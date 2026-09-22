# 批17「平衡大修」实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复平衡审计发现的 1-伤害墙/受击死跳水/腐化死亡陷阱/职业断崖/meta 无感/掉落无加权/无尽倒挂，全部数值经审计脚本 fixSim 验证落入目标带。

**Architecture:** 一处核心公式改造（combat.attack 减法→百分比减伤，双向）+ 六族数值改动（data.ts/enemies.ts/events.ts/skills.ts/item-gen.ts/combat.ts 表值）+ 审计脚本种子化并抽 `balance-targets.ts` 纯模块作 vitest 曲线回归门。零存档结构变更。

**Tech Stack:** TypeScript + Vite + vitest(happy-dom) + vite-node 审计脚本 + playwright 电池（既有惯例）。

**Spec:** `docs/superpowers/specs/2026-09-22-batch17-balance-overhaul/TECH.md`（§2 目标曲线表与 §3 变更清单是本计划的对照基准，执行者须同时读）

## Global Constraints

- 伤害公式 K=100：`dmg = max(1, floor((atk + rng(-2,2)) * 100 / (100 + def)))`，**双向**（玩家/敌同式），元素/暴击/法穿/mana shield/corruption 乘区位置不变（仍在新基础伤害之后）。
- 敌人 fs `.12 → .10`（**boss fs `.1` 不动**）；AREAS 仅改 sanctum `0.12→0.05`、endless `0.15→0.10`。
- F25+ 四 Boss atk ×0.75 + phases atkM 2.0→1.6（Dragon Emperor 28→21 / Leviathan 35→26 / Void Sovereign 45→34 / Creator 55→41）。
- 升级 HP `rng(5,12) → rng(6,14)`（combat.ts:245，**不是** dungeon.ts:20 的同形 rng——那是房间尺寸）。
- 掉落加权 `w = 1 + b.r * (1 + f/40)`，mr 门不变。
- 腐化：施法 50% 概率 +1；净水 v 20→30（data.ts CONSUMABLES purified_water 的 v 与 desc 两处 + items.ts:157 fallback `|| 20` → `|| 30`）；神龛 -20→-25（events.ts:189）。
- 职业：Rogue 必暴倍率 `* 2` → `* 1.75`（skills.ts burst case，含 aoe 分支两处同字面量）；Paladin 圣光术附带 120%ATK 神圣伤害（≤4 距离全体）；Mage CLASSES hp 30→38。
- meta：start_hp 10→15 / start_atk 1→2 / start_def 1→2 / crit_bonus 3→4 / dodge_bonus 2→3（valuePerLevel 字段，costs 不动，desc 双语同步「+15/+2/+2/+4%/+3%」）。
- 无尽 4 敌 mf：Void Titan 42→44 / Doom Seraph 45→48 / Entropy Beast 48→52 / Abyssal Tyrant 50→56。
- 每任务收尾：`npx tsc --noEmit`（裸跑看退出码，**禁管道**——grep 管道会吞 exit code）+ `npx vitest run`（全绿）再 commit。
- 老档兼容：不改任何 SaveData/类型结构；改的是公式与静态表。
- i18n 规则：改数值文案时 en/zh 双语同改；新键走 `t()`/`tx()`，占位符用 `{}` 不用 `{1}`。

---

### Task 1: T1 伤害公式改造（核心）

**Files:**
- Modify: `src/combat.ts:85`（attack() 第一行伤害计算）
- Test: `src/__tests__/batch17-formula.test.ts`（新建）

**Interfaces:**
- Produces: 全局伤害语义 `dmg = max(1, floor((atk + rng(-2,2)) * 100 / (100 + def)))`，后续所有任务与曲线门依赖此语义。
- Consumes: 无（叶改动）。

- [ ] **Step 1: 写失败测试**（新文件 `src/__tests__/batch17-formula.test.ts`）

公式纯函数无法直接单测（attack 耦合 G/消息/fx），用真实 `attack()` + 最小 G 桩，锁定三个判据：低层等价、百分比减伤、def≥atk 不塌陷。

