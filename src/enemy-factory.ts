// Pure enemy-instance factory. Lives in its own module (not enemies.ts) so the
// import chain stays light (only state+utils+types) and it is unit-testable
// without pulling combat/render/talents/relics into the test environment.
import type { Enemy, Element, I18nText, EnemySkill, BossDef } from './types.js';
import { lang } from './state.js';
import { rng } from './utils.js';
import { tx } from './i18n.js';

// Fields makeEnemy actually reads. Both EnemyDef and BossDef satisfy this
// structurally (BossDef simply omits the optional ai/res/tags/mf).
export type EnemyBase = {
  n: I18nText; ch: string; c: string;
  hp: number; atk: number; def: number; exp: number; g: [number, number];
  el?: Element; res?: Partial<Record<Element, number>>; tags?: string[]; ai?: string;
  skill?: EnemySkill;
  phases?: BossDef['phases'];
  summon?: BossDef['summon'];
};

export interface EnemyMult {
  hpM?: number; atkM?: number; defM?: number; defAdd?: number;
  expM?: number; goldM?: number; isBoss?: boolean; isElite?: boolean; isAlly?: boolean;
}

/**
 * Build a runtime Enemy instance from a static def + floor scale + multipliers.
 * Unifies the 7 repeated literal sites in enemies.ts:
 *   hp/maxHp = floor(base.hp * fs * hpM)
 *   atk      = floor(base.atk * fs * atkM)
 *   def      = floor((base.def + defAdd) * fs * defM)   // additive defAdd (elite) AND mult defM (branch/summon)
 *   exp      = floor(base.exp * fs * expM)
 *   goldDrop = floor(rng(base.g[0], base.g[1]) * goldM)
 */
export function makeEnemy(
  base: EnemyBase,
  x: number, y: number, fs: number,
  m?: EnemyMult,
  nameOverride?: string,
): Enemy {
  const hpM = m?.hpM ?? 1, atkM = m?.atkM ?? 1, defM = m?.defM ?? 1, defAdd = m?.defAdd ?? 0;
  const expM = m?.expM ?? 1, goldM = m?.goldM ?? 1;
  const hp = Math.floor(base.hp * fs * hpM);
  return {
    name: nameOverride ?? tx(base.n),
    ch: base.ch, c: base.c, x, y,
    hp, maxHp: hp,
    atk: Math.floor(base.atk * fs * atkM),
    def: Math.floor((base.def + defAdd) * fs * defM),
    exp: Math.floor(base.exp * fs * expM),
    goldDrop: Math.floor(rng(base.g[0], base.g[1]) * goldM),
    ai: base.ai ?? 'chase',
    stunned: 0, feared: 0,
    isAlly: m?.isAlly ?? false,
    isBoss: m?.isBoss, isElite: m?.isElite,
    el: (base.el || 'none') as Element,
    res: base.res ? { ...base.res } : {},
    skill: base.skill ? { ...base.skill, name: { ...base.skill.name } } : undefined,
    aiCd: 0,
    atkBuffTurns: 0,
    atkBuffVal: 0,
    skillCd: 0,
    tags: base.tags ? [...base.tags] : [],
    // ① Boss config rides the instance (reference copy — read-only static
    // data, unlike `skill` which gets a defensive deep copy). bossAtkBase is
    // DELIBERATELY UNFLOORED: processBossPhase computes floor(origAtk * atkM),
    // so with the .1 boss fs this reproduces the legacy origAtk formula
    // bd.atk*(1+(fl-1)*.1) bit-exactly on every main-line floor.
    ...(m?.isBoss ? { phases: base.phases, summon: base.summon, bossAtkBase: base.atk * fs * atkM } : {}),
  };
}

// ⑥ Deep-floor fallback pick (F55+, where the [floor-4, floor] mf window is
// empty and uniform `pick` gave F1 rats Void-Titan odds). Weight falls off
// with distance: w = exp(-(floor - mf)/15) → F60: mf50→0.51, mf42→0.30, mf1→0.02.
export function pickWeightedByMf<T extends { mf: number }>(
  pool: T[], floor: number, rand: () => number = Math.random,
): T | undefined {
  if (pool.length === 0) return undefined;
  if (pool.length === 1) return pool[0];
  const ws = pool.map(e => Math.exp(-(floor - e.mf) / 15));
  let roll = rand() * ws.reduce((s, w) => s + w, 0);
  for (let i = 0; i < pool.length; i++) {
    roll -= ws[i];
    if (roll < 0) return pool[i];
  }
  return pool[pool.length - 1];
}
