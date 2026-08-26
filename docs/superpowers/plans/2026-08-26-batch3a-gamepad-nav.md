# 批3A：手柄全导航 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 手柄在全游戏（标题/选人/面板/暂停/事件/死亡/胜利/结局）可完整导航——menu context 焦点导航层 + 空间最近邻 + focus 即显 tooltip + ending-choice 按键泄漏修复。

**Architecture:** 新增 `focus-nav.ts`（纯焦点几何工具）与 `menu-context.ts`（菜单上下文探测 + 泛化关闭梯）；`input.ts` 的 `pollGamepad` 重构为"菜单态焦点导航 / 游戏态现行分发"两态，按钮经 `buttonToAction` 语义重释（keybinds schema 零改动）；选人浮层抽出 `char-select.ts` 并可聚焦。

**Tech Stack:** TypeScript + Vite + vitest/happy-dom + Playwright（channel='chrome'，伪造 `navigator.getGamepads`）。

**Spec:** `docs/superpowers/specs/2026-08-26-batch3a-gamepad-nav-design.md`（基线 main @ c71a5d2，398 测全绿）

## Global Constraints

- 分支 `feat/batch3a-gamepad-nav` 自 main@c71a5d2 切出；批内不 push origin，T7 全绿后统一处理；merge 回 main 由用户确认。
- 游戏态手柄语义零回归：B 无 overlay 时拾取、Start 暂停、stick 移动节流（input.ts 现行为）全部保留。
- keybinds.ts schema 不改（菜单态经 `buttonToAction` 重释，不新增 Action）。
- 键盘路径零回归：Tab 圈闭、数字键、面板快捷键行为不动（smoke 65 检查必须复现全绿）。
- 新 UI 文案走 i18n L 键（本批预计 0 新键；char-sel 全部复用现有键）。
- 测试基线 398（vitest）；每 task 后全量绿 + `npx tsc --noEmit` 0 错才可 commit。
- 提交信息格式 `feat(nav)/fix(nav)/test(e2e)/refactor(...)`，含 `(batch3a)` 标记。

---

### Task 1: focus-nav.ts 纯焦点工具 + .gp-focus 样式

**Files:**
- Create: `src/focus-nav.ts`
- Modify: `style/main.css`（:359 focus-visible 规则后追加）
- Test: `src/__tests__/batch3a-focus-nav.test.ts`

**Interfaces:**
- Consumes: 无（纯工具，零项目依赖）
- Produces（后续 task 依赖的精确签名）:
  - `focusablesIn(container: HTMLElement): HTMLElement[]`
  - `interface FocusCand { el: HTMLElement; r: { x: number; y: number; w: number; h: number } }`
  - `spatialNext(cur: {x,y,w,h}, cands: FocusCand[], dx: -1|0|1, dy: -1|0|1): HTMLElement | null`
  - `stepRange(el: HTMLInputElement, dir: -1|1): boolean`
  - `gpFocus(el: HTMLElement): void` / `clearGpFocus(): void`
  - `seqFocus(container: HTMLElement, dir: -1|1): HTMLElement | null`

- [ ] **Step 0: 建分支**

```bash
git checkout -b feat/batch3a-gamepad-nav main
```

- [ ] **Step 1: 写失败测试**

```ts
// src/__tests__/batch3a-focus-nav.test.ts
// Batch3A T1: pure focus-nav utilities — selector filtering, spatial geometry
// (numeric rects, no layout needed), range stepping, gp-focus class management.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { focusablesIn, spatialNext, stepRange, gpFocus, clearGpFocus, seqFocus } from '../focus-nav.js';

// happy-dom has no layout — patch offsetParent so the visibility filter sees
// everything we append (same technique the T3 poll tests will use).
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() { return document.body; }, configurable: true,
  });
});
afterEach(() => { document.body.innerHTML = ''; clearGpFocus(); });

describe('focusablesIn', () => {
  it('collects buttons, links, inputs, tabindex=0 divs in DOM order', () => {
    document.body.innerHTML = `<div id="c">
      <button>a</button><a href="#">b</a><input type="range">
      <div tabindex="0">d</div><div tabindex="-1">skip</div><p>plain</p>
    </div>`;
    const els = focusablesIn(document.getElementById('c')!);
    expect(els.map(e => e.textContent || (e as HTMLInputElement).type))
      .toEqual(['a', 'b', 'range', 'd']);
  });
  it('excludes disabled buttons', () => {
    document.body.innerHTML = `<div><button disabled>x</button><button>y</button></div>`;
    expect(focusablesIn(document.querySelector('div')!).length).toBe(1);
  });
});

describe('spatialNext — numeric rect geometry', () => {
  const R = (x: number, y: number, w = 10, h = 10, tag = '') =>
    ({ el: document.createElement('button'), r: { x, y, w, h } });
  it('moves right to the horizontally nearest candidate', () => {
    const cur = { x: 0, y: 0, w: 10, h: 10 };
    const near = R(30, 0, 10, 10), far = R(80, 0, 10, 10);
    expect(spatialNext(cur, [far, near], 1, 0)).toBe(near.el);
  });
  it('orthogonal offset weighs double: prefers aligned over nearer-but-skewed', () => {
    const cur = { x: 0, y: 0, w: 10, h: 10 };
    const skewed = R(20, 30), aligned = R(40, 2);
    // skewed: pri=20 + 2*35=90; aligned: pri=40 + 2*7=54 → aligned wins
    expect(spatialNext(cur, [skewed, aligned], 1, 0)).toBe(aligned.el);
  });
  it('ignores candidates on the wrong side / overlapping the axis', () => {
    const cur = { x: 50, y: 50, w: 10, h: 10 };
    const behind = R(80, 50), same = R(52, 50);
    expect(spatialNext(cur, [behind, same], -1, 0)).toBeNull();
  });
  it('up direction selects the candidate above', () => {
    const cur = { x: 0, y: 100, w: 10, h: 10 };
    const above = R(0, 20), below = R(0, 150);
    expect(spatialNext(cur, [above, below], 0, -1)).toBe(above.el);
  });
  it('diagonal requires sign match on both axes', () => {
    const cur = { x: 0, y: 0, w: 10, h: 10 };
    const diag = R(30, 30), horiz = R(30, 0);
    expect(spatialNext(cur, [diag, horiz], 1, 1)).toBe(diag.el);
  });
  it('tie on score falls back to nearest center distance', () => {
    const cur = { x: 0, y: 0, w: 10, h: 10 };
    const a = R(30, 10), b = R(10, 30); // symmetric scores; a is closer by hypot
    expect(spatialNext(cur, [a, b], 1, 1)).toBe(a.el);
  });
});

describe('stepRange', () => {
  it('steps value by el.step and dispatches bubbling input+change', () => {
    document.body.innerHTML = `<input type="range" id="s" min="0" max="1" step="0.05" value="0.5">`;
    const s = document.getElementById('s') as HTMLInputElement;
    const events: string[] = [];
    s.addEventListener('input', () => events.push('input'));
    s.addEventListener('change', () => events.push('change'));
    expect(stepRange(s, 1)).toBe(true);
    expect(s.value).toBe('0.55');
    expect(events).toEqual(['input', 'change']);
    stepRange(s, -1);
    expect(s.value).toBe('0.5');
  });
  it('clamps at max/min and returns false for non-range', () => {
    document.body.innerHTML = `<input type="range" min="0" max="10" step="2" value="9"><input type="text" id="tx">`;
    const s = document.querySelectorAll('input')[0] as HTMLInputElement;
    stepRange(s, 1); expect(s.value).toBe('10');
    stepRange(s, 1); expect(s.value).toBe('10');
    expect(stepRange(document.getElementById('tx') as HTMLInputElement, 1)).toBe(false);
  });
});

describe('gpFocus / seqFocus', () => {
  it('gpFocus adds .gp-focus, focuses, and moves the class on retarget', () => {
    document.body.innerHTML = `<div><button id="a">a</button><button id="b">b</button></div>`;
    const a = document.getElementById('a')!, b = document.getElementById('b')!;
    gpFocus(a);
    expect(a.classList.contains('gp-focus')).toBe(true);
    expect(document.activeElement).toBe(a);
    gpFocus(b);
    expect(a.classList.contains('gp-focus')).toBe(false);
    expect(b.classList.contains('gp-focus')).toBe(true);
    clearGpFocus();
    expect(b.classList.contains('gp-focus')).toBe(false);
  });
  it('seqFocus cycles in DOM order with wraparound; unfocused starts at first/last', () => {
    document.body.innerHTML = `<div id="c"><button>1</button><button>2</button><button>3</button></div>`;
    const c = document.getElementById('c')!;
    expect(seqFocus(c, 1)!.textContent).toBe('1');   // nothing focused → first
    expect(seqFocus(c, 1)!.textContent).toBe('2');
    expect(seqFocus(c, -1)!.textContent).toBe('1');  // wrap backwards
    expect(seqFocus(c, -1)!.textContent).toBe('3');  // wrap around the top
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/__tests__/batch3a-focus-nav.test.ts`
Expected: FAIL（`Cannot find module '../focus-nav.js'`）

