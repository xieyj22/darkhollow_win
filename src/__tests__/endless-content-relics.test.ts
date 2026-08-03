// Task 2 (Endless content): characterization tests for the 6 rarity-5 relics.
// Each effect gets ONE characterization that locks in the wiring site:
//   void_heart  → relics.applyRelicBonuses (spellPower scales with floor)
//   chaos_egg   → relics.applyRelicBonuses (atk scales with soulEchoes)
//   abyss_eye   → relics.relicOnHitEnemy   (+30% dmg vs void-tagged foes)
//   eternal_sand→ combat.applyCorruption   (halve GAIN, n>0 gate protects cleanse)
//   star_core   → talents.getCritMultiplier(crit dmg scales with floor)
//   null_crown  → game.enterFloor          (random buff each endless floor)
//   grantRandomRelic → cap lifted to rarity 5 at F41+
//
// Mock strategy: relics/talents/combat/game/data/corruption are REAL (these are
// the modules under test). Only the leaf side-effect deps (audio/fx/messages/
// dungeon/items/render/save/bridge/enemies/meta/warden/steam/i18n/state/utils)
// are mocked, following the endless-content.test (T1) pattern.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../state.js', () => ({
  get G(): unknown { return (globalThis as { G?: unknown }).G; },
  lang: 'en',
  // grantRelic → queueRelicIntro reads introEnabled; keep intro disabled so the
  // quiet discoverItem branch runs (no overlay/DOM needed in this suite).
  introEnabled: false,
}));
vi.mock('../utils.js', () => ({
  rng: () => 0,
  pick: <T>(a: T[]) => a[0],
  dst: () => 1,
}));
vi.mock('../audio.js', () => ({ snd: () => {}, setBgmScene: () => {} }));
vi.mock('../effects.js', () => ({ flt: () => {}, shake: () => {} }));
vi.mock('../fx.js', () => ({ fxFlash: () => {}, fxBurst: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: () => {} }));
vi.mock('../enemies.js', () => ({
  processBossPhase: () => {},
  spawnEnemies: () => [],
  spawnBranchEnemies: () => [],
  spawnWarden: () => {},
}));
vi.mock('../i18n.js', () => ({
  t: (k: string) => k,
  tMsg: (k: string, ...a: string[]) => a.reduce((s: string, x) => s.replace('{}', x), k),
  tx: (f: { en?: string } | string) => (typeof f === 'string' ? f : (f && f.en) || ''),
  itemName: (f: { n?: { en?: string } } | undefined) => (f && f.n && f.n.en) || '',
}));
vi.mock('../meta.js', () => ({
  bonusExp: (e: number) => e,
  bonusGold: (g: number) => g,
  // Default echoes = 0; individual tests override via (globalThis as any).__echoes.
  getMeta: () => ({ upgrades: {}, stats: {}, soulEchoes: (globalThis as any).__echoes ?? 0 }),
  persistAchievement: () => {},
  calculateSoulEchoes: () => ({ total: 0 }),
  updateRunStats: () => {},
  renderEchoBreakdown: () => {},
  creditSoulEchoes: () => {},
  recordRun: () => {},
  recordWardenLegacy: () => {},
  unlockLore: vi.fn(),
  discoverItem: () => false,
  endlessLuckMult: () => 1,
  corruptionWardMult: () => 1,
}));
vi.mock('../warden.js', () => ({
  pickWardenRelic: () => null,
  nextWardenMemory: () => null,
  wardenMemoryText: () => null,
  // relics.ts now imports item-intro.ts → ui-panels.ts → lore.ts, which reads
  // WARDEN_MEMORIES at module load; provide an empty array so the mock satisfies it.
  WARDEN_MEMORIES: [],
}));
vi.mock('../steam.js', () => ({ unlockAchievement: () => {} }));
// game.ts deps (only exercised by the null_crown test):
vi.mock('../dungeon.js', () => ({
  genDungeon: () => ({ rooms: [{ cx: 5, cy: 5, x: 0, y: 0, w: 10, h: 10 }], traps: [], map: [[0]] }),
  updatePlayerFOV: () => {},
  computeFOV: () => [],
}));
vi.mock('../items.js', () => ({
  genItem: () => ({ type: 'gold', name: 'x', value: 1, ch: '$', c: '#ffd700', x: 0, y: 0, rarity: 0, desc: '' }),
  genFood: () => ({ name: 'f', hungerRestore: 10, c: '#aa', ch: '%', r: 0, x: 0, y: 0 }),
}));
vi.mock('../player.js', () => ({ createPlayer: () => ({}) }));
vi.mock('../render.js', () => ({ updateUI: () => {}, render: () => {}, resizeCanvas: () => {} }));
vi.mock('../save.js', () => ({ autoSave: () => {} }));
vi.mock('../bridge.js', () => ({ bridge: { muted: false } }));

