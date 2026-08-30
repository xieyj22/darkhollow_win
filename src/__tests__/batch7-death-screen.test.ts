// 批7 T1: death screen trio (epitaph / fallen wardens / event-popup cleanup).
import { describe, it, expect, beforeEach } from 'vitest';
import { initGame } from '../game.js';
import { setEventOpen, setLang } from '../state.js';
import { playerDeath } from '../combat.js';
import { closeEvent } from '../events.js';
import { bridge } from '../bridge.js';
import { getMeta, saveMeta } from '../meta.js';

// Same convention as combat.test.ts: tests carry their own DOM shell
// (happy-dom has no index.html). Elements the death path touches.
const DOM_HTML = `
  <div id="log-panel"></div>
  <div id="death-screen"></div><div id="death-stats"></div>
  <div id="death-epitaph"></div><div id="death-echoes"></div><div id="death-wardens"></div>
  <div id="event-popup"></div>
`;

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = DOM_HTML;
  setLang('zh');                    // quoteFlavor renders 「」 only in zh
  bridge.closeEvent = closeEvent;   // main.ts wires this in the real app; tests bring their own
  initGame(0, 0, false);
});

describe('death screen trio (批7 A + D)', () => {
  it('epitaph block renders template line + quoted flavor', () => {
    playerDeath('测试杀手', 'trap');
    const ep = document.getElementById('death-epitaph')!;
    expect(ep.querySelector('.ep-line')!.textContent).toContain('测试杀手');
    expect(ep.querySelector('.ep-flavor')!.textContent!).toMatch(/^「.+」$/);
  });
  it('renders last 5 fallen wardens with +N overflow row', () => {
    const m = getMeta();
    // recordWardenLegacy unshifts (newest first) — seed the same way.
    for (let i = 0; i < 7; i++) m.wardens.unshift({ name: `陨者${i}`, cls: 0, race: 0, floor: 10 + i, ts: 1 });
    saveMeta(m);                    // getMeta() re-parses localStorage — seed must persist
    playerDeath('X');
    const rows = [...document.querySelectorAll('#death-wardens .epw-row')];
    expect(rows.length).toBe(6);                      // 5 entries + overflow
    expect(rows[0].textContent).toContain('F16');     // newest of the shown five
    expect(rows[4].textContent).toContain('F12');
    expect(rows[5].textContent).toBe('+2');
    expect(document.querySelector('#death-wardens .epw-title')!.textContent).toBeTruthy();
  });
  it('empty wardens list renders nothing (no orphan header)', () => {
    playerDeath('X');
    expect(document.getElementById('death-wardens')!.innerHTML).toBe('');
  });
  it('event popup open at death is closed (批4 backlog: residue)', () => {
    setEventOpen(true);
    document.getElementById('event-popup')!.style.display = 'block';
    playerDeath('X', 'trap');
    expect(document.getElementById('event-popup')!.style.display).toBe('none');
  });
});
