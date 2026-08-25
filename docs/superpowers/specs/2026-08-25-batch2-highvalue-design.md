# TECH — 批2「高性价比」：内容多样性 × 表现力 × 文案卫生（10 项）

- 基线 commit：`4aaa188`（main，2026-08-24，批1 已合入）
- 来源：2026-08-24 五维审计剩余"高性价比"层（底稿存 memory `darkhollow-audit-2026-08-24`）+ 批1 review 顺带 2 项（shrineBuff 死 key、净化 shake）
- 范围裁决（用户已批）：10 项全做，一批清空小时~天级机会层；批3 只剩大投资（Boss 专属模板 / emoji 全量 sprite 化 / 手柄全导航等）
- 原则：沿用批1——普通主线行为变化仅限**本批显式设计的内容**（新敌人/新事件/Boss 技能/教学卡）；无尽/分支同享新内容；无断线修复（批1 已清零）

---

## 1. Context（现状与证据，行号为 4aaa188 实测）

**死 handler ×3**：`executeEnemySkill`（enemy-skills.ts:31-42）dispatch 完整、有单测，但 `heal`/`blink`/`summon` 三个效果 0 个敌人引用（注释自认 "v1: no caster uses this effect yet"，enemy-skills.ts:79/130/147）。`castHeal`（:78-91，治疗受伤敌友军 25%×dmg maxHp）、`castBlink`（:129-144，瞬移到玩家相邻格）、`castSummon`（:146-166，按 mf 窗口召 0.6 血小怪）全部即插即用。

**Boss 无技能**：BOSSES 9 条（data.ts:254-292）全部无 `skill` 字段——Boss 战只有平 A+相位+召小怪。且审计漏掉的关键事实：**技能闸门在近战分支之后**——actEnemies 循环里 `if (d <= 1.5) { attack(...); continue; }`（enemies.ts:204）先于 `if (shouldCastSkill(e, d, visible, playerInvis))`（enemies.ts:208-209），chase AI 的 Boss 贴脸回合永远走平 A，**纯 data 加 skill 字段对贴脸 Boss 几乎不生效**。另：Creator（data.ts:285）`summon` 缺 `kind`；Leviathan（:271）唯一无 summon（本批用 skill-summon 补主题）；Myconid Sovereign（:291）菌穴白板。

**事件池单一**：地图实体仅 4 种——chest 50%/merchant 35%/treasure_merchant 每 5 层/endless_merchant 无尽每 3 层（game.ts:106-110 `placeEntity` 模式）。40 层主线同 4 弹窗重复 60+ 次。批1 已删空壳 `maybeEvent`（测试钉住 events-checkTiles.test.ts:78-79）。popup 骨架齐全：`showEvent`（events.ts:31-53）+ `_bindEventBtns`（:55-64）+ 动态按钮版 `openTreasureMerchant`（:281-310）；实体触发走 `triggerNpc`（:250-256）按 `entity.npc` 分发。

**教学缺口**：腐化跨档只有一行 `🟪 侵蚀…`（combat.ts:387-391）；守渊人首刷一句播报；首进菌穴无解释。item-intro 卡片系统完整可复用：队列机制（item-intro.ts:38-53）+ `renderCard`（:84-124）+ MetaSave.discoveredItems 跨局去重。

**硬编码残留**：`name:'Gold'` 英文单语 ×2（game.ts:87/198，zh tooltip 显"◆ Gold [普通]"）；null_crown buff 名硬编码 `'null_crown'`（game.ts:142，侧栏 render.ts:471 显原始 relic id）；`+${hg}HP +${mg}MP…` 英文缩写（combat.ts:249）；`+${val} ATK ${dur}t` ×3（items.ts:46/47/87）；行内 {en,zh} 字面量绕过 L 库：CRIT（combat.ts:131）、盾击/暗影突袭（skills.ts:~84/~122）；`<html lang="en">` 不随切语言更新（setLang state.ts:46 只写 localStorage）。

**地形穿帮**：门 `+` 字符（render.ts:259）与楼梯精致 sprite 同层反差最大；PORTAL `◯` 单字符静态（render.ts:271）；宝箱 npc 实体走 `drawItemSprite` 无专属模板。sprite 分流模式现成：`if (tile === TL.STAIR) { drawStairSprite(c, sx, sy); continue; }`（render.ts:286-288）。渲染是 rAF 连续帧（敌 idle bob 用时间基，render.ts:119），PORTAL 动画有条件。