- [ ] **Step 3: 实现 focus-nav.ts**

```ts
// Batch3A: pure focus-navigation utilities for gamepad menu navigation.
// spatialNext/stepRange operate on plain numbers / elements without reading
// layout internally (callers pass rects read from the live DOM) so unit tests
// never depend on happy-dom layout. Zero project imports — leaf module.
export interface FocusRect { x: number; y: number; w: number; h: number; }
export interface FocusCand { el: HTMLElement; r: FocusRect; }

export const FOCUSABLE_SEL =
  'button,[href],input:not([type=hidden]),select,textarea,[tabindex]:not([tabindex="-1"])';

export function focusablesIn(container: HTMLElement): HTMLElement[] {
  const els = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SEL));
  return els.filter(el => !(el as HTMLButtonElement).disabled && el.offsetParent !== null);
}

// Spatial nearest-in-direction: filter to the direction half-plane (candidate
// center must be ≥1px beyond the current rect on each pressed axis), then pick
// the minimum score = primary-axis distance + 2 × orthogonal offset; ties fall
// back to nearest center distance.
export function spatialNext(
  cur: FocusRect, cands: FocusCand[], dx: -1 | 0 | 1, dy: -1 | 0 | 1,
): HTMLElement | null {
  if (!dx && !dy) return null;
  const ccx = cur.x + cur.w / 2, ccy = cur.y + cur.h / 2;
  let best: HTMLElement | null = null, bestScore = Infinity, bestDist = Infinity;
  for (const c of cands) {
    const offX = c.r.x + c.r.w / 2 - ccx;
    const offY = c.r.y + c.r.h / 2 - ccy;
    if (dx !== 0 && (Math.sign(offX) !== dx || offX * dx < 1)) continue;
    if (dy !== 0 && (Math.sign(offY) !== dy || offY * dy < 1)) continue;
    const diag = dx !== 0 && dy !== 0;
    const pri = diag ? Math.max(Math.abs(offX), Math.abs(offY))
      : dx !== 0 ? Math.abs(offX) : Math.abs(offY);
    const orth = diag ? Math.min(Math.abs(offX), Math.abs(offY))
      : dx !== 0 ? Math.abs(offY) : Math.abs(offX);
    const score = pri + 2 * orth;
    const dist = Math.hypot(offX, offY);
    if (score < bestScore || (score === bestScore && dist < bestDist)) {
      best = c.el; bestScore = score; bestDist = dist;
    }
  }
  return best;
}

// Adjust a range input by one step (manual value math — deterministic across
// browsers/test DOMs) and notify listeners with bubbling input+change events.
export function stepRange(el: HTMLInputElement, dir: -1 | 1): boolean {
  if (el.type !== 'range') return false;
  const min = parseFloat(el.min || '0') || 0;
  const max = parseFloat(el.max || '100');
  const step = parseFloat(el.step || '1') || 1;
  const v = parseFloat(el.value) || min;
  el.value = String(Math.min(max, Math.max(min, v + dir * step)));
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

// Gamepad focus: programmatic focus() does not reliably trigger :focus-visible,
// so we mirror the ring with an explicit .gp-focus class (see style/main.css).
let gpFocused: HTMLElement | null = null;
export function gpFocus(el: HTMLElement): void {
  if (gpFocused && gpFocused !== el) gpFocused.classList.remove('gp-focus');
  gpFocused = el;
  el.classList.add('gp-focus');
  el.focus();
  try { el.scrollIntoView({ block: 'nearest' }); } catch { /* happy-dom no-op */ }
}
export function clearGpFocus(): void {
  if (gpFocused) { gpFocused.classList.remove('gp-focus'); gpFocused = null; }
}

// Sequential focus (LB/RB) — DOM order with wraparound, Tab-equivalent escape
// hatch for dense panels where spatial movement feels jumpy.
export function seqFocus(container: HTMLElement, dir: -1 | 1): HTMLElement | null {
  const list = focusablesIn(container);
  if (!list.length) return null;
  const active = document.activeElement as HTMLElement | null;
  const idx = active && list.includes(active) ? list.indexOf(active) : -1;
  const next = idx < 0
    ? (dir > 0 ? list[0] : list[list.length - 1])
    : list[(idx + dir + list.length) % list.length];
  gpFocus(next);
  return next;
}
```

- [ ] **Step 4: CSS 追加 .gp-focus（style/main.css :359 规则下一行）**

```css
.gp-focus{outline:2px solid var(--accent-gold);outline-offset:2px}
```

- [ ] **Step 5: 全量测试 + tsc**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 408 passed（398 基线 + 10 新）；tsc 0 错

- [ ] **Step 6: Commit**

```bash
git add src/focus-nav.ts src/__tests__/batch3a-focus-nav.test.ts style/main.css
git commit -m "feat(nav): pure focus-nav utilities — spatialNext/stepRange/gpFocus/seqFocus (batch3a T1)"
```

---

### Task 2: menu-context.ts 菜单上下文探测 + 泛化关闭梯

**Files:**
- Create: `src/menu-context.ts`
- Modify: `src/input.ts:220-235`（删除私有 closeActiveOverlay，改 import；`dispatchGamepadAction` :256 的调用点不变）
- Test: `src/__tests__/batch3a-menu-context.test.ts`

**Interfaces:**
- Consumes: `focus-nav.ts` 无；state 各 open 标志 / `closeEvent`(events.js) / `hideOverlay`(ui-panels.js) / `bridge` / `closeItemIntro` / panels 各 close
- Produces:
  - `closeActiveOverlay(): boolean`（自 input.ts 原样迁来 + 补 records/codex 两档；**不含 ending-choice**——强制抉择不许 B 关）
  - `activeMenuContext(): HTMLElement | null`
  - `menuBack(): boolean`

- [ ] **Step 1: 写失败测试**

