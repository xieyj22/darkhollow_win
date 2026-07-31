# Playtest #10: Enemy Sprite Variety — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `pickEnemyTemplate` routing (language-independent; English mode no longer mis-renders untagged enemies as GOBLIN) and add **11 new** 16×16 pixel templates so ~70 enemies have far higher visual variety (10 → 21 templates).

**Architecture:** Three-file change. `src/sprites.ts` gains 11 new `TEMPLATES` entries + a rewritten `pickEnemyTemplate` (priority tag chain + `i`-flagged name-regex fallback). `src/data.ts` `ENEMIES` tags are updated per the spec's per-enemy table (~70 enemies). The boss path (`drawBossSprite`) is untouched.

**Tech Stack:** TypeScript, Vite, Canvas 2D. Pinned at `0d1e831`.

## Global Constraints

(From `docs/superpowers/specs/2026-08-01-playtest10-enemy-sprites-design.md`; every task inherits these.)

- **Preserve gameplay tags:** `undead` / `demon` tags are read by `items.ts holy_water` (holy weakness) and must be KEPT on enemies that have them. Only sprite-routing tags (dragon/beast/elemental/construct/spirit/cultist + the 11 new) are changed. The routing priority chain checks the new specific tags BEFORE `undead`/`demon`, so a multi-tag enemy (e.g. Fallen Seraph `[seraph,undead,demon]`) routes to its intended template while keeping holy weakness.
- **No `ch`/`c`/stat changes** to any enemy — only `tags` + new templates + routing.
- **BOSS template untouched** (bosses use `drawBossSprite`).
- **No unit tests for sprites** — happy-dom has no canvas2d `getContext`. Validation = `npm run typecheck` + `npm run build` clean + the existing **dev-time row-length check** (`for row of tpl if row.length !== N console.error`) + visual playtest. (Consistent with existing untested `sprites.ts`.)
- The per-enemy tag mapping is **authoritative in spec §3**; this plan references it.
- Code pinned at `0d1e831`.

---

## File Structure

- **Modify `src/sprites.ts`**: add 11 entries to `TEMPLATES` (BAT/HOUND/INSECT/RODENT/AQUATIC/KNIGHT/BRUTE/MAGE/ABERRATION/SERAPH/FUNGI); rewrite `pickEnemyTemplate` (priority tag chain + `i`-flagged regex fallback).
- **Modify `src/data.ts`**: update `tags` on ~70 `ENEMIES` per spec §3.
- *(Optional)* `src/main.ts renderLegend`: add a few new template icons — non-goal unless time permits.

---

## Task 1: Author 11 new templates in `src/sprites.ts` `TEMPLATES`

**Files:** Modify `src/sprites.ts` (add 11 entries to the `TEMPLATES` record, near the existing enemy templates ~L92-289).

**Interfaces:** Produces 11 new `TEMPLATES` keys consumed by `pickEnemyTemplate` (Task 2).

**Style rules (all 11):**
- Each template is a `string[]` of exactly **16 rows**, every row **exactly 16 chars**. The dev-time check (`for row of tpl if row.length !== N console.error(...)`) enforces this — after authoring, grep the build/browser-console for "bad row len" and fix any.
- Use the established palette codes: `M` main · `D` dark · `L` light · `E` eye-glow · `K` black · `W` white/glass · `G` gold · `C` grey · `N` brown. `buildPalette(color)` derives M/D/L from each enemy's color at draw time, so the SAME template recolors correctly per enemy (e.g. a red HOUND vs grey HOUND).
- Mimic the density/silhouette readability of existing templates (GOBLIN/BEAST/DRAGON) — filled body, 1-2 `E` eyes, `K` outline gaps.

**Worked example — `BAT` (the quality bar; wings + ears + eyes + body):**
```ts
  BAT: [
    "................",
    ".KK..........KK.",
    ".DK..........KD.",
    ".DMMDD....DDMMD.",
    ".DMMMMDDDDMMMMD.",
    "..DMMMMMMMMMMD..",
    "...DMEMMMEMD....",
    "...DMMMMMMMD....",
    "....DKMMKD......",
    ".....DMMMD......",
    "......DKD.......",
    ".......K........",
    "................",
    "................",
    "................",
    "................",
  ],
```

**Per-template specs for the other 10** (author each as 16×16 following the style rules + these intents; structural reference = the existing template noted):

