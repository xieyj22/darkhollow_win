# Playtest #9 Phase 1: Corruption — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a run-scoped 0-100 Corruption stat with tiered risk/reward (clean→touched→corrupted→mutated→**warden-death at 100**), accrued by descending / abyss water / shadow-hit / spell-cast, cleansed at fountains/shrines/净水, shown in a sidebar meter.

**Architecture:** New pure leaf `src/corruption.ts` (tiers + mods + `addCorruption`) is the testable core. `recalc()` applies tier mods; 4 accrual sites + 3 cleanse sites call `addCorruption`; `updateUI` renders the meter; at 100 a warden-death ends the run. Corruption is pure math (not canvas) → unit-tested, unlike fx/sprites.

**Tech Stack:** TypeScript, Vite, vitest+happy-dom. Pinned at `2c86a3d`.

## Global Constraints

(From `docs/superpowers/specs/2026-08-01-corruption-design.md`.)
- **Run-scoped:** `Player.corruption`, reset each run, persisted in save (Player is serialized whole). Old saves migrate `corruption ?? 0`.
- **Clean tier = zero behavior change** (all mods 0) → existing runs unaffected.
- **100 = warden-death (run ends)** — Phase 1 just ends the run (Phase 3 will persist legacy).
- **No multi-ending / no legacy in Phase 1** (those are Phase 2/3).
- reducedMotion: tier-cross screen tint self-guards (existing pattern).
- Code pinned at `2c86a3d`.

---

## File Structure

- **Create `src/corruption.ts`** (pure leaf: tiers, mods table, `addCorruption`, labels/colors).
- **Create `src/__tests__/corruption.test.ts`** (tier thresholds, mods, clamp/cross/maxed).
- **Modify `src/types.ts`** (`Player.corruption: number`).
- **Modify `src/combat.ts`** (`recalc` apply mods; `attack` apply `dmgTakenPct` on player; `wardenDeath`).
- **Modify `src/player.ts`** (`createPlayer` init `corruption: 0`; `descendStairs` +1).
- **Modify `src/skills.ts`** (`executeSkill` +1 on cast).
- **Modify `src/events.ts`** (abyss water tile +1; fountain -15; shrine purify option -20).
- **Modify `src/items.ts`** (new `purify` consumable case -20).
- **Modify `src/data.ts`** (CONSUMABLES: add 净水/Purified Water).
- **Modify `src/render.ts`** (`updateUI` sidebar meter).
- **Modify `src/save.ts`** (`loadGame` migration `corruption ?? 0`).
- **Modify `src/turn.ts`** (per-turn mutated HP cost) — confirm location at impl.

---

## Task 1: `corruption.ts` pure module + test

**Files:** Create `src/corruption.ts`, `src/__tests__/corruption.test.ts`.
**Interfaces — Produces:** `CORRUPTION_MAX`, `Tier`, `CorruptionMods`, `corruptionTier(c)`, `corruptionMods(c)`, `TIER_LABEL`, `TIER_COLOR`, `addCorruption(p, n)`.

- [ ] **Step 1: Write the failing test** — `src/__tests__/corruption.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { corruptionTier, corruptionMods, addCorruption, CORRUPTION_MAX } from '../corruption.js';

describe('corruptionTier', () => {
  it('threshold boundaries', () => {
    expect(corruptionTier(0)).toBe('clean');
    expect(corruptionTier(19)).toBe('clean');
    expect(corruptionTier(20)).toBe('touched');
    expect(corruptionTier(49)).toBe('touched');
    expect(corruptionTier(50)).toBe('corrupted');
    expect(corruptionTier(79)).toBe('corrupted');
    expect(corruptionTier(80)).toBe('mutated');
    expect(corruptionTier(99)).toBe('mutated');
    expect(corruptionTier(100)).toBe('warden');
  });
});
describe('corruptionMods', () => {
  it('clean is all-zero (no behavior change)', () => {
    const m = corruptionMods(0);
    expect(m).toEqual({ spellPct: 0, critPct: 0, atk: 0, healPct: 0, dmgTakenPct: 0, perTurnHp: 0 });
  });
  it('mutated = biggest spell power + perTurnHp cost + healing penalty', () => {
    const m = corruptionMods(85);
    expect(m.spellPct).toBe(50);
    expect(m.perTurnHp).toBe(1);
    expect(m.healPct).toBe(-20);
  });
});
describe('addCorruption', () => {
  const mk = (c: number) => ({ corruption: c }) as any;
  it('clamps to [0, CORRUPTION_MAX]', () => {
    const p = mk(98); addCorruption(p, 10); expect(p.corruption).toBe(CORRUPTION_MAX);
    addCorruption(p, -999); expect(p.corruption).toBe(0);
  });
  it('detects tier cross + maxed', () => {
    const p = mk(18);
    const r = addCorruption(p, 4);
    expect(r.crossed).toBe(true); expect(r.after).toBe('touched'); expect(r.maxed).toBe(false);
    const p2 = mk(99);
    const r2 = addCorruption(p2, 1);
    expect(r2.maxed).toBe(true); expect(p2.corruption).toBe(100);
  });
  it('no cross within same tier', () => {
    expect(addCorruption(mk(30), 5).crossed).toBe(false);
  });
});
```

