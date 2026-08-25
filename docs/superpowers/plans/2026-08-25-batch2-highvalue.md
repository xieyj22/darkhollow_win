# 批2「高性价比」Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 清空审计高性价比层——死 handler 启用 ×3、Boss 技能 ×9、事件池 ×8、教学三件套、硬编码清理、门/传送门/宝箱 sprite、Boss 出场+三连 fx、shrineBuff 接活、净化方向 fx。

**Architecture:** 全部改动落在既有模块的数据层/接线层：新内容走 data-driven dispatch（enemy-skills/showEvent/pickItemTemplate），新机制（事件站点）走独立叶模块 event-sites.ts 防 import 环，Boss 出场挂 dungeon.updatePlayerFOV 尾部（已验证无环：enemies 闭包不 import dungeon）。

**Tech Stack:** TypeScript + Canvas + Vite；vitest + happy-dom（canvas2d 不可用——sprite 测试只测数据形状与纯路由函数）。

**Spec:** `docs/superpowers/specs/2026-08-25-batch2-highvalue-design.md`（实现前必读，本计划论证从 spec 出发）

## Global Constraints

- 测试基线 358 绿；每 task 结束 `npx vitest run` 全绿 + `npx tsc --noEmit` 0 错。
- 行号基于 `4aaa188`（spec 基线），允许小幅漂移——**定位以引用的代码片段为准，不盲信行号**。
- 测试 harness 模式统一照 `src/__tests__/events-checkTiles.test.ts:1-55`（vi.mock 依赖模块 + `(globalThis as any).G = mkG(...)` + `vi.clearAllMocks()`）。
- 中文文案全角标点；新 i18n key 全部 en/zh 双语，加进 L 对象（i18n.ts 顶部 `const L = {...}`）。
- happy-dom 无 canvas2d：不写依赖 `getContext('2d')` 返回值的断言。
- 每个提交信息用 `feat/fix/test(scope): ...`，批内 11 个 task 各自提交。
- 不动 `smoke` 脚本与设置面。

---

### Task 1: ① 三只死-handler 敌人上线

**Files:**
- Modify: `src/data.ts`（ENEMIES 数组，~:161-252 区间按 mf 插入）
- Test: `src/__tests__/batch2-enemies.test.ts`（新建）

**Interfaces:**
- Consumes: `EnemyDef`（含可选 `skill: EnemySkill`）、`ENEMIES` 导出
- Produces: ENEMIES 总数 73；三个活体引用 `heal`/`blink`/`summon` 效果的敌人

- [ ] **Step 1: 写失败测试**

```ts
// src/__tests__/batch2-enemies.test.ts
// 批2 ①: the three previously-dead handlers (heal/blink/summon) gain live casters.
import { describe, it, expect } from 'vitest';
import { ENEMIES } from '../data.js';

describe('batch2 ① dead-handler enemies', () => {
  it('ENEMIES count is 73', () => expect(ENEMIES.length).toBe(73));

  it('heal effect has a live caster (enemy, not class)', () => {
    // CLASSES[3] (paladin) also has effect 'heal' — ENEMIES only here.
    expect(ENEMIES.filter(e => e.skill?.effect === 'heal').length).toBeGreaterThanOrEqual(1);
  });
  it('blink effect has a live caster', () => {
    expect(ENEMIES.filter(e => e.skill?.effect === 'blink').length).toBeGreaterThanOrEqual(1);
  });
  it('summon effect has a live caster (skill-based, distinct from ai summoners)', () => {
    expect(ENEMIES.filter(e => e.skill?.effect === 'summon').length).toBeGreaterThanOrEqual(1);
  });

  it('three new enemies are well-formed', () => {
    for (const en of ['Deep Mender', 'Crypt Summoner', 'Void Blinker']) {
      const e = ENEMIES.find(x => x.n.en === en);
      expect(e, en).toBeDefined();
      expect(e!.mf).toBeGreaterThanOrEqual(1);
      expect(e!.hp).toBeGreaterThan(0);
      expect(e!.tags!.length).toBeGreaterThan(0);          // sprite routing needs a tag
      expect(e!.skill).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/__tests__/batch2-enemies.test.ts`
Expected: FAIL（count 70 ≠ 73；三个 effect 0 caster）

- [ ] **Step 3: data.ts 插入三行**

按 mf 升序插入（ch 只作 sprite 路由失败时的回退字形；sprite 由 tags 决定——aquatic/caster/spirit 模板现成）：

`Crypt Summoner` 插在 Gargoyle（mf 17, data.ts:199）之后：
```ts
  { n: { en: 'Crypt Summoner', zh: '地穴召唤师' }, ch: 'ψ', c: '#7b68ee', hp: 80, atk: 26, def: 8, exp: 78, g: [25, 55], ai: 'ranged', mf: 17, tags: ['caster'], skill: { name: { en: 'Raise Dead', zh: '亡者苏生' }, effect: 'summon', chance: 0.25, cd: 7, range: 6 } },
```

`Deep Mender` 插在 Deep One（mf 26, data.ts:210）之后：
```ts
  { n: { en: 'Deep Mender', zh: '深渊修补者' }, ch: '⚕', c: '#20b2aa', hp: 90, atk: 22, def: 8, exp: 75, g: [25, 55], ai: 'ranged', mf: 26, tags: ['aquatic'], skill: { name: { en: 'Mending Tide', zh: '修补潮汐' }, effect: 'heal', chance: 0.35, cd: 4, dmg: 1.2, range: 7 } },
```

`Void Blinker` 插在 Fallen Seraph（mf 37, data.ts:223）之后：
```ts
  { n: { en: 'Void Blinker', zh: '虚空闪行者' }, ch: '∆', c: '#7df9ff', hp: 110, atk: 46, def: 8, exp: 105, g: [45, 90], ai: 'ambush', mf: 37, el: 'shadow', tags: ['spirit'], skill: { name: { en: 'Void Step', zh: '虚空步' }, effect: 'blink', chance: 0.3, cd: 3 } },
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/__tests__/batch2-enemies.test.ts`
Expected: PASS 全绿

- [ ] **Step 5: 全量回归 + 提交**

Run: `npx vitest run && npx tsc --noEmit`（全绿/0 错；若 makeEnemy-real-data / item-data-integrity 等硬编码了 70 需同步改 73——这是数据门测试，改数字合法）

```bash
git add src/data.ts src/__tests__/batch2-enemies.test.ts
git commit -m "feat(enemies): activate heal/blink/summon dead handlers with 3 new enemies (batch2 ①)"
```

---

### Task 2: ② Boss 技能 ×9 + 贴脸优先闸门

**Files:**
- Modify: `src/types.ts`（BossDef ~:214 加 skill；Enemy 不需要——skill 已有）
- Modify: `src/data.ts`（BOSSES 9 条各加 skill；Creator 补 summon.kind）
- Modify: `src/enemies.ts`（:199-200 之间插 Boss 优先闸门）
- Test: `src/__tests__/batch2-boss-skills.test.ts`（新建）

**Interfaces:**
- Consumes: `EnemySkill`（types.ts:36-45）、`shouldCastSkill`/`executeEnemySkill`（enemy-skills.ts:17/:28）、makeEnemy 已深拷贝 skill
- Produces: `BossDef.skill?: EnemySkill`；Boss 实例带 skill；`shouldCastSkill` 复用（无新导出）

- [ ] **Step 1: 写失败测试**

```ts
// src/__tests__/batch2-boss-skills.test.ts
// 批2 ②: every boss casts; the priority gate lets bosses cast at melee range.
import { describe, it, expect } from 'vitest';
import { BOSSES, ENEMIES } from '../data.js';
import { makeEnemy } from '../enemy-factory.js';

describe('batch2 ② boss skills', () => {
  it('all 9 bosses have a skill with a valid effect', () => {
    const VALID = ['dmg_bolt', 'dmg_aoe', 'heal', 'buff', 'debuff_poison', 'debuff_slow', 'debuff_weaken', 'debuff_stun', 'blink', 'summon'];
    expect(BOSSES.length).toBe(9);
    for (const b of BOSSES) {
      expect(b.skill, b.n.en).toBeDefined();
      expect(VALID).toContain(b.skill!.effect);
      expect(b.skill!.chance).toBeLessThanOrEqual(0.35);
      expect(b.skill!.cd).toBeGreaterThanOrEqual(4);
    }
  });
  it("Creator's summon kind resolves to a real enemy", () => {
    const creator = BOSSES.find(b => b.fl === 40)!;
    expect(creator.summon?.kind).toBeDefined();
    expect(ENEMIES.some(e => e.n.en === creator.summon!.kind)).toBe(true);
  });
  it('makeEnemy copies skill onto boss instances', () => {
    const bd = BOSSES.find(b => b.fl === 5)!;
    const e = makeEnemy(bd, 3, 3, 1.4, { isBoss: true }, '哥布林王');
    expect(e.skill?.effect).toBe(bd.skill!.effect);
    expect(e.isBoss).toBe(true);
  });
});
```

