import { describe, it, expect } from 'vitest';
import { makeEnemy, pickWeightedByMf } from '../enemy-factory.js';
import type { EnemyDef } from '../types.js';
import type { EnemyBase } from '../enemy-factory.js';

const base: EnemyDef = {
  n: { zh: '哥布林', en: 'Goblin' }, ch: 'g', c: '#90ee90',
  hp: 20, atk: 6, def: 2, exp: 8, g: [3, 7], ai: 'chase', mf: 1, el: 'none', tags: ['goblin'],
  res: { fire: 0.5 },
};

describe('makeEnemy', () => {
  it('applies fs scaling to hp/atk/def/exp', () => {
    const e = makeEnemy(base, 5, 7, 2.0);
    expect(e.hp).toBe(40); expect(e.maxHp).toBe(40);
    expect(e.atk).toBe(12); expect(e.def).toBe(4); expect(e.exp).toBe(16);
    expect(e.x).toBe(5); expect(e.y).toBe(7);
  });

  it('applies multiplicative mults', () => {
    const e = makeEnemy(base, 1, 1, 1, { hpM: 1.5, atkM: 1.2, defM: 0.5, expM: 2 });
    expect(e.hp).toBe(30); expect(e.atk).toBe(7); expect(e.def).toBe(1); expect(e.exp).toBe(16);
  });

  it('applies additive defAdd then mult + fs (elite additive + branch/summon mult unified)', () => {
    expect(makeEnemy(base, 0, 0, 1, { defAdd: 3 }).def).toBe(5);            // (2+3)*1*1
    expect(makeEnemy(base, 0, 0, 2, { defAdd: 3 }).def).toBe(10);           // (2+3)*2*1
    expect(makeEnemy(base, 0, 0, 1, { defAdd: 3, defM: 0.5 }).def).toBe(2); // (2+3)*1*0.5
  });

  it('goldDrop stays within the scaled gold range', () => {
    for (let i = 0; i < 50; i++) {
      const g = makeEnemy(base, 0, 0, 1).goldDrop;
      expect(g).toBeGreaterThanOrEqual(3); expect(g).toBeLessThanOrEqual(7);
    }
    for (let i = 0; i < 50; i++) {
      const g = makeEnemy(base, 0, 0, 1, { goldM: 0.4 }).goldDrop;          // floor(rng(3,7)*0.4) in [1,2]
      expect(g).toBeGreaterThanOrEqual(1); expect(g).toBeLessThanOrEqual(2);
    }
  });

  it('nameOverride wins; default name follows lang (happy-dom localStorage empty -> en)', () => {
    expect(makeEnemy(base, 0, 0, 1).name).toBe('Goblin');
    expect(makeEnemy(base, 0, 0, 1, {}, '精英哥布林').name).toBe('精英哥布林');
  });

  it('passes through flags + defaults (isAlly false, ai from base, el, skillCd 0)', () => {
    const e = makeEnemy(base, 1, 2, 1, { isBoss: true });
    expect(e.isBoss).toBe(true); expect(e.isAlly).toBe(false);
    expect(e.ai).toBe('chase'); expect(e.el).toBe('none'); expect(e.skillCd).toBe(0);
    expect(e.stunned).toBe(0); expect(e.feared).toBe(0);
  });

  it('deep-copies res and tags (mutating the copy does not affect the base)', () => {
    const e = makeEnemy(base, 0, 0, 1);
    expect(e.res).toEqual({ fire: 0.5 }); expect(e.res).not.toBe(base.res);
    expect(e.tags).toEqual(['goblin']); expect(e.tags).not.toBe(base.tags);
    e.tags!.push('mut'); expect(base.tags).toEqual(['goblin']);
  });

  const skillDef: EnemyBase = {
    n: { en: 'T', zh: 'T' }, ch: 'x', c: '#fff', hp: 10, atk: 5, def: 1, exp: 5, g: [1, 2],
    ai: 'chase',
    skill: { name: { en: 'Zap', zh: '电击' }, effect: 'dmg_bolt', chance: 0.5, cd: 3, dmg: 1.8, range: 5 },
  };

  it('deep-copies skill from def to runtime (no shared reference)', () => {
    const e = makeEnemy(skillDef, 0, 0, 1);
    expect(e.skill).toBeDefined();
    expect(e.skill!.effect).toBe('dmg_bolt');
    expect(e.skill).not.toBe(skillDef.skill);            // outer not same ref
    expect(e.skill!.name).not.toBe(skillDef.skill!.name); // inner I18nText not same ref
  });

  it('initializes aiCd / atkBuffTurns / atkBuffVal to 0', () => {
    const e = makeEnemy({ ...skillDef, skill: undefined }, 0, 0, 1);
    expect(e.aiCd).toBe(0);
    expect(e.atkBuffTurns).toBe(0);
    expect(e.atkBuffVal).toBe(0);
    expect(e.skill).toBeUndefined();
  });
});

describe('boss config travels with the instance (① reconnect)', () => {
  const bossBase = {
    ...base,
    phases: [{ hpThreshold: 0.5, atkM: 1.5 }],
    summon: { chance: 0.4, cd: 3, maxAdds: 2 },
  };
  it('isBoss copies phases/summon refs + records bossAtkBase', () => {
    const e = makeEnemy(bossBase as any, 1, 1, 1.4, { isBoss: true });
    expect(e.phases).toBe(bossBase.phases);        // 引用拷贝（只读静态配置）
    expect(e.summon).toBe(bossBase.summon);
    expect(e.bossAtkBase).toBeCloseTo(8.4);        // 未取整的出生缩放攻击(6*1.4)，floor 留给 phase 触发时
  });
  it('non-boss carries no boss fields', () => {
    const e = makeEnemy(bossBase as any, 1, 1, 1);
    expect(e.phases).toBeUndefined();
    expect(e.summon).toBeUndefined();
    expect(e.bossAtkBase).toBeUndefined();
  });
});

describe('pickWeightedByMf (⑥ deep-floor fallback)', () => {
  const pool = [{ mf: 1 }, { mf: 42 }, { mf: 50 }];
  it('rand near 0 picks the first (lowest-mf) item — weighted roulette keeps all entries reachable', () => {
    expect(pickWeightedByMf(pool, 60, () => 0)).toBe(pool[0]);
  });
  it('mid/high rolls land on the deep-floor entries (w = exp(-(floor-mf)/15))', () => {
    expect(pickWeightedByMf(pool, 60, () => 0.999)).toBe(pool[2]);   // mf 50 dominates
    expect(pickWeightedByMf(pool, 60, () => 0.5)).not.toBe(pool[0]); // rat (w≈.027 of ≈.95 total)
  });
  it('high-mf entry wins the large majority of a uniform sweep at F60', () => {
    let deep = 0;
    for (let i = 0; i <= 100; i++) if (pickWeightedByMf(pool, 60, () => i / 100) === pool[2]) deep++;
    expect(deep).toBeGreaterThanOrEqual(50);   // mf50 share ≈ exp(-10/15)=0.51 vs mf42 0.30 + mf1 0.02
  });
  it('degenerate pools: empty -> undefined, single -> itself', () => {
    expect(pickWeightedByMf([], 60, () => 0)).toBeUndefined();
    expect(pickWeightedByMf([{ mf: 7 }], 60, () => 0)).toEqual({ mf: 7 });
  });
});
