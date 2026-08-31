// 批10 A3: 神龛二选一——暗黑契约 +15🩸 双倍祝福，余量不足回落洁净祝福。
import { describe, it, expect, vi } from 'vitest';

vi.mock('../state.js', () => ({
  G: { floor: 5, player: { corruption: 20, baseAtk: 10, baseDef: 5, baseMaxHp: 80, maxHp: 80, hp: 40, x: 3, y: 3 } },
  lang: 'zh', eventOpen: false, eventActions: [], setEventOpen: vi.fn(), setEventActions: vi.fn(),
}));
// 其余 vi.mock 前言照抄 src/__tests__/batch10-dual-price.test.ts 的 mock 集
// （= 批9 前言 + 批10 B2/A2 为 events.ts import 图补的 meta/corruption/cost 三条）。
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
/* === 批10 A3 另加：cost.ts 支付叶（Task 3） === */
vi.mock('../cost.js', () => ({
  payCorruption: vi.fn(() => true),
  corruptionPriceOf: () => 5, canPayCorruption: () => true,
}));

import { readFileSync } from 'node:fs';

describe('批10 A3 神龛（source-gate）', () => {
  const f = 'events.ts';   // 动态形式——Vite 会改写字面量 new URL()（批4 教训）
  const e = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  it('无腐化路径变二选一弹窗（随机 20% 移除）', () => {
    // \b 是必须的：trapped_npc 的 `Math.random() < 0.25`（批2 ③）包含子串
    // `Math.random() < 0.2`，字面量 not.toContain 会误伤——只打 0.2 阈值。
    expect(e).not.toMatch(/Math\.random\(\) < 0\.2\b/);
    expect(e).toContain('sh.cleanBless');
    expect(e).toContain('sh.darkPact');
  });
  it('暗黑契约双倍数值与回落', () => {
    expect(e).toContain('payCorruption(G!.player, 15)');
    // brief 印的 'baseAtk += 4' 与其自带的 bless(atk,def,hp,aura) 参数化实现互斥
    // ——按参数化调用形式断言（双倍数值 + 紫/金 aura 一次锁死）。
    expect(e).toContain("bless(4, 4, 20, '#9d8df1')");
    expect(e).toContain("bless(2, 2, 10, '#ffd700')");
    expect(e).toContain('sh.darkFallback');
  });
  it('有腐化净化路径保留（回归锚）', () => {
    expect(e).toContain('applyCorruption(-20)');
  });
});
