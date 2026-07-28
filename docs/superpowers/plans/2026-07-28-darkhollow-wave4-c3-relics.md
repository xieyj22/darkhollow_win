# darkhollow Wave 4-C3(圣物扩充)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development。合并 spec 角色(explore 已给精确接线点)。

**Goal:** 加 4 个新圣物,启用 3 个新 hook(on-kill / on-dodge / on-crit),补 r0 / r3 空缺档。

**Architecture:** `data.ts` RELICS 加 4 条 + `relics.ts` 加 3 个 hook 函数(`relicOnKill`/`relicOnDodge`/`relicOnCrit`)+ 在 `combat.ts`/`skills.ts`/`enemies.ts` 的 talent hook 调用点之后接线(relic hook 与 talent hook 平行)。`worn_amulet` 走现有 `applyRelicBonuses` 被动,不需新 hook。

**Tech Stack:** TypeScript 5.7。

## Global Constraints

- **汉化硬约束**:每条 `n:{zh,en}` / `d:{zh,en}` 双语完整、名要帅。
- 接线必须覆盖所有调用点(on-kill 有 3 处),漏一处会导致不同击杀路径表现不一致——已知易错点。
- 提交基准:`b1dccd6`(C2 merge 后 main HEAD)。

---

## Context(explore 摘要)

- 现有 6 hook:`applyRelicBonuses`(passive,relics.ts:25)、`relicOnHitEnemy`(relics.ts:38,combat.ts:102)、`relicOnDamaged`(relics.ts:76,combat.ts:214)、`relicOnDeath`(relics.ts:87)、`getRelicGoldMult`/`getRelicExpMult`(relics.ts:106-107)。
- talents.ts 现成调用点可复用:`onPlayerKill`(talents.ts:126,被 combat.ts:163/431 + skills.ts:42 调)、`onPlayerDodged`(talents.ts:145,被 combat.ts:70 + enemies.ts:151 调)。**on-crit 无现成 hook**,需在 combat.ts:105 块内新挖。
- rarity 空缺:r0、r3 完全空;加 r3 自然填 F15-29 掉落中间档。
- `hasRelic(id)`(relics.ts:20)判断持有。

---

## Proposed

### 4 个新圣物(`data.ts` RELICS 末尾追加)

| id | en / zh | desc en / zh | ch | c | rarity | effect | value |
|----|---------|------|----|----|--------|--------|-------|
| soul_harvester | Soul Harvester / 猎魂者 | Kills restore 10% MP / 击杀回复10%MP | 💀 | #9b5de5 | 2 | kill_mp | 10 |
| wind_step | Wind Step / 御风步 | Dodging heals 8% HP / 闪避回复8%HP | 🌬 | #7ec8e3 | 2 | dodge_hp | 8 |
| executioner_pact | Executioner Pact / 处刑契约 | Crits heal 15% of damage / 暴击吸取15%伤害 | ⚔ | #b91c3c | 3 | crit_lifesteal | 15 |
| worn_amulet | Worn Amulet / 磨损护符 | +10 max HP / +10 最大生命 | 📿 | #8b7355 | 0 | hp | 10 |

```ts
  { id: 'soul_harvester', n: { en: 'Soul Harvester', zh: '猎魂者' }, d: { en: 'Kills restore 10% MP', zh: '击杀回复10%MP' }, ch: '💀', c: '#9b5de5', rarity: 2, effect: 'kill_mp', value: 10 },
  { id: 'wind_step', n: { en: 'Wind Step', zh: '御风步' }, d: { en: 'Dodging heals 8% HP', zh: '闪避回复8%HP' }, ch: '🌬', c: '#7ec8e3', rarity: 2, effect: 'dodge_hp', value: 8 },
  { id: 'executioner_pact', n: { en: 'Executioner Pact', zh: '处刑契约' }, d: { en: 'Crits heal 15% of damage', zh: '暴击吸取15%伤害' }, ch: '⚔', c: '#b91c3c', rarity: 3, effect: 'crit_lifesteal', value: 15 },
  { id: 'worn_amulet', n: { en: 'Worn Amulet', zh: '磨损护符' }, d: { en: '+10 max HP', zh: '+10 最大生命' }, ch: '📿', c: '#8b7355', rarity: 0, effect: 'hp', value: 10 },
```

### 3 个新 hook(`relics.ts`,在 `relicOnDeath` 之后)

