# 设置面板核心优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 设置架构收拢（渐进兼容 schema）+ 全自定义键位（键盘/手柄/overlay-close）+ 恢复默认，不破现有 12 文件的设置 import。

**Architecture:** 新建 `settings.ts`（14 项 schema，get/set 指向 state.ts/audio.ts 的现有 source of truth）+ `keybinds.ts`（Action 枚举 + 默认映射=现状 + 持久化 + rebind）；options.ts 由 schema 驱动渲染 + 新增 Keybinds tab + 恢复默认；input.ts 重写为查表分发（行为等价）。

**Tech Stack:** TypeScript（strict，ESM `.js`）、Vite、vitest + happy-dom、Canvas+DOM。

## Global Constraints

- **基线**：`main @ ba82145` → 开 `feat/settings-core` 分支。
- **TS strict / ESM**：所有 import 带 `.js` 扩展名。
- **渐进兼容**：state.ts 的 let+setter **保留作 source of truth**（render/particles/effects/fx/item-intro/items 等 12 文件 import 不破）；settings.ts 是元数据 + 调度层，get/set 指向 state/audio 的现有 getter/setter。
- **默认键位 = 现状**：keybinds DEFAULT_KEYS/BUTTONS 从 input.ts 现状逐键提取，**行为严格等价**（防回归）。
- **改键边界**：overlay_close（ESC/B）纳入改键；overlay 内数字操作键（inv 1-9/event 1-N/skill）保留硬编码（语义耦合 overlay）；元键 CTRL+S/F11 保留硬编码。
- **i18n**：新 key 用 `opt.*`（设置）+ `kb.*`（键位动作名/提示）点号前缀，双语。
- **测试**：vitest，mock 仿 codex.test.ts。`npx vitest run`（全量）/ `npx vitest run <file>`（聚焦）。

---

## File Structure

| 文件 | 责任 | 动作 |
|---|---|---|
| `src/settings.ts` | 14 项设置 schema + resetDefaults + applyAll | **Create** |
| `src/keybinds.ts` | Action 枚举 + 默认映射 + keyToAction/buttonToAction/rebind/reset + 持久化 | **Create** |
| `src/options.ts` | schema 驱动渲染 4 tab + row desc + 恢复默认 + Keybinds tab | Modify（重构） |
| `src/input.ts` | 键盘主 switch + 12 overlay 块 + 手柄查表分发 | Modify（重写） |
| `src/state.ts` | 删 muted mirror（迁 audio.ts）；let+setter 保留 | Modify（小） |
| `src/ui-settings.ts` | 删重复 apply（applyZoom/applySafe/applyReducedMotion） | Modify（小） |
| `src/main.ts` | apply 启动调用收拢到 settings.applyAll | Modify（小） |
| `src/i18n.ts` | kb.* + opt.* 新 key（动作名/rebind/confirmReset/desc） | Modify |
| `src/__tests__/settings.test.ts` | schema/resetDefaults/muted 单一 source | Create |
| `src/__tests__/keybinds.test.ts` | keyToAction/buttonToAction 默认映射 + rebind 冲突 + 持久化 | Create |

---

## Task 1: settings.ts schema + resetDefaults + 修 muted mirror

**Files:**
- Create: `src/settings.ts`
- Modify: `src/state.ts:50-52`（删 muted/setMuted mirror）、消费者迁 audio.ts
- Modify: `src/ui-settings.ts`（删重复 apply）、`src/main.ts`（apply 收拢）
- Test: `src/__tests__/settings.test.ts`（Create）

**Interfaces:**
- Produces: `SETTING_DEFS: SettingDef[]`（14 项）、`resetDefaults()`、`applyAll()`、`SettingDef`/`Control` 类型。
- Consumes: state.ts 的 getter/setter（reducedMotion/setReducedMotion 等）、audio.ts 的 isMuted/setMutedState/getMasterVol 等。

