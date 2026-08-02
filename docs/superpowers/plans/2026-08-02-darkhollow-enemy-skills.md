# 敌人技能系统 (Enemy Skills) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给敌人做一套数据驱动的施法系统（11 个 effect handler + AI 施法闸门），并给约 24 个 caster 类敌人配技能数据，让战斗中敌人会周期性放技能（伤害走 `attack` 结算）。

**Architecture:** 复用玩家 `executeSkill` 模式——新建 `enemy-skills.ts`（`shouldCastSkill` 纯决策 + `executeEnemySkill` effect 路由），`processEnemies` 在 ai switch 前插施法闸门；伤害统一走 `attack()` 复用抗性/暴击/法穿/腐蚀/talent。`EnemyDef.skill`/`Enemy.skill` 激活为 `EnemySkill` 结构，`makeEnemy` 深拷贝。`skillCd` 解耦出 `aiCd` 专供 summon/teleport/boss-summon 行为冷却，`skillCd` 专属于技能。

**Tech Stack:** TypeScript + Vite + Canvas 2D + Electron；vitest + happy-dom（现 141 测基座）；i18n 走 `t()/tMsg()/tx()`。

**Spec:** `docs/superpowers/specs/2026-08-02-darkhollow-enemy-skills-design.md`（分支 `feat/enemy-skills` @ `8beedac`）

## Global Constraints

-伤害统一走 `combat.ts::attack(caster, G.player, false)`，禁止敌人技能自算伤害公式（DRY + 平衡一致）。
- `EnemyDef.skill` 结构 = `EnemySkill { name: I18nText; effect: string; chance: number; cd: number; dmg?: number; range?: number; aoe?: number; el?: Element }`。
- 新字段全部 optional，save 零迁移（老档 `undefined` → 守卫回退）。
- 禁止 AI 硬门之外的 `skillCd` 用法留在 `enemies.ts`（解耦后 `grep 'skillCd' src/enemies.ts` 仅剩施法闸门 + L170 递减）。
- i18n：所有新玩家可见消息走 `t/tMsg/tx`，新键加进 `i18n.ts` 的 `L` 表（zh+en），命名前缀 `esk.*`（enemy skill）。
- 文风/编码：UTF-8；commit message 用 `Enemy skills Task N: <summary>` 前缀。
- TDD：先写失败测试再实现；每 task 结束 `npx tsc --noEmit` + `npx vitest run` 双绿才 commit（注意：`&&` 链别用 `| grep` 掩退出码，用 `npx tsc --noEmit; echo $?` 显式核验）。

## File Structure

| 文件 | 责任 | 任务 |
|---|---|---|
| `src/types.ts` | `EnemySkill` 接口；`EnemyDef.skill`/`Enemy.skill` 改 `EnemySkill?`；`Enemy.aiCd?`/`Enemy.atkBuffTurns?`/`Enemy.atkBuffVal?`；`Player.stunned?` | T1 |
| `src/enemy-factory.ts` | `EnemyBase.skill?`；`makeEnemy` 深拷贝 skill + 设 `aiCd:0`/`atkBuffTurns:0`/`atkBuffVal:0` | T1 |
| `src/save.ts` | `aiCd`/`atkBuff*` undefined 守卫（同 `skillCd` 模式 L117） | T1 |
| `src/enemy-skills.ts` (**新**) | `shouldCastSkill` 纯函数 + `executeEnemySkill` + 11 handler | T2 |
| `src/i18n.ts` | `esk.*` 消息键（zh+en） | T2 |
| `src/enemies.ts` | `processEnemies` 施法闸门 + `skillCd`→`aiCd` 解耦 + atkBuff 递减 | T3 |
| `src/input.ts`（+ 玩家行动入口） | 玩家端 `stunned` 拦截 | T3 |
| `src/data.ts` | 24 个 caster EnemyDef 加 `skill` | T4 |
| `src/__tests__/enemy-skills.test.ts` (**新**) | shouldCastSkill + 各 handler characterization | T2 |
| `src/__tests__/makeEnemy.test.ts` | skill 深拷贝 + aiCd 默认 | T1 |
| `src/__tests__/makeEnemy-real-data.test.ts` | 所有配 skill 的 EnemyDef runtime 深拷贝 | T4 |

**依赖与执行顺序**：T1 先行（基础类型，全局影响）→ T2（enemy-skills.ts）与 T4（data.ts）文件不重叠可并行 → T3（enemies.ts/input.ts）依赖 T2 的 `executeEnemySkill`/`shouldCastSkill`。建议 subagent-driven：T1 主 Agent 内联（改 types 影响全局需 hand-tune）；T2+T4 一波（≤2 并发 subagent）；T3 主 Agent 内联（AI 热点 + aiCd 解耦易错）。final opus whole-branch review。撞 GLM-5.1 429 则主 Agent 内联接手。

