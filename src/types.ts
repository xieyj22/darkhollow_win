// ===== Core Type Definitions =====

export interface I18nText {
  en: string;
  zh: string;
}

export interface I18nDesc {
  en: string;
  zh: string;
}

// --- Element System ---

export type Element = 'fire' | 'ice' | 'lightning' | 'shadow' | 'holy' | 'none';

// --- Race & Class ---

export interface RaceDef {
  name: I18nText;
  hpM: number;
  atkM: number;
  defM: number;
  mpM: number;
  desc: I18nText;
}

export interface SkillDef {
  name: I18nText;
  desc: I18nText;
  cost: number;
  cd: number;
  effect: string;
}

export interface ClassDef {
  name: I18nText;
  hp: number;
  mp: number;
  atk: number;
  def: number;
  desc: I18nText;
  skill: SkillDef;
}

// --- Items ---

export interface WeaponDef {
  n: I18nText;
  r: number;
  a: number;
  ch: string;
  el?: Element;
  set?: string;
}

export interface ArmorDef {
  n: I18nText;
  r: number;
  d: number;
  ch: string;
  el?: Element;
  set?: string;
}

export interface AccessoryDef {
  n: I18nText;
  r: number;
  a: number;
  d: number;
  h: number;
  ch: string;
  set?: string;
}

export interface PotionDef {
  n: I18nText;
  ef: string;
  v: number;
  c: string;
  ch: string;
  dur?: number;
}

export interface ScrollDef {
  n: I18nText;
  ef: string;
  v: number;
  c: string;
  ch: string;
  dur?: number;
}

export interface ConsumableDef {
  n: I18nText;
  ef: string;
  v: number;
  c: string;
  ch: string;
  r: number;
  desc: I18nText;
  dur?: number;
}

export interface FoodDef {
  n: I18nText;
  hungerRestore: number;
  hpHeal?: number;
  c: string;
  ch: string;
  r: number;
}

export interface TrapDef {
  n: I18nText;
  dmg: number;
  c: string;
  ds: I18nText;
  ef?: string;
  dur?: number;
}

// --- Runtime item (in inventory / on ground) ---

export type ItemType = 'weapon' | 'armor' | 'accessory' | 'potion' | 'scroll' | 'food' | 'consumable' | 'gold';

export interface Item {
  type: ItemType;
  name: string;
  rarity: number;
  ch: string;
  c: string;
  desc: string;
  x: number;
  y: number;
  // weapon
  atk?: number;
  // armor
  def?: number;
  // accessory
  hp?: number;
  // potion/scroll/consumable
  ef?: string;
  val?: number;
  dur?: number;
  // gold
  value?: number;
  // runtime
  id?: boolean;
  // element & set
  el?: Element;
  set?: string;
  // map entity marker — when set, this "item" is not picked up; stepping on it
  // triggers its associated event instead. Used for chests/merchants on the map.
  npc?: 'merchant' | 'chest' | 'treasure_merchant' | 'fountain' | 'shrine';
  // merchant stock for treasure merchant (list of pre-rolled item refs to buy)
  stock?: Item[];
}

// --- Enemies ---

export interface EnemyDef {
  n: I18nText;
  ch: string;
  c: string;
  hp: number;
  atk: number;
  def: number;
  exp: number;
  g: [number, number];
  ai: string;
  mf: number;
  el?: Element;
  res?: Partial<Record<Element, number>>;
  tags?: string[];
  skill?: {
    name: I18nText;
    effect: string;
    chance: number;
    dmg?: number;
  };
}

export interface BossDef {
  n: I18nText;
  ch: string;
  c: string;
  hp: number;
  atk: number;
  def: number;
  exp: number;
  g: [number, number];
  fl: number;
  el?: Element;
  phases?: Array<{
    hpThreshold: number;
    atkM: number;
    newAi?: string;
    newEl?: Element;
  }>;
  // Boss summon adds: randomly summons minions during the fight.
  summon?: {
    chance: number;   // probability per eligible turn (0..1)
    cd: number;       // cooldown turns between summon attempts
    maxAdds: number;  // cap of alive summoned adds at once
    kind?: string;    // 指定召唤敌人的 n.en;省略则用楼层随机池
  };
}

export interface ElitePrefix {
  n: I18nText;
  hpM: number;
  atkM: number;
  defM?: number;
  expM: number;
  goldM: number;
}

// Runtime enemy instance
export interface Enemy {
  name: string;
  ch: string;
  c: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  exp: number;
  goldDrop: number;
  ai: string;
  stunned: number;
  feared: number;
  isAlly: boolean;
  isBoss?: boolean;
  isElite?: boolean;
  el: Element;
  res: Partial<Record<Element, number>>;
  skillCd: number;
  tags?: string[];
  phasesTriggered?: Set<number>;
}

// --- Traps (runtime) ---

export interface Trap {
  x: number;
  y: number;
  n: I18nText;
  dmg: number;
  c: string;
  ds: I18nText;
  triggered: boolean;
  hidden: boolean;
  ef?: string;
  dur?: number;
  playerTrap?: boolean;
}

// --- Buff ---

export interface Buff {
  name: string;
  type: string;
  value: number;
  turns: number;
}

// --- Equipment Sets ---

export interface EquipmentSetBonus {
  required: number;
  type: string;
  value: number;
  desc: I18nText;
}

