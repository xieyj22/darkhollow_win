# TECH — 批4「断裂修复+一致性」：P1 存档 bug 清零 + 7 P2 + 顺手包

- 基线 commit：`106a53d`（main，2026-08-28，1.4.0，批1-3D 已合入）
- 来源：2026-08-28 五路审计（memory `darkhollow-audit-2026-08-28`）批4 提案；本 spec 撰写时已派 Explore agent 对全部 14 处 file:line 逐一复核，**全部判定准确**，行号即 106a53d 实测
- 范围裁决（用户已批 2026-08-29）：本批只做批4（批5 性能/批6 Steam/批7 结算可达性后续另批）
- 原则：纯 bug 清零批，**零新玩法/零数值变化**；每处修复贴着现有模式写；全 TDD

---

## 1. Context（现状与证据）

### P1：eventFlags 不入存档（A/B 双盲撞中）

`eventFlags?: Record<string, boolean>`（GameState，types.ts:545）是批2 事件站「每 run 一次」标记：`eligibleEventSites` 用 `!(s.once && G?.eventFlags?.[s.id])` 过滤（event-sites.ts:30），写入在 events.ts:440-441。但存档三处全缺：

- `buildSave`（save.ts:31-43）顶层字段只有 player/floor/dungeon/enemies/items/traps/msgs/qs/endless/wardenCd；
- `SaveData`（types.ts:580-591）无该字段（optional 故 tsc 不报）；
- `loadGame`（save.ts:62-74）不恢复、`initGame`（game.ts:30-38）不初始化。

后果：中途存档 → Continue → `G.eventFlags` 为 undefined → 5 个 once 事件站（cursed_altar/gambler_altar/trapped_npc/ancient_stele/sealed_box）重生重触发，+3ATK 献祭/赌坛可反复薅。

现有模式参考：`endless?: boolean` / `wardenCd?: number` 就是后期通过 save 迁移追加的 optional 字段对（SaveData:589-590 ↔ buildSave:40-41 ↔ loadGame:72-73），本修复完全复刻该模式；eventFlags 是普通对象，JSON 直序列化，比 achievements 的 `Array.from(Set)`（save.ts:36）还简单。

### P2-1：returnToTitle/loadGame 不清 UI 旗标

`returnToTitle`（main.ts:127-137）只切 display/停粒子/放 BGM，无任何 overlay 关闭；Continue 路径 `on('btn-cont', loadGame)`（main.ts:147）同样。main.ts 已 import `closeItemIntro`（:36）与 `closeEvent`（:19）却未用。

现成梯子：`closeActiveOverlay()`（menu-context.ts:15-34）按 introOpen→eventOpen→invOpen→…→menuOpen→records/codex 逐层关闭并返回 boolean，手柄 B 就走它（input.ts:263）。

**审计未展开的坑**：`closeItemIntro`（item-intro.ts:88-93）在队列非空时 `showNext()` **前进而非清空**——直接拿它当清理器会把下一张卡又弹出来。需要一个新的真清空入口。

残留 introOpen 的直接危害：`input.ts:112-115` 吞掉所有非数字键输入（WASD 死到 ESC）；intro 卡 z=1100（`.overlay`，main.css:123/52）浮在 z=1000 标题屏与 z=900 结算屏之上。

### P2-2：lore 三连

`LORE_ENTRIES`（lore.ts:23-57，cat ∈ world/area/boss/warden/relic），`unlockLore`（meta.ts:236-243）写 `MetaSave.unlockedLore`，渲染时不在册的条目显 "???"。全库 7 个调用点：

1. **`world:creator`（lore.ts:27-28）永锁死**——7 处调用无一产出该 id，世界 tab 长期 "???"。
2. **`unlockLore('relic:'+id)`（relics.ts:174）死写入**——LORE_ENTRIES 零 `relic:` 前缀条目，26 圣物各一条永久死数据；圣物图鉴实际由 `discoveredItems` 驱动（ui-panels.ts:342 `data-type="relic"`）。
3. **`unlockLore('boss:'+G.floor)`（combat.ts:591）无守卫**——同函数 593 行的 `!G.branchMode && !G.endless` 守卫模式现成可抄：菌穴（branchMode）内击杀 boss 会错写 `boss:<入口层>`（提前剧透主线 Boss 典籍）；无尽 F45+ 每 5 层 scaled boss 产出 `boss:45` 等不存在 id 无限积累。`boss:5..boss:40` 共 8 条在册（lore.ts:43-50）。

### P2-3：教学卡图标仍是 emoji

