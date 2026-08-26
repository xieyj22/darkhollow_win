// src/__tests__/batch3a-menu-context.test.ts
// Batch3A T2: menu-context detection priority + context-appropriate back.
// Follows input.test.ts mock-set conventions (all closers mocked).
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  G: null as any, invOpen: false, helpOpen: false, skillOpen: false,
  achOpen: false, talentOpen: false, eventOpen: false,
  eventActions: [] as Array<() => void>, menuOpen: false, introOpen: false,
}));
vi.mock('../state.js', () => mockState);
vi.mock('../events.js', () => ({ closeEvent: vi.fn() }));
vi.mock('../ui-panels.js', () => ({ hideOverlay: vi.fn() }));
vi.mock('../bridge.js', () => ({ bridge: { closeOptions: vi.fn(), openPause: vi.fn(), closePause: vi.fn() } }));
vi.mock('../item-intro.js', () => ({ closeItemIntro: vi.fn() }));
vi.mock('../panels.js', () => ({
  closeInventory: vi.fn(), closeSkillPanel: vi.fn(), closeAchievements: vi.fn(),
  closeTalentPanel: vi.fn(), closeHelp: vi.fn(),
}));

import { activeMenuContext, menuBack, closeActiveOverlay } from '../menu-context.js';
import { hideOverlay } from '../ui-panels.js';
import { closeEvent } from '../events.js';

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
  mockState.invOpen = mockState.helpOpen = mockState.skillOpen = false;
  mockState.achOpen = mockState.talentOpen = mockState.eventOpen = false;
  mockState.menuOpen = mockState.introOpen = false;
});

describe('activeMenuContext priority', () => {
  it('returns the first .overlay.active (incl. ending-choice / records / codex)', () => {
    // (title-screen hidden — matches the real DOM when ending-choice is up; the
    //  priority chain deliberately places ending-choice BEHIND visible screens.)
    document.body.innerHTML = `<div id="ending-choice" class="overlay active"><button>Slay</button></div>
      <div id="title-screen" style="display:none"><button>New Game</button></div>`;
    expect(activeMenuContext()!.id).toBe('ending-choice');
  });
  it('falls through to event-popup / char-sel / title / death / victory by visibility', () => {
    document.body.innerHTML = `<div id="title-screen" style="display:flex"></div>`;
    expect(activeMenuContext()!.id).toBe('title-screen');
    document.body.innerHTML = `<div id="char-sel"><button>Begin</button></div>`;
    expect(activeMenuContext()!.id).toBe('char-sel');
    document.body.innerHTML = `<div id="death-screen" style="display:flex"></div><div id="title-screen" style="display:none"></div>`;
    expect(activeMenuContext()!.id).toBe('death-screen');
    document.body.innerHTML = `<div id="event-popup" style="display:block"></div>`;
    expect(activeMenuContext()!.id).toBe('event-popup');
    document.body.innerHTML = ``;
    expect(activeMenuContext()).toBeNull();
  });
});

describe('menuBack', () => {
  it('overlay → generalized close ladder (records via hideOverlay)', () => {
    document.body.innerHTML = `<div id="records-overlay" class="overlay active"></div>`;
    expect(menuBack()).toBe(true);
    expect(hideOverlay).toHaveBeenCalledWith('records-overlay');
  });
  it('event popup visible but flag desynced → closeEvent directly', () => {
    document.body.innerHTML = `<div id="event-popup" style="display:block"></div>`;
    expect(menuBack()).toBe(true);
    expect(closeEvent).toHaveBeenCalled();
  });
  it('char-sel → clicks #char-back-btn', () => {
    document.body.innerHTML = `<div id="char-sel"><button id="char-back-btn">Back</button></div>`;
    expect(menuBack()).toBe(true);
  });
  it('title / death / victory → false (B is a no-op; A on buttons is the exit)', () => {
    document.body.innerHTML = `<div id="death-screen" style="display:flex"></div>`;
    expect(menuBack()).toBe(false);
  });
});

describe('closeActiveOverlay ladder (migrated from input.ts)', () => {
  it('inventory flag → closeInventory; forge visible → hideOverlay(forge-overlay)', () => {
    mockState.invOpen = true;
    expect(closeActiveOverlay()).toBe(true);
    mockState.invOpen = false;
    document.body.innerHTML = `<div id="forge-overlay" style="display:flex"></div>`;
    expect(closeActiveOverlay()).toBe(true);
    expect(hideOverlay).toHaveBeenCalledWith('forge-overlay');
  });
  it('codex tier mirrors records: .active → hideOverlay(codex-overlay)', () => {
    document.body.innerHTML = `<div id="codex-overlay" class="overlay active"></div>`;
    expect(closeActiveOverlay()).toBe(true);
    expect(hideOverlay).toHaveBeenCalledWith('codex-overlay');
  });
  it('never closes ending-choice even though it is .overlay.active', () => {
    document.body.innerHTML = `<div id="ending-choice" class="overlay active"></div>`;
    expect(closeActiveOverlay()).toBe(false);
  });
});
