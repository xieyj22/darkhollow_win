// Warden logic — pure, testable leaf. Only imports types + utils + state so it
// unit-tests without pulling combat/render/relics into the test env. The impure
// spawnWarden() lives in enemies.ts (same domain as spawnEnemies); this module
// owns the math + pick/sequence helpers it + combat.ts consume.
import type { I18nText } from './types.js';

// fs matches spawnEnemies: 1 + (floor-1)*.12 (area bonus intentionally omitted —
// the Warden is a universal threat, not biome-scaled). def is NOT fs-scaled
// (keeps it pierceable by a deep player's attack), matching the spec formula.
export function wardenStats(floor: number): { hp: number; maxHp: number; atk: number; def: number; exp: number } {
  const fs = 1 + (floor - 1) * 0.12;
  const hp = Math.floor((45 + floor * 5) * fs);
  return {
    hp, maxHp: hp,
    atk: Math.floor((10 + floor * 1.6) * fs),
    def: Math.floor(4 + floor * 0.6),
    exp: 40 + floor * 4,
  };
}

// The 3 "前任遗物" defs live in data.ts RELICS; this is just the pick-list so
// the kill-drop can grant the next unowned one deterministically (no rng).
export const WARDEN_RELIC_IDS = ['warden_cloak', 'fallen_blade', 'memory_shard'] as const;

export function pickWardenRelic(owned: readonly string[]): string | null {
  const set = new Set(owned);
  return WARDEN_RELIC_IDS.find(id => !set.has(id)) ?? null;
}

// Sequential memory unlocks: each Warden kill reveals the next fragment of the
// Warden's past life. null once all 3 are unlocked.
export function nextWardenMemory(unlocked: readonly string[]): string | null {
  const set = new Set(unlocked);
  for (let i = 1; i <= WARDEN_MEMORIES.length; i++) {
    if (!set.has(`warden:memory${i}`)) return `warden:memory${i}`;
  }
  return null;
}

// Three lore fragments, revealed one per kill. Sourced from docs/lore (the
// Warden was a former Descender, absorbed and remade as the abyss's immune hound).
export const WARDEN_MEMORIES: I18nText[] = [
  { en: 'A memory surfaces: the Warden once descended for the same reasons you did. They failed where you now stand.', zh: '一段记忆浮现：守渊人曾为同样的理由下探。他们在你现在站立之处失败了。' },
  { en: 'The abyss did not kill them. It remembered them — and reshaped them into its hound. They still recall their own name, sometimes.', zh: '深渊没有杀死 Ta，而是「记住」了 Ta——把 Ta 改造成了猎犬。Ta 有时仍记着自己的名字。' },
  { en: 'In their last flash of self, you see your own reflection. To defeat them is self-preservation — and a rehearsal for your own fall.', zh: '在最后一丝自我中，你看见了自己的倒影。击败 Ta 是自保，也是你自身坠落的预演。' },
];

export function wardenMemoryText(id: string): I18nText | null {
  const m = /warden:memory(\d+)/.exec(id);
  if (!m) return null;
  const i = parseInt(m[1], 10) - 1;
  return WARDEN_MEMORIES[i] ?? null;
}
