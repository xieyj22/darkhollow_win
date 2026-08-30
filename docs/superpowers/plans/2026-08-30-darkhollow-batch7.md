# 批7「结算与可达性」Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 死亡屏三件套（墓志铭+陨落者名单+事件残留清理）+ 可达性包（键盘行间移焦/tabindex/dialog 语义/aria-live/滑条手柄长按）+ i18n 信息包（术语/标点/日志聚合/日期列）全落地。

**Architecture:** 新纯函数模块 `src/epitaph.ts`（可注入随机源）+ `playerDeath(killer, cause?)` 签名扩展（10 调用点归类）；键盘移焦/滑条长按全部复用批3A 基建（`activeMenuContext`/`seqFocus`/`stepRange`/`menuMoveFocus`）；combat→events 的死亡清场走 bridge late-binding（events 已 import combat，反向必成环）。

**Tech Stack:** TS+Vite renderer / vitest(happy-dom) / Playwright（dev server 同实例法）。

**Spec:** `docs/superpowers/specs/2026-08-30-batch7-deathscreen-a11y-design.md`（两处计划期修正已回写：①死因行并入墓志铭模板句避免 killer 双显（spec 已改）；②"折叠头无按钮语义"经盘点**不存在**——codex tab 已是真 `<button>`，该项裁掉；③talent 面板缺标题元素是盘点新发现，本计划顺手补 h2+键）。

## Global Constraints

- 基线 `main@839923a`（批6 已合+spec 已入）；分支 `feat/batch7-deathscreen-a11y`。
- `npx tsc --noEmit` 裸跑贴原文；测试计数**实跑为准**（当前基线 vitest 506/506）。
- source 门读文件用动态路径形式 `new URL('../' + f, import.meta.url)`（批4 裁决）。
- 手柄/键盘 gameplay 行为零变化：键盘移焦只作用于 `activeMenuContext()` 非空的 overlay 态；gameplay 分支不动。
- en 文案零标点改动；zh 标点清洗只动 CJK 邻接的半角 `,;:!?`。
- 既有 e2e 五套（batch4-19/batch3c-64/gamepad-22/reconnect-10/batch5-28）全绿是回归证明。

---

### Task 1: epitaph 模块 + playerDeath(cause) + 死亡屏渲染 + eventOpen 残留清理（spec A 全部 + D）

**Files:**
- Create: `src/epitaph.ts`、`src/__tests__/batch7-epitaph.test.ts`、`src/__tests__/batch7-death-screen.test.ts`
- Modify: `src/i18n.ts`（18 新键）、`src/combat.ts:429-480`（签名+渲染+清场）、`src/bridge.ts`（closeEvent 槽）、`src/main.ts`（bridge 接线）、`src/enemies.ts:296`/`src/events.ts:100,121,198`/`src/items.ts:49`/`src/turn.ts:46,67,78`（cause 归类，仅 4 处需传参）、`index.html:108`（两个新 div）、`style/main.css:152 一带`（样式）

**Interfaces:**
- Produces: `type DeathCause = 'combat'|'trap'|'poison'|'starve'|'corruption'|'warden'`；`buildEpitaph(cause: DeathCause, killer: string, floor: number, turns: number, rand?: () => number): { template: string; flavor: string }`；`quoteFlavor(s: string): string`；`playerDeath(killer: string, cause?: DeathCause)`；`bridge.closeEvent?: VoidFn`。T2-T6 不消费本任务导出（i18n 键 `ui.close`/`up.date` 已在本任务一次性入库，供 T2/T4 用）。

- [ ] **Step 1: 写失败测试** — 两个新测试文件：

```ts
// src/__tests__/batch7-epitaph.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { buildEpitaph, quoteFlavor, type DeathCause } from '../epitaph.js';
import { setLang } from '../state.js';

beforeEach(() => setLang('zh'));

describe('buildEpitaph (pure, injectable rand)', () => {
  it('template carries killer/floor/turns in current lang', () => {
    const e = buildEpitaph('combat', '腐化巨魔', 23, 255, () => 0);
    expect(e.template).toContain('腐化巨魔');
    expect(e.template).toContain('23');
    expect(e.template).toContain('255');
  });
  it('every flavor slot in every class resolves to real text (no undefined/key leak)', () => {
    for (const cause of ['combat','trap','poison','starve','corruption','warden'] as DeathCause[]) {
      for (let i = 0; i < 6; i++) {
        const e = buildEpitaph(cause, 'X', 1, 1, () => i / 6);
        expect(e.flavor).toBeTruthy();
        expect(e.flavor).not.toContain('undefined');
        expect(e.flavor).not.toContain('ep.');
      }
    }
  });
  it('unknown cause falls back to combat lib without throwing', () => {
    expect(() => buildEpitaph('nonsense' as DeathCause, 'X', 1, 1, () => 0)).not.toThrow();
    expect(buildEpitaph('nonsense' as DeathCause, 'X', 1, 1, () => 0).flavor).toBeTruthy();
  });
  it('quoteFlavor per language', () => {
    expect(quoteFlavor('深渊有数')).toBe('「深渊有数」');
    setLang('en');
    expect(quoteFlavor('abyss')).toBe('“abyss”');
  });
});
```

