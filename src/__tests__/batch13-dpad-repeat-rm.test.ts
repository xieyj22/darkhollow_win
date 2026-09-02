// 批13: two bounded fixes, one red file —
//   A) gamepad D-pad held-repeat: buttons 12-15 were edge-only (one step per
//      press) while the left stick already repeats at the walking cadence
//      (gpMoveCd=8 ≈ 480ms/step). The fix unifies buttons onto the same
//      cooldown: first press steps once and arms cd=8 (single click can never
//      double-step), then while HELD the direction repeats every time the
//      shared cooldown drains — identical rhythm to the stick.
//   B) rm enterFloor: with reduced motion the 200ms opacity fade setTimeout
//      lingered as a dead black gap (batch12 removed the CSS animation, not
//      the timer). The fix runs the transition path synchronously instead.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  G: { gameOver: false, floor: 1, player: { x: 5, y: 5 } } as any,
  invOpen: false, helpOpen: false, skillOpen: false,
  achOpen: false, talentOpen: false, eventOpen: false,
  eventActions: [] as Array<() => void>, menuOpen: false, introOpen: false,
  setGameState: vi.fn(), lang: 'zh',
  reducedMotion: true,
}));
vi.mock('../state.js', () => mockState);
vi.mock('../audio.js', () => ({ snd: () => {}, setBgmScene: () => {} }));
vi.mock('../player.js', () => ({ movePlayer: vi.fn(), pickupItem: vi.fn(), descendStairs: vi.fn(), doWait: vi.fn(), createPlayer: vi.fn(() => ({})) }));
vi.mock('../items.js', () => ({ quickQuaff: vi.fn(), quickRead: vi.fn(), useQuickSlot: vi.fn(), useItem: vi.fn(), equipItem: vi.fn(), sellItem: vi.fn(), genItem: vi.fn(() => ({})), genFood: vi.fn(() => ({})) }));
vi.mock('../skills.js', () => ({ executeSkill: vi.fn() }));
vi.mock('../save.js', () => ({ saveGame: vi.fn(), autoSave: vi.fn() }));
vi.mock('../events.js', () => ({ closeEvent: vi.fn() }));
vi.mock('../ui-panels.js', () => ({ hideOverlay: vi.fn() }));
vi.mock('../bridge.js', () => ({ bridge: { toggleLang: vi.fn(), toggleSound: vi.fn(), openPause: vi.fn(), closePause: vi.fn(), closeOptions: vi.fn(), render: vi.fn(), updateUI: vi.fn() } }));
vi.mock('../item-intro.js', () => ({ closeItemIntro: vi.fn(), queueMechanicIntro: vi.fn() }));
vi.mock('../messages.js', () => ({ addMsg: vi.fn() }));
vi.mock('../panels.js', () => ({
  openInventory: vi.fn(), closeInventory: vi.fn(), openHelp: vi.fn(), closeHelp: vi.fn(),
  tryCastSkill: vi.fn(), openSkillPanel: vi.fn(), closeSkillPanel: vi.fn(),
  openAchievements: vi.fn(), closeAchievements: vi.fn(), openTalentPanel: vi.fn(),
  closeTalentPanel: vi.fn(), sellMode: false,
}));

import { movePlayer } from '../player.js';
import { pollGamepad } from '../input.js';