```ts
// batch17: 伤害公式=百分比减伤 dmg=max(1,floor((atk+rng(-2,2))*100/(100+def)))
// 真实 attack() + 最小 G 桩。rng 抖动 ±2 在 atk 侧，选大 atk 差使断言对 rng 不敏感。
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../state.js', () => ({ G: null, lang: 'en', setGameState: () => {} }));
vi.mock('../i18n.js', () => ({ t: () => '', tMsg: () => '', tx: () => '' }));
vi.mock('../messages.js', () => ({ addMsg: () => {} }));
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../effects.js', () => ({ flt: () => {} }));
vi.mock('../fx.js', () => ({ fxFlash: () => {}, fxBurst: () => {}, fxBeam: () => {}, fxBolt: () => {}, fxAura: () => {} }));
vi.mock('../talents.js', () => ({ onPlayerHitEnemy: (_e: any, d: number) => d, getCritMultiplier: () => 2, getSkillModifiers: () => ({}) as any, applyTalentBonuses: () => {} }));
vi.mock('../relics.js', () => ({ relicOnHitEnemy: (_e: any, d: number) => d, relicOnCrit: () => {}, relicOnDodge: () => {}, applyRelicBonuses: () => {}, hasRelic: () => false }));
vi.mock('../corruption.js', () => ({ corruptionMods: () => ({ spellPct: 0, critPct: 0, atk: 0, healPct: 0, dmgTakenPct: 0 }) as any }));
vi.mock('../meta.js', () => ({ getMeta: () => ({}) as any, bonusGold: (g: number) => g, bonusExp: (e: number) => e }));

import { attack } from '../combat.js';
import type { Enemy, Player } from '../types.js';

const mkEnemy = (hp: number, def: number): Enemy =>
  ({ name: 'T', x: 2, y: 2, hp, maxHp: hp, atk: 1, def, exp: 5, goldDrop: 5, el: 'none', res: {}, isAlly: false } as unknown as Enemy);

function seedG(player: Partial<Player>, enemy: Enemy) {
  (globalThis as any).G = {
    player: { critChance: 0, dodgeChance: 0, spellPower: 1, elDmgBonus: {}, elRes: {}, healBonus: 0, corruption: 0, buffs: [], x: 1, y: 1, ...player } as unknown as Player,
    enemies: [enemy], gameOver: false, won: false, floor: 1, endless: false, branchMode: false,
  };
}

describe('batch17 T1 percentage-mitigation formula', () => {
  beforeEach(() => { vi.clearAllMocks(); Math.random = () => 0.5; });  // rng(-2,2) 均值 0

  it('low-def equivalence: atk100 vs def3 ≈ 97 (old: 97)', () => {
    const e = mkEnemy(999, 3); seedG({ atk: 100, def: 0 }, e);
    attack({ atk: 100, el: 'none' } as any, e, true);
    expect(999 - e.hp).toBe(97);  // floor(100*100/103)=97
  });

  it('percentage mitigation: atk100 vs def100 → 50 (old: 1)', () => {
    const e = mkEnemy(999, 100); seedG({ atk: 100, def: 0 }, e);
    attack({ atk: 100, el: 'none' } as any, e, true);
    expect(999 - e.hp).toBe(50);
  });

  it('no wall at def≥atk: atk50 vs def200 → 12 (old: 1)', () => {
    const e = mkEnemy(999, 200); seedG({ atk: 50, def: 0 }, e);
    attack({ atk: 50, el: 'none' } as any, e, true);
    expect(999 - e.hp).toBe(12);  // floor(50*100/300)=16? No: 50*100/(100+200)=16.67→16
  });

  it('floor 1: applies symmetrically to enemy attacks (def-side)', () => {
    const e = mkEnemy(999, 0); e.atk = 60;
    seedG({ atk: 0, def: 50, maxHp: 999, hp: 999, warded: false } as Partial<Player>, e);
    attack(e as any, (globalThis as any).G.player, false);
    expect(999 - (globalThis as any).G.player.hp).toBe(30);  // 60*100/150=40? floor(60*100/(100+50))=40
  });
});
```

