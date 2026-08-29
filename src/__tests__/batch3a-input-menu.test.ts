// Batch3A T3: pollGamepad menu-state behavior — fake gamepad injection via a
// stubbed navigator.getGamepads, real DOM buttons, edge-triggered presses.
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  G: { gameOver: false, player: { x: 5, y: 5 } } as any,
  invOpen: false, helpOpen: false, skillOpen: false,
  achOpen: false, talentOpen: false, eventOpen: false,
  eventActions: [] as Array<() => void>, menuOpen: false, introOpen: false,
}));
vi.mock('../state.js', () => mockState);
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../player.js', () => ({ movePlayer: vi.fn(), pickupItem: vi.fn(), descendStairs: vi.fn(), doWait: vi.fn() }));
vi.mock('../items.js', () => ({ quickQuaff: vi.fn(), quickRead: vi.fn(), useQuickSlot: vi.fn(), useItem: vi.fn(), equipItem: vi.fn(), sellItem: vi.fn() }));
vi.mock('../skills.js', () => ({ executeSkill: vi.fn() }));
vi.mock('../save.js', () => ({ saveGame: vi.fn() }));
vi.mock('../events.js', () => ({ closeEvent: vi.fn() }));
vi.mock('../ui-panels.js', () => ({ hideOverlay: vi.fn() }));
vi.mock('../bridge.js', () => ({ bridge: { toggleLang: vi.fn(), toggleSound: vi.fn(), openPause: vi.fn(), closePause: vi.fn(), closeOptions: vi.fn() } }));
vi.mock('../item-intro.js', () => ({ closeItemIntro: vi.fn() }));
vi.mock('../panels.js', () => ({
  openInventory: vi.fn(), closeInventory: vi.fn(), openHelp: vi.fn(), closeHelp: vi.fn(),
  tryCastSkill: vi.fn(), openSkillPanel: vi.fn(), closeSkillPanel: vi.fn(),
  openAchievements: vi.fn(), closeAchievements: vi.fn(), openTalentPanel: vi.fn(),
  closeTalentPanel: vi.fn(), sellMode: false,
}));

import { movePlayer } from '../player.js';
import { pollGamepad, initInput } from '../input.js';
import { hideOverlay } from '../ui-panels.js';
import { bridge } from '../bridge.js';

// Mutable fake gamepad wired into navigator.getGamepads.
// 批4: `mapping: 'standard'` — pollGamepad only honors standard-mapping pads
// now, so the fixture must present itself as one (a real browser Gamepad does).
const pad = vi.hoisted(() => ({
  buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
  axes: [0, 0] as number[],
  mapping: 'standard',
}));
beforeEach(() => {
  vi.clearAllMocks();
  (navigator as any).getGamepads = () => [pad];
  pad.buttons.forEach(b => (b.pressed = false));
  pad.axes = [0, 0];
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() { return document.body; }, configurable: true,
  });
  // happy-dom lays everything out at (0,0) — spatialNext's direction filter
  // ("candidate center ≥1px beyond the current center on the pressed axis")
  // would exclude every candidate. Patch getBoundingClientRect to give each
  // element a position derived from its DOM order instead: a 1-column grid
  // where every later element sits strictly BELOW the previous one. That is
  // exactly what the D-pad down/up assertions need (r before s in DOM order
  // → s below r); no assertion here depends on horizontal spatial geometry
  // (LB/RB use seqFocus, range stepping intercepts before spatialNext).
  // menuMoveFocus reads r.left/r.top/r.width/r.height.
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    get() {
      const self = this as HTMLElement;
      return () => {
        const all = Array.from(document.querySelectorAll('*'));
        const idx = Math.max(0, all.indexOf(self));
        return {
          x: 0, y: idx * 60, left: 0, top: idx * 60, width: 100, height: 40,
          right: 100, bottom: idx * 60 + 40, toJSON: () => ({}),
        };
      };
    },
  });
});

// Simulate one button edge: settle → press → settle (poll is edge-triggered).
function press(idx: number) {
  pollGamepad();                    // records all-up as previous state
  pad.buttons[idx].pressed = true;
  pollGamepad();                    // edge fires here
  pad.buttons[idx].pressed = false;
  pollGamepad();
}

