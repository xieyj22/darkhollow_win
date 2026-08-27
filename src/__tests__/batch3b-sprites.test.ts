// 批3B: boss/entity sprite 路由地基守卫。
import { describe, it, expect } from 'vitest';
import { TEMPLATES, ENTITY_PAL, pickItemTemplate } from '../sprites.js';
import { makeEnemy } from '../enemy-factory.js';
import { BOSSES } from '../data.js';

describe('batch3b routing foundation', () => {
  it('ENTITY_PAL exported and absorbs CHEST (multi-hue chest palette wired)', () => {
    expect(ENTITY_PAL['CHEST']).toBeDefined();
    expect(ENTITY_PAL['CHEST']['K']).toBe('#140a0a');
    expect(ENTITY_PAL['CHEST']['G']).toBe('#ffd54a');
  });
  it('makeEnemy copies spriteKind from def to instance', () => {
    const bd = BOSSES[0];
    const e = makeEnemy({ ...bd, spriteKind: 'B_PROBE' } as never, 3, 3, 1, { isBoss: true });
    expect(e.spriteKind).toBe('B_PROBE');
  });
  it('makeEnemy without spriteKind leaves instance field undefined', () => {
    const e = makeEnemy({ n: { en: 'X', zh: 'X' }, ch: 'x', c: '#fff', hp: 5, atk: 1, def: 0, exp: 1, g: [1, 2], ai: 'chase', mf: 1 } as never, 1, 1, 1);
    expect(e.spriteKind).toBeUndefined();
  });
});
