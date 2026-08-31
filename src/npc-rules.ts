// Batch9 ④: which stepped-on map entities persist after interaction.
// Merchants stay on the map for the rest of the floor (re-interactable);
// chests and event sites are consumed once, exactly as before.
export function npcPersists(npc: unknown): boolean {
  return npc === 'merchant' || npc === 'treasure_merchant' || npc === 'endless_merchant';
}
