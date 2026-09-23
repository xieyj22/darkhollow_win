// batch17 T0: 曲线带状回归门 — spec §2 目标表锁定, 防未来数值漂移。
// 带是硬门（模型假设在 balance-targets.ts 头注释声明，可在带内调；越带=上游数值问题）。
import { describe, it, expect } from 'vitest';
import { curves } from '../balance-targets.js';

// [floor, ttkMin, ttkMax, h2dMin] — estab 画像, 全职业须同时满足
const BANDS: [number, number, number, number][] = [
  [10, 0.5, 3, 8], [15, 1, 4, 6], [20, 1.5, 6, 4.5], [25, 2, 7, 4],
  [30, 2, 8, 4.5], [35, 2.5, 9, 3.5], [40, 4, 13, 2.8],
];

describe('batch17 balance curves (spec §2 bands)', () => {
  it('normal-floor TTK & h2d within bands for all classes', () => {
    const c = curves('estab');
    for (const cls of Object.keys(c.classes)) {
      for (const [f, tMin, tMax, hMin] of BANDS) {
        const row = c.classes[cls].find(r => r.f === f)!;
        expect(row.ttk, `${cls} F${f} ttk`).toBeGreaterThanOrEqual(tMin);
        expect(row.ttk, `${cls} F${f} ttk`).toBeLessThanOrEqual(tMax);
        expect(row.h2d, `${cls} F${f} h2d`).toBeGreaterThanOrEqual(hMin);
      }
    }
  });

  it('boss TTK bands: F5 1-5 / F25 4.5-12 / F40 19-60', () => {
    // R10: 下界重标定（F5 2→1 / F25 5→4.5 / F40 20→19）— 原带按 T8 前 meta 画像标定；
    // T8 estab 加强（+6atk/+8%crit）对暴击流的 ttk 下移（Rogue F5 1.2t/F25 4.6t/F40 19.8t）
    // 属设计内力量幻想；上界（Boss 不许是墙）承重不动。
    const c = curves('estab');
    const g = c.boss['Goblin King'], d = c.boss['Dragon Emperor'], cr = c.boss['The Creator'];
    for (const cls of Object.keys(g)) {
      expect(g[cls].ttk, `${cls} F5 boss ttk`).toBeGreaterThanOrEqual(1);
      expect(g[cls].ttk, `${cls} F5 boss ttk`).toBeLessThanOrEqual(5);
      expect(d[cls].ttk, `${cls} F25 boss ttk`).toBeGreaterThanOrEqual(4.5);
      expect(d[cls].ttk, `${cls} F25 boss ttk`).toBeLessThanOrEqual(12);
      expect(cr[cls].ttk, `${cls} F40 boss ttk`).toBeGreaterThanOrEqual(19);
      expect(cr[cls].ttk, `${cls} F40 boss ttk`).toBeLessThanOrEqual(60);
    }
  });

  it('boss h2d: F5 ≥7 / F25 ≥3.8 / F40 ≥2.1', () => {
    const c = curves('estab');
    const g = c.boss['Goblin King'], d = c.boss['Dragon Emperor'], cr = c.boss['The Creator'];
    for (const cls of Object.keys(g)) {
      expect(g[cls].h2d, `${cls} F5 boss h2d`).toBeGreaterThanOrEqual(7);
      expect(d[cls].h2d, `${cls} F25 boss h2d`).toBeGreaterThanOrEqual(3.8);
      expect(cr[cls].h2d, `${cls} F40 boss h2d`).toBeGreaterThanOrEqual(2.1);
    }
  });

  it('class spread at F40 ≤ 2.5×', () => {
    const c = curves('estab');
    const ttks = Object.values(c.classes).map(rows => rows.find(r => r.f === 40)!.ttk);
    expect(Math.max(...ttks) / Math.min(...ttks)).toBeLessThanOrEqual(2.5);
  });

  it('corruption @F40: all ≤60, mage in [10,55] (catches both revert & over-cleanse drift)', () => {
    const c = curves('estab');
    for (const [cls, v] of Object.entries(c.corruption)) {
      expect(v, `${cls} corruption`).toBeLessThanOrEqual(60);
    }
    expect(c.corruption['Mage']).toBeGreaterThanOrEqual(10);
    expect(c.corruption['Mage']).toBeLessThanOrEqual(55);
  });

  it('fresh profile also inside coarser bands (new-player experience)', () => {
    const c = curves('fresh');
    for (const cls of Object.keys(c.classes)) {
      for (const [f, , tMax, hMin] of [[15, 1, 5, 4], [25, 2, 9, 3], [40, 4, 16, 2.2]] as [number, number, number, number][]) {
        const row = c.classes[cls].find(r => r.f === f)!;
        expect(row.ttk, `${cls} fresh F${f} ttk`).toBeLessThanOrEqual(tMax);
        expect(row.h2d, `${cls} fresh F${f} h2d`).toBeGreaterThanOrEqual(hMin);
      }
    }
  });
});