---

### Task 1: 类型扩展 + makeEnemy 深拷贝 + save 兼容

**Files:**
- Modify: `src/types.ts`（`EnemyDef.skill` 改型、`Enemy` 加字段、`Player` 加 `stunned?`）
- Modify: `src/enemy-factory.ts:11-57`（`EnemyBase` + `makeEnemy` 返回对象）
- Modify: `src/save.ts:117`（守卫）
- Modify: `src/__tests__/makeEnemy.test.ts`（加 2 测）

**Interfaces:**
- Produces: `EnemySkill`（types.ts 导出）；`Enemy.skill?`/`Enemy.aiCd?`/`Enemy.atkBuffTurns?`/`Enemy.atkBuffVal?`；`Player.stunned?`；`makeEnemy` 深拷贝 skill 的运行时契约。T2/T3/T4 全部依赖这些类型。

- [ ] **Step 1: 写失败测试（makeEnemy.test.ts 末尾追加）**

```ts
import type { EnemyBase } from '../enemy-factory.js';

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
```

- [ ] **Step 2: 跑测试验证失败**

Run: `npx vitest run src/__tests__/makeEnemy.test.ts`
Expected: FAIL（`e.skill` undefined / `e.aiCd` undefined —— 类型和拷贝都还没加）

- [ ] **Step 3: types.ts 加类型**

在 `SkillDef` 之后（约 L34 后）加：
```ts
export interface EnemySkill {
  name: I18nText;
  effect: string;   // effect key → enemy-skills.ts handler
  chance: number;   // 0..1 per eligible turn
  cd: number;       // cooldown turns
  dmg?: number;     // atk 倍率(dmg_*) 或强度(buff/debuff/poison 每回合)
  range?: number;   // cast range (default per-effect)
  aoe?: number;     // AOE radius OR status turns (buff/debuff_*)
  el?: Element;     // skill element (default = enemy el)
}
```
改 `EnemyDef.skill`（L176-181）为 `skill?: EnemySkill;`（删掉旧的内联 `{name,effect,chance,dmg}`）。
`Enemy` 接口（L243 `skillCd` 附近）加：
```ts
  skill?: EnemySkill;
  aiCd?: number;
  atkBuffTurns?: number;
  atkBuffVal?: number;
```
`Player` 接口（L426 `corruption` 后）加：`stunned?: number;`

- [ ] **Step 4: enemy-factory.ts —— EnemyBase 加 skill + makeEnemy 深拷贝**

`EnemyBase`（L11-15）加 `skill?: EnemySkill;`（import `EnemySkill` from types）。
`makeEnemy` 返回对象（L40-56）在 `res` 后、`skillCd: 0` 前加：
```ts
    skill: base.skill ? { ...base.skill, name: { ...base.skill.name } } : undefined,
    aiCd: 0,
    atkBuffTurns: 0,
    atkBuffVal: 0,
```
（`name` 单独展开，防同类敌人共享 `I18nText` 引用——与 `res`/`tags` 深拷贝同模式 L53-55）

- [ ] **Step 5: save.ts 加守卫**

`loadGame` 里现有 `if (e.skillCd === undefined) (e as any).skillCd = 0;`（L117）后追加：
```ts
      if (e.aiCd === undefined) (e as any).aiCd = 0;
      if (e.atkBuffTurns === undefined) (e as any).atkBuffTurns = 0;
      if (e.atkBuffVal === undefined) (e as any).atkBuffVal = 0;
```
（`Player.stunned` optional，老档 undefined 自然 falsy，无需守卫）

- [ ] **Step 6: 跑测试 + typecheck + build 验证全绿**

