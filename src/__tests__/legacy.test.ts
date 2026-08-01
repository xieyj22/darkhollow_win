import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../data.js', () => ({ META_UPGRADES: [], ACH_DEFS: [], RELICS: [] }));
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../state.js', () => ({ lang: 'en' }));

import { recordWardenLegacy, getMeta } from '../meta.js';

beforeEach(() => localStorage.clear());

describe('recordWardenLegacy', () => {
  it('caps at 10, newest first', () => {
    for (let i = 0; i < 12; i++) recordWardenLegacy(`h${i}`, 0, 0, 1 + i);
    const w = getMeta().wardens;
    expect(w).toHaveLength(10);
    expect(w[0].name).toBe('h11'); // newest first
    expect(w[9].name).toBe('h2');  // oldest kept
  });

  it('old meta save without wardens migrates to []', () => {
    localStorage.setItem('dh_meta', JSON.stringify({ version: 1, soulEchoes: 0, totalSpent: 0, upgrades: {}, achievements: [], stats: {}, unlockedLore: [] }));
    expect(getMeta().wardens).toEqual([]);
  });
});
