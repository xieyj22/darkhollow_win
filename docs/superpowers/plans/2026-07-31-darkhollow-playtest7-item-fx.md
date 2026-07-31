# Playtest #7: Item FX Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give all 12 currently-fx-less scroll/potion/consumable `useItem` effects a distinct animation — add one new FX primitive `fxAura` (expanding stroked ring) for the 8 sustained self-buffs + map-reveal, and wire the other 4 to existing `fxBurst`/`fxFlash`.

**Architecture:** Two-file change. `src/fx.ts` gains an additive `aura` kind (new export `fxAura` + a `drawFx` branch — the existing 4 kinds are untouched). `src/items.ts useItem` adds one fx call to each of 12 bare `case` branches, per the spec's mapping table.

**Tech Stack:** TypeScript, Vite, Canvas 2D. Pinned at `11058c1`.

## Global Constraints

(From `docs/superpowers/specs/2026-07-31-playtest7-fx-design.md`; every task inherits these.)

- **No regression to working fx:** the 14 effects that already have fx (heal/mana/ward/haste/fireball/lightning/blizzard/holy_blast/summon_ally/bomb/throw_knife/holy_water/teleport/smoke_bomb) are NOT modified.
- **No new engine primitives besides `fxAura`:** the existing `flash`/`beam`/`bolt`/`dash` kinds' behavior is unchanged; `aura` is purely additive.
- **reducedMotion:** `fxAura` self-guards on `reducedMotion` exactly like `fxFlash`.
- **No unit tests for fx** — happy-dom has no canvas2d `getContext`; validation = `npm run typecheck` + `npm run build` clean + code-level review + manual/headless visual confirmation. (Consistent with existing `fx.ts`, which has no unit tests.)
- Code pinned at `11058c1`.

---

## File Structure

- **Modify `src/fx.ts`**: add `'aura'` to the `FxKind` union; export `fxAura(x, y, color, scale?)`; add an `aura` branch in `drawFx`. (One clear responsibility: the FX engine.)
- **Modify `src/items.ts`**: in `useItem`, add the `fxAura` import and one fx call to each of the 12 bare `case` branches. (One clear responsibility: item-use effects.)

---

## Task 1: `fxAura` primitive in `src/fx.ts`

**Files:**
- Modify: `src/fx.ts` (`FxKind` type ~L8; new export after `fxFlash` ~L79; new `drawFx` branch among the kind checks ~L156-197)

**Interfaces:**
- Produces: `fxAura(x: number, y: number, color: string, scale?: number): void` — exported. Task 2 consumes it. Behavior: pushes an `Fx` with `kind: 'aura'`, `maxLife: 12`, `size: TS * 0.6 * scale`; draws as an expanding stroked ring that fades.

- [ ] **Step 1: Extend the `FxKind` union**

`src/fx.ts` L8 — change:
```ts
type FxKind = 'flash' | 'beam' | 'bolt' | 'dash';
```
to:
```ts
type FxKind = 'flash' | 'beam' | 'bolt' | 'dash' | 'aura';
```

- [ ] **Step 2: Add the `fxAura` export**

Insert immediately after the `fxFlash` function (after ~L79), mirroring its shape:
```ts
// Expanding stroked ring on a tile — sustained self-buff / aura. Visually distinct
// from fxFlash's filled radial glow: reads as "buff applied to self".
export function fxAura(x: number, y: number, color: string, scale = 1): void {
  if (reducedMotion) return;
  fxs.push({ kind: 'aura', x, y, tx: x, ty: y, life: 0, maxLife: 12, color, size: TS * 0.6 * scale });
  trim(fxs, MAX_FX);
}
```

- [ ] **Step 3: Add the `aura` branch in `drawFx`**

Inside the per-fx loop in `drawFx`, alongside the `flash`/`beam`/`dash`/`bolt` branches (add after the `flash` branch, before `else if (f.kind === 'beam')` ~L162). The branch uses the already-computed `a = 1 - t` and `r,g,b` from `rgb(f.color)`:
```ts
      if (f.kind === 'aura') {
        const cx = pxX(f.x), cy = pxY(f.y);
        const rad = Math.max(1, f.size * (0.4 + t * 1.8));
        c.globalAlpha = a;
        c.strokeStyle = `rgba(${r},${g},${b},${a})`;
        c.lineWidth = 2 + (1 - t) * 1.5;
        c.shadowColor = f.color; c.shadowBlur = 10;
        c.beginPath(); c.arc(cx, cy, rad, 0, Math.PI * 2); c.stroke();
        c.shadowBlur = 0;
      } else if (f.kind === 'flash') {
```
(Convert the existing `if (f.kind === 'flash') {` into `else if` after the new `aura` branch, or keep `flash` first and append `aura` as a final `else if` before the `bolt` default — either order works since kinds are mutually exclusive. Keep the `bolt` branch as the final `else`.)

- [ ] **Step 4: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean. (The new kind is exhaustive in the union; the `drawFx` branch handles it.)

- [ ] **Step 5: Commit**

```bash
git add src/fx.ts
git commit -m "Playtest #7 Task 1: fxAura primitive (expanding ring fx kind)"
```

---

## Task 2: wire the 12 bare `useItem` effects in `src/items.ts`

**Files:**
- Modify: `src/items.ts` (fx import L8; 12 `case` branches in `useItem` ~L150-267)

**Interfaces:**
- Consumes: `fxAura` from Task 1; existing `fxBurst`/`fxFlash` (already imported L8); `flt` (already imported and used elsewhere in the file).

