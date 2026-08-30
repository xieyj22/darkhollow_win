// All game data definitions
import type {
  RaceDef, ClassDef, WeaponDef, ArmorDef, AccessoryDef,
  PotionDef, ScrollDef, ConsumableDef, TrapDef, FoodDef,
  EnemyDef, BossDef, ElitePrefix, AchievementDef, Element,
  EquipmentSetDef, AreaDef, TalentTree, I18nText,
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
  { id: 'rusty_sword', n: { en: 'Rusty Sword', zh: '锈剑' }, r: 0, a: 2, ch: '/',
    flavor: { en: 'The cheapest issue from the forge; rust on its grip tells of countless failed descents.', zh: '铁匠铺里最廉价的制式剑，握柄上的锈迹诉说着无数失意者的下山之路。' } },
  { id: 'iron_dagger', n: { en: 'Iron Dagger', zh: '铁匕首' }, r: 0, a: 3, ch: '‡',
    flavor: { en: 'Short, easily hidden; the guild\'s welcome gift to novices, and a frequent guest between shoulder blades.', zh: '短小易藏，是盗贼行会里新丁的入门礼，也是背后一刀的常见凶器。' } },
  { id: 'short_sword', n: { en: 'Short Sword', zh: '短剑' }, r: 0, a: 4, ch: '/',
    flavor: { en: 'The standard sidearm of cave mercenaries: long enough to guard the body, short enough to turn in a tight passage.', zh: '洞穴佣兵最常配发的近战兵器，长度足以自卫，却不至于阻碍在窄道中转身。' } },
  { id: 'longsword', n: { en: 'Longsword', zh: '长剑' }, r: 1, a: 6, ch: '†',
    flavor: { en: 'A knight\'s regulation blade; its steel often bears forgotten oaths, and ruined nobles pawn them for bread.', zh: '正规骑士的制式佩剑，剑身上往往刻有失落的誓言，落魄贵族也靠它典当度日。' } },
  { id: 'battle_axe', n: { en: 'Battle Axe', zh: '战斧' }, r: 1, a: 7, ch: 'Ψ',
    flavor: { en: 'The two-handed wide blade favored by barbarian raiders; each swing carries the dull wind of shields splitting.', zh: '蛮族劫掠者惯用的双手宽刃，挥动时带着撕开盾阵的沉闷风声。' } },
  { id: 'war_hammer', n: { en: 'War Hammer', zh: '战锤' }, r: 1, a: 8, ch: '⊥',
    flavor: { en: 'A blunt iron head made to crack plate; every dent matches a corpse that could no longer be named.', zh: '钝重的铁头专破重甲，每一道凹痕都对应着一具再也无法辨认的尸体。' } },
  { id: 'flamebrand', n: { en: 'Flamebrand', zh: '炎刃' }, r: 2, a: 10, ch: '†',
    flavor: { en: 'Quenched seven days in a volcanic forge, the steel still glows dull red; they say dragon\'s blood was in the water.', zh: '剑身以火山口炉火淬过七日，至今仍泛着暗红，据说淬火时掺了龙血。' } },
  { id: 'frost_edge', n: { en: 'Frost Edge', zh: '霜刃' }, r: 2, a: 11, ch: '†',
    flavor: { en: 'Shamans of the north set permafrost crystals along the spine; drawing it turns the air to frost.', zh: '寒带萨满将永冻层下的冰晶嵌入剑脊，出鞘时空气便凝结成霜粉。' } },
  { id: 'thunder_mace', n: { en: 'Thunder Mace', zh: '雷霆锤' }, r: 2, a: 12, ch: '⊥',
    flavor: { en: 'A wisp of undying thunder is sealed in the head; on impact its blue flash numbs the heart beneath the armor.', zh: '锤头里封着一缕不散的雷魂，击打时迸发的青光能让盔甲下的心脏发麻。' } },
  { id: 'shadow_blade', n: { en: 'Shadow Blade', zh: '暗影之刃' }, r: 3, a: 15, ch: '†',
    flavor: { en: 'Ground from the bones of oathbreakers; it makes almost no sound when swung—only the shadow twists a moment early.', zh: '由背誓者之骨磨制而成，挥动时几乎不留声响，唯有影子会先一步扭曲。' } },
  { id: 'dragon_fang', n: { en: "Dragon's Fang", zh: '龙牙剑' }, r: 3, a: 17, ch: '†',
    flavor: { en: 'Edged from a fallen ancient dragon\'s fang, its grip wrapped in dragonhide; bearers dream of burning peaks.', zh: '以古龙脱落的犬齿开刃，剑柄缠着龙皮，据传持剑者会梦见火焰中的高山。' } },
  { id: 'vorpal_sword', n: { en: 'Vorpal Sword', zh: '斩首剑' }, r: 4, a: 22, ch: '†',
    flavor: { en: 'The headsman\'s heirloom; it has never caught on bone. Some say it finds the gap in a neck on its own.', zh: '行刑官世代相传的利刃，从未在骨头里卡住过，传说它会自己寻找颈骨的缝隙。' } },
  { id: 'godslayer_sword', n: { en: 'Godslayer', zh: '弑神剑' }, r: 4, a: 25, ch: '†',
    flavor: { en: 'Its maker took his own life the night it was finished; the blade drank its fill of mortal resolve and despair.', zh: '铸造它的工匠在完成的那夜自刎，剑身因此吸饱了凡人弑神的决心与绝望。' } },
];

export const ARMORS: ArmorDef[] = [
  { id: 'leather_vest', n: { en: 'Leather Vest', zh: '皮甲' }, r: 0, d: 1, ch: '▦', subType: 'leather',
    flavor: { en: 'Coarse-tanned from cave bison hide, its reek never fades; it is the only protection the poor can afford on the way down.', zh: '用洞穴野牛皮粗鞣而成，腥味难除，却是穷苦下山者唯一负担得起的护身之物。' } },
  { id: 'chain_mail', n: { en: 'Chain Mail', zh: '锁子甲' }, r: 0, d: 2, ch: '#', subType: 'scale',
    flavor: { en: 'Thousands of rings hand-joined, heavy and stifling; each ring, they say, cost an apprentice his sight at the forge.', zh: '数千枚铁环手工编就，重而闷热，相传每一环都由一名学徒在炉前耗尽视力。' } },
  { id: 'iron_plate', n: { en: 'Iron Plate', zh: '铁甲' }, r: 1, d: 4, ch: '▣', subType: 'plate',
    flavor: { en: 'Mass-produced heavy iron plate; the dull note it makes when struck tells veterans whether a comrade is still on his feet.', zh: '量产的厚重铁板，被击中时声音沉闷，老兵凭那声响就能判断同伴是否还站着。' } },
  { id: 'steel_armor', n: { en: 'Steel Armor', zh: '钢甲' }, r: 1, d: 5, ch: '▣', subType: 'plate',
    flavor: { en: 'Carbon-hardened steel, lighter and tougher than iron; the regulars\' crest is branded on the breast, and rarely saves its wearer.', zh: '经过渗碳淬火的钢板比铁更硬也更轻，正规军的徽记常烙在胸口，鲜能保住主人。' } },
  { id: 'mithril_mail', n: { en: 'Mithril Mail', zh: '秘银甲' }, r: 2, d: 7, ch: '#', subType: 'scale',
    flavor: { en: 'Rings forged of mithril drawn from the dwarves\' deep wells—weightless, and cold blue under the moon.', zh: '矮人深井里采得的秘银锻成的锁环，轻若无物，月光下泛着清冷的蓝。' } },
  { id: 'dragon_scale', n: { en: 'Dragon Scale', zh: '龙鳞甲' }, r: 2, d: 8, ch: '◆', subType: 'scale',
    flavor: { en: 'Sewn from scales shed by an adult ancient dragon; each scale still holds a spark of unquenchable hate.', zh: '以成年古龙脱落的鳞片缝缀而成，每片鳞都残留着一段无法熄灭的恨意。' } },
  { id: 'shadow_cloak', n: { en: 'Shadow Cloak', zh: '暗影斗篷' }, r: 3, d: 10, ch: '≈', subType: 'cloak',
    flavor: { en: 'Woven from shadow-spider silk, it makes its wearer near-invisible in the dark; those who wear it long can no longer find their own shadow.', zh: '织自影蛛之丝的斗篷，穿戴者在黑暗中几近隐形，长久披挂后却再难照见自己的影子。' } },
  { id: 'celestial_plate', n: { en: 'Celestial Plate', zh: '天界甲' }, r: 4, d: 14, ch: '▣', subType: 'plate',
    flavor: { en: 'Said to be cast from the relics of a fallen saint; the celestial sigils on its face still glow, faintly, even in corrupted ground.', zh: '据说是坠落圣徒的遗骸熔铸，甲面铭刻的天界符文在腐化之地仍微微发光。' } },
];

export const ACCESSORIES: AccessoryDef[] = [
  { id: 'copper_ring', n: { en: 'Copper Ring', zh: '铜戒指' }, r: 0, a: 1, d: 0, h: 0, ch: '○', subType: 'ring',
    flavor: { en: 'A cheap ring thrown off by the village coppersmith; descenders wear it as a charm, but it is only a poor man\'s comfort.', zh: '村庄铜匠随手打造的廉价戒指，常被下山者当作护身符，其实只是穷人的心理安慰。' } },
  { id: 'iron_amulet', n: { en: 'Iron Amulet', zh: '铁护符' }, r: 0, a: 0, d: 1, h: 5, ch: '✝', subType: 'amulet',
    flavor: { en: 'A ward-iron chip worn by miners; said to turn aside the death-breath of a cave-in, though no one has lived to confirm it.', zh: '矿工们佩戴的避邪铁片，据说能挡住一次洞穴塌方的死气，谁也没法证实。' } },
  { id: 'ruby_ring', n: { en: 'Ruby Ring', zh: '红宝石戒指' }, r: 1, a: 2, d: 0, h: 0, ch: '○', subType: 'ring',
    flavor: { en: 'The stone is red as clotted blood; it belonged to a countess who loved torture, and her screams, they say, are sealed inside.', zh: '戒面红石色泽如凝固的鲜血，传说曾属于一位以酷刑为乐的伯爵夫人，她的尖叫仍封存石中。' } },
  { id: 'sapphire_pendant', n: { en: 'Sapphire Pendant', zh: '蓝宝石吊坠' }, r: 1, a: 0, d: 2, h: 10, ch: '◇', subType: 'amulet',
    flavor: { en: 'A deep-sea sapphire set in silver; wearers breathe underwater in their dreams, and wake always tasting salt.', zh: '深海打捞而得的蓝宝嵌于银托，传说佩戴者能在梦中呼吸水下，醒来却总带着咸味。' } },
  { id: 'emerald_brooch', n: { en: 'Emerald Brooch', zh: '翡翠胸针' }, r: 2, a: 2, d: 2, h: 15, ch: '✿', subType: 'brooch',
    flavor: { en: 'The last treasure an elven exile carried from court; its green holds an echo of home that makes all who see it yearn.', zh: '精灵宫廷流亡者带出的最后一件珍宝，绿意中藏着故园的回响，见了它的人都会思乡。' } },
  { id: 'crown_of_flames', n: { en: 'Crown of Flames', zh: '火焰王冠' }, r: 3, a: 4, d: 2, h: 20, ch: '♛', subType: 'crown',
    flavor: { en: 'A gilded crown left by a tyrant who burned his city; its crest is hot to this day, and wearers dream of raining fire.', zh: '一位焚城暴君遗落的金冠，顶端的火焰纹至今烫手，戴上它的人梦境里总下着火雨。' } },
  { id: 'ring_of_void', n: { en: 'Ring of the Void', zh: '虚空之戒' }, r: 4, a: 5, d: 5, h: 30, ch: '○', subType: 'ring',
    flavor: { en: 'The band casts no reflection, as if a piece of reality had been scooped away; staring at it brings a faint sense of falling.', zh: '戒环上没有任何反光，仿佛被挖去了一小块现实，凝视久了会感到一阵轻微的下坠。' } },
];

export const POTIONS: PotionDef[] = [
  { id: 'heal_potion', n: { en: 'Health Potion', zh: '生命药水' }, ef: 'heal', v: 20, c: '#e63946', ch: '♥',
    flavor: { en: 'A red brew simmered by herbalists under the moon; the most common bottle on a descender\'s hip, and the one most often drunk too late.', zh: '由草药医师在月夜下熬制的红色药水，是下山者腰间最常见的瓶子，也是最常被来不及喝下的那瓶。' } },
  { id: 'greater_heal_potion', n: { en: 'Greater Health Potion', zh: '高级生命药水' }, ef: 'heal', v: 50, c: '#ff6b6b', ch: '♥',
    flavor: { en: 'A thick elixir hoarded by the alchemists\' guild, dark as arterial blood; the recipe, it is said, calls for a unicorn\'s tear.', zh: '炼金公会秘藏的浓稠药液，颜色深如动脉之血，传闻其方需以独角兽之泪作引。' } },
  { id: 'mana_potion', n: { en: 'Mana Potion', zh: '魔力药水' }, ef: 'mana', v: 15, c: '#4895ef', ch: '✦',
    flavor: { en: 'Crystal magic dissolved in snowmelt; drinking it numbs the tongue and sends a brief hum across the ears.', zh: '将晶体魔力溶于雪水所得的蓝色药剂，饮下时舌根发麻，耳边会掠过短暂的嗡鸣。' } },
  { id: 'greater_mana_potion', n: { en: 'Greater Mana Potion', zh: '高级魔力药水' }, ef: 'mana', v: 35, c: '#7ec8e3', ch: '✦',
    flavor: { en: 'A forbidden formula dense with aether; frost clings to the bottle year-round, and immoderate drinkers find their fingertips turning clear.', zh: '以太浓度极高的禁方药剂，瓶壁上常年凝着霜花，过量饮用会让指尖逐渐透明。' } },
  { id: 'strength_elixir', n: { en: 'Strength Elixir', zh: '力量药剂' }, ef: 'str_buff', v: 3, c: '#f4845f', ch: '↑', dur: 30,
    flavor: { en: 'An orange brew cut with beast\'s blood and ground rage-root; the veins stand out under the skin for hours after.', zh: '掺入野兽心血与磨碎的烈根草的橙黄药水，饮后血管会在皮下暴起数时辰。' } },
  { id: 'iron_skin_potion', n: { en: 'Iron Skin Potion', zh: '铁皮药剂' }, ef: 'def_buff', v: 3, c: '#7ec8e3', ch: '■', dur: 30,
    flavor: { en: 'A folk recipe miners use to survive a cave-in; it leaves the skin tough as tanned hide, but slows the heart.', zh: '矿工传统中用来硬撑过塌方的民间配方，喝下后皮肤粗糙如鞣皮，却也让心跳变得迟钝。' } },
  { id: 'restoration_potion', n: { en: 'Potion of Restoration', zh: '恢复药水' }, ef: 'restore', v: 0, c: '#ffd700', ch: '✚',
    flavor: { en: 'A clear golden antidote first brewed by an ancient order for the cursed; for a moment after drinking, the world goes still.', zh: '金色透明的中和剂，据说是远古教团为受咒者调制的解药，喝下后世界会安静片刻。' } },
  { id: 'poison_bottle', n: { en: 'Poison', zh: '毒药' }, ef: 'poison', v: 10, c: '#32cd32', ch: '☠',
    flavor: { en: 'A vivid green from the swamp-witch\'s hut; a sweet reek drifts from the uncorked neck, and a drop lays an ox quietly down.', zh: '来自沼泽巫婆的翠绿毒液，瓶口常年飘着一缕甜腥气，一滴足以让一头牛安静地倒下。' } },
];

export const SCROLLS: ScrollDef[] = [
  { id: 'fireball_scroll', n: { en: 'Scroll of Fireball', zh: '火球术卷轴' }, ef: 'fireball', v: 25, c: '#f4845f', ch: '☀', subType: 'fire',
    flavor: { en: 'The fire school\'s first incantation; warm parchment, ink of brimstone and charred agave, and letters that catch as you read.', zh: '火元素学派的入门咒文，纸面温热，墨迹中混着硫磺与龙舌兰的焦香，朗读时字迹会燃起。' } },
  { id: 'lightning_scroll', n: { en: 'Scroll of Lightning', zh: '闪电术卷轴' }, ef: 'lightning', v: 30, c: '#ffd700', ch: '⚡', subType: 'arcane',
    flavor: { en: 'A short charm of the storm school; the scroll is left blank, for the true words appear only on a thunderous night.', zh: '风暴学派的短咒，卷轴上留着空白，因为真正的咒文只在雷雨夜才会显形。' } },
  { id: 'teleport_scroll', n: { en: 'Scroll of Teleport', zh: '传送卷轴' }, ef: 'teleport', v: 0, c: '#9b5de5', ch: '↻', subType: 'arcane',
    flavor: { en: 'A displacement charm circulated by the spatialists\' guild; most of its former owners, it is said, did not arrive entirely.', zh: '空间法师公会流传的位移咒，据说前主人大多没能完整地传送到目的地。' } },
  { id: 'mapping_scroll', n: { en: 'Scroll of Mapping', zh: '地图卷轴' }, ef: 'mapping', v: 0, c: '#4895ef', ch: '▦', subType: 'arcane',
    flavor: { en: 'The cartographers\' guild pathfinding charm; unrolled, it sketches the layout of the surrounding halls—though never the traps.', zh: '制图师公会的探路咒文，展开时会自行勾勒出周围的格局，却从不标出陷阱所在。' } },
  { id: 'shield_scroll', n: { en: 'Scroll of Shield', zh: '护盾卷轴' }, ef: 'shield', v: 5, c: '#7ec8e3', ch: '◈', subType: 'arcane', dur: 30,
    flavor: { en: 'A ward from the protective school; once read, an unseen field circles the caster with a faint, persistent hum.', zh: '守护学派的防御咒文，朗读完毕后，一段无形的力场会环绕施法者，发出极轻的嗡鸣。' } },
  { id: 'fear_scroll', n: { en: 'Scroll of Fear', zh: '恐惧卷轴' }, ef: 'fear', v: 0, c: '#aaa', ch: '☾', subType: 'arcane',
    flavor: { en: 'A forbidden text of the shadow school; its grey ink writhes under moonlight, and after the reading, nearby creatures shrink back by instinct.', zh: '暗影学派的禁忌咒文，灰黑墨迹在月光下会蠕动，朗读后附近生灵都会本能地退却。' } },
];

