// P1-1/2/3 regression: processAoeKills must route each kill through the single
// grantKillRewards pipeline (so relic gold/xp mults, warden rewards, boss lore +
// victory guard all fire) instead of hand-rolling a partial copy of it.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../state.js', () => ({ get G(): unknown { return (globalThis as any).G; }, lang: 'en' }));
vi.mock('../utils.js', () => ({ rng: () => 0, dst: () => 1 }));
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../effects.js', () => ({ flt: () => {}, shake: () => {} }));
vi.mock('../fx.js', () => ({ fxFlash: () => {}, fxBolt: () => {}, fxBeam: () => {}, fxBurst: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: () => {} }));
vi.mock('../combat.js', () => ({
  recalc: () => {}, killEnemy: () => {}, checkLevelUp: () => {}, checkAch: () => {}, checkAchs: () => {},
  playerVictory: () => {}, applyCorruption: () => {}, grantKillRewards: vi.fn(),
  getElementSymbol: (el: string) => el,   // ③ skills.ts imports it for Elemental Storm flt text
}));
vi.mock('../config.js', () => ({ FINAL: 40 }));
vi.mock('../data.js', () => ({ CLASSES: [] }));
vi.mock('../meta.js', () => ({ bonusGold: (g: number) => g, bonusExp: (e: number) => e }));
vi.mock('../talents.js', () => ({ getSkillModifiers: vi.fn(() => ({})), onPlayerKill: () => {}, getSpellPenMult: vi.fn(() => 1) }));
vi.mock('../relics.js', () => ({ grantRandomRelic: () => {}, relicOnKill: () => {} }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tMsg: (k: string, ...a: string[]) => a.reduce((s: string, x) => s.replace('{}', x), k), tx: (f: { en?: string }) => (f && f.en) || '' }));

import { processAoeKills, executeSkill } from '../skills.js';
import { grantKillRewards } from '../combat.js';
import { getSkillModifiers } from '../talents.js';
import type { Enemy } from '../types.js';

function mkEnemy(over: Partial<Enemy> = {}): Enemy {
  return { name: 'Goblin', x: 1, y: 1, hp: 0, maxHp: 10, c: '#0f0', exp: 5, goldDrop: 3, isBoss: false, isElite: false, ...over } as unknown as Enemy;
}

describe('P1 processAoeKills routes through the single reward pipeline', () => {
  beforeEach(() => {
    (globalThis as any).G = {
      player: { kills: 0, streak: 0, bestStreak: 0, bossesKilledThisRun: 0, level: 1, expNext: 999999, achievements: new Set<string>() },
      floor: 5, won: false,
    };
    vi.clearAllMocks();
  });

  it('each AOE kill goes through grantKillRewards (relic mults + warden + boss lore)', () => {
    const e = mkEnemy();
    processAoeKills([e]);
    expect(grantKillRewards).toHaveBeenCalledWith(e);
  });

  it('stops processing once playerVictory fires (F40 Creator killed by AOE)', () => {
    (globalThis as any).G.floor = 40;
    const boss = mkEnemy({ isBoss: true });
    const other = mkEnemy({ name: 'Other' });
    // grantKillRewards is mocked; simulate it calling playerVictory → G.won=true
    (grantKillRewards as any).mockImplementation(() => { (globalThis as any).G.won = true; });
    processAoeKills([boss, other]);
    expect(grantKillRewards).toHaveBeenCalledTimes(1); // broke after the boss
  });
});

describe('③ m_elemental_storm: aoe rides a random element with (1 - res) scaling', () => {
  it('fire-locked roll halves damage vs a fire-resistant foe, matches combat.attack sign', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);   // element idx 0 = fire; no other rolls in this path
    vi.mocked(getSkillModifiers).mockReturnValue({
      dmgMult: 1, forceCrit: false, aoe: false, chainCount: 0, radiusBonus: 0,
      halfCd: false, alsoFear: false, alsoStun: false, alsoHolyDmg: false,
      alsoHeal: false, alsoSlow: false, alsoBlind: false, randomElement: true,
    } as any);
    (globalThis as any).G = {
      floor: 5, won: false,
      player: { x: 0, y: 0, ci: 1, mp: 100, maxMp: 100, skillCd: 0, stunned: 0,
        atk: 10, level: 3, spellPower: 1, exp: 0, gold: 0, kills: 0 },
      enemies: [
        { name: 'Neutral', x: 1, y: 0, hp: 100, maxHp: 100, isAlly: false, res: {} },
        { name: 'FireWard', x: 0, y: 1, hp: 100, maxHp: 100, isAlly: false, res: { fire: 0.5 } },
      ],
    };
    executeSkill({ cost: 5, effect: 'aoe', cd: 3 });
    // base = (10 + 3*3) * 1 * 1 * 1 = 19; res .5 -> floor(19*.5) = 9
    expect((globalThis as any).G.enemies[0].hp).toBe(81);
    expect((globalThis as any).G.enemies[1].hp).toBe(91);
    spy.mockRestore();
  });
});
