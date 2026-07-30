import { describe, it, expect } from 'vitest';
import { makeEnemy } from '../enemy-factory.js';
import { ENEMIES, BOSSES } from '../data.js';

// Exercises makeEnemy against the REAL game data (EnemyDef + BossDef), not a
// synthetic fixture — proves the refactor works for every enemy/boss at runtime.
describe('makeEnemy over real game data', () => {
  for (const e of ENEMIES) {
    it(`builds ${e.n.en} (mf=${e.mf}) without throw + sane stats`, () => {
      const out = makeEnemy(e, 1, 2, 1 + (e.mf) * .12, { hpM: .7, atkM: .7, defM: .7, expM: .7, goldM: .7 });
      expect(out.maxHp).toBe(out.hp);
      expect(out.hp).toBeGreaterThan(0);
      expect(out.atk).toBeGreaterThanOrEqual(0);
      expect(out.goldDrop).toBeGreaterThanOrEqual(0);
      expect(out.name.length).toBeGreaterThan(0);
      expect(out.res).toEqual(e.res ? { ...e.res } : {});
    });
  }
  for (const b of BOSSES) {
    it(`builds boss ${b.n.en} (fl=${b.fl}) without throw + sane stats`, () => {
      const out = makeEnemy(b, 5, 5, 1 + (b.fl - 1) * .1, { isBoss: true });
      expect(out.isBoss).toBe(true);
      expect(out.maxHp).toBe(out.hp);
      expect(out.hp).toBeGreaterThan(0);
      expect(out.ai).toBe('chase');       // BossDef has no ai -> default 'chase'
      expect(out.res).toEqual({});         // BossDef has no res -> {}
    });
  }
});