- [ ] **Step 1: 写失败测试**（Create `src/__tests__/settings.test.ts`）

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../audio.js', () => ({
  isMuted: vi.fn(() => false), setMutedState: vi.fn(),
  getMasterVol: vi.fn(() => 0.9), setMasterVol: vi.fn(),
  getMusicVol: vi.fn(() => 0.45), setMusicVol: vi.fn(),
  getSfxVol: vi.fn(() => 0.9), setSfxVol: vi.fn(),
}));
vi.mock('../state.js', () => ({
  lang: 'en', setLang: vi.fn(),
  uiZoom: 1, setUiZoom: vi.fn(), minimapScale: 3, setMinimapScale: vi.fn(),
  reducedMotion: false, setReducedMotion: vi.fn(), safeZone: 16, setSafeZone: vi.fn(),
  shakeScale: 1, setShakeScale: vi.fn(), textScale: 1, setTextScale: vi.fn(),
  colorblind: 'off', setColorblind: vi.fn(), barCues: true, setBarCues: vi.fn(),
  introEnabled: true, setIntroEnabled: vi.fn(), legendVisible: false, keysVisible: false,
}));
import { SETTING_DEFS, resetDefaults } from '../settings.js';

beforeEach(() => vi.clearAllMocks());

describe('settings schema', () => {
  it('covers 14 settings across 4 tabs', () => {
    expect(SETTING_DEFS.length).toBeGreaterThanOrEqual(13); // mute+3vol + fullscreen? + zoom+text+minimap+safe+lang + reduced+shake+cb+bar + intro
    const tabs = new Set(SETTING_DEFS.map(d => d.tab));
    expect(tabs).toContain('audio'); expect(tabs).toContain('display');
    expect(tabs).toContain('access'); expect(tabs).toContain('game');
  });
  it('every def has key/label/control/default + get/set', () => {
    for (const d of SETTING_DEFS) {
      expect(d.key).toBeTruthy(); expect(d.labelKey).toBeTruthy();
      expect(['toggle','seg','slider']).toContain(d.control);
      expect(typeof d.get).toBe('function'); expect(typeof d.set).toBe('function');
      expect('default' in d).toBe(true);
    }
  });
  it('resetDefaults calls set(default) for every def', () => {
    resetDefaults();
    for (const d of SETTING_DEFS) expect(d.set).toHaveBeenCalledWith(d.default);
  });
});
```

- [ ] **Step 2: 跑测试验证失败**（settings.ts 不存在）

- [ ] **Step 3: 实现 settings.ts** —— 14 项 schema，每项 get/set 指向 state/audio 的现有 getter/setter（**不新建 source of truth**）。例：
```ts
// audio master
{ key:'master', tab:'audio', labelKey:'volMaster', control:'slider', min:0, max:1, step:0.01,
  get: () => getMasterVol(), set: (v) => setMasterVol(v as number),
  toDisplay: (v) => `${Math.round((v as number)*100)}`, default: 0.9 },
// reducedMotion
{ key:'reducedMotion', tab:'access', labelKey:'optReducedMotion', control:'toggle',
  get: () => reducedMotion, set: (v) => setReducedMotion(v as boolean),
  apply: applyReducedMotion, default: false },
