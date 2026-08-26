# 批3A：手柄全导航（menu context 焦点导航）技术规格

- 日期：2026-08-26 · 基线：main @ df933e5（398 测 / tsc 0 / CI 四门绿）
- 分支：`feat/batch3a-gamepad-nav`（规格+计划先落 main，同批1/批2惯例）
- 上游底稿：[[审计报告二 #1 手柄全导航]]（darkhollow-audit-2026-08-24）；设计已于 2026-08-26 口头获批（空间最近邻 + 含 focus 即显 tooltip）

## 1. Context（现状与问题）

目标：Steam Deck / 手柄下全屏面可达——标题→选人→游玩→暂停/各面板→死亡/胜利/结局，纯手柄可完整循环。

现状（全部 @ df933e5 复核）：

- **手柄分发**：`pollGamepad` 60ms 轮询边沿触发（`src/input.ts:269-340`）。`overlay` 布尔是**手写清单**（input.ts:308-310：invOpen/skillOpen/talentOpen/achOpen/helpOpen/eventOpen/menuOpen/introOpen/options/forge），`G && !G.gameOver` 闸（:311）在 gameOver 且无 overlay 时跳过一切。
- **死区清单**（审计坐实）：①标题/选人屏 `G=null` → 手柄全死（`else if (overlay)` 分支 :332 不含它们）②死亡/胜利屏非 `.overlay`，gameOver 闸杀死输入 ③暂停菜单/事件选项/options 控件：overlay 态下 B 只会关（dispatchGamepadAction :249-263 的 `!overlay` 闸），A=wait 被闸，D-pad 无焦点移动 ④records/codex 不在手写 overlay 清单里。
- **发现的真 bug——ending-choice 按键泄漏**：`#ending-choice` 是 `.overlay`（index.html:107）但不在 input.ts 任何簿记里——弹窗开着时键盘按键走 gameplay 分发（movePlayer 照常），手柄同理。F40 弑神抉择等于鼠标专属。
- **选人浮层不可聚焦**：`showCharSelect`（`src/main.ts:113-183`）动态建 `div#char-sel`，`.race-opt/.class-opt/.mode-opt` 是**纯 div onclick 无 tabindex**——键盘 Tab 也只能到 Begin/Back 两按钮。
- **可复用基建**：键盘 Tab 圈闭（input.ts:64-77，选择器 `button,[tabindex="0"]`——**漏掉 input[type=range]** 等原生控件）；`showOverlay` 开面板即 focus 关闭钮 + `hideOverlay` 还焦（`src/ui-panels.ts:155-176`）；GP 改键全套（`src/keybinds.ts`，DEFAULT_BUTTONS :72-83：**LB(4)=quaff、RB(5)=descend**，菜单态本被 `!overlay` 闸成无效）；focus-visible 金边（main.css:359）。
- **DOM tooltip 现状**：`title` 属性三处——hotbar 槽（`src/items.ts:288`，自带 tabindex=0）、天赋格（`src/panels.ts:363`）、商人按钮（`src/events.ts:308,388`）。地图 canvas tooltip（ui-panels.ts:95-150）是 mousemove 坐标驱动，**不属本批范围**（canvas 无逐格焦点，见 Follow-ups）。
- **面板按钮盘点**（spatial 直接可用）：暂停菜单 3×.menu-btn+✕（index.html:111）；背包行内 mkInvBtn 动作钮（panels.ts:90-118 卖/丢/用/配槽）；事件弹窗 .evb（index.html:110）；熔炉/记录/图鉴/选项均为动态按钮。

## 2. Proposed Changes

### 2.1 新文件 `src/focus-nav.ts` —— 纯焦点工具（可单测，不读 DOM 内部状态）

```
focusablesIn(container): HTMLElement[]   // 'button,[href],input:not([type=hidden]),select,textarea,[tabindex]:not([tabindex="-1"])'
                                         // + 可见过滤(offsetParent) + disabled 排除，DOM 序
spatialNext(cur: Rect, cands: Array<{el: HTMLElement, r: Rect}>, dx, dy): HTMLElement | null
                                         // 方向半平面过滤 → score = 主轴距离 + 2×正交偏移，最小者胜；
                                         // 平局取中心距最近。rect 由调用侧读取传入——happy-dom 零 rect 也能注入数值测
stepRange(el: HTMLInputElement, dir: -1|1): boolean
                                         // input[type=range]: stepUp/stepDown + dispatch input+change（带 bubbles）
gpFocus(el: HTMLElement): void           // focus() + 上一元素移除 .gp-focus + 本元素加 .gp-focus + scrollIntoView({block:'nearest'})
seqFocus(container, dir: -1|1): void     // DOM 序前/后（LB/RB 用），绕圈
```

设计要点：`spatialNext` 吃纯数值 rect，DOM 读取留在调用侧（input.ts）——单测无需 mock getBoundingClientRect。

### 2.2 新文件 `src/menu-context.ts` —— 菜单上下文探测

```
activeMenuContext(): HTMLElement | null   // 优先级：
  1. document.querySelector('.overlay.active')      // 含 ending-choice/records/codex/pause/options——顺带修清单漏项
  2. #event-popup 可见（getComputedStyle display≠none）
  3. #char-sel 存在（节点移除即关）
  4. #title-screen 可见
  5. #death-screen 可见
  6. #victory-screen 可见
menuBack(): boolean   // 上下文级返回：overlay→泛化 closeActiveOverlay（input.ts 迁入/复用）；
                      // event-popup→closeEvent()；char-sel→#char-back-btn.click()；title/death/victory→false（B 无操作，A 走按钮）
```

### 2.3 `src/input.ts` pollGamepad 重构（核心）

capture 模式块之后：

```
const menu = activeMenuContext();
if (menu) {
  // 焦点导航态（不依赖 G，title/gameOver 自然覆盖）
  初始锚定: menu 内无焦点 → gpFocus(focusablesIn(menu)[0])
  D-pad/stick 方向（stick 复用 gpMoveCd 节流防连跳）:
    焦点在 input[type=range] 且方向水平 → stepRange(±1)，不移动焦点
    否则 → rect 计算 + spatialNext + gpFocus
  A(0)  → (document.activeElement in menu) ? .click() : gpFocus(first)
  B(1)  → menuBack()
  LB(4)/RB(5) → seqFocus(menu, ∓1)          // 菜单态重释（游戏态 quaff/descend 分发不动）
  Start(9) → menuOpen ? closePause() : (G&&!G.gameOver ? openPause() : noop)
} else if (G && !G.gameOver) {
  ……现行 gameplay 分发原样保留（stick 移动 + buttonToAction dispatch）……
}
// gameOver 且无 menu：保持死区（正确——死亡屏有按钮即 menu，纯尸体状态无输入）
```

键盘侧同修：keydown 早段加 ending-choice 闸（`#ending-choice.classList.contains('active')` → 仅放行 Tab 走原生圈闭，其余全部吞掉——该抉择无 ESC 关闭路径且是强制选择；键盘玩家用 Tab+Enter，手柄用 A）。

### 2.4 `src/main.ts` 选人浮层可聚焦

`.race-opt/.class-opt/.mode-opt` 模板加 `tabindex="0" role="button" aria-pressed`（选中态同步）；容器委托 keydown：Enter/Space → click()。选中回调里同步 aria-pressed。

### 2.5 tooltip 即显（`src/ui-panels.ts`）

document 级 `focusin/focusout` 委托：target 自带或 closest(`[title]`) 且 title 非空 → `#tooltip` 显示转义后 title（`\n`→`<br>`），定位元素 rect 下方（视口边缘翻转），focusout 隐藏。鼠标 hover 路径零改动。hotbar 槽（已有 tabindex=0）、天赋格、商人按钮即时受益。

### 2.6 `src/main.css`

`.gp-focus` 镜像 focus-visible 金边；`.race-opt:focus-visible,.class-opt:focus-visible,.mode-opt:focus-visible` 补金边（现无任何 focus 样式）。

### 2.7 不改的

keybinds.ts schema（重释层不加新 Action）；游戏态手柄语义（B 拾取等全保留）；键盘 Tab/数字键/面板快捷键行为；地图 canvas tooltip。

## 3. Testing and Validation

- **单测**（vitest+happy-dom，新文件 `src/__tests__/batch3a-focus-nav.test.ts` / `batch3a-menu-context.test.ts` / `batch3a-input-menu.test.ts` / `batch3a-charsel.test.ts` / `batch3a-tooltip-focus.test.ts`）：
  - spatialNext：网格/列表/平局/无候选 null/方向半平面（数值 rect 表驱动）
  - focusablesIn：hidden/disabled/tabindex=-1 过滤、range input 命中
  - stepRange：值变化 + input 事件派发
  - activeMenuContext：六种屏态各一 fixture（含 ending-choice.active 命中）
  - menuBack：各上下文映射
  - pollGamepad 菜单态：伪 gamepad（navigator.getGamepads stub）+ 真实 DOM 按钮断言 click/focus/gp-focus 类
  - char-sel：Enter/Space 激活 .race-opt、aria-pressed 同步
  - tooltip focusin/focusout 显隐
- **回归门**：398 基线全绿 + tsc 0 + build + smoke 65-0（键盘路径不动）
- **e2e 新脚本 `scripts/verify_gamepad_ingame.py`**（Playwright `channel='chrome'`，addInitScript 覆写 `navigator.getGamepads` 返回可变 `window.__pad`，press(idx) 模拟按下/抬起跨 60ms 轮询）验收**纯手柄全流程**（~15 检查）：
  1. 标题：D-pad 聚焦首钮（.gp-focus 断言）→ A 开新游戏 → char-sel 出现
  2. 选人：右移焦点跨列 → A 选职业（断言 aria-pressed）→ 聚焦 Begin → A 开局
  3. 游玩：Y 开背包 → D-pad 到动作钮 → A 点击（断言 inv 变化）→ B 关
  4. Start 暂停 → 下移到 Settings → A 开 options → tablist 左右换 tab → 聚焦 slider 左右调值（断言 DOM/持久化变化）→ B 关回暂停 → B 关暂停
  5. 事件弹窗（live 注入同批2法）：spatial 到选项 2 → A → eventFlags 断言
  6. 死亡屏：live 模块弄死玩家 → D-pad 聚焦 Try Again → A → 回选人屏
  7. 全程 0 console 错误

## 4. Parallelization

顺序单分支执行（同批1/批2 SDD 惯例）：T1 focus-nav → T2 menu-context → T3 input 重构（依赖 T1/T2）→ T4 char-sel → T5 tooltip → T6 CSS → T7 e2e+四门 → T8 final review。共享面集中在 input.ts/focus-nav.ts，强耦合不宜并行；每 task subagent implement+review，final opus 整分支终审。

## 5. Risks and Mitigations

- **程序化 focus 不触发 :focus-visible**（浏览器启发式）→ `.gp-focus` 类显式金边兜底
- **面板重渲染丢焦点**（renderInv innerHTML 重建）→ 下次方向键自动重新锚定首元素；LB/RB 可快跳，可接受
- **密集行间 spatial 跳跃感**（背包动作钮簇）→ 主轴+2×正交评分偏保守；LB/RB 顺序翻页作逃生门
- **stick 60ms 轮询连跳** → 复用 gpMoveCd 节流（焦点移动同 8 拍冷却）
- **happy-dom 无布局** → spatialNext 数值化设计（2.1）规避

## 6. Follow-ups（不属本批）

- 手柄地图格检查器（canvas tooltip 的手柄等价物：D-pad 光标模式）——独立特性
- overlay `role="dialog"`/`aria-modal` 语义层（审计另一低优先项）
- 死亡/胜利屏 B 键语义（当前 no-op）如有 playtest 反馈再议

## 7. 验收口径

纯手柄可完成：标题→新游戏→选人（换职业+模式）→开局→开背包操作物品→暂停菜单进 Settings 调滑条→事件弹窗做选择→死亡→Try Again。键盘全路径行为零回归（smoke 65 复现）。398+N 测全绿 + tsc 0 + build + e2e 新脚本全过 + 0 console 错。
