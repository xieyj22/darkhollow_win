# Settings B-表层（Options 视觉精修 + 无障碍增强）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 B-核心 schema 架构上做 options 面板视觉精修（CSS 层）+ 无障碍增强（文字大小连续调节 / 高对比模式 / ARIA / tab 方向键），同套基础控件皮肤全局同步。

**Architecture:** 方案 A——渲染结构不动，视觉全部在 `style/main.css` 令牌与皮肤层完成；无障碍走既有 `SETTING_DEFS` schema（新 setting 自动获得渲染/持久化/reset）；ARIA 属性在 `options.ts` 的 HTML 拼接处内联补齐。分支 `feat/settings-surface`（自 main `1db85f9`）。

**Tech Stack:** TypeScript + Vite + vitest(happy-dom) + 原生 DOM/CSS。无新依赖。

**Spec:** `docs/superpowers/specs/2026-08-23-darkhollow-settings-surface-design.md`

## Global Constraints

- 322 现有测全绿红线；`npx tsc --noEmit` exit 0；`npm run build` 成功
- **凡 mock 了 `state.js` 的测试文件都要同步加 `hc: false, setHc: vi.fn()`**——grep 确认有 3 个：`settings.test.ts` / `options.test.ts` / `keybinds.test.ts`（vi.mock 工厂内）。Task 1 一并改齐，否则 settings.ts import `hc` 时三文件全崩
- **不碰**：`input.ts`、`keybinds.ts`、`main.ts`、其他面板 TS、`.forge-tab` 类
- B-核心 6 冒烟场景语义不变（改键/overlay/mute 链路）
- i18n 新 key 双语（en/zh），前缀 `opt.`/`kb.`
- 所有动效在 `body.reduced-motion` 下有静态降级
- min-height 44px 触控目标不缩小
- Windows bash：`npx vitest run; echo $?` 显式核验退出码（`| tail` 会掩码）

---

### Task 1: 高对比模式（state source + schema def + CSS）

**Files:**
- Modify: `src/state.ts`（~90-121 区域，加 hc source）
- Modify: `src/settings.ts`（apply 区 + SETTING_DEFS access 段）
- Modify: `src/i18n.ts`（2 新 key）
- Modify: `style/main.css`（body.hc 覆盖块，加在色弱滤镜块 ~L377 后）
- Modify: `src/__tests__/settings.test.ts` + `options.test.ts` + `keybinds.test.ts`（三处 state.js mock 加 hc/setHc）
- Test: `src/__tests__/settings.test.ts`

**Interfaces:**
- Produces: `state.ts` 导出 `hc: boolean` 与 `setHc(v: boolean)`；SETTING_DEFS 含 `{ key:'hc', tab:'access', control:'toggle', default:false }`；`body.hc` CSS 类

- [ ] **Step 1: 写失败测试**（追加到 `settings.test.ts` 末尾；该文件已 mock state.js，先在 mock 里加 `hc: false, setHc: vi.fn()`）

```typescript
describe('hc (high contrast) setting', () => {
  it('schema def: access tab, toggle, default false, has descKey', () => {
    const def = SETTING_DEFS.find(d => d.key === 'hc');
    expect(def).toBeDefined();
    expect(def!.tab).toBe('access');
    expect(def!.control).toBe('toggle');
    expect(def!.default).toBe(false);
    expect(def!.descKey).toBe('opt.hcDesc');
  });
});
```

注意：
- 该文件 **mock 的 state.js 里必须加 `hc: false, setHc: vi.fn()`**（vi.mock 工厂 ~L17-23），否则 settings.ts import hc 报 undefined。
- resetDefaults 覆盖**不需要新写**——既有测试 `resetDefaults calls set(default) for every def`（settings.test.ts:35）遍历全部 def，hc def 加入后自动覆盖（`d.set` 在运行时就是 `setHc` mock 引用，`asSetter` 仅编译期擦除）。
- `SETTING_DEFS` 已在该文件 import（L16），无需补。

- [ ] **Step 2: 跑测确认失败**

Run: `npx vitest run src/__tests__/settings.test.ts`
Expected: FAIL — `def` 为 undefined（hc def 不存在）

