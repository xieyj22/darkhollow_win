// batch17 T0: 平衡曲线纯模型 — spec §2 目标表的计算载体，与曲线回归门测试共享。
// 纯叶子：只 import data/types，不 import combat（G 耦合）——公式是复刻不是复用。
// 常量互指：MITIG_K 与 combat.ts 的局部常量同值（改一处须同步另一处，曲线门会红）。
//
// 模型假设（可在带内调整——带是硬门，假设不是；来源：scripts/balance_audit.mts spike）：
//  - 每层交战 ~70% 敌人、击杀掉落 30% → gear 期望表见下方 GEAR_SNAPSHOT（T5 加权掉落
//    **前**的均匀池审计输出，加权后实际略强 → 带有余量；出处警示见快照处注释）
//  - 施法频率 ~3 次/层（CD10 限战斗窗，探索回合不施法；回退 50% 概率时 mage@F40=80 必越带）
//  - 净化 ~2.5/层有效（喷泉/神龛/净水 T6 新值 15/25/30 × 60% 使用率摊 40 层）
import { ENEMIES, BOSSES, CLASSES, ELITE_PREFIX, AREAS } from './data.js';
import type { EnemyDef } from './types.js';

export const MITIG_K = 100;

// gear 期望快照（至今最佳装备均值）— 来源=T5 加权掉落**前**的均匀池审计输出（保守方向）；
// 现行 docs/balance-audit-2026-09-22.json 已是加权池数据，勿直接回填本快照，除非重校带状区间。
export interface GearRun { wAtk: number; aDef: number; accA: number; accD: number; accH: number }
const GEAR_SNAPSHOT: Record<number, GearRun> = {
  5: { wAtk: 7, aDef: 4, accA: 1, accD: 1, accH: 7 }, 10: { wAtk: 11, aDef: 7, accA: 2, accD: 2, accH: 14 },
  15: { wAtk: 18, aDef: 11, accA: 4, accD: 4, accH: 27 }, 20: { wAtk: 23, aDef: 15, accA: 5, accD: 6, accH: 38 },
  25: { wAtk: 26, aDef: 17, accA: 6, accD: 7, accH: 45 }, 30: { wAtk: 29, aDef: 19, accA: 8, accD: 8, accH: 52 },
  35: { wAtk: 31, aDef: 21, accA: 9, accD: 9, accH: 56 }, 40: { wAtk: 33, aDef: 23, accA: 9, accD: 9, accH: 60 },
  45: { wAtk: 35, aDef: 25, accA: 10, accD: 10, accH: 63 }, 50: { wAtk: 37, aDef: 27, accA: 10, accD: 10, accH: 65 },
  55: { wAtk: 39, aDef: 29, accA: 10, accD: 10, accH: 67 }, 60: { wAtk: 41, aDef: 31, accA: 10, accD: 11, accH: 69 },
  65: { wAtk: 43, aDef: 33, accA: 10, accD: 11, accH: 70 }, 70: { wAtk: 45, aDef: 35, accA: 10, accD: 11, accH: 71 },
  75: { wAtk: 47, aDef: 37, accA: 10, accD: 12, accH: 72 }, 80: { wAtk: 49, aDef: 39, accA: 10, accD: 12, accH: 73 },
};
export function gearAt(f: number): GearRun {
  const ks = Object.keys(GEAR_SNAPSHOT).map(Number).sort((a, b) => a - b);
  const hi = ks.find(k => k >= f) ?? ks[ks.length - 1];
  const lo = [...ks].reverse().find(k => k <= f) ?? ks[0];
  if (hi === lo) return GEAR_SNAPSHOT[lo];
  const t = (f - lo) / (hi - lo);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  const A = GEAR_SNAPSHOT[lo], B = GEAR_SNAPSHOT[hi];
  return { wAtk: mix(A.wAtk, B.wAtk), aDef: mix(A.aDef, B.aDef), accA: mix(A.accA, B.accA), accD: mix(A.accD, B.accD), accH: mix(A.accH, B.accH) };
}

// ---- 敌人窗口/缩放（复刻 enemies.ts spawn 语义：fs=.10 + AREAS enemyScaleBonus 实时读表） ----
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const areaOf = (f: number) => AREAS.find(a => f >= a.floorStart && f <= a.floorEnd && a.floorStart < 1000);
export const fsEnemy = (f: number) => 1 + (f - 1) * 0.10 + (areaOf(f)?.enemyScaleBonus ?? 0);
const fsBoss = (f: number) => 1 + (f - 1) * 0.1;
const eliteP = (f: number) => Math.min(0.25, 0.05 + f * 0.01);
const ELITE = {
  hpM: mean(ELITE_PREFIX.map(p => p.hpM)), atkM: mean(ELITE_PREFIX.map(p => p.atkM)),
  defM: mean(ELITE_PREFIX.map(p => p.defM ?? 1)), expM: mean(ELITE_PREFIX.map(p => p.expM ?? 1)),
};
function eliteM(f: number) {
  const p = eliteP(f);
  return { hp: 1 + p * (ELITE.hpM - 1), atk: 1 + p * (ELITE.atkM - 1), def: 1 + p * (ELITE.defM - 1) };
}
// F55+ 深层回退池（复刻 pickWeightedByMf 权重 exp(-(f-mf)/15)）
export function windowEnemies(f: number): { e: EnemyDef; w: number }[] {
  const se = ENEMIES.filter(e => e.mf <= f && e.mf >= Math.max(1, f - 4) && e.mf >= 1);
  if (se.length > 0) return se.map(e => ({ e, w: 1 / se.length }));
  const pool = ENEMIES.filter(e => e.mf >= 1);
  const ws = pool.map(e => Math.exp(-(f - e.mf) / 15));
  const tot = ws.reduce((a, b) => a + b, 0);
  return pool.map((e, i) => ({ e, w: ws[i] / tot }));
}

