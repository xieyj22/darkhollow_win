// 批10 B1: 死亡快照落 meta（echoes cap10 newest-first）+ keepsake 选取。
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../state.js', () => ({ G: null, lang: 'en' }));
vi.mock('../combat.js', () => ({ recalc: () => {}, checkLevelUp: () => {} }));

import { recordEcho, pickKeepsake, getMeta, initMeta } from '../meta.js';
import { readFileSync } from 'node:fs';
import type { EchoRecord } from '../types.js';

const mk = (ts: number): EchoRecord => ({
  cause: 'combat', killer: 'Slime', floor: 5, turns: 100, classIdx: 0,
  corruption: 30, keepsake: null, epitaph: { template: 'T', flavor: 'F' }, ts,
});

describe('批10 B1 recordEcho', () => {
  beforeEach(() => { localStorage.clear(); initMeta(); });
  it('落盘并可回读', () => {
    recordEcho(mk(1));
    expect(getMeta().echoes?.length).toBe(1);
    expect(getMeta().echoes![0].killer).toBe('Slime');
  });
  it('cap 10，newest-first', () => {
    for (let i = 0; i < 12; i++) recordEcho(mk(i));
    const es = getMeta().echoes!;
    expect(es.length).toBe(10);
    expect(es[0].ts).toBe(11); expect(es[9].ts).toBe(2);
  });
  it('旧档（无 echoes 字段）迁移为空数组', () => {
    localStorage.setItem('dh_meta', JSON.stringify({ stats: {}, upgrades: {} }));
    expect(getMeta().echoes).toEqual([]);
  });
});

describe('批10 B1 pickKeepsake', () => {
  const it3 = { rarity: 3 } as any, it1 = { rarity: 1 } as any;
  it('inv+装备取最高稀有度', () => {
    const p: any = { inv: [it1, it3], eq: { weapon: { rarity: 2 }, armor: null, accessory: null } };
    expect(pickKeepsake(p)).toBe(it3);
  });
  it('全空返回 null', () => {
    expect(pickKeepsake({ inv: [], eq: { weapon: null, armor: null, accessory: null } } as any)).toBeNull();
  });
});

describe('批10 B1 playerDeath 接线（source-gate）', () => {
  it('buildEpitaph 之后调用 recordEcho', () => {
    // batch4 note: the `'../' + f` dynamic form is deliberate — folding it to a
    // string LITERAL lets Vite rewrite the URL to a dev-server http:// path,
    // which node's readFileSync rejects ("scheme file").
    const f = 'combat.ts';
    const text = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    expect(text).toContain('recordEcho({');
  });
});