`MECHANIC_CARDS`（item-intro.ts:19-23）`sym` 字段为 🟪/👁/🍄 emoji，`renderCard`（:100-111）以 `font-size:2.2em` 直出——批3C 全量 sprite 化漏了这条批2 新路径；同卡 item/relic 分支已是 `canvas.lic` + `paintIcon`（item-intro.ts:74-82 查询后 paint；paintIcon 签名 sprites.ts:2572 `paintIcon(target, kind, color)`）。

批3C 模板池：22 个 T_* 键（sprites.ts:1743-2161）。映射可行性：warden→`T_EYE`、corruption→`T_SHADOW`（THEME_PAL 固定多色，sprites.ts:2249-2252，传入 hue 被固定配色覆盖——视觉需目检）、fungal **无对应模板**（T_MEAT 是肉块）。同剪影别名先例：`TEMPLATES.ES_ALTAR_GAMBLER = TEMPLATES.ES_ALTAR_CURSED`（:2162-2166）。

### P2-4：intro 卡 z1100 叠死亡/胜利屏 z900

z 阶梯（main.css:52）：结算屏 900 < 标题屏 1000 < overlay 1100 < lang 2000。Creator 战中跨腐化阶入队机制教学卡 → 玩家死亡 → intro 卡浮在结算屏上 + `.overlay.active` 抢手柄焦点（无软锁，先关卡即可）。`closeItemIntro` 自动弹下一条的机制见 P2-1——同样需要「清空」而非「前进」。

### P2-5：传送浮字硬编码中文

items.ts:83 `flt(p.x, p.y, '⚡传送', '#9b5de5')`——全库 CJK 扫描唯一残留，EN 界面下浮中文。现成 key：`ig.teleport = {en:'Teleport', zh:'传送'}`（i18n.ts:326）；emoji 前缀拼接先例 `relics.ts:179` `'🏺' + t('rl.relicTag')`。

### P2-6：rAF 守卫缺 introOpen/gameOver

`tick`（particles.ts:93-102）守卫条件含 menuOpen/invOpen/…/eventOpen/options-overlay，**缺 introOpen（import 行 particles.ts:2 也未引入）与结算态**——拾取弹窗 2-4s / 死亡胜利结算屏期间全帧重绘空转。`introOpen` 来自 state.ts:33，结算态即 `G.gameOver`/`G.won`（tick 首行已有 `!G` 早退）。

### 顺手包（4 项 + 1 提交）

- **pads[0] 无 standard 过滤**（input.ts:278-283）：`pads[0]` 可能为 null 或非 standard mapping 设备；`getGamepads()` 返回含 null 数组，现状只挡 null。Steam 兼容性铺垫（审计 Steam 小时级项）。
- **drawItemSprite sig 冗余**（sprites.ts:2540-2548）：`item.spriteKind` 命中 `ENTITY_PAL`（固定多色调色板，:2295-2312）时 `item.c` 不参与成图，但 sig 仍拼 `key+':'+item.c` → 同模板不同 c 裂成多条缓存。裸 sig 先例：`drawStairSprite` 用 `'STAIR'`（:2395）。
- **键盘 ESC 拦截链缺 records/codex**（input.ts:102-187）：键盘链末端 ：187 `overlay_close → openPause()`，而 records/codex 无 open flag 纯 `.active` class；手柄 B 走 `closeActiveOverlay` 有兜底（menu-context.ts:28-32）。怪象：标题屏 records 开着按 ESC 关不掉（openPause 对 G=null no-op）；游戏内则叠一层 pause。
- **#title-particles 无 aria-hidden**（index.html:12）：批3D T4 给 18 处 canvas 都加了，这处漏（批3D review M5 defer）。注意批3D 源码层门的 `SRC_FILES` 不含 index.html（batch3d-residue.test.ts:97-106）。
- **scripts/verify_reconnect_ingame.py**：工作树唯一未提交改动（+7 行：intro 教学卡 `.active` 时点 ✕ 关闭的守卫块，e2e 过期修补，复跑 10/10），随本批提交。

---

## 2. Proposed changes

### ① eventFlags 持久化（P1，四处一线）

| 文件 | 改动 |
|---|---|
| save.ts buildSave（:41 旁） | `eventFlags: g.eventFlags || {}` |
| types.ts SaveData（:590 旁） | `eventFlags?: Record<string, boolean>;`（复刻 endless/wardenCd 模式） |
| save.ts loadGame（:73 旁） | `eventFlags: s.eventFlags || {}`（老档兜底） |
| game.ts initGame（:37 旁） | `eventFlags: {}`（显式初始化，与批2 测试构造器一致） |