import { applyRelicBonuses, relicOnHitEnemy, grantRandomRelic, setRecalcFn } from '../relics.js';
import { getCritMultiplier } from '../talents.js';
import { applyCorruption } from '../combat.js';
import { enterFloor } from '../game.js';
import { RELICS } from '../data.js';
import type { Player, Enemy, Item } from '../types.js';

// Suppress the late-bound recalc (grantRelic calls _recalc?.()).
setRecalcFn(() => {});

function barePlayer(over: Partial<Player> = {}): Player {
  return {
    x: 0, y: 0, hp: 50, maxHp: 50, mp: 10, maxMp: 10,
    atk: 5, def: 2, baseAtk: 5, baseDef: 2, baseMaxHp: 50,
    level: 1, exp: 0, expNext: 100, gold: 0, turns: 0,
    raceName: 'Human', clsName: 'Warrior', ri: 0, ci: 0,
    inv: [], eq: { weapon: null, armor: null, accessory: null, accessory2: null },
    buffs: [], visible: null, explored: [],
    kills: 0, deepestFloor: 1,
    critChance: 0.05, baseCritChance: 0.05,
    spellPower: 1, baseSpellPower: 1,
    dodgeChance: 0.05, baseDodgeChance: 0.05,
    poisonTurns: 0, poisonDmg: 0, hunger: 100, maxHunger: 100,
    quickSlots: [null, null, null, null], warded: false, freeTurn: false,
    skillCd: 0, streak: 0, bestStreak: 0, achievements: new Set<string>(),
    talents: { talents: {}, points: 0 },
    elRes: {}, setBonusActive: {}, elDmgBonus: {}, healBonus: 0,
    slowed: 0, critDamageBonus: 0,
    hasRevived: false, bossCheatDeathUsed: false, combatReviveUsed: false,
    bossesKilledThisRun: 0, relics: [], corruption: 0,
    setCorruptionResist: 0,
  } as unknown as Player;
}

function setG(over: Record<string, unknown> = {}): void {
  (globalThis as any).G = {
    floor: 1, endless: false, branchMode: false, wardenCd: 99,
    player: barePlayer(),
    enemies: [], items: [], traps: [], dungeon: { rooms: [{ cx: 0, cy: 0 }], map: [[0]], traps: [] },
    ...over,
  };
}

beforeEach(() => { (globalThis as any).__echoes = 0; });
afterEach(() => { vi.restoreAllMocks?.(); });

// --- void_heart: spellPower += floor * 0.01 ---
describe('void_heart (applyRelicBonuses)', () => {
  it('adds floor*0.01 spellPower (F100 → +1)', () => {
    setG({ floor: 100 });
    const p = (globalThis as any).G.player as Player;
    p.relics = ['void_heart'];
    p.spellPower = 1; p.baseSpellPower = 1;
    applyRelicBonuses(p);
    expect(p.spellPower).toBe(2); // 1 + floor(100*0.01)=1
  });

  it('scales with floor (F50 → +0 until floor rounds up)', () => {
    setG({ floor: 50 });
    const p = (globalThis as any).G.player as Player;
    p.relics = ['void_heart'];
    p.spellPower = 1;
    applyRelicBonuses(p);
    // floor(50*0.01) = floor(0.5) = 0 — no bonus at F50 yet
    expect(p.spellPower).toBe(1);
  });
});

