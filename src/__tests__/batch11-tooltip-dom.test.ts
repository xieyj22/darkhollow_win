// 批11 B: DOM 委托 tooltip(hotbar/背包行)第三 anchor ttDomEl — 行元素被重渲染
// 静默吞掉后 validateTooltip 秒隐(照 ttFocusEl 的 document.contains 先例)。
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../state.js', () => ({
  G: { player: { quickSlots: [{ name: '宝石', desc: '红', rarity: 2 }], inv: [{ name: '面包', desc: '吃', rarity: 1 }] } },
  lang: 'en',
}));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tMsg: (k: string) => k, tx: () => 'x', rareName: () => 'r', RARITY_C: ['#888', '#8bc34a', '#4fc3f7', '#b39ddb', '#ffd700'] }));
vi.mock('../sprites.js', () => ({ paintIcon: vi.fn() }));

import { initTooltip, initFocusTooltips, validateTooltip } from '../ui-panels.js';

const tt = () => document.getElementById('tooltip')!;

describe('批11 B DOM 委托 tooltip 第三 anchor', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="tooltip" style="display:none"></div>
      <div id="game-canvas"></div>
      <div id="hotbar"><div class="hb-slot" data-qs="0"><span>x</span></div></div>
      <div id="inv-content"><div class="ii"><canvas data-idx="0"></canvas></div></div>`;
    initTooltip();
    initFocusTooltips();
  });
  it('hotbar: mouseover 显示;行元素被移除(模拟重渲染吞行)后 validateTooltip 隐藏并清空', () => {
    const slot = document.querySelector<HTMLElement>('.hb-slot')!;
    slot.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 10, clientY: 10 }));
    expect(tt().style.display).toBe('block');
    expect(tt().innerHTML).toContain('宝石');
    slot.remove();
    validateTooltip();
    expect(tt().style.display).toBe('none');
    expect(tt().innerHTML).toBe('');
  });
  it('背包: 行内 canvas 命中(.ii 路径)显示;行仍在时 validateTooltip 不隐藏(负例锁行为)', () => {
    const canvas = document.querySelector<HTMLElement>('.ii canvas[data-idx]')!;
    canvas.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 10, clientY: 10 }));
    expect(tt().style.display).toBe('block');
    expect(tt().innerHTML).toContain('面包');
    validateTooltip();
    expect(tt().style.display).toBe('block');
    expect(tt().innerHTML).toContain('面包');
  });
  it('所有权切换: hotbar mouseover 后 focusin 接管仍显示;移除焦点元素后 validateTooltip 隐藏(两锚不互相卡死)', () => {
    const slot = document.querySelector<HTMLElement>('.hb-slot')!;
    slot.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 10, clientY: 10 }));
    expect(tt().style.display).toBe('block');
    const btn = document.createElement('button');
    btn.title = '焦点说明';
    document.body.appendChild(btn);
    btn.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(tt().style.display).toBe('block'); // focus 接管,tooltip 仍显示
    expect(tt().innerHTML).toContain('焦点说明');
    btn.remove();
    validateTooltip();
    expect(tt().style.display).toBe('none');
    expect(tt().innerHTML).toBe('');
  });
});
