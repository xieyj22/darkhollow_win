# 批9「体验缝合」Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地 7 项游玩体验修复：道具栏放大+名条 / UI 温和精修 / 商人常驻 / 小地图跨层持久 / 售卖 bug 收口 / 宝藏商人降价 / tooltip 时机。

**Architecture:** 全部为既有流程上的点状修改——DOM hotbar 与 CSS token 层出手、地图实体删除逻辑改条件化、模块级状态生命周期收口、tooltip 加目标校验钩子。无新系统、无数据迁移。

**Tech Stack:** TypeScript + Vite + happy-dom/vitest（单测）+ playwright python 脚本（in-game battery，`scripts/verify_*_ingame.py` 模式）。

**Spec:** `docs/superpowers/specs/batch9-experience-polish/TECH.md`（规格与本计划同读）

## Global Constraints

- 基线 `main@a00504c`；开工先建分支 `feat/batch9-experience-polish`；开工前 `npx vitest run` 基线 530 全绿。
- 提交信息用仓库惯例前缀：`feat(batch9):` / `fix(batch9):` / `test(batch9):`。
- **不改任何既有 DOM id/class**；唯一新增 DOM 节点 `#hb-name`（`aria-hidden="true"`）。`.hb-slot` 的 `tabindex="0"`/`role="button"` 必须保留（批3A 手柄导航，gamepad 22 e2e 是硬门）。
- 新增用户可见文案一律走 `src/i18n.ts` en+zh 双语（批7 parity 门会扫）。
- 过渡动画一律包 `@media (prefers-reduced-motion: no-preference)`（仓库既有 5 站点约定）。
- happy-dom 无 canvas2d：单测凡触渲染一律 `vi.mock('../sprites.js', ...)` 掉 paint* 函数。
- Windows bash，仓库根 `E:\claude\darkhollow`；tsc 必须裸跑看 exit code（管道会吞）。
- 每任务收尾：`npx vitest run <本任务测试文件>` 绿 + 全量 `npx vitest run` 不退步 + commit。

---

### Task 1: 售卖 bug 收口（spec T5）

**Files:**
- Modify: `src/panels.ts:19-30`（openInventory/openInventorySell）
- Modify: `src/main.ts:160`（✕ 按钮）
- Test: `src/__tests__/batch9-sell-mode.test.ts`（新建）
- Test: 同文件内加 source-gate（main.ts ✕ 路径）

**Interfaces:**
- Produces: `openInventory(opts?: { sell?: boolean }): void`（无参调用重置 `sellMode=false`）；`closeInventory()` 不变（已清 sellMode）。后续任务无人消费。

- [ ] **Step 1: 写失败测试**

```ts
// 批9 ⑥: 售卖态生命周期 = 本次背包开启。✕ 关闭走 closeInventory 收口；
// 非商人入口重开背包必须重置 sellMode（此前鼠标流泄漏：数字键继续卖货）。
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../state.js', () => ({
  G: { gameOver: false, player: { inv: [], quickSlots: [] } },
  lang: 'en',
  setInvOpen: vi.fn(),
}));
vi.mock('../ui-panels.js', () => ({ showOverlay: vi.fn(), hideOverlay: vi.fn() }));
vi.mock('../items.js', () => ({
  sellItem: vi.fn(), equipItem: vi.fn(), useItem: vi.fn(), dropItem: vi.fn(),
  assignToQuickSlot: vi.fn(), itemToGold: () => 10, useQuickSlot: vi.fn(),
}));
vi.mock('../skills.js', () => ({ executeSkill: vi.fn() }));
vi.mock('../meta.js', () => ({ getMeta: () => ({}) }));
vi.mock('../i18n.js', () => ({
  t: (k: string) => k, tMsg: (k: string) => k, tx: (k: string) => k,
  RARITY_C: ['#888', '#8bc34a', '#4fc3f7', '#b39ddb', '#ffd700'],
}));
vi.mock('../data.js', () => ({ RELICS: [] }));
vi.mock('../sprites.js', () => ({ paintIcon: vi.fn(), paintItemIcon: vi.fn(), paintRelicIcon: vi.fn() }));
vi.mock('../bridge.js', () => ({ bridge: {} }));
vi.mock('../combat.js', () => ({ recalc: () => {}, checkLevelUp: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: vi.fn() }));

import { readFileSync } from 'node:fs';
import { sellMode, openInventory, closeInventory } from '../panels.js';

describe('批9 ⑥ sellMode 生命周期', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="inv-content"></div>';
  });
  it('openInventory({sell:true}) 置售卖态', () => {
    openInventory({ sell: true });
    expect(sellMode).toBe(true);
  });
  it('普通 openInventory() 重置售卖态（bug 修复点）', () => {
    openInventory({ sell: true });
    openInventory();               // 键盘 b / 手柄重开路径
    expect(sellMode).toBe(false);  // 现状: true ← 红
  });
  it('closeInventory 清售卖态（回归）', () => {
    openInventory({ sell: true });
    closeInventory();
    expect(sellMode).toBe(false);
  });
  it('source-gate: main.ts ✕ 按钮走 closeInventory 收口', () => {
    const text = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');
    expect(text).toContain("on('btn-close-inv', () => { closeInventory(); })");
    expect(text).not.toContain("on('btn-close-inv', () => { setInvOpen(false); hideOverlay('inventory-overlay'); })");
  });
});
```

