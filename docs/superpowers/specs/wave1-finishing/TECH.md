# Wave 1 收尾打磨:tile 轻量补间 + 发布就绪

技术规格。对梁为 `darkhollow`(`Depths of Darkhollow`,TS + Canvas2D + Vite + Electron 的 ASCII roguelike)。本规格是 Wave 1 实现与验收的唯一对照基准。产品意图以 brainstorming 口头获批为准(策略 A「收尾优先」)。

提交基准:`ab5b3b0`(已 push `origin/main`)。下文代码引用均 pin 到此 commit。

---

## Context

渲染是**「离散重绘 + 连续动画层」双轨**:

- [`render.ts` `render()` (L58-233) @ ab5b3b0](https://github.com/xieyj22/darkhollow_win/blob/ab5b3b0/src/render.ts#L58-L233) —— 每回合调用一次,整屏重绘地形/陷阱/物品/敌人/玩家,末尾 [`captureSnapshot()` (L231-233)](https://github.com/xieyj22/darkhollow_win/blob/ab5b3b0/src/render.ts#L231-L233) 把当前画面存进 offscreen canvas。
- [`particles.ts` `tick()` (L80-145) @ ab5b3b0](https://github.com/xieyj22/darkhollow_win/blob/ab5b3b0/src/particles.ts#L80-L145) —— 持续 `requestAnimationFrame` 循环:每帧 `drawImage(snapshot)` 恢复,再叠加环境粒子 → `drawFx` → `applyShakeFrame`。**动画层已存在**,补间天然挂这里。
- [`render.ts` 玩家绘制 (L204-212) @ ab5b3b0](https://github.com/xieyj22/darkhollow_win/blob/ab5b3b0/src/render.ts#L204-L212) —— `#2a1a00` 底 + 径向光晕 + `drawPlayerSprite(c, px, py, ci)`。其后是 vignette / warm tint / scanline 等全屏后处理(基于玩家逻辑位置)。**这一段是独立、可摘出的。**

移动是瞬时的:[`player.ts` `movePlayer()` (L62-103) @ ab5b3b0](https://github.com/xieyj22/darkhollow_win/blob/ab5b3b0/src/player.ts#L62-L103) —— [L78-80](https://github.com/xieyj22/darkhollow_win/blob/ab5b3b0/src/player.ts#L78-L80) 记旧坐标、直接赋新坐标、调 `fxDash()` 残影,随后 `endTurn()` → `render()`。结果:玩家在 snapshot 里已是目的地,视觉上是**瞬移 + 残影**,没有格子间的滑动。

项目无自动化测试框架(`typecheck` = `tsc --noEmit` 是唯一质量门),Wave 1 也不引入。验证以 typecheck + 手动 QA 为主。Steam 桥接维持现状(`steamworks.js` 未装,走 no-op),本 Wave 不动。

---

## 目标与范围(Wave 1)

1. **tile 轻量补间**:玩家移动时格子间平滑滑过,逻辑保持离散回合制。
2. **发布扫尾**:README / LICENSE / 应用图标 / 重建 portable exe。
3. **QA 基线**:手动通关 + 存档迁移 + 手柄 + 选项 + 补间体感。

**边界**:只补间**玩家**。敌人/物品留在静态层瞬移(敌人补间要动 `processEnemies` 且每帧画全部敌人,工作量翻倍、收益低,留 Wave 2 评估)。

---

## Proposed changes

### A. tile 轻量补间 —— 玩家从静态层移入动态层

**核心思路**:玩家 sprite + 光晕不再画进 snapshot,改由 `tick()` 每帧用插值位置绘制。只动这一个实体的归属,不重构整体架构。

**`render.ts`**
- 移除 `render()` 中 [L205-212](https://github.com/xieyj22/darkhollow_win/blob/ab5b3b0/src/render.ts#L205-L212) 的玩家底色(`#2a1a00`)、径向光晕、`drawPlayerSprite`;**保留** [L204](https://github.com/xieyj22/darkhollow_win/blob/ab5b3b0/src/render.ts#L204) 的 `px/py` 声明与后续 vignette(vignette 仍按玩家逻辑位置画,进 snapshot)。
- 新增 module 级补间状态与导出:
  - `let _playerTween: { fx, fy, tx, ty, t0, dur } | null`
  - `export function setPlayerTween(fx, fy, tx, ty)`:`t0 = performance.now()`,`dur = reducedMotion ? 0 : 90`。
  - `export function drawPlayerLayer(c: CanvasRenderingContext2D)`:读 `_playerTween`,算 `progress = clamp((now - t0) / dur, 0, 1)`,`easeOutQuad` 缓动,`lerp` 得当前格坐标,转屏幕 `(lx - G.vx) * TS` / `(ly - G.vy) * TS`,画光晕 + `drawPlayerSprite`;`progress >= 1` 清空 tween。`dur === 0` 时首帧即终点(=瞬移)。

**`particles.ts`**
- module 级 `let _drawPlayerLayer: ((c) => void) | null = null` + `export function setDrawPlayerLayerFn(fn)`(late-binding,沿用项目 [main.ts L32-41](https://github.com/xieyj22/darkhollow_win/blob/ab5b3b0/src/main.ts#L32-L41) 的 `setXxxFn` 模式)。
- `tick()` 里 `drawImage(snapshot)` 之后、`drawFx` 之前插入 `_drawPlayerLayer?.(c)`。顺序:`drawImage → 玩家层 → 粒子 → drawFx → applyShakeFrame`(玩家随震屏抖,符合预期)。

**`player.ts`**
- `import { setPlayerTween } from './render.js'`,`movePlayer()` 赋新坐标后([L79](https://github.com/xieyj22/darkhollow_win/blob/ab5b3b0/src/player.ts#L79) 之后)调 `setPlayerTween(pfx, pfy, nx, ny)`(格坐标)。无循环依赖:`render → particles` 已存在单向,`player → render` 单向,`particles` 不 import `render`。

**`main.ts`**
- 接线:`setDrawPlayerLayerFn(drawPlayerLayer)`(与现有 `setXxxFn` 并列)。

**`fxDash` 去留**:补间接管「移动平滑」语义后,`fxDash` 的瞬移残影变得多余。倾向在补间期间移除残影、或改为半透明拖影增强。具体在 plan 阶段定(读 `fx.ts` 后决定),本规格只锁定「移动视觉由补间主导」。

### B. 发布扫尾

- `README.md`:运行(`npm run dev`)、构建/打包(`build` / `dist` / `electron:preview`)、操作速查(复用标题画面的键位说明)、技术栈与架构一段、当前状态(jam 原型)。
- `LICENSE`:MIT(与作者其他公开发布项目一致)。
- 应用图标:用 `sprites.ts` 风格程序化绘制 256×256「暗渊」主题图,转 `build/icon.ico`;在 `package.json` 的 electron-builder 配置加 `icon` 字段。**`package.json` 的改动只发生在 B**。
- 重建:`npm run dist` 生成新 portable exe,确认含最新代码 + 图标;删除 6/14 旧 `release/*.exe`。

### C. QA 基线(手动清单)

新游戏 → 拾取/装备 → 打怪升级 → Boss 层 → 死亡或胜利;存档/读档(重点验 `loadGame()` 老存档字段迁移分支);选项面板各项;手柄移动/菜单;**补间体感**(滑动跟手、连续快移不撕裂、reducedMotion 下瞬移、暂停/选项期间 tween 不残留)。

---

## Testing and validation

- `npm run typecheck`(`tsc --noEmit`)必过。
- `npm run build`(`tsc && vite build`)必过。
- QA 清单(上文 C)逐项记录过/不过。
- **补间专项**:单次移动观察滑格;连续快速移动无撕裂/重影;`reducedMotion` 开关切换后瞬移;tween 在补间途中打开暂停/选项,恢复后不卡在中间位置。
- **exe 冒烟**:新 portable exe 启动 → 进游戏 → 移动,确认含补间 + 新图标。

---

## Parallelization

改动量小且 A、B 耦合度低,可用两个并行 sub-agent:

- **Agent A「tile 补间」**:`render.ts` + `particles.ts` + `player.ts` + `main.ts` 接线。local,主工作树。
- **Agent B「发布扫尾」**:`README.md` + `LICENSE` + 图标 + `package.json`(build.icon)。local,主工作树。

**协调边界**:`package.json` 仅由 B 拥有(A 不碰),避免并发 clobber。A、B 文件集互不重叠。**QA + 重建 exe 必须在 A/B 都完成后顺序执行**(依赖最终代码与 `package.json`)。

考虑到改动总量小(A≈4 文件、B≈4 文件),串行也很短;但 A 是核心且需视觉 QA,A 先做或并行均可。默认:A、B 并行 → 合并 → 统一 QA + 重建 exe。无需 worktree(主工作树文件集不冲突,`package.json` 归属已明确)。

---

## Risks and mitigations

- **snapshot 不含玩家后,光晕(vignette 之前的 pGrad)与 sprite 错位**:补间仅 90ms、最多半格,可接受;若明显,把光晕也移入 `drawPlayerLayer`(本规格已如此设计——光晕随 sprite 一起进动态层)。
- **每帧多画 1 个 sprite + 1 radial gradient**:成本可忽略(远小于环境粒子)。
- **reducedMotion 路径**:`dur=0` 时首帧 progress=1,tween 立即完成,不卡插值。
- **tooltip / minimap 回归**:`initTooltip` 用鼠标→格坐标、`renderMinimap` 独立 canvas,均不依赖玩家像素位置,不受影响(已在 Context 核对)。
- **打包镜像**:复用现有 `.npmrc`(6/14 已成功打过 portable exe);若二进制重下撞镜像,按既有 ELECTRON_MIRROR 配置处置。

---

## Follow-ups

- 敌人补间(Wave 2 评估,需动 `processEnemies` + 每帧画全部敌人)。
- 程序化像素美术升级(`sprites.ts`,Wave 2)。
- 内容扩展:新敌人/圣物/meta + 平衡性(Wave 2),新生物群系/楼层 + 新机制(Wave 3)。
- Steamworks 真激活(待 AppID,独立任务,本 Wave 保持 no-op)。
- 引入单测框架(可选;目前 typecheck + QA 足够)。