export const CONSUMABLES: ConsumableDef[] = [
  { id: 'bomb', n: { en: 'Bomb', zh: '炸弹' }, ef: 'bomb', v: 30, c: '#ff4500', ch: '*', subType: 'bomb', r: 1, desc: { en: 'AoE fire dmg to nearby foes', zh: '对附近敌人造成范围火焰伤害' },
    flavor: { en: 'A spherical powder pot from the dwarven powder-makers; its fuse burns damp, and has unseated a hundred siege-walls.', zh: '矮人爆破匠量产的球形火药罐，引信潮湿地燃烧，曾在无数次围城中掀开城墙。' } },
  { id: 'throwing_knife', n: { en: 'Throwing Knife', zh: '飞刀' }, ef: 'throw_knife', v: 20, c: '#c0c0c0', ch: '†', subType: 'tool', r: 0, desc: { en: 'Throw at nearest enemy', zh: '投向最近的敌人' },
    flavor: { en: 'A well-balanced throwing knife, the grip wound with thread for easy pulling; the silent opening of partisans and fleeing men.', zh: '平衡精准的轻掷刀，刀柄缠线以利拔出，是游击手与逃亡者无声的开场白。' } },
  { id: 'purified_water', n: { en: 'Purified Water', zh: '净水' }, ef: 'purify', v: 20, c: '#7ec8e3', ch: '💧', subType: 'pouch', r: 1, desc: { en: 'Cleanses 20 corruption', zh: '净化 20 腐化' },
    flavor: { en: 'Water blessed by the order; it briefly rinses the corruption from the soul, and a thin ring of light clings to the flask\'s inner wall.', zh: '教团祝圣过的清水，能短暂洗去灵魂上的腐化，瓶壁内侧凝着一圈极细的光环。' } },
  { id: 'torch', n: { en: 'Torch', zh: '火把' }, ef: 'torch', v: 5, c: '#f4845f', ch: '☀', subType: 'tool', r: 0, desc: { en: '+5 FOV for 30 turns', zh: '视野+5持续30回合' }, dur: 30,
    flavor: { en: 'A coarse hemp torch dipped in pitch; the plainest answer to the dark below, and the only company when loneliness sets in.', zh: '浸过松脂的粗麻火把，是下山者对抗黑暗的最朴素的手段，也是孤独时唯一的伴侣。' } },
  { id: 'bear_trap', n: { en: 'Bear Trap', zh: '捕兽夹' }, ef: 'bear_trap', v: 20, c: '#a0522d', ch: '▲', subType: 'trap', r: 0, desc: { en: 'Place trap on ground', zh: '在地面放置陷阱' },
    flavor: { en: 'An iron-jaw trap a hunter left at the wood\'s edge; the rust has not dulled the teeth, and what it holds rarely keeps the whole leg.', zh: '猎人遗落在林边的铁齿陷阱，锈迹未掩其锋利，被它咬住的猎物很少能留下全腿。' } },
  { id: 'smoke_bomb', n: { en: 'Smoke Bomb', zh: '烟雾弹' }, ef: 'smoke_bomb', v: 0, c: '#888', ch: '○', subType: 'bomb', r: 1, desc: { en: 'Fear nearby enemies', zh: '恐惧附近的敌人' },
    flavor: { en: 'A small clay pot adapted from Eastern firework-craft; it bursts into thick grey smoke—the parting gift of thieves and assassins.', zh: '改良自东方烟火术的小型陶罐，裂开后涌出浓密灰烟，是盗贼与刺客最爱的告别礼。' } },
  { id: 'ward_stone', n: { en: 'Ward Stone', zh: '护身石' }, ef: 'ward', v: 0, c: '#4895ef', ch: '◆', subType: 'tool', r: 1, desc: { en: 'Block next hit completely', zh: '完全抵挡下一次攻击' },
    flavor: { en: 'A blue cobble carved thick with old wards; warm in the palm, said to step between its holder and a single killing blow.', zh: '刻满古老护符的蓝卵石，握在掌心会微微发暖，据说能在致命一击来临前替主人挡下。' } },
  { id: 'haste_potion', n: { en: 'Haste Potion', zh: '加速药水' }, ef: 'haste', v: 0, c: '#06d6a0', ch: '»', subType: 'pouch', r: 1, desc: { en: 'Take a free extra turn', zh: '获得一次免费额外行动' },
    flavor: { en: 'A green brew cut from a wind-sylph\'s core; after drinking, the world seems to slow while the heartbeat runs frighteningly fast.', zh: '以风精之核调成的青绿药水，饮下后周遭一切仿佛放缓，唯有自己的心跳快得惊人。' } },
  { id: 'antidote', n: { en: 'Antidote', zh: '解毒剂' }, ef: 'antidote', v: 0, c: '#80ed99', ch: '✦', subType: 'pouch', r: 0, desc: { en: 'Cure poison + resist', zh: '治愈中毒并获得抗性' },
    flavor: { en: 'A general antidote the herbalists have refined for generations; bitter to the throat, but it breaks a poison before venom reaches the heart.', zh: '草药师代代改良的通用解毒方，味苦难咽，却能在毒素尚未咬透心脉之前将其化解。' } },
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
  { n: { en: 'Rat', zh: '老鼠' }, ch: 'r', c: '#a0522d', hp: 8, atk: 2, def: 0, exp: 5, g: [1, 3], ai: 'wander', mf: 1, tags: ['rodent'] },
  { n: { en: 'Bat', zh: '蝙蝠' }, ch: 'b', c: '#696969', hp: 6, atk: 3, def: 0, exp: 5, g: [1, 2], ai: 'erratic', mf: 1, tags: ['bat'] },
  { n: { en: 'Goblin', zh: '哥布林' }, ch: 'g', c: '#228b22', hp: 12, atk: 4, def: 1, exp: 8, g: [2, 6], ai: 'chase', mf: 1 },
  { n: { en: 'Slime', zh: '史莱姆' }, ch: 's', c: '#32cd32', hp: 15, atk: 2, def: 3, exp: 6, g: [1, 4], ai: 'wander', mf: 1, tags: ['slime'] },
  // === New: early-mid fill (mf 2-14) ===
  { n: { en: 'Mushroom', zh: '毒蘑菇' }, ch: 'm', c: '#8b4513', hp: 8, atk: 3, def: 2, exp: 6, g: [1, 3], ai: 'wander', mf: 2, tags: ['fungi'] },
  { n: { en: 'Cave Fish', zh: '洞穴鱼' }, ch: 'f', c: '#4682b4', hp: 10, atk: 4, def: 1, exp: 7, g: [2, 5], ai: 'erratic', mf: 3, tags: ['aquatic'] },
  { n: { en: 'Kobold', zh: '狗头人' }, ch: 'k', c: '#cd853f', hp: 16, atk: 5, def: 2, exp: 10, g: [3, 8], ai: 'erratic', mf: 3 },
  // === Original enemies continued ===
  { n: { en: 'Skeleton', zh: '骷髅' }, ch: '☠', c: '#dcdcdc', hp: 18, atk: 6, def: 2, exp: 12, g: [3, 8], ai: 'chase', mf: 2, tags: ['undead'] },
  { n: { en: 'Spider', zh: '蜘蛛' }, ch: 'ψ', c: '#4b0082', hp: 14, atk: 8, def: 1, exp: 10, g: [2, 5], ai: 'ambush', mf: 2, tags: ['insect'] },
  { n: { en: 'Orc', zh: '兽人' }, ch: 'o', c: '#8b0000', hp: 25, atk: 7, def: 3, exp: 15, g: [5, 12], ai: 'chase', mf: 3, tags: ['brute'] },
  // === New: mid fill ===
  { n: { en: 'Wolf', zh: '灰狼' }, ch: 'ω', c: '#7a8890', hp: 18, atk: 7, def: 2, exp: 12, g: [3, 8], ai: 'chase', mf: 4, tags: ['hound'] },
  { n: { en: 'Cultist', zh: '邪教徒' }, ch: '☼', c: '#5c2d91', hp: 20, atk: 9, def: 2, exp: 18, g: [6, 15], ai: 'ranged', mf: 5, el: 'shadow', tags: ['cultist'], skill: { name: { en: 'Shadow Ritual', zh: '暗影仪式' }, effect: 'dmg_bolt', chance: 0.4, cd: 4, dmg: 1.6, range: 5, el: 'shadow' } },
  // === Original continued ===
  { n: { en: 'Wraith', zh: '幽灵' }, ch: 'Ω', c: '#9370db', hp: 20, atk: 10, def: 3, exp: 20, g: [5, 15], ai: 'phase', mf: 4, tags: ['spirit', 'undead'], skill: { name: { en: 'Chill Grasp', zh: '寒灵之握' }, effect: 'debuff_slow', chance: 0.35, cd: 5, aoe: 3, range: 4 } },
  { n: { en: 'Ogre', zh: '食人魔' }, ch: 'Θ', c: '#daa520', hp: 40, atk: 12, def: 4, exp: 25, g: [8, 20], ai: 'chase', mf: 5, tags: ['brute'] },
  { n: { en: 'Dark Mage', zh: '暗黑法师' }, ch: '☾', c: '#800080', hp: 22, atk: 14, def: 2, exp: 22, g: [10, 25], ai: 'ranged', mf: 4, tags: ['mage'], skill: { name: { en: 'Shadow Bolt', zh: '暗影箭' }, effect: 'dmg_bolt', chance: 0.4, cd: 4, dmg: 1.8, range: 6, el: 'shadow' } },
  // === New: mid-upper ===
  { n: { en: 'Harpy', zh: '鹰身女妖' }, ch: '♀', c: '#c4a040', hp: 22, atk: 10, def: 3, exp: 20, g: [5, 14], ai: 'erratic', mf: 6, tags: ['beast'] },
  { n: { en: 'Mimic', zh: '宝箱怪' }, ch: '=', c: '#ffd700', hp: 30, atk: 12, def: 4, exp: 28, g: [10, 25], ai: 'ambush', mf: 7 },
  { n: { en: 'Wyvern', zh: '双足飞龙' }, ch: 'Δ', c: '#2e8b57', hp: 45, atk: 14, def: 5, exp: 35, g: [12, 28], ai: 'ranged', mf: 8, el: 'fire', tags: ['dragon'], skill: { name: { en: 'Fire Breath', zh: '烈焰吐息' }, effect: 'dmg_aoe', chance: 0.35, cd: 5, dmg: 1.3, aoe: 2, range: 5, el: 'fire' } },
  { n: { en: 'Dark Knight', zh: '暗黑骑士' }, ch: '♞', c: '#3a6060', hp: 55, atk: 16, def: 8, exp: 42, g: [15, 35], ai: 'chase', mf: 9, el: 'shadow', tags: ['knight'] },
  // === Original continued ===
  { n: { en: 'Troll', zh: '巨魔' }, ch: 'Π', c: '#556b2f', hp: 50, atk: 14, def: 6, exp: 35, g: [12, 30], ai: 'chase', mf: 7, tags: ['brute'] },
  { n: { en: 'Vampire', zh: '吸血鬼' }, ch: '♠', c: '#b91c3c', hp: 35, atk: 16, def: 5, exp: 40, g: [15, 35], ai: 'lifesteal', mf: 7, tags: ['undead'] },
  { n: { en: 'Golem', zh: '魔像' }, ch: '◘', c: '#808080', hp: 60, atk: 12, def: 10, exp: 38, g: [10, 25], ai: 'chase', mf: 8, tags: ['construct'] },
  { n: { en: 'Lich', zh: '巫妖' }, ch: 'Ψ', c: '#9400d3', hp: 45, atk: 20, def: 8, exp: 55, g: [20, 50], ai: 'ranged', mf: 10, tags: ['mage', 'undead'], skill: { name: { en: 'Death Cloud', zh: '死亡之云' }, effect: 'dmg_aoe', chance: 0.35, cd: 5, dmg: 1.3, aoe: 2, el: 'shadow' } },
  { n: { en: 'Demon', zh: '恶魔' }, ch: 'φ', c: '#ff4500', hp: 55, atk: 22, def: 7, exp: 60, g: [25, 60], ai: 'chase', mf: 10, tags: ['demon'] },
  { n: { en: 'Necromancer', zh: '死灵法师' }, ch: '☽', c: '#6a0dad', hp: 35, atk: 18, def: 4, exp: 45, g: [15, 40], ai: 'summon', mf: 10, el: 'shadow', tags: ['mage'], skill: { name: { en: 'Enfeeble', zh: '衰弱术' }, effect: 'debuff_weaken', chance: 0.35, cd: 5, dmg: 6, aoe: 3, el: 'shadow' } },
  { n: { en: 'Dragon Whelp', zh: '幼龙' }, ch: 'δ', c: '#ff6347', hp: 65, atk: 18, def: 10, exp: 50, g: [30, 70], ai: 'ranged', mf: 11, tags: ['dragon'], skill: { name: { en: 'Firebolt', zh: '龙息弹' }, effect: 'dmg_bolt', chance: 0.4, cd: 4, dmg: 1.7, range: 5 } },
  { n: { en: 'Ancient Dragon', zh: '远古巨龙' }, ch: 'Λ', c: '#ff0000', hp: 80, atk: 25, def: 12, exp: 80, g: [40, 100], ai: 'ranged', mf: 14, tags: ['dragon'], skill: { name: { en: 'Ancient Breath', zh: '远古龙息' }, effect: 'dmg_aoe', chance: 0.35, cd: 5, dmg: 1.6, aoe: 3, range: 6 } },
  { n: { en: 'Death Knight', zh: '死亡骑士' }, ch: 'Ξ', c: '#191970', hp: 70, atk: 28, def: 14, exp: 75, g: [35, 80], ai: 'chase', mf: 14, tags: ['knight', 'undead'] },
  // === New: Dark Fortress (mf 16-19) — 填 F12-25 断层 ===
  { n: { en: 'Castellan', zh: '铁卫统领' }, ch: '♝', c: '#4a5a6a', hp: 95, atk: 26, def: 16, exp: 70, g: [25, 55], ai: 'chase', mf: 16, tags: ['knight'] },
  { n: { en: 'Gargoyle', zh: '石化魔像' }, ch: 'Γ', c: '#708090', hp: 85, atk: 30, def: 12, exp: 75, g: [20, 50], ai: 'ambush', mf: 17, tags: ['construct'] },
  { n: { en: 'Crypt Summoner', zh: '地穴召唤师' }, ch: 'ψ', c: '#7b68ee', hp: 80, atk: 26, def: 8, exp: 78, g: [25, 55], ai: 'ranged', mf: 17, tags: ['caster'], skill: { name: { en: 'Raise Dead', zh: '亡者苏生' }, effect: 'summon', chance: 0.25, cd: 7, range: 6 } },
  { n: { en: 'Inquisitor', zh: '圣裁官' }, ch: '✠', c: '#d4af37', hp: 75, atk: 32, def: 8, exp: 80, g: [30, 60], ai: 'ranged', mf: 18, el: 'holy', tags: ['cultist'], skill: { name: { en: 'Judgement', zh: '审判' }, effect: 'debuff_weaken', chance: 0.35, cd: 5, dmg: 8, aoe: 3, range: 6, el: 'holy' } },
  { n: { en: 'Siege Golem', zh: '破城巨像' }, ch: '◍', c: '#696969', hp: 125, atk: 34, def: 15, exp: 85, g: [35, 70], ai: 'chase', mf: 19, tags: ['construct'] },
  // === New: Dragon's Domain (mf 21-25) ===
  { n: { en: 'Pyro Drake', zh: '烈焰飞龙' }, ch: '¤', c: '#ff6347', hp: 115, atk: 34, def: 12, exp: 95, g: [40, 80], ai: 'ranged', mf: 21, el: 'fire', tags: ['dragon'], skill: { name: { en: 'Pyro Breath', zh: '烈焰龙息' }, effect: 'dmg_aoe', chance: 0.35, cd: 5, dmg: 1.5, aoe: 3, range: 6, el: 'fire' } },
  { n: { en: 'Drake Zealot', zh: '龙血信徒' }, ch: '☧', c: '#8b0000', hp: 95, atk: 30, def: 10, exp: 90, g: [30, 65], ai: 'summon', mf: 22, tags: ['cultist'], skill: { name: { en: 'Frenzy', zh: '狂热' }, effect: 'buff', chance: 0.3, cd: 6, dmg: 6, aoe: 4 } },
  { n: { en: 'Magma Behemoth', zh: '熔岩巨兽' }, ch: '●', c: '#ff4500', hp: 135, atk: 32, def: 16, exp: 100, g: [40, 85], ai: 'chase', mf: 23, el: 'fire', tags: ['elemental'], skill: { name: { en: 'Eruption', zh: '熔岩喷发' }, effect: 'dmg_aoe', chance: 0.35, cd: 5, dmg: 1.5, aoe: 2, range: 2, el: 'fire' } },
  { n: { en: 'Drakeborn Knight', zh: '龙裔骑士' }, ch: '†', c: '#b22222', hp: 115, atk: 38, def: 14, exp: 110, g: [45, 90], ai: 'chase', mf: 24, tags: ['knight'], skill: { name: { en: 'Dragon Bash', zh: '龙裔盾击' }, effect: 'debuff_stun', chance: 0.25, cd: 5, aoe: 1, range: 1 } },
  { n: { en: 'Storm Wraith', zh: '雷霆怨灵' }, ch: '⚡', c: '#4682b4', hp: 100, atk: 36, def: 10, exp: 100, g: [40, 80], ai: 'ranged', mf: 25, el: 'lightning', tags: ['spirit'], skill: { name: { en: 'Storm Burst', zh: '雷霆爆裂' }, effect: 'dmg_aoe', chance: 0.35, cd: 5, dmg: 1.4, aoe: 3, range: 6, el: 'lightning' } },
  // === New: The Abyss (mf 26-30) ===
  { n: { en: 'Abyssal Jellyfish', zh: '深海水母' }, ch: '∞', c: '#00ced1', hp: 70, atk: 20, def: 6, exp: 55, g: [20, 50], ai: 'wander', mf: 26, el: 'ice', tags: ['aquatic'] },
  { n: { en: 'Deep One', zh: '深潜者' }, ch: 'Σ', c: '#006400', hp: 85, atk: 24, def: 10, exp: 70, g: [25, 60], ai: 'chase', mf: 26, tags: ['aquatic'] },
  { n: { en: 'Deep Mender', zh: '深渊修补者' }, ch: '⚕', c: '#20b2aa', hp: 90, atk: 22, def: 8, exp: 75, g: [25, 55], ai: 'ranged', mf: 26, tags: ['aquatic'], skill: { name: { en: 'Mending Tide', zh: '修补潮汐' }, effect: 'heal', chance: 0.35, cd: 4, dmg: 1.2, range: 7 } },
  { n: { en: 'Void Leech', zh: '虚空水蛭' }, ch: 'λ', c: '#483d8b', hp: 60, atk: 22, def: 5, exp: 50, g: [15, 45], ai: 'lifesteal', mf: 27, el: 'shadow', tags: ['aberration'] },
  { n: { en: 'Coral Golem', zh: '珊瑚魔像' }, ch: 'Φ', c: '#ff7f50', hp: 110, atk: 18, def: 18, exp: 75, g: [30, 65], ai: 'chase', mf: 28, tags: ['construct'] },
  { n: { en: 'Siren', zh: '塞壬' }, ch: '♪', c: '#ff69b4', hp: 65, atk: 28, def: 6, exp: 65, g: [25, 55], ai: 'ranged', mf: 29, el: 'ice', tags: ['aquatic'], skill: { name: { en: 'Luring Song', zh: '诱惑之歌' }, effect: 'debuff_slow', chance: 0.4, cd: 5, aoe: 3, range: 6, el: 'ice' } },
  { n: { en: 'Kraken Spawn', zh: '克拉肯幼体' }, ch: 'κ', c: '#1a237e', hp: 120, atk: 30, def: 12, exp: 90, g: [40, 80], ai: 'chase', mf: 30, el: 'ice', tags: ['aquatic'] },
  // === New: Void Realm (mf 31-35) ===
  { n: { en: 'Void Wraith', zh: '虚空幽灵' }, ch: 'ξ', c: '#8a2be2', hp: 100, atk: 32, def: 8, exp: 80, g: [30, 70], ai: 'phase', mf: 31, el: 'shadow', tags: ['spirit'], skill: { name: { en: 'Void Poison', zh: '虚空之毒' }, effect: 'debuff_poison', chance: 0.35, cd: 5, dmg: 4, aoe: 4, el: 'shadow' } },
  { n: { en: 'Chaos Elemental', zh: '混沌元素' }, ch: 'χ', c: '#ff1493', hp: 90, atk: 35, def: 6, exp: 85, g: [35, 75], ai: 'erratic', mf: 32, tags: ['elemental'], skill: { name: { en: 'Chaos Burst', zh: '混沌爆裂' }, effect: 'dmg_aoe', chance: 0.4, cd: 4, dmg: 1.5, aoe: 3, range: 4 } },
  { n: { en: 'Rift Stalker', zh: '裂隙猎手' }, ch: 'τ', c: '#800080', hp: 110, atk: 30, def: 14, exp: 90, g: [40, 80], ai: 'teleport', mf: 33, el: 'shadow', tags: ['aberration'] },
  { n: { en: 'Void Mage', zh: '虚空法师' }, ch: 'υ', c: '#7b2fbe', hp: 80, atk: 40, def: 8, exp: 100, g: [45, 90], ai: 'ranged', mf: 34, el: 'shadow', tags: ['mage'], skill: { name: { en: 'Void Burst', zh: '虚空爆裂' }, effect: 'dmg_aoe', chance: 0.4, cd: 5, dmg: 1.6, aoe: 3, range: 6, el: 'shadow' } },
  { n: { en: 'Reality Shard', zh: '现实碎片' }, ch: '◊', c: '#e0e0ff', hp: 130, atk: 28, def: 20, exp: 95, g: [35, 75], ai: 'wander', mf: 35, tags: ['aberration'], skill: { name: { en: 'Splinter', zh: '裂解' }, effect: 'debuff_weaken', chance: 0.35, cd: 5, dmg: 6, aoe: 3, range: 5 } },
  // === New: The Final Sanctum (mf 36-40) ===
  { n: { en: 'Seraphim', zh: '炽天使' }, ch: '☀', c: '#ffd700', hp: 140, atk: 38, def: 16, exp: 110, g: [50, 100], ai: 'chase', mf: 36, el: 'holy', tags: ['seraph'], skill: { name: { en: 'Holy Lance', zh: '圣光矛' }, effect: 'dmg_bolt', chance: 0.35, cd: 5, dmg: 1.8, range: 5, el: 'holy' } },
  { n: { en: 'Fallen Seraph', zh: '堕落炽天使' }, ch: '✝', c: '#8b0000', hp: 150, atk: 42, def: 14, exp: 120, g: [55, 110], ai: 'chase', mf: 37, el: 'shadow', tags: ['seraph', 'undead', 'demon'], skill: { name: { en: 'Fallen Halo', zh: '堕落光晕' }, effect: 'dmg_aoe', chance: 0.35, cd: 5, dmg: 1.5, aoe: 3, range: 4, el: 'shadow' } },
  { n: { en: 'Void Blinker', zh: '虚空闪行者' }, ch: '∆', c: '#7df9ff', hp: 110, atk: 46, def: 8, exp: 105, g: [45, 90], ai: 'ambush', mf: 37, el: 'shadow', tags: ['spirit'], skill: { name: { en: 'Void Step', zh: '虚空步' }, effect: 'blink', chance: 0.3, cd: 3 } },
  { n: { en: 'Divine Golem', zh: '神圣魔像' }, ch: '⊕', c: '#c0c0c0', hp: 200, atk: 30, def: 25, exp: 130, g: [40, 90], ai: 'chase', mf: 38, el: 'holy', tags: ['construct'] },
  { n: { en: 'Cosmic Horror', zh: '宇宙恐怖' }, ch: '∇', c: '#1a0033', hp: 160, atk: 48, def: 12, exp: 150, g: [60, 120], ai: 'erratic', mf: 39, el: 'shadow', tags: ['aberration', 'demon'], skill: { name: { en: 'Mind Fracture', zh: '心智撕裂' }, effect: 'debuff_stun', chance: 0.25, cd: 5, aoe: 1 } },
  { n: { en: 'Archon', zh: '执政官' }, ch: '♔', c: '#ffffff', hp: 180, atk: 45, def: 18, exp: 160, g: [70, 140], ai: 'ranged', mf: 40, el: 'holy', tags: ['seraph'], skill: { name: { en: 'Holy Beam', zh: '圣光束' }, effect: 'dmg_bolt', chance: 0.4, cd: 5, dmg: 2.0, range: 7, el: 'holy' } },
  // === Wave 6b: 主题敌人填中段辨识度 ===
  { n: { en: 'Cave Beetle', zh: '洞穴甲虫' }, ch: '⬟', c: '#7a5230', hp: 14, atk: 5, def: 4, exp: 8, g: [2, 6], ai: 'ambush', mf: 2, tags: ['insect'] },
  { n: { en: 'Dire Bat', zh: '巨蝠' }, ch: '⬣', c: '#4a4a4a', hp: 12, atk: 6, def: 1, exp: 9, g: [3, 7], ai: 'erratic', mf: 3, tags: ['bat'] },
  { n: { en: 'Bone Pile', zh: '骸骨堆' }, ch: '≡', c: '#dcdcdc', hp: 45, atk: 8, def: 10, exp: 25, g: [8, 18], ai: 'ambush', mf: 7, tags: ['undead'] },
  { n: { en: 'Crypt Warden', zh: '墓穴守卫' }, ch: '☩', c: '#8a8a8a', hp: 55, atk: 16, def: 8, exp: 40, g: [14, 30], ai: 'chase', mf: 9, tags: ['undead'] },
  { n: { en: 'Fire Imp', zh: '火焰小妖' }, ch: 'æ', c: '#ff7847', hp: 50, atk: 16, def: 5, exp: 38, g: [12, 26], ai: 'erratic', mf: 12, el: 'fire', tags: ['demon'], skill: { name: { en: 'Fire Bolt', zh: '火焰箭' }, effect: 'dmg_bolt', chance: 0.45, cd: 3, dmg: 1.6, range: 5, el: 'fire' } },
  { n: { en: 'Magma Hound', zh: '熔岩犬' }, ch: 'Ð', c: '#b22222', hp: 70, atk: 18, def: 8, exp: 45, g: [15, 30], ai: 'chase', mf: 13, el: 'fire', tags: ['hound'] },
  { n: { en: 'Cinder Wraith', zh: '余烬怨灵' }, ch: '§', c: '#ff6347', hp: 60, atk: 22, def: 6, exp: 50, g: [18, 35], ai: 'phase', mf: 15, el: 'fire', tags: ['spirit'], skill: { name: { en: 'Cinder Burst', zh: '余烬爆裂' }, effect: 'dmg_aoe', chance: 0.35, cd: 5, dmg: 1.4, aoe: 2, range: 3, el: 'fire' } },
  { n: { en: 'Dread Legionnaire', zh: '恐惧军团兵' }, ch: '☨', c: '#5a5a6a', hp: 110, atk: 30, def: 14, exp: 85, g: [30, 60], ai: 'chase', mf: 18, el: 'shadow', tags: ['knight'], skill: { name: { en: 'Terrifying Slam', zh: '威慑猛击' }, effect: 'debuff_stun', chance: 0.25, cd: 5, aoe: 1, range: 1 } },
  // === Wave 6c: Fungal Hollow branch enemies (mf 0 = branch-only, excluded
  // from main-floor spawns by the mf>=1 filter in spawnEnemies). Stats tuned to
  // ~F8-15 tier; spawnBranchEnemies applies a 0.7x side-content multiplier.
  // Each carries a sprite-routing tag from pickEnemyTemplate's checked set
  // (language-independent). Playtest #10 reroutes these to the FUNGI/SLIME
  // templates: Brute→FUNGI, Spore Mother→FUNGI, Myconid→FUNGI, Fungal Knight→FUNGI, Glow Slime→SLIME.
  { n: { en: 'Mushroom Brute', zh: '菇蛮' }, ch: '♭', c: '#6a4a3a', hp: 70, atk: 16, def: 8, exp: 40, g: [12, 28], ai: 'chase', mf: 0, tags: ['fungi'] },
  { n: { en: 'Spore Mother', zh: '孢子之母' }, ch: '☂', c: '#5a8a5a', hp: 55, atk: 18, def: 5, exp: 45, g: [15, 30], ai: 'ranged', mf: 0, el: 'shadow', tags: ['fungi'], skill: { name: { en: 'Toxic Spores', zh: '毒孢子' }, effect: 'debuff_poison', chance: 0.4, cd: 4, dmg: 3, aoe: 3, el: 'shadow' } },
  { n: { en: 'Myconid', zh: '蕈人' }, ch: '♟', c: '#7a4a8a', hp: 50, atk: 15, def: 6, exp: 35, g: [10, 22], ai: 'chase', mf: 0, tags: ['fungi'] },
  { n: { en: 'Fungal Knight', zh: '菌骑' }, ch: '✟', c: '#8a7a6a', hp: 65, atk: 20, def: 10, exp: 50, g: [15, 35], ai: 'chase', mf: 0, el: 'shadow', tags: ['fungi', 'undead'] },
  { n: { en: 'Glow Slime', zh: '荧光史莱姆' }, ch: '◉', c: '#5fdf8a', hp: 60, atk: 12, def: 9, exp: 32, g: [8, 20], ai: 'wander', mf: 0, tags: ['slime'] },
  // === Wave 6d: Endless mode (F41+) — mf 40+ exclusive strong foes ===
  { n: { en: 'Void Titan', zh: '虚空泰坦' }, ch: '⊛', c: '#3a1a5a', hp: 220, atk: 48, def: 16, exp: 200, g: [60, 120], ai: 'chase', mf: 42, el: 'shadow', tags: ['aberration'] },
  { n: { en: 'Doom Seraph', zh: '末日炽天使' }, ch: '♰', c: '#b0b0ff', hp: 260, atk: 54, def: 14, exp: 240, g: [80, 140], ai: 'ranged', mf: 45, el: 'holy', tags: ['seraph', 'demon'], skill: { name: { en: 'Doom Aura', zh: '末日光环' }, effect: 'dmg_aoe', chance: 0.4, cd: 5, dmg: 1.7, aoe: 3, range: 6, el: 'holy' } },
  { n: { en: 'Entropy Beast', zh: '熵兽' }, ch: '✺', c: '#ff1493', hp: 300, atk: 58, def: 18, exp: 280, g: [90, 160], ai: 'erratic', mf: 48, el: 'shadow', tags: ['aberration'] },
  { n: { en: 'Abyssal Tyrant', zh: '深渊暴君' }, ch: '⛐', c: '#1a0033', hp: 380, atk: 64, def: 22, exp: 350, g: [120, 200], ai: 'chase', mf: 50, el: 'shadow', tags: ['demon'] },
];

