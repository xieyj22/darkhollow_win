# Playtest #9 Phase 3: Warden Legacy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development or executing-plans. Checkbox steps.

**Goal:** A 100-corruption death records the descender as a `WardenLegacy`; future `spawnWarden` calls name the Warden "守渊人 · 前<descender>" (formerly you); killing such a legacy Warden grants the `warden_self_slay` achievement. Closes the #9 arc (corruption → endings → you become the Warden).

**Architecture:** `MetaSave.wardens` (cap 10) is the cross-run store. `wardenDeath` records; `spawnWarden` reads + renames; `grantKillRewards` flags the kill. `Enemy.legacyWarden` is a runtime flag (floor enemies don't persist, so no save impact).

**Tech Stack:** TypeScript, Vite, vitest+happy-dom. Pinned at `957781d`.

## Global Constraints

(From `docs/superpowers/specs/2026-08-01-legacy-design.md`.)
- **Only 100-corruption (warden) deaths convert**; normal deaths/endings don't record a legacy.
- **wardens capped at 10**, newest first.
- No ghost/relic/note encounters; no relic-drop-from-legacy; no dynamic codex list (all follow-ups).
- No stat/combat/ending changes; spawnWarden with no wardens behaves exactly as Phase 1.
- Code pinned at `957781d`.

---

## File Structure

- **Modify `src/types.ts`**: `WardenLegacy` interface; `MetaSave.wardens: WardenLegacy[]`; `Enemy.legacyWarden?: boolean`.
- **Modify `src/meta.ts`**: `initMeta`/`getMeta` wardens migration; new `recordWardenLegacy`.
- **Create `src/__tests__/legacy.test.ts`**: `recordWardenLegacy` cap-10 + newest-first.
- **Modify `src/combat.ts`**: `wardenDeath` records legacy (import `recordWardenLegacy`); `grantKillRewards` warden branch → self-slayer ach.
- **Modify `src/enemies.ts`**: `spawnWarden` legacy name + flag (import `getMeta`).
- **Modify `src/data.ts`**: `ACH_DEFS` +`warden_self_slay`.

---

## Task 1: types + meta + test

**Files:** `src/types.ts`, `src/meta.ts`, `src/__tests__/legacy.test.ts`.

- [ ] **types.ts** — add near the run-record types:
```ts
export interface WardenLegacy { name: string; cls: number; race: number; floor: number; ts: number; }
```
`MetaSave` add `wardens: WardenLegacy[];` (after `unlockedLore`). `Enemy` add `legacyWarden?: boolean;` (after `isWarden?`).
- [ ] **meta.ts** — `initMeta` add `wardens: []`; `getMeta` migration `if (!m.wardens) m.wardens = [];`; new export:
```ts
export function recordWardenLegacy(name: string, cls: number, race: number, floor: number): void {
  const m = getMeta();
  m.wardens.unshift({ name, cls, race, floor, ts: Date.now() });
  if (m.wardens.length > 10) m.wardens.length = 10;
  saveMeta(m);
}
```
- [ ] **test** `src/__tests__/legacy.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../data.js', () => ({ META_UPGRADES: [], ACH_DEFS: [], RELICS: [] }));
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../state.js', () => ({ lang: 'en' }));
import { recordWardenLegacy, getMeta } from '../meta.js';

beforeEach(() => localStorage.clear());
describe('recordWardenLegacy', () => {
  it('caps at 10, newest first', () => {
    for (let i = 0; i < 12; i++) recordWardenLegacy(`h${i}`, 0, 0, 1 + i);
    const w = getMeta().wardens;
    expect(w).toHaveLength(10);
    expect(w[0].name).toBe('h11'); // newest first
    expect(w[9].name).toBe('h2');
  });
});
```
- [ ] RED→GREEN; typecheck + build. Commit `Wave9P3 Task 1: WardenLegacy types + meta recordWardenLegacy + cap test`.

---

## Task 2: `wardenDeath` records the legacy

**Files:** `src/combat.ts` (imports; `wardenDeath`).

- [ ] **import** — add `recordWardenLegacy` to the meta import (`import { ..., recordRun, unlockLore, recordWardenLegacy } from './meta.js';`).
- [ ] **`wardenDeath`** — replace the Phase 1 body with the recording version:
```ts
function wardenDeath(): void {
  if (!G) return;
  const p = G.player;
  const nm = lang === 'zh' ? p.raceName + p.clsName : p.raceName + ' ' + p.clsName;
  recordWardenLegacy(nm, p.ci, p.ri, G.floor);
  addMsg(lang === 'zh' ? '你不复是你……你加入了守渊人的行列,将在未来阻挡后来的下探者。' : 'You are no longer you... you join the Wardens, and will hunt future Descenders.', 'md');
  playerDeath(lang === 'zh' ? '化作守渊人' : 'became the Warden');
}
```
- [ ] `npx tsc --noEmit && npm run build`; vitest. Commit `Wave9P3 Task 2: wardenDeath records a WardenLegacy`.

---

## Task 3: spawnWarden legacy name + self-slayer achievement

**Files:** `src/enemies.ts` (`spawnWarden`), `src/combat.ts` (`grantKillRewards`), `src/data.ts` (`ACH_DEFS`).

- [ ] **enemies.ts import** — add `getMeta` to the meta import (`import { bonusExp, getMeta } from './meta.js';` — confirm exact import line at impl).
- [ ] **`spawnWarden`** — before the `G.enemies.push({...})`, compute the legacy name + flag:
```ts
  const wardens = getMeta().wardens;
  let wName = lang === 'zh' ? '守渊人' : 'The Warden';
  let legacyWarden = false;
  if (wardens.length) {
    const leg = wardens[Math.floor(Math.random() * wardens.length)];
    wName = lang === 'zh' ? `守渊人 · 前${leg.name}` : `The Warden — formerly ${leg.name}`;
    legacyWarden = true;
  }
```
then in the pushed enemy literal use `name: wName,` and add `legacyWarden,` (replace the old `name: lang === 'zh' ? '守渊人' : 'The Warden',`).
- [ ] **combat.ts `grantKillRewards`** — in the Phase 1 warden branch (`if (e.isWarden) { ... }`), after the relic/memory handling, add `if (e.legacyWarden) checkAch('warden_self_slay');`.
- [ ] **data.ts `ACH_DEFS`** — append:
```ts
  { id: 'warden_self_slay', icon: '🗡', n: { en: 'Self-Slayer', zh: '弑前' }, d: { en: 'Slay a Warden that was once you', zh: '击杀一个曾是你的守渊人' } },
```
- [ ] `npx tsc --noEmit && npm run build`; vitest. Commit `Wave9P3 Task 3: spawnWarden legacy name + self-slayer achievement`.

---

## Task 4: verification

- [ ] `npx vitest run` all green (legacy.test + existing 130).
- [ ] `npx tsc --noEmit && npm run build` clean.
- [ ] Playtest (manual): die at 100 corruption → message "joined the Wardens"; new run → a Warden spawn shows "守渊人 · 前<name>"; kill it → `warden_self_slay` achievement; a run with no prior warden-deaths → plain "守渊人" (Phase 1 behavior).

---

## Self-Review

**1. Spec coverage:** WardenLegacy + MetaSave.wardens + Enemy.legacyWarden + recordWardenLegacy + cap (Task 1) ✅; wardenDeath records (Task 2) ✅; spawnWarden legacy name+flag + self-slayer ach + ACH_DEFS (Task 3) ✅. Only-100-corr-converts (wardenDeath is the only recorder) ✅. Non-goals (no ghost/relic/note/codex) ✅.
**2. Placeholders:** Task 1 full code+test. Tasks 2-3 exact snippets (wardenDeath body, spawnWarden name block, grantKillRewards check, ACH_DEFS entry). spawnWarden's import line + push-literal edit flagged "confirm exact at impl" (read the current spawnWarden).
**3. Type consistency:** `WardenLegacy`/`wardens`/`legacyWarden`/`recordWardenLegacy` names match across tasks. `recordWardenLegacy(name, cls, race, floor)` signature matches wardenDeath's call (`nm, p.ci, p.ri, G.floor`). `warden_self_slay` id matches between ACH_DEFS and grantKillRewards. spawnWarden's `legacyWarden` flag is read by grantKillRewards via `e.legacyWarden`.

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-08-01-darkhollow-playtest9-legacy.md`. Options:
**1. Subagent-Driven** · **2. Inline Execution**. Which?
