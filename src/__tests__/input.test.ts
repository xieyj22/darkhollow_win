// Focused tests for the table-driven keybind dispatch extracted from input.ts.
// Verifies the action→side-effect mapping for both keyboard (dispatchKeyboardAction)
// and gamepad (dispatchGamepadAction), including the overlay-gating and the
// gamepad-B (overlay_close) "close else pickup" ruling.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mutable state mock — vi.hoisted so the factory returns the same object reference
// and tests can toggle overlay flags for closeActiveOverlay coverage.
const mockState = vi.hoisted(() => ({
  G: null as any,
  invOpen: false, helpOpen: false, skillOpen: false,
  achOpen: false, talentOpen: false, eventOpen: false,
  eventActions: [] as Array<() => void>, menuOpen: false, introOpen: false,
}));
vi.mock('../state.js', () => mockState);
vi.mock('../audio.js', () => ({ snd: () => {} }));

// Inline factories (hoisted by vitest) — import the mocked fns below to assert calls.
vi.mock('../player.js', () => ({
  movePlayer: vi.fn(), pickupItem: vi.fn(), descendStairs: vi.fn(), doWait: vi.fn(),
}));
vi.mock('../items.js', () => ({
  quickQuaff: vi.fn(), quickRead: vi.fn(), useQuickSlot: vi.fn(),
  useItem: vi.fn(), equipItem: vi.fn(), sellItem: vi.fn(),
}));
vi.mock('../skills.js', () => ({ executeSkill: vi.fn() }));
vi.mock('../save.js', () => ({ saveGame: vi.fn() }));
vi.mock('../events.js', () => ({ closeEvent: vi.fn() }));
vi.mock('../ui-panels.js', () => ({ hideOverlay: vi.fn() }));
vi.mock('../bridge.js', () => ({
  bridge: { toggleLang: vi.fn(), toggleSound: vi.fn(), openPause: vi.fn(), closePause: vi.fn(), closeOptions: vi.fn() },
}));
vi.mock('../item-intro.js', () => ({ closeItemIntro: vi.fn() }));
vi.mock('../panels.js', () => ({
  openInventory: vi.fn(), closeInventory: vi.fn(),
  openHelp: vi.fn(), closeHelp: vi.fn(),
  tryCastSkill: vi.fn(), openSkillPanel: vi.fn(), closeSkillPanel: vi.fn(),
  openAchievements: vi.fn(), closeAchievements: vi.fn(),
  openTalentPanel: vi.fn(), closeTalentPanel: vi.fn(),
  sellMode: false,
}));

import { movePlayer, pickupItem, descendStairs, doWait } from '../player.js';
import { quickQuaff, quickRead, useQuickSlot } from '../items.js';
import { openInventory, closeInventory, openHelp, tryCastSkill, openAchievements, openTalentPanel, openSkillPanel, closeSkillPanel } from '../panels.js';
import { bridge } from '../bridge.js';
import { dispatchKeyboardAction, dispatchGamepadAction } from '../input.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockState.invOpen = false; mockState.menuOpen = false; mockState.introOpen = false;
  mockState.helpOpen = false; mockState.skillOpen = false; mockState.achOpen = false;
  mockState.talentOpen = false; mockState.eventOpen = false;
});

