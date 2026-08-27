// Batch3B T4: dropping all the way back to the clean tier is the cleanse
// payoff — currently the `r.after !== 'clean'` guard gives it ZERO feedback.
// It deserves its own message + green flt + aura (no shake; relief, not
// violence). Skeleton cloned from combat-eternal-sand.test.ts, mocked fns
// swapped to vi.fn() so call args can be asserted.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../state.js', () => ({ get G(): unknown { return (globalThis as any).G; }, lang: 'en' }));
vi.mock('../config.js', () => ({ FINAL: 40 }));
vi.mock('../utils.js', () => ({ rng: () => 0, dst: () => 1 }));
vi.mock('../audio.js', () => ({ snd: () => {}, setBgmScene: () => {} }));
vi.mock('../effects.js', () => ({ flt: vi.fn(), shake: vi.fn() }));
vi.mock('../fx.js', () => ({ fxFlash: vi.fn(), fxBurst: vi.fn(), fxAura: vi.fn() }));
vi.mock('../messages.js', () => ({ addMsg: vi.fn() }));
vi.mock('../enemies.js', () => ({ processBossPhase: () => {} }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tMsg: (k: string, ...a: string[]) => a.reduce((s: string, x) => s.replace('{}', x), k), tx: (f: { en?: string }) => (f && f.en) || '' }));
vi.mock('../data.js', () => ({ ACH_DEFS: [], EQUIPMENT_SETS: [] }));
vi.mock('../meta.js', () => ({
  bonusExp: (e: number) => e, bonusGold: (g: number) => g,
  getMeta: () => ({ upgrades: {}, stats: {}, unlockedLore: [] }),
  persistAchievement: () => {}, calculateSoulEchoes: () => ({ total: 0 }),
  updateRunStats: () => {}, renderEchoBreakdown: () => {}, creditSoulEchoes: () => {},
  recordRun: () => {}, unlockLore: () => {}, recordWardenLegacy: () => {},
  corruptionWardMult: () => 1,
}));
vi.mock('../warden.js', () => ({ pickWardenRelic: () => null, nextWardenMemory: () => null, wardenMemoryText: () => null, WARDEN_MEMORIES: [] }));
vi.mock('../relics.js', () => ({
  getRelicExpMult: () => 1, getRelicGoldMult: () => 1, relicOnKill: () => {},
  grantRandomRelic: () => {}, grantRelic: () => {}, relicOnHitEnemy: (d: number) => d,
  relicOnDamaged: () => {}, relicOnDeath: () => false, relicOnDodge: () => {}, relicOnCrit: () => {},
  hasRelic: () => false,
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
vi.mock('../item-intro.js', () => ({ queueMechanicIntro: vi.fn() }));

import { applyCorruption } from '../combat.js';
import { addMsg } from '../messages.js';
import { flt, shake } from '../effects.js';
import { fxAura } from '../fx.js';
import { queueMechanicIntro } from '../item-intro.js';

const mkP = () => ({
  corruption: 25, x: 5, y: 5,
  baseAtk: 10, baseDef: 5, baseMaxHp: 100,
  baseCritChance: 0.05, baseDodgeChance: 0.05, baseSpellPower: 1,
  eq: { weapon: null, armor: null, accessory: null, accessory2: null },
  buffs: [],
});

describe('批3B: cleanse crossing INTO clean tier gets dedicated feedback', () => {
  beforeEach(() => { (globalThis as any).G = { player: mkP() }; vi.clearAllMocks(); });
  afterEach(() => vi.restoreAllMocks());

  it('touched(25) + applyCorruption(-30) → clean: message + green flt + aura, no shake/intro', () => {
    applyCorruption(-30);
    expect((globalThis as any).G.player.corruption).toBe(0);
    expect(addMsg).toHaveBeenCalledWith('cb.tierClean', 'md');
    expect(flt).toHaveBeenCalledWith(5, 5, 'CLEAN', '#80ed99');
    expect(fxAura).toHaveBeenCalledWith(5, 5, '#80ed99', 1.4);
    expect(shake).not.toHaveBeenCalled();
    expect(queueMechanicIntro).not.toHaveBeenCalled();
  });
});
