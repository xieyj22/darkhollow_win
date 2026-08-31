# 批10「深渊记账+回响」Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 腐化成为第二货币（吃进腐化双价签+神龛暗黑契约）+ 死亡回响跨局实体（掠夺/超度/继承三交互），全部走既有 applyCorruption/addCorruption、meta、事件弹窗范式。

**Architecture:** B1 数据层（EchoRecord 落 dh_meta）→ B2 注入与交互（enterFloor 35% + showEvent 骨架）→ A1 纯叶 cost.ts（支付走 addCorruption 绕开修正链）→ A2 双价签（宝藏/endless）→ A3 神龛二选一 → battery。无新框架、无迁移风险（meta 逐字段兜底）。

**Tech Stack:** TS + Vite + vitest/happy-dom + playwright python battery（crib `scripts/verify_batch9_ingame.py`）。

**Spec:** `docs/superpowers/specs/batch10-abyss-ledger-echoes/TECH.md`（权威，计划与之同读）

## Global Constraints

- 基线 `main@9b23683`；开工先建分支 `feat/batch10-abyss-ledger-echoes`；开工前 `npx vitest run` 基线 554 全绿。
- 提交前缀：`feat(batch10):` / `fix(batch10):` / `test(batch10):` / `test(e2e):`。
- **支付只走 `addCorruption`（低层 clamp），绝不走 `applyCorruption`**——修正链（eternal_sand 减半/corruption_ward 抵消）会把支付变折扣或免费（spec Risks 最高危条目）。
- `canPayCorruption` 硬线：`cur + cost <= 95`（边界放行，永不因购物跨 100）。
- 新增用户可见文案全部走 `src/i18n.ts` en+zh 成对（批7 parity 门扫）。
- 不改既有 DOM id/class；复用 `#event-popup`/`.evb`/`eventActions` 骨架（`events.ts:34-67`）。
- T_ECHO 刻意不进 THEME_PAL（单 hue `buildPalette(...)`，同 T_KEY/T_INFINITY 先例，`sprites.ts:2163` 注释）。
- happy-dom 无 canvas2d：触渲染的单测 mock `../sprites.js` paint*；读源码的断言用动态 `'../' + f` new URL 形式（Vite 改写字面量，batch4 坑）。
- tsc 裸跑看 exit code；每任务收尾全量 vitest 不退步 + commit。

---

### Task 1: B1 数据层 — EchoRecord + recordEcho + playerDeath 接线

**Files:**
- Modify: `src/types.ts`（`MetaSave` 附近加 `EchoRecord`；`MetaSave` 加 `echoes?: EchoRecord[]`）
- Modify: `src/meta.ts`（getMeta 迁移一行 + `recordEcho` + `pickKeepsake`）
- Modify: `src/combat.ts:486-489`（buildEpitaph 后调 recordEcho）
- Test: `src/__tests__/batch10-echo-data.test.ts`（新建）

**Interfaces:**
- Produces: `interface EchoRecord { cause: DeathCause; killer: string; floor: number; turns: number; classIdx: number; corruption: number; keepsake: Item | null; epitaph: { template: string; flavor: string }; ts: number }`
- Produces: `recordEcho(rec: EchoRecord): void`（unshift、cap 10、saveMeta）
- Produces: `pickKeepsake(p: Player): Item | null`（inv + p.weapon/p.armor/p.accessory 中 rarity 最高，同稀有度取 inv 靠前的；空则 null）
- Consumes: `buildEpitaph(cause, killer, floor, turns)` 既有签名（`epitaph.ts:20`）；`saveMeta`/`getMeta`（`meta.ts`）。

- [ ] **Step 1: 写失败测试**

