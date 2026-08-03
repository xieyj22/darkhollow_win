// Task 1 (Endless content): tests for genEndlessGear, endlessLuckMult stub,
// and the new corruption_resist set-bonus (void_gear 3-pc) flowing through recalc.
//
// Mocks follow the grantKillRewards.test pattern: state/utils/i18n + all of
// combat.ts's side-effectful deps are mocked so we can import recalc directly.
// data.js + config.js + corruption.js are left REAL (pure / leaf) so the new
// ENDLESS_GEAR table + EQUIPMENT_SETS entries are exercised as shipped.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../state.js', () => ({
  get G(): unknown { return (globalThis as { G?: unknown }).G; },
  lang: 'en',
}));
vi.mock('../utils.js', () => ({
  rng: () => 0,
  pick: <T>(a: T[]) => a[0],   // deterministic: always first pool entry
  dst: () => 1,
}));
vi.mock('../audio.js', () => ({ snd: () => {}, setBgmScene: () => {} }));
vi.mock('../effects.js', () => ({ flt: () => {}, shake: () => {} }));
vi.mock('../fx.js', () => ({ fxFlash: () => {}, fxBurst: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: () => {} }));
vi.mock('../enemies.js', () => ({ processBossPhase: () => {} }));
vi.mock('../i18n.js', () => ({
  t: (k: string) => k,
  tMsg: (k: string, ...a: string[]) => a.reduce((s: string, x) => s.replace('{}', x), k),
  tx: (f: { en?: string } | string) => (typeof f === 'string' ? f : (f && f.en) || ''),
  itemName: (f: { n?: { en?: string } } | undefined) => (f && f.n && f.n.en) || '',
}));
vi.mock('../meta.js', () => ({
  bonusExp: (e: number) => e,
  bonusGold: (g: number) => g,
  getMeta: () => ({ upgrades: {}, stats: {} }),
  persistAchievement: () => {},
  calculateSoulEchoes: () => ({ total: 0 }),
  updateRunStats: () => {},
  renderEchoBreakdown: () => {},
  creditSoulEchoes: () => {},
  recordRun: () => {},
  unlockLore: vi.fn(),
  endlessLuckMult: () => 1,
  corruptionWardMult: () => 1,
}));
vi.mock('../warden.js', () => ({
  pickWardenRelic: () => null,
  nextWardenMemory: () => null,
  wardenMemoryText: () => null,
}));
vi.mock('../relics.js', () => ({
  getRelicExpMult: () => 1,
  getRelicGoldMult: () => 1,
  relicOnKill: () => {},
  grantRandomRelic: () => {},
  grantRelic: vi.fn(),
  relicOnHitEnemy: (d: number) => d,
  relicOnDamaged: () => {},
  relicOnDeath: () => false,
  relicOnDodge: () => {},
  relicOnCrit: () => {},
  applyRelicBonuses: () => {},
}));
vi.mock('../talents.js', () => ({
  onPlayerKill: () => {},
  onPlayerHitEnemy: (d: number) => d,
  onPlayerDodged: () => {},
  onPlayerDamaged: () => false,
  onPlayerDeath: () => false,
  onEnemyHitPlayer: () => {},
  checkDoubleStrike: () => false,
  getCritMultiplier: () => 2,
  getManaShieldReduction: () => 0,
  applyTalentBonuses: () => {},
}));
vi.mock('../steam.js', () => ({ unlockAchievement: () => {} }));

import { genEndlessGear, endlessLuckMult } from '../item-gen.js';
import { recalc, endlessLootIsExclusive } from '../combat.js';
import { ENDLESS_GEAR, EQUIPMENT_SETS } from '../data.js';
import type { Player, Item } from '../types.js';

