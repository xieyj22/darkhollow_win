# 批1「断线重连」Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 2026-08-24 五维审计发现的 9 处"断裂级"系统——无尽 Boss 相位/召唤、腐化净化死码、3 个死天赋 + 玩家 CC、标题统计死 UI、lore 死解锁、F55+ 生成退化、corruption_ward 漏 endless 门、2 处图标像素、3 条过期注释。

**Architecture:** 修"接线"不重写系统：Boss 定义随实例走（factory 拷贝 + 表查回退双路径）、活体地形接通已设计的净化数值、死天赋接入既有 modifier/CC 管线、纯函数补距离加权回退。普通模式 F1-40 行为零变化（除②净化与③CC 两处 spec 明示的"接通"）。

**Tech Stack:** TypeScript 5 + Canvas 2D + Vite + vitest/happy-dom；无新依赖。

**Spec:** `docs/superpowers/specs/2026-08-24-reconnect-batch-design.md`（分支 `feat/reconnect-batch`，基线 85e4e3d）

## Global Constraints

- 普通模式 F1-40 主线行为零变化（例外仅②净化、③CC——spec 明示的"接通已设计但断线"项）。
- 不新增敌人/Boss 条目；3 个 stun caster 全部选自现有 ENEMIES。
- 每个任务收尾跑 `npx tsc --noEmit`（必须贴 0 错原文，不信口头）+ `npx vitest run <本任务相关文件>`；T7 跑全量。
- 测试基线 332 全绿；本批预计新增 ~20±2 条（以 vitest 汇总为准，不硬编码总数）。
- 新 i18n key 仅 3 个：`ev.fountainPurify` / `ev.shrinePurify` / `esk.stunImmune`；敌人技能名内联 {en,zh}。
- 提交信息用 conventional commits（feat/fix/test/chore），逐任务一提交。
- **两处对 spec 的精化**（spec 自带"以 data.ts 现值为准"条款）：
  - ③ 第二个 stun caster：spec 写"Thunder Wraith mf≈21"，data.ts 实际是 **Storm Wraith (mf 25)** 且已带 dmg_aoe 技能——换掉会删工作内容。改为 **Drakeborn Knight（龙裔骑士，mf 24，现无技能）**，同危险带。三个 caster 定为：Dread Legionnaire (mf18) / Drakeborn Knight (mf24) / Cosmic Horror (mf39)。
  - ⑧ I_CROWN：spec 写"尖顶 col 5-8→6-9 右移 1 列"，实数是上半部分中心 col 7 vs 下半横带中心 col 7.5（半像素错位，整数平移无法修复）。改为**真对称重画**上半 5 行（全部回文、与宝石列 3-4/11-12 对齐），见 T7 精确像素。

---

### Task 1: ① Boss 定义随实例走（types + factory + enemies 双路径）

**Files:**
- Modify: `src/types.ts`（Enemy 接口，约 :80-120 区域内加 3 个可选字段）
- Modify: `src/enemy-factory.ts:4,11-16,32-62`
- Modify: `src/enemies.ts:54-69,132-160,323-360`
- Test: `src/__tests__/makeEnemy.test.ts`、`src/__tests__/makeEnemy-real-data.test.ts`、Create `src/__tests__/enemies-boss.test.ts`

**Interfaces:**
- Produces（后续任务与本任务内共同依赖）：`Enemy.phases?: BossDef['phases']`、`Enemy.summon?: BossDef['summon']`、`Enemy.bossAtkBase?: number`；`EnemyBase` 同步加 `phases`/`summon`；`enemies.ts` 新导出 `endlessBossPool(): BossDef[]`、`tryBossSummon(boss: Enemy): void`（从私有改导出）。
- 消费关系：T2 不依赖本任务产物；processBossPhase/tryBossSummon/bossSummonAdd 改为"实例优先、表查回退"。

- [ ] **Step 1: 写失败测试（3 个文件）**

`makeEnemy.test.ts` 追加（文件末尾新 describe）：

```ts
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
    expect(e.bossAtkBase).toBe(e.atk);             // 出生缩放后攻击，等价旧 origAtk 公式
  });
  it('non-boss carries no boss fields', () => {
    const e = makeEnemy(bossBase as any, 1, 1, 1);
    expect(e.phases).toBeUndefined();
    expect(e.summon).toBeUndefined();
    expect(e.bossAtkBase).toBeUndefined();
  });
});
```

`makeEnemy-real-data.test.ts` 追加：

```ts
it('every BossDef with phases/summon surfaces them on the built instance (①)', () => {
  for (const b of BOSSES) {
    const out = makeEnemy(b, 5, 5, 1 + (b.fl - 1) * .1, { isBoss: true });
    expect(out.phases).toBe(b.phases);
    expect(out.summon).toBe(b.summon);
    expect(out.bossAtkBase).toBe(out.atk);
  }
});
```

新建 `enemies-boss.test.ts`（mock 清单对照 enemies.ts:2-16,400-402 的实际 import；data/enemy-factory/utils/config 保持真实）：

