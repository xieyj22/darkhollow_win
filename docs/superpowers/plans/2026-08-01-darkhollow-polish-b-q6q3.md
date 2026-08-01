# Polish-B: Q6 (split) + Q3 (i18n) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: executing-plans (inline) or subagent-driven-development. Checkbox steps.

**Goal:** Split `input.ts`/`items.ts`/`main.ts` into focused modules (Q6) and sweep `lang === 'zh'` → `t()` (Q3), **zero behavior change**. Phased A→D; each phase green before the next.

**Architecture:** Pure relocation — function bodies move verbatim to new modules; public export names/signatures unchanged (call sites only update import paths). `items.ts` gets characterization tests first (the memory's "test before split" mandate); `input`/`main` are DOM-heavy relocations guarded by typecheck+build+smoke.

**Tech Stack:** TS, Vite, vitest+happy-dom. Pinned at `058d680`.

## Global Constraints

(From `docs/superpowers/specs/2026-08-01-polish-b-q6q3-design.md`.)
- **Zero behavior change** — move bodies verbatim; no logic edits.
- **Public exports stable** (name + signature) — only import paths change at call sites.
- **New modules are one-way dependencies** (no import cycles); typecheck catches any.
- Each phase ends with `npx vitest run` (all green) + `npx tsc --noEmit` + `npm run build` clean.
- Q3 last; finish with `grep "lang === 'zh'" src/` ≈ 0 (hard gate; documented exceptions only).
- Code pinned at `058d680`.

---

## Phase A — split `items.ts` (tests first)

### Task A1: characterization tests for the gen* functions
**Files:** Create `src/__tests__/items.test.ts`.
**Why:** lock generation behavior *before* moving gen* to `item-gen.ts`; the same tests must pass post-move (import flipped to `item-gen.js`).

- [ ] **Write `src/__tests__/items.test.ts`:**
```ts
import { describe, it, expect, vi } from 'vitest';
vi.mock('../state.js', () => ({ G: { floor: 5 }, lang: 'en' }));
vi.mock('../utils.js', () => ({ rng: () => 0, pick: <T>(a: T[]) => a[0], dst: () => 1 }));
vi.mock('../combat.js', () => ({ recalc: () => {}, checkLevelUp: () => {}, killEnemy: () => {}, applyCorruption: () => {}, playerDeath: () => {} }));
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../effects.js', () => ({ flt: () => {} }));
vi.mock('../fx.js', () => ({ fxBeam: () => {}, fxBolt: () => {}, fxBurst: () => {}, fxFlash: () => {}, fxAura: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: () => {} }));

import { genItem, genWeapon, genArmor, genAcc, genPotion, genScroll, genFood, genConsumable, isGear, isConsumable } from '../items.js';

describe('isGear / isConsumable', () => {
  it('classifies by type', () => {
    expect(isGear({ type: 'weapon' } as any)).toBe(true);
    expect(isGear({ type: 'armor' } as any)).toBe(true);
    expect(isGear({ type: 'accessory' } as any)).toBe(true);
    expect(isGear({ type: 'potion' } as any)).toBe(false);
    expect(isConsumable({ type: 'scroll' } as any)).toBe(true);
    expect(isConsumable({ type: 'consumable' } as any)).toBe(true);
    expect(isConsumable({ type: 'potion' } as any)).toBe(true);
    expect(isConsumable({ type: 'weapon' } as any)).toBe(false);
  });
});

// gen* characterization: with rng→0 + pick→first, assert a valid Item of the right
// type with sane stats. These invariants must hold identically after the move.
describe('gen* produce valid items', () => {
  it('genWeapon', () => {
    const w = genWeapon(5);
    expect(w.type).toBe('weapon');
    expect(w.atk).toBeGreaterThanOrEqual(0);
    expect(w.rarity).toBeGreaterThanOrEqual(0);
    expect(typeof w.name).toBe('string'); expect(typeof w.ch).toBe('string');
    expect(w.x).toBe(0); expect(w.y).toBe(0);
  });
  it('genArmor', () => { const a = genArmor(5); expect(a.type).toBe('armor'); expect(a.def).toBeGreaterThanOrEqual(0); expect(a.x).toBe(0); });
  it('genAcc', () => { const a = genAcc(5); expect(a.type).toBe('accessory'); expect(typeof a.atk === 'number' || a.atk === undefined).toBe(true); });
  it('genPotion', () => { const p = genPotion(5); expect(p.type).toBe('potion'); expect(p.val).toBeGreaterThanOrEqual(0); expect(p.rarity).toBe(0); });
  it('genScroll', () => { const s = genScroll(5); expect(s.type).toBe('scroll'); expect(s.val).toBeGreaterThanOrEqual(0); expect(s.rarity).toBe(1); });
  it('genFood', () => { const f = genFood(5); expect(f.type).toBe('food'); expect(f.val).toBeGreaterThanOrEqual(0); });
  it('genConsumable', () => { const c = genConsumable(5); expect(c.type).toBe('consumable'); expect(['bomb','throw_knife','torch','bear_trap','smoke_bomb','ward','haste','antidote','holy_water','recall','invis','purify']).toContain(c.ef); });
  it('genItem returns a valid type', () => {
    const it = genItem(5);
    expect(['weapon','armor','accessory','potion','scroll','food','consumable']).toContain(it.type);
  });
});
```
- [ ] Run `npx vitest run src/__tests__/items.test.ts` → GREEN (captures pre-move behavior). Commit `Polish-B A1: item-gen characterization tests`.

### Task A2: extract `item-gen.ts`
**Files:** Create `src/item-gen.ts`; modify `src/items.ts` (remove moved fns) + any call-site imports.

- [ ] **Move** (cut verbatim from items.ts → item-gen.ts): `genItem`, `isGear`, `isConsumable`, `genWeapon`, `genArmor`, `genAcc`, `genPotion`, `genScroll`, `genFood`, `genConsumable`. Move their imports too (data tables `ALL_WEAPONS/ALL_ARMORS/ALL_ACCESSORIES/ALL_POTIONS/ALL_SCROLLS/FOODS/ALL_CONSUMABLES`, `itemName`/`rar`-related from i18n, `rng`/`pick` from utils, `lang`/`G` from state).
- [ ] **items.ts**: remove those fns; `import { genItem, isGear, isConsumable } from './item-gen.js'` (items.ts uses genItem for loot + isGear/isConsumable for caps). Keep `export`-re-export of genItem/isGear/isConsumable from items.ts IF other modules import them from items — **grep first** (`grep -rn "from './items" src/` and `genItem\|isGear\|isConsumable`) to find call sites; either re-export or update them to import from item-gen.
  - Known: `combat.ts` `_genItem` late-bound via `setGenItemFn` → `main.ts` wires `setCombatGenItem(genItem)` — update main.ts to import genItem from `item-gen.js`.
- [ ] **Flip the test import**: `items.test.ts` → `import { ... } from '../item-gen.js'` (the gen*) + keep isGear/isConsumable from wherever they land. Re-run → must still be GREEN (proves behavior unchanged).
- [ ] `npx vitest run` (all green, +items.test) + `npx tsc --noEmit` + `npm run build`. Commit `Polish-B A2: extract item-gen.ts from items.ts`.

---

## Phase B — split `input.ts`

### Task B1: extract `panels.ts`
**Files:** Create `src/panels.ts`; modify `src/input.ts`.

- [ ] **Move** (verbatim): inventory group (`openInventory`/`openInventorySell`/`closeInventory`/`mkInvBtn`/`renderInv` + its `sellMode` state), help (`openHelp`/`closeHelp`/`renderHelp`), skill (`tryCastSkill`/`openSkillPanel`/`closeSkillPanel`/`renderSkillPanel`/`await_getClasses`), achievements (`openAchievements`/`closeAchievements`/`renderAch`), talent (`openTalentPanel`/`closeTalentPanel`/`renderTalentPanel`). Move their dependencies (setInvOpen/setHelpOpen/etc from state, items/skills/meta fns, CLASSES/data, i18n, bridge).
- [ ] **input.ts**: `import { openInventory, openHelp, tryCastSkill, ... } from './panels.js'` for the key-dispatch calls in `initInput`. Keep `initInput`/`closeActiveOverlay`/`pollGamepad`/`initTouchControls`.
- [ ] **Watch for cycles**: panels.ts imports items/skills/meta; if any of those import input.ts (grep), use late-binding. typecheck catches it.
- [ ] `npx tsc --noEmit` + `npm run build` + `npx vitest run` (still green) + manual smoke (B/I/T/K keys open the right panels). Commit `Polish-B B1: extract panels.ts from input.ts`.

---

## Phase C — split `main.ts`

### Task C1: extract `ui-settings.ts`
**Files:** Create `src/ui-settings.ts`; modify `src/main.ts`.

- [ ] **Move** (verbatim): `adjustZoom`/`applyZoom`, `adjustSafe`/`applySafe`, `applyReducedMotion`/`toggleReducedMotion`, `minimapZoom`, `toggleLang`/`updateLangUI`, `toggleSound`/`updateSoundBtn`/`applyAudioUI`. Move their state imports (uiZoom/safeZone/reducedMotion/lang/muted/minimapScale/legendVisible + setters).
- [ ] **main.ts**: import these back; `bindButtons`/`window-load` call them. (Some are wired into `bridge.*` in main.ts — keep the bridge assignment lines in main.ts, just import the fn from ui-settings.)
- [ ] typecheck + build + vitest + smoke (sliders/lang/sound). Commit `Polish-B C1: extract ui-settings.ts`.

### Task C2: extract `ui-panels.ts`
**Files:** Create `src/ui-panels.ts`; modify `src/main.ts`.

- [ ] **Move** (verbatim): `toggleLegend`/`renderLegend`, `toggleObjective`, `toggleKeys`/`renderKeyHints`, `initTooltip`, `showOverlay`/`hideOverlay`, `openPause`/`closePause`, `renderRecords`/`renderCodex`. Move deps (paintIcon, getMeta, LORE_ENTRIES, etc.).
- [ ] **main.ts**: import them back; bindButtons binds codex/records/etc. via the imported fns.
- [ ] typecheck + build + vitest + smoke (legend/keys/records/codex/pause/tooltip). Commit `Polish-B C2: extract ui-panels.ts`.

---

## Phase D — Q3: `lang === 'zh'` → `t()`

### Task D1: i18n sweep
**Files:** all `src/*.ts` with `lang === 'zh'`.

- [ ] **Inventory**: `grep -rn "lang === 'zh'" src/ | wc -l` (~241). Group by file.
- [ ] For each site: replace `lang === 'zh' ? A : B` with `t('key')`; add the `key: { en: B, zh: A }` to `L` in `src/i18n.ts` if missing. For interpolated strings use `tMsg('key', arg)` (existing helper) or build with the looked-up `t()` pieces. Reuse existing keys where the text already exists in `L`.
- [ ] **Hard gate**: `grep -rn "lang === 'zh'" src/ | wc -l` ≈ 0 (allow ≤ a handful of genuinely-dynamic ones, each with an inline comment explaining why it can't be keyed).
- [ ] `npx vitest run` + `npx tsc --noEmit` + `npm run build`. Manual smoke: switch EN/ZH, confirm all text still correct (a missing/wrong key shows the raw key string).
- [ ] Commit `Polish-B D1: Q3 sweep lang===→t()`.

---

## Final verification

- [ ] `npx vitest run` all green (132 + items.test + any Q3 additions).
- [ ] `npx tsc --noEmit` + `npm run build` clean.
- [ ] `grep -rn "lang === 'zh'" src/ | wc -l` ≈ 0.
- [ ] Full manual smoke: all panels, settings, EN/ZH toggle, a short playthrough (move/fight/item/equip/floor). Then push (per user).

---

## Self-Review

**1. Spec coverage:** items split + characterization (A) ✅; input split (B) ✅; main split (C1+C2) ✅; Q3 sweep (D) ✅. Test strategy: items characterized (A1 real test), input/main typecheck+build+smoke ✅. Phasing A→D ✅.
**2. Placeholders:** A1 is full test code. A2/B1/C1/C2 list exact functions to move (from the inventory) + the import-fixup rule (grep call sites, re-export or update) + verify. D1 gives the sweep procedure + hard gate. Relocation tasks can't inline 100s of lines of bodies — they enumerate moves + the rule, which is correct for a verbatim-move refactor.
**3. Type consistency:** gen* names match between items.ts (current) and item-gen.ts (A2). The A1 test's import flips items→item-gen post-move (called out). Public exports stay stable (constraint), so combat/player/main call sites only change import paths. Late-bound `setGenItemFn(genItem)` wiring (main.ts) flagged for the genItem move.

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-08-01-darkhollow-polish-b-q6q3.md`. **Inline execution** (per user: "做完再push"). Proceeding A→D.
