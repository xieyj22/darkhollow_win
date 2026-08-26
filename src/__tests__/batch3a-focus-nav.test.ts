// Batch3A T1: pure focus-nav utilities — selector filtering, spatial geometry
// (numeric rects, no layout needed), range stepping, gp-focus class management.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { focusablesIn, spatialNext, stepRange, gpFocus, clearGpFocus, seqFocus } from '../focus-nav.js';

// happy-dom has no layout — patch offsetParent so the visibility filter sees
// everything we append (same technique the T3 poll tests will use).
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() { return document.body; }, configurable: true,
  });
});
afterEach(() => { document.body.innerHTML = ''; clearGpFocus(); });

describe('focusablesIn', () => {
  it('collects buttons, links, inputs, tabindex=0 divs in DOM order', () => {
    document.body.innerHTML = `<div id="c">
      <button>a</button><a href="#">b</a><input type="range">
      <div tabindex="0">d</div><div tabindex="-1">skip</div><p>plain</p>
    </div>`;
    const els = focusablesIn(document.getElementById('c')!);
    expect(els.map(e => e.textContent || (e as HTMLInputElement).type))
      .toEqual(['a', 'b', 'range', 'd']);
  });
  it('excludes disabled buttons', () => {
    document.body.innerHTML = `<div><button disabled>x</button><button>y</button></div>`;
    expect(focusablesIn(document.querySelector('div')!).length).toBe(1);
  });
});

describe('spatialNext — numeric rect geometry', () => {
  const R = (x: number, y: number, w = 10, h = 10, tag = '') =>
    ({ el: document.createElement('button'), r: { x, y, w, h } });
  it('moves right to the horizontally nearest candidate', () => {
    const cur = { x: 0, y: 0, w: 10, h: 10 };
    const near = R(30, 0, 10, 10), far = R(80, 0, 10, 10);
    expect(spatialNext(cur, [far, near], 1, 0)).toBe(near.el);
  });
  it('orthogonal offset weighs double: prefers aligned over nearer-but-skewed', () => {
    const cur = { x: 0, y: 0, w: 10, h: 10 };
    const skewed = R(20, 30), aligned = R(40, 2);
    // skewed: pri=20 + 2*35=90; aligned: pri=40 + 2*7=54 → aligned wins
    expect(spatialNext(cur, [skewed, aligned], 1, 0)).toBe(aligned.el);
  });
  it('ignores candidates on the wrong side / overlapping the axis', () => {
    const cur = { x: 50, y: 50, w: 10, h: 10 };
    const behind = R(80, 50), same = R(52, 50);
    expect(spatialNext(cur, [behind, same], -1, 0)).toBeNull();
  });
  it('up direction selects the candidate above', () => {
    const cur = { x: 0, y: 100, w: 10, h: 10 };
    const above = R(0, 20), below = R(0, 150);
    expect(spatialNext(cur, [above, below], 0, -1)).toBe(above.el);
  });
  it('diagonal requires sign match on both axes', () => {
    const cur = { x: 0, y: 0, w: 10, h: 10 };
    const diag = R(30, 30), horiz = R(30, 0);
    expect(spatialNext(cur, [diag, horiz], 1, 1)).toBe(diag.el);
  });
  it('tie on score falls back to nearest center distance', () => {
    const cur = { x: 0, y: 0, w: 10, h: 10 };
    const a = R(30, 10), b = R(10, 30); // symmetric scores; a is closer by hypot
    expect(spatialNext(cur, [a, b], 1, 1)).toBe(a.el);
  });
});

describe('stepRange', () => {
  it('steps value by el.step and dispatches bubbling input+change', () => {
    document.body.innerHTML = `<input type="range" id="s" min="0" max="1" step="0.05" value="0.5">`;
    const s = document.getElementById('s') as HTMLInputElement;
    const events: string[] = [];
    s.addEventListener('input', () => events.push('input'));
    s.addEventListener('change', () => events.push('change'));
    expect(stepRange(s, 1)).toBe(true);
    expect(s.value).toBe('0.55');
    expect(events).toEqual(['input', 'change']);
    stepRange(s, -1);
    expect(s.value).toBe('0.5');
  });
  it('clamps at max/min and returns false for non-range', () => {
    document.body.innerHTML = `<input type="range" min="0" max="10" step="2" value="9"><input type="text" id="tx">`;
    const s = document.querySelectorAll('input')[0] as HTMLInputElement;
    stepRange(s, 1); expect(s.value).toBe('10');
    stepRange(s, 1); expect(s.value).toBe('10');
    expect(stepRange(document.getElementById('tx') as HTMLInputElement, 1)).toBe(false);
  });
});

describe('gpFocus / seqFocus', () => {
  it('gpFocus adds .gp-focus, focuses, and moves the class on retarget', () => {
    document.body.innerHTML = `<div><button id="a">a</button><button id="b">b</button></div>`;
    const a = document.getElementById('a')!, b = document.getElementById('b')!;
    gpFocus(a);
    expect(a.classList.contains('gp-focus')).toBe(true);
    expect(document.activeElement).toBe(a);
    gpFocus(b);
    expect(a.classList.contains('gp-focus')).toBe(false);
    expect(b.classList.contains('gp-focus')).toBe(true);
    clearGpFocus();
    expect(b.classList.contains('gp-focus')).toBe(false);
  });
  it('seqFocus cycles in DOM order with wraparound; unfocused starts at first/last', () => {
    document.body.innerHTML = `<div id="c"><button>1</button><button>2</button><button>3</button></div>`;
    const c = document.getElementById('c')!;
    expect(seqFocus(c, 1)!.textContent).toBe('1');   // nothing focused → first
    expect(seqFocus(c, 1)!.textContent).toBe('2');
    expect(seqFocus(c, -1)!.textContent).toBe('1');  // wrap backwards
    expect(seqFocus(c, -1)!.textContent).toBe('3');  // wrap around the top
  });
});