- [ ] **Step 2: 跑测试确认红**

Run: `npx vitest run src/__tests__/batch9-sell-mode.test.ts`
Expected: FAIL（`sellMode` 为 true + source-gate 不匹配）

- [ ] **Step 3: 最小实现**

`src/panels.ts:19-24` 改为：

```ts
export function openInventory(opts?: { sell?: boolean }): void {
  // 批9 ⑥: 售卖态只在"从商人入口打开"时成立，任何普通重开都归位。
  if (!opts?.sell) sellMode = false;
  setInvOpen(true);
  showOverlay('inventory-overlay');
  renderInv();
}
function openInventorySell(): void { openInventory({ sell: true }); }
```

`src/main.ts:160` 改为（并把 `closeInventory` 加进 main.ts 顶部对 `./panels.js` 的既有 import；若 main.ts 未引 panels 则新增 import 行）：

```ts
  on('btn-close-inv', () => { closeInventory(); });
```

- [ ] **Step 4: 跑测试确认绿 + 全量回归**

Run: `npx vitest run src/__tests__/batch9-sell-mode.test.ts && npx vitest run`
Expected: 新文件 4 绿；全量 530+4 不退步

- [ ] **Step 5: Commit**

```bash
git add src/panels.ts src/main.ts src/__tests__/batch9-sell-mode.test.ts
git commit -m "fix(batch9): sell mode scoped to one inventory session — ✕-close funnels through closeInventory, plain reopen resets"
```

---

### Task 2: 小地图跨层持久（spec T4）

**Files:**
- Modify: `src/render.ts:244-245`（resizeCanvas 读 minimapScale）
- Test: `src/__tests__/batch9-minimap.test.ts`（新建，source-gate）

**Interfaces:**
- Consumes: `minimapScale` 已由 `src/state.ts:61` 导出（`export let minimapScale`）。
- Produces: 无新接口；行为由 in-game battery（Task 8）验证。

- [ ] **Step 1: 写失败测试（source-gate 风格，改不动 DOM 不足以单测 canvas 尺寸——行为归 battery）**

```ts
// 批9 ⑤: resizeCanvas 尊重 minimapScale（此前硬编码 MW*3，开局/读档/窗口变化打回默认）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('批9 ⑤ resizeCanvas 尊重 minimapScale', () => {
  const text = readFileSync(new URL('../render.ts', import.meta.url), 'utf8');
  it('画布尺寸用 minimapScale 而非硬编码 3', () => {
    expect(text).toContain('mc.width = MW * minimapScale');
    expect(text).toContain('mc.height = MH * minimapScale');
    expect(text).not.toContain('mc.width = MW * 3');
  });
  it('render.ts 从 state.js 引入 minimapScale', () => {
    const m = text.match(/import \{[^}]*\} from '\.\/state\.js';/);
    expect(m?.[0]).toMatch(/minimapScale/);
  });
});
```

- [ ] **Step 2: 跑测试确认红**

Run: `npx vitest run src/__tests__/batch9-minimap.test.ts`
Expected: FAIL（仍是 `MW * 3`）

- [ ] **Step 3: 最小实现**

`src/render.ts:244-245` 改为，并在文件顶部对 `./state.js` 的既有 import 中加入 `minimapScale`（resizeCanvas 已在 254 行置 `minimapCanvas = null` 使缓存失效，无需额外重画调用）：