```ts
// ① reconnect: boss phases/summon must work from the INSTANCE (endless F45+
// reuse), with the floor-keyed table kept only as the legacy-save fallback.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../state.js', () => ({ get G() { return (globalThis as any).G; }, lang: 'en' }));
vi.mock('../meta.js', () => ({ bonusExp: (e: number) => e, unlockLore: () => {}, getMeta: () => ({ upgrades: {}, stats: {}, achievements: [] }) }));
vi.mock('../effects.js', () => ({ flt: () => {}, shake: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: vi.fn() }));
vi.mock('../combat.js', () => ({ attack: () => {}, killEnemy: () => {}, checkLevelUp: () => {}, playerDeath: () => {}, recalc: () => {} }));
vi.mock('../talents.js', () => ({ onPlayerDamaged: () => false, onEnemyHitPlayer: () => {}, onPlayerDodged: () => {}, onPlayerDeath: () => false, getManaShieldReduction: () => 0 }));
vi.mock('../relics.js', () => ({ relicOnDodge: () => {} }));
vi.mock('../render.js', () => ({ setEnemyTween: () => {} }));
vi.mock('../warden.js', () => ({ wardenStats: () => ({}) }));
vi.mock('../enemy-skills.js', () => ({ shouldCastSkill: () => false, executeEnemySkill: () => {} }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tMsg: (k: string) => k, tx: (f: any) => f?.en ?? '' }));
vi.mock('../audio.js', () => ({ snd: () => {} }));

import { processBossPhase, tryBossSummon, endlessBossPool } from '../enemies.js';
import { BOSSES } from '../data.js';
import { TL } from '../config.js';
import type { Enemy } from '../types.js';

const mkBoss = (over: Partial<Enemy> = {}): Enemy => ({
  name: 'Endless Reuse', ch: 'B', c: '#fff', x: 5, y: 5,
  hp: 40, maxHp: 100, atk: 100, def: 5, exp: 10, goldDrop: 10,
  ai: 'chase', stunned: 0, feared: 0, isAlly: false, isBoss: true,
  el: 'none', res: {}, skillCd: 0, ...over,
} as Enemy);

beforeEach(() => {
  (globalThis as any).G = {
    floor: 43, branchMode: false, gameOver: false,
    enemies: [],
    items: [],
    player: { x: 0, y: 0, hp: 100, maxHp: 100, buffs: [] },
    dungeon: { map: Array.from({ length: 30 }, () => Array(30).fill(TL.FLOOR)), rooms: [], stair: { x: 0, y: 0 }, traps: [] },
  };
});
afterEach(() => { vi.restoreAllMocks(); });

describe('① boss phases from the instance', () => {
  it('F43 endless boss with instance phases triggers + scales from bossAtkBase (no table match)', () => {
    const boss = mkBoss({ phases: [{ hpThreshold: 0.5, atkM: 1.5 }], bossAtkBase: 100 });
    processBossPhase(boss);
    expect(boss.atk).toBe(150);                       // 100 * 1.5
    expect(boss.phasesTriggered?.size).toBe(1);
  });

  it('legacy save (no instance fields) falls back to the floor table — F5 Goblin King', () => {
    (globalThis as any).G.floor = 5;
    const boss = mkBoss({ hp: 40, maxHp: 100 });       // ratio .4 <= .4
    processBossPhase(boss);
    const gk = BOSSES.find(b => b.fl === 5)!;
    const origAtk = gk.atk * (1 + (5 - 1) * .1);       // 10 * 1.4 = 14
    expect(boss.atk).toBe(Math.floor(origAtk * gk.phases![0].atkM!));  // floor(14*1.4)=19
  });
});

describe('① boss summon from the instance', () => {
  it('F43 endless boss with instance summon spawns a themed add', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const boss = mkBoss({ summon: { chance: 1, cd: 5, maxAdds: 3, kind: 'Goblin' } });
    tryBossSummon(boss);
    expect((globalThis as any).G.enemies.length).toBe(1);
    expect((globalThis as any).G.enemies[0].name).toContain('Goblin');
  });
});

describe('① endless reuse pool excludes the branch mini-boss', () => {
  it('endlessBossPool = all main-line bosses (fl>=5), Myconid Sovereign (fl 0) out', () => {
    expect(BOSSES.some(b => b.fl === 0)).toBe(true);           // fixture exists
    const pool = endlessBossPool();
    expect(pool.every(b => b.fl >= 5)).toBe(true);
    expect(pool.length).toBe(BOSSES.length - 1);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/__tests__/makeEnemy.test.ts src/__tests__/makeEnemy-real-data.test.ts src/__tests__/enemies-boss.test.ts`
Expected: 新增用例 FAIL（`e.phases` undefined / `endlessBossPool` not exported / atk 仍 100）；既有用例 PASS。若 enemies-boss.test 因缺某个 mock 导出名报模块错误，按报错把缺的导出补进对应 vi.mock 工厂（enemies.ts:2-16 列出的每个具名 import 都要有）。

- [ ] **Step 3: 实现**

`src/types.ts` Enemy 接口（`skillCd: number;` 附近）加：

```ts
  // ① reconnect: boss config travels with the instance — endless F45+ reuse
  // another floor's BossDef, so the old floor-keyed table lookups came up
  // empty there. Optional: legacy saves hold instances without them.
  phases?: BossDef['phases'];
  summon?: BossDef['summon'];
  bossAtkBase?: number;
```

`src/enemy-factory.ts`：import 行加 `BossDef`；`EnemyBase`（:11-16）`skill?: EnemySkill;` 后加：

```ts
  phases?: BossDef['phases'];
  summon?: BossDef['summon'];
```

`makeEnemy` 返回对象（:60 `tags:` 行后）加：

```ts
    // ① Boss config rides the instance (reference copy — read-only static
    // data, unlike `skill` which gets a defensive deep copy). bossAtkBase =
    // post-scale spawn atk; with the .1 boss fs this equals the legacy
    // origAtk formula bd.atk*(1+(fl-1)*.1).
    ...(m?.isBoss ? { phases: base.phases, summon: base.summon, bossAtkBase: Math.floor(base.atk * fs * atkM) } : {}),
```

`src/enemies.ts` 三处读点 + 无尽池：

- `:65` `const base = pick(BOSSES);` → `const base = pick(endlessBossPool());`，并在 `spawnEnemies` 上方加导出：

```ts
// Endless F45+ boss reuse pool — excludes the fl:0 branch mini-boss
// (Myconid Sovereign: no phases/summon, wrong tier for endless).
export function endlessBossPool(): BossDef[] {
  return BOSSES.filter(b => b.fl >= 5);
}
```

（`import type { Enemy, Room, Element }` 行补 `BossDef`；data 的 `BOSSES` 已 import。）

- `processBossPhase` :140-145 改：

```ts
  const fl = G.floor;
  const bd = BOSSES.find(b => b.fl === fl);
  // Instance-first: makeEnemy-copied bosses (endless F45+ reuse) carry their
  // own phases; the table lookup stays as the legacy-save fallback.
  const phases = boss.phases ?? bd?.phases;
  if (!phases) return;
  if (!boss.phasesTriggered) boss.phasesTriggered = new Set();
  const origAtk = boss.bossAtkBase ?? (bd ? bd.atk * (1 + (fl - 1) * .1) : boss.atk);
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
```

