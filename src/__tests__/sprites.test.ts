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
