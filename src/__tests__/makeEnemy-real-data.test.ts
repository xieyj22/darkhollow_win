import { describe, it, expect } from 'vitest';
import { makeEnemy } from '../enemy-factory.js';
import { ENEMIES, BOSSES } from '../data.js';
import { tx } from '../i18n.js';

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

  // Task 4: every EnemyDef that declares a `skill` must surface a deep-copied
  // runtime skill on the built Enemy (not the def's shared reference). Covers
  // all 25 casters that now carry skill data.
  it('every enemy with a def.skill gets a deep-copied runtime skill', () => {
    let checked = 0;
    for (const def of ENEMIES) {
      if (!def.skill) continue;
      checked++;
      const e = makeEnemy(def, 0, 0, 1);
      expect(e.skill, `${tx(def.n)}: def.skill missing at runtime`).toBeDefined();
      expect(e.skill).not.toBe(def.skill);
      expect(e.skill!.name).not.toBe(def.skill!.name);
      expect(e.skill!.effect).toBe(def.skill!.effect);
      expect(e.skill!.cd).toBe(def.skill!.cd);
    }
    // Guard: if all caster skills were silently dropped from data, this would
    // loop zero times and pass vacuously — assert we actually exercised them.
    // 25 original casters + 3 stun casters added by ③ (audit #3) + 3 dead-handler
    // casters added by batch2 ① (heal/blink/summon) = 31.
    expect(checked).toBe(31);
  });

  it('every BossDef with phases/summon surfaces them on the built instance (①)', () => {
    for (const b of BOSSES) {
      const out = makeEnemy(b, 5, 5, 1 + (b.fl - 1) * .1, { isBoss: true });
      expect(out.phases).toBe(b.phases);
      expect(out.summon).toBe(b.summon);
      expect(out.bossAtkBase).toBeCloseTo(b.atk * (1 + (b.fl - 1) * .1));  // unfloored legacy origAtk formula
    }
  });

  it('③ exactly 3 enemies carry debuff_stun (CC online, conservative)', () => {
    const stunCasters = ENEMIES.filter(e => e.skill?.effect === 'debuff_stun');
    expect(stunCasters.map(e => e.n.en).sort()).toEqual(['Cosmic Horror', 'Drakeborn Knight', 'Dread Legionnaire']);
  });
});
