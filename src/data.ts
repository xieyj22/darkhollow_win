// All game data definitions
import type {
  RaceDef, ClassDef, WeaponDef, ArmorDef, AccessoryDef,
  PotionDef, ScrollDef, ConsumableDef, TrapDef, FoodDef,
  EnemyDef, BossDef, ElitePrefix, AchievementDef, Element,
  EquipmentSetDef, AreaDef, TalentTree,
} from './types.js';

export const RACES: RaceDef[] = [
  { name: { en: 'Human', zh: '人类' }, hpM: 0, atkM: 0, defM: 0, mpM: 0, desc: { en: 'Balanced', zh: '均衡' } },
  { name: { en: 'Dwarf', zh: '矮人' }, hpM: 10, atkM: 0, defM: 2, mpM: -5, desc: { en: '+HP +DEF -MP', zh: '+HP +DEF -MP' } },
  { name: { en: 'Elf', zh: '精灵' }, hpM: -5, atkM: 1, defM: -1, mpM: 10, desc: { en: '+ATK +MP -HP', zh: '+ATK +MP -HP' } },
  { name: { en: 'Orc', zh: '兽人' }, hpM: 5, atkM: 2, defM: 0, mpM: -5, desc: { en: '+HP +ATK -MP', zh: '+HP +ATK -MP' } },
];

export const CLASSES: ClassDef[] = [
  { name: { en: 'Warrior', zh: '战士' }, hp: 50, mp: 10, atk: 6, def: 3, desc: { en: 'High HP and DEF', zh: '高HP高DEF' },
    skill: { name: { en: 'Shield Bash', zh: '盾击' }, desc: { en: 'Deal 150% ATK dmg + stun 2 turns (5 MP, CD:8)', zh: '造成150%ATK伤害并眩晕2回合(5MP,CD:8)' }, cost: 5, cd: 8, effect: 'stun' } },
  { name: { en: 'Rogue', zh: '盗贼' }, hp: 35, mp: 15, atk: 8, def: 1, desc: { en: 'High ATK, crit', zh: '高攻击暴击' },
    skill: { name: { en: 'Shadow Strike', zh: '暗影突袭' }, desc: { en: 'Deal 250% ATK dmg (4 MP, CD:6)', zh: '造成250%ATK伤害(4MP,CD:6)' }, cost: 4, cd: 6, effect: 'burst' } },
  { name: { en: 'Mage', zh: '法师' }, hp: 30, mp: 40, atk: 3, def: 1, desc: { en: 'High MP, spells', zh: '高魔力法术' },
    skill: { name: { en: 'Arcane Blast', zh: '奥术爆破' }, desc: { en: 'Deal magic dmg to all nearby enemies (8 MP, CD:10)', zh: '对所有附近敌人造成魔法伤害(8MP,CD:10)' }, cost: 8, cd: 10, effect: 'aoe' } },
  { name: { en: 'Paladin', zh: '圣骑士' }, hp: 45, mp: 20, atk: 5, def: 4, desc: { en: 'Balanced tank', zh: '均衡坦克' },
    skill: { name: { en: 'Holy Light', zh: '圣光术' }, desc: { en: 'Heal 40% maxHP + cleanse (6 MP, CD:9)', zh: '恢复40%最大HP并净化(6MP,CD:9)' }, cost: 6, cd: 9, effect: 'heal' } },
];

export const WEAPONS: WeaponDef[] = [
  { n: { en: 'Rusty Sword', zh: '锈剑' }, r: 0, a: 2, ch: '/' }, { n: { en: 'Iron Dagger', zh: '铁匕首' }, r: 0, a: 3, ch: '‡' },
  { n: { en: 'Short Sword', zh: '短剑' }, r: 0, a: 4, ch: '/' }, { n: { en: 'Longsword', zh: '长剑' }, r: 1, a: 6, ch: '†' },
  { n: { en: 'Battle Axe', zh: '战斧' }, r: 1, a: 7, ch: 'Ψ' }, { n: { en: 'War Hammer', zh: '战锤' }, r: 1, a: 8, ch: '⊥' },
  { n: { en: 'Flamebrand', zh: '炎刃' }, r: 2, a: 10, ch: '†' }, { n: { en: 'Frost Edge', zh: '霜刃' }, r: 2, a: 11, ch: '†' },
  { n: { en: 'Thunder Mace', zh: '雷霆锤' }, r: 2, a: 12, ch: '⊥' }, { n: { en: 'Shadow Blade', zh: '暗影之刃' }, r: 3, a: 15, ch: '†' },
  { n: { en: "Dragon's Fang", zh: '龙牙剑' }, r: 3, a: 17, ch: '†' }, { n: { en: 'Vorpal Sword', zh: '斩首剑' }, r: 4, a: 22, ch: '†' },
  { n: { en: 'Godslayer', zh: '弑神剑' }, r: 4, a: 25, ch: '†' },
];

export const ARMORS: ArmorDef[] = [
  { n: { en: 'Leather Vest', zh: '皮甲' }, r: 0, d: 1, ch: '▦' }, { n: { en: 'Chain Mail', zh: '锁子甲' }, r: 0, d: 2, ch: '#' },
  { n: { en: 'Iron Plate', zh: '铁甲' }, r: 1, d: 4, ch: '▣' }, { n: { en: 'Steel Armor', zh: '钢甲' }, r: 1, d: 5, ch: '▣' },
  { n: { en: 'Mithril Mail', zh: '秘银甲' }, r: 2, d: 7, ch: '#' }, { n: { en: 'Dragon Scale', zh: '龙鳞甲' }, r: 2, d: 8, ch: '◆' },
  { n: { en: 'Shadow Cloak', zh: '暗影斗篷' }, r: 3, d: 10, ch: '≈' }, { n: { en: 'Celestial Plate', zh: '天界甲' }, r: 4, d: 14, ch: '▣' },
];

export const ACCESSORIES: AccessoryDef[] = [
  { n: { en: 'Copper Ring', zh: '铜戒指' }, r: 0, a: 1, d: 0, h: 0, ch: '○' }, { n: { en: 'Iron Amulet', zh: '铁护符' }, r: 0, a: 0, d: 1, h: 5, ch: '✝' },
  { n: { en: 'Ruby Ring', zh: '红宝石戒指' }, r: 1, a: 2, d: 0, h: 0, ch: '○' }, { n: { en: 'Sapphire Pendant', zh: '蓝宝石吊坠' }, r: 1, a: 0, d: 2, h: 10, ch: '◇' },
  { n: { en: 'Emerald Brooch', zh: '翡翠胸针' }, r: 2, a: 2, d: 2, h: 15, ch: '✿' }, { n: { en: 'Crown of Flames', zh: '火焰王冠' }, r: 3, a: 4, d: 2, h: 20, ch: '♛' },
  { n: { en: 'Ring of the Void', zh: '虚空之戒' }, r: 4, a: 5, d: 5, h: 30, ch: '○' },
];

export const POTIONS: PotionDef[] = [
  { n: { en: 'Health Potion', zh: '生命药水' }, ef: 'heal', v: 20, c: '#e63946', ch: '♥' },
  { n: { en: 'Greater Health Potion', zh: '高级生命药水' }, ef: 'heal', v: 50, c: '#ff6b6b', ch: '♥' },
  { n: { en: 'Mana Potion', zh: '魔力药水' }, ef: 'mana', v: 15, c: '#4895ef', ch: '✦' },
  { n: { en: 'Greater Mana Potion', zh: '高级魔力药水' }, ef: 'mana', v: 35, c: '#7ec8e3', ch: '✦' },
  { n: { en: 'Strength Elixir', zh: '力量药剂' }, ef: 'str_buff', v: 3, c: '#f4845f', ch: '↑', dur: 30 },
  { n: { en: 'Iron Skin Potion', zh: '铁皮药剂' }, ef: 'def_buff', v: 3, c: '#7ec8e3', ch: '■', dur: 30 },
  { n: { en: 'Potion of Restoration', zh: '恢复药水' }, ef: 'restore', v: 0, c: '#ffd700', ch: '✚' },
  { n: { en: 'Poison', zh: '毒药' }, ef: 'poison', v: 10, c: '#32cd32', ch: '☠' },
];

export const SCROLLS: ScrollDef[] = [
  { n: { en: 'Scroll of Fireball', zh: '火球术卷轴' }, ef: 'fireball', v: 25, c: '#f4845f', ch: '☀' },
  { n: { en: 'Scroll of Lightning', zh: '闪电术卷轴' }, ef: 'lightning', v: 30, c: '#ffd700', ch: '⚡' },
  { n: { en: 'Scroll of Teleport', zh: '传送卷轴' }, ef: 'teleport', v: 0, c: '#9b5de5', ch: '↻' },
  { n: { en: 'Scroll of Mapping', zh: '地图卷轴' }, ef: 'mapping', v: 0, c: '#4895ef', ch: '▦' },
  { n: { en: 'Scroll of Shield', zh: '护盾卷轴' }, ef: 'shield', v: 5, c: '#7ec8e3', ch: '◈', dur: 30 },
  { n: { en: 'Scroll of Fear', zh: '恐惧卷轴' }, ef: 'fear', v: 0, c: '#aaa', ch: '☾' },
];

