// 批7 T3: permanent source gates — zh punctuation normalization + unified term.
// (Dynamic-URL file reads, 批4 convention; sweep script: scripts/fix_zh_punct.mjs)
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const CJK = '[\\u4e00-\\u9fff]';
for (const f of ['i18n.ts', 'data.ts', 'corruption.ts']) {
  it(`${f}: zh literals keep half-width punctuation away from CJK`, async () => {
    const text = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    const bad = text.split('\n')
      .filter(l => /zh:\s*['"`]/.test(l))
      .filter(l => new RegExp(`${CJK}[,;:?!]`).test(l) || new RegExp(`,(?=${CJK})`).test(l));
    expect(bad, JSON.stringify(bad.slice(0, 3), null, 1)).toHaveLength(0);
  });
}
it('TIER_LABEL uses the unified term 腐化 (not 侵蚀)', async () => {
  const f = 'corruption.ts';   // dynamic form — Vite rewrites literal new URL() (批4 lesson)
  const text = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  expect(text).not.toContain('侵蚀');
  expect(text).toContain('腐化');
});

// 批7 review I2: the standing parity gate the plan claimed but never had —
// every key in L (scalar or array entries) must carry BOTH en and zh entries,
// so a future en-only addition fails here instead of shipping silently.
// (Property presence, not truthiness: '' is a legitimate deliberate blank,
// e.g. cb.floorUnit needs no unit suffix in English.)
it('every i18n key has both en and zh values', async () => {
  const { L } = await import('../i18n.js');
  const missing = (x: unknown) => x === undefined || x === null;
  const bad = Object.entries(L).filter(([, v]) =>
    Array.isArray(v) ? v.some(x => missing(x?.en) || missing(x?.zh)) : missing(v?.en) || missing(v?.zh));
  expect(bad.map(([k]) => k).slice(0, 8)).toHaveLength(0);
});
