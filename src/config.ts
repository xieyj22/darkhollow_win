// Game constants
export const TS = 22;       // tile size in pixels
export const MW = 70;       // map width
export const MH = 45;       // map height
export const FOV = 10;      // field of view radius
export const BASE_MAX_INV = 20;  // base max inventory slots
export const MAX_INV = 20;  // max inventory slots (legacy compat)
export const FINAL = 40;    // final floor number

// Per-category inventory caps. Inventory is split into two pools instead of one
// global cap: gear (weapon+armor+accessory) is capped tightly so the player
// keeps only the best few pieces and the rest auto-converts to gold;
// consumables (scroll+item+potion) get a much larger cap so the player can
// stockpile them. Food is eaten immediately on pickup and never stored.
export const GEAR_INV_MAX = 6;        // weapons + armors + accessories combined
export const BASE_CONS_INV_MAX = 16;  // scrolls + consumables + potions combined

// Dynamic max inventory — reads meta upgrades
export function getMaxInv(): number {
  try {
    const meta = JSON.parse(localStorage.getItem('dh_meta') || '{}');
    return BASE_MAX_INV + ((meta.upgrades?.['inv_size'] || 0) * 4);
  } catch { return BASE_MAX_INV; }
}

// Dynamic consumable-pool cap — Pack Mule meta upgrade also expands consumables.
export function getMaxConsInv(): number {
  try {
    const meta = JSON.parse(localStorage.getItem('dh_meta') || '{}');
    return BASE_CONS_INV_MAX + ((meta.upgrades?.['inv_size'] || 0) * 4);
  } catch { return BASE_CONS_INV_MAX; }
}

// Gear-pool cap — grows with the Pack Mule (inv_size) meta upgrade (+1/rank),
// so players can hold more spares to compare/equip manually.
export function getGearInvMax(): number {
  try {
    const meta = JSON.parse(localStorage.getItem('dh_meta') || '{}');
    return GEAR_INV_MAX + (meta.upgrades?.['inv_size'] || 0);
  } catch { return GEAR_INV_MAX; }
}

// Tile types
export const enum TL {
  VOID = 0,
  WALL = 1,
  FLOOR = 2,
  CORR = 3,
  DOOR = 4,
  STAIR = 5,
  WATER = 6,
  FOUNTAIN = 7,
  SHRINE = 8,
  LAVA = 9,
  VOID_FLOOR = 10,
  CRYSTAL = 11,
  ABYSS_WATER = 12,
  MOSS = 13,
  CURSE = 14,
  ALARM = 15,
  PORTAL = 16,
}
