import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../state.js', () => ({ get G() { return (globalThis as any).G; }, lang: 'en' }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tx: (f: any) => f?.en ?? '' }));
vi.mock('../data.js', () => ({ META_UPGRADES: [], ACH_DEFS: [], RELICS: [], TALENT_TREES: [] }));
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: () => {} }));

import { TEMPLATES, THEME_PAL } from '../sprites.js';
import { renderForge } from '../meta.js';

// Batch3d T1: two new single-hue templates. They must live on the
// buildPalette(color) path (NOT in THEME_PAL) so the emitter's hue
// argument actually drives the tint — that is what lets the forge tab
// bar give each tab its own color identity.
describe('batch3d T1: T_INFINITY & T_KEY templates', () => {
  const KINDS = ['T_INFINITY', 'T_KEY'] as const;
  it('both templates exist, 16x16, outside THEME_PAL (hue param must drive color)', () => {
    for (const k of KINDS) {
      expect(TEMPLATES[k], `${k} missing from TEMPLATES`).toBeTruthy();
      expect(TEMPLATES[k]!.length, `${k} row count`).toBe(16);
      expect(TEMPLATES[k]!.every(r => r.length === 16), `${k} not 16 wide`).toBe(true);
      expect(THEME_PAL[k], `${k} must NOT be in THEME_PAL — single-hue path is load-bearing for tab hues`).toBeUndefined();
    }
  });
  it('both templates carry enough ink to be visible and are distinct shapes', () => {
    const ink = (rows: string[]) => rows.join('').split('').filter(c => c !== '.').length;
    for (const k of KINDS) {
      expect(ink(TEMPLATES[k]!), `${k} too sparse (<20 opaque px)`).toBeGreaterThanOrEqual(20);
    }
    expect(TEMPLATES.T_INFINITY).not.toEqual(TEMPLATES.T_KEY);
  });
});

beforeEach(() => {
  document.body.innerHTML = '<div id="forge-se-count"></div><div id="forge-tabs"></div><div id="forge-content"></div>';
  localStorage.clear();
  localStorage.setItem('dh_meta', JSON.stringify({
    version: 1, soulEchoes: 0, totalSpent: 0, upgrades: {}, achievements: [],
    stats: {}, runHistory: [], endlessLeaderboard: [], unlockedLore: [],
    discoveredItems: [], seenMechanics: [], wardens: [],
  }));
});

// Batch3d T2: the forge tab bar keeps its label text (focus/gamepad nav reads
// it) but the five legacy emoji become painted canvases, one per category.
describe('batch3d T2: forge tab bar sprites', () => {
  it('renders 5 tab canvases with the mapped kinds, distinct hues, and no legacy emoji', () => {
    renderForge();
    const tabs = document.querySelectorAll('#forge-tabs .forge-tab');
    expect(tabs.length).toBe(5);
    const canvases = [...document.querySelectorAll('#forge-tabs canvas.ft-ic')] as HTMLCanvasElement[];
    expect(canvases.map(c => c.dataset.kind)).toEqual(['T_SWORD', 'T_HEART', 'T_STAR', 'T_RUNE', 'T_INFINITY']);
    const hues = canvases.map(c => (c.dataset.color || '').toLowerCase());
    expect(new Set(hues).size).toBe(5); // five distinct tab identities
    const html = document.getElementById('forge-tabs')!.innerHTML;
    for (const e of ['⚔', '❤', '🌟', '🔧', '♾']) {
      expect(html.includes(e), `legacy emoji ${e} still in forge tabs`).toBe(false);
    }
    expect(tabs[0].textContent).toContain('mt.catStats'); // label survives for nav
  });
});
