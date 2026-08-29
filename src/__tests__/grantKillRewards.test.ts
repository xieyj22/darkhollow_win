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
vi.mock('../i18n.js', () => ({
  t: (k: string) => k,
  tMsg: (k: string, ...a: string[]) => a.reduce((s: string, x) => s.replace('{}', x), k),
  tx: (f: { en?: string }) => (f && f.en) || '',
}));
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
  unlockLore: vi.fn(),
}));
vi.mock('../warden.js', () => ({
  pickWardenRelic: (owned: string[]) => owned.length === 0 ? 'warden_cloak' : null,
  nextWardenMemory: (u: string[]) => u.includes('warden:memory3') ? null : 'warden:memory1',
  wardenMemoryText: () => ({ en: 'mem', zh: '记忆' }),
  // batch2 ④: combat → item-intro → ui-panels → lore reads WARDEN_MEMORIES
  // at module load; provide an empty array so the mock satisfies it.
  WARDEN_MEMORIES: [],
}));
vi.mock('../relics.js', () => ({
  getRelicExpMult: () => 1.5,
  getRelicGoldMult: () => 2,
  relicOnKill: () => {},
  grantRandomRelic: () => {},
  grantRelic: vi.fn(),
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

// 批4: F40-normal kill reaches playerVictory → presentCreatorChoice — keep the
// endings chain mocked like every other combat dependency in this file.
vi.mock('../endings.js', () => ({ canRefuse: () => true, endingForChoice: () => 'slay', ENDINGS: {} }));

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

describe('grantKillRewards — 批4 lore 三连', () => {
  beforeEach(() => {
    (globalThis as any).G = fixtureG();
    (globalThis as any).G.player.relics = [];
    vi.clearAllMocks();
  });

  it('boss lore is main-line only: endless F45 kill writes no boss: id', () => {
    const G = (globalThis as any).G;
    G.endless = true; G.floor = 45;
    grantKillRewards(fixtureEnemy({ isBoss: true }));
    expect(unlockLore).not.toHaveBeenCalledWith('boss:45');
  });

  it('boss lore: branch-mode kill writes no boss:<entry-floor> id', () => {
    const G = (globalThis as any).G;
    G.branchMode = true; G.floor = 10;
    grantKillRewards(fixtureEnemy({ isBoss: true }));
    expect(unlockLore).not.toHaveBeenCalled();
  });

  it('F40 Creator kill unlocks world:creator (endless variant — no victory path)', () => {
    const G = (globalThis as any).G;
    G.endless = true; G.floor = 40;
    grantKillRewards(fixtureEnemy({ isBoss: true }));
    expect(unlockLore).toHaveBeenCalledWith('world:creator');
  });

  it('F40 normal kill unlocks world:creator before playerVictory runs', () => {
    const G = (globalThis as any).G;
    G.floor = 40;
    G.player.corruption = 0;
    // playerVictory → presentCreatorChoice touches these DOM nodes (combat.ts:516-528).
    document.body.innerHTML =
      '<div id="ending-choice"></div><div id="ending-title"></div><div id="ending-desc"></div>' +
      '<button id="btn-ending-refuse"></button>';
    grantKillRewards(fixtureEnemy({ isBoss: true }));
    expect(unlockLore).toHaveBeenCalledWith('world:creator');
    expect(unlockLore).toHaveBeenCalledWith('boss:40');
  });
});
