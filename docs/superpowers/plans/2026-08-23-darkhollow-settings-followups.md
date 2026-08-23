# Settings 收尾小包（4 项 follow-up）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 清掉 settings A/B 落地后 ledger 留下的 4 条 follow-up：smoke favicon 白名单（接 CI 前必做）、toggleHtml 3 站点 switch aria、M2 reduced-motion 5 站点 CSS 降解、smoke 3 处恒 True 断言清理 + 补 2 截图。

**Architecture:** 纯收尾批——1 个 Python smoke 脚本（`scripts/smoke_settings_core.py`，590 行）+ 3 行 TS（`src/options.ts` toggleHtml）+ 1 条 CSS 规则（`style/main.css`）+ 2 个 vitest 断言扩展。零玩法行为变更；aria 属性与 reduced-motion 降级均不动逻辑。

**Tech Stack:** TypeScript + Vite + vitest(happy-dom)；smoke = Python playwright（`channel='chrome'` 系统 Chrome）跑 `vite preview` :4173。

## Global Constraints

- 零玩法/零行为变更：只加 aria 属性、CSS 降级（仅在 `body.reduced-motion` 下）、smoke 脚本自身改动。
- CSS 降解跟随既有块风格（`style/main.css:384-388`）：`body.reduced-motion <sel>{transition:none}`，**不加** `!important`。
- i18n 零新增 key：aria-label 复用 `optFullscreen`/`optLegend`/`optKeys`（调用点已有）。
- 测试计数口径：vitest 基线 **332**（Task 2 净 +0～2，按"基线+N"算，别信累计预测）。
- smoke 基线 **57 check**；本批 = 57 −1（ev_ok 删）+2（aria）+1（ts1.5 hud）= **59**，且 **exit 0**（Task 1 后）。
- 每任务一 commit；分支 `feat/settings-followups`（自 main @ 4290bda）。
- 验证硬门：`npx tsc --noEmit` exit 0、`npx vitest run` 全绿、`npm run build` exit 0、smoke exit 0 且 59/59、`scripts/smoke_out/` 出现 2 张新 png。

---

### Task 1: smoke favicon 404 白名单（接 CI 前必做）

**Files:**
- Modify: `scripts/smoke_settings_core.py:78-79`（console/response 两个 handler）

**Interfaces:**
- Consumes: 无
- Produces: `console_errors` 不再收 favicon 404 → `sys.exit(1 if fails or console_errors else 0)`（L584）可为 0，CI 门有效。

**背景**：vite preview 无 favicon，Chrome 请求 `/favicon.ico` 得 404，**两条路**都进 `console_errors`：response handler（`r.status>=400`）+ console handler（`m.type=='error'` 的 "Failed to load resource: …404"，URL 在 `m.location` 不在 `m.text`）。故两个 handler 都要滤。

- [ ] **Step 1: 修两个 handler**（现状 L78-79）

```python
        page.on('console', lambda m: console_errors.append(f'{m.text} :: {m.location.get("url", "?")}') if m.type == 'error' else None)
        page.on('response', lambda r: console_errors.append(f'HTTP {r.status} {r.url}') if r.status >= 400 else None)
```

改为（favicon 404 = vite preview 预期噪音，白名单直至应用真正带图标）：

```python
        # favicon.ico 404 is expected under vite preview (no icon shipped) —
        # whitelist it so console_errors can gate the CI exit code honestly.
        page.on('console', lambda m: console_errors.append(f'{m.text} :: {m.location.get("url", "?")}') if m.type == 'error' and 'favicon' not in m.text and 'favicon' not in (m.location.get('url') or '') else None)
        page.on('response', lambda r: console_errors.append(f'HTTP {r.status} {r.url}') if r.status >= 400 and 'favicon' not in r.url else None)
```

- [ ] **Step 2: 语法自检**