（循环体 :146-158 不动。）

- `tryBossSummon` :332-336 改（并加 `export`，供测试）：

```ts
  const fl = G.floor;
  const bd = BOSSES.find(b => b.fl === fl);
  const cfg = boss.summon ?? bd?.summon;   // instance-first, table fallback
  if (!cfg) return;
  if ((boss.aiCd ?? 0) > 0) return;                 // on cooldown
```

（删掉原 :334-336 的 `if (!bd || !bd.summon) return;` 与 `const cfg = bd.summon;`，后续 nearbyAdds 逻辑用 `cfg` 不变。）

- `bossSummonAdd` :347-350 同型改：

```ts
  const fl = G.floor;
  const bd = BOSSES.find(b => b.fl === fl);
  const cfg = boss.summon ?? bd?.summon;
  if (!cfg) return;
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/__tests__/makeEnemy.test.ts src/__tests__/makeEnemy-real-data.test.ts src/__tests__/enemies-boss.test.ts`
Expected: 全 PASS。

- [ ] **Step 5: tsc + 提交**

```bash
npx tsc --noEmit   # 贴 0 错原文
git add src/types.ts src/enemy-factory.ts src/enemies.ts src/__tests__/makeEnemy.test.ts src/__tests__/makeEnemy-real-data.test.ts src/__tests__/enemies-boss.test.ts
git commit -m "fix(endless): boss phases/summon travel with the instance; table kept as legacy fallback (audit #1)"
```

---

### Task 2: ⑥ F55+ 距离加权回退 pickWeightedByMf

**Files:**
- Modify: `src/enemy-factory.ts`（文件末尾加纯函数）
- Modify: `src/enemies.ts:30`
- Test: `src/__tests__/makeEnemy.test.ts`

**Interfaces:**
- Produces: `pickWeightedByMf<T extends { mf: number }>(pool: T[], floor: number, rand: () => number = Math.random): T | undefined`（enemy-factory.ts 导出）
- 消费：enemies.ts `makeIn` 回退分支。窗口非空分支（F1-54）零改动。

- [ ] **Step 1: 写失败测试**（`makeEnemy.test.ts` 末尾追加）

```ts
import { pickWeightedByMf } from '../enemy-factory.js';   // 提到文件顶部 import 区

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
    expect(deep).toBeGreaterThanOrEqual(50);   // mf50 share ≈ exp(-10/15)=0.51 vs mf42 0.41 + mf1 0.02
  });
  it('degenerate pools: empty -> undefined, single -> itself', () => {
    expect(pickWeightedByMf([], 60, () => 0)).toBeUndefined();
    expect(pickWeightedByMf([{ mf: 7 }], 60, () => 0)).toEqual({ mf: 7 });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/__tests__/makeEnemy.test.ts`
Expected: FAIL `pickWeightedByMf is not a function`。

- [ ] **Step 3: 实现**

`src/enemy-factory.ts` 末尾追加：

```ts
// ⑥ Deep-floor fallback pick (F55+, where the [floor-4, floor] mf window is
// empty and uniform `pick` gave F1 rats Void-Titan odds). Weight falls off
// with distance: w = exp(-(floor - mf)/15) → F60: mf50→0.51, mf42→0.41, mf1→0.02.
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
```

`src/enemies.ts:30`：

```ts
    const base = se.length > 0 ? pick(se) : (pickWeightedByMf(el, floor) ?? pick(el));
```

（import 区 `import { makeEnemy } from './enemy-factory.js';` → `import { makeEnemy, pickWeightedByMf } from './enemy-factory.js';`）

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/__tests__/makeEnemy.test.ts`
Expected: 全 PASS（含既有用例）。

- [ ] **Step 5: tsc + 提交**

```bash
npx tsc --noEmit
git add src/enemy-factory.ts src/enemies.ts src/__tests__/makeEnemy.test.ts
git commit -m "fix(spawn): distance-weighted fallback pick for F55+ empty mf windows (audit #6)"
```

---

### Task 3: ② 腐化净化接入活体地形 + 死代码清除

**Files:**
- Modify: `src/events.ts:24-28,54-64,122-142,192-213`
- Modify: `src/turn.ts:10,101`
- Modify: `src/i18n.ts`（:254 后加 2 key；删 12 个死 key）
- Test: Create `src/__tests__/events-checkTiles.test.ts`

**Interfaces:**
- 消费：`applyCorruption(-15/-20)`（combat.ts 既有导出，events.ts 已 import）。
- Produces: 新 i18n key `ev.fountainPurify`、`ev.shrinePurify`；删除导出 `maybeEvent`（turn.ts 不再调用）。

- [ ] **Step 1: 写失败测试**

新建 `src/__tests__/events-checkTiles.test.ts`：

```ts
// ② reconnect: fountains/shrines must CLEANSE corruption (the -15/-20 values
// lived in dead popup code). Unit boundary: assert checkTiles' decisions —
// applyCorruption mock records the call; its math is covered elsewhere.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../state.js', () => ({ get G() { return (globalThis as any).G; }, lang: 'en' }));
vi.mock('../utils.js', () => ({ rng: () => 1, dst: () => 1, pick: (a: any[]) => a[0] }));
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../effects.js', () => ({ flt: () => {}, shake: () => {} }));
vi.mock('../fx.js', () => ({ fxFlash: () => {}, fxBurst: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: vi.fn() }));
vi.mock('../render.js', () => ({ updateUI: () => {}, render: () => {} }));
vi.mock('../game.js', () => ({ enterBranch: () => {}, exitBranch: () => {} }));
vi.mock('../items.js', () => ({ genItem: () => ({}) }));
vi.mock('../i18n.js', () => ({
  t: (k: string) => k,
  tMsg: (k: string, ...a: string[]) => a.reduce((s, x) => s.replace('{}', x), k),
  tx: (f: any) => f?.en ?? '',
}));
vi.mock('../combat.js', () => ({
  applyCorruption: vi.fn(),
  playerDeath: vi.fn(),
  recalc: () => {},
}));
vi.mock('../bridge.js', () => ({ bridge: {} }));

import { checkTiles } from '../events.js';
import { applyCorruption } from '../combat.js';
import { TL } from '../config.js';
import * as events from '../events.js';