Run: `npx vitest run src/__tests__/makeEnemy.test.ts && npx vitest run && npx tsc --noEmit; echo "tsc=$?"`
Expected: 新 2 测 PASS；全量 141 测仍绿（零行为变更）；tsc=0。

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/enemy-factory.ts src/save.ts src/__tests__/makeEnemy.test.ts
git commit -m "Enemy skills Task 1: EnemySkill type + makeEnemy deep-copy + save guards"
```

---

### Task 2: enemy-skills.ts —— shouldCastSkill + executeEnemySkill (11 handlers)

**Files:**
- Create: `src/enemy-skills.ts`
- Modify: `src/i18n.ts`（加 `esk.*` 键）
- Create: `src/__tests__/enemy-skills.test.ts`

**Interfaces:**
- Consumes (from T1): `Enemy.skill?: EnemySkill`、`Enemy.atkBuffTurns/atkBuffVal`、`Player.stunned?`；`combat.ts::attack`/`killEnemy`；`makeEnemy`；`ENEMIES`/`TL`/`rng`/`dst`/`pick`。
- Produces: `shouldCastSkill(e: Enemy, dist: number, visible: boolean, playerInvis: boolean): boolean` 与 `executeEnemySkill(caster: Enemy, skill: EnemySkill): void`（T3 的施法闸门调用这两个）。

- [ ] **Step 1: 写 shouldCastSkill 失败测试（enemy-skills.test.ts）**

mock 掉 canvas 依赖（沿用 `grantKillRewards.test.ts` 的 mock 模式）：
```ts
import { vi } from 'vitest';
vi.mock('../fx.js', () => ({ fxBeam: vi.fn(), fxBurst: vi.fn(), fxFlash: vi.fn(), fxAura: vi.fn() }));
vi.mock('../effects.js', () => ({ flt: vi.fn(), shake: vi.fn() }));
vi.mock('../audio.js', () => ({ snd: vi.fn() }));

import { shouldCastSkill } from '../enemy-skills.js';
import type { Enemy } from '../types.js';
const mk = (over: Partial<Enemy> = {}): Enemy => ({ name:'E',ch:'x',c:'#fff',x:0,y:0,hp:10,maxHp:10,atk:5,def:1,exp:5,goldDrop:5,ai:'chase',stunned:0,feared:0,isAlly:false,el:'none',res:{},skillCd:0,...over });

it('shouldCastSkill: false when no skill / on cd / out of range / unseen / invis-far', () => {
  const sk = { name:{en:'Z',zh:'Z'}, effect:'dmg_bolt', chance:1, cd:3, dmg:1, range:5 };
  expect(shouldCastSkill(mk(), 1, true, false)).toBe(false);                       // no skill
  expect(shouldCastSkill(mk({ skill: sk, skillCd: 2 }), 1, true, false)).toBe(false); // on cd
  expect(shouldCastSkill(mk({ skill: sk }), 9, true, false)).toBe(false);          // out of range
  expect(shouldCastSkill(mk({ skill: sk }), 3, false, false), ).toBe(false);       // unseen
  expect(shouldCastSkill(mk({ skill: sk }), 5, true, true)).toBe(false);           // invis & far
  expect(shouldCastSkill(mk({ skill: sk }), 1, true, true)).toBe(true);            // invis point-blank OK
  expect(shouldCastSkill(mk({ skill: sk }), 3, true, false)).toBe(true);           // in range, visible, chance=1
});
```

- [ ] **Step 2: 跑测试验证失败** — Run: `npx vitest run src/__tests__/enemy-skills.test.ts` → FAIL（模块不存在）

- [ ] **Step 3: 创建 enemy-skills.ts —— shouldCastSkill + import + handler 框架**

```ts
// Enemy skill system — data-driven casting, mirrors player executeSkill.
import type { Enemy, EnemySkill } from './types.js';
import { G } from './state.js';
import { dst, rng, pick } from './utils.js';
import { MW, MH, TL } from './config.js';
import { attack } from './combat.js';
import { addMsg } from './messages.js';
import { fxBeam, fxBurst, fxFlash, fxAura } from './fx.js';
import { flt, shake } from './effects.js';
import { snd } from './audio.js';
import { makeEnemy } from './enemy-factory.js';
import { ENEMIES } from './data.js';
import { tMsg } from './i18n.js';

// Pure decision — extracted so it is unit-testable without G/enemies.
export function shouldCastSkill(e: Enemy, dist: number, visible: boolean, playerInvis: boolean): boolean {
  if (!e.skill || e.skillCd > 0) return false;
  if (playerInvis && dist > 2) return false;       // invis: only point-blank
  if (!playerInvis && !visible) return false;       // normal: must see player
  const range = e.skill.range ?? 5;
  if (dist > range) return false;
  return Math.random() < e.skill.chance;
}

const EL_COLOR: Record<string, string> = { fire:'#ff7a45', ice:'#7ec8e3', lightning:'#fff2a8', shadow:'#b583f6', holy:'#ffd700', none:'#b583f6' };

