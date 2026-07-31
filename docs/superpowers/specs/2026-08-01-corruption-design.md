# Playtest #9 Phase 1 — 深渊腐化 (Corruption) — Design Spec

Brainstorm design spec.对应 `darkhollow`. 本规格是 #9 Phase 1 实现与验收的对照基准。这是「深渊化」arc 的第一步(Phase 2=多结局、Phase 3=前人遗志,各自独立 spec)。

提交基准:`2c86a3d`(#10 合并后的 main HEAD)。代码引用 pin 此 commit。

---

## Goal

新增一个 run-scoped 的 **腐化 (Corruption)** 数值(0-100):下探本身 + 施法 + 被暗影击中 + 踩深渊水 会累积腐化;腐化越高 = 法强/暴击越强但治疗/生存越差,越过 80 进入"变异"危险区,达到 100 **化作守渊人(run 结束)**。给游戏一个标志性的风险/收益机制,把战斗/守渊人串起来。

**Phase 1 范围**:腐化数值 + 层级效果 + 累积 + 净化 + UI 槽 + 100 化守渊人(硬上限)。**不含**结局判定(Phase 2 用腐化)、遗志持久化(Phase 3)。

## Context (current state, 本规格复用/改动)

- [`Player` types.ts](src/types.ts):加 `corruption: number`(run-scoped,随 Player 入存档)。
- [`recalc()` combat.ts](src/combat.ts):每回合重算派生属性的天赋/圣物之后,加腐化层级修饰。
- 累积点:`descendStairs`(player.ts)/ 深渊水 tile(events.ts)/ 被暗影击中(combat.ts)/ 施法(skills.ts executeSkill)。
- 净化:喷泉(events.ts -15)/ 神殿(events.ts 新"净化"选项)/ 新消耗品「净水」(-20)。
- UI:`updateUI`(render.ts)侧栏加腐化槽;层级跨越 → `addMsg` + `flt` + 短屏幕色调。

---

## Design

### 1. 数据(`src/corruption.ts` 新纯叶子模块,可单测)

```ts
export const CORRUPTION_MAX = 100;
export type Tier = 'clean' | 'touched' | 'corrupted' | 'mutated' | 'warden';
export interface CorruptionMods { spellPct: number; critPct: number; atk: number; healPct: number; dmgTakenPct: number; perTurnHp: number; }
export function corruptionTier(c: number): Tier { /* c>=100 warden; >=80 mutated; >=50 corrupted; >=20 touched; else clean */ }
export function corruptionMods(c: number): CorruptionMods { /* 按 tier 返回下表 */ }
export function corruptionLabel(t: Tier): I18nText { /* 双语层级名 + 色 */ }
```

层级效果表(recalc 套用):
| 腐化 | Tier | spellPct | critPct | atk | healPct | dmgTakenPct | perTurnHp |
|---|---|---|---|---|---|---|---|
| 0-19 | clean | 0 | 0 | 0 | 0 | 0 | 0 |
| 20-49 | touched | +15 | +5 | 0 | 0 | 0 | 0 |
| 50-79 | corrupted | +30 | +10 | +1 | -10 | +10 | 0 |
| 80-99 | mutated | +50 | +10 | +2 | -20 | +20 | **-1 maxHp/回合** |
| 100 | warden | — | — | — | — | — | **run 结束(化守渊人)** |

### 2. 累积(`addCorruption(p, n)` helper,corruption.ts)

```ts
export function addCorruption(p: Player, n: number): { reached: Tier; crossed: boolean; maxed: boolean }
```
- `p.corruption = clamp(p.corruption + n, 0, CORRUPTION_MAX)`。
- 检测层级跨越(`corruptionTier(before) !== corruptionTier(after)`)→ 返回 `crossed`(调用方发消息/flt/色调)。
- `maxed = (after >= 100)` → 调用方触发化守渊人 game-over(见 §4)。

**累积点**(各 +1,除注明):
- `player.ts descendStairs`:下一层 +1(被动暗流)。
- `events.ts` 深渊水 tile:踩上 +1。
- `combat.ts` `attack(!isP)`:被 `atkEl==='shadow'` 击中 +1。
- `skills.ts executeSkill`:施法(技能) +1(主动源 —— 法师流自然腐化更快)。

### 3. 净化(`addCorruption(p, -n)`)
- 喷泉(events.ts `fountainDrink`):额外 -15 腐化(原有回血保留)。
- 神殿(events.ts `shrinePray`):新增"净化祈祷"选项(-20 腐化,替代随机 buff;或与 buff 二选一)。
- 新消耗品「净水 / Purified Water」(-20 腐化):加进 `data.ts` CONSUMABLES + items.ts `useItem` case(`ef: 'purify'`)。

### 4. 100 化守渊人(硬上限)
`addCorruption` 返回 `maxed=true` 时,调用方(累积点)→ 触发一个特殊 game-over:`playerDeath` 变体或新 `wardenTransformation()`:消息「你不复是你。深渊记住了你 —— 你成了下一个守渊人。」+ death-screen。**Phase 1 不持久化为遗志**(那是 Phase 3);仅 run 结束。

### 5. UI + 反馈
- `render.ts updateUI`:侧栏加腐化槽(紫渐变条,按 tier 变色:clean 灰/touched 淡紫/corrupted 紫/mutated 暗红/warden —) + tier 双语标签。
- 跨层级:`addMsg`("你感到深渊在你体内低语…" 等)+ `flt(p.x,p.y,'CORRUPTED',色)` + 短屏幕色调(`effects.ts` 一个轻 vignette/flash,reducedMotion 退避)。

### 6. 集成 / recalc
`combat.ts recalc()` 在天赋+圣物之后:
```ts
const cm = corruptionMods(p.corruption);
p.spellPower *= (1 + cm.spellPct/100);
p.critChance += cm.critPct/100;
p.atk += cm.atk;
p.healBonus += cm.healPct/100;        // negative = less healing
// dmgTakenPct: 在 attack() 受伤侧乘(攻方 isP=false 时 dmg *= 1+dmgTakenPct/100)
// perTurnHp: 在 turn 循环里扣 maxHp(变异 tier)
```

---

## Non-goals (Phase 1)

- **不做多结局**(Phase 2):腐化只累积;在创世者处按腐化判定结局是 Phase 2。Phase 1 的 100 = 化守渊人(硬死),通关高腐化暂无特殊结局。
- **不做遗志持久化**(Phase 3):100 死后不留 ghost/遗物;仅 run 结束。
- **圣物不直接致腐**:`RelicDef` 无 element 字段;Phase 1 不引入"暗影圣物"概念,主动源仅"施法"。
- **不做"拥抱深渊"显式动作**:施法已覆盖"主动汲取",不加额外按键。
- 不改既有天赋/圣物/职业数值(只叠加腐化修饰)。

---

## Testing and validation

- `npm run typecheck` + `npm run build` 必过。
- **可单测(腐化是纯数学,非 canvas)**:`src/__tests__/corruption.test.ts` —— `corruptionTier` 边界(0/19/20/49/50/79/80/99/100)、`corruptionMods` 各 tier 值、`addCorruption` clamp + 跨层检测 + maxed。这些是纯函数,happy-dom 友好。
- recalc 套用 + 累积点接线:靠 typecheck + build + 代码审查 + playtest(现有 grantKillRewards.test 模式可扩展测 recalc 套腐化修饰)。
- UI 槽/色调:playtest 视觉验。
- **回归**:确认既有 run(0 腐化)行为不变(clean tier 全 0 修饰)。