export const CONSUMABLES: ConsumableDef[] = [
  { n: { en: 'Bomb', zh: '炸弹' }, ef: 'bomb', v: 30, c: '#ff4500', ch: '*', r: 1, desc: { en: 'AoE fire dmg to nearby foes', zh: '对附近敌人造成范围火焰伤害' } },
  { n: { en: 'Throwing Knife', zh: '飞刀' }, ef: 'throw_knife', v: 20, c: '#c0c0c0', ch: '†', r: 0, desc: { en: 'Throw at nearest enemy', zh: '投向最近的敌人' } },
  { n: { en: 'Torch', zh: '火把' }, ef: 'torch', v: 5, c: '#f4845f', ch: '☀', r: 0, desc: { en: '+5 FOV for 30 turns', zh: '视野+5持续30回合' }, dur: 30 },
  { n: { en: 'Bear Trap', zh: '捕兽夹' }, ef: 'bear_trap', v: 20, c: '#a0522d', ch: '▲', r: 0, desc: { en: 'Place trap on ground', zh: '在地面放置陷阱' } },
  { n: { en: 'Smoke Bomb', zh: '烟雾弹' }, ef: 'smoke_bomb', v: 0, c: '#888', ch: '○', r: 1, desc: { en: 'Fear nearby enemies', zh: '恐惧附近的敌人' } },
  { n: { en: 'Ward Stone', zh: '护身石' }, ef: 'ward', v: 0, c: '#4895ef', ch: '◆', r: 1, desc: { en: 'Block next hit completely', zh: '完全抵挡下一次攻击' } },
  { n: { en: 'Haste Potion', zh: '加速药水' }, ef: 'haste', v: 0, c: '#06d6a0', ch: '»', r: 1, desc: { en: 'Take a free extra turn', zh: '获得一次免费额外行动' } },
  { n: { en: 'Antidote', zh: '解毒剂' }, ef: 'antidote', v: 0, c: '#80ed99', ch: '✦', r: 0, desc: { en: 'Cure poison + resist', zh: '治愈中毒并获得抗性' } },
];

export const TRAPS: TrapDef[] = [
  { n: { en: 'Spike Trap', zh: '尖刺陷阱' }, dmg: 8, c: '#a0522d', ds: { en: 'Spikes shoot from the floor!', zh: '地面射出尖刺！' } },
  { n: { en: 'Fire Trap', zh: '火焰陷阱' }, dmg: 12, c: '#ff4500', ds: { en: 'Flames erupt!', zh: '火焰喷涌而出！' } },
  { n: { en: 'Poison Trap', zh: '毒气陷阱' }, dmg: 5, c: '#32cd32', ds: { en: 'Noxious gas!', zh: '毒气弥漫！' }, ef: 'poison_dot', dur: 5 },
  { n: { en: 'Teleport Trap', zh: '传送陷阱' }, dmg: 0, c: '#9b5de5', ds: { en: 'The world shifts!', zh: '空间扭曲！' }, ef: 'teleport' },
];

export const ELITE_PREFIX: ElitePrefix[] = [
  { n: { en: 'Elite ', zh: '精英' }, hpM: 1.5, atkM: 1.3, expM: 2, goldM: 2 },
  { n: { en: 'Enraged ', zh: '狂暴' }, hpM: 1.2, atkM: 1.6, expM: 1.8, goldM: 1.5 },
  { n: { en: 'Armored ', zh: '重甲' }, hpM: 1.8, atkM: 1.0, defM: 2, expM: 1.5, goldM: 1.5 },
  { n: { en: 'Swift ', zh: '迅捷' }, hpM: 0.8, atkM: 1.4, expM: 1.3, goldM: 1.2 },
];

export const ENEMIES: EnemyDef[] = [
  // === Original enemies ===
  { n: { en: 'Rat', zh: '老鼠' }, ch: 'r', c: '#a0522d', hp: 8, atk: 2, def: 0, exp: 5, g: [1, 3], ai: 'wander', mf: 1 },
  { n: { en: 'Bat', zh: '蝙蝠' }, ch: 'b', c: '#696969', hp: 6, atk: 3, def: 0, exp: 5, g: [1, 2], ai: 'erratic', mf: 1 },
  { n: { en: 'Goblin', zh: '哥布林' }, ch: 'g', c: '#228b22', hp: 12, atk: 4, def: 1, exp: 8, g: [2, 6], ai: 'chase', mf: 1 },
  { n: { en: 'Slime', zh: '史莱姆' }, ch: 's', c: '#32cd32', hp: 15, atk: 2, def: 3, exp: 6, g: [1, 4], ai: 'wander', mf: 1 },
  // === New: early-mid fill (mf 2-14) ===
  { n: { en: 'Mushroom', zh: '毒蘑菇' }, ch: 'm', c: '#8b4513', hp: 8, atk: 3, def: 2, exp: 6, g: [1, 3], ai: 'wander', mf: 2 },
  { n: { en: 'Cave Fish', zh: '洞穴鱼' }, ch: 'f', c: '#4682b4', hp: 10, atk: 4, def: 1, exp: 7, g: [2, 5], ai: 'erratic', mf: 3 },
  { n: { en: 'Kobold', zh: '狗头人' }, ch: 'k', c: '#cd853f', hp: 16, atk: 5, def: 2, exp: 10, g: [3, 8], ai: 'erratic', mf: 3 },
  // === Original enemies continued ===
  { n: { en: 'Skeleton', zh: '骷髅' }, ch: '☠', c: '#dcdcdc', hp: 18, atk: 6, def: 2, exp: 12, g: [3, 8], ai: 'chase', mf: 2, tags: ['undead'] },
  { n: { en: 'Spider', zh: '蜘蛛' }, ch: 'ψ', c: '#4b0082', hp: 14, atk: 8, def: 1, exp: 10, g: [2, 5], ai: 'ambush', mf: 2 },
  { n: { en: 'Orc', zh: '兽人' }, ch: 'o', c: '#8b0000', hp: 25, atk: 7, def: 3, exp: 15, g: [5, 12], ai: 'chase', mf: 3 },
  // === New: mid fill ===
  { n: { en: 'Wolf', zh: '灰狼' }, ch: 'ω', c: '#7a8890', hp: 18, atk: 7, def: 2, exp: 12, g: [3, 8], ai: 'chase', mf: 4 },
  { n: { en: 'Cultist', zh: '邪教徒' }, ch: '☼', c: '#5c2d91', hp: 20, atk: 9, def: 2, exp: 18, g: [6, 15], ai: 'ranged', mf: 5, el: 'shadow' },
  // === Original continued ===
  { n: { en: 'Wraith', zh: '幽灵' }, ch: 'Ω', c: '#9370db', hp: 20, atk: 10, def: 3, exp: 20, g: [5, 15], ai: 'phase', mf: 4, tags: ['undead'] },
  { n: { en: 'Ogre', zh: '食人魔' }, ch: 'Θ', c: '#daa520', hp: 40, atk: 12, def: 4, exp: 25, g: [8, 20], ai: 'chase', mf: 5 },
  { n: { en: 'Dark Mage', zh: '暗黑法师' }, ch: '☾', c: '#800080', hp: 22, atk: 14, def: 2, exp: 22, g: [10, 25], ai: 'ranged', mf: 4 },
  // === New: mid-upper ===
  { n: { en: 'Harpy', zh: '鹰身女妖' }, ch: '♀', c: '#c4a040', hp: 22, atk: 10, def: 3, exp: 20, g: [5, 14], ai: 'erratic', mf: 6 },
  { n: { en: 'Mimic', zh: '宝箱怪' }, ch: '=', c: '#ffd700', hp: 30, atk: 12, def: 4, exp: 28, g: [10, 25], ai: 'ambush', mf: 7 },
  { n: { en: 'Wyvern', zh: '双足飞龙' }, ch: 'Δ', c: '#2e8b57', hp: 45, atk: 14, def: 5, exp: 35, g: [12, 28], ai: 'ranged', mf: 8, el: 'fire' },
  { n: { en: 'Dark Knight', zh: '暗黑骑士' }, ch: '♞', c: '#3a6060', hp: 55, atk: 16, def: 8, exp: 42, g: [15, 35], ai: 'chase', mf: 9, el: 'shadow' },
  // === Original continued ===
  { n: { en: 'Troll', zh: '巨魔' }, ch: 'Π', c: '#556b2f', hp: 50, atk: 14, def: 6, exp: 35, g: [12, 30], ai: 'chase', mf: 7 },
  { n: { en: 'Vampire', zh: '吸血鬼' }, ch: '♠', c: '#b91c3c', hp: 35, atk: 16, def: 5, exp: 40, g: [15, 35], ai: 'lifesteal', mf: 7, tags: ['undead'] },
  { n: { en: 'Golem', zh: '魔像' }, ch: '◘', c: '#808080', hp: 60, atk: 12, def: 10, exp: 38, g: [10, 25], ai: 'chase', mf: 8 },
  { n: { en: 'Lich', zh: '巫妖' }, ch: 'Ψ', c: '#9400d3', hp: 45, atk: 20, def: 8, exp: 55, g: [20, 50], ai: 'ranged', mf: 10, tags: ['undead'] },
  { n: { en: 'Demon', zh: '恶魔' }, ch: 'φ', c: '#ff4500', hp: 55, atk: 22, def: 7, exp: 60, g: [25, 60], ai: 'chase', mf: 10, tags: ['demon'] },
  { n: { en: 'Necromancer', zh: '死灵法师' }, ch: '☽', c: '#6a0dad', hp: 35, atk: 18, def: 4, exp: 45, g: [15, 40], ai: 'summon', mf: 10, el: 'shadow' },
  { n: { en: 'Dragon Whelp', zh: '幼龙' }, ch: 'δ', c: '#ff6347', hp: 65, atk: 18, def: 10, exp: 50, g: [30, 70], ai: 'ranged', mf: 11 },
  { n: { en: 'Ancient Dragon', zh: '远古巨龙' }, ch: 'Λ', c: '#ff0000', hp: 80, atk: 25, def: 12, exp: 80, g: [40, 100], ai: 'ranged', mf: 14 },
  { n: { en: 'Death Knight', zh: '死亡骑士' }, ch: 'Ξ', c: '#191970', hp: 70, atk: 28, def: 14, exp: 75, g: [35, 80], ai: 'chase', mf: 14, tags: ['undead'] },
  // === New: Dark Fortress (mf 16-19) — 填 F12-25 断层 ===
  { n: { en: 'Castellan', zh: '铁卫统领' }, ch: '♝', c: '#4a5a6a', hp: 95, atk: 26, def: 16, exp: 70, g: [25, 55], ai: 'chase', mf: 16 },
  { n: { en: 'Gargoyle', zh: '石化魔像' }, ch: 'Γ', c: '#708090', hp: 85, atk: 30, def: 12, exp: 75, g: [20, 50], ai: 'ambush', mf: 17 },
  { n: { en: 'Inquisitor', zh: '圣裁官' }, ch: '✠', c: '#d4af37', hp: 75, atk: 32, def: 8, exp: 80, g: [30, 60], ai: 'ranged', mf: 18, el: 'holy' },
  { n: { en: 'Siege Golem', zh: '破城巨像' }, ch: '◍', c: '#696969', hp: 125, atk: 34, def: 15, exp: 85, g: [35, 70], ai: 'chase', mf: 19 },
  // === New: Dragon's Domain (mf 21-25) ===
  { n: { en: 'Pyro Drake', zh: '烈焰飞龙' }, ch: '¤', c: '#ff6347', hp: 115, atk: 34, def: 12, exp: 95, g: [40, 80], ai: 'ranged', mf: 21, el: 'fire' },
  { n: { en: 'Drake Zealot', zh: '龙血信徒' }, ch: '☧', c: '#8b0000', hp: 95, atk: 30, def: 10, exp: 90, g: [30, 65], ai: 'summon', mf: 22 },
  { n: { en: 'Magma Behemoth', zh: '熔岩巨兽' }, ch: '●', c: '#ff4500', hp: 135, atk: 32, def: 16, exp: 100, g: [40, 85], ai: 'chase', mf: 23, el: 'fire' },
  { n: { en: 'Drakeborn Knight', zh: '龙裔骑士' }, ch: '†', c: '#b22222', hp: 115, atk: 38, def: 14, exp: 110, g: [45, 90], ai: 'chase', mf: 24 },
  { n: { en: 'Storm Wraith', zh: '雷霆怨灵' }, ch: '⚡', c: '#4682b4', hp: 100, atk: 36, def: 10, exp: 100, g: [40, 80], ai: 'ranged', mf: 25, el: 'lightning' },
  // === New: The Abyss (mf 26-30) ===
  { n: { en: 'Abyssal Jellyfish', zh: '深海水母' }, ch: '∞', c: '#00ced1', hp: 70, atk: 20, def: 6, exp: 55, g: [20, 50], ai: 'wander', mf: 26, el: 'ice' },
  { n: { en: 'Deep One', zh: '深潜者' }, ch: 'Σ', c: '#006400', hp: 85, atk: 24, def: 10, exp: 70, g: [25, 60], ai: 'chase', mf: 26 },
  { n: { en: 'Void Leech', zh: '虚空水蛭' }, ch: 'λ', c: '#483d8b', hp: 60, atk: 22, def: 5, exp: 50, g: [15, 45], ai: 'lifesteal', mf: 27, el: 'shadow' },
  { n: { en: 'Coral Golem', zh: '珊瑚魔像' }, ch: 'Φ', c: '#ff7f50', hp: 110, atk: 18, def: 18, exp: 75, g: [30, 65], ai: 'chase', mf: 28 },
  { n: { en: 'Siren', zh: '塞壬' }, ch: '♪', c: '#ff69b4', hp: 65, atk: 28, def: 6, exp: 65, g: [25, 55], ai: 'ranged', mf: 29, el: 'ice' },
  { n: { en: 'Kraken Spawn', zh: '克拉肯幼体' }, ch: 'κ', c: '#1a237e', hp: 120, atk: 30, def: 12, exp: 90, g: [40, 80], ai: 'chase', mf: 30, el: 'ice' },
  // === New: Void Realm (mf 31-35) ===
  { n: { en: 'Void Wraith', zh: '虚空幽灵' }, ch: 'ξ', c: '#8a2be2', hp: 100, atk: 32, def: 8, exp: 80, g: [30, 70], ai: 'phase', mf: 31, el: 'shadow' },
  { n: { en: 'Chaos Elemental', zh: '混沌元素' }, ch: 'χ', c: '#ff1493', hp: 90, atk: 35, def: 6, exp: 85, g: [35, 75], ai: 'erratic', mf: 32 },
  { n: { en: 'Rift Stalker', zh: '裂隙猎手' }, ch: 'τ', c: '#800080', hp: 110, atk: 30, def: 14, exp: 90, g: [40, 80], ai: 'teleport', mf: 33, el: 'shadow' },
  { n: { en: 'Void Mage', zh: '虚空法师' }, ch: 'υ', c: '#7b2fbe', hp: 80, atk: 40, def: 8, exp: 100, g: [45, 90], ai: 'ranged', mf: 34, el: 'shadow' },
  { n: { en: 'Reality Shard', zh: '现实碎片' }, ch: '◊', c: '#e0e0ff', hp: 130, atk: 28, def: 20, exp: 95, g: [35, 75], ai: 'wander', mf: 35 },
  // === New: The Final Sanctum (mf 36-40) ===
  { n: { en: 'Seraphim', zh: '炽天使' }, ch: '☀', c: '#ffd700', hp: 140, atk: 38, def: 16, exp: 110, g: [50, 100], ai: 'chase', mf: 36, el: 'holy' },
  { n: { en: 'Fallen Seraph', zh: '堕落炽天使' }, ch: '✝', c: '#8b0000', hp: 150, atk: 42, def: 14, exp: 120, g: [55, 110], ai: 'chase', mf: 37, el: 'shadow', tags: ['undead', 'demon'] },
  { n: { en: 'Divine Golem', zh: '神圣魔像' }, ch: '⊕', c: '#c0c0c0', hp: 200, atk: 30, def: 25, exp: 130, g: [40, 90], ai: 'chase', mf: 38, el: 'holy' },
  { n: { en: 'Cosmic Horror', zh: '宇宙恐怖' }, ch: '∇', c: '#1a0033', hp: 160, atk: 48, def: 12, exp: 150, g: [60, 120], ai: 'erratic', mf: 39, el: 'shadow', tags: ['demon'] },
  { n: { en: 'Archon', zh: '执政官' }, ch: '♔', c: '#ffffff', hp: 180, atk: 45, def: 18, exp: 160, g: [70, 140], ai: 'ranged', mf: 40, el: 'holy' },
];