钉存档往返测试：save → load 后 eventFlags 逐键相等；无字段老档 load 后为 `{}` 且 once 事件站不再可选（eligibleEventSites 断言）。

### ② 瞬态 UI 清理器 + 三处接线（P2-1 + P2-4 合一）

**新增两个小函数**：

- `resetIntros()`（item-intro.ts，紧挨 closeItemIntro）——真清空：`queue.length = 0; hideOverlay('item-intro-overlay'); setIntroOpen(false);`（closeItemIntro 的「前进」语义保持不变，不改动）。
- `clearTransientUi()`（menu-context.ts export）——`resetIntros()` 后**有界**循环 `for (let i = 0; i < 12 && closeActiveOverlay(); i++)`。清空 intro 队列 + 沿既有梯子关掉所有开着的 overlay/事件弹窗。（计划阶段修正：不能写 `while`——closers 清旗标是各 rung 自己的责任，无限循环会把别人的失误变成挂起，测试 mock 下也必然死循环。）

**接线三处**（均在 main.ts / combat.ts，save.ts 不动、避免新依赖）：

1. `returnToTitle`（main.ts:127）开头调 `clearTransientUi()`；
2. Continue 改 wrapper：`on('btn-cont', () => { clearTransientUi(); loadGame(); })`（main.ts:147）；
3. `playerDefeat` / `playerVictory`（combat.ts，结算屏拉起处）调 `resetIntros()`——跨腐化阶入队的机制卡不再浮在 z900 结算屏上（P2-4 用 flush 方案而非 z 调 1150：不引入新层级值，且一并解决焦点被抢）。

### ③ lore 三连（combat.ts + relics.ts）

1. **world:creator 解锁**：combat.ts isBoss 块（:589-596）内加 `if (G.floor === FINAL && !G.branchMode) unlockLore('world:creator');`——与 593/594 两个 F40 分支同点，normal 通关与 endless F40 斩杀都覆盖（unlockLore 自带 includes 去重，转生重杀无害）。
2. **删死写入**：relics.ts:174 `unlockLore('relic:' + id);` 整行删除（圣物图鉴由 discoveredItems 驱动，不补 26 条条目——那是把死数据变活数据的负收益）。
3. **boss: 解锁加守卫**：combat.ts:591 改 `if (!G.branchMode && !G.endless) unlockLore('boss:' + G.floor);`（照抄 :593 守卫形状；无尽/菌穴击杀不再产出垃圾 id）。

### ④ 教学卡 sprite 化（item-intro.ts + sprites.ts）

- `MECHANIC_CARDS` 结构改 `{ tpl: string; hue: string; tk: string; bk: string }`，映射：`corruption → { tpl:'T_SHADOW', hue:'#b583f6' }`（THEME_PAL 固定配色生效，hue 仅作非主题回退与语义锚点）、`warden → { tpl:'T_EYE', hue:'#9a2be2' }`、`fungal → { tpl:'T_MUSHROOM', hue:'#06d6a0' }`。
- sprites.ts 新增 `T_MUSHROOM` 16×16 模板（格式照 T_MEAT 相邻模板；**刻意不进 THEME_PAL**——单 hue 走 buildPalette，与批3D T_INFINITY/T_KEY 同理：THEME_PAL 是多 hue 承重墙）。
- `renderCard` mechanic 分支（item-intro.ts:100-111）：emoji div 改为 `<canvas class="lic" width="16" height="16" aria-hidden="true">`（与 item/relic 分支 :119/:144 同形），渲染后 `paintIcon(cv, tpl, hue)`。批3D DOM 层 aria 门天然覆盖新增 canvas。

### ⑤ 传送浮字 i18n（items.ts:83，一行）

`flt(p.x, p.y, '⚡' + t('ig.teleport'), '#9b5de5')`（items.ts 已有 t import；relics.ts:179 拼接先例）。

### ⑥ rAF 守卫补全（particles.ts，两行）

- import 行（:2）补 `introOpen`；
- 守卫条件（:98-99）追加 `|| introOpen || G.gameOver || G.won`。

### ⑦ 顺手包

| # | 文件:行 | 改动 |
|---|---|---|
| a | input.ts:280 | `const gp = pads.find(p => p && p.mapping === 'standard');`（`if (!gp) return;` 原样保留，:380 gpPrevBtn 依赖非空） |
| b | sprites.ts:2545 | `const sig = (item.spriteKind && ENTITY_PAL[item.spriteKind]) ? key : key + ':' + item.c;`（仅 ENTITY_PAL 命中时用裸 key；普通单 hue 物品仍需 c 参与调色，**不可**全量裸化） |
| c | input.ts:187 前 | 抄 menu-context.ts:28-32 形状：`for (const id of ['records-overlay','codex-overlay']) { const el = document.getElementById(id); if (el?.classList.contains('active')) { hideOverlay(id); e.preventDefault(); return; } }`（标题屏与游戏内都修好） |
| d | index.html:12 | `<canvas id="title-particles" class="title-particles" aria-hidden="true"></canvas>`；batch3d-residue 源码层测试把 index.html 纳入扫描（或加单行断言） |