```ts
// src/__tests__/batch7-death-screen.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { initGame } from '../game.js';
import { setEventOpen } from '../state.js';
import { playerDeath } from '../combat.js';
import { closeEvent } from '../events.js';
import { bridge } from '../bridge.js';
import { getMeta } from '../meta.js';

beforeEach(() => {
  localStorage.clear();
  document.getElementById('log-panel')!.innerHTML = '';
  bridge.closeEvent = closeEvent;   // main.ts 在真应用里接线；测试自带
  initGame(0, 0, false);
});

describe('death screen trio (批7 A + D)', () => {
  it('epitaph block renders template line + quoted flavor', () => {
    playerDeath('测试杀手', 'trap');
    const ep = document.getElementById('death-epitaph')!;
    expect(ep.querySelector('.ep-line')!.textContent).toContain('测试杀手');
    expect(ep.querySelector('.ep-flavor')!.textContent!).toMatch(/^「.+」$/);
  });
  it('renders last 5 fallen wardens with +N overflow row', () => {
    const m = getMeta();
    for (let i = 0; i < 7; i++) m.wardens.push({ name: `陨者${i}`, cls: 0, race: 0, floor: 10 + i, ts: 1 });
    playerDeath('X');
    const rows = [...document.querySelectorAll('#death-wardens .epw-row')];
    expect(rows.length).toBe(6);                      // 5 entries + overflow
    expect(rows[4].textContent).toContain('F16');
    expect(rows[5].textContent).toBe('+2');
    expect(document.querySelector('#death-wardens .epw-title')!.textContent).toBeTruthy();
  });
  it('empty wardens list renders nothing (no orphan header)', () => {
    playerDeath('X');
    expect(document.getElementById('death-wardens')!.innerHTML).toBe('');
  });
  it('event popup open at death is closed (批4 backlog: residue)', () => {
    setEventOpen(true);
    document.getElementById('event-popup')!.style.display = 'block';
    playerDeath('X', 'trap');
    expect(document.getElementById('event-popup')!.style.display).toBe('none');
  });
});
```

- [ ] **Step 2: 跑测试确认失败** — `npx vitest run src/__tests__/batch7-epitaph.test.ts src/__tests__/batch7-death-screen.test.ts`；期望全 FAIL（模块不存在/元素缺失）。

- [ ] **Step 3: i18n 新键** — `src/i18n.ts` 键对象里加（`ui.close`/`up.date` 一次入库，T2/T4 消费）：

```ts
// batch7: death epitaph — template + flavor library (6 causes × 2-3 lines × 2 langs)
"ep.template": { en: 'Slain by {0} on floor {1} · survived {2} turns', zh: '被{0}终结于第{1}层 · 存活{2}回合' },
"ep.fallen": { en: 'The Fallen Before You', zh: '先你而陨者' },
"ep.flavor.combat.0": { en: 'The abyss never asks where you came from — only where you end.', zh: '深渊不问来处，只收终局。' },
"ep.flavor.combat.1": { en: 'Blades are impartial. The abyss keeps count.', zh: '刀剑无情，深渊有数。' },
"ep.flavor.combat.2": { en: 'Its name is yours now.', zh: '它的名字，从此也是你的。' },
"ep.flavor.trap.0": { en: 'The old builders waited a thousand years for that one step.', zh: '古人的机关等了千年，只为你这一步。' },
"ep.flavor.trap.1": { en: 'Traps are patient.', zh: '陷阱从不着急。' },
"ep.flavor.poison.0": { en: 'Sweet or bitter, it all ends cold.', zh: '甜的苦的，到头都是凉的。' },
"ep.flavor.poison.1": { en: 'Poison never hurries. It is simply on time.', zh: '毒不催人，时候到了而已。' },
"ep.flavor.starve.0": { en: 'The lamp ran dry before the blades could.', zh: '灯尽油枯，先于刀剑。' },
"ep.flavor.starve.1": { en: 'The slowest death in the depths is also the most honest.', zh: '深渊里最慢的死法，也最诚实。' },
"ep.flavor.corruption.0": { en: 'The rot never kills. It only asks you to stay.', zh: '腐化从不杀人，它只是请你留下。' },
"ep.flavor.corruption.1": { en: 'You finally match the abyss in color.', zh: '你终于和深渊一个颜色了。' },
"ep.flavor.warden.0": { en: 'You did not fall. You only changed your name.', zh: '你未陨落，只是换了姓名。' },
"ep.flavor.warden.1": { en: 'Wardens have no graves. The abyss is the stone.', zh: '守渊人无墓，深渊即碑。' },
"ui.close": { en: 'Close', zh: '关闭' },
"ui.talents": { en: '🌳 Talents', zh: '🌳 天赋' },
"up.date": { en: 'Date', zh: '日期' },
```

- [ ] **Step 4: 新建 `src/epitaph.ts`**：