export interface EquipmentSetDef {
  id: string;
  n: I18nText;
  pieces: number;
  bonuses: EquipmentSetBonus[];
}

// --- Talent Tree ---

export interface TalentNode {
  id: string;
  n: I18nText;
  desc: I18nText;
  maxRank: number;
  icon: string;
  row: number;
  col: number;
  requires?: string[];
  effect: string;
  valuePerRank: number;
}

export interface TalentTree {
  classIdx: number;
  nodes: TalentNode[];
}

export interface PlayerTalentState {
  talents: Record<string, number>;
  points: number;
}

// --- Area Definitions ---

export interface AreaSpecialTile {
  type: number;       // TL value
  ch: string;
  fg: string;
  bg: string;
  count: [number, number]; // [min, max] per floor
}

export interface AreaDef {
  id: string;
  n: I18nText;
  floorStart: number;
  floorEnd: number;
  wallColor: string;
  floorColor: string;
  corrColor: string;
  bgColor: string;
  wallChar: string;
  floorChar: string;
  specialTiles?: AreaSpecialTile;
  enemyScaleBonus: number;
  lore: I18nText[];
}

// --- Player ---

export interface Equipment {
  weapon: Item | null;
  armor: Item | null;
  accessory: Item | null;
  accessory2: Item | null;
}

export interface Player {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  def: number;
  baseAtk: number;
  baseDef: number;
  baseMaxHp: number;
  level: number;
  exp: number;
  expNext: number;
  gold: number;
  turns: number;
  raceName: string;
  clsName: string;
  ri: number;
  ci: number;
  inv: Item[];
  eq: Equipment;
  buffs: Buff[];
  visible: boolean[][] | null;
  explored: boolean[][];
  kills: number;
  deepestFloor: number;
  critChance: number;
  baseCritChance: number;
  spellPower: number;
  baseSpellPower: number;
  dodgeChance: number;
  baseDodgeChance: number;
  poisonTurns: number;
  poisonDmg: number;
  hunger: number;
  maxHunger: number;
  quickSlots: (Item | null)[];
  warded: boolean;
  freeTurn: boolean;
  skillCd: number;
  streak: number;
  bestStreak: number;
  achievements: Set<string>;
  // New fields
  talents: PlayerTalentState;
  elRes: Partial<Record<Element, number>>;
  setBonusActive: Record<string, number>;
  elDmgBonus: Partial<Record<Element, number>>;
  healBonus: number;
  // Abyss water slow effect
  slowed: number;
  // Talent trigger tracking
  critDamageBonus: number;
  hasRevived: boolean;
  bossCheatDeathUsed: boolean;
  combatReviveUsed: boolean;
  bossesKilledThisRun: number;
  // Relics owned this run (run-scoped; reset on new run)
  relics: string[];
}

// --- Dungeon ---

export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

export interface Dungeon {
  map: number[][];
  rooms: Room[];
  stair: { x: number; y: number };
  traps: Trap[];
}

// --- Game Message ---

export interface GameMessage {
  text: string;
  type: string;
}

// --- Game State ---

export interface GameState {
  player: Player;
  floor: number;
  dungeon: Dungeon;
  enemies: Enemy[];
  items: Item[];
  traps: Trap[];
  msgs: GameMessage[];
  gameOver: boolean;
  won: boolean;
  vx: number;
  vy: number;
  // Portal branch biome ("Fungal Hollow"): when branchMode is true the player
  // is inside a self-contained branch; branchReturn records the main-floor
  // position to restore on exit. See enterBranch/exitBranch in game.ts.
  branchMode?: boolean;
  branchReturn?: { floor: number; x: number; y: number } | null;
}

// --- Achievements ---

export interface AchievementDef {
  id: string;
  icon: string;
  n: I18nText;
  d: I18nText;
}

// --- Relics (run-defining passive artifacts) ---

export interface RelicDef {
  id: string;
  n: I18nText;
  d: I18nText;
  ch: string;       // map/panel glyph
  c: string;        // glyph color
  rarity: number;   // 0-4 (reuses RARITY_C palette)
  effect: string;   // effect key (interpreted in relics.ts)
  value: number;    // effect magnitude
}

// --- Save Data ---

export interface SaveData {
  player: Player;
  floor: number;
  dungeon: Dungeon;
  enemies: Enemy[];
  items: Item[];
  traps: Trap[];
  msgs: GameMessage[];
  qs: number[];
}

// --- Meta Progression ---

export interface MetaSave {
  version: number;
  soulEchoes: number;
  totalSpent: number;
  upgrades: Record<string, number>;
  achievements: string[];
  stats: MetaStats;
}

export interface MetaStats {
  totalRuns: number;
  bestFloor: number;
  totalKills: number;
  totalBossKills: number;
  totalGold: number;
  totalTurns: number;
  wins: number;
  deaths: number;
  bestStreak: number;
  highestLevel: number;
  classesWon: number[];  // class indices that have won
}

export interface MetaUpgradeDef {
  id: string;
  n: I18nText;
  d: I18nText;
  icon: string;
  maxLevel: number;
  costs: number[];
  effect: string;
  valuePerLevel: number;
  category: string;
}

export interface SoulEchoBreakdown {
  kills: number;
  floor: number;
  bosses: number;
  gold: number;
  streak: number;
  victory: number;
  total: number;
}