export const BOSSES: BossDef[] = [
  { n: { en: 'Goblin King', zh: '哥布林王' }, ch: '♚', c: '#ffd700', hp: 60, atk: 10, def: 4, exp: 100, g: [50, 80], fl: 5, spriteKind: 'B_GOBLIN_KING',
    skill: { name: { en: 'King\'s Menace', zh: '王之威吓' }, effect: 'debuff_weaken', chance: 0.3, cd: 4, range: 5, dmg: 6 },
    summon: { chance: 0.4, cd: 3, maxAdds: 2, kind: 'Goblin' },
    phases: [{ hpThreshold: 0.4, atkM: 1.4, newAi: 'chase' }] },
  { n: { en: 'Spider Queen', zh: '蜘蛛女王' }, ch: '♛', c: '#8a2be2', hp: 90, atk: 14, def: 6, exp: 180, g: [70, 120], fl: 10, spriteKind: 'B_SPIDER_QUEEN',
    skill: { name: { en: 'Web Snare', zh: '蛛网束缚' }, effect: 'debuff_slow', chance: 0.35, cd: 4, range: 5, aoe: 3 },
    summon: { chance: 0.4, cd: 3, maxAdds: 2, kind: 'Spider' },
    phases: [{ hpThreshold: 0.5, atkM: 1.3, newAi: 'ambush' }] },
  { n: { en: 'Vampire Lord', zh: '吸血鬼领主' }, ch: '▼', c: '#dc143c', hp: 120, atk: 18, def: 8, exp: 280, g: [100, 180], fl: 15, el: 'shadow', spriteKind: 'B_VAMPIRE_LORD',
    skill: { name: { en: 'Shadow Bolt', zh: '暗影箭' }, effect: 'dmg_bolt', chance: 0.3, cd: 4, range: 6, dmg: 1.6, el: 'shadow' },
    summon: { chance: 0.5, cd: 3, maxAdds: 4, kind: 'Vampire' },
    phases: [{ hpThreshold: 0.5, atkM: 1.3, newAi: 'lifesteal' }] },
  { n: { en: 'Elder Lich', zh: '远古巫妖' }, ch: '☯', c: '#9932cc', hp: 150, atk: 22, def: 10, exp: 400, g: [150, 250], fl: 20, spriteKind: 'B_ELDER_LICH',
    skill: { name: { en: 'Necrotic Burst', zh: '死灵爆发' }, effect: 'dmg_aoe', chance: 0.3, cd: 5, range: 6, dmg: 1.3, aoe: 2 },
    summon: { chance: 0.4, cd: 3, maxAdds: 3, kind: 'Skeleton' },
    phases: [{ hpThreshold: 0.5, atkM: 1.4, newAi: 'ranged' }] },
  { n: { en: 'Dragon Emperor', zh: '龙皇' }, ch: '♜', c: '#ff8c00', hp: 200, atk: 28, def: 14, exp: 600, g: [250, 500], fl: 25, el: 'fire', spriteKind: 'B_DRAGON_EMPEROR',
    skill: { name: { en: 'Dragon Breath', zh: '龙息' }, effect: 'dmg_bolt', chance: 0.35, cd: 4, range: 6, dmg: 1.7, el: 'fire' },
    summon: { chance: 0.35, cd: 4, maxAdds: 2, kind: 'Dragon Whelp' },
    phases: [{ hpThreshold: 0.3, atkM: 1.6, newAi: 'chase', newEl: 'fire' }] },
  // === New bosses ===
  { n: { en: 'Leviathan', zh: '利维坦' }, ch: '≈', c: '#00ced1', hp: 280, atk: 35, def: 14, exp: 800, g: [200, 400], fl: 30, el: 'ice', spriteKind: 'B_LEVIATHAN',
    skill: { name: { en: 'Abyssal Call', zh: '深渊呼唤' }, effect: 'summon', chance: 0.3, cd: 6, range: 6 },
    phases: [
      { hpThreshold: 0.5, atkM: 1.5, newAi: 'chase' },
    ] },
  { n: { en: 'Void Sovereign', zh: '虚空君主' }, ch: '◈', c: '#9400d3', hp: 400, atk: 45, def: 18, exp: 1200, g: [300, 600], fl: 35, el: 'shadow', spriteKind: 'B_VOID_SOVEREIGN',
    skill: { name: { en: 'Void Solidify', zh: '虚空凝固' }, effect: 'debuff_stun', chance: 0.3, cd: 6, range: 5, aoe: 1 },
    phases: [
      { hpThreshold: 0.3, atkM: 2, newAi: 'chase', newEl: 'shadow' },
    ],
    summon: { chance: 0.45, cd: 3, maxAdds: 3, kind: 'Void Wraith' } },
  { n: { en: 'The Creator', zh: '创世者' }, ch: 'Ω', c: '#ffffff', hp: 600, atk: 55, def: 22, exp: 2000, g: [500, 1000], fl: 40, el: 'holy', spriteKind: 'B_CREATOR',
    skill: { name: { en: 'Reconstruction', zh: '重构' }, effect: 'heal', chance: 0.25, cd: 8, range: 9, dmg: 1.5 },
    phases: [
      { hpThreshold: 0.6, atkM: 1.4 },
      { hpThreshold: 0.25, atkM: 2, newAi: 'chase' },
    ],
    summon: { chance: 0.5, cd: 3, maxAdds: 4, kind: 'Seraphim' } },
  // === Wave 6c: Fungal Hollow mini-boss (fl 0 = branch-only, never resolves via
  // the main-line BOSSES.find(fl===floor) lookup). Static — no phases/summon —
  // and processBossPhase early-returns when G.branchMode, so it stays a simple
  // tank. Renders via its own spriteKind template (B_MYCONID, batch3b) in
  // drawBossSprite — no enemy tag needed for sprite routing.
  { n: { en: 'Myconid Sovereign', zh: '菌主' }, ch: '♫', c: '#9370db', hp: 150, atk: 24, def: 10, exp: 300, g: [100, 200], fl: 0, el: 'shadow', spriteKind: 'B_MYCONID',
    skill: { name: { en: 'Mycelial Boon', zh: '菌丝回哺' }, effect: 'heal', chance: 0.3, cd: 5, range: 6, dmg: 1 } },
];