```ts
// 批7: death epitaph — template line + one flavor line per death-cause class.
// Pure module (no DOM, no state reads beyond lang) so tests drive everything
// via arguments, including the random source (injectable for determinism).
import { t, tMsg } from './i18n.js';
import { lang } from './state.js';

export type DeathCause = 'combat' | 'trap' | 'poison' | 'starve' | 'corruption' | 'warden';

export interface Epitaph { template: string; flavor: string }

const FLAVOR_KEYS: Record<DeathCause, string[]> = {
  combat: ['ep.flavor.combat.0', 'ep.flavor.combat.1', 'ep.flavor.combat.2'],
  trap: ['ep.flavor.trap.0', 'ep.flavor.trap.1'],
  poison: ['ep.flavor.poison.0', 'ep.flavor.poison.1'],
  starve: ['ep.flavor.starve.0', 'ep.flavor.starve.1'],
  corruption: ['ep.flavor.corruption.0', 'ep.flavor.corruption.1'],
  warden: ['ep.flavor.warden.0', 'ep.flavor.warden.1'],
};

export function buildEpitaph(cause: DeathCause, killer: string, floor: number, turns: number,
                             rand: () => number = Math.random): Epitaph {
  const keys = FLAVOR_KEYS[cause] ?? FLAVOR_KEYS.combat;   // unknown cause → combat lib
  const flavor = keys[Math.min(keys.length - 1, Math.floor(rand() * keys.length))];
  return { template: tMsg('ep.template', killer, String(floor), String(turns)), flavor: t(flavor) };
}

/** Quote marks differ per language — zh corner brackets, en curly quotes. */
export function quoteFlavor(s: string): string {
  return lang() === 'zh' ? `「${s}」` : `“${s}”`;
}
```

- [ ] **Step 5: bridge + 接线** — `src/bridge.ts` 槽区加 `closeEvent?: VoidFn;`；`src/main.ts` bridge 赋值区（:69 一带）加 `bridge.closeEvent = closeEvent;`（import 区补 `import { closeEvent } from './events.js';`——main→events 无环）。

- [ ] **Step 6: playerDeath 改造**（combat.ts:429 起）——签名 `export function playerDeath(killer: string, cause: DeathCause = 'combat'): void`；import 区加 `import { buildEpitaph, quoteFlavor, type DeathCause } from './epitaph.js';` 与 `eventOpen`（并入现有 state import）与 `import { bridge } from './bridge.js';`；模块顶加 `const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');`（若 combat 已有同名工具则复用）。`:431 resetIntros();` 后加一行：

```ts
  if (eventOpen()) bridge.closeEvent?.();   // 批7 D: an event popup must not outlive the player
```

death-stats 渲染块（:466-475）之后、`renderEchoBreakdown` 之前插入：

```ts
  const ep = buildEpitaph(cause, killer, G.floor, p.turns);
  document.getElementById('death-epitaph')!.innerHTML =
    `<div class="ep-line">${escHtml(ep.template)}</div>` +
    `<div class="ep-flavor">${quoteFlavor(escHtml(ep.flavor))}</div>`;
  const wardens = getMeta().wardens || [];
  document.getElementById('death-wardens')!.innerHTML = wardens.length
    ? `<div class="epw-title">${t('ep.fallen')}</div>` +
      wardens.slice(0, 5).map(w => `<span class="epw-row">${escHtml(w.name)} F${w.floor}</span>`).join('') +
      (wardens.length > 5 ? `<span class="epw-row">+${wardens.length - 5}</span>` : '')
    : '';
```

（t 已在 combat import ✓；getMeta 已 import ✓。）

- [ ] **Step 7: 调用点归类**（只列需传 cause 的 4 处，其余吃默认 'combat'）：
  - `src/events.ts:121` → `playerDeath(tx(trap.n), 'trap')`
  - `src/events.ts:198` → `playerDeath(t('ev.lava'), 'trap')`
  - `src/items.ts:49` → `playerDeath(t('it.poisonCause'), 'poison')`
  - `src/turn.ts:46` → `playerDeath(t('tn.starve'), 'starve')`；`:67` → `playerDeath(t('tn.poison'), 'poison')`；`:78` → `playerDeath(t('tn.corruption'), 'corruption')`
  - `src/combat.ts:424` → `playerDeath(t('cb.becameWarden'), 'warden')`
  - 不动：combat.ts:218 / enemies.ts:296 / events.ts:100（默认 combat）。

- [ ] **Step 8: index.html + 样式** — `:108` death-screen 内 `death-stats` 后插 `<div id="death-epitaph" class="death-epitaph"></div>`、`death-echoes` 后插 `<div id="death-wardens" class="death-wardens"></div>`。`style/main.css` `.death-stats` 规则（:152）附近加：

```css
.death-epitaph{margin-top:12px;max-width:560px;color:#9a8ec8;font-style:italic;line-height:1.7}
.death-epitaph .ep-flavor{margin-top:4px;color:#7d735f}
.death-wardens{margin-top:10px;font-size:.85em;color:#667}
.death-wardens .epw-title{color:#889;margin-bottom:4px}
.death-wardens .epw-row{display:inline-block;margin:2px 10px 2px 0;color:#756f8f}
```

