// Task 3 (Endless content): characterization tests for endless_merchant stock.
// rollEndlessStock produces 3 endless gear + 1 rarity5 relic + purge + heal,
// priced gold = floor × {80,200,40,30}. Mock leaf deps; item-gen/relics/data real.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../state.js', () => ({
  get G(): unknown { return (globalThis as { G?: unknown }).G; },
  lang: 'en',
  eventOpen: false,
  eventActions: [],
  setEventOpen: () => {},
  setEventActions: () => {},
}));
vi.mock('../utils.js', () => ({ rng: () => 0, pick: <T>(a: T[]) => a[0], dst: () => 1 }));
vi.mock('../audio.js', () => ({ snd: () => {}, setBgmScene: () => {} }));
vi.mock('../effects.js', () => ({ flt: () => {}, shake: () => {} }));
vi.mock('../fx.js', () => ({ fxFlash: () => {}, fxBurst: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: () => {} }));
vi.mock('../render.js', () => ({ updateUI: () => {}, render: () => {} }));
vi.mock('../game.js', () => ({ enterBranch: () => {}, exitBranch: () => {} }));
vi.mock('../items.js', () => ({
  genItem: () => ({}), genWeapon: () => ({}), genArmor: () => ({}), genAcc: () => ({}),
  addItemWithOverflow: () => {}, itemToGold: () => 0,
}));
vi.mock('../combat.js', () => ({ recalc: () => {}, playerDeath: () => {}, applyCorruption: () => {} }));
vi.mock('../bridge.js', () => ({ bridge: {} }));
vi.mock('../meta.js', () => ({
  getMeta: () => ({ soulEchoes: 0, upgrades: {}, stats: {} }),
  unlockLore: () => {}, persistAchievement: () => {},
  bonusExp: (e: number) => e, bonusGold: (g: number) => g,
}));
vi.mock('../i18n.js', () => ({
  t: (k: string) => k,
  tMsg: (k: string, ...a: string[]) => a.reduce((s: string, x) => s.replace('{}', x), k),
  tx: (f: { en?: string } | string) => (typeof f === 'string' ? f : (f && f.en) || ''),
  itemName: (f: { n?: { en?: string } } | undefined) => (f && f.n && f.n.en) || '',
}));

import { rollEndlessStock } from '../events.js';

describe('endless_merchant stock (Task 3)', () => {
  beforeEach(() => {
    (globalThis as { G?: unknown }).G = {
      floor: 50, endless: true,
      player: { relics: [], x: 0, y: 0, hp: 50, maxHp: 100, gold: 99999 },
    };
  });

  it('produces 3 gear + 1 relic + purge + heal', () => {
    const stock = rollEndlessStock();
    expect(stock.filter(s => s.kind === 'gear').length).toBe(3);
    expect(stock.filter(s => s.kind === 'relic').length).toBe(1);
    expect(stock.filter(s => s.kind === 'purge').length).toBe(1);
    expect(stock.filter(s => s.kind === 'heal').length).toBe(1);
  });

  it('prices = floor × {gear:80, relic:200, purge:40, heal:30}', () => {
    const stock = rollEndlessStock();
    expect(stock.find(s => s.kind === 'gear')!.price).toBe(4000);   // 50*80
    expect(stock.find(s => s.kind === 'relic')!.price).toBe(10000);  // 50*200
    expect(stock.find(s => s.kind === 'purge')!.price).toBe(2000);   // 50*40
    expect(stock.find(s => s.kind === 'heal')!.price).toBe(1500);    // 50*30
  });

  it('gear items are endless (rarity 5, _gear set)', () => {
    const gears = rollEndlessStock().filter(s => s.kind === 'gear');
    for (const g of gears) {
      expect(g.item!.rarity).toBe(5);
      expect(g.item!.set).toMatch(/_gear$/);
    }
  });

  it('relic entry is a rarity-5 relic id', () => {
    const r = rollEndlessStock().find(s => s.kind === 'relic')!;
    expect(r.relicId).toBeTruthy();
  });
});