export const BOSSES: BossDef[] = [
  { n: { en: 'Goblin King', zh: '哥布林王' }, ch: '♚', c: '#ffd700', hp: 60, atk: 10, def: 4, exp: 100, g: [50, 80], fl: 5,
    summon: { chance: 0.4, cd: 3, maxAdds: 2 },
    phases: [{ hpThreshold: 0.4, atkM: 1.4, newAi: 'chase' }] },
  { n: { en: 'Spider Queen', zh: '蜘蛛女王' }, ch: '♛', c: '#8a2be2', hp: 90, atk: 14, def: 6, exp: 180, g: [70, 120], fl: 10,
    summon: { chance: 0.4, cd: 3, maxAdds: 2 },
    phases: [{ hpThreshold: 0.5, atkM: 1.3, newAi: 'ambush' }] },
  { n: { en: 'Vampire Lord', zh: '吸血鬼领主' }, ch: '▼', c: '#dc143c', hp: 120, atk: 18, def: 8, exp: 280, g: [100, 180], fl: 15, el: 'shadow',
    summon: { chance: 0.5, cd: 3, maxAdds: 4 },
    phases: [{ hpThreshold: 0.5, atkM: 1.3, newAi: 'lifesteal' }] },
  { n: { en: 'Elder Lich', zh: '远古巫妖' }, ch: '☯', c: '#9932cc', hp: 150, atk: 22, def: 10, exp: 400, g: [150, 250], fl: 20,
    summon: { chance: 0.4, cd: 3, maxAdds: 3 },
    phases: [{ hpThreshold: 0.5, atkM: 1.4, newAi: 'ranged' }] },
  { n: { en: 'Dragon Emperor', zh: '龙皇' }, ch: '♜', c: '#ff8c00', hp: 200, atk: 28, def: 14, exp: 600, g: [250, 500], fl: 25, el: 'fire',
    summon: { chance: 0.35, cd: 4, maxAdds: 2 },
    phases: [{ hpThreshold: 0.3, atkM: 1.6, newAi: 'chase', newEl: 'fire' }] },
  // === New bosses ===
  { n: { en: 'Leviathan', zh: '利维坦' }, ch: '≈', c: '#00ced1', hp: 280, atk: 35, def: 14, exp: 800, g: [200, 400], fl: 30, el: 'ice',
    phases: [
      { hpThreshold: 0.5, atkM: 1.5, newAi: 'chase' },
    ] },
  { n: { en: 'Void Sovereign', zh: '虚空君主' }, ch: '◈', c: '#9400d3', hp: 400, atk: 45, def: 18, exp: 1200, g: [300, 600], fl: 35, el: 'shadow',
    phases: [
      { hpThreshold: 0.3, atkM: 2, newAi: 'chase', newEl: 'shadow' },
    ],
    summon: { chance: 0.45, cd: 3, maxAdds: 3 } },
  { n: { en: 'The Creator', zh: '创世者' }, ch: 'Ω', c: '#ffffff', hp: 600, atk: 55, def: 22, exp: 2000, g: [500, 1000], fl: 40, el: 'holy',
    phases: [
      { hpThreshold: 0.6, atkM: 1.4 },
      { hpThreshold: 0.25, atkM: 2, newAi: 'chase' },
    ],
    summon: { chance: 0.5, cd: 3, maxAdds: 4 } },
];