Run: `python -m py_compile scripts/smoke_settings_core.py && echo OK`
Expected: `OK`（真跑放 Task 4 一并验证 exit 0，单独跑一次全 smoke 太贵）

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke_settings_core.py
git commit -m "fix(smoke): whitelist favicon 404 so exit code can gate CI"
```

---

### Task 2: toggleHtml 3 站点 switch aria（TDD）

**Files:**
- Modify: `src/options.ts:175-178`（toggleHtml）、`src/options.ts:324,340,341`（3 调用点）
- Test: `src/__tests__/options.test.ts:71-96`（display/game 两个既有 case 内扩断言）

**Interfaces:**
- Consumes: `t()`（既有 i18n，调用点求值后传字符串，toggleHtml 内部**不新增** t() 调用 → settings/keybinds 等 mock 不用动）
- Produces: `toggleHtml(checked: boolean, extraKey = '', label = '')` — 第三参非空时输出 `aria-label`；恒输出 `role="switch" aria-checked="${checked}"`。与 schema 版（`schemaControlHtml` L188）对齐。

**现状**（`options.ts:175-178`）：

```ts
function toggleHtml(checked: boolean, extraKey = ''): string {
  const attr = extraKey ? ` data-extra="${extraKey}"` : '';
  return `<label class="toggle"><input type="checkbox"${attr}${checked ? ' checked' : ''}><span class="track"></span><span class="thumb"></span></label>`;
}
```

3 调用点：L324 `row(t('optFullscreen'), toggleHtml(!!document.fullscreenElement, 'fullscreen')),`；L340 `row(t('optLegend'), toggleHtml(legendVisible, 'legend')) +`；L341 `row(t('optKeys'), toggleHtml(keysVisible, 'keys')) +`。

- [ ] **Step 1: 先写失败测试** — 扩 `options.test.ts` 两个既有 case：

display case（`it('display tab: schema defs + fullscreen extra')` 末尾追加）：

```ts
    // B-followup: legacy extras render as proper switches (match schema pattern)
    expect(extras[0].getAttribute('role')).toBe('switch');
    expect(extras[0].getAttribute('aria-checked')).toBe('false'); // headless: no fullscreenElement
    expect(extras[0].getAttribute('aria-label')).toBe(t('optFullscreen'));
```

game case（`it('game tab: schema defs + legend/keys extras')` 末尾追加）：

```ts
    // B-followup: legend/keys extras render as switches with labels
    for (const el of Array.from(extras)) {
      expect(el.getAttribute('role')).toBe('switch');
      expect(el.getAttribute('aria-checked')).not.toBeNull();
      expect(el.getAttribute('aria-label')).toBeTruthy();
    }
```

（`t` 若未 import 则补 `import { t } from '../i18n.js';`——按文件现有 import 风格；若 mock 了 i18n 则断言改用 mock 返回值。）

- [ ] **Step 2: 跑测确认红**

Run: `npx vitest run src/__tests__/options.test.ts 2>&1 | tail -6`
Expected: FAIL 2 处（`getAttribute('role')` 得 `null`）

- [ ] **Step 3: 最小实现**

```ts
function toggleHtml(checked: boolean, extraKey = '', label = ''): string {
  const attr = extraKey ? ` data-extra="${extraKey}"` : '';
  const aria = label ? ` aria-label="${label}"` : '';
  return `<label class="toggle"><input type="checkbox" role="switch" aria-checked="${checked}"${aria}${attr}${checked ? ' checked' : ''}><span class="track"></span><span class="thumb"></span></label>`;
}
```

3 调用点改：

```ts
    row(t('optFullscreen'), toggleHtml(!!document.fullscreenElement, 'fullscreen', t('optFullscreen'))),
```
```ts
    row(t('optLegend'), toggleHtml(legendVisible, 'legend', t('optLegend'))) +
    row(t('optKeys'), toggleHtml(keysVisible, 'keys', t('optKeys'))) +
```

（保持行尾 `,`/`+` 与现状一致。）

- [ ] **Step 4: 跑测确认绿**

Run: `npx vitest run src/__tests__/options.test.ts 2>&1 | tail -4 && npx tsc --noEmit; echo tsc=$?`
Expected: options.test 全 PASS；tsc=0

- [ ] **Step 5: Commit**

```bash
git add src/options.ts src/__tests__/options.test.ts
git commit -m "feat(a11y): legacy toggle extras render as role=switch with aria state/label"
```

---

### Task 3: M2 reduced-motion 降解 5 遗留站点

**Files:**
- Modify: `style/main.css:384-388`（既有 reduced-motion 块内追加 1 行；顺手核 L371-373 块头注释是否需补）

**Interfaces:**
- Consumes: 既有 `body.reduced-motion` 类（手动开关/系统偏好 → body class，`main.css:371`）
- Produces: 5 站点 `transition:none` 降级：`#opt-reset`（L219）、`.kb-rebind`（L241）、`.kb-reset`（L244）、`.hb-slot`（L297）、`.forge-tab`（L334）。

**范围裁定**：ledger 指名的 5 个 = settings 波次新引入/触碰的站点。其余 `transition:`（`.menu-btn`/`.ii`/`.close-btn`/`.sk-row`/`.evb`/`.mc-btn`/`.sb-btn`/`#keys-toggle`/`.talent-cell`/`.forge-upgrade`/`.fu-buy`/`.bar .fill` 等）是**更早的面板底色**，其中 `.bar .fill` 是血条宽度过渡、动 degradation 会改游戏读条手感 → 不在本批，留给 follow-up 记录（见 Self-review 尾注）。