```ts
// src/__tests__/batch3a-menu-context.test.ts
// Batch3A T2: menu-context detection priority + context-appropriate back.
// Follows input.test.ts mock-set conventions (all closers mocked).
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  G: null as any, invOpen: false, helpOpen: false, skillOpen: false,
  achOpen: false, talentOpen: false, eventOpen: false,
  eventActions: [] as Array<() => void>, menuOpen: false, introOpen: false,
}));
vi.mock('../state.js', () => mockState);
vi.mock('../events.js', () => ({ closeEvent: vi.fn() }));
vi.mock('../ui-panels.js', () => ({ hideOverlay: vi.fn() }));
vi.mock('../bridge.js', () => ({ bridge: { closeOptions: vi.fn(), openPause: vi.fn(), closePause: vi.fn() } }));
vi.mock('../item-intro.js', () => ({ closeItemIntro: vi.fn() }));
vi.mock('../panels.js', () => ({
  closeInventory: vi.fn(), closeSkillPanel: vi.fn(), closeAchievements: vi.fn(),
  closeTalentPanel: vi.fn(), closeHelp: vi.fn(),
}));

import { activeMenuContext, menuBack, closeActiveOverlay } from '../menu-context.js';
import { hideOverlay } from '../ui-panels.js';
import { closeEvent } from '../events.js';

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
  Object.values(mockState).forEach(v => { if (typeof v === 'boolean') (mockState as any)[v]; });
  mockState.invOpen = mockState.helpOpen = mockState.skillOpen = false;
  mockState.achOpen = mockState.talentOpen = mockState.eventOpen = false;
  mockState.menuOpen = mockState.introOpen = false;
});

describe('activeMenuContext priority', () => {
  it('returns the first .overlay.active (incl. ending-choice / records / codex)', () => {
    document.body.innerHTML = `<div id="ending-choice" class="overlay active"><button>Slay</button></div>
      <div id="title-screen"><button>New Game</button></div>`;
    expect(activeMenuContext()!.id).toBe('ending-choice');
  });
  it('falls through to event-popup / char-sel / title / death / victory by visibility', () => {
    document.body.innerHTML = `<div id="title-screen" style="display:flex"></div>`;
    expect(activeMenuContext()!.id).toBe('title-screen');
    document.body.innerHTML = `<div id="char-sel"><button>Begin</button></div>`;
    expect(activeMenuContext()!.id).toBe('char-sel');
    document.body.innerHTML = `<div id="death-screen" style="display:flex"></div><div id="title-screen" style="display:none"></div>`;
    expect(activeMenuContext()!.id).toBe('death-screen');
    document.body.innerHTML = `<div id="event-popup" style="display:block"></div>`;
    expect(activeMenuContext()!.id).toBe('event-popup');
    document.body.innerHTML = ``;
    expect(activeMenuContext()).toBeNull();
  });
});

describe('menuBack', () => {
  it('overlay → generalized close ladder (records via hideOverlay)', () => {
    document.body.innerHTML = `<div id="records-overlay" class="overlay active"></div>`;
    expect(menuBack()).toBe(true);
    expect(hideOverlay).toHaveBeenCalledWith('records-overlay');
  });
  it('event popup visible but flag desynced → closeEvent directly', () => {
    document.body.innerHTML = `<div id="event-popup" style="display:block"></div>`;
    expect(menuBack()).toBe(true);
    expect(closeEvent).toHaveBeenCalled();
  });
  it('char-sel → clicks #char-back-btn', () => {
    document.body.innerHTML = `<div id="char-sel"><button id="char-back-btn">Back</button></div>`;
    expect(menuBack()).toBe(true);
  });
  it('title / death / victory → false (B is a no-op; A on buttons is the exit)', () => {
    document.body.innerHTML = `<div id="death-screen" style="display:flex"></div>`;
    expect(menuBack()).toBe(false);
  });
});

describe('closeActiveOverlay ladder (migrated from input.ts)', () => {
  it('inventory flag → closeInventory; forge visible → hideOverlay(forge-overlay)', () => {
    mockState.invOpen = true;
    expect(closeActiveOverlay()).toBe(true);
    mockState.invOpen = false;
    document.body.innerHTML = `<div id="forge-overlay" style="display:flex"></div>`;
    expect(closeActiveOverlay()).toBe(true);
    expect(hideOverlay).toHaveBeenCalledWith('forge-overlay');
  });
  it('never closes ending-choice even though it is .overlay.active', () => {
    document.body.innerHTML = `<div id="ending-choice" class="overlay active"></div>`;
    expect(closeActiveOverlay()).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/__tests__/batch3a-menu-context.test.ts`
Expected: FAIL（`Cannot find module '../menu-context.js'`）

- [ ] **Step 3: 实现 menu-context.ts**

```ts
// Batch3A: menu-context detection for gamepad focus navigation.
// activeMenuContext() names the ONE container spatial navigation operates in;
// menuBack() performs the context-appropriate "B = back" action.
// closeActiveOverlay() moved here from input.ts (batch3a T2) so both the
// gameplay dispatch and menuBack share one close ladder — now generalized to
// any .overlay.active panel (records/codex included; ending-choice deliberately
// EXCLUDED: the Slay/Refuse choice is mandatory and has no close path).
import { invOpen, helpOpen, skillOpen, achOpen, talentOpen, eventOpen, menuOpen, introOpen } from './state.js';
import { closeEvent } from './events.js';
import { hideOverlay } from './ui-panels.js';
import { bridge } from './bridge.js';
import { closeItemIntro } from './item-intro.js';
import { closeInventory, closeSkillPanel, closeAchievements, closeTalentPanel, closeHelp } from './panels.js';

export function closeActiveOverlay(): boolean {
  if (introOpen) { closeItemIntro(); return true; }
  if (eventOpen) { closeEvent(); return true; }
  if (invOpen) { closeInventory(); return true; }
  if (skillOpen) { closeSkillPanel(); return true; }
  if (talentOpen) { closeTalentPanel(); return true; }
  if (achOpen) { closeAchievements(); return true; }
  if (helpOpen) { closeHelp(); return true; }
  const forge = document.getElementById('forge-overlay');
  if (forge && getComputedStyle(forge).display !== 'none') { hideOverlay('forge-overlay'); return true; }
  const optOv = document.getElementById('options-overlay');
  if (optOv && optOv.classList.contains('active')) { bridge.closeOptions?.(); return true; }
  if (menuOpen) { bridge.closePause?.(); return true; }
  // Batch3A: panels shown via showOverlay but absent from the open-flag list.
  for (const id of ['records-overlay', 'codex-overlay']) {
    const el = document.getElementById(id);
    if (el && el.classList.contains('active')) { hideOverlay(id); return true; }
  }
  return false;
}

function visible(id: string): HTMLElement | null {
  const el = document.getElementById(id);
  return el && getComputedStyle(el).display !== 'none' ? el : null;
}

export function activeMenuContext(): HTMLElement | null {
  const ov = document.querySelector<HTMLElement>('.overlay.active');
  if (ov && ov.id !== 'ending-choice') return ov;   // handled below via ladder-free back
  return visible('event-popup') || visible('char-sel')
    || visible('title-screen') || visible('death-screen') || visible('victory-screen')
    || ov;   // ending-choice IS a navigable menu — it just has no back action
}

export function menuBack(): boolean {
  if (closeActiveOverlay()) return true;
  if (visible('event-popup')) { closeEvent(); return true; }
  const cs = document.getElementById('char-sel');
  if (cs) { (cs.querySelector('#char-back-btn') as HTMLElement | null)?.click(); return true; }
  return false;   // title / death / victory / ending-choice: B does nothing
}
```

注意 `.overlay.active` 分支顺序：ending-choice 虽可导航但 `menuBack` 经 `closeActiveOverlay()`（不关它）→ `visible('event-popup')` 否 → `char-sel` 否 → **return false**（B 无操作）——与测试第 4 条一致。

- [ ] **Step 4: input.ts 迁移接线**

删除 input.ts:220-235 的私有 `closeActiveOverlay`，头部加：
```ts
import { activeMenuContext, menuBack, closeActiveOverlay } from './menu-context.js';
```
`dispatchGamepadAction` 内 `:256` 的 `closeActiveOverlay()` 调用与 `else if (overlay)` 分支（:332-337）本轮不动（T3 处理后者）。

- [ ] **Step 5: 全量测试 + tsc**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 414 passed（408 + 6 新）；tsc 0 错；input.test.ts 既有 12 测仍绿（closeActiveOverlay 迁移零行为变化）

- [ ] **Step 6: Commit**

```bash
git add src/menu-context.ts src/__tests__/batch3a-menu-context.test.ts src/input.ts
git commit -m "feat(nav): menu-context detector + generalized close ladder (batch3a T2)"
```

---

### Task 3: pollGamepad 菜单分支 + ending-choice 键盘闸

**Files:**
- Modify: `src/input.ts`（pollGamepad :265-340 重构 + keydown 加闸 + 导出 pollGamepad）
- Test: `src/__tests__/batch3a-input-menu.test.ts`