```ts
  mc.width = MW * minimapScale;
  mc.height = MH * minimapScale;
```

- [ ] **Step 4: 跑测试确认绿 + 全量回归**

Run: `npx vitest run src/__tests__/batch9-minimap.test.ts && npx vitest run`
Expected: 2 绿；全量不退步

- [ ] **Step 5: Commit**

```bash
git add src/render.ts src/__tests__/batch9-minimap.test.ts
git commit -m "fix(batch9): resizeCanvas honors minimapScale — zoom survives new game / load / window resize"
```

---

### Task 3: 商人常驻（spec T3）

**Files:**
- Create: `src/npc-rules.ts`（纯叶子模块，仿 endings.ts/epitaph.ts 先例）
- Modify: `src/player.ts:94-98`（条件删除）
- Modify: `src/events.ts:296`（宝藏库存只 roll 一次）+ `openTreasureMerchant` 售罄分支
- Modify: `src/i18n.ts`（`ev.treasureSoldOut` en/zh）
- Test: `src/__tests__/batch9-merchant-persist.test.ts`（新建）

**Interfaces:**
- Produces: `npcPersists(npc: unknown): boolean`（`src/npc-rules.ts`）——player.ts 消费；Task 4/8 不消费。
- Produces: i18n 键 `ev.treasureSoldOut`（en: `"Sold out — nothing left but the lantern's glow."` / zh: `"售罄——只剩提灯的光了。"`）。

- [ ] **Step 1: 写失败测试**

```ts
// 批9 ④: 商人常驻（三类），宝箱/事件站仍"删后触发"。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { npcPersists } from '../npc-rules.js';

describe('批9 ④ npcPersists', () => {
  it('三类商人常驻', () => {
    expect(npcPersists('merchant')).toBe(true);
    expect(npcPersists('treasure_merchant')).toBe(true);
    expect(npcPersists('endless_merchant')).toBe(true);
  });
  it('宝箱与事件站仍消耗', () => {
    expect(npcPersists('chest')).toBe(false);
    expect(npcPersists('event')).toBe(false);
    expect(npcPersists(undefined)).toBe(false);
  });
  it('player.ts 消费 npcPersists 做条件删除（source-gate）', () => {
    const text = readFileSync(new URL('../player.ts', import.meta.url), 'utf8');
    expect(text).toContain('if (!npcPersists(npcEntity.npc)) G.items = G.items.filter(i => i !== npcEntity)');
  });
  it('宝藏库存只 roll 一次，售罄有文案（source-gate）', () => {
    const text = readFileSync(new URL('../events.ts', import.meta.url), 'utf8');
    expect(text).toContain('if (!entity.stock) entity.stock = rollTreasureStock()');
    expect(text).not.toContain('if (!entity.stock || entity.stock.length === 0) entity.stock = rollTreasureStock()');
    expect(text).toContain("t('ev.treasureSoldOut')");
  });
});
```

- [ ] **Step 2: 跑测试确认红**

Run: `npx vitest run src/__tests__/batch9-merchant-persist.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 最小实现**

新建 `src/npc-rules.ts`：

```ts
// Batch9 ④: which stepped-on map entities persist after interaction.
// Merchants stay on the map for the rest of the floor (re-interactable);
// chests and event sites are consumed once, exactly as before.
export function npcPersists(npc: unknown): boolean {
  return npc === 'merchant' || npc === 'treasure_merchant' || npc === 'endless_merchant';
}
```

`src/player.ts:94-98` 改为（文件顶部 import 加入 `./npc-rules.js`）：

```ts
    const npcEntity = itemsHere.find(i => i.npc);
    if (npcEntity) {
      // Batch9 ④: merchants persist on the map — only chests/event sites are consumed.
      if (!npcPersists(npcEntity.npc)) G.items = G.items.filter(i => i !== npcEntity);
      triggerNpc(npcEntity);
    }
```

`src/events.ts:296` 改为，并在 `openTreasureMerchant` 的库存渲染处（299 行起，读现有代码找 buttons 渲染循环）加售罄分支——`stock.length === 0` 时 desc 区显示 `t('ev.treasureSoldOut')` 且不渲染购买按钮，只留离开：

```ts
  if (!entity.stock) entity.stock = rollTreasureStock();