- [ ] **Step 1: 加规则**（紧跟 L388 `body.reduced-motion .vol-slider::-webkit-slider-thumb{transition:none}` 之后，同风格无 `!important`）：

```css
body.reduced-motion #opt-reset,body.reduced-motion .kb-rebind,body.reduced-motion .kb-reset,body.reduced-motion .hb-slot,body.reduced-motion .forge-tab{transition:none}
```

- [ ] **Step 2: 核块头注释**（L371-373 若枚举了覆盖面则补这 5 个；只写泛述就不动）

- [ ] **Step 3: 验证**

Run: `grep -c "body.reduced-motion #opt-reset" style/main.css && npm run build 2>&1 | tail -2`
Expected: `1`；build ✓ built（CSS 语法错误会让 vite build 报错）

- [ ] **Step 4: Commit**

```bash
git add style/main.css
git commit -m "feat(a11y): reduced-motion degrades 5 leftover transition sites (opt-reset/kb-rebind/kb-reset/hb-slot/forge-tab)"
```

---

### Task 4: smoke 恒 True 清理×3 + aria 强化 + 补 2 截图

**Files:**
- Modify: `scripts/smoke_settings_core.py`（L456-458 / L470-472 / L541-558 / L109 / L130 / MATRIX 尾部）

**Interfaces:**
- Consumes: Task 2 的 role=switch（aria 断言）；既有 helpers `check/click_tab/open_options/overlay_active`（L25/50 附近，`open_options` 在 L483 有用例）。
- Produces: 59 check 全过、exit 0；`scripts/smoke_out/surface-hc-cb-hud.png` + `surface-ts15-hud.png`。

- [ ] **Step 1: 删 ev_ok 假断言**（L456-458，`ev_ok = page.evaluate(...)` 到 `check('S5', 'dynamic event modal (boot import ok)', ev_ok)` 共 4 行整段删——boot 期 import 失败已由 console/pageerror 全局门覆盖，此 check 无信息量）

- [ ] **Step 2: L470-472 恒 True 改真**（序列：'b' 开背包 → Escape 关 → 'i' 再开）：

```python
        page.keyboard.press('i')
        page.wait_for_timeout(250)
        i_inv = overlay_active(page, 'inventory-overlay')
        check('S5', "'i' opens inventory (b-closed state, guard path)", i_inv)
```

- [ ] **Step 3: L541-558 event-popup 假断言改真**（合成弹窗后、隐藏前取真实可见性；`placed` 为 False 时兜底）：

```python
        popup_ok = False
        placed = page.evaluate(...)
        if placed:
            page.wait_for_timeout(200)
            popup_ok = page.evaluate("() => document.getElementById('event-popup').style.display === 'block' && document.getElementById('ev-title').textContent !== ''")
            page.screenshot(path=f'{OUT}/radius-event-popup.png')
            page.evaluate("() => { document.getElementById('event-popup').style.display = 'none'; }")
        check('MATRIX', '#event-popup synthesized popup visible for shot', popup_ok)
```

- [ ] **Step 4: L109/L130 补 aria 真断言**（各在既有 check 后追加）：

display（fullscreen，headless 无全屏 → aria-checked="false"）：

```python
        fs_switch = page.eval_on_selector('#opt-body [data-extra="fullscreen"]',
            'el => el.getAttribute("role") === "switch" && el.getAttribute("aria-checked") === "false" && !!el.getAttribute("aria-label")')
        check('S1', 'fullscreen extra = switch with aria state/label', fs_switch)
```

game（legend/keys）：

```python
        lk_switch = page.eval_on_selector_all('#opt-body [data-extra="legend"], #opt-body [data-extra="keys"]',
            'els => els.length === 2 && els.every(e => e.getAttribute("role") === "switch" && !!e.getAttribute("aria-label"))')
        check('S1', 'legend/keys extras = switches with aria labels', lk_switch)
```

- [ ] **Step 5: MATRIX 尾部（forge 段之后、收尾循环之前）补 2 截图段**：

