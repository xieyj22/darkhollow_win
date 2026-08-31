// 批9 ①: 格子放大由 CSS 承担（battery 目检），单测锁：无 title 双提示、
// aria-label 在、名条节点在且随焦点更新。
import { describe, it, expect, vi, beforeEach } from 'vitest';

// NOTE: vi.mock factories are hoisted above every top-level binding, so the
// potion must be created *inside* the factory (one shared object: renderHotbar
// does inv.indexOf(item) — two literals would unlink inv[0] from quickSlots[0]).
vi.mock('../state.js', () => {
  const potion = { type: 'potion', name: '生命药水', desc: '回复生命', rarity: 0, ef: 'heal', val: 20 };
  return { G: { floor: 1, gameOver: false, player: { inv: [potion], quickSlots: [potion, null, null, null, null, null, null, null, null] } }, lang: 'zh' };
});
vi.mock('../utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils.js')>();
  return { ...actual, rng: () => 0, pick: <T,>(a: T[]) => a[0], dst: () => 1 };
});
vi.mock('../sprites.js', () => ({ paintItemIcon: vi.fn(), paintIcon: vi.fn(), paintRelicIcon: vi.fn() }));
vi.mock('../combat.js', () => ({ recalc: () => {}, checkLevelUp: () => {}, killEnemy: () => {}, applyCorruption: () => {}, playerDeath: () => {} }));
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../effects.js', () => ({ flt: () => {} }));
vi.mock('../fx.js', () => ({ fxFlash: () => {}, fxBeam: () => {}, fxBolt: () => {}, fxBurst: () => {}, fxAura: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: () => {} }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tMsg: (k: string) => k, tx: (k: string) => k, RARITY_C: ['#888', '#8bc34a', '#4fc3f7', '#b39ddb', '#ffd700'] }));

import { renderHotbar } from '../items.js';

describe('批9 ① hotbar', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="hotbar"></div>'; });
  it('无 title 属性（消灭 OS 双提示）', () => {
    renderHotbar();
    const slot = document.querySelector('.hb-slot')!;
    expect(slot.getAttribute('title')).toBeNull();
  });
  it('aria-label 携带道具名（无障碍承接）', () => {
    renderHotbar();
    expect(document.querySelector('.hb-slot')!.getAttribute('aria-label')).toContain('生命药水');
  });
  it('#hb-name 存在且 aria-hidden', () => {
    renderHotbar();
    const nb = document.getElementById('hb-name')!;
    expect(nb.getAttribute('aria-hidden')).toBe('true');
  });
  it('焦点格全名进名条', () => {
    renderHotbar();
    const slot = document.querySelector('.hb-slot') as HTMLElement;
    slot.focus();
    slot.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(document.getElementById('hb-name')!.textContent).toContain('生命药水');
  });
});
