// Procedural PIXEL-ART sprites — 16×16 pixel matrices rendered via offscreen
// canvases and blitted with imageSmoothingEnabled=false for crisp scaled edges.
// Enemy templates use 'M' (main = enemy color). Item templates are per-type AND
// sub-type (sword/axe/hammer..., health/mana/poison...). Player has 4 class
// templates. To swap in real PNG art later, replace blit()/getSprite() — render.ts unchanged.
import type { Enemy, Item } from './types.js';
import { TS } from './config.js';
import { darken } from './utils.js';

type Template = string[];
const N = 16; // pixel grid dimension

// Color codes: M=main · D=dark · L=light · E=eye(glow) · K=black · W=white/glass
//              G=gold · S=skin · R=red cloak · N=brown · C=grey
//              Player class mains: A=warrior steel · P=rogue purple · B=mage blue · H=paladin gold
const TEMPLATES: Record<string, Template> = {
  // ===== Player classes =====
  WARRIOR: [
    "................",
    ".....KK..KK.....",
    "....KKKKKKKK....",
    "....KSSSSSSK....",
    "....KSKKKKSK....",
    "....KSSSSSSK....",
    "....KGGGGGGK....",
    "...RAAALLAARRW..",
    "...RAAALLAARRW..",
    "...RAAAAAAARRW..",
    "....NNNNNNNN....",
    "....NN....NN....",
    "....NN....NN....",
    "....KK....KK....",
    "................",
    "................",
  ],
  ROGUE: [
    "................",
    ".......KK.......",
    "......KPPK......",
    ".....KPPPPK.....",
    "....KPSSSSPK....",
    "....KPSKKSPK....",
    "....KPSSSSPK....",
    "....KKPPPPKK....",
    "...PPPPPPPPPPW..",
    "...PPPLLLLPPPW..",
    "...PPPPPPPPPP...",
    "....NNNNNNNN....",
    "....NN....NN....",
    "....NN....NN....",
    "....KK....KK....",
    "................",
  ],
  MAGE: [
    ".W....KK........",
    ".G....KBBK......",
    ".W....KBBK......",
    ".W...KSSSSK.....",
    ".W...KSKKSK.....",
    ".....KSSSSK.....",
    ".....KKBBKK.....",
    "....BBBBBBBB....",
    "....BBLLLLBB....",
    "....BBBBBBBB....",
    ".....NNNNNN.....",
    ".....NN..NN.....",
    ".....NN..NN.....",
    ".....KK..KK.....",
    "................",
    "................",
  ],
  PALADIN: [
    "................",
    ".......LL.......",
    ".....KK..KK.....",
    "....KKHHHHKK....",
    "....KHSSSSHK....",
    "....KHSKKSHK....",
    "....KHSSSSHK....",
    "....KKHHHHKK....",
    "...HHHHHHHHHH...",
    "..HHHHKHKHHHHH..",
    "..HHHHHHHHHHHH..",
    "....NNNNNNNN....",
    "....NN....NN....",
    "....NN....NN....",
    "....KK....KK....",
    "................",
  ],

  // ===== Enemies =====
  GOBLIN: [
    "................",
    "...DD......DD...",
    "....D......D....",
    "......DDDD......",
    ".....DMMMMMD....",
    "....DMEMMEMD....",
    "....DMMMMMMD....",
    "....DMKKKKMD....",
    "....DMMMMMMD....",
    "....DDMMMMDD....",
    "...DMMMMMMMMD...",
    "...DMMKKKKMMD...",
    "...DMMMMMMMMD...",
    "....DD....DD....",
    "....KK....KK....",
    "................",
  ],
  SKELETON: [
    "................",
    "....WWWWWWWW....",
    "....WKKWWKKW....",
    "....WWWWWWWW....",
    "....WKWWWWKW....",
    "....WWKKKKWW....",
    ".....WWWWWW.....",
    "......CCCC......",
    ".....CWCCWC.....",
    ".....CWCCWC.....",
    ".....CWWWWC.....",
    ".....CWCCWC.....",
    "......CCCC......",
    ".......CC.......",
    "......KKKK......",
    "................",
  ],
  SLIME: [
    "................",
    "................",
    "......LLLL......",
    ".....LMWWML.....",
    "....MMEMMEMM....",
    "...MMMMMMMMMM...",
    "...MMWMMMMWMM...",
    "..MMMMMMMMMMMM..",
    "..MMMMMMMMMMMM..",
    "..MMMMMMMMMMMM..",
    "..MMMMMMMMMMMM..",
    "..MMMMMMMMMMMM..",
    "..DDDDDDDDDDDD..",
    "................",
    "................",
    "................",
  ],
  BEAST: [
    "................",
    "................",
    "...DD....DD.....",
    "....DDDDDD......",
    "...DMMMMMMD.D...",
    "..DMEMMMMMMD....",
    "..DMMMMMMMMD....",
    "..DMKKMMKKMD....",
    "..DMMMMMMMMD....",
    "..DDDDDDDDDDD...",
    "...DD......DD...",
    "...DD......DD...",
    "...KK......KK...",
    "................",
    "................",
    "................",
  ],
  DEMON: [
    ".K..........K...",
    ".KK........KK...",
    "..KK......KK....",
    "...DDDDDDDD.....",
    "..DMMMMMMMMD....",
    "..DMGMMMMGMD....",
    "..DMEEMMEEMD....",
    "..DMMMMMMMMD....",
    "..DDMMMMMMDD....",
    ".DMMMMMMMMMMD...",
    ".DMMMMMMMMMMD...",
    ".DD.DDDDDD.DD...",
    "..K...KK...K....",
    "................",
    "................",
    "................",
  ],
  BOSS: [
    ".K..K....K..K...",
    ".KKKK....KKKK...",
    "..KK........KK..",
    "...DDDDDDDDDD...",
    "..DMMMMMMMMMD...",
    "..DMGMMMMMMGMD..",
    "..DMEEMMMEEMMD..",
    "..DMMMMMMMMMD...",
    ".DDMMMMMMMMMMDD.",
    ".DMMMMMMMMMMMMMD",
    ".DMMGMMMMMMGMMMD",
    ".DMMMMMMMMMMMMMD",
    ".DDDDDDDDDDDDDD.",
    "..DD........DD..",
    "..KK........KK..",
    "................",
  ],

  // ===== Weapons (by name) =====
  W_SWORD: [
    "................",
    ".......ML.......",
    ".......MM.......",
    ".......MM.......",
    ".......MM.......",
    ".......MM.......",
    ".......MM.......",
    ".......MM.......",
    "......GGGG......",
    ".......NN.......",
    ".......NN.......",
    ".......NN.......",
    ".......NN.......",
    "......KNNK......",
    "................",
    "................",
  ],
  W_AXE: [
    "................",
    "......DDD.......",
    ".....DMMMD......",
    "....DMMMMMD.....",
    "...DMMMMMMMD....",
    "..DMMMMMMMMMD...",
    "...DMMMMMMMD....",
"......NN........",
"......NN........",
"......NN........",
"......NN........",
"......NN........",
"......NN........",
"......KK........",
"................",
"................",
  ],
  W_HAMMER: [
    "................",
    "....DDDDDDDD....",
    "...DMMMMMMMMD...",
    "...DMMMMMMMMD...",
    "...DMMMMMMMMD...",
    "....DDDDDDDD....",
    "......NN........",
    "......NN........",
    "......NN........",
    "......NN........",
    "......NN........",
    "......NN........",
    "......NN........",
    "......KK........",
    "................",
    "................",
  ],
  W_DAGGER: [
    "................",
    "................",
    "................",
    "........ML......",
    "........MM......",
    "........MM......",
    "........MM......",
    ".......GGGG.....",
    "........NN......",
    "........NN......",
    "........NN......",
    ".......KNNK.....",
    "................",
    "................",
    "................",
    "................",
  ],
  W_STAFF: [
    ".......W........",
    "......GLG.......",
    ".......W........",
    ".......W........",
    ".......W........",
    ".......W........",
    ".......W........",
    ".......W........",
    ".......W........",
    ".......W........",
    ".......W........",
    ".......W........",
    ".......W........",
    "......KNNK......",
    "................",
    "................",
  ],
  W_SPEAR: [
    ".......K........",
    "......MKK.......",
    ".....KMMK.......",
    "......MK........",
    ".......N........",
    ".......N........",
    ".......N........",
    ".......N........",
    ".......N........",
    ".......N........",
    ".......N........",
    ".......N........",
    ".......N........",
    "......KNNK......",
    "................",
    "................",
  ],
  W_SCYTHE: [
    "................",
    "............K...",
    "...........KM...",
    "..........KMM...",
    ".........KMM....",
    "........KMM.....",
    "..N.....KMM.....",
    "..N...KMM.......",
    "..N.KMM.........",
    "..NKMM..........",
    "..NMM...........",
    "..NM............",
    "..N.............",
    ".KNNK...........",
    "................",
    "................",
  ],

  // ===== Armor / Accessory / Scroll / Food / Gold =====
  I_SHIELD: [
    "................",
    ".....DDDDDD.....",
    "....DMMMMMMD....",
    "...DMMMMMMMMD...",
    "...DMWMMMMWMD...",
    "...DMMMMMMMMD...",
    "...DMMMMMMMMD...",
    "...DMMKKKKMMD...",
    "...DMMKKKKMMD...",
    "...DMMMMMMMMD...",
    "....DMMMMMMD....",
    ".....DDDDDD.....",
    "......DDDD......",
    "................",
    "................",
    "................",
  ],
  I_RING: [
    "................",
    "................",
    ".......WW.......",
    "......WLLW......",
    ".......WW.......",
    ".......MM.......",
    ".....DDDDDD.....",
    "....D......D....",
    "....D......D....",
    "....D......D....",
    ".....DDDDDD.....",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  I_SCROLL: [
    "................",
    "................",
    "......DDDD......",
    ".....DMMMMD.....",
    "....DWWWWWWD....",
    "...DWWWWWWWWD...",
    "...DWWWWWWWWD...",
    "...DWWWWWWWWD...",
    "...DWWWWWWWWD...",
    "...DWWWWWWWWD...",
    "....DWWWWWWD....",
    ".....DMMMMD.....",
    "......DDDD......",
    "................",
    "................",
    "................",
  ],
  I_FOOD: [
    "................",
    "................",
    ".......NN.......",
    "......NMMN......",
    ".....NMMMMN.....",
    "....NMMMMMMN....",
    "...NMMMMMMMMN...",
    "...NMMMMMMMMN...",
    "...NMMWMMMMMN...",
    "...NMMMMMMMMN...",
    "....NMMMMMMN....",
    ".....NMMMMN.....",
    "......NMMN......",
    "................",
    "................",
    "................",
  ],
  I_GOLD: [
    "................",
    "................",
    "................",
    ".....GG.GG......",
    "....GLGGLG......",
    "....GGGGGG......",
    "...GGGGGGGG.....",
    "..GGGGGGGGGG....",
    "..GLGGGGGGGG....",
    "..GGGGGGGGGG....",
    "...GGGGGGGG.....",
    "....GGGGGG......",
    "................",
    "................",
    "................",
    "................",
  ],

  // ===== Potions (by effect) =====
  P_HEALTH: [
    "................",
    ".......NN.......",
    "......NNNN......",
    ".....DWWWD......",
    "....DWMMMMWD....",
    "...DWWMMMMWWD...",
    "...DMMMWWMMMMD..",
    "...DMMMWWMMMMD..",
    "...DWWMMMMWWD...",
    "...DWMMMMMWWD...",
    "...DWWWWWWWWD...",
    "....DDWWWWDD....",
    "................",
    "................",
    "................",
    "................",
  ],
  P_MANA: [
    "................",
    ".......NN.......",
    "......NNNN......",
    ".....DWWWD......",
    "....DWMMMMWD....",
    "...DWWMMMMWWD...",
    "...DMMMMWMMMMD..",
    "...DMMMWMMMMD...",
    "...DMMMMWMMMMD..",
    "...DWMMMMMWWD...",
    "...DWWWWWWWWD...",
    "....DDWWWWDD....",
    "................",
    "................",
    "................",
    "................",
  ],
  P_POISON: [
    "................",
    ".......NN.......",
    "......NNNN......",
    ".....DWWWD......",
    "....DWMMMMWD....",
    "...DWWMMMMWWD...",
    "...DMMKKKKMMD...",
    "...DMKKMMKKMD...",
    "...DMMKKKKMMD...",
    "...DWMMMMMWWD...",
    "...DWWWWWWWWD...",
    "....DDWWWWDD....",
    "................",
    "................",
    "................",
    "................",
  ],
  P_GENERIC: [
    "................",
    ".......NN.......",
    "......NNNN......",
    ".....DWWWD......",
    "....DWMMMMWD....",
    "...DWMMMMMWWD...",
    "...DMMMMMMMMD...",
    "...DMMWMMMMMD...",
    "...DMMMMMMMMD...",
    "...DWMMMMMWWD...",
    "...DWWWWWWWWD...",
    "....DDWWWWDD....",
    "................",
    "................",
    "................",
    "................",
  ],

  // ===== Consumables =====
  C_BOMB: [
    "................",
    ".......KK.......",
    "......K..K......",
    ".....DMMMM K....",   // fuse top
    "...DDMMMMMMD....",
    "..DMMMMMMMMMD...",
    "..DMMMMMMMMMD...",
    "..DMMKKKKMMMD...",
    "..DMMMMMMMMMD...",
    "..DMMMMMMMMMD...",
    "...DDMMMMDD.....",
    "....DDDDDD......",
    "................",
    "................",
    "................",
    "................",
  ],
  C_POUCH: [
    "................",
    ".......KK.......",
    "......KMMK......",
    ".....KMMMMK.....",
    "....DMMMMMMD....",
    "...DMMMMMMMMD...",
    "...DMMWMMMMMD...",
    "...DMMMMMMMMD...",
    "...DMMMMMMMMD...",
    "....DDMMMMDD....",
    ".....DDDDDD.....",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],

  // ===== Stairs (descending staircase + down chevron) =====
  STAIR: [
    "................",
    "......WWWW......",
    ".....KKKKKK.....",
    "....KKCCCCCKK...",
    "...KKKCCCCCKKK..",
    "..KKKCCCLLCCKKK.",
    "..KKCCCCLLLCCCKK",
    "..KKCCCCCCCCCCKK",
    "...KKKKKKKKKKKK.",
    "................",
    ".......VV.......",
    "......VVVV......",
    ".......VV.......",
    "................",
    "................",
    "................",
  ],
  TRAP: [
    "................",
    "................",
    ".......L........",
    "......DMD.......",
    ".....DMMMD......",
    "....DMMMMMD.....",
    "...DMMMMMMMD....",
    "..DMMMMMMMMMD...",
    "..DDNNNNNNNNDD..",
    "..DNNNNNNNNNND..",
    "..DDDDDDDDDDDD..",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  FOUNTAIN: [
    "................",
    "................",
    ".......W........",
    "......WLW.......",
    ".....WLWLW......",
    "....DCCCCCCD....",
    "...DCCMMMMCCD...",
    "..DCCMMMMMMCCD..",
    "..DCMMMMMMMMCD..",
    "..DCCMMMMMMCCD..",
    "...DCCCCCCCCD...",
    "....DDCCCCDD....",
    ".....DDDDDD.....",
    "................",
    "................",
    "................",
  ],
  SHRINE: [
    "................",
    ".......G........",
    "......GLG.......",
    ".......G........",
    "....KKKKKKKK....",
    "...KCCCCCCCCK...",
    "...KCCGMMGCCK...",
    "...KCCGMMGCCK...",
    "...KCCCCCCCCK...",
    "....KKKKKKKK....",
    "....NNNNNNNN....",
    "...NNNNNNNNNN...",
    "................",
    "................",
    "................",
    "................",
  ],
};

// Blend a hex color toward white (amt 0..1).
function lighten(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const mix = (c: number) => Math.floor(c + (255 - c) * amt);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

// Fixed palette for player classes (baked-in colors; A/P/B/H are class mains).
const PLAYER_PAL: Record<string, string> = {
  A: '#4a6b8a', P: '#6a3a8a', B: '#3a6bc0', H: '#e8c84a',
  G: '#ffd54a', S: '#f0d098', K: '#2a1208', R: '#7a1f2b', N: '#5a3a1a',
  L: '#fff0a8', W: '#c8d8e8', C: '#8a8a96',
};

// Per-call palette where 'M'/'D'/'L' derive from the enemy/item color.
function buildPalette(main: string): Record<string, string> {
  return {
    M: main,
    D: darken(main, 0.5),
    L: lighten(main, 0.45),
    E: '#ff7a3c',
    K: '#140a0a',
    W: '#eaeaf0',
    C: '#8a8a96',
    G: '#ffd54a',
    N: '#6b4423',
    V: '#7ec8e3', // stair chevron accent
  };
}

// Stair uses fixed stone colors.
const STAIR_PAL: Record<string, string> = {
  K: '#3a4a5a', C: '#5a6a7a', W: '#9aaab8', L: '#b8c8d8', V: '#7ec8e3',
};

// ===== Offscreen sprite cache (16×16, drawn once per template+palette signature) =====
const spriteCache = new Map<string, HTMLCanvasElement>();

function getSprite(template: Template, pal: Record<string, string>, sig: string): HTMLCanvasElement {
  const cached = spriteCache.get(sig);
  if (cached) return cached;
  const cv = document.createElement('canvas');
  cv.width = N; cv.height = N;
  const cc = cv.getContext('2d')!;
  for (let r = 0; r < template.length; r++) {
    const row = template[r];
    for (let c = 0; c < row.length; c++) {
      const col = pal[row[c]];
      if (!col) continue;
      cc.fillStyle = col;
      cc.fillRect(c, r, 1, 1);
    }
  }
  spriteCache.set(sig, cv);
  return cv;
}

function blit(c: CanvasRenderingContext2D, x: number, y: number, sprite: HTMLCanvasElement): void {
  const prev = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  c.drawImage(sprite, Math.round(x), Math.round(y), TS, TS);
  c.imageSmoothingEnabled = prev;
}

// ===== Public draw API =====

export function drawPlayerSprite(c: CanvasRenderingContext2D, x: number, y: number, ci: number): void {
  const key = ci === 1 ? 'ROGUE' : ci === 2 ? 'MAGE' : ci === 3 ? 'PALADIN' : 'WARRIOR';
  blit(c, x, y, getSprite(TEMPLATES[key], PLAYER_PAL, 'PLAYER:' + key));
}

export function drawStairSprite(c: CanvasRenderingContext2D, x: number, y: number): void {
  blit(c, x, y, getSprite(TEMPLATES.STAIR, STAIR_PAL, 'STAIR'));
}

export function drawTrapSprite(c: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  blit(c, x, y, getSprite(TEMPLATES.TRAP, buildPalette(color), 'TRAP:' + color));
}

export function drawFountainSprite(c: CanvasRenderingContext2D, x: number, y: number): void {
  blit(c, x, y, getSprite(TEMPLATES.FOUNTAIN, buildPalette('#4895ef'), 'FOUNTAIN'));
}

export function drawShrineSprite(c: CanvasRenderingContext2D, x: number, y: number): void {
  blit(c, x, y, getSprite(TEMPLATES.SHRINE, buildPalette('#06d6a0'), 'SHRINE'));
}

export function drawBossSprite(c: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  blit(c, x, y, getSprite(TEMPLATES.BOSS, buildPalette(color), 'BOSS:' + color));
}

function pickEnemyTemplate(e: Enemy): Template {
  const tags = e.tags || [];
  if (tags.includes('undead')) return TEMPLATES.SKELETON;
  if (tags.includes('demon')) return TEMPLATES.DEMON;
  const n = e.name;
  if (/slime|ooze|blob|gel|史莱|黏|胶|果冻/.test(n)) return TEMPLATES.SLIME;
  if (/bat|raven|bird|spider|rat|wolf|hound|beast|serpent|snak|蝙蝠|蜘|鼠|狼|蛛|蛇/.test(n)) return TEMPLATES.BEAST;
  if (/dragon|drake|wyrm|wyvern|龙|蛟/.test(n)) return TEMPLATES.DEMON;
  return TEMPLATES.GOBLIN;
}

export function drawEnemySprite(c: CanvasRenderingContext2D, x: number, y: number, color: string, e: Enemy): void {
  const tpl = pickEnemyTemplate(e);
  const sig = (tpl === TEMPLATES.GOBLIN ? 'GOBLIN:' : tpl === TEMPLATES.SLIME ? 'SLIME:' : tpl === TEMPLATES.BEAST ? 'BEAST:' : tpl === TEMPLATES.SKELETON ? 'SKELETON:' : 'DEMON:') + color;
  blit(c, x, y, getSprite(tpl, buildPalette(color), sig));
}

// Pick a weapon template by its name (sword / axe / hammer / dagger / staff / spear / scythe).
function pickWeaponTemplate(name: string): Template {
  if (/axe|cleaver|斧/.test(name)) return TEMPLATES.W_AXE;
  if (/hammer|mace|锤/.test(name)) return TEMPLATES.W_HAMMER;
  if (/dagger|匕首/.test(name)) return TEMPLATES.W_DAGGER;
  if (/wand|staff|法杖|杖/.test(name)) return TEMPLATES.W_STAFF;
  if (/spear|trident|矛|戟/.test(name)) return TEMPLATES.W_SPEAR;
  if (/reaper|scythe|镰/.test(name)) return TEMPLATES.W_SCYTHE;
  return TEMPLATES.W_SWORD;
}

// Pick an item template by type (+ name for weapons, + effect for potions/consumables).
function pickItemTemplate(item: Item): Template {
  switch (item.type) {
    case 'weapon': return pickWeaponTemplate(item.name);
    case 'armor': return TEMPLATES.I_SHIELD;
    case 'accessory': return TEMPLATES.I_RING;
    case 'potion':
      if (item.ef === 'heal') return TEMPLATES.P_HEALTH;
      if (item.ef === 'mana') return TEMPLATES.P_MANA;
      if (item.ef === 'poison') return TEMPLATES.P_POISON;
      return TEMPLATES.P_GENERIC;
    case 'scroll': return TEMPLATES.I_SCROLL;
    case 'food': return TEMPLATES.I_FOOD;
    case 'gold': return TEMPLATES.I_GOLD;
    case 'consumable':
      if (item.ef === 'bomb') return TEMPLATES.C_BOMB;
      return TEMPLATES.C_POUCH;
    default: return TEMPLATES.C_POUCH;
  }
}

export function drawItemSprite(c: CanvasRenderingContext2D, x: number, y: number, item: Item): void {
  const tpl = pickItemTemplate(item);
  blit(c, x, y, getSprite(tpl, buildPalette(item.c), item.type + ':' + item.ef + ':' + item.name + ':' + item.c));
}

// Paint a named sprite into a 16×16 canvas — used by the legend/help panels so
// their icons match the in-game pixel sprites exactly. `kind` is a TEMPLATES key.
export function paintIcon(target: HTMLCanvasElement, kind: string, color = '#cccccc'): void {
  const ctx = target.getContext('2d');
  if (!ctx) return;
  if (target.width !== 16) { target.width = 16; target.height = 16; }
  let pal: Record<string, string>;
  if (kind === 'STAIR') pal = STAIR_PAL;
  else if (kind === 'WARRIOR' || kind === 'ROGUE' || kind === 'MAGE' || kind === 'PALADIN') pal = PLAYER_PAL;
  else pal = buildPalette(color);
  const tpl = TEMPLATES[kind];
  if (!tpl) { ctx.clearRect(0, 0, 16, 16); return; }
  const sprite = getSprite(tpl, pal, 'ICON:' + kind + color);
  ctx.clearRect(0, 0, 16, 16);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, 0, 0);
}

