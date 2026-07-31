import { describe, it, expect } from 'vitest';
import { computeFOV } from '../dungeon.js';
import { MH, MW, TL } from '../config.js';

const px = Math.floor(MW / 2), py = Math.floor(MH / 2), rad = 6;
function openMap(): number[][] {
  return Array.from({ length: MH }, () => Array(MW).fill(TL.FLOOR));
}

describe('computeFOV (characterization)', () => {
  it('origin always visible; no visible cell beyond radius', () => {
    const v = computeFOV(openMap(), px, py, rad);
    expect(v[py][px]).toBe(true);
    for (let y = 0; y < MH; y++)
      for (let x = 0; x < MW; x++)
        if (v[y][x]) expect(Math.hypot(x - px, y - py)).toBeLessThanOrEqual(rad + 0.5);
  });

  it('open map: all cells within rad-1 are visible (dense ray coverage)', () => {
    const v = computeFOV(openMap(), px, py, rad);
    for (let y = 0; y < MH; y++)
      for (let x = 0; x < MW; x++)
        if (Math.hypot(x - px, y - py) <= rad - 1) expect(v[y][x]).toBe(true);
  });

  it('marks explored exactly for the visible set when explored grid passed', () => {
    const explored = Array.from({ length: MH }, () => Array<boolean>(MW).fill(false));
    const v = computeFOV(openMap(), px, py, rad, explored);
    for (let y = 0; y < MH; y++)
      for (let x = 0; x < MW; x++)
        expect(explored[y][x]).toBe(v[y][x]);
  });
});
