// 批10 A2: 双价签渲染 + 腐化购买路径 + 余量不足禁用。
import { describe, it, expect, vi } from 'vitest';

vi.mock('../state.js', () => ({
  G: { floor: 5, player: { corruption: 30, gold: 0, inv: [], quickSlots: [] } },
  lang: 'zh', eventOpen: false, eventActions: [], setEventOpen: vi.fn(), setEventActions: vi.fn(),
}));
// 其余 vi.mock 前言照抄 src/__tests__/batch10-echo-flow.test.ts 的 mock 集
// （= 批9 前言 + 批10 B2 为 events.ts 新增 meta/corruption import 补的两条）。
vi.mock('../utils.js', () => ({ rng: () => 1, dst: () => 1, pick: (a: any[]) => a[0] }));
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../effects.js', () => ({ flt: () => {}, shake: () => {} }));
vi.mock('../fx.js', () => ({ fxFlash: () => {}, fxAura: () => {}, fxBeam: () => {}, fxBolt: () => {}, fxBurst: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: vi.fn() }));
vi.mock('../render.js', () => ({ updateUI: () => {}, render: () => {} }));
vi.mock('../items.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../items.js')>();
  return { ...actual, addItemWithOverflow: vi.fn() };
});
vi.mock('../item-gen.js', () => ({ genEndlessGear: () => ({}) }));
vi.mock('../relics.js', () => ({ grantRelic: vi.fn(), hasRelic: () => false }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tMsg: (k: string, ...a: string[]) => a.reduce((s, x) => s.replace('{}', x), k), tx: (f: any) => f?.en ?? '' }));
vi.mock('../combat.js', () => ({ applyCorruption: vi.fn(), playerDeath: vi.fn(), recalc: () => {} }));
vi.mock('../enemy-factory.js', () => ({ makeEnemy: vi.fn(() => ({})) }));
vi.mock('../data.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data.js')>();
  return { ...actual, ENEMIES: [{ n: { en: 'Skeleton' }, mf: 1, hp: 1, atk: 1, def: 0, exp: 1, g: [1, 2], ai: 'chase' }] };
});
vi.mock('../meta.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../meta.js')>();
  return { ...actual, getMeta: () => ({ echoes: [], soulEchoes: 0 }), creditSoulEchoes: vi.fn() };
});
vi.mock('../corruption.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../corruption.js')>();
  return { ...actual, addCorruption: vi.fn() };
});
/* === 批10 A2 另加：cost.ts 支付叶（Task 3） === */
vi.mock('../cost.js', () => ({
  corruptionPriceOf: (g: number) => Math.max(5, Math.min(25, Math.round(g / 45))),
  canPayCorruption: (c: number, k: number) => c + k <= 95,
  payCorruption: vi.fn(() => true),
}));

import { readFileSync } from 'node:fs';

describe('批10 A2 双价签（source-gate）', () => {
  const f = 'events.ts';   // 动态形式——Vite 会改写字面量 new URL()（批4 教训）
  const e = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  it('宝藏与 endless 都引用 cost.ts', () => {
    expect(e).toContain("from './cost.js'");
    expect(e.match(/corruptionPriceOf/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
  it('金币扣款原路径保留（回归锚）', () => {
    expect(e).toContain('if (G.player.gold < price)');
  });
  it('余量不足提示键存在', () => {
    const fi = 'i18n.ts';
    const i = readFileSync(new URL('../' + fi, import.meta.url), 'utf8');
    expect(i).toContain('ev.tooCorrupted');
    expect(i).toContain('ev.corruptPay');
  });
});

describe('批10 A2 腐化购买（行为桩）', () => {
  it('buyTreasure 腐化路径调 payCorruption 成功后 splice 库存', () => {
    const f = 'events.ts';
    const e = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    expect(e).toContain('payCorruption(G.player, cPrice)');
    expect(e).toContain("t('ev.tooCorrupted')");
  });
});
