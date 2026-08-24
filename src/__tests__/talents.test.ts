// P0-2 regression: a counter-attack kill must route through killEnemy (full
// reward pipeline: relic mults, boss victory, warden rewards, loot, ach, fx),
// not hand-roll exp/gold/kills the way it used to.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../state.js', () => ({
  get G(): unknown { return (globalThis as { G?: unknown }).G; },
  lang: 'en',
}));
vi.mock('../effects.js', () => ({ flt: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: () => {} }));
// data.js NOT mocked — getSkillModifiers reads real talent ids; tr() only
// touches player.talents.talents so the other tests stay hermetic.
vi.mock('../utils.js', () => ({ rng: () => 0, dst: () => 1 }));
vi.mock('../meta.js', () => ({ bonusGold: (g: number) => g, bonusExp: (e: number) => e }));
vi.mock('../relics.js', () => ({ hasRelic: () => false }));
vi.mock('../i18n.js', () => ({
  t: (k: string) => k,
  tMsg: (k: string, ...a: string[]) => a.reduce((s: string, x) => s.replace('{}', x), k),
  tx: (f: { en?: string }) => (f && f.en) || '',
}));
vi.mock('../combat.js', () => ({ killEnemy: vi.fn() }));

import { onEnemyHitPlayer, getSkillModifiers } from '../talents.js';
import { killEnemy } from '../combat.js';
import type { Enemy, Player } from '../types.js';

function mkPlayer(): Player {
  return { atk: 10, talents: { talents: { w_retaliation: 1 } } } as unknown as Player;
}
function mkEnemy(hp: number): Enemy {
  // counter dmg = max(1, p.atk - def) = max(1, 10-3) = 7 → kills an hp=5 foe
  return { name: 'Brute', x: 2, y: 2, hp, maxHp: 20, def: 3, exp: 5, goldDrop: 5 } as unknown as Enemy;
}

describe('P0-2 counter-attack kill routes through killEnemy', () => {
  beforeEach(() => {
    (globalThis as any).G = { player: mkPlayer(), enemies: [mkEnemy(5)] };
    vi.clearAllMocks();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('a counter that kills the attacker calls killEnemy (full reward pipeline)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // < 0.1 → counter triggers
    const attacker = mkEnemy(5);
    (globalThis as any).G.enemies = [attacker];
    onEnemyHitPlayer(attacker);
    expect(killEnemy).toHaveBeenCalledWith(attacker);
  });
});

describe('③ w_shield_mastery consumes into skill dmgMult', () => {
  it('rank 2 -> dmgMult 1.4', () => {
    (globalThis as any).G = { player: { talents: { talents: { w_shield_mastery: 2 } } } };
    expect(getSkillModifiers(0).dmgMult).toBeCloseTo(1.4);
  });
  it('rank 0 -> base 1.0', () => {
    (globalThis as any).G = { player: { talents: { talents: {} } } };
    expect(getSkillModifiers(0).dmgMult).toBe(1);
  });
});