export const ACH_DEFS: AchievementDef[] = [
  // Batch3c T3 tpl/hue routing: kill family = T_SWORD/T_SKULL with a
  // red-brown gradient that deepens with the count (emoji skulls honored);
  // boss/warden = crown/trophy gold; floor_* = T_BOOT greens; endless_* =
  // T_SHADOW (THEME_PAL, no hue); gold = T_COIN; levels = T_STAR; endings
  // follow their emoji semantics.
  { id: 'first_kill', icon: '⚔', n: { en: 'First Blood', zh: '初见血' }, d: { en: 'Kill your first enemy', zh: '击杀第一个敌人' }, tpl: 'T_SWORD', hue: '#b85a4a' },
  { id: 'kill_10', icon: '💀', n: { en: 'Monster Slayer', zh: '怪物猎人' }, d: { en: 'Kill 10 enemies', zh: '击杀10个敌人' }, tpl: 'T_SKULL', hue: '#b85a4a' },
  { id: 'kill_50', icon: '☠️', n: { en: 'Massacre', zh: '屠杀者' }, d: { en: 'Kill 50 enemies', zh: '击杀50个敌人' }, tpl: 'T_SKULL', hue: '#8a3a2a' },
  { id: 'kill_100', icon: '⚔', n: { en: 'Century Slayer', zh: '百人斩' }, d: { en: 'Kill 100 enemies', zh: '击杀100个敌人' }, tpl: 'T_SWORD', hue: '#a04434' },
  { id: 'kill_200', icon: '⚔', n: { en: 'Army Breaker', zh: '破军' }, d: { en: 'Kill 200 enemies', zh: '击杀200个敌人' }, tpl: 'T_SWORD', hue: '#86342a' },
  { id: 'boss_kill', icon: '👑', n: { en: 'Boss Slayer', zh: 'Boss杀手' }, d: { en: 'Defeat a boss', zh: '击败一个Boss' }, tpl: 'T_CROWN', hue: '#ffd54a' },
  { id: 'floor5', icon: '🗡️', n: { en: 'Deep Explorer', zh: '深层探索者' }, d: { en: 'Reach floor 5', zh: '到达第5层' }, tpl: 'T_BOOT', hue: '#6cc46c' },
  { id: 'floor15', icon: '🕳️', n: { en: 'Abyss Walker', zh: '深渊行者' }, d: { en: 'Reach floor 15', zh: '到达第15层' }, tpl: 'T_BOOT', hue: '#58b458' },
  { id: 'floor25', icon: '🐉', n: { en: 'Dragon Slayer', zh: '屠龙者' }, d: { en: 'Reach floor 25', zh: '到达第25层' }, tpl: 'T_BOOT', hue: '#7ad47a' },
  { id: 'floor30', icon: '🌀', n: { en: 'Abyssal Diver', zh: '深渊潜水者' }, d: { en: 'Reach floor 30', zh: '到达第30层' }, tpl: 'T_BOOT', hue: '#48a448' },
  { id: 'floor35', icon: '🌀', n: { en: 'Void Walker', zh: '虚空行者' }, d: { en: 'Reach floor 35', zh: '到达第35层' }, tpl: 'T_BOOT', hue: '#86d486' },
  { id: 'floor40', icon: '👑', n: { en: 'Sanctum Conqueror', zh: '圣殿征服者' }, d: { en: 'Reach floor 40', zh: '到达第40层' }, tpl: 'T_BOOT', hue: '#3a943a' },
  { id: 'legendary', icon: '🌟', n: { en: 'Legendary Find', zh: '传说发现' }, d: { en: 'Find a legendary item', zh: '找到一件传说装备' }, tpl: 'T_STAR', hue: '#ffb347' },
  { id: 'streak5', icon: '🔥', n: { en: 'On Fire!', zh: '火力全开！' }, d: { en: '5 kill streak', zh: '5连杀' }, tpl: 'T_FIRE' },
  { id: 'gold500', icon: '💰', n: { en: 'Rich', zh: '富翁' }, d: { en: 'Accumulate 500 gold', zh: '累积500金币' }, tpl: 'T_COIN', hue: '#ffd54a' },
  { id: 'gold1000', icon: '💎', n: { en: 'Tycoon', zh: '大富翁' }, d: { en: 'Accumulate 1000 gold', zh: '累积1000金币' }, tpl: 'T_COIN', hue: '#4ad6c0' },
  { id: 'gold5000', icon: '👑', n: { en: "Dragon's Hoard", zh: '龙之宝库' }, d: { en: 'Accumulate 5000 gold', zh: '累积5000金币' }, tpl: 'T_COIN', hue: '#e8a83a' },
  { id: 'lvl10', icon: '⭐', n: { en: 'Veteran', zh: '老兵' }, d: { en: 'Reach level 10', zh: '到达10级' }, tpl: 'T_STAR', hue: '#8a5de8' },
  { id: 'lvl20', icon: '⭐⭐', n: { en: 'Elite', zh: '精英' }, d: { en: 'Reach level 20', zh: '到达20级' }, tpl: 'T_STAR', hue: '#a86ae8' },
  { id: 'lvl30', icon: '⭐⭐⭐', n: { en: 'Legend', zh: '传奇' }, d: { en: 'Reach level 30', zh: '到达30级' }, tpl: 'T_STAR', hue: '#ffd54a' },
  { id: 'win', icon: '🏆', n: { en: 'Champion', zh: '冠军' }, d: { en: 'Beat the game', zh: '通关游戏' }, tpl: 'T_TROPHY', hue: '#ffd54a' },
  { id: 'creator_kill', icon: '🏆', n: { en: 'Godslayer', zh: '弑神者' }, d: { en: 'Defeat The Creator', zh: '击败创世者' }, tpl: 'T_TROPHY', hue: '#f0e8d0' },
  // Wave 6d: Endless milestones
  { id: 'endless50', icon: '♾', n: { en: 'Abyss Delver', zh: '深渊掘进者' }, d: { en: 'Reach floor 50 in Endless', zh: '无尽模式到达50层' }, tpl: 'T_SHADOW' },
  { id: 'endless75', icon: '♾', n: { en: 'Void Walker', zh: '虚空行者' }, d: { en: 'Reach floor 75 in Endless', zh: '无尽模式到达75层' }, tpl: 'T_SHADOW' },
  { id: 'endless100', icon: '♾', n: { en: 'The Bottomless', zh: '无底之人' }, d: { en: 'Reach floor 100 in Endless', zh: '无尽模式到达100层' }, tpl: 'T_SHADOW' },
  // Playtest #9 Phase 2 — endings at the Creator
  { id: 'end_pyrrhic', icon: '🏆', n: { en: 'Pyrrhic Victor', zh: '悲壮英雄' }, d: { en: 'Slay the Creator (low corruption)', zh: '击杀创世者(低腐化)' }, tpl: 'T_TROPHY', hue: '#d8b45a' },
  { id: 'end_doom', icon: '💀', n: { en: 'Doombringer', zh: '末日使者' }, d: { en: 'Slay the Creator while deeply corrupted', zh: '高腐化下击杀创世者' }, tpl: 'T_SKULL', hue: '#9a5de8' },
  { id: 'end_guardian', icon: '🛡', n: { en: 'The Guardian', zh: '守誓者' }, d: { en: 'Refuse to slay the Creator', zh: '拒绝击杀创世者' }, tpl: 'T_SHIELD', hue: '#6ab8e8' },
  // Playtest #9 Phase 3 — slew a Warden that was once you
  { id: 'warden_self_slay', icon: '🗡', n: { en: 'Self-Slayer', zh: '弑前' }, d: { en: 'Slay a Warden that was once you', zh: '击杀一个曾是你的守渊人' }, tpl: 'T_SWORD', hue: '#9a6ae0' },
];

// ===== New Weapons =====
export const NEW_WEAPONS: WeaponDef[] = [
  { id: 'bronze_spear', n: { en: 'Bronze Spear', zh: '青铜矛' }, r: 0, a: 3, ch: '│',
    flavor: { en: 'A common find at the bottom of the old copper pits; the bronze gleams green with damp, the head still bearing ancient blood-rust.', zh: '远古铜矿坑底常见的发掘物，青铜在湿气中泛着青绿，矛头仍带着古老的血锈。' } },
  { id: 'claymore', n: { en: 'Claymore', zh: '大剑' }, r: 1, a: 8, ch: '†',
    flavor: { en: 'A two-handed heavy blade for the tall; when it falls it comes like a mountainside, and garrisons make it their last line.', zh: '身躯高大者方能驾驭的双手重剑，挥下时如山压顶，守军常以其为最后防线。' } },
  { id: 'crystal_wand', n: { en: 'Crystal Wand', zh: '水晶法杖' }, r: 1, a: 5, ch: '※',
    flavor: { en: 'Crowned with a natural cluster from the crystal caves, it amplifies the caster\'s will—and whispers at midnight.', zh: '顶端嵌着来自水晶洞的天然晶簇，能放大施法者的意念，也会在午夜低声絮语。' } },
  { id: 'inferno_blade', n: { en: 'Inferno Blade', zh: '烈焰之刃' }, r: 2, a: 10, ch: '†', el: 'fire', set: 'fire_lord',
    flavor: { en: 'Forged from the core left by the fallen Fire Lord; the grip is scalding, borne only by those bound to flame.', zh: '炎魔之王陨落后留下的核心锻成，握柄滚烫，唯有与火立约者方能忍受。' } },
  { id: 'glacial_staff', n: { en: 'Glacial Staff', zh: '冰霜法杖' }, r: 2, a: 9, ch: '※', el: 'ice', set: 'frost_mage',
    flavor: { en: 'The heirloom staff of northern frost mages; it feels like gripping ice, and all its former owners stand somewhere as frozen sculpture.', zh: '北地霜法师的传世之杖，触之如握寒冰，据说其前主人都化作了永不融化的冰雕。' } },
  { id: 'storm_cleaver', n: { en: 'Storm Cleaver', zh: '风暴斧' }, r: 2, a: 11, ch: 'Ψ', el: 'lightning',
    flavor: { en: 'Consecrated by storm priests at the heart of a thunderhead; the etchings on its edge discharge faintly with the pressure.', zh: '风暴祭司在雷暴中心开光的战斧，斧刃上的纹路会随气压变化隐隐放电。' } },
  { id: 'shadow_dagger', n: { en: 'Shadow Dagger', zh: '暗影匕首' }, r: 3, a: 13, ch: '‡', el: 'shadow', set: 'shadow_set',
    flavor: { en: 'Buried with a master assassin, its blade so black that candlelight will not rest on it; it has ended three dynasties.', zh: '刺客大师的殉葬之物，匕身黑得连烛光都无法在其上停留，曾被用于终结三段王朝。' } },
  { id: 'holy_avenger', n: { en: 'Holy Avenger', zh: '圣光复仇者' }, r: 3, a: 16, ch: '†', el: 'holy', set: 'divine',
    flavor: { en: 'Conferred by the Inquisition upon its highest justiciar; the sigil on its crossguard dims the instant its bearer falls.', zh: '异端审判庭授予最高圣裁官的佩剑，剑格上的圣印会在持剑者堕落时黯淡无光。' } },
  { id: 'abyssal_trident', n: { en: 'Abyssal Trident', zh: '深渊三叉戟' }, r: 3, a: 14, ch: 'ψ', el: 'ice', set: 'abyssal',
    flavor: { en: 'Said to be a ceremonial piece left by a fugitive of the deep court; silent underwater, it drips brine year-round on land.', zh: '据说是深海宫廷叛逃者遗落的礼器，三叉在水下无声，上岸后却终年滴着咸腥的水。' } },
  { id: 'void_reaper', n: { en: 'Void Reaper', zh: '虚空镰刀' }, r: 4, a: 20, ch: 'Ͽ', el: 'shadow', set: 'shadow_set',
    flavor: { en: 'The blade reflects light from angles that should not exist; it reaps not grain but the last wisp of escaping soul-fire.', zh: '镰刃不存在的角度反光，收割的不是谷物，而是被斩者最后一缕逃逸的魂火。' } },
  { id: 'celestial_blade', n: { en: 'Celestial Blade', zh: '天界之刃' }, r: 4, a: 24, ch: '†', el: 'holy', set: 'divine',
    flavor: { en: 'A holy blade tempered from the ruined wing of a fallen seraph; each swing trails a brief line of gold.', zh: '坠落炽天使残翼淬出的圣剑，挥动时拖着一道转瞬即逝的金色光痕。' } },
  { id: 'thunder_god_hammer', n: { en: 'Thunder God Hammer', zh: '雷神之锤' }, r: 4, a: 22, ch: '⊥', el: 'lightning',
    flavor: { en: 'A forgotten thunder-god hurled it to earth and never picked it up; the runes on its head still crackle on rainy nights.', zh: '传说一位被遗忘的雷神将它掷向大地后未再拾起，锤身上的符文至今仍随雨夜噼啪作响。' } },
  { id: 'cosmic_devourer', n: { en: 'Cosmic Devourer', zh: '宇宙吞噬者' }, r: 4, a: 28, ch: 'Ω',
    flavor: { en: 'Its star-iron came from a dead sun; the blade is so black that those who stare too long hear the void\'s heartbeat.', zh: '铸造此剑的星铁来自一颗熄灭的恒星，剑身幽黑，凝视过久者会听见虚空的心跳。' } },
];

// Merge all weapons
export const ALL_WEAPONS: WeaponDef[] = [...WEAPONS, ...NEW_WEAPONS];

// ===== New Armors =====
export const NEW_ARMORS: ArmorDef[] = [
  { id: 'brigandine', n: { en: 'Brigandine', zh: '镶甲' }, r: 1, d: 3, ch: '▦', subType: 'plate',
    flavor: { en: 'Iron plates riveted inside coarse cloth; unremarkable to look at, yet trusted by mercenaries and bandits alike.', zh: '内衬铁片、外覆粗布的实用铠甲，貌不惊人却深受雇佣兵与山贼的信赖。' } },
  { id: 'inferno_plate', n: { en: 'Inferno Plate', zh: '烈焰板甲' }, r: 2, d: 7, ch: '▣', subType: 'plate', el: 'fire', set: 'fire_lord',
    flavor: { en: 'Reforged from the ribs of the Fire Lord; the plate runs hot year-round, and its wearer rarely feels cold—or anything else.', zh: '炎魔之王的肋骨重塑而成，板甲内部终年滚烫，穿上它的人很少会感到寒冷——或其他任何感觉。' } },
  { id: 'frostweave_robe', n: { en: 'Frostweave Robe', zh: '霜织法袍' }, r: 2, d: 6, ch: '≈', subType: 'robe', el: 'ice', set: 'frost_mage',
    flavor: { en: 'Woven from the silk of ice-worms that never melt; the frost patterns on the robe drift slowly with the caster\'s mood.', zh: '以永不融化的冰蚕丝织就，法袍上的霜花纹会随施法者的情绪缓缓移动。' } },
  { id: 'shadow_mantle', n: { en: 'Shadow Mantle', zh: '暗影披风' }, r: 3, d: 9, ch: '≈', subType: 'cloak', el: 'shadow', set: 'shadow_set',
    flavor: { en: 'The ceremonial mantle of the Night-Cult\'s high priests; its hem is ever damp with dew, as if just back from another\'s dream.', zh: '夜行教派高阶祭司的礼袍，披风下摆永远沾着未干的露水，仿佛刚刚踏过他人的梦境。' } },
  { id: 'sanctified_plate', n: { en: 'Sanctified Plate', zh: '圣化板甲' }, r: 3, d: 12, ch: '▣', subType: 'plate', el: 'holy', set: 'divine',
    flavor: { en: 'Purified through seven nights of consecration; slivers of holy relic line its seams, and corruption cannot easily take hold.', zh: '经七昼夜祝圣仪式净化过的板甲，接缝处嵌着细小的圣物碎片，腐化难以在其上附着。' } },
  { id: 'abyssal_carapace', n: { en: 'Abyssal Carapace', zh: '深渊甲壳' }, r: 3, d: 11, ch: '◆', subType: 'scale', el: 'ice', set: 'abyssal',
    flavor: { en: 'Pieced from the molted shell of an abyssal leviathan; it is dark of hue, and at close range smells of ancient tidal brine.', zh: '用深海巨兽褪下的甲壳拼接而成，色泽幽暗，靠近时会闻到一股古老咸腥的潮汐味。' } },
  { id: 'void_shroud', n: { en: 'Void Shroud', zh: '虚空罩袍' }, r: 4, d: 13, ch: '≈', subType: 'robe', el: 'shadow',
    flavor: { en: 'Woven from threads of congealed void; beneath the shroud is no true outline, and staring too long makes a name slip from the mind.', zh: '以凝固的虚空为线织就，罩袍下没有真正的轮廓，凝视它过久会让人忘却自己的姓名。' } },
  { id: 'godslayer_armor', n: { en: 'Godslayer Armor', zh: '弑神铠甲' }, r: 4, d: 16, ch: '▣', subType: 'plate',
    flavor: { en: 'The few suits that remain vanished after the Creation War; wearers hear the last whisper of a dying god, and sleep no more.', zh: '仅存的几套都在创世战争后失踪，据说穿上它的人会听见神祇临终前的低语，彻夜难眠。' } },
];

export const ALL_ARMORS: ArmorDef[] = [...ARMORS, ...NEW_ARMORS];