- [ ] **Step 3: 最小实现**

`src/state.ts`（在 barCues/introEnabled source 附近，模仿 `barCues` 行；读取用 `=== '1'`）:
```typescript
export let hc: boolean = localStorage.getItem('dh_hc') === '1';
export function setHc(v: boolean) { hc = v; localStorage.setItem('dh_hc', v ? '1' : '0'); }
```
（注意：state.ts 现有 boolean source 的读取惯例先 grep `localStorage.getItem('dh_` 对齐——若 barCues 用 `=== '1'` 则同款。）

`src/settings.ts`：
- import 区加 `hc, setHc`（对齐现有 `barCues, setBarCues` 行）
- apply 区（`applyBarCues` 后）加：
```typescript
function applyHc(): void {
  document.body.classList.toggle('hc', hc);
}
```
- SETTING_DEFS access 段（barCues 后）加：
```typescript
{
  key: 'hc', tab: 'access', labelKey: 'optHc', descKey: 'opt.hcDesc', control: 'toggle',
  get: () => hc, set: asSetter(setHc),
  apply: applyHc, default: false,
},
```
- 顶部 schema 注释 "14 settings" 改 "15 settings"

`src/i18n.ts`（`opt.resetDefaults` 行 ~140 附近）:
```typescript
optHc: { en: 'High Contrast', zh: '高对比度' },
"opt.hcDesc": { en: 'Brighter text and stronger borders across the interface', zh: '界面文字更亮、边框更强' },
```
（对齐该文件既有 key 风格：无点 key 裸名、带点 key 加引号。）

`style/main.css` 色弱滤镜块后追加：
```css
/* ===== High contrast (accessibility toggle → body.hc) =====
   Lifts text tokens, brightens borders, flattens translucent backgrounds.
   Combinable with cb-* filters (different mechanisms). */
body.hc{--text-secondary:#b8b8cc;--text-muted:#999999;--border-default:#555570;--border-subtle:#44445c}
body.hc .panel{background:#141420}
body.hc #keys-panel,body.hc #legend-panel,body.hc #objective-panel{background:#0f0f1a}
```
（`#keys-panel` 等当前半透明背景在 main.css ~L254/L271；若 grep 发现其他 `ee` 结尾半透明 HUD 背景，一并加实。）

- [ ] **Step 4: 跑测确认通过 + 全量回归**

Run: `npx vitest run; echo $?`
Expected: 全绿（322 + 2 新增 = 324）

- [ ] **Step 5: tsc + build**

Run: `npx tsc --noEmit; echo $?` 然后 `npm run build 2>&1 | tail -2`
Expected: exit 0 / build 成功

- [ ] **Step 6: Commit**

```bash
git add src/state.ts src/settings.ts src/i18n.ts style/main.css src/__tests__/settings.test.ts src/__tests__/options.test.ts src/__tests__/keybinds.test.ts
git commit -m "feat(settings-surface): high-contrast mode — hc source + schema def + body.hc CSS"
```

---

### Task 2: 文字大小 seg→slider（连续 0.85–1.5）

**Files:**
- Modify: `src/state.ts:90`（clamp 上限 1.2→1.5）
- Modify: `src/settings.ts`（textScale def）
- Modify: `src/i18n.ts`（删 tsSmall/tsMedium/tsLarge 三行 ~178-180）
- Test: `src/__tests__/settings.test.ts`

**Interfaces:**
- Produces: textScale def `control:'slider', min:0.85, max:1.5, step:0.05, toDisplay:v=>${Math.round(v*100)}%`

- [ ] **Step 1: 写失败测试**

```typescript
describe('textScale continuous slider', () => {
  it('def is a slider 0.85–1.5 step 0.05 with percent display', () => {
    const def = SETTING_DEFS.find(d => d.key === 'textScale')!;
    expect(def.control).toBe('slider');
    expect(def.min).toBe(0.85);
    expect(def.max).toBe(1.5);
    expect(def.step).toBe(0.05);
    expect(def.toDisplay!(1.5)).toBe('150%');
  });
});
```

- [ ] **Step 2: 跑测确认失败**