```
完整 14 项：audio(mute/master/music/sfx)、display(zoom/textSize/minimap/safeZone/lang；fullscreen 是实时读 DOM 不持久化，作 toggle get/set 调 toggleFullscreen)、access(reducedMotion/shake/colorblind/barCues)、game(introEnabled；legend/keys 不持久化但可入 schema get/set 调 toggleLegend/toggleKeys)。从 state.ts/audio.ts 的现有变量 + setter + i18n key 填。
`resetDefaults()` 遍历调 `d.set(d.default); d.apply?.()`。`applyAll()` 遍历调 `d.apply?.()`。

- [ ] **Step 4: 修 muted 双份 mirror** —— 删 state.ts:50-52 的 `muted`/`setMuted`；grep 消费者（ui-settings.ts toggleSound L63-64、main.ts bridge.muted、input.ts）迁移到 audio.ts `isMuted`/`setMutedState`。settings.ts 的 mute 项 get/set 用 audio.ts。

- [ ] **Step 5: 删 ui-settings.ts 重复 apply**（applyZoom/applySafe/applyReducedMotion）—— 确认 options.ts 有同名（getSettings 调用它们）；main.ts 启动的 apply 调用改用 settings.applyAll()（或保留各 apply import 但去重）。

- [ ] **Step 6: 跑测试 + tsc + 全量**

- [ ] **Step 7: Commit** `feat(settings-core): schema-driven settings + resetDefaults + fix muted mirror`

---

## Task 2: options.ts schema 驱动重构 + row desc + 恢复默认

**Files:**
- Modify: `src/options.ts`（renderAudio/Display/Access/Game 改为 schema 驱动 + row 加 desc + 恢复默认按钮）

**Interfaces:**
- Consumes: `SETTING_DEFS`、`resetDefaults`（Task 1）。

- [ ] **Step 1: row() 加 desc 参数** —— `row(label, controlHtml, desc?, disabled?)`，desc 非空时在 label 下渲染灰色小字。
- [ ] **Step 2: schema 驱动 renderTab** —— 新 `renderSchemaTab(body, tab)`：`SETTING_DEFS.filter(d=>d.tab===tab)` 生成 row（label=t(labelKey), desc=t(descKey?), control 按 d.control 派生 toggleHtml/segHtml/slider，bind 调 d.set + d.apply + renderOptions）。renderAudio/Display/Access/Game 改为调 renderSchemaTab。
- [ ] **Step 3: 恢复默认按钮** —— renderOptions 末尾（opt-body 后）加 `<button id="opt-reset">↺ ${t('opt.resetDefaults')}</button>`，onclick confirm → resetDefaults() + renderOptions() + applyAll。
- [ ] **Step 4: i18n key** —— opt.resetDefaults / opt.confirmReset + 确保各 Desc key 齐全（opt.zoomDesc 等，缺的补双语）。
- [ ] **Step 5: tsc + 全量 + 手动**（4 tab schema 渲染 + desc 小字 + 恢复默认）。
- [ ] **Step 6: Commit** `feat(settings-core): schema-driven options render + descriptions + reset-defaults button`

---

## Task 3: keybinds.ts — Action 枚举 + 默认映射 + API

**Files:**
- Create: `src/keybinds.ts`
- Test: `src/__tests__/keybinds.test.ts`（Create）

**Interfaces:**
- Produces: `Action` 类型、`DEFAULT_KEYS`/`DEFAULT_BUTTONS`、`keyToAction(e)`/`buttonToAction(i)`/`rebind(action,key)`/`bindingFor(action)`/`resetKeybinds()`/`loadKeybinds()`。

- [ ] **Step 1: 写失败测试**（Create `src/__tests__/keybinds.test.ts`）

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../state.js', () => ({ lang: 'en' }));
import { keyToAction, buttonToAction, rebind, bindingFor, resetKeybinds, DEFAULT_KEYS } from '../keybinds.js';

const ke = (key: string, ctrl = false) => ({ key, ctrlKey: ctrl, toLowerCase: () => key.toLowerCase() } as any);

beforeEach(() => localStorage.clear());

describe('keybinds default mapping (behavior-equivalent)', () => {
  it('movement keys', () => {
    expect(keyToAction(ke('w'))).toBe('move_up'); expect(keyToAction(ke('arrowup'))).toBe('move_up');
    expect(keyToAction(ke('d'))).toBe('move_right'); expect(keyToAction(ke('arrowright'))).toBe('move_right');
  });
  it('gameplay actions', () => {
    expect(keyToAction(ke('g'))).toBe('pickup'); expect(keyToAction(ke('i'))).toBe('inventory');
    expect(keyToAction(ke('b'))).toBe('inventory'); expect(keyToAction(ke('k'))).toBe('skill');
    expect(keyToAction(ke('escape'))).toBe('overlay_close');
  });
  it('quick slots 1-9', () => {
    for (let n=1;n<=9;n++) expect(keyToAction(ke(String(n)))).toBe(`quick${n}` as any);
  });
  it('gamepad buttons', () => {
    expect(buttonToAction(12)).toBe('move_up'); expect(buttonToAction(1)).toBe('overlay_close');
    expect(buttonToAction(0)).toBe('wait'); expect(buttonToAction(9)).toBe('pause');
  });
});
describe('rebind + conflict', () => {
  it('rebind changes mapping and persists', () => {
    rebind('pickup', 'p'); expect(keyToAction(ke('p'))).toBe('pickup');
    expect(keyToAction(ke('g'))).toBeNull(); // g freed
    expect(JSON.parse(localStorage.getItem('dh_keybinds')!).keys.p).toBe('pickup');
  });
  it('rebind onto an occupied key is rejected (returns conflict)', () => {
    const r = rebind('pickup', 'k'); // k is skill
    expect(r.conflict).toBe('skill'); expect(keyToAction(ke('k'))).toBe('skill'); // unchanged
  });
  it('resetKeybinds restores defaults', () => {
    rebind('pickup','p'); resetKeybinds(); expect(keyToAction(ke('g'))).toBe('pickup');
  });
});
```