export function executeEnemySkill(caster: Enemy, sk: EnemySkill): void {
  if (!G || G.gameOver) return;
  const col = EL_COLOR[sk.el ?? caster.el] ?? '#b583f6';
  switch (sk.effect) {
    case 'dmg_bolt':   return castDamageBolt(caster, sk, col);
    case 'dmg_aoe':    return castDamageAoe(caster, sk, col);
    case 'heal':       return castHeal(caster, sk);
    case 'buff':       return castBuff(caster, sk);
    case 'debuff_poison': return castDebuff(caster, sk, 'poison');
    case 'debuff_slow':   return castDebuff(caster, sk, 'slow');
    case 'debuff_weaken': return castDebuff(caster, sk, 'weaken');
    case 'debuff_stun':   return castDebuff(caster, sk, 'stun');
    case 'blink':      return castBlink(caster);
    case 'summon':     return castSummon(caster);
  }
}
```

- [ ] **Step 4: 实现 damage handlers（bolt + aoe）**

```ts
function castDamageBolt(caster: Enemy, sk: EnemySkill, col: string): void {
  if (!G) return;
  const orig = caster.atk;
  caster.atk = Math.floor(orig * (sk.dmg ?? 1.5));
  fxBeam(caster.x, caster.y, G.player.x, G.player.y, col);
  attack(caster, G.player, false);
  caster.atk = orig;
  addMsg(tMsg('esk.bolt', String(caster.name)), 'me');
}

function castDamageAoe(caster: Enemy, sk: EnemySkill, col: string): void {
  if (!G) return;
  const radius = sk.aoe ?? 2;
  const orig = caster.atk;
  caster.atk = Math.floor(orig * (sk.dmg ?? 1.3));
  fxBurst(G.player.x, G.player.y, col, 18, 1.3);
  // Player: AOE ignores dodge — temporarily suppress (don't modify attack() body).
  const od = G.player.dodgeChance;
  G.player.dodgeChance = 0;
  attack(caster, G.player, false);
  G.player.dodgeChance = od;
  // Allies in radius: direct damage (attack() would treat ally as player — see spec §2.4).
  const allies = G.enemies.filter(a => a.isAlly && a !== caster && dst(caster.x, caster.y, a.x, a.y) <= radius);
  for (const ally of allies) {
    const raw = Math.max(1, caster.atk - ally.def);
    ally.hp -= raw; flt(ally.x, ally.y, `-${raw}`, col);
    if (ally.hp <= 0) { fxBurst(ally.x, ally.y, ally.c, 10, 0.8); }
  }
  G.enemies = G.enemies.filter(a => a.hp > 0 || (!a.isAlly));
  caster.atk = orig;
  addMsg(tMsg('esk.aoe', String(caster.name)), 'me');
}
```

- [ ] **Step 5: 实现 heal + buff + debuff handlers**

```ts
function castHeal(caster: Enemy, sk: EnemySkill): void {
  if (!G) return;
  const amt = Math.floor(caster.maxHp * 0.25 * (sk.dmg ?? 1));
  const hurtAllies = G.enemies.filter(a => a.isAlly && a.hp < a.maxHp);
  const target = (caster.hp < caster.maxHp) ? caster : (hurtAllies[0] ?? caster);
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + amt);
  fxFlash(target.x, target.y, '#80ed99', 1.2);
  flt(target.x, target.y, `+${target.hp - before}`, '#80ed99');
  addMsg(tMsg('esk.heal', String(caster.name)), 'mc');
}

function castBuff(caster: Enemy, sk: EnemySkill): void {
  if (!G) return;
  // Enemy has no buffs[] system (only Player does) — use lightweight temp-atk fields.
  const val = sk.dmg ?? 6, turns = sk.aoe ?? 3;
  caster.atkBuffVal = (caster.atkBuffVal ?? 0) + val;
  caster.atkBuffTurns = turns;
  caster.atk += val;
  fxAura(caster.x, caster.y, '#ffd700');
  addMsg(tMsg('esk.buff', String(caster.name)), 'mc');
}