| Template | Visual intent | Structural reference |
|---|---|---|
| `HOUND` | four-legged predator: snout, four legs, raised tail, low body | BEAST (quad) |
| `INSECT` | segmented dome body + 6-8 legs splayed; works for spider & beetle | SLIME (round) + legs |
| `RODENT` | small rounded body, long tail curling, two round ears, snout | BEAST (small) |
| `AQUATIC` | fish/serpent body with dorsal + tail fin, eye mid-body | — (lateral) |
| `KNIGHT` | upright armored humanoid: helmet w/ visor slit (`K` bar), pauldrons, shield bulge on one side | GOBLIN (biped) |
| `BRUTE` | oversized torso, tiny head, long arms, stumpy legs | GOBLIN (bulkier) |
| `MAGE` | robed figure: pointed hood, wide cloak base, `E`/`W` glow at hand (staff orb) | CULTIST (robe) |
| `ABERRATION` | asymmetrical mass: bulbous body, 2-3 tentacles, central `E` eye, jagged `K` gaps | DEMON (mass) |
| `SERAPH` | winged humanoid: two `L`/`W` wings spread, halo (`G`/`W` ring) above head, upright | WRAITH (winged) |
| `FUNGI` | mushroom-cap head (`M` dome + `W`/`D` spots), stalk body, small base | SLIME (cap) |

- [ ] **Step 1: Add the 11 template entries** to `TEMPLATES` (BAT/HOUND/INSECT/RODENT/AQUATIC/KNIGHT/BRUTE/MAGE/ABERRATION/SERAPH/FUNGI), each 16 rows × 16 chars, using the BAT example above as the format/quality bar and the per-template intents.
- [ ] **Step 2: Verify row lengths** — the dev-time loop at the bottom of `sprites.ts` logs `TEMPLATE <k> bad row len <n>` for any wrong row. Run `npm run build` and check for that warning in output; fix any row that isn't 16 chars. (Also eyeball: each template's `.length` === 16 rows.)
- [ ] **Step 3: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean; no `bad row len` warnings.

- [ ] **Step 4: Commit**

```bash
git add src/sprites.ts
git commit -m "Playtest #10 Task 1: 11 new enemy templates (bat/hound/insect/rodent/aquatic/knight/brute/mage/aberration/seraph/fungi)"
```

---

## Task 2: Rewrite `pickEnemyTemplate` routing in `src/sprites.ts`

**Files:** Modify `src/sprites.ts` `pickEnemyTemplate` (~L828-846).

**Interfaces:** Consumes the 11 new template keys (Task 1). Produces correct template selection for any `Enemy` via its `tags` (priority chain) then `i`-flagged name-regex fallback.

- [ ] **Step 1: Replace `pickEnemyTemplate` with the priority-chain version**

```ts
function pickEnemyTemplate(e: Enemy): { tpl: Template; key: string } {
  const tags = e.tags || [];
  const has = (t: string) => tags.includes(t);
  // Priority: most specific first. undead/demon are KEPT on enemies for holy_water
  // gameplay, so the specific templates (seraph/knight/mage/fungi/...) must be
  // checked BEFORE undead/demon so they win the sprite route.
  if (has('dragon'))     return { tpl: TEMPLATES.DRAGON,     key: 'DRAGON' };
  if (has('seraph'))     return { tpl: TEMPLATES.SERAPH,     key: 'SERAPH' };
  if (has('aberration')) return { tpl: TEMPLATES.ABERRATION, key: 'ABERRATION' };
  if (has('spirit'))     return { tpl: TEMPLATES.WRAITH,     key: 'WRAITH' };
  if (has('fungi'))      return { tpl: TEMPLATES.FUNGI,      key: 'FUNGI' };
  if (has('bat'))        return { tpl: TEMPLATES.BAT,        key: 'BAT' };
  if (has('hound'))      return { tpl: TEMPLATES.HOUND,      key: 'HOUND' };
  if (has('insect'))     return { tpl: TEMPLATES.INSECT,     key: 'INSECT' };
  if (has('rodent'))     return { tpl: TEMPLATES.RODENT,     key: 'RODENT' };
  if (has('aquatic'))    return { tpl: TEMPLATES.AQUATIC,    key: 'AQUATIC' };
  if (has('knight'))     return { tpl: TEMPLATES.KNIGHT,     key: 'KNIGHT' };
  if (has('mage'))       return { tpl: TEMPLATES.MAGE,       key: 'MAGE' };
  if (has('brute'))      return { tpl: TEMPLATES.BRUTE,      key: 'BRUTE' };
  if (has('construct'))  return { tpl: TEMPLATES.GOLEM,      key: 'GOLEM' };
  if (has('elemental'))  return { tpl: TEMPLATES.ELEMENTAL,  key: 'ELEMENTAL' };
  if (has('cultist'))    return { tpl: TEMPLATES.CULTIST,    key: 'CULTIST' };
  if (has('demon'))      return { tpl: TEMPLATES.DEMON,      key: 'DEMON' };
  if (has('undead'))     return { tpl: TEMPLATES.SKELETON,   key: 'SKELETON' };
  if (has('slime'))      return { tpl: TEMPLATES.SLIME,      key: 'SLIME' };
  if (has('beast'))      return { tpl: TEMPLATES.BEAST,      key: 'BEAST' };
  // Name-regex fallback — i-flagged so English capitalized names (Wolf/Spider/...)
  // also match (the original was case-sensitive and mis-routed to GOBLIN in en).
  const n = e.name;
  if (/slime|ooze|blob|gel|史莱|黏|胶|果冻/i.test(n))        return { tpl: TEMPLATES.SLIME,     key: 'SLIME' };
  if (/dragon|drake|wyrm|wyvern|龙|蛟/i.test(n))             return { tpl: TEMPLATES.DRAGON,    key: 'DRAGON' };
  if (/golem|gargoyle|construct|魔像|巨像/i.test(n))         return { tpl: TEMPLATES.GOLEM,     key: 'GOLEM' };
  if (/wraith|ghost|spirit|specter|怨灵|幽/i.test(n))        return { tpl: TEMPLATES.WRAITH,    key: 'WRAITH' };
  if (/elemental|behemoth|熔岩|元素/i.test(n))               return { tpl: TEMPLATES.ELEMENTAL, key: 'ELEMENTAL' };
  if (/cultist|zealot|inquisitor|信徒|裁官/i.test(n))        return { tpl: TEMPLATES.CULTIST,   key: 'CULTIST' };
  if (/bat|raven|bird|spider|rat|wolf|hound|beast|beetle|serpent|snak|蝙蝠|蜘|鼠|狼|蛛|蛇|甲虫/i.test(n))
                                                             return { tpl: TEMPLATES.BEAST,     key: 'BEAST' };
  return { tpl: TEMPLATES.GOBLIN, key: 'GOBLIN' };
}
```