Run: `npx vitest run src/__tests__/settings.test.ts`
Expected: FAIL — control 是 'seg'

- [ ] **Step 3: 实现**

`src/settings.ts` textScale def 整块替换：
```typescript
{
  key: 'textScale', tab: 'display', labelKey: 'optTextSize', control: 'slider',
  min: 0.85, max: 1.5, step: 0.05,
  get: () => textScale, set: asSetter(setTextScale),
  apply: applyTextScale, default: 1,
  toDisplay: v => `${Math.round((v as number) * 100)}%`,
},
```
`src/state.ts:90`：
```typescript
export let textScale: number = clampFloat(localStorage.getItem('dh_text_scale'), 1, 0.85, 1.5);
```
（行尾注释同步改 `0.85–1.5`。）
`src/i18n.ts`：删除 `tsSmall`/`tsMedium`/`tsLarge` 三行（已 grep 确认唯一引用是 settings.ts 旧 def，Step 3 已删）。

- [ ] **Step 4: 跑测 + 全量回归**

Run: `npx vitest run; echo $?`
Expected: 全绿 325（若 options.test 有 seg 相关 textScale 断言挂掉，按新 control 更新该断言——grep `textScale` in options.test 先查）

- [ ] **Step 5: tsc + build + Commit**

```bash
git add src/state.ts src/settings.ts src/i18n.ts src/__tests__/settings.test.ts
git commit -m "feat(settings-surface): text size 3-tier seg → continuous slider 85%–150%"
```

---

### Task 3: ARIA 角色 + tab 图标（options.ts 渲染层）

**Files:**
- Modify: `src/options.ts`（renderOptions tab 拼接 ~L88、schemaControlHtml ~L160、toggleHtml ~L150、row() ~L145、renderKeybinds 分组标题 ~L359）
- Modify: `src/i18n.ts`（3 新 key `kb.grpGameplay`/`kb.grpQuick`/`kb.grpMeta`）
- Test: `src/__tests__/options.test.ts`

**Interfaces:**
- Produces: tab 按钮带 `role="tab" aria-selected aria-controls="opt-body"` + 图标前缀；`#opt-body` 带 `role="tabpanel" tabindex="0"`；schema toggle input 带 `role="switch" aria-checked aria-label`；slider 带 `aria-valuemin/max/now valuetext`；seg 容器 `role="radiogroup"` + 按钮 `role="radio" aria-checked`；`.kb-group` 前有分组标题 `.kb-group-title`

- [ ] **Step 1: 写失败测试**（追加到 options.test.ts）

```typescript
describe('ARIA roles and tab icons', () => {
  it('tabs have role=tab + aria-selected + aria-controls; body has tabpanel', () => {
    const tabs = document.querySelectorAll('.opt-tab');
    expect(tabs.length).toBe(5);
    const active = document.querySelector('.opt-tab.active')!;
    expect(active.getAttribute('role')).toBe('tab');
    expect(active.getAttribute('aria-selected')).toBe('true');
    expect(active.getAttribute('aria-controls')).toBe('opt-body');
    const inactive = document.querySelector('.opt-tab:not(.active)')!;
    expect(inactive.getAttribute('aria-selected')).toBe('false');
    const body = document.getElementById('opt-body')!;
    expect(body.getAttribute('role')).toBe('tabpanel');
  });
  it('schema toggle has role=switch + aria-checked + aria-label', () => {
    switchTab('audio');
    const cb = document.querySelector<HTMLInputElement>('#opt-body input[data-optkey="mute"]')!;
    expect(cb.getAttribute('role')).toBe('switch');
    expect(cb.getAttribute('aria-checked')).toBe('false');
    expect(cb.getAttribute('aria-label')).toBeTruthy();
  });
  it('schema slider carries aria valuemin/max/now + valuetext', () => {
    switchTab('audio');
    const sl = document.querySelector<HTMLInputElement>('#opt-body input[data-optkey="master"]')!;
    expect(sl.getAttribute('aria-valuemin')).toBe('0');
    expect(sl.getAttribute('aria-valuemax')).toBe('1');
    expect(sl.getAttribute('aria-valuetext')).toBe('90%');
  });
  it('seg container is radiogroup with radio + aria-checked children', () => {
    switchTab('display');
    const seg = document.querySelector<HTMLElement>('#opt-body .seg[data-optkey="lang"]')!;
    expect(seg.getAttribute('role')).toBe('radiogroup');
    const activeBtn = seg.querySelector<HTMLButtonElement>('button.active')!;
    expect(activeBtn.getAttribute('role')).toBe('radio');
    expect(activeBtn.getAttribute('aria-checked')).toBe('true');
  });
  it('keybinds groups have visible titles', () => {
    switchTab('keybinds');
    const titles = document.querySelectorAll('#opt-body .kb-group-title');
    expect(titles.length).toBe(3);
  });
});
```