export const ACH_DEFS: AchievementDef[] = [
  { id: 'first_kill', icon: '⚔', n: { en: 'First Blood', zh: '初见血' }, d: { en: 'Kill your first enemy', zh: '击杀第一个敌人' } },
  { id: 'kill_10', icon: '💀', n: { en: 'Monster Slayer', zh: '怪物猎人' }, d: { en: 'Kill 10 enemies', zh: '击杀10个敌人' } },
  { id: 'kill_50', icon: '☠️', n: { en: 'Massacre', zh: '屠杀者' }, d: { en: 'Kill 50 enemies', zh: '击杀50个敌人' } },
  { id: 'kill_100', icon: '⚔', n: { en: 'Century Slayer', zh: '百人斩' }, d: { en: 'Kill 100 enemies', zh: '击杀100个敌人' } },
  { id: 'kill_200', icon: '⚔', n: { en: 'Army Breaker', zh: '破军' }, d: { en: 'Kill 200 enemies', zh: '击杀200个敌人' } },
  { id: 'boss_kill', icon: '👑', n: { en: 'Boss Slayer', zh: 'Boss杀手' }, d: { en: 'Defeat a boss', zh: '击败一个Boss' } },
  { id: 'floor5', icon: '🗡️', n: { en: 'Deep Explorer', zh: '深层探索者' }, d: { en: 'Reach floor 5', zh: '到达第5层' } },
  { id: 'floor15', icon: '🕳️', n: { en: 'Abyss Walker', zh: '深渊行者' }, d: { en: 'Reach floor 15', zh: '到达第15层' } },
  { id: 'floor25', icon: '🐉', n: { en: 'Dragon Slayer', zh: '屠龙者' }, d: { en: 'Reach floor 25', zh: '到达第25层' } },
  { id: 'floor30', icon: '🌀', n: { en: 'Abyssal Diver', zh: '深渊潜水者' }, d: { en: 'Reach floor 30', zh: '到达第30层' } },
  { id: 'floor35', icon: '🌀', n: { en: 'Void Walker', zh: '虚空行者' }, d: { en: 'Reach floor 35', zh: '到达第35层' } },
  { id: 'floor40', icon: '👑', n: { en: 'Sanctum Conqueror', zh: '圣殿征服者' }, d: { en: 'Reach floor 40', zh: '到达第40层' } },
  { id: 'legendary', icon: '🌟', n: { en: 'Legendary Find', zh: '传说发现' }, d: { en: 'Find a legendary item', zh: '找到一件传说装备' } },
  { id: 'streak5', icon: '🔥', n: { en: 'On Fire!', zh: '火力全开！' }, d: { en: '5 kill streak', zh: '5连杀' } },
  { id: 'gold500', icon: '💰', n: { en: 'Rich', zh: '富翁' }, d: { en: 'Accumulate 500 gold', zh: '累积500金币' } },
  { id: 'gold1000', icon: '💎', n: { en: 'Tycoon', zh: '大富翁' }, d: { en: 'Accumulate 1000 gold', zh: '累积1000金币' } },
  { id: 'gold5000', icon: '👑', n: { en: "Dragon's Hoard", zh: '龙之宝库' }, d: { en: 'Accumulate 5000 gold', zh: '累积5000金币' } },
  { id: 'lvl10', icon: '⭐', n: { en: 'Veteran', zh: '老兵' }, d: { en: 'Reach level 10', zh: '到达10级' } },
  { id: 'lvl20', icon: '⭐⭐', n: { en: 'Elite', zh: '精英' }, d: { en: 'Reach level 20', zh: '到达20级' } },
  { id: 'lvl30', icon: '⭐⭐⭐', n: { en: 'Legend', zh: '传奇' }, d: { en: 'Reach level 30', zh: '到达30级' } },
  { id: 'win', icon: '🏆', n: { en: 'Champion', zh: '冠军' }, d: { en: 'Beat the game', zh: '通关游戏' } },
  { id: 'creator_kill', icon: '🏆', n: { en: 'Godslayer', zh: '弑神者' }, d: { en: 'Defeat The Creator', zh: '击败创世者' } },
];

// ===== New Weapons =====
export const NEW_WEAPONS: WeaponDef[] = [
  { n: { en: 'Bronze Spear', zh: '青铜矛' }, r: 0, a: 3, ch: '│' },
  { n: { en: 'Claymore', zh: '大剑' }, r: 1, a: 8, ch: '†' },
  { n: { en: 'Crystal Wand', zh: '水晶法杖' }, r: 1, a: 5, ch: '※' },
  { n: { en: 'Inferno Blade', zh: '烈焰之刃' }, r: 2, a: 10, ch: '†', el: 'fire', set: 'fire_lord' },
  { n: { en: 'Glacial Staff', zh: '冰霜法杖' }, r: 2, a: 9, ch: '※', el: 'ice', set: 'frost_mage' },
  { n: { en: 'Storm Cleaver', zh: '风暴斧' }, r: 2, a: 11, ch: 'Ψ', el: 'lightning' },
  { n: { en: 'Shadow Dagger', zh: '暗影匕首' }, r: 3, a: 13, ch: '‡', el: 'shadow', set: 'shadow_set' },
  { n: { en: 'Holy Avenger', zh: '圣光复仇者' }, r: 3, a: 16, ch: '†', el: 'holy', set: 'divine' },
  { n: { en: 'Abyssal Trident', zh: '深渊三叉戟' }, r: 3, a: 14, ch: 'ψ', el: 'ice', set: 'abyssal' },
  { n: { en: 'Void Reaper', zh: '虚空镰刀' }, r: 4, a: 20, ch: 'Ͽ', el: 'shadow', set: 'shadow_set' },
  { n: { en: 'Celestial Blade', zh: '天界之刃' }, r: 4, a: 24, ch: '†', el: 'holy', set: 'divine' },
  { n: { en: 'Thunder God Hammer', zh: '雷神之锤' }, r: 4, a: 22, ch: '⊥', el: 'lightning' },
  { n: { en: 'Cosmic Devourer', zh: '宇宙吞噬者' }, r: 4, a: 28, ch: 'Ω' },
];

// Merge all weapons
export const ALL_WEAPONS: WeaponDef[] = [...WEAPONS, ...NEW_WEAPONS];

// ===== New Armors =====
export const NEW_ARMORS: ArmorDef[] = [
  { n: { en: 'Brigandine', zh: '镶甲' }, r: 1, d: 3, ch: '▦' },
  { n: { en: 'Inferno Plate', zh: '烈焰板甲' }, r: 2, d: 7, ch: '▣', el: 'fire', set: 'fire_lord' },
  { n: { en: 'Frostweave Robe', zh: '霜织法袍' }, r: 2, d: 6, ch: '≈', el: 'ice', set: 'frost_mage' },
  { n: { en: 'Shadow Mantle', zh: '暗影披风' }, r: 3, d: 9, ch: '≈', el: 'shadow', set: 'shadow_set' },
  { n: { en: 'Sanctified Plate', zh: '圣化板甲' }, r: 3, d: 12, ch: '▣', el: 'holy', set: 'divine' },
  { n: { en: 'Abyssal Carapace', zh: '深渊甲壳' }, r: 3, d: 11, ch: '◆', el: 'ice', set: 'abyssal' },
  { n: { en: 'Void Shroud', zh: '虚空罩袍' }, r: 4, d: 13, ch: '≈', el: 'shadow' },
  { n: { en: 'Godslayer Armor', zh: '弑神铠甲' }, r: 4, d: 16, ch: '▣' },
];

export const ALL_ARMORS: ArmorDef[] = [...ARMORS, ...NEW_ARMORS];

// ===== New Accessories =====
export const NEW_ACCESSORIES: AccessoryDef[] = [
  { n: { en: 'Jade Pendant', zh: '翡翠吊坠' }, r: 1, a: 1, d: 1, h: 8, ch: '◇' },
  { n: { en: 'Inferno Band', zh: '烈焰戒指' }, r: 2, a: 3, d: 1, h: 5, ch: '○', set: 'fire_lord' },
  { n: { en: 'Frost Amulet', zh: '冰霜护符' }, r: 2, a: 1, d: 3, h: 15, ch: '✝', set: 'frost_mage' },
  { n: { en: 'Shadow Signet', zh: '暗影印戒' }, r: 3, a: 3, d: 3, h: 15, ch: '○', set: 'shadow_set' },
  { n: { en: 'Divine Halo', zh: '神圣光环' }, r: 3, a: 3, d: 3, h: 20, ch: '◎', set: 'divine' },
  { n: { en: 'Abyssal Pearl', zh: '深渊珍珠' }, r: 3, a: 2, d: 4, h: 25, ch: '●', set: 'abyssal' },
  { n: { en: 'Astral Crown', zh: '星界王冠' }, r: 4, a: 6, d: 6, h: 40, ch: '♛' },
];

export const ALL_ACCESSORIES: AccessoryDef[] = [...ACCESSORIES, ...NEW_ACCESSORIES];

// ===== New Potions =====
export const NEW_POTIONS: PotionDef[] = [
  { n: { en: 'Supreme Health Potion', zh: '终极生命药水' }, ef: 'heal', v: 100, c: '#ff6b6b', ch: '♥' },
  { n: { en: 'Supreme Mana Potion', zh: '终极魔力药水' }, ef: 'mana', v: 60, c: '#4895ef', ch: '✦' },
  { n: { en: 'Fire Resistance Potion', zh: '火焰抗性药水' }, ef: 'el_res_fire', v: 50, c: '#ff4500', ch: '◊', dur: 30 },
  { n: { en: 'Ice Resistance Potion', zh: '冰霜抗性药水' }, ef: 'el_res_ice', v: 50, c: '#00ced1', ch: '◊', dur: 30 },
];

export const ALL_POTIONS: PotionDef[] = [...POTIONS, ...NEW_POTIONS];

// ===== New Scrolls =====
export const NEW_SCROLLS: ScrollDef[] = [
  { n: { en: 'Scroll of Blizzard', zh: '暴风雪卷轴' }, ef: 'blizzard', v: 35, c: '#00ced1', ch: '✻' },
  { n: { en: 'Scroll of Holy Light', zh: '圣光卷轴' }, ef: 'holy_blast', v: 40, c: '#ffd700', ch: '✦' },
  { n: { en: 'Scroll of Summoning', zh: '召唤卷轴' }, ef: 'summon_ally', v: 0, c: '#06d6a0', ch: '☉' },
];

export const ALL_SCROLLS: ScrollDef[] = [...SCROLLS, ...NEW_SCROLLS];