```python
        # --- E. hc × colorblind composite HUD view (follow-up screenshot 1/2) ---
        click_tab(page, 'access')
        page.evaluate("() => document.querySelector('[data-optkey=\"hc\"]').click()")          # hc on
        page.evaluate("() => document.querySelector('[data-optkey=\"colorblind\"]').click()")  # cb on
        page.wait_for_timeout(250)
        page.keyboard.press('Escape')   # close options → HUD view
        page.wait_for_timeout(250)
        page.screenshot(path=f'{OUT}/surface-hc-cb-hud.png')
        open_options(page); click_tab(page, 'access')
        page.evaluate("() => document.querySelector('[data-optkey=\"colorblind\"]').click()")  # cb off
        page.evaluate("() => document.querySelector('[data-optkey=\"hc\"]').click()")          # hc off
        page.wait_for_timeout(150)

        # --- F. textScale 1.5 HUD overflow doc (follow-up screenshot 2/2) ---
        click_tab(page, 'display')
        page.evaluate("() => { const el = document.querySelector('[data-optkey=\"textScale\"]'); el.value = 1.5; el.dispatchEvent(new Event('input', {bubbles:true})); }")
        page.wait_for_timeout(250)
        page.keyboard.press('Escape')
        page.wait_for_timeout(250)
        page.screenshot(path=f'{OUT}/surface-ts15-hud.png')
        hud_ok = page.evaluate("() => document.getElementById('hotbar').getBoundingClientRect().right <= window.innerWidth + 1")
        check('MATRIX', 'textScale 1.5 — hotbar stays within viewport', hud_ok)
        open_options(page); click_tab(page, 'display')
        page.evaluate("() => { const el = document.querySelector('[data-optkey=\"textScale\"]'); el.value = 1; el.dispatchEvent(new Event('input', {bubbles:true})); }")
        page.keyboard.press('Escape')
        page.wait_for_timeout(150)
```

**前置自检（写码前 3 个 grep）**：① `[data-optkey="colorblind"]` 存在于 access tab（`grep -n "colorblind" src/settings.ts`，SETTING_DEFS tab 字段须是 `access`）；② `textScale` 在 display tab（已核：`settings.ts:166 tab:'display'` ✓）；③ `open_options` 确为函数名（`grep -n "def open_options" scripts/smoke_settings_core.py`）。任一不符 → 按实际改选择器，**不改 app 代码去凑脚本**。

- [ ] **Step 6: 起 preview + 全量 smoke**

```bash
npm run build && (npm run preview -- --port 4173 &> /tmp/preview.log &) && sleep 3 && curl -s -o /dev/null -w "%{http_code}" http://localhost:4173
python scripts/smoke_settings_core.py; echo exit=$?
```

Expected: `200`；末尾 `Total 59 checks, 0 failed`、`Console errors: 0`、**exit=0**

- [ ] **Step 7: 产物核验**

```bash
ls -la scripts/smoke_out/surface-hc-cb-hud.png scripts/smoke_out/surface-ts15-hud.png
```
Expected: 两文件存在且非 0 字节；顺手 `Read` 两张 png 目检（hc×cb 面板对比度叠加生效 / ts1.5 下 hotbar 不溢出）

- [ ] **Step 8: 收尾验证 + commit**

```bash
npx tsc --noEmit; echo tsc=$?; npx vitest run 2>&1 | tail -4
git add scripts/smoke_settings_core.py
git commit -m "test(smoke): real assertions for 3 constant-True checks + aria checks + hc×cb/ts1.5 HUD shots"
```

Expected: tsc=0；vitest 全绿（332 基线 + Task 2 增量）

---

### Task 5: 终验（verification-before-completion）

- [ ] 全量四门：`npx tsc --noEmit`=0 / `npx vitest run` 全绿 / `npm run build`=0 / smoke `exit=0` 59/59
- [ ] 截图 2 张目检通过
- [ ] `git log --oneline main..feat/settings-followups` = 4 commits
- [ ] 汇报 + 等用户裁决 merge（finishing-a-development-branch）

## Self-Review

**覆盖核对**：ledger 4 项 → favicon（T1）/ aria 3 站点（T2）/ M2 5 站点（T3）/ 恒True×3 + 2 截图（T4）。第 5 条「连续方向键 UX」按 ledger 明确不在本批（会动 B-core 测试锁定行为，独立 ticket）。✓
**占位符扫描**：无 TBD/类似 Task N；所有代码块含实码。✓
**类型一致**：`toggleHtml(checked, extraKey, label)` 三参在 T2 定义与调用点一致；smoke helpers 名以 grep 为准（Step 5 前置自检兜底）。✓
**范围外记录（不在本批）**：`.menu-btn/.evb/.mc-btn/.sb-btn/#keys-toggle/.talent-cell/.forge-upgrade/.fu-buy/.ii/.close-btn/.sk-row/.bar .fill` 等 pre-existing transition 未降级——`.bar .fill` 涉血条读条手感，需单独裁决。
