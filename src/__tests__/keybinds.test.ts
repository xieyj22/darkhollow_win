import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../state.js', () => ({ lang: 'en' }));
import { keyToAction, buttonToAction, rebind, bindingFor, resetKeybinds, DEFAULT_KEYS } from '../keybinds.js';

const ke = (key: string, ctrl = false) => ({ key, ctrlKey: ctrl, toLowerCase: () => key.toLowerCase() } as any);

beforeEach(() => localStorage.clear());

describe('keybinds default mapping (behavior-equivalent)', () => {
  it('movement keys', () => {
    expect(keyToAction(ke('w'))).toBe('move_up'); expect(keyToAction(ke('arrowup'))).toBe('move_up');
    expect(keyToAction(ke('d'))).toBe('move_right'); expect(keyToAction(ke('arrowright'))).toBe('move_right');
  });
  it('gameplay actions', () => {
    expect(keyToAction(ke('g'))).toBe('pickup'); expect(keyToAction(ke('i'))).toBe('inventory');
    expect(keyToAction(ke('b'))).toBe('inventory'); expect(keyToAction(ke('k'))).toBe('skill');
    expect(keyToAction(ke('escape'))).toBe('overlay_close');
  });
  it('quick slots 1-9', () => {
    for (let n=1;n<=9;n++) expect(keyToAction(ke(String(n)))).toBe(`quick${n}` as any);
  });
  it('gamepad buttons', () => {
    expect(buttonToAction(12)).toBe('move_up'); expect(buttonToAction(1)).toBe('overlay_close');
    expect(buttonToAction(0)).toBe('wait'); expect(buttonToAction(9)).toBe('pause');
  });
});
describe('rebind + conflict', () => {
  it('rebind changes mapping and persists', () => {
    rebind('pickup', 'p'); expect(keyToAction(ke('p'))).toBe('pickup');
    expect(keyToAction(ke('g'))).toBeNull(); // g freed
    expect(JSON.parse(localStorage.getItem('dh_keybinds')!).keys.p).toBe('pickup');
  });
  it('rebind onto an occupied key is rejected (returns conflict)', () => {
    const r = rebind('pickup', 'k'); // k is skill
    expect(r.conflict).toBe('skill'); expect(keyToAction(ke('k'))).toBe('skill'); // unchanged
  });
  it('resetKeybinds restores defaults', () => {
    rebind('pickup','p'); resetKeybinds(); expect(keyToAction(ke('g'))).toBe('pickup');
  });
});