- [ ] **Step 9: 跑测试确认通过** — 两个新文件全 PASS；全量 `npx vitest run`（506+新）+ `npx tsc --noEmit` 裸跑 0。

- [ ] **Step 10: 提交**

```bash
git add src/epitaph.ts src/__tests__/batch7-epitaph.test.ts src/__tests__/batch7-death-screen.test.ts src/i18n.ts src/combat.ts src/bridge.ts src/main.ts src/enemies.ts src/events.ts src/items.ts src/turn.ts index.html style/main.css
git commit -m "feat(death): epitaph (template+flavor lib, 6 causes) + fallen-wardens list + event-popup death cleanup (batch7 T1)"
```

---

### Task 2: 日志聚合×N + records 日期列（spec C3+C4）

**Files:**
- Modify: `src/messages.ts:5-22`（addMsg DOM 聚合）、`src/ui-panels.ts:220-238`（renderRecords 日期列+行语义）、`index.html:98`（records-content 加 role="list"）
- Test: `src/__tests__/batch7-info-pack.test.ts`（新建）

**Interfaces:**
- Consumes: T1 的 `up.date` 键。
- Produces: 无（纯展示层；G.msgs 存档语义不变）。

- [ ] **Step 1: 写失败测试**：

```ts
// src/__tests__/batch7-info-pack.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { addMsg } from '../messages.js';
import { initGame } from '../game.js';
import { renderRecords } from '../ui-panels.js';
import { getMeta } from '../meta.js';

beforeEach(() => {
  localStorage.clear();
  document.getElementById('log-panel')!.innerHTML = '';
  initGame(0, 0, false);
});

describe('addMsg consecutive-identical aggregation (批7 C3)', () => {
  it('three identical messages collapse into one row with ×3', () => {
    addMsg('你拾起了金币', 'mi'); addMsg('你拾起了金币', 'mi'); addMsg('你拾起了金币', 'mi');
    const p = document.getElementById('log-panel')!;
    expect(p.children.length).toBe(1);
    expect((p.lastElementChild as HTMLElement).textContent).toBe('你拾起了金币 ×3');
  });
  it('different messages never aggregate (even interleaved)', () => {
    addMsg('A'); addMsg('B'); addMsg('A');
    expect(document.getElementById('log-panel')!.children.length).toBe(3);
  });
  it('aggregation only merges the LAST row (gap breaks the run)', () => {
    addMsg('X'); addMsg('Y'); addMsg('X'); addMsg('X');
    const p = document.getElementById('log-panel')!;
    expect(p.children.length).toBe(3);
    expect((p.lastElementChild as HTMLElement).textContent).toBe('X ×2');
  });
});

describe('records date column (批7 C4)', () => {
  it('MM-DD for ts runs, — for legacy ts:0 runs; row carries listitem role+tabindex+title', () => {
    const m = getMeta();
    m.runHistory.push({ mode: 'normal', floor: 5, kills: 3, classIdx: 0, result: 'death', turns: 90, gold: 10, ts: 0 });
    m.runHistory.push({ mode: 'normal', floor: 6, kills: 4, classIdx: 0, result: 'death', turns: 91, gold: 11, ts: new Date('2026-08-30T12:00:00').getTime() });
    renderRecords();
    const rows = [...document.querySelectorAll('#records-content .rrow')] as HTMLElement[];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0].textContent).toContain('—');
    expect(rows[1].textContent).toMatch(/08-30/);
    expect(rows[1].getAttribute('tabindex')).toBe('0');
    expect(rows[1].getAttribute('role')).toBe('listitem');
    expect(rows[1].getAttribute('title')).toBeTruthy();
  });
  it('endless leaderboard also gains the date column', () => {
    const m = getMeta();
    m.endlessLeaderboard.push({ floor: 44, kills: 90, classIdx: 0, turns: 900, gold: 500, ts: new Date('2026-08-29T09:00:00').getTime() });
    renderRecords();
    expect(document.getElementById('records-content')!.textContent).toMatch(/08-29/);
  });
});
```

- [ ] **Step 2: 跑测试确认失败** — `npx vitest run src/__tests__/batch7-info-pack.test.ts` 期望全 FAIL。

- [ ] **Step 3: addMsg 聚合**（messages.ts）——`G.msgs` 推入与 cap 逻辑保持原样，DOM 段改为：

```ts
  const p = document.getElementById('log-panel');
  if (!p) return;
  // 批7: consecutive identical text aggregates into the last row (×N) — display
  // layer only; G.msgs (save data) keeps every entry verbatim.
  const last = p.lastElementChild as HTMLElement | null;
  if (last?.dataset?.mtext === text) {
    const n = (Number(last.dataset.mcount || '1') || 1) + 1;
    last.dataset.mcount = String(n);
    last.textContent = `${text} ×${n}`;
    p.scrollTop = p.scrollHeight;
    return;
  }
  const d = document.createElement('div');
  d.className = 'msg ' + type;
  d.dataset.mtext = text;
  d.textContent = text;
  p.appendChild(d);
  p.scrollTop = p.scrollHeight;
  while (p.children.length > 100) { const first = p.firstChild; if (first) p.removeChild(first); }
```