// ===== New Consumables =====
export const NEW_CONSUMABLES: ConsumableDef[] = [
  { n: { en: 'Void Bomb', zh: '虚空炸弹' }, ef: 'bomb', v: 50, c: '#9400d3', ch: '*', r: 2, desc: { en: 'AoE void dmg to nearby foes', zh: '对附近敌人造成范围虚空伤害' } },
  { n: { en: 'Holy Water', zh: '圣水' }, ef: 'holy_water', v: 30, c: '#ffd700', ch: '+', r: 2, desc: { en: 'Holy dmg to undead/demons', zh: '对亡灵/恶魔造成神圣伤害' } },
  { n: { en: 'Recall Stone', zh: '回城石' }, ef: 'recall', v: 0, c: '#4895ef', ch: '@', r: 2, desc: { en: 'Teleport to floor start', zh: '传送回楼层起点' } },
  { n: { en: 'Shadow Cloak', zh: '暗影斗篷' }, ef: 'invis', v: 0, c: '#2f4f4f', ch: '~', r: 3, desc: { en: 'Invisible for 10 turns', zh: '隐身10回合' } },
];

export const ALL_CONSUMABLES: ConsumableDef[] = [...CONSUMABLES, ...NEW_CONSUMABLES];

// ===== New Traps =====
export const NEW_TRAPS: TrapDef[] = [
  { n: { en: 'Void Rift Trap', zh: '虚空裂缝陷阱' }, dmg: 15, c: '#9400d3', ds: { en: 'A void rift tears open!', zh: '虚空裂缝撕裂开来！' }, ef: 'void_pull' },
  { n: { en: 'Holy Fire Trap', zh: '圣火陷阱' }, dmg: 20, c: '#ffd700', ds: { en: 'Holy fire engulfs you!', zh: '圣火将你吞没！' }, ef: 'holy_fire', dur: 3 },
];

export const ALL_TRAPS: TrapDef[] = [...TRAPS, ...NEW_TRAPS];

// ===== Food Definitions =====
export const FOODS: FoodDef[] = [
  { n: { en: 'Dried Meat', zh: '肉干' }, hungerRestore: 30, c: '#f4845f', ch: '≡', r: 0 },
  { n: { en: 'Fresh Bread', zh: '新鲜面包' }, hungerRestore: 20, hpHeal: 5, c: '#daa520', ch: '◯', r: 0 },
  { n: { en: 'Elven Feast', zh: '精灵盛宴' }, hungerRestore: 50, hpHeal: 20, c: '#06d6a0', ch: '※', r: 1 },
  { n: { en: 'Divine Ambrosia', zh: '神仙甘露' }, hungerRestore: 100, hpHeal: 50, c: '#ffd700', ch: '✦', r: 3 },
];

// ===== Equipment Sets =====
export const EQUIPMENT_SETS: EquipmentSetDef[] = [
  {
    id: 'fire_lord', n: { en: 'Fire Lord', zh: '炎魔之王' }, pieces: 3,
    bonuses: [
      { required: 2, type: 'el_res_fire', value: 50, desc: { en: '+50% Fire Resist', zh: '+50%火焰抗性' } },
      { required: 3, type: 'el_dmg_fire', value: 25, desc: { en: '+25% Fire Damage', zh: '+25%火焰伤害' } },
    ],
  },
  {
    id: 'frost_mage', n: { en: 'Frost Mage', zh: '冰霜法师' }, pieces: 2,
    bonuses: [
      { required: 2, type: 'el_dmg_ice', value: 30, desc: { en: '+30% Ice Damage', zh: '+30%冰霜伤害' } },
    ],
  },
  {
    id: 'shadow_set', n: { en: 'Shadow Walker', zh: '暗影行者' }, pieces: 3,
    bonuses: [
      { required: 2, type: 'dodge', value: 10, desc: { en: '+10% Dodge', zh: '+10%闪避' } },
      { required: 3, type: 'crit', value: 15, desc: { en: '+15% Crit', zh: '+15%暴击' } },
    ],
  },
  {
    id: 'divine', n: { en: 'Divine Champion', zh: '神圣卫士' }, pieces: 3,
    bonuses: [
      { required: 2, type: 'el_res_holy', value: 50, desc: { en: '+50% Holy Resist', zh: '+50%神圣抗性' } },
      { required: 3, type: 'heal_bonus', value: 20, desc: { en: '+20% Healing', zh: '+20%治疗加成' } },
    ],
  },
  {
    id: 'abyssal', n: { en: 'Abyssal Dweller', zh: '深渊居民' }, pieces: 2,
    bonuses: [
      { required: 2, type: 'maxhp', value: 30, desc: { en: '+30 Max HP', zh: '+30最大HP' } },
    ],
  },
];

// ===== Area Definitions =====
import { TL } from './config.js';

export const AREAS: AreaDef[] = [
  {
    id: 'caves', n: { en: 'The Caverns', zh: '地下洞穴' }, floorStart: 1, floorEnd: 5,
    wallColor: '#444', floorColor: '#333', corrColor: '#2a2a2a', bgColor: '#1a1a2e',
    wallChar: '#', floorChar: '·', enemyScaleBonus: 0,
    lore: [
      { en: 'Damp cave walls drip with moisture.', zh: '潮湿的洞壁上渗出水珠。' },
      { en: 'You hear skittering in the darkness.', zh: '黑暗中传来窸窣声。' },
    ],
  },
  {
    id: 'crypts', n: { en: 'Ancient Crypts', zh: '远古墓穴' }, floorStart: 6, floorEnd: 10,
    wallColor: '#3d3d5c', floorColor: '#2d2d3d', corrColor: '#1d1d2d', bgColor: '#0a0a1e',
    wallChar: '#', floorChar: '·', enemyScaleBonus: 0,
    lore: [
      { en: 'Ancient carvings line the corridors.', zh: '古老的雕刻布满走廊。' },
      { en: 'Dust motes dance in pale light.', zh: '微光中尘土飞扬。' },
    ],
  },
  {
    id: 'depths', n: { en: 'Burning Depths', zh: '灼热深渊' }, floorStart: 11, floorEnd: 15,
    wallColor: '#4a2020', floorColor: '#3d2020', corrColor: '#2d1515', bgColor: '#1a0a0a',
    wallChar: '#', floorChar: '·', enemyScaleBonus: 0,
    specialTiles: { type: TL.LAVA, ch: '~', fg: '#ff4500', bg: '#2a0a0a', count: [2, 5] },
    lore: [
      { en: 'The air smells of brimstone.', zh: '空气中弥漫着硫磺的气味。' },
      { en: 'Lava glows in cracks along the walls.', zh: '墙壁裂缝中透出岩浆的红光。' },
    ],
  },
  {
    id: 'fortress', n: { en: 'Dark Fortress', zh: '暗黑堡垒' }, floorStart: 16, floorEnd: 20,
    wallColor: '#2d2d3d', floorColor: '#2d2d35', corrColor: '#1d1d25', bgColor: '#0a0a15',
    wallChar: '#', floorChar: '·', enemyScaleBonus: 0,
    lore: [
      { en: 'Bones crunch under your feet.', zh: '脚下传来骨头碎裂的声响。' },
      { en: 'Iron portcullises groan in the dark.', zh: '铁栅栏在黑暗中吱呀作响。' },
    ],
  },
  {
    id: 'dragon', n: { en: "Dragon's Domain", zh: '龙之领域' }, floorStart: 21, floorEnd: 25,
    wallColor: '#4a1010', floorColor: '#3d1515', corrColor: '#2d0a0a', bgColor: '#1a0505',
    wallChar: '#', floorChar: '·', enemyScaleBonus: 0,
    specialTiles: { type: TL.LAVA, ch: '~', fg: '#ff6347', bg: '#2a0505', count: [3, 6] },
    lore: [
      { en: 'A distant roar echoes through the halls.', zh: '远处传来怒吼的回声。' },
      { en: 'Dragon fire illuminates the cavern.', zh: '龙火照亮了洞穴。' },
    ],
  },
  {
    id: 'abyss', n: { en: 'The Abyss', zh: '无尽深渊' }, floorStart: 26, floorEnd: 30,
    wallColor: '#0a2a3a', floorColor: '#0d1a2a', corrColor: '#0a1015', bgColor: '#050a10',
    wallChar: '~', floorChar: '.', enemyScaleBonus: 0.05,
    specialTiles: { type: TL.ABYSS_WATER, ch: '~', fg: '#00ced1', bg: '#0a1520', count: [5, 10] },
    lore: [
      { en: 'The water is impossibly deep. Something watches from below.', zh: '海水深不可测。有什么东西在下方注视着你。' },
      { en: 'Bioluminescent creatures drift in the current.', zh: '发光生物随波漂流。' },
    ],
  },
  {
    id: 'void', n: { en: 'Void Realm', zh: '虚空领域' }, floorStart: 31, floorEnd: 35,
    wallColor: '#1a0030', floorColor: '#150025', corrColor: '#0a0015', bgColor: '#050008',
    wallChar: '░', floorChar: '·', enemyScaleBonus: 0.08,
    specialTiles: { type: TL.VOID_FLOOR, ch: ' ', fg: '#2a0040', bg: '#0a0010', count: [3, 8] },
    lore: [
      { en: 'Reality bends. The walls are not walls.', zh: '现实扭曲。墙壁并非墙壁。' },
      { en: 'Colors that should not exist hurt your eyes.', zh: '不该存在的颜色刺痛了你的双眼。' },
    ],
  },
  {
    id: 'sanctum', n: { en: 'The Final Sanctum', zh: '最终圣殿' }, floorStart: 36, floorEnd: 40,
    wallColor: '#3a3a10', floorColor: '#2a2a10', corrColor: '#1a1a05', bgColor: '#0a0a00',
    wallChar: '█', floorChar: '·', enemyScaleBonus: 0.12,
    specialTiles: { type: TL.CRYSTAL, ch: '◆', fg: '#ffd700', bg: '#1a1a05', count: [2, 4] },
    lore: [
      { en: 'Divine light fills the halls. This is the end.', zh: '神圣的光芒充满殿堂。这是尽头。' },
      { en: 'The Creator awaits.', zh: '创世者在等待。' },
    ],
  },
];

