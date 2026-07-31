# Wave 8: Warden + Lore Codex — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a periodic cross-floor stalking nemesis (The Warden) that drops unique relics + memories, and a 📜 Lore Codex panel that unlocks world/area/boss/relic/warden entries as you descend — embedding the existing lore docs into the game.

**Architecture:** Two coupled tracks. **Track A (Warden):** a `wardenCd` countdown on `GameState` ticks down in `enterFloor`; at 0 a `spawnWarden()` pushes one strong `isElite`+`isWarden` `chase` enemy; killing it routes through `grantKillRewards` to grant a specific (not random) relic + unlock the next warden memory. The Warden is a normal floor enemy (no cross-floor persistence), so descending naturally despawns it ("fight or flight"). **Track B (Codex):** `MetaSave.unlockedLore: string[]` + `unlockLore(id)` mirror the existing achievement-persistence pattern; a new `lore.ts` holds bilingual `LORE_ENTRIES`; `renderCodex()` clones the Wave 7b records-overlay. Both tracks are pure-TS + DOM (no new canvas hot paths), so they are unit-testable with the vitest+happy-dom base introduced in Polish-A.

**Tech Stack:** TypeScript, Vite, vitest 3 + happy-dom, vanilla DOM. Code pinned at `ea83dd5` (current main HEAD; spec was written against `e1f165d` but Polish-A/Q5 since then added the test base + typed `bridge.ts`).

## Global Constraints

(From `docs/superpowers/specs/wave8-warden-codex/TECH.md`; every task inherits these.)

- **Normal mode is not disturbed:** the Warden is an *extra* threat; it never replaces a fixed boss. Warden/Codex both active in normal + endless.
- **No boss/branch coupling:** the Warden is `isElite` (not `isBoss`), so it never enters `processBossPhase`/`tryBossSummon` (which key off `isBoss` + `G.floor`). It is never spawned inside a portal branch (`enterBranch` does not call `enterFloor`, so `wardenCd` does not tick there).
- **Backward compatibility:** old saves missing `wardenCd` / `unlockedLore` migrate to defaults (`wardenCd ?? 0`, `unlockedLore ?? []`).
- **reducedMotion:** the spawn `shake()`/`flt()` already self-guard under reduced-motion (existing `effects.ts`); no new work.
- **Bilingual:** all Warden copy + every `LORE_ENTRIES` body is `{en, zh}`.
- **Verification floor:** `npm run typecheck` + `npm run build` must be clean for every task; TDD unit tests where the logic is pure (Warden stats, relic pick, memory sequence, `unlockLore` dedup, LORE structure). Canvas/render paths stay on typecheck+build+headless-smoke (happy-dom has no canvas2d `getContext`).
- **Commit cadence:** one commit per task; tasks run sequentially (Track A → Track B) because they share `types.ts`/`combat.ts`/`game.ts`.

---

## File Structure

**New files:**
- `src/warden.ts` — Warden logic leaf (testable: only imports `types` + `utils` + `state`). Owns the pure stat formula `wardenStats(floor)`, the relic-pick + memory-sequence helpers, the relic-id pick-list, and the 3 bilingual memory texts. `spawnWarden()` (impure) lives in `enemies.ts`.
- `src/lore.ts` — pure data leaf (imports only `types`). Owns `LORE_ENTRIES` + `LORE_CATS` + `LoreEntry`/`LoreCat` types.
- `src/__tests__/warden.test.ts`, `src/__tests__/codex.test.ts`, `src/__tests__/warden-relics.test.ts` — unit tests.

**Modified files (with responsibility):**
- `src/types.ts` — add `GameState.wardenCd`, `Enemy.isWarden?`, `MetaSave.unlockedLore`, `SaveData.wardenCd?`.
- `src/data.ts` — append 3 Warden relic defs to `RELICS`.
- `src/relics.ts` — 3 one-line effect cases (cloak dodge / blade crit-lifesteal / shard exp) + relic-pickup lore unlock.
- `src/enemies.ts` — `spawnWarden(floor)` + import `shake`.
- `src/game.ts` — `wardenCd` init in `initGame`; tick + spawn + area-lore-unlock in `enterFloor`.
- `src/combat.ts` — Warden kill-drop branch + boss-lore-unlock in `grantKillRewards`.
- `src/meta.ts` — `unlockedLore` migration + `unlockLore(id)`.
- `src/save.ts` — persist `wardenCd` in `buildSave`/`loadGame`.
- `index.html` — `#btn-codex` + `#codex-overlay` (clone of records markup).
- `src/main.ts` — `renderCodex()` + bind + `updateLangUI` label.

---

## Task 1: Warden stat model + types

**Files:**
- Modify: `src/types.ts` (GameState ~L451, Enemy ~L220, MetaSave ~L531, SaveData ~L498)
- Create: `src/warden.ts`
- Test: `src/__tests__/warden.test.ts`

**Interfaces:**
- Produces: `wardenStats(floor): {hp,maxHp,atk,def,exp}`; `WARDEN_RELIC_IDS: string[]`; `pickWardenRelic(owned: string[]): string | null`; `nextWardenMemory(unlocked: string[]): string | null`; `WARDEN_MEMORIES: I18nText[]`; `wardenMemoryText(id): I18nText | null`. Later tasks import these.

- [ ] **Step 1: Write the failing test**

`src/__tests__/warden.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
// warden.ts imports rng from utils only for goldDrop, which we don't assert here.
vi.mock('../utils.js', () => ({ rng: () => 0 }));
vi.mock('../state.js', () => ({ lang: 'en' }));

import { wardenStats, pickWardenRelic, nextWardenMemory, WARDEN_RELIC_IDS, WARDEN_MEMORIES } from '../warden.js';

describe('wardenStats', () => {
  it('floor 1 (fs=1): deterministic baseline', () => {
    const s = wardenStats(1);            // fs = 1 + 0*.12 = 1
    expect(s.hp).toBe(50);               // (45 + 1*5) * 1
    expect(s.maxHp).toBe(50);
    expect(s.atk).toBe(11);              // floor((10 + 1*1.6) * 1) = floor(11.6)
    expect(s.def).toBe(4);               // floor(4 + 1*0.6) = floor(4.6) — NOT fs-scaled
    expect(s.exp).toBe(44);              // 40 + 1*4
  });
  it('floor 10 scales hp/atk by fs, def stays linear', () => {
    const s = wardenStats(10);           // fs = 1 + 9*.12 = 2.08
    expect(s.hp).toBe(Math.floor((45 + 50) * 2.08));   // 197
    expect(s.atk).toBe(Math.floor((10 + 16) * 2.08));  // floor(54.08) = 54
    expect(s.def).toBe(Math.floor(4 + 10 * 0.6));      // 10
    expect(s.exp).toBe(80);             // 40 + 40
  });
  it('grows with floor (hp monotonic)', () => {
    expect(wardenStats(20).hp).toBeGreaterThan(wardenStats(10).hp);
  });
});

describe('pickWardenRelic', () => {
  it('returns the first unowned warden relic', () => {
    expect(pickWardenRelic([])).toBe(WARDEN_RELIC_IDS[0]);
    expect(pickWardenRelic([WARDEN_RELIC_IDS[0]])).toBe(WARDEN_RELIC_IDS[1]);
  });
  it('returns null when all owned', () => {
    expect(pickWardenRelic(WARDEN_RELIC_IDS)).toBeNull();
  });
});

describe('nextWardenMemory', () => {
  it('unlocks memory1 -> memory2 -> memory3 in order', () => {
    expect(nextWardenMemory([])).toBe('warden:memory1');
    expect(nextWardenMemory(['warden:memory1'])).toBe('warden:memory2');
    expect(nextWardenMemory(['warden:memory1', 'warden:memory2'])).toBe('warden:memory3');
    expect(nextWardenMemory(['warden:memory1', 'warden:memory2', 'warden:memory3'])).toBeNull();
  });
});

describe('WARDEN_MEMORIES', () => {
  it('has exactly 3 bilingual entries', () => {
    expect(WARDEN_MEMORIES).toHaveLength(3);
    for (const m of WARDEN_MEMORIES) { expect(typeof m.en).toBe('string'); expect(typeof m.zh).toBe('string'); }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/warden.test.ts`
