import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../data.js', () => ({ META_UPGRADES: [], ACH_DEFS: [], RELICS: [] }));
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../state.js', () => ({ lang: 'en' }));
// batch2 ④: unlockLore now logs the codex update via messages.addMsg.
vi.mock('../messages.js', () => ({ addMsg: () => {} }));

import { initMeta, getMeta, unlockLore } from '../meta.js';
import { LORE_ENTRIES, LORE_CATS } from '../lore.js';

beforeEach(() => localStorage.clear());

describe('unlockLore', () => {
  it('adds a new id and persists across getMeta()', () => {
    unlockLore('world:descent');
    expect(getMeta().unlockedLore).toContain('world:descent');
  });
  it('dedups (idempotent)', () => {
    unlockLore('area:caves'); unlockLore('area:caves');
    expect(getMeta().unlockedLore.filter(id => id === 'area:caves')).toHaveLength(1);
  });
  it('old meta save without unlockedLore migrates to []', () => {
    localStorage.setItem('dh_meta', JSON.stringify({ version: 1, soulEchoes: 0, totalSpent: 0, upgrades: {}, achievements: [], stats: {} }));
    expect(getMeta().unlockedLore).toEqual([]);
  });
  it('initMeta seeds unlockedLore as []', () => {
    expect(initMeta().unlockedLore).toEqual([]);
  });
});

describe('LORE_ENTRIES', () => {
  it('ids are unique', () => {
    const ids = LORE_ENTRIES.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('every entry has a known cat + bilingual text', () => {
    const cats = new Set(LORE_CATS.map(c => c.id));
    for (const e of LORE_ENTRIES) {
      expect(cats.has(e.cat)).toBe(true);
      expect(typeof e.n.en && typeof e.n.zh && typeof e.body.en && typeof e.body.zh).toBe('string');
    }
  });
  it('contains the default-unlocked world entry + all 10 areas (8 main + fungal/endless ⑤) + 8 bosses', () => {
    const ids = new Set(LORE_ENTRIES.map(e => e.id));
    expect(ids.has('world:descent')).toBe(true);
    expect([...ids].filter(id => id.startsWith('area:')).length).toBe(10);   // ⑤ +area:fungal/area:endless
    expect([...ids].filter(id => id.startsWith('boss:')).length).toBe(8);
  });
});

describe('⑤ area lore covers the fungal branch and the endless zone', () => {
  it('entries exist with real bodies (was: unlockLore targets with no entry)', () => {
    const ids = LORE_ENTRIES.map(e => e.id);
    expect(ids).toContain('area:fungal');
    expect(ids).toContain('area:endless');
    for (const id of ['area:fungal', 'area:endless']) {
      const e = LORE_ENTRIES.find(x => x.id === id)!;
      expect(e.cat).toBe('area');
      expect(e.body.en.length).toBeGreaterThan(40);
      expect(e.body.zh.length).toBeGreaterThan(20);
    }
  });
});
