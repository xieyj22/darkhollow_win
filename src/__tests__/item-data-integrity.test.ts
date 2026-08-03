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
