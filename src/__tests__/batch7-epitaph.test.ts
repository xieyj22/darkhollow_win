// 批7 T1: epitaph — pure module, injectable random source.
import { describe, it, expect, beforeEach } from 'vitest';
import { buildEpitaph, quoteFlavor, type DeathCause } from '../epitaph.js';
import { setLang } from '../state.js';

beforeEach(() => setLang('zh'));

describe('buildEpitaph (pure, injectable rand)', () => {
  it('template carries killer/floor/turns in current lang', () => {
    const e = buildEpitaph('combat', '腐化巨魔', 23, 255, () => 0);
    expect(e.template).toContain('腐化巨魔');
    expect(e.template).toContain('23');
    expect(e.template).toContain('255');
  });
  it('every flavor slot in every class resolves to real text (no undefined/key leak)', () => {
    for (const cause of ['combat','trap','poison','starve','corruption','warden'] as DeathCause[]) {
      for (let i = 0; i < 6; i++) {
        const e = buildEpitaph(cause, 'X', 1, 1, () => i / 6);
        expect(e.flavor).toBeTruthy();
        expect(e.flavor).not.toContain('undefined');
        expect(e.flavor).not.toContain('ep.');
      }
    }
  });
  it('unknown cause falls back to combat lib without throwing', () => {
    expect(() => buildEpitaph('nonsense' as DeathCause, 'X', 1, 1, () => 0)).not.toThrow();
    expect(buildEpitaph('nonsense' as DeathCause, 'X', 1, 1, () => 0).flavor).toBeTruthy();
  });
  it('quoteFlavor per language', () => {
    expect(quoteFlavor('深渊有数')).toBe('「深渊有数」');
    setLang('en');
    expect(quoteFlavor('abyss')).toBe('“abyss”');
  });
});
