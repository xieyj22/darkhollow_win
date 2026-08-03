import { describe, it, expect, vi } from 'vitest';
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../state.js', () => ({ lang: 'en' }));

import { rarityTint } from '../sprites.js';

describe('rarityTint', () => {
  it('rarity 5 (endless) returns void purple', () => {
    expect(rarityTint('#f4845f', 5)).toBe('#9b5de5');
  });
  it('higher rarity → lighter (more luminance)', () => {
    const r0 = rarityTint('#f4845f', 0);
    const r4 = rarityTint('#f4845f', 4);
    // r4 should be lighter than r0 (parse rgb, compare sum)
    const lum = (s: string) => { const m = s.match(/\d+/g)!; return +m[0] + +m[1] + +m[2]; };
    expect(lum(r4)).toBeGreaterThan(lum(r0));
  });
  it('deterministic (same input → same output)', () => {
    expect(rarityTint('#06d6a0', 3)).toBe(rarityTint('#06d6a0', 3));
  });
  it('preserves hue family roughly (weapon stays warm)', () => {
    // r-channel dominant over b-channel for the warm weapon base.
    // Parse either `#rrggbb` or `rgb(r,g,b)` so the assertion holds at any
    // rarity (rarity 2 returns the hex base unchanged; others return rgb()).
    const chan = (s: string): [number, number, number] => {
      if (s.startsWith('#')) {
        const h = s.slice(1);
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
      }
      const m = s.match(/\d+/g)!;
      return [+m[0], +m[1], +m[2]];
    };
    const [r, , b] = chan(rarityTint('#f4845f', 2));
    expect(r).toBeGreaterThan(b);
  });
});