```

`src/i18n.ts` 在 `ev.treasureDesc` 邻近加：

```ts
  'ev.treasureSoldOut': { en: "Sold out — nothing left but the lantern's glow.", zh: '售罄——只剩提灯的光了。' },
```

（键结构以 i18n.ts 现有 `ev.*` 条目写法为准，en/zh 必须成对。）

- [ ] **Step 4: 跑测试确认绿 + 全量回归**

Run: `npx vitest run src/__tests__/batch9-merchant-persist.test.ts && npx vitest run`
Expected: 4 绿；全量不退步

- [ ] **Step 5: Commit**

```bash
git add src/npc-rules.ts src/player.ts src/events.ts src/i18n.ts src/__tests__/batch9-merchant-persist.test.ts
git commit -m "feat(batch9): merchants persist on the floor — re-interactable shops, treasure stock rolled once with sold-out copy"
```

---

### Task 4: 宝藏商人降价（spec T6）

**Files:**
- Modify: `src/events.ts:273-276`（treasurePrice 导出 + 新数值）
- Test: `src/__tests__/batch9-treasure-price.test.ts`（新建）

**Interfaces:**
- Consumes: Task 3 已改 events.ts（同文件先后编辑，无冲突）。
- Produces: `export function treasurePrice(it: Item): number`（原为模块私有，导出以供测试）。

- [ ] **Step 1: 写失败测试**

```ts
// 批9 ⑦: 宝藏商人对齐金币曲线（每层拾金 ≈ 50+15×floor，F1-5 累计 ≈475）。
// 新价: base r3=420 r4=880 + floor×8 → F5 460/920、F20 580/1040、F40 740/1200。
import { describe, it, expect, vi } from 'vitest';

let floor = 5;
vi.mock('../state.js', () => ({
  G: { get floor() { return floor; } },
  lang: 'en',
  setEventOpen: vi.fn(), setEventActions: vi.fn(),
}));
// 其余 vi.mock 前言照抄 src/__tests__/batch2-event-sites.test.ts 的 mock 集
// （events.ts 的 import 图）；若 events.ts 此后新增 import，同步补 mock。
/* === 此处粘贴 batch2-event-sites.test.ts 的全部 vi.mock 块 === */

import { treasurePrice } from '../events.js';

const it3 = { rarity: 3 } as any, it4 = { rarity: 4 } as any;
describe('批9 ⑦ treasurePrice', () => {
  it('F5', () => { floor = 5; expect(treasurePrice(it3)).toBe(460); expect(treasurePrice(it4)).toBe(920); });
  it('F20', () => { floor = 20; expect(treasurePrice(it3)).toBe(580); expect(treasurePrice(it4)).toBe(1040); });
  it('F40', () => { floor = 40; expect(treasurePrice(it3)).toBe(740); expect(treasurePrice(it4)).toBe(1200); });
});
```

- [ ] **Step 2: 跑测试确认红**

Run: `npx vitest run src/__tests__/batch9-treasure-price.test.ts`
Expected: FAIL（treasurePrice 未导出 / 数值旧）

- [ ] **Step 3: 最小实现**

`src/events.ts:273-276` 改为：

```ts
export function treasurePrice(it: Item): number {
  // 批9 ⑦: realigned to the gold curve (piles ≈ 50+15×floor per floor) — r3/r4
  // were 1200/2400+18f, unreachable before F15. Dead r0-2 branches kept as-is.
  const base = [150, 320, 640, 420, 880][it.rarity] || 150;
  return base + (G ? G.floor * 8 : 0);
}
```

- [ ] **Step 4: 跑测试确认绿 + 全量回归**

Run: `npx vitest run src/__tests__/batch9-treasure-price.test.ts && npx vitest run`
Expected: 3 绿；全量不退步

- [ ] **Step 5: Commit**

```bash
git add src/events.ts src/__tests__/batch9-treasure-price.test.ts
git commit -m "feat(batch9): treasure merchant prices realigned to gold curve — 1200/2400+18f to 420/880+8f"
```

---

### Task 5: 道具栏放大 + 常驻名条（spec T1）

**Files:**
- Modify: `src/items.ts:273-312`（renderHotbar：去 title 加 aria-label、插 #hb-name、焦点联动）
- Modify: `style/main.css:301-317`（slot 50px / icon 24px / 单行省略 / mobile 54px / #hb-name 样式）
- Test: `src/__tests__/batch9-hotbar.test.ts`（新建）

**Interfaces:**
- Produces: `#hb-name` DOM 节点（renderHotbar 每次重建，`aria-hidden`）。Task 6 的 hotbar tooltip 委托依赖 `.hb-slot[data-qs]`（不变）。

