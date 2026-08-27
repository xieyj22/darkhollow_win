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

// NOTE(plan deviation): the plan/brief counted 86 talent nodes; the shipped
// TALENT_TREES has 4 trees x 16 = 64 (renderTalentPanel draws a 4x4 grid per
// class). Gate asserts the real total so accidental node loss also fails.
describe('batch3c T2: talent real-data gate', () => {
  it('every talent node has tpl in TEMPLATES', () => {
    let n = 0;
    for (const tree of TALENT_TREES) for (const node of tree.nodes) {
      expect(node.tpl, `talent ${node.id} missing tpl`).toBeTruthy();
      expect(TEMPLATES[node.tpl!], `talent ${node.id} tpl ${node.tpl} not in TEMPLATES`).toBeTruthy();
      n++;
    }
    expect(n).toBe(64);
  });
});

// NOTE(plan deviation): the plan/brief counted 31 achievements / 27 meta
// upgrades; the shipped tables have 29 / 22 (same miscount pattern T2 hit on
// the 64-node talent total). Gates assert the real totals so accidental row
// loss also fails.
describe('batch3c T3: achievement + forge real-data gates', () => {
  it('every ACH_DEFS entry has tpl in TEMPLATES', () => {
    expect(ACH_DEFS.length).toBe(29);
    for (const a of ACH_DEFS) {
      expect(a.tpl, `ach ${a.id} missing tpl`).toBeTruthy();
      expect(TEMPLATES[a.tpl!], `ach ${a.id} tpl ${a.tpl} not in TEMPLATES`).toBeTruthy();
    }
  });
  it('every META_UPGRADES entry has tpl in TEMPLATES', () => {
    expect(META_UPGRADES.length).toBe(22);
    for (const m of META_UPGRADES) {
      expect(m.tpl, `meta ${m.id} missing tpl`).toBeTruthy();
      expect(TEMPLATES[m.tpl!], `meta ${m.id} tpl ${m.tpl} not in TEMPLATES`).toBeTruthy();
    }
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
