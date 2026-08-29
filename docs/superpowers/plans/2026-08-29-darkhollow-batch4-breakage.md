# 批4「断裂修复+一致性」Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 清零 2026-08-28 五路审计的 1 P1（eventFlags 不入存档）+ 7 P2 + 顺手包，全部 TDD。

**Architecture:** 纯 bug 修复批，零新玩法。数据层（save/types/game/combat/relics）与表现层（menu-context/item-intro/input/particles/sprites/main）各自小 diff，贴现有模式（optional 字段迁移对、closeActiveOverlay 梯子、paintIcon 管线、source-discipline 门）。

**Tech Stack:** TypeScript + Vite + Canvas + vitest(happy-dom) + Playwright e2e（channel='chrome'）。

**Spec:** `docs/superpowers/specs/2026-08-29-batch4-breakage-consistency-design.md`（计划从 spec 论证，执行者两份都读）

## Global Constraints

- 基线 `main@106a53d`；分支 `feat/batch4-breakage`（从 main 切，最终 ff-merge）。
- 基线测试数 **462/462** 绿 + `npx tsc --noEmit` 0 错——每 task 结束都必须保持全绿；**计数永远基线+N**（别信 spec/plan 的预估数，以实际跑出的为准）。
- `npx tsc --noEmit` 必须**裸跑贴输出原文**（过 grep 管道会吞 exit code——历史坑）。
- happy-dom 无 canvas2d：只走有 `if (!ctx) return` 守卫的路径（paintIcon:2573-2574 已守卫）。
- 相对导入带 `.js` 后缀（ESM 惯例）；新 UI 文案一律 i18n key。
- 测试文件沿用各文件已有的 `vi.mock` 清单惯例；改共享 mock 前先读该测试文件全文。
- 不做（出界清单见 spec §2 末尾）：其余 items.ts 英文浮字、z-index 重构、lore relic 条目、连续方向键键盘导航。

---

### Task 1: eventFlags 持久化（P1）

**Files:**
- Modify: `src/save.ts:37-43`（buildSave）、`src/save.ts:62-74`（loadGame）
- Modify: `src/types.ts:580-591`（SaveData）
- Modify: `src/game.ts:30-38`（initGame）
- Test: `src/__tests__/save.test.ts`（追加 describe；复用其 fixtureG 与既有 mock 清单）

**Interfaces:**
- Consumes: `GameState.eventFlags?: Record<string, boolean>`（types.ts:545 已存在，本 task 只补 SaveData 侧与读写）。
- Produces: 存档 JSON 新增可选顶层字段 `eventFlags`；`loadGame` 产出的 GameState 恒有 `eventFlags`（存档缺字段时为 `{}`）。后续 task 无依赖。

- [ ] **Step 1: 写失败测试** — 在 `src/__tests__/save.test.ts` 末尾追加（并把 :19 的 import 行改为 `import { autoSave, saveGame, loadGame } from '../save.js';`；再把文件顶部 state.js mock 的 `setGameState: () => {}` 改为 `setGameState: (g: unknown) => { (globalThis as { G?: unknown }).G = g; }`——loadGame 测试靠它捕获恢复结果，现有用例不调 loadGame 不受影响）：

```ts
// 批4 P1: eventFlags (once-per-run event sites) must survive save/load.

describe('批4 P1: eventFlags persists through save/load', () => {
  beforeEach(() => {
    localStorage.clear(); vi.clearAllMocks();
    // loadGame touches these three DOM nodes directly (save.ts:137-140).
    document.body.innerHTML = '<div id="title-screen"></div><div id="game-container"></div><div id="log-panel"></div>';
  });

  it('buildSave writes eventFlags into the save JSON', () => {
    (globalThis as any).G = { ...fixtureG(false), eventFlags: { cursed_altar: true, sealed_box: true } };
    autoSave();
    const s = JSON.parse(localStorage.getItem('dh_save')!);
    expect(s.eventFlags).toEqual({ cursed_altar: true, sealed_box: true });
  });

  it('loadGame restores eventFlags into the new GameState', () => {
    (globalThis as any).G = { ...fixtureG(false), eventFlags: { cursed_altar: true } };
    autoSave();
    loadGame();
    expect((globalThis as any).G.eventFlags).toEqual({ cursed_altar: true });
  });

  it('old save without eventFlags loads to {} (not undefined)', () => {
    (globalThis as any).G = fixtureG(false);
    autoSave();
    const s = JSON.parse(localStorage.getItem('dh_save')!);
    delete s.eventFlags;   // simulate a pre-batch4 save
    localStorage.setItem('dh_save', JSON.stringify(s));
    loadGame();
    expect((globalThis as any).G.eventFlags).toEqual({});
  });
});
```