// ---- 等级曲线（expNext×1.5 精确；交战 70%） ----
export function levelAt(f: number): number {
  let exp = 0, level = 1, next = 20;
  for (let fl = 1; fl <= f; fl++) {
    const roster = windowEnemies(fl);
    const nSpawn = 5 + 3.5 + Math.floor(fl / 3);
    const fought = nSpawn * 0.7;
    const avgExp = mean(roster.map(r => r.e.exp));
    const eM = 1 + eliteP(fl) * (ELITE.expM - 1);
    exp += fought * avgExp * fsEnemy(fl) * eM;
    while (exp >= next) { exp -= next; level++; next = Math.floor(next * 1.5); }
  }
  return level;
}

// ---- 玩家面板（升级期望 hp10/atk2/def1 + 职业加成 + 天赋计划 + meta 画像） ----
export type Profile = 'fresh' | 'estab';
const META_PROFILES: Record<Profile, Record<string, number>> = {
  fresh: {},
  // T8 后 estab≈250 回响画像：hp3级(+45) atk3级(+6) def3级(+6) crit2级(+8%) dodge2级(+6%) talent+2
  estab: { start_hp: 3, start_atk: 3, start_def: 3, crit_bonus: 2, dodge_bonus: 2, extra_talent: 2 },
};
const TALENT_PLAN: Record<number, [string, number][]> = {
  0: [['w_battle_fury', 3], ['w_iron_skin', 3], ['w_blood', 3], ['w_weapon_mastery', 3], ['w_shield_mastery', 2]],
  1: [['r_keen_eye', 3], ['r_backstab', 1], ['r_swift_feet', 3], ['r_evasion', 2], ['r_double_strike', 1], ['r_death_mark', 1]],
  2: [['m_arcane_power', 3], ['m_mana_flow', 3], ['m_elemental_affinity', 1], ['m_spell_pen', 1], ['m_mana_shield', 1], ['m_archmage', 1]],
  3: [['p_holy_str', 3], ['p_divine_shield', 3], ['p_healing_light', 3], ['p_blessed_endurance', 3], ['p_aura', 1]],
};
export interface Panel { maxHp: number; atk: number; def: number; crit: number; dodge: number; spellPower: number; doubleStrike: number; manaShield: number; spellPen: number; critMult: number; level: number }
export function playerPanel(ci: number, level: number, gear: GearRun, profile: Profile): Panel {
  const cls = CLASSES[ci];
  const m = META_PROFILES[profile];
  const g = level - 1;
  const hpWar = ci === 0 ? 5 : ci === 3 ? 3 : 0;
  let maxHp = cls.hp + 10 * g + hpWar * g + (m.start_hp || 0) * 15 + gear.accH;
  let atk = cls.atk + 2 * g + (m.start_atk || 0) * 2 + gear.wAtk + gear.accA;
  let def = cls.def + 1 * g + (m.start_def || 0) * 2 + gear.aDef + gear.accD;
  const points = g + (m.extra_talent || 0);
  let spent = 0; const ranks: Record<string, number> = {};
  for (const [id, maxR] of TALENT_PLAN[ci]) { if (spent >= points) break; const take = Math.min(maxR, points - spent); ranks[id] = take; spent += take; }
  atk += (ranks.w_battle_fury || 0) * 2 + (ranks.w_weapon_mastery || 0) * 3 + (ranks.p_holy_str || 0) * 2;
  def += (ranks.w_iron_skin || 0) * 2 + (ranks.p_divine_shield || 0) * 2;
  maxHp += (ranks.w_blood || 0) * 15 + (ranks.p_blessed_endurance || 0) * 15;
  const crit = Math.min(0.85, (ci === 1 ? 0.15 : 0.05) + (m.crit_bonus || 0) * 0.04 + (ranks.r_keen_eye || 0) * 0.05);
  const dodge = Math.min(0.75, (ci === 1 ? 0.12 : 0.05) + (m.dodge_bonus || 0) * 0.03 + (ranks.r_swift_feet || 0) * 0.03 + (ranks.r_evasion || 0) * 0.05);
  let spellPower = ci === 2 ? 1.5 : ci === 3 ? 1.1 : 1;
  spellPower += (ranks.m_arcane_power || 0) * 0.10 + ((ranks.m_archmage || 0) ? 0.30 : 0);
  return {
    maxHp, atk, def, crit, dodge, spellPower,
    doubleStrike: (ranks.r_double_strike || 0) ? 0.15 : 0,
    manaShield: (ranks.m_mana_shield || 0) ? 0.10 : 0,
    spellPen: (ranks.m_spell_pen || 0) ? 0.20 : 0,
    critMult: 2 + (ranks.r_backstab || 0) * 0.25,
    level,
  };
}

