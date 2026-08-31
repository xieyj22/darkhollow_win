// 批9 ⑦: 宝藏商人对齐金币曲线（每层拾金 ≈ 50+15×floor，F1-5 累计 ≈475）。
// 新价: base r3=420 r4=880 + floor×8 → F5 460/920、F20 580/1040、F40 740/1200。
import { describe, it, expect, vi } from 'vitest';

let floor = 5;
vi.mock('../state.js', () => ({
  G: { get floor() { return floor; } },
  lang: 'en',
  setEventOpen: vi.fn(), setEventActions: vi.fn(),
}));
// 其余 vi.mock 前言照抄 src/__tests__/batch2-event-sites.test.ts 的 mock 集
// （events.ts 的 import 图）；events.ts 此后未新增 import（batch2-event-sites
// 测试至今全绿，即该 mock 集仍完整覆盖其模块解析）。
vi.mock('../utils.js', () => ({ rng: () => 1, dst: () => 1, pick: (a: any[]) => a[0] }));
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../effects.js', () => ({ flt: () => {}, shake: () => {} }));
vi.mock('../fx.js', () => ({ fxFlash: () => {}, fxAura: () => {}, fxBeam: () => {}, fxBolt: () => {}, fxBurst: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: vi.fn() }));
vi.mock('../render.js', () => ({ updateUI: () => {}, render: () => {} }));
vi.mock('../items.js', () => ({ genItem: () => ({ rarity: 1, name: 'x' }), genWeapon: () => ({}), genArmor: () => ({}), genAcc: () => ({}), addItemWithOverflow: vi.fn(), itemToGold: () => 0 }));
vi.mock('../item-gen.js', () => ({ genEndlessGear: () => ({}) }));
vi.mock('../relics.js', () => ({ grantRelic: vi.fn(), hasRelic: () => false }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tMsg: (k: string, ...a: string[]) => a.reduce((s, x) => s.replace('{}', x), k), tx: (f: any) => f?.en ?? '' }));
vi.mock('../combat.js', () => ({ applyCorruption: vi.fn(), playerDeath: vi.fn(), recalc: () => {} }));
vi.mock('../enemy-factory.js', () => ({ makeEnemy: vi.fn(() => ({})) }));
vi.mock('../data.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data.js')>();
  return { ...actual, ENEMIES: [{ n: { en: 'Skeleton' }, mf: 1, hp: 1, atk: 1, def: 0, exp: 1, g: [1, 2], ai: 'chase' }] };
});

import { treasurePrice } from '../events.js';

const it3 = { rarity: 3 } as any, it4 = { rarity: 4 } as any;
describe('批9 ⑦ treasurePrice', () => {
  it('F5', () => { floor = 5; expect(treasurePrice(it3)).toBe(460); expect(treasurePrice(it4)).toBe(920); });
  it('F20', () => { floor = 20; expect(treasurePrice(it3)).toBe(580); expect(treasurePrice(it4)).toBe(1040); });
  it('F40', () => { floor = 40; expect(treasurePrice(it3)).toBe(740); expect(treasurePrice(it4)).toBe(1200); });
});