- [ ] **Step 2: 跑测试确认失败** — `npx vitest run src/__tests__/save.test.ts`；期望前两条 FAIL（`s.eventFlags` undefined / `G.eventFlags` undefined），第三条 FAIL（undefined ≠ {}）。

- [ ] **Step 3: 最小实现** — 四处：

`src/save.ts` buildSave（:41 `wardenCd: g.wardenCd ?? 0,` 之后加一行）：
```ts
    wardenCd: g.wardenCd ?? 0,
    eventFlags: g.eventFlags || {},
```

`src/save.ts` loadGame（:73 `wardenCd: Math.max(2, s.wardenCd ?? 0),` 之后加一行）：
```ts
      wardenCd: Math.max(2, s.wardenCd ?? 0),
      eventFlags: s.eventFlags || {},
```

`src/types.ts` SaveData（:590 `wardenCd?: number;` 之后加一行，与 GameState:545 完全对齐）：
```ts
  wardenCd?: number;
  eventFlags?: Record<string, boolean>;
```

`src/game.ts` initGame（:37 `wardenCd: rng(4, 6),` 之后加一行）：
```ts
      wardenCd: rng(4, 6),
      eventFlags: {},
```

- [ ] **Step 4: 跑测试确认通过** — `npx vitest run src/__tests__/save.test.ts`；期望全 PASS（3 旧 + 3 新）。

- [ ] **Step 5: 全量回归 + 提交**

```bash
npx vitest run   # 465/465（462 基线 + 3 新）
git add src/save.ts src/types.ts src/game.ts src/__tests__/save.test.ts
git commit -m "fix(save): persist eventFlags through save/load — once-per-run sites stay consumed after Continue (batch4 P1)"
```

---

### Task 2: lore 三连（creator 解锁 / relic 死写入 / boss 守卫）

**Files:**
- Modify: `src/combat.ts:589-596`（grantKillRewards 的 isBoss 块）
- Modify: `src/relics.ts:174`（删一行）
- Test: `src/__tests__/grantKillRewards.test.ts`（追加 describe；unlockLore 已在该文件 mock）
- Create: `src/__tests__/batch4-consistency.test.ts`（source-discipline 门，本 task 先建第一条）

**Interfaces:**
- Consumes: `unlockLore(id: string): void`（meta.ts:236-243，测试中已是 vi.fn）；`FINAL = 40`（config.ts:8，测试 mock 为 40）。
- Produces: 无新接口；lore 行为变化——`boss:<floor>` 仅主线写入、`world:creator` 在 F40 击杀（normal+endless）写入、grantRelic 不再写 `relic:` 前缀。

- [ ] **Step 1: 写失败测试** — `src/__tests__/grantKillRewards.test.ts`：先在 mock 区（:74 steam mock 之后）加一行防真实链（F40 normal 用例会走到 playerVictory → presentCreatorChoice → canRefuse/endingForChoice）：

```ts
// 批4: F40-normal kill reaches playerVictory → presentCreatorChoice — keep the
// endings chain mocked like every other combat dependency in this file.
vi.mock('../endings.js', () => ({ canRefuse: () => true, endingForChoice: () => 'slay', ENDINGS: {} }));
```

然后在文件末尾追加（该文件 unlockLore/grantRelic 已 import 且 mock，直接复用）：

```ts
describe('grantKillRewards — 批4 lore 三连', () => {
  beforeEach(() => {
    (globalThis as any).G = fixtureG();
    (globalThis as any).G.player.relics = [];
    vi.clearAllMocks();
  });

  it('boss lore is main-line only: endless F45 kill writes no boss: id', () => {
    const G = (globalThis as any).G;
    G.endless = true; G.floor = 45;
    grantKillRewards(fixtureEnemy({ isBoss: true }));
    expect(unlockLore).not.toHaveBeenCalledWith('boss:45');
  });

  it('boss lore: branch-mode kill writes no boss:<entry-floor> id', () => {
    const G = (globalThis as any).G;
    G.branchMode = true; G.floor = 10;
    grantKillRewards(fixtureEnemy({ isBoss: true }));
    expect(unlockLore).not.toHaveBeenCalled();
  });

  it('F40 Creator kill unlocks world:creator (endless variant — no victory path)', () => {
    const G = (globalThis as any).G;
    G.endless = true; G.floor = 40;
    grantKillRewards(fixtureEnemy({ isBoss: true }));
    expect(unlockLore).toHaveBeenCalledWith('world:creator');
  });

  it('F40 normal kill unlocks world:creator before playerVictory runs', () => {
    const G = (globalThis as any).G;
    G.floor = 40;
    G.player.corruption = 0;
    // playerVictory → presentCreatorChoice touches these DOM nodes (combat.ts:516-528).
    document.body.innerHTML =
      '<div id="ending-choice"></div><div id="ending-title"></div><div id="ending-desc"></div>' +
      '<button id="btn-ending-refuse"></button>';
    grantKillRewards(fixtureEnemy({ isBoss: true }));
    expect(unlockLore).toHaveBeenCalledWith('world:creator');
    expect(unlockLore).toHaveBeenCalledWith('boss:40');
  });
});
```

