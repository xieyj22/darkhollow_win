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
}));
vi.mock('../config.js', () => ({ FINAL: 40 }));
vi.mock('../data.js', () => ({ CLASSES: [] }));
vi.mock('../meta.js', () => ({ bonusGold: (g: number) => g, bonusExp: (e: number) => e }));
vi.mock('../talents.js', () => ({ getSkillModifiers: () => ({}), onPlayerKill: () => {}, getSpellPenMult: () => 0 }));
vi.mock('../relics.js', () => ({ grantRandomRelic: () => {}, relicOnKill: () => {} }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tMsg: (k: string, ...a: string[]) => a.reduce((s: string, x) => s.replace('{}', x), k), tx: (f: { en?: string }) => (f && f.en) || '' }));

import { processAoeKills } from '../skills.js';
import { grantKillRewards } from '../combat.js';
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