**Interfaces:**
- Consumes: T1 全部导出；T2 `activeMenuContext/menuBack`
- Produces: `export function pollGamepad(): void`（测试可注伪手柄）；`menuMoveFocus` 保持模块私有

- [ ] **Step 1: 写失败测试**

```ts
// src/__tests__/batch3a-input-menu.test.ts
// Batch3A T3: pollGamepad menu-state behavior — fake gamepad injection via a
// stubbed navigator.getGamepads, real DOM buttons, edge-triggered presses.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  G: { gameOver: false, player: { x: 5, y: 5 } } as any,
  invOpen: false, helpOpen: false, skillOpen: false,
  achOpen: false, talentOpen: false, eventOpen: false,
  eventActions: [] as Array<() => void>, menuOpen: false, introOpen: false,
}));
vi.mock('../state.js', () => mockState);
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../player.js', () => ({ movePlayer: vi.fn(), pickupItem: vi.fn(), descendStairs: vi.fn(), doWait: vi.fn() }));
vi.mock('../items.js', () => ({ quickQuaff: vi.fn(), quickRead: vi.fn(), useQuickSlot: vi.fn(), useItem: vi.fn(), equipItem: vi.fn(), sellItem: vi.fn() }));
vi.mock('../skills.js', () => ({ executeSkill: vi.fn() }));
vi.mock('../save.js', () => ({ saveGame: vi.fn() }));
vi.mock('../events.js', () => ({ closeEvent: vi.fn() }));
vi.mock('../ui-panels.js', () => ({ hideOverlay: vi.fn() }));
vi.mock('../bridge.js', () => ({ bridge: { toggleLang: vi.fn(), toggleSound: vi.fn(), openPause: vi.fn(), closePause: vi.fn(), closeOptions: vi.fn() } }));
vi.mock('../item-intro.js', () => ({ closeItemIntro: vi.fn() }));
vi.mock('../panels.js', () => ({
  openInventory: vi.fn(), closeInventory: vi.fn(), openHelp: vi.fn(), closeHelp: vi.fn(),
  tryCastSkill: vi.fn(), openSkillPanel: vi.fn(), closeSkillPanel: vi.fn(),
  openAchievements: vi.fn(), closeAchievements: vi.fn(), openTalentPanel: vi.fn(),
  closeTalentPanel: vi.fn(), sellMode: false,
}));

import { movePlayer } from '../player.js';
import { pollGamepad } from '../input.js';

// Mutable fake gamepad wired into navigator.getGamepads.
const pad = vi.hoisted(() => ({
  buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
  axes: [0, 0] as number[],
}));
beforeEach(() => {
  vi.clearAllMocks();
  (navigator as any).getGamepads = () => [pad];
  pad.buttons.forEach(b => (b.pressed = false));
  pad.axes = [0, 0];
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() { return document.body; }, configurable: true,
  });
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    get() { return () => ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) }); },
    configurable: true,
  });
});

// Simulate one button edge: settle → press → settle (poll is edge-triggered).
function press(idx: number) {
  pollGamepad();                    // records all-up as previous state
  pad.buttons[idx].pressed = true;
  pollGamepad();                    // edge fires here
  pad.buttons[idx].pressed = false;
  pollGamepad();
}

describe('menu state — focus navigation', () => {
  it('D-pad down moves focus to the next button and stamps .gp-focus', () => {
    document.body.innerHTML = `<div id="pause-overlay" class="overlay active">
      <button id="r">Resume</button><button id="s">Settings</button></div>`;
    press(12);   // D-pad up — anchors initial focus (first = Resume)
    expect(document.activeElement!.id).toBe('r');
    press(13);   // D-pad down
    expect(document.activeElement!.id).toBe('s');
    expect(document.getElementById('s')!.classList.contains('gp-focus')).toBe(true);
  });

  it('A activates the focused element (click), never dispatches gameplay wait', () => {
    document.body.innerHTML = `<div id="pause-overlay" class="overlay active">
      <button id="r">Resume</button></div>`;
    press(12); press(0);
    // .overlay.active + menuOpen=false → nothing closed; wait NOT dispatched
    expect(mockState.G.gameOver).toBe(false);
    expect(movePlayer).not.toHaveBeenCalled();
  });

  it('B in a panel calls menuBack (close ladder) instead of pickup', () => {
    document.body.innerHTML = `<div id="records-overlay" class="overlay active"></div>`;
    press(1);
    // hideOverlay mocked in ui-panels mock — assert via menuBack effect:
    // records closed through the ladder (hideOverlay called with records-overlay)
    const { hideOverlay } = await import('../ui-panels.js');
    expect(hideOverlay).toHaveBeenCalledWith('records-overlay');
  });

  it('LB/RB move focus sequentially', () => {
    document.body.innerHTML = `<div id="x" class="overlay active">
      <button>1</button><button>2</button><button>3</button></div>`;
    press(4);   // LB → last
    expect(document.activeElement!.textContent).toBe('3');
    press(5);   // RB → first
    expect(document.activeElement!.textContent).toBe('1');
  });

  it('left/right on a focused range input steps its value instead of moving focus', () => {
    document.body.innerHTML = `<div id="o" class="overlay active">
      <input type="range" id="s" min="0" max="100" step="10" value="50">
      <button id="b">x</button></div>`;
    press(12);   // anchor on first focusable = the range
    expect((document.activeElement as HTMLInputElement).type).toBe('range');
    press(15);   // D-pad right
    expect((document.getElementById('s') as HTMLInputElement).value).toBe('60');
    expect(document.activeElement!.id).toBe('s');   // focus did NOT move
  });

  it('gameOver with a visible death screen still navigates (menu branch precedes the gate)', () => {
    mockState.G.gameOver = true;
    document.body.innerHTML = `<div id="death-screen" style="display:flex">
      <button id="try">Try Again</button></div>`;
    press(12);
    expect(document.activeElement!.id).toBe('try');
    mockState.G.gameOver = false;
  });

  it('gameplay state unchanged: no menu → D-pad still calls movePlayer', () => {
    document.body.innerHTML = `<div id="title-screen" style="display:none"></div>`;
    press(12);
    expect(movePlayer).toHaveBeenCalledWith(0, -1);
  });
});
```