再建 `src/__tests__/batch4-consistency.test.ts`（source-discipline 门，沿用 batch3d SRC_FILES 模式）：

```ts
// 批4: source-discipline gates — 行为难以单测触达的死代码/硬编码，用源码门钉住。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('批4 source gates', () => {
  it('relics.ts no longer dead-writes relic: lore ids (codex is driven by discoveredItems)', () => {
    const text = readFileSync(new URL('../relics.ts', import.meta.url), 'utf8');
    expect(text).not.toContain("unlockLore('relic:");
  });
});
```

- [ ] **Step 2: 跑测试确认失败** — `npx vitest run src/__tests__/grantKillRewards.test.ts src/__tests__/batch4-consistency.test.ts`；期望新 describe 前两条 FAIL（endless/branch 现状会写入）、第三四条 FAIL（world:creator 无解锁点）、source 门 FAIL（死写入还在）。

- [ ] **Step 3: 最小实现**

`src/combat.ts` isBoss 块（:589-592）改为：

```ts
  if (e.isBoss) {
    G.player.bossesKilledThisRun++;
    // 批4: boss codex is main-line only — endless F45+ scaled bosses and hollow
    // branch kills used to write boss:<floor> ids that have no LORE_ENTRIES row.
    if (!G.branchMode && !G.endless) unlockLore('boss:' + G.floor);
    // 批4: the F40 Creator kill (normal AND endless — both really slay him)
    // unlocks the previously dead-locked world:creator codex entry.
    if (G.floor === FINAL && !G.branchMode) unlockLore('world:creator');
    checkAch('boss_kill');
```

（:593 起的 victory/endless 分支不动。）

`src/relics.ts:174` 整行删除：
```ts
  unlockLore('relic:' + id);
```
（relics.ts 若因此不再使用 unlockLore，同步删掉顶部对应 import。）

- [ ] **Step 4: 跑测试确认通过** — 同 Step 2 命令，全 PASS（grantKillRewards 旧 6 + 新 4；source 门 1）。

- [ ] **Step 5: 全量回归 + 提交**

```bash
npx vitest run   # 470/470（465 + 5 新）
git add src/combat.ts src/relics.ts src/__tests__/grantKillRewards.test.ts src/__tests__/batch4-consistency.test.ts
git commit -m "fix(lore): main-line-only boss unlocks, F40 unlocks world:creator, drop dead relic: writes (batch4)"
```

---

### Task 3: 瞬态 UI 清理（returnToTitle / Continue / 结算屏）+ rAF 守卫

**Files:**
- Modify: `src/item-intro.ts:88-93`（新增 resetIntros，紧挨 closeItemIntro）
- Modify: `src/menu-context.ts`（新增 clearTransientUi export）
- Modify: `src/combat.ts:426-428 / :481-483`（playerDeath / playerVictory 接线）
- Modify: `src/main.ts:127-137 / :147`（returnToTitle / btn-cont 接线）
- Modify: `src/particles.ts:2`（import 补 introOpen）+ `:98-99`（守卫条件）——spec ⑥，rAF tick 内联条件不做单测，由 tsc + e2e 覆盖（spec §3 已裁决）
- Test: `src/__tests__/batch3a-menu-context.test.ts`（更新 item-intro mock + 新 describe）

**Interfaces:**
- Consumes: `closeActiveOverlay(): boolean`（menu-context.ts:15-34，已存在）；`hideOverlay(id)` / `setIntroOpen`（已有）。
- Produces:
  - `resetIntros(): void`（item-intro.ts export）——清空私有 queue + `hideOverlay('item-intro-overlay')` + `setIntroOpen(false)`。
  - `clearTransientUi(): void`（menu-context.ts export）——`resetIntros()` 后有界循环 `closeActiveOverlay()`。
  - Task 6 的 e2e 依赖这两个函数的行为（quit-to-title / Continue / 死亡后无 overlay 残留）。

- [ ] **Step 1: 写失败测试** — `src/__tests__/batch3a-menu-context.test.ts`：先把 :15 的 mock 改为

```ts
vi.mock('../item-intro.js', () => ({ closeItemIntro: vi.fn(), resetIntros: vi.fn() }));
```

import 区追加 `import { resetIntros } from '../item-intro.js';`，文件末尾追加：

