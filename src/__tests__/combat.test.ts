// P0 regression tests for combat.ts (playerDeath idempotency / corruption_ward
// gate / playerVictory save clear). Mock setup mirrors grantKillRewards.test.ts.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../state.js', () => ({
  get G(): unknown { return (globalThis as { G?: unknown }).G; },
  lang: 'en',
  setGameState: () => {},
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
vi.mock('../meta.js', () => ({
  bonusExp: (e: number) => e,
  bonusGold: (g: number) => g,
  getMeta: () => ({ upgrades: {}, stats: { bestEndlessFloor: 0 } }),
  persistAchievement: () => {},
  calculateSoulEchoes: () => ({ total: 10 }),
  updateRunStats: () => {},
  renderEchoBreakdown: () => {},
  creditSoulEchoes: vi.fn(),
  recordRun: () => {},
  unlockLore: () => {},
  recordWardenLegacy: () => {},
  corruptionWardMult: () => 0.5,
}));
vi.mock('../warden.js', () => ({
  pickWardenRelic: () => null,
  nextWardenMemory: () => null,
  wardenMemoryText: () => ({ en: 'm', zh: '忆' }),
}));
vi.mock('../relics.js', () => ({
  getRelicExpMult: () => 1,
  getRelicGoldMult: () => 1,
  relicOnKill: () => {},
  grantRandomRelic: () => {},
  grantRelic: () => {},
  relicOnHitEnemy: (d: number) => d,
  relicOnDamaged: () => {},
  relicOnDeath: () => false,
  relicOnDodge: () => {},
  relicOnCrit: () => {},
  hasRelic: () => false,
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
vi.mock('../item-gen.js', () => ({ genEndlessGear: () => ({}), endlessLuckMult: () => 1 }));
vi.mock('../endings.js', () => ({
  ENDINGS: {},
  endingForChoice: () => 'pyrrhic',
  canRefuse: () => true,
}));
// corruption.js stays REAL (pure module) so applyCorruption's addCorruption call mutates.

import { playerDeath, playerVictory, applyCorruption } from '../combat.js';
import { creditSoulEchoes } from '../meta.js';

function fixtureG(): any {
  return {
    player: {
      exp: 0, gold: 0, kills: 5, streak: 0, bestStreak: 3,
      bossesKilledThisRun: 0, level: 5, expNext: 999999, ci: 0, ri: 0,
      achievements: new Set<string>(), corruption: 10,
      hp: 10, maxHp: 10, atk: 5, def: 1, turns: 50, raceName: 'R', clsName: 'C',
      x: 1, y: 1,
    },
    enemies: [], floor: 5, branchMode: false, endless: false,
    gameOver: false, won: false,
  };
}

const DOM_HTML = `
  <div id="death-screen"></div><div id="death-stats"></div>
  <div id="ending-title"></div><div id="ending-desc"></div>
  <button id="btn-ending-refuse"></button><div id="ending-choice"></div>
  <div id="victory-screen"></div><div id="vic-stats"></div>
  <div id="vic-ending"></div><div id="death-echoes"></div><div id="vic-echoes"></div>
`;

describe('P0-3 playerDeath idempotent', () => {
  beforeEach(() => {
    (globalThis as any).G = fixtureG();
    document.body.innerHTML = DOM_HTML;
    vi.clearAllMocks();
    localStorage.clear();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('does not double-credit soul echoes when called twice (wardenDeath + fatal hit)', () => {
    playerDeath('Shadow');
    playerDeath('Shadow'); // gameOver already true — must short-circuit
    expect(creditSoulEchoes).toHaveBeenCalledTimes(1);
  });
});

describe('P0-4 corruption_ward negates +1 sources', () => {
  beforeEach(() => {
    (globalThis as any).G = fixtureG();
    vi.clearAllMocks();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('wardMult 0.5 + random 0 → a +1 source is negated (not ceil\'d back up to 1)', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const G = (globalThis as any).G;
    G.player.corruption = 10;
    applyCorruption(1);
    expect(G.player.corruption).toBe(10); // n reduced to 0 by the ward
    spy.mockRestore();
  });
});

describe('P0-5 playerVictory clears run save immediately', () => {
  beforeEach(() => {
    (globalThis as any).G = fixtureG();
    document.body.innerHTML = DOM_HTML;
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('removes dh_save during playerVictory (not deferred to resolveEnding)', () => {
    localStorage.setItem('dh_save', JSON.stringify({ floor: 40 }));
    playerVictory();
    expect(localStorage.getItem('dh_save')).toBeNull();
  });
});
