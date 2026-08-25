// src/__tests__/batch2-boss-skills.test.ts
// 批2 ②: every boss casts; the priority gate lets bosses cast at melee range.
import { describe, it, expect } from 'vitest';
import { BOSSES, ENEMIES } from '../data.js';
import { makeEnemy } from '../enemy-factory.js';

describe('batch2 ② boss skills', () => {
  it('all 9 bosses have a skill with a valid effect', () => {
    const VALID = ['dmg_bolt', 'dmg_aoe', 'heal', 'buff', 'debuff_poison', 'debuff_slow', 'debuff_weaken', 'debuff_stun', 'blink', 'summon'];
    expect(BOSSES.length).toBe(9);
    for (const b of BOSSES) {
      expect(b.skill, b.n.en).toBeDefined();
      expect(VALID).toContain(b.skill!.effect);
      expect(b.skill!.chance).toBeLessThanOrEqual(0.35);
      expect(b.skill!.cd).toBeGreaterThanOrEqual(4);
    }
  });
  it("Creator's summon kind resolves to a real enemy", () => {
    const creator = BOSSES.find(b => b.fl === 40)!;
    expect(creator.summon?.kind).toBeDefined();
    expect(ENEMIES.some(e => e.n.en === creator.summon!.kind)).toBe(true);
  });
  it('makeEnemy copies skill onto boss instances', () => {
    const bd = BOSSES.find(b => b.fl === 5)!;
    const e = makeEnemy(bd, 3, 3, 1.4, { isBoss: true }, '哥布林王');
    expect(e.skill?.effect).toBe(bd.skill!.effect);
    expect(e.isBoss).toBe(true);
  });
});