// ===== New Accessories =====
export const NEW_ACCESSORIES: AccessoryDef[] = [
  { id: 'jade_pendant', n: { en: 'Jade Pendant', zh: '翡翠吊坠' }, r: 1, a: 1, d: 1, h: 8, ch: '◇', subType: 'amulet',
    flavor: { en: 'A ward-jade carved by far-eastern lapidaries; it steadies the heart, granting the wearer a moment\'s clarity amid the corruption\'s whisper.', zh: '远东玉匠雕琢的护身玉，据传能稳住心神，使佩戴者在腐化的低语中保持片刻清明。' } },
  { id: 'inferno_band', n: { en: 'Inferno Band', zh: '烈焰戒指' }, r: 2, a: 3, d: 1, h: 5, ch: '○', subType: 'ring', set: 'fire_lord',
    flavor: { en: 'A wick of undying fire is sealed in the stone; the finger that wears it is always warm, yet bears no mark.', zh: '戒面内封着一缕永不熄灭的火心，戴上后手指常年灼热，却不会留下任何伤痕。' } },
  { id: 'frost_amulet', n: { en: 'Frost Amulet', zh: '冰霜护符' }, r: 2, a: 1, d: 3, h: 15, ch: '✝', subType: 'amulet', set: 'frost_mage',
    flavor: { en: 'The token given to northern frost mages on their initiation; worn at the breast, it carries the distant echo of calving glaciers.', zh: '北境冰法师的入职信物，护符贴胸佩戴时，能听见远方冰川缓慢崩裂的回声。' } },
  { id: 'shadow_signet', n: { en: 'Shadow Signet', zh: '暗影印戒' }, r: 3, a: 3, d: 3, h: 15, ch: '○', subType: 'ring', set: 'shadow_set',
    flavor: { en: 'The signet of the Assassins\' Council; covenants sealed in blood by this ring are binding, and defaulters are swallowed by its shadow.', zh: '刺客议会的印信，盖上蜡封的契约以鲜血为证，违约者会被戒面上的阴影慢慢吞没。' } },
  { id: 'divine_halo', n: { en: 'Divine Halo', zh: '神圣光环' }, r: 3, a: 3, d: 3, h: 20, ch: '◎', subType: 'crown', set: 'divine',
    flavor: { en: 'A congealed fragment of a saint\'s halo, hovering an inch above the wearer; its light dims whenever a lie is spoken nearby.', zh: '圣徒头顶光环的凝固残片，悬浮于佩戴者顶上寸许，光环中的光会在谎言响起时黯淡。' } },
  { id: 'abyssal_pearl', n: { en: 'Abyssal Pearl', zh: '深渊珍珠' }, r: 3, a: 2, d: 4, h: 25, ch: '●', subType: 'amulet', set: 'abyssal',
    flavor: { en: 'A black pearl grown a century in an abyssal oyster; at its core is sealed a briny drop—the last tear shed before Creation.', zh: '深海巨蚌百年孕育的黑珠，珠心封着一滴咸水，据说是创世前的最后一滴眼泪。' } },
  { id: 'astral_crown', n: { en: 'Astral Crown', zh: '星界王冠' }, r: 4, a: 6, d: 6, h: 40, ch: '♛', subType: 'crown',
    flavor: { en: 'A circlet cast from congealed starlight; the wearer hears, briefly, the hum of revolving stars—and sleeps but poorly afterward.', zh: '以凝固星光铸成的环冠，戴上它的人能短暂听见星辰运转的嗡鸣，此后再难安睡。' } },
];

export const ALL_ACCESSORIES: AccessoryDef[] = [...ACCESSORIES, ...NEW_ACCESSORIES];

// ===== New Potions =====
export const NEW_POTIONS: PotionDef[] = [
  { id: 'supreme_heal_potion', n: { en: 'Supreme Health Potion', zh: '终极生命药水' }, ef: 'heal', v: 100, c: '#ff6b6b', ch: '♥',
    flavor: { en: 'A rare red liquor rumored to be drawn from a saint\'s blood; it glows, and is counted the lost summit of the alchemists\' craft.', zh: '传闻由圣徒之血调成的稀有红液，整瓶泛着柔光，据说是炼金术几近失传的巅峰之作。' } },
  { id: 'supreme_mana_potion', n: { en: 'Supreme Mana Potion', zh: '终极魔力药水' }, ef: 'mana', v: 60, c: '#4895ef', ch: '✦',
    flavor: { en: 'A forbidden draught of pure dissolved aether-crystal; the bottle is ever cold, and drinkers brush, briefly, a god\'s mind.', zh: '以纯以太结晶直接溶成的禁药，瓶身始终冰凉，据说饮用者能短暂触及神明的思绪。' } },
  { id: 'fire_resist_potion', n: { en: 'Fire Resistance Potion', zh: '火焰抗性药水' }, ef: 'el_res_fire', v: 50, c: '#ff4500', ch: '◊', dur: 30,
    flavor: { en: 'An orange brew the desert nomads render from salamander glands; the body runs hot, yet the skin learns to shrug at flame.', zh: '砂漠游牧者以火蜥蜴腺体熬成的橘红药水，饮后体温骤升，皮肤却对火焰习以为常。' } },
  { id: 'ice_resist_potion', n: { en: 'Ice Resistance Potion', zh: '冰霜抗性药水' }, ef: 'el_res_ice', v: 50, c: '#00ced1', ch: '◊', dur: 30,
    flavor: { en: 'A blue brew compounded by caldera-gatherers from lava-fern; the limbs warm, and even the breath carries no mist.', zh: '火山口采药者以熔岩蕨调制的青蓝药水，饮后四肢回暖，连呼出的气都不再起雾。' } },
];

export const ALL_POTIONS: PotionDef[] = [...POTIONS, ...NEW_POTIONS];

// ===== New Scrolls =====
export const NEW_SCROLLS: ScrollDef[] = [
  { id: 'blizzard_scroll', n: { en: 'Scroll of Blizzard', zh: '暴风雪卷轴' }, ef: 'blizzard', v: 35, c: '#00ced1', ch: '✻', subType: 'frost',
    flavor: { en: 'A high charm of the northern frost mages; frost clings to the edge of the parchment, and after the reading the air goes abruptly still.', zh: '北境霜法师的高阶咒文，展开时纸缘已凝着冰碴，朗读后整片空气都会骤然安静。' } },
  { id: 'holy_light_scroll', n: { en: 'Scroll of Holy Light', zh: '圣光卷轴' }, ef: 'holy_blast', v: 40, c: '#ffd700', ch: '✦', subType: 'holy',
    flavor: { en: 'A consecrated charm the temple knights use to drive out the unholy; its gold ink glimmers in the dark, and demands a clean heart.', zh: '圣殿骑士团用以驱散邪祟的祝圣咒文，金墨在黑暗中微微发亮，朗读需以纯净之心。' } },
  { id: 'summoning_scroll', n: { en: 'Scroll of Summoning', zh: '召唤卷轴' }, ef: 'summon_ally', v: 0, c: '#06d6a0', ch: '☉', subType: 'arcane',
    flavor: { en: 'The summoners\' school most debated pact; the called one fights in the caster\'s stead, and the price surfaces only afterward.', zh: '召唤学派富于争议的契约咒，被召者会暂代施法者而战，代价常在事后才显形。' } },
];

export const ALL_SCROLLS: ScrollDef[] = [...SCROLLS, ...NEW_SCROLLS];

// ===== New Consumables =====
export const NEW_CONSUMABLES: ConsumableDef[] = [
  { id: 'void_bomb', n: { en: 'Void Bomb', zh: '虚空炸弹' }, ef: 'bomb', v: 50, c: '#9400d3', ch: '*', subType: 'bomb', r: 2, desc: { en: 'AoE void dmg to nearby foes', zh: '对附近敌人造成范围虚空伤害' },
    flavor: { en: 'A forbidden charge cored with congealed void; the blast leaves a brief rift that swallows anything that comes too near.', zh: '以凝固虚空为芯的禁制爆裂物，引爆处会留下一道短暂的裂口，吞噬一切过于靠近的东西。' } },
  { id: 'holy_water', n: { en: 'Holy Water', zh: '圣水' }, ef: 'holy_water', v: 30, c: '#ffd700', ch: '+', subType: 'pouch', r: 2, desc: { en: 'Holy dmg to undead/demons', zh: '对亡灵/恶魔造成神圣伤害' },
    flavor: { en: 'Well-water purified through seven nights of consecration, kept in silver flasks; it rises in white smoke where it touches undead or demon.', zh: '经七昼夜祝圣仪式净化的井水，盛于银瓶中，浇在亡灵与恶魔身上会腾起白烟。' } },
  { id: 'recall_stone', n: { en: 'Recall Stone', zh: '回城石' }, ef: 'recall', v: 0, c: '#4895ef', ch: '@', subType: 'tool', r: 2, desc: { en: 'Teleport to floor start', zh: '传送回楼层起点' },
    flavor: { en: 'A pebble the spatialists have imprinted with a return-coordinate; squeeze and speak to be drawn back to the stair, at the cost of a wave of dizziness.', zh: '空间法师公会刻印归返坐标的石子，握紧默念即能回到楼层入口，代价是一阵眩晕。' } },
  { id: 'invis_cloak', n: { en: 'Shadow Cloak', zh: '暗影斗篷' }, ef: 'invis', v: 0, c: '#2f4f4f', ch: '~', subType: 'tool', r: 3, desc: { en: 'Invisible for 10 turns', zh: '隐身10回合' },
    flavor: { en: 'A thin cloak woven by shadow-mages from distilled shadow; wrapped in it, the wearer\'s image dissolves, though his own heartbeat grows deafening.', zh: '影法师以蒸馏的影织成的薄披风，裹住后周身影像消融，唯独心跳声会被自己听得格外清晰。' } },
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
  { id: 'dried_meat', n: { en: 'Dried Meat', zh: '肉干' }, hungerRestore: 30, c: '#f4845f', ch: '≡', subType: 'meat', r: 0,
    flavor: { en: 'Strips of wind-cured salted meat, so tough they must be softened with spit; the most reliable ration on a long descent.', zh: '风干腌制的肉条，硬得需要用口水慢慢软化，却是长途下山最可靠的口粮。' } },
  { id: 'fresh_bread', n: { en: 'Fresh Bread', zh: '新鲜面包' }, hungerRestore: 20, hpHeal: 5, c: '#daa520', ch: '◯', subType: 'bread', r: 0,
    flavor: { en: 'A dark-rye round baked at first light in the town at the pass; its faint smoke is the last taste of home on the way down.', zh: '山口小镇清晨烤出的黑麦圆包，麦香里带着一丝烟熏味，是下山前最后的家常味道。' } },
  { id: 'elven_feast', n: { en: 'Elven Feast', zh: '精灵盛宴' }, hungerRestore: 50, hpHeal: 20, c: '#06d6a0', ch: '※', subType: 'feast', r: 1,
    flavor: { en: 'Thin cakes and mead left by elven wayfarers; those who eat them dream of the evergreen wood, and wake with dew at the eye\'s corner.', zh: '精灵旅人留下的薄饼与蜜酒，据说吃下后会梦见永青之林，醒来时眼角常带着露水。' } },
  { id: 'divine_ambrosia', n: { en: 'Divine Ambrosia', zh: '神仙甘露' }, hungerRestore: 100, hpHeal: 50, c: '#ffd700', ch: '✦', subType: 'feast', r: 3,
    flavor: { en: 'The golden liquor the gods were said to drink, glowing faintly in its white porcelain flask; a single sip lets a mortal forget days of toil.', zh: '传闻诸神饮用的金液，封在白瓷瓶中盈盈发光，凡人喝下一口便足以忘却数日的疲惫。' } },
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
  // === Wave 6d / Endless content (Task 1): F41+ exclusive themed sets ===
  { id: 'void_gear', n: { en: 'Void', zh: '虚空' }, pieces: 3, bonuses: [
    { required: 2, type: 'el_dmg_shadow', value: 15, desc: { en: '+15% Shadow Dmg', zh: '+15%暗影伤害' } },
    { required: 3, type: 'corruption_resist', value: 3, desc: { en: '-3 Corruption/floor', zh: '每层-3腐化' } },
  ] },
  { id: 'abyss_gear', n: { en: 'Abyss', zh: '深渊' }, pieces: 3, bonuses: [
    { required: 2, type: 'crit', value: 10, desc: { en: '+10% Crit', zh: '+10%暴击' } },
    { required: 3, type: 'heal_bonus', value: 15, desc: { en: '+15% Healing', zh: '+15%治疗' } },
  ] },
  { id: 'astral_gear', n: { en: 'Astral', zh: '星辰' }, pieces: 2, bonuses: [
    { required: 2, type: 'el_dmg_holy', value: 15, desc: { en: '+15% Holy Dmg', zh: '+15%神圣伤害' } },
  ] },
];

// ===== Area Definitions =====
import { TL } from './config.js';

