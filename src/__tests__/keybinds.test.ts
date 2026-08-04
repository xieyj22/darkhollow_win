import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../state.js', () => ({ lang: 'en' }));
import { keyToAction, buttonToAction, rebind, rebindButton, bindingFor, bindingsFor, resetKeybinds, DEFAULT_KEYS } from '../keybinds.js';

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

// ===== Task 5: multi-key rebind + gamepad rebind + bindingsFor =====

describe('bindingsFor (T5): reverse-lookup all keys', () => {
  beforeEach(() => resetKeybinds());
  it('returns all keys for multi-key actions', () => {
    expect(bindingsFor('move_up').sort()).toEqual(['arrowup', 'w']);
    expect(bindingsFor('inventory').sort()).toEqual(['b', 'i']);
  });
  it('returns single key for single-key actions', () => {
    expect(bindingsFor('pickup')).toEqual(['g']);
  });
  it('reflects current bindings after a partial rebind', () => {
    // Rebind ONLY 'w' off move_up → move_up keeps arrowup, loses w, gains z.
    rebind('move_up', 'z', 'w');
    expect(bindingsFor('move_up').sort()).toEqual(['arrowup', 'z']);
  });
});

describe('rebind with oldKey (T5): preserve multi-key siblings', () => {
  beforeEach(() => resetKeybinds());
  it('oldKey frees ONLY the specified key, preserving siblings', () => {
    // move_up defaults: w + arrowup. Rebind ONLY 'w' → 'p'.
    const r = rebind('move_up', 'p', 'w');
    expect(r.conflict).toBeUndefined();
    expect(keyToAction(ke('p'))).toBe('move_up');
    expect(keyToAction(ke('w'))).toBeNull();            // w freed
    expect(keyToAction(ke('arrowup'))).toBe('move_up'); // sibling preserved!
  });
  it('omitting oldKey still frees ALL siblings (legacy behavior)', () => {
    rebind('move_up', 'p'); // no oldKey → free-all
    expect(keyToAction(ke('p'))).toBe('move_up');
    expect(keyToAction(ke('w'))).toBeNull();
    expect(keyToAction(ke('arrowup'))).toBeNull(); // sibling also freed
  });
  it('oldKey that does not belong to the action is a no-op free', () => {
    // 'k' belongs to 'skill', not 'pickup'. Rebinding pickup with oldKey='k'
    // should NOT free 'k' from skill, but should still set the new key.
    const r = rebind('pickup', 'p', 'k'); // oldKey='k' is NOT pickup's key
    expect(r.conflict).toBeUndefined();
    expect(keyToAction(ke('p'))).toBe('pickup');
    expect(keyToAction(ke('g'))).toBe('pickup');  // g NOT freed (oldKey was 'k')
    expect(keyToAction(ke('k'))).toBe('skill');   // k still skill
  });
});

describe('rebindButton (T5): gamepad conflict detection', () => {
  beforeEach(() => resetKeybinds());
  it('rebinds a button and persists', () => {
    rebindButton('pickup', 6);
    expect(buttonToAction(6)).toBe('pickup');
    expect(JSON.parse(localStorage.getItem('dh_keybinds')!).buttons[6]).toBe('pickup');
  });
  it('frees the action previous button on rebind', () => {
    // button 2 = skill. Rebind skill to button 7 → button 2 freed.
    rebindButton('skill', 7);
    expect(buttonToAction(7)).toBe('skill');
    expect(buttonToAction(2)).toBeNull();
  });
  it('rejects occupied button with conflict', () => {
    // button 0 = wait. Try to rebind pickup to button 0.
    const r = rebindButton('pickup', 0);
    expect(r.conflict).toBe('wait');
    expect(buttonToAction(0)).toBe('wait'); // unchanged
  });
  it('rebinding action to its own button is a no-op success', () => {
    const r = rebindButton('wait', 0); // button 0 IS wait
    expect(r.conflict).toBeUndefined();
    expect(buttonToAction(0)).toBe('wait');
  });
});