- [ ] **Step 2: 跑测确认失败**

Run: `npx vitest run src/__tests__/options.test.ts`
Expected: FAIL（aria-selected 为 null / kb-group-title 0 个）

- [ ] **Step 3: 实现**（全部在 options.ts）

(a) `renderOptions` tab 拼接替换（图标 + aria）：
```typescript
const TAB_ICONS: Record<SettingTab, string> = {
  audio: '🔊', display: '🖥', access: '♿', game: '⚔', keybinds: '⌨',
};
tabsEl.innerHTML = TABS.map(id =>
  `<button class="opt-tab${id === optActiveTab ? ' active' : ''}" data-tab="${id}" role="tab" aria-selected="${id === optActiveTab}" aria-controls="opt-body">${TAB_ICONS[id]} ${tabLabels[id]}</button>`,
).join('');
```
并在 `bodyEl.innerHTML = ''` 前：`bodyEl.setAttribute('role', 'tabpanel'); bodyEl.setAttribute('tabindex', '0');`

(b) `schemaControlHtml` 三分支加 aria：
- toggle：`<input type="checkbox" role="switch" aria-checked="${d.get()}" aria-label="${t(d.labelKey)}" data-optkey=...>`
- slider：在现有 `<input type="range"` 后追加 ` aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${v}" aria-valuetext="${display}"`（display 变量已存在）
- seg：容器 `<div class="seg" role="radiogroup" data-optkey=...>`，按钮 `<button data-seg="${o.id}" role="radio" aria-checked="${o.id === cur}" class=...>`

注意 aria-checked/aria-selected 是字符串插值，toggle 的 `d.get()` 返回 boolean 直接插 `${...}` 得 "true"/"false"，正确。

(c) `renderKeybinds` 分组标题：
```typescript
body.innerHTML =
  `<div class="kb-group-title">🎮 ${t('kb.grpGameplay')}</div><div class="kb-group">${KB_GAMEPLAY.map(renderActionRow).join('')}</div>` +
  `<div class="kb-group-title">1️⃣ ${t('kb.grpQuick')}</div><div class="kb-group">${KB_QUICK.map(renderActionRow).join('')}</div>` +
  `<div class="kb-group-title">⚙ ${t('kb.grpMeta')}</div><div class="kb-group">${KB_META.map(renderActionRow).join('')}</div>`;
```

(d) `src/i18n.ts`（kb.* 区 ~L170-175）：
```typescript
"kb.grpGameplay": { en: 'Gameplay', zh: '游戏操作' },
"kb.grpQuick": { en: 'Quick Slots', zh: '快捷栏' },
"kb.grpMeta": { en: 'Meta', zh: '系统' },
```

- [ ] **Step 4: 跑测 + 全量回归**

Run: `npx vitest run; echo $?`
Expected: 330 全绿（325+5）

- [ ] **Step 5: tsc + build + Commit**

```bash
git add src/options.ts src/i18n.ts src/__tests__/options.test.ts
git commit -m "feat(settings-surface): ARIA roles (tab/switch/radio/valuetext) + tab icons + kb group titles"
```

---

### Task 4: tablist 方向键导航

**Files:**
- Modify: `src/options.ts`（renderOptions 的 tabsEl.forEach 后挂容器 keydown，**捕获阶段**）
- Test: `src/__tests__/options.test.ts`

