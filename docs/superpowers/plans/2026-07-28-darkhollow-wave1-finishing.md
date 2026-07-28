# darkhollow Wave 1 收尾打磨 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 darkhollow 加玩家移动 tile 补间(体感),补齐发布扫尾(README/LICENSE/图标/重建 exe),跑一轮全流程 QA。

**Architecture:** tile 补间 = 把玩家 sprite + 光晕从 `render()` 的静态 snapshot 层移入 `particles.tick()` 的动态层,移动时按格坐标做 easeOutQuad 位置插值(90ms,reducedMotion 下 0ms 瞬移),经 late-binding(`setDrawPlayerLayerFn`,沿用项目 `setXxxFn` 惯例)接线。发布扫尾 = README + MIT LICENSE + 程序化 256×256 图标(`@napi-rs/canvas` 画 → `png-to-ico` 转)+ electron-builder `win.icon` + 重建 portable exe。

**Tech Stack:** TypeScript 5.7 + Vite 6 + Canvas2D + Electron 42 + electron-builder 26;Web Audio(程序化音频);程序化像素 sprite;无外部美术/音频资源。

## Global Constraints

- **无自动化测试框架**(Wave 1 不引入)。验证 = `npm run typecheck` + `npm run build` + 手动 QA。每个 Task 的"测试"步骤即手动验证。
- **Steam 桥接维持 no-op**,本 Wave 不动(`steamworks.js` 未装,走 catch)。
- **只补间玩家**;敌人/物品留在静态 snapshot 层瞬移(敌人补间留 Wave 2)。
- **补间参数**:duration 90ms,easeOutQuad,`reducedMotion` 时 duration=0(瞬移)。
- **`package.json` 改动只发生在 Task 3**(图标/脚本)。Task 1 不碰 `package.json`。
- 代码引用 pin 到 commit `ab5b3b0`(TECH.md 同款)。
- 中文文案为主(README 中文;游戏 i18n 已中英);LICENSE 用 MIT。
- **频繁 commit**:每个 Task 结束一个 commit。
- **并行机会**:Task 1(改 `src/`)与 Task 2/3(建 README/LICENSE/scripts/build/、改 package.json)**文件集不重叠,可并行**;Task 4 必须在 Task 1-3 全部完成后顺序执行(依赖最终代码 + package.json)。

---

## File Structure

| 文件 | 动作 | 责任 |
|------|------|------|
| `src/render.ts` | Modify | 加 tween 状态/`setPlayerTween`/`drawPlayerLayer`;移除 `render()` 里玩家静态绘制(L205-212) |
| `src/particles.ts` | Modify | 加 `_drawPlayerLayer`/`setDrawPlayerLayerFn`;`tick()` 里调用 |
| `src/main.ts` | Modify | import + 接线 `setDrawPlayerLayerFn(drawPlayerLayer)` |
| `src/player.ts` | Modify | import `setPlayerTween`;`movePlayer` 触发补间;删 `fxDash` 调用 |
| `README.md` | Create | 项目说明 / 运行 / 操作 / 架构 |
| `LICENSE` | Create | MIT |
| `scripts/gen-icon.mjs` | Create | 程序化生成 `build/icon.ico` |
| `build/icon.ico` | Create(产物,进 git) | 应用图标 |
| `package.json` | Modify | devDeps + `gen:icon` 脚本 + `build.win.icon` |
| `release/`(gitignored) | 重建 | 新 portable exe |

---

## Task 1: tile 轻量补间(玩家进动态层)

**Files:**
- Modify: `src/render.ts`、`src/particles.ts`、`src/main.ts`、`src/player.ts`

**Interfaces:**
- Produces: `setPlayerTween(fx: number, fy: number, tx: number, ty: number): void`(render.ts 导出);`drawPlayerLayer(c: CanvasRenderingContext2D): void`(render.ts 导出);`setDrawPlayerLayerFn(fn: ((c: CanvasRenderingContext2D) => void) | null): void`(particles.ts 导出)。