**Juice 缺口**：升级仅文字+音效（combat.ts:248-250）；道具落地无 fx（combat.ts:186-188 push 后静默落地）；拾取仅 snd（player.ts:101 金币 / items.ts pickup ~:476-500）；Boss 出场零 fx（只有 msg+BGM+snd，game.ts:118/147-148，且都在进层时播——Boss 在远处房间，玩家看不见时已放完）。fx 积木全齐：fxFlash/fxAura/fxBeam/fxBolt/fxBurst（fx.ts:75-127）。

**shrineBuff 死 key**：i18n.ts:66 `shrineBuff`（"神殿赐予了你强大的祝福！"）无引用；神龛现状固定 3 选 1（events.ts:172-175，atk/def/hp 各 rng 1-2/5-10）。

**净化 shake**：applyCorruption 跨档分支（combat.ts:387-392）不分方向——净化（n<0）降档时同样 `🟪` 紫字+shake(1.5)，与腐化上行体验混同。`addCorruption` 返回 `{before, after, crossed, maxed}`（corruption.ts:56-60），方向可由局部 `n` 符号判定。

---

## 2. Proposed changes

### ① 死 handler 启用 ×3（data.ts：ENEMIES 70→73）

新增 3 只敌人，全部走现有 dispatch，零引擎改动。数值与同 mf 邻居对齐（实现时以 data.ts 相邻行 HP/ATK/DEF 为基准 ±10%）：

| id/名 | mf | tags | skill | 设计意图 |
|---|---|---|---|---|
| deep_mender 深渊修补者 | 26 | aquatic | `heal` chance .35 cd 4 range 7 dmg 1.2 | 治疗受伤友军 30% maxHp；迫使玩家集火优先级决策 |
| crypt_summoner 地穴召唤师 | 17 | caster | `summon` chance .25 cd 7 range 6 | 正式技能召唤（区别于 Necromancer 的 ai:'summon' 分支） |
| void_blinker 虚空闪行者 | 37 | wraith | `blink` chance .3 cd 3 | 瞬移贴脸刺客，配合 void 区压迫感 |

name/desc 双语内联（沿既有敌人模式）；/tags 保证 sprite 路由（AQUATIC/CASTER/WRAITH 模板现成）。

### ② Boss 配 skill ×9 + 技能优先闸门（data.ts + types.ts + enemies.ts）

**引擎改动（1 处，小）**：actEnemies 近战分支**前**插 Boss 专属技能闸门：

```ts
// enemies.ts ~:204，melee 分支之前
if (e.isBoss && shouldCastSkill(e, d, visible, playerInvis)) { executeEnemySkill(e, e.skill!); continue; }
```

仅 `e.isBoss` 走优先路径（贴脸也放技能）；普通 caster 行为零变化（仍走 :208 原闸门）。`shouldCastSkill` 是纯函数（enemy-skills.ts:17-24）已有测试，Boss 复用即可。

**BossDef 加可选 `skill?: EnemySkill`**（types.ts）；`makeEnemy` 已深拷贝 skill（批1 确认），Boss 实例天然获得。分配表（效果全从现有 8 种挑，chance/cd 保守起步）：

| Boss | 技能 | 参数 |
|---|---|---|
| F5 哥布林王 | debuff_weaken「王之威吓」 | chance .3 cd 4 range 5 dmg 6 |
| F10 蜘蛛女王 | debuff_slow「蛛网束缚」 | chance .35 cd 4 range 5 aoe 3（=持续回合） |
| F15 吸血鬼领主 | dmg_bolt「暗影箭」 | chance .3 cd 4 range 6 dmg 1.6 el shadow |
| F20 远古巫妖 | dmg_aoe「死灵爆发」 | chance .3 cd 5 range 6 dmg 1.3 aoe 2（=半径） |
| F25 龙皇 | dmg_bolt「龙息」 | chance .35 cd 4 range 6 dmg 1.7 el fire |
| F30 利维坦 | summon「深渊呼唤」 | chance .3 cd 6 range 6（补它缺的召唤主题） |
| F35 虚空君主 | debuff_stun「虚空凝固」 | chance .3 cd 6 range 5 aoe 1（1 回合，handler 上限 2 兜底） |
| F40 创世者 | heal「重构」 | chance .25 cd 8 range 9 dmg 1.5（37.5% maxHp 自愈，终结战拉扯）+ **summon.kind 补**（从 F36+ 现有 ENEMIES id 选，实现时核对） |
| 菌主（菌穴） | heal「菌丝回哺」 | chance .3 cd 5 range 6 dmg 1（branch 内 castSummon 池是主线怪，故选 heal 不选 summon） |

无尽 F45+ 随机复用 Boss 自动获得技能（更多变化，无需额外处理）。