- [ ] **Step 4: renderRecords 日期列 + 行语义**（ui-panels.ts:220-238）——row 帮手与两表列清单改为：

```ts
  const fmtDate = (ts: number) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const row = (cols: string[], color = '#ccc') =>
    `<div class="rrow" tabindex="0" role="listitem" title="${cols.join(' · ')}" style="display:flex;gap:8px;padding:3px 6px;border-bottom:1px solid #1c1c1c;color:${color};font-size:.88em">${cols.map(c => `<span style="flex:1">${c}</span>`).join('')}</div>`;
```

`hist` 行列：`[r.mode === 'endless' ? '♾' : '◐', cls(r.classIdx), `F${r.floor}`, `${r.kills}${t('up.killUnit')}`, fmtDate(r.ts), r.result === 'win' ? '🏆' : '💀']`；表头 `[t('up.mode'), t('up.class'), t('up.floorHdr'), t('up.kills'), t('up.date'), t('up.result')]`。leaderboard 行同样在 kills 后插 `fmtDate(r.ts)`、表头插 `t('up.date')`。`index.html:98` 的 `<div id="records-content"></div>` 改 `<div id="records-content" role="list"></div>`。

- [ ] **Step 5: 跑测试确认通过 + 全量** — 新文件 PASS；`npx vitest run` 全量 + `npx tsc --noEmit` 0。

- [ ] **Step 6: 提交**

```bash
git add src/messages.ts src/ui-panels.ts index.html src/__tests__/batch7-info-pack.test.ts
git commit -m "feat(ui): log ×N aggregation + records date column w/ row list semantics (batch7 T2)"
```

---

### Task 3: 术语统一 + zh 标点清洗 + 锁门（spec C1+C2）

**Files:**
- Modify: `src/corruption.ts:45`（侵蚀→腐化）、`src/i18n.ts`+`src/data.ts`（标点清洗，脚本改写）
- Create: `scripts/fix_zh_punct.mjs`（一次性脚本，入库留档）、`src/__tests__/batch7-zh-punct.test.ts`（永久锁门）

**Interfaces:** 无消费方；`TIER_LABEL` 值变更（zh '侵蚀'→'腐化'）。若有既有断言 '侵蚀' 的测试，同步改断言（先 grep）。

- [ ] **Step 1: 写失败锁门测试**：

