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

export interface EnemySkill {
  name: I18nText;
  effect: string;   // effect key → enemy-skills.ts handler
  chance: number;   // 0..1 per eligible turn
  cd: number;       // cooldown turns
  dmg?: number;     // atk 倍率(dmg_*) 或强度(buff/debuff/poison 每回合)
  range?: number;   // cast range (default per-effect)
  aoe?: number;     // AOE radius OR status turns (buff/debuff_*)
  el?: Element;     // skill element (default = enemy el)
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
  id?: string;
  flavor?: I18nText;
  r: number;
  a: number;
  ch: string;
  el?: Element;
  set?: string;
}

export interface ArmorDef {
  n: I18nText;
  id?: string;
  flavor?: I18nText;
  r: number;
  d: number;
  ch: string;
  subType?: string;
  el?: Element;
  set?: string;
}

export interface AccessoryDef {
  n: I18nText;
  id?: string;
  flavor?: I18nText;
  r: number;
  a: number;
  d: number;
  h: number;
  ch: string;
  subType?: string;
  set?: string;
}

export interface PotionDef {
  n: I18nText;
  id?: string;
  flavor?: I18nText;
  ef: string;
  v: number;
  c: string;
  ch: string;
  dur?: number;
}

export interface ScrollDef {
  n: I18nText;
  id?: string;
  flavor?: I18nText;
  ef: string;
  v: number;
  c: string;
  ch: string;
  subType?: string;
  dur?: number;
}

export interface ConsumableDef {
  n: I18nText;
  id?: string;
  flavor?: I18nText;
  ef: string;
  v: number;
  c: string;
  ch: string;
  subType?: string;
  r: number;
  desc: I18nText;
  dur?: number;
}

export interface FoodDef {
  n: I18nText;
  id?: string;
  flavor?: I18nText;
  hungerRestore: number;
  hpHeal?: number;
  c: string;
  ch: string;
  subType?: string;
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
  // catalog subtype (Task 4): armor plate/leather/cloak/robe/scale, accessory
  // ring/amulet/brooch/crown, scroll fire/frost/arcane/holy, consumable
  // bomb/trap/pouch/tool, food meat/bread/feast. Drives pickItemTemplate routing.
  subType?: string;
  // gold
  value?: number;
  // catalog id — matches the def.id the item was generated from; used as the
  // Item Codex / first-pickup key (stable across languages, unlike `name`).
  id?: string;
  // element & set
  el?: Element;
  set?: string;
  // map entity marker — when set, this "item" is not picked up; stepping on it
  // triggers its associated event instead. Used for chests/merchants on the map.
  npc?: 'merchant' | 'chest' | 'treasure_merchant' | 'endless_merchant' | 'fountain' | 'shrine';
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
  skill?: EnemySkill;
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
  isWarden?: boolean;
  // Phase 3: this Warden is a recorded former descender (runtime; floor enemies don't persist).
  legacyWarden?: boolean;
  el: Element;
  res: Partial<Record<Element, number>>;
  skillCd: number;
  // ① reconnect: boss config travels with the instance — endless F45+ reuse
  // another floor's BossDef, so the old floor-keyed table lookups came up
  // empty there. Optional: legacy saves hold instances without them.
  phases?: BossDef['phases'];
  summon?: BossDef['summon'];
  bossAtkBase?: number;
  skill?: EnemySkill;
  aiCd?: number;
  atkBuffTurns?: number;
  atkBuffVal?: number;
  tags?: string[];
  phasesTriggered?: Set<number>;
}

// Shared shape for attack()'s attacker/defender — both Player and Enemy satisfy
// it. Optional fields cover one-side-specific properties: only Enemy has
// name/goldDrop/c/ai, so they're optional here (Player has raceName/clsName + gold).
export interface Combatant {
  x: number; y: number;
  hp: number; maxHp: number; atk: number; def: number;
  exp: number;
  name?: string; goldDrop?: number;
  el?: Element; res?: Partial<Record<Element, number>>;
  ai?: string; c?: string;
  isBoss?: boolean; isElite?: boolean; isAlly?: boolean;
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
  // A single special-tile spec, OR an array of them (Wave 6c: multiple types per
  // area, e.g. Fortress keeps its ALARM from 6b and adds a rare PORTAL).
  specialTiles?: AreaSpecialTile | AreaSpecialTile[];
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
  // Corruption 0..100 (Playtest #9; run-scoped). 100 → warden-death.
  corruption: number;
  // Set-bonus grant: corruption cleansed per floor (void_gear 3-pc). Recalc
  // resets this to 0 then re-applies the active set bonus; enterFloor consumes
  // it once per floor via applyCorruption(-setCorruptionResist).
  setCorruptionResist?: number;
  stunned?: number;
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
  // Endless mode (chosen at new-game). When true the F40 Creator kill does NOT
  // trigger victory — play continues F41+ with scaling + a scaled boss every 5
  // floors; death records deepest floor as the endless score.
  endless?: boolean;
  // Warden (Wave 8): floors remaining until the stalking nemesis next spawns.
  // Decrements in enterFloor; at <=0 spawnWarden fires and this resets.
  wardenCd: number;
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
  flavor?: I18nText; // lore blurb for the intro card / codex (separate from effect `d`)
  // Task 6: relic sprite template key (R_ATTACK/R_DEFENSE/.../R_UTILITY).
  // Drives paintRelicIcon; absent → R_UTILITY fallback.
  spriteKind?: string;
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
  endless?: boolean;
  wardenCd?: number;
}

// --- Meta Progression ---

export interface RunRecord {
  mode: 'normal' | 'endless';
  floor: number;
  kills: number;
  classIdx: number;
  result: 'win' | 'death';
  turns: number;
  gold: number;
  ts: number;
}
export interface EndlessRecord {
  floor: number;
  kills: number;
  classIdx: number;
  turns: number;
  gold: number;
  ts: number;
}

// A descender who died at 100 corruption and became a Warden (Playtest #9 Phase 3).
// Future runs' spawnWarden draws these to name the Warden "formerly <name>".
export interface WardenLegacy { name: string; cls: number; race: number; floor: number; ts: number; }

export interface MetaSave {
  version: number;
  soulEchoes: number;
  totalSpent: number;
  upgrades: Record<string, number>;
  achievements: string[];
  stats: MetaStats;
  runHistory: RunRecord[];
  endlessLeaderboard: EndlessRecord[];
  unlockedLore: string[];
  discoveredItems: string[];
  wardens: WardenLegacy[];
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
  bestEndlessFloor: number;
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
