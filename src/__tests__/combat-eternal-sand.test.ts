// P0-4b regression: eternal_sand relic ("corruption -50%") used Math.ceil(n/2),
// which for the n=1 sources every accrual site uses always rounds back to 1 —
// same dead-upgrade bug as corruption_ward. Isolate eternal_sand by turning the
// ward OFF (mult=1) so only the relic branch acts.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../state.js', () => ({ get G(): unknown { return (globalThis as any).G; }, lang: 'en' }));
vi.mock('../config.js', () => ({ FINAL: 40 }));
vi.mock('../utils.js', () => ({ rng: () => 0, dst: () => 1 }));
vi.mock('../audio.js', () => ({ snd: () => {}, setBgmScene: () => {} }));
vi.mock('../effects.js', () => ({ flt: () => {}, shake: () => {} }));
vi.mock('../fx.js', () => ({ fxFlash: () => {}, fxBurst: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: () => {} }));
vi.mock('../enemies.js', () => ({ processBossPhase: () => {} }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tMsg: (k: string, ...a: string[]) => a.reduce((s: string, x) => s.replace('{}', x), k), tx: (f: { en?: string }) => (f && f.en) || '' }));
vi.mock('../data.js', () => ({ ACH_DEFS: [], EQUIPMENT_SETS: [] }));
vi.mock('../meta.js', () => ({
  bonusExp: (e: number) => e, bonusGold: (g: number) => g,
  getMeta: () => ({ upgrades: {}, stats: {}, unlockedLore: [] }),
  persistAchievement: () => {}, calculateSoulEchoes: () => ({ total: 0 }),
  updateRunStats: () => {}, renderEchoBreakdown: () => {}, creditSoulEchoes: () => {},
  recordRun: () => {}, unlockLore: () => {}, recordWardenLegacy: () => {},
  corruptionWardMult: () => 1, // ward OFF — isolate the eternal_sand branch
}));
vi.mock('../warden.js', () => ({ pickWardenRelic: () => null, nextWardenMemory: () => null, wardenMemoryText: () => null, WARDEN_MEMORIES: [] }));
vi.mock('../relics.js', () => ({
  getRelicExpMult: () => 1, getRelicGoldMult: () => 1, relicOnKill: () => {},
  grantRandomRelic: () => {}, grantRelic: () => {}, relicOnHitEnemy: (d: number) => d,
  relicOnDamaged: () => {}, relicOnDeath: () => false, relicOnDodge: () => {}, relicOnCrit: () => {},
  hasRelic: (id: string) => id === 'eternal_sand', // eternal_sand ON
  applyRelicBonuses: () => {},
}));
vi.mock('../talents.js', () => ({
  onPlayerKill: () => {}, onPlayerHitEnemy: (d: number) => d, onPlayerDodged: () => {},
  onPlayerDamaged: () => false, onPlayerDeath: () => false, onEnemyHitPlayer: () => {},
  checkDoubleStrike: () => false, getCritMultiplier: () => 2, getManaShieldReduction: () => 0,
  applyTalentBonuses: () => {},
}));
vi.mock('../steam.js', () => ({ unlockAchievement: () => {} }));
vi.mock('../item-gen.js', () => ({ genEndlessGear: () => ({}), endlessLuckMult: () => 1 }));
vi.mock('../endings.js', () => ({ ENDINGS: {}, endingForChoice: () => 'pyrrhic', canRefuse: () => true }));

import { applyCorruption } from '../combat.js';

describe('P0-4b eternal_sand negates +1 sources', () => {
  beforeEach(() => {
    (globalThis as any).G = { player: { corruption: 10 } };
    vi.clearAllMocks();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('eternal_sand + random 0 → a +1 source is halved to 0 (not ceil\'d back to 1)', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    applyCorruption(1);
    expect((globalThis as any).G.player.corruption).toBe(10); // n reduced to 0 by the relic
    spy.mockRestore();
  });
});
