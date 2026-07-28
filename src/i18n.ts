// Internationalization system
import type { I18nText } from './types.js';
import { G, lang } from './state.js';

// Translation strings
export const L: Record<string, I18nText | I18nText[]> = {
  titleH1: { en: 'DEPTHS OF DARKHOLLOW', zh: '暗渊深处' },
  titleH2: { en: 'A Roguelike Dungeon Crawler', zh: '肉鸽地牢探险' },
  btnNew: { en: 'New Game', zh: '新游戏' },
  btnCont: { en: 'Continue', zh: '继续游戏' },
  btnHelp: { en: 'How to Play', zh: '游戏说明' },
  hero: { en: 'Hero', zh: '英雄' },
  name: { en: 'Name', zh: '名字' }, race: { en: 'Race', zh: '种族' }, cls: { en: 'Class', zh: '职业' },
  level: { en: 'Level', zh: '等级' }, gold: { en: 'Gold', zh: '金币' }, floor: { en: 'Floor', zh: '楼层' },
  turns: { en: 'Turns', zh: '回合' }, combo: { en: 'Combo', zh: '连击' },
  stats: { en: 'Stats', zh: '属性' }, equip: { en: 'Equipment', zh: '装备' },
  weapon: { en: 'Weapon', zh: '武器' }, armor: { en: 'Armor', zh: '护甲' }, accessory: { en: 'Accessory', zh: '饰品' },
  effects: { en: 'Effects', zh: '效果' }, inventory: { en: '🎒 Inventory', zh: '🎒 背包' },
  howToPlay: { en: '📖 How to Play', zh: '📖 游戏说明' }, skills: { en: '⚡ Skills', zh: '⚡ 技能' },
  achievements: { en: '🏆 Achievements', zh: '🏆 成就' },
  createHero: { en: 'Create Your Hero', zh: '创建你的英雄' },
  begin: { en: 'Begin Adventure', zh: '开始冒险' },
  none: { en: 'None', zh: '无' }, empty: { en: 'Your inventory is empty.', zh: '背包是空的。' },
  deathH1: { en: 'YOU HAVE PERISHED', zh: '你已阵亡' },
  victorySub: { en: 'The Creator has been vanquished!', zh: '创世者已被击败！' },
  saved: { en: 'Game saved!', zh: '游戏已保存！' },
  noSave: { en: 'No saved game found!', zh: '未找到存档！' },
  muted: { en: 'Sound muted.', zh: '已静音。' }, unmuted: { en: 'Sound enabled.', zh: '已开启音效。' },
  langChanged: { en: 'Language: English', zh: '语言：中文' },
  noPotion: { en: 'No potions to drink!', zh: '没有药水可以喝！' },
  noScroll: { en: 'No scrolls to read!', zh: '没有卷轴可以读！' },
  noStairs: { en: 'There are no stairs here.', zh: '这里没有楼梯。' },
  nothingHere: { en: 'Nothing to pick up here.', zh: '这里没有可拾取的物品。' },
  invFull: { en: 'Inventory full!', zh: '背包已满！' },
  noMP: { en: 'Not enough MP! (Need 3 MP)', zh: '魔力不足！（需要3MP）' },
  wait: { en: 'You wait...', zh: '你等待了一回合...' },
  effectsOff: { en: 'effect wore off.', zh: '效果消失了。' },
  weaponGrp: { en: '⚔ Weapons', zh: '⚔ 武器' }, armorGrp: { en: '🛡 Armor', zh: '🛡 护甲' },
  accGrp: { en: '💍 Accessories', zh: '💍 饰品' }, potGrp: { en: '🧪 Potions', zh: '🧪 药水' },
  scrGrp: { en: '📜 Scrolls', zh: '📜 卷轴' }, conGrp: { en: '🔧 Items', zh: '🔧 道具' },
  equPrefix: { en: 'Equipped ', zh: '装备了 ' },
  unequPrefix: { en: 'Unequipped ', zh: '卸下了 ' },
  pickedUp: { en: 'Picked up ', zh: '拾取了 ' },
  equipped: { en: 'Equipped ', zh: '装备了 ' },
  rareCommon: { en: 'Common', zh: '普通' }, rareUncommon: { en: 'Uncommon', zh: '优秀' },
  rareRare: { en: 'Rare', zh: '稀有' }, rareEpic: { en: 'Epic', zh: '史诗' }, rareLegend: { en: 'Legendary', zh: '传说' },
  floorDesc: [
    { en: 'Damp cave walls drip with moisture.', zh: '潮湿的洞壁上渗出水珠。' },
    { en: 'Ancient carvings line the corridors.', zh: '古老的雕刻布满走廊。' },
    { en: 'The air smells of brimstone.', zh: '空气中弥漫着硫磺的气味。' },
    { en: 'Bones crunch under your feet.', zh: '脚下传来骨头碎裂的声响。' },
    { en: 'A distant roar echoes through the halls.', zh: '远处传来怒吼的回声。' },
  ],
  merchantTitle: { en: '🧙 Wandering Merchant', zh: '🧙 流浪商人' },
  merchantDesc: { en: 'A mysterious merchant appears! "I have wares, if you have coin..."', zh: '一个神秘的商人出现了！"我有货，如果你有钱的话……"' },
  merchantBuy: { en: 'Buy Mystery Item (-30 Gold)', zh: '购买神秘物品（-30金币）' },
  merchantLeave: { en: 'Leave', zh: '离开' },
  merchantNoGold: { en: 'Not enough gold!', zh: '金币不足！' },
  merchantBought: { en: 'The merchant hands you a mysterious item!', zh: '商人递给你一件神秘物品！' },
  chestTitle: { en: '📦 Treasure Chest', zh: '📦 宝箱' },
  chestDesc: { en: 'You found an ornate chest! It could contain great treasure... or a trap.', zh: '你发现了一个华丽的宝箱！里面可能有宝藏……也可能是陷阱。' },
  chestOpen: { en: 'Open It', zh: '打开它' },
  chestLeave: { en: 'Leave It', zh: '不管它' },
  chestGood: { en: 'The chest contains wonderful treasures!', zh: '宝箱里装满了珍宝！' },
  chestBad: { en: 'It was a mimic! It bites you!', zh: '是宝箱怪！它咬了你一口！' },
  fountainTitle: { en: '⛲ Enchanted Fountain', zh: '⛲ 魔法喷泉' },
  fountainDesc: { en: 'A glowing fountain bubbles with magical water. Drink?', zh: '一个发光的喷泉涌出魔法之水。要喝吗？' },
  fountainDrink: { en: 'Drink', zh: '饮用' },
  fountainSkip: { en: 'Skip', zh: '跳过' },
  fountainHeal: { en: 'The magic water heals your wounds!', zh: '魔法之水治愈了你的伤口！' },
  shrineTitle: { en: '⛩ Ancient Shrine', zh: '⛩ 古代神殿' },
  shrineDesc: { en: 'A shrine pulses with power. Pray for a blessing?', zh: '一座神殿散发着力量。祈求祝福？' },
  shrinePray: { en: 'Pray', zh: '祈祷' },
  shrineSkip: { en: 'Skip', zh: '跳过' },
  shrineBuff: { en: 'The shrine bestows a powerful blessing!', zh: '神殿赐予了你强大的祝福！' },
  loreIntro: { en: 'You descend into the Depths of Darkhollow...', zh: '你踏入了暗渊深处……' },
  loreTip1: { en: 'Find the stairs (>) to go deeper. Survive!', zh: '找到楼梯(>)深入地牢。活下去！' },
  loreTip2: { en: 'Beware of traps (^) and manage your hunger.', zh: '小心陷阱(^)，注意管理饥饿度。' },
  loreBoss: { en: 'You sense a powerful presence on this floor...', zh: '你感受到这层有一股强大的气息……' },
  loreFinal: { en: 'The Creator awaits in the Final Sanctum...', zh: '创世者在最终圣殿中等待着你……' },
  loreVictory: { en: 'The Creator falls! You have conquered Darkhollow!', zh: '创世者倒下了！你征服了暗渊！' },
  hungerWarn: { en: 'You are getting hungry...', zh: '你开始感到饥饿……' },
  hungerDmg: { en: 'Starvation deals ', zh: '饥饿造成了' }, hungerDmgSuf: { en: ' damage!', zh: '点伤害！' },
  foodFound: { en: 'You found some food! Hunger restored.', zh: '你找到了食物！饥饿度恢复了。' },
  foodName: { en: 'Dried Meat', zh: '肉干' }, foodDesc: { en: 'Restores hunger', zh: '恢复饥饿度' },
  streakMsg: { en: ' kill streak! Bonus XP!', zh: '连杀！额外经验！' },
  dodgeMsg: { en: 'You dodged an attack!', zh: '你闪避了一次攻击！' },
  skillCooldown: { en: 'Skill on cooldown!', zh: '技能冷却中！' },
  skillUsed: { en: ' used!', zh: '！' },
  poisonTurn: { en: 'Poison deals ', zh: '中毒造成' }, poisonTurnSuf: { en: ' damage!', zh: '点伤害！' },
  hungerLabel: { en: 'Hunger', zh: '饥饿' },
  allyName: { en: 'Summoned Spirit', zh: '召唤灵' },
  allyMsg: { en: 'A summoned spirit appears to aid you!', zh: '一个召唤灵出现了！' },
  allyKill: { en: 'Your spirit killed ', zh: '你的召唤灵击杀了' },
  allyHit: { en: 'Your spirit hits ', zh: '你的召唤灵攻击了' },
  tryAgain: { en: 'Try Again', zh: '再试一次' },
  playAgain: { en: 'Play Again', zh: '再来一局' },
  titleScreen: { en: 'Title Screen', zh: '返回标题' },
  bossMark: { en: '⚠ BOSS', zh: '⚠ BOSS' },
  finalMark: { en: '★ FINAL', zh: '★ 最终层' },
  legendToggle: { en: 'Legend', zh: '图例' },
  keysToggle: { en: '⌨ Keys', zh: '⌨ 键位' },
  // Meta progression
  forgeBtn: { en: '⚒ The Forge', zh: '⚒ 铸魂炉' },
  forgeTitle: { en: '⚒ The Forge — Permanent Upgrades', zh: '⚒ 铸魂炉 — 永久升级' },
  soulEchoes: { en: 'Soul Echoes', zh: '灵魂回响' },
  purchasedUpgrade: { en: 'Upgraded!', zh: '升级成功！' },
  audioTitle: { en: '🔊 Audio', zh: '🔊 音频设置' },
  volMaster: { en: 'Master', zh: '主音量' },
  volMusic: { en: 'Music', zh: '音乐' },
  volSfx: { en: 'Sound FX', zh: '音效' },
  // ===== Options / Settings system =====
  options: { en: 'Options', zh: '选项' },
  optionsTitle: { en: '⚙ Options', zh: '⚙ 选项' },
  optTabAudio: { en: 'Audio', zh: '音频' },
  optTabDisplay: { en: 'Display', zh: '显示' },
  optTabAccess: { en: 'Accessibility', zh: '辅助功能' },
  optTabGame: { en: 'Gameplay', zh: '游戏' },
  optMute: { en: 'Mute All', zh: '全部静音' },
  optFullscreen: { en: 'Fullscreen', zh: '全屏' },
  optZoom: { en: 'UI Zoom', zh: '界面缩放' },
  optTextSize: { en: 'Text Size', zh: '文字大小' },
  optMinimap: { en: 'Minimap Size', zh: '小地图大小' },
  optSafeZone: { en: 'Safe Zone', zh: '安全区' },
  optLanguage: { en: 'Language', zh: '语言' },
  optReducedMotion: { en: 'Reduced Motion', zh: '减少动效' },
  optShake: { en: 'Screen Shake', zh: '震屏强度' },
  optColorblind: { en: 'Color Blindness', zh: '色弱滤镜' },
  optBarCues: { en: 'Bar Shape Cues', zh: '状态条图标' },
  optLegend: { en: 'Show Legend', zh: '显示图例' },
  optKeys: { en: 'Show Key Hints', zh: '显示键位提示' },
  cbOff: { en: 'Off', zh: '关闭' },
  cbProto: { en: 'Protanopia', zh: '红色盲' },
  cbDeutan: { en: 'Deuteranopia', zh: '绿色盲' },
  cbTritan: { en: 'Tritanopia', zh: '蓝色盲' },
  tsSmall: { en: 'Small', zh: '小' },
  tsMedium: { en: 'Medium', zh: '中' },
  tsLarge: { en: 'Large', zh: '大' },
  on: { en: 'On', zh: '开' },
  off: { en: 'Off', zh: '关' },
  pauseTitle: { en: '⏸ Paused', zh: '⏸ 已暂停' },
  pauseResume: { en: 'Resume', zh: '继续游戏' },
  pauseSettings: { en: '⚙ Settings', zh: '⚙ 设置' },
  pauseQuit: { en: 'Quit to Title', zh: '返回标题' },
  quitConfirm: { en: 'Quit to title? Current progress will be lost.', zh: '返回标题？当前进度将丢失。' },
};

export function t(key: string): string {
  const entry = L[key];
  if (!entry) return key;
  if ('en' in entry && 'zh' in entry) {
    const e = entry as I18nText;
    return lang === 'zh' ? e.zh : e.en;
  }
  return key;
}

export function tMsg(key: string, ...args: string[]): string {
  let s = t(key);
  for (let i = 0; i < args.length; i++) s = s.replace('{}', args[i]);
  return s;
}

// Rarity names
const RARITY_N = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
const RARITY_NZ = ['普通', '优秀', '稀有', '史诗', '传说'];
export const RARITY_C = ['#c0c0c0', '#06d6a0', '#4895ef', '#9b5de5', '#ffd700'];

export function rareName(r: number): string {
  return lang === 'zh' ? RARITY_NZ[r] : RARITY_N[r];
}

export function itemName(base: { n: I18nText }): string {
  const n = base.n;
  return lang === 'zh' ? n.zh : n.en;
}