**注意**：Step 1 里两行注释的期望值有笔误（12 应为 16、30 应为 40）——**以数学为准写对再跑**：`floor(atk*100/(100+def))`。上面保留笔误标注是提醒：断言值必须自己按公式算，别抄 plan。正确断言：第 3 条 `toBe(16)`，第 4 条 `toBe(40)`。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/__tests__/batch17-formula.test.ts`
Expected: 4 FAIL（当前公式 atk-def：97→97 可能过，但 50→1、16→1、40→10 三条必红）。任一条绿=断言或桩写错，回 Step 1。

- [ ] **Step 3: 改公式**（`src/combat.ts:85`）

```ts
// 旧: let dmg = Math.max(1, atk.atk - def.def + rng(-2, 2));
// batch17 T1: percentage mitigation (K=100) — def=100 ⇒ 50% 减伤, 单调无 1-dmg 墙;
// 低层 def≤3 时与旧减法差 <1 (F1-15 体感不变)。调参入口=此常量 100。
const MITIG_K = 100;
let dmg = Math.max(1, Math.floor((atk.atk + rng(-2, 2)) * MITIG_K / (MITIG_K + def.def)));
```

- [ ] **Step 4: 跑新测试 + 全量测试**

Run: `npx vitest run src/__tests__/batch17-formula.test.ts` → 4 PASS。
Run: `npx vitest run` → 若有精确伤害 pin 挂：按映射 `旧 atk-def → 新 floor(atk*100/(100+def))` 更新期望值（预期受影响文件：`enemy-skills.test.ts` L12-16 的本地 mock 副本公式须同步镜像新公式——它被 executeEnemySkill 的 dmg_bolt 期望值依赖；`talents.test.ts` 反击注释 dmg 7→8-9 区间，断言按杀不死/杀得死语义一般不动）。**禁止为过测改生产公式回旧值**。
Run: `npx tsc --noEmit`（裸跑）→ exit 0。

- [ ] **Step 5: Commit**

```bash
git add src/combat.ts src/__tests__/batch17-formula.test.ts src/__tests__/enemy-skills.test.ts
git commit -m "feat(batch17): T1 percentage-mitigation damage formula (K=100, both directions) — kills the 1-dmg wall at F35+"
```

---

### Task 2: T2 敌人缩放放缓 + 区域加成

**Files:**
- Modify: `src/enemies.ts:39`（spawnEnemies fs）、`src/enemies.ts:88`（spawnBranchEnemies fs）、`src/enemies.ts:312`（summon fs）、`src/enemies.ts:403`（bossSummonAdd fs）
- Modify: `src/warden.ts:11`（fs 镜像副本 + L7 注释）
- Modify: `src/data.ts` AREAS sanctum `enemyScaleBonus: 0.12`→`0.05`、endless `enemyScaleBonus: 0.15`→`0.10`
- Test: 既有 `src/__tests__/warden.test.ts`（fs pin 更新）+ 新增断言进 `src/__tests__/batch17-formula.test.ts`

**Interfaces:**
- Produces: 敌人生效缩放 `fs = 1 + (floor-1)*0.10 + areaBonus`（boss `0.1` 不变）；warden 同步。
- Consumes: Task 1 无关（独立）。

- [ ] **Step 1: 写失败测试**（追加到 `src/__tests__/batch17-formula.test.ts`）

```ts
// batch17 T2: enemy fs slope .12 → .10
describe('batch17 T2 enemy scale slope', () => {
  it('sanctum area bonus 0.12 → 0.05, endless 0.15 → 0.10', async () => {
    const { AREAS } = await import('../data.js');
    const sanctum = AREAS.find(a => a.id === 'sanctum')!;
    const endless = AREAS.find(a => a.id === 'endless')!;
    expect(sanctum.enemyScaleBonus).toBe(0.05);
    expect(endless.enemyScaleBonus).toBe(0.10);
  });
  it('wardenStats mirrors .10 slope', async () => {
    const { wardenStats } = await import('../warden.js');
    const s = wardenStats(11);  // fs = 1 + 10*0.10 = 2.0
    expect(s.atk).toBe(Math.floor(30 * 2.0));  // 以 warden.ts 基础 atk 为准——先读 warden.ts 再填真值
  });
});
```

**注意**：`wardenStats` 的基础 atk 以 `src/warden.ts` 实际表值为准（先读文件再写断言，别猜）。

- [ ] **Step 2: 跑测试确认失败**（warden/AREAS 断言红）

Run: `npx vitest run src/__tests__/batch17-formula.test.ts`

- [ ] **Step 3: 改四处 fs + warden 镜像 + AREAS**

`src/enemies.ts` 四处 `1 + (floor|fl - 1) * .12` → `* .10`（L39/L88/L312/L403；L39 那行含 `+ (area ? area.enemyScaleBonus : 0)` 保留）。**不要碰 `1 + (floor - 1) * .1`（boss fs）与 `1 + (fl - 1) * .1`（endless boss/批2 boss 站点）**——改前逐行看上下文。
`src/warden.ts:11` `0.12` → `0.10`，L7 注释同步 `matches spawnEnemies: 1 + (floor-1)*.10`。
`src/data.ts` AREAS sanctum 行 `enemyScaleBonus: 0.12` → `0.05`；endless 行 `enemyScaleBonus: 0.15` → `0.10`（fungal 的 0.1 不动）。

- [ ] **Step 4: 全量测试**（warden.test.ts 的 `fs = 1 + 9*.12 = 2.08` 两处 pin 按 `.10` 重算期望——`wardenStats(10)` fs=1.9）

Run: `npx vitest run` 全绿；`npx tsc --noEmit` exit 0。

- [ ] **Step 5: Commit**

```bash
git add src/enemies.ts src/warden.ts src/data.ts src/__tests__/warden.test.ts src/__tests__/batch17-formula.test.ts
git commit -m "feat(batch17): T2 enemy fs slope .12→.10 + sanctum/endless area bonus trim (0.12→0.05 / 0.15→0.10)"
```

---

### Task 3: T3+T4 Boss 数值 + 升级 HP 成长

**Files:**
- Modify: `src/data.ts` BOSSES：Dragon Emperor `atk: 28`→`21`、Leviathan `atk: 35`→`26`、Void Sovereign `atk: 45`→`34`、Creator `atk: 55`→`41`；Void Sovereign phases `atkM: 2`→`1.6`、Creator 第二相 `atkM: 2`→`1.6`
- Modify: `src/combat.ts:245` `rng(5, 12)` → `rng(6, 14)`
- Test: 追加断言进 `src/__tests__/batch17-formula.test.ts`

**Interfaces:**
- Produces: Boss 表值新基准；升级 HP 期望均值 10。
- Consumes: 无。

- [ ] **Step 1: 写失败测试**

```ts
// batch17 T3/T4: boss atk ×0.75 (fl≥25) + phase atkM cap 1.6 + levelup hp rng(6,14)
describe('batch17 T3/T4 boss atk & levelup hp', () => {
  it('F25+ boss atk cut + atkM cap', async () => {
    const { BOSSES } = await import('../data.js');
    const byName = (fl: number) => BOSSES.find((b: any) => b.fl === fl)!;
    expect(byName(25).atk).toBe(21);
    expect(byName(30).atk).toBe(26);
    expect(byName(35).atk).toBe(34);
    expect(byName(40).atk).toBe(41);
    expect(byName(35).phases[0].atkM).toBe(1.6);
    expect(byName(40).phases[1].atkM).toBe(1.6);
    // 未动的: 龙皇 1.6 相位不在此列(25 的 phase atkM 本为 1.6 不改), Leviathan 1.5 不改
    expect(byName(30).phases[0].atkM).toBe(1.5);
  });
  it('checkLevelUp hp roll is rng(6,14) — source-level pin', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync('src/combat.ts', 'utf-8');
    expect(src).toMatch(/rng\(6, 14\)/);
    expect(src).not.toMatch(/rng\(5, 12\)/);  // dungeon.ts 的同形 rng 不在本文件
  });
});
```

- [ ] **Step 2: 确认失败** → Run: `npx vitest run src/__tests__/batch17-formula.test.ts`

- [ ] **Step 3: 改表值**（data.ts BOSSES 四条 atk + 两个 atkM；combat.ts:245 rng(6,14)——注意职业加成 `+ (p.ci === 0 ? 5 : ...)` 整行保留）

- [ ] **Step 4: 全量**（batch2-boss-skills/enemies-boss 等若 pin 旧 atk 值按新表改）→ vitest 全绿 + tsc 0

- [ ] **Step 5: Commit**

```bash
git add src/data.ts src/combat.ts src/__tests__/batch17-formula.test.ts
git commit -m "feat(batch17): T3 F25+ boss atk ×0.75 + atkM cap 1.6; T4 levelup hp rng(6,14)"
```

---

### Task 4: T5 掉落稀有度楼层加权

**Files:**
- Modify: `src/item-gen.ts`：genWeapon L35 / genArmor L46 / genAcc L55 的 `pick(el)` → `pickWeighted(el, f)`
- Test: 新增 `src/__tests__/batch17-drop-weight.test.ts`

**Interfaces:**
- Produces: `pickWeighted<T extends { r: number }>(pool: T[], f: number): T`（item-gen.ts 内导出，权重 `1 + b.r * (1 + f/40)`）。
- Consumes: data.ts ALL_* 池（既有）。

- [ ] **Step 1: 写失败测试**

```ts
// batch17 T5: 掉落稀有度楼层加权 w=1+r*(1+f/40)
import { describe, it, expect } from 'vitest';
import { pickWeighted } from '../item-gen.js';
import { ALL_WEAPONS } from '../data.js';