// --- chaos_egg: atk += floor(echoes/50) ---
describe('chaos_egg (applyRelicBonuses)', () => {
  it('adds floor(echoes/50) atk (250 echoes → +5)', () => {
    (globalThis as any).__echoes = 250;
    setG();
    const p = (globalThis as any).G.player as Player;
    p.relics = ['chaos_egg'];
    p.atk = 10; p.baseAtk = 5;
    applyRelicBonuses(p);
    expect(p.atk).toBe(15);
  });

  it('adds nothing when echoes < 50', () => {
    (globalThis as any).__echoes = 49;
    setG();
    const p = (globalThis as any).G.player as Player;
    p.relics = ['chaos_egg'];
    p.atk = 10;
    applyRelicBonuses(p);
    expect(p.atk).toBe(10);
  });
});

// --- abyss_eye: +30% dmg vs void-tagged foes ---
describe('abyss_eye (relicOnHitEnemy)', () => {
  it('multiplies dmg x1.3 vs spirit-tagged foe', () => {
    setG();
    (globalThis as any).G.player.relics = ['abyss_eye'];
    const defender = { hp: 100, maxHp: 100, tags: ['spirit'] } as Enemy;
    expect(relicOnHitEnemy(defender, 100)).toBe(130);
  });

  it('multiplies dmg x1.3 vs aberration/demon tags', () => {
    setG();
    (globalThis as any).G.player.relics = ['abyss_eye'];
    expect(relicOnHitEnemy({ hp: 100, maxHp: 100, tags: ['aberration'] } as Enemy, 50)).toBe(65);
    setG();
    (globalThis as any).G.player.relics = ['abyss_eye'];
    expect(relicOnHitEnemy({ hp: 100, maxHp: 100, tags: ['demon'] } as Enemy, 10)).toBe(13);
  });

  it('does NOT boost untagged or non-void foes', () => {
    setG();
    (globalThis as any).G.player.relics = ['abyss_eye'];
    expect(relicOnHitEnemy({ hp: 100, maxHp: 100, tags: ['rodent'] } as Enemy, 100)).toBe(100);
    setG();
    (globalThis as any).G.player.relics = ['abyss_eye'];
    expect(relicOnHitEnemy({ hp: 100, maxHp: 100 } as Enemy, 100)).toBe(100);
  });

  it('does nothing without the relic even vs void foes', () => {
    setG();
    // no relic in player.relics
    expect(relicOnHitEnemy({ hp: 100, maxHp: 100, tags: ['demon'] } as Enemy, 100)).toBe(100);
  });
});

// --- eternal_sand: halve corruption GAIN (n>0 gate) ---
describe('eternal_sand (applyCorruption)', () => {
  it('halves positive corruption gain (10 → 5)', () => {
    setG();
    const p = (globalThis as any).G.player as Player;
    p.relics = ['eternal_sand']; p.corruption = 0;
    applyCorruption(10);
    expect(p.corruption).toBe(5);
  });

  it('without the relic, full gain applies (10 → 10)', () => {
    setG();
    const p = (globalThis as any).G.player as Player;
    p.relics = []; p.corruption = 0;
    applyCorruption(10);
    expect(p.corruption).toBe(10);
  });

  it('does NOT halve negative (cleanse) deltas — n>0 gate protects purification', () => {
    // The carry-over concern from T1: void_gear's per-floor applyCorruption(-resist)
    // must cleanse the FULL amount. If eternal_sand halved negative n, 20→15 (bug).
    // With the gate, 20 → 10 (full cleanse preserved).
    setG();
    const p = (globalThis as any).G.player as Player;
    p.relics = ['eternal_sand']; p.corruption = 20;
    applyCorruption(-10);
    expect(p.corruption).toBe(10); // 20 - 10, NOT 20 - ceil(-10/2)=20-(-5)=15
  });

  it('rounds UP the halved gain (Math.ceil)', () => {
    setG();
    const p = (globalThis as any).G.player as Player;
    p.relics = ['eternal_sand']; p.corruption = 0;
    applyCorruption(11); // ceil(11/2) = 6
    expect(p.corruption).toBe(6);
  });
});