```ts
import { clearTransientUi } from '../menu-context.js';

describe('批4 clearTransientUi', () => {
  it('flushes the intro queue, then walks the close ladder to the last overlay', () => {
    mockState.introOpen = true; mockState.eventOpen = true;
    document.body.innerHTML = `<div id="records-overlay" class="overlay active"></div>`;
    clearTransientUi();
    expect(resetIntros).toHaveBeenCalledTimes(1);
    expect(closeEvent).toHaveBeenCalled();                       // eventOpen rung
    expect(hideOverlay).toHaveBeenCalledWith('records-overlay'); // ladder tail rung
  });
  it('no-op when nothing is open (no infinite loop, no closers called)', () => {
    document.body.innerHTML = '';
    expect(() => clearTransientUi()).not.toThrow();
    expect(closeEvent).not.toHaveBeenCalled();
    expect(hideOverlay).not.toHaveBeenCalled();
  });
});
```

（注意：closers 在此文件全是 mock、不会真的翻转 open 旗标——这正是 clearTransientUi 必须**有界循环**而非 `while` 的原因，见 Step 3。）

- [ ] **Step 2: 跑测试确认失败** — `npx vitest run src/__tests__/batch3a-menu-context.test.ts`；期望新 describe FAIL（clearTransientUi 不是函数）。

- [ ] **Step 3: 最小实现**

`src/item-intro.ts`（:93 closeItemIntro 之后追加）：

```ts
// 批4: hard clear — unlike closeItemIntro (which ADVANCES to the next queued
// card), this drops the whole queue. Used when leaving the game context
// (quit-to-title, Continue) or when a settlement screen takes over.
export function resetIntros(): void {
  queue.length = 0;
  hideOverlay('item-intro-overlay');
  setIntroOpen(false);
}
```

`src/menu-context.ts`（closeActiveOverlay 之后追加；**有界**循环——closers 的正确性是它自己的责任，无限 while 会把别人的失误变成挂起）：

```ts
// 批4: full transient-UI reset for context switches (quit-to-title / Continue).
// resetIntros first (closeItemIntro would just advance the queue), then walk the
// ladder. Bounded: each rung must clear its own flag; 12 ≥ ladder depth.
export function clearTransientUi(): void {
  resetIntros();
  for (let i = 0; i < 12 && closeActiveOverlay(); i++) { /* ladder closes one rung per call */ }
}
```

（menu-context.ts 顶部 item-intro.js import 行改为 `import { closeItemIntro, resetIntros } from './item-intro.js';`）

`src/combat.ts` 接线两处：
- playerDeath（:428 `G.gameOver = true;` 之后）加 `resetIntros();`
- playerVictory（:483 `G.gameOver = true; G.won = true;` 之后）加 `resetIntros();`
- combat.ts 现有 `./item-intro.js` import 行（queueMechanicIntro 所在）追加 `resetIntros`。

`src/main.ts` 接线两处：
- import 区（:36 附近）加 `import { clearTransientUi } from './menu-context.js';`
- returnToTitle（:127 函数体第一行）加 `clearTransientUi();`
- :147 改为 `on('btn-cont', () => { clearTransientUi(); loadGame(); });`

`src/particles.ts`（spec ⑥ rAF 守卫，两行）：
- :2 import 行末尾补 `introOpen`（现为 `menuOpen, invOpen, skillOpen, talentOpen, achOpen, helpOpen, eventOpen`）；
- :98-99 守卫条件追加 `|| introOpen || G.gameOver || G.won`（tick 首行已有 `!G` 早退，G 非空）：

```ts
  if (menuOpen || invOpen || skillOpen || talentOpen || achOpen || helpOpen || eventOpen
    || introOpen || G.gameOver || G.won
    || !!optOv?.classList.contains('active')) {
```

- [ ] **Step 4: 跑测试确认通过 + 排查涟漪**

`npx vitest run src/__tests__/batch3a-menu-context.test.ts` 全 PASS。然后 `npx vitest run` 全量——若任何**调用 playerDeath/playerVictory 的既有测试**因真实 resetIntros 链炸（ui-panels 真实 hideOverlay 找不到 DOM 之类），给该测试文件加：

```ts
vi.mock('../item-intro.js', () => ({ queueMechanicIntro: vi.fn(), queueRelicIntro: vi.fn(), resetIntros: vi.fn() }));
```

（保持该文件其余 mock 不动；加之前先读该文件确认它没 mock 过 item-intro。）

- [ ] **Step 5: 全量回归 + 提交**

```bash
npx vitest run   # 计数 = 上一 task 基线 + 2 新（+可能 0；以实跑为准）
git add src/item-intro.ts src/menu-context.ts src/combat.ts src/main.ts src/particles.ts src/__tests__/batch3a-menu-context.test.ts
git commit -m "fix(ui): clear transient overlays on quit-to-title/Continue/settlement + rAF guard (batch4)"
```

（main.ts 接线无单测——入口模块不可导入；由 Task 6 e2e 场景 2/3 覆盖。）