- [ ] **Step 1: `render.ts` import 补 `reducedMotion`**

把第 2 行:
```ts
import { G, canvas, ctx, miniCtx, minimapScale, lang } from './state.js';
```
改为:
```ts
import { G, canvas, ctx, miniCtx, minimapScale, lang, reducedMotion } from './state.js';
```

- [ ] **Step 2: `render.ts` 加 tween 状态 + `setPlayerTween` + `drawPlayerLayer`**

在 import 块之后、`let minimapCanvas` 之前插入:
```ts
// Player tween — player lives in the dynamic layer (particles.tick) so its
// position can slide between tiles. Logic stays discrete (turn-based).
interface PlayerTween { fx: number; fy: number; tx: number; ty: number; t0: number; }
let _playerTween: PlayerTween | null = null;
const TWEEN_DUR_MS = 90;

export function setPlayerTween(fx: number, fy: number, tx: number, ty: number): void {
  if (reducedMotion) { _playerTween = null; return; } // reduced-motion: instant
  _playerTween = { fx, fy, tx, ty, t0: performance.now() };
}

// Called every frame by particles.ts tick() on top of the snapshot.
export function drawPlayerLayer(c: CanvasRenderingContext2D): void {
  if (!G) return;
  let lx = G.player.x, ly = G.player.y;
  if (_playerTween) {
    const p = Math.min(1, (performance.now() - _playerTween.t0) / TWEEN_DUR_MS);
    const e = 1 - (1 - p) * (1 - p); // easeOutQuad
    lx = _playerTween.fx + (_playerTween.tx - _playerTween.fx) * e;
    ly = _playerTween.fy + (_playerTween.ty - _playerTween.fy) * e;
    if (p >= 1) _playerTween = null;
  }
  const px = (lx - G.vx) * TS, py = (ly - G.vy) * TS;
  const pGrad = c.createRadialGradient(px + TS / 2, py + TS / 2, 2, px + TS / 2, py + TS / 2, TS * 1.5);
  pGrad.addColorStop(0, 'rgba(255,215,0,0.12)');
  pGrad.addColorStop(0.5, 'rgba(255,215,0,0.05)');
  pGrad.addColorStop(1, 'rgba(255,215,0,0)');
  c.fillStyle = pGrad; c.fillRect(px - TS * 0.5, py - TS * 0.5, TS * 2, TS * 2);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  drawPlayerSprite(c, px, py, G.player.ci);
}
```

- [ ] **Step 3: `render.ts` 移除 `render()` 里玩家静态绘制**

