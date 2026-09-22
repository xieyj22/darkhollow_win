// 批16: zh pixel font CSS source gate — 同批14 runes-css 静态源门模式。
// 中文像素字体只上大字号锚位（12px 整数倍才锐利——spike 实测 13/14px 灰晕），
// 正文 13/14px 保持系统字体（负锚点锁死）。C1 教训：@font-face 必须顶层（先于首个 @media）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '../../style/main.css'), 'utf8');
const charSel = readFileSync(join(here, '../char-select.ts'), 'utf8');

function ruleBlock(selector: string): string {
  const i = css.indexOf(selector);
  expect(i, `selector ${selector} not found in main.css`).toBeGreaterThan(-1);
  const open = css.indexOf('{', i);
  const close = css.indexOf('}', open);
  return css.slice(open, close);
}

describe('批16: zh pixel font wiring (CSS source gate)', () => {
  it("@font-face 'Darkhollow Zh Pixel' top-level, correct src + swap", () => {
    const m = css.match(/@font-face\{[^}]*'Darkhollow Zh Pixel'[^}]*\}/);
    expect(m, 'zh pixel @font-face').toBeTruthy();
    expect(m![0]).toMatch(/url\(['"]?\/fonts\/darkhollow-zh-pixel\.woff2['"]?\)/);
    expect(m![0]).toMatch(/font-display:\s*swap/);
    // C1（批14 大坑）: face 若嵌在 @media 内桌面端永不注册——必须先于首个 @media 规则出现
    // （先剥注释：文件头的 C1 教训注释本身就含 "@media" 字样，indexOf 会误中）
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const mediaIdx = stripped.indexOf('@media');
    expect(css.indexOf(m![0]), 'face precedes first @media rule').toBeLessThan(mediaIdx);
  });

  it('token --font-zh-px defined as bare family (composed per anchor)', () => {
    expect(css).toMatch(/--font-zh-px:\s*'Darkhollow Zh Pixel'/);
  });

  // runes 系锚位：zh 像素插在 runes 前（中文命中像素，拉丁穿透到 runes=现状）
  const RUNES_ANCHORS = ['#title-h2', '.menu-btn', '.panel h2', '#char-sel h2', '.ft.crit'];
  it.each(RUNES_ANCHORS)('%s stacks zh-pixel before runes', (sel) => {
    const b = ruleBlock(sel);
    expect(b).toContain('var(--font-zh-px)');
    expect(b).toContain('var(--font-runes)');
    expect(b.indexOf('--font-zh-px'), 'zh-px listed before runes').toBeLessThan(b.indexOf('--font-runes'));
  });

  // 裸 mono 锚位（death/victory 现状无 runes）：英文模式零变化 → zh 像素 + mono
  it.each(['#death-screen h1', '#victory-screen h1'])('%s stacks zh-pixel before mono', (sel) => {
    const b = ruleBlock(sel);
    expect(b).toContain('var(--font-zh-px)');
    expect(b).toContain('var(--font-mono)');
    expect(b.indexOf('--font-zh-px')).toBeLessThan(b.indexOf('--font-mono'));
    expect(b).not.toContain('--font-runes');
  });

  it('sizes snap to 12px multiples (round() keeps --fs-scale snapping per step)', () => {
    // 原生位必须一起 snap：#title-screen h2 (1,0,1) 特异性压过 #title-h2 (1,0,0) —— 批14 C1 同款教训
    expect(ruleBlock('#title-screen h2')).toContain('round(up, 1.1em, 12px)');
    expect(ruleBlock('#title-h2')).toContain('round(up, 1.05em, 12px)');
    expect(ruleBlock('.menu-btn')).toContain('round(up, 1.1em, 12px)');
    expect(ruleBlock('.panel h2')).toContain('round(nearest, 1.4em, 12px)');
    expect(ruleBlock('#death-screen h1')).toContain('round(nearest, 3em, 12px)');
    expect(ruleBlock('#victory-screen h1')).toContain('round(nearest, 3em, 12px)');
    expect(ruleBlock('.ft.crit')).toContain('font-size:24px');
  });

  it('char-select h2 inline size snaps (src-side companion)', () => {
    expect(charSel).toContain('round(nearest,1.8em,12px)');
  });

  it('negative anchors: body/log/keycap keep mono (正文不换)', () => {
    expect(ruleBlock('body{')).not.toContain('--font-zh-px');
    expect(ruleBlock('#log-panel')).not.toContain('--font-zh-px');
    expect(ruleBlock('.kb-key')).not.toContain('--font-zh-px');
  });
});
