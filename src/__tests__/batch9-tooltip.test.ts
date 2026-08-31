// 批9 ⑧: 目标失效 tooltip 秒隐。焦点路径可单测（happy-dom）；鼠标路径由 battery 覆盖。
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('../state.js', () => ({ G: null, lang: 'en' }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tMsg: (k: string) => k, tx: () => 'x', rareName: () => 'r', RARITY_C: ['#888', '#8bc34a', '#4fc3f7', '#b39ddb', '#ffd700'] }));
vi.mock('../sprites.js', () => ({ paintIcon: vi.fn() }));

import { initFocusTooltips, validateTooltip } from '../ui-panels.js';

describe('批9 ⑧ tooltip 目标校验', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="tooltip" style="display:none"></div>';
    initFocusTooltips();
  });
  it('focusin 显示焦点 tooltip', () => {
    const el = document.createElement('button');
    el.title = '天赋说明';
    document.body.appendChild(el);
    el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(document.getElementById('tooltip')!.style.display).toBe('block');
  });
  it('元素被 innerHTML 重渲染移除后 validateTooltip 隐藏（无 focusout 场景）', () => {
    const el = document.createElement('button');
    el.title = '天赋说明';
    document.body.appendChild(el);
    el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    el.remove(); // 焦点静默回落 body，浏览器不派发 focusout
    validateTooltip();
    expect(document.getElementById('tooltip')!.style.display).toBe('none');
  });
  // NOTE: literal `new URL('../render.ts', import.meta.url)` gets rewritten by
  // Vite (recurring pitfall) — the dynamic `'../' + f` form is the suite-wide
  // convention for reading real source from tests.
  it('source-gate: updateUI 每回合消费 bridge.validateTooltip', () => {
    const f = 'render.ts';
    const text = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    expect(text).toContain('bridge.validateTooltip?.()');
  });
  it('source-gate: hotbar/背包 DOM 委托已接管（无原生 title 兜底）', () => {
    const f = 'ui-panels.ts';
    const text = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    expect(text).toContain("getElementById('hotbar')");
    expect(text).toContain("getElementById('inv-content')");
  });
});