- [ ] **Step 1: 写失败测试**

```ts
// 批9 ①: 格子放大由 CSS 承担（battery 目检），单测锁：无 title 双提示、
// aria-label 在、名条节点在且随焦点更新。
import { describe, it, expect, vi, beforeEach } from 'vitest';

const potion = { type: 'potion', name: '生命药水', desc: '回复生命', rarity: 0, ef: 'heal', val: 20 };
vi.mock('../state.js', () => ({ G: { floor: 1, gameOver: false, player: { inv: [potion], quickSlots: [potion, null, null, null, null, null, null, null, null] } }, lang: 'zh' }));
vi.mock('../utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils.js')>();
  return { ...actual, rng: () => 0, pick: <T,>(a: T[]) => a[0], dst: () => 1 };
});
vi.mock('../sprites.js', () => ({ paintItemIcon: vi.fn(), paintIcon: vi.fn(), paintRelicIcon: vi.fn() }));
vi.mock('../combat.js', () => ({ recalc: () => {}, checkLevelUp: () => {}, killEnemy: () => {}, applyCorruption: () => {}, playerDeath: () => {} }));
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../effects.js', () => ({ flt: () => {} }));
vi.mock('../fx.js', () => ({ fxFlash: () => {}, fxBeam: () => {}, fxBolt: () => {}, fxBurst: () => {}, fxAura: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: () => {} }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tMsg: (k: string) => k, tx: (k: string) => k, RARITY_C: ['#888', '#8bc34a', '#4fc3f7', '#b39ddb', '#ffd700'] }));

import { renderHotbar } from '../items.js';

describe('批9 ① hotbar', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="hotbar"></div>'; });
  it('无 title 属性（消灭 OS 双提示）', () => {
    renderHotbar();
    const slot = document.querySelector('.hb-slot')!;
    expect(slot.getAttribute('title')).toBeNull();
  });
  it('aria-label 携带道具名（无障碍承接）', () => {
    renderHotbar();
    expect(document.querySelector('.hb-slot')!.getAttribute('aria-label')).toContain('生命药水');
  });
  it('#hb-name 存在且 aria-hidden', () => {
    renderHotbar();
    const nb = document.getElementById('hb-name')!;
    expect(nb.getAttribute('aria-hidden')).toBe('true');
  });
  it('焦点格全名进名条', () => {
    renderHotbar();
    const slot = document.querySelector('.hb-slot') as HTMLElement;
    slot.focus();
    slot.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(document.getElementById('hb-name')!.textContent).toContain('生命药水');
  });
});
```

- [ ] **Step 2: 跑测试确认红**

Run: `npx vitest run src/__tests__/batch9-hotbar.test.ts`
Expected: FAIL（title 属性仍在 / #hb-name 不存在）

- [ ] **Step 3: 最小实现**

`src/items.ts` renderHotbar：288 行 slot 模板去掉 `title="${item.name}: ${item.desc}"` 换成 `aria-label="${item.name}: ${item.desc}"`（注意 name/desc 需转义——沿用仓库 `escAttr` 帮助函数若 i18n.ts 已导出，批7 M2 加过）；`hb.innerHTML = html` 前面拼一行名条、循环后绑定焦点：

```ts
  hb.innerHTML = `<div id="hb-name" aria-hidden="true"></div>` + html;
  // …既有 canvas paint 与 click/keydown 绑定不动…
  const namebar = hb.querySelector('#hb-name') as HTMLElement;
  const setNamebar = () => {
    const active = document.activeElement as HTMLElement | null;
    const qs = active?.closest?.('.hb-slot')?.getAttribute('data-qs');
    const item = qs != null ? p.quickSlots[+qs] : null;
    namebar.textContent = item ? item.name : '';
  };
  hb.addEventListener('focusin', setNamebar);
  setNamebar(); // innerHTML 重渲染吞焦点后，从 activeElement 恢复
```

`style/main.css`（301-317 区域）：

