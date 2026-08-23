import { describe, it, expect, vi, beforeEach } from 'vitest';
// Expanded mocks: settings.ts (imported transitively by options.ts) references
// many state.js/audio.js exports at module-evaluation time (SETTING_DEFS).
vi.mock('../audio.js', () => ({
  snd: () => {},
  isMuted: () => false, setMutedState: () => {},
  getMasterVol: () => 0.9, setMasterVol: () => {},
  getMusicVol: () => 0.45, setMusicVol: () => {},
  getSfxVol: () => 0.9, setSfxVol: () => {},
}));
vi.mock('../state.js', () => ({
  lang: 'en', setLang: () => {},
  uiZoom: 1, setUiZoom: () => {},
  minimapScale: 3, setMinimapScale: () => {},
  reducedMotion: false, setReducedMotion: () => {},
  safeZone: 16, setSafeZone: () => {},
  shakeScale: 1, setShakeScale: () => {},
  textScale: 1, setTextScale: () => {},
  colorblind: 'off', setColorblind: () => {},
  barCues: true, setBarCues: () => {},
  introEnabled: true, setIntroEnabled: () => {},
  legendVisible: false, keysVisible: false,
  hc: false, setHc: () => {},
}));
// Mocks for options.ts transitive deps so closeOptions can be imported.
vi.mock('../config.js', () => ({ MW: 64, MH: 64 }));
vi.mock('../render.js', () => ({ renderMinimap: () => {} }));
vi.mock('../ui-panels.js', () => ({
  showOverlay: () => {}, hideOverlay: () => {},
  toggleLegend: () => {}, toggleKeys: () => {},
}));
import { keyToAction, buttonToAction, rebind, rebindButton, bindingFor, bindingsFor, buttonBindingsFor, gamepadBtnLabel, loadKeybinds, resetKeybinds, getCapturing, setCapturing, DEFAULT_KEYS, DEFAULT_BUTTONS } from '../keybinds.js';
import { closeOptions } from '../options.js';

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

describe('buttonBindingsFor (T5 fix): reverse-lookup gamepad labels', () => {
  beforeEach(() => resetKeybinds());
  it('returns friendly labels for default button bindings', () => {
    expect(buttonBindingsFor('move_up')).toEqual(['D-pad↑']);
    expect(buttonBindingsFor('wait')).toEqual(['A']);
    expect(buttonBindingsFor('overlay_close')).toEqual(['B']);
    expect(buttonBindingsFor('pause')).toEqual(['Start']);
  });
  it('reflects rebinds as friendly labels', () => {
    rebindButton('pickup', 6); // LT
    expect(buttonBindingsFor('pickup')).toEqual(['LT']);
  });
  it('returns empty array for actions with no button binding', () => {
    expect(buttonBindingsFor('help')).toEqual([]);
    expect(buttonBindingsFor('pickup')).toEqual([]);
  });
});

describe('loadKeybinds (T5 fix): persisted bindings survive reload', () => {
  beforeEach(() => { localStorage.clear(); resetKeybinds(); });

  it('loads a stored keyboard rebind so keyToAction reflects it', () => {
    // Simulate a saved rebind: pickup moved from 'g' to 'p'. A real rebind
    // frees 'g' before saving, so the stored map has 'p' but NOT 'g'.
    const savedKeys = { ...DEFAULT_KEYS };
    delete savedKeys.g;  // g was freed by the rebind that produced this save
    (savedKeys as any).p = 'pickup';
    localStorage.setItem('dh_keybinds', JSON.stringify({
      keys: savedKeys,
      buttons: { ...DEFAULT_BUTTONS },
    }));
    // Before load, defaults are active (g→pickup, p→null).
    expect(keyToAction(ke('g'))).toBe('pickup');
    expect(keyToAction(ke('p'))).toBeNull();
    loadKeybinds();
    // After load, the stored map takes over verbatim: p→pickup, g absent.
    expect(keyToAction(ke('p'))).toBe('pickup');
    expect(keyToAction(ke('g'))).toBeNull();
  });

  it('loads a stored gamepad rebind so buttonToAction reflects it', () => {
    localStorage.setItem('dh_keybinds', JSON.stringify({
      keys: {},
      buttons: { 6: 'pickup' }, // LT → pickup
    }));
    loadKeybinds();
    expect(buttonToAction(6)).toBe('pickup');
    // The stored map is used verbatim — buttons NOT in the save are unbound.
    expect(buttonToAction(0)).toBeNull(); // A (wait in defaults) is absent
  });

  it('falls back to defaults on corrupt localStorage data', () => {
    localStorage.setItem('dh_keybinds', 'not valid json{{{');
    loadKeybinds();
    expect(keyToAction(ke('g'))).toBe('pickup'); // default restored
    expect(buttonToAction(0)).toBe('wait');
  });

  it('falls back to defaults when no save exists', () => {
    localStorage.clear(); // beforeEach's resetKeybinds() writes defaults; clear for a true empty test
    loadKeybinds();
    expect(keyToAction(ke('g'))).toBe('pickup');
    expect(buttonToAction(12)).toBe('move_up');
  });
});

describe('gamepadBtnLabel (review fix): shared button labels', () => {
  it('maps standard indices to Xbox-layout labels', () => {
    expect(gamepadBtnLabel(0)).toBe('A');
    expect(gamepadBtnLabel(1)).toBe('B');
    expect(gamepadBtnLabel(4)).toBe('LB');
    expect(gamepadBtnLabel(12)).toBe('D-pad↑');
  });
  it('falls back to B<index> for non-standard indices', () => {
    expect(gamepadBtnLabel(16)).toBe('B16');
    expect(gamepadBtnLabel(99)).toBe('B99');
  });
});

describe('capture flag cleanup on options close (review fix: Important #1)', () => {
  beforeEach(() => resetKeybinds());

  it('closeOptions clears an in-flight capture flag', () => {
    setCapturing('move_up');
    expect(getCapturing()).toBe('move_up');
    closeOptions();
    expect(getCapturing()).toBeNull();
  });

  it('after closeOptions, bindings are unchanged (no silent rebind)', () => {
    setCapturing('move_up');
    closeOptions();
    // Capture cleared → a gameplay keypress hits normal dispatch, not rebind.
    // Bindings remain at defaults.
    expect(keyToAction(ke('w'))).toBe('move_up');
    expect(keyToAction(ke('arrowup'))).toBe('move_up');
    expect(keyToAction(ke('g'))).toBe('pickup');
  });
});