### ③ 事件池 ×8（events.ts + game.ts + types.ts + state.ts）

**机制**：地图实体 `npc:'event'` + `eventId` 字段（types.ts Item.npc 联合类型加 `'event'`、Item 加 `eventId?: string`）。放置沿 `placeEntity` 模式（game.ts:98-110）：`floor >= 3 && !branchMode && Math.random() < 0.28` 时放 1 个站点（同层最多 1 个，避 STAIR 已有守卫）；从合格池挑（每事件 minFloor + once 标记过滤）。触发走 `triggerNpc` 加一分支 → 新 `showEventSite(entity)`（照 openTreasureMerchant 动态按钮模式）。once-per-run 标记存 `G.eventFlags?: Record<string, boolean>`（GameState 可选字段，老档兼容）。

**8 个事件**（名称/描述/按钮全走 L 键，前缀 `ev2.`）：

| id | 名 | 频率 | 机制 |
|---|---|---|---|
| cursed_altar | 诅咒祭坛 ⛧ | once | 献祭当前武器→永久 baseAtk+3 / 或离开。有武器才出 |
| gambler_altar | 赌徒祭坛 ⚄ | once | 押注 gold≥50：45% 翻倍 / 45% 全没 / 10% 三倍 |
| trapped_npc | 被困旅人 ⌂ | once | 救（25% 伏击→刷 2 敌）：得道具+金币 / 离开 |
| ancient_remains | 前代遗骸 ⚰ | 可重复 | 搜：60% 金币/道具 / 30% 无 / 10% 刷 1-2 骷髅 |
| blood_pool | 血池 ♨ | 可重复 | 饮：baseMaxHp+5 且 corruption+3 / 离开（腐化经济的一体两面） |
| ancient_stele | 古老石碑 ᛘ | once | 读：随机 1 项 +1 永久属性 + flavor 文案（成世界观点缀） |
| sealed_box | 封印之匣 ⊞ | once | 开：50% r3+ 道具 / 35% corruption+8 / 15% 圣物 / 离开 |
| sacrifice_well | 献祭井 ◍ | 可重复 | 献 20% 当前 HP→corruption -12 / 离开（普通局主动净化源，呼应批1 腐化经济） |

数值锚点：金币量级对齐 gold drop（floor×3 系）；corruption 幅度不超过批1 喷泉(-15)/神龛(-20)。

### ④ 教学三件套（item-intro.ts + meta.ts + combat.ts + enemies.ts + game.ts + i18n.ts）

- `IntroTarget` 联合加 `{ kind:'mechanic'; id:string }`；`MECHANIC_CARDS` 三张：`corruption`（腐化跨档→结局影响/净化途径）、`warden`（守渊人 6-9 层规律/奖励/转化）、`fungal`（菌穴分支/进出/奖励）。卡片=标题+正文+色块符号徽章（🟪/👁/🍄，emoji 全量 sprite 化是批3，此处沿用现状风格）。
- 队列复用：`queueMechanicIntro(id)`——`introEnabled` 关则只记不弹（与 item-intro 一致）。
- 跨局 once：MetaSave 加 `seenMechanics: string[]` + `discoverMechanic(id)`（镜像 `discoverItem` 模式，meta.ts）。
- 触发点：腐化首次跨档（combat.ts:387 `r.crossed && r.after!=='clean'` 处）；守渊人首刷（spawnWarden，enemies.ts）；首进菌穴（enterBranch，game.ts:170）。
- **unlockLore 日志**：meta.ts `unlockLore` 真解锁路径加 `addMsg(t('codex.updated'), 'mi')`（新键"📜典籍更新"）。messages.ts 无反向依赖，无环。

### ⑤ 硬编码清理（game.ts + combat.ts + items.ts + skills.ts + state.ts）

| 位置 | 改法 |
|---|---|
| game.ts:87/198 `name:'Gold'` | → `t('gold')`（键已有 i18n.ts:14） |
| game.ts:142 buff 名 `'null_crown'` | → `t('buff.nullCrown')` 新键 |
| combat.ts:249 `+${hg}HP…` | → `tMsg('cb.levelStats', hg, mg, ag, dg)` |
| items.ts:46/47/87 `+X ATK Nt` ×3 | → `tMsg('it.atkGain'/'it.defGain'/'it.shieldGain', val, dur)` |
| combat.ts:131 CRIT 行内双语 | → `tMsg('cb.critHit', name, dmg, elSym)` |
| skills.ts 盾击/暗影突袭行内双语 ×2 | → `tMsg('sk.shieldBash'/'sk.shadowStrike', name, dmg)` |
| state.ts:46 setLang | 加 `document.documentElement.lang = l`；模块加载时按存量 lang 初始化一次 |