- [ ] **Step 2: Run — RED** (`npx vitest run src/__tests__/corruption.test.ts`) → module not found.

- [ ] **Step 3: Write `src/corruption.ts`:**
```ts
// Pure corruption logic — leaf module (imports types only), unit-testable.
import type { Player, I18nText } from './types.js';

export const CORRUPTION_MAX = 100;

export type Tier = 'clean' | 'touched' | 'corrupted' | 'mutated' | 'warden';

export interface CorruptionMods {
  spellPct: number;      // +% spell power
  critPct: number;       // +% crit chance
  atk: number;           // flat atk
  healPct: number;       // +% heal (negative = reduced healing)
  dmgTakenPct: number;   // +% dmg taken (applied to player in attack)
  perTurnHp: number;     // HP cost per turn (mutated tier)
}

export function corruptionTier(c: number): Tier {
  if (c >= 100) return 'warden';
  if (c >= 80) return 'mutated';
  if (c >= 50) return 'corrupted';
  if (c >= 20) return 'touched';
  return 'clean';
}

const MODS: Record<Exclude<Tier, 'warden'>, CorruptionMods> = {
  clean:     { spellPct: 0,  critPct: 0,  atk: 0, healPct: 0,   dmgTakenPct: 0,  perTurnHp: 0 },
  touched:   { spellPct: 15, critPct: 5,  atk: 0, healPct: 0,   dmgTakenPct: 0,  perTurnHp: 0 },
  corrupted: { spellPct: 30, critPct: 10, atk: 1, healPct: -10, dmgTakenPct: 10, perTurnHp: 0 },
  mutated:   { spellPct: 50, critPct: 10, atk: 2, healPct: -20, dmgTakenPct: 20, perTurnHp: 1 },
};

export function corruptionMods(c: number): CorruptionMods {
  const t = corruptionTier(c);
  return t === 'warden' ? MODS.mutated : MODS[t];
}

export const TIER_LABEL: Record<Tier, I18nText> = {
  clean:     { en: 'Clean',     zh: '清醒' },
  touched:   { en: 'Touched',   zh: '动摇' },
  corrupted: { en: 'Corrupted', zh: '侵蚀' },
  mutated:   { en: 'Mutated',   zh: '变异' },
  warden:    { en: 'Warden',    zh: '守渊人' },
};

export const TIER_COLOR: Record<Tier, string> = {
  clean: '#8a8a96', touched: '#b583f6', corrupted: '#9a2be2', mutated: '#e63946', warden: '#1a0033',
};

// Add/subtract corruption on a player. Returns tier info so the caller can
// surface cross-tier feedback and trigger warden-death at 100.
export function addCorruption(p: Player, n: number): { before: Tier; after: Tier; crossed: boolean; maxed: boolean } {
  const before = corruptionTier(p.corruption);
  p.corruption = Math.max(0, Math.min(CORRUPTION_MAX, p.corruption + n));
  const after = corruptionTier(p.corruption);
  return { before, after, crossed: before !== after, maxed: after === 'warden' };
}
```

- [ ] **Step 4: Run — GREEN.** Step 5: `npm run typecheck && npm run build` clean. Step 6: commit `Wave9 Task 1: corruption pure module + test`.

---

## Task 2: types + createPlayer + recalc integration