```css
.hb-slot { width: 50px; height: 50px; border: 2px solid var(--border-default); border-radius: var(--radius-md); /* 余下属性保持原样 */ }
canvas.hb-icon { width: 24px; height: 24px; }
.hb-slot .hb-sub { font-size: 11px; /* 固定小号保 4 字单行；完整名走 #hb-name（随 --fs-scale 缩放） */ max-width: 46px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center; line-height: 1.15; }
#hb-name { flex-basis: 100%; min-height: 1.2em; font-size: var(--fs-floor); color: var(--text-secondary); text-align: center; }
```

（原 `.hb-sub` 的 `display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical` 三行删除；移动端断点 `.hb-slot{max-width:44px}` → `54px`。）

- [ ] **Step 4: 跑测试确认绿 + 全量回归**

Run: `npx vitest run src/__tests__/batch9-hotbar.test.ts && npx vitest run`
Expected: 4 绿；全量不退步

- [ ] **Step 5: Commit**

```bash
git add src/items.ts style/main.css src/__tests__/batch9-hotbar.test.ts
git commit -m "feat(batch9): hotbar slots 50px with persistent name plate — no native title, full name on focus"
```

---

### Task 6: tooltip 时机（spec T7）

**Files:**
- Modify: `src/ui-panels.ts:100-182`（initTooltip 目标缓存 + validateTooltip 导出 + initFocusTooltips 记录元素 + hotbar/inv DOM 委托）
- Modify: `src/render.ts`（updateUI 末尾 `bridge.validateTooltip?.()`）
- Modify: `src/bridge.ts`（`validateTooltip?: () => void` 可选字段）
- Modify: `src/main.ts`（bridge 接线处，约 65 行区域，`bridge.validateTooltip = validateTooltip`）
- Test: `src/__tests__/batch9-tooltip.test.ts`（新建）

**Interfaces:**
- Consumes: Task 5 后 hotbar 无 title（focus tooltips 不再依赖 hotbar title）；`.hb-slot[data-qs]`、`.ii [data-idx]` 选择器。
- Produces: `export function validateTooltip(): void`（ui-panels.ts）→ bridge 可选回调 → updateUI 每回合消费。

- [ ] **Step 1: 写失败测试**

```ts
// 批9 ⑧: 目标失效 tooltip 秒隐。焦点路径可单测（happy-dom）；鼠标路径由 battery 覆盖。
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../state.js', () => ({ G: null, lang: 'en' }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tMsg: (k: string) => k, tx: () => 'x', rareName: () => 'r', RARITY_C: ['#888', '#8bc34a', '#4fc3f7', '#b39ddb', '#ffd700'] }));
vi.mock('../sprites.js', () => ({ paintIcon: vi.fn() }));

import { initFocusTooltips, validateTooltip } from '../ui-panels.js';

describe('批9 ⑧ tooltip 目标校验', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="tooltip" style="display:none"></div>';
    initFocusTooltips();
  });
  it('focusin 显示焦点 tooltip', () => {
    const el = document.createElement('button');
    el.title = '天赋说明';
    document.body.appendChild(el);
    el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(document.getElementById('tooltip')!.style.display).toBe('block');
  });
  it('元素被 innerHTML 重渲染移除后 validateTooltip 隐藏（无 focusout 场景）', () => {
    const el = document.createElement('button');
    el.title = '天赋说明';
    document.body.appendChild(el);
    el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    el.remove(); // 焦点静默回落 body，浏览器不派发 focusout
    validateTooltip();
    expect(document.getElementById('tooltip')!.style.display).toBe('none');
  });
  it('source-gate: updateUI 每回合消费 bridge.validateTooltip', () => {
    const text = readFileSync(new URL('../render.ts', import.meta.url), 'utf8');
    expect(text).toContain('bridge.validateTooltip?.()');
  });
  it('source-gate: hotbar/背包 DOM 委托已接管（无原生 title 兜底）', () => {
    const text = readFileSync(new URL('../ui-panels.ts', import.meta.url), 'utf8');
    expect(text).toContain("getElementById('hotbar')");
    expect(text).toContain("getElementById('inv-content')");
  });
});
```

（`readFileSync` 顶部补 `import { readFileSync } from 'node:fs';`。）

- [ ] **Step 2: 跑测试确认红**