function castDebuff(caster: Enemy, sk: EnemySkill, kind: 'poison'|'slow'|'weaken'|'stun'): void {
  if (!G) return;
  const p = G.player;
  const turns = sk.aoe ?? 3;
  if (kind === 'poison') {
    p.poisonTurns = Math.max(p.poisonTurns, turns);
    p.poisonDmg = Math.max(p.poisonDmg, sk.dmg ?? 4);
    fxBurst(p.x, p.y, '#7ec8e3', 10, 0.8);
  } else if (kind === 'slow') {
    p.slowed = Math.max(p.slowed ?? 0, turns);
    fxFlash(p.x, p.y, '#7ec8e3');
  } else if (kind === 'weaken') {
    // Reuse player buff system with negative value (recalc L258: str_buff adds value → negative subtracts).
    p.buffs.push({ name: 'weakened', type: 'str_buff', value: -(sk.dmg ?? 6), turns });
    fxFlash(p.x, p.y, '#b583f6');
  } else { // stun
    p.stunned = Math.min(2, Math.max(p.stunned ?? 0, turns));
    fxFlash(p.x, p.y, '#fff2a8'); shake(1);
  }
  addMsg(tMsg(`esk.${kind}`, String(caster.name)), 'me');
}
```

- [ ] **Step 6: 实现 blink + summon handlers**

```ts
function castBlink(caster: Enemy): void {
  if (!G) return;
  for (let i = 0; i < 10; i++) {
    const tx = G.player.x + rng(-1, 1), ty = G.player.y + rng(-1, 1);
    if (tx === caster.x && ty === caster.y) continue;
    if (tx < 0 || tx >= MW || ty < 0 || ty >= MH) continue;
    if (G.dungeon.map[ty][tx] === TL.WALL || G.dungeon.map[ty][tx] === TL.VOID) continue;
    if (G.enemies.some(o => o !== caster && o.x === tx && o.y === ty)) continue;
    if (tx === G.player.x && ty === G.player.y) continue;
    caster.x = tx; caster.y = ty;
    flt(tx, ty, '⚡BLINK', '#8a2be2');
    addMsg(tMsg('esk.blink', String(caster.name)), 'me');
    return;
  }
}

function castSummon(caster: Enemy): void {
  if (!G || G.enemies.length >= 30) return;
  const fl = G.floor;
  const pool = ENEMIES.filter(en => en.mf <= fl && en.mf >= Math.max(1, fl - 6) && !en.tags?.includes('boss'));
  if (!pool.length) return;
  const base = pick(pool);
  const fs = 1 + (fl - 1) * 0.12;
  for (let attempt = 0; attempt < 8; attempt++) {
    const sx = caster.x + rng(-2, 2), sy = caster.y + rng(-2, 2);
    if (sx < 0 || sx >= MW || sy < 0 || sy >= MH) continue;
    if (G.dungeon.map[sy][sx] === TL.WALL || G.dungeon.map[sy][sx] === TL.VOID) continue;
    if (G.enemies.some(o => o.x === sx && o.y === sy)) continue;
    if (sx === G.player.x && sy === G.player.y) continue;
    const sn = makeEnemy(base, sx, sy, fs, { hpM: 0.6, atkM: 0.8, defM: 0.6, expM: 0.4, goldM: 0.4 });
    G.enemies.push(sn);
    flt(sx, sy, '⚡SUMMON', '#9b5de5');
    addMsg(tMsg('esk.summon', String(caster.name), String(sn.name)), 'me');
    return;
  }
}
```

- [ ] **Step 7: i18n.ts 加键（L 表，zh+en 各一）**

加进 `i18n.ts` 的 `L` 对象（找现有 `cb.*`/`em.*` 键块，追加）：
```ts
  "esk.bolt": { en: "{1} hurls a bolt!", zh: "{1}掷出一发法术！" },
  "esk.aoe":  { en: "{1} unleashes a blast!", zh: "{1}释放了一片范围法术！" },
  "esk.heal": { en: "{1} mends itself!", zh: "{1}治愈了伤口！" },
  "esk.buff": { en: "{1} enrages!", zh: "{1}狂热加持！" },
  "esk.poison": { en: "{1} poisons you!", zh: "{1}毒雾笼罩了你！" },
  "esk.slow":   { en: "{1} chills you!", zh: "{1}冰寒减缓了你！" },
  "esk.weaken": { en: "{1} saps your strength!", zh: "{1}削弱了你的力量！" },
  "esk.stun":   { en: "{1} stuns you!", zh: "{1}眩晕了你！" },
  "esk.blink":  { en: "{1} blinks beside you!", zh: "{1}瞬移到你身旁！" },
  "esk.summon": { en: "{1} summons {2}!", zh: "{1}召唤了{2}！" },
```

- [ ] **Step 8: 加 handler characterization 测试（dmg_bolt 走 attack + dmg_aoe 盟友 + 一个 debuff）**

```ts
import { executeEnemySkill } from '../enemy-skills.js';
import { G } from '../state.js';

beforeEach(() => {
  G.player = { ...minimalPlayer, hp: 100, maxHp: 100, dodgeChance: 0.5, buffs: [], poisonTurns: 0, poisonDmg: 0, slowed: 0 };
  G.enemies = [];
  G.gameOver = false;
});

it('dmg_bolt: reduces player hp via attack', () => {
  const e = mk({ atk: 20, x: 1, y: 0 });
  G.player.x = 0; G.player.y = 0; G.player.def = 0;
  executeEnemySkill(e, { name:{en:'Z',zh:'Z'}, effect:'dmg_bolt', chance:1, cd:1, dmg:2 });
  expect(G.player.hp).toBeLessThan(100);   // 20*2 - 0 = 40 dmg
});