**Interfaces:**
- Consumes: Task 3 的 `.opt-tab` DOM
- Produces: tabs 容器 ArrowLeft/ArrowRight 移动 focus 并激活相邻 tab；事件不冒泡到 document（options overlay 的 document keydown 会 swallow / arrowleft 绑 move_left）

**背景（implementer 必读）**：`input.ts` 在 document 上有全局 keydown；options overlay active 时它 swallow 一切非 overlay_close 键（input.ts ~L79-84），而 arrowleft/right 绑定 move_left/move_right。因此 tablist 方向键 handler 必须在事件到达 document 前消费：挂 `tabsEl.addEventListener('keydown', handler, true)` 不够（keydown 在焦点元素上先触发再冒泡，容器捕获+preventDefault+stopPropagation 即可拦截）。

- [ ] **Step 1: 写失败测试**

```typescript
describe('tablist arrow-key navigation', () => {
  it('ArrowRight/ArrowLeft move focus and activate the neighbor tab', () => {
    const tabs = Array.from(document.querySelectorAll<HTMLElement>('.opt-tab'));
    tabs[0].focus(); // audio
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const active = document.querySelector('.opt-tab.active') as HTMLElement;
    expect(active.dataset.tab).toBe('display');
    expect(document.activeElement).toBe(active);
    active.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect((document.querySelector('.opt-tab.active') as HTMLElement).dataset.tab).toBe('audio');
  });
  it('wraps at both ends', () => {
    const tabs = Array.from(document.querySelectorAll<HTMLElement>('.opt-tab'));
    const last = tabs[tabs.length - 1];
    last.focus();
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect((document.querySelector('.opt-tab.active') as HTMLElement).dataset.tab).toBe('audio');
  });
});
```

- [ ] **Step 2: 跑测确认失败**

Run: `npx vitest run src/__tests__/options.test.ts`
Expected: FAIL（dispatch 后 active 仍是 audio）

- [ ] **Step 3: 实现**（renderOptions 的 tabsEl.querySelectorAll 绑定块后追加）

```typescript
// Arrow-key tab traversal (WAI-ARIA tablist pattern). Capture-phase +
// stopPropagation: the document keydown (input.ts) swallows arrows while the
// options overlay is open (arrowleft/right are bound to move_left/move_right),
// so this handler must consume the event before it bubbles out of the tabs.
tabsEl.onkeydown = (ev: KeyboardEvent) => {
  if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
  ev.preventDefault();
  ev.stopPropagation();
  const btns = Array.from(tabsEl!.querySelectorAll<HTMLElement>('.opt-tab'));
  const idx = btns.indexOf(document.activeElement as HTMLElement);
  if (idx === -1) return;
  const dir = ev.key === 'ArrowRight' ? 1 : -1;
  const next = btns[(idx + dir + btns.length) % btns.length];
  next.focus();
  next.click();
};
```
（用 `tabsEl.onkeydown` 属性赋值——renderOptions 每次 innerHTML 重建 tab，容器元素本身不重建，属性赋值避免重复 addEventListener 累积。）

- [ ] **Step 4: 跑测 + 全量回归**

Run: `npx vitest run; echo $?`
Expected: 332 全绿

- [ ] **Step 5: tsc + build + Commit**

```bash
git add src/options.ts src/__tests__/options.test.ts
git commit -m "feat(settings-surface): WAI-ARIA tablist arrow-key navigation (capture, wraps)"
```

---

### Task 5: 视觉精修 CSS（令牌 + tab 下划线 + 控件皮肤 + kb 键帽）

**Files:**
- Modify: `style/main.css`（:root 令牌区 ~L34 后 + options 控件区 ~L193-232 重写 + reduced-motion 块追加）
- 无新测试（CSS 视觉层；happy-dom 不渲染样式）——验证 = 全量测不回归 + Task 6 冒烟截图

**Interfaces:**
- Consumes: Task 3/4 的 DOM（.kb-group-title 等）
- Produces: 全局类 `.toggle`/`.seg`/`.vol-slider` 新皮肤（forge/records/codex 被动继承）；`.opt-tab` 下划线 active；`.kb-key` 键帽化

