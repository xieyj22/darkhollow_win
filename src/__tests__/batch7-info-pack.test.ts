// 批7 T2: log ×N aggregation + records date column.
import { describe, it, expect, beforeEach } from 'vitest';
import { addMsg } from '../messages.js';
import { initGame } from '../game.js';
import { renderRecords } from '../ui-panels.js';
import { getMeta, saveMeta } from '../meta.js';

const DOM_HTML = `
  <div id="log-panel"></div>
  <div id="records-overlay"></div><div id="records-title"></div><div id="records-content"></div>
`;

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = DOM_HTML;
  initGame(0, 0, false);
  document.getElementById('log-panel')!.innerHTML = '';   // drop initGame's boot messages
});

describe('addMsg consecutive-identical aggregation (批7 C3)', () => {
  it('three identical messages collapse into one row with ×3', () => {
    addMsg('你拾起了金币', 'mi'); addMsg('你拾起了金币', 'mi'); addMsg('你拾起了金币', 'mi');
    const p = document.getElementById('log-panel')!;
    expect(p.children.length).toBe(1);
    expect((p.lastElementChild as HTMLElement).textContent).toBe('你拾起了金币 ×3');
  });
  it('different messages never aggregate (even interleaved)', () => {
    addMsg('A'); addMsg('B'); addMsg('A');
    expect(document.getElementById('log-panel')!.children.length).toBe(3);
  });
  it('aggregation only merges the LAST row (gap breaks the run)', () => {
    addMsg('X'); addMsg('Y'); addMsg('X'); addMsg('X');
    const p = document.getElementById('log-panel')!;
    expect(p.children.length).toBe(3);
    expect((p.lastElementChild as HTMLElement).textContent).toBe('X ×2');
  });
});

describe('records date column (批7 C4)', () => {
  it('MM-DD for ts runs, — for legacy ts:0 runs; row carries listitem role+tabindex+title', () => {
    const m = getMeta();
    m.runHistory.push({ mode: 'normal', floor: 5, kills: 3, classIdx: 0, result: 'death', turns: 90, gold: 10, ts: 0 });
    m.runHistory.push({ mode: 'normal', floor: 6, kills: 4, classIdx: 0, result: 'death', turns: 91, gold: 11, ts: new Date('2026-08-30T12:00:00').getTime() });
    saveMeta(m);                       // getMeta() re-parses localStorage — seed must persist
    renderRecords();
    const rows = [...document.querySelectorAll('#records-content .rrow')] as HTMLElement[];
    expect(rows.length).toBeGreaterThanOrEqual(2);      // header is NOT a .rrow (review I1)
    expect(rows[0].textContent).toContain('—');         // data row 1 (legacy ts:0)
    expect(rows[1].textContent).toMatch(/08-30/);       // data row 2
    expect(rows[0].getAttribute('tabindex')).toBe('0');
    expect(rows[0].getAttribute('role')).toBe('listitem');
    expect(rows[0].getAttribute('title')).toBeTruthy();
  });
  it('endless leaderboard also gains the date column', () => {
    const m = getMeta();
    m.endlessLeaderboard.push({ floor: 44, kills: 90, classIdx: 0, turns: 900, gold: 500, ts: new Date('2026-08-29T09:00:00').getTime() });
    saveMeta(m);
    renderRecords();
    expect(document.getElementById('records-content')!.textContent).toMatch(/08-29/);
  });
});
