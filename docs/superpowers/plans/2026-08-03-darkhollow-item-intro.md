# 道具图鉴介绍系统（首次拾取弹窗）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 玩家首次拾取任意道具/圣物时弹出介绍卡片（暂停游戏），并把"已发现"沉淀为跨局道具图鉴；第二次及以后不再弹。

**Architecture:** 复用现有 overlay 弹窗系统 + `MetaSave` 的幂等解锁范式（仿 `unlockLore`）。新增 `MetaSave.discoveredItems` 跨局持久化、`item-intro.ts` 弹窗模块（卡片渲染 + 多件拾取队列）、目录 `id`+`flavor` 双语字段。两个拾取入口（`addItemWithOverflow` / `grantRelic`）接线触发。Codex 加"道具图鉴"tab。

**Tech Stack:** TypeScript（strict，ESM `.js` import 扩展名）、Vite、vitest + happy-dom、Canvas+DOM 混合渲染、`localStorage` 持久化。

## Global Constraints

- **基线 commit**：`main @ 475c716d`。在 main 上开 feature 分支 `feat/item-intro` 实现，全部完成后 fast-forward merge 回 main（仿项目惯例）。
- **TS strict / ESM**：所有 import 必须带 `.js` 扩展名（如 `from './state.js'`）。类型严格，禁用 `any`（已有 `as any` 例外仅限 bridge/DOM 边界）。
- **i18n 规范**：新增文案一律双语 `{ en, zh }`，dotted 前缀：弹窗用 `intro.*`、设置开关用 `opt.intro*`、图鉴用 `codex.tab*`/`codex.item*`。helper：`t(key)` 查表、`tMsg(key, ...args)` 占位插值、`tx(I18nText)` 本地化数据字段。新 key 加在 `src/i18n.ts` 的 `L` 对象内。
- **目录 id 规范**：snake_case 语义化（如 `iron_sword`、`heal_potion`、`war_totem`），全表唯一（integrity 测试守卫）。
- **向后兼容**：`Item.id` 设为可选；旧存档 Item 无 id 不影响（已持有道具不再触发首次）。`MetaSave.discoveredItems` 在 `getMeta` 迁移补全。
- **测试范式**：vitest，mock 见 `src/__tests__/codex.test.ts`（`vi.mock('../data.js', ...)` / `vi.mock('../state.js', ...)` / `beforeEach(() => localStorage.clear())`）。运行：`npx vitest run`（全量）或 `npx vitest run path/to/test.ts`。
- **不动子系统 B**：本 plan 只做道具图鉴介绍系统。设置面板全面优化另开。

---

## File Structure

| 文件 | 责任 | 动作 |
|---|---|---|
| `src/types.ts` | `MetaSave`、目录类型、`Item`、`RelicDef` 类型 | Modify |
| `src/meta.ts` | `discoverItem` 幂等 + 迁移 | Modify |
| `src/data.ts` | 122 条目补 `id`+`flavor` | Modify（subagent 批量） |
| `src/item-gen.ts` | 7 个 gen 函数赋 `Item.id` | Modify |
| `src/state.ts` | `introOpen` flag + `introEnabled` 持久化 | Modify |
| `src/item-intro.ts` | 弹窗模块：卡片渲染 + 队列 + queue/close | **Create** |
| `src/input.ts` | `introOpen` 拦截 + `closeActiveOverlay` + pollGamepad | Modify |
| `src/items.ts` | `addItemWithOverflow` 五路径接线 | Modify |
| `src/relics.ts` | `grantRelic` 接线 | Modify |
| `src/options.ts` | Gameplay tab「首次拾取提示」开关 | Modify |
| `src/ui-panels.ts` | `renderCodex` 加道具图鉴 tab | Modify |
| `index.html` | `#item-intro-overlay` DOM | Modify |
| `src/i18n.ts` | `intro.*` / `opt.intro*` / `codex.tab*` key | Modify |
| `src/__tests__/item-intro.test.ts` | discoverItem/队列/边界单测 | **Create** |
| `src/__tests__/item-data-integrity.test.ts` | 目录 id 唯一 + flavor 双语 | **Create** |

---

## Task 1: MetaSave.discoveredItems + discoverItem 幂等函数

**Files:**
- Modify: `src/types.ts:559-570`（`MetaSave` 接口）
- Modify: `src/meta.ts:20-28`（`initMeta`）、`src/meta.ts:42-43`（`getMeta` 迁移）、`src/meta.ts:236` 后（新增 `discoverItem`）
- Test: `src/__tests__/item-intro.test.ts`（Create）

**Interfaces:**
- Produces: `discoverItem(key: string): boolean` —— 首次返回 `true` 并 `saveMeta`，已存在返回 `false`。`MetaSave.discoveredItems: string[]`。

- [ ] **Step 1: 写失败测试**（Create `src/__tests__/item-intro.test.ts`）

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../data.js', () => ({ META_UPGRADES: [], ACH_DEFS: [], RELICS: [] }));
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../state.js', () => ({ lang: 'en' }));

import { initMeta, getMeta, discoverItem } from '../meta.js';

beforeEach(() => localStorage.clear());

