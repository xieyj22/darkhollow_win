import { describe, it, expect, vi, beforeEach } from 'vitest';

// combat.ts reads `G` via its imported binding from state.js (a `let`), NOT
// globalThis.G. Expose a getter so enemy-skills.ts sees whatever we assign to
// globalThis.G in beforeEach. (Mirrors grantKillRewards.test.ts mock pattern.)
vi.mock('../state.js', () => ({
  get G(): unknown { return (globalThis as { G?: unknown }).G; },
  lang: 'en',
}));

// Mock attack() to mirror the real damage formula without dragging in
// talents/relics/meta/corruption. Real attack() does `dmg = max(1, atk - def)`
// (ignoring the rng(-2,2) jitter for deterministic tests) then `def.hp -= dmg`.
vi.mock('../combat.js', () => ({
  attack: (atk: { atk: number }, def: { hp: number; def: number }, _isP: boolean): boolean => {
    const dmg = Math.max(1, atk.atk - def.def);
    def.hp -= dmg;
    return def.hp <= 0;
  },
}));

vi.mock('../messages.js', () => ({ addMsg: () => {} }));
vi.mock('../fx.js', () => ({ fxBeam: vi.fn(), fxBurst: vi.fn(), fxFlash: vi.fn(), fxAura: vi.fn() }));
vi.mock('../effects.js', () => ({ flt: vi.fn(), shake: vi.fn() }));
vi.mock('../audio.js', () => ({ snd: vi.fn() }));
vi.mock('../enemy-factory.js', () => ({ makeEnemy: vi.fn() }));
vi.mock('../data.js', () => ({ ENEMIES: [] }));
vi.mock('../i18n.js', () => ({
  t: (k: string) => k,
  tMsg: (k: string, ...a: string[]) => a.reduce((s: string, x: string) => s.replace('{}', x), k),
  tx: (f: { en?: string }) => (f && f.en) || '',
}));

import { shouldCastSkill, executeEnemySkill } from '../enemy-skills.js';
import type { Enemy, GameState } from '../types.js';
import { MW, MH, TL } from '../config.js';
import { ENEMIES } from '../data.js';
import { makeEnemy } from '../enemy-factory.js';

// Full-floor map fixture — every tile walkable (TL.FLOOR), so position-based
// handlers (blink/summon) always find a legal target tile without fighting rng.
const floorMap = (): number[][] => Array.from({ length: MH }, () => new Array(MW).fill(TL.FLOOR));

// `G` is provided by the state.js mock as a getter over globalThis.G. Read it
// via this helper so TS sees a non-null GameState (set in beforeEach) — the
// imported `let G: GameState | null` from state.ts would otherwise trip TS18047.
const G = (): GameState => (globalThis as { G?: GameState }).G!;

const mk = (over: Partial<Enemy> = {}): Enemy => ({
  name: 'E', ch: 'x', c: '#fff', x: 0, y: 0, hp: 10, maxHp: 10, atk: 5, def: 1,
  exp: 5, goldDrop: 5, ai: 'chase', stunned: 0, feared: 0, isAlly: false,
  el: 'none', res: {}, skillCd: 0, ...over,
});

// Minimal Player fixture — satisfies the Player interface fields that
// executeEnemySkill touches. Spread + override per-test (see beforeEach).
const minimalPlayer: Record<string, unknown> = {
  x: 0, y: 0, hp: 100, maxHp: 100, mp: 0, maxMp: 0,
  atk: 5, def: 0, baseAtk: 5, baseDef: 0, baseMaxHp: 100,
  level: 1, exp: 0, expNext: 100, gold: 0, turns: 0,
  raceName: 'R', clsName: 'C', ri: 0, ci: 0,
  inv: [], eq: { weapon: null, armor: null, accessory: null, accessory2: null },
  buffs: [], visible: null, explored: [],
  kills: 0, deepestFloor: 1,
  critChance: 0, baseCritChance: 0,
  spellPower: 0, baseSpellPower: 0,
  dodgeChance: 0, baseDodgeChance: 0,
  poisonTurns: 0, poisonDmg: 0,
  hunger: 100, maxHunger: 100,
  quickSlots: [], warded: false, freeTurn: false,
  skillCd: 0, streak: 0, bestStreak: 0,
  achievements: new Set<string>(),
  talents: { talents: {}, points: 0 },
  elRes: {}, setBonusActive: {}, elDmgBonus: {},
  healBonus: 0, slowed: 0,
  critDamageBonus: 0, hasRevived: false,
  bossCheatDeathUsed: false, combatReviveUsed: false,
  bossesKilledThisRun: 0,
  relics: [], corruption: 0,
};

describe('shouldCastSkill', () => {
  it('false when no skill / on cd / out of range / unseen / invis-far; true for invis point-blank / in range', () => {
    const sk = { name: { en: 'Z', zh: 'Z' }, effect: 'dmg_bolt', chance: 1, cd: 3, dmg: 1, range: 5 };
    expect(shouldCastSkill(mk(), 1, true, false)).toBe(false);                        // no skill
    expect(shouldCastSkill(mk({ skill: sk, skillCd: 2 }), 1, true, false)).toBe(false); // on cd
    expect(shouldCastSkill(mk({ skill: sk }), 9, true, false)).toBe(false);            // out of range
    expect(shouldCastSkill(mk({ skill: sk }), 3, false, false)).toBe(false);           // unseen
    expect(shouldCastSkill(mk({ skill: sk }), 5, true, true)).toBe(false);             // invis & far
    expect(shouldCastSkill(mk({ skill: sk }), 1, true, true)).toBe(true);              // invis point-blank OK
    expect(shouldCastSkill(mk({ skill: sk }), 3, true, false)).toBe(true);             // in range, visible, chance=1
  });
});

