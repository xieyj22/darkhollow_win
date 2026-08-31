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
  it('终审修复：踩 NPC 时同格非 NPC 战利品仍被拾取，且清扫不误删常驻商人（source-gate）', () => {
    // Final-review F1: pre-batch9 the merchant vanished after one interaction, so
    // co-located loot never stranded; now that it persists all floor, ordinary
    // sequences (dropping while standing on it, an enemy dying on its tile) put
    // non-NPC items on the NPC's tile — the npc branch must run them through the
    // same pickup loop, and the blanket tile sweep must spare NPCs.
    const f = 'player.ts';
    const text = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    // Non-NPC loot on the stepped tile is picked up alongside the NPC trigger.
    expect(text).toContain('const loot = itemsHere.filter(i => !i.npc)');
    // The tile sweep spares NPCs — the persisting merchant survives removal of
    // the picked-up pile (assert the actual final expression text).
    expect(text).toContain('G.items = G.items.filter(i => !i.npc ? (i.x !== nx || i.y !== ny) : true)');
    // The sweep must run BEFORE triggerNpc: chestOpen spawns loot onto this very
    // tile, and a later sweep would delete it (regression guard on ordering).
    const sweep = text.indexOf('G.items = G.items.filter(i => !i.npc ?');
    const trig = text.indexOf('triggerNpc(npcEntity)');
    expect(sweep).toBeGreaterThan(-1);
    expect(trig).toBeGreaterThan(-1);
    expect(sweep).toBeLessThan(trig);
  });
  it('宝藏库存只 roll 一次，售罄有文案（source-gate）', () => {
    const f = 'events.ts';
    const text = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    expect(text).toContain('if (!entity.stock) entity.stock = rollTreasureStock()');
    expect(text).not.toContain('if (!entity.stock || entity.stock.length === 0) entity.stock = rollTreasureStock()');
    expect(text).toContain("t('ev.treasureSoldOut')");
  });
});