// ===== Talent Trees =====
export const TALENT_TREES: TalentTree[] = [
  // Warrior (classIdx 0) — "Ironclad"
  {
    classIdx: 0,
    nodes: [
      { id: 'w_iron_skin', n: { en: 'Iron Skin', zh: '铁皮' }, desc: { en: '+2 DEF per rank', zh: '每级+2防御' }, maxRank: 3, icon: '🛡', row: 0, col: 0, effect: 'def', valuePerRank: 2 },
      { id: 'w_shield_mastery', n: { en: 'Shield Mastery', zh: '盾击精通' }, desc: { en: 'Shield Bash +20% dmg/rank', zh: '每级盾击+20%伤害' }, maxRank: 2, icon: '🔰', row: 0, col: 1, effect: 'skill_stun_dmg', valuePerRank: 20 },
      { id: 'w_battle_fury', n: { en: 'Battle Fury', zh: '战意' }, desc: { en: '+2 ATK per rank', zh: '每级+2攻击' }, maxRank: 3, icon: '⚔', row: 0, col: 2, effect: 'atk', valuePerRank: 2 },
      { id: 'w_berserker', n: { en: 'Berserker Rage', zh: '狂暴' }, desc: { en: '+15% ATK when HP<50%', zh: 'HP<50%时+15%攻击' }, maxRank: 1, icon: '💢', row: 0, col: 3, requires: ['w_battle_fury'], effect: 'low_hp_atk', valuePerRank: 15 },
      { id: 'w_blood', n: { en: 'Thick Blood', zh: '厚血' }, desc: { en: '+15 HP per rank', zh: '每级+15HP' }, maxRank: 3, icon: '❤', row: 1, col: 0, requires: ['w_iron_skin'], effect: 'maxhp', valuePerRank: 15 },
      { id: 'w_retaliation', n: { en: 'Retaliation', zh: '反击' }, desc: { en: '10% chance counter-attack', zh: '10%概率反击' }, maxRank: 1, icon: '↩', row: 1, col: 1, requires: ['w_iron_skin'], effect: 'counter', valuePerRank: 10 },
      { id: 'w_weapon_mastery', n: { en: 'Weapon Mastery', zh: '武器精通' }, desc: { en: '+3 ATK per rank', zh: '每级+3攻击' }, maxRank: 3, icon: '🗡', row: 1, col: 2, requires: ['w_battle_fury'], effect: 'atk', valuePerRank: 3 },
      { id: 'w_executioner', n: { en: 'Executioner', zh: '处刑人' }, desc: { en: '+30% dmg to HP<30% foes', zh: '对HP<30%敌人+30%伤害' }, maxRank: 1, icon: '💀', row: 1, col: 3, requires: ['w_weapon_mastery'], effect: 'execute', valuePerRank: 30 },
      { id: 'w_fortify', n: { en: 'Fortify', zh: '壁垒' }, desc: { en: '+3 DEF when HP>80%', zh: 'HP>80%时+3防御' }, maxRank: 1, icon: '🏰', row: 2, col: 0, requires: ['w_blood'], effect: 'high_hp_def', valuePerRank: 3 },
      { id: 'w_iron_will', n: { en: 'Iron Will', zh: '钢铁意志' }, desc: { en: 'Poison dmg reduced 50%', zh: '中毒伤害减半' }, maxRank: 1, icon: '🧠', row: 2, col: 1, requires: ['w_retaliation'], effect: 'poison_resist', valuePerRank: 50 },
      { id: 'w_whirlwind', n: { en: 'Whirlwind', zh: '旋风斩' }, desc: { en: 'Skill hits all adjacent', zh: '技能攻击所有相邻敌人' }, maxRank: 1, icon: '🌀', row: 2, col: 2, requires: ['w_shield_mastery'], effect: 'skill_aoe', valuePerRank: 1 },
      { id: 'w_last_stand', n: { en: 'Last Stand', zh: '背水一战' }, desc: { en: '+50% ATK when HP<20%', zh: 'HP<20%时+50%攻击' }, maxRank: 1, icon: '🔥', row: 2, col: 3, requires: ['w_berserker'], effect: 'desperate_atk', valuePerRank: 50 },
      { id: 'w_unbreakable', n: { en: 'Unbreakable', zh: '不屈' }, desc: { en: 'Survive lethal hit once/boss', zh: '每场Boss战免死一次' }, maxRank: 1, icon: '💎', row: 3, col: 0, requires: ['w_fortify'], effect: 'cheat_death', valuePerRank: 1 },
      { id: 'w_war_cry', n: { en: 'War Cry', zh: '战吼' }, desc: { en: 'Skill also fears nearby', zh: '技能同时恐惧附近敌人' }, maxRank: 1, icon: '📢', row: 3, col: 1, requires: ['w_iron_will'], effect: 'skill_fear', valuePerRank: 1 },
      { id: 'w_titan_strike', n: { en: 'Titan Strike', zh: '泰坦之击' }, desc: { en: 'Skill dmg +50%', zh: '技能伤害+50%' }, maxRank: 1, icon: '⚡', row: 3, col: 2, requires: ['w_whirlwind'], effect: 'skill_dmg_up', valuePerRank: 50 },
      { id: 'w_undying', n: { en: 'Undying', zh: '不死' }, desc: { en: 'Auto-revive 1/battle to 30% HP', zh: '每场战斗自动复活一次至30%HP' }, maxRank: 1, icon: '✨', row: 3, col: 3, requires: ['w_last_stand', 'w_titan_strike'], effect: 'auto_revive', valuePerRank: 30 },
    ],
  },
  // Rogue (classIdx 1) — "Shadow"
  {
    classIdx: 1,
    nodes: [
      { id: 'r_keen_eye', n: { en: 'Keen Eye', zh: '锐眼' }, desc: { en: '+5% crit per rank', zh: '每级+5%暴击' }, maxRank: 3, icon: '👁', row: 0, col: 0, effect: 'crit', valuePerRank: 5 },
      { id: 'r_swift_feet', n: { en: 'Swift Feet', zh: '迅步' }, desc: { en: '+3% dodge per rank', zh: '每级+3%闪避' }, maxRank: 3, icon: '💨', row: 0, col: 1, effect: 'dodge', valuePerRank: 3 },
      { id: 'r_poison_blade', n: { en: 'Poison Blade', zh: '毒刃' }, desc: { en: '20% chance to poison on hit', zh: '20%概率附加中毒' }, maxRank: 1, icon: '🐍', row: 0, col: 2, effect: 'on_hit_poison', valuePerRank: 20 },
      { id: 'r_backstab', n: { en: 'Backstab', zh: '背刺' }, desc: { en: '+25% crit damage', zh: '+25%暴击伤害' }, maxRank: 1, icon: '🗡', row: 0, col: 3, requires: ['r_keen_eye'], effect: 'crit_dmg', valuePerRank: 25 },
      { id: 'r_night_vision', n: { en: 'Night Vision', zh: '夜视' }, desc: { en: '+2 FOV', zh: '视野+2' }, maxRank: 1, icon: '🌙', row: 1, col: 0, requires: ['r_swift_feet'], effect: 'fov', valuePerRank: 2 },
      { id: 'r_evasion', n: { en: 'Evasion', zh: '闪避' }, desc: { en: '+5% dodge per rank', zh: '每级+5%闪避' }, maxRank: 2, icon: '🌀', row: 1, col: 1, requires: ['r_swift_feet'], effect: 'dodge', valuePerRank: 5 },
      { id: 'r_double_strike', n: { en: 'Double Strike', zh: '双重打击' }, desc: { en: '15% chance attack twice', zh: '15%概率攻击两次' }, maxRank: 1, icon: '⚔', row: 1, col: 2, requires: ['r_poison_blade'], effect: 'double_strike', valuePerRank: 15 },
      { id: 'r_death_mark', n: { en: 'Death Mark', zh: '死亡标记' }, desc: { en: 'Skill always crits', zh: '技能必定暴击' }, maxRank: 1, icon: '☠', row: 1, col: 3, requires: ['r_backstab'], effect: 'skill_crit', valuePerRank: 1 },
      { id: 'r_shadow_step', n: { en: 'Shadow Step', zh: '暗影步' }, desc: { en: 'Dodge next attack after kill', zh: '击杀后闪避下次攻击' }, maxRank: 1, icon: '👤', row: 2, col: 0, requires: ['r_night_vision'], effect: 'dodge_after_kill', valuePerRank: 1 },
      { id: 'r_vanish', n: { en: 'Vanish', zh: '消失' }, desc: { en: 'Invisible 3t when HP<25%', zh: 'HP<25%时隐身3回合' }, maxRank: 1, icon: '🚫', row: 2, col: 1, requires: ['r_evasion'], effect: 'vanish_low_hp', valuePerRank: 3 },
      { id: 'r_fan_knives', n: { en: 'Fan of Knives', zh: '飞刀扇' }, desc: { en: 'Skill hits all in range', zh: '技能攻击范围内所有敌人' }, maxRank: 1, icon: '🔪', row: 2, col: 2, requires: ['r_double_strike'], effect: 'skill_aoe', valuePerRank: 1 },
      { id: 'r_assassinate', n: { en: 'Assassinate', zh: '暗杀' }, desc: { en: 'Instakill foes <10% HP', zh: '秒杀HP<10%的敌人' }, maxRank: 1, icon: '💀', row: 2, col: 3, requires: ['r_death_mark'], effect: 'instakill', valuePerRank: 10 },
      { id: 'r_master_assassin', n: { en: 'Master Assassin', zh: '暗杀大师' }, desc: { en: '+50% skill damage', zh: '技能伤害+50%' }, maxRank: 1, icon: '🏆', row: 3, col: 0, requires: ['r_shadow_step'], effect: 'skill_dmg_up', valuePerRank: 50 },
      { id: 'r_smoke_screen', n: { en: 'Smoke Screen', zh: '烟幕' }, desc: { en: 'Skill also blinds enemies', zh: '技能同时致盲敌人' }, maxRank: 1, icon: '💨', row: 3, col: 1, requires: ['r_vanish'], effect: 'skill_blind', valuePerRank: 1 },
      { id: 'r_shadow_dance', n: { en: 'Shadow Dance', zh: '暗影之舞' }, desc: { en: 'Attack +30% for 3t after dodge', zh: '闪避后3回合攻击+30%' }, maxRank: 1, icon: '💃', row: 3, col: 2, requires: ['r_fan_knives'], effect: 'dodge_atk_buff', valuePerRank: 30 },
      { id: 'r_phantom_blade', n: { en: 'Phantom Blade', zh: '幻影刃' }, desc: { en: '30% chance extra full dmg', zh: '30%概率造成额外全额伤害' }, maxRank: 1, icon: '👻', row: 3, col: 3, requires: ['r_assassinate', 'r_master_assassin'], effect: 'phantom_strike', valuePerRank: 30 },
    ],
  },
  // Mage (classIdx 2) — "Arcane"
  {
    classIdx: 2,
    nodes: [
      { id: 'm_arcane_power', n: { en: 'Arcane Power', zh: '奥能' }, desc: { en: '+10% spell power per rank', zh: '每级+10%法术强度' }, maxRank: 3, icon: '🔮', row: 0, col: 0, effect: 'spellPower', valuePerRank: 10 },
      { id: 'm_mana_flow', n: { en: 'Mana Flow', zh: '法力流' }, desc: { en: '+5 max MP per rank', zh: '每级+5最大MP' }, maxRank: 3, icon: '💧', row: 0, col: 1, effect: 'maxmp', valuePerRank: 5 },
      { id: 'm_elemental_affinity', n: { en: 'Elemental Affinity', zh: '元素亲和' }, desc: { en: '+10% all element dmg', zh: '全元素伤害+10%' }, maxRank: 1, icon: '🌈', row: 0, col: 2, requires: ['m_arcane_power'], effect: 'all_el_dmg', valuePerRank: 10 },
      { id: 'm_spell_pen', n: { en: 'Spell Penetration', zh: '法穿' }, desc: { en: 'Ignore 20% enemy DEF', zh: '无视20%敌人防御' }, maxRank: 1, icon: '💫', row: 0, col: 3, requires: ['m_arcane_power'], effect: 'spell_pen', valuePerRank: 20 },
      { id: 'm_mana_shield', n: { en: 'Mana Shield', zh: '法力护盾' }, desc: { en: 'Take 10% less dmg when MP>50%', zh: 'MP>50%时减伤10%' }, maxRank: 1, icon: '🛡', row: 1, col: 0, requires: ['m_mana_flow'], effect: 'mana_shield', valuePerRank: 10 },
      { id: 'm_frost_touch', n: { en: 'Frost Touch', zh: '冰霜之触' }, desc: { en: '15% slow on hit', zh: '15%概率减速敌人' }, maxRank: 1, icon: '❄', row: 1, col: 1, requires: ['m_mana_flow'], effect: 'on_hit_slow', valuePerRank: 15 },
      { id: 'm_fire_mastery', n: { en: 'Fire Mastery', zh: '火焰精通' }, desc: { en: '+20% fire damage', zh: '火焰伤害+20%' }, maxRank: 1, icon: '🔥', row: 1, col: 2, requires: ['m_elemental_affinity'], effect: 'el_dmg_fire', valuePerRank: 20 },
      { id: 'm_chain_lightning', n: { en: 'Chain Lightning', zh: '连锁闪电' }, desc: { en: 'Skill chains to 2 extra foes', zh: '技能连锁至额外2个敌人' }, maxRank: 1, icon: '⚡', row: 1, col: 3, requires: ['m_spell_pen'], effect: 'skill_chain', valuePerRank: 2 },
      { id: 'm_arcane_barrier', n: { en: 'Arcane Barrier', zh: '奥术屏障' }, desc: { en: '+3 DEF per rank', zh: '每级+3防御' }, maxRank: 2, icon: '🧿', row: 2, col: 0, requires: ['m_mana_shield'], effect: 'def', valuePerRank: 3 },
      { id: 'm_time_warp', n: { en: 'Time Warp', zh: '时间扭曲' }, desc: { en: 'MP regen +2 per tick', zh: 'MP回复+2/tick' }, maxRank: 1, icon: '⏳', row: 2, col: 1, requires: ['m_frost_touch'], effect: 'mp_regen', valuePerRank: 2 },
      { id: 'm_blizzard', n: { en: 'Blizzard', zh: '暴风雪' }, desc: { en: 'Skill also slows enemies', zh: '技能同时减速敌人' }, maxRank: 1, icon: '🌨', row: 2, col: 2, requires: ['m_fire_mastery'], effect: 'skill_slow', valuePerRank: 1 },
      { id: 'm_meteor', n: { en: 'Meteor', zh: '陨石' }, desc: { en: 'Skill AoE radius +2', zh: '技能范围+2' }, maxRank: 1, icon: '☄', row: 2, col: 3, requires: ['m_chain_lightning'], effect: 'skill_radius', valuePerRank: 2 },
      { id: 'm_archmage', n: { en: 'Archmage', zh: '大法师' }, desc: { en: 'Spell power +30%', zh: '法术强度+30%' }, maxRank: 1, icon: '🧙', row: 3, col: 0, requires: ['m_arcane_barrier'], effect: 'spellPower', valuePerRank: 30 },
      { id: 'm_mana_surge', n: { en: 'Mana Surge', zh: '法力涌动' }, desc: { en: 'Kill restores 10% MP', zh: '击杀回复10%MP' }, maxRank: 1, icon: '💎', row: 3, col: 1, requires: ['m_time_warp'], effect: 'kill_mp', valuePerRank: 10 },
      { id: 'm_elemental_storm', n: { en: 'Elemental Storm', zh: '元素风暴' }, desc: { en: 'Skill uses random element', zh: '技能随机使用元素' }, maxRank: 1, icon: '🌪', row: 3, col: 2, requires: ['m_blizzard'], effect: 'skill_random_el', valuePerRank: 1 },
      { id: 'm_reality_tear', n: { en: 'Reality Tear', zh: '现实撕裂' }, desc: { en: 'Skill CD halved', zh: '技能冷却减半' }, maxRank: 1, icon: '🕳', row: 3, col: 3, requires: ['m_meteor', 'm_elemental_storm'], effect: 'skill_cd_half', valuePerRank: 50 },
    ],
  },
  // Paladin (classIdx 3) — "Divine"
  {
    classIdx: 3,
    nodes: [
      { id: 'p_holy_str', n: { en: 'Holy Strength', zh: '圣力' }, desc: { en: '+2 ATK per rank', zh: '每级+2攻击' }, maxRank: 3, icon: '⚔', row: 0, col: 0, effect: 'atk', valuePerRank: 2 },
      { id: 'p_divine_shield', n: { en: 'Divine Shield', zh: '圣盾' }, desc: { en: '+2 DEF per rank', zh: '每级+2防御' }, maxRank: 3, icon: '🛡', row: 0, col: 1, effect: 'def', valuePerRank: 2 },
      { id: 'p_healing_light', n: { en: 'Healing Light', zh: '治愈之光' }, desc: { en: '+10% healing per rank', zh: '每级+10%治疗量' }, maxRank: 3, icon: '💚', row: 0, col: 2, effect: 'heal_bonus', valuePerRank: 10 },
      { id: 'p_aura', n: { en: 'Aura of Protection', zh: '守护光环' }, desc: { en: '+5% dodge', zh: '闪避+5%' }, maxRank: 1, icon: '✨', row: 0, col: 3, requires: ['p_divine_shield'], effect: 'aura_dodge', valuePerRank: 5 },
      { id: 'p_righteous_fury', n: { en: 'Righteous Fury', zh: '正义之怒' }, desc: { en: '+3 ATK vs shadow foes', zh: '对暗影敌人+3攻击' }, maxRank: 1, icon: '🔥', row: 1, col: 0, requires: ['p_holy_str'], effect: 'bonus_vs_shadow', valuePerRank: 3 },
      { id: 'p_blessed_endurance', n: { en: 'Blessed Endurance', zh: '祝福耐力' }, desc: { en: '+15 HP per rank', zh: '每级+15HP' }, maxRank: 3, icon: '❤', row: 1, col: 1, requires: ['p_divine_shield'], effect: 'maxhp', valuePerRank: 15 },
      { id: 'p_consecrate', n: { en: 'Consecrate', zh: '净化' }, desc: { en: 'Skill also deals holy dmg', zh: '技能同时造成神圣伤害' }, maxRank: 1, icon: '🌟', row: 1, col: 2, requires: ['p_healing_light'], effect: 'skill_holy_dmg', valuePerRank: 1 },
      { id: 'p_judgment', n: { en: 'Divine Judgment', zh: '神圣审判' }, desc: { en: 'Skill also stuns 1 turn', zh: '技能同时眩晕1回合' }, maxRank: 1, icon: '⚡', row: 1, col: 3, requires: ['p_aura'], effect: 'skill_stun', valuePerRank: 1 },
      { id: 'p_lay_on_hands', n: { en: 'Lay on Hands', zh: '圣疗' }, desc: { en: 'Auto-heal 20% when HP<20%', zh: 'HP<20%时自动回复20%' }, maxRank: 1, icon: '🤲', row: 2, col: 0, requires: ['p_righteous_fury'], effect: 'auto_heal', valuePerRank: 20 },
      { id: 'p_sanctuary', n: { en: 'Sanctuary', zh: '庇护所' }, desc: { en: 'Immune to fear/stun', zh: '免疫恐惧和眩晕' }, maxRank: 1, icon: '🏛', row: 2, col: 1, requires: ['p_blessed_endurance'], effect: 'cc_immune', valuePerRank: 1 },
      { id: 'p_holy_nova', n: { en: 'Holy Nova', zh: '神圣新星' }, desc: { en: 'Skill also heals nearby', zh: '技能同时治疗附近友方' }, maxRank: 1, icon: '💫', row: 2, col: 2, requires: ['p_consecrate'], effect: 'skill_aoe_heal', valuePerRank: 1 },
      { id: 'p_smite', n: { en: 'Smite', zh: '圣击' }, desc: { en: 'Skill dmg +40%', zh: '技能伤害+40%' }, maxRank: 1, icon: '🔨', row: 2, col: 3, requires: ['p_judgment'], effect: 'skill_dmg_up', valuePerRank: 40 },
      { id: 'p_champion', n: { en: 'Champion of Light', zh: '光明之冠' }, desc: { en: '+3 ATK, +3 DEF', zh: '+3攻击, +3防御' }, maxRank: 1, icon: '👑', row: 3, col: 0, requires: ['p_lay_on_hands'], effect: 'atk', valuePerRank: 3 },
      { id: 'p_intervention', n: { en: 'Divine Intervention', zh: '神圣干预' }, desc: { en: 'Revive to 50% HP once/run', zh: '每局自动复活至50%HP一次' }, maxRank: 1, icon: '👼', row: 3, col: 1, requires: ['p_sanctuary'], effect: 'auto_revive', valuePerRank: 50 },
      { id: 'p_angelic_wrath', n: { en: 'Angelic Wrath', zh: '天使之怒' }, desc: { en: 'Holy dmg on every attack', zh: '每次攻击附加神圣伤害' }, maxRank: 1, icon: '⚡', row: 3, col: 2, requires: ['p_holy_nova'], effect: 'holy_on_hit', valuePerRank: 1 },
      { id: 'p_resurrection', n: { en: 'Resurrection', zh: '复活' }, desc: { en: 'Auto-revive to 100% once', zh: '自动复活至满血一次' }, maxRank: 1, icon: '🌟', row: 3, col: 3, requires: ['p_smite', 'p_intervention'], effect: 'full_revive', valuePerRank: 100 },
    ],
  },
];