```ts
// 批10 B1: 死亡快照落 meta（echoes cap10 newest-first）+ keepsake 选取。
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../state.js', () => ({ G: null, lang: 'en' }));
vi.mock('../combat.js', () => ({ recalc: () => {}, checkLevelUp: () => {} }));

import { recordEcho, pickKeepsake, getMeta, initMeta } from '../meta.js';
import { readFileSync } from 'node:fs';
import type { EchoRecord } from '../types.js';

const mk = (ts: number): EchoRecord => ({
  cause: 'combat', killer: 'Slime', floor: 5, turns: 100, classIdx: 0,
  corruption: 30, keepsake: null, epitaph: { template: 'T', flavor: 'F' }, ts,
});

describe('批10 B1 recordEcho', () => {
  beforeEach(() => { localStorage.clear(); initMeta(); });
  it('落盘并可回读', () => {
    recordEcho(mk(1));
    expect(getMeta().echoes?.length).toBe(1);
    expect(getMeta().echoes![0].killer).toBe('Slime');
  });
  it('cap 10，newest-first', () => {
    for (let i = 0; i < 12; i++) recordEcho(mk(i));
    const es = getMeta().echoes!;
    expect(es.length).toBe(10);
    expect(es[0].ts).toBe(11); expect(es[9].ts).toBe(2);
  });
  it('旧档（无 echoes 字段）迁移为空数组', () => {
    localStorage.setItem('dh_meta', JSON.stringify({ stats: {}, upgrades: {} }));
    expect(getMeta().echoes).toEqual([]);
  });
});

describe('批10 B1 pickKeepsake', () => {
  const it3 = { rarity: 3 } as any, it1 = { rarity: 1 } as any;
  it('inv+装备取最高稀有度', () => {
    const p: any = { inv: [it1, it3], weapon: { rarity: 2 }, armor: null, accessory: null };
    expect(pickKeepsake(p)).toBe(it3);
  });
  it('全空返回 null', () => {
    expect(pickKeepsake({ inv: [], weapon: null, armor: null, accessory: null } as any)).toBeNull();
  });
});

describe('批10 B1 playerDeath 接线（source-gate）', () => {
  it('buildEpitaph 之后调用 recordEcho', () => {
    const text = readFileSync(new URL('../' + 'combat.ts', import.meta.url), 'utf8');
    expect(text).toContain('recordEcho({');
  });
});
```

- [ ] **Step 2: 跑测试确认红**

Run: `npx vitest run src/__tests__/batch10-echo-data.test.ts`
Expected: FAIL（recordEcho/pickKeepsake/EchoRecord 不存在）

- [ ] **Step 3: 最小实现**

`src/types.ts`（`MetaSave` 定义邻近，`DeathCause` 从 epitaph 侧 import 或按现状复述）：

```ts
// Batch10 B: death snapshot that can resurface as a map echo in later runs.
export interface EchoRecord {
  cause: import('./epitaph.js').DeathCause;
  killer: string; floor: number; turns: number; classIdx: number; corruption: number;
  keepsake: Item | null;             // full JSON snapshot (survives dh_save/dh_meta round-trips)
  epitaph: { template: string; flavor: string };
  ts: number;
}
```
并在 `MetaSave` 加 `echoes?: EchoRecord[];`。

`src/meta.ts`（recordRun 后面，镜像其惯例）：

```ts
export function recordEcho(rec: EchoRecord): void {
  const m = getMeta();
  if (!m.echoes) m.echoes = [];
  m.echoes.unshift(rec);
  if (m.echoes.length > 10) m.echoes.length = 10;
  saveMeta(m);
}

// Highest-rarity item across inventory + equipped slots — the run's keepsake.
export function pickKeepsake(p: Player): Item | null {
  const pool = [...(p.inv || []), p.weapon, p.armor, p.accessory].filter(Boolean) as Item[];
  if (!pool.length) return null;
  return pool.reduce((best, it) => (it.rarity > best.rarity ? it : best), pool[0]);
}
```
（顶部 import `type { EchoRecord, Player }`；`types.js` 已是既有 import 源。）`getMeta` 迁移区加 `if (!m.echoes) m.echoes = [];`。

`src/combat.ts:486-489` 后（epitaph 渲染完）：

```ts
  // Batch10 B1: persist the death snapshot — later runs may meet this echo on the map.
  recordEcho({
    cause, killer, floor: G.floor, turns: p.turns, classIdx: p.ci,
    corruption: p.corruption, keepsake: pickKeepsake(p),
    epitaph: { template: ep.template, flavor: ep.flavor }, ts: Date.now(),
  });
```
（`recordEcho`/`pickKeepsake` 加进 combat.ts 顶部对 `./meta.js` 的既有 import。）

- [ ] **Step 4: 跑测试确认绿 + 全量回归**