const mkG = (tile: number, corruption: number, hpFull = true) => ({
  floor: 5, branchMode: false, gameOver: false,
  dungeon: { map: [[tile]], rooms: [], stair: { x: 0, y: 0 }, traps: [] },
  items: [], enemies: [],
  player: {
    x: 0, y: 0, corruption,
    hp: hpFull ? 100 : 40, maxHp: 100,
    mp: 100, maxMp: 100,
    baseAtk: 5, baseDef: 5, baseMaxHp: 100, buffs: [],
  },
});

beforeEach(() => { vi.clearAllMocks(); });

describe('② fountain cleanses corruption', () => {
  it('full HP/MP but corruption>0: consumes the fountain + applyCorruption(-15)', () => {
    (globalThis as any).G = mkG(TL.FOUNTAIN, 30);
    checkTiles();
    expect(applyCorruption).toHaveBeenCalledWith(-15);
    expect((globalThis as any).G.dungeon.map[0][0]).toBe(TL.WATER);   // consumed
  });
  it('corruption 0 + full HP/MP: quiet, tile NOT consumed', () => {
    (globalThis as any).G = mkG(TL.FOUNTAIN, 0);
    checkTiles();
    expect(applyCorruption).not.toHaveBeenCalled();
    expect((globalThis as any).G.dungeon.map[0][0]).toBe(TL.FOUNTAIN);
  });
});

describe('② shrine cleanses corruption', () => {
  it('corruption>0: blessing fires + applyCorruption(-20)', () => {
    (globalThis as any).G = mkG(TL.SHRINE, 30);
    checkTiles();
    expect(applyCorruption).toHaveBeenCalledWith(-20);
    expect((globalThis as any).G.dungeon.map[0][0]).toBe(TL.FLOOR);
  });
});

describe('② dead popup-event code removed', () => {
  it('maybeEvent no longer exported', () => {
    expect((events as any).maybeEvent).toBeUndefined();
  });
});
```

注意：若 events.ts 顶部还 import 了本清单之外的运行时模块（读 events.ts:1-17 核对），照同型补 vi.mock；纯类型 import 不用管。`items.js`/`bridge.js` 以实际 import 名为准（events.ts 用了 `genItem` 与 `bridge`）。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/__tests__/events-checkTiles.test.ts`
Expected: 净化 2 条 FAIL（applyCorruption 未被调用 / tile 未消耗——现行 quiet 分支把满血满蓝判为 quiet）；maybeEvent 条 FAIL。

- [ ] **Step 3: 实现 events.ts + turn.ts**

`checkTiles` FOUNTAIN 分支（:192-204）整体替换：

```ts
  if (tile === TL.FOUNTAIN) {
    const h = Math.floor(G.player.maxHp * .3);
    const healed = Math.min(h, G.player.maxHp - G.player.hp);
    const corrupt = G.player.corruption > 0;
    // Consume when the player benefits any way: HP, MP, or a corruption
    // cleanse (② reconnect — the -15 fountain cleanse was dead popup code).
    if (healed <= 0 && G.player.mp >= G.player.maxMp && !corrupt) {
      addMsg(t('ev.fountainQuiet'), 'mi');
    } else {
      G.player.hp += healed;
      G.player.mp = Math.min(G.player.maxMp, G.player.mp + Math.floor(G.player.maxMp * .2));
      addMsg(tMsg('ev.fountainRestore', String(healed)), 'mh');
      if (corrupt) { applyCorruption(-15); addMsg(t('ev.fountainPurify'), 'md'); }
      flt(G.player.x, G.player.y, `+${healed}`, '#80ed99'); snd('heal');
      G.dungeon.map[G.player.y][G.player.x] = TL.WATER;
    }
  }
```

SHRINE 分支（:206-213）在 `else { ... ev.shrineHp ... }` 行之后、`recalc();` 之前插一行：

```ts
    if (G.player.corruption > 0) { applyCorruption(-20); addMsg(t('ev.shrinePurify'), 'md'); }
```

死代码删除：
- `maybeEvent`（:24-28 整函数）。
- `showEvent` 的 `fountain_event`/`shrine_event` 两个 else-if 分支（:54-64）。
- `fountainDrink`/`shrinePray`（:122-142 整函数）。
- `turn.ts`：删 `:10 import { maybeEvent } from './events.js';` 与 `:101 maybeEvent();`。

- [ ] **Step 4: i18n 增删**

先 grep 验证死 key 仅死分支引用：

```bash
grep -rn "fountainTitle\|fountainDesc\|fountainDrink\|fountainSkip\|fountainHeal\|shrineTitle\|shrineDesc\|shrinePray\|shrineSkip\|shrineBlessing" src/
```

Expected: 仅 `src/events.ts`（即将删除的死分支）与 `src/i18n.ts` 自身命中；如出现其他文件命中，**停**——把该引用报告回来再决定。

`i18n.ts` :255 `"ev.fountainRestore"` 行后加：

```ts
  "ev.fountainPurify": { en: "✨ The clear water washes away corruption! (-15)", zh: "✨ 清泉洗去腐化！（-15）" },
  "ev.shrinePurify": { en: "✨ The shrine's blessing purifies you! (-20 corruption)", zh: "✨ 神龛的祝福净化了你！（腐化-20）" },
```

