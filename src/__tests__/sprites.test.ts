import { describe, it, expect } from 'vitest';
import { TEMPLATES } from '../sprites.js';

// Permanent regression guard: every template must be a 16×16 grid. The dev-time
// console.error check in sprites.ts is weak (runtime-only, easy to miss); this
// asserts it at test time so a malformed template fails CI.
describe('sprite templates', () => {
  it('every template is exactly 16 rows × 16 cols', () => {
    const keys = Object.keys(TEMPLATES);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      const tpl = TEMPLATES[key];
      expect(tpl.length, `${key} must have 16 rows`).toBe(16);
      for (let i = 0; i < tpl.length; i++) {
        expect(tpl[i].length, `${key} row ${i} must be 16 chars`).toBe(16);
      }
    }
  });
});

describe('⑧ icon pixel fixes', () => {
  it('C_BOMB fuse row has no transparent hole', () => {
    expect(TEMPLATES.C_BOMB[3]).toBe('.....DMMMMMK....');    // was ".....DMMMM K...."
  });
  it('I_CROWN upper half is mirror-symmetric (true center fix, not a shift)', () => {
    // idx = line - 784: idx 1..5 = spire + peaks (redrawn), idx 6..10 = bands
    // (already symmetric). Every row must be a palindrome so the crown
    // centers on the same axis (7.5) as its lower bands/gems.
    for (let r = 1; r <= 10; r++) {
      expect(TEMPLATES.I_CROWN[r], `row ${r}`).toBe(TEMPLATES.I_CROWN[r].split('').reverse().join(''));
    }
    expect(TEMPLATES.I_CROWN[3]).toBe('.....KMMMMK.....');   // spire base, even width, center 7.5
  });
});