删掉 `render()` 中 [L205-212](https://github.com/xieyj22/darkhollow_win/blob/ab5b3b0/src/render.ts#L205-L212) 这几行(玩家底色 `#2a1a00`、径向光晕 `pGrad`、`drawPlayerSprite`),**保留 [L204](https://github.com/xieyj22/darkhollow_win/blob/ab5b3b0/src/render.ts#L204) 的 `const px = ..., py = ...`**(vignette L215+ 还要用)。删后 `render()` 末尾应直接从 L204 的 `px/py` 声明接到 vignette 段。

- [ ] **Step 4: `particles.ts` 加动态层 sink**

在 import 块之后、`const MAX_PARTICLES` 之前插入:
```ts
// Late-bound player-layer drawer (set from render.ts via main.ts wiring).
let _drawPlayerLayer: ((c: CanvasRenderingContext2D) => void) | null = null;
export function setDrawPlayerLayerFn(fn: ((c: CanvasRenderingContext2D) => void) | null): void {
  _drawPlayerLayer = fn;
}
```

- [ ] **Step 5: `particles.ts` `tick()` 里调用动态层**

在 `tick()` 的 `drawImage` 块结束之后(约 [L96](https://github.com/xieyj22/darkhollow_win/blob/ab5b3b0/src/particles.ts#L96))、`// Spawn new particles`(约 L98)之前插入:
```ts
  // Player layer — drawn from the tweened position on top of the snapshot.
  if (_drawPlayerLayer) _drawPlayerLayer(c);
```

- [ ] **Step 6: `main.ts` 接线**

第 23 行 render 的 import 末尾加 `drawPlayerLayer`:
```ts
import { render, renderMinimap, resizeCanvas, updateUI, markMinimapDirty, drawPlayerLayer } from './render.js';
```
第 29 行 particles 的 import 加 `setDrawPlayerLayerFn`:
```ts
import { startParticles, stopParticles, setDrawPlayerLayerFn } from './particles.js';
```
在接线区([L41](https://github.com/xieyj22/darkhollow_win/blob/ab5b3b0/src/main.ts#L41) `setKillEnemyFn(killEnemy);` 之后)加:
```ts
setDrawPlayerLayerFn(drawPlayerLayer);
```

- [ ] **Step 7: `player.ts` 触发补间 + 删 `fxDash` 调用**

import 块加(与现有 `import { flt } from './effects.js';` 同区):
```ts
import { setPlayerTween } from './render.js';
```
`movePlayer()` 中 [L78-80](https://github.com/xieyj22/darkhollow_win/blob/ab5b3b0/src/player.ts#L78-L80) 改为:
```ts
  const pfx = G.player.x, pfy = G.player.y;
  G.player.x = nx; G.player.y = ny;
  setPlayerTween(pfx, pfy, nx, ny);
```
(即:新增 `setPlayerTween(...)` 一行;**删除**原 `fxDash(pfx, pfy, nx, ny, '#ffd700');` 一行。`fx.ts` 的 `fxDash` 定义保留。)

- [ ] **Step 8: typecheck + build**

Run: `npm run typecheck` → Expected: 无错误。
Run: `npm run build` → Expected: `tsc && vite build` 成功。

- [ ] **Step 9: 手动 QA(补间专项)**

Run: `npm run dev`,浏览器打开,新游戏进关卡。
验证清单(逐项确认):
- 单次按方向键:玩家从旧格**平滑滑到**新格(约 90ms),不是瞬移。
- 连续快速按方向键:无撕裂、无重影(每次移动重置 tween)。
- 选项面板开 `reducedMotion`(或在 `main.ts` 临时设):移动变回**瞬移**。
- 移动补间途中按 ESC 开暂停、再关:恢复后玩家不卡在中间位置(下回合正常)。
- tooltip(鼠标悬停敌人/物品)、minimap 正常不受影响。
若任一项不过:回到对应 step 修,不进入 commit。

- [ ] **Step 10: Commit**

```bash
git add src/render.ts src/particles.ts src/main.ts src/player.ts
git commit -m "feat: 玩家移动 tile 补间(动态层位置插值)"
```

---

## Task 2: README + LICENSE

**Files:**
- Create: `README.md`、`LICENSE`

**Interfaces:** 无(独立文档)。

- [ ] **Step 1: 写 `README.md`**

内容(中文为主):
```markdown
# Depths of Darkhollow

一款 ASCII roguelike 地下城 crawler。纯 TypeScript + Canvas 2D,程序化音频与像素 sprite,无外部美术/音频资源。jam 原型,持续打磨中。

## 运行

```bash
npm install        # 装依赖(electron 二进制走 .npmrc 镜像)
npm run dev        # Vite dev server(浏览器,:5173)
npm run build      # tsc + vite build(类型检查 + 产物)
npm run electron:preview   # build 后用 Electron 打开
npm run dist       # build + electron-builder 打 Win portable exe → release/
npm run gen:icon   # 重新生成 build/icon.ico
```

## 操作

| 键 | 动作 | | 键 | 动作 |
|----|------|-|----|------|
| WASD / 方向键 | 移动 | | F | 等待 |
| 1-9 | 快捷道具 | | Q | 喝药 |
| B | 背包 | | R | 读卷 |
| G | 拾取 | | T | 成就 |
| > | 下楼 | | L | 切语言 |
| K | 技能 | | M | 静音 |
| Ctrl+S | 保存 | | ESC | 暂停 |

**目标**:下到第 40 层击败创世者。每 5 层一个 Boss。手柄亦支持(Start 暂停)。

## 技术栈

TypeScript 5 · Vite 6 · Canvas 2D · Electron 42 · electron-builder 26 · Web Audio API(程序化 BGM/SFX)。

## 架构要点

- **渲染双轨**:`render()` 每回合整屏重绘 + `captureSnapshot()`;`particles.ts` 持续 rAF 循环在 snapshot 上叠加粒子 / FX / 震屏 / 玩家补间层。
- **late-binding**(`setXxxFn`)解模块间循环依赖。
- **存档双写**:localStorage(同步)+ Electron 文件 `userData/darkhollow-save.json`(异步,供 Steam Cloud)。
- 表驱动内容:`data.ts` 的 `ENEMIES` / `RELICS` / `META_UPGRADES` / `ACH_DEFS`。

## License

MIT。
```

- [ ] **Step 2: 写 `LICENSE`**

MIT 全文,版权行:`Copyright (c) 2026 xieyj22`。(用 MIT 标准模板。)

- [ ] **Step 3: Commit**

```bash
git add README.md LICENSE
git commit -m "docs: README + MIT LICENSE"
```

---

## Task 3: 应用图标 + 打包配置

**Files:**
- Create: `scripts/gen-icon.mjs`、`build/icon.ico`
- Modify: `package.json`

**Interfaces:** 产出 `build/icon.ico` + `package.json` 的 `build.win.icon` + `scripts.gen:icon`。

- [ ] **Step 1: 装 devDeps**

Run: `npm i -D @napi-rs/canvas png-to-ico`
Expected: 两个包写入 `devDependencies`(`@napi-rs/canvas` 预编译二进制走 npmmirror)。若 `@napi-rs/canvas` 二进制下载失败,确认 `.npmrc` 镜像或重试。

- [ ] **Step 2: 写 `scripts/gen-icon.mjs`**

```js
// 程序化生成 build/icon.ico(256×256)。运行:node scripts/gen-icon.mjs
import { createCanvas } from '@napi-rs/canvas';
import pngToIco from 'png-to-ico';
import { writeFileSync, mkdirSync } from 'node:fs';

const S = 256;
const c = createCanvas(S, S);
const x = c.getContext('2d');

// 背景:深黑 + 淡紫径向
x.fillStyle = '#05050a'; x.fillRect(0, 0, S, S);
let bg = x.createRadialGradient(S / 2, S / 2, 8, S / 2, S / 2, S / 1.4);
bg.addColorStop(0, 'rgba(60,20,80,0.5)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
x.fillStyle = bg; x.fillRect(0, 0, S, S);

// 金色断环
x.strokeStyle = '#ffd700'; x.lineWidth = 10;
x.beginPath(); x.arc(S / 2, S / 2, 92, 0, Math.PI * 2); x.stroke();

// 中心深渊之眼:红径向
let eye = x.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, 60);
eye.addColorStop(0, '#ff5544'); eye.addColorStop(0.6, '#7a0a0a'); eye.addColorStop(1, '#1a0000');
x.fillStyle = eye; x.beginPath(); x.arc(S / 2, S / 2, 58, 0, Math.PI * 2); x.fill();

// 几粒金点
x.fillStyle = '#ffd700';
for (const [dx, dy, r] of [[-70, -70, 3], [80, -60, 2], [-60, 80, 2.5], [70, 70, 2]]) {
  x.beginPath(); x.arc(S / 2 + dx, S / 2 + dy, r, 0, Math.PI * 2); x.fill();
}

mkdirSync('build', { recursive: true });
const pngBuf = c.toBuffer('image/png');
const icoBuf = await pngToIco(pngBuf);
writeFileSync('build/icon.ico', icoBuf);
console.log('wrote build/icon.ico');
```
> 若 `png-to-ico` 安装版本是 named export,把第 2 行改为 `import { pngToIco } from 'png-to-ico';`(以包 README 为准)。

- [ ] **Step 3: 生成图标**

Run: `node scripts/gen-icon.mjs`
Expected: 控制台 `wrote build/icon.ico`;`build/icon.ico` 存在。打开看一眼是黑底金环红眼。

- [ ] **Step 4: `package.json` 加脚本 + icon 配置**

`scripts` 块加一行:
```json
"gen:icon": "node scripts/gen-icon.mjs",
```
`build.win` 块加 `icon` 字段(在 `"target"` 之前):
```json
"win": {
  "icon": "build/icon.ico",
  "target": [ ... ]
}
```

- [ ] **Step 5: typecheck 验证不破坏**

Run: `npm run typecheck` → Expected: 无错误(脚本/配置不参与 tsc,确认未误改 `.ts`)。

- [ ] **Step 6: Commit**

```bash
git add scripts/gen-icon.mjs build/icon.ico package.json package-lock.json
git commit -m "build: 程序化应用图标 + electron-builder win.icon"
```

---

## Task 4: 重建 portable exe + 全流程 QA

**Files:**
- 产物:`release/`(gitignored,**不 commit**)。

**Interfaces:** 依赖 Task 1-3 全部完成。

- [ ] **Step 1: 重建 portable exe**

Run: `npm run dist`
Expected: `npm run build` 成功 + electron-builder 生成 `release/Depths of Darkhollow 1.0.0.exe`(含最新代码 + 新图标)。若二进制重下撞镜像,复用 `.npmrc` / `ELECTRON_MIRROR` 配置重试。

- [ ] **Step 2: 删旧 exe**

删除 `release/` 下 6/14 的旧 exe(文件名相同则已被覆盖;若有残留旧文件手动删)。

- [ ] **Step 3: 新 exe 冒烟**

双击新 `release/*.exe`:
- 启动正常,任务栏/窗口图标是新的(黑底金环红眼),不是 Electron 默认。
- 进游戏,移动:确认**补间平滑**(非瞬移)。
- 标题画面、选项面板正常。

- [ ] **Step 4: 全流程 QA 清单**

手动通关一条路径,逐项记录过/不过:
- 新游戏(选族裔+职业)→ 进入第 1 层。
- 拾取金币/装备、装备穿脱、背包(B)。
- 打怪、升级、技能(K)。
- 到达第 5 层 Boss,战斗(可酌情调试强度进入)。
- 死亡或胜利画面。
- **存档/读档**:Ctrl+S 保存 → 关闭重开 → 继续(`btn-cont`)。重点:若有更早版本的存档,验证 `loadGame()` 老字段迁移分支不崩。
- 选项面板:Audio/Display/Accessibility/Gameplay 各项可调;色弱滤镜、文字大小、reducedMotion、震屏强度生效。
- 手柄:移动、Start 暂停。
- 切语言(L)中英都正常。

- [ ] **Step 5: 记录与收尾**

QA 结果记录(过/不过 + 不通过的复现)。若全部通过 → Wave 1 完成。若有 bug → 单开修复(回到对应 Task,小修 + commit),不改本 plan 的成功标准。

(产物 `release/` 被 gitignore,无需 commit。)

---

## Self-Review(plan 写完后自检结果)

- **Spec coverage**:tile 补间(Task 1)✓、README/LICENSE(Task 2)✓、图标/打包(Task 3)✓、重建 exe + QA(Task 4)✓。TECH.md 的 Proposed changes A/B/C 与 Success criteria 全覆盖。
- **Placeholder scan**:每步含实际代码 / 命令 / 预期;`png-to-ico` import 模式给了 default + named fallback(第三方 API 现实,非占位)。
- **Type consistency**:`setPlayerTween` / `drawPlayerLayer` / `setDrawPlayerLayerFn` 在 Task 1 各 step 与 Interfaces 名字一致;`_playerTween` / `TWEEN_DUR_MS` 一致。
- **YAGNI**:只补间玩家(敌人留静态);不引入测试框架;`fxDash` 定义保留不删。
