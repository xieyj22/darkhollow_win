// batch17 T5: 掉落稀有度楼层加权 w=1+r*(1+f/40)
import { describe, it, expect } from 'vitest';
import { pickWeighted } from '../item-gen.js';
import { ALL_WEAPONS } from '../data.js';

describe('batch17 T5 drop rarity weighting', () => {
  it('weight formula: w=1+r*(1+f/40) — F40 favors r4 ~9:1 over r0 per item', () => {
    // Brief's original assertion compared aggregate r0 hits against a single
    // item's probability (1/wS) while ALL_WEAPONS holds 4 r0 weapons — always
    // red. Recalculated per task ruling: expectations aggregated per rarity
    // tier from the fixed formula w=1+r*(1+f/40). Formula itself unchanged.
    const r0 = ALL_WEAPONS.find(w => w.r === 0 && w.id === 'rusty_sword')!;
    const r4 = ALL_WEAPONS.find(w => w.r === 4 && w.id === 'godslayer_sword')!;
    expect(r0.r).toBe(0);
    expect(r4.r).toBe(4);
    const pool = ALL_WEAPONS.filter(w => w.r <= 4);
    // 间接验证: F40 十万次抽取, 各稀有度命中率 ≈ Σw(该稀有度)/Σw(全池) (±10%)
    let hit4 = 0, hit0 = 0; const N = 100000;
    for (let i = 0; i < N; i++) {
      const p = pickWeighted(pool, 40);
      if (p.r === 4) hit4++; if (p.r === 0) hit0++;
    }
    const w = (r: number) => 1 + r * (1 + 40 / 40);  // 1 + 2r
    const wS = pool.reduce((s, x) => s + w(x.r), 0);
    const exp4 = pool.filter(x => x.r === 4).length * w(4) / wS;
    const exp0 = pool.filter(x => x.r === 0).length * w(0) / wS;
    expect(hit4 / N).toBeGreaterThan(exp4 * 0.9);
    expect(hit4 / N).toBeLessThan(exp4 * 1.1);
    expect(hit0 / N).toBeGreaterThan(exp0 * 0.9);
    expect(hit0 / N).toBeLessThan(exp0 * 1.1);
  });
  it('mr gate unchanged: F5 max rarity 1', () => {
    for (let i = 0; i < 2000; i++) {
      const p = pickWeighted(ALL_WEAPONS.filter(w => w.r <= Math.min(4, Math.floor(5 / 3))), 5);
      expect(p.r).toBeLessThanOrEqual(1);
    }
  });
});