- [ ] **Step 1: Add `fxAura` to the fx import**

`src/items.ts` L8 — change:
```ts
import { fxBeam, fxBolt, fxBurst, fxFlash } from './fx.js';
```
to:
```ts
import { fxBeam, fxBolt, fxBurst, fxFlash, fxAura } from './fx.js';
```

- [ ] **Step 2: Wire the 8 `fxAura` cases (sustained self-buffs + map reveal)**

In each branch, add the `fxAura` call right before `break;` (after the existing `addMsg`):

- `case 'str_buff'` (~L150): add `fxAura(p.x, p.y, '#ff6b6b');`
- `case 'def_buff'` (~L151): add `fxAura(p.x, p.y, '#8d99ae');`
- `case 'el_res_fire'` (~L154): add `fxAura(p.x, p.y, '#ff7a45');`
- `case 'el_res_ice'` (~L155): add `fxAura(p.x, p.y, '#7ec8e3');`
- `case 'shield'` (~L191): add `fxAura(p.x, p.y, '#4895ef');`
- `case 'torch'` (~L245): add `fxAura(p.x, p.y, '#ffae42', 1.4);`
- `case 'invis'` (~L267): add `fxAura(p.x, p.y, '#9a2be2');`
- `case 'mapping'` (~L190): add `fxAura(p.x, p.y, '#ffd700', 2);`

- [ ] **Step 3: Wire the 3 `fxBurst` cases (antidote / fear / bear_trap)**

- `case 'antidote'` (~L260): add `fxBurst(p.x, p.y, '#80ed99', 14);` before the existing `snd('heal');` (or before `break`).
- `case 'fear'` (~L192) — the branch already builds `nb` and does `nb.forEach(e => e.feared = rng(5, 10));`. Change that forEach to also burst each enemy:
  ```ts
  nb.forEach(e => { e.feared = rng(5, 10); fxBurst(e.x, e.y, '#6a3a8a', 10); });
  ```
- `case 'bear_trap'` (~L246-248) — after `G.traps.push(trap);` and before `addMsg`, add:
  ```ts
  fxBurst(p.x, p.y, '#a0522d', 8); flt(p.x, p.y, '🐾', '#a0522d');
  ```

- [ ] **Step 4: Wire `recall` (`fxFlash` ×2, old position captured before the move)**

`case 'recall'` (~L266) — replace:
```ts
case 'recall': { const rm = G.dungeon.rooms[0]; p.x = rm.cx; p.y = rm.cy; addMsg(lang === 'zh' ? '传送回起点！' : 'Recalled to start!', 'mi'); break; }
```
with (capture old position BEFORE reassigning):
```ts
case 'recall': { const rm = G.dungeon.rooms[0]; const ox = p.x, oy = p.y; p.x = rm.cx; p.y = rm.cy; fxFlash(ox, oy, '#9b5de5', 1.4); fxFlash(p.x, p.y, '#9b5de5', 1.4); flt(ox, oy, '⮐', '#9b5de5'); addMsg(lang === 'zh' ? '传送回起点！' : 'Recalled to start!', 'mi'); break; }
```

- [ ] **Step 5: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean.

- [ ] **Step 6: Visual confirmation (manual/headless — NOT automatable; canvas can't render in happy-dom)**

The implementer/subagent CANNOT visually verify fx (no canvas2d in the headless test env). Code-level verification (Step 5 + reviewer) is the automated gate. Actual visual confirmation is the user's playtest: `npm run dev` (or the next exe build), drink one of each of the 12 items, confirm a distinct animation fires and reduced-motion suppresses it. Note this explicitly in the report — do not claim visual verification you did not do.

- [ ] **Step 7: Commit**

```bash
git add src/items.ts
git commit -m "Playtest #7 Task 2: wire 12 useItem effects to fx (aura/burst/flash)"
```

---

## Self-Review

**1. Spec coverage** — vs `2026-07-31-playtest7-fx-design.md`:
- New `fxAura` primitive (signature, `maxLife:12`, `size: TS*0.6*scale`, expanding stroked ring, reducedMotion guard) → Task 1. ✅
- 8 `fxAura` cases (str_buff/def_buff/shield/el_res_fire/el_res_ice/torch/invis/mapping) with exact colors + torch scale 1.4 + mapping scale 2 → Task 2 Step 2. ✅
- 3 `fxBurst` cases (antidote green-14 / fear dark-purple per enemy in forEach / bear_trap brown-8) → Task 2 Step 3. ✅
- `recall` `fxFlash` ×2 with old-position capture + `flt` → Task 2 Step 4. ✅
- Non-goals respected: no change to the 14 working-fx effects; no buff-expiry fx; `aura` additive only. ✅
- reducedMotion inherited. ✅

**2. Placeholder scan** — no TBD/TODO; every step has the exact code/colors/line anchors. ✅

**3. Type/name consistency** — `fxAura` (Task 1 export) matches the Task 2 import + calls. `FxKind` adds `'aura'`; the `drawFx` branch keys on `f.kind === 'aura'`. The `recall` old-position capture (`ox/oy` before `p.x=`/`p.y=`) is the one ordering-sensitive edit — called out explicitly. The `fear` forEach change preserves the existing `e.feared = rng(5,10)` and only adds the burst. ✅

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-31-darkhollow-playtest7-item-fx.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task (1 → 2), review between. Small, mechanical diff; fast.

**2. Inline Execution** — execute in this session via executing-plans.

Which approach?
