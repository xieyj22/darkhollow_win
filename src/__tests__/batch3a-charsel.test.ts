// Batch3A T4: char-select options are focusable (tabindex+role) and keyboard-
// activable (Enter/Space), aria-pressed tracks selection, deps fire on buttons.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../data.js', () => ({
  RACES: [
    { name: { en: 'Human', zh: '人' }, desc: { en: 'd', zh: 'd' } },
    { name: { en: 'Dwarf', zh: '矮' }, desc: { en: 'd', zh: 'd' } },
  ],
  CLASSES: [
    { name: { en: 'Warrior', zh: '战' }, desc: { en: 'd', zh: 'd' }, skill: { name: { en: 'Bash', zh: '击' }, desc: { en: 's', zh: 's' } } },
    { name: { en: 'Mage', zh: '法' }, desc: { en: 'd', zh: 'd' }, skill: { name: { en: 'Zap', zh: '雷' }, desc: { en: 's', zh: 's' } } },
  ],
}));
vi.mock('../i18n.js', () => ({
  t: (k: string) => k,
  tx: (v: { en: string }) => v.en,
}));

import { showCharSelect } from '../char-select.js';

beforeEach(() => { document.body.innerHTML = ''; });

function open() {
  const deps = { onStart: vi.fn(), onBack: vi.fn() };
  showCharSelect(deps);
  return deps;
}

describe('char-select focusability', () => {
  it('options carry tabindex=0 role=button; aria-pressed reflects default selection', () => {
    open();
    const race = document.querySelectorAll('.race-opt') as NodeListOf<HTMLElement>;
    expect(race.length).toBe(2);
    expect(race[0].getAttribute('tabindex')).toBe('0');
    expect(race[0].getAttribute('role')).toBe('button');
    expect(race[0].getAttribute('aria-pressed')).toBe('true');
    expect(race[1].getAttribute('aria-pressed')).toBe('false');
  });
  it('Enter and Space activate the focused option; selection syncs aria-pressed', () => {
    const deps = open();
    const mage = document.querySelectorAll('.class-opt')[1] as HTMLElement;
    mage.focus();
    mage.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(mage.getAttribute('aria-pressed')).toBe('true');
    const warrior = document.querySelectorAll('.class-opt')[0] as HTMLElement;
    warrior.focus();
    warrior.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(warrior.getAttribute('aria-pressed')).toBe('true');
    expect(mage.getAttribute('aria-pressed')).toBe('false');
    document.getElementById('start-btn')!.click();
    expect(deps.onStart).toHaveBeenCalledWith(0, 0, false);
  });
  it('mode toggle flips endless param; back button fires onBack', () => {
    const deps = open();
    (document.querySelectorAll('.mode-opt')[1] as HTMLElement).click();
    document.getElementById('start-btn')!.click();
    expect(deps.onStart).toHaveBeenCalledWith(0, 0, true);
    const deps2 = open();   // start removed the overlay; reopen for the back leg
    document.getElementById('char-back-btn')!.click();
    expect(deps2.onBack).toHaveBeenCalled();
    expect(document.getElementById('char-sel')).toBeNull();   // overlay removed
  });
});