⑧ **提交 scripts/verify_reconnect_ingame.py**（已在工作树，无代码改动，随本批分支走）。

**不做**（明确出界）：其余 items.ts 硬编码浮字（FULL/☆SUMMON 等英文缩写——审计未列，属批7 文案卫生）；z-index 阶梯重构；lore relic 条目补全；连续方向键键盘侧导航（批7）。

---

## 3. Testing and validation

| 修复 | 测试 | 文件 |
|---|---|---|
| ① eventFlags | 新增：save→load 往返逐键相等；无字段老档 → `{}`；once 站点 Continue 后不再 eligible | save 相关既有 test 文件旁 |
| ② UI 清理 | returnToTitle / btn-cont wrapper 后 `introOpen===false`、`eventOpen===false`、overlay 无 `.active` 残留（happy-dom 驱动，先造脏态再清） | menu-context / main 相关 test |
| ③ lore | endless 击杀 boss 不写 `boss:N`；branchMode 同；F40 击杀写 `world:creator`；grantRelic 后 unlockedLore 无 `relic:` 前缀 | codex.test.ts（已有 entry 计数断言 :43-48 处扩展） |
| ④ 教学卡 | renderCard mechanic 分支 DOM 含 `canvas.lic` 且 `aria-hidden="true"`、无 emoji 文本节点；T_MUSHROOM 进 TEMPLATES 键集断言（batch3c 模式） | batch3c / batch3d test |
| ⑤ 传送 | zh 环境浮字含「传送」、en 环境含 "Teleport" 且不含 CJK（全库 CJK 扫描门顺带复跑） | items 相关 test / 静态扫描 |
| ⑥ rAF | 不单独单测（tick 内联条件）；由 e2e 全量复跑覆盖（intro/结算态期间不炸） | — |
| ⑦a pads | mock getGamepads：`[null, standardPad]` 选中 standard；`[nonStandardPad]` 视为无手柄 | input.test.ts（批3A mock 模式） |
| ⑦b sig | 同 key 不同 c 的两个 ENTITY_PAL 实体 draw 后 spriteCache 仅 +1 条目 | sprites 相关 test |
| ⑦c ESC | happy-dom：records-overlay `.active` + keydown Escape → active 移除且 openPause 未被调（G=null 场景） | input test |
| ⑦d aria | index.html 该行含 aria-hidden（源码层） | batch3d-residue.test.ts |

**收尾验证**（verification-before-completion）：`npx tsc --noEmit` 0 错（裸跑贴原文，不透管道）；`npx vitest run` 全绿（基线 462 + 本批新增）；e2e 五脚本连跑全绿（reconnect 10 / batch2 20 / batch3b 18 / batch3c 64 / gamepad 22，零 console 错）；游戏内冒烟（Vite dev server + ESM live import 同实例法）：中途存档 → Continue → 已用过的 cursed_altar 站不再出现；手柄开 intro 卡 → Quit to Title → 标题屏无浮卡、WASD 正常。

---

## 4. Parallelization

**不并行、同分支串行**（沿用批2/批3 惯例）：

- 总量 ~10 个文件的小 diff，多数单文件 1-4 行；并行 worktree 的合并开销超过收益。
- 历史坑：多个 test 文件 mock state.js 须同步新 source（批3 教训），串行天然避免。
- subagent-driven SDD 分 3 个 task（每 task 一个 subagent，TDD 红→绿）：
  - **T1 数据层**：① eventFlags + ③ lore（save/types/game/combat/relics + 测试）；
  - **T2 表现层**：② UI 清理 + ④ 教学卡 sprite + ⑤ 传送 + ⑥ rAF（main/menu-context/item-intro/items/particles/sprites-tpl + 测试）；
  - **T3 收尾**：⑦ 顺手包四项 + ⑧ 脚本提交 + batch3d-residue 门扩展 + 全量回归（tsc/vitest/e2e 五连）。
- T1/T2 文件不相交可理论并行，但 T2 的 combat.ts（resetIntros 接线）与 T1 的 combat.ts（lore）同文件——**串行**最稳。
- 分支：`feat/batch4-breakage`，全绿后 ff-merge main → push → 看 CI 四门真在跑 → 删分支。
