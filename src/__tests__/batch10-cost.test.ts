// 批10 A1: 吃进腐化支付——数值表 + 95 硬线 + 只走 addCorruption（绕开修正链）。
import { describe, it, expect, vi, beforeEach } from 'vitest';

const addCorruption = vi.fn();
vi.mock('../corruption.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../corruption.js')>();
  return { ...actual, addCorruption: (...a: any[]) => addCorruption(...a) };
});
vi.mock('../combat.js', () => ({ applyCorruption: vi.fn() }));

import { corruptionPriceOf, canPayCorruption, payCorruption } from '../cost.js';

describe('批10 A1 corruptionPriceOf（clamp(round(g/45), 5, 25)）', () => {
  it.each([[460, 10], [920, 20], [3600, 25], [30, 5], [225, 5]])('%i金 → %i🩸', (g, n) => {
    expect(corruptionPriceOf(g)).toBe(n);
  });
});

describe('批10 A1 canPayCorruption（cur+cost <= 95）', () => {
  it('85+15=false；80+15=true（边界放行）', () => {
    expect(canPayCorruption(85, 15)).toBe(false);
    expect(canPayCorruption(80, 15)).toBe(true);
  });
});

describe('批10 A1 payCorruption', () => {
  // 模块级 spy 跨用例保留调用记录（vite.config 无 clearMocks）——批2同款隔离法。
  beforeEach(() => { addCorruption.mockClear(); });
  it('可付：走 addCorruption 且返回 true', () => {
    const p: any = { corruption: 30 };
    expect(payCorruption(p, 10)).toBe(true);
    expect(addCorruption).toHaveBeenCalledWith(p, 10);
  });
  it('不可付：不动腐化且返回 false', () => {
    const p: any = { corruption: 90 };
    expect(payCorruption(p, 10)).toBe(false);
    expect(addCorruption).not.toHaveBeenCalled();
  });
});