**Files:** `src/types.ts` (Player), `src/player.ts` (createPlayer), `src/combat.ts` (recalc, attack), `src/turn.ts` (per-turn HP).

- [ ] **types.ts** — `Player` add `corruption: number;` (near `relics`).
- [ ] **player.ts `createPlayer`** — init `corruption: 0` in the returned player literal.
- [ ] **combat.ts `recalc`** — after the talent + relic bonus lines, apply corruption:
```ts
import { corruptionMods } from './corruption.js';
// ...in recalc, after applyRelicBonuses(p):
const cm = corruptionMods(p.corruption);
p.spellPower += p.baseSpellPower * cm.spellPct / 100;
p.critChance += cm.critPct / 100;
p.atk += cm.atk;
p.healBonus += cm.healPct / 100;
// dmgTakenPct + perTurnHp applied at the call sites (attack / turn), not here.
```
- [ ] **combat.ts `attack`** — when the player takes damage (`!isP` branch, before `def.hp -= dmg`): if the defender is the player, scale `dmg` by `corruptionMods(G.player.corruption).dmgTakenPct`. (Add `dmg = Math.floor(dmg * (1 + corruptionMods(G.player.corruption).dmgTakenPct/100));` in the `!isP` path. Cache the mods once.)
- [ ] **turn.ts** — find the per-turn tick (where buffs decrement / poison ticks). For mutated tier, apply `corruptionMods(G.player.corruption).perTurnHp` as HP cost: `if (cm.perTurnHp > 0) { G.player.hp -= cm.perTurnHp; flt(...); if (hp<=0) playerDeath('腐化'); }`. (Locate the exact per-turn hook at impl.)
- [ ] typecheck + build + full vitest (corruption.test green, others unaffected). Commit `Wave9 Task 2: wire corruption into recalc/attack/turn`.

---

## Task 3: accrual (4 sources) + warden-death

**Files:** `src/player.ts` (descendStairs), `src/events.ts` (abyss water), `src/combat.ts` (shadow-hit + wardenDeath), `src/skills.ts` (executeSkill).

- [ ] **Define a small helper** for the cross-tier/maxed feedback + warden-death, e.g. in `combat.ts`:
```ts
export function applyCorruption(p: Player, n: number): void {
  const r = addCorruption(p, n);
  if (r.maxed) { wardenDeath(); return; }
  if (r.crossed && r.after !== 'clean') {
    addMsg(lang === 'zh' ? `🟪 ${TIER_LABEL[r.after].zh}…` : `🟪 ${TIER_LABEL[r.after].en}...`, 'md');
    flt(p.x, p.y, r.after.toUpperCase(), TIER_COLOR[r.after]);
    shake(1.5);
  }
}
function wardenDeath(): void {
  if (!G) return;
  G.gameOver = true;
  addMsg(lang === 'zh' ? '你不复是你。深渊记住了你 —— 你成了下一个守渊人。' : 'You are no longer you. The abyss remembers — you become the next Warden.', 'md');
  playerDeath(lang === 'zh' ? '化作守渊人' : 'became the Warden');
}
```
(Import `addCorruption`, `TIER_LABEL`, `TIER_COLOR` from corruption.js; `addMsg`/`flt`/`shake`/`playerDeath` already in scope.)

- [ ] **player.ts `descendStairs`** — call `applyCorruption(G.player, 1)` (import from combat.js, or expose via late-binding if cycle).
- [ ] **events.ts abyss-water tile** — `applyCorruption(G.player, 1)` where the abyss-water tile effect fires.
- [ ] **combat.ts `attack` (`!isP` branch)** — when `atkEl === 'shadow'`, `applyCorruption(G.player, 1)` after the hit.
- [ ] **skills.ts `executeSkill`** — `applyCorruption(G.player, 1)` on a successful cast.
- [ ] Watch for import cycles (combat↔player↔skills). Use the existing late-binding pattern (`setXFn`) if a cycle appears; `applyCorruption` in combat.ts is the natural home (combat is widely imported).
- [ ] typecheck + build + vitest. Commit `Wave9 Task 3: corruption accrual (4 sources) + warden-death at 100`.

---

## Task 4: cleansing (fountain / shrine / 净水 consumable)

