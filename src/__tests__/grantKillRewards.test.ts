import { describe, it, expect, vi, beforeEach } from 'vitest';

// combat.ts reads `G` via its imported binding from state.js (a `let`), NOT
// globalThis.G. Expose a getter so combat.ts sees whatever we assign to
// globalThis.G in beforeEach.
vi.mock('../state.js', () => ({
  get G(): unknown { return (globalThis as { G?: unknown }).G; },
  lang: 'en',
}));

vi.mock('../config.js', () => ({ FINAL: 40 }));
vi.mock('../utils.js', () => ({ rng: () => 0, dst: () => 1 }));

vi.mock('../audio.js', () => ({ snd: () => {}, setBgmScene: () => {} }));
vi.mock('../effects.js', () => ({ flt: () => {}, shake: () => {} }));
vi.mock('../fx.js', () => ({ fxFlash: () => {}, fxBurst: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: () => {} }));
vi.mock('../enemies.js', () => ({ processBossPhase: () => {} }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k }));
vi.mock('../data.js', () => ({ ACH_DEFS: [], EQUIPMENT_SETS: [] }));

// Amplify the multipliers so reward math is easy to assert. Stub the rest of
// what combat.ts imports from these modules (only called outside grantKillRewards).
vi.mock('../meta.js', () => ({
  bonusExp: (e: number) => e * 2,
  bonusGold: (g: number) => g * 3,
  getMeta: () => ({ upgrades: {}, stats: {} }),
  persistAchievement: () => {},
  calculateSoulEchoes: () => ({ total: 0 }),
  updateRunStats: () => {},
  renderEchoBreakdown: () => {},
  creditSoulEchoes: () => {},
  recordRun: () => {},
}));
vi.mock('../relics.js', () => ({
  getRelicExpMult: () => 1.5,
  getRelicGoldMult: () => 2,
  relicOnKill: () => {},
  grantRandomRelic: () => {},
  relicOnHitEnemy: (_d: number) => _d,
  relicOnDamaged: () => {},
  relicOnDeath: () => false,
  relicOnDodge: () => {},
  relicOnCrit: () => {},
  applyRelicBonuses: () => {},
}));
vi.mock('../talents.js', () => ({
  onPlayerKill: () => {},
  onPlayerHitEnemy: (_d: number) => _d,
  onPlayerDodged: () => {},
  onPlayerDamaged: () => false,
  onPlayerDeath: () => false,
  onEnemyHitPlayer: () => {},
  checkDoubleStrike: () => false,
  getCritMultiplier: () => 2,
  getManaShieldReduction: () => 0,
  applyTalentBonuses: () => {},
}));
// steam.ts exports unlockAchievement (not checkAch — that's combat-internal).
vi.mock('../steam.js', () => ({ unlockAchievement: () => {} }));

import { grantKillRewards } from '../combat.js';
import type { Enemy } from '../types.js';

function fixtureEnemy(over: Partial<Enemy> = {}): Enemy {
  return {
    name: 'Goblin', ch: 'g', c: '#0f0', x: 1, y: 1, hp: 0, maxHp: 10, atk: 3, def: 1,
    exp: 8, goldDrop: 5, ai: 'chase', stunned: 0, feared: 0, isAlly: false,
    el: 'none', res: {}, skillCd: 0, ...over,
  } as Enemy;
}

function fixtureG(): any {
  return {
    player: {
      exp: 0, gold: 0, kills: 0, streak: 0, bestStreak: 0,
      bossesKilledThisRun: 0, level: 1, expNext: 999999, ci: 0,
      achievements: new Set<string>(),
    },
    enemies: [], floor: 1, branchMode: false, endless: false,
  };
}

describe('grantKillRewards', () => {
  beforeEach(() => { (globalThis as any).G = fixtureG(); });

  it('grants exp/gold with relic mults, increments kills + streak', () => {
    const G = (globalThis as any).G;
    grantKillRewards(fixtureEnemy({ exp: 8, goldDrop: 5 }));
    expect(G.player.exp).toBe(Math.floor(8 * 2 * 1.5));   // bonusExp * relicExp
    expect(G.player.gold).toBe(Math.floor(5 * 3 * 2));    // bonusGold * relicGold
    expect(G.player.kills).toBe(1);
    expect(G.player.streak).toBe(1);
  });

  it('streak bonus at >=3 and tracks bestStreak', () => {
    const G = (globalThis as any).G;
    G.player.streak = 2;
    grantKillRewards(fixtureEnemy({ exp: 8 }));
    expect(G.player.streak).toBe(3);
    expect(G.player.bestStreak).toBe(3);
    // streak bonus = bonusExp(floor(8*0.2*3)) added on top of base reward
    expect(G.player.exp).toBeGreaterThan(Math.floor(8 * 2 * 1.5));
  });

  it('boss kill increments bossesKilledThisRun; non-boss does not', () => {
    const G = (globalThis as any).G;
    grantKillRewards(fixtureEnemy({ isBoss: false }));
    expect(G.player.bossesKilledThisRun).toBe(0);
    grantKillRewards(fixtureEnemy({ isBoss: true }));
    expect(G.player.bossesKilledThisRun).toBe(1);
  });
});
