import { describe, it, expect } from 'vitest';
import { makeEnemy } from '../enemy-factory.js';
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