已知边界：item.name 生成时烘焙当前语言（结构性，mid-run 切语言背包仍旧语言）——批3 议题，本批只清渲染路径。

### ⑥ 门/传送门/宝箱 sprite（sprites.ts + render.ts + game.ts）

- TEMPLATES 加 `DOOR`（木门+铁框）、`PORTAL`（旋环）、`CHEST`（箱体+锁扣）三个 16×16；shape 守卫测试自动把关（sprites.test.ts 每行 16 字符）。
- render.ts:286-288 模式加两行：`DOOR`/`PORTAL` 分流到 `drawDoorSprite`/`drawPortalSprite`。
- **PORTAL 动画**：`drawPortalSprite(c, sx, sy)` 用 `performance.now()` 时间基做旋臂相位（与敌 bob 同法）；`reducedMotion` 时画静态帧。
- **CHEST**：`placeEntity('chest', …)`（game.ts:106）与事件站点实体加 `spriteKind:'CHEST'`，`pickItemTemplate` 优先读 spriteKind 路由到新模板（事件站点字符字形继续走 glyph 回退，不入本批）。

### ⑦ Boss 出场演出（enemies.ts + render.ts + types.ts）

- `Enemy` 加可选 `introPlayed?: boolean`；纯函数 `shouldBossReveal(e, vis): boolean`（isBoss && !introPlayed && vis）。
- `checkBossReveal()`：遍历 G.enemies，命中→ `fxAura(e.x, e.y, e.c, 2.5)` + `shake(2)` + `flt(e.x, e.y, tx(name), e.c, 'crit')` 名字 banner + `snd('boss')`，置 flag。
- 挂点由 plan 裁决，二选一（约束：恰在 Boss **首次可见**时触发一次，不在进层时）：a) `updatePlayerFOV` 后（dungeon.ts，注意 import 环检查）；b) render 敌人绘制段顶部一次性 flag 检查（rAF 帧驱动，幂等）。推荐 a，若成环退 b。

### ⑧ 升级/落地/拾取 fx 三连（combat.ts + items.ts + player.ts）

- 升级：combat.ts:250 `flt('LEVEL UP!')` 旁加 `fxAura(p.x, p.y, '#ffd700', 1.6)`。
- 落地：combat.ts:187 `G.items.push(loot)` 后加 `fxBurst(loot.x, loot.y, RARITY_C[loot.rarity] || loot.c, 6, 0.5)`（RARITY_C 自 i18n.ts import）。
- 拾取：items.ts pickup 函数入口（~:476）+ player.ts:101 金币分支，各加 `fxFlash(p.x, p.y, '#ffd700', 0.9)`。
- 全部尊重 reducedMotion（fx.ts 内建）。

### ⑨ shrineBuff 接上（events.ts）

神龛 roll（events.ts:172-175）前加 20% 大祝福分支：`baseAtk+2 && baseDef+2 && baseMaxHp+10` 三合一 + `t('shrineBuff')`（死键复活）+ `fxAura` 金圈 + `snd('levelup')`；其余 80% 走现有 3 选 1 不变。

### ⑩ 净化方向 fx（combat.ts:385-393）

`r.crossed && r.after!=='clean'` 分支按局部 `n` 符号分流：`n<0`（降档=净化）→ `tMsg('cb.tierCleansed', label)` + `flt(…, '#80ed99')` 绿字、**不 shake**；`n>0` 维持现状（🟪+紫 flt+shake(1.5)）。`recalc()` 两路都执行。

### 新增 i18n key 清单（en/zh，L 库）

- ① 敌人技能 name/desc ×3：data 内联双语（沿模式，不入 L）
- ② Boss 技能 name/desc ×9：同上内联
- ③ `ev2.*`：8 事件 ×（标题/描述/2-3 按钮文案）+ 结果消息 ~12 条
- ④ `intro.mc.corruption/warden/fungal`（标题+正文 ×3）+ `codex.updated`
- ⑤ `buff.nullCrown`、`cb.levelStats`、`cb.critHit`、`it.atkGain/defGain/shieldGain`、`sk.shieldBash/shadowStrike`
- ⑩ `cb.tierCleansed`
- ⑨ 复用现有 `shrineBuff`

---

## 3. Testing and validation