it('dmg_aoe: hits player ignoring dodge + damages ally directly', () => {
  const e = mk({ atk: 20, x: 1, y: 0 });
  const ally = mk({ isAlly: true, hp: 30, maxHp: 30, x: 1, y: 1, def: 0 });
  G.player.x = 0; G.player.y = 0; G.player.def = 5;
  G.enemies = [e, ally];
  const playerHpBefore = G.player.hp;
  executeEnemySkill(e, { name:{en:'Z',zh:'Z'}, effect:'dmg_aoe', chance:1, cd:1, dmg:1, aoe:2 });
  expect(G.player.hp).toBeLessThan(playerHpBefore);  // took damage despite dodgeChance 0.5
  expect(ally.hp).toBeLessThan(30);                  // ally hit directly
});

it('debuff_poison: sets poisonTurns/poisonDmg', () => {
  const e = mk({ x: 1, y: 0 });
  executeEnemySkill(e, { name:{en:'Z',zh:'Z'}, effect:'debuff_poison', chance:1, cd:1, dmg:5, aoe:4 });
  expect(G.player.poisonTurns).toBe(4);
  expect(G.player.poisonDmg).toBe(5);
});
```
（`minimalPlayer` 参照 `grantKillRewards.test.ts` 的 player fixture。Run: `npx vitest run src/__tests__/enemy-skills.test.ts` → 全 PASS）

- [ ] **Step 9: 全量测试 + typecheck + build**

Run: `npx vitest run && npx tsc --noEmit; echo "tsc=$?"` → 全绿，tsc=0。

- [ ] **Step 10: Commit**

```bash
git add src/enemy-skills.ts src/i18n.ts src/__tests__/enemy-skills.test.ts
git commit -m "Enemy skills Task 2: enemy-skills.ts (shouldCastSkill + 11 effect handlers)"
```

---

### Task 3: AI 施法闸门 + skillCd/aiCd 解耦 + 玩家端 stun

**Files:**
- Modify: `src/enemies.ts`（`processEnemies` L158-286 + summon/teleport/tryBossSummon 的 `skillCd`→`aiCd` + atkBuff 递减）
- Modify: `src/input.ts`（+ 玩家行动入口：玩家端 `stunned` 拦截）

**Interfaces:**
- Consumes (from T2): `shouldCastSkill(e, dist, visible, playerInvis)`、`executeEnemySkill(e, skill)`。
- 硬门：完成后 `grep 'skillCd' src/enemies.ts` 仅剩 `processEnemies` 施法闸门 + L170 递减（递减改为同时 `aiCd`）。

- [ ] **Step 1: skillCd→aiCd 解耦（4 处非技能用途）**

`processEnemies` L170 `if (e.skillCd > 0) e.skillCd--;` 改为同时递减：
```ts
    if (e.skillCd > 0) e.skillCd--;
    if (e.aiCd && e.aiCd > 0) e.aiCd--;
    // atkBuff expiry (castBuff sets atkBuffTurns)
    if (e.atkBuffTurns && e.atkBuffTurns > 0) {
      e.atkBuffTurns--;
      if (e.atkBuffTurns === 0 && e.atkBuffVal) { e.atk -= e.atkBuffVal; e.atkBuffVal = 0; }
    }
```
`summon` ai（L239-240）`e.skillCd <= 0` → `e.aiCd <= 0`、`e.skillCd = 4` → `e.aiCd = 4`。
`teleport` ai（L262-263）`e.skillCd <= 0` → `e.aiCd <= 0`、`e.skillCd = 3` → `e.aiCd = 3`。
`tryBossSummon`（L314 `boss.skillCd > 0`→`boss.aiCd`；L319 `boss.skillCd = 1`→`boss.aiCd`；L320 `boss.skillCd = cfg.cd`→`boss.aiCd`）。

- [ ] **Step 2: 施法闸门插入（processEnemies，switch(e.ai) 之前，L186 `if (playerInvis) randMove(e); continue;` 之后、`switch(e.ai)` 之前）**

```ts
    // Enemy skill gate (data-driven casting) — fires before the ai switch.
    if (e.skill && e.skillCd <= 0) {
      const visible = !!G.player.visible?.[e.y]?.[e.x];
      if (shouldCastSkill(e, d, visible, playerInvis)) {
        executeEnemySkill(e, e.skill);
        e.skillCd = e.skill.cd;
        if (G.gameOver) return;
        continue;  // casting consumes the turn; skip normal ai
      }
    }