（makeEnemy 的调用签名以 `src/enemies.ts:64` 现有调用 `makeEnemy(bd, br.cx, br.cy, bs, { isBoss: true }, tx(bd.n))` 为准；如测试报参数错照其修正。）

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/__tests__/batch2-boss-skills.test.ts`
Expected: FAIL（boss 无 skill）

- [ ] **Step 3: types.ts BossDef 加字段**

`export interface BossDef {`（types.ts:214）块内 `el?: Element;` 后加：
```ts
  // Batch2 ②: boss active skill — cast through the shared enemy-skill dispatch.
  // Priority gate in actEnemies lets bosses cast even at melee range.
  skill?: EnemySkill;
```

- [ ] **Step 4: data.ts BOSSES 9 条各加 skill**

在每条的 `phases:` 或 `summon:` 字段前插入（数值自 spec ② 表）：

```ts
  // F5
    skill: { name: { en: 'King\'s Menace', zh: '王之威吓' }, effect: 'debuff_weaken', chance: 0.3, cd: 4, range: 5, dmg: 6 },
  // F10
    skill: { name: { en: 'Web Snare', zh: '蛛网束缚' }, effect: 'debuff_slow', chance: 0.35, cd: 4, range: 5, aoe: 3 },
  // F15（该条有 el: 'shadow'）
    skill: { name: { en: 'Shadow Bolt', zh: '暗影箭' }, effect: 'dmg_bolt', chance: 0.3, cd: 4, range: 6, dmg: 1.6, el: 'shadow' },
  // F20
    skill: { name: { en: 'Necrotic Burst', zh: '死灵爆发' }, effect: 'dmg_aoe', chance: 0.3, cd: 5, range: 6, dmg: 1.3, aoe: 2 },
  // F25（该条有 el: 'fire'）
    skill: { name: { en: 'Dragon Breath', zh: '龙息' }, effect: 'dmg_bolt', chance: 0.35, cd: 4, range: 6, dmg: 1.7, el: 'fire' },
  // F30 Leviathan
    skill: { name: { en: 'Abyssal Call', zh: '深渊呼唤' }, effect: 'summon', chance: 0.3, cd: 6, range: 6 },
  // F35（该条有 el: 'shadow'）
    skill: { name: { en: 'Void Solidify', zh: '虚空凝固' }, effect: 'debuff_stun', chance: 0.3, cd: 6, range: 5, aoe: 1 },
  // F40 Creator —— 同时给 summon 补 kind:'Seraphim'（bossSummonAdd 按 n.en 解析，enemies.ts:359）
    skill: { name: { name: undefined } as any },  // ← 占位说明：实际写下面一行
    skill: { name: { en: 'Reconstruction', zh: '重构' }, effect: 'heal', chance: 0.25, cd: 8, range: 9, dmg: 1.5 },
    // summon 行改为: summon: { chance: 0.5, cd: 3, maxAdds: 4, kind: 'Seraphim' },
  // 菌穴 Myconid Sovereign（fl:0）
    skill: { name: { en: 'Mycelial Boon', zh: '菌丝回哺' }, effect: 'heal', chance: 0.3, cd: 5, range: 6, dmg: 1 },
```

**注意：Creator 那条只保留一个 skill 行（`Reconstruction`），上面标注占位的行不要写入——写完后自查无 `as any`。**

- [ ] **Step 5: enemies.ts 插 Boss 优先闸门**

在 `if (d <= 1.5) { attack(e, G.player, false); ...`（enemies.ts:200）**之前**插入：

```ts
    // Batch2 ②: bosses cast even at melee range — without this priority gate
    // the melee branch `continue`s every adjacent turn and chase bosses never cast.
    if (e.isBoss && e.skill && e.skillCd <= 0) {
      const bVis = !!G.player.visible?.[e.y]?.[e.x];
      if (shouldCastSkill(e, d, bVis, playerInvis)) {
        executeEnemySkill(e, e.skill);
        e.skillCd = e.skill.cd;
        if (G.gameOver) return;
        continue;
      }
    }
```

（`shouldCastSkill`/`executeEnemySkill` 已在 enemies.ts:16 import。）

- [ ] **Step 6: 跑测试确认通过 + 全量回归**

Run: `npx vitest run src/__tests__/batch2-boss-skills.test.ts && npx vitest run && npx tsc --noEmit`
Expected: 全绿（enemies-boss.test.ts 既有测试若对 actEnemies 行为敏感需复跑确认——Boss 闸门只影响带 skill 的 Boss，旧测试的 Boss def 当时无 skill，不受影响）

- [ ] **Step 7: 提交**

```bash
git add src/types.ts src/data.ts src/enemies.ts src/__tests__/batch2-boss-skills.test.ts
git commit -m "feat(boss): all 9 bosses cast skills; melee-range priority gate (batch2 ②)"
```

---

### Task 3: ③a 事件站点基建 + 3 个 once 事件

**Files:**
- Create: `src/event-sites.ts`（叶模块：表 + 资格过滤，防 game↔events 环）
- Modify: `src/types.ts`（Item.npc 联合加 `'event'` ~:190；Item 加 `eventId?: string`；GameState 加 `eventFlags?: Record<string, boolean>` ~:522）
- Modify: `src/events.ts`（triggerNpc 加分支 ~:255；文件尾加 showEventSite/runEventAction）
- Modify: `src/game.ts`（enterFloor 内 endless_merchant 行 ~:110 后加放置调用）
- Modify: `src/i18n.ts`（L 加 ev2.* 键）
- Test: `src/__tests__/batch2-event-sites.test.ts`（新建）

**Interfaces:**
- Consumes: `placeEntity` 模式（game.ts:98-105）、`showEvent` popup 骨架（events.ts:31-53）、`_bindEventBtns`、`setEventOpen/setEventActions`
- Produces: `EVENT_SITES: EventSiteDef[]`、`eligibleEventSites(floor: number): EventSiteDef[]`（event-sites.ts 导出）；`showEventSite(entity: Item): void`（events.ts 导出）；`Item.eventId`、`GameState.eventFlags`

- [ ] **Step 1: 写失败测试**

```ts
// src/__tests__/batch2-event-sites.test.ts
// 批2 ③: event-site eligibility + once-flags + triggerNpc routing.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../state.js', () => ({ get G() { return (globalThis as any).G; }, lang: 'en', eventOpen: false, eventActions: [], setEventOpen: vi.fn(), setEventActions: vi.fn() }));
vi.mock('../utils.js', () => ({ rng: () => 1, dst: () => 1, pick: (a: any[]) => a[0] }));
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../effects.js', () => ({ flt: () => {}, shake: () => {} }));
vi.mock('../fx.js', () => ({ fxFlash: () => {}, fxAura: () => {}, fxBeam: () => {}, fxBolt: () => {}, fxBurst: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: vi.fn() }));
vi.mock('../render.js', () => ({ updateUI: () => {}, render: () => {} }));
vi.mock('../items.js', () => ({ genItem: () => ({ rarity: 1, name: 'x' }), genWeapon: () => ({}), genArmor: () => ({}), genAcc: () => ({}), addItemWithOverflow: vi.fn(), itemToGold: () => 0 }));
vi.mock('../item-gen.js', () => ({ genEndlessGear: () => ({}) }));
vi.mock('../relics.js', () => ({ grantRelic: vi.fn(), hasRelic: () => false }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tMsg: (k: string, ...a: string[]) => a.reduce((s, x) => s.replace('{}', x), k), tx: (f: any) => f?.en ?? '' }));
vi.mock('../combat.js', () => ({ applyCorruption: vi.fn(), playerDeath: vi.fn(), recalc: () => {} }));
vi.mock('../enemy-factory.js', () => ({ makeEnemy: vi.fn(() => ({})) }));
vi.mock('../data.js', async (im) => ({ ...(await im<object>('../data.js')), ENEMIES: [{ n: { en: 'Skeleton' }, mf: 1, hp: 1, atk: 1, def: 0, exp: 1, g: [1, 2], ai: 'chase' }] }));

import { EVENT_SITES, eligibleEventSites } from '../event-sites.js';
import { triggerNpc } from '../events.js';

const mkG = () => ({
  floor: 10, branchMode: false, gameOver: false, endless: false, eventFlags: {},
  dungeon: { map: [[0]], rooms: [], traps: [] },
  items: [], enemies: [],
  player: { x: 0, y: 0, gold: 100, hp: 100, maxHp: 100, baseAtk: 5, baseDef: 5, baseMaxHp: 100, eq: { weapon: { name: 'sword', atk: 3 }, armor: null, accessory: null, accessory2: null }, buffs: [] },
});

beforeEach(() => { vi.clearAllMocks(); (globalThis as any).G = mkG(); });

describe('eligibleEventSites', () => {
  it('respects minFloor', () => {
    (globalThis as any).G = undefined;
    expect(eligibleEventSites(2).map(s => s.id)).not.toContain('cursed_altar');  // minFloor 4
  });
  it('filters once-events already flagged', () => {
    (globalThis as any).G = { eventFlags: { cursed_altar: true } };
    const ids = eligibleEventSites(10).map(s => s.id);
    expect(ids).not.toContain('cursed_altar');
    expect(ids).toContain('ancient_remains');  // repeatable
  });
  it('8 sites defined', () => expect(EVENT_SITES.length).toBe(8));
});

describe('triggerNpc routes event sites', () => {
  it('marks once-flag and opens popup', () => {
    const el = document.createElement('div'); el.id = 'event-popup';
    const title = document.createElement('div'); title.id = 'ev-title';
    const desc = document.createElement('div'); desc.id = 'ev-desc';
    const btns = document.createElement('div'); btns.id = 'ev-buttons';
    for (const n of [el, title, desc, btns]) document.body.appendChild(n);
    triggerNpc({ npc: 'event', eventId: 'cursed_altar' } as any);
    expect((globalThis as any).G.eventFlags.cursed_altar).toBe(true);
    expect(title.textContent).toBe('ev2.cursed_altarTitle');
    expect(btns.children.length).toBe(2);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/__tests__/batch2-event-sites.test.ts`
Expected: FAIL（event-sites.js 不存在）

- [ ] **Step 3: 建 event-sites.ts**

```ts
// Batch2 ③: random event-site table + eligibility. Leaf module (state/types
// only) so game.ts can import it without a game↔events import cycle.
import { G } from './state.js';

export type EventSiteId =
  | 'cursed_altar' | 'gambler_altar' | 'trapped_npc' | 'ancient_remains'
  | 'blood_pool' | 'ancient_stele' | 'sealed_box' | 'sacrifice_well';

export interface EventSiteDef {
  id: EventSiteId;
  ch: string;        // map glyph (sprite fallback)
  c: string;         // glyph color
  minFloor: number;
  once: boolean;     // once per run (G.eventFlags)
}

export const EVENT_SITES: EventSiteDef[] = [
  { id: 'cursed_altar',    ch: '⛧', c: '#c0392b', minFloor: 4,  once: true },
  { id: 'gambler_altar',   ch: '⚄', c: '#f39c12', minFloor: 3,  once: true },
  { id: 'trapped_npc',     ch: '⌂', c: '#7ec8e3', minFloor: 5,  once: true },
  { id: 'ancient_remains', ch: '⚰', c: '#95a5a6', minFloor: 3,  once: false },
  { id: 'blood_pool',      ch: '♨', c: '#8b0000', minFloor: 8,  once: false },
  { id: 'ancient_stele',   ch: 'ᛘ', c: '#daa520', minFloor: 6,  once: true },
  { id: 'sealed_box',      ch: '⊞', c: '#9b5de5', minFloor: 10, once: true },
  { id: 'sacrifice_well',  ch: '◍', c: '#06d6a0', minFloor: 7,  once: false },
];

export function eligibleEventSites(floor: number): EventSiteDef[] {
  return EVENT_SITES.filter(s => floor >= s.minFloor && !(s.once && G?.eventFlags?.[s.id]));
}
```

- [ ] **Step 4: types.ts 三处加字段**

- `npc?: 'merchant' | ... | 'shrine';`（types.ts:190）联合加 `| 'event'`
- Item 内 `stock?: Item[];` 后加：
```ts
  // event-site id (npc === 'event') — which random event this entity triggers.
  eventId?: string;
```
- GameState `wardenCd: number;`（~:522）后加：
```ts
  // Batch2 ③: once-per-run flags for random event sites (id → triggered).
  eventFlags?: Record<string, boolean>;
```

- [ ] **Step 5: events.ts 加 triggerNpc 分支 + showEventSite + 3 个事件动作**

triggerNpc（events.ts:250-256）加一分支：
```ts
  else if (entity.npc === 'event' && entity.eventId) showEventSite(entity);
```

events.ts 顶部 import 增加（已有行合并）：`import { EVENT_SITES, type EventSiteDef, type EventSiteId } from './event-sites.js';`、`import { makeEnemy } from './enemy-factory.js';`、`import { ENEMIES } from './data.js';`（data.js 已 import RELICS——合并为一行）。文件尾追加：

```ts
// --- Batch2 ③: random event sites (8 low-frequency map events) ---

export function showEventSite(entity: Item): void {
  if (!G || !entity.eventId) return;
  const def = EVENT_SITES.find(s => s.id === entity.eventId);
  if (!def) return;
  if (def.once) {
    G.eventFlags = G.eventFlags || {};
    G.eventFlags[def.id] = true;
  }
  const popup = document.getElementById('event-popup')!;
  document.getElementById('ev-title')!.textContent = t('ev2.' + def.id + 'Title');
  document.getElementById('ev-desc')!.textContent = t('ev2.' + def.id + 'Desc');
  const btns = document.getElementById('ev-buttons')!;
  btns.innerHTML = '';
  const actions: Array<() => void> = [];
  const addBtn = (label: string, action: () => void) => {
    const b = document.createElement('button');
    b.className = 'evb';
    b.textContent = `[${actions.length + 1}] ${label}`;
    btns.appendChild(b);
    actions.push(action);
  };
  addBtn(t('ev2.' + def.id + 'Act'), () => runEventAction(def));
  addBtn(t('merchantLeave'), closeEvent);
  setEventOpen(true);
  setEventActions(actions);
  _bindEventBtns(actions);
  popup.style.display = 'block';
}

function runEventAction(def: EventSiteDef): void {
  if (!G) return;
  const p = G.player;
  switch (def.id) {
    case 'cursed_altar': {
      // Player equipment slots live under p.eq (types.ts Equipment) — p.eq.weapon, not p.weapon.
      if (!p.eq.weapon) { addMsg(t('ev2.cursedAltarNoWeapon'), 'mi'); closeEvent(); return; }
      p.eq.weapon = null;
      p.baseAtk += 3;
      recalc();
      addMsg(tMsg('ev2.cursedAltarDone'), 'ml'); snd('levelup');
      break;
    }
    case 'gambler_altar': {
      if (p.gold < 50) { addMsg(t('merchantNoGold'), 'mi'); closeEvent(); return; }
      p.gold -= 50;
      const r = Math.random();
      if (r < 0.45) { p.gold += 100; addMsg(tMsg('ev2.gamblerWin', '100'), 'me'); snd('chest'); }
      else if (r < 0.90) { addMsg(t('ev2.gamblerLose'), 'mt'); snd('trap'); }
      else { p.gold += 150; addMsg(tMsg('ev2.gamblerJackpot', '150'), 'ml'); snd('levelup'); }
      break;
    }
    case 'trapped_npc': {
      if (Math.random() < 0.25) {
        spawnEventFoes(2);
        addMsg(t('ev2.trappedAmbush'), 'mt'); snd('trap'); shake();
      } else {
        p.gold += 10 + G.floor * 5;
        const it = genItem(G.floor + 2); it.x = p.x; it.y = p.y; G.items.push(it);
        addMsg(tMsg('ev2.trappedReward', String(10 + G.floor * 5)), 'me'); snd('chest');
      }
      break;
    }
    default: break;  // T4 fills the rest
  }
  closeEvent(); updateUI(); render();
}

// Shared: place n foes from the floor-appropriate pool near the player.
function spawnEventFoes(n: number): void {
  if (!G) return;
  const pool = ENEMIES.filter(en => en.mf <= G!.floor && en.mf >= Math.max(1, G!.floor - 6) && !en.tags?.includes('boss'));
  if (!pool.length) return;
  const fs = 1 + (G.floor - 1) * 0.1;
  for (let k = 0; k < n; k++) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const sx = G.player.x + rng(-3, 3), sy = G.player.y + rng(-3, 3);
      if (sx < 0 || sy < 0 || G.dungeon.map[sy]?.[sx] === undefined) continue;
      if (G.dungeon.map[sy][sx] === TL.WALL || G.dungeon.map[sy][sx] === TL.VOID) continue;
      if (G.enemies.some(o => o.x === sx && o.y === sy)) continue;
      if (sx === G.player.x && sy === G.player.y) continue;
      G.enemies.push(makeEnemy(pick(pool), sx, sy, fs, { hpM: 0.8, atkM: 0.9 }));
      break;
    }
  }
}
```

（`recalc` 已 import 自 combat；`TL` 已 import 自 config。）

- [ ] **Step 6: game.ts 放置调用**

import 加 `import { eligibleEventSites } from './event-sites.js';`。enterFloor 内 `endless_merchant` 行（game.ts:110）后加：

```ts
    // Batch2 ③: one random event site on ~28% of floors (F3+; main line & endless).
    if (floor >= 3 && Math.random() < 0.28) {
      const pool = eligibleEventSites(floor);
      if (pool.length) {
        const s = pick(pool);
        const rooms = G!.dungeon.rooms.slice(1);
        if (rooms.length) {
          const rm = pick(rooms);
          const x = rng(rm.x + 1, rm.x + rm.w - 2), y = rng(rm.y + 1, rm.y + rm.h - 2);
          if (G!.dungeon.map[y][x] !== TL.STAIR)
            G!.items.push({ type: 'consumable', name: t('ev2.' + s.id + 'Title'), ch: s.ch, c: s.c, desc: '', x, y, rarity: 2, npc: 'event', eventId: s.id } as Item);
        }
      }
    }
```

- [ ] **Step 7: i18n.ts 加 ev2.* 键（本 task 部分）**

L 对象内（chestTitle 附近语义区）加：

```ts
  'ev2.cursed_altarTitle': { en: '⛧ Cursed Altar', zh: '⛧ 诅咒祭坛' },
  'ev2.cursed_altarDesc': { en: 'A black altar whispers: offer your blade, gain eternal strength.', zh: '黑色祭坛低语着：献上你的武器，换取永恒的力量。' },
  'ev2.cursed_altarAct': { en: 'Sacrifice Weapon (+3 ATK)', zh: '献祭武器（攻击+3）' },
  'ev2.cursedAltarNoWeapon': { en: 'You have no weapon to offer.', zh: '你没有可献祭的武器。' },
  'ev2.cursedAltarDone': { en: 'The altar devours your weapon. Strength floods your arms.', zh: '祭坛吞噬了你的武器。力量涌入你的双臂。' },
  'ev2.gambler_altarTitle': { en: '⚄ Gambler\'s Altar', zh: '⚄ 赌徒祭坛' },
  'ev2.gambler_altarDesc': { en: 'Wager 50 gold. Double your money — or lose it all. Sometimes more.', zh: '押上 50 金币。要么翻倍——要么血本无归。偶尔还有惊喜。' },
  'ev2.gambler_altarAct': { en: 'Wager 50 Gold', zh: '押注 50 金币' },
  'ev2.gamblerWin': { en: 'The dice favor you! You win {} gold!', zh: '骰子眷顾了你！赢得 {} 金币！' },
  'ev2.gamblerLose': { en: 'The dice betray you. Your gold vanishes into the altar.', zh: '骰子背叛了你。金币没入祭坛消失无踪。' },
  'ev2.gamblerJackpot': { en: 'A triple! The altar pours out {} gold!', zh: '三倍大奖！祭坛吐出了 {} 金币！' },
  'ev2.trapped_npcTitle': { en: '⌂ Trapped Traveler', zh: '⌂ 被困旅人' },
  'ev2.trapped_npcDesc': { en: 'A traveler is pinned under rubble, begging for help. Something feels off...', zh: '一名旅人被压在碎石下哀求救助。但有什么地方不对劲……' },
  'ev2.trapped_npcAct': { en: 'Help Them', zh: '施以援手' },
  'ev2.trappedAmbush': { en: 'It was a trap! Ambushers spring from the shadows!', zh: '是圈套！伏兵从阴影中跃出！' },
  'ev2.trappedReward': { en: 'The traveler rewards you with items and {} gold.', zh: '旅人以物资和 {} 金币作为答谢。' },
```

- [ ] **Step 8: 跑测试 + 全量回归 + 提交**

Run: `npx vitest run src/__tests__/batch2-event-sites.test.ts && npx vitest run && npx tsc --noEmit`
Expected: 全绿（events-checkTiles.test.ts 的 maybeEvent 断言不受影响——本批不复活 maybeEvent）

```bash
git add src/event-sites.ts src/types.ts src/events.ts src/game.ts src/i18n.ts src/__tests__/batch2-event-sites.test.ts
git commit -m "feat(events): event-site infrastructure + cursed altar/gambler/trapped traveler (batch2 ③a)"
```

---

### Task 4: ③b 其余 5 个事件

**Files:**
- Modify: `src/events.ts`（runEventAction switch 补 5 case）
- Modify: `src/i18n.ts`（ev2.* 其余键）
- Test: `src/__tests__/batch2-event-sites.test.ts`（追加用例）

**Interfaces:**
- Consumes: Task 3 全部产出（runEventAction/spawnEventFoes/showEventSite）
- Produces: 8/8 事件可玩

- [ ] **Step 1: 追加失败测试**

```ts
describe('runEventAction remaining sites', () => {
  const ev = document.createElement('div'); // ids 已由前述用例创建（同文件共享 DOM）
  it('blood_pool: +5 maxHp, +3 corruption', () => {
    const { applyCorruption } = vi.mocked(await import('../combat.js'));
    (globalThis as any).G = mkG();
    showEventSiteById('blood_pool');   // helper 见下
    document.querySelector('.evb')!.click();
    expect((globalThis as any).G.player.baseMaxHp).toBe(105);
    expect(applyCorruption).toHaveBeenCalledWith(3);
  });
  it('sacrifice_well: -20% HP, cleanse 12', () => {
    const { applyCorruption } = vi.mocked(await import('../combat.js'));
    (globalThis as any).G = mkG();
    showEventSiteById('sacrifice_well');
    document.querySelector('.evb')!.click();
    expect((globalThis as any).G.player.hp).toBe(80);       // 100 - 20%
    expect(applyCorruption).toHaveBeenCalledWith(-12);
  });
});
```

测试文件头加 helper（triggerNpc 走通即可，不必直接调私有 runEventAction）：
```ts
import { triggerNpc } from '../events.js';
const showEventSiteById = (id: string) => triggerNpc({ npc: 'event', eventId: id } as any);
```
（顶部 DOM 元素若未创建需创建——把 Task 3 用例里的 4 个 getElementById 元素创建提为 beforeAll。）

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/__tests__/batch2-event-sites.test.ts`
Expected: 新用例 FAIL（blood_pool 走 default: break，corruption 未调用）

- [ ] **Step 3: runEventAction 补 5 个 case**

switch 内 `default: break;` 替换为：

```ts
    case 'ancient_remains': {
      const r = Math.random();
      if (r < 0.6) { const g = rng(10, 30) + G.floor * 2; p.gold += g; addMsg(tMsg('ev2.remainsGold', String(g)), 'me'); snd('pickup'); }
      else if (r < 0.9) { addMsg(t('ev2.remainsEmpty'), 'mi'); }
      else { spawnEventFoes(rng(1, 2)); addMsg(t('ev2.remainsAmbush'), 'mt'); snd('trap'); shake(); }
      break;
    }
    case 'blood_pool': {
      p.baseMaxHp += 5; p.hp += 5;
      applyCorruption(3);
      addMsg(t('ev2.bloodPoolDrunk'), 'md'); snd('heal');
      break;
    }
    case 'ancient_stele': {
      const b = rng(1, 3);
      if (b === 1) { p.baseAtk += 1; addMsg(t('ev2.steleAtk'), 'ml'); }
      else if (b === 2) { p.baseDef += 1; addMsg(t('ev2.steleDef'), 'ml'); }
      else { p.baseMaxHp += 5; p.hp += 5; addMsg(t('ev2.steleHp'), 'ml'); }
      recalc(); snd('levelup');
      break;
    }
    case 'sealed_box': {
      const r = Math.random();
      if (r < 0.5) {
        const it = genItem(G.floor + 3); it.rarity = Math.max(3, it.rarity); it.x = p.x; it.y = p.y;
        G.items.push(it); addMsg(tMsg('ev2.sealedLoot', String(it.name)), 'me'); snd('chest');
      } else if (r < 0.85) {
        applyCorruption(8); addMsg(t('ev2.sealedCorrupt'), 'mc'); snd('trap'); shake();
      } else {
        const pool = RELICS.filter(x => x.rarity <= 3);
        grantRelic(pick(pool).id, p.x, p.y); addMsg(t('ev2.sealedRelic'), 'ml'); snd('levelup');
      }
      break;
    }
    case 'sacrifice_well': {
      const cost = Math.min(Math.max(1, Math.floor(p.hp * 0.2)), p.hp - 1);
      if (cost < 1) { addMsg(t('ev2.wellTooWeak'), 'mi'); closeEvent(); return; }
      p.hp -= cost;
      applyCorruption(-12);
      addMsg(tMsg('ev2.wellPaid', String(cost)), 'md'); snd('heal');
      break;
    }
    default: break;
```

- [ ] **Step 4: i18n.ts 补其余 ev2.* 键**

```ts
  'ev2.ancient_remainsTitle': { en: '⚰ Ancient Remains', zh: '⚰ 前代遗骸' },
  'ev2.ancient_remainsDesc': { en: 'The bones of a previous descender. Their pack may still hold something...', zh: '前一位下潜者的骸骨。背包里或许还有些东西……' },
  'ev2.ancient_remainsAct': { en: 'Search the Remains', zh: '搜刮遗骸' },
  'ev2.remainsGold': { en: 'You find {} gold in the pack!', zh: '你在背包里找到了 {} 金币！' },
  'ev2.remainsEmpty': { en: 'Nothing but dust and bones.', zh: '只有尘土与枯骨。' },
  'ev2.remainsAmbush': { en: 'The bones rise! The dead defend their treasures!', zh: '骸骨站了起来！亡者守护着他们的遗物！' },
  'ev2.blood_poolTitle': { en: '♨ Blood Pool', zh: '♨ 血池' },
  'ev2.blood_poolDesc': { en: 'A pool of thick, warm blood. Drinking it might strengthen you... at a price.', zh: '一汪浓稠温热的血。饮下它或许能变强……但须付出代价。' },
  'ev2.blood_poolAct': { en: 'Drink (+5 Max HP, +3 Corruption)', zh: '饮用（生命上限+5，腐化+3）' },
  'ev2.bloodPoolDrunk': { en: 'Power surges through you — and something dark takes root.', zh: '力量涌遍全身——某种黑暗也悄然扎根。' },
  'ev2.ancient_steleTitle': { en: 'ᛘ Ancient Stele', zh: 'ᛘ 古老石碑' },
  'ev2.ancient_steleDesc': { en: 'A rune-carved stele older than the Depths themselves.', zh: '比暗渊本身更古老的符文石碑。' },
  'ev2.ancient_steleAct': { en: 'Read the Runes', zh: '解读符文' },
  'ev2.steleAtk': { en: 'The runes teach ferocity. +1 ATK.', zh: '符文传授了凶悍。攻击+1。' },
  'ev2.steleDef': { en: 'The runes teach resilience. +1 DEF.', zh: '符文传授了坚韧。防御+1。' },
  'ev2.steleHp': { en: 'The runes warm your blood. +5 Max HP.', zh: '符文温暖了你的血液。生命上限+5。' },
  'ev2.sealed_boxTitle': { en: '⊞ Sealed Box', zh: '⊞ 封印之匣' },
  'ev2.sealed_boxDesc': { en: 'A lead box sealed with holy sigils. Whatever is inside, it is potent.', zh: '以圣印封缄的铅匣。无论里面是什么，都绝非凡物。' },
  'ev2.sealed_boxAct': { en: 'Break the Seal', zh: '开启封印' },
  'ev2.sealedLoot': { en: 'Inside: {} — potent, and yours.', zh: '匣中是：{}——威力不凡，归你了。' },
  'ev2.sealedCorrupt': { en: 'A wave of corruption washes over you!', zh: '一阵腐化浪潮扑面而来！' },
  'ev2.sealedRelic': { en: 'A relic! It hums with old power.', zh: '是一件圣物！它嗡鸣着古老的力量。' },
  'ev2.sacrifice_wellTitle': { en: '◍ Sacrificial Well', zh: '◍ 献祭井' },
  'ev2.sacrifice_wellDesc': { en: 'A well of clear water that hungers for blood. It offers cleansing in return.', zh: '一口渴望鲜血的清水井。它以净化作为交换。' },
  'ev2.sacrifice_wellAct': { en: 'Offer Blood (-20% HP, Corruption -12)', zh: '献祭鲜血（生命-20%，腐化-12）' },
  'ev2.wellPaid': { en: 'The well drinks {} HP. Your corruption recedes.', zh: '井饮下了 {} 点生命。你的腐化退去了。' },
  'ev2.wellTooWeak': { en: 'You are too weak to bleed for the well.', zh: '你虚弱得无法为井献血。' },
```

- [ ] **Step 5: 跑测试 + 全量回归 + 提交**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 全绿

```bash
git add src/events.ts src/i18n.ts src/__tests__/batch2-event-sites.test.ts
git commit -m "feat(events): remains/blood pool/stele/sealed box/sacrifice well (batch2 ③b)"
```

---

### Task 5: ④ 教学三件套 + unlockLore 日志

**Files:**
- Modify: `src/meta.ts`（MetaSave 加 seenMechanics + discoverMechanic + unlockLore 日志）
- Modify: `src/item-intro.ts`（IntroTarget 加 mechanic + MECHANIC_CARDS + queueMechanicIntro + renderCard 分支）
- Modify: `src/combat.ts`（applyCorruption 跨档处 queue）
- Modify: `src/enemies.ts`（spawnWarden 尾部 queue）
- Modify: `src/game.ts`（enterBranch queue）
- Modify: `src/i18n.ts`（intro.mc* ×6 + codex.updated）
- Test: `src/__tests__/batch2-mechanic-cards.test.ts`（新建）

**Interfaces:**
- Consumes: item-intro 队列（queue/showNext/introOpen/introEnabled）、`discoverItem` 模式（meta.ts:243-251）
- Produces: `discoverMechanic(key: string): boolean`（meta.ts）；`queueMechanicIntro(id: string): void`（item-intro.ts）；`MECHANIC_CARDS`（内部）

- [ ] **Step 1: 写失败测试**

```ts
// src/__tests__/batch2-mechanic-cards.test.ts
// 批2 ④: mechanic tutorial cards queue once per career (MetaSave).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../state.js', () => ({ get G() { return (globalThis as any).G; }, lang: 'en', introOpen: false, introEnabled: true, setIntroOpen: vi.fn() }));
vi.mock('../meta.js', () => ({ discoverItem: vi.fn(() => true), discoverMechanic: vi.fn(() => true), getMeta: () => ({ upgrades: {}, unlockedLore: [], discoveredItems: [], seenMechanics: [] }) }));
vi.mock('../ui-panels.js', () => ({ showOverlay: vi.fn(), hideOverlay: vi.fn() }));
vi.mock('../sprites.js', () => ({ paintItemIcon: vi.fn(), paintRelicIcon: vi.fn() }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tx: (f: any) => f?.en ?? '', rareName: () => '', RARITY_C: ['#c0c0c0', '#06d6a0', '#4895ef', '#9b5de5', '#ffd700'] }));

import { queueMechanicIntro } from '../item-intro.js';
import { discoverMechanic } from '../meta.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('queueMechanicIntro', () => {
  it('queues on first sight (discoverMechanic true)', () => {
    queueMechanicIntro('corruption');
    expect(discoverMechanic).toHaveBeenCalledWith('corruption');
    expect(document.getElementById('item-intro-content')!.innerHTML).toContain('intro.mcCorruptionTitle');
  });
  it('skips when already seen', () => {
    vi.mocked(discoverMechanic).mockReturnValue(false);
    queueMechanicIntro('warden');
    expect(document.getElementById('item-intro-content')!.innerHTML).not.toContain('mcWarden');
  });
  it('unknown id is a no-op', () => {
    queueMechanicIntro('nonsense');
    expect(discoverMechanic).not.toHaveBeenCalled();
  });
});
```

（DOM：happy-dom 全局 document 可直接 `getElementById`——item-intro 测试既有模式见 `src/__tests__/item-intro.test.ts`，若它显式创建了 `item-intro-content`/`item-intro-hint`/`item-intro-overlay` 节点则照抄其 setup。）

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/__tests__/batch2-mechanic-cards.test.ts`
Expected: FAIL（queueMechanicIntro 不存在）

- [ ] **Step 3: meta.ts 三处**

1) `initMeta()`（meta.ts:20-30）`discoveredItems: []` 后加 `seenMechanics: [],`；2) loadMeta 迁移处（`if (!m.discoveredItems) ...` 同一块，~:44）加 `if (!m.seenMechanics) m.seenMechanics = [];`；3) MetaSave 接口 `discoveredItems: string[];` 后加 `seenMechanics: string[];`。然后加函数（discoverItem 后面）：

```ts
// Batch2 ④: mechanic tutorial cards — once per career, like item intros.
export function discoverMechanic(key: string): boolean {
  const meta = getMeta();
  if (!meta.seenMechanics.includes(key)) {
    meta.seenMechanics.push(key);
    saveMeta(meta);
    return true;
  }
  return false;
}
```

unlockLore（meta.ts）真解锁分支加日志（meta.ts 顶部 `import { addMsg } from './messages.js';`——messages.ts 是叶模块，无环）：
```ts
export function unlockLore(id: string): void {
  const meta = getMeta();
  if (!meta.unlockedLore.includes(id)) {
    meta.unlockedLore.push(id);
    saveMeta(meta);
    addMsg(t('codex.updated'), 'mi');   // Batch2 ④: silent unlocks no more
  }
}
```
（meta.ts 若未 import t 需加 `import { t } from './i18n.js';`。）

- [ ] **Step 4: item-intro.ts 加 mechanic 分支**

```ts
import { discoverItem, discoverMechanic } from './meta.js';
// ...
type IntroTarget = { kind: 'item'; item: Item } | { kind: 'relic'; id: string } | { kind: 'mechanic'; id: string };

// Batch2 ④: first-encounter mechanic tutorials (corruption/warden/fungal).
const MECHANIC_CARDS: Record<string, { sym: string; col: string; tk: string; bk: string }> = {
  corruption: { sym: '🟪', col: '#b583f6', tk: 'intro.mcCorruptionTitle', bk: 'intro.mcCorruptionBody' },
  warden:     { sym: '👁', col: '#9a2be2', tk: 'intro.mcWardenTitle',     bk: 'intro.mcWardenBody' },
  fungal:     { sym: '🍄', col: '#06d6a0', tk: 'intro.mcFungalTitle',     bk: 'intro.mcFungalBody' },
};

export function queueMechanicIntro(id: string): void {
  if (!MECHANIC_CARDS[id]) return;
  if (!introEnabled) { discoverMechanic(id); return; }     // record for consistency, no popup
  if (!discoverMechanic(id)) return;                        // already seen
  queue.push({ kind: 'mechanic', id });
  if (!introOpen) showNext();
}
```

renderCard（item-intro.ts:84）函数体最前加：
```ts
  if (target.kind === 'mechanic') {
    const mc = MECHANIC_CARDS[target.id];
    if (!mc) return '';
    return `
      <div style="text-align:center;margin-bottom:8px">
        <div style="font-size:2.2em;color:${mc.col};margin-top:4px">${mc.sym}</div>
        <div style="color:${mc.col};font-size:1.3em;font-weight:700;margin-top:4px">${t(mc.tk)}</div>
        <div style="color:#ffd700;font-size:.8em;margin-top:4px">✦ ${t('intro.firstDiscover')}</div>
      </div>
      <div style="background:rgba(155,83,229,.1);border:1px solid #9a2be2;border-radius:4px;padding:8px 10px;margin:8px 0">
        <div style="color:#e8d8ff">${t(mc.bk)}</div>
      </div>`;
  }
```

- [ ] **Step 5: 三个触发点接线**

combat.ts：import 行加 `import { queueMechanicIntro } from './item-intro.js';`（combat→item-intro 传递闭包无 combat，安全；若 tsc 报环改走 bridge 模式并在提交信息注明）。applyCorruption 跨档分支（combat.ts:387 `if (r.crossed && r.after !== 'clean') {`）首行加：
```ts
    queueMechanicIntro('corruption');
```

enemies.ts：import 加 queueMechanicIntro；spawnWarden 尾部（`shake();` 后）加：
```ts
  queueMechanicIntro('warden');
```

game.ts：import 加 queueMechanicIntro；enterBranch 内 `unlockLore('area:fungal');`（game.ts:176）后加：
```ts
  queueMechanicIntro('fungal');
```

- [ ] **Step 6: i18n.ts 加键**

```ts
  'intro.mcCorruptionTitle': { en: 'Corruption', zh: '腐化' },
  'intro.mcCorruptionBody': { en: 'Shadow damage and dark bargains raise your Corruption. Higher tiers empower your spells but twist your body — at 100 you become the next Warden. Fountains, shrines and certain wares can cleanse it. Your ending depends on where you stand.', zh: '暗影伤害与黑暗交易会累积腐化。腐化档位越高，法术越强，但身体也愈发扭曲——到 100 你将成为下一任守渊人。喷泉、神龛与某些商品可以净化腐化。你的结局取决于你身处何方。' },
  'intro.mcWardenTitle': { en: 'The Warden', zh: '守渊人' },
  'intro.mcWardenBody': { en: 'A nemesis that stalks you every 6-9 floors. Fight it for relics and lost memories — or descend and leave it behind. Descenders who succumb to corruption join its ranks.', zh: '每 6-9 层追猎你一次的天敌。击败它可获得圣物与失落的记忆——或者干脆下楼甩开它。被腐化吞噬的下潜者会加入它的行列。' },
  'intro.mcFungalTitle': { en: 'The Fungal Hollow', zh: '荧光菌穴' },
  'intro.mcFungalBody': { en: 'A glowing side-pocket of the Depths, entered through portals on floors 11-20. Weaker foes, but a high-rarity reward and gold guard the exit portal. Step on the return portal to go back to where you entered.', zh: '暗渊的荧光侧袋，经由 11-20 层的传送门进入。敌人较弱，但出口传送门前守着高稀有度奖励与金币。踏上归返传送门即可回到入口位置。' },
  'codex.updated': { en: '📜 Codex updated.', zh: '📜 典籍已更新。' },
```

- [ ] **Step 7: 跑测试 + 全量回归 + 提交**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 全绿（save.test.ts 若快照 MetaSave 形状需同步 seenMechanics 字段）

```bash
git add src/meta.ts src/item-intro.ts src/combat.ts src/enemies.ts src/game.ts src/i18n.ts src/__tests__/batch2-mechanic-cards.test.ts
git commit -m "feat(tutorial): corruption/warden/fungal mechanic cards + codex-update log (batch2 ④)"
```

---

### Task 6: ⑤ 硬编码清理 ×7 + html lang

**Files:**
- Modify: `src/game.ts`（:87/:198 Gold；:142 null_crown）
- Modify: `src/combat.ts`（:249 levelStats；:131 critHit）
- Modify: `src/items.ts`（:46/:47/:87 buffGain）
- Modify: `src/skills.ts`（盾击/暗影突袭两处行内双语）
- Modify: `src/state.ts`（setLang + 模块初始化）
- Modify: `src/i18n.ts`（8 个键）
- Test: `src/__tests__/batch2-i18n-hardcode.test.ts`（新建）

**Interfaces:**
- Consumes: `t`/`tMsg`（{} 顺序替换，i18n.ts:606-611）、`t('gold')` 键已存在（i18n.ts:14）
- Produces: 无新接口，纯文案路径

- [ ] **Step 1: 写失败测试**

```ts
// src/__tests__/batch2-i18n-hardcode.test.ts
// 批2 ⑤: rendered-path strings go through L keys; html lang tracks language.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../state.js', () => ({ get G() { return (globalThis as any).G; }, lang: 'en' }));
vi.mock('../i18n.js', async (im) => {
  const real = await im<typeof import('../i18n.js')>();
  return { ...real };
});

import { setLang, lang } from '../state.js';
import { t } from '../i18n.js';
import * as gameSrc from '../game.js';  // module loads with mocks — smoke only

describe('hardcoded string cleanup', () => {
  it('new keys resolve in both languages', () => {
    for (const k of ['buff.nullCrown', 'cb.levelStats', 'cb.critHit', 'it.atkGain', 'it.defGain', 'it.shieldGain', 'sk.shieldBash', 'sk.shadowStrike']) {
      expect(t(k), k).not.toBe(k);   // t() falls back to the key itself when missing
    }
  });
  it('levelStats renders four numbers', () => {
    const real = await import('../i18n.js');
    // direct L check via tMsg with fake args
    expect(real.tMsg('cb.levelStats', '5', '2', '1', '0')).toMatch(/5.*2.*1.*0/);
  });
});
```

（setLang/html-lang 断言放同文件：`it('setLang updates documentElement.lang', () => { setLang('zh'); expect(document.documentElement.lang).toBe('zh'); setLang('en'); })`——state.js 被 mock 的用例里不能测 setLang，此用例需真实 state 模块；把 state mock 从本文件去掉，改 mock state 依赖之外的东西。**实现时以「能编译且断言过」为准调整 mock 集**——不 mock state.js，直接用真实模块。）

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/__tests__/batch2-i18n-hardcode.test.ts`
Expected: FAIL（键不存在，t 返回 key 本身）

- [ ] **Step 3: 逐处替换**

| 文件:行 | 旧 | 新 |
|---|---|---|
| game.ts:87 | `name: 'Gold',` | `name: t('gold'),` |
| game.ts:198 | `name: 'Gold',` | `name: t('gold'),` |
| game.ts:142 | `name: 'null_crown',` | `name: t('buff.nullCrown'),` |
| combat.ts:249 | ``addMsg(`+${hg}HP +${mg}MP +${ag}ATK +${dg}DEF`, 'ml');`` | `addMsg(tMsg('cb.levelStats', String(hg), String(mg), String(ag), String(dg)), 'ml');` |
| combat.ts:131 | ``addMsg(tx({ en: `CRIT! ...`, zh: `暴击！...` }), 'mc');`` | `addMsg(tMsg('cb.critHit', String(def.name), String(dmg), String(elSym)), 'mc');` |
| items.ts:46 | ``addMsg(`+${item.val} ATK ${item.dur}t`, 'mi');`` | `addMsg(tMsg('it.atkGain', String(item.val || 0), String(item.dur || 30)), 'mi');` |
| items.ts:47 | ``addMsg(`+${item.val} DEF ${item.dur}t`, 'mi');`` | `addMsg(tMsg('it.defGain', String(item.val || 0), String(item.dur || 30)), 'mi');` |
| items.ts:87 | ``addMsg(`+${item.val} DEF ${item.dur}t`, 'mi');`` | `addMsg(tMsg('it.shieldGain', String(item.val || 0), String(item.dur || 30)), 'mi');` |
| skills.ts 盾击 | `addMsg(tx({ en: \`Shield Bash! ...\`, zh: \`盾击！...\` }), 'msk');` | `addMsg(tMsg('sk.shieldBash', String(e.name), String(dmg)), 'msk');` |
| skills.ts 暗影 | `addMsg(tx({ en: \`Shadow Strike! ...\`, zh: \`暗影突袭！...\` }), 'msk');` | `addMsg(tMsg('sk.shadowStrike', String(e.name), String(dmg)), 'msk');` |

（skills.ts 两处的实际行内容以源码为准——保留 fx/flt 行不动，只换 addMsg 行。）

state.ts:44-46：
```ts
export function setLang(l: string) { lang = l; localStorage.setItem('dh_lang', l); document.documentElement.lang = l; }
// module init: apply stored language to the document root
document.documentElement.lang = lang;
```

- [ ] **Step 4: i18n.ts 加 8 键**

```ts
  'buff.nullCrown': { en: "Null Crown's Gift", zh: '虚无之冕的馈赠' },
  'cb.levelStats': { en: '+{}HP +{}MP +{}ATK +{}DEF', zh: '生命+{} 法力+{} 攻击+{} 防御+{}' },
  'cb.critHit': { en: 'CRIT! You deal {}{} to {}!', zh: '暴击！对{}造成{}伤害{}！' },
  'it.atkGain': { en: '+{} ATK for {} turns', zh: '攻击+{}，持续{}回合' },
  'it.defGain': { en: '+{} DEF for {} turns', zh: '防御+{}，持续{}回合' },
  'it.shieldGain': { en: '+{} DEF (shield) for {} turns', zh: '防御+{}（护盾），持续{}回合' },
  'sk.shieldBash': { en: 'Shield Bash! {} damage to {}, stunned!', zh: '盾击！对{}造成{}伤害并眩晕！' },
  'sk.shadowStrike': { en: 'Shadow Strike! {} to {}!', zh: '暗影突袭！对{}造成{}伤害！' },
```

（注意 cb.critHit 参数顺序=旧文案：name, dmg, elSym。）

- [ ] **Step 5: 跑测试 + 全量回归 + 提交**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 全绿（combat/items/skills 相关既有测试若断言旧英文串需同步改——逐个改断言为新键输出，属合法行为更新）

```bash
git add src/game.ts src/combat.ts src/items.ts src/skills.ts src/state.ts src/i18n.ts src/__tests__/batch2-i18n-hardcode.test.ts
git commit -m "fix(i18n): route 7 hardcoded strings through L keys; html lang tracks language (batch2 ⑤)"
```

---

### Task 7: ⑥ DOOR/PORTAL/CHEST sprite + 路由

**Files:**
- Modify: `src/sprites.ts`（TEMPLATES 加 3 模板 + PORTAL_PAL + drawDoorSprite/drawPortalSprite；pickItemTemplate 加 spriteKind 优先 + export）
- Modify: `src/render.ts`（:286-288 后加 DOOR/PORTAL 分流；import 两个新函数）
- Modify: `src/game.ts`（placeEntity chest 行加 spriteKind —— 但 placeEntity 不透传，直接在 chest 的 placeEntity 调用后补一行或改 placeEntity 签名，见 Step 5）
- Modify: `src/types.ts`（Item 加 `spriteKind?: string;`）
- Test: `src/__tests__/batch2-sprites.test.ts`（新建）

**Interfaces:**
- Consumes: `Template = string[]`（16×16）、`getSprite`/`blit`、`buildPalette`、`reducedMotion`（state.ts:79 `export let reducedMotion`）
- Produces: `drawDoorSprite(c, x, y)`、`drawPortalSprite(c, x, y)`（sprites.ts 导出）；`pickItemTemplate(item)` 导出供测试；`Item.spriteKind`

- [ ] **Step 1: 写失败测试**

```ts
// src/__tests__/batch2-sprites.test.ts
// 批2 ⑥: new terrain/entity templates + spriteKind routing.
import { describe, it, expect } from 'vitest';
import { TEMPLATES, pickItemTemplate } from '../sprites.js';

describe('batch2 templates', () => {
  it('DOOR/PORTAL/CHEST defined, 16 rows × 16 chars', () => {
    for (const k of ['DOOR', 'PORTAL', 'CHEST']) {
      const tpl = (TEMPLATES as Record<string, string[]>)[k];
      expect(tpl, k).toBeDefined();
      expect(tpl.length).toBe(16);
      tpl.forEach((row, i) => expect(row.length, k + ' row ' + i).toBe(16));
    }
  });
  it('spriteKind routes before type switch', () => {
    const r = pickItemTemplate({ type: 'consumable', spriteKind: 'CHEST', name: 'x', rarity: 2 } as any);
    expect(r.key).toBe('CHEST');
  });
  it('unknown spriteKind falls through to normal routing', () => {
    const r = pickItemTemplate({ type: 'gold', spriteKind: 'NOPE', name: 'x', rarity: 0 } as any);
    expect(r.key).toBe('I_GOLD');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/__tests__/batch2-sprites.test.ts`
Expected: FAIL（模板未定义 / pickItemTemplate 未导出）

- [ ] **Step 3: sprites.ts 加三模板**（插在 SHRINE 模板后；每行必须 16 字符）

```ts
  DOOR: [
    "................",
    "....KKKKKKKK....",
    "...KNNNNNNNNK...",
    "..KNNWNNNNWNNK..",
    "..KNWNNNNNNWNK..",
    "..KNNNNNNNNNNK..",
    "..KNNNNNGNNNNK..",
    "..KNNNNNGNNNNK..",
    "..KNNNNNNNNNNK..",
    "..KNNNNNNNNNNK..",
    "..KNNNDNNNDNNK..",
    "..KNNNDDNNDDNK..",
    "...KNNNNNNNNK...",
    "....KKKKKKKK....",
    "................",
    "................",
  ],
  PORTAL: [
    "................",
    ".....MMMMMM.....",
    "...MMLLLLLLMM...",
    "..MLLKKKKKKLLM..",
    "..MLKKddddKKLM..",
    ".MLKddLLLLddKLM.",
    ".MLKdLKKKKLdKLM.",
    ".MLKdLKddKLdKLM.",
    ".MLKdLKKKKLdKLM.",
    ".MLKddLLLLddKLM.",
    "..MLKKddddKKLM..",
    "..MLLKKKKKKLLM..",
    "...MMLLLLLLMM...",
    ".....MMMMMM.....",
    "................",
    "................",
  ],
  CHEST: [
    "................",
    "................",
    "...KKKKKKKKKK...",
    "..KNNWWWWWWNNK..",
    ".KNNNNNNNNNNNNK.",
    ".KNNNNNNNNNNNNK.",
    ".KKKKKKKKKKKKKK.",
    ".KNNNNNGNNNNNNK.",
    ".KNNNNNGGNNNNNK.",
    ".KNNNNNGNNNNNNK.",
    ".KNNNNNNNNNNNNK.",
    ".KKKKKKKKKKKKKK.",
    "..KKKKKKKKKKKK..",
    "................",
    "................",
    "................",
  ],
```

调色板（buildPalette 后面）：
```ts
// Batch2 ⑥ fixed terrain palettes.
const DOOR_PAL: Record<string, string> = { K: '#140a0a', N: '#6b4423', D: '#4a2e17', G: '#ffd54a', W: '#8a5a30' };
const PORTAL_PAL: Record<string, string> = { M: '#7df9ff', L: '#b266ff', d: '#3a0d5c', K: '#0a0015' };
const PORTAL_PAL_B: Record<string, string> = { M: '#b266ff', L: '#7df9ff', d: '#3a0d5c', K: '#0a0015' };
const CHEST_PAL: Record<string, string> = { K: '#140a0a', N: '#8a5a30', W: '#c89a5a', G: '#ffd54a' };
```

draw API（drawShrineSprite 后面）：
```ts
export function drawDoorSprite(c: CanvasRenderingContext2D, x: number, y: number): void {
  blit(c, x, y, getSprite(TEMPLATES.DOOR, DOOR_PAL, 'DOOR'));
}

// Batch2 ⑥: portal animates — palette phase swap + orbiting spark. Static under
// reduced motion (same gate the enemy idle bob uses).
export function drawPortalSprite(c: CanvasRenderingContext2D, x: number, y: number): void {
  const phase = reducedMotion ? 0 : Math.floor(performance.now() / 400) % 2;
  blit(c, x, y, getSprite(TEMPLATES.PORTAL, phase ? PORTAL_PAL_B : PORTAL_PAL, 'PORTAL:' + phase));
  if (!reducedMotion) {
    const a = performance.now() / 500;
    const cx = x + TS / 2, cy = y + TS / 2;
    c.fillStyle = '#e0b3ff';
    c.fillRect(Math.round(cx + Math.cos(a) * TS * 0.28) - 1, Math.round(cy + Math.sin(a) * TS * 0.28) - 1, 2, 2);
  }
}
```

（sprites.ts 顶部若无 `import { reducedMotion } from './state.js';` 则加。）

pickItemTemplate：函数签名前去掉 `function` 的私有性改 `export function pickItemTemplate(...)`，函数体最前加：
```ts
  // Batch2 ⑥: explicit spriteKind wins (map entities like CHEST bypass type routing).
  if ((item as any).spriteKind && (TEMPLATES as Record<string, Template>)[item.spriteKind!]) {
    const k = item.spriteKind!;
    return { tpl: (TEMPLATES as Record<string, Template>)[k], key: k };
  }
```
（Item.spriteKind 字段加上后可去掉 as any。）

- [ ] **Step 4: render.ts 分流**

import 行（render.ts:9）加 `drawDoorSprite, drawPortalSprite`。:288 SHRINE 行后加：
```ts
      if (tile === TL.DOOR) { drawDoorSprite(c, sx, sy); continue; }
      if (tile === TL.PORTAL) { drawPortalSprite(c, sx, sy); continue; }
```

- [ ] **Step 5: chest 实体带 spriteKind**

types.ts Item `subType?: string;` 后加：
```ts
  // explicit sprite override (Batch2 ⑥) — wins over type routing in pickItemTemplate
  spriteKind?: string;
```

game.ts placeEntity（:98-105）的 push 对象加 `spriteKind` 透传——改签名 `const placeEntity = (npc: Item['npc'], ch: string, c: string, nameKey: string, rarity: number, spriteKind?: string)` 并在 push 对象加 `spriteKind`（undefined 时 JSON 兼容）。chest 调用行（:106）改：
```ts
    if (Math.random() < 0.5) placeEntity('chest', '▣', '#daa520', 'gm.chest', 2, 'CHEST');
```

- [ ] **Step 6: 跑测试 + 全量回归 + 提交**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: 全绿（sprites.test.ts 既有 shape 守卫会自动扫到新模板——若它按白名单枚举模板名，把 3 个新名加进清单）

```bash
git add src/sprites.ts src/render.ts src/game.ts src/types.ts src/__tests__/batch2-sprites.test.ts
git commit -m "feat(sprites): DOOR/PORTAL/CHEST templates + animated portal + spriteKind routing (batch2 ⑥)"
```

---

### Task 8: ⑦ Boss 出场演出

**Files:**
- Modify: `src/types.ts`（Enemy 加 `introPlayed?: boolean;`）
- Modify: `src/enemies.ts`（shouldBossReveal 纯函数 + checkBossReveal + spawn 时初始化无必要——undefined 即 falsy）
- Modify: `src/dungeon.ts`（updatePlayerFOV 尾部调 checkBossReveal——已验证无环：enemies 的传递闭包不含 dungeon）
- Test: `src/__tests__/batch2-boss-reveal.test.ts`（新建）

**Interfaces:**
- Consumes: `fxAura`（fx.ts:83）、`flt(x, y, text, color, cls?)`、`shake(mag?)`（effects.ts）、`snd('boss')`
- Produces: `shouldBossReveal(e: Enemy, vis: boolean): boolean`、`checkBossReveal(): void`（enemies.ts 导出）

- [ ] **Step 1: 写失败测试**

```ts
// src/__tests__/batch2-boss-reveal.test.ts
// 批2 ⑦: boss intro fx fires exactly once, on first sight.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../state.js', () => ({ get G() { return (globalThis as any).G; }, lang: 'en' }));
vi.mock('../fx.js', () => ({ fxFlash: () => {}, fxAura: vi.fn(), fxBeam: () => {}, fxBolt: () => {}, fxBurst: () => {} }));
vi.mock('../effects.js', () => ({ flt: vi.fn(), shake: vi.fn() }));
vi.mock('../audio.js', () => ({ snd: vi.fn(), setBgmScene: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: vi.fn() }));
vi.mock('../combat.js', () => ({ attack: vi.fn(), playerDeath: vi.fn() }));
vi.mock('../enemy-skills.js', () => ({ shouldCastSkill: () => false, executeEnemySkill: vi.fn() }));
vi.mock('../enemy-factory.js', () => ({ makeEnemy: vi.fn() }));
vi.mock('../warden.js', () => ({ wardenStats: () => ({ hp: 1, maxHp: 1, atk: 1, def: 1, exp: 1 }) }));
vi.mock('../relics.js', () => ({ grantRelic: vi.fn(), hasRelic: () => false }));
vi.mock('../meta.js', () => ({ getMeta: () => ({ upgrades: {}, wardens: [], unlockedLore: [] }), unlockLore: vi.fn() }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tMsg: (k: string, ...a: string[]) => k + a.join(''), tx: (f: any) => f?.en ?? '' }));
vi.mock('../render.js', () => ({ setEnemyTween: vi.fn(), updateUI: () => {}, render: () => {} }));
vi.mock('../item-intro.js', () => ({ queueMechanicIntro: vi.fn() }));

import { shouldBossReveal, checkBossReveal } from '../enemies.js';
import { fxAura } from '../fx.js';
import { shake } from '../effects.js';

const boss = (over: any = {}) => ({ isBoss: true, introPlayed: false, x: 3, y: 3, c: '#ffd700', name: 'Goblin King', ...over });

beforeEach(() => { vi.clearAllMocks(); });

describe('shouldBossReveal (pure)', () => {
  it('boss + visible + not played → true', () => expect(shouldBossReveal(boss(), true)).toBe(true));
  it('already played → false', () => expect(shouldBossReveal(boss({ introPlayed: true }), true)).toBe(false));
  it('not visible → false', () => expect(shouldBossReveal(boss(), false)).toBe(false));
  it('non-boss → false', () => expect(shouldBossReveal(boss({ isBoss: false }), true)).toBe(false));
});

describe('checkBossReveal', () => {
  it('fires fx once, then idempotent', () => {
    const b = boss();
    (globalThis as any).G = { enemies: [b], player: { x: 0, y: 0, visible: { 3: { 3: true } } }, gameOver: false };
    checkBossReveal();
    expect(fxAura).toHaveBeenCalledWith(3, 3, '#ffd700', 2.5);
    expect(shake).toHaveBeenCalledWith(2);
    checkBossReveal();   // second call: no more fx
    expect(fxAura).toHaveBeenCalledTimes(1);
    expect(b.introPlayed).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/__tests__/batch2-boss-reveal.test.ts`
Expected: FAIL（函数不存在）

- [ ] **Step 3: 实现**

types.ts Enemy `skillCd: number;` 附近加：
```ts
  // Batch2 ⑦: one-shot intro-fx guard — set when the boss is first seen.
  introPlayed?: boolean;
```

enemies.ts（spawnWarden 前的合适位置，如 actEnemies 定义前）：
```ts
// Batch2 ⑦: boss reveal — intro fx fires exactly once, when the boss first
// becomes visible (NOT at floor entry: the boss spawns off-screen).
export function shouldBossReveal(e: Enemy, vis: boolean): boolean {
  return !!e.isBoss && !e.introPlayed && vis;
}

export function checkBossReveal(): void {
  if (!G || G.gameOver) return;
  for (const e of G.enemies) {
    if (!shouldBossReveal(e, !!G.player.visible?.[e.y]?.[e.x])) continue;
    e.introPlayed = true;
    fxAura(e.x, e.y, e.c, 2.5);
    flt(e.x, e.y, String(e.name), e.c, 'crit');
    shake(2);
    snd('boss');
  }
}
```
（enemies.ts 已 import fx？查顶部——若无 `fxAura` 需把它加进现有 fx.js import。）

dungeon.ts：`import { checkBossReveal } from './enemies.js';` + `updatePlayerFOV` 函数体末尾（return 前的所有路径之后，若函数多处 return 则在主计算完成处）加 `checkBossReveal();`。

- [ ] **Step 4: 跑测试 + 全量回归 + 提交**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 全绿

```bash
git add src/types.ts src/enemies.ts src/dungeon.ts src/__tests__/batch2-boss-reveal.test.ts
git commit -m "feat(juice): boss reveal intro fx on first sight (batch2 ⑦)"
```

---

### Task 9: ⑧ 升级/落地/拾取 fx 三连

**Files:**
- Modify: `src/combat.ts`（:250 升级 fxAura；:187 落地 fxBurst；fx import 加 fxAura、i18n import 加 RARITY_C）
- Modify: `src/player.ts`（拾取 fxFlash；import fx）
- Test: `src/__tests__/batch2-fx-wiring.test.ts`（新建）

**Interfaces:**
- Consumes: `fxAura`/`fxBurst`/`fxFlash`（fx.ts）、`RARITY_C`（i18n.ts:614 导出）
- Produces: 无新接口

- [ ] **Step 1: 写失败测试**

```ts
// src/__tests__/batch2-fx-wiring.test.ts
// 批2 ⑧: level-up / loot-drop / pickup fire fx (mock fx counts).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../state.js', () => ({ get G() { return (globalThis as any).G; }, lang: 'en' }));
vi.mock('../fx.js', () => ({ fxFlash: vi.fn(), fxAura: vi.fn(), fxBeam: () => {}, fxBolt: () => {}, fxBurst: vi.fn() }));
vi.mock('../effects.js', () => ({ flt: () => {}, shake: () => {} }));
vi.mock('../audio.js', () => ({ snd: () => {}, setBgmScene: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: vi.fn() }));
vi.mock('../enemies.js', () => ({ processBossPhase: () => {}, checkBossReveal: () => {} }));
vi.mock('../utils.js', () => ({ rng: () => 1, dst: () => 3, pick: (a: any[]) => a[0] }));
vi.mock('../config.js', () => ({ FINAL: 40 }));
vi.mock('../meta.js', () => ({ getMeta: () => ({ upgrades: {}, stats: {}, achievements: [], unlockedLore: [], discoveredItems: [], seenMechanics: [], runHistory: [], endlessLeaderboard: [], wardens: [] }), checkAchs: vi.fn(), unlockLore: vi.fn() }));
vi.mock('../talents.js', () => ({ getCritMultiplier: () => 1.5, getSkillModifiers: () => ({ dmgMult: 1 }), isCCImmune: () => false }));
vi.mock('../relics.js', () => ({ hasRelic: () => false, relicOnCrit: vi.fn(), relicOnKill: vi.fn(), grantRelic: vi.fn() }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tMsg: (k: string, ...a: string[]) => k + a.join(''), tx: (f: any) => f?.en ?? '', RARITY_C: ['#c0c0c0', '#06d6a0', '#4895ef', '#9b5de5', '#ffd700'] }));
vi.mock('../items.js', () => ({ _genItem: undefined, checkAch: vi.fn() }));
vi.mock('../item-intro.js', () => ({ queueMechanicIntro: vi.fn() }));

import { checkLevelUp, applyCorruption } from '../combat.js';
import { fxAura, fxBurst } from '../fx.js';

const mkPlayer = () => ({
  x: 5, y: 5, level: 1, exp: 999, expNext: 10,
  hp: 50, maxHp: 100, mp: 10, maxMp: 20,
  baseAtk: 5, baseDef: 5, baseMaxHp: 100,
  atk: 5, def: 5, critChance: 0, dodgeChance: 0,
  talents: { points: 0 }, buffs: [], elRes: {}, elDmgBonus: {},
  healBonus: 0, corruption: 0, setCorruptionResist: 0,
  ci: 0, ri: 0, raceName: 'r', clsName: 'c',
  stunned: 0, slowed: 0, poisonTurns: 0, poisonDmg: 0,
  gold: 0, hunger: 100, maxHunger: 100, kills: 0, turns: 0,
  eq: { weapon: null, armor: null, accessory: null, accessory2: null }, inv: [], relics: [],
});

beforeEach(() => { vi.clearAllMocks(); });

describe('⑧ level-up fires fxAura', () => {
  it('checkLevelUp calls fxAura with gold color', () => {
    (globalThis as any).G = { player: mkPlayer(), enemies: [], items: [], floor: 1, gameOver: false, won: false };
    checkLevelUp();
    expect(fxAura).toHaveBeenCalledWith(5, 5, '#ffd700', 1.6);
  });
});
```

（落地/拾取两条 fx 在 attack 内联路径与 movePlayer 内联路径上，单测搭 G 成本高——**以本文件 level-up 断言 + Task 11 游戏内实测覆盖**；不为此抽取纯函数。）

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/__tests__/batch2-fx-wiring.test.ts`
Expected: FAIL（fxAura 未被调）

- [ ] **Step 3: 三处接线**

combat.ts:8 import 改 `import { fxFlash, fxBurst, fxAura } from './fx.js';`；i18n import 行加 RARITY_C。

:250 `flt(p.x, p.y, 'LEVEL UP!', '#ffd700'); snd('levelup'); checkAchs();` 行前加：
```ts
    fxAura(p.x, p.y, '#ffd700', 1.6);
```

:187 `G.items.push(loot);` 后加：
```ts
        fxBurst(loot.x, loot.y, RARITY_C[loot.rarity] || loot.c || '#c0c0c0', 6, 0.5);
```

player.ts：import 加 `import { fxFlash } from './fx.js';`；拾取分支（`for (const it of itemsHere) {` 行前）加：
```ts
      fxFlash(nx, ny, '#ffd700', 0.9);
```

- [ ] **Step 4: 跑测试 + 全量回归 + 提交**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 全绿

```bash
git add src/combat.ts src/player.ts src/__tests__/batch2-fx-wiring.test.ts
git commit -m "feat(juice): level-up aura + loot burst + pickup flash (batch2 ⑧)"
```

---

### Task 10: ⑨ 神龛大祝福 + ⑩ 净化方向 fx

**Files:**
- Modify: `src/events.ts`（checkTiles SHRINE 分支 ~:171-179 加 20% 大祝福）
- Modify: `src/combat.ts`（applyCorruption 跨档分支按 n 符号分流）
- Modify: `src/i18n.ts`（cb.tierCleansed）
- Test: `src/__tests__/batch2-polish.test.ts`（新建）

**Interfaces:**
- Consumes: `addCorruption` 返回 `{before, after, crossed, maxed}`（corruption.ts:56-60）、`TIER_LABEL/TIER_COLOR`（corruption.ts）
- Produces: 无新接口

- [ ] **Step 1: 写失败测试**

```ts
// src/__tests__/batch2-polish.test.ts
// 批2 ⑨⑩: shrine 4th outcome + cleanse-direction fx.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../state.js', () => ({ get G() { return (globalThis as any).G; }, lang: 'en' }));
vi.mock('../utils.js', () => ({ rng: () => 1, dst: () => 1, pick: (a: any[]) => a[0] }));
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../effects.js', () => ({ flt: vi.fn(), shake: vi.fn() }));
vi.mock('../fx.js', () => ({ fxFlash: () => {}, fxAura: vi.fn(), fxBurst: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: vi.fn() }));
vi.mock('../render.js', () => ({ updateUI: () => {}, render: () => {} }));
vi.mock('../items.js', () => ({ genItem: () => ({}), genWeapon: () => ({}), genArmor: () => ({}), genAcc: () => ({}), addItemWithOverflow: () => {}, itemToGold: () => 0 }));
vi.mock('../item-gen.js', () => ({ genEndlessGear: () => ({}) }));
vi.mock('../relics.js', () => ({ grantRelic: () => {}, hasRelic: () => false }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tMsg: (k: string, ...a: string[]) => a.reduce((s, x) => s.replace('{}', x), k), tx: (f: any) => f?.en ?? '' }));
vi.mock('../combat.js', async (im) => {
  const real = await im<typeof import('../combat.js')>();
  return { ...real, applyCorruption: real.applyCorruption };  // real combat: direction logic lives there
});
vi.mock('../enemy-factory.js', () => ({ makeEnemy: vi.fn() }));
vi.mock('../item-intro.js', () => ({ queueMechanicIntro: vi.fn() }));

import { checkTiles } from '../events.js';
import { applyCorruption } from '../combat.js';
import { shake } from '../effects.js';
import { TL } from '../config.js';

const mkG = (tile: number) => ({
  floor: 10, branchMode: false, gameOver: false,
  dungeon: { map: [[tile]], rooms: [], traps: [] },
  items: [], enemies: [],
  player: { x: 0, y: 0, corruption: 55, hp: 100, maxHp: 100, mp: 100, maxMp: 100, baseAtk: 5, baseDef: 5, baseMaxHp: 100, buffs: [], talents: { points: 0 }, exp: 0, expNext: 999, level: 1, critChance: 0, dodgeChance: 0, elRes: {}, elDmgBonus: {}, healBonus: 0, setCorruptionResist: 0, ci: 0, ri: 0, raceName: 'r', clsName: 'c', stunned: 0, slowed: 0, poisonTurns: 0, poisonDmg: 0, gold: 0, hunger: 100, maxHunger: 100, kills: 0, turns: 0, eq: { weapon: null, armor: null, accessory: null, accessory2: null }, inv: [], relics: [] },
});

beforeEach(() => { vi.clearAllMocks(); vi.spyOn(Math, 'random').mockReturnValue(0.5); });
afterEach(() => { vi.restoreAllMocks(); });

describe('⑨ shrine 20% powerful blessing', () => {
  it('random<0.2 grants all-three blessing', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    (globalThis as any).G = mkG(TL.SHRINE);
    checkTiles();
    const p = (globalThis as any).G.player;
    expect(p.baseAtk).toBe(7);        // 5 + 2
    expect(p.baseDef).toBe(7);
    expect(p.baseMaxHp).toBe(110);    // 100 + 10
  });
  it('random>=0.2 keeps 3-way roll (rng()=1 → atk path)', () => {
    (globalThis as any).G = mkG(TL.SHRINE);
    checkTiles();
    expect((globalThis as any).G.player.baseAtk).toBe(6);   // 5 + rng(1,2)=1
  });
});

describe('⑩ cleanse direction fx', () => {
  it('corruption DROP across a tier: green flt, no shake', () => {
    (globalThis as any).G = mkG(TL.FOUNTAIN);   // corruption 55 → -15 → 40 crosses a tier boundary
    checkTiles();
    expect(shake).not.toHaveBeenCalled();
  });
  it('corruption GAIN across a tier still shakes (regression pin)', () => {
    (globalThis as any).G = mkG(TL.CURSE);      // CURSE drains MP, not corruption — use direct call instead
    applyCorruption(5);                          // 55 + 5 may cross; assert by direct call with a crossing delta
    // direct: pick a delta that crosses — 55 is inside a tier; use 60→crosses at 60? boundary depends on TIER map.
    // Simpler pin: gain path DID shake when crossing. If 55+5 doesn't cross, this assertion is vacuous but harmless.
    expect(true).toBe(true);
  });
});
```

**实现注意**：第二个 gain 用例若无法稳定构造跨档（tier 边界未知），改成读 `corruption.ts` 的 TIER 阈值表来选一个必跨的起始 corruption——**不要留自欺式 vacuous 断言**：写成 `const start = <某档下界>; G.player.corruption = start; applyCorruption(5); expect(shake).toHaveBeenCalled();`（阈值表 corruption.ts:20-50 可读）。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/__tests__/batch2-polish.test.ts`
Expected: ⑨ FAIL（无 20% 分支）；⑩ FAIL（净化也 shake）

- [ ] **Step 3: events.ts SHRINE 分支**

`if (tile === TL.SHRINE) {`（events.ts:171）块内 `const b = rng(1, 3);` 前加：
```ts
    // Batch2 ⑨: 20% powerful blessing (revives the dead shrineBuff key).
    if (Math.random() < 0.2) {
      G.player.baseAtk += 2; G.player.baseDef += 2;
      G.player.baseMaxHp += 10; G.player.maxHp += 10; G.player.hp += 10;
      addMsg(t('shrineBuff'), 'ml');
      recalc(); snd('levelup'); fxAura(G.player.x, G.player.y, '#ffd700', 2);
      G.dungeon.map[G.player.y][G.player.x] = TL.FLOOR;
      return;
    }
```
（fxAura 需在 events.ts 的 fx import 中补上——现只有部分；`t('shrineBuff')` 键已存在 i18n.ts:66。）

- [ ] **Step 4: combat.ts 净化方向分流**

`if (r.crossed && r.after !== 'clean') {`（combat.ts:387）块改为：
```ts
  if (r.crossed && r.after !== 'clean') {
    queueMechanicIntro('corruption');   // Task 5 已加（若本 task 先于 Task 5 执行则省略此行——执行顺序按编号）
    const label = tx(TIER_LABEL[r.after]);
    if (n < 0) {
      // Batch2 ⑩: a cleanse that DROPS a tier reads as relief — green, no shake.
      addMsg(tMsg('cb.tierCleansed', label), 'md');
      flt(p.x, p.y, label.toUpperCase(), '#80ed99');
    } else {
      addMsg(`🟪 ${label}${t('cb.ellipsis')}`, 'md');
      flt(p.x, p.y, label.toUpperCase(), TIER_COLOR[r.after]);
      shake(1.5);
    }
    recalc(); // apply the new tier's mods immediately (both directions)
  }
```

i18n 加键：
```ts
  'cb.tierCleansed': { en: '🟢 {} — the corruption recedes.', zh: '🟢 {}——腐化退去了。' },
```

- [ ] **Step 5: 跑测试 + 全量回归 + 提交**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 全绿

```bash
git add src/events.ts src/combat.ts src/i18n.ts src/__tests__/batch2-polish.test.ts
git commit -m "feat(polish): shrine powerful blessing + cleanse-direction fx (batch2 ⑨⑩)"
```

---

### Task 11: 全量门 + 游戏内实测

**Files:**
- Create: `scripts/verify_batch2_ingame.py`（照 `scripts/verify_reconnect_ingame.py` 的 Vite dev server + ESM live import 同实例法）
- 无源码改动（本 task 只验证；发现的问题回注对应 task 修复后重跑）

**Interfaces:**
- Consumes: 全部前序 task

- [ ] **Step 1: 四门全过**

Run: `npx tsc --noEmit && npx vitest run && npm run build && python scripts/smoke_check.py`（smoke 脚本名以仓库实际为准——CI 四门对应的本地命令）
Expected: 全绿；记录测试总数（预期 ~400）

- [ ] **Step 2: 写游戏内实测脚本**

照 `verify_reconnect_ingame.py` 模式（Vite dev server 起服 + ESM `import()` 拿活体模块 + 直接调函数断言状态）。清单 10 项：

1. 造 F26 层 → 断言 ENEMIES 池含 Deep Mender 且 `shouldCastSkill` 在其受伤友军在场时可触发（直接调 `executeEnemySkill` 验 heal 数字）
2. Crypt Summoner `executeEnemySkill` → G.enemies +1
3. Void Blinker `executeEnemySkill` → 位置变为玩家相邻
4. 造 Boss（makeEnemy BOSSES[0]）→ `e.skill` 存在；actEnemies 单步（隔离环境）后 skillCd 被设置或 attack 被调——二选一断言
5. enterFloor(F5) 后 G.items 存在 `npc==='event'` 实体（mock Math.random=0.1 强制放置）→ triggerNpc 弹 popup → 点按钮 → G.eventFlags 置位
6. 首次 applyCorruption 跨档 → `#item-intro-content` 含 mcCorruptionTitle（或 introEnabled=false 时 seenMechanics 记录）
7. `document.documentElement.lang` 随 setLang('zh') 变 'zh'
8. `pickItemTemplate({spriteKind:'CHEST',...}).key === 'CHEST'`；`TEMPLATES.PORTAL` 16×16
9. `shouldBossReveal` + visible 矩阵 → checkBossReveal 后 fxAura 调用（活体 fx 数组长度变化亦可）
10. checkTiles SHRINE with Math.random=0.1 → baseAtk/baseDef/baseMaxHp 三加；applyCorruption(-15) 跨档后 shake 未发生（effects 内部状态）

每项 PASS/FAIL 汇总输出，10/10 才算过。

- [ ] **Step 3: 跑实测脚本至 10/10**

Run: `python scripts/verify_batch2_ingame.py`
Expected: `10/10 PASS`

- [ ] **Step 4: 提交 + push + CI**

```bash
git add scripts/verify_batch2_ingame.py
git commit -m "test(e2e): in-game verification script for batch 2 (live-module imports via dev server)"
git push origin main
```
Expected: CI 四门绿（Actions typecheck/vitest/build/smoke）

---

## Self-Review 记录

- **Spec 覆盖**：spec ①→T1、②→T2、③→T3+T4、④→T5、⑤→T6、⑥→T7、⑦→T8、⑧→T9、⑨⑩→T10、验证节→T11。spec「新增 i18n key 清单」四组分别在 T3/T4/T5/T6/T10 落地。✓
- **占位符扫描**：T2 Step 4 的 Creator 段有一行带 `as any` 的示例占位（已用粗体标注"不要写入"并给出正解行）；T10 Step 1 的 gain 回归用例标注了必须改为真断言不许留 vacuous。除此之外无 TBD/TODO。✓
- **类型一致性**：`EventSiteDef`/`eligibleEventSites`（event-sites.ts 定义，game.ts/events.ts 消费）；`queueMechanicIntro(id: string): void`（T5 定义，combat/enemies/game 消费，T8/T9 测试 mock 同名）；`shouldBossReveal(e, vis)`/`checkBossReveal()`（T8 定义，dungeon 消费）；`pickItemTemplate`（T7 导出，测试消费）。✓
- **执行顺序**：T10 依赖 T5 的 queueMechanicIntro（combat 跨档处）——按编号执行即可；T2/T5/T8/T9 测试都 mock `enemy-skills`/`item-intro` 等晚依赖，mock 集合以各自文件列出的为准，冲突时以「能编译+断言过」微调（mock 多列无害）。✓
- **Self-Review 修正**：① Player 装备槽是 `p.eq.weapon`（types.ts Equipment:397-402 + Player.eq:426），计划内 4 处 `p.weapon`/mkG 字段已改 `eq`；② `makeEnemy` 确认在 `src/enemy-factory.ts:34` 导出，测试 import/mock 路径 `../enemy-factory.js` 无误。✓
