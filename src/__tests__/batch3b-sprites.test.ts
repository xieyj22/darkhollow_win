// 批3B: boss/entity sprite 路由地基守卫。
import { describe, it, expect } from 'vitest';
import { TEMPLATES, ENTITY_PAL, BOSS_PAL, pickItemTemplate } from '../sprites.js';
import { makeEnemy } from '../enemy-factory.js';
import { BOSSES } from '../data.js';
import { EVENT_SITES } from '../event-sites.js';

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

describe('batch3b boss templates (real-data gate)', () => {
  it('every BOSSES def has a spriteKind that resolves to template + palette', () => {
    expect(BOSSES.length).toBe(9);
    for (const b of BOSSES) {
      expect(b.spriteKind, b.n.en).toBeDefined();
      expect(TEMPLATES[b.spriteKind!], b.n.en).toBeDefined();
      expect(BOSS_PAL[b.spriteKind!], b.n.en).toBeDefined();
    }
  });
  it('boss templates are pairwise distinct (no shared row arrays)', () => {
    const arrs = BOSSES.map(b => TEMPLATES[b.spriteKind!]);
    expect(new Set(arrs).size).toBe(9);
  });
});

describe('batch3b event-site & merchant entities', () => {
  it('every EVENT_SITES def has spriteKind resolving to template + ENTITY_PAL', () => {
    expect(EVENT_SITES.length).toBe(8);
    for (const s of EVENT_SITES) {
      expect(TEMPLATES[s.spriteKind], s.id).toBeDefined();
      expect(ENTITY_PAL[s.spriteKind], s.id).toBeDefined();
    }
  });
  it('shared-silhouette aliases reference the same rows (altar pair + merchant trio)', () => {
    expect(TEMPLATES['ES_ALTAR_GAMBLER']).toBe(TEMPLATES['ES_ALTAR_CURSED']);
    expect(TEMPLATES['MERCHANT_TREASURE']).toBe(TEMPLATES['MERCHANT']);
    expect(TEMPLATES['MERCHANT_ENDLESS']).toBe(TEMPLATES['MERCHANT']);
  });
  it('merchant trio gets three distinct ENTITY_PAL palettes', () => {
    const ps = ['MERCHANT', 'MERCHANT_TREASURE', 'MERCHANT_ENDLESS'].map(k => JSON.stringify(ENTITY_PAL[k]));
    expect(new Set(ps).size).toBe(3);
  });
});