---

### Task 4: 教学卡 sprite 化 + 传送浮字 i18n

**Files:**
- Modify: `src/sprites.ts:2161` 附近（TEMPLATES 尾部新增 T_MUSHROOM，**不进 THEME_PAL**）
- Modify: `src/item-intro.ts:19-23`（MECHANIC_CARDS 结构）、`:70-86`（showNext paint 分支）、`:100-111`（renderCard mechanic 分支）、`:9`（import paintIcon）
- Modify: `src/items.ts:83`（浮字 i18n）
- Test: `src/__tests__/batch2-mechanic-cards.test.ts`（mock 补 paintIcon + 新断言）
- Test: `src/__tests__/batch3c-sprites.test.ts`（T_MUSHROOM 门）
- Test: `src/__tests__/batch4-consistency.test.ts`（追加传送 source 门）

**Interfaces:**
- Consumes: `paintIcon(target: HTMLCanvasElement, kind: string, color = '#cccccc'): void`（sprites.ts:2572，ctx null 已守卫）；`buildPalette` 字符集 M/D/L/W/N（sprites.ts:2230-2243）。
- Produces: `TEMPLATES.T_MUSHROOM`（16×16 单 hue 模板）；`MECHANIC_CARDS` 新形状 `{ tpl: string; hue: string; col: string; tk: string; bk: string }`（col 保留驱动标题/正文色，hue 驱动 sprite）。

- [ ] **Step 1: 写失败测试**

`src/__tests__/batch2-mechanic-cards.test.ts`：:7 的 sprites mock 改为 `vi.mock('../sprites.js', () => ({ paintItemIcon: vi.fn(), paintRelicIcon: vi.fn(), paintIcon: vi.fn() }));`，import 区加 `import { paintIcon } from '../sprites.js';`，末尾追加：

```ts
describe('批4: mechanic card renders a pixel sprite, not an emoji', () => {
  it('fungal card emits canvas.lic + paints T_MUSHROOM', () => {
    queueMechanicIntro('fungal');
    const html = document.getElementById('item-intro-content')!.innerHTML;
    expect(html).toContain('canvas class="lic"');
    expect(html).not.toMatch(/🟪|👁|🍄/);
    expect(paintIcon).toHaveBeenCalledWith(expect.anything(), 'T_MUSHROOM', '#06d6a0');
  });
  it('warden card paints T_EYE with its hue', () => {
    queueMechanicIntro('warden');
    expect(paintIcon).toHaveBeenCalledWith(expect.anything(), 'T_EYE', '#9a2be2');
  });
});
```

`src/__tests__/batch3c-sprites.test.ts` 末尾追加：

```ts
describe('批4: T_MUSHROOM template (fungal mechanic card)', () => {
  it('exists and is a valid 16×16 grid', () => {
    const tpl = TEMPLATES.T_MUSHROOM;
    expect(tpl).toBeTruthy();
    expect(tpl!.length).toBe(16);
    tpl!.forEach(row => expect(row.length, row).toBe(16));
  });
});
```

`src/__tests__/batch4-consistency.test.ts` 的 describe 里追加：

```ts
  it('teleport float text is i18n-driven (no hardcoded CJK in items.ts)', () => {
    const text = readFileSync(new URL('../items.ts', import.meta.url), 'utf8');
    expect(text).not.toContain('⚡传送');
    expect(text).toContain("t('ig.teleport')");
  });
```

- [ ] **Step 2: 跑测试确认失败** — `npx vitest run src/__tests__/batch2-mechanic-cards.test.ts src/__tests__/batch3c-sprites.test.ts src/__tests__/batch4-consistency.test.ts`；新断言全 FAIL（T_MUSHROOM 不存在 / innerHTML 仍是 emoji div / ⚡传送还在）。

- [ ] **Step 3: 最小实现**

`src/sprites.ts` TEMPLATES 尾部（:2161 `T_SHADOW` 结束、`};` 之前）追加（M=主色 #06d6a0 菌盖、W=浅斑、D=暗缘/菌褶、N=菌柄棕影；执行时可微调像素但必须保持每行 16 字符——:2170 的 dev sanity 循环会兜底）：

```ts
  // T_MUSHROOM — 真菌教学卡（批4）：M 菌盖+W 浅斑+D 菌褶，W/N 菌柄。
  // 刻意不进 THEME_PAL：单 hue 走 buildPalette('#06d6a0')（同 T_INFINITY/T_KEY 理由）。
  T_MUSHROOM: [
    "................",
    ".....MMMM.......",
    "...MMMMMMMM.....",
    "..MMWWMMMMMD....",
    ".MMWWMMMMMMMD...",
    ".MWWMMMMMMMMDD..",
    "MMMMMMMMMMMMDDM.",
    "MMMDMMMMMMMDDDM.",
    ".MDDDDDDDDDDDD..",
    "......WWN.......",
    "......WWN.......",
    "......WWN.......",
    ".....WWWN.......",
    ".....WWWN.......",
    "....WWWWWN......",
    "................",
  ],
```