- **单测（happy-dom，目标 +35~45 条，358→~400）**：
  - ① real-data 硬门：ENEMIES 总数 73；`heal`/`blink`/`summon` 效果各 ≥1 个活体引用；3 新敌 tags/mf 合法、sprite 路由命中模板。
  - ② Boss skill 优先闸门：贴脸（d=1）Boss flag 命中时走 executeEnemySkill 不走 melee（mock attack 断言未被调）；普通敌人贴脸仍 melee（零回归）；BOSSES 9/9 有 skill、effect 枚举合法、Creator summon.kind 存在于 ENEMIES。
  - ③ 事件池：`placeEventSite` 确定性（mock Math.random）；once 标记写 G.eventFlags；8 事件各 action 效果（金币/道具/腐化/刷怪/属性）；triggerNpc 'event' 路由。
  - ④ discoverMechanic once 语义；三触发点各只 queue 一次；unlockLore 真解锁时 addMsg（mock）。
  - ⑤ 键存在性（现有 key 交叉框架自动覆盖）；setLang 后 documentElement.lang 更新。
  - ⑥ 三模板 shape 守卫；pickItemTemplate spriteKind 优先；地形分流抽纯函数 `pickTerrainDraw(tile)` 可测。
  - ⑦ shouldBossReveal 纯函数；checkBossReveal 触发一次后幂等（mock fx）。
  - ⑧ 升级/落地/拾取 fx 接线断言（mock fx 模块计数）。
  - ⑨ 神龛 20% 分支（mock Math.random 锁定）三属性同加 + 消息。
  - ⑩ applyCorruption(-X) 跨档：绿 flt、shake 未被调（mock effects.shake）；+X 跨档 shake 被调（既有行为钉住）。
- **全量门**：`npx tsc --noEmit` 0 错、`npx vitest run` 全绿、`npm run build` 0 错、push 后 CI 四门绿。
- **游戏内实测**：照批1 的 verify_reconnect_ingame.py 模式（Vite dev server + ESM live import），清单：新敌人出场放技能 ×3、Boss 放技能（造 F5 快速验）、事件站点完整交互 ≥3 种、教学卡三张首触、门/传送门 sprite 目检、Boss 出场演出、神龛大祝福、净化绿字。10/10 过才算完。

## 4. Parallelization

**不并行，顺序 SDD（subagent-driven 或主 Agent 内联，plan 阶段定）**。理由同批1：⑤⑧⑩ 同触 combat.ts；③④ 同触 game.ts/events.ts；①② 同触 data.ts/enemies.ts；i18n.ts 是全项共享文件——四个工作流两两相交，worktree 合并开销超过收益（单项均小时级）。任务切分按工作流 W1(①②③)→W2(④⑤)→W3(⑥⑦⑧)→W4(⑨⑩) 顺序，W1 最大（含事件池天级项）可再拆 2 task。

## 5. Risks and mitigations

- **② Boss 难度上抬**：9 Boss 同时获得主动技 + 贴脸优先闸门是本批最大平衡风险。缓解：chance ≤.35、cd ≥4 保守起步；F5 削弱系非爆发系；数值感受交 playtest 批统一调（纯 data 一行改）。
- **②闸门位置**：Boss 优先技能可能打断"贴脸互殴"节奏（每 cd 回合放一次）。cd≥4 + chance 概率保证多数回合仍平 A。若 playtest 反馈"太吵"，降 chance 即可。
- **③事件强度**：sealed_box +8 腐化 / blood_pool +3 是新腐化源，献祭井 -12 是新净化源——净方向偏净化（设计意图：普通局净化稀缺是批1 遗留痛点）。锚点已对齐喷泉/神龛，超调风险低。
- **④教学卡打断节奏**：腐化跨档可能发生在战斗中——卡片是模态 overlay。缓解：队列机制天然顺延（item-intro 同款）；worst case 战斗中弹卡，玩家按任意键关，成本可接受。
- **⑦挂点成环**：enemies.ts ↔ dungeon.ts import 若成环，退 render 帧驱动方案 b（已备好）。
- **⑤ name 烘焙边界**：本批只清渲染路径硬编码，mid-run 切语言旧档混语是已知结构性问题（批3），勿在本批顺手扩大战场。

## 6. Follow-ups（明确不做，转批3+）

- Boss 专属 16×16 模板（8 Boss 同剪影）、emoji 全量 sprite 化、手柄全导航焦点系统——批3 大投资三巨头。
- 事件站点专属 sprite（本批 glyph 回退）、教学卡符号 sprite 化。
- mid-run 切语言（item.name 由 id 反查现译）。
- 职业第二技能/菌穴分支加厚/套装触发机制（中价值内容项，批3 挑选）。
- Boss/事件数值 playtest 调优批。