- [ ] **Step 2: 跑测试验证失败**

- [ ] **Step 3: 实现 keybinds.ts** —— `Action` 联合（spec §③ 枚举）；`DEFAULT_KEYS`/`DEFAULT_BUTTONS`（从 input.ts 现状逐键提取，**务必覆盖所有现状键**：move 8/wasd+arrow、pickup g、descend ./>、wait space/f、inventory i/b、quaff q、read r、help ?、skill k、talent n、achieve t、lang l、mute m、overlay_close escape、quick1-9 数字）；`loadKeybinds()` 读 dh_keybinds（无→默认，迁移）；`keyToAction(e)` normalize e.key.toLowerCase() 查映射（数字 1-9 → quickN；CTRL+S/F11 元键返回 null 由 input.ts 特殊处理）；`buttonToAction(i)`；`rebind(action,newKey)` 冲突检测（newKey 已映射其他 action → 返回 {conflict} 不改；否则更新+saveKeybinds）；`bindingFor(action)` 反查；`resetKeybinds()` 恢复默认 + save。

- [ ] **Step 4: 跑测试 + tsc + 全量**

- [ ] **Step 5: Commit** `feat(settings-core): keybinds module — action map + rebind + persistence`

---

## Task 4: input.ts 重写（查表分发，行为等价）

**Files:**
- Modify: `src/input.ts`（主 switch L122-145 + 12 overlay 块 L36-111 + pollGamepad L174-216）

**Interfaces:**
- Consumes: `keyToAction`/`buttonToAction`/`Action`（Task 3）。

- [ ] **Step 1: 加行为等价回归测试**（追加 `src/__tests__/keybinds.test.ts` 或新 input 文件——若 input.ts 难单测则靠 keybinds 默认映射测试 + 手动冒烟）。优先：keybinds 默认映射测试（Task 3）已覆盖"键→action"，input.ts 的"action→dispatch"是机械分发，靠手动冒烟 + code review。

- [ ] **Step 2: 重写 input.ts keyboard handler**
  - 12 overlay 块的"ESC/B 关"：改为在各块内 `if (keyToAction(e) === 'overlay_close') { closeXxx(); e.preventDefault(); return; }`（替换 `e.key === 'Escape' || e.key === 'b'`）。注意：introOpen/menuOpen/inv/help/skill/achieve/talent/forge/options 各块的关闭键统一走 overlay_close。
  - inv 的数字 1-9（操作道具）/ event 的 1-N（选动作）/ skill 的 K/Enter：**保留各自逻辑**（不纳入改键，spec 边界），但 inv 的 B 关 → overlay_close。
  - 主 gameplay switch（L122-145）：改为 `const a = keyToAction(e); if (!a) { /*元键 CTRL+S/F11 保留原特殊判断*/ ...; switch(e.key.toLowerCase()){case 's': if(ctrlKey){saveGame();return;} ...} return; } switch(a){case 'move_up':movePlayer(0,-1);...case 'quick1':useQuickSlot(0);...}`。
  - Escape 全局开 pause：`if (keyToAction(e)==='overlay_close' && 无其他overlay打开) bridge.openPause()`（保留原 L115 逻辑，但用 action 判断）。

- [ ] **Step 3: 重写 pollGamepad** —— `const a = buttonToAction(i); if(a) dispatchGamepadAction(a)`，dispatchGamepadAction 按 action 分发（move/wait/overlay_close→closeActiveOverlay/skill/inventory/quaff/descend/pause）。摇杆移动（axes）保留原逻辑（非按钮）。