Run: `npx vitest run src/__tests__/batch9-tooltip.test.ts`
Expected: FAIL（validateTooltip 未导出）

- [ ] **Step 3: 最小实现**

`src/ui-panels.ts`：showTooltip 成功分支末尾统一记 `ttTile = { mx, my }`（else 分支置 null）；把 enemy/item/trap/tile 查找链抽成 `findTtTarget(mx, my)` 供 showTooltip 与校验共用；模块级 `let ttFocusEl: HTMLElement | null = null;`，focusin 里 `ttFocusEl = el`，focusout 置 null。新增：

```ts
// Batch9 ⑧: hide tooltips whose target vanished (keyboard kills/walk-aways,
// and innerHTML re-renders that silently swallow focus without focusout).
export function validateTooltip(): void {
  const tt = document.getElementById('tooltip');
  if (!tt || tt.style.display === 'none') return;
  if (ttFocusEl && !document.contains(ttFocusEl)) { tt.style.display = 'none'; tt.innerHTML = ''; return; }
  if (ttTile && G && !findTtTarget(ttTile.mx, ttTile.my)) { tt.style.display = 'none'; tt.style.borderColor = ''; }
}
```

initTooltip 末尾加 DOM 委托（复用 #tooltip，mouseenter 类事件用 mouseover 委托 + 容器 mouseleave 直隐藏，无防抖）：

```ts
  const bindDom = (rootId: string, resolve: (el: HTMLElement) => { name: string; desc: string; color: string } | null) => {
    const root = document.getElementById(rootId);
    if (!root) return;
    root.addEventListener('mouseover', (e) => {
      const hit = resolve(e.target as HTMLElement);
      if (!hit) return;
      tt.innerHTML = `<div class="ttn" style="color:${hit.color}">◆ ${hit.name}</div><div class="ttd">${hit.desc}</div>`;
      tt.style.display = 'block'; tt.style.left = (e.clientX + 15) + 'px'; tt.style.top = (e.clientY + 15) + 'px';
    });
    root.addEventListener('mouseleave', () => { tt.style.display = 'none'; tt.innerHTML = ''; });
  };
  bindDom('hotbar', (el) => {
    const qs = el.closest?.('.hb-slot')?.getAttribute('data-qs');
    const item = qs != null && G ? G.player.quickSlots[+qs] : null;
    return item ? { name: item.name, desc: item.desc, color: RARITY_C[item.rarity] } : null;
  });
  bindDom('inv-content', (el) => {
    const idxAttr = el.closest?.('.ii')?.querySelector('canvas[data-idx]')?.getAttribute('data-idx');
    const item = idxAttr != null && G ? G.player.inv[+idxAttr] : null;
    return item ? { name: item.name, desc: item.desc, color: RARITY_C[item.rarity] } : null;
  });
```

`src/render.ts` updateUI 函数体末尾加 `bridge.validateTooltip?.();`；`src/bridge.ts` 类型加 `validateTooltip?: () => void;`；`src/main.ts` bridge 接线区（65 行附近）加 `bridge.validateTooltip = validateTooltip;`（import 自 `./ui-panels.js`）。

- [ ] **Step 4: 跑测试确认绿 + 全量回归**

Run: `npx vitest run src/__tests__/batch9-tooltip.test.ts && npx vitest run`
Expected: 4 绿；全量不退步

- [ ] **Step 5: Commit**

```bash
git add src/ui-panels.ts src/render.ts src/bridge.ts src/main.ts src/__tests__/batch9-tooltip.test.ts
git commit -m "fix(batch9): tooltip dies with its target — per-turn validation, DOM-delegate tooltips for hotbar/inventory"
```

---

### Task 7: UI 温和精修（spec T2，纯 CSS）

**Files:**
- Modify: `style/main.css`（只改属性值/新增规则，不动选择器结构与 DOM）

**Interfaces:** 无。约束：不新增/删除选择器所依附的 DOM 结构；全部过渡包 reduced-motion。

- [ ] **Step 1: 落 CSS 五件套**

1. 消息日志顶部渐隐：`#log-panel .log-body`（实际滚动容器以 main.css 现状为准）加
   `mask-image: linear-gradient(to bottom, transparent 0, #000 18px);`
