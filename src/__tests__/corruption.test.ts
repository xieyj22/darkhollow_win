import { describe, it, expect } from 'vitest';
import { corruptionTier, corruptionMods, addCorruption, CORRUPTION_MAX } from '../corruption.js';

describe('corruptionTier', () => {
  it('threshold boundaries', () => {
    expect(corruptionTier(0)).toBe('clean');
    expect(corruptionTier(19)).toBe('clean');
    expect(corruptionTier(20)).toBe('touched');
    expect(corruptionTier(49)).toBe('touched');
    expect(corruptionTier(50)).toBe('corrupted');
    expect(corruptionTier(79)).toBe('corrupted');
    expect(corruptionTier(80)).toBe('mutated');
    expect(corruptionTier(99)).toBe('mutated');
    expect(corruptionTier(100)).toBe('warden');
  });
});

describe('corruptionMods', () => {
  it('clean is all-zero (no behavior change for existing runs)', () => {
    expect(corruptionMods(0)).toEqual({ spellPct: 0, critPct: 0, atk: 0, healPct: 0, dmgTakenPct: 0, perTurnHp: 0 });
  });
  it('mutated = biggest spell power + perTurnHp cost + healing penalty', () => {
    const m = corruptionMods(85);
    expect(m.spellPct).toBe(50);
    expect(m.perTurnHp).toBe(1);
    expect(m.healPct).toBe(-20);
  });
  it('monotonic: deeper tiers give >= spell power', () => {
    expect(corruptionMods(30).spellPct).toBeLessThanOrEqual(corruptionMods(60).spellPct);
    expect(corruptionMods(60).spellPct).toBeLessThanOrEqual(corruptionMods(85).spellPct);
  });
});

describe('addCorruption', () => {
  const mk = (c: number) => ({ corruption: c }) as any;
  it('clamps to [0, CORRUPTION_MAX]', () => {
    const p = mk(98);
    addCorruption(p, 10);
    expect(p.corruption).toBe(CORRUPTION_MAX);
    addCorruption(p, -999);
    expect(p.corruption).toBe(0);
  });
  it('detects tier cross + maxed', () => {
    const p = mk(18);
    const r = addCorruption(p, 4);
    expect(r.crossed).toBe(true);
    expect(r.after).toBe('touched');
    expect(r.maxed).toBe(false);
    const p2 = mk(99);
    const r2 = addCorruption(p2, 1);
    expect(r2.maxed).toBe(true);
    expect(p2.corruption).toBe(100);
  });
  it('no cross within same tier', () => {
    expect(addCorruption(mk(30), 5).crossed).toBe(false);
  });
});