describe('executeEnemySkill', () => {
  beforeEach(() => {
    (globalThis as { G?: unknown }).G = {
      player: {
        ...minimalPlayer,
        hp: 100, maxHp: 100, dodgeChance: 0.5,
        buffs: [], poisonTurns: 0, poisonDmg: 0, slowed: 0,
      },
      enemies: [],
      gameOver: false,
    };
  });

  it('dmg_bolt: reduces player hp via attack', () => {
    const e = mk({ atk: 20, x: 1, y: 0 });
    G().player.x = 0; G().player.y = 0; G().player.def = 0;
    executeEnemySkill(e, { name: { en: 'Z', zh: 'Z' }, effect: 'dmg_bolt', chance: 1, cd: 1, dmg: 2 });
    expect(G().player.hp).toBeLessThan(100);   // 20*2 - 0 = 40 dmg
  });

  it('dmg_aoe: hits player ignoring dodge + damages ally directly', () => {
    const e = mk({ atk: 20, x: 1, y: 0 });
    const ally = mk({ isAlly: true, hp: 30, maxHp: 30, x: 1, y: 1, def: 0 });
    G().player.x = 0; G().player.y = 0; G().player.def = 5;
    G().enemies = [e, ally];
    const playerHpBefore = G().player.hp;
    executeEnemySkill(e, { name: { en: 'Z', zh: 'Z' }, effect: 'dmg_aoe', chance: 1, cd: 1, dmg: 1, aoe: 2 });
    expect(G().player.hp).toBeLessThan(playerHpBefore);  // took damage despite dodgeChance 0.5
    expect(ally.hp).toBeLessThan(30);                    // ally hit directly
  });

  it('debuff_poison: sets poisonTurns/poisonDmg', () => {
    const e = mk({ x: 1, y: 0 });
    executeEnemySkill(e, { name: { en: 'Z', zh: 'Z' }, effect: 'debuff_poison', chance: 1, cd: 1, dmg: 5, aoe: 4 });
    expect(G().player.poisonTurns).toBe(4);
    expect(G().player.poisonDmg).toBe(5);
  });

  // Characterization tests for the four v1-data-less handlers (see spec §2.2/§7):
  // they have no caster in data.ts yet, so these tests pin each handler's behavior
  // directly via executeEnemySkill to guard the logic until casters are added.

  it('heal: restores a hurt caster hp, capped at maxHp', () => {
    const caster = mk({ hp: 18, maxHp: 20, x: 1, y: 0 });   // hurt → targets self
    executeEnemySkill(caster, { name: { en: 'Z', zh: 'Z' }, effect: 'heal', chance: 1, cd: 1 });
    expect(caster.hp).toBe(20);   // floor(20*0.25)=5 healed → 18+5=23, capped to maxHp 20
  });

  it('debuff_stun: sets player stunned to min(2, turns)', () => {
    const e = mk({ x: 1, y: 0 });
    executeEnemySkill(e, { name: { en: 'Z', zh: 'Z' }, effect: 'debuff_stun', chance: 1, cd: 1, aoe: 2 });
    expect(G().player.stunned).toBe(2);   // min(2, max(0, turns=2))
  });

  it('blink: teleports caster adjacent to the player', () => {
    G().dungeon = { map: floorMap(), rooms: [], stair: { x: 0, y: 0 }, traps: [] };
    G().player.x = 5; G().player.y = 5;
    G().enemies = [];
    const caster = mk({ x: 0, y: 0 });
    executeEnemySkill(caster, { name: { en: 'Z', zh: 'Z' }, effect: 'blink', chance: 1, cd: 1 });
    // dst is Euclidean (diagonal neighbor = sqrt(2)); use Chebyshev for true adjacency.
    const cheb = Math.max(Math.abs(caster.x - G().player.x), Math.abs(caster.y - G().player.y));
    expect(cheb).toBe(1);                                  // now in the player's 8-neighborhood
    expect(caster.x !== 0 || caster.y !== 0).toBe(true);   // moved off its origin tile
  });

  it('summon: pushes a makeEnemy result into G.enemies when the pool is non-empty', () => {
    // enemy-factory/data are module-level mocks (singleton); inject one pool entry
    // and a deterministic makeEnemy return so the handler's spawn+push logic runs.
    G().dungeon = { map: floorMap(), rooms: [], stair: { x: 0, y: 0 }, traps: [] };
    G().floor = 1;
    G().player.x = 0; G().player.y = 0;
    G().enemies = [];
    const fake = mk({ name: 'Imp' });
    vi.mocked(makeEnemy).mockReturnValue(fake);
    (ENEMIES as Array<{ mf?: number; tags?: string[] }>).push({ mf: 1 });
    try {
      const caster = mk({ x: 5, y: 5 });
      executeEnemySkill(caster, { name: { en: 'Z', zh: 'Z' }, effect: 'summon', chance: 1, cd: 1 });
      expect(G().enemies.length).toBe(1);
      expect(G().enemies[0]).toBe(fake);
    } finally {
      (ENEMIES as Array<unknown>).pop();
      vi.mocked(makeEnemy).mockReset();
    }
  });
});
