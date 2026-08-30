// 批7: death epitaph — template line + one flavor line per death-cause class.
// Pure module (no DOM, no state reads beyond lang) so tests drive everything
// via arguments, including the random source (injectable for determinism).
import { t, tMsg } from './i18n.js';
import { lang } from './state.js';

export type DeathCause = 'combat' | 'trap' | 'poison' | 'starve' | 'corruption' | 'warden';

export interface Epitaph { template: string; flavor: string }

const FLAVOR_KEYS: Record<DeathCause, string[]> = {
  combat: ['ep.flavor.combat.0', 'ep.flavor.combat.1', 'ep.flavor.combat.2'],
  trap: ['ep.flavor.trap.0', 'ep.flavor.trap.1'],
  poison: ['ep.flavor.poison.0', 'ep.flavor.poison.1'],
  starve: ['ep.flavor.starve.0', 'ep.flavor.starve.1'],
  corruption: ['ep.flavor.corruption.0', 'ep.flavor.corruption.1'],
  warden: ['ep.flavor.warden.0', 'ep.flavor.warden.1'],
};

export function buildEpitaph(cause: DeathCause, killer: string, floor: number, turns: number,
                             rand: () => number = Math.random): Epitaph {
  const keys = FLAVOR_KEYS[cause] ?? FLAVOR_KEYS.combat;   // unknown cause → combat lib
  const flavor = keys[Math.min(keys.length - 1, Math.floor(rand() * keys.length))];
  return { template: tMsg('ep.template', killer, String(floor), String(turns)), flavor: t(flavor) };
}

/** Quote marks differ per language — zh corner brackets, en curly quotes. */
export function quoteFlavor(s: string): string {
  return lang === 'zh' ? `「${s}」` : `“${s}”`;
}