// --- Sanity: the data shipped as required by the brief ---
describe('ENDLESS_GEAR table shape (Task 1 brief)', () => {
  it('has 3 weapons / 3 armors / 2 accessories, all rarity 5', () => {
    expect(ENDLESS_GEAR.weapons.length).toBe(3);
    expect(ENDLESS_GEAR.armors.length).toBe(3);
    expect(ENDLESS_GEAR.accessories.length).toBe(2);
    for (const w of ENDLESS_GEAR.weapons) expect(w.r).toBe(5);
    for (const a of ENDLESS_GEAR.armors) expect(a.r).toBe(5);
    for (const a of ENDLESS_GEAR.accessories) expect(a.r).toBe(5);
  });

  it('every piece carries a set tag routing to the new sets', () => {
    const all = [...ENDLESS_GEAR.weapons, ...ENDLESS_GEAR.armors, ...ENDLESS_GEAR.accessories];
    for (const p of all) {
      expect(p.set).toMatch(/_gear$/);
    }
  });

  it('EQUIPMENT_SETS includes the 3 new sets (no id collision with existing)', () => {
    const ids = EQUIPMENT_SETS.map(s => s.id);
    expect(ids).toContain('void_gear');
    expect(ids).toContain('abyss_gear');
    expect(ids).toContain('astral_gear');
    // no duplicate ids
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// --- genEndlessGear: scaling + type routing ---
describe('genEndlessGear', () => {
  it('scales atk with floor + carries set/el (weapon)', () => {
    // pick → first: Void Blade (a=14, el=shadow, set=void_gear)
    const w41 = genEndlessGear(41, 'weapon');
    const w100 = genEndlessGear(100, 'weapon');
    expect(w41.type).toBe('weapon');
    expect(w41.rarity).toBe(5);
    expect(w41.set).toMatch(/_gear$/);
    expect(w41.el).toBe('shadow');
    // F41 bonus = 0 → atk = base 14; F100 bonus = 23 → atk = 37
    expect(w41.atk).toBe(14);
    expect((w100.atk ?? 0)).toBeGreaterThan(w41.atk ?? 0);
    expect(w100.atk).toBe(14 + 23);
  });

  it('bonus formula matches brief-documented milestones (F41:0 F46:2 F60:7 F100:23)', () => {
    expect(genEndlessGear(41, 'weapon').atk).toBe(14);   // +0
    expect(genEndlessGear(46, 'weapon').atk).toBe(16);   // +2
    expect(genEndlessGear(60, 'weapon').atk).toBe(21);   // +7
    expect(genEndlessGear(100, 'weapon').atk).toBe(37);  // +23
  });

  it('armor/accessory produce correct types with set tag', () => {
    const a = genEndlessGear(50, 'armor');
    expect(a.type).toBe('armor');
    expect(a.rarity).toBe(5);
    expect(a.set).toMatch(/_gear$/);
    expect(typeof a.def).toBe('number');

    const ac = genEndlessGear(50, 'accessory');
    expect(ac.type).toBe('accessory');
    expect(ac.rarity).toBe(5);
    expect(ac.set).toMatch(/_gear$/);
    // accessory uses fixed base stats (no floor scaling) per brief
    // pick → first: Void Ring (a=3, d=2, h=30)
    expect(ac.atk).toBe(3);
    expect(ac.def).toBe(2);
    expect(ac.hp).toBe(30);
  });

  it('armor def scales with floor (F100 > F41)', () => {
    // pick → first: Void Armor (d=12)
    expect(genEndlessGear(41, 'armor').def).toBe(12);    // +0
    expect(genEndlessGear(100, 'armor').def).toBe(35);   // +23
  });
});

describe('endlessLuckMult (T1 stub)', () => {
  it('returns 1 (placeholder; T4 wires the meta rank)', () => {
    expect(endlessLuckMult()).toBe(1);
  });
});

// --- corruption_resist set bonus via recalc ---
// recalc is the only public path that exercises the (unexported) applySetBonus.
// We equip a full void_gear 3-pc set (weapon+armor+accessory) and assert that
// recalc both RESETS setCorruptionResist to 0 first and then re-applies the
// 3-pc bonus (+3) — and that the 2-pc el_dmg_shadow case also fires.
function voidItem(type: 'weapon' | 'armor' | 'accessory'): Item {
  if (type === 'weapon')
    return { type: 'weapon', name: 'Void Blade', rarity: 5, ch: '/', c: '#9b5de5', desc: '', x: 0, y: 0, atk: 14, el: 'shadow', set: 'void_gear' };
  if (type === 'armor')
    return { type: 'armor', name: 'Void Armor', rarity: 5, ch: '[', c: '#9b5de5', desc: '', x: 0, y: 0, def: 12, el: 'shadow', set: 'void_gear' };
  return { type: 'accessory', name: 'Void Ring', rarity: 5, ch: '"', c: '#9b5de5', desc: '', x: 0, y: 0, atk: 3, def: 2, hp: 30, set: 'void_gear' };
}

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

describe('recalc + corruption_resist set bonus (void_gear)', () => {
  beforeEach(() => {
    // recalc reads G via the imported state binding (mocked to globalThis.G).
    (globalThis as any).G = { player: barePlayer() };
  });

  it('void_gear 3-pc grants setCorruptionResist=3 + el_dmg_shadow=15', () => {
    const p = (globalThis as any).G.player as Player;
    p.eq.weapon = voidItem('weapon');
    p.eq.armor = voidItem('armor');
    p.eq.accessory = voidItem('accessory');
    recalc();
    expect(p.setCorruptionResist).toBe(3);          // 3-pc void_gear bonus
    expect(p.elDmgBonus['shadow']).toBe(15);        // 2-pc void_gear bonus
  });

  it('void_gear 2-pc (no accessory) grants el_dmg_shadow only (no corruption_resist)', () => {
    const p = (globalThis as any).G.player as Player;
    p.eq.weapon = voidItem('weapon');
    p.eq.armor = voidItem('armor');
    // accessory2 stays null → only 2 void_gear pieces
    recalc();
    expect(p.setCorruptionResist).toBe(0);          // 3-pc not met
    expect(p.elDmgBonus['shadow']).toBe(15);        // 2-pc still applies
  });

  it('recalc RESETS setCorruptionResist to 0 before re-applying (no stale carryover)', () => {
    const p = (globalThis as any).G.player as Player;
    // Pre-poison the field to prove recalc zeroes it first.
    p.setCorruptionResist = 99;
    // No void_gear equipped → reset to 0, no bonus re-applied.
    recalc();
    expect(p.setCorruptionResist).toBe(0);
  });

  it('no set equipped → setCorruptionResist stays 0', () => {
    const p = (globalThis as any).G.player as Player;
    recalc();
    expect(p.setCorruptionResist).toBe(0);
  });
});

// --- fix1 (I-1): boss/elite F41+ must drop ENDLESS-EXCLUSIVE gear, not just any loot ---
// Spec §2.2: "boss/精英 F41+ 必掉一件专属装备". The loot decision is extracted into
// the pure predicate endlessLootIsExclusive (caller passes the random roll) so we can
// assert the decision deterministically without mocking the entire attack() flow.
describe('endlessLootIsExclusive — boss/elite F41+ forces exclusive gear (fix1 / spec §2.2)', () => {
  it('boss OR elite on F41+ endless → exclusive regardless of roll', () => {
    expect(endlessLootIsExclusive(45, true, false, true, 0.99, 1)).toBe(true);  // boss
    expect(endlessLootIsExclusive(45, false, true, true, 0.99, 1)).toBe(true);  // elite
    expect(endlessLootIsExclusive(41, true, false, true, 1.0, 1)).toBe(true);   // F41 boundary, roll=1
  });

  it('normal foe on F41+ endless → exclusive only when roll < 0.5×luckMult', () => {
    expect(endlessLootIsExclusive(45, false, false, true, 0.49, 1)).toBe(true);   // 0.49 < 0.5
    expect(endlessLootIsExclusive(45, false, false, true, 0.50, 1)).toBe(false);  // 0.50 not < 0.5
    expect(endlessLootIsExclusive(45, false, false, true, 0.99, 2)).toBe(true);   // luckMult 2 → threshold 1.0
    expect(endlessLootIsExclusive(45, false, false, true, 0.99, 1)).toBe(false);  // 0.99 >= 0.5
  });

  it('below F41 or non-endless → never exclusive (normal mode untouched)', () => {
    expect(endlessLootIsExclusive(40, true, false, true, 0.0, 1)).toBe(false);    // F40 endless boss
    expect(endlessLootIsExclusive(45, true, false, false, 0.0, 1)).toBe(false);   // F45 non-endless boss
    expect(endlessLootIsExclusive(1, false, false, false, 0.0, 1)).toBe(false);   // normal F1
  });

  it('a forced-exclusive drop produces a rarity-5 _gear item via genEndlessGear', () => {
    // The decision is true for a boss → combat.ts calls genEndlessGear; assert the
    // producer output shape (rarity 5, set matches /_gear$/) the wiring relies on.
    const drop = endlessLootIsExclusive(45, true, false, true, 0.99, 1);
    expect(drop).toBe(true);
    const item = genEndlessGear(45);
    expect(item.rarity).toBe(5);
    expect(item.set).toMatch(/_gear$/);
  });
});
