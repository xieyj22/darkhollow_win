import { describe, it, expect } from 'vitest';
import { TEMPLATES, THEME_PAL, iconPalette } from '../sprites.js';
import { TALENT_TREES, ACH_DEFS, META_UPGRADES } from '../data.js';

describe('batch3c T1: iconPalette routing', () => {
  it('falls back to buildPalette(color) for unknown/plain kinds', () => {
    const pal = iconPalette('T_SWORD', '#aa3311');
    expect(pal.M).toBe('#aa3311');
    expect(pal.K).toBe('#140a0a');
  });
  it('returns THEME_PAL entry for multi-hue themes and STAIR, PLAYER_PAL for classes', () => {
    expect(iconPalette('T_FIRE', '#000000')).toBe(THEME_PAL.T_FIRE);
    expect(iconPalette('T_ICE', '#000000')).toBe(THEME_PAL.T_ICE);
    expect(iconPalette('STAIR', '#000000')).toEqual({ K: '#3a4a5a', C: '#5a6a7a', W: '#9aaab8', L: '#b8c8d8', V: '#7ec8e3' });
    expect(iconPalette('WARRIOR', '#000000')).toBe(iconPalette('MAGE', '#000000'));
  });
});

describe('batch3c T1: theme templates present & single-hue letter discipline', () => {
  const SINGLE = new Set(['M', 'D', 'L', 'E', 'K', 'W', 'C', 'G', 'N', 'V']);
  it('every T_ template is 16x16 (shape guard covers) and single-hue ones only use buildPalette letters', () => {
    for (const [k, rows] of Object.entries(TEMPLATES)) {
      if (!k.startsWith('T_')) continue;
      expect(rows.length, `${k} rows`).toBe(16);
      const multi = THEME_PAL[k] !== undefined;
      const letters = new Set(rows.join('').split(''));
      if (!multi) {
        for (const ch of letters) {
          if (ch === '.') continue;
          expect(SINGLE.has(ch), `${k} uses non-buildPalette letter ${ch} but has no THEME_PAL entry`).toBe(true);
        }
      } else {
        for (const ch of letters) {
          if (ch === '.') continue;
          expect(THEME_PAL[k]![ch] !== undefined, `${k} letter ${ch} unmapped in THEME_PAL`).toBe(true);
        }
      }
    }
  });
});