```
（顶部 `import { shouldCastSkill, executeEnemySkill } from './enemy-skills.js';`）注意 `d` 已在 L173 算好；闸门放在 `d` 算出之后。

- [ ] **Step 3: 验证解耦硬门**

Run: `grep 'skillCd' src/enemies.ts`
Expected: 仅剩 `processEnemies` 里 `if (e.skillCd > 0) e.skillCd--;`（L170 递减）+ 施法闸门的 `e.skillCd <= 0` / `e.skillCd = e.skill.cd`。summon/teleport/tryBossSummon 全改 `aiCd`。若有遗漏修正。

- [ ] **Step 4: 玩家端 stunned 拦截（input.ts 玩家行动入口）**

定位玩家消耗回合的动作入口（移动 `movePlayer`/键盘移动、近战攻击、`executeSkill`、`useItem`）。在每个"触发 `endTurn`"的动作**最前面**加守卫；或提取共用 helper。最简做法——在 `turn.ts::endTurn` 调用方的玩家动作 dispatcher 顶部，或直接在每个动作函数入口加：
```ts
if (G.player.stunned && G.player.stunned > 0) {
  G.player.stunned--;
  addMsg(t('esk.playerStunned'), 'mi');
  endTurn();   // consume the turn without acting
  return;
}
```
（`input.ts` 顶部 `import { endTurn } from './turn.js'` 若未导入；`'esk.playerStunned'` 键加进 i18n.ts：`{ en:"You are stunned!", zh:"你被眩晕，无法行动！" }`）
**implementer 须 grep 定位所有"玩家主动消耗回合"的入口**（`grep -n 'endTurn' src/input.ts src/panels.ts`），统一加该守卫，避免漏点（如只挡移动不挡施法）。

- [ ] **Step 5: 全量测试 + typecheck + build**

Run: `npx vitest run && npx tsc --noEmit; echo "tsc=$?"` → 全绿，tsc=0（aiCd 解耦不改变 summon/teleport/boss-summon 行为语义，仅字段名变；既有测试不应回归）。

- [ ] **Step 6: Commit**

```bash
git add src/enemies.ts src/input.ts src/i18n.ts
git commit -m "Enemy skills Task 3: AI skill gate + skillCd/aiCd decouple + player stun"
```

---

### Task 4: 24 个 caster 配技能数据 + real-data 深拷贝测 + 无头冒烟

**Files:**
- Modify: `src/data.ts`（ENEMIES 数组 L97-188，给 24 个 EnemyDef 加 `skill`）
- Modify: `src/__tests__/makeEnemy-real-data.test.ts`（加 runtime 深拷贝断言）

**Interfaces:**
- Consumes (from T1): `EnemySkill` 结构、`makeEnemy` 深拷贝。
- 数据数值取 spec §2.5 + brainstorming Section B 表（保守值，playtest 后调）。

- [ ] **Step 1: 给 24 个 caster 加 skill（按主题分组，逐个 EnemyDef 加 `skill: {...}` 字段）**

数值表（`dmg`=atk 倍率 for dmg_*；`aoe`=半径 for dmg_aoe / 回合数 for debuff_*；`range`=射程）：

**暗影法师**：Cultist(L113) `{effect:'dmg_bolt',chance:.4,cd:4,dmg:1.6,range:5,el:'shadow'}` / Dark Mage(L117) `dmg_bolt,.4,4,1.8,6,shadow` / Lich(L127) `dmg_aoe,.35,5,1.3,aoe:2,shadow` / Necromancer(L129) `debuff_weaken,.35,5,dmg:6,aoe:3,shadow` / Void Mage(L155) `dmg_aoe,.4,5,1.6,aoe:3,range:6,shadow`
**幽灵**：Wraith(L115) `debuff_slow,.35,5,aoe:3,range:4` / Cinder Wraith(L170) `dmg_aoe,.35,5,1.4,aoe:2,range:3,fire` / Storm Wraith(L143) `dmg_aoe,.35,5,1.4,aoe:3,range:6,lightning` / Void Wraith(L152) `debuff_poison,.35,5,dmg:4,aoe:4,shadow`
**龙**：Wyvern(L121) `dmg_aoe,.35,5,1.3,aoe:2,range:5,fire` / Dragon Whelp(L130) `dmg_bolt,.4,4,1.7,5` / Ancient Dragon(L131) `dmg_aoe,.35,5,1.6,aoe:3,range:6` / Pyro Drake(L139) `dmg_aoe,.35,5,1.5,aoe:3,range:6,fire`
**元素/恶魔/天使**：Fire Imp(L168) `dmg_bolt,.45,3,1.6,5,fire` / Magma Behemoth(L141) `dmg_aoe,.35,5,1.5,aoe:2,range:2,fire` / Chaos Elemental(L153) `dmg_aoe,.4,4,1.5,aoe:3,range:4` / Seraphim(L158) `dmg_bolt,.35,5,1.8,5,holy` / Fallen Seraph(L159) `dmg_aoe,.35,5,1.5,aoe:3,range:4,shadow` / Archon(L162) `dmg_bolt,.4,5,2.0,7,holy` / Doom Seraph(L185) `dmg_aoe,.4,5,1.7,aoe:3,range:6,holy`
**辅助控场**：Inquisitor(L136) `debuff_weaken,.35,5,dmg:8,aoe:3,range:6,holy` / Siren(L149) `debuff_slow,.4,5,aoe:3,range:6,ice` / Spore Mother(L179) `debuff_poison,.4,4,dmg:3,aoe:3,shadow` / Drake Zealot(L140) `buff,.3,6,dmg:6,aoe:4` / Reality Shard(L156) `debuff_weaken,.35,5,dmg:6,aoe:3,range:5`

每个 `skill` 加 `name: { en: '<英>', zh: '<中>' }`（如 Cultist→`{en:'Shadow Ritual',zh:'暗影仪式'}`，命名由 implementer 按敌人主题起，双语）。implementer 逐条 Edit `data.ts`，**整数组原子替换或逐条加都行**——参考 Wave6b 教训：敌人 `ch` 字形不画地图（走 sprite），无字形冲突顾虑。

- [ ] **Step 2: real-data 测加 runtime 深拷贝断言（makeEnemy-real-data.test.ts 末尾）**

```ts
it('every enemy with a def.skill gets a deep-copied runtime skill', () => {
  for (const def of ENEMIES) {
    if (!def.skill) continue;
    const e = makeEnemy(def, 0, 0, 1);
    expect(e.skill, `${tx(def.n)}: def.skill missing at runtime`).toBeDefined();
    expect(e.skill).not.toBe(def.skill);
    expect(e.skill!.name).not.toBe(def.skill!.name);
    expect(e.skill!.effect).toBe(def.skill!.effect);
    expect(e.skill!.cd).toBe(def.skill!.cd);
  }
});
```

- [ ] **Step 3: 全量测试 + typecheck + build**

Run: `npx vitest run && npx tsc --noEmit; echo "tsc=$?"` → 全绿（含新 real-data 断言），tsc=0。

- [ ] **Step 4: 无头冒烟（playwright）**

进一个中后期有 caster 的楼层（如刷 Void Mage/Ancient Dragon 的层），确认：敌人施法时消息/特效正常、玩家受伤害、不崩、无 JS error。
Run（参照仓内既有冒烟脚本模式）: `npx vite build && npx vite preview --port 4173 &` → playwright 脚本导航+进入战斗+截图 → `analyze_image` 抓一帧确认 fx 渲染。kill preview。

- [ ] **Step 5: Commit**

```bash
git add src/data.ts src/__tests__/makeEnemy-real-data.test.ts
git commit -m "Enemy skills Task 4: 24 casters skill data + real-data deep-copy test"
```

---

## Self-Review（写计划后自检）

**1. Spec coverage**: §2.1 类型→T1 ✓ / §2.2 enemy-skills.ts+11 handler→T2 ✓ / §2.3 AI 闸门+aiCd 解耦→T3 ✓ / §2.4 边界（AOE 盟友直扣血 T2 Step4、dmg_aoe 无视 dodge T2 Step4、玩家端 stun T3 Step4、隐身 shouldCastSkill T2 Step1/3）✓ / §2.5 数据→T4 ✓ / §4 测试→T1/T2/T4 测 + T3 硬门 + T4 冒烟 ✓ / §5 并行→执行顺序段 ✓。
**2. Placeholder scan**: 无 TBD/TODO；每步含真实代码。数值表用紧凑记法（`effect,chance,cd,dmg,...`）但每字段含义已在表头说明，implementer 可直接落。
**3. Type consistency**: `EnemySkill` 在 T1 定义、T2/T4 消费一致；`shouldCastSkill`/`executeEnemySkill` 签名 T2 定义、T3 消费一致；`aiCd`/`atkBuffTurns`/`atkBuffVal`/`stunned` 全链路命名一致。✓

**注**：spec §2.2 `buff` 写的是 `caster.buffs.push(...)`，但 `Enemy` 无 `buffs` 字段（仅 `Player` 有）。本计划 T2 Step5 落实为 `Enemy.atkBuffTurns/atkBuffVal` 轻量临时 atk 提升 + T3 Step1 递减——行为等价（敌人临时 atk 提升 N 回合），是对 spec 的合理细化，非偏离。