Expected: FAIL — `Cannot find module '../warden.js'` / `wardenStats is not a function`.

- [ ] **Step 3: Add the type fields**

In `src/types.ts`:

Enemy interface (after `isElite?: boolean;` ~L237):
```ts
  isWarden?: boolean;
```

GameState interface (after `endless?: boolean;` ~L471):
```ts
  // Warden (Wave 8): floors remaining until the stalking nemesis next spawns.
  // Decrements in enterFloor; at <=0 spawnWarden fires and this resets.
  wardenCd: number;
```

SaveData interface (after `endless?: boolean;` ~L507):
```ts
  wardenCd?: number;
```

MetaSave interface (after `endlessLeaderboard: EndlessRecord[];` ~L539):
```ts
  unlockedLore: string[];
```

- [ ] **Step 4: Write `src/warden.ts`**

```ts
// Warden logic — pure, testable leaf. Only imports types + utils + state so it
// unit-tests without pulling combat/render/relics into the test env. The impure
// spawnWarden() lives in enemies.ts (same domain as spawnEnemies); this module
// owns the math + pick/sequence helpers it + combat.ts consume.
import type { I18nText } from './types.js';

// fs matches spawnEnemies: 1 + (floor-1)*.12 (area bonus intentionally omitted —
// the Warden is a universal threat, not biome-scaled). def is NOT fs-scaled
// (keeps it pierceable by a deep player's attack), matching the spec formula.
export function wardenStats(floor: number): { hp: number; maxHp: number; atk: number; def: number; exp: number } {
  const fs = 1 + (floor - 1) * 0.12;
  const hp = Math.floor((45 + floor * 5) * fs);
  return {
    hp, maxHp: hp,
    atk: Math.floor((10 + floor * 1.6) * fs),
    def: Math.floor(4 + floor * 0.6),
    exp: 40 + floor * 4,
  };
}

// The 3 "前任遗物" defs live in data.ts RELICS; this is just the pick-list so
// the kill-drop can grant the next unowned one deterministically (no rng).
export const WARDEN_RELIC_IDS = ['warden_cloak', 'fallen_blade', 'memory_shard'] as const;

export function pickWardenRelic(owned: string[]): string | null {
  const set = new Set(owned);
  return WARDEN_RELIC_IDS.find(id => !set.has(id)) ?? null;
}

// Sequential memory unlocks: each Warden kill reveals the next fragment of the
// Warden's past life. null once all 3 are unlocked.
export function nextWardenMemory(unlocked: string[]): string | null {
  const set = new Set(unlocked);
  for (let i = 1; i <= WARDEN_MEMORIES.length; i++) {
    if (!set.has(`warden:memory${i}`)) return `warden:memory${i}`;
  }
  return null;
}

// Three lore fragments, revealed one per kill. Sourced from docs/lore (the
// Warden was a former Descender, absorbed and remade as the abyss's immune hound).
export const WARDEN_MEMORIES: I18nText[] = [
  { en: 'A memory surfaces: the Warden once descended for the same reasons you did. They failed where you now stand.', zh: '一段记忆浮现：守渊人曾为同样的理由下探。他们在你现在站立之处失败了。' },
  { en: 'The abyss did not kill them. It remembered them — and reshaped them into its hound. They still recall their own name, sometimes.', zh: '深渊没有杀死 Ta，而是「记住」了 Ta——把 Ta 改造成了猎犬。Ta 有时仍记着自己的名字。' },
  { en: 'In their last flash of self, you see your own reflection. To defeat them is self-preservation — and a rehearsal for your own fall.', zh: '在最后一丝自我中，你看见了自己的倒影。击败 Ta 是自保，也是你自身坠落的预演。' },
];

export function wardenMemoryText(id: string): I18nText | null {
  const m = /warden:memory(\d+)/.exec(id);
  if (!m) return null;
  const i = parseInt(m[1], 10) - 1;
  return WARDEN_MEMORIES[i] ?? null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/__tests__/warden.test.ts`
Expected: PASS (all 8 assertions).

- [ ] **Step 6: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean. (Note: `GameState.wardenCd` is now required but not yet set in `initGame` — tsc will flag `initGame`'s gameState literal. If so, temporarily add `wardenCd: 0` to the literal in `game.ts` initGame now; the real `rng(4,6)` lands in Task 3. Minimal patch only.)

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/warden.ts src/__tests__/warden.test.ts src/game.ts
git commit -m "Wave 8 Task 1: warden stat model + types (wardenCd/isWarden/unlockedLore)"
```

---

## Task 2: Warden relic defs + effect hooks

**Files:**
- Modify: `src/data.ts` (RELICS array ~L630)
- Modify: `src/relics.ts` (`applyRelicBonuses` ~L25, `relicOnCrit` ~L127, `getRelicExpMult` ~L138)
- Test: `src/__tests__/warden-relics.test.ts`

**Interfaces:**
- Consumes: `WARDEN_RELIC_IDS` from Task 1 (for asserting the defs exist).
- Produces: 3 new `RelicDef` entries (`warden_cloak`, `fallen_blade`, `memory_shard`) in `RELICS`, each with a working effect hook so `grantRelic` can grant them.

- [ ] **Step 1: Write the failing test**

`src/__tests__/warden-relics.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../state.js', () => ({
  get G(): unknown { return (globalThis as { G?: unknown }).G; },
  lang: 'en',
}));
vi.mock('../data.js', () => ({ RELICS: [] }));   // applyRelicBonuses reads p.relics, not RELICS
vi.mock('../messages.js', () => ({ addMsg: () => {} }));
vi.mock('../effects.js', () => ({ flt: () => {} }));
vi.mock('../fx.js', () => ({ fxFlash: () => {}, fxBurst: () => {} }));
vi.mock('../audio.js', () => ({ snd: () => {} }));

import { applyRelicBonuses, relicOnCrit, getRelicExpMult } from '../relics.js';
import { WARDEN_RELIC_IDS } from '../warden.js';

function fixturePlayer(relics: string[]): any {
  return {
    relics, atk: 10, baseAtk: 10, def: 5, maxHp: 100, hp: 100,
    critChance: 0.1, dodgeChance: 0.1, spellPower: 1,
    critDamageBonus: 0, healBonus: 0, elRes: {}, elDmgBonus: {}, setBonusActive: {},
  };
}

