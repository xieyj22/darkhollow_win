// Procedural PIXEL-ART sprites — 16×16 pixel matrices rendered via offscreen
// canvases and blitted with imageSmoothingEnabled=false for crisp scaled edges.
// Enemy templates use 'M' (main = enemy color). Item templates are per-type AND
// sub-type (sword/axe/hammer..., health/mana/poison...). Player has 4 class
// templates. To swap in real PNG art later, replace blit()/getSprite() — render.ts unchanged.
import type { Enemy, Item, ItemType, RelicDef } from './types.js';
import { TS } from './config.js';
import { darken } from './utils.js';

type Template = string[];
const N = 16; // pixel grid dimension

// Color codes: M=main · D=dark · L=light · E=eye(glow) · K=black · W=white/glass
//              G=gold · S=skin · R=red cloak · N=brown · C=grey
//              Player class mains: A=warrior steel · P=rogue purple · B=mage blue · H=paladin gold
export const TEMPLATES: Record<string, Template> = {
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
  DRAGON: [
    "...K........K...",
    "..KK........KK..",
    ".KDMMMMMMMMDK...",
    "KDMMMMMMMMMMDMDK",
    "DMMMMMKKKKMMMMMD",
    "DMMMMEEMMEEMMMMD",
    "DMMMMMMMMMMMMMMD",
    "..DMMMMMMMMMMD..",
    "...DMMMMMMMMMD..",
    "...DKMMMMMMMKD..",
    "..DDMMMMMMMMDD..",
    "...DKMMKKMMD....",
    "....DMMMMMD.....",
    ".....DMMMD......",
    "......KKK.......",
    "................",
  ],
  GOLEM: [
    "....KKKKKKKK....",
    "..KKMMMMMMMMKK..",
    "..KMMEMMMEMMMK..",
    "..KMMMMMMMMMMK..",
    ".KMMMMMMMMMMMMK.",
    "KMMMMMMMMMMMMMMK",
    "KMDMMMMMMMMMDMMK",
    "KMMMMMMMMMMMMMMK",
    "DKMMMMMMMMMMMMKD",
    ".KMMMMMMMMMMMMK.",
    "..KMMMMMMMMMMK..",
    "..KMMMMMMMMMMK..",
    "..KMMMMMMMMMMK..",
    "..KKMMMMMMMMKK..",
    "...KKKKKKKKKK...",
    "................",
  ],
  WRAITH: [
    "......KKKK......",
    ".....KMMMMK.....",
    "...KMMMMMMMMK...",
    "..KMMWMMMMWMMK..",
    "..KMMEMMMMMEMK..",
    "..KMMMMMMMMMMK..",
    "..KMMMMMMMMMMK..",
    "..DMMMMMMMMMMD..",
    "...DMMMMMMMMD...",
    "....DKMMMMKD....",
    "....DMMWWMMD....",
    ".....DMMWMD.....",
    ".....DWMMWD.....",
    "......DWWD......",
    "................",
    "................",
  ],
  ELEMENTAL: [
    "......LLLL......",
    "....LLMMMMLL....",
    "...LMMMMMMMML...",
    "..LMMMEMMMEMML..",
    "..LMMMMMMMMMML..",
    ".LMMMMMMMMMMMML.",
    ".LMMMMMMMMMMMML.",
    ".LMMMMMMMMMMMML.",
    ".LMMMDMMMMDMMML.",
    ".LMMMMMMMMMMMML.",
    "..LMMMMMMMMMML..",
    "..LMMMMMMMMMML..",
    "...LMMMMMMMML...",
    "....DMMMMMMD....",
    ".....DMMMMD.....",
    "................",
  ],
  CULTIST: [
    "......KKKK......",
    ".....KMMMMK.....",
    "...KMMMMMMMMK...",
    "..KMMEMMMMEMMK..",
    "..KMMMMMMMMMMK..",
    "..DMMMMMMMMMMD..",
    ".DMMMMMMMMMMMMD.",
    "DMMMMMMMMMMMMMMD",
    "DMMMDMMMMMMDMMMD",
    "DMMMMMMMMMMMMMMD",
    ".DMMMMMMMMMMMMD.",
    "..DMMMMMMMMMMD..",
    "..DMMMMMMMMMMD..",
    "..KKMMMMMMMMKK..",
    ".KKKKKKKKKKKKKK.",
    "................",
  ],
  // ===== Playtest #10: new enemy templates (11) — route via pickEnemyTemplate tags =====
  BAT: [
    "................",
    ".KK..........KK.",
    ".DK..........KD.",
    ".DMMDD....DDMMD.",
    ".DMMMMDDDDMMMMD.",
    "..DMMMMMMMMMMD..",
    "...DMEMMMEMD....",
    "...DMMMMMMMD....",
    "....DKMMKD......",
    ".....DMMMD......",
    "......DKD.......",
    ".......K........",
    "................",
    "................",
    "................",
    "................",
  ],
  HOUND: [
    "................",
    "...K........K...",
    "..KK........KK..",
    "..DMMKK..KKMMD..",
    "..DMMMMMMMMMMD..",
    "..DMEEMMMMEMMD..",
    "...DMMKKKKMMD...",
    "....DMMMMMD.....",
    "...DDMMMMMDDD...",
    "...D..D..D..D...",
    "...D..D..D..D...",
    "...K..K..K..K...",
    "................",
    "................",
    "................",
    "................",
  ],
  INSECT: [
    "................",
    "................",
    ".D..D..D..D..D..",
    "..DD.DD.DD.DD...",
    "...DMMMMMMMMD...",
    "..DMMEMMMMEMMD..",
    "..DMMMMMMMMMMD..",
    "...DMMMMMMMMD...",
    "..DD.DD.DD.DD...",
    ".D..D..D..D..D..",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  RODENT: [
    "................",
    "................",
    "....K......K....",
    "...DK......KD...",
    "...DMM....MMD...",
    "...DMEEEEEMD....",
    "...DMMMMMMMD....",
    "....DMMMMMD....K",
    "....DMMMMMD...KK",
    "....DKKKKD...KK.",
    ".....DKKD....K..",
    "......DD........",
    "................",
    "................",
    "................",
    "................",
  ],
  AQUATIC: [
    "................",
    "................",
    "..............K.",
    "..K..........KK.",
    ".KK..DMMMMMD.KK.",
    ".KK.DMEMMMMMDKK.",
    ".KK..DMMMMMD.KK.",
    "..K..........KK.",
    "..............K.",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  KNIGHT: [
    "................",
    ".....KKKKKK.....",
    "....KCCCCCCCK...",
    "....KCWKWKWCK...",
    "....KCCCCCCCK...",
    "...KKKCCCCCKKK..",
    "..KMMMCCCCCMMMK.",
    "..KMMMCCCCCMMMK.",
    "..KMMMKDDKKMMMK.",
    "..KMMMD..DMMMD..",
    "...KMM....MMK...",
    "...KMK....KMK...",
    "...KK......KK...",
    "................",
    "................",
    "................",
  ],
  BRUTE: [
    "................",
    "......KKKK......",
    ".....KMMMMK.....",
    ".....KMEEMK.....",
    "....KKMMMMKK....",
    "...KMMMMMMMMK...",
    "..KMMMMMMMMMMK..",
    "..KMMMMMMMMMMK..",
    "...KMMMMMMMMK...",
    "....DKMMMMKD....",
    "....DDK..KDD....",
    "....KK....KK....",
    "................",
    "................",
    "................",
    "................",
  ],
  CASTER: [
    ".......W........",
    "......KWK.......",
    ".....KMMMK......",
    ".....KMEEM......",
    "....KKMMMMKK....",
    "...KMMMMMMMMK...",
    "..KMMMMMMMMMMK..",
    "..KMMMMMMMMMMK..",
    "..KMMMMMMMMMMK..",
    "...KMMMMMMMMK...",
    "....KKKMMKKK....",
    ".....KK..KK.....",
    ".....KK..KK.....",
    "................",
    "................",
    "................",
  ],
  ABERRATION: [
    "................",
    ".K...K...K...K..",
    "..K..K..K..K....",
    "...KMMMMMMMMK...",
    "..KMMMMMMMMMMK..",
    "..KMMWMMMMWMMK..",
    "..KMMEMMMMMEMK..",
    "..KMMMMMMMMMMK..",
    "...KMMMMMMMMK...",
    "....KKKKKKKK....",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  SERAPH: [
    ".......G........",
    "......KWK.......",
    ".....KMMMK......",
    ".WW..KMEEM..WW..",
    "WWWW.KMMMMK.WWWW",
    ".WWWKMMMMMMKWWW.",
    "..KKMMMMMMMMKK..",
    "...KMMMMMMMMK...",
    "...KMMMMMMMMK...",
    "....KKMMMMKK....",
    ".....KMMMMK.....",
    ".....KK..KK.....",
    ".....KK..KK.....",
    "................",
    "................",
    "................",
  ],
  FUNGI: [
    "................",
    "......KKKK......",
    ".....KWWWWK.....",
    "....KWMMMMWK....",
    "...KWMMWMMMWK...",
    "..KWMWKWKWMMWK..",
    "...KMMMMMMMMK...",
    "....DKMMMMKD....",
    ".....DKMMKD.....",
    ".....DKMMKD.....",
    "......DKKD......",
    "......DKKD......",
    ".......KK.......",
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
  // Armor subtypes (Task 5): plate/leather/cloak/robe/scale — I_SHIELD stays fallback.
  I_PLATE: [
    "................",
    ".....DDDDDD.....",
    "....DMMMMMMD....",
    "...DMMMMMMMMD...",
    "...DMLMMMMMMD...",
    "...DMMMMMMMMD...",
    "...DMMKKKKMMD...",
    "...DMMKLLKMMD...",
    "...DMMKKKKMMD...",
    "...DMMMMMMMMD...",
    "...DMMWWWWMMD...",
    "....DMMMMMMD....",
    ".....DDDDDD.....",
    "......DDDD......",
    "................",
    "................",
  ],
  I_LEATHER: [
    "................",
    "................",
    "....DDDDDDDD....",
    "...DMMMMMMMMD...",
    "..DMMMMMMMMMMD..",
    "..DMMNMMMMNMMD..",
    "..DMMMMGGMMMMD..",
    "..DMMMMGGMMMMD..",
    "..DMMNMMMMNMMD..",
    "..DMMMMMMMMMMD..",
    "...DMMMMMMMMD...",
    "....DDDDDDDD....",
    "................",
    "................",
    "................",
    "................",
  ],
  I_CLOAK: [
    "................",
    ".......KK.......",
    "......KGGK......",
    ".....KMMMMK.....",
    "....KMMMMMMK....",
    "....KMMLMMMK....",
    "...KMMMMMMMMK...",
    "...KMMLMMMMMK...",
    "..KMMMMMMMMMMK..",
    "..KMMLMMMMMMMK..",
    "..KMMMMMMMMMMK..",
    "..KMMMMMMMMMMK..",
    "...KMMMMMMMMK...",
    "....KKKKKKKK....",
    "................",
    "................",
  ],
  I_ROBE: [
    "................",
    ".......KK.......",
    "......KMMK......",
    ".....KMMLMK.....",
    "....KMMMMMMK....",
    "....KMMMMMMK....",
    "....KMMMMMMK....",
    "....KMMMMMMK....",
    "....KMMMMMMK....",
    "...KMMMMMMMMK...",
    "...KMMMMMMMMK...",
    "..KMMMMMMMMMMK..",
    "..KKKKKKKKKKKK..",
    "................",
    "................",
    "................",
  ],
  I_SCALE: [
    "................",
    "................",
    "..DMDMDMDMDMDM..",
    "..MMMMMMMMMMMM..",
    "..DMDMDMDMDMDM..",
    "..MMMMMMMMMMMM..",
    ".DMDMDMDMDMDMDM.",
    ".MMMMMMMMMMMMMM.",
    ".DMDMDMDMDMDMDM.",
    ".MMMMMMMMMMMMMM.",
    "..DMDMDMDMDMDM..",
    "..MMMMMMMMMMMM..",
    "..DDDDDDDDDDDD..",
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
  // Accessory subtypes (Task 5): amulet/brooch/crown — I_RING reused for ring.
  I_AMULET: [
    "................",
    ".....KK..KK.....",
    "....KMMMMMMK....",
    ".....KMMMMK.....",
    "......KMMK......",
    "......DGGD......",
    ".....DMMMMD.....",
    ".....DWMMMD.....",
    ".....DMMMMD.....",
    "......DGGD......",
    ".......KK.......",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  I_BROOCH: [
    "................",
    "................",
    ".......N........",
    "......NN........",
    ".....N..........",
    "..KKKKKKKKKKKK..",
    "..KMMMGGMGMMMK..",
    "..KMMMMMMMMMMK..",
    "..KMMMGGMGMMMK..",
    "..KKKKKKKKKKKK..",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  I_CROWN: [
    "................",
    ".......K........",
    "......KMK.......",
    ".....KMMMK......",
    "...K.......K....",
    "...KK.....KK....",
    "....KKKKKKKK....",
    "..KKKKKKKKKKKK..",
    "..KWWGGGGGGWWK..",
    "..KGGGGGGGGGGK..",
    "..KKKKKKKKKKKK..",
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
  // Scroll subtypes (Task 5): fire/frost/arcane/holy — shared body, elemental accent.
  SC_FIRE: [
    "................",
    "................",
    "......NNNN......",
    ".....NMMMMN.....",
    "....NMWWWWMN....",
    "...NMWWWWWWMN...",
    "...NMWWEEWWMN...",
    "...NMWLEELWMN...",
    "...NMWWEEWWMN...",
    "...NMWWWWWWMN...",
    "....NMWWWWMN....",
    ".....NMMMMN.....",
    "......NNNN......",
    "................",
    "................",
    "................",
  ],
  SC_FROST: [
    "................",
    "................",
    "......NNNN......",
    ".....NMMMMN.....",
    "....NMWWWWMN....",
    "...NMWWWWWWMN...",
    "...NMWCWWCWMN...",
    "...NMWCCCCWMN...",
    "...NMWCWWCWMN...",
    "...NMWWWWWWMN...",
    "....NMWWWWMN....",
    ".....NMMMMN.....",
    "......NNNN......",
    "................",
    "................",
    "................",
  ],
  SC_ARCANE: [
    "................",
    "................",
    "......NNNN......",
    ".....NMMMMN.....",
    "....NMWWWWMN....",
    "...NMWWWWWWMN...",
    "...NMWKWWKWMN...",
    "...NMWWKKWWMN...",
    "...NMWKWWKWMN...",
    "...NMWWWWWWMN...",
    "....NMWWWWMN....",
    ".....NMMMMN.....",
    "......NNNN......",
    "................",
    "................",
    "................",
  ],
  SC_HOLY: [
    "................",
    "................",
    "......NNNN......",
    ".....NMMMMN.....",
    "....NMWWWWMN....",
    "...NMWWWWWWMN...",
    "...NMWWGGWWMN...",
    "...NMWGWWGWMN...",
    "...NMWWGGWWMN...",
    "...NMWWWWWWMN...",
    "....NMWWWWMN....",
    ".....NMMMMN.....",
    "......NNNN......",
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
  // Food subtypes (Task 5): meat/bread/feast — I_FOOD stays fallback.
  FD_MEAT: [
    "................",
    "................",
    "......KK........",
    ".....KWWK.......",
    "......KK........",
    ".....KKMK.......",
    "....KKMMMMKK....",
    "...KMMMMMMMMK...",
    "...KMMMMMMMMK...",
    "...KMMMLLMMMK...",
    "...KMMMMMMMMK...",
    "....KMMMMMMK....",
    ".....KKKKKK.....",
    "................",
    "................",
    "................",
  ],
  FD_BREAD: [
    "................",
    "................",
    "................",
    "......DDDD......",
    ".....DMMMMD.....",
    "....DMMMMMMD....",
    "...DMMMMMMMMD...",
    "..DMMNMMMNMMMD..",
    "..DMMMMMMMMMMD..",
    "..DMMNMMMNMMMD..",
    "..DMMMMMMMMMMD..",
    "...DMMMMMMMMD...",
    "....DMMMMMMD....",
    ".....DDDDDD.....",
    "................",
    "................",
  ],
  FD_FEAST: [
    "................",
    "................",
    "................",
    "..CCCCCCCCCCCC..",
    ".CCCCCCCCCCCCCC.",
    ".CCMMMMMMMMMMCC.",
    ".CCMMNMMNMMMMCC.",
    ".CCMMMMMMMMMMCC.",
    ".CCMMGMMMGMMMCC.",
    ".CCMMMMMMMMMMCC.",
    ".CCCCCCCCCCCCCC.",
    "..CCCCCCCCCCCC..",
    "................",
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
  // Consumable subtypes (Task 5): trap/tool — C_BOMB and C_POUCH reused.
  C_TRAP: [
    "................",
    "................",
    "...K..K..K..K...",
    "..KKKKKKKKKKKKK.",
    "..K...........K.",
    "..KKKKKKKKKKKKK.",
    "...K..K..K..K...",
    ".....NNNNNN.....",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  C_TOOL: [
    "................",
    ".......E........",
    "......EWE.......",
    ".......E........",
    "......ENE.......",
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

  // ===== Relic templates (Task 6) — themed by effect, ~7 silhouettes.
  // Each relic gets def.c-driven palette so same-template relics still differ
  // in color. Premium feel via E (#ff7a3c glow) + G (#ffd54a gold) accents.
  // R_ATTACK — radiant blade (offense: atk/crit/execute/fire/lifesteal).
  R_ATTACK: [
    "................",
    ".......E........",
    "......ELE.......",
    ".......E........",
    ".......ML.......",
    ".......MM.......",
    ".......MM.......",
    ".......MM.......",
    ".......MM.......",
    "......GGGG......",
    ".......NN.......",
    ".......NN.......",
    "......KNNK......",
    "................",
    "................",
    "................",
  ],
  // R_DEFENSE — ward shield with glowing gem boss (def/dodge/maxhp/thorns).
  R_DEFENSE: [
    "................",
    ".....KKKKKK.....",
    "....KGGGGGGK....",
    "...KGMMMMMMGK...",
    "...KMMMMMMMMK...",
    "...KMMWMMWMMK...",
    "...KMMMEEEMMK...",
    "...KMMMMMMMMK...",
    "...KMMKKKKMMK...",
    "...KMMMMMMMMK...",
    "....KMMMMMMK....",
    ".....KKKKKK.....",
    "......KKKK......",
    "................",
    "................",
    "................",
  ],
  // R_ARCANE — glowing glass orb on a pedestal (spell/exp/crystal/amulet).
  R_ARCANE: [
    "................",
    ".......EE.......",
    "......EWWWE.....",
    ".....EWMMMWE....",
    ".....EMMLMME....",
    ".....EWMMMWE....",
    "......EWWWE.....",
    ".......EE.......",
    ".......NN.......",
    "......KNNK......",
    "......KNNK......",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  // R_SOUL — heart with soul-flame (lifesteal/revive/kill-mp/soul).
  R_SOUL: [
    "................",
    ".......E........",
    "......EWE.......",
    ".....EE..EE.....",
    "....KEEEKEEEK...",
    "....KMMMMMMMK...",
    "....KMMEEEMMK...",
    "....KMMMMMMMK...",
    ".....KMMMMMK....",
    "......KMMMK.....",
    ".......KMK......",
    "........K.......",
    "................",
    "................",
    "................",
    "................",
  ],
  // R_NATURE — faceted frost crystal (ice/wind/dodge-heal).
  R_NATURE: [
    "................",
    ".......E........",
    "......WLW.......",
    ".....WLMMLW.....",
    "....WLMMMMLW....",
    "....WMMMMMMW....",
    "....WLMMMMLW....",
    ".....WLMMLW.....",
    "......WLW.......",
    ".......W........",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  // R_VOID — abyssal eye with glowing iris (void/corruption/chaos/endless).
  R_VOID: [
    "................",
    "................",
    ".....KKKKKK.....",
    "....KMMMMMMMK...",
    "...KMMWMMWMMMK..",
    "...KMMMEEEEMMK..",
    "...KMMMKKKMMMK..",
    "...KMMMMMMMMMK..",
    "....KMMMMMMMK...",
    ".....KKKKKK.....",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  // R_UTILITY — gold idol/totem with glowing eye (greed/luck/economy + fallback).
  R_UTILITY: [
    "................",
    "......KGGK......",
    ".....KGLLGK.....",
    "....KGGGGGGK....",
    "....KGMGMMGK....",
    "....KGGEGGGK....",
    "....KGGEGGGK....",
    "....KGGGGGGK....",
    "....KNNNNNNK....",
    ".....KNNNNK.....",
    "......KKKK......",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
};

// Dev-time sanity: every template row must be exactly N(16) chars.
for (const [k, tpl] of Object.entries(TEMPLATES)) {
  for (const row of tpl) if (row.length !== N) console.error(`TEMPLATE ${k} bad row len ${row.length}: "${row}"`);
}

// Blend a hex color toward white (amt 0..1).
function lighten(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const mix = (c: number) => Math.floor(c + (255 - c) * amt);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

// Canonicalize an `rgb(r,g,b)` / `rgba(...)` CSS color to `#rrggbb` hex so it
// survives darken/lighten's hex-only guard. Already-`#hex` input passes through.
// Used by rarityTint so item.c is always canonical hex for buildPalette shading.
function rgbToHex(col: string): string {
  if (col.startsWith('#')) return col;
  const m = col.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return col;
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(+m[1])}${h(+m[2])}${h(+m[3])}`;
}

// Fixed palette for player classes (baked-in colors; A/P/B/H are class mains).
const PLAYER_PAL: Record<string, string> = {
  A: '#4a6b8a', P: '#6a3a8a', B: '#3a6bc0', H: '#e8c84a',
  G: '#ffd54a', S: '#f0d098', K: '#2a1208', R: '#7a1f2b', N: '#5a3a1a',
  L: '#fff0a8', W: '#c8d8e8', C: '#8a8a96',
};

// Type-base color + rarity luminance boost. Preserves hue family so weapon/armor/
// accessory stay recognizable; rarity stretches lightness. rarity 5 (endless) → void purple.
// Deterministic: same (base, rarity) always yields the same swatch.
export function rarityTint(base: string, rarity: number): string {
  if (rarity >= 5) return '#9b5de5';
  switch (rarity) {
    case 0: return rgbToHex(darken(base, 0.70));
    case 1: return rgbToHex(darken(base, 0.88));
    case 2: return base;
    case 3: return rgbToHex(lighten(base, 0.18));
    default: return rgbToHex(lighten(base, 0.34));   // rarity 4
  }
}

// Derive a sprite color for a catalog DEF (not a runtime Item). Weapons/armor/
// accessories store only rarity `r` (no `c`), so their color comes from
// rarityTint on a per-type base hue; potions/scrolls/consumables/food/relics
// already carry `c` and return it verbatim. Used by the Codex items tab, which
// iterates defs rather than live Items.
export function catalogSpriteColor(def: { r?: number; c?: string }, type: ItemType): string {
  switch (type) {
    case 'weapon': return rarityTint('#f4845f', def.r ?? 2);
    case 'armor': return rarityTint('#7ec8e3', def.r ?? 2);
    case 'accessory': return rarityTint('#06d6a0', def.r ?? 2);
    default: return def.c || '#cccccc';   // potion/scroll/consumable/food/relic
  }
}

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

const OUTLINE_COLOR = '#0a0a0a';
// Dark silhouette cache (all opaque pixels -> outline color), keyed by sprite sig.
const silCache = new Map<string, HTMLCanvasElement>();
function getSilhouette(sig: string, sprite: HTMLCanvasElement): HTMLCanvasElement {
  const cached = silCache.get(sig);
  if (cached) return cached;
  const cv = document.createElement('canvas');
  cv.width = N; cv.height = N;
  const cc = cv.getContext('2d')!;
  cc.drawImage(sprite, 0, 0);
  cc.globalCompositeOperation = 'source-in';
  cc.fillStyle = OUTLINE_COLOR;
  cc.fillRect(0, 0, N, N);
  silCache.set(sig, cv);
  return cv;
}

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

// Blit with a dark outline: stamp the silhouette at ±thickness on all 8(ish)
// neighbor offsets, then the real sprite. Pixel-art readability on busy tiles.
function blitOutlined(c: CanvasRenderingContext2D, x: number, y: number, sprite: HTMLCanvasElement, sig: string, thickness = 1): void {
  const sil = getSilhouette(sig, sprite);
  const prev = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  for (let dy = -thickness; dy <= thickness; dy++)
    for (let dx = -thickness; dx <= thickness; dx++)
      if (dx !== 0 || dy !== 0) c.drawImage(sil, Math.round(x + dx), Math.round(y + dy), TS, TS);
  c.drawImage(sprite, Math.round(x), Math.round(y), TS, TS);
  c.imageSmoothingEnabled = prev;
}

// ===== Public draw API =====

export function drawPlayerSprite(c: CanvasRenderingContext2D, x: number, y: number, ci: number): void {
  const key = ci === 1 ? 'ROGUE' : ci === 2 ? 'MAGE' : ci === 3 ? 'PALADIN' : 'WARRIOR';
  const sig = 'PLAYER:' + key;
  blitOutlined(c, x, y, getSprite(TEMPLATES[key], PLAYER_PAL, sig), sig);
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
  const sig = 'BOSS:' + color;
  blitOutlined(c, x, y, getSprite(TEMPLATES.BOSS, buildPalette(color), sig), sig, 2);
}

function pickEnemyTemplate(e: Enemy): { tpl: Template; key: string } {
  const tags = e.tags || [];
  const has = (t: string) => tags.includes(t);
  // Priority: most specific first. undead/demon are KEPT on enemies for holy_water
  // gameplay (holy weakness), so the specific templates (seraph/knight/mage/fungi/
  // ...) must be checked BEFORE undead/demon so they win the sprite route.
  if (has('dragon'))     return { tpl: TEMPLATES.DRAGON,     key: 'DRAGON' };
  if (has('seraph'))     return { tpl: TEMPLATES.SERAPH,     key: 'SERAPH' };
  if (has('aberration')) return { tpl: TEMPLATES.ABERRATION, key: 'ABERRATION' };
  if (has('spirit'))     return { tpl: TEMPLATES.WRAITH,     key: 'WRAITH' };
  if (has('fungi'))      return { tpl: TEMPLATES.FUNGI,      key: 'FUNGI' };
  if (has('bat'))        return { tpl: TEMPLATES.BAT,        key: 'BAT' };
  if (has('hound'))      return { tpl: TEMPLATES.HOUND,      key: 'HOUND' };
  if (has('insect'))     return { tpl: TEMPLATES.INSECT,     key: 'INSECT' };
  if (has('rodent'))     return { tpl: TEMPLATES.RODENT,     key: 'RODENT' };
  if (has('aquatic'))    return { tpl: TEMPLATES.AQUATIC,    key: 'AQUATIC' };
  if (has('knight'))     return { tpl: TEMPLATES.KNIGHT,     key: 'KNIGHT' };
  if (has('mage'))       return { tpl: TEMPLATES.CASTER,     key: 'CASTER' };
  if (has('brute'))      return { tpl: TEMPLATES.BRUTE,      key: 'BRUTE' };
  if (has('construct'))  return { tpl: TEMPLATES.GOLEM,      key: 'GOLEM' };
  if (has('elemental'))  return { tpl: TEMPLATES.ELEMENTAL,  key: 'ELEMENTAL' };
  if (has('cultist'))    return { tpl: TEMPLATES.CULTIST,    key: 'CULTIST' };
  if (has('demon'))      return { tpl: TEMPLATES.DEMON,      key: 'DEMON' };
  if (has('undead'))     return { tpl: TEMPLATES.SKELETON,   key: 'SKELETON' };
  if (has('slime'))      return { tpl: TEMPLATES.SLIME,      key: 'SLIME' };
  if (has('beast'))      return { tpl: TEMPLATES.BEAST,      key: 'BEAST' };
  // Name-regex fallback — i-flagged so English capitalized names (Wolf/Spider/...)
  // also match (the original was case-sensitive and mis-routed to GOBLIN in en).
  const n = e.name;
  if (/slime|ooze|blob|gel|史莱|黏|胶|果冻/i.test(n)) return { tpl: TEMPLATES.SLIME, key: 'SLIME' };
  if (/dragon|drake|wyrm|wyvern|龙|蛟/i.test(n))     return { tpl: TEMPLATES.DRAGON, key: 'DRAGON' };
  if (/golem|gargoyle|construct|魔像|巨像/i.test(n)) return { tpl: TEMPLATES.GOLEM,  key: 'GOLEM' };
  if (/wraith|ghost|spirit|specter|怨灵|幽/i.test(n))return { tpl: TEMPLATES.WRAITH, key: 'WRAITH' };
  if (/elemental|behemoth|熔岩|元素/i.test(n))       return { tpl: TEMPLATES.ELEMENTAL, key: 'ELEMENTAL' };
  if (/cultist|zealot|inquisitor|信徒|裁官/i.test(n))return { tpl: TEMPLATES.CULTIST, key: 'CULTIST' };
  if (/bat|raven|bird|spider|rat|wolf|hound|beast|beetle|serpent|snak|蝙蝠|蜘|鼠|狼|蛛|蛇|甲虫/i.test(n)) return { tpl: TEMPLATES.BEAST, key: 'BEAST' };
  return { tpl: TEMPLATES.GOBLIN, key: 'GOBLIN' };
}

export function drawEnemySprite(c: CanvasRenderingContext2D, x: number, y: number, color: string, e: Enemy): void {
  const { tpl, key } = pickEnemyTemplate(e);
  const sig = key + ':' + color;
  blitOutlined(c, x, y, getSprite(tpl, buildPalette(color), sig), sig);
}

// Pick a weapon template by its name (sword / axe / hammer / dagger / staff / spear / scythe).
function pickWeaponTemplate(name: string): { tpl: Template; key: string } {
  if (/axe|cleaver|斧/.test(name)) return { tpl: TEMPLATES.W_AXE, key: 'W_AXE' };
  if (/hammer|mace|锤/.test(name)) return { tpl: TEMPLATES.W_HAMMER, key: 'W_HAMMER' };
  if (/dagger|匕首/.test(name)) return { tpl: TEMPLATES.W_DAGGER, key: 'W_DAGGER' };
  if (/wand|staff|法杖|杖/.test(name)) return { tpl: TEMPLATES.W_STAFF, key: 'W_STAFF' };
  if (/spear|trident|矛|戟/.test(name)) return { tpl: TEMPLATES.W_SPEAR, key: 'W_SPEAR' };
  if (/reaper|scythe|镰/.test(name)) return { tpl: TEMPLATES.W_SCYTHE, key: 'W_SCYTHE' };
  return { tpl: TEMPLATES.W_SWORD, key: 'W_SWORD' };
}

// Pick an item template by type (+ name for weapons, + subType/ef for variants).
function pickItemTemplate(item: Item): { tpl: Template; key: string } {
  switch (item.type) {
    case 'weapon': return pickWeaponTemplate(item.name);
    case 'armor': {
      // plate/leather/cloak/robe/scale → I_PLATE/I_LEATHER/...; default I_SHIELD.
      const k = 'I_' + (item.subType || 'shield').toUpperCase();
      return TEMPLATES[k] ? { tpl: TEMPLATES[k], key: k } : { tpl: TEMPLATES.I_SHIELD, key: 'I_SHIELD' };
    }
    case 'accessory': {
      // ring/amulet/brooch/crown → I_RING/I_AMULET/I_BROOCH/I_CROWN.
      const sub = item.subType || 'ring';
      const k = 'I_' + sub.toUpperCase();
      return TEMPLATES[k] ? { tpl: TEMPLATES[k], key: k } : { tpl: TEMPLATES.I_RING, key: 'I_RING' };
    }
    case 'potion':
      if (item.ef === 'heal') return { tpl: TEMPLATES.P_HEALTH, key: 'P_HEALTH' };
      if (item.ef === 'mana') return { tpl: TEMPLATES.P_MANA, key: 'P_MANA' };
      if (item.ef === 'poison') return { tpl: TEMPLATES.P_POISON, key: 'P_POISON' };
      return { tpl: TEMPLATES.P_GENERIC, key: 'P_GENERIC' };
    case 'scroll': {
      // fire/frost/arcane/holy → SC_FIRE/SC_FROST/SC_ARCANE/SC_HOLY; default I_SCROLL.
      const k = item.subType ? 'SC_' + item.subType.toUpperCase() : 'I_SCROLL';
      return TEMPLATES[k] ? { tpl: TEMPLATES[k], key: k } : { tpl: TEMPLATES.I_SCROLL, key: 'I_SCROLL' };
    }
    case 'food': {
      // meat/bread/feast → FD_MEAT/FD_BREAD/FD_FEAST; default I_FOOD.
      const k = item.subType ? 'FD_' + item.subType.toUpperCase() : 'I_FOOD';
      return TEMPLATES[k] ? { tpl: TEMPLATES[k], key: k } : { tpl: TEMPLATES.I_FOOD, key: 'I_FOOD' };
    }
    case 'gold': return { tpl: TEMPLATES.I_GOLD, key: 'I_GOLD' };
    case 'consumable': {
      // bomb/trap/pouch/tool → C_BOMB/C_TRAP/C_POUCH/C_TOOL (subType-driven).
      const m: Record<string, string> = { bomb: 'C_BOMB', trap: 'C_TRAP', pouch: 'C_POUCH', tool: 'C_TOOL' };
      const k = m[item.subType || 'pouch'] || 'C_POUCH';
      return { tpl: TEMPLATES[k], key: k };
    }
    default: return { tpl: TEMPLATES.C_POUCH, key: 'C_POUCH' };
  }
}

export function drawItemSprite(c: CanvasRenderingContext2D, x: number, y: number, item: Item): void {
  const { tpl, key } = pickItemTemplate(item);
  // Sprite visuals depend only on template (type+ef → key) + palette (color).
  // sig uses `key` (not item.name) so the sprite cache stays bounded — and key
  // will carry subType routing in Task 5 when weapons/potions get variants.
  const sig = key + ':' + item.c;
  blitOutlined(c, x, y, getSprite(tpl, buildPalette(item.c), sig), sig);
}

// Public helper: the TEMPLATES key an item maps to (W_SWORD / I_SHIELD / P_HEALTH ...).
// Used by paintItemIcon so HTML panels can render the exact in-game pixel sprite.
export function itemSpriteKind(item: Item): string {
  return pickItemTemplate(item).key;
}

// Paint an item's pixel sprite into a 16×16 canvas — the panel-facing wrapper
// around paintIcon. Used by inventory + hotbar so their icons match the map.
export function paintItemIcon(target: HTMLCanvasElement, item: Item): void {
  paintIcon(target, itemSpriteKind(item), item.c);
}

// Paint a relic's pixel sprite into a 16×16 canvas. Relics aren't runtime Items
// (no pickItemTemplate routing), so they route by def.spriteKind directly. The
// def.c color drives the palette so same-template relics still differ in hue.
// Task 6: used by the pickup popup, inventory relic row, and Codex relic rows.
export function paintRelicIcon(target: HTMLCanvasElement, def: RelicDef): void {
  paintIcon(target, def.spriteKind || 'R_UTILITY', def.c);
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