**Files:** `src/events.ts`, `src/items.ts`, `src/data.ts`.

- [ ] **events.ts fountain** — in the fountain drink handler, add `applyCorruption(G.player, -15)` (+ message "🟪 -15 腐化").
- [ ] **events.ts shrine** — add a "Purify" option (-20 corruption) alongside the existing buff prayer. (If the shrine UI is a 2-button pick, add a 3rd; otherwise make purify the shrine's effect half the time. Confirm shrine structure at impl.)
- [ ] **data.ts CONSUMABLES** — add 净水/Purified Water:
```ts
{ n: { en: 'Purified Water', zh: '净水' }, ef: 'purify', v: 20, c: '#7ec8e3', ch: '💧', r: 1, desc: { en: 'Cleanses 20 corruption', zh: '净化 20 腐化' } },
```
- [ ] **items.ts `useItem`** — add `case 'purify': applyCorruption(p, -(item.val||20)); addMsg(...); fxAura(p.x,p.y,'#7ec8e3'); break;` (reuse the `fxAura` from Playtest #7).
- [ ] typecheck + build + vitest. Commit `Wave9 Task 4: corruption cleansing (fountain/shrine/净水)`.

---

## Task 5: UI meter + tier-cross tint + save migration

**Files:** `src/render.ts` (`updateUI`), `src/save.ts` (`loadGame`), maybe `src/effects.ts` (tint).

- [ ] **render.ts `updateUI`** — add a corruption meter element to the sidebar: a labeled purple bar whose width + color track `corruptionTier(p.corruption)` + the tier label. (If no spare sidebar slot exists, add a small `<div id="corruption-bar">` to `index.html` sidebar and populate it in `updateUI`. Use `TIER_COLOR`/`TIER_LABEL`.)
- [ ] **index.html** — add the meter element to the sidebar (e.g. under HP/MP bars).
- [ ] **effects.ts** (optional polish) — a brief screen tint on tier-cross (the `applyCorruption` in Task 3 can call it; reducedMotion guards). Skip if time-tight — the `flt` + message already signal the cross.
- [ ] **save.ts `loadGame`** — migration: `if (gameState.player.corruption === undefined) gameState.player.corruption = 0;` (alongside the other player-field migrations).
- [ ] typecheck + build + vitest. Commit `Wave9 Task 5: corruption UI meter + save migration`.

---

## Task 6: verification

- [ ] `npx vitest run` all green (corruption.test + existing 120).
- [ ] `npm run typecheck && npm run build` clean.
- [ ] Playtest (manual): a clean run stays clean-tier (no behavior change); a mage hitting ~80 corruption sees mutated buffs + per-turn HP drain; hitting 100 → warden-death; fountain/shrine/净水 reduce corruption; meter renders + recolors per tier; EN/ZH tier labels.

---

## Self-Review

**1. Spec coverage:** corruption.ts tiers/mods/addCorruption (Task 1) ✅; Player.corruption + recalc + attack dmgTaken + per-turn HP (Task 2) ✅; 4 accrual sources + warden-death@100 (Task 3) ✅; 3 cleanse sources + 净水 (Task 4) ✅; UI meter + save migration (Task 5) ✅; clean-tier zero-change (Task 1 mods + test) ✅. Non-goals (no endings/legacy) respected.
**2. Placeholders:** Task 1 is full code+test. Tasks 2-5 are function-level edits with exact snippets where code is known (recalc, attack, data.ts consumable, useItem case, migration) and location-guided where the file must be read first (turn.ts per-turn hook, events.ts fountain/shrine structure, render.ts/updateUI sidebar, index.html sidebar slot) — each names the file + what to add + the import.
**3. Type consistency:** `corruptionMods`/`corruptionTier`/`addCorruption`/`TIER_LABEL`/`TIER_COLOR` names match across tasks. `applyCorruption` (Task 3) wraps `addCorruption` + feedback — single accrual entry point used by all 4 sources + cleansing (negative n). `purify` ef + consumable def match. `fxAura` reused (from #7, in fx.ts).

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-08-01-darkhollow-playtest9-corruption.md`. Options:
**1. Subagent-Driven** — per-task subagent + review (Task 1 testable; Tasks 3/5 touch many files).
**2. Inline Execution** — this session via executing-plans.
Which approach?