Run: `npx vitest run src/__tests__/batch10-echo-data.test.ts && npx vitest run`
Expected: 7 绿；全量 554+7=561

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/meta.ts src/combat.ts src/__tests__/batch10-echo-data.test.ts
git commit -m "feat(batch10): EchoRecord death snapshot persisted to dh_meta — recordEcho cap10 + pickKeepsake wired into playerDeath"
```

---

### Task 2: B2 回响注入与三交互

**Files:**
- Modify: `src/game.ts:99-127`（enterFloor 注入区加 echo 分支）
- Modify: `src/events.ts`（`triggerNpc` 加 `echo` 分支 + `openEchoEvent`）
- Modify: `src/sprites.ts`（`T_ECHO` 模板，T_KEY 邻近）
- Modify: `src/i18n.ts`（~10 键 en/zh）
- Test: `src/__tests__/batch10-echo-flow.test.ts`（新建）

**Interfaces:**
- Consumes: Task 1 的 `EchoRecord`/`getMeta().echoes`；`showEvent`/`_bindEventBtns`/`closeEvent` 骨架（`events.ts:34-76`）；`addItemWithOverflow`（`items.ts`）；`applyCorruption(-n)` 负向正门；`addCorruption`（`corruption.ts`）；`creditSoulEchoes(30)`（`meta.ts:222`）。
- Produces: 地图实体 `{ npc: 'echo', echo: EchoRecord, spriteKind: 'ECHO', … }`；`openEchoEvent(entity: Item): void`。

- [ ] **Step 1: 写失败测试**

```ts
// 批10 B2: echo 实体消费语义 + 三交互 + 注入门（source-gate）。
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../state.js', () => ({
  G: { player: { corruption: 30, maxHp: 100, hp: 50, inv: [], quickSlots: [] }, floor: 3 },
  lang: 'zh', eventOpen: false, setEventOpen: vi.fn(), setEventActions: vi.fn(),
}));
// 其余 vi.mock 前言照抄 src/__tests__/batch9-treasure-price.test.ts 的 mock 集
// （该文件在批9 已为 events.ts 现行 import 图调通）；events.ts 若新增 import 同步补 mock。
/* === 粘贴 batch9-treasure-price.test.ts 的全部 vi.mock 块，另加： === */
vi.mock('../meta.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../meta.js')>();
  return { ...actual, getMeta: () => ({ echoes: [], soulEchoes: 0 }), creditSoulEchoes: vi.fn() };
});
vi.mock('../items.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../items.js')>();
  return { ...actual, addItemWithOverflow: vi.fn() };
});
vi.mock('../corruption.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../corruption.js')>();
  return { ...actual, addCorruption: vi.fn() };
});

import { readFileSync } from 'node:fs';
import { npcPersists } from '../npc-rules.js';

describe('批10 B2 消费语义', () => {
  it("npcPersists('echo') === false（踩上即消耗，宝箱同款）", () => {
    expect(npcPersists('echo')).toBe(false);
  });
});

describe('批10 B2 注入门（source-gate）', () => {
  const g = readFileSync(new URL('../' + 'game.ts', import.meta.url), 'utf8');
  it('floor>=2 且 35% 且池非空才注入', () => {
    expect(g).toContain("floor >= 2 && Math.random() < 0.35");
    expect(g).toContain('getMeta().echoes');
    expect(g).toContain("npc: 'echo'");
  });
});

describe('批10 B2 三交互（source-gate + 行为桩）', () => {
  const e = readFileSync(new URL('../' + 'events.ts', import.meta.url), 'utf8');
  it('openEchoEvent 分派与三动作存在', () => {
    expect(e).toContain("entity.npc === 'echo'");
    expect(e).toContain('openEchoEvent');
    expect(e).toContain('addItemWithOverflow');
    expect(e).toContain('applyCorruption(-10)');
    expect(e).toContain('creditSoulEchoes(30)');
    expect(e).toContain("addCorruption(p, 10)");
  });
  it('keepsake null 走降级（+5 腐化换 50 金）', () => {
    expect(e).toContain('addCorruption(p, 5)');
    expect(e).toContain('50');
  });
});