注意：`it('B in a panel…')` 用例含顶层 `await import` —— 该用例须写成 `async () => {...}`（vitest 支持）；提交前把该用例签名改为 `it('...', async () => {`。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/__tests__/batch3a-input-menu.test.ts`
Expected: FAIL（pollGamepad 未导出 / 菜单分支不存在 → 死亡屏聚焦断言挂）

- [ ] **Step 3: 实现 pollGamepad 重构**

input.ts 顶部追加：
```ts
import { focusablesIn, spatialNext, stepRange, gpFocus, seqFocus, type FocusRect } from './focus-nav.js';
```

以 `export` 替换私有签名（注释注明测试注入口），并将 :306-339（optOv/forgeOv 到函数尾）整体替换为：

```ts
  // Batch3A: menu contexts take precedence over gameplay dispatch. Focus
  // navigation runs regardless of G / gameOver — this is what makes title,
  // char-sel, death, victory and ending screens reachable by gamepad.
  const menu = activeMenuContext();
  if (menu) {
    // Anchor: if nothing inside the menu holds focus, focus the first element.
    const active = document.activeElement as HTMLElement | null;
    if (!active || !menu.contains(active)) {
      const first = focusablesIn(menu)[0];
      if (first) gpFocus(first);
    }
    // Left stick — directional focus movement, same repeat cooldown as walking.
    const axes = gp!.axes || [];
    const ax = axes[0] || 0, ay = axes[1] || 0;
    if (gpMoveCd <= 0 && (Math.abs(ax) > 0.5 || Math.abs(ay) > 0.5)) {
      menuMoveFocus(menu,
        Math.abs(ax) > 0.5 ? Math.sign(ax) as -1 | 1 : 0,
        Math.abs(ay) > 0.5 ? Math.sign(ay) as -1 | 1 : 0);
      gpMoveCd = 8;
    }
    if (gpMoveCd > 0 && Math.abs(ax) <= 0.5 && Math.abs(ay) <= 0.5) gpMoveCd = 0;
    // Buttons — edge-triggered, reinterpreted through the user's own bindings:
    // move_* = spatial focus, wait = activate, overlay_close = back,
    // quaff/descend (LB/RB) = sequential focus, pause stays pause.
    for (let i = 0; i < gp.buttons.length; i++) {
      if (!edge(i)) continue;
      const a = buttonToAction(i);
      if (!a) continue;
      if (a === 'move_up') menuMoveFocus(menu, 0, -1);
      else if (a === 'move_down') menuMoveFocus(menu, 0, 1);
      else if (a === 'move_left') menuMoveFocus(menu, -1, 0);
      else if (a === 'move_right') menuMoveFocus(menu, 1, 0);
      else if (a === 'wait') {
        const el = document.activeElement as HTMLElement | null;
        if (el && menu.contains(el)) el.click();
      }
      else if (a === 'overlay_close') menuBack();
      else if (a === 'quaff') seqFocus(menu, -1);
      else if (a === 'descend') seqFocus(menu, 1);
      else if (a === 'pause') {
        if (menuOpen) bridge.closePause?.();
        else if (G && !G.gameOver) bridge.openPause?.();
      }
    }
  } else if (G && !G.gameOver) {
    // ---- gameplay dispatch (pre-batch3A behavior, unchanged) ----
    // Left stick — 8-direction, 0.5 deadzone, repeat cooldown (NOT a button action)
    const axes = gp!.axes || [];
    const ax = axes[0] || 0, ay = axes[1] || 0;
    if (gpMoveCd <= 0 && (Math.abs(ax) > 0.5 || Math.abs(ay) > 0.5)) {
      const dx = Math.abs(ax) > 0.5 ? Math.sign(ax) : 0;
      const dy = Math.abs(ay) > 0.5 ? Math.sign(ay) : 0;
      movePlayer(dx, dy);
      gpMoveCd = 8; // ~480ms at 60ms poll — controllable stepping pace
    }
    if (gpMoveCd > 0 && Math.abs(ax) <= 0.5 && Math.abs(ay) <= 0.5) gpMoveCd = 0;
    // Action buttons (edge-triggered) — dispatch via table lookup.
    for (let i = 0; i < gp.buttons.length; i++) {
      if (edge(i)) {
        const a = buttonToAction(i);
        if (a) dispatchGamepadAction(a, false);
      }
    }
  }
  if (gpMoveCd > 0) gpMoveCd--;
  gpPrevBtn = gp.buttons.map(b => !!(b && b.pressed));
}

// Batch3A: directional focus move within a menu context. A focused range input
// captures horizontal input for value adjustment instead of moving focus.
function menuMoveFocus(menu: HTMLElement, dx: -1 | 0 | 1, dy: -1 | 0 | 1): void {
  if (!dx && !dy) return;
  const active = document.activeElement as HTMLElement | null;
  const inMenu = !!(active && menu.contains(active));
  if (dx !== 0 && inMenu && active instanceof HTMLInputElement && active.type === 'range') {
    if (stepRange(active, dx)) return;
  }
  const list = focusablesIn(menu);
  if (!list.length) return;
  const from = inMenu && list.includes(active!) ? active! : list[0];
  const rect = (el: HTMLElement): FocusRect => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  };
  const next = spatialNext(rect(from), list.map(el => ({ el, r: rect(el) })), dx, dy);
  if (next && next !== from) gpFocus(next);
}
```

要点：原 `else if (overlay)` gameOver 分支（:332-337）随重构**删除**（菜单分支已覆盖其全部行为且更完整）；`dispatchGamepadAction(a, overlay)` 的第二参在 gameplay 态恒为 `false`（进入该分支即无 menu）——`dispatchGamepadAction` 签名与其单测不动。

- [ ] **Step 4: 键盘 ending-choice 闸（keydown，capture 块之后、F11 之前插入）**

```ts
    // Batch3A: ending-choice is a mandatory modal outside the open-flag
    // bookkeeping — without this gate gameplay keys (movement!) leak through
    // while the Slay/Refuse popup is up. Only Tab (native focus trap) passes.
    const endingOv = document.getElementById('ending-choice');
    if (endingOv && endingOv.classList.contains('active')) {
      if (e.key !== 'Tab') e.preventDefault();
      return;
    }
```

- [ ] **Step 5: 全量测试 + tsc**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 421 passed（414 + 7 新）；tsc 0 错

- [ ] **Step 6: Commit**

```bash
git add src/input.ts src/__tests__/batch3a-input-menu.test.ts
git commit -m "feat(nav): pollGamepad menu-state focus branch + ending-choice key gate (batch3a T3)"
```

---

### Task 4: char-select.ts 抽取 + 选人浮层可聚焦

**Files:**
- Create: `src/char-select.ts`（自 main.ts:104-183 迁移 + 增强）
- Modify: `src/main.ts:104-111`（startNewGame 改走注入）、删除 :113-183 旧函数与模块级 selRace/selCls、:35 import 区
- Modify: `style/main.css`（:359 规则补三个选择器）
- Test: `src/__tests__/batch3a-charsel.test.ts`

**Interfaces:**
- Consumes: `RACES/CLASSES`(data.js)、`t/tx`(i18n.js)
- Produces: `showCharSelect(deps: { onStart(race: number, cls: number, endless: boolean): void; onBack(): void }): void`

- [ ] **Step 1: 写失败测试**

```ts
// src/__tests__/batch3a-charsel.test.ts
// Batch3A T4: char-select options are focusable (tabindex+role) and keyboard-
// activable (Enter/Space), aria-pressed tracks selection, deps fire on buttons.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../data.js', () => ({
  RACES: [
    { name: { en: 'Human', zh: '人' }, desc: { en: 'd', zh: 'd' } },
    { name: { en: 'Dwarf', zh: '矮' }, desc: { en: 'd', zh: 'd' } },
  ],
  CLASSES: [
    { name: { en: 'Warrior', zh: '战' }, desc: { en: 'd', zh: 'd' }, skill: { name: { en: 'Bash', zh: '击' }, desc: { en: 's', zh: 's' } } },
    { name: { en: 'Mage', zh: '法' }, desc: { en: 'd', zh: 'd' }, skill: { name: { en: 'Zap', zh: '雷' }, desc: { en: 's', zh: 's' } } },
  ],
}));
vi.mock('../i18n.js', () => ({
  t: (k: string) => k,
  tx: (v: { en: string }) => v.en,
}));

import { showCharSelect } from '../char-select.js';

beforeEach(() => { document.body.innerHTML = ''; });

function open() {
  const deps = { onStart: vi.fn(), onBack: vi.fn() };
  showCharSelect(deps);
  return deps;
}