// Mutable fake gamepad wired into navigator.getGamepads (batch3a/批4 fixture
// shape: standard mapping, 17 buttons).
const pad = vi.hoisted(() => ({
  buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
  axes: [0, 0] as number[],
  mapping: 'standard' as const,
}));
beforeEach(() => {
  vi.clearAllMocks();
  (navigator as any).getGamepads = () => [pad];
  pad.buttons.forEach(b => (b.pressed = false));
  pad.axes = [0, 0];
  // batch3a crib: happy-dom lays out at (0,0) — derive rects from DOM order so
  // the spatial down/up filter sees a 1-column grid (later = strictly below).
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

// ===== A) D-pad held repeat =====
describe('批13 A: gamepad D-pad held-direction repeat', () => {
  it('held D-pad down in a menu repeats focus at the walking cadence — 2nd step lands exactly 8 polls after the 1st', () => {
    document.body.innerHTML = `<div id="pause-overlay" class="overlay active">
      <button id="a">Resume</button><button id="b">Settings</button><button id="c">Quit</button></div>`;
    pollGamepad();                     // settle: all-up baseline
    pad.buttons[13].pressed = true;    // D-pad down
    pollGamepad();                     // poll 1 = edge: anchor (focus #a) + first step → #b, arms cd=8
    expect(document.activeElement!.id).toBe('b');
    for (let i = 0; i < 7; i++) pollGamepad();   // polls 2..8 — cd draining (tail decrement)
    expect(document.activeElement!.id, 'poll 8: still one step (cd armed at poll 1)').toBe('b');
    pollGamepad();                     // poll 9: cd hit 0 → repeat step (8-poll gap = 480ms)
    expect(document.activeElement!.id).toBe('c');
    pad.buttons[13].pressed = false;
    pollGamepad();
  });

  it('single click stays exactly one step', () => {
    document.body.innerHTML = `<div id="pause-overlay" class="overlay active">
      <button id="a">Resume</button><button id="b">Settings</button><button id="c">Quit</button></div>`;
    pollGamepad();
    pad.buttons[13].pressed = true;
    pollGamepad();                     // edge → #b
    pad.buttons[13].pressed = false;   // release well inside the 480ms window
    for (let i = 0; i < 3; i++) pollGamepad();
    expect(document.activeElement!.id).toBe('b');
  });

  it('gameplay: held D-pad right repeats movePlayer on the same cadence', () => {
    document.body.innerHTML = '';      // no menu context
    pollGamepad();
    pad.buttons[15].pressed = true;    // D-pad right
    pollGamepad();                     // edge → 1st step, arms cd=8
    expect(movePlayer).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 7; i++) pollGamepad();   // polls 2..8 — cooldown window
    expect(movePlayer, 'cooldown window: still 1 step').toHaveBeenCalledTimes(1);
    pollGamepad();                     // poll 9 → repeat (8-poll gap)
    expect(movePlayer).toHaveBeenCalledTimes(2);
    pad.buttons[15].pressed = false;
    pollGamepad();
  });

  it('range focused: held D-pad keeps the slider cadence and does not double-step or move focus', () => {
    document.body.innerHTML = `<div id="o" class="overlay active">
      <input type="range" id="s" min="0" max="100" step="10" value="50">
      <button id="btn">x</button></div>`;
    pollGamepad();
    pad.buttons[15].pressed = true;    // D-pad right
    pollGamepad();                     // edge → first slider step (60)
    expect((document.activeElement as HTMLInputElement).value).toBe('60');
    for (let i = 0; i < 9; i++) pollGamepad();   // slider repeat path (cd 5/1 rhythm)
    const v = (document.activeElement as HTMLInputElement).value;
    expect(document.activeElement!.id, 'focus stays on the range').toBe('s');
    expect(Number(v), 'slider stepped again under the gpSlide rhythm (≥1 more step by now)').toBeGreaterThanOrEqual(70);
    pad.buttons[15].pressed = false;
    pollGamepad();
  });

  // Review I2: a vertical tap that carries focus OFF a range input must still
  // arm the cooldown (the pre-fix code read a pre-edge-loop onRange snapshot,
  // skipped the arm, and the held-repeat double-stepped 60ms later).
  it('vertical tap leaving a slider moves focus exactly one step', () => {
    document.body.innerHTML = `<div id="o" class="overlay active">
      <input type="range" id="s" min="0" max="100" step="10" value="50">
      <button id="u">up</button></div>`;
    pollGamepad();
    pad.buttons[13].pressed = true;    // D-pad down — but the range is FIRST in
    pollGamepad();                     // DOM order, so focus anchors there and
    // the spatial move goes... anchor happens on this poll too. Set up the
    // interesting state explicitly: focus the range, then tap down.
    pad.buttons[13].pressed = false;
    pollGamepad();
    (document.getElementById('s') as HTMLInputElement).focus();
    pad.buttons[13].pressed = true;    // vertical edge FROM the range
    pollGamepad();                     // edge → focus moves off (arm now unconditional)
    expect(document.activeElement!.id).toBe('u');
    pad.buttons[13].pressed = true;    // still held one more poll (a ~120ms tap)
    pollGamepad();
    expect(document.activeElement!.id, 'held inside the arm window: no second step').toBe('u');
    pad.buttons[13].pressed = false;
    pollGamepad();
  });

  // Review I1: an overlay-opening edge on the exact poll where the walking
  // repeat's cooldown drains must NOT also step the player — that would run a
  // full enemy turn under an open overlay. bridge.openPause's real effect is
  // menuOpen=true + pause-overlay.active; the mock reproduces both.
  it('overlay opened on a drain poll: held-repeat does not step the player under it', async () => {
    const { bridge } = await import('../bridge.js');
    (bridge.openPause as any).mockImplementation(() => {
      mockState.menuOpen = true;
      const ov = document.getElementById('pause-overlay');
      ov?.classList.add('active');
    });
    document.body.innerHTML = `<div id="pause-overlay" class="overlay">
      <button id="p1">Resume</button></div>`;
    mockState.menuOpen = false;
    pollGamepad();
    pad.buttons[15].pressed = true;    // D-pad right — walking
    pollGamepad();                     // edge → step 1, arms cd=8
    expect(movePlayer).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 7; i++) pollGamepad();   // polls 2..8: cooldown drains
    // Poll 9 is the drain poll — open pause on it: Start edge + held right.
    pad.buttons[9].pressed = true;     // Start (pause) — edge fires first
    pollGamepad();
    expect(movePlayer, 'no repeat step under the just-opened overlay').toHaveBeenCalledTimes(1);
    pad.buttons[15].pressed = false;
    pad.buttons[9].pressed = false;
    pollGamepad();
    mockState.menuOpen = false;        // restore for other tests
  });
});

