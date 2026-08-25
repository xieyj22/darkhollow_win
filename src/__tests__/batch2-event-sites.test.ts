// 批2 ③: event-site eligibility + once-flags + triggerNpc routing.
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

vi.mock('../state.js', () => ({ get G() { return (globalThis as any).G; }, lang: 'en', eventOpen: false, eventActions: [], setEventOpen: vi.fn(), setEventActions: vi.fn() }));
vi.mock('../utils.js', () => ({ rng: () => 1, dst: () => 1, pick: (a: any[]) => a[0] }));
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../effects.js', () => ({ flt: () => {}, shake: () => {} }));
vi.mock('../fx.js', () => ({ fxFlash: () => {}, fxAura: () => {}, fxBeam: () => {}, fxBolt: () => {}, fxBurst: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: vi.fn() }));
vi.mock('../render.js', () => ({ updateUI: () => {}, render: () => {} }));
vi.mock('../items.js', () => ({ genItem: () => ({ rarity: 1, name: 'x' }), genWeapon: () => ({}), genArmor: () => ({}), genAcc: () => ({}), addItemWithOverflow: vi.fn(), itemToGold: () => 0 }));
vi.mock('../item-gen.js', () => ({ genEndlessGear: () => ({}) }));
vi.mock('../relics.js', () => ({ grantRelic: vi.fn(), hasRelic: () => false }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tMsg: (k: string, ...a: string[]) => a.reduce((s, x) => s.replace('{}', x), k), tx: (f: any) => f?.en ?? '' }));
vi.mock('../combat.js', () => ({ applyCorruption: vi.fn(), playerDeath: vi.fn(), recalc: () => {} }));
vi.mock('../enemy-factory.js', () => ({ makeEnemy: vi.fn(() => ({})) }));
vi.mock('../data.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data.js')>();
  return { ...actual, ENEMIES: [{ n: { en: 'Skeleton' }, mf: 1, hp: 1, atk: 1, def: 0, exp: 1, g: [1, 2], ai: 'chase' }] };
});

import { EVENT_SITES, eligibleEventSites } from '../event-sites.js';
import { triggerNpc } from '../events.js';
import { applyCorruption } from '../combat.js';  // mocked module — returns the vi.fn()

const showEventSiteById = (id: string) => triggerNpc({ npc: 'event', eventId: id } as any);

const mkG = () => ({
  floor: 10, branchMode: false, gameOver: false, endless: false, eventFlags: {},
  dungeon: { map: [[0]], rooms: [], traps: [] },
  items: [], enemies: [],
  player: { x: 0, y: 0, gold: 100, hp: 100, maxHp: 100, baseAtk: 5, baseDef: 5, baseMaxHp: 100, eq: { weapon: { name: 'sword', atk: 3 }, armor: null, accessory: null, accessory2: null }, buffs: [] },
});

// Shared popup DOM (hoisted from the ③a case so every site test sees it).
beforeAll(() => {
  const el = document.createElement('div'); el.id = 'event-popup';
  const title = document.createElement('div'); title.id = 'ev-title';
  const desc = document.createElement('div'); desc.id = 'ev-desc';
  const btns = document.createElement('div'); btns.id = 'ev-buttons';
  for (const n of [el, title, desc, btns]) document.body.appendChild(n);
});

beforeEach(() => { vi.clearAllMocks(); (globalThis as any).G = mkG(); });

describe('eligibleEventSites', () => {
  it('respects minFloor', () => {
    (globalThis as any).G = undefined;
    expect(eligibleEventSites(2).map(s => s.id)).not.toContain('cursed_altar');  // minFloor 4
  });
  it('filters once-events already flagged', () => {
    (globalThis as any).G = { eventFlags: { cursed_altar: true } };
    const ids = eligibleEventSites(10).map(s => s.id);
    expect(ids).not.toContain('cursed_altar');
    expect(ids).toContain('ancient_remains');  // repeatable
  });
  it('8 sites defined', () => expect(EVENT_SITES.length).toBe(8));
});

describe('triggerNpc routes event sites', () => {
  it('marks once-flag and opens popup', () => {
    triggerNpc({ npc: 'event', eventId: 'cursed_altar' } as any);
    expect((globalThis as any).G.eventFlags.cursed_altar).toBe(true);
    const title = document.getElementById('ev-title')!;
    const btns = document.getElementById('ev-buttons')!;
    expect(title.textContent).toBe('ev2.cursed_altarTitle');
    expect(btns.children.length).toBe(2);
  });
});

describe('runEventAction remaining sites', () => {
  it('blood_pool: +5 maxHp, +3 corruption', () => {
    showEventSiteById('blood_pool');
    document.querySelector<HTMLElement>('.evb')!.click();
    expect((globalThis as any).G.player.baseMaxHp).toBe(105);
    expect((globalThis as any).G.player.hp).toBe(105);
    expect(applyCorruption).toHaveBeenCalledWith(3);
  });
  it('sacrifice_well: -20% HP, cleanse 12', () => {
    showEventSiteById('sacrifice_well');
    document.querySelector<HTMLElement>('.evb')!.click();
    expect((globalThis as any).G.player.hp).toBe(80);       // 100 - 20%
    expect(applyCorruption).toHaveBeenCalledWith(-12);
  });
  it('sacrifice_well: too weak to bleed (hp<=1) is a no-op', () => {
    (globalThis as any).G.player.hp = 1;
    showEventSiteById('sacrifice_well');
    document.querySelector<HTMLElement>('.evb')!.click();
    expect((globalThis as any).G.player.hp).toBe(1);        // unharmed
    expect(applyCorruption).not.toHaveBeenCalled();
  });
});
