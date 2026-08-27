// Batch2 ③: random event-site table + eligibility. Leaf module (state/types
// only) so game.ts can import it without a game↔events import cycle.
import { G } from './state.js';

export type EventSiteId =
  | 'cursed_altar' | 'gambler_altar' | 'trapped_npc' | 'ancient_remains'
  | 'blood_pool' | 'ancient_stele' | 'sealed_box' | 'sacrifice_well';

export interface EventSiteDef {
  id: EventSiteId;
  ch: string;        // fallback glyph (legacy saves render via type routing)
  c: string;         // glyph/frame color
  minFloor: number;
  once: boolean;     // once per run (G.eventFlags)
  spriteKind: string; // 批3B: TEMPLATES key — map rendering via pickItemTemplate
}

export const EVENT_SITES: EventSiteDef[] = [
  { id: 'cursed_altar',    ch: '⛧', c: '#c0392b', minFloor: 4,  once: true,  spriteKind: 'ES_ALTAR_CURSED' },
  { id: 'gambler_altar',   ch: '⚄', c: '#f39c12', minFloor: 3,  once: true,  spriteKind: 'ES_ALTAR_GAMBLER' },
  { id: 'trapped_npc',     ch: '⌂', c: '#7ec8e3', minFloor: 5,  once: true,  spriteKind: 'ES_HOUSE' },
  { id: 'ancient_remains', ch: '⚰', c: '#95a5a6', minFloor: 3,  once: false, spriteKind: 'ES_COFFIN' },
  { id: 'blood_pool',      ch: '♨', c: '#8b0000', minFloor: 8,  once: false, spriteKind: 'ES_POOL' },
  { id: 'ancient_stele',   ch: 'ᛘ', c: '#daa520', minFloor: 6,  once: true,  spriteKind: 'ES_STELE' },
  { id: 'sealed_box',      ch: '⊞', c: '#9b5de5', minFloor: 10, once: true,  spriteKind: 'ES_SEALED' },
  { id: 'sacrifice_well',  ch: '◍', c: '#06d6a0', minFloor: 7,  once: false, spriteKind: 'ES_WELL' },
];

export function eligibleEventSites(floor: number): EventSiteDef[] {
  return EVENT_SITES.filter(s => floor >= s.minFloor && !(s.once && G?.eventFlags?.[s.id]));
}
