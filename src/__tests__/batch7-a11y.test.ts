// 批7 T4: static dialog semantics + keyboard linear focus in overlays.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { initGame } from '../game.js';

const DOM_HTML = `
  <div id="log-panel"></div>
  <div id="records-overlay" class="overlay"><div id="records-panel" class="panel"><button class="close-btn" id="btn-close-records">✕</button><h2 id="records-title">Records</h2><div id="records-content" role="list"></div></div></div>
`;

beforeEach(() => { localStorage.clear(); document.body.innerHTML = DOM_HTML; initGame(0, 0, false); });

describe('static dialog semantics (批7 B5/B4)', () => {
  it('every static overlay panel is role=dialog + aria-modal', async () => {
    const f = 'index.html';   // dynamic form — Vite rewrites literal new URL() (批4 lesson)
    const html = readFileSync(new URL('../../' + f, import.meta.url), 'utf8');
    const overlays = (html.match(/class="overlay"/g) ?? []).length;
    const dialogs = (html.match(/role="dialog" aria-modal="true"/g) ?? []).length;
    expect(overlays).toBeGreaterThanOrEqual(11);
    expect(dialogs).toBe(overlays);   // one labelled panel per overlay, order-agnostic
  });
  it('log panel is a polite live region', async () => {
    const f = 'index.html';
    const html = readFileSync(new URL('../../' + f, import.meta.url), 'utf8');
    const m = html.match(/<div id="log-panel"[^>]*>/) ?? [];
    expect(m[0]).toContain('aria-live="polite"');
  });
});

describe('keyboard linear focus in overlays (批7 B1)', () => {
  it('ArrowDown/ArrowUp move focus between record rows', async () => {
    const { initInput } = await import('../input.js');
    initInput();
    const { showOverlay, renderRecords } = await import('../ui-panels.js');
    const { getMeta, saveMeta } = await import('../meta.js');
    const m = getMeta();
    m.runHistory.push({ mode: 'normal', floor: 1, kills: 1, classIdx: 0, result: 'death', turns: 5, gold: 0, ts: 1 });
    m.runHistory.push({ mode: 'normal', floor: 2, kills: 2, classIdx: 0, result: 'death', turns: 6, gold: 0, ts: 2 });
    saveMeta(m);
    showOverlay('records-overlay'); renderRecords();
    await new Promise(r => setTimeout(r, 30));   // showOverlay adds .active inside a rAF — let it land
    const rows = [...document.querySelectorAll('#records-content .rrow')] as HTMLElement[];
    // happy-dom quirk (批3A): offsetParent is null for everything, which
    // focusablesIn's visibility filter would read as invisible — stub it.
    for (const r of rows) Object.defineProperty(r, 'offsetParent', { get: () => document.body, configurable: true });
    rows[1].focus();   // first DATA row (rows[0] is the header)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(rows[2]);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(rows[1]);
  });
  it('arrows outside any overlay never hijack (gameplay dispatch untouched)', async () => {
    const { initInput } = await import('../input.js');
    initInput();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(document.body);   // no overlay → no focus move
  });
});
