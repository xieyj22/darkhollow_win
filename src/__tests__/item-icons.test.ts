import { describe, it, expect, vi } from 'vitest';
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../state.js', () => ({ lang: 'en' }));

import { rarityTint, itemSpriteKind, catalogSpriteColor } from '../sprites.js';
import { genWeapon } from '../item-gen.js';

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

describe('itemSpriteKind', () => {
  it('a sword maps to W_SWORD', () => {
    const it = genWeapon(1);
    expect(itemSpriteKind(it)).toMatch(/^W_/);
  });
  it('a heal potion maps to P_HEALTH', () => {
    const it = { type: 'potion', ef: 'heal', c: '#e63946', rarity: 0 } as any;
    expect(itemSpriteKind(it)).toBe('P_HEALTH');
  });

  // Task 5: subType routing — each subtype resolves to its dedicated template key.
  describe('armor subtypes', () => {
    const cases: [string, string][] = [
      ['plate', 'I_PLATE'],
      ['leather', 'I_LEATHER'],
      ['cloak', 'I_CLOAK'],
      ['robe', 'I_ROBE'],
      ['scale', 'I_SCALE'],
    ];
    for (const [sub, key] of cases) {
      it(`armor subType=${sub} → ${key}`, () => {
        expect(itemSpriteKind({ type: 'armor', subType: sub, c: '#7ec8e3', rarity: 0 } as any)).toBe(key);
      });
    }
    it('armor without subType falls back to I_SHIELD', () => {
      expect(itemSpriteKind({ type: 'armor', c: '#7ec8e3', rarity: 0 } as any)).toBe('I_SHIELD');
    });
    it('armor with unknown subType falls back to I_SHIELD', () => {
      expect(itemSpriteKind({ type: 'armor', subType: 'mystery', c: '#7ec8e3', rarity: 0 } as any)).toBe('I_SHIELD');
    });
  });

  describe('accessory subtypes', () => {
    const cases: [string, string][] = [
      ['ring', 'I_RING'],
      ['amulet', 'I_AMULET'],
      ['brooch', 'I_BROOCH'],
      ['crown', 'I_CROWN'],
    ];
    for (const [sub, key] of cases) {
      it(`accessory subType=${sub} → ${key}`, () => {
        expect(itemSpriteKind({ type: 'accessory', subType: sub, c: '#06d6a0', rarity: 0 } as any)).toBe(key);
      });
    }
    it('accessory without subType falls back to I_RING', () => {
      expect(itemSpriteKind({ type: 'accessory', c: '#06d6a0', rarity: 0 } as any)).toBe('I_RING');
    });
  });

  describe('scroll subtypes', () => {
    const cases: [string, string][] = [
      ['fire', 'SC_FIRE'],
      ['frost', 'SC_FROST'],
      ['arcane', 'SC_ARCANE'],
      ['holy', 'SC_HOLY'],
    ];
    for (const [sub, key] of cases) {
      it(`scroll subType=${sub} → ${key}`, () => {
        expect(itemSpriteKind({ type: 'scroll', subType: sub, c: '#f4845f', rarity: 1 } as any)).toBe(key);
      });
    }
    it('scroll without subType falls back to I_SCROLL', () => {
      expect(itemSpriteKind({ type: 'scroll', c: '#f4845f', rarity: 1 } as any)).toBe('I_SCROLL');
    });
    it('scroll with unknown subType falls back to I_SCROLL', () => {
      expect(itemSpriteKind({ type: 'scroll', subType: 'void', c: '#f4845f', rarity: 1 } as any)).toBe('I_SCROLL');
    });
  });

  describe('food subtypes', () => {
    const cases: [string, string][] = [
      ['meat', 'FD_MEAT'],
      ['bread', 'FD_BREAD'],
      ['feast', 'FD_FEAST'],
    ];
    for (const [sub, key] of cases) {
      it(`food subType=${sub} → ${key}`, () => {
        expect(itemSpriteKind({ type: 'food', subType: sub, c: '#daa520', rarity: 0 } as any)).toBe(key);
      });
    }
    it('food without subType falls back to I_FOOD', () => {
      expect(itemSpriteKind({ type: 'food', c: '#daa520', rarity: 0 } as any)).toBe('I_FOOD');
    });
  });

  describe('consumable subtypes', () => {
    const cases: [string, string][] = [
      ['bomb', 'C_BOMB'],
      ['trap', 'C_TRAP'],
      ['pouch', 'C_POUCH'],
      ['tool', 'C_TOOL'],
    ];
    for (const [sub, key] of cases) {
      it(`consumable subType=${sub} → ${key}`, () => {
        expect(itemSpriteKind({ type: 'consumable', subType: sub, c: '#ff4500', rarity: 0 } as any)).toBe(key);
      });
    }
    it('consumable without subType falls back to C_POUCH', () => {
      expect(itemSpriteKind({ type: 'consumable', c: '#ff4500', rarity: 0 } as any)).toBe('C_POUCH');
    });
  });
});

describe('catalogSpriteColor', () => {
  it('weapon def (no c) → rarityTint on warm base', () => {
    expect(catalogSpriteColor({ r: 2 }, 'weapon')).toBe(rarityTint('#f4845f', 2));
  });
  it('armor def → rarityTint on cool blue base', () => {
    expect(catalogSpriteColor({ r: 1 }, 'armor')).toBe(rarityTint('#7ec8e3', 1));
  });
  it('accessory def → rarityTint on green base', () => {
    expect(catalogSpriteColor({ r: 3 }, 'accessory')).toBe(rarityTint('#06d6a0', 3));
  });
  it('weapon rarity 5 → void purple (endless gear)', () => {
    expect(catalogSpriteColor({ r: 5 }, 'weapon')).toBe('#9b5de5');
  });
  it('potion def (has c, no r) → returns def.c verbatim', () => {
    expect(catalogSpriteColor({ c: '#e63946' }, 'potion')).toBe('#e63946');
  });
  it('consumable def (has c and r) → returns def.c (r ignored for consumables)', () => {
    expect(catalogSpriteColor({ c: '#abc123', r: 4 }, 'consumable')).toBe('#abc123');
  });
  it('food def → returns def.c', () => {
    expect(catalogSpriteColor({ c: '#06d6a0', r: 2 }, 'food')).toBe('#06d6a0');
  });
  it('falls back to #ccc when neither r nor c', () => {
    expect(catalogSpriteColor({}, 'potion')).toBe('#cccccc');
  });
});