`src/item-intro.ts` 三处：

:9 import 行改 `import { paintItemIcon, paintRelicIcon, paintIcon } from './sprites.js';`

:19-23 改为：

```ts
const MECHANIC_CARDS: Record<string, { tpl: string; hue: string; col: string; tk: string; bk: string }> = {
  corruption: { tpl: 'T_SHADOW', hue: '#b583f6', col: '#b583f6', tk: 'intro.mcCorruptionTitle', bk: 'intro.mcCorruptionBody' },
  warden:     { tpl: 'T_EYE',    hue: '#9a2be2', col: '#9a2be2', tk: 'intro.mcWardenTitle',     bk: 'intro.mcWardenBody' },
  fungal:     { tpl: 'T_MUSHROOM', hue: '#06d6a0', col: '#06d6a0', tk: 'intro.mcFungalTitle',    bk: 'intro.mcFungalBody' },
};
```

showNext 的 paint 分支（:76-82）改为：

```ts
  if (cv) {
    if (target.kind === 'item') paintItemIcon(cv, target.item);
    else if (target.kind === 'mechanic') {
      const mc = MECHANIC_CARDS[target.id];
      if (mc) paintIcon(cv, mc.tpl, mc.hue);
    } else {
      const rdef = RELICS.find(r => r.id === target.id);
      if (rdef) paintRelicIcon(cv, rdef);
    }
  }
```

renderCard mechanic 分支（:103-108）emoji div 换 canvas（照 relic 分支 :119 形状）：

```ts
    return `
      <div style="text-align:center;margin-bottom:8px">
        <canvas class="lic" width="16" height="16" style="image-rendering:pixelated;width:48px;height:48px;vertical-align:middle;background:${mc.hue}22;border:1px solid ${mc.hue};border-radius:4px;padding:4px" aria-hidden="true"></canvas>
        <div style="color:${mc.col};font-size:1.3em;font-weight:700;margin-top:4px">${t(mc.tk)}</div>
        <div style="color:#ffd700;font-size:.8em;margin-top:4px">✦ ${t('intro.firstDiscover')}</div>
      </div>
      <div style="background:rgba(155,83,229,.1);border:1px solid #9a2be2;border-radius:4px;padding:8px 10px;margin:8px 0">
        <div style="color:#e8d8ff">${t(mc.bk)}</div>
      </div>`;
```

`src/items.ts:83`：

```ts
        fxFlash(p.x, p.y, '#9b5de5', 1.4); flt(p.x, p.y, '⚡' + t('ig.teleport'), '#9b5de5');
```

（`ig.teleport` 已存在：i18n.ts:326 en 'Teleport' / zh '传送'，勿新建。）

- [ ] **Step 4: 跑测试确认通过** — Step 2 命令全 PASS；再 `npx vitest run src/__tests__/item-intro.test.ts src/__tests__/batch3d-residue.test.ts`（item-intro 真链 + 源码 canvas aria 门——新 canvas 带 aria-hidden 应天然过）。

- [ ] **Step 5: 全量回归 + 提交**

```bash
npx vitest run   # 计数 = 上一 task 基线 + 4 新（以实跑为准）
git add src/sprites.ts src/item-intro.ts src/items.ts src/__tests__/batch2-mechanic-cards.test.ts src/__tests__/batch3c-sprites.test.ts src/__tests__/batch4-consistency.test.ts
git commit -m "feat(ui): sprite icons for mechanic intro cards (T_MUSHROOM/T_EYE/T_SHADOW) + localized teleport float (batch4)"
```

---

### Task 5: 顺手包（手柄 standard 过滤 / sig 去冗 / ESC 关 records·codex / title-particles aria）

**Files:**
- Modify: `src/input.ts:280`（pads.find standard）、`:184-187`（ESC records/codex 链）
- Modify: `src/sprites.ts:2545`（sig 条件裸 key）
- Modify: `index.html:12`（aria-hidden）
- Test: `src/__tests__/batch3a-input-menu.test.ts`（pad 补 mapping + 2 新 describe）
- Test: `src/__tests__/batch3d-residue.test.ts`（index.html 门）
- Test: `src/__tests__/batch4-consistency.test.ts`（sig source 门）

**Interfaces:**
- Consumes: `hideOverlay`（input.ts:8 已 import）、`bridge.openPause`（:19 mock 有）、`ENTITY_PAL`（sprites.ts:2295）。
- Produces: pollGamepad 只认 `mapping === 'standard'` 的手柄；ESC 在 records/codex `.active` 时关它们（标题屏也生效）。