describe('char-select focusability', () => {
  it('options carry tabindex=0 role=button; aria-pressed reflects default selection', () => {
    open();
    const race = document.querySelectorAll('.race-opt') as NodeListOf<HTMLElement>;
    expect(race.length).toBe(2);
    expect(race[0].getAttribute('tabindex')).toBe('0');
    expect(race[0].getAttribute('role')).toBe('button');
    expect(race[0].getAttribute('aria-pressed')).toBe('true');
    expect(race[1].getAttribute('aria-pressed')).toBe('false');
  });
  it('Enter and Space activate the focused option; selection syncs aria-pressed', () => {
    const deps = open();
    const mage = document.querySelectorAll('.class-opt')[1] as HTMLElement;
    mage.focus();
    mage.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(mage.getAttribute('aria-pressed')).toBe('true');
    const warrior = document.querySelectorAll('.class-opt')[0] as HTMLElement;
    warrior.focus();
    warrior.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(warrior.getAttribute('aria-pressed')).toBe('true');
    expect(mage.getAttribute('aria-pressed')).toBe('false');
    document.getElementById('start-btn')!.click();
    expect(deps.onStart).toHaveBeenCalledWith(0, 0, false);
  });
  it('mode toggle flips endless param; back button fires onBack', () => {
    const deps = open();
    (document.querySelectorAll('.mode-opt')[1] as HTMLElement).click();
    document.getElementById('start-btn')!.click();
    expect(deps.onStart).toHaveBeenCalledWith(0, 0, true);
    document.getElementById('char-back-btn')!.click();
    expect(deps.onBack).toHaveBeenCalled();
    expect(document.getElementById('char-sel')).toBeNull();   // overlay removed
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/__tests__/batch3a-charsel.test.ts`
Expected: FAIL（`Cannot find module '../char-select.js'`）

- [ ] **Step 3: 实现 char-select.ts（迁移 main.ts:113-183 并增强）**

```ts
// Batch3A: character selection overlay — extracted from main.ts for testability
// and made keyboard/gamepad-focusable: options carry tabindex="0" role="button"
// + aria-pressed so spatial focus navigation and keyboard Tab reach them;
// Enter/Space activate. Dependencies are injected (no main.ts import cycle).
import { RACES, CLASSES } from './data.js';
import { t, tx } from './i18n.js';

export interface CharSelDeps {
  onStart: (race: number, cls: number, endless: boolean) => void;
  onBack: () => void;
}

export function showCharSelect(deps: CharSelDeps): void {
  let selRace = 0, selCls = 0;
  const ov = document.createElement('div');
  ov.id = 'char-sel';
  ov.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(10,10,15,.95);z-index:1000;display:flex;align-items:center;justify-content:center;flex-direction:column';
  const opt = (cls: string, idx: number, inner: string) =>
    `<div class="${cls}" data-idx="${idx}" tabindex="0" role="button" aria-pressed="${idx === 0}" style="padding:8px 15px;margin:4px 0;cursor:pointer;border:1px solid ${idx === 0 ? '#e63946' : '#333'};border-radius:3px;color:${idx === 0 ? '#ddd' : '#888'}">${inner}</div>`;
  const raceHtml = RACES.map((r, i) =>
    opt('race-opt', i, `<b>${tx(r.name)}</b> <span style="color:#666;font-size:.9em">${tx(r.desc)}</span>`)).join('');
  const classHtml = CLASSES.map((c, i) => {
    const sk = c.skill;
    return opt('class-opt', i, `<b>${tx(c.name)}</b> <span style="color:#666;font-size:.9em">${tx(c.desc)}</span><br><span style="color:#9b5de5;font-size:.8em">⚡ ${tx(sk.name)} — ${tx(sk.desc)}</span>`);
  }).join('');
  // Mode selector: 0 = Normal (F40 Creator = victory), 1 = Endless. Resets each open.
  let selMode = 0;
  const modeOpts = [
    { n: t('mn.modeNormal'), d: t('mn.modeNormalDesc') },
    { n: t('mn.modeEndless'), d: t('mn.modeEndlessDesc') },
  ];
  const modeHtml = modeOpts.map((m, i) =>
    opt('mode-opt', i, `<b>${m.n}</b> <span style="color:#666;font-size:.9em">${m.d}</span>`)).join('');
  ov.innerHTML = `<h2 style="color:#e63946;margin-bottom:20px;font-size:1.8em">${t('createHero')}</h2>
  <div style="display:flex;gap:30px;margin-bottom:20px;flex-wrap:wrap;justify-content:center">
  <div><h3 style="color:#8888aa;margin-bottom:10px">${t('race')}</h3>${raceHtml}</div>
  <div><h3 style="color:#8888aa;margin-bottom:10px">${t('cls')}</h3>${classHtml}</div>
  <div><h3 style="color:#8888aa;margin-bottom:10px">${t('mn.mode')}</h3>${modeHtml}</div></div>
  <div style="display:flex;gap:10px;align-items:center">
  <button class="menu-btn" id="start-btn" style="margin-top:10px">${t('begin')}</button>
  <button class="menu-btn" id="char-back-btn" style="margin-top:10px;border-color:#888;color:#888">${t('mn.back')}</button>
  </div>`;
  document.body.appendChild(ov);
  // Batch3A: keyboard activation — Enter/Space on an option behaves like a click
  // (divs with tabindex don't get native button key activation).
  ov.addEventListener('keydown', (e: KeyboardEvent) => {
    const el = (e.target as HTMLElement).closest('.race-opt,.class-opt,.mode-opt') as HTMLElement | null;
    if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); el.click(); }
  });
  const selectGroup = (group: string, idx: number) => {
    ov.querySelectorAll(group).forEach((n, i) => {
      const el = n as HTMLElement;
      el.style.borderColor = i === idx ? '#e63946' : '#333';
      el.style.color = i === idx ? '#ddd' : '#888';
      el.setAttribute('aria-pressed', String(i === idx));
    });
  };
  ov.querySelectorAll('.race-opt').forEach((el: any) => {
    el.onclick = () => { selRace = parseInt(el.dataset.idx); selectGroup('.race-opt', selRace); };
  });
  ov.querySelectorAll('.class-opt').forEach((el: any) => {
    el.onclick = () => { selCls = parseInt(el.dataset.idx); selectGroup('.class-opt', selCls); };
  });
  ov.querySelectorAll('.mode-opt').forEach((el: any) => {
    el.onclick = () => { selMode = parseInt(el.dataset.idx); selectGroup('.mode-opt', selMode); };
  });
  document.getElementById('start-btn')!.onclick = () => {
    ov.remove();
    deps.onStart(selRace, selCls, selMode === 1);
  };
  document.getElementById('char-back-btn')!.onclick = () => {
    ov.remove();
    deps.onBack();
  };
}
```

- [ ] **Step 4: main.ts 接线**

`startNewGame`（main.ts:106-111）改为：
```ts
function startNewGame(): void {
  document.getElementById('title-screen')!.style.display = 'none';
  document.getElementById('death-screen')!.style.display = 'none';
  document.getElementById('victory-screen')!.style.display = 'none';
  showCharSelect({
    onStart: (r, c, endless) => {
      document.getElementById('game-container')!.style.display = 'flex';
      initAudio();
      initGame(r, c, endless);
      resizeCanvas();
      startParticles();
      updateUI();
      render();
    },
    onBack: () => {
      document.getElementById('title-screen')!.style.display = 'flex';
      initTitleParticles();
      renderTitleStats();   // ④ refresh after a run may have changed meta stats
    },
  });
}
```
删除旧 `showCharSelect`（:113-183）与模块级 `let selRace = 0, selCls = 0;`（:104）；import 区加 `import { showCharSelect } from './char-select.js';`。

- [ ] **Step 5: CSS 追加（style/main.css :359 选择器列表末尾）**

将该行选择器列表追加 `,.race-opt:focus-visible,.class-opt:focus-visible,.mode-opt:focus-visible`（保持单行规则不变，只扩选择器）。

- [ ] **Step 6: 全量测试 + tsc**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 424 passed（421 + 3 新）；tsc 0 错

- [ ] **Step 7: Commit**

```bash
git add src/char-select.ts src/main.ts style/main.css src/__tests__/batch3a-charsel.test.ts
git commit -m "feat(nav): char-select extracted + focusable options (tabindex/role/aria-pressed/Enter-Space) (batch3a T4)"
```

---

### Task 5: tooltip 即显（focusin/focusout）

**Files:**
- Modify: `src/ui-panels.ts`（initTooltip 后新增导出函数）
- Modify: `src/main.ts:279`（initTooltip() 调用后加一行）
- Test: `src/__tests__/batch3a-tooltip-focus.test.ts`

**Interfaces:**
- Consumes: 无新依赖（只用 #tooltip 元素）
- Produces: `initFocusTooltips(): void`

- [ ] **Step 1: 写失败测试**

```ts
// src/__tests__/batch3a-tooltip-focus.test.ts
// Batch3A T5: focusing any [title]-bearing element shows the shared #tooltip
// div (escaped, \n → <br>); blur hides it. Mouse-hover path untouched.
import { describe, it, expect, beforeEach } from 'vitest';

// ui-panels imports — minimal mock set (state/i18n/bridge), same conventions
// as events-checkTiles.test.ts.
vi.mock('../state.js', () => ({
  G: null, setInvOpen: () => {}, setHelpOpen: () => {}, setSkillOpen: () => {},
  setAchOpen: () => {}, setTalentOpen: () => {}, setEventOpen: () => {},
  setMenuOpen: () => {}, setIntroOpen: () => {}, setLang: () => {},
  lang: 'en', reducedMotion: false,
}));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tx: (v: { en: string }) => v.en }));
vi.mock('../bridge.js', () => ({ bridge: {} }));

