# 批7「结算与可达性」设计（spec）

**Base:** `main@5ae3eeb`（批6 已合）· **分支:** `feat/batch7-deathscreen-a11y`
**来源:** 08-28 五路审计 D 维（UX 4.0）+ 08-24 UI 债 + 批4 backlog（eventOpen 死亡残留）。
**范围裁定（用户已批）:** A 死亡屏三件套 + B 可达性包 + C i18n/信息包 + D 顺手包，全收；键盘方向键=行间移焦；墓志铭=模板+风味语库。

## Context（现状 @5ae3eeb）

- **死亡屏纯数字**: `playerDeath(killer)` (combat.ts:429) 把 killer 只写进日志 (`addMsg(tMsg('cb.slainBy', killer))` :432)；`#death-stats` (:466-475) 只渲染 楼层/等级/击杀/金币/回合。`m.wardens`（meta.ts:275-276, cap10 `{name,cls,race,floor,ts}`）自 Wave8 持久化以来**从未渲染**。`#death-screen` 结构= index.html:108（h1 + stats + echoes + 两按钮）。
- **playerDeath 10 个调用点**: combat.ts:218(敌击)/:424(守渊人转化)、enemies.ts:296(敌技)、events.ts:100(宝箱拟态)/:121(陷阱)/:198(岩浆)、items.ts:49(毒瓶)、turn.ts:46(饥饿)/:67(毒DOT)/:78(腐化)。killer 均为已本地化显示串。
- **可达性基建已在位**（批3A/4）: `focus-nav.ts` 已导出 `focusablesIn`/`spatialNext`/`seqFocus(container,dir)`(:76 线性移焦)/`stepRange(el,dir)`(:48 滑条步进)/`gpFocus`；input.ts 手柄侧已有 `menuMoveFocus`(:391-405, 含 range 聚焦时横轴=stepRange) 与 menu-context 判定；`initFocusTooltips`(ui-panels.ts:159-172) 已做 focusin→[title] tooltip 显示（行缺 title 是另一半缺口）。
- **键盘侧缺口**: input.ts keydown 在 gameplay 分支吞掉方向键（menu/overlay 开着时键盘只能 Tab/Shift+Tab——审计原话）。滑条 D-pad 为 edge 触发单步（textScale 0.85→1.5 需 13 按）。
- **零 aria-live / 零 dialog 语义**: 全库 `role="dialog"` 与 `aria-live` 零命中；13 处 `close-btn`（✕）无 aria-label；折叠头无按钮语义（08-24 债）。
- **i18n**: `TIER_LABEL`(corruption.ts:43-49) zh `corrupted`=「侵蚀」与全库机制名「腐化」分裂；zh 串半/全角标点混用。`addMsg`(messages.ts:5-22) 无聚合（同文本连刷逐行堆叠，DOM cap100）。`renderRecords`(ui-panels.ts:220-238) 两表均有 ts 数据（meta.ts:69 leaderboard 也带 ts）但无日期列；records/codex/help 行 div 无 tabindex。
- **eventOpen 残留**: events.ts 事件动作内 `playerDeath(...)`（:100/:121/:198）后事件弹窗不关（死亡屏与弹窗同屏）——批4 修了 intro 队列(resetIntros)漏了事件。`closeEvent()`(events.ts:69-74) 已导出。

## Proposed changes

### A 死亡屏三件套

1. **死因上屏（并入墓志铭模板句，避免 killer 双显）**: `#death-stats` 保持纯数字；新增的墓志铭模板句承载死因——`tMsg('ep.template', killer, floor, turns)`（如 zh「被 {killer} 终结于第 {floor} 层 · 存活 {turns} 回合」），不再单独渲染 `cb.slainBy` 行。
2. **墓志铭**: 新 `src/epitaph.ts` 纯函数模块：
   - `type DeathCause = 'combat' | 'trap' | 'poison' | 'starve' | 'corruption' | 'warden'`
   - `playerDeath(killer: string, cause: DeathCause = 'combat')` 签名扩展；10 调用点归类：events:121/198→'trap'、items:49→'poison'、turn:46→'starve'、turn:67→'poison'、turn:78→'corruption'、combat:424→'warden'、其余默认 'combat'（events:100 拟态按 'combat'）。
   - `buildEpitaph(cause, killer, floor, turns, rand)` → `{ line: string }`：模板句（`tMsg('ep.template', killer, floor, turns)`）+ 按类别随机抽一条风味语（`ep.flavor.<cause>.<i>`，i18n.ts 新增 ~6 类 × 2-3 条 × 2 语言，写手费心：短、克制、黑深风格与现有文案一致）。随机源注入（`rand: () => number`）保单测确定性。
   - 渲染：death-stats 与 death-echoes 之间插入斜体引言块（模板句 + 换行 + 风味语；index.html 加 `<div id="death-epitaph">`，样式进 style 区）。
3. **陨落者名单**: `m.wardens` 最近 5 条渲染进 `<div id="death-wardens">`（echoes 下方）：小节标题（新键 `ep.fallen`）+ 每行 `name F{floor}`，>5 条尾行 `+N`（新键）。名字为转化时语言烘焙串，接受现状（O 级已知，不本批修）。

### B 可达性包