// ===== B) reduced-motion enterFloor =====
describe('批13 B: enterFloor under reduced motion skips the 200ms fade timer', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('rm=true: floor entry is synchronous — no fade, floor set immediately', async () => {
    mockState.reducedMotion = true;
    document.body.innerHTML = '<canvas id="game-canvas"></canvas>';
    mockState.G.floor = 1;
    const { enterFloor } = await import('../game.js');
    // NB: not asserting raw timer counts here — the REAL dependency chain
    // (dungeon/enemies/meta/combat, unmocked in this file) registers its own
    // timers while setup() runs, so counts are unstable across mock surfaces.
    // The synchronous branch is proven directly: floor lands NOW (the fade
    // path defers setup behind the 200ms timer — see the rm=false test) and
    // the canvas opacity is never driven to '0' (no black-gap flash).
    enterFloor(2, false);
    expect(mockState.G.floor).toBe(2);
    expect((document.getElementById('game-canvas') as HTMLCanvasElement).style.opacity,
      'canvas opacity untouched — no black-gap flash').toBe('');
  });

  it('rm=false: the classic 200ms fade survives untouched', async () => {
    mockState.reducedMotion = false;
    document.body.innerHTML = '<canvas id="game-canvas"></canvas>';
    mockState.G.floor = 1;
    const { enterFloor } = await import('../game.js');
    const before = vi.getTimerCount();
    enterFloor(2, false);
    expect(vi.getTimerCount(), 'exactly the one fade timer').toBe(before + 1);
    expect(mockState.G.floor, 'setup deferred until the timer fires').toBe(1);
    vi.advanceTimersByTime(200);
    expect(mockState.G.floor).toBe(2);
  });
});
