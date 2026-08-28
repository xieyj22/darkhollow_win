import { describe, it, expect } from 'vitest';
import { TEMPLATES, THEME_PAL } from '../sprites.js';

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