- [ ] **Step 4: tsc + 全量 + 手动冒烟**（重点：12 overlay 块 ESC/B 关闭行为无回归；gameplay 按键无回归；手柄无回归）。
  - 冒烟清单：开/关每个 overlay（inv/help/skill/achieve/talent/forge/options/pause/intro/event）、gameplay 全键（wasd/g/./i/k/t/n/q/r/1-9）、手柄 D-pad/A/B/X/Y/LB/RB/Start。

- [ ] **Step 5: Commit** `feat(settings-core): rewrite input.ts to table-driven keybind dispatch`

---

## Task 5: Keybinds tab（捕获 UI + 冲突 + 重置）

**Files:**
- Modify: `src/options.ts`（TABS 加 'keybinds' + renderKeybinds）、`src/input.ts`（捕获模式钩子）

**Interfaces:**
- Consumes: `bindingFor`/`rebind`/`resetKeybinds`/`Action`（Task 3）。

- [ ] **Step 1: TABS 加 keybinds** + tabLabels 加 `keybinds: t('optTabKeybinds')`。
- [ ] **Step 2: renderKeybinds(body)** —— 遍历 Action（分组 gameplay/meta），每行：`row(t('kb.<action>'), <span class="kb-key">${bindingFor(action)||'—'}</span> <button data-rebind="<action>">${t('kb.rebind')}</button>)`。点击 rebind 按钮 → 进入捕获模式（按钮变"按下新键…"）+ 设全局 capturingAction flag。
- [ ] **Step 3: input.ts 捕获钩子** —— keydown 顶部：`if (capturingAction) { e.preventDefault(); const r = rebind(capturingAction, e.key.toLowerCase()); capturingAction=null; if(r.conflict) alert(tMsg('kb.conflict', bindingFor...)); bridge.renderOptions?.(); return; }`。手柄捕获同理（pollGamepad 顶部）。
- [ ] **Step 4: 重置键位按钮** —— renderKeybinds 底部 `↺ ${t('kb.reset')}` onclick resetKeybinds + renderOptions。
- [ ] **Step 5: i18n** —— kb.* (各动作名 move_up/pickup/.../overlay_close、rebind、conflict、reset、capturing) + optTabKeybinds，双语。
- [ ] **Step 6: tsc + 全量 + 手动**（Keybinds tab 列所有动作 + 捕获改键 + 冲突提示 + 重置）。
- [ ] **Step 7: Commit** `feat(settings-core): keybinds settings tab with capture + conflict detection`

---

## Task 6: 全量验证 + 冒烟

**Files:** 全项目

- [ ] **Step 1: tsc + 全量测试**（含 settings/keybinds 新测 + 无回归）
- [ ] **Step 2: 冒烟（dev server）**
  1. 4 tab schema 渲染 + desc 小字 + 恢复默认按钮（重置后 DOM 更新）。
  2. Keybinds tab 列所有动作 + 当前键；点击捕获新键；冲突红字；重置默认。
  3. 改键后 gameplay 按新键执行（键盘 + 手柄）。
  4. overlay_close 改键后一致（如改 close 为 Q，所有 overlay Q 关）。
  5. 12 overlay 块开/关无回归（ESC/B + 各自数字/特殊键）。
  6. muted 单一 source（静音按钮 + 设置 toggle 一致）。
- [ ] **Step 3: Commit + 分支收尾**（merge 决策由用户）

---

## Self-Review 记录

- **Spec coverage**：spec §①架构 → Task 1/2；§②改键（keybinds + input 重写 + Keybinds tab）→ Task 3/4/5；§③恢复默认 → Task 1/2（settings.resetDefaults 按钮）；§Testing → Task 6 + 各 task 测试。全覆盖。
- **Placeholder**：settings.ts 14 项给样例 + 清单指引（subagent 读 state/audio 现有 getter/setter 填）；input.ts 重写给模式 + 行号 + 行为等价测试（不全文重写 234 行）。
- **Type 一致性**：`SettingDef`/`Control`/`Action`/`keyToAction`/`rebind`/`bindingFor` 跨 task 签名一致。
- **行为等价**：Task 3 默认映射测试 + Task 4 手动冒烟覆盖现状键位无回归（最大风险点）。
