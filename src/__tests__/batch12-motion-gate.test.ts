// 批12 T4: motion-gate static source lock — every `transition:` declaration in
// style/main.css must live in exactly one of two sanctioned places:
//   (a) inside an `@media (prefers-reduced-motion: no-preference)` block, or
//   (b) inside a `body.reduced-motion …{transition:none}` sweep rule.
// Anything else means a control animates for reduced-motion users again —
// the exact regression 批11 E started fixing and this batch finishes.
// Same source-lock pattern as the i18n parity gate (批7) and the dynamic-path
// source gate (批4): parse the CSS text, no DOM involved.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const cssPath = join(dirname(fileURLToPath(import.meta.url)), '../../style/main.css');
// Strip comments first — the file documents its gates in prose and those
// mentions must not count as (or mask) declarations.
const css = readFileSync(cssPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Index of the `}` closing the block whose `{` is at `open`. */
function blockEnd(open: number): number {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

// Ranges of every prefers-reduced-motion: no-preference media block.
const gateRanges: Array<[number, number]> = [];
{
  const needle = '@media (prefers-reduced-motion: no-preference)';
  let at = css.indexOf(needle);
  while (at !== -1) {
    const open = css.indexOf('{', at);
    const end = blockEnd(open);
    expect(end, 'unbalanced media block').toBeGreaterThan(open);
    gateRanges.push([open, end]);
    at = css.indexOf(needle, end);
  }
}
const inGate = (i: number) => gateRanges.some(([a, b]) => i > a && i < b);

interface Rule { selector: string; value: string; }
/** Selector + value of the rule a `transition:` occurrence lives in.
 *  Only used for bare (non-gated) rules — the sweep lines, all top-level —
 *  where the previous rule's `}` is the selector's left bound. */
function owningRule(idx: number): Rule {
  const open = css.lastIndexOf('{', idx);
  const close = css.indexOf('}', idx);
  // NB: lastIndexOf includes the fromIndex char, so searching for '{' AT open
  // would return open itself — that bug silently emptied every selector.
  const bound = css.lastIndexOf('}', open);
  const selector = css.slice(bound + 1, open).replace(/\s+/g, ' ').trim();
  const value = css.slice(idx, close).replace(/^transition\s*:\s*/, '').trim();
  return { selector, value };
}

// Collect every transition occurrence, gated vs bare.
const bare: Rule[] = [];
let at = css.indexOf('transition:');
while (at !== -1) {
  if (!inGate(at)) bare.push(owningRule(at));
  at = css.indexOf('transition:', at + 1);
}

// Bare ones are legal only as body.reduced-motion kill rules; harvest their
// selectors (minus the body.reduced-motion prefix) for the closure check.
const sweepSelectors = new Set<string>();
for (const r of bare) {
  const parts = r.selector.split(',').map((s) => s.trim()).filter(Boolean);
  for (const p of parts) {
    if (p === 'body.reduced-motion') continue; // bare-class rule, no transition expected
    if (!p.startsWith('body.reduced-motion '))
      throw new Error(`bare transition outside gate and sweep: ${p} → ${r.value}`);
    if (r.value !== 'none')
      throw new Error(`sweep rule with a non-none transition: ${p} → ${r.value}`);
    sweepSelectors.add(p.replace(/^body\.reduced-motion /, ''));
  }
}

// Selectors carrying a transition inside the gates.
const gatedSelectors = new Set<string>();
for (const [a, b] of gateRanges) {
  const body = css.slice(a + 1, b);
  for (const m of body.matchAll(/([^{}]+)\{/g)) {
    for (const part of m[1].split(',')) {
      const s = part.replace(/\s+/g, ' ').trim();
      if (s) gatedSelectors.add(s);
    }
  }
}

describe('批12 T4: every transition is motion-gated or swept', () => {
  it('no bare transition declarations survive outside the gates', () => {
    // The loop above throws on the first offender; reaching here with every
    // bare rule being a kill rule is the pass condition. Keep a hard count
    // so a future silent empty-parse can't fake a pass (批5 A0 lesson).
    expect(bare.length).toBeGreaterThanOrEqual(6); // 392-395+397 sweep lines + 批12 sweep
    expect([...sweepSelectors].length).toBeGreaterThanOrEqual(20);
  });

  it('every gated selector also has a body.reduced-motion kill rule (manual toggle closure)', () => {
    const missing = [...gatedSelectors].filter((s) => !sweepSelectors.has(s));
    expect(missing, 'gated but not swept — manual reduced-motion users still see motion').toEqual([]);
  });

  it('floor: three gates exist and the gate family is non-empty', () => {
    // 批11 E gate + ③ token gate + 批12 gate. A wholesale CSS deletion would
    // otherwise pass the two checks above vacuously.
    expect(gateRanges.length).toBeGreaterThanOrEqual(3);
    expect(gatedSelectors.size).toBeGreaterThanOrEqual(25);
  });

  // Verbatim value lock for the 批12 gate: the move from rule body into the
  // gate must not alter duration/easing — "allow-motion users see byte-identical
  // animation" is the whole equivalence claim of this batch.
  const EXPECTED: Array<[string, string]> = [
    ['.menu-btn', 'transition:all .3s'],
    ['.bar .fill', 'transition:width .35s cubic-bezier(.2,.7,.3,1)'],
    ['canvas#game-canvas', 'transition:transform .05s,opacity .25s'],
    ['.overlay', 'transition:opacity var(--dur-med) ease'],
    ['.vol-slider::-webkit-slider-thumb', 'transition:box-shadow .15s'],
    ['.opt-tab', 'transition:color .15s'],
    ['.opt-tab::after', 'transition:transform .15s'],
    ['.opt-row', 'transition:background .15s'],
    ['.toggle .track', 'transition:all .15s'],
    ['.toggle .thumb', 'transition:left .15s cubic-bezier(.4,0,.2,1.4),background .15s'],
    ['.obj-bar .fill', 'transition:width .3s'],
    ['.hb-slot', 'transition:all .15s'],
    ['.talent-cell', 'transition:all .15s'],
    ['.forge-upgrade', 'transition:all .15s'],
    ['#sidebar', 'transition:width .3s,min-width .3s,padding .3s,opacity .3s'],
    ['#btn-sidebar-toggle', 'transition:left .3s'],
  ];

  it.each(EXPECTED)('%s restored verbatim inside a no-preference gate', (sel, decl) => {
    const hit = gateRanges.some(([a, b]) => {
      const body = css.slice(a + 1, b);
      return body.includes(decl) && body.includes(sel);
    });
    expect(hit, `${sel}: ${decl} not found in any gate`).toBe(true);
  });

  // ③-family members had their own `transition:all .15s` deleted from the rule
  // body — ③ (source order later) already wins on motion-allowing systems, so
  // deleting the body copy changes nothing there and silences system-rm users.
  it.each(['#opt-reset', '.seg button', '.kb-rebind', '.kb-reset', '.evb', '.mc-btn', '#keys-toggle', '.forge-tab', '.fu-buy'])(
    '%s rule body carries no transition of its own anymore',
    (sel) => {
      const re = new RegExp(`(^|[}\\s,])${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\{[^}]*\\}`, 'g');
      for (const m of css.matchAll(re)) {
        // `transition:none` inside a body.reduced-motion sweep match is the
        // kill rule itself, not a leftover — only real values fail here.
        expect(m[0], `${sel} still owns a transition: ${m[0]}`).not.toMatch(/transition(?!-origin)(?!:\s*none)/);
      }
    },
  );
});