// ---- 伤害模型（复刻 attack() 语义：MITIG 双向 + 暴击期望 + 职业技能折算） ----
function skillDps(ci: number, p: Panel): number {
  if (ci === 0) return (p.atk * 1.5 * 1.4) / 8;                       // 盾击 150%+精通, CD8
  if (ci === 1) return (p.atk * 2.5 * 1.75) / 6;                      // 必暴 1.75, CD6
  if (ci === 2) return ((p.atk + p.level * 3) * p.spellPower * p.spellPen) / 10 * 2.2; // AOE 摊 2.2 敌
  return (p.atk * 1.2) / 9;                                           // 圣光附带 120%, CD9
}
function dpsVs(ci: number, p: Panel, def: number): number {
  const hit = Math.max(1, p.atk * MITIG_K / (MITIG_K + def)) * (1 + p.crit * (p.critMult - 1)) * (1 + p.doubleStrike);
  return hit + skillDps(ci, p);
}
function dmgInTo(eAtk: number, p: Panel): number {
  return Math.max(1, eAtk * MITIG_K / (MITIG_K + p.def)) * (1 - p.dodge) * (1 - p.manaShield);
}

export interface Row { f: number; ttk: number; h2d: number }
export interface Curves {
  classes: Record<string, Row[]>;
  boss: Record<string, Record<string, { ttk: number; h2d: number }>>;
  corruption: Record<string, number>;
}
const FLOORS = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];

export function curves(profile: Profile): Curves {
  const classes: Record<string, Row[]> = {};
  for (let ci = 0; ci < 4; ci++) {
    const rows: Row[] = [];
    for (const f of FLOORS) {
      const roster = windowEnemies(f);
      const em = eliteM(f), fs = fsEnemy(f);
      const eHp = mean(roster.map(r => r.e.hp)) * fs * em.hp;
      const eAtk = mean(roster.map(r => r.e.atk)) * fs * em.atk;
      const eDef = mean(roster.map(r => r.e.def)) * fs * em.def;
      const p = playerPanel(ci, levelAt(f), gearAt(f), profile);
      rows.push({ f, ttk: eHp / dpsVs(ci, p, eDef), h2d: p.maxHp / dmgInTo(eAtk, p) });
    }
    classes[CLASSES[ci].name.en] = rows;
  }
  const boss: Record<string, Record<string, { ttk: number; h2d: number }>> = {};
  for (const bd of BOSSES.filter(b => b.fl > 0)) {
    const fs = fsBoss(bd.fl);
    const hp = bd.hp * fs;
    const ph = (bd.phases ?? []).map(x => x.atkM ?? 1);
    const phAtk = ph.length ? bd.atk * fs * mean(ph) : bd.atk * fs;
    const per: Record<string, { ttk: number; h2d: number }> = {};
    for (let ci = 0; ci < 4; ci++) {
      const p = playerPanel(ci, levelAt(bd.fl), gearAt(bd.fl), profile);
      per[CLASSES[ci].name.en] = { ttk: hp / dpsVs(ci, p, bd.def * fs), h2d: p.maxHp / dmgInTo(phAtk, p) };
    }
    boss[bd.n.en] = per;
  }
  const corruption: Record<string, number> = {};
  for (let ci = 0; ci < 4; ci++) {
    let c = 0;
    for (let f = 1; f <= 40; f++) {
      // 每层结算后 clamp 0——游戏里腐化 0 时净化是浪费的（applyCorruption 负增量
      // 不入账），模型不许把净化 bank 到负数跨层抵消未来的获取。
      let income = 1;                                                        // descend
      const roster = windowEnemies(f);
      const shadowShare = roster.filter(r => (r.e as EnemyDef & { el?: string }).el === 'shadow').length / roster.length;
      income += 8 * 0.7 * 0.35 * shadowShare;                                // 被暗影击中
      if (ci === 2) income += 3.0 * 0.5;                                     // 施法 3/层 × 50%
      if (ci === 3) income += 0.3 * 0.5;                                     // 圣骑按需奶
      c = Math.max(0, Math.max(0, c + income) - 2.5);                        // 净化有效值（T6 新值 × 60% 使用率）
    }
    corruption[CLASSES[ci].name.en] = Math.round(c);
  }
  return { classes, boss, corruption };
}