describe('batch17 T5 drop rarity weighting', () => {
  it('weight formula: r0 w=1, r4@F40 w=5', () => {
    const r0 = ALL_WEAPONS.find(w => w.r === 0 && w.id === 'rusty_sword')!;
    const r4 = ALL_WEAPONS.find(w => w.r === 4 && w.id === 'godslayer_sword')!;
    // 间接验证: F40 十万次抽取, r4 命中率 ≈ w4/Σw (±1%)
    let hit4 = 0, hit0 = 0; const N = 100000;
    for (let i = 0; i < N; i++) {
      const p = pickWeighted(ALL_WEAPONS.filter(w => w.r <= 4), 40);
      if (p.r === 4) hit4++; if (p.r === 0) hit0++;
    }
    const wS = ALL_WEAPONS.filter(w => w.r <= 4)
      .reduce((s, w) => s + 1 + w.r * (1 + 40 / 40), 0);
    expect(hit4 / N).toBeGreaterThan((5 / wS) * 0.9);
    expect(hit0 / N).toBeLessThan((1 / wS) * 1.1);
  });
  it('mr gate unchanged: F5 max rarity 1', () => {
    for (let i = 0; i < 2000; i++) {
      const p = pickWeighted(ALL_WEAPONS.filter(w => w.r <= Math.min(4, Math.floor(5 / 3))), 5);
      expect(p.r).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: 确认失败**（pickWeighted 不存在 → 编译错即红）

- [ ] **Step 3: 实现**（item-gen.ts，utils 的 pick 旁）

```ts
// batch17 T5: rarity-vs-floor weighting — deeper floors favor higher rarity,
// so F40 drops r4 at 5× the r0 rate instead of uniform. mr gate unchanged.
export function pickWeighted<T extends { r: number }>(pool: T[], f: number): T {
  const ws = pool.map(b => 1 + b.r * (1 + f / 40));
  let roll = Math.random() * ws.reduce((s, w) => s + w, 0);
  for (let i = 0; i < pool.length; i++) { roll -= ws[i]; if (roll < 0) return pool[i]; }
  return pool[pool.length - 1];
}
```

genWeapon/genArmor/genAcc 三处 `const b = pick(el);` → `const b = pickWeighted(el, f);`（genAcc 的参数名是 `f`，genWeapon/genArmor 也是 `f`——逐一确认）。

- [ ] **Step 4: 全量**（既有 items/item-gen characterization 若均匀池分布 pin 会被加权改变——按新分布重算；genPotion/genScroll/genFood/genConsumable 的 `pick`/索引不动）→ vitest 全绿 + tsc 0

- [ ] **Step 5: Commit**

```bash
git add src/item-gen.ts src/__tests__/batch17-drop-weight.test.ts
git commit -m "feat(batch17): T5 drop rarity-vs-floor weighting (F40 r4:r0 = 5:1)"
```

---

### Task 5: T6 腐化经济

**Files:**
- Modify: `src/skills.ts:58`（施法腐化 50% 概率）
- Modify: `src/data.ts` CONSUMABLES purified_water `v: 20`→`30` + desc 双语「净化 20 腐化」→「净化 30 腐化」/ 'Cleanses 30 corruption'
- Modify: `src/items.ts:157` fallback `item.val || 20` → `|| 30`（两处同值——val 与消息各一）
- Modify: `src/events.ts:189` `applyCorruption(-20)` → `(-25)`
- Test: 新增 `src/__tests__/batch17-corruption-econ.test.ts`

**Interfaces:**
- Produces: 施法腐化概率化；净水 30；神龛 -25。
- Consumes: combat.ts applyCorruption（既有）。

- [ ] **Step 1: 写失败测试**

```ts
// batch17 T6: 施法 50% 概率+1 / 净水30 / 神龛-25
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';

describe('batch17 T6 corruption economy', () => {
  it('skills.ts cast corruption is probabilistic (50%)', () => {
    const src = readFileSync('src/skills.ts', 'utf-8');
    expect(src).toMatch(/Math\.random\(\) < 0\.5[^;]*applyCorruption\(1\)|applyCorruption\(1\)[^;]*< 0\.5/s);
  });
  it('purified_water v=30 + desc 30 (both langs)', async () => {
    const { ALL_CONSUMABLES } = await import('../data.js');
    const w = ALL_CONSUMABLES.find(c => c.ef === 'purify')!;
    expect(w.v).toBe(30);
    expect(w.desc!.en).toContain('30'); expect(w.desc!.zh).toContain('30');
  });
  it('items.ts purify fallback is 30', () => {
    const src = readFileSync('src/items.ts', 'utf-8');
    expect(src.match(/item\.val \|\| (\d+)/)?.[1]).toBe('30');
  });
  it('shrine cleanse -25', () => {
    const src = readFileSync('src/events.ts', 'utf-8');
    expect(src).toContain('applyCorruption(-25)');
  });
});
```

- [ ] **Step 2: 确认失败**

- [ ] **Step 3: 实现**

skills.ts:58：
```ts
  // batch17 T6: 施法腐化概率化(50%) — 法师每层~4 施法不再线性爆 100,
  // Guardian 结局(<50)对施法系可达。近战职业施法稀疏, 影响可忽略。
  if (Math.random() < 0.5) applyCorruption(1);
```
（删原 `applyCorruption(1); // drawing on the seal's power corrupts (Playtest #9)` 行，注释语义并入新行。）

data.ts purified_water：`v: 20`→`v: 30`；desc zh `'净化 20 腐化'`→`'净化 30 腐化'`、en `'Cleanses 20 corruption'`→`'Cleanses 30 corruption'`。
items.ts:157 两处 `item.val || 20` → `item.val || 30`。
events.ts:189 `applyCorruption(-20)` → `applyCorruption(-25)`（fountain -15 与事件弹窗分支不动；若 i18n 有神龛净化数值文案 grep `ev.shrinePurify` 键同步，无数值则不动）。

- [ ] **Step 4: 全量**（batch10-shrine / corruption 相关测试若 pin -20/20 按 -25/30 更新）→ vitest 全绿 + tsc 0

- [ ] **Step 5: Commit**

```bash
git add src/skills.ts src/data.ts src/items.ts src/events.ts src/__tests__/batch17-corruption-econ.test.ts
git commit -m "feat(batch17): T6 corruption economy — 50% cast roll, purified water 30, shrine -25"
```

---

### Task 6: T7 职业微调

**Files:**
- Modify: `src/skills.ts` burst case：非 aoe 分支 `* 2` → `* 1.75`（L106）；aoe 分支 `* 2` → `* 1.75`（L112）
- Modify: `src/skills.ts` heal case：治疗段后追加神圣伤害段
- Modify: `src/data.ts` CLASSES：Mage `hp: 30`→`hp: 38`；Paladin skill desc 双语更新
- Test: 新增 `src/__tests__/batch17-class-tuning.test.ts`

**Interfaces:**
- Produces: 圣光术附带 `floor(p.atk * 1.2)` 神圣伤害作用于 dst≤4 全体敌（对齐 p_consecrate 的实现形状）。
- Consumes: skills.ts 既有 helpers（dst/fx*）。

- [ ] **Step 1: 写失败测试**

```ts
// batch17 T7: rogue 必暴 1.75 / 圣光附带伤害 / mage hp 38
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';

describe('batch17 T7 class tuning', () => {
  it('death-mark crit mult 1.75 (both branches)', () => {
    const src = readFileSync('src/skills.ts', 'utf-8');
    const burst = src.slice(src.indexOf("case 'burst'"), src.indexOf("case 'aoe'"));
    expect(burst).not.toMatch(/\* 2\b/);
    expect(burst).toMatch(/1\.75/);
  });
  it('mage base hp 38', async () => {
    const { CLASSES } = await import('../data.js');
    expect(CLASSES[2].hp).toBe(38);
  });
  it('paladin skill desc mentions holy damage (both langs)', async () => {
    const { CLASSES } = await import('../data.js');
    const d = CLASSES[3].skill.desc;
    expect(d.zh).toContain('神圣伤害'); expect(d.en).toContain('holy dmg');
  });
  it('heal case deals holy damage to ≤4 range foes', () => {
    const src = readFileSync('src/skills.ts', 'utf-8');
    const heal = src.slice(src.indexOf("case 'heal'"), src.indexOf('case ', src.indexOf("case 'heal'") + 10));
    expect(heal).toMatch(/p\.atk \* 1\.2/);
    expect(heal).toMatch(/<= 4/);
  });
});
```

- [ ] **Step 2: 确认失败**

- [ ] **Step 3: 实现**

burst case 两处 `Math.floor(p.atk * 2.5 * mods.dmgMult * 2)` → `* 1.75`（death-mark 注释同步「×1.75」）。

heal case 在 `p.poisonTurns = 0;` 之后、Consecrate 块之前插入（**独立于 p_consecrate 天赋，无条件生效**；若目标已在 Consecrate 块处理避免双算——读实现后若 Consecrate 也打伤害，则新段仅在 `!mods.alsoHolyDmg` 时执行并注释说明）：
```ts
      // batch17 T7: Holy Light 附带神圣伤害 — Paladin 零伤害技能在 def 墙时代掉队,
      // 给 120% ATK 神圣伤害(≤4 距离全体), 与 p_consecrate 天赋叠加规则:
      // alsoHolyDmg 存在时由天赋块处理更强的版本, 此基础段跳过防双算。
      if (!mods.alsoHolyDmg) {
        const foes = G.enemies.filter(e => !e.isAlly && dst(p.x, p.y, e.x, e.y) <= 4);
        for (const e of foes) {
          const dmg = Math.floor(p.atk * 1.2);
          e.hp -= dmg; flt(e.x, e.y, `-${dmg}`, '#ffd700');
          if (e.hp <= 0) killEnemy(e);
        }
        G.enemies = G.enemies.filter(e => e.hp > 0 || e.isAlly);
        if (foes.length) addMsg(tMsg('sk.holyNovaDmg', String(foes.length)), 'msk');
      }
```
（`sk.holyNovaDmg` 新 i18n 键：en `'Holy Light scorches {}/foe(s) for holy dmg!'`——**执行时按 i18n.ts 既有 `{}` 占位风格写全两种语言**，killEnemy 若未 import 则按文件内既有调用方式接线。）

data.ts CLASSES[2] `hp: 30` → `hp: 38`；CLASSES[3].skill.desc zh `'恢复40%最大HP并净化(6MP,CD:9)'` → `'恢复40%最大HP并净化,对附近敌人造成120%ATK神圣伤害(6MP,CD:9)'`，en 对应加 `, 120% ATK holy dmg to nearby foes`。

- [ ] **Step 4: 全量**（skills 相关 characterization 若 pin 旧倍率/职业 hp 按新值更新）→ vitest 全绿 + tsc 0

- [ ] **Step 5: Commit**

```bash
git add src/skills.ts src/data.ts src/i18n.ts src/__tests__/batch17-class-tuning.test.ts
git commit -m "feat(batch17): T7 class tuning — rogue crit 1.75, paladin holy dmg on heal, mage hp 38"
```

---

### Task 7: T8+T9 meta 数值 + 无尽窗口

**Files:**
- Modify: `src/data.ts` META_UPGRADES：start_hp `valuePerLevel: 10`→`15`、start_atk `1`→`2`、start_def `1`→`2`、crit_bonus `3`→`4`、dodge_bonus `2`→`3`（五条 desc 双语数值同步 +15/+2/+2/+4%/+3%）
- Modify: `src/data.ts` ENEMIES 四条 mf：Void Titan `mf: 42`→`44`、Doom Seraph `45`→`48`、Entropy Beast `48`→`52`、Abyssal Tyrant `50`→`56`
- Test: 新增 `src/__tests__/batch17-meta-endless.test.ts`

**Interfaces:**
- Produces: meta 新数值；无尽 mf 窗口 F55-60 直供。
- Consumes: meta.ts applyMetaUpgrades 消费 valuePerLevel（既有，自动跟随）。

- [ ] **Step 1: 写失败测试**

```ts
// batch17 T8/T9: meta 数值放大 + 无尽 mf 窗口
import { describe, it, expect } from 'vitest';

describe('batch17 T8/T9 meta & endless window', () => {
  it('meta values buffed', async () => {
    const { META_UPGRADES } = await import('../data.js');
    const by = (id: string) => META_UPGRADES.find(u => u.id === id)!;
    expect(by('start_hp').valuePerLevel).toBe(15);
    expect(by('start_atk').valuePerLevel).toBe(2);
    expect(by('start_def').valuePerLevel).toBe(2);
    expect(by('crit_bonus').valuePerLevel).toBe(4);
    expect(by('dodge_bonus').valuePerLevel).toBe(3);
    expect(by('start_hp').d.zh).toContain('15');
  });
  it('endless mf spread feeds F55-60 window', async () => {
    const { ENEMIES } = await import('../data.js');
    const by = (id: string) => ENEMIES.find((e: any) => e.n.en === id);
    const mfs = ['Void Titan', 'Doom Seraph', 'Entropy Beast', 'Abyssal Tyrant'].map(nm => by(nm)!.mf);
    expect(mfs).toEqual([44, 48, 52, 56]);
    // F55 窗口 [51,55] 有 Entropy Beast(52) 直供
    const win = ENEMIES.filter((e: any) => e.mf <= 55 && e.mf >= 51);
    expect(win.some((e: any) => e.n.en === 'Entropy Beast')).toBe(true);
  });
});
```

- [ ] **Step 2: 确认失败**

- [ ] **Step 3: 改表**（五条 valuePerLevel + 五条 desc 双语数值；四条 mf——ENEMIES 内 mf 值唯一性无冲突[52/56 无既有敌占用，grep 确认]）

- [ ] **Step 4: 全量**（meta/rebirth/endless-content 测试若 pin 旧 valuePerLevel/mf 按新值更新；makeEnemy-real-data 的 checked 计数不含 mf 变化）→ vitest 全绿 + tsc 0

- [ ] **Step 5: Commit**

```bash
git add src/data.ts src/__tests__/batch17-meta-endless.test.ts
git commit -m "feat(batch17): T8 meta presence (hp15/atk2/def2/crit4/dodge3) + T9 endless mf window 44/48/52/56"
```

---

### Task 8: T0 曲线回归门（balance-targets 纯模块 + 带状断言）

**Files:**
- Create: `src/balance-targets.ts`（纯模块：导入 data.ts 只读，复刻审计脚本的曲线计算）
- Create: `src/__tests__/batch17-balance-curves.test.ts`
- Modify: `scripts/balance_audit.mts`（蒙特卡洛换 mulberry32 种子=13——可选共用，**最小改动**：仅把 `Math.random` 在脚本顶部替换为种子版，fixSim 判据以本任务测试为准）

**Interfaces:**
- Produces: `curves(profile: 'fresh'|'estab')` 返回 `{ classes: Record<string, {f:number,ttk:number,h2d:number}[]>, boss: Record<string, {ttk:number,h2d:number}>, corruption: Record<string,number> }`。
- Consumes: Task 1-7 全部新数值（data.ts/combat 语义镜像——本模块**复刻公式**而非 import combat[耦合 G]）。

- [ ] **Step 1: 写 balance-targets.ts**

从 `scripts/balance_audit.mts` 的 fixSim 段（`FIX` 常量 + `fixCombatRow` + fix boss 计算 + `fixCorruption` + `playerPanel`/`windowEnemies`/`eliteM`/gear 期望表）抽成纯模块。**gear 期望表不用蒙特卡洛**——直接内嵌审计输出 `docs/balance-audit-2026-09-22.json` 的 `gear` 均值快照（F10/F20/.../F80 九个点，线性插值），注明来源与刷新法（重跑审计脚本更新快照）。公式常量与 Task 1-7 完全一致（MITIG_K=100 / fs .10 / 区域加成 / boss cut / hp rng(6,14) 期望 10 / 加权掉落用 gear 快照吸收）。

关键签名：
```ts
export function windowEnemies(f: number): { e: EnemyDef; w: number }[]
export function playerPanel(ci: number, level: number, gear: GearRun, profile: 'fresh'|'estab'): Panel
export function curves(profile: 'fresh'|'estab'): Curves
```

- [ ] **Step 2: 写带状断言测试**（`src/__tests__/batch17-balance-curves.test.ts`，锁 spec §2 表）

```ts
// batch17 T0: 曲线带状回归门 — spec §2 目标表锁定, 防未来数值漂移
import { describe, it, expect } from 'vitest';
import { curves } from '../balance-targets.js';

const BANDS: [number, number, number, number][] = [
  // [floor, ttkMin, ttkMax, h2dMin] — estab 画像, 全职业须同时满足
  [10, 0.5, 3, 8], [15, 1, 4, 6], [20, 1.5, 6, 4.5], [25, 2, 7, 4],
  [30, 2, 8, 4.5], [35, 2.5, 9, 3.5], [40, 4, 13, 2.8],
];
describe('batch17 balance curves (spec §2 bands)', () => {
  it('normal-floor TTK & h2d within bands for all classes', () => {
    const c = curves('estab');
    for (const cls of Object.keys(c.classes)) {
      for (const [f, tMin, tMax, hMin] of BANDS) {
        const row = c.classes[cls].find(r => r.f === f)!;
        expect(row.ttk, `${cls} F${f} ttk`).toBeGreaterThanOrEqual(tMin);
        expect(row.ttk, `${cls} F${f} ttk`).toBeLessThanOrEqual(tMax);
        expect(row.h2d, `${cls} F${f} h2d`).toBeGreaterThanOrEqual(hMin);
      }
    }
  });
  it('boss TTK bands: F5 2-5 / F25 5-12 / F40 20-60', () => {
    const c = curves('estab');
    for (const cls of Object.keys(c.boss.map((_: any) => _)[0] ? {} : c.boss['Goblin King'] ? c.boss : {})) { /* 按 boss 结构遍历 */ }
    const g = c.boss['Goblin King'], d = c.boss['Dragon Emperor'], cr = c.boss['The Creator'];
    for (const cls of Object.keys(g)) {
      expect(g[cls].ttk).toBeGreaterThanOrEqual(2); expect(g[cls].ttk).toBeLessThanOrEqual(5);
      expect(d[cls].ttk).toBeGreaterThanOrEqual(5); expect(d[cls].ttk).toBeLessThanOrEqual(12);
      expect(cr[cls].ttk).toBeGreaterThanOrEqual(20); expect(cr[cls].ttk).toBeLessThanOrEqual(60);
    }
  });
  it('class spread at F40 ≤ 2.5×', () => {
    const c = curves('estab');
    const ttks = Object.values(c.classes).map(rows => rows.find(r => r.f === 40)!.ttk);
    expect(Math.max(...ttks) / Math.min(...ttks)).toBeLessThanOrEqual(2.5);
  });
  it('corruption @F40 all ≤60, mage ≤55', () => {
    const c = curves('estab');
    for (const v of Object.values(c.corruption)) expect(v).toBeLessThanOrEqual(60);
    expect(c.corruption['Mage']).toBeLessThanOrEqual(55);
  });
});
```

（boss 结构遍历那行是伪码残留——**写实现时删掉，直接用下面三行具名断言**。）

- [ ] **Step 3: 跑测试调带**（预期首轮有少量带越界——微调 balance-targets 的模型常数时**只能调模型假设**[如交战率/净化估值]，不得反向改 spec 目标；若真实数值超出带=上游 Task 数值问题，回报 controller 裁决）

Run: `npx vitest run src/__tests__/batch17-balance-curves.test.ts` → PASS

- [ ] **Step 4: 审计脚本种子化 + 全量**

`scripts/balance_audit.mts` 顶部（stub 之后）：
```ts
// mulberry32 — deterministic MC (seed 13) so fixSim tables are reproducible
let _s = 13;
const mr = () => { _s |= 0; _s = _s + 0x6D2B79F5 | 0; let t = Math.imul(_s ^ _s >>> 15, 1 | _s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
(globalThis as any).Math.random = mr;  // vite-node 下直接覆写可行; gen 内部走同 Math.random
```
（若覆写 Math.random 在 vite-node ESM 下不生效——`Math.random = mr` 语法即可，属性可写——跑一次脚本两遍核对输出一致即证确定性。）
Run: `npx vite-node scripts/balance_audit.mts > /tmp/a1.txt && npx vite-node scripts/balance_audit.mts > /tmp/a2.txt && diff /tmp/a1.txt /tmp/a2.txt` → 空 diff。
Run: `npx vitest run` 全绿 + `npx tsc --noEmit` 0。

- [ ] **Step 5: Commit**

```bash
git add src/balance-targets.ts src/__tests__/batch17-balance-curves.test.ts scripts/balance_audit.mts
git commit -m "test(batch17): T0 balance curve regression gate (balance-targets pure module + spec §2 bands) + seeded audit MC"
```

---

### Task 9: 游戏内电池 + 终验

**Files:**
- Create: `scripts/verify_batch17_ingame.py`（复用 verify_batch*_ingame.py 惯例：dev server + ESM live import + 真 UI 操作）
- 无生产码改动（纯验证任务）

**Interfaces:**
- Consumes: 全部前任务；`npm run dev -- --port 5173 --strictPort` 前置。

- [ ] **Step 1: 写电池**（8 检查，全部走 `page.evaluate(async()=>await import('/src/state.ts'))` live 模块同实例惯例）

1. **公式等价抽查**: F1 生成战斗，玩家 atk/敌 def 已知时伤害落 `floor((atk±2)*100/(100+def))` 区间。
2. **def 墙消除**: live 注入一场 F40 模拟（设敌 def=145/玩家 atk=106），伤害 ≥50（旧公式=1）。
3. **圣光术伤害段**: Paladin 开局放技能（mp 够），附近敌 hp 下降或消息含新键。
4. **法师 HP**: 选 Mage 开局 maxHp=38+race。
5. **施法腐化概率**: 强制 `Math.random=()=>0.5` 以下连放 10 次技能，腐化增量 ≤5（概率化生效；恢复 Math.random）。
6. **掉落加权**: live 调 `genWeapon(40)`×500 统计 r 分布，r≥3 占比 > 均匀池基线（26 池 r≥3 共 6/26≈23% → 加权后 ≥30%）。
7. **无尽窗口**: 设 G.endless+F55 走 spawnEnemies 逻辑断言窗口含 mf≥51 敌。
8. **零 console error** 全程。

（坑位提醒：`Math.random` 覆写在 live 模块里是全局共享——验完恢复原引用；favicon 404 白名单沿用既有电池；fake pad 不涉及本批。）

- [ ] **Step 2: 跑电池** → 8/8 + 0 console error

Run: `python scripts/verify_batch17_ingame.py`（dev server 前置起法照抄既有电池脚本头注释）

- [ ] **Step 3: 终验三门**（`npx tsc --noEmit` 裸跑 / `npx vitest run` 全绿 / `npm run build` 0）+ 更新审计 JSON（重跑 balance_audit.mts，fixSim 表入 commit message 摘要）

- [ ] **Step 4: Commit**

```bash
git add scripts/verify_batch17_ingame.py docs/balance-audit-2026-09-22.json
git commit -m "test(batch17): in-game battery 8/8 + refreshed audit JSON (fixSim curves in-range)"
```

---

## Self-Review 记录

- **Spec 覆盖**: T1→Task1 / T2→Task2 / T3+T4→Task3 / T5→Task4 / T6→Task5 / T7→Task6 / T8+T9→Task7 / T0→Task8 / §5 验证→Task9（游戏内电池+三门+CI 在 merge 流程）。§4「不做」无任务对应——正确。
- **Placeholder 扫描**: Task 6 heal-case 伤害段给出了完整代码与双算规避规则；Task 8 balance-targets 给出签名与来源映射（gear 快照=审计 JSON，非 TBD）；Task 9 电池 8 检查全部具体化。两处「以源码为准」标注（wardenStats 基础 atk、Task 1 断言笔误警示）是显式的执行者核对指令而非占位。
- **类型一致性**: `pickWeighted<T extends {r:number}>(pool,f)` Task 4 定义并自用；`curves(profile)` 签名 Task 8 内自洽；MITIG_K 仅 combat.ts 局部常量，balance-targets 复刻同值并注释互指。
