import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../state.js', () => ({ get G() { return (globalThis as any).G; }, lang: 'en' }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tx: (f: any) => f?.en ?? '' }));
vi.mock('../data.js', () => ({ META_UPGRADES: [], ACH_DEFS: [], RELICS: [], TALENT_TREES: [] }));
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: () => {} }));

import { TEMPLATES, THEME_PAL } from '../sprites.js';
import { renderForge, renderTitleStats } from '../meta.js';
import { renderKeyHints } from '../ui-panels.js';

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
  document.body.innerHTML = '<div id="forge-se-count"></div><div id="forge-tabs"></div><div id="forge-content"></div><div id="title-stats"></div>';
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

// Batch3d T3: the two ledger-scoped emoji residues outside the three panels.
// Title scope is ONLY the 📋 achievement line — 💀 price tags and the other
// title-stat glyphs are batch-out by design.
describe('batch3d T3: title 📋 -> T_BOOK, keys ⌨ -> T_KEY', () => {
  it('renderTitleStats swaps the achievement-line 📋 for a T_BOOK canvas, other glyph lines untouched', () => {
    renderTitleStats();
    const html = document.getElementById('title-stats')!.innerHTML;
    expect(html.includes('📋'), 'legacy 📋 still in title stats').toBe(false);
    const cv = document.querySelector('#title-stats canvas[data-kind="T_BOOK"]') as HTMLCanvasElement | null;
    expect(cv, 'T_BOOK canvas missing on achv line').toBeTruthy();
    expect((cv!.dataset.color || '').toLowerCase()).toBe('#8a5de5');
    expect(html).toContain('mt.achv'); // stat text survives
    expect(html).toContain('💀');      // price-tag glyphs stay (design)
  });
  it('renderKeyHints swaps the header ⌨ for a T_KEY canvas', () => {
    document.body.innerHTML = '<div id="keys-panel"></div>';
    renderKeyHints();
    const html = document.getElementById('keys-panel')!.innerHTML;
    expect(html.includes('⌨'), 'legacy ⌨ still in keys header').toBe(false);
    const cv = document.querySelector('#keys-panel canvas[data-kind="T_KEY"]') as HTMLCanvasElement | null;
    expect(cv, 'T_KEY canvas missing in keys header').toBeTruthy();
    expect(html).toContain('up.keys'); // header label survives
  });
});

// Batch3d T4: every decorative icon-canvas emission is hidden from AT.
// Two layers: a source-discipline gate over all emit sites (catches sites no
// unit test drives), and a DOM gate proving the attribute survives rendering.
import { readFileSync } from 'node:fs';

describe('batch3d T4: decorative canvases are aria-hidden', () => {
  const SRC_FILES = ['meta.ts', 'ui-panels.ts', 'panels.ts', 'render.ts', 'items.ts', 'item-intro.ts'];
  it('every <canvas ...> emission in source carries aria-hidden="true"', () => {
    for (const f of SRC_FILES) {
      const text = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
      const tags = text.match(/<canvas[^>]*>/g) ?? [];
      expect(tags.length, `${f}: no canvas tags found (file moved?)`).toBeGreaterThan(0);
      for (const tag of tags) {
        expect(tag.includes('aria-hidden="true"'), `${f}: ${tag.slice(0, 70)}… missing aria-hidden`).toBe(true);
      }
    }
  });
  it('driven renders put aria-hidden on every canvas in the DOM', () => {
    document.body.innerHTML = '<div id="forge-se-count"></div><div id="forge-tabs"></div><div id="forge-content"></div><div id="title-stats"></div><div id="keys-panel"></div>';
    renderForge();
    renderTitleStats();
    renderKeyHints();
    const canvases = document.querySelectorAll('canvas');
    expect(canvases.length).toBeGreaterThan(0);
    canvases.forEach(cv => expect(cv.getAttribute('aria-hidden'), 'canvas without aria-hidden in DOM').toBe('true'));
  });
  // 批4 (batch3D M5 defer): the static decorative canvas in index.html. Scoped to
  // the title-particles canvas — game-canvas / minimap-canvas are live viewports,
  // not decorative icons, and are deliberately outside this gate. Read uses the
  // `'…' + name` dynamic form (see batch4-consistency.test.ts) so Vite leaves the
  // URL alone instead of rewriting it to a dev-server http:// path.
  it('index.html decorative canvases (title-particles) carry aria-hidden', () => {
    const f = 'index.html';
    const text = readFileSync(new URL('../../' + f, import.meta.url), 'utf8');
    const tags = text.match(/<canvas[^>]*title-particles[^>]*>/g) ?? [];
    expect(tags.length, 'index.html title-particles canvas (file moved?)').toBeGreaterThan(0);
    for (const tag of tags) {
      expect(tag.includes('aria-hidden="true"'), `${tag.slice(0, 70)}… missing aria-hidden`).toBe(true);
    }
  });
});
