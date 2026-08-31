# TECH 批9「体验缝合」— 7 项游玩体验修复与精修

- 状态: 已获用户批准的设计（2026-08-31 会话）落规格
- 基线: main @ `f4138b4`（1.5.0，批6-8 已并入），vitest 530 绿
- 产品意图来源: 用户 8 条游玩反馈中的 ①②④⑤⑥⑦⑧（③ 核心创新已分流为批10）

## Context

七个独立但同批落地的体验问题。全部现状已实地摸底，关键代码如下（均为 `f4138b4`）：

**道具栏截断（①）**: hotbar 是纯 DOM（`<div id="hotbar">` + 9 个 `.hb-slot`），渲染于 [`src/items.ts:273`](https://github.com/xieyj22/darkhollow_win/blob/f4138b4/src/items.ts#L273) `renderHotbar()`。每格 40×40px（`style/main.css:301`），名字在格内 `.hb-sub`，`max-width:52px` + `-webkit-line-clamp:2`（`main.css:306`）。`--fs-floor = 12px × --fs-scale`（Text Size 最大 1.5），4 个中文字在默认缩放下 48px 勉强一行，调大文字必然换行截断。格子还带原生 `title` 属性（`items.ts:288`），与自定义 `#tooltip` 双提示叠加。

**UI 温和精修（②）**: HUD 全 CSS/DOM 布局，`index.html:25-87`（`#sidebar` / `#right-panel`）。`style/main.css`（436 行）已有完整 token 体系（`:root` 1-55：radius/fs/sp/dur/z 全套）。精修=token 层统一出手，不动布局与 DOM 结构。

**商人消失（④）**: 玩家踏入实体格即删实体后触发——[`src/player.ts:94-98`](https://github.com/xieyj22/darkhollow_win/blob/f4138b4/src/player.ts#L94-L98) `G.items = G.items.filter(i => i !== npcEntity); triggerNpc(npcEntity);`。三类商人（`merchant` 35%/层、`treasure_merchant` 每 5 层、`endless_merchant` F41+ 每 3 层）都走这条路，故全部"交互一次即消失"。库存本就挂在实体 `entity.stock`（`types.ts:193-194`，`events.ts:296,374-376` 懒加载 roll），常驻化顺理成章。触发在"踏入格子"时发生，站立期间不重复触发。

**小地图不持久（⑤）**: 设置三层存储齐备（`state.ts:61-62` 内存+localStorage+Steam Cloud；`settings.ts:172-183` schema 键 `minimap`）。bug 根因在 [`src/render.ts:244-245`](https://github.com/xieyj22/darkhollow_win/blob/f4138b4/src/render.ts#L244-L245) `resizeCanvas()` 硬编码 `mc.width = MW * 3`，开局/读档/窗口变化时把画布钳回默认 3 倍。`renderMinimap()`（`render.ts:397-411`）本身读 `minimapScale`，只是可见画布尺寸错了。

**售卖 bug（⑥）**: `sellMode` 是模块级导出变量（`panels.ts:16`），**唯一清零点是 `closeInventory()`**（`panels.ts:25-30`）。鼠标 ✕ 关背包走 [`src/main.ts:160`](https://github.com/xieyj22/darkhollow_win/blob/f4138b4/src/main.ts#L160) 只 `setInvOpen(false)+hideOverlay` 不经 `closeInventory`；之后任何入口重开背包 `openInventory()`（`panels.ts:19-23`）也不重置——售卖态泄漏。键盘 ESC（`input.ts:158`）与手柄 B（`menu-context.ts:18`）走正路会清，故鼠标流才撞上。`sellItem`（`items.ts:370-379`）守卫只有 gameOver 与索引，与商人无关联。

**宝藏商人定价（⑦）**: [`src/events.ts:273-276`](https://github.com/xieyj22/darkhollow_win/blob/f4138b4/src/events.ts#L273-L276) `base=[150,320,640,1200,2400][rarity] + floor*18`，库存强制 rarity≥3（`events.ts:288`），实际售价 F5=1290/2490，F40=1920/3120。玩家金币收入曲线（实测代码）：每层 3-7 堆金 × `rng(5,15)+floor*3` ≈ **50+15×楼层/层**，F1-F5 累计拾金 ≈475，加变卖（`itemToGold×1.5`）约 600-700 总入。F5 要价 1290-2490 完全够不着。对照：流浪商人同层商品 62 金左右。

**tooltip 残留（⑧）**: `initTooltip()`（`ui-panels.ts:100-158`）只绑 `gameCanvas`：mousemove 250ms 防抖显示、mouseleave 隐藏、**无 TTL 无帧校验**。三条残留路径：a) 鼠标停住后目标被键盘操作弄消失（走开/捡起/敌人死亡），无人隐藏；b) 焦点 tooltip（`initFocusTooltips` `ui-panels.ts:164-182`）依赖 focusout，但 `renderHotbar()`/`renderInv()` 每回合 `innerHTML` 重渲染，聚焦元素被移除时浏览器不触发 focusout，tooltip 卡屏；c) hotbar 原生 `title` 的 OS 级延迟消失（1-2s+）。DOM 侧（hotbar/背包）没有任何自定义 tooltip。

## Proposed changes

### T1 道具栏放大 + 常驻名条（①）
- `main.css`: `.hb-slot` 40→**50px**（图标 canvas 显示 20→24px），`.hb-sub` 改单行 `white-space:nowrap; text-overflow:ellipsis`（宽度=格宽），移动端断点 44→54px。
- `items.ts` `renderHotbar()`: 新增格子上方常驻名条 `#hb-name`（`aria-hidden` 的纯视觉行），显示**焦点/悬停格**道具全名+数量；`tabindex=0` 焦点模型不动（批3A 手柄导航零回归）。焦点变化经 focusin 更新，重渲染后从 `document.activeElement` 恢复。
- 移除 `.hb-slot` 的 `title` 属性，保留/补 `aria-label`（原生 title 的消亡归 T7 接管）。

### T2 UI 温和精修（②）
只动 CSS 属性与少量文案类 token，**不改 DOM 结构、不改类名/id**（e2e 选择器零影响）：
- 消息日志 `#log-panel` 顶部渐隐遮罩（`mask-image` 线性渐变）。
- 侧栏数值行 `font-variant-numeric: tabular-nums` 对齐；面板标题统一字号/字距 token。
- 按钮统一 hover/active 态（`--border-bright` + 背景微抬升），过渡仅 `--dur-fast` 且包 `@media (prefers-reduced-motion: no-preference)`（沿用仓库既有 5 站点约定）。
- 焦点环统一 2px outline offset。
- 交付时附 2 张截图对比（沿用 hc/textScale 截图先例），目检归档。

### T3 商人常驻（④）
- `player.ts:94-98`: 只对 `npc === 'chest'` 与事件站实体保持"删后触发"；`merchant` / `treasure_merchant` / `endless_merchant` **不删除**，照常 `triggerNpc`。事件站 once 语义（批4 eventFlags）不动。
- 触发时机维持"踏入格子"：站立关闭弹窗后不重复弹，离开再回来才再触发（roguelike 惯例语义）。
- 宝藏/endless 库存挂实体（现状即如此）→ 本层内买剩的可回头补买；流浪商人每次交互重 roll 神秘货（现状行为，价格随回合上涨的经济曲线不变）。
- 售罄的宝藏商人保留实体，弹窗显示售罄文案（新增 i18n 键 `ev.treasureSoldOut` en/zh，过 parity 门）。

### T4 小地图跨层持久（⑤）
- `render.ts:244-245`: `mc.width = MW * minimapScale; mc.height = MH * minimapScale;`（从 `state.ts` 引入），随后 `markMinimapDirty()`（canvas width 赋值会清空内容，必须重画）。两行修复。

### T5 售卖 bug 收口（⑥）
- `main.ts` ✕ 按钮 handler 改调 `closeInventory()`（统一收口，`sellMode` 必清）。
- `panels.ts` `openInventory(opts?: {sell?: boolean})`：无参/`{sell:false}` 调用时重置 `sellMode=false`；`openInventorySell()` 改传 `{sell:true}`。售卖态生命周期=「本次背包开启」，键盘 `input.ts:253`、手柄 menu-context 等所有非商人入口自动归位。

### T6 宝藏商人降价（⑦）
- `events.ts:273-276`: r3 基价 1200→**420**，r4 2400→**880**，楼层系数 18→**8**（r0-2 死分支原样保留）。新价：F5=460/920、F20=580/1040、F40=740/1200。
- 曲线核验：F5 r3≈首见层累计金币入的 65-75%（攒钱可达的"贵但非天价"）；F20 r4≈该点累计入 ~25%。叠加 T3 常驻（可回头补买），前期体验双重缓解。

### T7 tooltip 时机（⑧）
- **目标校验**：`showTooltip` 显示时缓存目标引用（敌人对象/物品对象/地块键）。`updateUI()`（`render.ts:476`，每回合必经）末尾追加 `validateTooltip()`（经 bridge）：目标已从 `G.enemies`/`G.items` 消失或不再可见 → 立即隐藏。键盘弄消失的目标从此秒隐。不做 TTL（目标仍有效时持续显示是正确行为）。
- **焦点陈旧校验**：`validateTooltip` 同时检查 `document.activeElement === document.body`（innerHTML 重渲染吞焦点的特征）→ 隐藏焦点 tooltip。
- **DOM tooltip 接管**：`#hotbar` 与背包格容器各加事件委托（mouseenter/mousemove/mouseleave），复用 `#tooltip` DOM 显示道具名+描述，替换原生 `title`（`aria-label` 保留）。移开即隐（mouseleave 直接触发，无防抖）。

## Testing and validation

行为不变量 → 测试映射（vitest 单测为主，全部 TDD 先红后绿）：

| 不变量 | 验证 |
|---|---|
| B1 商人交互后实体仍在 `G.items`，可再次触发 | 单测：踏入 merchant 格 → 实体留存 + `triggerNpc` 调用 |
| B2 宝箱/事件站仍"删后触发"（回归） | 单测：chest/event 踏入 → 实体移除 |
| B3 `resizeCanvas` 尊重 `minimapScale` | 单测：设 5 → `mc.width === MW*5` |
| B4 ✕ 关闭→重开背包→数字键不售卖 | 单测：`openInventorySell()`→✕ 路径→`openInventory()`→`sellMode===false` |
| B5 商人入口售卖路径仍工作（回归） | 单测：`openInventorySell()`→内部传 `{sell:true}`→`sellMode===true` |
| B6 新定价精确 | 单测：F5/F20/F40 三点 r3/r4 数值断言 |
| B7 目标失效 tooltip 秒隐 | 单测：显示敌人 tooltip→从 `G.enemies` 移除→`validateTooltip()`→`display:none` |
| B8 hotbar 无 title 属性、有 aria-label、名条随焦点更新 | 单测（HTML 断言）+ battery 目检 |
| B9 全套门禁绿 | vitest 530+N / tsc 0 / build / smoke 65 / gamepad 22 / battery 19+新增 |

新增 i18n 键走 en/zh parity 门（批7 既有门）。UI 视觉（T1/T2）以 battery 截图 + PIL 像素统计目检（analyze_image 不吃 Win 路径，沿用批6 先例）。

## Parallelization

不派并行 subagent：七项虽文件错开，但 `events.ts`（T3+T6）、`panels.ts`/`input.ts`（T1 title 移除与 T5 开关收口）、battery/e2e 门禁文件互相交叠，单人单分支顺序 TDD 的返工成本低于并行协调成本；总量约 8 文件 + 15-20 个新单测，wall-clock 收益小。沿用本会话主循环直接实现（批3D/批5 同款节奏）。

## Risks and mitigations

- **手柄导航回归**（T1 动 hotbar DOM）：`tabindex=0` 与 focus 模型不动，namebar `aria-hidden`；gamepad 22 e2e 是硬门。
- **商人常驻的弹窗骚扰**：仅踏入触发 + ESC 关闭，站原地不重复弹；语义与现有宝箱一致。
- **`innerHTML` 重渲染吞焦点**（T1 名条 + T7 焦点校验都依赖 activeElement）：焦点回落 body 的场景两者都要兜住，单测覆盖。
- **移动端断点**（T1 放大）：54px 断点值同步调整，battery 含 mobile 视口的站点走查。

## Follow-ups

- 批10「深渊记账+回响」：T3 常驻商人是双价签挂接的地基（本批先落地避免返工，见会话设计）。
- 版本号：批9+批10 合并后统一 bump 1.6.0。