// ===== Meta Upgrades (The Forge) =====
import type { MetaUpgradeDef } from './types.js';

export const META_UPGRADES: MetaUpgradeDef[] = [
  { id: 'start_hp', n: { en: 'Vitality', zh: '生命强化' }, d: { en: '+10 Max HP per level', zh: '每级+10最大HP' }, icon: '❤', maxLevel: 5, costs: [10, 15, 25, 40, 60], effect: 'start_hp', valuePerLevel: 10, category: 'stats' },
  { id: 'start_mp', n: { en: 'Arcane Reserves', zh: '魔力储备' }, d: { en: '+5 Max MP per level', zh: '每级+5最大MP' }, icon: '💧', maxLevel: 3, costs: [10, 20, 35], effect: 'start_mp', valuePerLevel: 5, category: 'stats' },
  { id: 'start_atk', n: { en: 'Martial Training', zh: '武技' }, d: { en: '+1 ATK per level', zh: '每级+1攻击' }, icon: '⚔', maxLevel: 3, costs: [15, 30, 50], effect: 'start_atk', valuePerLevel: 1, category: 'stats' },
  { id: 'start_def', n: { en: 'Toughness', zh: '坚韧' }, d: { en: '+1 DEF per level', zh: '每级+1防御' }, icon: '🛡', maxLevel: 3, costs: [15, 30, 50], effect: 'start_def', valuePerLevel: 1, category: 'stats' },
  { id: 'crit_bonus', n: { en: 'Keen Edge', zh: '锐锋' }, d: { en: '+3% crit chance per level', zh: '每级+3%暴击' }, icon: '🗡', maxLevel: 3, costs: [20, 35, 55], effect: 'crit_bonus', valuePerLevel: 3, category: 'stats' },
  { id: 'dodge_bonus', n: { en: 'Nimble', zh: '灵巧' }, d: { en: '+2% dodge chance per level', zh: '每级+2%闪避' }, icon: '💨', maxLevel: 3, costs: [20, 35, 55], effect: 'dodge_bonus', valuePerLevel: 2, category: 'stats' },
  { id: 'start_gold', n: { en: 'Inheritance', zh: '遗产' }, d: { en: '+15 starting gold per level', zh: '每级+15初始金币' }, icon: '💰', maxLevel: 3, costs: [10, 20, 35], effect: 'start_gold', valuePerLevel: 15, category: 'survival' },
  { id: 'heal_bonus', n: { en: 'Regeneration', zh: '再生' }, d: { en: '+5% healing from all sources', zh: '所有治疗效果+5%' }, icon: '💚', maxLevel: 3, costs: [20, 40, 65], effect: 'heal_bonus', valuePerLevel: 5, category: 'survival' },
  { id: 'start_food', n: { en: 'Well Fed', zh: '饱食' }, d: { en: '+20 starting hunger per level', zh: '每级+20初始饱食度' }, icon: '🍖', maxLevel: 2, costs: [10, 20], effect: 'start_food', valuePerLevel: 20, category: 'survival' },
  { id: 'extra_talent', n: { en: 'Gifted', zh: '天赋' }, d: { en: '+1 bonus talent point at start', zh: '开局额外+1天赋点' }, icon: '🌟', maxLevel: 3, costs: [25, 50, 80], effect: 'extra_talent', valuePerLevel: 1, category: 'talent' },
  { id: 'exp_bonus', n: { en: 'Wisdom', zh: '智慧' }, d: { en: '+10% experience gain', zh: '经验获取+10%' }, icon: '📖', maxLevel: 3, costs: [25, 45, 70], effect: 'exp_bonus', valuePerLevel: 10, category: 'talent' },
  { id: 'fov_bonus', n: { en: 'Eagle Eye', zh: '鹰眼' }, d: { en: '+1 FOV radius per level', zh: '每级+1视野范围' }, icon: '👁', maxLevel: 2, costs: [20, 40], effect: 'fov_bonus', valuePerLevel: 1, category: 'utility' },
  { id: 'inv_size', n: { en: 'Pack Mule', zh: '驮兽' }, d: { en: '+4 inventory slots per level', zh: '每级+4背包容量' }, icon: '🎒', maxLevel: 2, costs: [15, 30], effect: 'inv_size', valuePerLevel: 4, category: 'utility' },
  { id: 'gold_bonus', n: { en: 'Greed', zh: '贪婪' }, d: { en: '+10% gold earned', zh: '金币获取+10%' }, icon: '💎', maxLevel: 3, costs: [15, 30, 50], effect: 'gold_bonus', valuePerLevel: 10, category: 'utility' },
  { id: 'soul_bonus', n: { en: 'Soul Attunement', zh: '灵魂共鸣' }, d: { en: '+10% Soul Echoes earned', zh: '灵魂回响获取+10%' }, icon: '💀', maxLevel: 3, costs: [30, 60, 100], effect: 'soul_bonus', valuePerLevel: 10, category: 'utility' },
];

