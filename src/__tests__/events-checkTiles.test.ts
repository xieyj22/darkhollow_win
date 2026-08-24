// ② reconnect: fountains/shrines must CLEANSE corruption (the -15/-20 values
// lived in dead popup code). Unit boundary: assert checkTiles' decisions —
// applyCorruption mock records the call; its math is covered elsewhere.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../state.js', () => ({ get G() { return (globalThis as any).G; }, lang: 'en' }));
vi.mock('../utils.js', () => ({ rng: () => 1, dst: () => 1, pick: (a: any[]) => a[0] }));
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../effects.js', () => ({ flt: () => {}, shake: () => {} }));
vi.mock('../fx.js', () => ({ fxFlash: () => {}, fxBurst: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: vi.fn() }));
vi.mock('../render.js', () => ({ updateUI: () => {}, render: () => {} }));
vi.mock('../game.js', () => ({ enterBranch: () => {}, exitBranch: () => {} }));
vi.mock('../items.js', () => ({
  genItem: () => ({}), genWeapon: () => ({}), genArmor: () => ({}), genAcc: () => ({}),
  addItemWithOverflow: () => {}, itemToGold: () => 0,
}));
// events.ts actually imports genEndlessGear from item-gen.js and
// grantRelic/hasRelic from relics.js — mock those modules too.
vi.mock('../item-gen.js', () => ({ genEndlessGear: () => ({}) }));
vi.mock('../relics.js', () => ({ grantRelic: () => {}, hasRelic: () => false }));
vi.mock('../i18n.js', () => ({
  t: (k: string) => k,
  tMsg: (k: string, ...a: string[]) => a.reduce((s, x) => s.replace('{}', x), k),
  tx: (f: any) => f?.en ?? '',
}));
vi.mock('../combat.js', () => ({
  applyCorruption: vi.fn(),
  playerDeath: vi.fn(),
  recalc: () => {},
}));
vi.mock('../bridge.js', () => ({ bridge: {} }));

import { checkTiles } from '../events.js';
import { applyCorruption } from '../combat.js';
import { TL } from '../config.js';
import * as events from '../events.js';

const mkG = (tile: number, corruption: number, hpFull = true) => ({
  floor: 5, branchMode: false, gameOver: false,
  dungeon: { map: [[tile]], rooms: [], stair: { x: 0, y: 0 }, traps: [] },
  items: [], enemies: [],
  player: {
    x: 0, y: 0, corruption,
    hp: hpFull ? 100 : 40, maxHp: 100,
    mp: 100, maxMp: 100,
    baseAtk: 5, baseDef: 5, baseMaxHp: 100, buffs: [],
  },
});

beforeEach(() => { vi.clearAllMocks(); });

describe('② fountain cleanses corruption', () => {
  it('full HP/MP but corruption>0: consumes the fountain + applyCorruption(-15)', () => {
    (globalThis as any).G = mkG(TL.FOUNTAIN, 30);
    checkTiles();
    expect(applyCorruption).toHaveBeenCalledWith(-15);
    expect((globalThis as any).G.dungeon.map[0][0]).toBe(TL.WATER);   // consumed
  });
  it('corruption 0 + full HP/MP: quiet, tile NOT consumed', () => {
    (globalThis as any).G = mkG(TL.FOUNTAIN, 0);
    checkTiles();
    expect(applyCorruption).not.toHaveBeenCalled();
    expect((globalThis as any).G.dungeon.map[0][0]).toBe(TL.FOUNTAIN);
  });
});

describe('② shrine cleanses corruption', () => {
  it('corruption>0: blessing fires + applyCorruption(-20)', () => {
    (globalThis as any).G = mkG(TL.SHRINE, 30);
    checkTiles();
    expect(applyCorruption).toHaveBeenCalledWith(-20);
    expect((globalThis as any).G.dungeon.map[0][0]).toBe(TL.FLOOR);
  });
});

describe('② dead popup-event code removed', () => {
  it('maybeEvent no longer exported', () => {
    expect((events as any).maybeEvent).toBeUndefined();
  });
});