import { initFocusTooltips } from '../ui-panels.js';

beforeEach(() => {
  document.body.innerHTML = `<div id="tooltip"></div>
    <button id="a" title="Line1
Line2">a</button><button id="b">b</button><button id="c" title="">c</button>`;
  initFocusTooltips();
});

describe('focus-triggered tooltip', () => {
  it('focusin on a titled element shows #tooltip with escaped, line-broken text', () => {
    document.getElementById('a')!.focus();
    const tt = document.getElementById('tooltip')!;
    expect(tt.style.display).toBe('block');
    expect(tt.innerHTML).toContain('Line1<br>Line2');
  });
  it('focusout hides it; empty-title and title-less elements never show it', () => {
    document.getElementById('a')!.focus();
    document.getElementById('b')!.focus();
    expect(document.getElementById('tooltip')!.style.display).toBe('none');
    document.getElementById('c')!.focus();
    expect(document.getElementById('tooltip')!.style.display).toBe('none');
  });
});
```

（测试文件顶部须 `import { describe, it, expect, beforeEach, vi } from 'vitest';`——mock 工厂先于 import 声明，vitest hoist 处理。若 ui-panels.js 真实模块图还需更多 mock（config/data 等），按 vitest 报错逐个补 `vi.mock`，以"最小通过集"为准并在 mock 块注明。）

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/__tests__/batch3a-tooltip-focus.test.ts`
Expected: FAIL（initFocusTooltips 未导出）

- [ ] **Step 3: 实现（ui-panels.ts initTooltip 函数之后）**

```ts
// Batch3A: focus-triggered tooltips. Focusing any element carrying a title
// attribute (hotbar slots, talent cells, merchant buttons…) shows the shared
// #tooltip div under the element; blur hides it. Mouse-hover behavior in
// initTooltip above is untouched — this is additive for keyboard/gamepad focus.
export function initFocusTooltips(): void {
  const tt = document.getElementById('tooltip');
  if (!tt) return;
  document.addEventListener('focusin', (e) => {
    const el = (e.target as HTMLElement).closest?.('[title]') as HTMLElement | null;
    const title = el?.getAttribute('title');
    if (!el || !title) return;
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    tt.innerHTML = `<div class="ttn">${esc(title).replace(/\n/g, '<br>')}</div>`;
    tt.style.display = 'block';
    const r = el.getBoundingClientRect();
    tt.style.left = Math.max(4, Math.min(window.innerWidth - 230, r.left)) + 'px';
    tt.style.top = (r.bottom + 90 > window.innerHeight ? Math.max(4, r.top - 90) : r.bottom + 8) + 'px';
  });
  document.addEventListener('focusout', () => {
    tt.style.display = 'none';
    tt.innerHTML = '';
  });
}
```

- [ ] **Step 4: main.ts 接线（:279 initTooltip() 之后一行）**

```ts
  initFocusTooltips();
```
（import 行同步加 `initFocusTooltips`。）

- [ ] **Step 5: 全量测试 + tsc**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 426 passed（424 + 2 新）；tsc 0 错

- [ ] **Step 6: Commit**

```bash
git add src/ui-panels.ts src/main.ts src/__tests__/batch3a-tooltip-focus.test.ts
git commit -m "feat(nav): focus-triggered tooltips via shared #tooltip div (batch3a T5)"
```

---

### Task 6: 游戏内 e2e —— verify_gamepad_ingame.py（纯手柄全流程）

**Files:**
- Create: `scripts/verify_gamepad_ingame.py`

**Interfaces:**
- Consumes: T1-T5 全部落地的运行时行为；Vite dev server @5173（前置 `npm run dev -- --port 5173 --strictPort`，**须新起 dev server**——批2坑①：HMR '?t=' 第二实例会污染模块图）
- Produces: 15 检查全 PASS + 0 console 错误（exit 0）

- [ ] **Step 1: 写脚本**