删除上述 grep 验证过的 12 个死 key：`fountainTitle`、`fountainDesc`、`fountainDrink`、`fountainSkip`、`fountainHeal`、`shrineTitle`、`shrineDesc`、`shrinePray`、`shrineSkip`、`ev.shrineBlessingAtk2`、`ev.shrineBlessingDef2`、`ev.shrineBlessingHp10`。

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run src/__tests__/events-checkTiles.test.ts src/__tests__/turn.test.ts 2>/dev/null || npx vitest run src/__tests__/events-checkTiles.test.ts`
Expected: 新文件全 PASS。

- [ ] **Step 6: tsc + 全量回归 + 提交**

```bash
npx tsc --noEmit
npx vitest run          # 332±既有 + 新增，全绿（确认无文件因 maybeEvent 删除而崩）
git add src/events.ts src/turn.ts src/i18n.ts src/__tests__/events-checkTiles.test.ts
git commit -m "fix(corruption): fountains/shrines cleanse corruption (-15/-20); delete dead popup-event code (audit #2)"
```

---

### Task 4: ③ 三个死天赋复活 + 玩家 CC 上线

**Files:**
- Modify: `src/talents.ts:295-298`（getSkillModifiers）
- Modify: `src/skills.ts`（import 区 + case 'aoe' :129-144）
- Modify: `src/enemy-skills.ts:2-13,103-124`
- Modify: `src/data.ts:206,225,235`
- Modify: `src/i18n.ts:245` 后加 1 key
- Test: `src/__tests__/talents.test.ts`、`src/__tests__/skills.test.ts`、`src/__tests__/enemy-skills.test.ts`、`src/__tests__/makeEnemy-real-data.test.ts`

**Interfaces:**
- 消费：`mods.randomElement`（talents.ts:335 已置位）、`isCCImmune()`（talents.ts:377 既有导出）、`getElementSymbol(el)`（combat.ts:53 既有导出）、抗性公式形状 `elMult *= (1 - res)`（combat.ts:105-108——**正 res 减伤**，实现必须同号同形）。
- Produces: data 3 个 `debuff_stun` skill；`esk.stunImmune` key。

- [ ] **Step 1: 写失败测试（4 个文件）**

`talents.test.ts`：先删掉 `vi.mock('../data.js', () => ({ TALENT_TREES: {} }));` 这行（让 data 真实——getSkillModifiers 需要真树；对既有 onEnemyHitPlayer 用例无影响），import 区补 `import { getSkillModifiers } from '../talents.js';`，文件末尾追加：

```ts
describe('③ w_shield_mastery consumes into skill dmgMult', () => {
  it('rank 2 -> dmgMult 1.4', () => {
    (globalThis as any).G = { player: { talents: { talents: { w_shield_mastery: 2 } } } };
    expect(getSkillModifiers(0).dmgMult).toBeCloseTo(1.4);
  });
  it('rank 0 -> base 1.0', () => {
    (globalThis as any).G = { player: { talents: { talents: {} } } };
    expect(getSkillModifiers(0).dmgMult).toBe(1);
  });
});
```

`skills.test.ts`：talents mock 工厂改为可覆写（:19）：

```ts
vi.mock('../talents.js', () => ({ getSkillModifiers: vi.fn(() => ({})), getSpellPenMult: vi.fn(() => 1), onPlayerKill: () => {} }));
```

（原 `getSpellPenMult: () => 0` 同步改 1——既有用例只测 processAoeKills，不走该函数。）import 区加：

```ts
import { getSkillModifiers } from '../talents.js';
import { executeSkill } from '../skills.js';
```

文件末尾追加：

```ts
describe('③ m_elemental_storm: aoe rides a random element with (1 - res) scaling', () => {
  it('fire-locked roll halves damage vs a fire-resistant foe, matches combat.attack sign', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);   // element idx 0 = fire; no other rolls in this path
    vi.mocked(getSkillModifiers).mockReturnValue({
      dmgMult: 1, forceCrit: false, aoe: false, chainCount: 0, radiusBonus: 0,
      halfCd: false, alsoFear: false, alsoStun: false, alsoHolyDmg: false,
      alsoHeal: false, alsoSlow: false, alsoBlind: false, randomElement: true,
    } as any);
    (globalThis as any).G = {
      floor: 5, won: false,
      player: { x: 0, y: 0, ci: 1, mp: 100, maxMp: 100, skillCd: 0, stunned: 0,
        atk: 10, level: 3, spellPower: 1, exp: 0, gold: 0, kills: 0 },
      enemies: [
        { name: 'Neutral', x: 1, y: 0, hp: 100, maxHp: 100, isAlly: false, res: {} },
        { name: 'FireWard', x: 0, y: 1, hp: 100, maxHp: 100, isAlly: false, res: { fire: 0.5 } },
      ],
    };
    executeSkill({ cost: 5, effect: 'aoe', cd: 3 });
    // base = (10 + 3*3) * 1 * 1 * 1 = 19; res .5 -> floor(19*.5) = 9
    expect((globalThis as any).G.enemies[0].hp).toBe(81);
    expect((globalThis as any).G.enemies[1].hp).toBe(91);
  });
});
```

`enemy-skills.test.ts`：文件末尾追加（`mk`/`minimalPlayer`/G setup 复用文件内既有夹具；若该文件没有 talents/data 的 vi.mock，则 talents 以真实模块进链——isCCImmune 只读玩家天赋表，安全）：

```ts
it('③ debuff_stun: Sanctuary (isCCImmune) blocks the stun', () => {
  const e = mk({ x: 1, y: 0 });
  (globalThis as any).G.player.talents = { talents: { p_sanctuary: 1 } };
  executeEnemySkill(e, { name: { en: 'Z', zh: 'Z' }, effect: 'debuff_stun', chance: 1, cd: 1, aoe: 2 });
  expect((globalThis as any).G.player.stunned ?? 0).toBe(0);   // blocked
});
```

`makeEnemy-real-data.test.ts` 末尾追加硬门：

```ts
it('③ exactly 3 enemies carry debuff_stun (CC online, conservative)', () => {
  const stunCasters = ENEMIES.filter(e => e.skill?.effect === 'debuff_stun');
  expect(stunCasters.map(e => e.n.en).sort()).toEqual(['Cosmic Horror', 'Drakeborn Knight', 'Dread Legionnaire']);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/__tests__/talents.test.ts src/__tests__/skills.test.ts src/__tests__/enemy-skills.test.ts src/__tests__/makeEnemy-real-data.test.ts`
Expected: 新增 5 条 FAIL（dmgMult 1 / hp 100,100 / stunned 2 / caster 列表不等）；既有 PASS。

- [ ] **Step 3: 实现**

`talents.ts` getSkillModifiers，在 `if (tr(p, 'p_smite') > 0) mods.dmgMult += 0.4;`（:297）后加：

```ts
  // ③ Shield Mastery — warrior's only active skill is Shield Bash (case
  // 'stun'), so a class-scoped dmgMult is exactly "Shield Bash +20%/rank".
  const smRank = tr(p, 'w_shield_mastery');
  if (smRank > 0) mods.dmgMult += 0.2 * smRank;
```

`skills.ts`：import 区从 combat 补 `getElementSymbol`；文件顶部（EL 表区）加：

```ts
// ③ Elemental Storm per-roll element colors (mirrors enemy-skills.ts EL_COLOR).
const EL_COLOR: Record<string, string> = { fire: '#ff7a45', ice: '#7ec8e3', lightning: '#fff2a8', shadow: '#b583f6' };
```

`case 'aoe'`（:129-144）改头部与循环：

```ts
    case 'aoe': {
      // Mage — Arcane Blast
      fxFlash(p.x, p.y, '#7ec8e3', 2.2);
      const baseRadius = 5 + mods.radiusBonus;
      const spellPen = getSpellPenMult();
      // ③ Elemental Storm — the blast rides a random element; each foe's
      // resistance rescales damage with combat.attack's exact shape:
      // (1 - res), positive res cuts, negative (vulnerability) boosts.
      let el: Element = 'none';
      let elColor = '#4895ef';
      if (mods.randomElement) {
        const RND_EL: Element[] = ['fire', 'ice', 'lightning', 'shadow'];
        el = RND_EL[Math.floor(Math.random() * RND_EL.length)];
        elColor = EL_COLOR[el] ?? elColor;
      }
      const sym = el !== 'none' ? getElementSymbol(el) : '';
      const enemies = G.enemies.filter(e => !e.isAlly && dst(p.x, p.y, e.x, e.y) <= baseRadius);
      const killed: Enemy[] = [];
      for (const e of enemies) {
        const resMult = el !== 'none' ? (1 - (e.res?.[el] ?? 0)) : 1;
        const dmg = Math.floor((p.atk + p.level * 3) * p.spellPower * mods.dmgMult * spellPen * resMult);
        e.hp -= dmg; fxFlash(e.x, e.y, elColor); flt(e.x, e.y, `-${dmg}${sym}`, elColor);
```

（循环剩余部分 :140-144 不动。）

`enemy-skills.ts`：import 区补 `import { t } from './i18n.js';`（改自仅 tMsg——按现有行合并）、`import { isCCImmune } from './talents.js';`（talents 不 import enemy-skills，无环）。`castDebuff` stun 分支（:118-122）顶部插守卫：

```ts
  } else { // stun
    if (isCCImmune()) { addMsg(t('esk.stunImmune'), 'mi'); return; }
    p.stunned = Math.min(2, Math.max(p.stunned ?? 0, turns));
```

（顺手把 :119 的"v1: no caster uses the 'stun' kind yet"过期注释删掉——3 个 caster 本任务上线。）

`data.ts` 三个现值条目追加 skill（行尾，沿既有单行风格）：

- `:206` Drakeborn Knight（龙裔骑士，mf24，原无技能）加：
  `skill: { name: { en: 'Dragon Bash', zh: '龙裔盾击' }, effect: 'debuff_stun', chance: 0.25, cd: 5, aoe: 1, range: 1 }`
- `:225` Cosmic Horror（宇宙恐怖，mf39，原无技能）加：
  `skill: { name: { en: 'Mind Fracture', zh: '心智撕裂' }, effect: 'debuff_stun', chance: 0.25, cd: 5, aoe: 1 }`
- `:235` Dread Legionnaire（恐惧军团兵，mf18，原无技能）加：
  `skill: { name: { en: 'Terrifying Slam', zh: '威慑猛击' }, effect: 'debuff_stun', chance: 0.25, cd: 5, aoe: 1, range: 1 }`

（`aoe: 1` 在 debuff 语义 = 眩晕 1 回合，handler `Math.min(2, ...)` 兜底；骑士近战 `range: 1`，宇宙恐怖默认射程 5。）

`i18n.ts` :245 `"esk.playerStunned"` 行后加：

```ts
  "esk.stunImmune": { en: "Sanctuary! You shrug off the stun.", zh: "庇护所生效！你免疫了眩晕。" },
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/__tests__/talents.test.ts src/__tests__/skills.test.ts src/__tests__/enemy-skills.test.ts src/__tests__/makeEnemy-real-data.test.ts`
Expected: 全 PASS。

- [ ] **Step 5: tsc + 提交**

```bash
npx tsc --noEmit
git add src/talents.ts src/skills.ts src/enemy-skills.ts src/data.ts src/i18n.ts src/__tests__/talents.test.ts src/__tests__/skills.test.ts src/__tests__/enemy-skills.test.ts src/__tests__/makeEnemy-real-data.test.ts
git commit -m "feat(talents): revive shield_mastery/elemental_storm/sanctuary + 3 stun casters (audit #3)"
```

---

### Task 5: ⑦ corruption_ward 补 endless 门

**Files:**
- Modify: `src/combat.ts:383`
- Modify: `src/__tests__/combat.test.ts:118-132`（ward 用例 + 新增 1 条）

**Interfaces:**
- 消费：`G.endless`（state 既有字段）、`corruptionWardMult()`（meta.ts:183，测试已 mock 0.5）。

- [ ] **Step 1: 写失败测试**

`combat.test.ts`：找到 corruption_ward 用例（`:129 applyCorruption(1); expect(...corruption).toBe(10)` 所在 it），在其 G 夹具赋值后（beforeEach 设 `(globalThis as any).G = fixtureG();` 的块内、该 it 开头）加一行：

```ts
    (globalThis as any).G.endless = true;   // ⑦ ward is an endless meta upgrade
```

并在同一 describe 内追加新用例：

```ts
  it('⑦ normal mode ignores corruption_ward entirely (endless-gated)', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);  // would always pass the 0.5 gate
    applyCorruption(1);
    expect(G.player.corruption).toBe(11);   // ward NOT applied — endless false
    spy.mockRestore();
  });
```

（`G` 取该文件既有的 G 访问方式——fixtureG 的引用；与文件内既有用例同风格。）

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/__tests__/combat.test.ts`
Expected: 新用例 FAIL（corruption 仍 10——ward 在普通模式也生效）；改过 endless:true 的既有用例 PASS。

- [ ] **Step 3: 实现**

`combat.ts:383`：

```ts
  if (G.endless && n > 0 && Math.random() < (1 - corruptionWardMult())) n -= 1;
```

并把 :379-382 注释里的 "Task 4: corruption_ward meta multiplies" 首句补成 `// Task 4: corruption_ward (endless meta upgrade — ⑦ gated to G.endless so normal runs are untouched) multiplies`。

- [ ] **Step 4: 跑测试确认通过（含同 mock 系测试）**

Run: `npx vitest run src/__tests__/combat.test.ts src/__tests__/combat-eternal-sand.test.ts src/__tests__/endless-content.test.ts src/__tests__/endless-content-relics.test.ts`
Expected: 全 PASS（eternal_sand/relics 系 mock=1，1-mult=0 恒假，不受门影响——逐一确认）。

- [ ] **Step 5: tsc + 提交**

```bash
npx tsc --noEmit
git add src/combat.ts src/__tests__/combat.test.ts
git commit -m "fix(endless): gate corruption_ward behind G.endless — normal runs untouched (audit #7; behavior fix, not a loosened assertion)"
```

---

### Task 6: ④ renderTitleStats 接线 + ⑤ lore 补两条与 fungal 解锁

**Files:**
- Modify: `src/main.ts:180,192,272`
- Modify: `src/lore.ts:38` 后加 2 条
- Modify: `src/game.ts:176`
- Test: Create `src/__tests__/title-stats.test.ts`；`src/__tests__/codex.test.ts` 追加

**Interfaces:**
- 消费：`renderTitleStats`（meta.ts:373，main.ts:28 已 import）；`unlockLore`（meta.ts 导出——game.ts 若未 import 则补 `import { unlockLore } from './meta.js';`，meta 不反向 import game，无环）。

- [ ] **Step 1: 写失败测试**

新建 `src/__tests__/title-stats.test.ts`：

```ts
// ④ reconnect: #title-stats must actually render on the title screen.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../state.js', () => ({ get G() { return (globalThis as any).G; }, lang: 'en' }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tx: (f: any) => f?.en ?? '' }));
vi.mock('../data.js', () => ({ ACH_DEFS: [] }));

import { renderTitleStats } from '../meta.js';

beforeEach(() => {
  document.body.innerHTML = '<div id="title-stats"></div>';
  localStorage.clear();
  localStorage.setItem('dh_meta', JSON.stringify({
    soulEchoes: 5,
    stats: { totalRuns: 3, bestFloor: 12, wins: 1, totalKills: 40 },
    achievements: [],
  }));
});

describe('④ renderTitleStats', () => {
  it('fills #title-stats with echoes/runs/best/wins/kills/achv', () => {
    renderTitleStats();
    const html = document.getElementById('title-stats')!.innerHTML;
    expect(html).toContain('>5<');        // soul echoes
    expect(html).toContain('F12');        // best floor
    expect(html).toContain('mt.runs');
    expect(html).toContain('mt.achv');
  });
});
```

（meta.ts 若还 import 其他运行时模块导致加载失败，按报错补 vi.mock；`getMeta` 读 `dh_meta`（META_KEY，meta.ts:8），缺省字段由 defaultStats 兜底。）

`codex.test.ts` 末尾追加（文件已 import LORE_ENTRIES 或就近补 import）：

```ts
it('⑤ area lore covers the fungal branch and the endless zone', () => {
  const ids = LORE_ENTRIES.map(e => e.id);
  expect(ids).toContain('area:fungal');
  expect(ids).toContain('area:endless');
  for (const id of ['area:fungal', 'area:endless']) {
    const e = LORE_ENTRIES.find(x => x.id === id)!;
    expect(e.cat).toBe('area');
    expect(e.body.en.length).toBeGreaterThan(40);
    expect(e.body.zh.length).toBeGreaterThan(20);
  }
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/__tests__/title-stats.test.ts src/__tests__/codex.test.ts`
Expected: title-stats PASS（函数本身是好的——**这不意外**：④的"断线"在调用侧，函数级测试钉行为防回归，接线由 Step 4 的 grep 门验证）；codex 新用例 FAIL（两条 id 缺失）。

- [ ] **Step 3: 实现 lore + 解锁**

`lore.ts` :38 `area:sanctum` 行后加：

```ts
  { id: 'area:fungal', cat: 'area', n: { en: 'Fungal Hollow', zh: '荧光菌穴' }, body: { en: "A pocket biome behind the portal — spore-choked dark where mycelium remembers every Descender who walked it. The Sovereign blooms quietly at its heart.", zh: '传送门后的秘境一隅，孢子弥漫的黑暗。菌丝记得每一位走过的下探者，菌主在其深处静静绽放。' } },
  { id: 'area:endless', cat: 'area', n: { en: 'Endless Abyss', zh: '无尽深渊' }, body: { en: 'Beyond F40 the broken seal bleeds twisted void. Floors repeat, horrors compound — Descenders descend not to win, but to see how far they fall.', zh: 'F40 之后，破碎的封印渗出扭曲虚空。楼层重复，恐怖叠加——继续向下已非为了胜利，只为看自己能坠多深。' } },
```

`game.ts` `enterBranch` :176 `G.branchMode = true;` 后加：

```ts
  unlockLore('area:fungal');   // ⑤ branch floors never resolve the main area — unlock here
```

（import 区补 `unlockLore`；tsc 确认无环。`area:endless` 无需手动——game.ts:125 `unlockLore('area:' + area.id)` 在 F41 命中 `id:'endless'` 自然解锁。）

- [ ] **Step 4: 实现 main.ts 接线 + grep 门**

三处 `initTitleParticles();` 调用后各加一行 `renderTitleStats();`：
- `:180`（char-back-btn 返回标题）
- `:192`（returnToTitle）
- `:272`（window load 启动）

grep 门（接线是④的本体，必须机械验证）：

```bash
grep -n "renderTitleStats()" src/main.ts
```

Expected: 恰好 3 处命中（:180/:192/:272 附近）。

- [ ] **Step 5: 跑测试 + tsc + 提交**

```bash
npx vitest run src/__tests__/title-stats.test.ts src/__tests__/codex.test.ts
npx tsc --noEmit
git add src/main.ts src/lore.ts src/game.ts src/__tests__/title-stats.test.ts src/__tests__/codex.test.ts
git commit -m "fix(meta): wire renderTitleStats at all title sites; add fungal/endless area lore + branch unlock (audit #4/#5)"
```

---

### Task 7: ⑧ 图标两像素修 + ⑨ 过期注释 + 全量门

**Files:**
- Modify: `src/sprites.ts:785-789,1063`
- Modify: `src/game.ts:170`、`src/enemies.ts:74-75`、`src/combat.ts:395-396`（注释）
- Test: `src/__tests__/sprites.test.ts`

**Interfaces:** 无新接口；sprites.test 的 16 字符/行 shape 守卫自动把关。

- [ ] **Step 1: 写失败测试**（`sprites.test.ts` 末尾追加）

```ts
describe('⑧ icon pixel fixes', () => {
  it('C_BOMB fuse row has no transparent hole', () => {
    expect(C_BOMB[3]).toBe('.....DMMMMMK....');    // was ".....DMMMM K...."
  });
  it('I_CROWN upper half is mirror-symmetric (true center fix, not a shift)', () => {
    // idx = line - 784: idx 1..5 = spire + peaks (redrawn), idx 6..10 = bands
    // (already symmetric). Every row must be a palindrome so the crown
    // centers on the same axis (7.5) as its lower bands/gems.
    for (let r = 1; r <= 10; r++) {
      expect(I_CROWN[r], `row ${r}`).toBe(I_CROWN[r].split('').reverse().join(''));
    }
    expect(I_CROWN[3]).toBe('.....KMMMMK.....');   // spire base, even width, center 7.5
  });
});
```

（import 区按文件现状补 `C_BOMB`/`I_CROWN`——若已从 sprites.ts 导入则仅加名。）

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/__tests__/sprites.test.ts`
Expected: 两条新用例 FAIL（row 含空格 / `.....KMMMK......` 非回文）。

- [ ] **Step 3: 实现像素修**

`sprites.ts` I_CROWN :785-789 五行替换为（真对称重画：上半与下半横带/宝石同轴 7.5，侧峰对齐宝石列 3-4/11-12）：

```ts
    ".......KK.......",
    "......KMMK......",
    ".....KMMMMK.....",
    "...K........K...",
    "...KK......KK...",
```

C_BOMB :1063 空格→M：

```ts
    ".....DMMMMMK....",   // fuse top (hole filled — space wasn't a palette color)
```

- [ ] **Step 4: ⑨ 三条过期注释**

- `game.ts:170` 段尾 `Both resolve the Task-2 fungal area / branch enemy pool at call time; until Task 2 lands, enterBranch no-ops (no 'fungal' area found).` → `Both resolve the fungal area / branch enemy pool at call time.`
- `enemies.ts:74-75` `Until Task 2 lands,\n// both filters come up empty and this returns [] — no branch enemies spawn.` → 删除这两句（保留其余描述）。
- `combat.ts:395-396` `(Phase 1: just ends run;\n// Phase 3 will persist you as a legacy/warden entity.)` → `(recordWardenLegacy persists the run as a warden entity.)`

- [ ] **Step 5: 跑测试 + 全量门**

```bash
npx vitest run src/__tests__/sprites.test.ts
npx tsc --noEmit        # 贴 0 错原文
npx vitest run          # 全绿：332 基线 + 本批全部新增（以汇总为准）
npm run build           # 0 错
```

- [ ] **Step 6: 提交**

```bash
git add src/sprites.ts src/game.ts src/enemies.ts src/combat.ts src/__tests__/sprites.test.ts
git commit -m "fix(icons): C_BOMB fuse hole + I_CROWN true mirror symmetry; refresh 3 stale comments (audit #8/#9)"
```

---

### Task 8: 收尾验证（不写代码）

- [ ] **Step 1: 对照 spec 验收清单逐项勾**

spec `docs/superpowers/specs/2026-08-24-reconnect-batch-design.md` §2 的 ①-⑨ 与 §3 的测试清单逐条对照（含"smoke 脚本不改"——本批不动设置面）。

- [ ] **Step 2: 手动冒烟（preview）**

```bash
npm run build && npm run preview -- --port 4173 &
python scripts/smoke_settings_core.py   # 65 检查应保持全过（回归确认）
```

游戏内快验（可选用调试捷径）：普通模式踩喷泉看净化消息；无尽 F45+ 打 Boss 看相位/召唤消息。

- [ ] **Step 3: push + CI**

```bash
curl -x http://127.0.0.1:7897 -s -o /dev/null -w "%{http_code}" https://github.com   # 200 再 push
git push -u origin feat/reconnect-batch
```

CI 只跑 main 的 push/PR——开 PR 或本地合 main 后触发；按团队惯例（既往 ff-merge main 再 push）走，merge 前完成 code review（superpowers:requesting-code-review）。

---

## Self-Review

**Spec coverage:** ①=T1 ②=T3 ③=T4 ④=T6 ⑤=T6 ⑥=T2 ⑦=T5 ⑧=T7 ⑨=T7；i18n 3 新 key 分属 T3(2)/T4(1)；测试清单 §3 每条都有对应用例（makeEnemy①=T1、pickWeighted⑥=T2、checkTiles②=T3、dmgMult③=T4、randomElement③=T4、stun immune③=T4、ward门⑦=T5、renderTitleStats④=T6、lore⑤=T6、stun caster 硬门③=T4）。无缺口。

**Placeholder scan:** 无 TBD/TODO/"适当处理"；所有代码步骤给出全文。两处"按报错补 mock"是确定性程序（枚举了报错来源与补法），非占位。

**Type consistency:** `phases/summon/bossAtkBase` 三处（types/factory/enemies）与测试字段名一致；`pickWeightedByMf<T extends { mf: number }>` 签名与调用点一致；`endlessBossPool` 定义（T1）与测试 import（T1）一致；`executeSkill({cost,effect,cd})` 签名取自 skills.ts:44 原文。

**已知偏差（已在 Global Constraints 声明）:** stun caster #2 与 I_CROWN 修法按 spec 的"以现值为准"条款精化，需向用户提示。
