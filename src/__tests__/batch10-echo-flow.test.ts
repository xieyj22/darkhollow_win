// 批10 B2: echo 实体消费语义 + 三交互 + 注入门（source-gate）+ T_ECHO/i18n 验收。
import { describe, it, expect, vi } from 'vitest';

vi.mock('../state.js', () => ({
  G: { player: { corruption: 30, maxHp: 100, hp: 50, inv: [], quickSlots: [] }, floor: 3 },
  lang: 'zh', eventOpen: false, setEventOpen: vi.fn(), setEventActions: vi.fn(),
}));
// 其余 vi.mock 前言照抄 src/__tests__/batch9-treasure-price.test.ts 的 mock 集
// （该文件在批9 已为 events.ts 现行 import 图调通）；events.ts 若新增 import 同步补 mock。
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
/* === 批10 B2 另加：events.ts 新增的 meta/corruption import（brief） === */
vi.mock('../meta.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../meta.js')>();
  return { ...actual, getMeta: () => ({ echoes: [], soulEchoes: 0 }), creditSoulEchoes: vi.fn() };
});
vi.mock('../corruption.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../corruption.js')>();
  return { ...actual, addCorruption: vi.fn() };
});

import { readFileSync } from 'node:fs';
import { npcPersists } from '../npc-rules.js';
import { TEMPLATES, pickItemTemplate } from '../sprites.js';

describe('批10 B2 消费语义', () => {
  it("npcPersists('echo') === false（踩上即消耗，宝箱同款）", () => {
    expect(npcPersists('echo')).toBe(false);
  });
});

describe('批10 B2 注入门（source-gate）', () => {
  const f = 'game.ts';   // 动态形式——Vite 会改写字面量 new URL()（批4 教训）
  const g = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  it('floor>=2 且 35% 且池非空才注入', () => {
    expect(g).toContain("floor >= 2 && Math.random() < 0.35");
    expect(g).toContain('getMeta().echoes');
    expect(g).toContain("npc: 'echo'");
  });
});

describe('批10 B2 三交互（source-gate + 行为桩）', () => {
  const f = 'events.ts';
  const e = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  it('openEchoEvent 分派与三动作存在', () => {
    expect(e).toContain("entity.npc === 'echo'");
    expect(e).toContain('openEchoEvent');
    expect(e).toContain('addItemWithOverflow');
    expect(e).toContain('applyCorruption(-10)');
    expect(e).toContain('creditSoulEchoes(30)');
    expect(e).toContain("addCorruption(p, 10)");
  });
  it('keepsake null 走降级（+5 腐化换 50 金）', () => {
    expect(e).toContain('addCorruption(p, 5)');
    expect(e).toContain('50');
  });
  it('掠夺过 95 硬线双门：闭包复验 + 渲染置灰（终审 I1，同商店腐化价签）', () => {
    expect(e).toContain('canPayCorruption(p.corruption, 10)');
    expect(e).toContain('canPayCorruption(p.corruption, 5)');
    expect(e).toContain('canPayCorruption(G.player.corruption, hasK ? 10 : 5)');
    expect(e).toContain('lootBtn.disabled = true');
    expect(e).toContain("lootBtn.style.opacity = '.45'");
  });
});

describe('批10 B2 T_ECHO 模板', () => {
  const f = 'sprites.ts';
  const s = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  it('sprites.ts 有 T_ECHO 且刻意不进 THEME_PAL', () => {
    expect(s).toContain('T_ECHO:');
    expect(s.match(/THEME_PAL[^;]*'ECHO'/)).toBeNull();
  });
  it('16×16 网格 + ≥3 色角色 + spriteKind ECHO 路由', () => {
    const tpl = TEMPLATES.T_ECHO!;
    expect(tpl, 'T_ECHO in TEMPLATES').toBeTruthy();
    expect(tpl.length).toBe(16);
    tpl.forEach((row, i) => expect(row.length, 'row ' + i).toBe(16));
    const SINGLE = new Set(['M', 'D', 'L', 'E', 'K', 'W', 'C', 'G', 'N', 'V']);
    const letters = new Set(tpl.join('').replace(/\./g, '').split(''));
    expect(letters.size, 'uses >= 3 palette roles').toBeGreaterThanOrEqual(3);
    for (const ch of letters) expect(SINGLE.has(ch), `letter ${ch} not buildPalette`).toBe(true);
    // spriteKind 'ECHO'（game.ts 实体）必须路由到同一模板——别名承载。
    expect(TEMPLATES.ECHO).toBe(tpl);
    expect(pickItemTemplate({ type: 'consumable', spriteKind: 'ECHO', name: 'x', rarity: 2 } as any).key).toBe('ECHO');
  });
});

describe('批10 B2 i18n 8 键', () => {
  it('en+zh 成对落词典（vi.importActual 绕过上方 i18n 桩）', async () => {
    const { L } = await vi.importActual<typeof import('../i18n.js')>('../i18n.js');
    const keys = ['ev.echoTitle', 'ev.echoLoot', 'ev.echoLootEmpty', 'ev.echoPurify',
      'ev.echoInherit', 'ev.echoLootDone', 'ev.echoPurifyDone', 'ev.echoInheritDone'];
    for (const k of keys) {
      const v = L[k] as { en?: string; zh?: string } | undefined;
      expect(v, k).toBeTruthy();
      expect(v!.en, k + '.en').toBeTruthy();
      expect(v!.zh, k + '.zh').toBeTruthy();
    }
  });
});
