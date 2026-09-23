// 平衡审计 Spike (2026-09-22) — headless 数值曲线分析。
// 运行: npx vite-node scripts/balance_audit.mts
// 输出: console 摘要 + docs/balance-audit-2026-09-22.json + markdown 报告到 stdout 尾部。
//
// 模型假设(全部在报告里声明,调参时改这里):
//  - 每层敌人 ~5 房保底 + extra rng(2,5)+f/3;玩家实际交战 ~70%
//  - 击杀掉落 30%(combat.ts:187 真值) → genItem 真实 Monte Carlo(2000 runs)取"至今最佳"装备
//  - 升级成长取期望均值(hp 8.5+职业加成 / atk 2 / def 1),expNext×1.5 精确
//  - 天赋按每职业优先级清单注入;meta 双画像(fresh=0 / established≈250回响)
//  - 伤害公式逐字复刻 combat.attack: max(1, atk-def+E[rng(-2,2)]) × 暴击期望

const S: any = (globalThis as any);
S.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
S.addEventListener = S.addEventListener ?? (() => {});
S.window = S;
S.document = { documentElement: { lang: 'en' } };

// batch17 T0: mulberry32 种子化 MC (seed 13) — fixSim 表可复现（连跑两遍 diff 为空验证过）。
let _s = 13;
const _mr = () => { _s |= 0; _s = _s + 0x6D2B79F5 | 0; let t = Math.imul(_s ^ _s >>> 15, 1 | _s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
Math.random = _mr;

const { ENEMIES, BOSSES, CLASSES, RACES, ALL_WEAPONS, ALL_ARMORS, ALL_ACCESSORIES, ELITE_PREFIX, AREAS, ENDLESS_GEAR, EQUIPMENT_SETS } = await import('../src/data.js');
const gen = await import('../src/item-gen.js');

// ---------- 工具 ----------
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const round1 = (x: number) => Math.round(x * 10) / 10;
const areaOf = (f: number) => AREAS.find(a => f >= a.floorStart && f <= a.floorEnd && a.floorStart < 1000);
const fsEnemy = (f: number) => 1 + (f - 1) * 0.12 + (areaOf(f)?.enemyScaleBonus ?? 0);
const fsBoss = (f: number) => 1 + (f - 1) * 0.1;
// 精英期望乘子(出现概率 min(.25,.05+.01f) × ELITE_PREFIX 均匀)
const eliteP = (f: number) => Math.min(0.25, 0.05 + f * 0.01);
const ELITE = {
  hpM: mean(ELITE_PREFIX.map(p => p.hpM)), atkM: mean(ELITE_PREFIX.map(p => p.atkM)),
  defM: mean(ELITE_PREFIX.map(p => p.defM ?? 1)),
};
function eliteM(f: number) { const p = eliteP(f); return { hp: 1 + p * (ELITE.hpM - 1), atk: 1 + p * (ELITE.atkM - 1), def: 1 + p * (ELITE.defM - 1) }; }
// F55+ 深层回退池权重(复刻 pickWeightedByMf)
function deepPool(f: number) {
  const pool = ENEMIES.filter(e => e.mf >= 1);
  const ws = pool.map(e => Math.exp(-(f - e.mf) / 15));
  const tot = ws.reduce((a, b) => a + b, 0);
  return pool.map((e, i) => ({ e, w: ws[i] / tot }));
}
function windowEnemies(f: number) {
  const se = ENEMIES.filter(e => e.mf <= f && e.mf >= Math.max(1, f - 4) && e.mf >= 1);
  return se.length > 0 ? se.map(e => ({ e, w: 1 / se.length })) : deepPool(f);
}

// ---------- 1. 装备 Monte Carlo(真实 genWeapon/genArmor/genAcc, 至今最佳) ----------
type GearRun = { wAtk: number; aDef: number; accA: number; accD: number; accH: number };
function simulateGear(runs = 2000) {
  const perFloor: Record<number, GearRun[]> = {};
  for (let r = 0; r < runs; r++) {
    let best: GearRun = { wAtk: 0, aDef: 0, accA: 0, accD: 0, accH: 0 };
    let acc2: GearRun = { wAtk: 0, aDef: 0, accA: 0, accD: 0, accH: 0 };
    for (let f = 1; f <= 80; f++) {
      // 每层 genItem 次数: 击杀~70%×敌人8-13只×30% + 箱子1 ≈ 3-4
      const nGen = 3.5;
      const n = Math.floor(nGen) + (Math.random() < nGen % 1 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const roll = Math.random();
        if (roll < 0.12) { const it = gen.genWeapon(f); if (it.atk > best.wAtk) { if (best.wAtk > 0) { /* downgrade ignored */ } best = { ...best, wAtk: it.atk }; } }
        else if (roll < 0.22) { const it = gen.genArmor(f); if (it.def > best.aDef) best = { ...best, aDef: it.def }; }
        else if (roll < 0.34) {
          const it = gen.genAcc(f) as any;
          const score = (it.atk || 0) + (it.def || 0) + ((it.hp || 0) / 8);
          const cur = acc2.accA + acc2.accD + acc2.accH / 8;
          const cur1 = best.accA + best.accD + best.accH / 8;
          if (score > cur1) { acc2 = { ...best }; best = { ...best, accA: it.atk || 0, accD: it.def || 0, accH: it.hp || 0 }; }
          else if (score > cur) acc2 = { ...acc2, accA: it.atk || 0, accD: it.def || 0, accH: it.hp || 0 };
        }
      }
      if (f % 5 === 0 || f === 1) (perFloor[f] ??= []).push({ ...best, accA: best.accA + acc2.accA, accD: best.accD + acc2.accD, accH: best.accH + acc2.accH });
    }
  }
  const out: Record<number, GearRun> = {};
  for (const f of Object.keys(perFloor).map(Number)) {
    const rs = perFloor[f];
    out[f] = { wAtk: Math.round(mean(rs.map(r => r.wAtk))), aDef: Math.round(mean(rs.map(r => r.aDef))), accA: Math.round(mean(rs.map(r => r.accA))), accD: Math.round(mean(rs.map(r => r.accD))), accH: Math.round(mean(rs.map(r => r.accH))) };
  }
  return out;
}

// ---------- 2. 经验/等级曲线 ----------
function simulateLevel(expMult = 1) {
  // 每层击杀经验 = Σ(交战敌人) exp×fs×(1+eliteP×(expM_avg-1));elite expM avg=1.825
  const levels: Record<number, number> = {};
  let exp = 0, level = 1, next = 20;
  for (let f = 1; f <= 80; f++) {
    const roster = windowEnemies(f);
    const nSpawn = 5 + 3.5 + Math.floor(f / 3); // 房保底+extra 均值
    const fought = nSpawn * 0.7;
    const avgExp = mean(roster.map(r => r.e.exp));
    const eM = 1 + eliteP(f) * (mean(ELITE_PREFIX.map(p => p.expM ?? 1)) - 1);
    exp += fought * avgExp * fsEnemy(f) * eM * expMult;
    while (exp >= next) { exp -= next; level++; next = Math.floor(next * 1.5); }
    if (f % 5 === 0 || f === 1) levels[f] = level;
  }
  return levels;
}

// ---------- 3. 玩家面板(职业×画像×层) ----------
const META_PROFILES: Record<string, Record<string, number>> = {
  fresh: {},
  estab: { start_hp: 3, start_mp: 1, start_atk: 3, start_def: 3, crit_bonus: 2, dodge_bonus: 2, heal_bonus: 2, extra_talent: 2 },
};
// 天赋注入(优先级序, points 按层): [id, maxRank]
const TALENT_PLAN: Record<number, [string, number][]> = {
  0: [['w_battle_fury', 3], ['w_iron_skin', 3], ['w_blood', 3], ['w_weapon_mastery', 3], ['w_shield_mastery', 2]],
  1: [['r_keen_eye', 3], ['r_backstab', 1], ['r_swift_feet', 3], ['r_evasion', 2], ['r_double_strike', 1], ['r_death_mark', 1]],
  2: [['m_arcane_power', 3], ['m_mana_flow', 3], ['m_elemental_affinity', 1], ['m_spell_pen', 1], ['m_mana_shield', 1], ['m_archmage', 1]],
  3: [['p_holy_str', 3], ['p_divine_shield', 3], ['p_healing_light', 3], ['p_blessed_endurance', 3], ['p_aura', 1]],
};
function playerPanel(ci: number, ri: number, level: number, gear: GearRun, profile: keyof typeof META_PROFILES) {
  const cls = CLASSES[ci], race = RACES[ri];
  const m = META_PROFILES[profile];
  const lvGrowth = level - 1;
  const hpBonusWar = ci === 0 ? 5 : ci === 3 ? 3 : 0;
  let maxHp = cls.hp + race.hpM + 8.5 * lvGrowth + hpBonusWar * lvGrowth + (m.start_hp || 0) * 10 + gear.accH;
  let atk = cls.atk + race.atkM + 2 * lvGrowth + (m.start_atk || 0) + gear.wAtk + gear.accA;
  let def = cls.def + race.defM + 1 * lvGrowth + (m.start_def || 0) + gear.aDef + gear.accD;
  // 天赋
  const points = (level - 1) + (m.extra_talent || 0);
  let spent = 0;
  const ranks: Record<string, number> = {};
  for (const [id, maxR] of TALENT_PLAN[ci]) {
    if (spent >= points) break;
    const take = Math.min(maxR, points - spent); ranks[id] = take; spent += take;
  }
  const per: Record<string, number> = { w_battle_fury: 2, w_iron_skin: 2, w_weapon_mastery: 3, w_blood: 15, w_shield_mastery: 0, r_keen_eye: 5, r_swift_feet: 3, r_evasion: 5, m_arcane_power: 10, m_mana_flow: 5, p_holy_str: 2, p_divine_shield: 2, p_healing_light: 0, p_blessed_endurance: 15 };
  atk += (ranks.w_battle_fury || 0) * 2 + (ranks.w_weapon_mastery || 0) * 3 + (ranks.p_holy_str || 0) * 2;
  def += (ranks.w_iron_skin || 0) * 2 + (ranks.p_divine_shield || 0) * 2;
  maxHp += (ranks.w_blood || 0) * 15 + (ranks.p_blessed_endurance || 0) * 15;
  let crit = (ci === 1 ? 0.15 : 0.05) + (m.crit_bonus || 0) * 0.03 + (ranks.r_keen_eye || 0) * 0.05;
  let dodge = (ci === 1 ? 0.12 : 0.05) + (m.dodge_bonus || 0) * 0.02 + (ranks.r_swift_feet || 0) * 0.03 + (ranks.r_evasion || 0) * 0.05;
  let spellPower = ci === 2 ? 1.5 : ci === 3 ? 1.1 : 1;
  spellPower += (ranks.m_arcane_power || 0) * 0.10 + ((ranks.m_archmage || 0) ? 0.30 : 0);
  const doubleStrike = (ranks.r_double_strike || 0) ? 0.15 : 0;
  const manaShield = (ranks.m_mana_shield || 0) ? 0.10 : 0;
  const spellPen = (ranks.m_spell_pen || 0) ? 0.20 : 0;
  const critMult = 2 + (ranks.r_backstab || 0) * 0.25;
  return { maxHp, atk, def, crit: Math.min(0.85, crit), dodge: Math.min(0.75, dodge), spellPower, doubleStrike, manaShield, spellPen, critMult, level };
}

// ---------- 4. 每层战斗表 ----------
const E_RNG = 0; // E[rng(-2,2)] = 0
function combatRow(f: number, ci: number, ri: number, panel: ReturnType<typeof playerPanel>, endless = false) {
  const roster = windowEnemies(f);
  const em = eliteM(f);
  const fs = fsEnemy(f);
  const eHp = mean(roster.map(r => r.e.hp)) * fs * em.hp;
  const eAtk = mean(roster.map(r => r.e.atk)) * fs * em.atk;
  const eDef = mean(roster.map(r => r.e.def)) * fs * em.def;
  // 玩家近战期望伤害(暴击期望)
  const hitDmg = Math.max(1, panel.atk - eDef + E_RNG);
  const meleeDps = hitDmg * (1 + panel.crit * (panel.critMult - 1)) * (1 + panel.doubleStrike);
  // 技能期望折算(每 cd 回合一次;受 MP 约束粗略=可常驻)
  const cls = CLASSES[ci];
  let skillDps = 0;
  if (ci === 0) skillDps = (panel.atk * 1.5 * 1.4) / 8;          // 盾击150%+盾击精通满2级=1.4x, CD8
  else if (ci === 1) skillDps = (panel.atk * 2.5 * 2) / 6;       // 死亡标记必暴 ×2, CD6
  else if (ci === 2) {
    const blast = (panel.atk + panel.level * 3) * panel.spellPower * panel.spellPen;
    skillDps = (blast / 10) * 2.2;                                // CD10, 半径内~2.2敌均摊
  }
  const dps = meleeDps + skillDps;
  const ttk = eHp / dps;
  // 敌人打玩家
  const dmgIn = Math.max(1, eAtk - panel.def + E_RNG) * (1 - panel.dodge) * (1 - panel.manaShield);
  const hitsToDie = panel.maxHp / dmgIn;
  return { f, eHp: Math.round(eHp), eAtk: Math.round(eAtk), eDef: Math.round(eDef), dps: Math.round(dps), ttk: round1(ttk), hitsToDie: round1(hitsToDie) };
}
function bossRow(f: number, bd: any, ci: number, ri: number, panel: ReturnType<typeof playerPanel>) {
  const fs = fsBoss(f);
  const hp = bd.hp * fs;
  // 相位 atkM 加权: boss 在 hpThreshold 以下吃到 atkM — 粗略按阈值比例加权
  const ph = (bd.phases ?? []).map((p: any) => p.atkM ?? 1);
  const bdAtk = bd.atk;
  const phAtk = ph.length ? bdAtk * fs * mean(ph) : bdAtk * fs;
  const hitDmg = Math.max(1, panel.atk - bd.def * fs + E_RNG);
  const meleeDps = hitDmg * (1 + panel.crit * (panel.critMult - 1)) * (1 + panel.doubleStrike);
  let skillDps = 0;
  if (ci === 0) skillDps = (panel.atk * 1.5 * 1.4) / 8;
  else if (ci === 1) skillDps = (panel.atk * 2.5 * 2) / 6;
  else if (ci === 2) skillDps = ((panel.atk + panel.level * 3) * panel.spellPower * panel.spellPen) / 10;
  const dps = meleeDps + skillDps;
  const dmgIn = Math.max(1, phAtk - panel.def) * (1 - panel.dodge) * (1 - panel.manaShield);
  return { fl: bd.fl ?? f, name: bd.n.en, hp: Math.round(hp), ttk: Math.round(hp / dps), hitsToDie: round1(panel.maxHp / dmgIn) };
}

// ---------- 5. 腐化经济 ----------
function corruptionModel() {
  // 源: 下楼+1/层; 施法+1/次; 暗影被击+1; 深渊水 tile+1
  // 净化: 喷泉-15/神龛-20(checkTiles 批1 修复后活体); 净水-20(掉落)
  const cleansePer10Floors = 15 + 10; // ~1.5 次净化事件+1 瓶净水的保守估计
  const out: Record<string, number> = {};
  for (let ci = 0; ci < 4; ci++) {
    let c = 0;
    for (let f = 1; f <= 40; f++) {
      c += 1; // descend
      const roster = windowEnemies(f);
      const shadowShare = roster.filter(r => (r.e as any).el === 'shadow').length / roster.length;
      const fought = 8 * 0.7;
      const turnsHit = fought * 0.35; // 被击次数粗估(击杀前的互殴)
      c += turnsHit * shadowShare;
      if (ci === 2) c += 40 / 10;       // 法师: 每~10回合一次技能, 每层~40回合
      if (ci === 3) c += 40 / 12;       // 圣骑偶尔奶自己不施法, 低频
      if (f % 10 === 0) c -= cleansePer10Floors / 2; // 净化机遇不均, 折半保守
    }
    out[CLASSES[ci].name.en] = Math.round(Math.max(0, c));
  }
  return out;
}

// ---------- 6. 无尽墙 ----------
function endlessWall(ci: number, ri: number, levels: Record<number, number>, gear: Record<number, GearRun>) {
  // 玩家无尽成长: endless 武器 a=11-14+bonus; 假设 F45 前后拿到
  const endGearAtk = (f: number) => mean(ENDLESS_GEAR.weapons.map(w => w.a)) + Math.floor((f - 41) / 5 * 2);
  const endGearDef = (f: number) => mean(ENDLESS_GEAR.armors.map(a => a.d)) + Math.floor((f - 41) / 5 * 2);
  const gearNear = (f: number) => gear[Math.max(5, Math.floor(Math.min(80, f) / 5) * 5)];
  for (let f = 41; f <= 100; f += 5) {
    const g = gearNear(f);
    const panel = playerPanel(ci, ri, levels[Math.min(80, f)] ?? levels[80], g, 'estab');
    panel.atk = Math.max(panel.atk, endGearAtk(f) + panel.atk - (g.wAtk || 0)); // 换无尽武器
    panel.def = Math.max(panel.def, endGearDef(f) + panel.def - (g.aDef || 0));
    // 无尽 boss 每 5 层
    if (f % 5 === 0) {
      const bd = BOSSES[Math.floor(Math.random() * BOSSES.filter(b => b.fl > 0 && b.fl <= 40).length)];
      const row = bossRow(f, bd, ci, ri, panel);
      if (row.hitsToDie < 2.5) return { wall: f, hitsToDie: row.hitsToDie };
    }
  }
  return { wall: 100, hitsToDie: 99 };
}

// ---------- 7. 劣势道具占比 ----------
function inferiorItems() {
  const res: any[] = [];
  for (const w of ALL_WEAPONS) {
    // F30 时 r≤4 全池 → 每件 1/N 概率; 检查 bottom 件
    res.push({ id: w.id, atk: w.a, r: w.r, share30: (1 / ALL_WEAPONS.filter(x => x.r <= 4).length) });
  }
  return res;
}

// ================= 修复模拟 (proposed constants) =================
// 目标: TTK 1-8t / 受击死 4-10h / boss TTK 5-40t / 职业差 ±25% / 腐化 20-60 / 无尽墙 F55-65
const FIX = {
  defK: 100,          // dmg = atk*100/(100+def) 双向
  fsSlope: 0.10,      // 敌人缩放 .12 → .10
  sanctumBonus: 0.05, // 0.12 → 0.05 (endless 0.15 → 0.10)
  endlessBonus: 0.10,
  bossPhaseCap: 1.6,  // atkM 上限 2.0 → 1.6
  gearWeight: true,   // rarity 楼层加权 (w ∝ 1+(r_max-r)*2 … 深层偏好高稀有)
  corrCast: 0.5,      // 技能腐化 +1 → +0.5 (向下取整概率)
  metaPct: true,      // start_atk/def/hp 改百分比 (+5%/级)
  paladinSkill: 1.2,  // 圣光术附带 120%ATK 神圣伤害 (数值级补偿)
  mageHp: 1.25,       // 法师 baseMaxHp 30 → 38
  hpPerLevel: 10,    // 升级 hp 均值 8.5 → 10
  bossAtkCut: 0.75,  // F25+ boss 基础 atk ×0.75
};
function fixCombatRow(f: number, ci: number, panel: ReturnType<typeof playerPanel>) {
  const roster = windowEnemies(f);
  const em = eliteM(f);
  const fs = 1 + (f - 1) * FIX.fsSlope + (areaOf(f) ? (f >= 41 ? FIX.endlessBonus : (areaOf(f)!.enemyScaleBonus === 0.12 ? FIX.sanctumBonus : areaOf(f)!.enemyScaleBonus)) : 0);
  const eHp = mean(roster.map(r => r.e.hp)) * fs * em.hp;
  const eAtk = mean(roster.map(r => r.e.atk)) * fs * em.atk;
  const eDef = mean(roster.map(r => r.e.def)) * fs * em.def;
  const pHit = Math.max(1, Math.floor(panel.atk * FIX.defK / (FIX.defK + eDef)) * (1 + panel.crit * (panel.critMult - 1)) * (1 + panel.doubleStrike));
  let skillDps = 0;
  if (ci === 0) skillDps = (panel.atk * 1.5 * 1.4) / 8;
  else if (ci === 1) skillDps = (panel.atk * 2.5 * 1.75) / 6;   // 必暴 ×2 → ×1.75 微降
  else if (ci === 2) skillDps = ((panel.atk + panel.level * 3) * panel.spellPower * panel.spellPen) / 10 * 2.2;
  else if (ci === 3) skillDps = (panel.atk * FIX.paladinSkill) / 9;  // 圣光附带伤害
  const dps = pHit + skillDps;
  const dmgIn = Math.max(1, eAtk * FIX.defK / (FIX.defK + panel.def)) * (1 - panel.dodge) * (1 - panel.manaShield);
  return { f, ttk: round1(eHp / dps), h2d: round1(panel.maxHp / dmgIn) };
}
function fixCorruption(ci: number) {
  let c = 0;
  for (let f = 1; f <= 40; f++) {
    c += 1;
    const roster = windowEnemies(f);
    const shadowShare = roster.filter(r => (r.e as any).el === 'shadow').length / roster.length;
    c += 8 * 0.7 * 0.35 * shadowShare;
    if (ci === 2) c += (40 / 10) * FIX.corrCast;
    if (f % 10 === 0) c -= 12.5;
  }
  return Math.round(Math.max(0, c));
}
function runFixSim(levels: Record<number, number>, gear: Record<number, GearRun>) {
  const out: any = {};
  console.log('\n===== 修复模拟 (proposed) =====');
  for (const profile of ['estab'] as const) {
    for (let ci = 0; ci < 4; ci++) {
      const rows: any[] = [];
      for (const f of FLOORS) {
        const lv = levels[f] ?? 1;
        const g = gear[f] ?? { wAtk: 0, aDef: 0, accA: 0, accD: 0, accH: 0 };
        const panel = playerPanel(ci, 0, lv, g, profile);
        // hp 杠杆: 等级hp 8.5→10 (差 1.5×(lv-1)) + 法师 base 30→38
        panel.maxHp = Math.round(panel.maxHp + 1.5 * (lv - 1) + (ci === 2 ? 8 : 0));
        rows.push(fixCombatRow(f, ci, panel));
      }
      out[`${CLASSES[ci].name.en}`] = rows;
      console.log(`${CLASSES[ci].name.en}: ` + rows.map(r => `F${r.f}[${r.ttk}t/${r.h2d}h]`).join(' '));
    }
  }
  // Boss (fix)
  console.log('--- Boss (fix, estab) ---');
  const bossOut: any = {};
  for (const bd of BOSSES.filter((b: any) => b.fl > 0)) {
    const lv = levels[bd.fl] ?? 20;
    const g = gear[bd.fl] ?? gear[40];
    const perCls: any = {};
    for (let ci = 0; ci < 4; ci++) {
      const panel = playerPanel(ci, 0, lv, g, 'estab');
      panel.maxHp = Math.round(panel.maxHp + 1.5 * (lv - 1) + (ci === 2 ? 8 : 0));
      const fs = 1 + (bd.fl - 1) * 0.10;
      const bdAtk = bd.atk * (bd.fl >= 25 ? FIX.bossAtkCut : 1);
      const hp = bd.hp * fs;
      const ph = (bd.phases ?? []).map((p: any) => Math.min(FIX.bossPhaseCap, p.atkM ?? 1));
      const phAtk = ph.length ? bdAtk * fs * mean(ph) : bdAtk * fs;
      const pHit = Math.max(1, Math.floor(panel.atk * FIX.defK / (FIX.defK + bd.def * fs)) * (1 + panel.crit * (panel.critMult - 1)) * (1 + panel.doubleStrike));
      let skillDps = 0;
      if (ci === 0) skillDps = (panel.atk * 1.5 * 1.4) / 8;
      else if (ci === 1) skillDps = (panel.atk * 2.5 * 1.75) / 6;
      else if (ci === 2) skillDps = ((panel.atk + panel.level * 3) * panel.spellPower * panel.spellPen) / 10;
      else if (ci === 3) skillDps = (panel.atk * FIX.paladinSkill) / 9;
      const dmgIn = Math.max(1, phAtk * FIX.defK / (FIX.defK + panel.def)) * (1 - panel.dodge) * (1 - panel.manaShield);
      perCls[CLASSES[ci].name.en] = { ttk: Math.round(hp / (pHit + skillDps)), h2d: round1(panel.maxHp / dmgIn) };
    }
    bossOut[bd.n.en] = perCls;
    console.log(`F${bd.fl} ${bd.n.en}: ` + Object.entries(perCls).map(([k, v]: any) => `${k} ${v.ttk}t/${v.h2d}h`).join(' '));
  }
  console.log('--- 腐化@F40 (fix) ---');
  const corr: any = {};
  for (let ci = 0; ci < 4; ci++) { corr[CLASSES[ci].name.en] = fixCorruption(ci); }
  console.log(JSON.stringify(corr));
  return { classes: out, boss: bossOut, corruption: corr };
}

// ================= 主流程 =================
console.log('=== darkhollow 平衡审计 (Monte Carlo 2000 runs) ===\n');
const gear = simulateGear(2000);
const levels = simulateLevel(1);
const FLOORS = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
const report: any = { gear, levels, classes: {}, boss: {}, corruption: corruptionModel(), endlessWall: {} };

for (const profile of ['fresh', 'estab'] as const) {
  console.log(`\n----- 画像: ${profile} -----`);
  for (let ci = 0; ci < 4; ci++) {
    const rows: any[] = [];
    for (const f of FLOORS) {
      const lv = levels[f] ?? 1;
      const g = gear[f] ?? { wAtk: 0, aDef: 0, accA: 0, accD: 0, accH: 0 };
      const panel = playerPanel(ci, 0, lv, g, profile);
      rows.push(combatRow(f, ci, 0, panel));
    }
    report.classes[`${CLASSES[ci].name.en}_${profile}`] = rows;
    console.log(`${CLASSES[ci].name.en}: ` + rows.map(r => `F${r.f}[TTK ${r.ttk}t / 受击死 ${r.hitsToDie}h]`).join(' '));
  }
}

// Boss 表(estab, 每职业)
console.log('\n----- Boss 战 (estab 画像) -----');
for (const bd of BOSSES.filter((b: any) => b.fl > 0)) {
  const lv = levels[bd.fl] ?? 20;
  const g = gear[bd.fl] ?? gear[40];
  const perCls: any = {};
  for (let ci = 0; ci < 4; ci++) perCls[CLASSES[ci].name.en] = bossRow(bd.fl, bd, ci, 0, playerPanel(ci, 0, lv, g, 'estab'));
  report.boss[bd.n.en] = perCls;
  console.log(`F${bd.fl} ${bd.n.en}: ` + Object.entries(perCls).map(([k, v]: any) => `${k} ${v.ttk}t/${v.hitsToDie}h`).join(' '));
}

console.log('\n----- 腐化 @F40 (Guardian 结局需 <50) -----');
console.log(JSON.stringify(report.corruption));

console.log('\n----- 无尽墙 (estab, boss 受击死<2.5 的首个 5 层点) -----');
for (let ci = 0; ci < 4; ci++) {
  report.endlessWall[CLASSES[ci].name.en] = endlessWall(ci, 0, levels, gear);
  console.log(`${CLASSES[ci].name.en}: wall@F${report.endlessWall[CLASSES[ci].name.en].wall}`);
}

console.log('\n----- 等级曲线 / 面板快照 (estab, Human) -----');
console.log('levels:', JSON.stringify(levels));
for (const f of [10, 20, 30, 40, 60]) {
  const lv = levels[Math.min(80, Math.floor(f / 5) * 5)] ?? levels[80];
  const g = gear[Math.max(5, Math.floor(f / 5) * 5)];
  for (let ci = 0; ci < 4; ci++) {
    const p = playerPanel(ci, 0, lv, g, 'estab');
    report.panels ??= {}; report.panels[`${CLASSES[ci].name.en}@F${f}`] = { level: Math.round(lv), atk: Math.round(p.atk), def: Math.round(p.def), maxHp: Math.round(p.maxHp), crit: round1(p.crit * 100), dodge: round1(p.dodge * 100) };
  }
}
console.log(JSON.stringify(report.panels, null, 1));

console.log('\n----- 装备池(至今最佳均值) -----');
for (const f of [10, 20, 30, 40, 50, 60]) console.log(`F${f}: wAtk=${gear[f].wAtk} aDef=${gear[f].aDef} acc(+${gear[f].accA}/${gear[f].accD}/${gear[f].accH}hp)`);

report.fixSim = runFixSim(levels, gear);

// 劣势武器示例
const bad = inferiorItems().filter(x => x.atk <= 4);
console.log(`\n----- 严格劣势武器(F12+ 全池解锁后仍 1/${inferiorItems().length} 概率出现) -----`);
console.log(bad.map(b => `${b.id}(atk${b.atk})`).join(' '));

import { writeFileSync } from 'node:fs';
writeFileSync('docs/balance-audit-2026-09-22.json', JSON.stringify(report, null, 1));
console.log('\nJSON → docs/balance-audit-2026-09-22.json');