// ===== Relics (run-defining passive artifacts) =====
import type { RelicDef } from './types.js';

export const RELICS: RelicDef[] = [
  // Offense
  { id: 'war_totem', n: { en: 'War Totem', zh: '战神图腾' }, d: { en: '+15% ATK', zh: '+15% 攻击力' }, ch: '⚒️', c: '#e63946', rarity: 1, effect: 'atk_pct', value: 15 },
  { id: 'assassin_sigil', n: { en: "Assassin's Sigil", zh: '刺客印记' }, d: { en: '+12% crit chance', zh: '+12% 暴击率' }, ch: '🗡️', c: '#9b5de5', rarity: 2, effect: 'crit', value: 12 },
  { id: 'executioners_axe', n: { en: "Executioner's Axe", zh: '处刑者之斧' }, d: { en: '+40% dmg to foes below 30% HP', zh: '对生命低于30%的敌人+40%伤害' }, ch: '🪓', c: '#ff4500', rarity: 2, effect: 'execute', value: 40 },
  // Sustain / survival
  { id: 'vampiric_fang', n: { en: 'Vampiric Fang', zh: '吸血獠牙' }, d: { en: 'Heal 15% of damage dealt', zh: '造成伤害的15%转化为生命' }, ch: '🦷', c: '#b5179e', rarity: 2, effect: 'lifesteal', value: 15 },
  { id: 'phoenix_heart', n: { en: 'Phoenix Heart', zh: '凤凰之心' }, d: { en: 'Revive once at 50% HP', zh: '死亡时复活一次（50%生命）' }, ch: '🔥', c: '#ff6b35', rarity: 4, effect: 'revive', value: 50 },
  { id: 'stone_skin', n: { en: 'Stone Skin', zh: '石肤符文' }, d: { en: '+5 DEF', zh: '+5 防御' }, ch: '🪨', c: '#8d99ae', rarity: 1, effect: 'def', value: 5 },
  { id: 'giants_belt', n: { en: "Giant's Belt", zh: '巨人腰带' }, d: { en: '+40 Max HP', zh: '+40 最大生命' }, ch: '🟫', c: '#06d6a0', rarity: 1, effect: 'maxhp', value: 40 },
  // Elements
  { id: 'ember_core', n: { en: 'Ember Core', zh: '余烬核心' }, d: { en: 'Attacks deal bonus fire damage', zh: '攻击附加火焰伤害' }, ch: '🌟', c: '#ff7a45', rarity: 2, effect: 'el_fire', value: 6 },
  { id: 'frost_heart', n: { en: 'Frost Heart', zh: '冰霜之心' }, d: { en: 'Bonus ice dmg + 20% slow chance', zh: '附加冰霜伤害，20%几率减速' }, ch: '❄️', c: '#7ec8e3', rarity: 2, effect: 'el_ice', value: 6 },
  // Economy
  { id: 'greed_idol', n: { en: 'Greed Idol', zh: '贪婪神像' }, d: { en: '+30% gold from kills', zh: '击杀金币+30%' }, ch: '💰', c: '#ffd700', rarity: 1, effect: 'gold_pct', value: 30 },
  { id: 'scholar_lens', n: { en: 'Scholar Lens', zh: '学者透镜' }, d: { en: '+25% XP', zh: '经验+25%' }, ch: '📖', c: '#4895ef', rarity: 1, effect: 'exp_pct', value: 25 },
  // Magic
  { id: 'arcane_focus', n: { en: 'Arcane Focus', zh: '奥术聚焦' }, d: { en: '+25% spell power', zh: '+25% 法术强度' }, ch: '🔮', c: '#9b5de5', rarity: 2, effect: 'spell_pct', value: 25 },
  // Counter
  { id: 'thorned_bramble', n: { en: 'Thorned Bramble', zh: '荆棘护甲' }, d: { en: 'Reflect 30% of damage taken', zh: '反弹30%受到的伤害' }, ch: '🌵', c: '#06d6a0', rarity: 2, effect: 'thorns', value: 30 },
];