- [ ] **Step 1: :root 令牌**（--fs-lg 行后）

```css
--opt-gap: 14px;
--radius-lg: 10px;
--hover-bg: #ffffff08;
```

- [ ] **Step 2: tab 条重写**（替换 .opt-tabs/.opt-tab/.opt-tab:hover/.opt-tab.active 四行 ~L197-200）

```css
.opt-tabs{display:flex;gap:2px;margin-bottom:14px;border-bottom:1px solid var(--border-default);flex-wrap:wrap}
.opt-tab{position:relative;background:none;border:none;color:var(--text-secondary);min-height:44px;padding:8px 14px;cursor:pointer;font-family:inherit;font-size:var(--fs-base);transition:color .15s}
.opt-tab::after{content:'';position:absolute;left:12px;right:12px;bottom:0;height:2px;background:var(--accent-red);transform:scaleX(0);transform-origin:center;transition:transform .15s}
.opt-tab:hover{color:var(--text-bright)}
.opt-tab.active{color:var(--accent-red)}
.opt-tab.active::after{transform:scaleX(1)}
body.reduced-motion .opt-tab::after{transition:none}
```
（焦点态 outline 已有全局 focus-visible 规则，不动。）

- [ ] **Step 3: 行/toggle/seg/slider 皮肤**（替换 .opt-row/.opt-desc/.toggle/.seg 块 ~L202-222）

```css
.opt-body{padding-top:4px}
.opt-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 var(--opt-gap);min-height:44px;padding:4px 8px;margin-left:-8px;margin-right:-8px;border-radius:var(--radius-sm);transition:background .15s}
.opt-row:hover{background:var(--hover-bg)}
.opt-row .opt-label{color:var(--text-secondary);font-size:var(--fs-base);flex:1}
.opt-row .opt-val{min-width:48px;text-align:right;color:var(--text-bright);font-variant-numeric:tabular-nums;font-size:var(--fs-sm)}
.opt-row.disabled{opacity:.4}
.opt-row.disabled .vol-slider,.opt-row.disabled .seg,.opt-row.disabled .toggle{pointer-events:none}
.opt-desc{display:block;font-size:var(--fs-sm);color:var(--text-muted);margin-top:2px;line-height:1.3}
```
toggle（checked 态发光 + thumb 弹性）：
```css
.toggle{position:relative;width:46px;height:26px;flex-shrink:0;cursor:pointer;display:inline-block}
.toggle input{opacity:0;position:absolute;inset:0;cursor:pointer;margin:0;width:100%;height:100%}
.toggle .track{position:absolute;inset:0;background:var(--bg-card);border:1px solid var(--border-default);border-radius:13px;box-shadow:inset 0 2px 4px #00000055;transition:all .15s;pointer-events:none}
.toggle .thumb{position:absolute;top:2px;left:2px;width:20px;height:20px;background:var(--text-muted);border-radius:50%;transition:left .15s cubic-bezier(.4,0,.2,1.4),background .15s;pointer-events:none}
.toggle input:checked ~ .track{background:#e6394633;border-color:var(--accent-red);box-shadow:inset 0 2px 4px #00000055,0 0 8px #e6394633}
.toggle input:checked ~ .thumb{left:22px;background:var(--accent-red)}
body.reduced-motion .toggle .thumb{transition:none}
```
seg（分隔减淡 + active 内亮边）：
```css
.seg{display:inline-flex;border:1px solid var(--border-default);border-radius:var(--radius-sm);overflow:hidden}
.seg button{background:none;border:none;color:var(--text-secondary);min-height:44px;min-width:44px;padding:6px 12px;cursor:pointer;font-family:inherit;font-size:var(--fs-sm);border-right:1px solid var(--border-subtle);transition:all .15s}
.seg button:last-child{border-right:none}
.seg button:hover{color:var(--accent-red)}
.seg button.active{background:#e6394622;color:var(--accent-red);box-shadow:inset 0 0 0 1px #e6394655}
```
slider（自定义 thumb + 细轨道；accent-color 保留为不支持伪元素的降级）：
```css
.vol-slider{flex:1;accent-color:var(--accent-red);cursor:pointer;height:24px}
.vol-slider::-webkit-slider-runnable-track{height:4px;background:var(--border-default);border-radius:2px}
.vol-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:14px;height:14px;margin-top:-5px;border-radius:50%;background:var(--accent-red);border:none;box-shadow:0 0 0 2px #16162a;transition:box-shadow .15s}
.vol-slider:hover::-webkit-slider-thumb{box-shadow:0 0 0 2px #16162a,0 0 8px #e6394688}
.vol-slider::-moz-range-track{height:4px;background:var(--border-default);border-radius:2px}
.vol-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:var(--accent-red);border:none;box-shadow:0 0 0 2px #16162a}
body.reduced-motion .vol-slider::-webkit-slider-thumb{transition:none}
```