2. 侧栏数值对齐：`#sidebar .stat-row, #log-panel` 相关数值元素加 `font-variant-numeric: tabular-nums;`
3. 按钮统一 hover/active：为 `button, .inv-act` 类既有规则补
   `transition: border-color var(--dur-fast) var(--ease-ui), background-color var(--dur-fast) var(--ease-ui);`
   与 `:hover { border-color: var(--border-bright); }`（包进 `@media (prefers-reduced-motion: no-preference)` 的是 transition，颜色变化本身保留）
4. 焦点环统一：可聚焦单元格既有 focus 样式核对为 `outline: 2px solid var(--accent-blue); outline-offset: 1px;` 不一致处统一
5. 面板标题统一：`#sidebar h3, .panel-title` 类（以现状为准）统一 `font-size: var(--fs-sm); letter-spacing: 0.05em; color: var(--text-secondary);`

- [ ] **Step 2: 目检不回归**

Run: `npm run build && npx vite preview` + 手开页面（或直接进 Task 8 的 battery 截图）
Expected: smoke 65 检查全过、面板无错位、hc/textScale 模式无破坏

- [ ] **Step 3: 全量回归 + Commit**

Run: `npx vitest run`
Expected: 不退步

```bash
git add style/main.css
git commit -m "feat(batch9): gentle UI polish pass — log fade mask, tabular numerals, unified hover/focus/title tokens"
```

---

### Task 8: 收尾——battery + 七门全绿 + review

**Files:**
- Create: `scripts/verify_batch9_ingame.py`（launcher 样板照抄 `scripts/verify_batch7_ingame.py` 的 dev-server 起/杀与 CDP 连接骨架）
- 无源码改动（发现问题回对应任务修）

**Interfaces:** Consumes 全部前序任务的运行时行为。

- [ ] **Step 1: 写 in-game battery（playwright python，走 Vite dev server + ESM live import 同实例法）**

断言清单（每条独立 try/except 汇总，末尾 exit code）：
1. **商人常驻**：造图找到 merchant → 走上去弹店 → ESC 关 → 实体仍在渲染列表、再踏上二次弹店
2. **售卖收口**：商人处 [2] 出售 → 卖 1 件 → ✕ 关背包 → 按 b 重开 → 数字键按下后金币与物品数不变
3. **小地图持久**：settings 设 minimap=5 → 下两层 → minimap-canvas width === 70*5
4. **宝藏价格**：F5 造宝藏商人，UI 价格 ≤ 460/920 断言
5. **tooltip**：悬停敌人 → 键盘击杀 → 一回合内 tooltip display none
6. **道具栏**：slot computed width === 50px；聚焦格后 #hb-name 含全名；slot 无 title 属性

- [ ] **Step 2: 七门全绿**

Run（顺序，tsc 裸跑）:
```bash
npx vitest run && npm run typecheck && npm run build && python scripts/smoke_out && python scripts/verify_gamepad_ingame.py && python scripts/verify_batch9_ingame.py
```
（smoke/gamepad 脚本名以 scripts/ 现状为准；CI 四门 = typecheck/vitest/build/smoke。）
Expected: 全绿，零 console 错误

- [ ] **Step 3: 代码审查**

invoke superpowers:requesting-code-review（对照 spec TECH.md 的 B1-B9 不变量），意见处置走 superpowers:receiving-code-review。

- [ ] **Step 4: 终验 + 汇报**

invoke superpowers:verification-before-completion：贴各门输出原文（不信口头"绿"），向用户汇报后**停下等裁决**（merge/继续调整）。merge 走 superpowers:finishing-a-development-branch（ff-merge main + push origin + 删分支，Verge 代理照旧 curl 验通再推）。

---

## Self-Review 记录

- **Spec 覆盖**: spec T1→Task5、T2→Task7、T3→Task3、T4→Task2、T5→Task1、T6→Task4、T7→Task6、B1-B9→各任务测试+Task8 battery。无缺口。
- **占位符扫描**: Task4 测试的 vi.mock 前言标注"照抄 batch2-event-sites.test.ts"并要求实现者核对 events.ts 现行 import 图——这是有意的防漂移指令，非占位；其余步骤全部带完整代码。
- **类型/命名一致性**: `npcPersists`（Task3 定义 = player.ts 消费）；`openInventory(opts?: {sell?: boolean})`（Task1）；`validateTooltip`/`bridge.validateTooltip?.()`（Task6 三处一致）；`#hb-name`（Task5 产、Task8 断言）。