```ts
// src/__tests__/batch7-zh-punct.test.ts — permanent gate (dynamic URL form, 批4 convention)
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const CJK = '[\\u4e00-\\u9fff]';
for (const f of ['i18n.ts', 'data.ts', 'corruption.ts']) {
  it(`${f}: zh literals keep half-width punctuation away from CJK`, async () => {
    const text = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    const bad = text.split('\n')
      .filter(l => /zh:\s*['"`]/.test(l))
      .filter(l => new RegExp(`${CJK}[,;:?!]`).test(l) || new RegExp(`,(?=${CJK})`).test(l));
    expect(bad, JSON.stringify(bad.slice(0, 3), null, 1)).toHaveLength(0);
  });
}
it('TIER_LABEL uses the unified term 腐化 (not 侵蚀)', async () => {
  const text = readFileSync(new URL('../corruption.ts', import.meta.url), 'utf8');
  expect(text).not.toContain('侵蚀');
  expect(text).toContain('腐化');
});
```

- [ ] **Step 2: 跑测试确认失败** — 期望 i18n/data 多行命中 + corruption 断言 FAIL（先 `grep -rn 侵蚀 src/ --include=*.ts | grep -v __tests__` 确认簇范围与既有测试断言）。

- [ ] **Step 3: 术语统一** — `src/corruption.ts:45` `corrupted: { en: 'Corrupted', zh: '侵蚀' }` → `zh: '腐化'`；grep 全库 `侵蚀` 清余量（含测试断言若有）。

- [ ] **Step 4: 清洗脚本** — 新建 `scripts/fix_zh_punct.mjs`：

```js
// One-shot (批7 T3): normalize half-width , ; : ? ! adjacent to CJK into full-width
// inside zh: '…' literals of i18n.ts / data.ts. en lines untouched. Run: node scripts/fix_zh_punct.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const CJK = /[一-鿿]/;
for (const f of ['src/i18n.ts', 'src/data.ts']) {
  const before = readFileSync(f, 'utf8');
  const after = before.split('\n').map(line => {
    if (!/zh:\s*['"`]/.test(line)) return line;
    return line
      .replace(/([一-鿿]),/g, '$1，')
      .replace(/([一-鿿]);/g, '$1；')
      .replace(/([一-鿿]):/g, '$1：')
      .replace(/([一-鿿])\?/g, '$1？')
      .replace(/([一-鿿])!/g, '$1！')
      .replace(/,(?=[一-鿿])/g, '，');
  }).join('\n');
  if (after !== before) { writeFileSync(f, after); console.log(f, 'rewritten'); }
}
console.log('done');
```

- [ ] **Step 5: 跑脚本 + 全量 diff 人工过目** — `node scripts/fix_zh_punct.mjs` 后 `git diff --stat src/i18n.ts src/data.ts` 并逐 hunk 过目（`git diff` 全量贴给主会话/审查者抽查）；再跑 `npx vitest run src/__tests__/batch7-zh-punct.test.ts` 绿 + i18n 键交叉/硬编码扫描测试仍绿 + 全量 vitest + tsc 0。

- [ ] **Step 6: 提交**

```bash
git add src/corruption.ts src/i18n.ts src/data.ts scripts/fix_zh_punct.mjs src/__tests__/batch7-zh-punct.test.ts
git commit -m "fix(i18n): unify 侵蚀→腐化 + zh punctuation normalization w/ permanent gate (batch7 T3)"
```

---

### Task 4: 键盘行间移焦 + dialog 语义 + aria-live + ✕ label（spec B1/B2/B4/B5）

**Files:**
- Modify: `src/input.ts:85 一带`（键盘移焦拦截）、`src/ui-settings.ts:22 一带`（✕/panel label 语言扫）、`src/ui-panels.ts`（codex 行 tabindex/role/title）、`src/panels.ts:158 一带`（help 行 tabindex）、`index.html:85,92-100,107,111,112`（aria-live + 11 panel role + talent h2 + records role 已在 T2）
- Test: `src/__tests__/batch7-a11y.test.ts`（新建）

**Interfaces:**
- Consumes: 批3A `activeMenuContext`/`seqFocus`/`stepRange`（input.ts 已 import）与本文件内 `menuMoveFocus`；T1 的 `ui.close`/`ui.talents` 键。
- Produces: 键盘 overlay 态方向键语义（gameplay 零变化）。

- [ ] **Step 1: 写失败测试**：

```ts
// src/__tests__/batch7-a11y.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { initGame } from '../game.js';

beforeEach(() => { localStorage.clear(); initGame(0, 0, false); });

describe('static dialog semantics (批7 B5/B4)', () => {
  it('every static overlay panel is role=dialog + aria-modal', async () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    const overlays = (html.match(/class="overlay"/g) ?? []).length;
    const dialogs = (html.match(/class="panel[^"]*"[^>]*role="dialog"[^>]*aria-modal="true"/g) ?? []).length;
    expect(overlays).toBeGreaterThanOrEqual(11);
    expect(dialogs).toBe(overlays);   // 11 static overlays, all panels labelled
  });
  it('log panel is a polite live region', async () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    const m = html.match(/<div id="log-panel"[^>]*>/) ?? [];
    expect(m[0]).toContain('aria-live="polite"');
  });
});

describe('keyboard linear focus in overlays (批7 B1)', () => {
  it('ArrowDown/ArrowUp move focus between record rows; range input keeps native left/right', async () => {
    const { initInput } = await import('../input.js');
    initInput();
    const { showOverlay, renderRecords } = await import('../ui-panels.js');
    const { getMeta } = await import('../meta.js');
    const m = getMeta();
    m.runHistory.push({ mode: 'normal', floor: 1, kills: 1, classIdx: 0, result: 'death', turns: 5, gold: 0, ts: 1 });
    m.runHistory.push({ mode: 'normal', floor: 2, kills: 2, classIdx: 0, result: 'death', turns: 6, gold: 0, ts: 2 });
    showOverlay('records-overlay'); renderRecords();
    const rows = [...document.querySelectorAll('#records-content .rrow')] as HTMLElement[];
    rows[0].focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(rows[1]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(rows[0]);
  });
  it('arrows outside any overlay never hijack (gameplay dispatch untouched)', async () => {
    const { initInput } = await import('../input.js');
    initInput();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(document.body);   // no overlay → no focus move
  });
});
```

- [ ] **Step 2: 跑测试确认失败** — 期望 dialog/live/移焦三项 FAIL。

- [ ] **Step 3: index.html 静态属性** — ①`:85` `<div id="log-panel">` → `<div id="log-panel" aria-live="polite">`；②11 个 `.panel` div（:92-100/:107/:111/:112 的 inventory/help/skill/achievement/talent/forge/records/codex/item-intro/ending-choice/pause/options）各加 ` role="dialog" aria-modal="true"`；③talent 面板补标题：`<div id="talent-panel" ...>` 的 close-btn 后插 `<h2 id="talent-title">🌳 Talents</h2>`。

- [ ] **Step 4: 键盘移焦拦截** — `src/input.ts` keydown 处理器里 `:85` gameOver 守卫之后、introOpen 分支之前插（函数声明提升使 `menuMoveFocus` 可前向使用）：

```ts
  // 批7: keyboard parity with gamepad menu nav — inside any open overlay context,
  // vertical action/arrows run linear focus; horizontal runs spatial (a focused
  // range steps instead, mirroring the gamepad rule). Text fields/selects opt out.
  const kmenu = activeMenuContext();
  if (kmenu) {
    const tgt = e.target as HTMLElement | null;
    const inTextField = !!tgt && (tgt.tagName === 'SELECT' || tgt.isContentEditable ||
      (tgt instanceof HTMLInputElement && tgt.type !== 'range'));
    if (!inTextField) {
      const act = keyToAction(e);
      if (e.key === 'ArrowUp' || act === 'move_up') { seqFocus(kmenu, -1); e.preventDefault(); return; }
      if (e.key === 'ArrowDown' || act === 'move_down') { seqFocus(kmenu, 1); e.preventDefault(); return; }
      if (e.key === 'ArrowLeft' || act === 'move_left' || e.key === 'ArrowRight' || act === 'move_right') {
        const dir: -1 | 1 = (e.key === 'ArrowLeft' || act === 'move_left') ? -1 : 1;
        menuMoveFocus(kmenu, dir, 0);   // range-focused → stepRange inside (gamepad rule)
        e.preventDefault(); return;
      }
    }
  }
```

（`keyToAction` 为 input.ts 现有帮手，若名不同以文件内实名为准——grep `function keyToAction` 核对。）

- [ ] **Step 5: 行 tabindex（codex/help）** — `src/ui-panels.ts` 的 `renderItemSection`/`renderLoreSection` 行 div 与 `src/panels.ts` `renderHelp` 的 `<tr>` 照 T2 records 模式加 `tabindex="0" role="listitem" title="…"`（help 的 tr 加 `tabindex="0"` + 首个 td 文本为 title；codex 行 title=条目名）。

- [ ] **Step 6: ✕/panel label 语言扫** — `src/ui-settings.ts` 标题扫（:22 一带）函数末尾追加：

```ts
  // 批7: dialog labels follow the language sweep — ✕ buttons get a name,
  // panels get an aria-label mirroring their (already-swept) heading.
  document.querySelectorAll<HTMLElement>('.close-btn').forEach(b => b.setAttribute('aria-label', t('ui.close')));
  document.querySelectorAll<HTMLElement>('.overlay .panel').forEach(p => {
    const h = p.querySelector('h1, h2, h3');
    const label = h?.textContent?.trim() || '';
    if (label) p.setAttribute('aria-label', label);
  });
  $('talent-title')!.textContent = t('ui.talents');
```

（`$` 为该文件现有帮手；若函数名/位置不同以 grep `btn-new` 定位为准。）

- [ ] **Step 7: 跑测试确认通过 + 全量** — 新文件 PASS；全量 vitest + tsc 0；**手跑 `python scripts/verify_gamepad_ingame.py`（dev server 起）确认手柄 22 项零回归**（input.ts 动过，这是硬门）。

- [ ] **Step 8: 提交**

```bash
git add src/input.ts src/ui-settings.ts src/ui-panels.ts src/panels.ts index.html src/__tests__/batch7-a11y.test.ts
git commit -m "feat(a11y): keyboard linear focus in overlays + dialog roles/labels + log aria-live + row semantics (batch7 T4)"
```

---

### Task 5: 滑条 D-pad 长按连发（spec B3）

**Files:**
- Modify: `src/input.ts`（pollGamepad menu 分支 + 模块级 repeat 状态）
- Test: 单测不覆盖（pollGamepad 内部循环，rAF 驱动）——由 T6 e2e 假手柄帧序列覆盖（批3A 同例）。

**Interfaces:** Consumes 既有 `stepRange`/`buttonToAction`/`menu`。Produces: 手柄滑条长按 ~360ms 后每 ~120ms 步进。

- [ ] **Step 1: 模块级状态**（`gpMoveCd` 声明旁）：

```ts
let gpSlideDir: -1 | 0 | 1 = 0;   // 批7: held-direction slider repeat (D-pad long-press)
let gpSlideCd = 0;
```

- [ ] **Step 2: menu 分支接入** — pollGamepad 的 overlay/menu 分支里、edge 按钮 `for` 循环之后（`} else if (G && !G.gameOver)` 之前）插：

```ts
    // 批7: slider long-press — while a range input is focused and the user's bound
    // left/right direction is HELD, repeat stepRange after an initial ~360ms delay
    // then every ~120ms (poll ≈ 60ms ⇒ cds 6 / 2). The edge loop already did the
    // first step via menuMoveFocus, so a fresh press only arms the timer.
    const ae = document.activeElement as HTMLElement | null;
    const onRange = !!(ae && menu.contains(ae) && ae instanceof HTMLInputElement && ae.type === 'range');
    if (!onRange) { gpSlideDir = 0; gpSlideCd = 0; }
    else {
      let held: -1 | 0 | 1 = 0;
      for (let i = 0; i < gp.buttons.length; i++) {
        if (!(gp.buttons[i] && gp.buttons[i].pressed)) continue;
        const a = buttonToAction(i);
        if (a === 'move_left') held = -1;
        else if (a === 'move_right') held = 1;
      }
      if (held === 0 || held !== gpSlideDir) { gpSlideDir = held; gpSlideCd = held === 0 ? 0 : 6; }
      else if (gpSlideCd > 0) gpSlideCd--;
      else { stepRange(ae as HTMLInputElement, held); gpSlideCd = 2; }
    }
```

- [ ] **Step 3: 验证** — `npx vitest run` 全量绿 + `npx tsc --noEmit` 0（行为验证在 T6 场景 5）。

- [ ] **Step 4: 提交**

```bash
git add src/input.ts
git commit -m "feat(gamepad): held D-pad direction auto-repeats focused sliders (~360ms delay, ~120ms rate) (batch7 T5)"
```

---

### Task 6: e2e 电池 verify_batch7_ingame.py + 七门回归

**Files:**
- Create: `scripts/verify_batch7_ingame.py`
- Consumes: T1-T5 全部；dev server `npm run dev -- --port 5173 --strictPort`（同实例 ESM import 法，批2/3/4/5 验证过的 harness；零 console error 门 + favicon 白名单照抄 verify_batch5_ingame.py）。

**Interfaces:** 电池场景（每项 PASS/FAIL + 总分 + 零 console error 才 exit 0）：

1. **死亡屏四块**：`initGame(0,0,false)` → 种 `getMeta().wardens` 7 条 → `playerDeath('冒烟杀手','trap')` → 断言 `#death-epitaph .ep-line` 含杀手名与楼层数、`.ep-flavor` 匹配 `^「.+」$` 且文本 ∈ 语库集合（evaluate 里 import i18n 直接取 15 条 zh 语料比对）、`#death-wardens .epw-row` 6 行含 `+2`、`#death-echoes` 非空。
2. **事件残留**：`setEventOpen(true)` + `#event-popup` 显示 → `playerDeath('X')` → 断言弹窗 `display:none`。
3. **日志聚合**：连发同文本 addMsg×3 → log-panel 子数 +1 且末行 `×3`；插一条异文本再×2 → 只并末行。
4. **records 日期列 + 键盘移焦**：种 runHistory（ts:0 与今日 ts 各一）+ renderRecords + showOverlay → 断言 `—`/`MM-DD` 两态 + `.rrow[tabindex="0"]` + focus 首行后 dispatch ArrowDown → activeElement=次行（真 KeyboardEvent，不 mock）。
5. **滑条长按**（T5 唯一行为覆盖）：假手柄注入（照 verify_gamepad_ingame.py 的 fake pad 模式）聚焦 options 的 textScale 滑条 → 按住左向 25 帧（~1.5s）→ 断言 value 步幅 ≥3 步（单步只会是 1）；松开 10 帧值不变。
6. **静态语义**：`document.querySelectorAll('.overlay .panel[role="dialog"][aria-modal="true"]').length === 11`、全部 `.close-btn` 有 aria-label、`#log-panel` aria-live=polite、`#records-content` role=list。

- [ ] **Step 1: 写脚本**（结构照 verify_batch5_ingame.py：BASE=http://localhost:5173、import('/src/*.ts') 同实例、console 双 handler、favicon 白名单、PASS/FAIL 汇总）。
- [ ] **Step 2: 起 dev server 跑电池** — 全绿 + 零 console error。
- [ ] **Step 3: 七门** — `npx tsc --noEmit` 裸跑 / `npx vitest run`（计数实跑为准）/ verify_batch7 / verify_batch4_ingame.py 19 / verify_batch3c_ingame.py 64 / verify_gamepad_ingame.py 22 / verify_reconnect_ingame.py 10 / verify_batch5_ingame.py 28。任一挂先修再继续。
- [ ] **Step 4: 提交**

```bash
git add scripts/verify_batch7_ingame.py
git commit -m "test(e2e): batch7 battery (death trio / event residue / log aggregation / keyboard focus / slider hold / dialog semantics) + gate run (batch7 T6)"
```

之后按总流程：final opus whole-branch review → 处理意见 → verification-before-completion → 用户令 merge → ff-merge main → push → CI 四门真跑绿 → 删分支 → 回填记忆。

---

## 执行顺序与并行性

T1→T2→T3→T4→T5→T6 串行为默认（T4 依赖 T1 的 ui.close/ui.talents 键；T6 依赖全部）。若并行：T1（combat/epitaph/i18n 键）∥ T3（corruption/i18n 标点——与 T1 同文件 i18n.ts 有合并冲突风险，**建议仍串行**）∥ T4 的 index.html 静态段（与 T1 的 index.html:108 不同区域，可并行但同文件）。结论：**串行执行**，冲突面最小。

## Self-Review 记录

- 覆盖：spec A(T1) B1(T4) B2(T4) B3(T5) B4(T4) B5(T4) C1(T3) C2(T3) C3(T2) C4(T2) D(T1) —— 全映射；spec 的"折叠头"盘点不存在已裁。
- 类型一致：`DeathCause`/`buildEpitaph`/`quoteFlavor`/`bridge.closeEvent` 各任务引用与 T1 定义一致；`rrow` class、`ep-*`/`epw-*` class 在 T1/T2/T6 间一致。
- 计数：新单测 = T1(4+4) + T2(5) + T3(4) + T4(4) ≈ 21 → 预期 ~527，**以实跑为准**。
