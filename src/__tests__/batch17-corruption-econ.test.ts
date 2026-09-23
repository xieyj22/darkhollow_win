// batch17 T6: 施法 50% 概率+1 / 净水30 / 神龛-25
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';

describe('batch17 T6 corruption economy', () => {
  it('skills.ts cast corruption is probabilistic (50%)', () => {
    const src = readFileSync('src/skills.ts', 'utf-8');
    expect(src).toMatch(/Math\.random\(\) < 0\.5[^;]*applyCorruption\(1\)|applyCorruption\(1\)[^;]*< 0\.5/s);
  });
  it('purified_water v=30 + desc 30 (both langs)', async () => {
    const { ALL_CONSUMABLES } = await import('../data.js');
    const w = ALL_CONSUMABLES.find(c => c.ef === 'purify')!;
    expect(w.v).toBe(30);
    expect(w.desc!.en).toContain('30'); expect(w.desc!.zh).toContain('30');
  });
  it('items.ts purify fallback is 30 (both val and message)', () => {
    const src = readFileSync('src/items.ts', 'utf-8');
    // brief 原正则 /item\.val \|\| (\d+)/ 命中 L44 heal 的 `|| 0`（首个匹配）
    // ——锚定 purify 行再数 30 的个数（val 与消息两处各一）。
    const line = src.split('\n').find(l => l.includes("case 'purify'"))!;
    const nums = [...line.matchAll(/item\.val \|\| (\d+)/g)].map(m => m[1]);
    expect(nums).toEqual(['30', '30']);
  });
  it('shrine cleanse -25', () => {
    const src = readFileSync('src/events.ts', 'utf-8');
    expect(src).toContain('applyCorruption(-25)');
  });
});
