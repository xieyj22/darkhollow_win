// Characterization tests for the item-generation functions (Playtest Polish-B Q6).
// Written BEFORE the gen* functions are moved to item-gen.ts; the same assertions
// must pass after the move (import flipped to '../item-gen.js') — proving the
// relocation preserved behavior.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../state.js', () => ({ G: { floor: 5 }, lang: 'en' }));
vi.mock('../utils.js', () => ({ rng: () => 0, pick: <T>(a: T[]) => a[0], dst: () => 1 }));
vi.mock('../combat.js', () => ({ recalc: () => {}, checkLevelUp: () => {}, killEnemy: () => {}, applyCorruption: () => {}, playerDeath: () => {} }));
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../effects.js', () => ({ flt: () => {} }));
vi.mock('../fx.js', () => ({ fxBeam: () => {}, fxBolt: () => {}, fxBurst: () => {}, fxFlash: () => {}, fxAura: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: () => {} }));

import { genItem, genWeapon, genArmor, genAcc, genPotion, genScroll, genFood, genConsumable, isGear, isConsumable } from '../items.js';

describe('isGear / isConsumable', () => {
  it('classifies by type', () => {
    expect(isGear({ type: 'weapon' } as any)).toBe(true);
    expect(isGear({ type: 'armor' } as any)).toBe(true);
    expect(isGear({ type: 'accessory' } as any)).toBe(true);
    expect(isGear({ type: 'potion' } as any)).toBe(false);
    expect(isConsumable({ type: 'scroll' } as any)).toBe(true);
    expect(isConsumable({ type: 'consumable' } as any)).toBe(true);
    expect(isConsumable({ type: 'potion' } as any)).toBe(true);
    expect(isConsumable({ type: 'weapon' } as any)).toBe(false);
  });
});

// gen* with rng→0 + pick→first: assert a valid Item of the right type with sane
// stats. These invariants must hold identically after the move to item-gen.ts.
describe('gen* produce valid items', () => {
  it('genWeapon', () => {
    const w = genWeapon(5);
    expect(w.type).toBe('weapon');
    expect(w.atk).toBeGreaterThanOrEqual(0);
    expect(w.rarity).toBeGreaterThanOrEqual(0);
    expect(typeof w.name).toBe('string');
    expect(typeof w.ch).toBe('string');
    expect(w.x).toBe(0);
    expect(w.y).toBe(0);
  });
  it('genArmor', () => {
    const a = genArmor(5);
    expect(a.type).toBe('armor');
    expect(a.def).toBeGreaterThanOrEqual(0);
    expect(a.x).toBe(0);
  });
  it('genAcc', () => {
    const a = genAcc(5);
    expect(a.type).toBe('accessory');
    expect(a.rarity).toBeGreaterThanOrEqual(0);
  });
  it('genPotion', () => {
    const p = genPotion(5);
    expect(p.type).toBe('potion');
    expect(p.val).toBeGreaterThanOrEqual(0);
    expect(p.rarity).toBe(0);
  });
  it('genScroll', () => {
    const s = genScroll(5);
    expect(s.type).toBe('scroll');
    expect(s.val).toBeGreaterThanOrEqual(0);
    expect(s.rarity).toBe(1);
  });
  it('genFood', () => {
    const f = genFood(5);
    expect(f.type).toBe('food');
    expect(f.val).toBeGreaterThanOrEqual(0);
  });
  it('genConsumable', () => {
    const c = genConsumable(5);
    expect(c.type).toBe('consumable');
    expect(['bomb', 'throw_knife', 'torch', 'bear_trap', 'smoke_bomb', 'ward', 'haste', 'antidote', 'holy_water', 'recall', 'invis', 'purify']).toContain(c.ef);
  });
  it('genItem returns a valid type', () => {
    const it = genItem(5);
    expect(['weapon', 'armor', 'accessory', 'potion', 'scroll', 'food', 'consumable']).toContain(it.type);
  });
});