- [ ] **Step 1: 写失败测试**

`src/__tests__/batch3a-input-menu.test.ts`：
1. :32-35 hoisted pad 对象补一个字段：`mapping: 'standard',`（不加这个，改动后**该文件全部既有用例**都会因找不到 standard 手柄而挂——先补）。
2. import 区确保有 `import { hideOverlay } from '../ui-panels.js';` 与 `import { bridge } from '../bridge.js';`（该文件 mock 已提供）。
3. 末尾追加（keyboard 事件走 initInput 注册的 document listener——该文件已有调用 initInput 的用例，沿用同一初始化路径；若 initInput 尚未在文件级调用，在下面 describe 的 beforeAll 里调用一次 `initInput()`）：

```ts
describe('批4: standard-mapping gamepad filter', () => {
  it('ignores a non-standard pad entirely (axes held → no dispatch)', () => {
    const bad = { buttons: Array.from({ length: 17 }, () => ({ pressed: false })), axes: [1, 0], mapping: 'dinput' };
    (navigator as any).getGamepads = () => [bad];
    pollGamepad();
    expect(movePlayer).not.toHaveBeenCalled();
  });
  it('skips null entries: first standard pad wins', () => {
    (navigator as any).getGamepads = () => [null, pad];
    pad.axes = [1, 0];
    pollGamepad();
    expect(movePlayer).toHaveBeenCalled();
    pad.axes = [0, 0];
  });
});

describe('批4: keyboard ESC closes records/codex (parity with gamepad B)', () => {
  it('records-overlay active → ESC hides it, does not open pause', () => {
    document.body.innerHTML = '<div id="records-overlay" class="overlay active"></div>';
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(hideOverlay).toHaveBeenCalledWith('records-overlay');
    expect(bridge.openPause).not.toHaveBeenCalled();
  });
  it('nothing open → ESC still opens pause (regression guard)', () => {
    document.body.innerHTML = '';
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(bridge.openPause).toHaveBeenCalled();
  });
});
```

（若该文件的 gameplay 分发断言显示 axes 在此 mock 态走路由而非 movePlayer，把第一条的断言换成该文件任一既有 gameplay axes 断言所用的同一 observable——原则不变：非 standard 手柄零分发。）

`src/__tests__/batch3d-residue.test.ts` 的 T4 describe 里追加：

```ts
  it('index.html decorative canvases (title-particles) carry aria-hidden', () => {
    const text = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    const tags = text.match(/<canvas[^>]*>/g) ?? [];
    expect(tags.length, 'index.html canvas tags (file moved?)').toBeGreaterThan(0);
    for (const tag of tags) {
      expect(tag.includes('aria-hidden="true"'), `${tag.slice(0, 70)}… missing aria-hidden`).toBe(true);
    }
  });
```

`src/__tests__/batch4-consistency.test.ts` 追加：

```ts
  it('ENTITY_PAL entities share one cache sig per template (bare key when palette is fixed)', () => {
    const text = readFileSync(new URL('../sprites.ts', import.meta.url), 'utf8');
    expect(text).toContain("ENTITY_PAL[item.spriteKind]) ? key : key + ':' + item.c");
  });
```

- [ ] **Step 2: 跑测试确认失败** — `npx vitest run src/__tests__/batch3a-input-menu.test.ts src/__tests__/batch3d-residue.test.ts src/__tests__/batch4-consistency.test.ts`；期望：ESC 第一条 FAIL（现状走 openPause）、index.html 门 FAIL（无 aria-hidden）、sig 门 FAIL；standard 过滤两条 FAIL（现状 pads[0] 不看 mapping——bad pad 会被分发 movePlayer / null-skip 第二条现状也过？注意第二条在现状可能已 PASS（pads[0]=null 时 `pads[0]` 为 null → return，同样不分发）——若已 PASS 就保留作回归守卫，不算失败项）。

- [ ] **Step 3: 最小实现**

`src/input.ts:280`：

```ts
  const gp = pads.find(p => p && p.mapping === 'standard');
```

（:281 `if (!gp) return;` 原样保留；:380 `gpPrevBtn = gp.buttons.map(...)` 依赖非空，不受影响。）

`src/input.ts:184-187` 改为：

```ts
    // overlay_close (ESC): records/codex are shown via showOverlay but have no
    // open-flag rung above — close them first (title screen included, where
    // openPause is a G=null no-op), else fall through to the pause menu.
    if (keyToAction(e) === 'overlay_close') {
      for (const id of ['records-overlay', 'codex-overlay']) {
        const el = document.getElementById(id);
        if (el?.classList.contains('active')) { hideOverlay(id); e.preventDefault(); return; }
      }
      bridge.openPause?.(); e.preventDefault(); return;
    }
```

`src/sprites.ts:2545`：

