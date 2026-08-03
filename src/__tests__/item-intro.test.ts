import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../data.js', () => ({
  META_UPGRADES: [], ACH_DEFS: [], RELICS: [],
  ALL_WEAPONS: [], ALL_ARMORS: [], ALL_ACCESSORIES: [],
  ALL_POTIONS: [], ALL_SCROLLS: [], ALL_CONSUMABLES: [],
  FOODS: [],
  ENDLESS_GEAR: { weapons: [], armors: [], accessories: [] },
}));
vi.mock('../audio.js', () => ({ snd: () => {} }));

// Mutable intro-state mock: introOpen must actually flip when setIntroOpen runs,
// otherwise the queue-advance assertions can't hold. vi.hoisted keeps the shared
// object alive before the (hoisted) vi.mock factory executes.
const introState = vi.hoisted(() => ({ open: false, enabled: true }));
vi.mock('../state.js', () => ({
  lang: 'en',
  get introOpen() { return introState.open; },
  get introEnabled() { return introState.enabled; },
  setIntroOpen: vi.fn((v: boolean) => { introState.open = v; }),
}));
vi.mock('../ui-panels.js', () => ({ showOverlay: vi.fn(), hideOverlay: vi.fn() }));
vi.mock('../meta.js', async () => {
  const actual = await vi.importActual<typeof import('../meta.js')>('../meta.js');
  return { ...actual, discoverItem: vi.fn(actual.discoverItem) };
});

import { initMeta, getMeta, discoverItem } from '../meta.js';
import { queueItemIntro, queueRelicIntro, closeItemIntro } from '../item-intro.js';
import { showOverlay, hideOverlay } from '../ui-panels.js';

beforeEach(() => { localStorage.clear(); introState.open = false; introState.enabled = true; });

describe('discoverItem', () => {
  it('returns true on first discovery and persists', () => {
    expect(discoverItem('weapon:iron_sword')).toBe(true);
    expect(getMeta().discoveredItems).toContain('weapon:iron_sword');
  });
  it('returns false on repeat (idempotent, no dup)', () => {
    expect(discoverItem('relic:war_totem')).toBe(true);
    expect(discoverItem('relic:war_totem')).toBe(false);
    expect(getMeta().discoveredItems.filter(k => k === 'relic:war_totem')).toHaveLength(1);
  });
  it('old meta without discoveredItems migrates to []', () => {
    localStorage.setItem('dh_meta', JSON.stringify({
      version: 1, soulEchoes: 0, totalSpent: 0, upgrades: {}, achievements: [],
      stats: {}, runHistory: [], endlessLeaderboard: [], unlockedLore: [], wardens: [],
    }));
    expect(getMeta().discoveredItems).toEqual([]);
  });
  it('initMeta seeds discoveredItems as []', () => {
    expect(initMeta().discoveredItems).toEqual([]);
  });
});

describe('intro queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // showNext() writes to #item-intro-content/#item-intro-hint; provide them so
    // getElementById doesn't return null under happy-dom (prod has them in index.html).
    document.body.innerHTML = '<div id="item-intro-content"></div><div id="item-intro-hint"></div>';
  });

  it('first pickup of an item shows overlay; second does not', () => {
    (discoverItem as any).mockReturnValue(true);
    const item = { type: 'weapon', name: 'Iron Sword', id: 'iron_sword', rarity: 0, ch: ')', c: '#fff', desc: '', x: 0, y: 0 } as any;
    queueItemIntro(item);
    expect(showOverlay).toHaveBeenCalledWith('item-intro-overlay');
    (discoverItem as any).mockReturnValue(false);
    queueItemIntro(item);
    expect(showOverlay).toHaveBeenCalledTimes(1); // not called again
  });

  it('multiple first pickups queue and closeItemIntro advances', () => {
    (discoverItem as any).mockReturnValue(true);
    const mk = (id: string) => ({ type: 'potion', name: id, id, rarity: 0, ch: '!', c: '#fff', desc: '', x: 0, y: 0 } as any);
    queueItemIntro(mk('heal_potion'));
    queueItemIntro(mk('mana_potion')); // queued while first is showing
    expect(showOverlay).toHaveBeenCalledTimes(1);
    closeItemIntro(); // closes #1 → should show #2
    expect(showOverlay).toHaveBeenCalledTimes(2);
    closeItemIntro(); // closes #2 → queue empty
    expect(hideOverlay).toHaveBeenCalledWith('item-intro-overlay');
  });
});

// Task 8: gold-guard ordering. The gold-type guard must run BEFORE the intro-disabled
// branch; otherwise a gold pickup with intro OFF would record `gold:<name>` into
// discoveredItems. (The brief's overflow-to-gold integration test used a broken spy
// on a throwaway object and is deferred to manual verification in Task 11 — see report.)
describe('queueItemIntro gold guard (Task 8 wiring)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="item-intro-content"></div><div id="item-intro-hint"></div>';
  });

  it('gold items are never recorded, even when intro is disabled', () => {
    introState.enabled = false;
    const gold = { type: 'gold', name: 'Gold', rarity: 0, ch: '*', c: '#ffd700', desc: '', x: 0, y: 0 } as any;
    queueItemIntro(gold);
    expect(discoverItem).not.toHaveBeenCalled();
    expect(showOverlay).not.toHaveBeenCalled();
  });

  it('gold items are never queued, even when intro is enabled and discoverItem would say yes', () => {
    introState.enabled = true;
    (discoverItem as any).mockReturnValue(true); // would queue a normal item
    const gold = { type: 'gold', name: 'Gold', rarity: 0, ch: '*', c: '#ffd700', desc: '', x: 0, y: 0 } as any;
    queueItemIntro(gold);
    expect(discoverItem).not.toHaveBeenCalled();
    expect(showOverlay).not.toHaveBeenCalled();
  });

  it('non-gold item with intro disabled records discovery (no popup)', () => {
    introState.enabled = false;
    const weapon = { type: 'weapon', name: 'Iron Sword', id: 'iron_sword', rarity: 0, ch: ')', c: '#fff', desc: '', x: 0, y: 0 } as any;
    queueItemIntro(weapon);
    expect(discoverItem).toHaveBeenCalledWith('weapon:iron_sword');
    expect(showOverlay).not.toHaveBeenCalled();
  });
});

// Task 11: queueRelicIntro coverage (noted untested in Task 7 review).
describe('queueRelicIntro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="item-intro-content"></div><div id="item-intro-hint"></div>';
  });

  it('first discovery of a relic shows overlay', () => {
    (discoverItem as any).mockReturnValue(true);
    queueRelicIntro('war_totem');
    expect(discoverItem).toHaveBeenCalledWith('relic:war_totem');
    expect(showOverlay).toHaveBeenCalledWith('item-intro-overlay');
  });

  it('already-discovered relic does not show overlay again', () => {
    (discoverItem as any).mockReturnValue(false);
    queueRelicIntro('war_totem');
    expect(discoverItem).toHaveBeenCalledWith('relic:war_totem');
    expect(showOverlay).not.toHaveBeenCalled();
  });
});
