// 批14 T6: runes font CSS source lock — @font-face declarations, the two font
// variables, and every wiring anchor pinning var(--font-runes)/var(--font-eroded)
// in their rule bodies; body and .kb-key must NOT carry the runes stack
// (正文/键帽保留 mono —— spec §3/§6). Same static source-gate pattern as 批12.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../style/main.css'), 'utf8');

function ruleBlock(selector: string): string {
  const i = css.indexOf(selector);
  expect(i, `selector ${selector} not found in main.css`).toBeGreaterThan(-1);
  const open = css.indexOf('{', i);
  const close = css.indexOf('}', open);
  return css.slice(open, close);
}

describe('批14 T6: runes font wiring (CSS source gate)', () => {
  it('two @font-face blocks with correct families and woff2 sources', () => {
    const faces = css.match(/@font-face\{[^}]*\}/g) ?? [];
    const reg = faces.find(f => f.includes("'Darkhollow Runes'") && !f.includes('Eroded'));
    const ero = faces.find(f => f.includes("'Darkhollow Runes Eroded'"));
    expect(reg, 'regular @font-face').toBeTruthy();
    expect(ero, 'eroded @font-face').toBeTruthy();
    expect(reg!).toMatch(/url\(['"]?\/fonts\/darkhollow-runes\.woff2['"]?\)/);
    expect(ero!).toMatch(/url\(['"]?\/fonts\/darkhollow-runes-eroded\.woff2['"]?\)/);
    expect(reg!).toMatch(/font-display:\s*swap/);
  });

  it('font variables defined (runes stacks over mono)', () => {
    expect(css).toMatch(/--font-runes:\s*'Darkhollow Runes',\s*var\(--font-mono\)/);
    expect(css).toMatch(/--font-eroded:\s*'Darkhollow Runes Eroded',\s*var\(--font-runes\)/);
  });

  // 接入位清单（spec §6）：(selector, variable)
  const ANCHORS: Array<[string, string]> = [
    ['#title-screen h1', '--font-eroded'],  // 原生规则位（特异性高于 #title-h1——曾把 56px 压回 2.8em）
    ['#title-h2', '--font-runes'],
    ['#char-sel h2', '--font-runes'],  // I3: 选人屏标题（.panel h2 够不到它）
    ['.menu-btn', '--font-runes'],
    ['.title-stats', '--font-runes'],
    ['#floor-label', '--font-runes'],
    ['#s-floor', '--font-runes'],
    ['.bt-text', '--font-runes'],
    ['.ft', '--font-runes'],
    ['.panel h2', '--font-runes'],
  ];

  it.each(ANCHORS)('%s carries var(%s)', (sel, v) => {
    expect(ruleBlock(sel)).toContain(`var(${v})`);
  });

  it('body and .kb-key keep the mono stack (negative anchors)', () => {
    expect(ruleBlock('body{'), 'body rule: no runes').not.toContain('--font-runes');
    expect(ruleBlock('body{')).not.toContain('--font-eroded');
    expect(ruleBlock('.kb-key'), 'keycap rule: no runes').not.toContain('--font-runes');
  });

  it('floor guards: both families and both variables exist (A0)', () => {
    expect((css.match(/Darkhollow Runes/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
});
