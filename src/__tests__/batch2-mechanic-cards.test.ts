// 批2 ④: mechanic tutorial cards queue once per career (MetaSave).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../state.js', () => ({ get G() { return (globalThis as any).G; }, lang: 'en', introOpen: false, introEnabled: true, setIntroOpen: vi.fn() }));
vi.mock('../meta.js', () => ({ discoverItem: vi.fn(() => true), discoverMechanic: vi.fn(() => true), getMeta: () => ({ upgrades: {}, unlockedLore: [], discoveredItems: [], seenMechanics: [] }) }));
vi.mock('../ui-panels.js', () => ({ showOverlay: vi.fn(), hideOverlay: vi.fn() }));
vi.mock('../sprites.js', () => ({ paintItemIcon: vi.fn(), paintRelicIcon: vi.fn() }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tx: (f: any) => f?.en ?? '', rareName: () => '', RARITY_C: ['#c0c0c0', '#06d6a0', '#4895ef', '#9b5de5', '#ffd700'] }));
// item-intro.ts also imports catalog tables from data.js (mocked empty, same
// idiom as item-intro.test.ts, so only the mechanic-card path is exercised).
vi.mock('../data.js', () => ({
  ALL_WEAPONS: [], ALL_ARMORS: [], ALL_ACCESSORIES: [], ALL_POTIONS: [],
  ALL_SCROLLS: [], ALL_CONSUMABLES: [], FOODS: [],
  ENDLESS_GEAR: { weapons: [], armors: [], accessories: [] }, RELICS: [],
}));

import { queueMechanicIntro } from '../item-intro.js';
import { discoverMechanic } from '../meta.js';

beforeEach(() => {
  vi.clearAllMocks();
  // showNext() writes to #item-intro-content/#item-intro-hint; provide them so
  // getElementById doesn't return null under happy-dom (prod has them in
  // index.html) — same setup as item-intro.test.ts.
  document.body.innerHTML = '<div id="item-intro-content"></div><div id="item-intro-hint"></div>';
});

describe('queueMechanicIntro', () => {
  it('queues on first sight (discoverMechanic true)', () => {
    queueMechanicIntro('corruption');
    expect(discoverMechanic).toHaveBeenCalledWith('corruption');
    expect(document.getElementById('item-intro-content')!.innerHTML).toContain('intro.mcCorruptionTitle');
  });
  it('skips when already seen', () => {
    vi.mocked(discoverMechanic).mockReturnValue(false);
    queueMechanicIntro('warden');
    expect(document.getElementById('item-intro-content')!.innerHTML).not.toContain('mcWarden');
  });
  it('unknown id is a no-op', () => {
    queueMechanicIntro('nonsense');
    expect(discoverMechanic).not.toHaveBeenCalled();
  });
});
