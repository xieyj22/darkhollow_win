// Task 4: verify item-gen functions carry def.id onto the runtime Item.
// Uses the REAL data.js (only audio+state mocked) so ALL_WEAPONS / ALL_POTIONS /
// FOODS are the actual catalog entries (not the empty arrays that
// item-intro.test.ts's top-level data.js mock would substitute).
import { describe, it, expect, vi } from 'vitest';
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../state.js', () => ({ lang: 'en' }));

import { genWeapon, genPotion, genFood } from '../item-gen.js';
import { ALL_WEAPONS, ALL_POTIONS, FOODS } from '../data.js';

describe('item-gen assigns def.id', () => {
  it('genWeapon carries the def id', () => {
    const it = genWeapon(1);
    const def = ALL_WEAPONS.find(w => w.id === it.id);
    expect(def).toBeTruthy();
  });
  it('genPotion carries the def id', () => {
    const it = genPotion(1);
    const def = ALL_POTIONS.find(p => p.id === it.id);
    expect(def).toBeTruthy();
  });
  it('genFood carries the def id', () => {
    const it = genFood(1);
    const def = FOODS.find(f => f.id === it.id);
    expect(def).toBeTruthy();
  });
});
