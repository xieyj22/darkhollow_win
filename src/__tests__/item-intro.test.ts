import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../data.js', () => ({ META_UPGRADES: [], ACH_DEFS: [], RELICS: [] }));
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../state.js', () => ({ lang: 'en' }));

import { initMeta, getMeta, discoverItem } from '../meta.js';

beforeEach(() => localStorage.clear());

describe('discoverItem', () => {
  it('returns true on first discovery and persists', () => {
    expect(discoverItem('weapon:iron_sword')).toBe(true);
    expect(getMeta().discoveredItems).toContain('weapon:iron_sword');
  });
  it('returns false on repeat (idempotent, no dup)', () => {
    expect(discoverItem('relic:war_totem')).toBe(true);
    expect(discoverItem('relic:war_totem')).toBe(false);
    expect(getMeta().discoveredItems.filter(k => k === 'relic:war_totem')).toHaveLength(1);
  });
  it('old meta without discoveredItems migrates to []', () => {
    localStorage.setItem('dh_meta', JSON.stringify({
      version: 1, soulEchoes: 0, totalSpent: 0, upgrades: {}, achievements: [],
      stats: {}, runHistory: [], endlessLeaderboard: [], unlockedLore: [], wardens: [],
    }));
    expect(getMeta().discoveredItems).toEqual([]);
  });
  it('initMeta seeds discoveredItems as []', () => {
    expect(initMeta().discoveredItems).toEqual([]);
  });
});