describe('Warden relic effects', () => {
  beforeEach(() => { (globalThis as any).G = { player: fixturePlayer([]) }; });

  it('warden_cloak grants +10% dodge in applyRelicBonuses', () => {
    const p = fixturePlayer(['warden_cloak']);
    applyRelicBonuses(p);
    expect(p.dodgeChance).toBeCloseTo(0.2);   // 0.1 base + 0.10
  });
  it('fallen_blade heals 18% of crit damage via relicOnCrit', () => {
    const G = (globalThis as any).G;
    G.player = fixturePlayer(['fallen_blade']); G.player.hp = 50;
    relicOnCrit({ x: 0, y: 0 } as any, 100);
    expect(G.player.hp).toBe(68);             // 50 + floor(100*0.18)
  });
  it('memory_shard gives +30% XP via getRelicExpMult', () => {
    (globalThis as any).G.player = fixturePlayer(['memory_shard']);
    expect(getRelicExpMult()).toBe(1.3);
  });
  it('all three ids are real relic defs (no typo)', () => {
    // sanity: the pick-list names match the effects we just wired
    expect(WARDEN_RELIC_IDS).toEqual(['warden_cloak', 'fallen_blade', 'memory_shard']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/warden-relics.test.ts`
Expected: FAIL — dodge/hp/mult unchanged (no relic cases yet).

- [ ] **Step 3: Add the 3 relic defs to `src/data.ts`**

Append to the `RELICS` array (after the `worn_amulet` entry, before the closing `];` ~L654):
```ts
  // Wave 8 — "前任遗物": dropped by The Warden. Each maps to ONE existing hook
  // (one new case per handler) to stay low-risk and testable.
  { id: 'warden_cloak', n: { en: 'Warden Cloak', zh: '守渊人斗篷' }, d: { en: '+10% dodge chance', zh: '+10% 闪避率' }, ch: '🧥', c: '#9a2be2', rarity: 3, effect: 'dodge', value: 10 },
  { id: 'fallen_blade', n: { en: 'Fallen Blade', zh: '前任之刃' }, d: { en: 'Crits heal 18% of damage', zh: '暴击吸取18%伤害' }, ch: '🗡', c: '#b91c3c', rarity: 3, effect: 'crit_lifesteal', value: 18 },
  { id: 'memory_shard', n: { en: 'Memory Shard', zh: '记忆碎片' }, d: { en: '+30% XP', zh: '经验+30%' }, ch: '🔮', c: '#4895ef', rarity: 3, effect: 'exp_pct', value: 30 },
```

- [ ] **Step 4: Wire the 3 effect hooks in `src/relics.ts`**

In `applyRelicBonuses` (add a case inside the `switch (id)` block, ~after `case 'arcane_focus'` L33):
```ts
      case 'warden_cloak': p.dodgeChance += 0.10; break;
```

In `relicOnCrit` (add a branch, ~after the `executioner_pact` block L133):
```ts
  if (hasRelic('fallen_blade')) {
    const heal = Math.floor(dmg * 0.18);
    if (heal > 0) { p.hp = Math.min(p.maxHp, p.hp + heal); flt(p.x, p.y, `+${heal}`, '#b91c3c'); }
  }
```

In `getRelicExpMult` (replace the one-liner ~L138):
```ts
export function getRelicExpMult(): number {
  let m = 1;
  if (hasRelic('scholar_lens')) m += 0.25;
  if (hasRelic('memory_shard')) m += 0.30;
  return m;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/__tests__/warden-relics.test.ts`
Expected: PASS.

- [ ] **Step 6: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/data.ts src/relics.ts src/__tests__/warden-relics.test.ts
git commit -m "Wave 8 Task 2: 3 warden relics + effect hooks (cloak/blade/shard)"
```

---

## Task 3: spawnWarden + wardenCd lifecycle

**Files:**
- Modify: `src/enemies.ts` (new `spawnWarden`; effects import ~L7)
- Modify: `src/game.ts` (`initGame` ~L18, `enterFloor` setup ~L57)
- Modify: `src/save.ts` (`buildSave` ~L37, `loadGame` gameState literal ~L61)
- Test: `src/__tests__/warden.test.ts` (extend — add a `spawnWarden` suite)

**Interfaces:**
- Consumes: `wardenStats` from Task 1. `rng`/`pick` already imported in `enemies.ts`.
- Produces: exported `spawnWarden(floor: number): void` (called from `enterFloor`); `G.wardenCd` ticks in `enterFloor` and persists in saves.

- [ ] **Step 1: Write the failing test (append to `src/__tests__/warden.test.ts`)**

Add a new top-level import block + describe at the end of the file. `spawnWarden` lives in `enemies.ts`, so its test must mock enemies.ts's heavy imports and import `spawnWarden` + `wardenStats` for-real:
```ts
// Append after the existing suites in warden.test.ts:
vi.mock('../config.js', () => ({ MW: 80, MH: 40, TL: { WALL: 1, VOID: 0 }, FINAL: 40 }));
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../effects.js', () => ({ flt: () => {}, shake: () => {} }));
vi.mock('../fx.js', () => ({ fxFlash: () => {}, fxBurst: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: () => {} }));
vi.mock('../render.js', () => ({ setEnemyTween: () => {} }));
vi.mock('../combat.js', () => ({ attack: () => false, killEnemy: () => {}, checkLevelUp: () => {} }));
vi.mock('../talents.js', () => ({ onPlayerDamaged: () => {}, onEnemyHitPlayer: () => {}, onPlayerDodged: () => {}, onPlayerDeath: () => false, getManaShieldReduction: () => 0 }));
vi.mock('../meta.js', () => ({ bonusExp: () => 0 }));
vi.mock('../data.js', () => ({ ENEMIES: [], BOSSES: [], ELITE_PREFIX: [], AREAS: [] }));

import { spawnWarden } from '../enemies.js';

describe('spawnWarden', () => {
  beforeEach(() => {
    (globalThis as any).G = {
      player: { x: 5, y: 5 },
      enemies: [],
      dungeon: { rooms: [{ x: 0, y: 0, w: 5, h: 5, cx: 2, cy: 2 }, { x: 10, y: 10, w: 6, h: 6, cx: 13, cy: 13 }] },
    };
  });
  it('pushes one isWarden + isElite enemy with wardenStats hp', () => {
    spawnWarden(10);
    const G = (globalThis as any).G;
    expect(G.enemies).toHaveLength(1);
    const w = G.enemies[0];
    expect(w.isWarden).toBe(true);
    expect(w.isElite).toBe(true);
    expect(w.ai).toBe('chase');
    expect(w.tags).toContain('spirit');
    expect(w.maxHp).toBe(wardenStats(10).hp);
  });
  it('no-ops when there is no non-start room', () => {
    (globalThis as any).G.dungeon.rooms = [{ x: 0, y: 0, w: 5, h: 5, cx: 2, cy: 2 }];
    spawnWarden(5);
    expect((globalThis as any).G.enemies).toHaveLength(0);
  });
});
```
(Re-declaring `vi.mock` for modules already mocked at the top of the file is fine — vitest hoists and merges; if the linter complains about duplicate mocks, move all module mocks to the top of the file above both describes.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/warden.test.ts`
Expected: FAIL — `spawnWarden is not exported from enemies.js`.

- [ ] **Step 3: Add `shake` to enemies.ts effects import**

`src/enemies.ts` L7 — change:
```ts
import { flt } from './effects.js';
```
to:
```ts
import { flt, shake } from './effects.js';
```
And add the warden import near the other local imports (after `import { makeEnemy } from './enemy-factory.js';` L14):
```ts
import { wardenStats } from './warden.js';
```

- [ ] **Step 4: Implement `spawnWarden` in `src/enemies.ts`**

Add after `spawnBranchEnemies` (after ~L92):
```ts
// The Warden (Wave 8): a stalking nemesis that spawns on a random cd. Strong
// chase elite; killing it (combat.grantKillRewards) drops a specific relic +
// unlocks a memory. It is a normal floor enemy, so descending (enterFloor)
// naturally despawns it — "fight or flight". tag 'spirit' -> WRAITH sprite.
export function spawnWarden(floor: number): void {
  if (!G) return;
  const rooms = G.dungeon.rooms.slice(1); // never in the start room
  if (!rooms.length) return;
  const rm = pick(rooms);
  const s = wardenStats(floor);
  G.enemies.push({
    name: lang === 'zh' ? '守渊人' : 'The Warden', ch: 'Ѡ', c: '#9a2be2',
    x: rng(rm.x + 1, rm.x + rm.w - 2), y: rng(rm.y + 1, rm.y + rm.h - 2),
    hp: s.hp, maxHp: s.maxHp, atk: s.atk, def: s.def, exp: s.exp,
    goldDrop: rng(30, 60) + floor * 3,
    ai: 'chase', stunned: 0, feared: 0, isAlly: false, isElite: true, isWarden: true,
    el: 'shadow', res: { shadow: 0.5, holy: -0.5 }, skillCd: 0, tags: ['spirit'],
  });
  addMsg(lang === 'zh' ? '👁 守渊人正在追猎你……' : '👁 The Warden is hunting you...', 'me');
  flt(G.player.x, G.player.y, '⚠WARDEN', '#9a2be2'); snd('boss'); shake();
}
```

- [ ] **Step 5: Wire wardenCd init + tick in `src/game.ts`**

In `initGame`'s gameState literal (replace the temporary `wardenCd: 0` from Task 1):
```ts
    endless,
    wardenCd: rng(4, 6),
```

In `enterFloor`'s `setup()`, immediately after the `G!.enemies = spawnEnemies(...)` line (~L57), add the tick + spawn (guarded against branch mode for clarity — branch entry never reaches here, but the guard documents intent):
```ts
    // Warden stalking timer (Wave 8): ticks once per main-line floor entry; at 0
    // the nemesis spawns and the timer resets. Not inside portal branches.
    if (!G!.branchMode) {
      G!.wardenCd--;
      if (G!.wardenCd <= 0) { spawnWarden(floor); G!.wardenCd = rng(6, 9); }
    }
```
Add `spawnWarden` to the enemies import at the top of game.ts (L6):
```ts
import { spawnEnemies, spawnBranchEnemies, spawnWarden } from './enemies.js';
```

- [ ] **Step 6: Persist `wardenCd` in `src/save.ts`**

`buildSave` (add to the JSON literal, ~after `endless: g.endless === true,` L40):
```ts
    endless: g.endless === true,
    wardenCd: g.wardenCd ?? 0,
```
`loadGame` gameState literal (add, ~after `endless: s.endless === true,` L71). Clamp to ≥2 so a save taken right before a spawn doesn't summon the Warden on the very next (load) floor:
```ts
    endless: s.endless === true,
    wardenCd: Math.max(2, s.wardenCd ?? 0),
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/warden.test.ts`
Expected: PASS (existing + 2 new spawnWarden tests).

- [ ] **Step 8: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add src/enemies.ts src/game.ts src/save.ts src/__tests__/warden.test.ts
git commit -m "Wave 8 Task 3: spawnWarden + wardenCd lifecycle (init/tick/persist)"
```

---

## Task 4: Warden kill rewards + boss lore unlock

**Files:**
- Modify: `src/combat.ts` (`grantKillRewards` ~L414; imports L9, L20)
- Test: `src/__tests__/grantKillRewards.test.ts` (extend — warden suite + add `warden.js`/`grantRelic`/`unlockLore` mocks)

**Interfaces:**
- Consumes: `pickWardenRelic`, `nextWardenMemory`, `wardenMemoryText` (Task 1); `grantRelic` (relics.ts); `unlockLore` (Task 5 — see note below).
- Produces: `grantKillRewards` grants a specific Warden relic + unlocks the next memory on `e.isWarden`; unlocks `boss:<floor>` on boss kills. The generic elite-40% random relic drop is skipped for Wardens.

> **Ordering note:** `unlockLore` is defined in Task 5 (meta.ts). To keep this task independently testable, the test mocks `../meta.js`'s `unlockLore` as a spy (the grantKillRewards test already fully mocks meta.js). The real import resolves once Task 5 lands. If implementing strictly in order, Task 5 must merge before this task's final build is green — or stub `unlockLore` locally. Recommended: implement Task 5 immediately after Task 4 (they're a pair).

- [ ] **Step 1: Write the failing test (append to `src/__tests__/grantKillRewards.test.ts`)**

Update the existing `vi.mock('../meta.js', ...)` block to add an `unlockLore` spy, and the `vi.mock('../relics.js', ...)` block to add `grantRelic`:
```ts
// in the meta.js mock, add:
  unlockLore: vi.fn(),
// in the relics.js mock, add:
  grantRelic: vi.fn(),
```
Add a new import for the warden module mock:
```ts
vi.mock('../warden.js', () => ({
  pickWardenRelic: (owned: string[]) => owned.length === 0 ? 'warden_cloak' : null,
  nextWardenMemory: (u: string[]) => u.includes('warden:memory3') ? null : 'warden:memory1',
  wardenMemoryText: () => ({ en: 'mem', zh: '记忆' }),
}));
```
At the bottom, after the existing imports + a `vi`/`beforeEach` reset, add:
```ts
import { unlockLore } from '../meta.js';
import { grantRelic } from '../relics.js';

describe('grantKillRewards — warden + boss lore', () => {
  beforeEach(() => {
    (globalThis as any).G = fixtureG();
    (globalThis as any).G.player.relics = [];
    vi.clearAllMocks();
  });

  it('warden kill grants the specific warden relic (not random) + unlocks memory1', () => {
    const G = (globalThis as any).G;
    grantKillRewards(fixtureEnemy({ isWarden: true, isElite: true, exp: 10 }));
    expect(grantRelic).toHaveBeenCalledWith('warden_cloak', expect.any(Number), expect.any(Number));
    expect(unlockLore).toHaveBeenCalledWith('warden:memory1');
  });

  it('non-warden elite kill does NOT call the warden relic path', () => {
    grantKillRewards(fixtureEnemy({ isElite: true, exp: 10 }));
    expect(grantRelic).not.toHaveBeenCalled();
    expect(unlockLore).not.toHaveBeenCalledWith(expect.stringMatching(/^warden:memory/));
  });

  it('boss kill unlocks boss:<floor> lore', () => {
    (globalThis as any).G.floor = 5;
    grantKillRewards(fixtureEnemy({ isBoss: true }));
    expect(unlockLore).toHaveBeenCalledWith('boss:5');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/grantKillRewards.test.ts`
Expected: FAIL — `grantRelic` / `unlockLore` not called (no warden branch yet).

- [ ] **Step 3: Update combat.ts imports**

`src/combat.ts` L9 — add `grantRelic` to the relics import:
```ts
import { applyRelicBonuses, relicOnHitEnemy, relicOnDamaged, relicOnDeath, getRelicGoldMult, getRelicExpMult, grantRandomRelic, grantRelic, relicOnKill, relicOnDodge, relicOnCrit } from './relics.js';
```
L20 — add `unlockLore` to the meta import:
```ts
import { calculateSoulEchoes, updateRunStats, persistAchievement, renderEchoBreakdown, bonusGold, bonusExp, getMeta, creditSoulEchoes, recordRun, unlockLore } from './meta.js';
```
Add a new import after L14:
```ts
import { pickWardenRelic, nextWardenMemory, wardenMemoryText } from './warden.js';
```

- [ ] **Step 4: Add warden kill branch + boss lore unlock in `grantKillRewards`**

In `grantKillRewards`, inside the `if (e.isBoss) { ... }` block (after `G.player.bossesKilledThisRun++;` ~L429), add the boss lore unlock:
```ts
    G.player.bossesKilledThisRun++;
    unlockLore('boss:' + G.floor);
    checkAch('boss_kill');
```

Then, immediately before the existing generic relic-drop line (`if (e.isBoss || (e.isElite && Math.random() < 0.4)) grantRandomRelic(e.x, e.y, G.floor);` ~L437), insert the warden branch and guard the generic drop against wardens:
```ts
  // Warden kill (Wave 8): specific relic (next unowned "前任遗物") + next memory,
  // INSTEAD of the generic elite-40% random drop.
  if (e.isWarden) {
    const rid = pickWardenRelic(G.player.relics || []);
    if (rid) grantRelic(rid, e.x, e.y);
    const mem = nextWardenMemory(getMeta().unlockedLore || []);
    if (mem) {
      unlockLore(mem);
      const mt = wardenMemoryText(mem);
      if (mt) addMsg(lang === 'zh' ? mt.zh : mt.en, 'md');
    }
    addMsg(lang === 'zh' ? '🕯 你击退了守渊人！' : '🕯 You have repelled the Warden!', 'ml');
  } else if (e.isBoss || (e.isElite && Math.random() < 0.4)) {
    grantRandomRelic(e.x, e.y, G.floor);
  }
```
(Replace the old single `if (e.isBoss || ...)` line with the `if/else if` above so wardens skip the random drop.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/__tests__/grantKillRewards.test.ts`
Expected: PASS (existing 3 + new 3). Note: this requires `unlockLore` to exist in `meta.ts` — if Task 5 hasn't landed, the import fails. Implement Task 5 next, then re-run.

- [ ] **Step 6: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean (after Task 5).

- [ ] **Step 7: Commit (together with Task 5)**

```bash
git add src/combat.ts src/__tests__/grantKillRewards.test.ts
git commit -m "Wave 8 Task 4: warden kill-drop (specific relic + memory) + boss lore unlock"
```

---

## Task 5: Codex data + unlockLore + meta persistence

**Files:**
- Create: `src/lore.ts`
- Modify: `src/meta.ts` (`initMeta` ~L19, `getMeta` ~L27; new `unlockLore`)
- Test: `src/__tests__/codex.test.ts`

**Interfaces:**
- Consumes: nothing (leaf data + meta).
- Produces: `unlockLore(id)` in meta.ts; `LORE_ENTRIES`, `LORE_CATS`, `LoreEntry`, `LoreCat` in lore.ts. Consumed by Task 4 (unlockLore), Task 6 (call sites), Task 7 (renderCodex).

- [ ] **Step 1: Write the failing test**

`src/__tests__/codex.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../data.js', () => ({ META_UPGRADES: [], ACH_DEFS: [], RELICS: [] }));
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../state.js', () => ({ lang: 'en' }));

import { initMeta, getMeta, unlockLore } from '../meta.js';
import { LORE_ENTRIES, LORE_CATS } from '../lore.js';

beforeEach(() => localStorage.clear());

describe('unlockLore', () => {
  it('adds a new id and persists across getMeta()', () => {
    unlockLore('world:descent');
    expect(getMeta().unlockedLore).toContain('world:descent');
  });
  it('dedups (idempotent)', () => {
    unlockLore('area:caves'); unlockLore('area:caves');
    expect(getMeta().unlockedLore.filter(id => id === 'area:caves')).toHaveLength(1);
  });
  it('old meta save without unlockedLore migrates to []', () => {
    localStorage.setItem('dh_meta', JSON.stringify({ version: 1, soulEchoes: 0, totalSpent: 0, upgrades: {}, achievements: [], stats: {} }));
    expect(getMeta().unlockedLore).toEqual([]);
  });
  it('initMeta seeds unlockedLore as []', () => {
    expect(initMeta().unlockedLore).toEqual([]);
  });
});

describe('LORE_ENTRIES', () => {
  it('ids are unique', () => {
    const ids = LORE_ENTRIES.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('every entry has a known cat + bilingual text', () => {
    const cats = new Set(LORE_CATS.map(c => c.id));
    for (const e of LORE_ENTRIES) {
      expect(cats.has(e.cat)).toBe(true);
      expect(typeof e.n.en && typeof e.n.zh && typeof e.body.en && typeof e.body.zh).toBe('string');
    }
  });
  it('contains the default-unlocked world entry + all 8 areas + 8 bosses', () => {
    const ids = new Set(LORE_ENTRIES.map(e => e.id));
    expect(ids.has('world:descent')).toBe(true);
    expect([...ids].filter(id => id.startsWith('area:')).length).toBe(8);
    expect([...ids].filter(id => id.startsWith('boss:')).length).toBe(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/codex.test.ts`
Expected: FAIL — `unlockLore is not a function` / `lore.js not found`.

- [ ] **Step 3: Add `unlockLore` + migrations in `src/meta.ts`**

In `initMeta` (add to the returned object, ~L23):
```ts
    runHistory: [], endlessLeaderboard: [],
    unlockedLore: [],
```
In `getMeta` (add a migration line inside the `if (d)` block, ~after the `endlessLeaderboard` migration L38):
```ts
    if (!m.unlockedLore) m.unlockedLore = [];
```
Add `unlockLore` (mirror of `persistAchievement`, after it ~L202):
```ts
// Unlock a Lore Codex entry (Wave 8). Idempotent + persisted to dh_meta.
export function unlockLore(id: string): void {
  const meta = getMeta();
  if (!meta.unlockedLore.includes(id)) {
    meta.unlockedLore.push(id);
    saveMeta(meta);
  }
}
```

- [ ] **Step 4: Write `src/lore.ts`**

Full bilingual entries, distilled from `docs/lore/00-世界观设定.md` + `00-世界观百科.md`. Area ids match `AREAS` ids; boss ids are `boss:<fl>` (matches the `unlockLore('boss:'+G.floor)` call in Task 4).

```ts
// Lore Codex entries (Wave 8). Pure data leaf — bilingual, sourced from
// docs/lore. renderCodex (main.ts) groups by cat; entries whose id is NOT in
// MetaSave.unlockedLore render as "???". Area ids mirror data.ts AREAS; boss
// ids are boss:<fl> so combat's unlockLore('boss:'+G.floor) resolves here.
import type { I18nText } from './types.js';

export type LoreCat = 'world' | 'area' | 'boss' | 'relic' | 'warden';
export interface LoreEntry {
  id: string;
  cat: LoreCat;
  n: I18nText;
  body: I18nText;
}

export const LORE_CATS: { id: LoreCat; label: I18nText }[] = [
  { id: 'world',  label: { en: 'The World',  zh: '世界' } },
  { id: 'area',   label: { en: 'Realms',     zh: '区域' } },
  { id: 'boss',   label: { en: 'Adversaries',zh: '强敌' } },
  { id: 'warden', label: { en: 'The Warden', zh: '守渊人' } },
  { id: 'relic',  label: { en: 'Relics',     zh: '圣物' } },
];

export const LORE_ENTRIES: LoreEntry[] = [
  // --- World (default-unlocked) ---
  { id: 'world:descent', cat: 'world', n: { en: 'The Descent', zh: '下探' },
    body: { en: 'The Abyss is not a dungeon but a wound in reality, sealed a thousand years ago with a living heart. Every Descender is sent to slay its warden — none know the cost.', zh: '暗渊不是地牢，而是现实的伤口，千年前以一颗活心封印。每个下探者都被派来斩杀守护者——无人知晓代价。' } },
  { id: 'world:creator', cat: 'world', n: { en: 'The Creator', zh: '创世者' },
    body: { en: 'Not a god, but a guardian imprisoned as the seal\'s living core. They never fell — they merely grew tired. They long for death. Slaying them shatters the seal.', zh: '并非神祇，而是被封作封印活心的守护者。Ta 从未堕落——只是累了。Ta 渴望死亡。杀 Ta，即碎封印。' } },

  // --- Areas (8) ---
  { id: 'area:caves',    cat: 'area', n: { en: 'The Caverns', zh: '地下洞穴' }, body: { en: 'F1-5. The rift\'s mouth — a graveyard of new Descenders. Damp, primal, lightly corrupted.', zh: 'F1-5。裂口地表，新下探者的坟场。潮湿、原始，腐化最浅。' } },
  { id: 'area:crypts',   cat: 'area', n: { en: 'Ancient Crypts', zh: '远古墓穴' }, body: { en: 'F6-10. The burial ground of the first civilization that tried — and failed — to seal the Abyss.', zh: 'F6-10。第一代试图封印深渊的失败文明的葬地。' } },
  { id: 'area:depths',   cat: 'area', n: { en: 'Burning Depths', zh: '灼热深渊' }, body: { en: 'F11-15. The forge where the seal was cast. The furnace cracked; fire elementals are its leaking shards.', zh: 'F11-15。锻造封印的熔炉所在。炉裂地泄，火元素是封印碎片的泄漏。' } },
  { id: 'area:fortress', cat: 'area', n: { en: 'Dark Fortress', zh: '暗黑堡垒' }, body: { en: 'F16-20. Garrison of the Seal Wardens — generations of soldiers, now all corrupted into undeath.', zh: 'F16-20。守印者军团的驻地。世代戍守的战士如今尽被腐化为不死。' } },
  { id: 'area:dragon',   cat: 'area', n: { en: "Dragon's Domain", zh: '龙之领域' }, body: { en: 'F21-25. Beasts the Warders once tamed, gone feral and twisted as the seal loosened.', zh: 'F21-25。守印者驯养的巨兽，封印松动后野化扭曲。' } },
  { id: 'area:abyss',    cat: 'area', n: { en: 'The Abyss', zh: '无尽深渊' }, body: { en: 'F26-30. The seal gapes; the Abyss itself seeps through. Something watches from below.', zh: 'F26-30。封印裂缝已大，深渊本体渗入。有什么东西在下方注视。' } },
  { id: 'area:void',     cat: 'area', n: { en: 'Void Realm', zh: '虚空领域' }, body: { en: 'F31-35. Reality buckles here. Colors that should not exist hurt your eyes.', zh: 'F31-35。现实在此崩坏。不该存在的颜色刺痛双眼。' } },
  { id: 'area:sanctum',  cat: 'area', n: { en: 'The Final Sanctum', zh: '最终圣殿' }, body: { en: 'F36-40. The seal\'s heart — the Creator\'s cage and throne. The holy light is their thousand-year will.', zh: 'F36-40。封印的心脏，创世者的囚笼与王座。圣光是 Ta 千年未熄的意志。' } },

  // --- Bosses (8, keyed boss:<fl>) ---
  { id: 'boss:5',  cat: 'boss', n: { en: 'Goblin King', zh: '哥布林王' }, body: { en: 'A petty tyrant of the rift\'s mouth. A small, early foe of no consequence to the main story.', zh: '裂口地表的小暴君，与主线无关的早期小角色。' } },
  { id: 'boss:10', cat: 'boss', n: { en: 'Spider Queen', zh: '蜘蛛女王' }, body: { en: 'Broodmother of the crypts, laying eggs among the graves to guard them.', zh: '墓穴深处的育母，在坟茔间产卵守墓。' } },
  { id: 'boss:15', cat: 'boss', n: { en: 'Vampire Lord', zh: '吸血鬼领主' }, body: { en: 'An old noble corrupted by the Abyss, draining blood to cling to a half-life.', zh: '被深渊腐化的旧贵族，嗜血以求半生。' } },
  { id: 'boss:20', cat: 'boss', n: { en: 'Elder Lich', zh: '远古巫妖' }, body: { en: 'Commander of the Seal Warders, who embraced undeath to guard the seal forever — now mad. He remembers the Creator, but forgets why he guards.', zh: '守印者军团统帅，为永守封印而转生不死，如今已疯。他记得创世者，却忘了为何而守。' } },
  { id: 'boss:25', cat: 'boss', n: { en: 'Dragon Emperor', zh: '龙皇' }, body: { en: 'The last twisted guardian-beast, holding the gate to the Abyss itself.', zh: '最后一只扭曲的守护巨兽，守着通往深渊本体的入口。' } },
  { id: 'boss:30', cat: 'boss', n: { en: 'Leviathan', zh: '利维坦' }, body: { en: 'A beast born as the Abyss\'s body first seeped through the cracked seal.', zh: '深渊本体随封印裂缝渗入后诞生的巨兽。' } },
  { id: 'boss:35', cat: 'boss', n: { en: 'Void Sovereign', zh: '虚空君主' }, body: { en: 'An entity that seeped through the fractured seal from beyond reality.', zh: '自现实之外、沿封印裂纹渗出的实体。' } },
  { id: 'boss:40', cat: 'boss', n: { en: 'The Creator', zh: '创世者' }, body: { en: 'The tragic guardian who begs for death. To strike them down is to shatter the seal you came to protect.', zh: '求死的悲剧守护者。击倒 Ta，便是亲手击碎你来此守护的封印。' } },

  // --- Warden (encounter default-unlocked on first spawn; memories via Task 4) ---
  { id: 'warden:encounter', cat: 'warden', n: { en: 'The Warden', zh: '守渊人' }, body: { en: 'A former Descender, absorbed by the Abyss and remade as its immune hound. It stalks you across floors. Kill it for a relic of the fallen — or descend and lose it.', zh: '前代下探者，被深渊吞噬后改造成免疫猎犬，跨层追猎你。杀 Ta 掉落前任遗物——或下楼甩脱。' } },
  { id: 'warden:memory1', cat: 'warden', n: { en: 'Memory I', zh: '记忆 一' }, body: WARDEN_MEMORIES_PLACEHOLDER(0) },
  { id: 'warden:memory2', cat: 'warden', n: { en: 'Memory II', zh: '记忆 二' }, body: WARDEN_MEMORIES_PLACEHOLDER(1) },
  { id: 'warden:memory3', cat: 'warden', n: { en: 'Memory III', zh: '记忆 三' }, body: WARDEN_MEMORIES_PLACEHOLDER(2) },
];

// Pull the 3 memory bodies from warden.ts so the Codex shows the same text that
// surfaces as a message on each kill (single source of truth).
import { WARDEN_MEMORIES } from './warden.js';
function WARDEN_MEMORIES_PLACEHOLDER(i: number): I18nText { return WARDEN_MEMORIES[i]; }
```
> Note: TS hoists `function` declarations, so referencing `WARDEN_MEMORIES_PLACEHOLDER` in the array literal above its definition is legal. The `import` at the bottom is also hoisted. If your lint setup dislikes it, inline the three bodies from `WARDEN_MEMORIES[i]` instead — but keep them identical.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/__tests__/codex.test.ts`
Expected: PASS.

- [ ] **Step 6: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean. (This unblocks Task 4's build.)

- [ ] **Step 7: Commit (with Task 4)**

```bash
git add src/lore.ts src/meta.ts src/__tests__/codex.test.ts
git commit -m "Wave 8 Task 5: lore entries + unlockLore + unlockedLore migration"
```

---

## Task 6: Lore unlock triggers (wiring)

**Files:**
- Modify: `src/game.ts` (`initGame` ~L18 world unlock; `enterFloor` area unlock ~L105)
- Modify: `src/relics.ts` (`grantRelic` ~L141 relic unlock)
- Modify: `src/enemies.ts` (`spawnWarden` warden:encounter unlock — add to the fn from Task 3)
- Test: none new — wiring verified by build + Task 7 smoke (the call sites touch heavy entry points that aren't unit-test-friendly; the unlock *behavior* is already covered by codex.test.ts).

**Interfaces:**
- Consumes: `unlockLore` (Task 5), `LORE_ENTRIES` ids.
- Produces: entries unlock at the right gameplay beats (new game, enter area, pick up relic, warden spawn).

- [ ] **Step 1: Wire the 4 call sites**

`src/game.ts` — add the import near the top (after `import { AREAS } from './data.js';` L15):
```ts
import { unlockLore } from './meta.js';
```
In `initGame` (after `enterFloor(1);` ~L28), unlock the default world entry:
```ts
  unlockLore('world:descent');
```
In `enterFloor`'s `setup()`, where the `area` is resolved (~L105, inside the existing `const area = AREAS.find(...)` block), add the area unlock (only when not in a branch — branch uses the fungal area id which has no codex entry):
```ts
    const area = AREAS.find(a => floor >= a.floorStart && floor <= a.floorEnd);
    if (area && !G!.branchMode) unlockLore('area:' + area.id);
    if (area && area.lore.length > 0) {
```
(Insert the unlock line before the existing `if (area && area.lore.length > 0)`.)

`src/relics.ts` — add the import (after the data import L8):
```ts
import { unlockLore } from './meta.js';
```
In `grantRelic` (after `p.relics.push(id);` ~L148), unlock that relic's codex entry:
```ts
  p.relics.push(id);
  unlockLore('relic:' + id);
```

`src/enemies.ts` — in `spawnWarden` (Task 3), add the encounter unlock right after the enemy push (before the `addMsg`):
```ts
import { unlockLore } from './meta.js';
```
(at top with other imports), and inside `spawnWarden` after `G.enemies.push({...});`:
```ts
  unlockLore('warden:encounter');
```

- [ ] **Step 2: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean.

- [ ] **Step 3: Sanity: confirm relic entries exist for the new ids**

The relic unlock stores `relic:<id>` for EVERY relic, but `LORE_ENTRIES` only defines warden relics as a sample. Unknown ids are harmless — `renderCodex` (Task 7) iterates `LORE_ENTRIES`, so stray `relic:*` ids that have no entry are simply ignored. No action needed; documented as a follow-up (full relic lore).

- [ ] **Step 4: Commit**

```bash
git add src/game.ts src/relics.ts src/enemies.ts
git commit -m "Wave 8 Task 6: wire lore unlock triggers (game/relic/warden spawn)"
```

---

## Task 7: Codex UI panel

**Files:**
- Modify: `index.html` (title menu ~L18; overlays ~L96)
- Modify: `src/main.ts` (`renderCodex` new ~after `renderRecords` L508; bind ~L530; `updateLangUI` ~L197; imports L28)
- Test: none unit — DOM rendering verified by headless smoke (Step 5). No canvas.

**Interfaces:**
- Consumes: `LORE_ENTRIES`, `LORE_CATS` (Task 5); `getMeta` (meta.ts); `showOverlay`/`hideOverlay` (main.ts).

- [ ] **Step 1: Add the button + overlay markup to `index.html`**

Title menu — next to the records button (~L18), add:
```html
<button class="menu-btn" id="btn-codex">📜 Codex</button>
```
Overlays — next to the records overlay (~L96), clone its structure:
```html
<div id="codex-overlay" class="overlay"><div id="codex-panel" class="panel" style="min-width:520px;max-width:680px"><button class="close-btn" id="btn-close-codex">✕</button><h2 id="codex-title">📜 Codex</h2><div id="codex-content"></div></div></div>
```

- [ ] **Step 2: Add `renderCodex` + bind in `src/main.ts`**

Imports — add to the meta import (~L28):
```ts
import { renderForge, renderTitleStats, getMeta } from './meta.js';
```
(unchanged — `getMeta` already imported). Add a new lore import near it:
```ts
import { LORE_ENTRIES, LORE_CATS } from './lore.js';
```

Add `renderCodex` right after `renderRecords` (~after L508):
```ts
// ===== Lore Codex (Wave 8) — clones the records-overlay pattern =====
function renderCodex(): void {
  const zh = lang === 'zh';
  const unlocked = new Set(getMeta().unlockedLore);
  const sections = LORE_CATS.map(cat => {
    const rows = LORE_ENTRIES.filter(e => e.cat === cat.id).map(e => {
      const has = unlocked.has(e.id);
      const name = has ? (zh ? e.n.zh : e.n.en) : '🔒 ???';
      const body = has ? (zh ? e.body.zh : e.body.en) : (zh ? '尚未发现。继续下探以解锁。' : 'Not yet discovered. Descend further to uncover.');
      return `<div style="padding:8px 10px;margin:4px 0;border-left:3px solid ${has ? '#9a2be2' : '#333'};background:rgba(255,255,255,.02)"><div style="color:${has ? '#ddd' : '#555'};font-weight:700">${name}</div><div style="color:${has ? '#999' : '#444'};font-size:.9em;margin-top:3px">${body}</div></div>`;
    }).join('');
    return rows
      ? `<div style="color:#8888aa;margin:14px 2px 4px;font-size:.95em;border-bottom:1px solid #222;padding-bottom:3px">${cat.label[zh ? 'zh' : 'en']}</div>${rows}`
      : '';
  }).join('');
  (document.getElementById('codex-content')!).innerHTML = sections || `<div style="color:#555;padding:12px">${zh ? '尚无条目。' : 'No entries yet.'}</div>`;
  (document.getElementById('codex-title')!).textContent = zh ? '📜 典籍' : '📜 Codex';
}
```

Bind (in `bindButtons`, next to the records bind ~L530):
```ts
  on('btn-codex', () => { showOverlay('codex-overlay'); renderCodex(); });
  on('btn-close-codex', () => { hideOverlay('codex-overlay'); });
```

`updateLangUI` (next to the records label ~L197):
```ts
  $('btn-codex')!.textContent = lang === 'zh' ? '📜 典籍' : '📜 Codex';
```

- [ ] **Step 3: typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean.

- [ ] **Step 4: Headless smoke (DOM-level, no canvas needed)**

Run a `vite preview` + playwright-core script (reuse the Polish-A/Q5 harness) that:
1. Loads the title screen, asserts `#btn-codex` is visible with text "📜 Codex".
2. Clicks `#btn-codex`, asserts `#codex-overlay` becomes `.active` and `#codex-content` contains "The Descent" (world:descent default-unlocked) and at least one "??? " (locked entry).
3. Toggles language (click `#lang-btn`), asserts the button text flips to "📜 典籍".
Expected: all 3 pass, 0 console errors.

- [ ] **Step 5: Commit**

```bash
git add index.html src/main.ts
git commit -m "Wave 8 Task 7: codex panel (renderCodex + bind + i18n label)"
```

---

## Task 8: Integration verification + manual QA

**Files:** none (verification only).

- [ ] **Step 1: Full test suite green**

Run: `npx vitest run`
Expected: all suites PASS (existing 96 + new ~14 across warden/warden-relics/codex + grantKillRewards additions).

- [ ] **Step 2: typecheck + build clean**

Run: `npm run typecheck && npm run build`
Expected: clean.

- [ ] **Step 3: Headless gameplay smoke**

`npm run dev` + playwright-core: start a Normal game, descend via the dev/cheat or by walking stairs until `wardenCd` hits 0 (init `rng(4,6)` → first spawn ~F4-6). Assert:
- The "👁 The Warden is hunting you..." message fires and a purple `Ѡ` enemy appears on a non-start room.
- Kill it (use existing dev cheats if available, else force `e.hp = 0`) → a `🏺 Relic acquired: …` message for one of cloak/blade/shard + a "🕯 You have repelled the Warden!" message + a memory line.
- Open 📜 Codex → the "The Warden" section now lists the encounter + the unlocked Memory.
- Descend (despawn) without killing → no Warden on the next floor; cd reset.
Expected: 0 console errors; behaviors observed.

- [ ] **Step 4: Manual QA checklist**

- [ ] Warden spawns ~F4-6, again ~6-9 floors later; never inside a portal branch.
- [ ] Warden kill grants a specific relic (not random), and the 3rd kill grants the last one; a 4th Warden kill grants no new relic (all owned) but still shows the message.
- [ ] Codex unlocks: world on new game; areas as you enter each of the 8; bosses on each boss kill; relics on pickup; warden encounter on first spawn; memories one-per-kill.
- [ ] EN/ZH toggle renders all Codex text + button labels correctly.
- [ ] Old save (pre-Wave-8) loads without error (wardenCd/unlockedLore migrate).
- [ ] Reduced-motion: Warden spawn still works (shake no-ops, message still shows).

- [ ] **Step 5: Final commit (docs/ledger) + report**

If following SDD, update `.superpowers/sdd/` ledger + run a whole-branch code review (superpowers:requesting-code-review) before merge. Commit any review fixes.

---

## Self-Review

**1. Spec coverage** — checked against `specs/wave8-warden-codex/TECH.md`:
- A.1 state (wardenCd/isWarden/init rng(4,6)/save migration) → Task 1 (types) + Task 3 (init/save). ✅
- A.2 trigger + spawnWarden (enterFloor tick, rng(6,9) reset, full Enemy literal, msg/fx) → Task 3. ✅
- A.3 kill drop (grantRelic(pick WARDEN_RELICS) + memory unlock + msg) → Task 4 (+ Task 2 relic defs). ✅
- A.4 flee (no logic — floor enemy) → inherent; verified in Task 8 QA. ✅
- B.1 data (LORE_ENTRIES, unlockedLore, initMeta/getMeta migration, unlockLore) → Task 5. ✅
- B.2 unlock triggers (area/boss/relic/warden encounter/warden memory/world default) → Task 4 (boss+memory) + Task 6 (world/area/relic/encounter). ✅
- B.3 UI (btn-codex, codex-overlay, renderCodex grouped/locked-as-???, bind, updateLangUI) → Task 7. ✅
- Non-goals respected: no corruption/sanity, no multi-ending, relic lore is placeholder ids (ignored by render). ✅
- Global constraints: branch guard (Task 3 `!G.branchMode`), reduced-motion inherits, bilingual throughout, old-save migration (Task 1/3/5). ✅

**2. Placeholder scan** — no TBD/TODO/"add appropriate"; all code blocks complete. The two `WARDEN_MEMORIES_PLACEHOLDER` usages in lore.ts are a real hoisted helper, not a placeholder. relic lore entries are intentionally not authored (spec non-goal) and stray ids are provably ignored by renderCodex (documented Task 6 Step 3).

**3. Type/name consistency** — `wardenStats`, `pickWardenRelic`, `nextWardenMemory`, `wardenMemoryText`, `WARDEN_MEMORIES`, `WARDEN_RELIC_IDS` (Task 1) consumed unchanged in Tasks 3/4/5. `unlockLore(id)` signature identical in Task 4 (mock) and Task 5 (real). `LORE_ENTRIES`/`LORE_CATS`/`LoreEntry`/`LoreCat` consistent Task 5→7. Boss id scheme `boss:<fl>` matches Task 4 call (`'boss:' + G.floor`) and Task 5 entries. Area id scheme `'area:' + area.id` matches Task 6 call and Task 5 entries (caves/crypts/depths/fortress/dragon/abyss/void/sanctum — verified against data.ts AREAS). `grantRelic(rid, e.x, e.y)` — relics.ts signature is `grantRelic(id, x, y)` (3-arg); Task 4 calls it with 3 args. ✅

**One risk called out for the reviewer:** Task 4 and Task 5 are interlocked (`combat.ts` imports `unlockLore` from `meta.ts`). They must both land before the build is green; the plan pairs them in a single commit window (Task 4 Step 7 defers commit until Task 5). If executing inline rather than per-task, merge 4+5 into one pass.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-31-darkhollow-wave8-warden-codex.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task (1→2→3→5→4→6→7→8; note 5 before 4), review between tasks, fast iteration. Keeps each task's diff focused and reviewable. Watch the GLM-5.1 5h limit (≤2 concurrent; fall back to main-agent inline on 429 — the codebase pattern).

**2. Inline Execution** — I execute tasks in this session via executing-plans, batching with checkpoints for your review.

Which approach?
