// Task 4 (Endless content): rebirth meta upgrade formulas + applyMetaUpgrades endless gate.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../state.js', () => ({
  get G(): unknown { return (globalThis as { G?: unknown }).G; },
  lang: 'en',
}));
vi.mock('../audio.js', () => ({ snd: () => {}, setBgmScene: () => {} }));
vi.mock('../i18n.js', () => ({
  t: (k: string) => k,
  tx: (f: { en?: string } | string) => (typeof f === 'string' ? f : (f && f.en) || ''),
}));

import { endlessLuckMult, corruptionWardMult, applyMetaUpgrades } from '../meta.js';

const setMeta = (upgrades: Record<string, number>) =>
  localStorage.setItem('dh_meta', JSON.stringify({
    version: 1, soulEchoes: 0, totalSpent: 0, upgrades, achievements: [],
    stats: { totalRuns: 0, bestFloor: 0, totalKills: 0, totalBossKills: 0, totalGold: 0, totalTurns: 0, wins: 0, deaths: 0, bestStreak: 0, highestLevel: 0, classesWon: [], bestEndlessFloor: 0 },
    runHistory: [], endlessLeaderboard: [], unlockedLore: [], wardens: [],
  }));

describe('rebirth meta (Task 4)', () => {
  beforeEach(() => { localStorage.clear(); (globalThis as { G?: unknown }).G = {}; });

  it('endlessLuckMult = 1 + rank × 0.2', () => {
    setMeta({});
    expect(endlessLuckMult()).toBe(1);
    setMeta({ endless_luck: 5 });
    expect(endlessLuckMult()).toBeCloseTo(2);
  });

  it('corruptionWardMult = 1 - rank × 0.15', () => {
    setMeta({});
    expect(corruptionWardMult()).toBe(1);
    setMeta({ corruption_ward: 5 });
    expect(corruptionWardMult()).toBeCloseTo(0.25);
  });

  it('applyMetaUpgrades: void_resist + endless_might apply ONLY in endless runs', () => {
    setMeta({ void_resist: 3, endless_might: 2 });
    const mkP = () => ({ elRes: {} as Record<string, number>, atk: 10, baseAtk: 10, spellPower: 1, baseSpellPower: 1 }) as any;
    // normal mode: NOT applied (endless is now an explicit param, not read from G)
    const p1 = mkP(); applyMetaUpgrades(p1, false);
    expect(p1.elRes.fire).toBeUndefined();
    expect(p1.atk).toBe(10);
    // endless mode: applied
    const p2 = mkP(); applyMetaUpgrades(p2, true);
    expect(p2.elRes.fire).toBeCloseTo(0.3); // 3 ranks × 0.10
    expect(p2.atk).toBe(11); // 10 + floor(10 × 2 × 0.05) = 11
  });
});
