// 批2 ⑨⑩: shrine 4th outcome + cleanse-direction fx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../state.js', () => ({
  get G() { return (globalThis as any).G; }, lang: 'en',
  eventOpen: false, eventActions: [], setEventOpen: () => {}, setEventActions: () => {}, setGameState: () => {},
}));
vi.mock('../utils.js', () => ({ rng: () => 1, dst: () => 1, pick: (a: any[]) => a[0] }));
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../effects.js', () => ({ flt: vi.fn(), shake: vi.fn() }));
vi.mock('../fx.js', () => ({ fxFlash: () => {}, fxAura: vi.fn(), fxBurst: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: vi.fn() }));
vi.mock('../render.js', () => ({ updateUI: () => {}, render: () => {} }));
vi.mock('../items.js', () => ({ genItem: () => ({}), genWeapon: () => ({}), genArmor: () => ({}), genAcc: () => ({}), addItemWithOverflow: () => {}, itemToGold: () => 0 }));
vi.mock('../item-gen.js', () => ({ genEndlessGear: () => ({}) }));
vi.mock('../relics.js', () => ({ grantRelic: () => {}, hasRelic: () => false, applyRelicBonuses: () => {} }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tMsg: (k: string, ...a: string[]) => a.reduce((s: string, x: string) => s.replace('{}', x), k), tx: (f: any) => f?.en ?? '' }));
vi.mock('../enemy-factory.js', () => ({ makeEnemy: vi.fn() }));
vi.mock('../item-intro.js', () => ({ queueMechanicIntro: vi.fn() }));

import { checkTiles } from '../events.js';
import { applyCorruption } from '../combat.js';
import { shake, flt } from '../effects.js';
import { TL } from '../config.js';
import { corruptionTier } from '../corruption.js';

const mkG = (tile: number) => ({
  floor: 10, branchMode: false, gameOver: false,
  dungeon: { map: [[tile]], rooms: [], traps: [] },
  items: [], enemies: [],
  player: { x: 0, y: 0, corruption: 55, hp: 100, maxHp: 100, mp: 100, maxMp: 100, baseAtk: 5, baseDef: 5, baseMaxHp: 100, buffs: [], talents: { points: 0 }, exp: 0, expNext: 999, level: 1, critChance: 0, dodgeChance: 0, elRes: {}, elDmgBonus: {}, healBonus: 0, setCorruptionResist: 0, ci: 0, ri: 0, raceName: 'r', clsName: 'c', stunned: 0, slowed: 0, poisonTurns: 0, poisonDmg: 0, gold: 0, hunger: 100, maxHunger: 100, kills: 0, turns: 0, eq: { weapon: null, armor: null, accessory: null, accessory2: null }, inv: [], relics: [] },
});

beforeEach(() => { vi.clearAllMocks(); vi.spyOn(Math, 'random').mockReturnValue(0.5); });
afterEach(() => { vi.restoreAllMocks(); });

describe('⑨ shrine 20% powerful blessing', () => {
  it('random<0.2 grants all-three blessing', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    (globalThis as any).G = mkG(TL.SHRINE);
    checkTiles();
    const p = (globalThis as any).G.player;
    expect(p.baseAtk).toBe(7);        // 5 + 2
    expect(p.baseDef).toBe(7);
    expect(p.baseMaxHp).toBe(110);    // 100 + 10
  });
  it('random>=0.2 keeps 3-way roll (rng()=1 → atk path)', () => {
    (globalThis as any).G = mkG(TL.SHRINE);
    checkTiles();
    expect((globalThis as any).G.player.baseAtk).toBe(6);   // 5 + rng(1,2)=1
  });
});

describe('⑩ cleanse direction fx', () => {
  it('corruption DROP across a tier (55→40, corrupted→touched): no shake', () => {
    (globalThis as any).G = mkG(TL.FOUNTAIN);   // fountain cleanse -15 crosses 50-boundary
    checkTiles();
    const p = (globalThis as any).G.player;
    expect(p.corruption).toBe(40);              // real crossing, not vacuous
    expect(corruptionTier(40)).toBe('touched');
    expect(shake).not.toHaveBeenCalled();
    expect(flt).toHaveBeenCalledWith(0, 0, 'TOUCHED', '#80ed99');   // green relief float
  });
  it('corruption GAIN across a tier (78→83, corrupted→mutated) still shakes', () => {
    (globalThis as any).G = mkG(TL.FLOOR);
    (globalThis as any).G.player.corruption = 78;
    applyCorruption(5);
    const p = (globalThis as any).G.player;
    expect(p.corruption).toBe(83);              // real crossing, not vacuous
    expect(corruptionTier(83)).toBe('mutated');
    expect(shake).toHaveBeenCalledWith(1.5);
  });
});
