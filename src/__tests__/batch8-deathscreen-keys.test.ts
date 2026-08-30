// 批8: death/victory screens are keyboard-arrow navigable (parity with gamepad —
// pollGamepad's menu branch ignores gameOver; the keydown block now sits above
// the gameOver early-return).
import { describe, it, expect, beforeEach } from 'vitest';
import { initGame } from '../game.js';
import { playerDeath } from '../combat.js';

const DOM_HTML = `
  <div id="log-panel"></div>
  <div id="death-screen"><h1></h1><div id="death-stats"></div><div id="death-epitaph"></div>
    <div id="death-echoes"></div><div id="death-wardens"></div>
    <button id="btn-try-again">Try Again</button><button id="btn-death-title">Title Screen</button></div>
`;

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = DOM_HTML;
  initGame(0, 0, false);
});

describe('death screen keyboard arrows (批8)', () => {
  it('ArrowDown focuses Try Again, then Title Screen (gameOver no longer swallows arrows)', async () => {
    const { initInput } = await import('../input.js');
    initInput();
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
