// 批4: source-discipline gates — 行为难以单测触达的死代码/硬编码，用源码门钉住。
// NOTE: reads use the batch3d `'../' + f` dynamic form on purpose — a string
// LITERAL first arg makes Vite statically rewrite the URL to a dev-server
// http:// path, which node's readFileSync rejects ("scheme file").
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('批4 source gates', () => {
  it('relics.ts no longer dead-writes relic: lore ids (codex is driven by discoveredItems)', () => {
    const SRC_FILES = ['relics.ts'];
    for (const f of SRC_FILES) {
      const text = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
      expect(text).not.toContain("unlockLore('relic:");
    }
  });
  it('teleport float text is i18n-driven (no hardcoded CJK in items.ts)', () => {
    const f = 'items.ts';
    const text = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    expect(text).not.toContain('⚡传送');
    expect(text).toContain("t('ig.teleport')");
  });
});
