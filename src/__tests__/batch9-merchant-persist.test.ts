// 批9 ④: 商人常驻（三类），宝箱/事件站仍"删后触发"。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { npcPersists } from '../npc-rules.js';

describe('批9 ④ npcPersists', () => {
  it('三类商人常驻', () => {
    expect(npcPersists('merchant')).toBe(true);
    expect(npcPersists('treasure_merchant')).toBe(true);
    expect(npcPersists('endless_merchant')).toBe(true);
  });
  it('宝箱与事件站仍消耗', () => {
    expect(npcPersists('chest')).toBe(false);
    expect(npcPersists('event')).toBe(false);
    expect(npcPersists(undefined)).toBe(false);
  });
  it('player.ts 消费 npcPersists 做条件删除（source-gate）', () => {
    // Dynamic `'../' + name` form — Vite rewrites literal new URL() into a
    // dev-server http:// path (known pitfall, see batch4-consistency.test.ts).
    const f = 'player.ts';
    const text = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    expect(text).toContain('if (!npcPersists(npcEntity.npc)) G.items = G.items.filter(i => i !== npcEntity)');
  });
  it('宝藏库存只 roll 一次，售罄有文案（source-gate）', () => {
    const f = 'events.ts';
    const text = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    expect(text).toContain('if (!entity.stock) entity.stock = rollTreasureStock()');
    expect(text).not.toContain('if (!entity.stock || entity.stock.length === 0) entity.stock = rollTreasureStock()');
    expect(text).toContain("t('ev.treasureSoldOut')");
  });
});