```ts
  const sig = (item.spriteKind && ENTITY_PAL[item.spriteKind]) ? key : key + ':' + item.c;
```

`index.html:12`：

```html
  <canvas id="title-particles" class="title-particles" aria-hidden="true"></canvas>
```

- [ ] **Step 4: 跑测试确认通过** — Step 2 命令全 PASS。

- [ ] **Step 5: 全量回归 + 提交**

```bash
npx vitest run   # 计数 = 上一 task 基线 + 5 新（以实跑为准）
git add src/input.ts src/sprites.ts index.html src/__tests__/batch3a-input-menu.test.ts src/__tests__/batch3d-residue.test.ts src/__tests__/batch4-consistency.test.ts
git commit -m "fix(input,a11y): standard-mapping gamepad filter, ESC closes records/codex, sig dedupe, title-particles aria (batch4)"
```

---

### Task 6: 全量回归 + 游戏内冒烟 + 脚本提交

**Files:**
- Create: `scripts/verify_batch4_ingame.py`（模板：`scripts/verify_batch3c_ingame.py` 同款——Vite dev server + ESM live import 同实例法、playwright `channel='chrome'`）
- Commit: `scripts/verify_reconnect_ingame.py`（工作树既有未提交修改，随本批入库）

**Interfaces:**
- Consumes: Task 1-5 全部产出；`scripts/verify_reconnect_ingame.py` 既有 e2e 脚本形态。
- Produces: 批4 验收证据（七门全绿）+ merge 前的最后回归。

- [ ] **Step 1: 提交遗留脚本修复**（先落袋，避免和后续 diff 混淆）：

```bash
git add scripts/verify_reconnect_ingame.py
git commit -m "test(e2e): close mechanic-intro overlay guard in reconnect script (was: stale after batch2 #4)"
```

- [ ] **Step 2: 写 verify_batch4_ingame.py**（照 verify_batch3c_ingame.py 的 launch/attach 骨架，断言四场景）：

1. **P1 存档往返**：进游戏走到首个事件站触发一次 once 事件（或直接 `page.evaluate` 往 `G.eventFlags` 写 `{cursed_altar:true}` 后调 autosave）→ `page.reload()` → Continue → `page.evaluate` 断言 `G.eventFlags.cursed_altar === true` 且 `eligibleEventSites` 结果不含 cursed_altar。
2. **Quit-to-title 清 UI**：手柄/键盘打开任一 intro 卡（`queueMechanicIntro('fungal')` 触发）→ 暂停菜单 Quit to Title → 断言 `document.querySelector('.overlay.active') === null` 且 `introOpen === false`，随后 WASD 按键不报错（标题屏无吞键怪象）。
3. **死亡屏无 intro 叠加**：入队 mechanic intro 后 `page.evaluate` 直接调 `playerDeath('test')` → 断言 `#item-intro-overlay` 无 `.active` 且 `#death-screen` 可见、z 序无遮挡（intro overlay 不 active 即可）。
4. **EN 传送浮字**：切 en → 使用传送卷轴（或 evaluate 直接走 teleport 分支）→ 断言浮字文本含 'Teleport' 不含 CJK。

跑法与既有脚本一致：先起 `npm run dev`，脚本连 `http://localhost:5173`，channel='chrome'（CDN 国内卡死，走系统 Chrome），结束打印 PASS/FAIL 汇总，全部通过 exit 0。

- [ ] **Step 3: 七门全绿**

```bash
npx tsc --noEmit          # 门1：0 错（裸跑，贴原文）
npx vitest run            # 门2：全绿（计数 = 462 基线 + 本批新增，钉在提交信息里）
node scripts/verify_batch4_ingame.py   # 门3：本批冒烟（或 python，按模板脚本的解释器惯例）
python scripts/verify_reconnect_ingame.py    # 门4：10/10（脚本修复的复验）
python scripts/verify_batch2_ingame.py       # 门5：20/20
python scripts/verify_batch3c_ingame.py      # 门6：64/64（教学卡 sprite 化最可能影响它——重点看 icons 断言）
python scripts/verify_gamepad_ingame.py      # 门7：22/22（standard 过滤 + ESC 链）
```

（实际脚本名以 `ls scripts/verify_*` 为准；e2e 期间零 console 错。任一门挂：先修再继续，不带病 merge。）

- [ ] **Step 4: 提交 + 收尾（merge 动作等 review 后，见总流程）**

```bash
git add scripts/verify_batch4_ingame.py
git commit -m "test(e2e): batch4 ingame verify battery (eventFlags roundtrip / UI clear / death overlay / EN warp text)"
```

之后按总流程走 `superpowers:requesting-code-review` → 处理意见 → `superpowers:verification-before-completion` → ff-merge main → push → 看 CI 四门真在跑 → 删分支。