export const AREAS: AreaDef[] = [
  {
    id: 'caves', n: { en: 'The Caverns', zh: '地下洞穴' }, floorStart: 1, floorEnd: 5,
    wallColor: '#444', floorColor: '#333', corrColor: '#2a2a2a', bgColor: '#1a1a2e',
    specialTiles: { type: TL.MOSS, ch: '"', fg: '#6b8e3a', bg: '#1a2a10', count: [2, 4] },
    wallChar: '#', floorChar: '·', enemyScaleBonus: 0,
    lore: [
      { en: 'Damp cave walls drip with moisture.', zh: '潮湿的洞壁上渗出水珠。' },
      { en: 'You hear skittering in the darkness.', zh: '黑暗中传来窸窣声。' },
    ],
  },
  {
    id: 'crypts', n: { en: 'Ancient Crypts', zh: '远古墓穴' }, floorStart: 6, floorEnd: 10,
    wallColor: '#3d3d5c', floorColor: '#2d2d3d', corrColor: '#1d1d2d', bgColor: '#0a0a1e',
    specialTiles: { type: TL.CURSE, ch: '☣', fg: '#8a2be2', bg: '#1a0a2a', count: [2, 4] },
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
    specialTiles: [
      { type: TL.LAVA, ch: '~', fg: '#ff4500', bg: '#2a0a0a', count: [2, 5] },
      { type: TL.PORTAL, ch: '◯', fg: '#b266ff', bg: '#1a0a2a', count: [0, 1] },
    ],
    lore: [
      { en: 'The air smells of brimstone.', zh: '空气中弥漫着硫磺的气味。' },
      { en: 'Lava glows in cracks along the walls.', zh: '墙壁裂缝中透出岩浆的红光。' },
    ],
  },
  {
    id: 'fortress', n: { en: 'Dark Fortress', zh: '暗黑堡垒' }, floorStart: 16, floorEnd: 20,
    wallColor: '#2d2d3d', floorColor: '#2d2d35', corrColor: '#1d1d25', bgColor: '#0a0a15',
    specialTiles: [
      { type: TL.ALARM, ch: '※', fg: '#daa520', bg: '#2a2a10', count: [1, 2] },
      { type: TL.PORTAL, ch: '◯', fg: '#b266ff', bg: '#1a0a2a', count: [0, 1] },
    ],
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
  // === Wave 6c: Portal branch biome. floorStart/floorEnd are sentinels (1000+)
  // so this area NEVER resolves via the main 1-40 floor-range lookup — it is
  // only used through genDungeon's areaOverride (enterBranch passes this def).
  // G.floor stays at the entry floor inside the branch, so render.ts resolves
  // the visual theme via a branchMode lookup (getCurrentArea in render.ts).
  {
    id: 'fungal', n: { en: 'Fungal Hollow', zh: '荧光菌穴' }, floorStart: 1000, floorEnd: 1002,
    wallColor: '#2a1a3a', floorColor: '#1a2a1a', corrColor: '#151a15', bgColor: '#0a1a0a',
    wallChar: '♣', floorChar: '·', enemyScaleBonus: 0.1,
    specialTiles: { type: TL.MOSS, ch: '"', fg: '#6b8e3a', bg: '#1a2a10', count: [3, 6] },
    lore: [
      { en: 'Spores thick in the air.', zh: '空气中孢子浓密。' },
      { en: 'Something vast blooms in the dark.', zh: '黑暗中有什么庞然大物在绽放。' },
    ],
  },
  // Wave 6d: Endless mode area (F41-9999) — only reached when G.endless; normal runs end at F40.
  {
    id: 'endless', n: { en: 'Endless Abyss', zh: '无尽深渊' }, floorStart: 41, floorEnd: 9999,
    wallColor: '#1a0a2a', floorColor: '#150a20', corrColor: '#0a0510', bgColor: '#05000a',
    wallChar: '▓', floorChar: '·', enemyScaleBonus: 0.15,
    specialTiles: { type: TL.VOID_FLOOR, ch: ' ', fg: '#2a0040', bg: '#0a0010', count: [3, 8] },
    lore: [
      { en: 'Reality frays at the edges. There is no bottom.', zh: '现实在边缘磨损。这里没有尽头。' },
      { en: 'The abyss goes on forever. So does something else.', zh: '深渊永无止境。别的什么也是。' },
    ],
  },
];

// ===== Talent Trees =====
export const TALENT_TREES: TalentTree[] = [
  // Warrior (classIdx 0) — "Ironclad"
  {
    classIdx: 0,
    nodes: [
      { id: 'w_iron_skin', n: { en: 'Iron Skin', zh: '铁皮' }, desc: { en: '+2 DEF per rank', zh: '每级+2防御' }, maxRank: 3, icon: '🛡', row: 0, col: 0, effect: 'def', valuePerRank: 2, tpl: 'T_SHIELD', hue: '#5a8ad6' },
      { id: 'w_shield_mastery', n: { en: 'Shield Mastery', zh: '盾击精通' }, desc: { en: 'Shield Bash +20% dmg/rank', zh: '每级盾击+20%伤害' }, maxRank: 2, icon: '🔰', row: 0, col: 1, effect: 'skill_stun_dmg', valuePerRank: 20, tpl: 'T_SHIELD', hue: '#7a9ae8' },
      { id: 'w_battle_fury', n: { en: 'Battle Fury', zh: '战意' }, desc: { en: '+2 ATK per rank', zh: '每级+2攻击' }, maxRank: 3, icon: '⚔', row: 0, col: 2, effect: 'atk', valuePerRank: 2, tpl: 'T_SWORD', hue: '#e05545' },
      { id: 'w_berserker', n: { en: 'Berserker Rage', zh: '狂暴' }, desc: { en: '+15% ATK when HP<50%', zh: 'HP<50%时+15%攻击' }, maxRank: 1, icon: '💢', row: 0, col: 3, requires: ['w_battle_fury'], effect: 'low_hp_atk', valuePerRank: 15, tpl: 'T_SWORD', hue: '#ff6a3c' },
      { id: 'w_blood', n: { en: 'Thick Blood', zh: '厚血' }, desc: { en: '+15 HP per rank', zh: '每级+15HP' }, maxRank: 3, icon: '❤', row: 1, col: 0, requires: ['w_iron_skin'], effect: 'maxhp', valuePerRank: 15, tpl: 'T_HEART', hue: '#e05560' },
      { id: 'w_retaliation', n: { en: 'Retaliation', zh: '反击' }, desc: { en: '10% chance counter-attack', zh: '10%概率反击' }, maxRank: 1, icon: '↩', row: 1, col: 1, requires: ['w_iron_skin'], effect: 'counter', valuePerRank: 10, tpl: 'T_SWORD', hue: '#e8705a' },
      { id: 'w_weapon_mastery', n: { en: 'Weapon Mastery', zh: '武器精通' }, desc: { en: '+3 ATK per rank', zh: '每级+3攻击' }, maxRank: 3, icon: '🗡', row: 1, col: 2, requires: ['w_battle_fury'], effect: 'atk', valuePerRank: 3, tpl: 'T_SWORD', hue: '#c83a2c' },
      { id: 'w_executioner', n: { en: 'Executioner', zh: '处刑人' }, desc: { en: '+30% dmg to HP<30% foes', zh: '对HP<30%敌人+30%伤害' }, maxRank: 1, icon: '💀', row: 1, col: 3, requires: ['w_weapon_mastery'], effect: 'execute', valuePerRank: 30, tpl: 'T_SKULL', hue: '#d8d0c0' },
      { id: 'w_fortify', n: { en: 'Fortify', zh: '壁垒' }, desc: { en: '+3 DEF when HP>80%', zh: 'HP>80%时+3防御' }, maxRank: 1, icon: '🏰', row: 2, col: 0, requires: ['w_blood'], effect: 'high_hp_def', valuePerRank: 3, tpl: 'T_SHIELD', hue: '#6a92e8' },
      { id: 'w_iron_will', n: { en: 'Iron Will', zh: '钢铁意志' }, desc: { en: 'Poison dmg reduced 50%', zh: '中毒伤害减半' }, maxRank: 1, icon: '🧠', row: 2, col: 1, requires: ['w_retaliation'], effect: 'poison_resist', valuePerRank: 50, tpl: 'T_FLASK', hue: '#4ac44a' },
      { id: 'w_whirlwind', n: { en: 'Whirlwind', zh: '旋风斩' }, desc: { en: 'Skill hits all adjacent', zh: '技能攻击所有相邻敌人' }, maxRank: 1, icon: '🌀', row: 2, col: 2, requires: ['w_shield_mastery'], effect: 'skill_aoe', valuePerRank: 1, tpl: 'T_SWORD', hue: '#ff9a4a' },
      { id: 'w_last_stand', n: { en: 'Last Stand', zh: '背水一战' }, desc: { en: '+50% ATK when HP<20%', zh: 'HP<20%时+50%攻击' }, maxRank: 1, icon: '🔥', row: 2, col: 3, requires: ['w_berserker'], effect: 'desperate_atk', valuePerRank: 50, tpl: 'T_SWORD', hue: '#ff3a1c' },
      { id: 'w_unbreakable', n: { en: 'Unbreakable', zh: '不屈' }, desc: { en: 'Survive lethal hit once/boss', zh: '每场Boss战免死一次' }, maxRank: 1, icon: '💎', row: 3, col: 0, requires: ['w_fortify'], effect: 'cheat_death', valuePerRank: 1, tpl: 'T_SHIELD', hue: '#a8c8f8' },
      { id: 'w_war_cry', n: { en: 'War Cry', zh: '战吼' }, desc: { en: 'Skill also fears nearby', zh: '技能同时恐惧附近敌人' }, maxRank: 1, icon: '📢', row: 3, col: 1, requires: ['w_iron_will'], effect: 'skill_fear', valuePerRank: 1, tpl: 'T_STAFF', hue: '#a06ae8' },
      { id: 'w_titan_strike', n: { en: 'Titan Strike', zh: '泰坦之击' }, desc: { en: 'Skill dmg +50%', zh: '技能伤害+50%' }, maxRank: 1, icon: '⚡', row: 3, col: 2, requires: ['w_whirlwind'], effect: 'skill_dmg_up', valuePerRank: 50, tpl: 'T_STAR', hue: '#e05545' },
      { id: 'w_undying', n: { en: 'Undying', zh: '不死' }, desc: { en: 'Auto-revive 1/battle to 30% HP', zh: '每场战斗自动复活一次至30%HP' }, maxRank: 1, icon: '✨', row: 3, col: 3, requires: ['w_last_stand', 'w_titan_strike'], effect: 'auto_revive', valuePerRank: 30, tpl: 'T_STAR', hue: '#ffd54a' },
    ],
  },
  // Rogue (classIdx 1) — "Shadow"
  {
    classIdx: 1,
    nodes: [
      { id: 'r_keen_eye', n: { en: 'Keen Eye', zh: '锐眼' }, desc: { en: '+5% crit per rank', zh: '每级+5%暴击' }, maxRank: 3, icon: '👁', row: 0, col: 0, effect: 'crit', valuePerRank: 5, tpl: 'T_SWORD', hue: '#6cc46c' },
      { id: 'r_swift_feet', n: { en: 'Swift Feet', zh: '迅步' }, desc: { en: '+3% dodge per rank', zh: '每级+3%闪避' }, maxRank: 3, icon: '💨', row: 0, col: 1, effect: 'dodge', valuePerRank: 3, tpl: 'T_BOOT', hue: '#6cc46c' },
      { id: 'r_poison_blade', n: { en: 'Poison Blade', zh: '毒刃' }, desc: { en: '20% chance to poison on hit', zh: '20%概率附加中毒' }, maxRank: 1, icon: '🐍', row: 0, col: 2, effect: 'on_hit_poison', valuePerRank: 20, tpl: 'T_FLASK', hue: '#52c452' },
      { id: 'r_backstab', n: { en: 'Backstab', zh: '背刺' }, desc: { en: '+25% crit damage', zh: '+25%暴击伤害' }, maxRank: 1, icon: '🗡', row: 0, col: 3, requires: ['r_keen_eye'], effect: 'crit_dmg', valuePerRank: 25, tpl: 'T_SWORD', hue: '#48c48c' },
      { id: 'r_night_vision', n: { en: 'Night Vision', zh: '夜视' }, desc: { en: '+2 FOV', zh: '视野+2' }, maxRank: 1, icon: '🌙', row: 1, col: 0, requires: ['r_swift_feet'], effect: 'fov', valuePerRank: 2, tpl: 'T_EYE', hue: '#6ad4d4' },
      { id: 'r_evasion', n: { en: 'Evasion', zh: '闪避' }, desc: { en: '+5% dodge per rank', zh: '每级+5%闪避' }, maxRank: 2, icon: '🌀', row: 1, col: 1, requires: ['r_swift_feet'], effect: 'dodge', valuePerRank: 5, tpl: 'T_BOOT', hue: '#52a452' },
      { id: 'r_double_strike', n: { en: 'Double Strike', zh: '双重打击' }, desc: { en: '15% chance attack twice', zh: '15%概率攻击两次' }, maxRank: 1, icon: '⚔', row: 1, col: 2, requires: ['r_poison_blade'], effect: 'double_strike', valuePerRank: 15, tpl: 'T_SWORD', hue: '#3aa45c' },
      { id: 'r_death_mark', n: { en: 'Death Mark', zh: '死亡标记' }, desc: { en: 'Skill always crits', zh: '技能必定暴击' }, maxRank: 1, icon: '☠', row: 1, col: 3, requires: ['r_backstab'], effect: 'skill_crit', valuePerRank: 1, tpl: 'T_SWORD', hue: '#b8e86a' },
      { id: 'r_shadow_step', n: { en: 'Shadow Step', zh: '暗影步' }, desc: { en: 'Dodge next attack after kill', zh: '击杀后闪避下次攻击' }, maxRank: 1, icon: '👤', row: 2, col: 0, requires: ['r_night_vision'], effect: 'dodge_after_kill', valuePerRank: 1, tpl: 'T_BOOT', hue: '#3a8a5a' },
      { id: 'r_vanish', n: { en: 'Vanish', zh: '消失' }, desc: { en: 'Invisible 3t when HP<25%', zh: 'HP<25%时隐身3回合' }, maxRank: 1, icon: '🚫', row: 2, col: 1, requires: ['r_evasion'], effect: 'vanish_low_hp', valuePerRank: 3, tpl: 'T_SHADOW' },
      { id: 'r_fan_knives', n: { en: 'Fan of Knives', zh: '飞刀扇' }, desc: { en: 'Skill hits all in range', zh: '技能攻击范围内所有敌人' }, maxRank: 1, icon: '🔪', row: 2, col: 2, requires: ['r_double_strike'], effect: 'skill_aoe', valuePerRank: 1, tpl: 'T_SWORD', hue: '#86d458' },
      { id: 'r_assassinate', n: { en: 'Assassinate', zh: '暗杀' }, desc: { en: 'Instakill foes <10% HP', zh: '秒杀HP<10%的敌人' }, maxRank: 1, icon: '💀', row: 2, col: 3, requires: ['r_death_mark'], effect: 'instakill', valuePerRank: 10, tpl: 'T_SKULL', hue: '#d8d0c0' },
      { id: 'r_master_assassin', n: { en: 'Master Assassin', zh: '暗杀大师' }, desc: { en: '+50% skill damage', zh: '技能伤害+50%' }, maxRank: 1, icon: '🏆', row: 3, col: 0, requires: ['r_shadow_step'], effect: 'skill_dmg_up', valuePerRank: 50, tpl: 'T_TROPHY', hue: '#ffd54a' },
      { id: 'r_smoke_screen', n: { en: 'Smoke Screen', zh: '烟幕' }, desc: { en: 'Skill also blinds enemies', zh: '技能同时致盲敌人' }, maxRank: 1, icon: '💨', row: 3, col: 1, requires: ['r_vanish'], effect: 'skill_blind', valuePerRank: 1, tpl: 'T_STAFF', hue: '#8a5de8' },
      { id: 'r_shadow_dance', n: { en: 'Shadow Dance', zh: '暗影之舞' }, desc: { en: 'Attack +30% for 3t after dodge', zh: '闪避后3回合攻击+30%' }, maxRank: 1, icon: '💃', row: 3, col: 2, requires: ['r_fan_knives'], effect: 'dodge_atk_buff', valuePerRank: 30, tpl: 'T_BOOT', hue: '#7ac47a' },
      { id: 'r_phantom_blade', n: { en: 'Phantom Blade', zh: '幻影刃' }, desc: { en: '30% chance extra full dmg', zh: '30%概率造成额外全额伤害' }, maxRank: 1, icon: '👻', row: 3, col: 3, requires: ['r_assassinate', 'r_master_assassin'], effect: 'phantom_strike', valuePerRank: 30, tpl: 'T_STAR', hue: '#6cc46c' },
    ],
  },
  // Mage (classIdx 2) — "Arcane"
  {
    classIdx: 2,
    nodes: [
      { id: 'm_arcane_power', n: { en: 'Arcane Power', zh: '奥能' }, desc: { en: '+10% spell power per rank', zh: '每级+10%法术强度' }, maxRank: 3, icon: '🔮', row: 0, col: 0, effect: 'spellPower', valuePerRank: 10, tpl: 'T_RUNE', hue: '#8a5de8' },
      { id: 'm_mana_flow', n: { en: 'Mana Flow', zh: '法力流' }, desc: { en: '+5 max MP per rank', zh: '每级+5最大MP' }, maxRank: 3, icon: '💧', row: 0, col: 1, effect: 'maxmp', valuePerRank: 5, tpl: 'T_RUNE', hue: '#6a7ae8' },
      { id: 'm_elemental_affinity', n: { en: 'Elemental Affinity', zh: '元素亲和' }, desc: { en: '+10% all element dmg', zh: '全元素伤害+10%' }, maxRank: 1, icon: '🌈', row: 0, col: 2, requires: ['m_arcane_power'], effect: 'all_el_dmg', valuePerRank: 10, tpl: 'T_FLASK', hue: '#e8c84a' },
      { id: 'm_spell_pen', n: { en: 'Spell Penetration', zh: '法穿' }, desc: { en: 'Ignore 20% enemy DEF', zh: '无视20%敌人防御' }, maxRank: 1, icon: '💫', row: 0, col: 3, requires: ['m_arcane_power'], effect: 'spell_pen', valuePerRank: 20, tpl: 'T_SWORD', hue: '#5a8ad6' },
      { id: 'm_mana_shield', n: { en: 'Mana Shield', zh: '法力护盾' }, desc: { en: 'Take 10% less dmg when MP>50%', zh: 'MP>50%时减伤10%' }, maxRank: 1, icon: '🛡', row: 1, col: 0, requires: ['m_mana_flow'], effect: 'mana_shield', valuePerRank: 10, tpl: 'T_SHIELD', hue: '#7aa8f0' },
      { id: 'm_frost_touch', n: { en: 'Frost Touch', zh: '冰霜之触' }, desc: { en: '15% slow on hit', zh: '15%概率减速敌人' }, maxRank: 1, icon: '❄', row: 1, col: 1, requires: ['m_mana_flow'], effect: 'on_hit_slow', valuePerRank: 15, tpl: 'T_ICE' },
      { id: 'm_fire_mastery', n: { en: 'Fire Mastery', zh: '火焰精通' }, desc: { en: '+20% fire damage', zh: '火焰伤害+20%' }, maxRank: 1, icon: '🔥', row: 1, col: 2, requires: ['m_elemental_affinity'], effect: 'el_dmg_fire', valuePerRank: 20, tpl: 'T_FIRE' },
      { id: 'm_chain_lightning', n: { en: 'Chain Lightning', zh: '连锁闪电' }, desc: { en: 'Skill chains to 2 extra foes', zh: '技能连锁至额外2个敌人' }, maxRank: 1, icon: '⚡', row: 1, col: 3, requires: ['m_spell_pen'], effect: 'skill_chain', valuePerRank: 2, tpl: 'T_RUNE', hue: '#5ad4e8' },
      { id: 'm_arcane_barrier', n: { en: 'Arcane Barrier', zh: '奥术屏障' }, desc: { en: '+3 DEF per rank', zh: '每级+3防御' }, maxRank: 2, icon: '🧿', row: 2, col: 0, requires: ['m_mana_shield'], effect: 'def', valuePerRank: 3, tpl: 'T_SHIELD', hue: '#4a6ac6' },
      { id: 'm_time_warp', n: { en: 'Time Warp', zh: '时间扭曲' }, desc: { en: 'MP regen +2 per tick', zh: 'MP回复+2/tick' }, maxRank: 1, icon: '⏳', row: 2, col: 1, requires: ['m_frost_touch'], effect: 'mp_regen', valuePerRank: 2, tpl: 'T_RUNE', hue: '#9a8ae8' },
      { id: 'm_blizzard', n: { en: 'Blizzard', zh: '暴风雪' }, desc: { en: 'Skill also slows enemies', zh: '技能同时减速敌人' }, maxRank: 1, icon: '🌨', row: 2, col: 2, requires: ['m_fire_mastery'], effect: 'skill_slow', valuePerRank: 1, tpl: 'T_ICE' },
      { id: 'm_meteor', n: { en: 'Meteor', zh: '陨石' }, desc: { en: 'Skill AoE radius +2', zh: '技能范围+2' }, maxRank: 1, icon: '☄', row: 2, col: 3, requires: ['m_chain_lightning'], effect: 'skill_radius', valuePerRank: 2, tpl: 'T_FIRE' },
      { id: 'm_archmage', n: { en: 'Archmage', zh: '大法师' }, desc: { en: 'Spell power +30%', zh: '法术强度+30%' }, maxRank: 1, icon: '🧙', row: 3, col: 0, requires: ['m_arcane_barrier'], effect: 'spellPower', valuePerRank: 30, tpl: 'T_CROWN', hue: '#8a5de8' },
      { id: 'm_mana_surge', n: { en: 'Mana Surge', zh: '法力涌动' }, desc: { en: 'Kill restores 10% MP', zh: '击杀回复10%MP' }, maxRank: 1, icon: '💎', row: 3, col: 1, requires: ['m_time_warp'], effect: 'kill_mp', valuePerRank: 10, tpl: 'T_RUNE', hue: '#6a8ae8' },
      { id: 'm_elemental_storm', n: { en: 'Elemental Storm', zh: '元素风暴' }, desc: { en: 'Skill uses random element', zh: '技能随机使用元素' }, maxRank: 1, icon: '🌪', row: 3, col: 2, requires: ['m_blizzard'], effect: 'skill_random_el', valuePerRank: 1, tpl: 'T_RUNE', hue: '#4ac4c4' },
      { id: 'm_reality_tear', n: { en: 'Reality Tear', zh: '现实撕裂' }, desc: { en: 'Skill CD halved', zh: '技能冷却减半' }, maxRank: 1, icon: '🕳', row: 3, col: 3, requires: ['m_meteor', 'm_elemental_storm'], effect: 'skill_cd_half', valuePerRank: 50, tpl: 'T_STAR', hue: '#5a8ad6' },
    ],
  },
  // Paladin (classIdx 3) — "Divine"
  {
    classIdx: 3,
    nodes: [
      { id: 'p_holy_str', n: { en: 'Holy Strength', zh: '圣力' }, desc: { en: '+2 ATK per rank', zh: '每级+2攻击' }, maxRank: 3, icon: '⚔', row: 0, col: 0, effect: 'atk', valuePerRank: 2, tpl: 'T_SWORD', hue: '#e8c84a' },
      { id: 'p_divine_shield', n: { en: 'Divine Shield', zh: '圣盾' }, desc: { en: '+2 DEF per rank', zh: '每级+2防御' }, maxRank: 3, icon: '🛡', row: 0, col: 1, effect: 'def', valuePerRank: 2, tpl: 'T_SHIELD', hue: '#6a8ad6' },
      { id: 'p_healing_light', n: { en: 'Healing Light', zh: '治愈之光' }, desc: { en: '+10% healing per rank', zh: '每级+10%治疗量' }, maxRank: 3, icon: '💚', row: 0, col: 2, effect: 'heal_bonus', valuePerRank: 10, tpl: 'T_HEART', hue: '#5ad46a' },
      { id: 'p_aura', n: { en: 'Aura of Protection', zh: '守护光环' }, desc: { en: '+5% dodge', zh: '闪避+5%' }, maxRank: 1, icon: '✨', row: 0, col: 3, requires: ['p_divine_shield'], effect: 'aura_dodge', valuePerRank: 5, tpl: 'T_SHIELD', hue: '#8ab0f0' },
      { id: 'p_righteous_fury', n: { en: 'Righteous Fury', zh: '正义之怒' }, desc: { en: '+3 ATK vs shadow foes', zh: '对暗影敌人+3攻击' }, maxRank: 1, icon: '🔥', row: 1, col: 0, requires: ['p_holy_str'], effect: 'bonus_vs_shadow', valuePerRank: 3, tpl: 'T_SWORD', hue: '#ff9a3c' },
      { id: 'p_blessed_endurance', n: { en: 'Blessed Endurance', zh: '祝福耐力' }, desc: { en: '+15 HP per rank', zh: '每级+15HP' }, maxRank: 3, icon: '❤', row: 1, col: 1, requires: ['p_divine_shield'], effect: 'maxhp', valuePerRank: 15, tpl: 'T_HEART', hue: '#e8756a' },
      { id: 'p_consecrate', n: { en: 'Consecrate', zh: '净化' }, desc: { en: 'Skill also deals holy dmg', zh: '技能同时造成神圣伤害' }, maxRank: 1, icon: '🌟', row: 1, col: 2, requires: ['p_healing_light'], effect: 'skill_holy_dmg', valuePerRank: 1, tpl: 'T_HOLY' },
      { id: 'p_judgment', n: { en: 'Divine Judgment', zh: '神圣审判' }, desc: { en: 'Skill also stuns 1 turn', zh: '技能同时眩晕1回合' }, maxRank: 1, icon: '⚡', row: 1, col: 3, requires: ['p_aura'], effect: 'skill_stun', valuePerRank: 1, tpl: 'T_STAFF', hue: '#8a5de8' },
      { id: 'p_lay_on_hands', n: { en: 'Lay on Hands', zh: '圣疗' }, desc: { en: 'Auto-heal 20% when HP<20%', zh: 'HP<20%时自动回复20%' }, maxRank: 1, icon: '🤲', row: 2, col: 0, requires: ['p_righteous_fury'], effect: 'auto_heal', valuePerRank: 20, tpl: 'T_HEART', hue: '#ff8a7a' },
      { id: 'p_sanctuary', n: { en: 'Sanctuary', zh: '庇护所' }, desc: { en: 'Immune to fear/stun', zh: '免疫恐惧和眩晕' }, maxRank: 1, icon: '🏛', row: 2, col: 1, requires: ['p_blessed_endurance'], effect: 'cc_immune', valuePerRank: 1, tpl: 'T_SHIELD', hue: '#4a6ac6' },
      { id: 'p_holy_nova', n: { en: 'Holy Nova', zh: '神圣新星' }, desc: { en: 'Skill also heals nearby', zh: '技能同时治疗附近友方' }, maxRank: 1, icon: '💫', row: 2, col: 2, requires: ['p_consecrate'], effect: 'skill_aoe_heal', valuePerRank: 1, tpl: 'T_STAR', hue: '#e8c84a' },
      { id: 'p_smite', n: { en: 'Smite', zh: '圣击' }, desc: { en: 'Skill dmg +40%', zh: '技能伤害+40%' }, maxRank: 1, icon: '🔨', row: 2, col: 3, requires: ['p_judgment'], effect: 'skill_dmg_up', valuePerRank: 40, tpl: 'T_SWORD', hue: '#ffd54a' },
      { id: 'p_champion', n: { en: 'Champion of Light', zh: '光明之冠' }, desc: { en: '+3 ATK, +3 DEF', zh: '+3攻击， +3防御' }, maxRank: 1, icon: '👑', row: 3, col: 0, requires: ['p_lay_on_hands'], effect: 'atk', valuePerRank: 3, tpl: 'T_CROWN', hue: '#e8c84a' },
      { id: 'p_intervention', n: { en: 'Divine Intervention', zh: '神圣干预' }, desc: { en: 'Revive to 50% HP once/run', zh: '每局自动复活至50%HP一次' }, maxRank: 1, icon: '👼', row: 3, col: 1, requires: ['p_sanctuary'], effect: 'auto_revive', valuePerRank: 50, tpl: 'T_WING', hue: '#f0e8c0' },
      { id: 'p_angelic_wrath', n: { en: 'Angelic Wrath', zh: '天使之怒' }, desc: { en: 'Holy dmg on every attack', zh: '每次攻击附加神圣伤害' }, maxRank: 1, icon: '⚡', row: 3, col: 2, requires: ['p_holy_nova'], effect: 'holy_on_hit', valuePerRank: 1, tpl: 'T_HOLY' },
      { id: 'p_resurrection', n: { en: 'Resurrection', zh: '复活' }, desc: { en: 'Auto-revive to 100% once', zh: '自动复活至满血一次' }, maxRank: 1, icon: '🌟', row: 3, col: 3, requires: ['p_smite', 'p_intervention'], effect: 'full_revive', valuePerRank: 100, tpl: 'T_STAR', hue: '#ffd54a' },
    ],
  },
];

// ===== Meta Upgrades (The Forge) =====
import type { MetaUpgradeDef } from './types.js';

export const META_UPGRADES: MetaUpgradeDef[] = [
  // Batch3c T3 tpl/hue routing: existing icon semantics migrate directly
  // (❤→T_HEART, 💧→T_FLASK, ⚔→T_SWORD, 🛡→T_SHIELD, 🗡→T_SWORD orange, 💨→T_BOOT,
  // 💰→T_COIN, 💚→T_HEART green, 🍖→T_MEAT, 🌟→T_STAR, 📖→T_BOOK, 👁→T_EYE,
  // 🎒→T_BOOT brown, 💎→T_COIN cyan, 💀→T_SKULL); icons without a clear
  // template fall back by category (utility→T_RUNE, endless→T_SHADOW). The
  // cyan base #4ad6c0 marks soul-echo meta-resource entries.
  { id: 'start_hp', n: { en: 'Vitality', zh: '生命强化' }, d: { en: '+10 Max HP per level', zh: '每级+10最大HP' }, icon: '❤', maxLevel: 5, costs: [10, 15, 25, 40, 60], effect: 'start_hp', valuePerLevel: 10, category: 'stats', tpl: 'T_HEART', hue: '#e05560' },
  { id: 'start_mp', n: { en: 'Arcane Reserves', zh: '魔力储备' }, d: { en: '+5 Max MP per level', zh: '每级+5最大MP' }, icon: '💧', maxLevel: 3, costs: [10, 20, 35], effect: 'start_mp', valuePerLevel: 5, category: 'stats', tpl: 'T_FLASK', hue: '#5a8ad6' },
  { id: 'start_atk', n: { en: 'Martial Training', zh: '武技' }, d: { en: '+1 ATK per level', zh: '每级+1攻击' }, icon: '⚔', maxLevel: 3, costs: [15, 30, 50], effect: 'start_atk', valuePerLevel: 1, category: 'stats', tpl: 'T_SWORD', hue: '#e05545' },
  { id: 'start_def', n: { en: 'Toughness', zh: '坚韧' }, d: { en: '+1 DEF per level', zh: '每级+1防御' }, icon: '🛡', maxLevel: 3, costs: [15, 30, 50], effect: 'start_def', valuePerLevel: 1, category: 'stats', tpl: 'T_SHIELD', hue: '#6a8ad6' },
  { id: 'crit_bonus', n: { en: 'Keen Edge', zh: '锐锋' }, d: { en: '+3% crit chance per level', zh: '每级+3%暴击' }, icon: '🗡', maxLevel: 3, costs: [20, 35, 55], effect: 'crit_bonus', valuePerLevel: 3, category: 'stats', tpl: 'T_SWORD', hue: '#ff9a3c' },
  { id: 'dodge_bonus', n: { en: 'Nimble', zh: '灵巧' }, d: { en: '+2% dodge chance per level', zh: '每级+2%闪避' }, icon: '💨', maxLevel: 3, costs: [20, 35, 55], effect: 'dodge_bonus', valuePerLevel: 2, category: 'stats', tpl: 'T_BOOT', hue: '#6cc46c' },
  { id: 'start_gold', n: { en: 'Inheritance', zh: '遗产' }, d: { en: '+15 starting gold per level', zh: '每级+15初始金币' }, icon: '💰', maxLevel: 3, costs: [10, 20, 35], effect: 'start_gold', valuePerLevel: 15, category: 'survival', tpl: 'T_COIN', hue: '#ffd54a' },
  { id: 'heal_bonus', n: { en: 'Regeneration', zh: '再生' }, d: { en: '+5% healing from all sources', zh: '所有治疗效果+5%' }, icon: '💚', maxLevel: 3, costs: [20, 40, 65], effect: 'heal_bonus', valuePerLevel: 5, category: 'survival', tpl: 'T_HEART', hue: '#5ad46a' },
  { id: 'start_food', n: { en: 'Well Fed', zh: '饱食' }, d: { en: '+20 starting hunger per level', zh: '每级+20初始饱食度' }, icon: '🍖', maxLevel: 2, costs: [10, 20], effect: 'start_food', valuePerLevel: 20, category: 'survival', tpl: 'T_MEAT', hue: '#c47a4a' },
  { id: 'extra_talent', n: { en: 'Gifted', zh: '天赋' }, d: { en: '+1 bonus talent point at start', zh: '开局额外+1天赋点' }, icon: '🌟', maxLevel: 3, costs: [25, 50, 80], effect: 'extra_talent', valuePerLevel: 1, category: 'talent', tpl: 'T_STAR', hue: '#8a5de8' },
  { id: 'exp_bonus', n: { en: 'Wisdom', zh: '智慧' }, d: { en: '+10% experience gain', zh: '经验获取+10%' }, icon: '📖', maxLevel: 3, costs: [25, 45, 70], effect: 'exp_bonus', valuePerLevel: 10, category: 'talent', tpl: 'T_BOOK', hue: '#c8a86a' },
  { id: 'fov_bonus', n: { en: 'Eagle Eye', zh: '鹰眼' }, d: { en: '+1 FOV radius per level', zh: '每级+1视野范围' }, icon: '👁', maxLevel: 2, costs: [20, 40], effect: 'fov_bonus', valuePerLevel: 1, category: 'utility', tpl: 'T_EYE', hue: '#6ad4d4' },
  { id: 'inv_size', n: { en: 'Pack Mule', zh: '驮兽' }, d: { en: '+4 inventory slots per level', zh: '每级+4背包容量' }, icon: '🎒', maxLevel: 2, costs: [15, 30], effect: 'inv_size', valuePerLevel: 4, category: 'utility', tpl: 'T_BOOT', hue: '#a8784a' },
  { id: 'gold_bonus', n: { en: 'Greed', zh: '贪婪' }, d: { en: '+10% gold earned', zh: '金币获取+10%' }, icon: '💎', maxLevel: 3, costs: [15, 30, 50], effect: 'gold_bonus', valuePerLevel: 10, category: 'utility', tpl: 'T_COIN', hue: '#4ad6c0' },
  { id: 'soul_bonus', n: { en: 'Soul Attunement', zh: '灵魂共鸣' }, d: { en: '+10% Soul Echoes earned', zh: '灵魂回响获取+10%' }, icon: '💀', maxLevel: 3, costs: [30, 60, 100], effect: 'soul_bonus', valuePerLevel: 10, category: 'utility', tpl: 'T_SKULL', hue: '#4ad6c0' },
  { id: 'start_relic', n: { en: 'Heirloom', zh: '传家宝' },
    d: { en: 'Start each run with a random rarity-1 relic', zh: '每局开局获得一个随机稀有度1圣物' },
    icon: '🏺', maxLevel: 1, costs: [40], effect: 'start_relic',
    valuePerLevel: 1, category: 'utility', tpl: 'T_RUNE', hue: '#d8a84a' },
  { id: 'blood_pact', n: { en: 'Blood Pact', zh: '鲜血契约' },
    d: { en: '-10 max HP per level, +1 talent point per level', zh: '每级-10最大生命，+1天赋点' },
    icon: '🩸', maxLevel: 2, costs: [30, 60], effect: 'blood_pact',
    valuePerLevel: 1, category: 'talent', tpl: 'T_FLASK', hue: '#c84040' },
  // Endless-only meta upgrades (Task 4): apply only in endless runs via applyMetaUpgrades gate.
  { id: 'deep_start', n: { en: 'Deep Start', zh: '深度起跳' }, d: { en: 'Endless starts +5 floors/rank', zh: '无尽开局楼层+5/级' }, icon: '↓', maxLevel: 5, costs: [200, 400, 700, 1100, 1600], effect: 'deep_start', valuePerLevel: 5, category: 'endless', tpl: 'T_SHADOW' },
  { id: 'void_resist', n: { en: 'Void Resist', zh: '虚空抗性' }, d: { en: '+10% all resist/rank (endless)', zh: '全抗+10%/级(无尽)' }, icon: '◈', maxLevel: 5, costs: [150, 300, 500, 800, 1200], effect: 'void_resist', valuePerLevel: 10, category: 'endless', tpl: 'T_SHADOW' },
  { id: 'endless_luck', n: { en: 'Endless Luck', zh: '无尽幸运' }, d: { en: '+20% endless drop rate/rank', zh: '无尽掉率+20%/级' }, icon: '★', maxLevel: 5, costs: [200, 400, 700, 1100, 1600], effect: 'endless_luck', valuePerLevel: 20, category: 'endless', tpl: 'T_STAR', hue: '#ffd54a' },
  { id: 'corruption_ward', n: { en: 'Corruption Ward', zh: '腐化守护' }, d: { en: '-15% corruption/rank', zh: '腐化-15%/级' }, icon: '🜔', maxLevel: 5, costs: [150, 300, 500, 800, 1200], effect: 'corruption_ward', valuePerLevel: 15, category: 'endless', tpl: 'T_SHADOW' },
  { id: 'endless_might', n: { en: 'Endless Might', zh: '无尽之力' }, d: { en: '+5% atk/spell/rank (endless)', zh: '攻击法强+5%/级(无尽)' }, icon: '⚔', maxLevel: 5, costs: [300, 600, 1000, 1500, 2200], effect: 'endless_might', valuePerLevel: 5, category: 'endless', tpl: 'T_SWORD', hue: '#c8452c' },
];

// ===== Endless-exclusive gear (F41+) — Task 1 =====
// Standalone pool (NOT merged into ALL_*); consumed only by genEndlessGear in
// item-gen.ts. Rarity 5, themed void/abyss/astral. ch chars are display glyphs
// only — kept distinct from key ALL_* items where possible. 'set' routes each
// piece into one of the three new EQUIPMENT_SETS (void_gear/abyss_gear/astral_gear).
export interface EndlessWeaponPiece { id?: string; flavor?: I18nText; n: I18nText; r: number; a: number; ch: string; el: Element; set: string; }
export interface EndlessArmorPiece { id?: string; flavor?: I18nText; n: I18nText; r: number; d: number; ch: string; el?: Element; set: string; }
export interface EndlessAccPiece { id?: string; flavor?: I18nText; n: I18nText; r: number; a: number; d: number; h: number; ch: string; set: string; }
export const ENDLESS_GEAR: {
  weapons: EndlessWeaponPiece[];
  armors: EndlessArmorPiece[];
  accessories: EndlessAccPiece[];
} = {
  weapons: [
    { id: 'endless_void_blade', n: { en: 'Void Blade', zh: '虚空之刃' }, r: 5, a: 14, ch: '/', el: 'shadow', set: 'void_gear',
      flavor: { en: 'The blade of an unnamed smith who lingers only in the void; the steel has no body; each swing briefly opens a slit in reality.', zh: '仅存于虚空深处的失名铸匠所留之刃，剑身没有实体，挥动时只是从现实中划开一道暂时的缝。' } },
    { id: 'endless_abyss_staff', n: { en: 'Abyss Staff', zh: '深渊法杖' }, r: 5, a: 11, ch: '|', el: 'shadow', set: 'abyss_gear',
      flavor: { en: 'Its shaft is congealed abyssal tide, its crown a sinking pearl that never rises; it drives a caster\'s spells down to the sea-floor.', zh: '以凝固的深渊潮水为杖身，顶端封着一颗永不浮起的沉珠，能将施法者的咒文压入海底。' } },
    { id: 'endless_star_bow', n: { en: 'Star Bow', zh: '星辰长弓' }, r: 5, a: 13, ch: ')', el: 'holy', set: 'astral_gear',
      flavor: { en: 'The limbs are carved from the spine of a fallen star; drawn full, the string hums like an old orbit, and the arrow leaves a light that lingers.', zh: '弓臂以一颗陨落星辰的脊骨削成，拉满时弓弦嗡鸣如远古星轨，箭到之处光痕不散。' } },
  ],
  armors: [
    { id: 'endless_void_armor', n: { en: 'Void Armor', zh: '虚空护甲' }, r: 5, d: 12, ch: '[', el: 'shadow', set: 'void_gear',
      flavor: { en: 'Armor shaped from congealed void, its weight impossible to gauge; to wear it is to stand outside all time, each breath drawn out long.', zh: '由凝固虚空塑成的护甲，重量难以衡量，穿上后仿佛身处一切时间之外，连呼吸都变得缓慢。' } },
    { id: 'endless_abyss_cape', n: { en: 'Abyss Cape', zh: '深渊斗篷' }, r: 5, d: 8, ch: ']', set: 'abyss_gear',
      flavor: { en: 'A ceremonial weave from a deep-sea silk-spinner; its lining is ever damp, and the wearer catches the low chant of distant trenches.', zh: '深海织妖以自身丝线编成的礼袍，斗篷内衬永远潮湿，披上它的人能听见远方海沟的低吟。' } },
    { id: 'endless_astral_aegis', n: { en: 'Astral Aegis', zh: '星辰护盾' }, r: 5, d: 11, ch: '}', el: 'holy', set: 'astral_gear',
      flavor: { en: 'A round shield congealed from starlight; it has no body until an attack comes, and only then briefly outlines itself in the world.', zh: '以星光凝结成的圆盾，盾面没有实体，只有当攻击袭来时才会在现实里短暂地显出轮廓。' } },
  ],
  accessories: [
    { id: 'endless_void_ring', n: { en: 'Void Ring', zh: '虚空戒指' }, r: 5, a: 3, d: 2, h: 30, ch: '"', set: 'void_gear',
      flavor: { en: 'The band is cast from a length of forgotten time; wearing it, one hears memories that never were, and on removal remembers nothing.', zh: '戒环由一段被遗忘的时间铸成，戴上后能短暂听见从未发生过的回忆，摘下时却什么都想不起。' } },
    { id: 'endless_abyss_amulet', n: { en: 'Abyss Amulet', zh: '深渊护符' }, r: 5, a: 2, d: 3, h: 40, ch: '"', set: 'abyss_gear',
      flavor: { en: 'A black pearl a thousand years in the abyssal oyster; cold against the chest year-round, and said to hold the wearer\'s final breath inside.', zh: '深渊巨蚌内孕育千年的黑珠，悬于胸前终年冰凉，据说能将佩戴者的最后一口气封存其中。' } },
  ],
};

// ===== Relics (run-defining passive artifacts) =====
import type { RelicDef } from './types.js';

export const RELICS: RelicDef[] = [
  // Offense
  { id: 'war_totem', n: { en: 'War Totem', zh: '战神图腾' }, d: { en: '+15% ATK', zh: '+15% 攻击力' }, ch: '⚒️', c: '#e63946', rarity: 1, effect: 'atk_pct', value: 15, spriteKind: 'R_ATTACK',
    flavor: { en: 'Quenched in beast-bone and enemy blood by tribal war-shamans; its bearer hears the drums of old battlefields.', zh: '蛮族战巫以兽骨与敌血淬炼的图腾，持握者能听见远古战场的鼓点。' } },
  { id: 'assassin_sigil', n: { en: "Assassin's Sigil", zh: '刺客印记' }, d: { en: '+12% crit chance', zh: '+12% 暴击率' }, ch: '🗡️', c: '#9b5de5', rarity: 2, effect: 'crit', value: 12, spriteKind: 'R_ATTACK',
    flavor: { en: 'Branded onto an apprentice\'s palm by a master on his deathbed; the marked cannot hide in shadow, nor be taken back by the light.', zh: '刺客大师临终前烙于爱徒掌心的符印，被印记的人在阴影中无所遁形，亦无法再被光明接纳。' } },
  { id: 'executioners_axe', n: { en: "Executioner's Axe", zh: '处刑者之斧' }, d: { en: '+40% dmg to foes below 30% HP', zh: '对生命低于30%的敌人+40%伤害' }, ch: '🪓', c: '#ff4500', rarity: 2, effect: 'execute', value: 40, spriteKind: 'R_ATTACK',
    flavor: { en: 'Three generations of headsman put a thousand necks to this axe; the edge needs no honing, and some say it finds the bone on its own.', zh: '三代行刑官用同一柄斧累积了千余次斩首，斧刃早已不必再磨，传说它会自己寻找颈骨。' } },
  // Sustain / survival
  { id: 'vampiric_fang', n: { en: 'Vampiric Fang', zh: '吸血獠牙' }, d: { en: 'Heal 15% of damage dealt', zh: '造成伤害的15%转化为生命' }, ch: '🦷', c: '#b5179e', rarity: 2, effect: 'lifesteal', value: 15, spriteKind: 'R_ATTACK',
    flavor: { en: 'An upper canine drawn from an ancient blood-drinker; hung at the throat, it warms and cools with the moon, and trembles near fresh blood.', zh: '取自一只古老血族的下颚犬齿，挂在颈间会随月相变冷变热，并在鲜血附近微微震颤。' } },
  { id: 'phoenix_heart', n: { en: 'Phoenix Heart', zh: '凤凰之心' }, d: { en: 'Revive once at 50% HP', zh: '死亡时复活一次（50%生命）' }, ch: '🔥', c: '#ff6b35', rarity: 4, effect: 'revive', value: 50, spriteKind: 'R_SOUL',
    flavor: { en: 'Embers of a phoenix whose burning failed; warm forever in the palm, and said to flare one last fire as its bearer dies.', zh: '传说一只自焚未死的凤凰遗下的余烬，握于掌心始终温热，据说能在佩戴者断气时燃起最后一次火。' } },
  { id: 'stone_skin', n: { en: 'Stone Skin', zh: '石肤符文' }, d: { en: '+5 DEF', zh: '+5 防御' }, ch: '🪨', c: '#8d99ae', rarity: 1, effect: 'def', value: 5, spriteKind: 'R_DEFENSE',
    flavor: { en: 'A ward carved by dwarven runecasters on mountain-heart stone; the skin turns rough as rock, but heat and cold grow faint.', zh: '矮人符文师在山心石上刻下的护身符，佩戴后皮肤触之如粗岩，却也变得难以感知冷暖。' } },
  { id: 'giants_belt', n: { en: "Giant's Belt", zh: '巨人腰带' }, d: { en: '+40 Max HP', zh: '+40 最大生命' }, ch: '🟫', c: '#06d6a0', rarity: 1, effect: 'maxhp', value: 40, spriteKind: 'R_DEFENSE',
    flavor: { en: 'A girdle dropped by an ancient frost-giant, its leather still showing the owner\'s coarse mending; on a mortal frame the bones creak faintly.', zh: '远古冰霜巨人遗落的腰封，皮带上还留着主人粗犷的缝补痕迹，凡人系上后骨骼会发出轻微的咯吱声。' } },
  // Elements
  { id: 'ember_core', n: { en: 'Ember Core', zh: '余烬核心' }, d: { en: 'Attacks deal bonus fire damage', zh: '攻击附加火焰伤害' }, ch: '🌟', c: '#ff7a45', rarity: 2, effect: 'el_fire', value: 6, spriteKind: 'R_ATTACK',
    flavor: { en: 'A shard of the fire-heart left by a fallen fire-demon; the ember within has burned a thousand years, and brings to mind every unspoken rage.', zh: '炎魔陨落后残存的火心碎片，核心内的余火千年不灭，靠近时会让人想起所有未曾说出口的愤怒。' } },
  { id: 'frost_heart', n: { en: 'Frost Heart', zh: '冰霜之心' }, d: { en: 'Bonus ice dmg + 20% slow chance', zh: '附加冰霜伤害，20%几率减速' }, ch: '❄️', c: '#7ec8e3', rarity: 2, effect: 'el_ice', value: 6, spriteKind: 'R_NATURE',
    flavor: { en: 'The still-beating heart of an ice-beast from the deep permafrost; the wearer\'s chest runs cold year-round, and the breath carries frost.', zh: '永冻层深处一头冰兽的心脏，至今仍在缓慢跳动，佩戴者胸口常年冰凉，连呼吸都带着白霜。' } },
  // Economy
  { id: 'greed_idol', n: { en: 'Greed Idol', zh: '贪婪神像' }, d: { en: '+30% gold from kills', zh: '击杀金币+30%' }, ch: '💰', c: '#ffd700', rarity: 1, effect: 'gold_pct', value: 30, spriteKind: 'R_UTILITY',
    flavor: { en: 'Cast from a miser-king melted down with his gold; its eyes are two unspent coins, and those who stare grow fonder of brass.', zh: '一位吝啬之王被熔进金币后铸成的小像，神像的眼睛仍是两枚未熔尽的金币，凝视者会愈发贪恋黄铜。' } },
  { id: 'scholar_lens', n: { en: 'Scholar Lens', zh: '学者透镜' }, d: { en: '+25% XP', zh: '经验+25%' }, ch: '📖', c: '#4895ef', rarity: 1, effect: 'exp_pct', value: 25, spriteKind: 'R_ARCANE',
    flavor: { en: 'A crystal lens left by the last dean of a lost academy; the world seen through it grows sharp, while the viewer\'s own name slips slowly away.', zh: '失落学院最后一位院长遗下的水晶镜片，透过它看世界会显得格外清晰，却也让看的人渐渐遗忘自己的姓名。' } },
  // Magic
  { id: 'arcane_focus', n: { en: 'Arcane Focus', zh: '奥术聚焦' }, d: { en: '+25% spell power', zh: '+25% 法术强度' }, ch: '🔮', c: '#9b5de5', rarity: 2, effect: 'spell_pct', value: 25, spriteKind: 'R_ARCANE',
    flavor: { en: 'A sliver of the crystal pillar an archmage fused with his power; in the hand it clarifies every spell, sometimes murmuring with a former master\'s voice.', zh: '上古大法师熔入自身法力的晶柱碎片，握持时咒文显得格外清晰，却也让施法者偶尔听见前主人的低语。' } },
  // Counter
  { id: 'thorned_bramble', n: { en: 'Thorned Bramble', zh: '荆棘护甲' }, d: { en: 'Reflect 30% of damage taken', zh: '反弹30%受到的伤害' }, ch: '🌵', c: '#06d6a0', rarity: 2, effect: 'thorns', value: 30, spriteKind: 'R_DEFENSE',
    flavor: { en: 'Living armor gifted by a sentient bramble in the deep corrupted wood; it feeds on the wearer\'s blood, and returns each pain twice to the striker.', zh: '腐林深处有意识的荆棘所赠的活体护甲，护甲会以佩戴者的血为养，将每一份痛楚加倍奉还给攻击者。' } },
  // Wave 4-C3 — on-kill / on-dodge / on-crit triggers + r0/r3 fill
  { id: 'soul_harvester', n: { en: 'Soul Harvester', zh: '猎魂者' }, d: { en: 'Kills restore 10% MP', zh: '击杀回复10%MP' }, ch: '💀', c: '#9b5de5', rarity: 2, effect: 'kill_mp', value: 10, spriteKind: 'R_SOUL',
    flavor: { en: 'A ring forged of bone and soul-flame by a necromancer; each time a life winks out in sight, the ring flares a quiet blue.', zh: '死灵法师以骨与魂火锻成的指环，每有生灵在视野中熄灭，指环便会亮起一抹幽蓝。' } },
  { id: 'wind_step', n: { en: 'Wind Step', zh: '御风步' }, d: { en: 'Dodging heals 8% HP', zh: '闪避回复8%HP' }, ch: '🌬', c: '#7ec8e3', rarity: 2, effect: 'dodge_hp', value: 8, spriteKind: 'R_NATURE',
    flavor: { en: 'A gossamer ward that condensed from the last footprints of a wandering wind-monk; the wearer treads light as air, and never makes a sound again.', zh: '风行僧侣圆寂后留下的脚印所化的轻纱符，佩戴者步履轻盈如风，却再也踩不出声响。' } },
  { id: 'executioner_pact', n: { en: 'Executioner Pact', zh: '处刑契约' }, d: { en: 'Crits heal 15% of damage', zh: '暴击吸取15%伤害' }, ch: '⚔', c: '#b91c3c', rarity: 3, effect: 'crit_lifesteal', value: 15, spriteKind: 'R_ATTACK',
    flavor: { en: 'A blood-pact with a nameless executioner-spirit; each killing blow brings a wisp of soul-fire not one\'s own surging into the heart.', zh: '与无名处刑之灵订立的血契符文，契约者每次挥出致命一击，都会有一缕不属于他的魂火涌入心脏。' } },
  { id: 'worn_amulet', n: { en: 'Worn Amulet', zh: '磨损护符' }, d: { en: '+10 max HP', zh: '+10 最大生命' }, ch: '📿', c: '#8b7355', rarity: 0, effect: 'hp', value: 10, spriteKind: 'R_ARCANE',
    flavor: { en: 'An old ward a nameless mother slipped into her son\'s pack at parting; the chain is broken, the face worn smooth, yet its warmth outlasts any artifact.', zh: '一位无名母亲临别时塞进游子行囊的旧护符，铜链已断，符面磨平，余温却比任何神器都更长。' } },
  // Wave 8 — "前任遗物": dropped by The Warden. Each maps to ONE existing hook
  // (one new case per handler) to stay low-risk and testable.
  { id: 'warden_cloak', n: { en: 'Warden Cloak', zh: '守渊人斗篷' }, d: { en: '+10% dodge chance', zh: '+10% 闪避率' }, ch: '🧥', c: '#9a2be2', rarity: 3, effect: 'dodge', value: 10, spriteKind: 'R_DEFENSE',
    flavor: { en: 'Left behind when a Warden of the Deeps fell; the lining still carries the abyssal cold, and at close range a single faint sigh arrives from afar.', zh: '据说是某任守渊人陨落后留下的斗篷，披风内衬仍残留着渊底的寒气，靠近时能听见极远处的一声叹息。' } },
  { id: 'fallen_blade', n: { en: 'Fallen Blade', zh: '前任之刃' }, d: { en: 'Crits heal 18% of damage', zh: '暴击吸取18%伤害' }, ch: '🗡', c: '#b91c3c', rarity: 3, effect: 'crit_lifesteal', value: 18, spriteKind: 'R_ATTACK',
    flavor: { en: 'The side-blade of a Warden who failed; the grip-wrap is blackened, and at every swing the spine weeps a former owner\'s death-cold hate.', zh: '曾属于一位失败守渊人的佩刃，剑柄缠皮已发黑，挥动时剑脊会渗出原主临终时未冷的恨意。' } },
  { id: 'memory_shard', n: { en: 'Memory Shard', zh: '记忆碎片' }, d: { en: '+30% XP', zh: '经验+30%' }, ch: '🔮', c: '#4895ef', rarity: 3, effect: 'exp_pct', value: 30, spriteKind: 'R_ARCANE',
    flavor: { en: 'A crystal of memory settled out of broken time; held in the palm, it flickers with strangers\' faces, most often the road its holder never walked.', zh: '破碎时空沉淀下的记忆结晶，握于掌心会闪过陌生人的脸庞，被看见的，往往是自己未曾走过的另一条路。' } },
  // Wave 6d / Endless content (Task 2): F41+ exclusive rarity-5 relics.
  // Effects are wired in relics.ts (applyRelicBonuses/relicOnHitEnemy),
  // combat.ts (applyCorruption), talents.ts (getCritMultiplier), game.ts (enterFloor).
  { id: 'void_heart', n: { en: 'Void Heart', zh: '虚空之心' }, d: { en: '+spellPower by floor', zh: '法强随楼层增长' }, ch: '♥', c: '#9b5de5', rarity: 5, effect: 'spell_floor', value: 0, spriteKind: 'R_VOID',
    flavor: { en: 'A beating black core dragged up from the depths of the void; each pulse blurs the edge of the real, and the holder slowly forgets his shadow.', zh: '自虚空深处打捞而得的搏动黑核，每下跳动都让现实的边缘微微失真，持有者会逐渐忘记自己的影子。' } },
  { id: 'abyss_eye', n: { en: 'Abyss Eye', zh: '深渊之眼' }, d: { en: '+30% dmg vs void foes', zh: '对虚空系敌人+30%伤害' }, ch: '◉', c: '#7b2fbe', rarity: 5, effect: 'dmg_void', value: 30, spriteKind: 'R_VOID',
    flavor: { en: 'One of an abyssal dweller\'s thousand eyes, set as a gem; the pupil turns as void-things draw near, and those who stare too long dream of the sea-floor.', zh: '深渊居民的千眼之一被凝固成宝石，瞳孔会随虚空生物的接近而转动，盯它太久的人会做海底的梦。' } },
  { id: 'eternal_sand', n: { en: 'Eternal Sand', zh: '永恒之沙' }, d: { en: '-50% corruption', zh: '腐化获取减半' }, ch: '⌛', c: '#e0c060', rarity: 5, effect: 'corruption_half', value: 0, spriteKind: 'R_VOID',
    flavor: { en: 'Taken from an hourglass long since stopped; the grains fall forever in the palm yet never add up, and time slips through the holder\'s fingers.', zh: '取自一个早已停摆的沙漏，沙粒在掌中永远下落却从不增多，握住它的人感觉时间在指缝间悄悄溜走。' } },
  { id: 'star_core', n: { en: 'Star Core', zh: '星辰之核' }, d: { en: '+crit dmg by floor', zh: '暴伤随楼层增长' }, ch: '✦', c: '#ffd700', rarity: 5, effect: 'crit_floor', value: 0, spriteKind: 'R_ARCANE',
    flavor: { en: 'The condensed core of a fallen star; blinding in the palm, and said to burn brighter with every floor its bearer descends.', zh: '一颗陨落恒星的浓缩核心，握于掌心光芒刺眼，据说会随佩戴者走过的每一层楼而愈发炽烈。' } },
  { id: 'chaos_egg', n: { en: 'Chaos Egg', zh: '混沌之卵' }, d: { en: '+atk by echoes', zh: '攻击随回响增长' }, ch: '◎', c: '#ff1493', rarity: 5, effect: 'atk_echoes', value: 0, spriteKind: 'R_VOID',
    flavor: { en: 'An unformed egg hatched out of primal chaos; the patterns shift without rest, and nearby one hears several versions of one\'s own breath.', zh: '自混沌原初孵出的未成形之卵，表面纹路不断变幻，靠近它的人会听见自己回响着数个版本的呼吸。' } },
  { id: 'null_crown', n: { en: 'Null Crown', zh: '虚无之冕' }, d: { en: 'buff each floor', zh: '每层随机增益' }, ch: '♔', c: '#e0e0ff', rarity: 5, effect: 'buff_floor', value: 0, spriteKind: 'R_VOID',
    flavor: { en: 'The kings who wore it are all nameless now; it bears no gems, only a few small voids turning slowly; the wearer forgets one thing each day.', zh: '戴上它的王者皆已无名，王冠上没有宝石，只有几个仍在缓慢旋转的小型虚空，戴上者每天会忘掉一件事。' } },
];
