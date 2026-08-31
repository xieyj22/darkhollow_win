// 批2 ⑨⑩: shrine outcome + cleanse-direction fx. ⑨ rewritten by 批10 A3:
// clean players get a two-choice popup (clean bless / dark pact, +15🩸);
// corrupted players keep the classic 3-way roll + applyCorruption(-20) cleanse.
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
// 批10 A3: cost.ts 支付叶打桩（fallback 分支需 payCorruption 返 false 才可达——
// 弹窗只在 corruption<=0 时开，真实 cost 下 +15 恒过 95 线）。
vi.mock('../cost.js', () => ({ corruptionPriceOf: () => 5, canPayCorruption: () => true, payCorruption: vi.fn(() => true) }));

import { checkTiles } from '../events.js';
import { applyCorruption } from '../combat.js';
import { shake, flt } from '../effects.js';
import { fxAura } from '../fx.js';
import { addMsg } from '../messages.js';
import { payCorruption } from '../cost.js';
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

describe('⑨ shrine two-way choice (批10 A3 replaced the 20% roll)', () => {
  const stubEventDom = () => {
    document.body.innerHTML = '<div id="event-popup" style="display:none"></div>' +
      '<div id="ev-title"></div><div id="ev-desc"></div><div id="ev-buttons"></div>';
  };
  const evBtn = (i: number) => document.getElementById('ev-buttons')!.querySelectorAll('.evb')[i] as HTMLElement;
  it('clean player: [2] dark pact doubles / [1] clean bless classic — tile consumed once, popup closes', () => {
    stubEventDom();
    // [2] 暗黑契约 — payCorruption stubbed true: doubled values + purple aura.
    (globalThis as any).G = mkG(TL.SHRINE);
    (globalThis as any).G.player.corruption = 0;
    checkTiles();
    const popup = document.getElementById('event-popup')!;
    expect(popup.style.display).toBe('block');
    expect(document.getElementById('ev-buttons')!.querySelectorAll('.evb').length).toBe(2);
    expect((globalThis as any).G.player.baseAtk).toBe(5);   // nothing until a choice
    evBtn(1).click();
    let p = (globalThis as any).G.player;
    expect(p.baseAtk).toBe(9);            // 5 + 4 (doubled)
    expect(p.baseDef).toBe(9);
    expect(p.baseMaxHp).toBe(120);        // 100 + 20
    expect(fxAura).toHaveBeenCalledWith(0, 0, '#9d8df1', 2);
    expect((globalThis as any).G.dungeon.map[0][0]).toBe(TL.FLOOR);   // consumed exactly once
    expect(popup.style.display).toBe('none');
    // [1] 洁净祈福 — classic +2/+2/+10 gold aura.
    (globalThis as any).G = mkG(TL.SHRINE);
    (globalThis as any).G.player.corruption = 0;
    checkTiles();
    evBtn(0).click();
    p = (globalThis as any).G.player;
    expect(p.baseAtk).toBe(7);            // 5 + 2
    expect(p.baseDef).toBe(7);
    expect(p.baseMaxHp).toBe(110);        // 100 + 10
    expect(fxAura).toHaveBeenCalledWith(0, 0, '#ffd700', 2);
    expect((globalThis as any).G.dungeon.map[0][0]).toBe(TL.FLOOR);
    expect(popup.style.display).toBe('none');
  });
  it('dark pact refused (95 headroom) → clean fallback; corrupted player keeps classic cleanse path', () => {
    stubEventDom();
    vi.mocked(payCorruption).mockReturnValueOnce(false);
    (globalThis as any).G = mkG(TL.SHRINE);
    (globalThis as any).G.player.corruption = 0;
    checkTiles();
    evBtn(1).click();
    const p = (globalThis as any).G.player;
    expect(p.baseAtk).toBe(7);            // clean values, NOT doubled
    expect(p.baseMaxHp).toBe(110);
    expect(addMsg).toHaveBeenCalledWith('sh.darkFallback', 'mi');
    expect((globalThis as any).G.dungeon.map[0][0]).toBe(TL.FLOOR);
    expect(document.getElementById('event-popup')!.style.display).toBe('none');
    // corruption>0 (55): classic 3-way roll + applyCorruption(-20) cleanse, no popup.
    (globalThis as any).G = mkG(TL.SHRINE);
    checkTiles();
    const q = (globalThis as any).G.player;
    expect(q.baseAtk).toBe(6);            // 5 + rng(1,2)=1
    expect(q.corruption).toBe(35);        // real combat.js: 55 - 20
    expect(document.getElementById('event-popup')!.style.display).toBe('none');
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