describe('dispatchKeyboardAction — action → side-effect mapping', () => {
  it('movement actions call movePlayer with correct deltas', () => {
    dispatchKeyboardAction('move_up');    expect(movePlayer).toHaveBeenCalledWith(0, -1);
    dispatchKeyboardAction('move_down');  expect(movePlayer).toHaveBeenCalledWith(0, 1);
    dispatchKeyboardAction('move_left');  expect(movePlayer).toHaveBeenCalledWith(-1, 0);
    dispatchKeyboardAction('move_right'); expect(movePlayer).toHaveBeenCalledWith(1, 0);
  });
  it('gameplay actions dispatch to the right function', () => {
    dispatchKeyboardAction('pickup');    expect(pickupItem).toHaveBeenCalled();
    dispatchKeyboardAction('descend');   expect(descendStairs).toHaveBeenCalled();
    dispatchKeyboardAction('wait');      expect(doWait).toHaveBeenCalled();
    dispatchKeyboardAction('inventory'); expect(openInventory).toHaveBeenCalled();
    dispatchKeyboardAction('quaff');     expect(quickQuaff).toHaveBeenCalled();
    dispatchKeyboardAction('read');      expect(quickRead).toHaveBeenCalled();
    dispatchKeyboardAction('help');      expect(openHelp).toHaveBeenCalled();
    dispatchKeyboardAction('skill');     expect(tryCastSkill).toHaveBeenCalled();
    dispatchKeyboardAction('achieve');   expect(openAchievements).toHaveBeenCalled();
    dispatchKeyboardAction('talent');    expect(openTalentPanel).toHaveBeenCalled();
  });
  it('quick slots map to useQuickSlot indices 0-8', () => {
    for (let n = 1; n <= 9; n++) {
      dispatchKeyboardAction(`quick${n}` as any);
      expect(useQuickSlot).toHaveBeenCalledWith(n - 1);
    }
  });
  it('lang and mute route to bridge toggles', () => {
    dispatchKeyboardAction('lang'); expect(bridge.toggleLang).toHaveBeenCalled();
    dispatchKeyboardAction('mute'); expect(bridge.toggleSound).toHaveBeenCalled();
  });
});

describe('dispatchGamepadAction — overlay gating', () => {
  it('move only fires when !overlay', () => {
    dispatchGamepadAction('move_up', false);
    expect(movePlayer).toHaveBeenCalledWith(0, -1);
    movePlayer.mockClear();
    dispatchGamepadAction('move_up', true);
    expect(movePlayer).not.toHaveBeenCalled();
  });
  it('wait (A) only fires when !overlay', () => {
    dispatchGamepadAction('wait', false); expect(doWait).toHaveBeenCalled();
    doWait.mockClear();
    dispatchGamepadAction('wait', true);  expect(doWait).not.toHaveBeenCalled();
  });
  it('skill/inventory/quaff/descend only fire when !overlay', () => {
    dispatchGamepadAction('skill', false);     expect(openSkillPanel).toHaveBeenCalled();
    dispatchGamepadAction('inventory', false);  expect(openInventory).toHaveBeenCalled();
    dispatchGamepadAction('quaff', false);      expect(quickQuaff).toHaveBeenCalled();
    dispatchGamepadAction('descend', false);    expect(descendStairs).toHaveBeenCalled();
    openSkillPanel.mockClear();
    dispatchGamepadAction('skill', true);
    expect(openSkillPanel).not.toHaveBeenCalled();
  });
  it('pause (Start) opens pause when menuOpen is false', () => {
    dispatchGamepadAction('pause', false);
    expect(bridge.openPause).toHaveBeenCalled();
    expect(bridge.closePause).not.toHaveBeenCalled();
  });
  it('pause closes pause when menuOpen is true', () => {
    mockState.menuOpen = true;
    dispatchGamepadAction('pause', false);
    expect(bridge.closePause).toHaveBeenCalled();
    mockState.menuOpen = false;
  });
});

describe('dispatchGamepadAction — overlay_close (B): close-else-pickup ruling', () => {
  it('picks up item when no overlay is open (!overlay)', () => {
    dispatchGamepadAction('overlay_close', false);
    expect(pickupItem).toHaveBeenCalled();
  });
  it('closes the overlay (no pickup) when an overlay is open', () => {
    mockState.invOpen = true;
    dispatchGamepadAction('overlay_close', true);
    expect(closeInventory).toHaveBeenCalled();
    expect(pickupItem).not.toHaveBeenCalled();
  });
  it('does not pick up when overlay=true even if closeActiveOverlay returns false', () => {
    // overlay=true but no specific overlay flag set — closeActiveOverlay returns false,
    // but the `&& !overlay` guard still prevents pickup (preserves original behavior).
    dispatchGamepadAction('overlay_close', true);
    expect(pickupItem).not.toHaveBeenCalled();
  });
});
