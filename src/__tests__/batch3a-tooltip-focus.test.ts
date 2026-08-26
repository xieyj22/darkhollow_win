// src/__tests__/batch3a-tooltip-focus.test.ts
// Batch3A T5: focusing any [title]-bearing element shows the shared #tooltip
// div (escaped, \n → <br>); blur hides it. Mouse-hover path untouched.
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ui-panels imports — minimal mock set (state/i18n/bridge), same conventions
// as events-checkTiles.test.ts.
vi.mock('../state.js', () => ({
  G: null, setInvOpen: () => {}, setHelpOpen: () => {}, setSkillOpen: () => {},
  setAchOpen: () => {}, setTalentOpen: () => {}, setEventOpen: () => {},
  setMenuOpen: () => {}, setIntroOpen: () => {}, setLang: () => {},
  lang: 'en', reducedMotion: false,
}));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tx: (v: { en: string }) => v.en }));
vi.mock('../bridge.js', () => ({ bridge: {} }));

import { initFocusTooltips } from '../ui-panels.js';

beforeEach(() => {
  document.body.innerHTML = `<div id="tooltip"></div>
    <button id="a" title="Line1
Line2">a</button><button id="b">b</button><button id="c" title="">c</button>`;
  initFocusTooltips();
});

describe('focus-triggered tooltip', () => {
  it('focusin on a titled element shows #tooltip with escaped, line-broken text', () => {
    document.getElementById('a')!.focus();
    const tt = document.getElementById('tooltip')!;
    expect(tt.style.display).toBe('block');
    expect(tt.innerHTML).toContain('Line1<br>Line2');
  });
  it('focusout hides it; empty-title and title-less elements never show it', () => {
    document.getElementById('a')!.focus();
    document.getElementById('b')!.focus();
    expect(document.getElementById('tooltip')!.style.display).toBe('none');
    document.getElementById('c')!.focus();
    expect(document.getElementById('tooltip')!.style.display).toBe('none');
  });
});