- [ ] **Step 4: kb 分组标题 + 键帽**（.kb-group 块前加标题样式；.kb-key 键帽化）

```css
.kb-group-title{color:#8888aa;font-size:var(--fs-sm);letter-spacing:1px;text-transform:uppercase;margin:12px 0 6px}
.kb-group-title:first-child{margin-top:0}
.kb-group{padding-top:2px}
.kb-group:not(:first-child){border-top:none;margin-top:6px}
.kb-key{display:inline-flex;align-items:center;gap:8px;padding:4px 8px;background:linear-gradient(180deg,#22223a,#1a1a2e);border:1px solid var(--border-default);border-bottom:3px solid var(--border-bright);border-radius:var(--radius-sm);font-family:var(--font-mono);font-size:var(--fs-sm);color:var(--text-bright);min-height:28px;line-height:1}
```
（原 `.kb-group:not(:first-child)` 的 border-top 分隔被标题取代——标题本身即分隔。`.kb-key .kb-kb/.kb-gp` 两行颜色规则保留不动。）

- [ ] **Step 5: 全量回归 + tsc + build**

Run: `npx vitest run; echo $?` + `npx tsc --noEmit; echo $?` + `npm run build 2>&1 | tail -2`
Expected: 332 全绿 / exit 0 / build 成功

- [ ] **Step 6: Commit**

```bash
git add style/main.css
git commit -m "feat(settings-surface): visual polish — tab underline, row hover, control skins, kb keycaps"
```

---

### Task 6: 冒烟更新 + 截图矩阵 + 全验证

**Files:**
- Modify: `scripts/smoke_settings_core.py`（textScale 断言 seg→slider + 新增断言）
- 产物: `scripts/smoke_out/surface-*.png`

**Interfaces:**
- Consumes: Tasks 1-5 全部产物

- [ ] **Step 1: 更新冒烟脚本**

(a) display tab 行数断言不变（行数未变——textScale 仍 1 行），但若脚本有 textScale seg 交互则改 slider。检查现有脚本：`grep -n textScale scripts/smoke_settings_core.py`——若无引用则跳过。
(b) S1 区新增（reset 段后）：
```python
# hc toggle persists + body class
click_tab(page, 'access')
hc_cb = page.query_selector('#opt-body input[data-optkey="hc"]')
check('SURF', 'hc toggle rendered on access tab', hc_cb is not None)
if hc_cb:
    page.click('#opt-body input[data-optkey="hc"]')
    page.wait_for_timeout(150)
    ls_hc = page.evaluate("localStorage.getItem('dh_hc')")
    body_hc = page.evaluate("document.body.classList.contains('hc')")
    check('SURF', 'hc toggle persists dh_hc=1 + body.hc', ls_hc == '1' and body_hc)
    page.click('#opt-body input[data-optkey="hc"]')  # restore off
# textScale slider to 1.5
click_tab(page, 'display')
page.evaluate("""() => { const el = document.querySelector('[data-optkey="textScale"]'); el.value = 1.5; el.dispatchEvent(new Event('input')); }""")
page.wait_for_timeout(150)
fs = page.evaluate("document.documentElement.style.getPropertyValue('--fs-scale')")
check('SURF', 'textScale slider 1.5 → --fs-scale=1.5', fs.strip() in ('1.5', '1.50'), fs)
page.evaluate("""() => { const el = document.querySelector('[data-optkey="textScale"]'); el.value = 1; el.dispatchEvent(new Event('input')); }""")
# tablist aria + arrow nav
aria_ok = page.evaluate("""() => {
  const a = document.querySelector('.opt-tab.active');
  return a && a.getAttribute('role') === 'tab' && a.getAttribute('aria-selected') === 'true'
    && document.getElementById('opt-body').getAttribute('role') === 'tabpanel';
}""")
check('SURF', 'tablist aria (tab/aria-selected/tabpanel)', aria_ok)
page.click('.opt-tab[data-tab="audio"]')
page.evaluate("""() => { document.querySelector('.opt-tab[data-tab="audio"]').focus();
  document.querySelector('.opt-tab[data-tab="audio"]').dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowRight', bubbles:true})); }""")
page.wait_for_timeout(150)
active_tab = page.evaluate("() => document.querySelector('.opt-tab.active').dataset.tab")
check('SURF', 'ArrowRight activates next tab', active_tab == 'display', str(active_tab))
```
(c) tab 图标断言（S1 tabs 检查后）：
```python
icons = page.eval_on_selector_all('.opt-tab', 'els => els.map(e => e.textContent.trim().slice(0,2))')
check('SURF', 'tabs carry icons', all(any(i in t for i in ['🔊','🖥','♿','⚔','⌨']) for t in icons), str(icons))
```

