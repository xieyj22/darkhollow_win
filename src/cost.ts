// Batch10 A: corruption as a second currency — paying MEANS taking corruption on.
// Payments MUST go through addCorruption (the low-level clamp entry), never
// applyCorruption: its modifier chain (eternal_sand halving, corruption_ward
// chance-cancel) would turn a payment into a discount or a free item.
import { addCorruption } from './corruption.js';
import type { Player } from './types.js';

export function corruptionPriceOf(goldPrice: number): number {
  return Math.max(5, Math.min(25, Math.round(goldPrice / 45)));
}

// Hard line: payments never push the player past 95 — shopping cannot trigger
// the warden-death at 100 (boundary value itself is allowed).
export function canPayCorruption(cur: number, cost: number): boolean {
  return cur + cost <= 95;
}

export function payCorruption(p: Player, cost: number): boolean {
  if (!canPayCorruption(p.corruption, cost)) return false;
  addCorruption(p, cost);
  return true;
}
