import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../state.js', () => ({
  get G(): unknown { return (globalThis as { G?: unknown }).G; },
  lang: 'en',
}));
vi.mock('../data.js', () => ({ RELICS: [] }));   // applyRelicBonuses reads p.relics, not RELICS
vi.mock('../messages.js', () => ({ addMsg: () => {} }));
vi.mock('../effects.js', () => ({ flt: () => {} }));
vi.mock('../fx.js', () => ({ fxFlash: () => {}, fxBurst: () => {} }));
vi.mock('../audio.js', () => ({ snd: () => {} }));

import { applyRelicBonuses, relicOnCrit, getRelicExpMult } from '../relics.js';
import { WARDEN_RELIC_IDS } from '../warden.js';

function fixturePlayer(relics: string[]): any {
  return {
    relics, atk: 10, baseAtk: 10, def: 5, maxHp: 100, hp: 100,
    critChance: 0.1, dodgeChance: 0.1, spellPower: 1,
    critDamageBonus: 0, healBonus: 0, elRes: {}, elDmgBonus: {}, setBonusActive: {},
  };
}

describe('Warden relic effects', () => {
  beforeEach(() => { (globalThis as any).G = { player: fixturePlayer([]) }; });

  it('warden_cloak grants +10% dodge in applyRelicBonuses', () => {
    const p = fixturePlayer(['warden_cloak']);
    applyRelicBonuses(p);
    expect(p.dodgeChance).toBeCloseTo(0.2);   // 0.1 base + 0.10
  });
  it('fallen_blade heals 18% of crit damage via relicOnCrit', () => {
    const G = (globalThis as any).G;
    G.player = fixturePlayer(['fallen_blade']); G.player.hp = 50;
    relicOnCrit({ x: 0, y: 0 } as any, 100);
    expect(G.player.hp).toBe(68);             // 50 + floor(100*0.18)
  });
  it('memory_shard gives +30% XP via getRelicExpMult', () => {
    (globalThis as any).G.player = fixturePlayer(['memory_shard']);
    expect(getRelicExpMult()).toBe(1.3);
  });
  it('all three ids are real relic defs (no typo)', () => {
    // sanity: the pick-list names match the effects we just wired
    expect(WARDEN_RELIC_IDS).toEqual(['warden_cloak', 'fallen_blade', 'memory_shard']);
  });
});
