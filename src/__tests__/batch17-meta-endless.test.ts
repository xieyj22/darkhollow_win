// batch17 T8/T9: meta 数值放大 + 无尽 mf 窗口
// T8: start_hp 10→15 / start_atk 1→2 / start_def 1→2 / crit_bonus 3→4 / dodge_bonus 2→3
// T9: Void Titan 42→44 / Doom Seraph 45→48 / Entropy Beast 48→52 / Abyssal Tyrant 50→56
// （F55 窗口 [51,55] 由 Entropy Beast(52) 直供，消除 F50→F55 难度倒挂）
import { describe, it, expect } from 'vitest';
import { META_UPGRADES, ENEMIES } from '../data.js';

describe('batch17 T8/T9 meta & endless window', () => {
  it('meta values buffed', () => {
    const by = (id: string) => META_UPGRADES.find(u => u.id === id)!;
    expect(by('start_hp').valuePerLevel).toBe(15);
    expect(by('start_atk').valuePerLevel).toBe(2);
    expect(by('start_def').valuePerLevel).toBe(2);
    expect(by('crit_bonus').valuePerLevel).toBe(4);
    expect(by('dodge_bonus').valuePerLevel).toBe(3);
    // desc 双语数值同步（5 条各查本条新值）
    expect(by('start_hp').d.zh).toContain('15');
    expect(by('start_atk').d.en).toContain('+2');
    expect(by('start_def').d.zh).toContain('+2');
    expect(by('crit_bonus').d.en).toContain('4%');
    expect(by('dodge_bonus').d.zh).toContain('3%');
  });
  it('endless mf spread feeds F55-60 window', () => {
    const by = (id: string) => ENEMIES.find((e: any) => e.n.en === id);
    const mfs = ['Void Titan', 'Doom Seraph', 'Entropy Beast', 'Abyssal Tyrant'].map(nm => by(nm)!.mf);
    expect(mfs).toEqual([44, 48, 52, 56]);
    // F55 窗口 [51,55] 有 Entropy Beast(52) 直供
    const win = ENEMIES.filter((e: any) => e.mf <= 55 && e.mf >= 51);
    expect(win.some((e: any) => e.n.en === 'Entropy Beast')).toBe(true);
  });
});