1. **键盘行间移焦**（=D 的连续方向键，合并）: input.ts keydown 的 menu-open 分支：`move_up/move_down` 动作键（含方向键默认绑定）→ `seqFocus(menu, ±1)` + preventDefault（menu 判定复用批3A menu-context，与手柄 `quaff/descend` 同一容器）；`move_left/right` 在聚焦 range 时 → `stepRange`。 gameplay 分支零改动。
2. **行 tabindex + role**: renderRecords/renderCodex/renderHelp（panels.ts:158 一带）行 div 加 `tabindex="0"` + 容器 `role="list"`/行 `role="listitem"`；行内容有信息量的加 `title`（接入已有 initFocusTooltips = 补齐另一半）。
3. **滑条 D-pad 长按**: input.ts 手柄 menu 分支——聚焦 range 且方向按住时，edge 后启动 repeat 计时（首延迟 ~350ms，~120ms/步，按 poll 帧 60ms 折算为帧数），松开/移焦即清。只影响手柄；键盘长按系统原生 repeat。
4. **aria-live**: index.html `#log-panel` 加 `aria-live="polite"`。
5. **overlay dialog 语义**: 13 处 overlay panel（index.html 静态 11 + js 动态 2，实跑以 DOM 扫描为准）加 `role="dialog" aria-modal="true"` + `aria-labelledby` 指向面板内 h2（缺 id 的补）；✕ close-btn 加 `aria-label`（新键 `ui.close`）；折叠头改 `<button>` 语义或 `role="button" tabindex="0"`（以 08-24 清单为准，实跑盘点）。
6. **地图 tooltip（收窄声明）**: canvas hover 保持 mouse-only；本批只做「focusable 行 focus 即显 tooltip」（=A2 的 title 补齐）。真键盘地图游标不进本批。

### C i18n/信息包

1. **术语统一**: TIER_LABEL.corrupted zh「侵蚀」→「腐化」（全库 grep「侵蚀」确认仅此簇）。
2. **标点清洗**: 一次性脚本扫 i18n.ts/data.ts/其余 src 的 zh 字面量：中文邻接的半角 `,;:!?` → 全角（数字/拉丁/「·」两侧不动；en 串零改动）；diff 全量人工过目后落地；i18n 键交叉测试当护栏。
3. **日志聚合×N**: `addMsg` DOM 层——若与 log 末条 text 相同则更新该条为 `text ×N`（count 存 DOM dataset），不新增行、不滚出视口；`G.msgs` 存档语义不变（仍逐条）。聚合只认相邻同文本。
4. **records 日期列**: 两表各加 `MM-DD` 列（ts→短日期；行 5→6 列，表头新键 `up.date`）。

### D 顺手包

- **eventOpen 死亡残留**: `playerDeath()` 内与 `resetIntros()`(:431) 并列：`if (eventOpen()) closeEvent();`（combat.ts 引 events.ts——若成环走 bridge.ts late-binding，计划期定）。

## Testing and validation

- **单测**（vitest/happy-dom，现有模式）: epitaph（类别路由/模板参数/注入 rand 确定性/未知类别兜底）；addMsg 聚合（相邻同文本×N/不同文本不聚/100 行 cap 仍守）；renderRecords 日期列（ts→MM-DD/无 ts 旧档「—」）；TIER_LABEL 术语；死亡屏渲染（killer 行/墓志铭块/名单 5+N——沿用 combat 死亡测试的 mock 模式）；eventOpen 死亡关闭；键盘移焦（keydown→seqFocus 调用，mock menu-context）；D-pad repeat（fake 按住帧序列→步数）。
- **静态门**: index.html 扫描门（批4 已有）扩：`role="dialog"` 覆盖全部 overlay panel、✕ 全带 aria-label、`aria-live` 存在。
- **e2e 电池** `scripts/verify_batch7_ingame.py`（dev server 同实例法）: 死亡屏四块 DOM 断言（killer/墓志铭两行/名单/聚合日志×N）+ records 内键盘↓移焦走查（focus 从表头行到行尾）+ 手柄滑条长按 3 步+/秒 + i18n 键交叉零缺失。
- **七门回归**: tsc 裸跑 / vitest 全量 / batch7 新电池 / batch4-19 / batch3c-64 / gamepad-22 / reconnect-10 / batch5-28（批6-Electron 门不受 renderer-only 改动影响，不重跑）。

## Parallelization

SDD 执行（subagent-driven，plan 细化）：A（combat/epitaph/i18n 语库）与 C2 标点清洗（纯 i18n 大扫）与 B5 dialog 语义（纯 index.html+静态门）文件集基本不相交，可并行；B1-B4（input/focus-nav/panels）与 D（combat/events）串行在 A 后。merge 前七门全绿。

## Risks and mitigations

- **playerDeath 签名扩展**——默认参数保旧调用零破坏；10 调用点逐一归类在 plan 里成表。
- **combat↔events 成环风险**（D）——倾向 bridge late-binding（项目惯例），plan 期以 grep import 定案。
- **标点清洗动 i18n 大文件**——脚本生成 diff、全量人工过目、659 键交叉测试+608 静态引用门双护栏；en 串零改动缩爆面。
- **风味语库文案量**——~15-20 对新键是本批主要新内容；风格对齐现有 zh 文案（克制、短句、不玩梗），一次性写完进 i18n.ts 供 review。
- **键盘移焦与 gameplay 方向键冲突**——只改 menu-open 分支；e2e gamepad/键盘双套回归守底。