describe('menu state — focus navigation', () => {
  it('D-pad down moves focus to the next button and stamps .gp-focus', () => {
    document.body.innerHTML = `<div id="pause-overlay" class="overlay active">
      <button id="r">Resume</button><button id="s">Settings</button></div>`;
    press(12);   // D-pad up — anchors initial focus (first = Resume)
    expect(document.activeElement!.id).toBe('r');
    press(13);   // D-pad down
    expect(document.activeElement!.id).toBe('s');
    expect(document.getElementById('s')!.classList.contains('gp-focus')).toBe(true);
  });

  it('A activates the focused element (click), never dispatches gameplay wait', async () => {
    let clicked = false;
    document.body.innerHTML = `<div id="pause-overlay" class="overlay active">
      <button id="r">Resume</button></div>`;
    document.getElementById('r')!.addEventListener('click', () => { clicked = true; });
    press(12);   // anchor Resume
    press(0);    // A
    expect(clicked).toBe(true);
    const { doWait } = await import('../player.js');
    expect(doWait).not.toHaveBeenCalled();
  });

  it('B in a panel calls menuBack (close ladder) instead of pickup', async () => {
    document.body.innerHTML = `<div id="records-overlay" class="overlay active"></div>`;
    press(1);
    // hideOverlay mocked in ui-panels mock — assert via menuBack effect:
    // records closed through the ladder (hideOverlay called with records-overlay)
    const { hideOverlay } = await import('../ui-panels.js');
    expect(hideOverlay).toHaveBeenCalledWith('records-overlay');
  });

  it('LB/RB move focus sequentially', () => {
    document.body.innerHTML = `<div id="x" class="overlay active">
      <button>1</button><button>2</button><button>3</button></div>`;
    press(4);   // LB → last
    expect(document.activeElement!.textContent).toBe('3');
    press(5);   // RB → first
    expect(document.activeElement!.textContent).toBe('1');
  });

  it('left/right on a focused range input steps its value instead of moving focus', () => {
    document.body.innerHTML = `<div id="o" class="overlay active">
      <input type="range" id="s" min="0" max="100" step="10" value="50">
      <button id="b">x</button></div>`;
    press(12);   // anchor on first focusable = the range
    expect((document.activeElement as HTMLInputElement).type).toBe('range');
    press(15);   // D-pad right
    expect((document.getElementById('s') as HTMLInputElement).value).toBe('60');
    expect(document.activeElement!.id).toBe('s');   // focus did NOT move
  });

  it('gameOver with a visible death screen still navigates (menu branch precedes the gate)', () => {
    mockState.G.gameOver = true;
    try {
      document.body.innerHTML = `<div id="death-screen" style="display:flex">
        <button id="try">Try Again</button></div>`;
      press(12);
      expect(document.activeElement!.id).toBe('try');
    } finally {
      mockState.G.gameOver = false;   // never leak into the next test
    }
  });

  it('gameplay state unchanged: no menu → D-pad still calls movePlayer', () => {
    document.body.innerHTML = `<div id="title-screen" style="display:none"></div>`;
    press(12);
    expect(movePlayer).toHaveBeenCalledWith(0, -1);
  });
});

describe('ending-choice keyboard gate — Tab enclosed, all other keys gated', () => {
  // Register the REAL keydown listener exactly once for the file (calling
  // initInput per test would stack listeners and double-wrap Tab). This also
  // starts the 60ms pollGamepad interval — harmless: the fake pad reports
  // all-up and focus stays inside the popup, so no dispatch ever fires.
  // This describe runs last, so the listener never touches earlier tests.
  beforeAll(() => { initInput(); });

  function key(k: string, shiftKey = false): KeyboardEvent {
    return new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true, cancelable: true });
  }

  it('Tab wraps within #ending-choice — never escapes the popup', () => {
    document.body.innerHTML = `<div id="ending-choice" class="overlay active">
      <button id="slay">Slay</button><button id="refuse">Refuse</button></div>`;
    const ec = document.getElementById('ending-choice')!;
    // Last button + Tab → wraps to first, still inside the popup.
    document.getElementById('refuse')!.focus();
    document.dispatchEvent(key('Tab'));
    expect(document.activeElement!.id).toBe('slay');
    expect(ec.contains(document.activeElement)).toBe(true);
    // First button + Shift+Tab → wraps to last.
    document.dispatchEvent(key('Tab', true));
    expect(document.activeElement!.id).toBe('refuse');
    expect(ec.contains(document.activeElement)).toBe(true);
  });

  it('Enter is prevented and gameplay keys do not leak through the gate', () => {
    document.body.innerHTML = `<div id="ending-choice" class="overlay active">
      <button id="slay">Slay</button><button id="refuse">Refuse</button></div>`;
    document.getElementById('slay')!.focus();
    const ev = key('Enter');
    document.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    // Movement must NOT dispatch while the mandatory Slay/Refuse popup is up.
    document.dispatchEvent(key('w'));
    expect(movePlayer).not.toHaveBeenCalled();
  });
});

// 批4: pollGamepad must only honor standard-mapping pads. Browsers report null
// slots for disconnected pads and some legacy DirectInput pads expose scrambled
// layouts — reading pads[0] blindly dispatches garbage from either.
// Gameplay-state DOM (hidden title-screen, same as the gameplay test above) so
// held axes dispatch movePlayer — that is the observable the first case pins.
describe('批4: standard-mapping gamepad filter', () => {
  it('ignores a non-standard pad entirely (axes held → no dispatch)', () => {
    document.body.innerHTML = '<div id="title-screen" style="display:none"></div>';
    const bad = { buttons: Array.from({ length: 17 }, () => ({ pressed: false })), axes: [1, 0], mapping: 'dinput' };
    (navigator as any).getGamepads = () => [bad];
    pollGamepad();
    expect(movePlayer).not.toHaveBeenCalled();
  });
  it('skips null entries: first standard pad wins', () => {
    document.body.innerHTML = '<div id="title-screen" style="display:none"></div>';
    (navigator as any).getGamepads = () => [null, pad];
    pad.axes = [1, 0];
    pollGamepad();
    expect(movePlayer).toHaveBeenCalled();
    pad.axes = [0, 0];
  });
});

// 批4: keyboard ESC closes records/codex overlays — parity with gamepad B,
// which closes them via closeActiveOverlay's tail. The keydown listener is the
// one the ending-choice describe above already registered via initInput().
describe('批4: keyboard ESC closes records/codex (parity with gamepad B)', () => {
  it('records-overlay active → ESC hides it, does not open pause', () => {
    document.body.innerHTML = '<div id="records-overlay" class="overlay active"></div>';
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(hideOverlay).toHaveBeenCalledWith('records-overlay');
    expect(bridge.openPause).not.toHaveBeenCalled();
  });
  it('nothing open → ESC still opens pause (regression guard)', () => {
    document.body.innerHTML = '';
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(bridge.openPause).toHaveBeenCalled();
  });
});