```ts
import { flt } from './effects.js';   // 若 relics.ts 未 import flt,加(下文 Step 2 确认)

// on-kill:击杀回 MP(soul_harvester)
export function relicOnKill(_enemy: Enemy): void {
  if (!G) return;
  const p = G.player;
  if (hasRelic('soul_harvester')) {
    const mp = Math.floor(p.maxMp * 0.10);
    if (mp > 0) { p.mp = Math.min(p.maxMp, p.mp + mp); flt(p.x, p.y, `+${mp}MP`, '#9b5de5'); }
  }
}

// on-dodge:闪避回 HP(wind_step)
export function relicOnDodge(): void {
  if (!G) return;
  const p = G.player;
  if (hasRelic('wind_step')) {
    const hp = Math.floor(p.maxHp * 0.08);
    if (hp > 0) { p.hp = Math.min(p.maxHp, p.hp + hp); flt(p.x, p.y, `+${hp}`, '#80ed99'); }
  }
}

// on-crit:暴击吸血(executioner_pact)
export function relicOnCrit(_defender: Enemy, dmg: number): void {
  if (!G) return;
  const p = G.player;
  if (hasRelic('executioner_pact')) {
    const heal = Math.floor(dmg * 0.15);
    if (heal > 0) { p.hp = Math.min(p.maxHp, p.hp + heal); flt(p.x, p.y, `+${heal}`, '#ff6b6b'); }
  }
}
```

### worn_amulet 被动(`relics.ts` `applyRelicBonuses` 加分支)

在 `applyRelicBonuses`(relics.ts:25)里,参照现有 `giants_belt`(+40 HP)的写法加:
```ts
if (hasRelic('worn_amulet')) p.maxHp += 10;
```

### 接线(combat.ts / skills.ts / enemies.ts)

**on-kill(3 处,每处紧跟 `onPlayerKill(...)` 之后加 `relicOnKill(...)`)**:
- `combat.ts:163`:`onPlayerKill(def as Enemy);` 后加 `relicOnKill(def as Enemy);`
- `combat.ts:431`:`onPlayerKill(e);` 后加 `relicOnKill(e);`
- `skills.ts:42`(`processAoeKills` 内):`onPlayerKill(e);` 后加 `relicOnKill(e);`

**on-dodge(2 处,紧跟 `onPlayerDodged()` 之后加 `relicOnDodge()`)**:
- `combat.ts:70`:`onPlayerDodged();` 后加 `relicOnDodge();`
- `enemies.ts:151`:`onPlayerDodged();` 后加 `relicOnDodge();`

**on-crit(1 处,新挖)**:
- `combat.ts:105-107` 的暴击块内,`dmg = Math.floor(dmg * critMult)` 之后(约 L107)加 `relicOnCrit(def as Enemy, dmg);`

**import**:
- `combat.ts:9`(已 import 自 relics)追加 `relicOnKill, relicOnDodge, relicOnCrit`。
- `skills.ts:14`(import `grantRandomRelic`)追加 `relicOnKill`。
- `enemies.ts` 顶部 import 追加 `relicOnDodge`(从 `./relics.js`)。
- `relics.ts`:确认是否已 import `flt`(若未,`import { flt } from './effects.js'`)。

---

## Task 1: 加 4 圣物 + 3 hook + 接线

**Files:** `src/data.ts`、`src/relics.ts`、`src/combat.ts`、`src/skills.ts`、`src/enemies.ts`

- [ ] **Step 1: `data.ts`** RELICS 末尾追加 4 条(上表)。
- [ ] **Step 2: `relics.ts`** 加 3 个 hook 函数(`relicOnKill`/`relicOnDodge`/`relicOnCrit`)+ `applyRelicBonuses` 加 `worn_amulet` 分支 + 确认 `flt` import。
- [ ] **Step 3: `combat.ts`** 接 on-kill(L163、L431)+ on-dodge(L70)+ on-crit(L107)+ import 追加 3 个。
- [ ] **Step 4: `skills.ts`** 接 on-kill(L42)+ import 追加 `relicOnKill`。
- [ ] **Step 5: `enemies.ts`** 接 on-dodge(L151)+ import 追加 `relicOnDodge`。
- [ ] **Step 6:** `npm run typecheck` + `npm run build` 必绿。
- [ ] **Step 7: 手动 QA**(dev):捡 soul_harvester 杀怪看 +MP;捡 wind_step 闪避看 +HP;捡 executioner_pact 暴击看吸血;捡 worn_amulet 看 maxHP +10;`L` 切中英 4 圣物名/desc 都正常。
- [ ] **Step 8:** commit `feat(content): +4 圣物 启用 on-kill/on-dodge/on-crit hook(补r0/r3)`,提交 5 文件。

---

## Self-Review

- **覆盖**:4 圣物 + 3 hook + 6 接线点(3 on-kill + 2 on-dodge + 1 on-crit)+ worn_amulet 被动。
- **No placeholder**:每步含实际代码 + 行号。
- **易错点**:on-kill 3 处全接(漏则路径不一致);on-crit 新挖点;`flt` import。
- **汉化**:4 圣物 `n`/`d` 双语。
- **YAGNI**:不引入新状态(都用即时效果 heal/mp);不接 on-level-up/on-buff-expire 等(留 follow-up)。
