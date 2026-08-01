// Endings at the Creator (Playtest #9 Phase 2) — pure leaf, unit-testable.
// On the F40 Creator kill (normal mode), the player chooses Slay / Refuse; Refuse
// is gated to corruption < 50. The choice + corruption resolve to one of 3
// endings, recorded as achievements. Bodies are bilingual, sourced from lore.
import type { I18nText } from './types.js';

export type EndingId = 'pyrrhic' | 'doombringer' | 'guardian';
export type CreatorChoice = 'slay' | 'refuse';

// Refuse is only selectable while corruption stays below this — deeper than this
// and the abyss's will overrides the player's (forces Slay).
export const REFUSE_CORRUPTION_THRESHOLD = 50;

export interface EndingDef { id: EndingId; ach: string; title: I18nText; body: I18nText; }

export const ENDINGS: Record<EndingId, EndingDef> = {
  pyrrhic:    { id: 'pyrrhic',    ach: 'end_pyrrhic', title: { en: 'Pyrrhic Victor', zh: '悲壮英雄' }, body: { en: 'The Creator thanks you as they fall. The seal shatters — and through the crack, the true abyss begins to seep. You did your duty. You also ended the world.', zh: '创世者在倒下时向你致谢。封印碎裂——真深渊从裂隙中渗出。你完成了使命,也终结了世界。' } },
  doombringer:{ id: 'doombringer',ach: 'end_doom',    title: { en: 'Doombringer',     zh: '末日使者' }, body: { en: 'It was not your hand that moved — it was the abyss moving through you. The seal breaks, the real abyss pours forth, and you stand at its vanguard: the doombringer it shaped you to be.', zh: '动手的不是你,是深渊借你的手。封印崩塌,真深渊奔涌而出,你站在它最前——它把你塑造成的末日使者。' } },
  guardian:   { id: 'guardian',   ach: 'end_guardian',title: { en: 'The Guardian',    zh: '守誓者' },   body: { en: "You lower your blade. You will not be the one to break the seal. You take the Creator's place at the heart of the wound, and bear the thousand-year burden they finally lay down.", zh: '你放下剑。你不会是击碎封印的那个人。你走到伤口的心脏,接过创世者的位置,担起 Ta 终于卸下的千年重负。' } },
};

// choice + corruption → ending. Refuse always → guardian; Slay splits at the threshold.
export function endingForChoice(choice: CreatorChoice, corruption: number): EndingId {
  if (choice === 'refuse') return 'guardian';
  return corruption >= REFUSE_CORRUPTION_THRESHOLD ? 'doombringer' : 'pyrrhic';
}

export function canRefuse(corruption: number): boolean {
  return corruption < REFUSE_CORRUPTION_THRESHOLD;
}
