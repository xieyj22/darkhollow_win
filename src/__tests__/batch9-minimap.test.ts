// 批9 ⑤: resizeCanvas 尊重 minimapScale（此前硬编码 MW*3，开局/读档/窗口变化打回默认）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('批9 ⑤ resizeCanvas 尊重 minimapScale', () => {
  // Dynamic '../' + f form on purpose — a string LITERAL first arg makes Vite
  // statically rewrite the URL to a dev-server http:// path (batch4 gotcha).
  const f = 'render.ts';
  const text = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  it('画布尺寸用 minimapScale 而非硬编码 3', () => {
    expect(text).toContain('mc.width = MW * minimapScale');
    expect(text).toContain('mc.height = MH * minimapScale');
    expect(text).not.toContain('mc.width = MW * 3');
  });
  it('render.ts 从 state.js 引入 minimapScale', () => {
    const m = text.match(/import \{[^}]*\} from '\.\/state\.js';/);
    expect(m?.[0]).toMatch(/minimapScale/);
  });
});