describe('discoverItem', () => {
  it('returns true on first discovery and persists', () => {
    expect(discoverItem('weapon:iron_sword')).toBe(true);
    expect(getMeta().discoveredItems).toContain('weapon:iron_sword');
  });
  it('returns false on repeat (idempotent, no dup)', () => {
    expect(discoverItem('relic:war_totem')).toBe(true);
    expect(discoverItem('relic:war_totem')).toBe(false);
    expect(getMeta().discoveredItems.filter(k => k === 'relic:war_totem')).toHaveLength(1);
  });
  it('old meta without discoveredItems migrates to []', () => {
    localStorage.setItem('dh_meta', JSON.stringify({
      version: 1, soulEchoes: 0, totalSpent: 0, upgrades: {}, achievements: [],
      stats: {}, runHistory: [], endlessLeaderboard: [], unlockedLore: [], wardens: [],
    }));
    expect(getMeta().discoveredItems).toEqual([]);
  });
  it('initMeta seeds discoveredItems as []', () => {
    expect(initMeta().discoveredItems).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑测试验证失败**

Run: `cd /e/claude/darkhollow && npx vitest run src/__tests__/item-intro.test.ts`
Expected: FAIL —— `discoverItem is not a function` / `discoveredItems` 不存在。

- [ ] **Step 3: 加 MetaSave 字段**（Modify `src/types.ts`，在 `unlockedLore: string[];` 后、`wardens` 前）

```ts
  unlockedLore: string[];
  discoveredItems: string[];
  wardens: WardenLegacy[];
```

- [ ] **Step 4: initMeta 种子 + getMeta 迁移**（Modify `src/meta.ts`）

`initMeta`（L20-28）在 `unlockedLore: [],` 后加：
```ts
    unlockedLore: [],
    discoveredItems: [],
    wardens: [],
```
`getMeta`（L42 `if (!m.unlockedLore) m.unlockedLore = [];` 后）加：
```ts
      if (!m.discoveredItems) m.discoveredItems = [];
```

- [ ] **Step 5: 实现 discoverItem**（Modify `src/meta.ts`，在 `unlockLore` 函数 L236 后）

```ts
// Record a discovered item/relic for the Item Codex + first-pickup intro popup.
// Returns true the first time a key is seen (caller uses this to decide whether
// to show the intro card), false on repeats. Idempotent + persisted to dh_meta.
export function discoverItem(key: string): boolean {
  const meta = getMeta();
  if (!meta.discoveredItems.includes(key)) {
    meta.discoveredItems.push(key);
    saveMeta(meta);
    return true;
  }
  return false;
}
```

- [ ] **Step 6: 跑测试验证通过**

Run: `cd /e/claude/darkhollow && npx vitest run src/__tests__/item-intro.test.ts`
Expected: 4 PASS。

- [ ] **Step 7: 全量测试确认无回归**

Run: `cd /e/claude/darkhollow && npx vitest run`
Expected: 全绿（`codex.test.ts` 等旧测试因 MetaSave 新字段可选 + 迁移而不受影响）。

- [ ] **Step 8: Commit**

```bash
cd /e/claude/darkhollow && git checkout -b feat/item-intro
git add src/types.ts src/meta.ts src/__tests__/item-intro.test.ts
git commit -m "feat(item-intro): add MetaSave.discoveredItems + idempotent discoverItem"
```

---

## Task 2: 类型字段铺路（目录 id/flavor、Item.id、RelicDef.flavor）

**Files:**
- Modify: `src/types.ts:59-123`（7 个目录类型）、`src/types.ts:160`（`Item.id`）、`src/types.ts:508-517`（`RelicDef`）

**Interfaces:**
- Produces: 目录类型可选 `id?: string` + `flavor?: I18nText`；`Item.id?: string`（替换原 `id?: boolean` 死代码）；`RelicDef.flavor?: I18nText`。后续 Task 3 填 data、Task 4 由 item-gen 读取。

- [ ] **Step 1: 确认 `Item.id?: boolean` 是死代码**

Run: `cd /e/claude/darkhollow && grep -rn "\.id\b" src/ | grep -v "RELICS\|AREAS\|ACH_DEFS\|EQUIPMENT_SETS\|LORE_\|META_UPGRADES\|area\.id\|pick\.id\|setDef\|\.id ===\|def\.id\|r\.id\|a\.id\|s\.id\|u\.id\|node\.id\|c\.id\|e\.id\|btn\|tab\|dataset\|getElementById\|char-sel\|ov\.id"`
Expected: 无输出 —— 证实运行时 `Item` 实例无人访问 `.id`，原 `id?: boolean` 是死代码。

- [ ] **Step 2: 给 7 个目录类型加可选 id + flavor**（Modify `src/types.ts`）

在 `WeaponDef`、`ArmorDef`、`AccessoryDef`、`PotionDef`、`ScrollDef`、`ConsumableDef`、`FoodDef` 每个接口内加两行（放在 `n: I18nText;` 后）：
```ts
  id?: string;
  flavor?: I18nText;
```

- [ ] **Step 3: 替换 Item.id 死代码字段**（Modify `src/types.ts:160`）

把：
```ts
  // runtime
  id?: boolean;
```
改为：
```ts
  // catalog id — matches the def.id the item was generated from; used as the
  // Item Codex / first-pickup key (stable across languages, unlike `name`).
  id?: string;
```

- [ ] **Step 4: RelicDef 加可选 flavor**（Modify `src/types.ts:508-517`，在 `value: number;` 后）

```ts
  value: number;    // effect magnitude
  flavor?: I18nText; // lore blurb for the intro card / codex (separate from effect `d`)
```

- [ ] **Step 5: tsc 编译验证**

Run: `cd /e/claude/darkhollow && npx tsc --noEmit`
Expected: 0 error（字段全可选，不破坏 data.ts 现有条目）。

- [ ] **Step 6: Commit**

```bash
cd /e/claude/darkhollow && git add src/types.ts
git commit -m "refactor(item-intro): add id/flavor fields to catalog types, fix Item.id type"
```

---

## Task 3: data.ts 补 id + flavor（subagent 并行）+ integrity 测试

**Files:**
- Modify: `src/data.ts`（`ALL_WEAPONS`/`ALL_ARMORS`/`ALL_ACCESSORIES`/`ALL_POTIONS`/`ALL_SCROLLS`/`ALL_CONSUMABLES`/`FOODS`/`ENDLESS_GEAR`/`RELICS` 共 ~122 条目）
- Test: `src/__tests__/item-data-integrity.test.ts`（Create）

**Interfaces:**
- Produces: 全表目录条目含唯一非空 `id` + 双语非空 `flavor`；圣物含 `flavor`。

> **执行方式**：本任务用 subagent 并行生成文本，主 agent 收口回填 `data.ts`。flavor 风格指南见 spec §A1-4。分波：圣物 28（pilot）→ 武器 26+护甲 16 → 饰品 14+药水 12+卷轴 9 → 消耗品 13+食物 4。每波 ≤3 并发，波间留间隔。subagent 只产出结构化补丁，不直接改 `data.ts`。

- [ ] **Step 1: 写 integrity 失败测试**（Create `src/__tests__/item-data-integrity.test.ts`）

```ts
import { describe, it, expect, vi } from 'vitest';
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../state.js', () => ({ lang: 'en' }));

import {
  ALL_WEAPONS, ALL_ARMORS, ALL_ACCESSORIES, ALL_POTIONS, ALL_SCROLLS,
  ALL_CONSUMABLES, FOODS, ENDLESS_GEAR, RELICS,
} from '../data.js';

const ALL = [
  ...['weapon', ALL_WEAPONS] as const,
].flatMap(([t, arr]) => arr.map(d => ({ type: t, id: d.id, flavor: (d as any).flavor })));

describe('catalog id + flavor integrity', () => {
  it('every catalog entry has a non-empty unique id', () => {
    const tables: Record<string, { id?: string }[]> = {
      weapon: ALL_WEAPONS, armor: ALL_ARMORS, accessory: ALL_ACCESSORIES,
      potion: ALL_POTIONS, scroll: ALL_SCROLLS, consumable: ALL_CONSUMABLES,
      food: FOODS,
    };
    for (const [_, arr] of Object.entries(tables)) {
      for (const d of arr) expect(d.id, `${_} missing id`).toBeTruthy();
    }
    // endless gear + relics
    for (const d of [...ENDLESS_GEAR.weapons, ...ENDLESS_GEAR.armors, ...ENDLESS_GEAR.accessories])
      expect(d.id).toBeTruthy();
    for (const r of RELICS) expect(r.id).toBeTruthy(); // relics already have id
    // global uniqueness
    const ids = [
      ...Object.values(tables).flat().map(d => d.id),
      ...[...ENDLESS_GEAR.weapons, ...ENDLESS_GEAR.armors, ...ENDLESS_GEAR.accessories].map(d => d.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('every catalog entry + relic has bilingual non-empty flavor', () => {
    const tables: { flavor?: { en: string; zh: string } }[][] = [
      ALL_WEAPONS, ALL_ARMORS, ALL_ACCESSORIES, ALL_POTIONS, ALL_SCROLLS, ALL_CONSUMABLES, FOODS,
      [...ENDLESS_GEAR.weapons, ...ENDLESS_GEAR.armors, ...ENDLESS_GEAR.accessories],
    ];
    for (const arr of tables) for (const d of arr) {
      expect(d.flavor, 'missing flavor').toBeDefined();
      expect(typeof d.flavor!.en).toBe('string');
      expect(d.flavor!.en.length).toBeGreaterThan(0);
      expect(typeof d.flavor!.zh).toBe('string');
      expect(d.flavor!.zh.length).toBeGreaterThan(0);
    }
    for (const r of RELICS) {
      expect(r.flavor, 'relic missing flavor').toBeDefined();
      expect(r.flavor!.en.length).toBeGreaterThan(0);
      expect(r.flavor!.zh.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: 跑测试验证失败**

Run: `cd /e/claude/darkhollow && npx vitest run src/__tests__/item-data-integrity.test.ts`
Expected: FAIL —— `missing id` / `missing flavor`（data.ts 尚未填）。

- [ ] **Step 3: 派 subagent 生成 flavor + id（按波）**

对每波，派 subagent（≤3 并发），prompt 模板：
> "读取 `E:\claude\darkhollow\src\data.ts` 的 `<类别>` 数组（共 N 条）。为每条生成：(1) 唯一 snake_case `id`（语义化，如 `iron_sword`）；(2) 双语 `flavor: { en, zh }` 背景句。**风格**：契合 darkhollow（深渊/守渊人/腐化/永恒/灵魂余响），冷峻克制带神秘，禁止搞笑出戏；1-2 句，zh 25-55 汉字、en 12-28 词；写背景氛围，**禁止重复属性**（属性由卡片展示）。锚定示例：武器 `iron_sword` zh「铁匠铺里最廉价的制式剑，握柄上的锈迹诉说着无数失意者的下山之路。」en「The cheapest issue from the forge; rust on its grip tells of countless failed descents.」**只输出 JSON 数组** `[{"idx":0,"id":"...","flavor":{"en":"...","zh":"..."}}]`，按原数组顺序，不要改 data.ts。"
- 波 1（pilot）：RELICS 28（含 id 已有，只补 flavor；让 subagent 复核 effect `d` 与 flavor 不冲突）。
- 波 2：ALL_WEAPONS 26 + ALL_ARMORS 16。
- 波 3：ALL_ACCESSORIES 14 + ALL_POTIONS 12 + ALL_SCROLLS 9。
- 波 4：ALL_CONSUMABLES 13 + FOODS 4 + ENDLESS_GEAR（武器3/护甲3/饰品2）。

- [ ] **Step 4: 主 agent 收口回填 data.ts**

校验每个 subagent 产出（风格/长度/禁忌/双语完整/id 唯一），逐类别把 `id` + `flavor` 字段回填到 `data.ts` 对应数组条目。圣物只加 `flavor`（id 已存在）。

- [ ] **Step 5: 跑 integrity 测试验证通过**

Run: `cd /e/claude/darkhollow && npx vitest run src/__tests__/item-data-integrity.test.ts`
Expected: 2 PASS。

- [ ] **Step 6: tsc + 全量测试**

Run: `cd /e/claude/darkhollow && npx tsc --noEmit && npx vitest run`
Expected: 0 error + 全绿。

- [ ] **Step 7: Commit**

```bash
cd /e/claude/darkhollow && git add src/data.ts src/__tests__/item-data-integrity.test.ts
git commit -m "feat(item-intro): add bilingual id+flavor to all catalog entries"
```

---

## Task 4: item-gen 7 个 gen 函数赋 Item.id

**Files:**
- Modify: `src/item-gen.ts:40,50,57,73,90,102,123`（genWeapon/genArmor/genAcc/genPotion/genScroll/genFood/genConsumable 的返回对象）、`src/item-gen.ts:147,151,154`（genEndlessGear 三分支）
- Test: 扩展 `src/__tests__/item-intro.test.ts`

**Interfaces:**
- Consumes: 目录类型 `id`（Task 2/3）。
- Produces: 运行时 `Item.id` 等于生成它的 `def.id`，作为图鉴 key 的一部分。

- [ ] **Step 1: 加 item-gen 测试**（追加到 `src/__tests__/item-intro.test.ts`）

```ts
import { genWeapon, genPotion, genFood } from '../item-gen.js';
import { ALL_WEAPONS, ALL_POTIONS, FOODS } from '../data.js';

describe('item-gen assigns def.id', () => {
  it('genWeapon carries the def id', () => {
    const it = genWeapon(1);
    const def = ALL_WEAPONS.find(w => w.id === it.id);
    expect(def).toBeTruthy();
  });
  it('genPotion carries the def id', () => {
    const it = genPotion(1);
    const def = ALL_POTIONS.find(p => p.id === it.id);
    expect(def).toBeTruthy();
  });
  it('genFood carries the def id', () => {
    const it = genFood(1);
    const def = FOODS.find(f => f.id === it.id);
    expect(def).toBeTruthy();
  });
});
```

- [ ] **Step 2: 跑测试验证失败**

Run: `cd /e/claude/darkhollow && npx vitest run src/__tests__/item-intro.test.ts`
Expected: 新 3 条 FAIL（`it.id` undefined）。

- [ ] **Step 3: 7 个 gen 函数返回对象加 `id: b.id`**

- `genWeapon`（L40）：对象加 `id: b.id,`（在 `type: 'weapon',` 后）
- `genArmor`（L50）：加 `id: b.id,`
- `genAcc`（L57）：加 `id: b.id,`
- `genPotion`（L73）：加 `id: b.id,`
- `genScroll`（L90）：加 `id: b.id,`
- `genFood`（L102）：加 `id: b.id,`
- `genConsumable`（L123）：加 `id: b.id,`
- `genEndlessGear`（L147/151/154 三分支）：各加 `id: b.id,`

- [ ] **Step 4: 跑测试验证通过**

Run: `cd /e/claude/darkhollow && npx vitest run src/__tests__/item-intro.test.ts`
Expected: 全 PASS。

- [ ] **Step 5: 全量测试 + tsc**

Run: `cd /e/claude/darkhollow && npx tsc --noEmit && npx vitest run`
Expected: 全绿。

- [ ] **Step 6: Commit**

```bash
cd /e/claude/darkhollow && git add src/item-gen.ts src/__tests__/item-intro.test.ts
git commit -m "feat(item-intro): gen functions carry def.id onto runtime Item"
```

---

## Task 5: state introOpen flag + introEnabled 持久化

**Files:**
- Modify: `src/state.ts`（flag 区 L26-40 加 `introOpen`；持久化区仿 `barCues` L95-96 加 `introEnabled`）

**Interfaces:**
- Produces: `introOpen: boolean` + `setIntroOpen(v)`（瞬时，不持久化）；`introEnabled: boolean`（默认 on）+ `setIntroEnabled(v)`（持久化 `dh_intro_enabled`）。

- [ ] **Step 1: 加 introOpen flag**（Modify `src/state.ts`，在 `eventActions` 行 L32 后 + setter 区）

flag（L31 `eventOpen` 附近加）：
```ts
export let introOpen = false;
```
setter（L39 `setEventOpen` 后加）：
```ts
export function setIntroOpen(v: boolean) { introOpen = v; }
```

- [ ] **Step 2: 加 introEnabled 持久化**（Modify `src/state.ts`，仿 `barCues` L95-96，在其后加）

```ts
// First-pickup item intro popup (on by default). When off, pickups still record
// to discoveredItems (codex unaffected) but don't queue the intro card.
export let introEnabled: boolean = localStorage.getItem('dh_intro_enabled') !== '0';
export function setIntroEnabled(v: boolean) { introEnabled = v; localStorage.setItem('dh_intro_enabled', v ? '1' : '0'); }
```

- [ ] **Step 3: 加 i18n key**（Modify `src/i18n.ts` `L` 对象，加在设置相关 key 附近）

```ts
  "opt.introEnabled": { en: "First-Pickup Item Intro", zh: "首次拾取道具介绍" },
  "opt.introEnabledDesc": { en: "Show a card the first time you pick up an item or relic", zh: "首次拾到道具/圣物时弹出介绍卡片" },
```

- [ ] **Step 4: tsc 验证**

Run: `cd /e/claude/darkhollow && npx tsc --noEmit`
Expected: 0 error。

- [ ] **Step 5: Commit**

```bash
cd /e/claude/darkhollow && git add src/state.ts src/i18n.ts
git commit -m "feat(item-intro): add introOpen flag + persisted introEnabled setting"
```

---

## Task 6: index.html overlay DOM + input.ts 拦截

**Files:**
- Modify: `index.html`（在 `codex-overlay` 附近加 `item-intro-overlay`）
- Modify: `src/input.ts:2`（import）、`L16`（gameOver 条件）、`L147-160`（`closeActiveOverlay`）、`L175`（pollGamepad overlay 判断）、新增 introOpen 拦截块
- Modify: `src/main.ts`（import + bind close 按钮）

**Interfaces:**
- Consumes: `introOpen`/`setIntroOpen`（Task 5）、`closeItemIntro`（Task 7，本 task 先用占位 import，Task 7 实现）。
- Produces: `#item-intro-overlay` DOM；introOpen 时键盘/手柄输入被拦截，Esc/手柄B 调 `closeItemIntro`。

- [ ] **Step 1: 加 overlay DOM**（Modify `index.html`，仿 codex-overlay 结构，加在其后）

```html
    <div id="item-intro-overlay" class="overlay">
      <div id="item-intro-panel" class="panel" style="min-width:380px;max-width:480px">
        <button class="close-btn" id="btn-close-intro">✕</button>
        <div id="item-intro-content"></div>
        <div class="intro-hint" id="item-intro-hint" style="text-align:center;color:#777;font-size:.85em;margin-top:10px"></div>
      </div>
    </div>
```

- [ ] **Step 2: input.ts import introOpen**（Modify `src/input.ts:2`）

把 import 行加上 `introOpen`：
```ts
import { G, invOpen, helpOpen, skillOpen, achOpen, talentOpen, eventOpen, eventActions, menuOpen, introOpen } from './state.js';
```
再加 import（顶部）：
```ts
import { closeItemIntro } from './item-intro.js';
```

- [ ] **Step 3: gameOver 条件加 introOpen**（Modify `src/input.ts:16`）

```ts
    if (G && G.gameOver && !invOpen && !helpOpen && !skillOpen && !achOpen && !talentOpen && !eventOpen && !menuOpen && !introOpen) return;
```

- [ ] **Step 4: 加 introOpen 拦截块**（Modify `src/input.ts`，在 pause menu 块 L40 之前、options 块 L35 之后插入）

```ts
    // Item intro card — ESC / B closes it; swallow all other keys while open.
    if (introOpen) {
      if (e.key === 'Escape' || e.key === 'b' || e.key === 'B') { closeItemIntro(); e.preventDefault(); return; }
      e.preventDefault(); return;
    }
```

- [ ] **Step 5: closeActiveOverlay 加 introOpen**（Modify `src/input.ts:148-160`，在 `if (eventOpen)` 前加）

```ts
  if (introOpen) { closeItemIntro(); return true; }
```

- [ ] **Step 6: pollGamepad overlay 判断加 introOpen**（Modify `src/input.ts:175`）

```ts
  const overlay = invOpen || skillOpen || talentOpen || achOpen || helpOpen || eventOpen || menuOpen || introOpen
    || !!optOv?.classList.contains('active')
    || (!!forgeOv && getComputedStyle(forgeOv).display !== 'none');
```

- [ ] **Step 7: main.ts bind 关闭按钮**（Modify `src/main.ts` import 行加 `closeItemIntro`，bindButtons 加）

import（L34 `ui-panels` import 旁或新行）：
```ts
import { closeItemIntro } from './item-intro.js';
```
bindButtons（L194 `on` helper 区内加）：
```ts
  on('btn-close-intro', closeItemIntro);
```

- [ ] **Step 8: 建 item-intro.ts 桩以便编译**（Create `src/item-intro.ts`，Task 7 会填充）

```ts
// First-pickup item intro popup — card render + multi-pickup queue. (Task 7 fills this in.)
export function closeItemIntro(): void { /* filled in Task 7 */ }
```

- [ ] **Step 9: tsc 验证**

Run: `cd /e/claude/darkhollow && npx tsc --noEmit`
Expected: 0 error。

- [ ] **Step 10: Commit**

```bash
cd /e/claude/darkhollow && git add index.html src/input.ts src/main.ts src/item-intro.ts
git commit -m "feat(item-intro): overlay DOM + input interception for intro card"
```

---

## Task 7: item-intro.ts 弹窗模块（卡片渲染 + 队列 + queue/close）

**Files:**
- Modify/Create: `src/item-intro.ts`（替换 Task 6 的桩）
- Test: 扩展 `src/__tests__/item-intro.test.ts`

**Interfaces:**
- Consumes: `introOpen`/`setIntroOpen`/`introEnabled`（state）、`discoverItem`（meta）、`showOverlay`/`hideOverlay`（ui-panels）、`t`/`tx`（i18n）、目录常量（data）、`RELICS`、`RARITY_C`/`rareName`（i18n）。
- Produces:
  - `queueItemIntro(item: Item): void` —— 构造 key、`introEnabled && discoverItem(key)` 为真则入队。
  - `queueRelicIntro(id: string): void` —— key `relic:<id>`，同上。
  - `closeItemIntro(): void` —— 关闭当前卡片，队列非空则弹下一个。
  - `findCatalogDef(type: ItemType, id?: string)` —— 反查目录 def（取 flavor）。

- [ ] **Step 1: 加队列单测**（追加到 `src/__tests__/item-intro.test.ts`）

```ts
vi.mock('../ui-panels.js', () => ({ showOverlay: vi.fn(), hideOverlay: vi.fn() }));
vi.mock('../meta.js', async () => {
  const actual = await vi.importActual<typeof import('../meta.js')>('../meta.js');
  return { ...actual, discoverItem: vi.fn(actual.discoverItem) };
});
import { queueItemIntro, closeItemIntro } from '../item-intro.js';
import { showOverlay, hideOverlay } from '../ui-panels.js';
import { introOpen } from '../state.js';
import { discoverItem } from '../meta.js';

describe('intro queue', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('first pickup of an item shows overlay; second does not', () => {
    (discoverItem as any).mockReturnValue(true);
    const item = { type: 'weapon', name: 'Iron Sword', id: 'iron_sword', rarity: 0, ch: ')', c: '#fff', desc: '', x: 0, y: 0 } as any;
    queueItemIntro(item);
    expect(showOverlay).toHaveBeenCalledWith('item-intro-overlay');
    (discoverItem as any).mockReturnValue(false);
    queueItemIntro(item);
    expect(showOverlay).toHaveBeenCalledTimes(1); // not called again
  });

  it('multiple first pickups queue and closeItemIntro advances', () => {
    (discoverItem as any).mockReturnValue(true);
    const mk = (id: string) => ({ type: 'potion', name: id, id, rarity: 0, ch: '!', c: '#fff', desc: '', x: 0, y: 0 } as any);
    queueItemIntro(mk('heal_potion'));
    queueItemIntro(mk('mana_potion')); // queued while first is showing
    expect(showOverlay).toHaveBeenCalledTimes(1);
    closeItemIntro(); // closes #1 → should show #2
    expect(showOverlay).toHaveBeenCalledTimes(2);
    closeItemIntro(); // closes #2 → queue empty
    expect(hideOverlay).toHaveBeenCalledWith('item-intro-overlay');
  });
});
```

- [ ] **Step 2: 跑测试验证失败**

Run: `cd /e/claude/darkhollow && npx vitest run src/__tests__/item-intro.test.ts`
Expected: 新队列测试 FAIL（`queueItemIntro` 未实现）。

- [ ] **Step 3: 实现 item-intro.ts**（替换 `src/item-intro.ts` 桩）

```ts
// First-pickup item intro popup — shows a card the first time an item/relic is
// acquired, with a queue so multi-pickup events (chests, kills, merchants) each
// get their own card. Discovered keys persist跨局 in MetaSave.discoveredItems.
import type { Item, ItemType } from './types.js';
import { introOpen, setIntroOpen, introEnabled } from './state.js';
import { discoverItem } from './meta.js';
import { showOverlay, hideOverlay } from './ui-panels.js';
import { t, tx, rareName, RARITY_C } from './i18n.js';
import {
  ALL_WEAPONS, ALL_ARMORS, ALL_ACCESSORIES, ALL_POTIONS, ALL_SCROLLS,
  ALL_CONSUMABLES, FOODS, ENDLESS_GEAR, RELICS,
} from './data.js';

type IntroTarget = { kind: 'item'; item: Item } | { kind: 'relic'; id: string };
const queue: IntroTarget[] = [];

// Reverse-lookup a catalog def by type + id to read its flavor (and name for relics).
export function findCatalogDef(type: ItemType, id?: string): { flavor?: { en: string; zh: string }; n?: { en: string; zh: string } } | null {
  if (!id) return null;
  const search = <T extends { id?: string }>(arr: T[]) => arr.find(d => d.id === id) as ({ flavor?: any; n?: any } & T) | undefined;
  switch (type) {
    case 'weapon': return search([...ALL_WEAPONS, ...ENDLESS_GEAR.weapons]) || null;
    case 'armor': return search([...ALL_ARMORS, ...ENDLESS_GEAR.armors]) || null;
    case 'accessory': return search([...ALL_ACCESSORIES, ...ENDLESS_GEAR.accessories]) || null;
    case 'potion': return search(ALL_POTIONS) || null;
    case 'scroll': return search(ALL_SCROLLS) || null;
    case 'consumable': return search(ALL_CONSUMABLES) || null;
    case 'food': return search(FOODS) || null;
    default: return null;
  }
}

function keyFor(item: Item): string {
  return `${item.type}:${item.id || item.name}`;
}

export function queueItemIntro(item: Item): void {
  if (!introEnabled) { discoverItem(keyFor(item)); return; } // record for codex, no popup
  if (item.type === 'gold') return;
  if (!discoverItem(keyFor(item))) return; // already discovered → no popup
  queue.push({ kind: 'item', item });
  if (!introOpen) showNext();
}

export function queueRelicIntro(id: string): void {
  if (!introEnabled) { discoverItem('relic:' + id); return; }
  if (!discoverItem('relic:' + id)) return;
  queue.push({ kind: 'relic', id });
  if (!introOpen) showNext();
}

function showNext(): void {
  const target = queue.shift();
  if (!target) { hideOverlay('item-intro-overlay'); setIntroOpen(false); return; }
  document.getElementById('item-intro-content')!.innerHTML = renderCard(target);
  document.getElementById('item-intro-hint')!.textContent = t('intro.closeHint');
  setIntroOpen(true);
  showOverlay('item-intro-overlay');
}

export function closeItemIntro(): void {
  // Advance to the next queued card, or close if none left.
  if (queue.length) { showNext(); return; }
  hideOverlay('item-intro-overlay');
  setIntroOpen(false);
}

function statRow(label: string, val: string | number, color = '#ccc'): string {
  return `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #1c1c1c"><span style="color:#888">${label}</span><span style="color:${color};font-weight:700">${val}</span></div>`;
}

function renderCard(target: IntroTarget): string {
  if (target.kind === 'relic') {
    const def = RELICS.find(r => r.id === target.id);
    if (!def) return '';
    const flavor = def.flavor ? tx(def.flavor) : '';
    return `
      <div style="text-align:center;margin-bottom:8px">
        <div style="font-size:2.4em;color:${def.c};line-height:1">${def.ch}</div>
        <div style="color:${RARITY_C[def.rarity] || '#ffd700'};font-size:1.3em;font-weight:700;margin-top:4px">${tx(def.n)}</div>
        <div style="color:#777;font-size:.8em">${t('intro.relicTag')} · ${rareName(def.rarity)}</div>
        <div style="color:#ffd700;font-size:.8em;margin-top:4px">✦ ${t('intro.firstDiscover')}</div>
      </div>
      <div style="background:rgba(155,83,229,.1);border:1px solid #9a2be2;border-radius:4px;padding:8px 10px;margin:8px 0">
        <div style="color:#c9a3ff;font-size:.85em;margin-bottom:3px">${t('intro.effect')}</div>
        <div style="color:#e8d8ff">${tx(def.d)}</div>
      </div>
      ${flavor ? `<div style="color:#9a9a9a;font-style:italic;font-size:.9em;margin-top:10px;border-left:2px solid #333;padding-left:10px">${flavor}</div>` : ''}`;
  }
  const item = target.item;
  const def = findCatalogDef(item.type, item.id);
  const flavor = def?.flavor ? tx(def.flavor) : '';
  const rc = RARITY_C[item.rarity] || '#ccc';
  let stats = '';
  if (item.atk) stats += statRow(t('intro.atk'), item.atk, '#f4845f');
  if (item.def) stats += statRow(t('intro.def'), item.def, '#7ec8e3');
  if (item.hp) stats += statRow(t('intro.hp'), item.hp, '#06d6a0');
  if (item.ef && item.ef !== 'food') stats += statRow(t('intro.effect'), item.desc);
  if (item.dur) stats += statRow(t('intro.duration'), item.dur + ' ' + t('intro.turns'));
  if (item.type === 'food') stats += statRow(t('intro.hunger'), item.val || 0);
  const setType = item.set ? `<div style="color:#9b5de5;font-size:.8em">${t('intro.set')}: ${item.set}</div>` : '';
  return `
    <div style="text-align:center;margin-bottom:8px">
      <div style="display:inline-block;background:${item.c}22;border:1px solid ${item.c};border-radius:4px;padding:4px 10px;font-size:2em;color:${item.c};line-height:1">${item.ch}</div>
      <div style="color:${rc};font-size:1.25em;font-weight:700;margin-top:6px">${item.name}</div>
      <div style="color:#777;font-size:.8em">${t('intro.type.' + item.type)} · ${rareName(item.rarity)}</div>
      <div style="color:#ffd700;font-size:.8em;margin-top:4px">✦ ${t('intro.firstDiscover')}</div>
    </div>
    ${setType}
    ${stats ? `<div style="margin:8px 0">${stats}</div>` : ''}
    ${flavor ? `<div style="color:#9a9a9a;font-style:italic;font-size:.9em;margin-top:10px;border-left:2px solid #333;padding-left:10px">${flavor}</div>` : ''}`;
}
```

- [ ] **Step 4: 加弹窗文案 i18n key**（Modify `src/i18n.ts` `L` 对象）

```ts
  "intro.closeHint": { en: "Press Esc / click ✕ / controller B to close", zh: "按 Esc / 点 ✕ / 手柄 B 关闭" },
  "intro.firstDiscover": { en: "First Discovery", zh: "首次发现" },
  "intro.relicTag": { en: "Relic", zh: "圣物" },
  "intro.effect": { en: "Effect", zh: "效果" },
  "intro.atk": { en: "Attack", zh: "攻击" },
  "intro.def": { en: "Defense", zh: "防御" },
  "intro.hp": { en: "HP", zh: "生命" },
  "intro.hunger": { en: "Hunger", zh: "饱食" },
  "intro.duration": { en: "Duration", zh: "持续" },
  "intro.turns": { en: "turns", zh: "回合" },
  "intro.set": { en: "Set", zh: "套装" },
  "intro.type.weapon": { en: "Weapon", zh: "武器" },
  "intro.type.armor": { en: "Armor", zh: "护甲" },
  "intro.type.accessory": { en: "Accessory", zh: "饰品" },
  "intro.type.potion": { en: "Potion", zh: "药水" },
  "intro.type.scroll": { en: "Scroll", zh: "卷轴" },
  "intro.type.consumable": { en: "Consumable", zh: "消耗品" },
  "intro.type.food": { en: "Food", zh: "食物" },
  "intro.type.gold": { en: "Gold", zh: "金币" },
```

- [ ] **Step 5: 跑测试验证通过**

Run: `cd /e/claude/darkhollow && npx vitest run src/__tests__/item-intro.test.ts`
Expected: 全 PASS（含 Task 1/4/7 的测试）。

- [ ] **Step 6: tsc + 全量测试**

Run: `cd /e/claude/darkhollow && npx tsc --noEmit && npx vitest run`
Expected: 全绿。

- [ ] **Step 7: Commit**

```bash
cd /e/claude/darkhollow && git add src/item-intro.ts src/i18n.ts src/__tests__/item-intro.test.ts
git commit -m "feat(item-intro): card render + multi-pickup queue + queue/close API"
```

---

## Task 8: 拾取入口接线（addItemWithOverflow 五路径 + grantRelic）

**Files:**
- Modify: `src/items.ts:464-528`（`addItemWithOverflow` 五路径）
- Modify: `src/relics.ts:165-180`（`grantRelic`）
- Test: 扩展 `src/__tests__/item-intro.test.ts`

**Interfaces:**
- Consumes: `queueItemIntro`/`queueRelicIntro`（Task 7）、`discoverItem`（Task 1）。
- 语义：4 条"获得"路径弹窗；直接转金路径（L526）仅 `discoverItem` 记录不弹；食物路径（L480）弹。

- [ ] **Step 1: 加边界单测**（追加到 `src/__tests__/item-intro.test.ts`）

```ts
import { addItemWithOverflow } from '../items.js';
import { queueItemIntro } from '../item-intro.js';

describe('addItemWithOverflow intro wiring', () => {
  beforeEach(() => { vi.clearAllMocks(); (globalThis as any).G = { player: { inv: [], hunger: 0, maxHunger: 100, hp: 50, maxHp: 100, quickSlots: [] } }; });

  it('overflow-to-gold path records discovery but does NOT queue popup', () => {
    // Fill inventory to cap so a weak item converts to gold.
    const p = (globalThis as any).G.player;
    p.inv = Array.from({ length: 20 }, (_, i) => ({ type: 'weapon', name: 'filler', rarity: 4, ch: ')', c: '#fff', desc: '', x: 0, y: 0, atk: 99, id: 'f' + i }));
    const queueSpy = vi.spyOn({ queueItemIntro }, 'queueItemIntro');
    // A weak weapon with rarity 0 → lower score than fillers → converts to gold.
    const weak = { type: 'weapon', name: 'w', rarity: 0, ch: ')', c: '#fff', desc: '', x: 0, y: 0, atk: 1, id: 'weak_w' } as any;
    addItemWithOverflow(weak);
    expect(queueSpy).not.toHaveBeenCalled(); // no popup on gold-convert
  });
});
```

> 注：该测试验证转金路径不调 `queueItemIntro`。其余 4 条路径的弹窗由 `discoverItem` 真值驱动，已在 Task 7 队列测试覆盖语义；手动验证见 §Validation。

- [ ] **Step 2: 跑测试验证失败**（或先确认现状）

Run: `cd /e/claude/darkhollow && npx vitest run src/__tests__/item-intro.test.ts`
Expected：接线前 `queueItemIntro` 本就不被调用 → 测试可能已通过（绿）。先记录，Step 4 后再确认仍绿。

- [ ] **Step 3: 接线 addItemWithOverflow**（Modify `src/items.ts`）

import（顶部）：
```ts
import { queueItemIntro } from './item-intro.js';
import { discoverItem } from './meta.js';
```
食物路径（L480 `addMsg(...); snd('heal'); return;` 之前加，让食物也介绍）：
```ts
    queueItemIntro(item);
```
装备升级路径（L487 `p.inv.push(item);` 后、`handleAutoEquip` 前）：
```ts
    queueItemIntro(item);
```
正常入池（L503 `p.inv.push(item); addMsg(...)` 行后）：
```ts
    queueItemIntro(item);
```
替换最弱（L523 `p.inv.push(item); addMsg(...)` 行后）：
```ts
    queueItemIntro(item);
```
直接转金（L526-527，`const gv = itemToGold(item); p.gold += gv;` 后加，**仅记录不弹**）：
```ts
    discoverItem(`${item.type}:${item.id || item.name}`);
```

- [ ] **Step 4: 接线 grantRelic**（Modify `src/relics.ts`）

import（顶部）：
```ts
import { queueRelicIntro } from './item-intro.js';
```
在 `p.relics.push(id);`（L172）后、`unlockLore(...)`（L173）后加：
```ts
  queueRelicIntro(id);
```

- [ ] **Step 5: 跑测试 + tsc + 全量**

Run: `cd /e/claude/darkhollow && npx vitest run src/__tests__/item-intro.test.ts && npx tsc --noEmit && npx vitest run`
Expected: 全绿。

- [ ] **Step 6: Commit**

```bash
cd /e/claude/darkhollow && git add src/items.ts src/relics.ts src/__tests__/item-intro.test.ts
git commit -m "feat(item-intro): wire pickup entry points (5 paths + grantRelic)"
```

---

## Task 9: options.ts Gameplay tab「首次拾取提示」开关

**Files:**
- Modify: `src/options.ts:271-278`（`renderGame`）

**Interfaces:**
- Consumes: `introEnabled`/`setIntroEnabled`（Task 5）。

- [ ] **Step 1: import introEnabled**（Modify `src/options.ts` import 块 L10-21，加）

```ts
  introEnabled, setIntroEnabled,
```

- [ ] **Step 2: renderGame 加开关行**（Modify `src/options.ts:271-278`）

把 `renderGame` 改为：
```ts
function renderGame(body: HTMLElement): void {
  body.innerHTML =
    row(t('opt.introEnabled'), toggleHtml(introEnabled)) +
    row(t('optLegend'), toggleHtml(legendVisible)) +
    row(t('optKeys'), toggleHtml(keysVisible));
  const toggles = body.querySelectorAll<HTMLInputElement>('.toggle input');
  if (toggles[0]) bindToggle(toggles[0], v => { setIntroEnabled(v); });
  if (toggles[1]) bindToggle(toggles[1], v => { if (v !== legendVisible) toggleLegend(); });
  if (toggles[2]) bindToggle(toggles[2], v => { if (v !== keysVisible) toggleKeys(); });
}
```

- [ ] **Step 3: tsc + 全量测试**

Run: `cd /e/claude/darkhollow && npx tsc --noEmit && npx vitest run`
Expected: 全绿。

- [ ] **Step 4: 手动验证**

`npm run dev` → 开局 → 设置 → Gameplay tab → 看到「首次拾取道具介绍」开关，默认开。关掉后拾新道具不弹。

- [ ] **Step 5: Commit**

```bash
cd /e/claude/darkhollow && git add src/options.ts
git commit -m "feat(item-intro): add first-pickup intro toggle in Gameplay settings"
```

---

## Task 10: Codex 道具图鉴 tab

**Files:**
- Modify: `src/ui-panels.ts:209-225`（`renderCodex` 改为两 tab）
- Modify: `src/i18n.ts`（加 `codex.tab*` / `codex.item*` key）

**Interfaces:**
- Consumes: `getMeta().discoveredItems`（Task 1）、目录常量 + `findCatalogDef`（Task 7）、`RELICS`。
- Produces: Codex 面板顶部两 tab（剧情 / 道具），道具 tab 按 `discoveredItems` 显示已发现/🔒。

- [ ] **Step 1: 加图鉴 i18n key**（Modify `src/i18n.ts`）

```ts
  "codex.tabLore": { en: "Lore", zh: "剧情" },
  "codex.tabItems": { en: "Items", zh: "道具" },
  "codex.itemLocked": { en: "??? Not yet discovered", zh: "??? 尚未发现" },
```

- [ ] **Step 2: 改 renderCodex 为两 tab**（Modify `src/ui-panels.ts`）

import（顶部加）：
```ts
import { ALL_WEAPONS, ALL_ARMORS, ALL_ACCESSORIES, ALL_POTIONS, ALL_SCROLLS, ALL_CONSUMABLES, FOODS, RELICS } from './data.js';
```
模块级 tab 状态（`renderCodex` 上方加）：
```ts
let codexTab: 'lore' | 'items' = 'lore';
```
替换 `renderCodex`（L209-225）为：
```ts
export function renderCodex(): void {
  const titleEl = document.getElementById('codex-title');
  if (titleEl) titleEl.textContent = t('up.codex');
  const content = document.getElementById('codex-content');
  if (!content) return;
  content.innerHTML =
    `<div class="opt-tabs" id="codex-tabs" role="tablist" style="margin-bottom:8px">
      <button class="opt-tab${codexTab === 'lore' ? ' active' : ''}" data-ctab="lore">${t('codex.tabLore')}</button>
      <button class="opt-tab${codexTab === 'items' ? ' active' : ''}" data-ctab="items">${t('codex.tabItems')}</button>
    </div>` +
    (codexTab === 'lore' ? renderLoreSection() : renderItemSection());
  content.querySelectorAll<HTMLElement>('[data-ctab]').forEach(btn => {
    btn.onclick = () => { codexTab = (btn.dataset.ctab as 'lore' | 'items') || 'lore'; renderCodex(); };
  });
}

function renderLoreSection(): string {
  const unlocked = new Set(getMeta().unlockedLore);
  return LORE_CATS.map(cat => {
    const rows = LORE_ENTRIES.filter(e => e.cat === cat.id).map(e => {
      const has = unlocked.has(e.id);
      const name = has ? tx(e.n) : '🔒 ???';
      const body = has ? tx(e.body) : t('up.notDiscovered');
      return `<div style="padding:8px 10px;margin:4px 0;border-left:3px solid ${has ? '#9a2be2' : '#333'};background:rgba(255,255,255,.02)"><div style="color:${has ? '#ddd' : '#555'};font-weight:700">${name}</div><div style="color:${has ? '#999' : '#444'};font-size:.9em;margin-top:3px">${body}</div></div>`;
    }).join('');
    return rows ? `<div style="color:#8888aa;margin:14px 2px 4px;font-size:.95em;border-bottom:1px solid #222;padding-bottom:3px">${tx(cat.label)}</div>${rows}` : '';
  }).join('') || `<div style="color:#555;padding:12px">${t('up.noEntries')}</div>`;
}

function renderItemSection(): string {
  const disc = new Set(getMeta().discoveredItems);
  const tables: { type: string; label: string; arr: { id?: string; n: { en: string; zh: string } }[] }[] = [
    { type: 'weapon', label: t('intro.type.weapon'), arr: ALL_WEAPONS },
    { type: 'armor', label: t('intro.type.armor'), arr: ALL_ARMORS },
    { type: 'accessory', label: t('intro.type.accessory'), arr: ALL_ACCESSORIES },
    { type: 'potion', label: t('intro.type.potion'), arr: ALL_POTIONS },
    { type: 'scroll', label: t('intro.type.scroll'), arr: ALL_SCROLLS },
    { type: 'consumable', label: t('intro.type.consumable'), arr: ALL_CONSUMABLES },
    { type: 'food', label: t('intro.type.food'), arr: FOODS },
  ];
  let html = '';
  for (const { type, label, arr } of tables) {
    const rows = arr.map(d => {
      const has = d.id ? disc.has(`${type}:${d.id}`) : false;
      const name = has ? tx(d.n) : '🔒 ???';
      return `<div style="padding:6px 10px;margin:3px 0;border-left:3px solid ${has ? '#ffd700' : '#333'};background:rgba(255,255,255,.02)"><span style="color:${has ? '#ddd' : '#555'};font-weight:700">${name}</span></div>`;
    }).join('');
    if (rows) html += `<div style="color:#8888aa;margin:12px 2px 4px;font-size:.95em;border-bottom:1px solid #222;padding-bottom:3px">${label}</div>${rows}`;
  }
  // Relics
  const rrows = RELICS.map(r => {
    const has = disc.has('relic:' + r.id);
    const name = has ? tx(r.n) : '🔒 ???';
    return `<div style="padding:6px 10px;margin:3px 0;border-left:3px solid ${has ? '#9a2be2' : '#333'};background:rgba(255,255,255,.02)"><span style="color:${has ? '#ddd' : '#555'};font-weight:700">${name}</span></div>`;
  }).join('');
  html += `<div style="color:#8888aa;margin:12px 2px 4px;font-size:.95em;border-bottom:1px solid #222;padding-bottom:3px">${t('intro.relicTag')}</div>${rrows}`;
  return html || `<div style="color:#555;padding:12px">${t('up.noEntries')}</div>`;
}
```

- [ ] **Step 3: tsc + 全量测试**

Run: `cd /e/claude/darkhollow && npx tsc --noEmit && npx vitest run`
Expected: 全绿。

- [ ] **Step 4: 手动验证**

`npm run dev` → 标题屏 → 典籍 → 顶部出现「剧情 / 道具」两 tab；道具 tab 显示所有道具，未拾过的 🔒，拾过的显示名。

- [ ] **Step 5: Commit**

```bash
cd /e/claude/darkhollow && git add src/ui-panels.ts src/i18n.ts
git commit -m "feat(item-intro): add Items tab to Lore Codex (discovered catalog)"
```

---

## Task 11: 全量验证 + i18n 交叉校验 + 冒烟

**Files:**
- 全项目

- [ ] **Step 1: i18n key 交叉校验**（确认所有 `t('intro.*'/'opt.intro*'/'codex.*')` 的 key 都在 `L` 中）

Run: `cd /e/claude/darkhollow && node -e "const {L}=require('./src/i18n.ts')" 2>/dev/null; grep -rhoE "t\('(intro|opt\.intro|codex)\.[a-zA-Z.]+'\)" src/ | sort -u`
逐个核对输出的 key 都在 `src/i18n.ts` 的 `L` 对象中（0 missing）。

- [ ] **Step 2: 全量测试 + tsc**

Run: `cd /e/claude/darkhollow && npx tsc --noEmit && npx vitest run`
Expected: 0 error + 全绿。

- [ ] **Step 3: 冒烟测试**（`npm run dev`，逐项验证）
1. 新开档拾起第一把武器 → 弹卡片（图标+名+稀有度+属性+flavor+✦首次发现），Esc 关闭；再拾同名武器 → 不弹。
2. 首次圣物 → 弹卡片（效果说明醒目 + flavor lore）。
3. 设法一次获 3 件首次道具（控制台多调宝箱或击杀连掉）→ 依次弹 3 张，关最后一张后输入解锁。
4. 设置关掉「首次拾取道具介绍」→ 拾新道具不弹；Codex 道具 tab 该道具仍显示为已发现。
5. 拾一件首次见的弱道具导致转金 → 不弹窗，Codex 道具 tab 该道具已解锁。
6. 死/胜回标题再开新档 → 之前拾过的道具不再弹（meta 持久化）。
7. 中英切换 → 卡片所有文案 + flavor 正确切换；Codex 双 tab 文案切换。

- [ ] **Step 4: 自检清单**（对照 spec §Testing）
- discoverItem 幂等/迁移/首次返回值 ✓（Task 1 测试）
- 目录 id 唯一 + flavor 双语 ✓（Task 3 测试）
- key 构造 / 队列多件 ✓（Task 7 测试）
- 转金路径记录不弹 ✓（Task 8 测试 + 手动 5）
- introEnabled=false 不弹但记录 ✓（手动 4）
- 跨局持久化 ✓（手动 6）
- 双语切换 ✓（手动 7）

- [ ] **Step 5: 最终 commit + 分支收尾**

```bash
cd /e/claude/darkhollow && git add -A
git commit -m "test(item-intro): full validation + i18n cross-check green" --allow-empty
```
按 `superpowers:finishing-a-development-branch` 做 fast-forward merge 回 main（或等用户确认后操作）。

---

## Self-Review 记录

- **Spec coverage**：spec §A1 数据层 → Task 1/2/3/4；§A2 弹窗 UI → Task 5/6/7；§A3 接线+开关 → Task 8/9；§A4 图鉴 → Task 10；§Testing → Task 11 + 各 task 测试。全覆盖。
- **Placeholder**：无 TBD/TODO；所有代码块为真实实现。
- **Type 一致性**：`discoverItem(key): boolean`、`queueItemIntro(item)`、`queueRelicIntro(id)`、`closeItemIntro()`、`findCatalogDef(type,id)` 在各 Task 间签名一致。
