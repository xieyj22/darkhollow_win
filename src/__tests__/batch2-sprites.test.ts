// 批2 ⑥: new terrain/entity templates + spriteKind routing.
import { describe, it, expect } from 'vitest';
import { TEMPLATES, pickItemTemplate } from '../sprites.js';

describe('batch2 templates', () => {
  it('DOOR/PORTAL/CHEST defined, 16 rows × 16 chars', () => {
    for (const k of ['DOOR', 'PORTAL', 'CHEST']) {
      const tpl = (TEMPLATES as Record<string, string[]>)[k];
      expect(tpl, k).toBeDefined();
      expect(tpl.length, k).toBe(16);
      tpl.forEach((row, i) => expect(row.length, k + ' row ' + i).toBe(16));
    }
  });
  it('spriteKind routes before type switch', () => {
    const r = pickItemTemplate({ type: 'consumable', spriteKind: 'CHEST', name: 'x', rarity: 2 } as any);
    expect(r.key).toBe('CHEST');
  });
  it('unknown spriteKind falls through to normal routing', () => {
    const r = pickItemTemplate({ type: 'gold', spriteKind: 'NOPE', name: 'x', rarity: 0 } as any);
    expect(r.key).toBe('I_GOLD');
  });
});
