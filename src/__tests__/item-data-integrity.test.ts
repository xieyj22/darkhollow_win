import { describe, it, expect, vi } from 'vitest';
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../state.js', () => ({ lang: 'en' }));

import {
  ALL_WEAPONS, ALL_ARMORS, ALL_ACCESSORIES, ALL_POTIONS, ALL_SCROLLS,
  ALL_CONSUMABLES, FOODS, ENDLESS_GEAR, RELICS,
} from '../data.js';

describe('catalog id + flavor integrity', () => {
  it('every catalog entry has a non-empty unique id', () => {
    const tables: Record<string, { id?: string }[]> = {
      weapon: ALL_WEAPONS, armor: ALL_ARMORS, accessory: ALL_ACCESSORIES,
      potion: ALL_POTIONS, scroll: ALL_SCROLLS, consumable: ALL_CONSUMABLES,
      food: FOODS,
    };
    for (const [_, arr] of Object.entries(tables)) {
      for (const d of arr) expect(d.id, `${_} missing id`).toBeTruthy();
    }
    // endless gear + relics
    for (const d of [...ENDLESS_GEAR.weapons, ...ENDLESS_GEAR.armors, ...ENDLESS_GEAR.accessories])
      expect(d.id).toBeTruthy();
    for (const r of RELICS) expect(r.id).toBeTruthy(); // relics already have id
    // global uniqueness across ALL catalog ids + relics (128 total)
    const ids = [
      ...Object.values(tables).flat().map(d => d.id),
      ...[...ENDLESS_GEAR.weapons, ...ENDLESS_GEAR.armors, ...ENDLESS_GEAR.accessories].map(d => d.id),
      ...RELICS.map(r => r.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('every catalog entry + relic has bilingual non-empty flavor', () => {
    const tables: { flavor?: { en: string; zh: string } }[][] = [
      ALL_WEAPONS, ALL_ARMORS, ALL_ACCESSORIES, ALL_POTIONS, ALL_SCROLLS, ALL_CONSUMABLES, FOODS,
      [...ENDLESS_GEAR.weapons, ...ENDLESS_GEAR.armors, ...ENDLESS_GEAR.accessories],
    ];
    for (const arr of tables) for (const d of arr) {
      expect(d.flavor, 'missing flavor').toBeDefined();
      expect(typeof d.flavor!.en).toBe('string');
      expect(d.flavor!.en.length).toBeGreaterThan(0);
      expect(typeof d.flavor!.zh).toBe('string');
      expect(d.flavor!.zh.length).toBeGreaterThan(0);
    }
    for (const r of RELICS) {
      expect(r.flavor, 'relic missing flavor').toBeDefined();
      expect(r.flavor!.en.length).toBeGreaterThan(0);
      expect(r.flavor!.zh.length).toBeGreaterThan(0);
    }
  });
});

describe('catalog subType integrity', () => {
  const VALID: Record<string, string[]> = {
    armor: ['plate', 'leather', 'cloak', 'robe', 'scale'],
    accessory: ['ring', 'amulet', 'brooch', 'crown'],
    scroll: ['fire', 'frost', 'arcane', 'holy', 'nature'],
    consumable: ['bomb', 'trap', 'pouch', 'tool'],
    food: ['meat', 'bread', 'fruit', 'feast'],
  };
  it('every armor/accessory/scroll/consumable/food has a valid subType', () => {
    const tables: [string, { subType?: string }[]][] = [
      ['armor', ALL_ARMORS], ['accessory', ALL_ACCESSORIES], ['scroll', ALL_SCROLLS],
      ['consumable', ALL_CONSUMABLES], ['food', FOODS],
    ];
    for (const [t, arr] of tables) for (const d of arr) {
      expect(d.subType, `${t} missing subType`).toBeTruthy();
      expect(VALID[t], `${t} invalid subType ${d.subType}`).toContain(d.subType);
    }
  });
});

describe('relic spriteKind integrity', () => {
  const VALID = ['R_ATTACK', 'R_DEFENSE', 'R_ARCANE', 'R_SOUL', 'R_NATURE', 'R_VOID', 'R_UTILITY'];
  it('every relic has a non-empty spriteKind in the R_* set', () => {
    expect(RELICS.length).toBeGreaterThan(0);
    for (const r of RELICS) {
      expect(r.spriteKind, `relic ${r.id} missing spriteKind`).toBeTruthy();
      expect(VALID, `relic ${r.id} invalid spriteKind ${r.spriteKind}`).toContain(r.spriteKind);
    }
  });
  it('every relic spriteKind resolves to a real TEMPLATES entry', async () => {
    const { TEMPLATES } = await import('../sprites.js');
    const N = 16;
    for (const r of RELICS) {
      const tpl = TEMPLATES[r.spriteKind!];
      expect(tpl, `relic ${r.id} spriteKind ${r.spriteKind} not in TEMPLATES`).toBeDefined();
      expect(tpl.length, `relic ${r.id} template must be ${N} rows`).toBe(N);
      for (const row of tpl) expect(row.length, `relic ${r.id} bad row width`).toBe(N);
    }
  });
});