- [ ] **Step 2: 跑冒烟（vite preview）**

Run: `npm run build 2>&1 | tail -1 && python "C:/Users/Administrator/.claude/skills/webapp-testing/scripts/with_server.py" --server "npm run preview -- --port 4173 --strictPort" --port 4173 -- python scripts/smoke_settings_core.py`
Expected: 原 48 项 + 新 ~6 项全 PASS，console error 仅 favicon 404（pre-existing）

- [ ] **Step 3: 截图矩阵**（脚本末尾 browser.close 前加）

```python
for tab in ['audio', 'display', 'access', 'game', 'keybinds']:
    page.evaluate(f"() => document.querySelector('.opt-tab[data-tab=\"{tab}\"]').click()")
    page.wait_for_timeout(200)
    page.screenshot(path=f'{OUT}/surface-opt-{tab}.png')
page.evaluate("() => document.querySelector('[data-optkey=\"hc\"]').click()")  # hc on
page.wait_for_timeout(200)
for tab in ['access', 'keybinds']:
    page.evaluate(f"() => document.querySelector('.opt-tab[data-tab=\"{tab}\"]').click()")
    page.wait_for_timeout(200)
    page.screenshot(path=f'{OUT}/surface-hc-{tab}.png')
page.evaluate("() => document.querySelector('[data-optkey=\"hc\"]').click()")  # off
# forge 同套控件抽查
page.evaluate("() => document.querySelector('#btn-forge').dispatchEvent(new MouseEvent('click', {bubbles:true}))")
page.wait_for_timeout(300)
page.screenshot(path=f'{OUT}/surface-forge-seg.png')
```
截图后用 Read 工具逐张肉眼核验（tab 下划线/toggle 发光/键帽/分组标题/hc 对比度/forge seg 新皮肤）。

- [ ] **Step 4: 全量验证**

Run: `npx vitest run; echo $?` + `npx tsc --noEmit; echo $?` + `npm run build 2>&1 | tail -2`
Expected: 332 全绿 / 0 / 成功

- [ ] **Step 5: Commit**

```bash
git add scripts/smoke_settings_core.py
git commit -m "test(settings-surface): smoke updates — hc/textScale/aria/arrow-nav + screenshot matrix"
```
（smoke_out/ 截图不入库——确认 .gitignore 含 scripts/smoke_out/，无则加。）

---

## 执行顺序与依赖

Task 1 → 2 → 3 → 4 → 5 → 6 严格串行（1/2/3 相对独立但都动 settings.ts/i18n.ts 同文件区，串行避冲突；4 依赖 3 的 DOM；5 依赖 3 的 .kb-group-title；6 收口全量）。

**完成后**：superpowers:requesting-code-review 发起审查 → finishing-a-development-branch（等用户冒烟+merge 决策，对齐 B-核心惯例）。