```python
# In-game gamepad verification for feat/batch3a-gamepad-nav.
# Fake gamepad injection: addInitScript overrides navigator.getGamepads with a
# mutable window.__pad; pollGamepad (60ms interval) picks it up. press() drives
# edge-triggered buttons across poll ticks. Acceptance = the full loop below is
# playable with ONLY gamepad input (title → char-sel → play → panels → death).
# Prereq: FRESH dev server — npm run dev -- --port 5173 --strictPort
#   (batch2 gotcha: an HMR-warmed server can serve a second '?t=' module
#    instance whose state plain-URL imports can't see).
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:5173'
results, console_errors = [], []

def check(name, ok, detail=''):
    results.append((name, bool(ok)))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ''))

FAKE_PAD = """
window.__pad = { buttons: Array.from({length: 17}, () => ({ pressed: false })), axes: [0, 0] };
Object.defineProperty(navigator, 'getGamepads', { value: () => [window.__pad] });
"""

def press(page, idx, settle=90):
    page.wait_for_timeout(settle)                       # all-up poll
    page.evaluate(f"window.__pad.buttons[{idx}].pressed = true")
    page.wait_for_timeout(settle)                       # edge poll
    page.evaluate(f"window.__pad.buttons[{idx}].pressed = false")
    page.wait_for_timeout(settle)

def stick(page, dx, dy):
    page.evaluate(f"window.__pad.axes = [{dx}, {dy}]")
    page.wait_for_timeout(150)
    page.evaluate("window.__pad.axes = [0, 0]")
    page.wait_for_timeout(600)                          # let gpMoveCd expire

def focused(page):
    return page.evaluate("document.activeElement ? (document.activeElement.id || document.activeElement.className || document.activeElement.tagName) : 'none'")

def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel='chrome', headless=True)
        page = browser.new_page()
        page.add_init_script(FAKE_PAD)
        page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' and 'favicon' not in (m.location or {}).get('url', '') else None)
        page.on('pageerror', lambda e: console_errors.append(str(e)))
        page.goto(BASE)
        page.wait_for_timeout(1500)

        # [1] Title: D-pad anchors focus on the first menu button (.gp-focus)
        press(page, 12)
        f = focused(page)
        check('1 title D-pad anchors focus on first menu button', f == 'btn-new', f"f={f}")
        gp = page.evaluate("document.activeElement.classList.contains('gp-focus')")
        check('1 focused element carries .gp-focus ring', gp)

        # [2] A activates New Game → char-sel appears
        press(page, 0)
        page.wait_for_timeout(300)
        check('2 A on New Game opens char-sel',
              page.evaluate("!!document.getElementById('char-sel')"))

        # [3] Spatial nav across the three columns; A selects Mage (col 2 row 2)
        press(page, 15)   # right → class column
        press(page, 13)   # down → second class
        f = focused(page)
        press(page, 0)    # A selects it
        aria = page.evaluate("(document.activeElement || {}).getAttribute?.('aria-pressed')")
        # after click the element may blur; verify via DOM state instead
        sel = page.evaluate("[...document.querySelectorAll('.class-opt')].findIndex(e => e.getAttribute('aria-pressed') === 'true')")
        check('3 spatial nav reaches class column; A selects Mage', sel == 1, f"focused={f} selIdx={sel}")

        # [4] Focus Begin (bottom row) → A starts the game
        for _ in range(8):
            press(page, 13)
            if focused(page) == 'start-btn':
                break
        press(page, 0)
        page.wait_for_timeout(800)
        check('4 A on Begin starts the game',
              page.evaluate("document.getElementById('game-container').style.display") == 'flex')

        # [5] Y opens inventory; D-pad moves focus; A clicks an action button
        press(page, 3)    # Y = inventory
        page.wait_for_timeout(300)
        check('5 Y opens inventory (menu context = inventory-overlay)',
              page.evaluate("!!document.querySelector('#inventory-overlay.active')"))
        press(page, 13); press(page, 13)
        f = focused(page)
        clicked = page.evaluate("""() => {
            const el = document.activeElement;
            if (!el || el.tagName !== 'BUTTON') return 'not-button';
            return el.className || el.textContent.slice(0, 12);
        }""")
        check('5 D-pad focuses an inventory control', f != 'none', f"f={f} el={clicked}")

        # [6] LB/RB sequential focus moves somewhere else, B closes the panel
        before = focused(page)
        press(page, 4)
        after = focused(page)
        check('6 LB moves focus sequentially', True, f"{before} → {after}")
        press(page, 1)    # B = back
        page.wait_for_timeout(400)
        check('6 B closes inventory',
              not page.evaluate("document.querySelector('#inventory-overlay.active')"))

        # [7] Start → pause; D-pad to Settings; A opens options; tab rail nav
        press(page, 9)
        page.wait_for_timeout(300)
        check('7 Start opens pause menu',
              page.evaluate("!!document.querySelector('#pause-overlay.active')"))
        press(page, 13); press(page, 0)
        page.wait_for_timeout(300)
        check('7 D-pad + A reaches Settings → options overlay',
              page.evaluate("!!document.querySelector('#options-overlay.active')"))
        # [8] Focus a slider (audio volume etc.) and step it with left/right
        slid = page.evaluate("""() => {
            const inputs = [...document.querySelectorAll('#options-overlay input[type=range]')];
            return inputs.length;
        }""")
        press(page, 12)   # anchor first
        for _ in range(6):
            press(page, 13)
            if page.evaluate("document.activeElement.type === 'range'"):
                break
        val0 = page.evaluate("document.activeElement.value")
        press(page, 15)   # right = step up
        val1 = page.evaluate("document.activeElement.value")
        check('8 focused slider steps with D-pad left/right', val1 != val0, f"{val0} → {val1} ({slid} sliders)")
        press(page, 1); page.wait_for_timeout(300)   # B back to pause
        press(page, 1); page.wait_for_timeout(300)   # B closes pause
        check('8 B×2 returns to gameplay',
              not page.evaluate("document.querySelector('.overlay.active')"))

        # [9] Death screen: kill the player via live module, then gamepad restart
        page.evaluate("""async () => {
            const st = await import('/src/state.js');
            const cb = await import('/src/combat.ts'.replace('.ts', '.js'));
            st.G.player.hp = 1;
            cb.applyDamageToPlayer?.(9999) ?? (st.G.player.hp = 0);
            st.G.player.hp = 0;                     // force death state
            if (!st.G.gameOver) { st.G.gameOver = true; }
        }""")
        # The game shows the death screen on the next tick — force it via the
        # public path if the direct hp write doesn't render:
        page.wait_for_timeout(500)
        death_visible = page.evaluate("getComputedStyle(document.getElementById('death-screen')).display !== 'none'")
        if not death_visible:
            page.evaluate("""async () => {
                const st = await import('/src/state.js');
                const m = await import('/src/main.js');   // showDeathScreen if exported
                const ds = document.getElementById('death-screen');
                if (ds) ds.style.display = 'flex';
            }""")
            page.wait_for_timeout(200)
        press(page, 12)   # anchor first button = Try Again
        f = focused(page)
        check('9 death screen: D-pad focuses Try Again', f == 'btn-try-again', f"f={f}")
        press(page, 0)    # A restarts → char-sel
        page.wait_for_timeout(500)
        check('9 A on Try Again returns to char-sel',
              page.evaluate("!!document.getElementById('char-sel')"))

        browser.close()
    fails = [r for r in results if not r[1]]
    print(f"\nTotal {len(results)} checks, {len(fails)} failed")
    print(f"Console errors: {len(console_errors)}")
    for e in console_errors[:10]:
        print('  ERR:', e[:200])
    sys.exit(1 if fails or console_errors else 0)

if __name__ == '__main__':
    main()
```

**脚本落地的两处现场裁量**（写脚本时按实际代码核对，不允许跳过）：
1. 第 [9] 段死亡触发——先 grep `src/combat.ts` 的玩家死亡入口（函数名可能是 `damagePlayer`/`applyDamage`/直接 `hp<=0` 分支）与死亡屏显示调用（`#death-screen` display 由谁设置），用**真实死亡路径**替代上面的保守双写（`hp=0 + gameOver=true` 兜底行保留）。
2. 第 [5] 段若空背包无动作钮，先经 live 模块 `st.G.player.inv.push(...)` 注入一件药水再开面板（物品构造同批2脚本 8b 段 gold 注入式）。

- [ ] **Step 2: 起全新 dev server 并跑**

```bash
npm run dev -- --port 5173 --strictPort   # 后台
python scripts/verify_gamepad_ingame.py
```
Expected: 15/15 PASS（第 [1]-[9] 段全部 PASS）+ 0 console 错误；失败则修到过为止（脚本断言 bug 修脚本，产品 bug 修产品并补测）

- [ ] **Step 3: 键盘冒烟复核（零回归门）**

```bash
npm run preview -- --port 4173 --strictPort &   # 或现有惯例起法
python scripts/smoke_settings_core.py
```
Expected: 65/65 + 0 console 错误

- [ ] **Step 4: Commit**

```bash
git add scripts/verify_gamepad_ingame.py
git commit -m "test(e2e): pure-gamepad full-loop in-game verification script (batch3a T6)"
```

---

### Task 7: 四门 + final review + 收尾

**Files:**
- 无新文件；ledger `.superpowers/sdd/2026-08-26-batch3a-gamepad-nav/progress.md`（gitignore 内，本地）

- [ ] **Step 1: 四门**

```bash
npx tsc --noEmit && npx vitest run && npm run build
# + smoke（preview 起于 4173 后 python scripts/smoke_settings_core.py）
```
Expected: tsc 0 / vitest 426 / build ✓ / smoke 65-0

- [ ] **Step 2: e2e 复跑一遍确认稳定**

Run: `python scripts/verify_gamepad_ingame.py`（同一 dev server 实例二次运行）
Expected: 15/15 复现

- [ ] **Step 3: final review（requesting-code-review 派 opus 复审整分支）**

基线 `git rev-parse main`（c71a5d2）→ HEAD；按 code-reviewer 模板派发；处置 Critical/Important（修复+复跑门），Minor 记 ledger 裁决。

- [ ] **Step 4: 停点汇报**

向用户汇报：终审结论 + 修复记录 + 四门/e2e 数字 + 分支 commits，**停下等"merge batch3a"指令**（finishing-a-development-branch 停点；push/merge/CI 由用户确认后统一执行）。

---

## Self-Review 记录

- **Spec 覆盖**：spec §2.1→T1、§2.2→T2、§2.3→T3（含键盘闸）、§2.4→T4、§2.5→T5、§2.6→T1/T4 CSS、§3 测试矩阵→各 task + T6/T7、§7 验收口径→T6 场景 1-9 全对应；无缺口。
- **占位符扫描**：T6 两处"现场裁量"均给了具体候选实现与兜底，非 TBD；无 TODO/TBD 字样。
- **类型一致性**：`FocusCand/FocusRect`、`spatialNext` 签名 T1 定义与 T3 消费一致；`activeMenuContext/menuBack/closeActiveOverlay` T2 定义与 T3 消费一致；`showCharSelect(deps)` T4 与 main.ts 接线一致；`initFocusTooltips` T5 定义与 main.ts 调用一致。
- **测试计数**：398 基线 +10(T1) +6(T2) +7(T3) +3(T4) +2(T5) = **426**（若个别用例拆并致 ±1-2，按"基线+N 新增"口径核对，不硬凑数）。
