// 批8: death/victory screens are keyboard-arrow navigable (parity with gamepad —
// pollGamepad's menu branch ignores gameOver; the keydown block now sits above
// the gameOver early-return).
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { initGame } from '../game.js';
import { playerDeath } from '../combat.js';

const DOM_HTML = `
  <div id="log-panel"></div>
  <div id="death-screen"><h1></h1><div id="death-stats"></div><div id="death-epitaph"></div>
    <div id="death-echoes"></div><div id="death-wardens"></div>
    <button id="btn-try-again">Try Again</button><button id="btn-death-title">Title Screen</button></div>
  <div id="victory-screen"><h1></h1><div id="vic-stats"></div><div id="vic-echoes"></div>
    <button id="btn-play-again">Play Again</button><button id="btn-vic-title">Title Screen</button></div>
`;

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = DOM_HTML;
  initGame(0, 0, false);
});

// initInput has no idempotence guard (批7 review M3) — attach once per file.
beforeAll(async () => { const { initInput } = await import('../input.js'); initInput(); });

describe('death screen keyboard arrows (批8)', () => {
  it('ArrowDown focuses Try Again, then Title Screen (gameOver no longer swallows arrows)', () => {
    playerDeath('X', 'trap');   // gameOver=true, #death-screen display:flex via playerDeath
    const tryAgain = document.getElementById('btn-try-again') as HTMLElement;
    const title = document.getElementById('btn-death-title') as HTMLElement;
    // happy-dom quirk: offsetParent is null for everything — stub for focusablesIn.
    for (const b of [tryAgain, title]) Object.defineProperty(b, 'offsetParent', { get: () => document.body, configurable: true });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(tryAgain);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(title);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(tryAgain);
  });
});

describe('victory screen keyboard arrows (批8 review M1 — same path, pinned anyway)', () => {
  it('ArrowDown focuses Play Again on the victory screen', () => {
    document.getElementById('death-screen')!.style.display = 'none';
    document.getElementById('victory-screen')!.style.display = 'flex';
    const play = document.getElementById('btn-play-again') as HTMLElement;
    Object.defineProperty(play, 'offsetParent', { get: () => document.body, configurable: true });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(play);
  });
});