- [ ] **Step 2: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/sprites.ts
git commit -m "Playtest #10 Task 2: rewrite pickEnemyTemplate routing (priority tag chain + i-flag regex)"
```

---

## Task 3: Update `ENEMIES` tags in `src/data.ts`

**Files:** Modify `src/data.ts` `ENEMIES` (~L96-188).

**Interfaces:** Consumes spec §3 (the authoritative per-enemy table). Produces `tags` that route each enemy to its intended template via Task 2's chain, while keeping `undead`/`demon` where present.

**Rule (apply to every enemy per spec §3):** set `tags` to the listed routing tag(s); KEEP `undead`/`demon` if the enemy had them (holy_water gameplay). Drop conflicting sprite-only tags (dragon/beast/elemental/construct/spirit/cultist) when replacing.

- [ ] **Step 1: Apply the spec §3 table to `ENEMIES`**

For each of the ~70 enemies, set its `tags` per the spec. Representative edits (the rest follow the same pattern from spec §3):

- `Rat` — add `tags: ['rodent']`
- `Wolf` — add `tags: ['hound']`
- `Wraith` — change `tags: ['undead']` → `tags: ['spirit', 'undead']` (spirit wins route; undead kept for holy_water)
- `Lich` — change `tags: ['undead']` → `tags: ['mage', 'undead']`
- `Death Knight` — change `tags: ['undead']` → `tags: ['knight', 'undead']`
- `Drakeborn Knight` — change `tags: ['dragon']` → `tags: ['knight']` (dragon is sprite-only, dropped)
- `Magma Hound` — change `tags: ['beast']` → `tags: ['hound']`
- `Fallen Seraph` — change `tags: ['undead', 'demon']` → `tags: ['seraph', 'undead', 'demon']` (seraph wins; undead+demon kept)
- `Doom Seraph` — change `tags: ['demon']` → `tags: ['seraph', 'demon']`
- `Entropy Beast` — change `tags: ['elemental']` → `tags: ['aberration']`
- `Void Titan` — change `tags: ['construct']` → `tags: ['aberration']`
- `Myconid` — change `tags: ['cultist']` → `tags: ['fungi']`
- `Glow Slime` — change `tags: ['elemental']` → `tags: ['slime']`
- `Spore Mother` — change `tags: ['spirit']` → `tags: ['fungi']`
- (Goblin/Kobold/Mimic — leave untagged → GOBLIN fallback, per spec)

Apply the remaining ~55 per spec §3 (Cave Beetle→insect, Dire Bat→bat, Castellan→knight replacing construct, Dread Legionnaire→knight replacing construct, Mushroom Brute→fungi replacing construct, Fungal Knight→[fungi,undead], Cosmic Horror→[aberration,demon], Seraphim/Archon→seraph, Cave Fish/Deep One/Siren/Kraken Spawn/Abyssal Jellyfish→aquatic, Void Leech/Rift Stalker/Reality Shard→aberration, Dark Mage/Necromancer/Void Mage→mage, Orc/Ogre/Troll→brute, Spider→insect, etc.).

- [ ] **Step 2: typecheck + build + full vitest**

Run: `npm run typecheck && npm run build && npx vitest run`
Expected: clean; 119/119 (no regression — tag changes don't affect tested code paths, but confirm).

- [ ] **Step 3: Spot-check holy_water gameplay tags preserved**

Confirm enemies that should still take holy-water bonus keep `undead`/`demon`: `Skeleton` (undead), `Demon` (demon), `Fallen Seraph` (undead+demon), `Cosmic Horror` (demon), `Lich` (undead), `Wraith` (undead). Grep `tags:` in data.ts to verify none of these lost their gameplay tag.

- [ ] **Step 4: Commit**

```bash
git add src/data.ts
git commit -m "Playtest #10 Task 3: update ENEMIES tags per spec (route to new templates, keep undead/demon)"
```

---

## Task 4: Verification (visual + regression)

**Files:** none (verification only).

- [ ] **Step 1: Full suite green**

Run: `npx vitest run` → 119/119 (or the current count).

- [ ] **Step 2: typecheck + build clean + no `bad row len` warnings**

Run: `npm run typecheck && npm run build` — confirm no `TEMPLATE ... bad row len` in build output.

- [ ] **Step 3: Visual playtest (manual — NOT automatable; canvas can't render in happy-dom)**

`npm run dev` (or next exe build). Descend across areas and confirm:
- Early animals render distinctly: Rat→RODENT, Bat→BAT, Spider→INSECT, Wolf→HOUND (NOT all GOBLIN — this is the routing-bug fix, esp. visible in **English** mode).
- Switch language to EN (L) and confirm the same enemies still render correctly (the old bug would've shown GOBLIN).
- Mid/late variety: KNIGHT (Dark Knight), BRUTE (Ogre), MAGE (Necromancer), ABERRATION (Cosmic Horror), SERAPH (Seraphim), FUNGI (Mushroom), AQUATIC (Siren), DRAGON/DEMON/GOLEM/etc.
- Holy water still bonus-damages undead/demon (Fallen Seraph/Cosmic Horror/Skeleton).

Note: visual confirmation is the user's playtest; the implementer verifies only Steps 1-2 (automated gates) and reports visual smoke as deferred.

- [ ] **Step 4: (Optional) legend panel** — add a few new template icons to `renderLegend` in `src/main.ts` (BAT/HOUND/KNIGHT/...) so the legend reflects the new variety. Skip if out of scope.

---

## Self-Review

**1. Spec coverage** — vs `2026-08-01-playtest10-enemy-sprites-design.md`:
- Routing rewrite (priority chain, `i`-flag, keep undead/demon) → Task 2. ✅
- 11 new templates → Task 1. ✅
- Per-enemy tag mapping (spec §3) → Task 3 (references spec §3 as authoritative). ✅
- Non-goals: BOSS untouched; no ch/c/stat changes; no Mimic template. ✅

**2. Placeholder scan** — routing code (Task 2) is full/exact. Templates (Task 1): BAT is a full worked example; the other 10 have explicit visual-intent + structural-reference + palette/16×16/row-check rules — these are concrete creative specs (not "TBD"), and pixel matrices can't be meaningfully reviewed as text (verified at playtest). Tag edits (Task 3): spec §3 is the authoritative table; representative edits + the rule are shown, remaining applied per spec.

**3. Type/name consistency** — `TEMPLATES.BAT/HOUND/.../FUNGI` (Task 1) match the keys referenced in `pickEnemyTemplate` (Task 2). Tag names (`rodent`/`hound`/`seraph`/`aberration`/etc.) match between Task 2's `has(...)` checks and Task 3's edits and spec §3. Priority order: seraph/aberration/spirit/fungi/... checked before demon/undead — consistent with the multi-tag rule. The `i`-flag is added to all 7 fallback regexes (preserving their original en+zh alternation).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-01-darkhollow-playtest10-enemy-sprites.md`. Two execution options:

**1. Subagent-Driven** — fresh subagent per task (1→2→3→4), review between. Task 1 (template authoring) benefits most from a review (row-length + visual intent); Task 3 (tag edits) is mechanical.

**2. Inline Execution** — execute in this session via executing-plans.

Which approach?
