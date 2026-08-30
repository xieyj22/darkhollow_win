// Pure corruption logic — leaf module (imports types only), unit-testable.
// The "Abyss corrupts you" signature mechanic (Playtest #9 Phase 1): descending
// + casting + shadow-hits + abyss water accrue corruption (0..100). Higher tiers
// = more spell/crit power but less healing / more dmg taken / per-turn HP; 100
// ends the run (you become the Warden). recalc() applies the mods; addCorruption
// is the single accrual/cleanse entry point used by all sources.
import type { Player, I18nText } from './types.js';

export const CORRUPTION_MAX = 100;

export type Tier = 'clean' | 'touched' | 'corrupted' | 'mutated' | 'warden';

export interface CorruptionMods {
  spellPct: number;      // +% spell power
  critPct: number;       // +% crit chance
  atk: number;           // flat atk
  healPct: number;       // +% healing (negative = reduced)
  dmgTakenPct: number;   // +% dmg taken (applied to the player in attack)
  perTurnHp: number;     // HP cost per turn (mutated tier)
}

export function corruptionTier(c: number): Tier {
  if (c >= 100) return 'warden';
  if (c >= 80) return 'mutated';
  if (c >= 50) return 'corrupted';
  if (c >= 20) return 'touched';
  return 'clean';
}

const MODS: Record<Exclude<Tier, 'warden'>, CorruptionMods> = {
  clean:     { spellPct: 0,  critPct: 0,  atk: 0, healPct: 0,   dmgTakenPct: 0,  perTurnHp: 0 },
  touched:   { spellPct: 15, critPct: 5,  atk: 0, healPct: 0,   dmgTakenPct: 0,  perTurnHp: 0 },
  corrupted: { spellPct: 30, critPct: 10, atk: 1, healPct: -10, dmgTakenPct: 10, perTurnHp: 0 },
  mutated:   { spellPct: 50, critPct: 10, atk: 2, healPct: -20, dmgTakenPct: 20, perTurnHp: 1 },
};

export function corruptionMods(c: number): CorruptionMods {
  const t = corruptionTier(c);
  return t === 'warden' ? MODS.mutated : MODS[t];
}

export const TIER_LABEL: Record<Tier, I18nText> = {
  clean:     { en: 'Clean',     zh: '清醒' },
  touched:   { en: 'Touched',   zh: '动摇' },
  corrupted: { en: 'Corrupted', zh: '腐化' },   // 批7: 术语统一——机制名全库为「腐化」
  mutated:   { en: 'Mutated',   zh: '变异' },
  warden:    { en: 'Warden',    zh: '守渊人' },
};

export const TIER_COLOR: Record<Tier, string> = {
  clean: '#8a8a96', touched: '#b583f6', corrupted: '#9a2be2', mutated: '#e63946', warden: '#1a0033',
};

// Add/subtract corruption on a player. Returns tier info so the caller can
// surface cross-tier feedback (message/fx) and trigger warden-death at 100.
export function addCorruption(p: Player, n: number): { before: Tier; after: Tier; crossed: boolean; maxed: boolean } {
  const before = corruptionTier(p.corruption);
  p.corruption = Math.max(0, Math.min(CORRUPTION_MAX, p.corruption + n));
  const after = corruptionTier(p.corruption);
  return { before, after, crossed: before !== after, maxed: after === 'warden' };
}