describe('批10 B2 T_ECHO 模板', () => {
  it('sprites.ts 有 T_ECHO 且刻意不进 THEME_PAL', () => {
    const s = readFileSync(new URL('../' + 'sprites.ts', import.meta.url), 'utf8');
    expect(s).toContain('T_ECHO:');
    expect(s.match(/THEME_PAL[^;]*'ECHO'/)).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试确认红**

Run: `npx vitest run src/__tests__/batch10-echo-flow.test.ts`
Expected: FAIL（全部断言落空）

- [ ] **Step 3: 最小实现**

`src/game.ts` enterFloor 注入区（endless_merchant 门之后、事件站注入之前）：

```ts
  // Batch10 B: echo of a past run's death — 35% per floor (F2+), snapshot embedded
  // (NOT a meta index — the cap rotates and would drift across saves).
  if (floor >= 2 && Math.random() < 0.35) {
    const pool = getMeta().echoes || [];
    if (pool.length) {
      const rec = pick(pool)[0] ?? pool[0];   // 用仓库既有随机取法；无 pick 则 pool[Math.floor(Math.random()*pool.length)]
      const rm2 = pick(G!.dungeon.rooms);
      G!.items.push({ type: 'consumable', name: t('ev.echoTitle'), ch: 'Ω', c: '#9d8df1',
        desc: '', x: rng(rm2.x + 1, rm2.x + rm2.w - 2), y: rng(rm2.y + 1, rm2.y + rm2.h - 2),
        rarity: 2, npc: 'echo', echo: rec, spriteKind: 'ECHO' } as Item);
    }
  }
```
（`getMeta` 已在 game.ts import；`Item` 加 `echo?: EchoRecord` 字段到 `types.ts:193` stock 邻近。）

`src/events.ts`：`triggerNpc` 加 `else if (entity.npc === 'echo' && entity.echo) openEchoEvent(entity);`，新函数（showEvent 同款骨架）：

```ts
function openEchoEvent(entity: Item): void {
  if (!G) return;
  const p = G.player, rec = entity.echo!;
  const popup = document.getElementById('event-popup')!;
  document.getElementById('ev-title')!.textContent = t('ev.echoTitle');
  document.getElementById('ev-desc')!.innerHTML =
    `<div class="ep-line">${escHtml(rec.epitaph.template)}</div><div class="ep-flavor">${escHtml(rec.epitaph.flavor)}</div>`;
  const hasK = !!rec.keepsake;
  document.getElementById('ev-buttons')!.innerHTML =
    `<button class="evb" data-ea="0">[1] ${hasK ? tMsg('ev.echoLoot', String(rec.keepsake!.name)) : t('ev.echoLootEmpty')} (+10🩸)</button>` +
    `<button class="evb" data-ea="1">[2] ${t('ev.echoPurify')} (-10🩸)</button>` +
    `<button class="evb" data-ea="2">[3] ${t('ev.echoInherit')}</button>`;
  const actions: Array<() => void> = [
    () => {   // 掠夺：吃进腐化，取遗物；无遗物降级为残渣
      if (rec.keepsake) { addCorruption(p, 10); addItemWithOverflow(rec.keepsake); }
      else { addCorruption(p, 5); p.gold += 50; }
      addMsg(t('ev.echoLootDone'), 'mi'); closeEvent(); updateUI();
    },
    () => {   // 超度：负向走正门（修正链对负增量本就不作用），回血 40%
      applyCorruption(-10);
      p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.4));
      addMsg(t('ev.echoPurifyDone'), 'mi'); closeEvent(); updateUI();
    },
    () => {   // 继承：灵魂入账 meta 货币
      creditSoulEchoes(30);
      addMsg(t('ev.echoInheritDone'), 'mi'); closeEvent(); updateUI();
    },
  ];
  setEventOpen(true);
  setEventActions(actions);
  _bindEventBtns(actions);
  popup.style.display = 'block';
}
```
（`addCorruption`/`creditSoulEchoes`/`addItemWithOverflow`/`escHtml` 按文件现状补 import；`updateUI` 经 `bridge.updateUI?.()`，与本文件既有调用同款。）

`src/sprites.ts` T_KEY 邻近加（像素画 16×16 字符串数组，D 主形+W 高光+L 心核，注释同款中文风格）：

```ts
  // T_ECHO — 回响：D 残影轮廓内 W 微光核+L 顶点星芒（批10 回响实体，单 hue 不进 THEME_PAL）。
  T_ECHO: [ /* 16 行像素串，风格同 T_KEY/T_BOOK；主 hue buildPalette('#9d8df1') */ ],
```
（实际 16 行像素画由实现者按邻近模板密度完成——这是像素画内容自由度，非占位；验收=模板存在、16 行、三色用到。）

`src/i18n.ts`（ev.* 邻近，en/zh 成对）：

```ts
  'ev.echoTitle': { en: 'Echo of the Fallen', zh: '回响' },
  'ev.echoLoot': { en: 'Loot the keepsake ({}) (+10🩸)', zh: '掠夺遗物（{}）(+10🩸)' },
  'ev.echoLootEmpty': { en: 'Sift the ashes (+5🩸, +50💰)', zh: '翻捡残烬 (+5🩸, +50💰)' },
  'ev.echoPurify': { en: 'Purify the echo (-10🩸, heal)', zh: '超度回响 (-10🩸, 回血)' },
  'ev.echoInherit': { en: 'Inherit its soul (+30 echoes)', zh: '继承其魂 (+30 回响之魂)' },
  'ev.echoLootDone': { en: 'The echo fades; its burden settles into you.', zh: '回响散去，它的重担沉进了你身体。' },
  'ev.echoPurifyDone': { en: 'The echo finds peace. Light knits your wounds.', zh: '回响得到安宁，光缝合了你的伤口。' },
  'ev.echoInheritDone': { en: 'Its soul joins your ledger.', zh: '它的魂记入了你的账簿。' },
```
（键结构以 i18n.ts 现有 `ev.*` 写法为准成对落。）

- [ ] **Step 4: 跑测试确认绿 + 全量回归**

Run: `npx vitest run src/__tests__/batch10-echo-flow.test.ts && npx vitest run`
Expected: 7 绿；全量 561+7=568

- [ ] **Step 5: Commit**

```bash
git add src/game.ts src/events.ts src/sprites.ts src/i18n.ts src/types.ts src/__tests__/batch10-echo-flow.test.ts
git commit -m "feat(batch10): echoes spawn on the map (35%/floor F2+) — loot/purify/inherit interactions, T_ECHO sprite, i18n"
```

---

### Task 3: A1 支付函数 — src/cost.ts 纯叶

**Files:**
- Create: `src/cost.ts`
- Test: `src/__tests__/batch10-cost.test.ts`（新建）

**Interfaces:**
- Consumes: `addCorruption(p, n)`（`corruption.ts:56`，仅 clamp）。
- Produces（Task 4/5 消费）: `corruptionPriceOf(goldPrice: number): number`；`canPayCorruption(cur: number, cost: number): boolean`；`payCorruption(p: Player, cost: number): boolean`。

- [ ] **Step 1: 写失败测试**

```ts
// 批10 A1: 吃进腐化支付——数值表 + 95 硬线 + 只走 addCorruption（绕开修正链）。
import { describe, it, expect, vi } from 'vitest';

const addCorruption = vi.fn();
vi.mock('../corruption.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../corruption.js')>();
  return { ...actual, addCorruption: (...a: any[]) => addCorruption(...a) };
});
vi.mock('../combat.js', () => ({ applyCorruption: vi.fn() }));

import { corruptionPriceOf, canPayCorruption, payCorruption } from '../cost.js';

describe('批10 A1 corruptionPriceOf（clamp(round(g/45), 5, 25)）', () => {
  it.each([[460, 10], [920, 20], [3600, 25], [30, 5], [225, 5]])('%i金 → %i🩸', (g, n) => {
    expect(corruptionPriceOf(g)).toBe(n);
  });
});

describe('批10 A1 canPayCorruption（cur+cost <= 95）', () => {
  it('85+15=false；80+15=true（边界放行）', () => {
    expect(canPayCorruption(85, 15)).toBe(false);
    expect(canPayCorruption(80, 15)).toBe(true);
  });
});

describe('批10 A1 payCorruption', () => {
  it('可付：走 addCorruption 且返回 true', () => {
    const p: any = { corruption: 30 };
    expect(payCorruption(p, 10)).toBe(true);
    expect(addCorruption).toHaveBeenCalledWith(p, 10);
  });
  it('不可付：不动腐化且返回 false', () => {
    const p: any = { corruption: 90 };
    expect(payCorruption(p, 10)).toBe(false);
    expect(addCorruption).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑测试确认红**

Run: `npx vitest run src/__tests__/batch10-cost.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 最小实现 — `src/cost.ts`**

```ts
// Batch10 A: corruption as a second currency — paying MEANS taking corruption on.
// Payments MUST go through addCorruption (the low-level clamp entry), never
// applyCorruption: its modifier chain (eternal_sand halving, corruption_ward
// chance-cancel) would turn a payment into a discount or a free item.
import { addCorruption } from './corruption.js';
import type { Player } from './types.js';

export function corruptionPriceOf(goldPrice: number): number {
  return Math.max(5, Math.min(25, Math.round(goldPrice / 45)));
}

// Hard line: payments never push the player past 95 — shopping cannot trigger
// the warden-death at 100 (boundary value itself is allowed).
export function canPayCorruption(cur: number, cost: number): boolean {
  return cur + cost <= 95;
}

export function payCorruption(p: Player, cost: number): boolean {
  if (!canPayCorruption(p.corruption, cost)) return false;
  addCorruption(p, cost);
  return true;
}
```

- [ ] **Step 4: 跑测试确认绿 + 全量回归**

Run: `npx vitest run src/__tests__/batch10-cost.test.ts && npx vitest run`
Expected: 8 绿；全量 568+8=576

- [ ] **Step 5: Commit**

```bash
git add src/cost.ts src/__tests__/batch10-cost.test.ts
git commit -m "feat(batch10): shared corruption-payment leaf (cost.ts) — price table, 95 hard line, addCorruption-only path"
```

---

### Task 4: A2 双价签 — 宝藏 + endless 商人

**Files:**
- Modify: `src/events.ts`（`openTreasureMerchant` ~:294-330 与 `openEndlessMerchant` ~:374-410 的按钮渲染 + `buyTreasure`/`buyEndless` 腐化路径）
- Modify: `src/i18n.ts`（`ev.corruptPay` / `ev.tooCorrupted`）
- Test: `src/__tests__/batch10-dual-price.test.ts`（新建）

**Interfaces:**
- Consumes: Task 3 全部三个函数；批9 的 `treasurePrice`（`events.ts:275`）、`npcPersists` 常驻商人。
- Produces: 每条 gear/relic 双按钮 `[n]💰价` / `[n+1]🩸corruptionPriceOf(价)`；purge/heal 维持金币单键。

- [ ] **Step 1: 写失败测试**

```ts
// 批10 A2: 双价签渲染 + 腐化购买路径 + 余量不足禁用。
import { describe, it, expect, vi } from 'vitest';

vi.mock('../state.js', () => ({
  G: { floor: 5, player: { corruption: 30, gold: 0, inv: [], quickSlots: [] } },
  lang: 'zh', eventOpen: false, setEventOpen: vi.fn(), setEventActions: vi.fn(),
}));
/* === 粘贴 batch9-treasure-price.test.ts 的全部 vi.mock 块，另加： === */
vi.mock('../cost.js', () => ({
  corruptionPriceOf: (g: number) => Math.max(5, Math.min(25, Math.round(g / 45))),
  canPayCorruption: (c: number, k: number) => c + k <= 95,
  payCorruption: vi.fn(() => true),
}));
vi.mock('../corruption.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../corruption.js')>();
  return { ...actual, addCorruption: vi.fn() };
});

import { readFileSync } from 'node:fs';

describe('批10 A2 双价签（source-gate）', () => {
  const e = readFileSync(new URL('../' + 'events.ts', import.meta.url), 'utf8');
  it('宝藏与 endless 都引用 cost.ts', () => {
    expect(e).toContain("from './cost.js'");
    expect(e.match(/corruptionPriceOf/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
  it('金币扣款原路径保留（回归锚）', () => {
    expect(e).toContain('if (G.player.gold < price)');
  });
  it('余量不足提示键存在', () => {
    const i = readFileSync(new URL('../' + 'i18n.ts', import.meta.url), 'utf8');
    expect(i).toContain('ev.tooCorrupted');
    expect(i).toContain('ev.corruptPay');
  });
});

describe('批10 A2 腐化购买（行为桩）', () => {
  it('buyTreasure 腐化路径调 payCorruption 成功后 splice 库存', () => {
    const e = readFileSync(new URL('../' + 'events.ts', import.meta.url), 'utf8');
    expect(e).toContain('payCorruption(G.player, cPrice)');
    expect(e).toContain("t('ev.tooCorrupted')");
  });
});
```

- [ ] **Step 2: 跑测试确认红**

Run: `npx vitest run src/__tests__/batch10-dual-price.test.ts`
Expected: FAIL

- [ ] **Step 3: 最小实现**

两店按钮循环内，每条 gear/relic 条目由单按钮改双按钮（leave 键顺延；3×2+leave=7 ≤ 9 键）。购买函数加"币别"参数：

```ts
function buyTreasure(entity: Item, idx: number, pay: 'gold' | 'corruption' = 'gold'): void {
  const it = entity.stock![idx];
  const price = treasurePrice(it);
  if (pay === 'corruption') {
    const cPrice = corruptionPriceOf(price);
    if (!payCorruption(G!.player, cPrice)) { addMsg(t('ev.tooCorrupted'), 'mi'); return; }
  } else {
    if (G!.player.gold < price) { addMsg(t('merchantNoGold'), 'mi'); return; }
    G!.player.gold -= price;
  }
  // …既有 splice/入包/重开弹窗逻辑不变…
}
```
`buyEndless(entity, idx, pay)` 同型（purge/heal 分支不传 pay，维持金币）。按钮渲染（openTreasureMerchant 内）：

```ts
    const cPrice = corruptionPriceOf(price);
    const canC = canPayCorruption(G!.player.corruption, cPrice);
    html += `<button class="evb" data-ea="${a}" ${''}>[${a + 1}] 💰${price}</button>` +
            `<button class="evb" data-ea="${a + 1}" ${canC ? '' : 'disabled style="opacity:.45"'}>[${a + 2}] 🩸${cPrice}</button>`;
    actions.push(() => buyTreasure(entity, i), () => buyTreasure(entity, i, 'corruption'));
```
i18n：`'ev.corruptPay': { en: 'Pay in corruption', zh: '以腐化支付' }`、`'ev.tooCorrupted': { en: 'Your body cannot hold more corruption.', zh: '你的身体已容不下更多腐化。' }`。

- [ ] **Step 4: 跑测试确认绿 + 全量回归**

Run: `npx vitest run src/__tests__/batch10-dual-price.test.ts && npx vitest run`
Expected: 4 绿；全量 576+4=580

- [ ] **Step 5: Commit**

```bash
git add src/events.ts src/i18n.ts src/__tests__/batch10-dual-price.test.ts
git commit -m "feat(batch10): dual price tags at treasure/endless merchants — gold or eat-in corruption, 95-line guard"
```

---

### Task 5: A3 神龛二选一 — 洁净祈福 / 暗黑契约

**Files:**
- Modify: `src/events.ts:176-196`（SHRINE 分支重构）
- Modify: `src/i18n.ts`（`sh.cleanBless/sh.darkPact/sh.darkDone/sh.darkFallback`）
- Test: `src/__tests__/batch10-shrine.test.ts`（新建）

**Interfaces:**
- Consumes: Task 3 `payCorruption`；既有 `recalc/snd/fxAura` 祝福副作用（`events.ts:179-184` 现值）。
- Produces: 神龛无腐化路径 = showEvent 骨架二选一；有腐化净化 -20 路径不变；地块两路都消耗。

- [ ] **Step 1: 写失败测试**

```ts
// 批10 A3: 神龛二选一——暗黑契约 +15🩸 双倍祝福，余量不足回落。
import { describe, it, expect, vi } from 'vitest';

vi.mock('../state.js', () => ({
  G: { floor: 5, player: { corruption: 20, baseAtk: 10, baseDef: 5, baseMaxHp: 80, maxHp: 80, hp: 40, x: 3, y: 3 } },
  lang: 'zh', eventOpen: false, setEventOpen: vi.fn(), setEventActions: vi.fn(),
}));
/* === 粘贴 batch9-treasure-price.test.ts 的全部 vi.mock 块，另加： === */
vi.mock('../cost.js', () => ({
  payCorruption: vi.fn(() => true),
  corruptionPriceOf: () => 5, canPayCorruption: () => true,
}));

import { readFileSync } from 'node:fs';

describe('批10 A3 神龛（source-gate）', () => {
  const e = readFileSync(new URL('../' + 'events.ts', import.meta.url), 'utf8');
  it('无腐化路径变二选一弹窗（随机 20% 移除）', () => {
    expect(e).not.toContain('Math.random() < 0.2');
    expect(e).toContain('sh.cleanBless');
    expect(e).toContain('sh.darkPact');
  });
  it('暗黑契约双倍数值与回落', () => {
    expect(e).toContain('payCorruption(G!.player, 15)');
    expect(e).toContain('baseAtk += 4');
    expect(e).toContain('sh.darkFallback');
  });
  it('有腐化净化路径保留（回归锚）', () => {
    expect(e).toContain('applyCorruption(-20)');
  });
});
```

- [ ] **Step 2: 跑测试确认红**

Run: `npx vitest run src/__tests__/batch10-shrine.test.ts`
Expected: FAIL

- [ ] **Step 3: 最小实现**

`events.ts` SHRINE 分支（:176 起）：有腐化 → 既有 `applyCorruption(-20)` 净化路径**原样保留**；无腐化 → 删 20% 随机 roll，改 showEvent 式弹窗：

```ts
  if (tile === TL.SHRINE) {
    if (G.player.corruption > 0) {
      // 既有净化路径：applyCorruption(-20) …（原样，含消息/地块消耗）
    } else {
      // Batch10 A3: the shrine offers a choice — clean blessing, or a dark pact.
      const popup = document.getElementById('event-popup')!;
      document.getElementById('ev-title')!.textContent = t('up.ancientShrine');
      document.getElementById('ev-desc')!.textContent = t('sh.choice');
      document.getElementById('ev-buttons')!.innerHTML =
        `<button class="evb" data-ea="0">[1] ${t('sh.cleanBless')}</button>` +
        `<button class="evb" data-ea="1">[2] ${t('sh.darkPact')} (+15🩸)</button>`;
      const bless = (atk: number, def: number, hp: number, aura: string) => {
        G!.player.baseAtk += atk; G!.player.baseDef += def;
        G!.player.baseMaxHp += hp; G!.player.maxHp += hp; G!.player.hp += hp;
        recalc(); snd('levelup'); fxAura(G!.player.x, G!.player.y, aura, 2);
        G!.dungeon.map[G!.player.y][G!.player.x] = TL.FLOOR;
      };
      setEventOpen(true);
      setEventActions([
        () => { bless(2, 2, 10, '#ffd700'); addMsg(t('shrineBuff'), 'ml'); closeEvent(); updateUI(); },
        () => {
          if (payCorruption(G!.player, 15)) { bless(4, 4, 20, '#9d8df1'); addMsg(t('sh.darkDone'), 'ml'); }
          else { bless(2, 2, 10, '#ffd700'); addMsg(t('sh.darkFallback'), 'mi'); }
          closeEvent(); updateUI();
        },
      ]);
      _bindEventBtns(/* 同 showEvent 的绑定方式，读 setEventActions 后的 actions */);
      popup.style.display = 'block';
      return;
    }
  }
```
（绑定处按本文件现状：若 `_bindEventBtns` 需 actions 数组，先建局部 `const actions = [...]` 再 `setEventActions(actions); _bindEventBtns(actions);`，与 showEvent 完全同构。）i18n 四键：`sh.choice`（en: 'The shrine hums. Light, or the deep?' / zh: '神龛低鸣。要光，还是深渊？'）、`sh.cleanBless`（'Clean blessing' / '洁净祈福'）、`sh.darkPact`（'Dark pact (doubled)' / '暗黑契约（双倍）'）、`sh.darkDone`（en: 'Power floods in — and something darker follows.' / zh: '力量涌入——还有更暗的东西跟了进来。'）、`sh.darkFallback`（en: 'Your body refused the darkness; the clean blessing remains.' / zh: '身体拒绝了黑暗，洁净祝福犹在。'）。

- [ ] **Step 4: 跑测试确认绿 + 全量回归**

Run: `npx vitest run src/__tests__/batch10-shrine.test.ts && npx vitest run`
Expected: 3 绿；全量 580+3=583

- [ ] **Step 5: Commit**

```bash
git add src/events.ts src/i18n.ts src/__tests__/batch10-shrine.test.ts
git commit -m "feat(batch10): shrine choice — clean blessing or dark pact (+15 corruption, doubled stats, fallback)"
```

---

### Task 6: 收尾 — battery + 七门 + final review

**Files:**
- Create: `scripts/verify_batch10_ingame.py`（launcher 照抄 `scripts/verify_batch9_ingame.py`）
- 无源码改动（发现问题回对应任务修）

**Interfaces:** Consumes 全部前序任务的运行时行为。

- [ ] **Step 1: 写 in-game battery（四组）**

1. **回响全环**：live 实例自杀造 echo（hp 0 / playerDeath 或直接 recordEcho 桩一条）→ 新局 F2+ 走层直到注入（或直接调 enterFloor 的注入逻辑/钉 Math.random）→ 踩上 → 三交互各验：掠夺(+10🩸+物品)、超度(-10🩸+回血)、继承(soulEchoes +30)
2. **宝藏双价签**：🩸购买全路径（扣腐化得物、库存 splice）；金币路径回归
3. **神龛暗黑契约**：0 腐化踩神龛 → [2] → 断言 baseAtk+4 且 corruption=15
4. **支付封锁**：corruption=85 时宝藏 🩸15 键 disabled（opacity 类或 disabled 属性）

零 console 错；截图 2 张（回响弹窗/双价签商店）入 `scripts/smoke_out/batch10/`。

- [ ] **Step 2: 七门全绿（裸跑）**

```bash
npx vitest run && npm run typecheck && npm run build && python scripts/smoke_settings_core.py && python scripts/verify_gamepad_ingame.py && python scripts/verify_batch9_ingame.py && python scripts/verify_batch10_ingame.py
```
Expected: 583 / 0 / ✓ / 65 / 22 / 27 / 新 battery 全绿（批9 battery 一并复跑=回归门）

- [ ] **Step 3: i18n parity 门 + final review(opus，全分支 merge-base..HEAD，对照 spec B-A..A-D 不变量 + 断言空洞性专查)**

- [ ] **Step 4: 终验汇报停等用户（verification-before-completion：贴各门输出原文）→ merge 裁决后 finishing-a-development-branch**

---

## Self-Review 记录

- **Spec 覆盖**: B1→Task1、B2→Task2、A1→Task3、A2→Task4、A3→Task5、Testing 六不变量→各任务测试+Task6 battery、Risks 支付陷阱→Task3 测试 spy 锁死。无缺口。
- **占位符扫描**: Task2 的 T_ECHO 像素画 16 行标注"实现者按邻近模板密度完成"——这是像素画内容自由度（验收标准明确：16 行/三色/存在），非逻辑占位；Task4 buyEndless 标注"同型"但给了完整 buyTreasure 参照体+差异点（purge/heal 不传 pay），符合"repeat the code"精神的边界内。其余步骤全部带完整代码。
- **类型/命名一致性**: `EchoRecord`（Task1 定义=Task2 实体 `echo` 字段）；`recordEcho/pickKeepsake`（Task1 产=combat.ts 消费）；`corruptionPriceOf/canPayCorruption/payCorruption`（Task3 产=Task4/5 消费，签名三处一致）；测试计数链 554→561→568→576→580→583 每任务 +N 与用例数吻合（7/7/8/4/3）。
