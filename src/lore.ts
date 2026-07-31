// Lore Codex entries (Wave 8). Pure data leaf — bilingual, sourced from
// docs/lore. renderCodex (main.ts) groups by cat; entries whose id is NOT in
// MetaSave.unlockedLore render as "???". Area ids mirror data.ts AREAS; boss
// ids are boss:<fl> so combat's unlockLore('boss:'+G.floor) resolves here.
import type { I18nText } from './types.js';

export type LoreCat = 'world' | 'area' | 'boss' | 'relic' | 'warden';
export interface LoreEntry {
  id: string;
  cat: LoreCat;
  n: I18nText;
  body: I18nText;
}

export const LORE_CATS: { id: LoreCat; label: I18nText }[] = [
  { id: 'world',  label: { en: 'The World',  zh: '世界' } },
  { id: 'area',   label: { en: 'Realms',     zh: '区域' } },
  { id: 'boss',   label: { en: 'Adversaries',zh: '强敌' } },
  { id: 'warden', label: { en: 'The Warden', zh: '守渊人' } },
  { id: 'relic',  label: { en: 'Relics',     zh: '圣物' } },
];

export const LORE_ENTRIES: LoreEntry[] = [
  // --- World (default-unlocked) ---
  { id: 'world:descent', cat: 'world', n: { en: 'The Descent', zh: '下探' },
    body: { en: 'The Abyss is not a dungeon but a wound in reality, sealed a thousand years ago with a living heart. Every Descender is sent to slay its warden — none know the cost.', zh: '暗渊不是地牢，而是现实的伤口，千年前以一颗活心封印。每个下探者都被派来斩杀守护者——无人知晓代价。' } },
  { id: 'world:creator', cat: 'world', n: { en: 'The Creator', zh: '创世者' },
    body: { en: 'Not a god, but a guardian imprisoned as the seal\'s living core. They never fell — they merely grew tired. They long for death. Slaying them shatters the seal.', zh: '并非神祇，而是被封作封印活心的守护者。Ta 从未堕落——只是累了。Ta 渴望死亡。杀 Ta，即碎封印。' } },

  // --- Areas (8) ---
  { id: 'area:caves',    cat: 'area', n: { en: 'The Caverns', zh: '地下洞穴' }, body: { en: 'F1-5. The rift\'s mouth — a graveyard of new Descenders. Damp, primal, lightly corrupted.', zh: 'F1-5。裂口地表，新下探者的坟场。潮湿、原始，腐化最浅。' } },
  { id: 'area:crypts',   cat: 'area', n: { en: 'Ancient Crypts', zh: '远古墓穴' }, body: { en: 'F6-10. The burial ground of the first civilization that tried — and failed — to seal the Abyss.', zh: 'F6-10。第一代试图封印深渊的失败文明的葬地。' } },
  { id: 'area:depths',   cat: 'area', n: { en: 'Burning Depths', zh: '灼热深渊' }, body: { en: 'F11-15. The forge where the seal was cast. The furnace cracked; fire elementals are its leaking shards.', zh: 'F11-15。锻造封印的熔炉所在。炉裂地泄，火元素是封印碎片的泄漏。' } },
  { id: 'area:fortress', cat: 'area', n: { en: 'Dark Fortress', zh: '暗黑堡垒' }, body: { en: 'F16-20. Garrison of the Seal Wardens — generations of soldiers, now all corrupted into undeath.', zh: 'F16-20。守印者军团的驻地。世代戍守的战士如今尽被腐化为不死。' } },
  { id: 'area:dragon',   cat: 'area', n: { en: "Dragon's Domain", zh: '龙之领域' }, body: { en: 'F21-25. Beasts the Warders once tamed, gone feral and twisted as the seal loosened.', zh: 'F21-25。守印者驯养的巨兽，封印松动后野化扭曲。' } },
  { id: 'area:abyss',    cat: 'area', n: { en: 'The Abyss', zh: '无尽深渊' }, body: { en: 'F26-30. The seal gapes; the Abyss itself seeps through. Something watches from below.', zh: 'F26-30。封印裂缝已大，深渊本体渗入。有什么东西在下方注视。' } },
  { id: 'area:void',     cat: 'area', n: { en: 'Void Realm', zh: '虚空领域' }, body: { en: 'F31-35. Reality buckles here. Colors that should not exist hurt your eyes.', zh: 'F31-35。现实在此崩坏。不该存在的颜色刺痛双眼。' } },
  { id: 'area:sanctum',  cat: 'area', n: { en: 'The Final Sanctum', zh: '最终圣殿' }, body: { en: 'F36-40. The seal\'s heart — the Creator\'s cage and throne. The holy light is their thousand-year will.', zh: 'F36-40。封印的心脏，创世者的囚笼与王座。圣光是 Ta 千年未熄的意志。' } },

  // --- Bosses (8, keyed boss:<fl>) ---
  { id: 'boss:5',  cat: 'boss', n: { en: 'Goblin King', zh: '哥布林王' }, body: { en: 'A petty tyrant of the rift\'s mouth. A small, early foe of no consequence to the main story.', zh: '裂口地表的小暴君，与主线无关的早期小角色。' } },
  { id: 'boss:10', cat: 'boss', n: { en: 'Spider Queen', zh: '蜘蛛女王' }, body: { en: 'Broodmother of the crypts, laying eggs among the graves to guard them.', zh: '墓穴深处的育母，在坟茔间产卵守墓。' } },
  { id: 'boss:15', cat: 'boss', n: { en: 'Vampire Lord', zh: '吸血鬼领主' }, body: { en: 'An old noble corrupted by the Abyss, draining blood to cling to a half-life.', zh: '被深渊腐化的旧贵族，嗜血以求半生。' } },
  { id: 'boss:20', cat: 'boss', n: { en: 'Elder Lich', zh: '远古巫妖' }, body: { en: 'Commander of the Seal Warders, who embraced undeath to guard the seal forever — now mad. He remembers the Creator, but forgets why he guards.', zh: '守印者军团统帅，为永守封印而转生不死，如今已疯。他记得创世者，却忘了为何而守。' } },
  { id: 'boss:25', cat: 'boss', n: { en: 'Dragon Emperor', zh: '龙皇' }, body: { en: 'The last twisted guardian-beast, holding the gate to the Abyss itself.', zh: '最后一只扭曲的守护巨兽，守着通往深渊本体的入口。' } },
  { id: 'boss:30', cat: 'boss', n: { en: 'Leviathan', zh: '利维坦' }, body: { en: 'A beast born as the Abyss\'s body first seeped through the cracked seal.', zh: '深渊本体随封印裂缝渗入后诞生的巨兽。' } },
  { id: 'boss:35', cat: 'boss', n: { en: 'Void Sovereign', zh: '虚空君主' }, body: { en: 'An entity that seeped through the fractured seal from beyond reality.', zh: '自现实之外、沿封印裂纹渗出的实体。' } },
  { id: 'boss:40', cat: 'boss', n: { en: 'The Creator', zh: '创世者' }, body: { en: 'The tragic guardian who begs for death. To strike them down is to shatter the seal you came to protect.', zh: '求死的悲剧守护者。击倒 Ta，便是亲手击碎你来此守护的封印。' } },

  // --- Warden (encounter default-unlocked on first spawn; memories via Task 4) ---
  { id: 'warden:encounter', cat: 'warden', n: { en: 'The Warden', zh: '守渊人' }, body: { en: 'A former Descender, absorbed by the Abyss and remade as its immune hound. It stalks you across floors. Kill it for a relic of the fallen — or descend and lose it.', zh: '前代下探者，被深渊吞噬后改造成免疫猎犬，跨层追猎你。杀 Ta 掉落前任遗物——或下楼甩脱。' } },
  { id: 'warden:memory1', cat: 'warden', n: { en: 'Memory I', zh: '记忆 一' }, body: WARDEN_MEMORIES_PLACEHOLDER(0) },
  { id: 'warden:memory2', cat: 'warden', n: { en: 'Memory II', zh: '记忆 二' }, body: WARDEN_MEMORIES_PLACEHOLDER(1) },
  { id: 'warden:memory3', cat: 'warden', n: { en: 'Memory III', zh: '记忆 三' }, body: WARDEN_MEMORIES_PLACEHOLDER(2) },
];

// Pull the 3 memory bodies from warden.ts so the Codex shows the same text that
// surfaces as a message on each kill (single source of truth).
import { WARDEN_MEMORIES } from './warden.js';
function WARDEN_MEMORIES_PLACEHOLDER(i: number): I18nText { return WARDEN_MEMORIES[i]; }