// --- star_core: crit dmg += floor * 0.005 ---
describe('star_core (getCritMultiplier)', () => {
  it('adds floor*0.005 to crit mult (F100 → +0.5 → mult 2.5)', () => {
    setG({ floor: 100 });
    const p = (globalThis as any).G.player as Player;
    p.relics = ['star_core']; p.critDamageBonus = 0;
    expect(getCritMultiplier()).toBe(2.5);
  });

  it('without the relic, base mult 2.0 at F100', () => {
    setG({ floor: 100 });
    const p = (globalThis as any).G.player as Player;
    p.relics = []; p.critDamageBonus = 0;
    expect(getCritMultiplier()).toBe(2.0);
  });

  it('stacks with existing critDamageBonus', () => {
    setG({ floor: 40 });
    const p = (globalThis as any).G.player as Player;
    p.relics = ['star_core']; p.critDamageBonus = 0.3;
    // 2.0 + 0.3 + (40*0.005=0.2) = 2.5
    expect(getCritMultiplier()).toBe(2.5);
  });
});

// --- null_crown: random buff each endless floor ---
describe('null_crown (enterFloor)', () => {
  it('adds a buff on endless F41 enterFloor', () => {
    setG({ endless: true });
    (globalThis as any).G.player.relics = ['null_crown'];
    enterFloor(41, true); // skipFade → synchronous setup()
    const buffs = (globalThis as any).G.player.buffs;
    expect(buffs.length).toBe(1);
    expect(buffs[0].name).toBe('null_crown');
    expect(buffs[0].turns).toBe(3);
    expect(buffs[0].value).toBe(5);
    expect(['str_buff', 'def_buff', 'shield']).toContain(buffs[0].type);
  });

  it('does NOT buff when not endless (normal mode untouched)', () => {
    setG({ endless: false });
    (globalThis as any).G.player.relics = ['null_crown'];
    enterFloor(41, true);
    expect((globalThis as any).G.player.buffs.length).toBe(0);
  });

  it('does NOT buff below F41 even when endless', () => {
    setG({ endless: true });
    (globalThis as any).G.player.relics = ['null_crown'];
    enterFloor(40, true);
    expect((globalThis as any).G.player.buffs.length).toBe(0);
  });

  it('does NOT buff at F41 without the relic', () => {
    setG({ endless: true });
    (globalThis as any).G.player.relics = [];
    enterFloor(41, true);
    expect((globalThis as any).G.player.buffs.length).toBe(0);
  });
});

// --- grantRandomRelic: rarity cap lifted to 5 at F41+ ---
describe('grantRandomRelic rarity cap (F41 → 5)', () => {
  // With Math.random pinned near 1, the weighted pool's LAST entry is picked.
  // RELICS data order puts the 6 rarity-5 relics last, so at F41 (cap=5) the last
  // candidate is null_crown (the final rarity-5 entry). At F40 (cap=4) rarity-5
  // relics are filtered OUT of `avail`, so the last candidate is memory_shard
  // (the last rarity<=4 relic in data order).
  it('F41 can grant a rarity-5 relic (null_crown picked at tail)', () => {
    setG();
    (globalThis as any).G.player.relics = [];
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99999);
    grantRandomRelic(0, 0, 41);
    const relic = (globalThis as any).G.player.relics[0];
    expect(relic).toBe('null_crown');
    expect(RELICS.find(r => r.id === relic)?.rarity).toBe(5);
    spy.mockRestore();
  });

  it('F40 (cap=4) does NOT pick a rarity-5 relic at tail → memory_shard (rarity 3)', () => {
    setG();
    (globalThis as any).G.player.relics = [];
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99999);
    grantRandomRelic(0, 0, 40);
    const relic = (globalThis as any).G.player.relics[0];
    expect(relic).toBe('memory_shard');
    expect(RELICS.find(r => r.id === relic)?.rarity).toBeLessThanOrEqual(4);
    spy.mockRestore();
  });

  it('when player owns all non-rarity5 relics, F41 grants a rarity-5 relic', () => {
    setG();
    // Own every relic except the 6 rarity-5 ones.
    (globalThis as any).G.player.relics = RELICS.filter(r => r.rarity < 5).map(r => r.id);
    grantRandomRelic(0, 0, 41);
    const granted = (globalThis as any).G.player.relics.at(-1);
    expect(RELICS.find(r => r.id === granted)?.rarity).toBe(5);
  });
});
