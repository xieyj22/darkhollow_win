# darkhollow Wave 2 UI 打磨 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 实现样式时可辅以项目自带 `ui-ux-pro-max` skill。

**Goal:** 给 darkhollow 左边栏减拥挤(合并分段 + 折叠次要 + 降密度 + 重排)并改为多断点 responsive 自适应。

**Architecture:** 单次 sidebar 改版:`index.html` 结构(Stats 合并进 Hero、Equipment 紧凑 grid、Objective 加 toggle 头 + 常驻 summary)+ `main.css`(四断点驱动宽度/字号 + 紧凑样式 + 降密度 token)+ `main.ts`(`toggleObjective` 仿 `toggleLegend`、`updateLangUI` 适配)+ `render.ts`(`renderObjective` 拆 summary/panel)。紧耦合,单 implementer 顺序完成。

**Tech Stack:** TypeScript 5.7 + Vite 6 + Canvas2D + 纯 CSS(无 UI 框架)。

## Global Constraints

- **无自动化测试框架**(不引入);验证 = `npm run typecheck` + `npm run build` + 手动 QA。
- **不动**:canvas/`render()` 主循环、gameplay、Wave 1 tile 补间、Steam 桥接。`render.ts` **只**改 `renderObjective`,不碰 `render()`。
- **紧耦合 → 单 implementer 顺序**做 A→B→C→D,**不并行**(多个改动命中同一批文件)。
- 断点宽度/字号、降密度 padding/margin 值——逐字按 `docs/superpowers/specs/wave2-ui/TECH.md`。
- 提交基准:`e55ace2`(spec HEAD)。代码引用可 pin 此 commit。
- i18n 中英双语都要正常(折叠交互用 `▸/▼` 箭头,不引入新文案键)。

---

## File Structure

| 文件 | 动作 | 责任 |
|------|------|------|
| `index.html` | Modify | sidebar 结构:Stats 合并进 Hero、Equipment `.eq-grid`、Objective toggle 头 + `#objective-summary` |
| `style/main.css` | Modify | 四断点 width/字号、`.stat-inline`/`.eq-grid`、降密度 token、保留 ≤600 隐藏 |
| `src/main.ts` | Modify | `toggleObjective()` + `bindButtons` 绑定 + `updateLangUI` 用 `#obj-label` |
| `src/render.ts` | Modify | `renderObjective()` 拆常驻 summary + 详情 panel |

---

## Task 1: sidebar 改版(合并 + 折叠 + 四断点 + 降密度)

**Files:** `index.html`、`style/main.css`、`src/main.ts`、`src/render.ts`

**Interfaces:** 无跨 task 接口(单 task)。内部新增 DOM id:`#objective-summary`、`#obj-arrow`、`#obj-label`、class `.stat-inline`、`.eq-grid`。

- [ ] **Step A1:`index.html` Stats 段合并进 Hero(删一个 h3)**

把 [index.html L34-40](https://github.com/xieyj22/darkhollow_win/blob/e55ace2/index.html#L34-L40)(`<h3 id="sb-stat">` + 6 个 `.sr`)替换为(保留所有 `s-*` id,`updateUI` 仍引用):
```html
<div class="stat-inline">
  <span><span class="sl">ATK</span> <span class="sv atk" id="s-atk">5</span></span>
  <span><span class="sl">DEF</span> <span class="sv def" id="s-def">2</span></span>
  <span><span class="sl" id="sb-gl">Gold</span> <span class="sv gold" id="s-gold">0</span></span>
  <span><span class="sl" id="sb-fl">Floor</span> <span class="sv" id="s-floor">1</span></span>
</div>
<div class="stat-inline minor">
  <span><span class="sl" id="sb-tl">Turns</span> <span class="sv" id="s-turns">0</span></span>
  <span><span class="sl" id="sb-co">Combo</span> <span class="sv gold" id="s-combo">0</span></span>
</div>
```
（删掉 `<h3 id="sb-stat">📊 Stats</h3>`。)

- [ ] **Step A2:`index.html` Equipment 改紧凑 grid**

把 [L42-45](https://github.com/xieyj22/darkhollow_win/blob/e55ace2/index.html#L42-L45) 4 个 `<div class="eq">` 包进 `.eq-grid`:
```html
<div class="eq-grid">
  <div class="eq"><span id="sb-wp">Weapon</span>: <span class="in" id="eq-weapon">-</span></div>
  <div class="eq"><span id="sb-ar">Armor</span>: <span class="in" id="eq-armor">-</span></div>
  <div class="eq"><span id="sb-ac">Accessory</span>: <span class="in" id="eq-accessory">-</span></div>
  <div class="eq"><span id="sb-ac2">Accessory</span>2: <span class="in" id="eq-accessory2">-</span></div>
</div>
```

- [ ] **Step A3:`style/main.css` 新增紧凑样式**

在 `.eq` 规则([L94](https://github.com/xieyj22/darkhollow_win/blob/e55ace2/style/main.css#L94))附近加:
```css
.stat-inline{display:flex;flex-wrap:wrap;gap:2px 10px;padding:2px 0}
.stat-inline.minor{font-size:var(--fs-floor);color:var(--text-muted)}
.stat-inline .sl{color:var(--text-secondary)}
.eq-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;padding:2px 0}
.eq-grid .eq{padding:1px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
```

- [ ] **Step B1:`index.html` Objective 加 toggle 头 + 常驻 summary**

把 [L50-51](https://github.com/xieyj22/darkhollow_win/blob/e55ace2/index.html#L50-L51) 替换为:
```html
<h3 id="sb-obj" style="cursor:pointer">🎯 <span id="obj-arrow">▸</span> <span id="obj-label">Objective</span></h3>
<div id="objective-summary"></div>
<div id="objective-panel" style="display:none"></div>
```

- [ ] **Step B2:`src/render.ts` `renderObjective` 拆 summary + panel**

把 [`renderObjective` (L401-415)](https://github.com/xieyj22/darkhollow_win/blob/e55ace2/src/render.ts#L401-L415) 改为:在写 `#objective-panel`(详情,保留现状 innerHTML)之前,先写常驻 `#objective-summary`:
```ts
function renderObjective(): void {
  if (!G) return;
  const zh = lang === 'zh';
  const fl = G.floor;
  const totalBosses = 8;
  const nextBoss = Math.ceil(fl / 5) * 5;
  const bossesKilled = Math.floor((fl - 1) / 5);
  // 常驻 summary(始终显示一行进度)
  const sum = document.getElementById('objective-summary');
  if (sum) sum.innerHTML =
    `<div class="obj-row"><span class="ol">${zh ? '层' : 'F'}</span><span class="ov">${fl}/${FINAL}</span></div>` +
    `<div class="obj-bar"><div class="fill" style="width:${(fl / FINAL) * 100}%"></div></div>`;
  // 详情 panel(默认折叠)
  const panel = document.getElementById('objective-panel')!;
  panel.innerHTML =
    `<div class="obj-row"><span class="ol">${zh ? '目标' : 'Goal'}</span><span class="ov">${zh ? '击败创世者(第40层)' : 'Beat The Creator (F40)'}</span></div>` +
    `<div class="obj-row"><span class="ol">${zh ? '下个Boss' : 'Next Boss'}</span><span class="ov${fl === nextBoss && fl % 5 === 0 ? ' boss' : ''}">${zh ? '第' : 'F'} ${nextBoss}${fl === nextBoss && fl % 5 === 0 ? (zh ? ' ⚠ 当前层！' : ' ⚠ HERE!') : ''}</span></div>` +
    `<div class="obj-row"><span class="ol">${zh ? 'Boss击杀' : 'Bosses'}</span><span class="ov${bossesKilled >= totalBosses ? ' done' : ''}">${bossesKilled}/${totalBosses}</span></div>`;
}
```

- [ ] **Step B3:`src/main.ts` 加 `toggleObjective` + 绑定**

在 [`toggleLegend` (L290-298)](https://github.com/xieyj22/darkhollow_win/blob/e55ace2/src/main.ts#L290-L298) 之后加(抄其模式):
```ts
export function toggleObjective(): void {
  const panel = document.getElementById('objective-panel')!;
  const arrow = document.getElementById('obj-arrow')!;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  arrow.textContent = open ? '▸' : '▼';
}
```
在 `bindButtons` 里([L500](https://github.com/xieyj22/darkhollow_win/blob/e55ace2/src/main.ts#L500) `$('sb-legend')` 那行附近)加:
```ts
document.getElementById('sb-obj')!.addEventListener('click', toggleObjective);
```

- [ ] **Step B4:`src/main.ts` `updateLangUI` 用 `#obj-label`**

把 [L193](https://github.com/xieyj22/darkhollow_win/blob/e55ace2/src/main.ts#L193) `$('sb-obj')!.textContent = '🎯 ' + (zh ? '游戏目标' : 'Objective');` 改为(避免覆盖箭头 span):
```ts
$('obj-label')!.textContent = zh ? '游戏目标' : 'Objective';
```
同时删掉 [L177](https://github.com/xieyj22/darkhollow_win/blob/e55ace2/src/main.ts#L177) `$('sb-stat')!.textContent = '📊 ' + t('stats');`(sb-stat h3 已删);若 `t('stats')` 无他用则留 i18n 键不删。

- [ ] **Step C:`style/main.css` 四断点 responsive(替换 L269-272)**

把 [`@media(max-width:768px)` 与 `@media(max-width:600px)` (L270-271)](https://github.com/xieyj22/darkhollow_win/blob/e55ace2/style/main.css#L270-L271) 的 sidebar 行拆为五档(保留 `≤600` 的 `display:none` + `#touch-controls`):
```css
/* ===== Responsive (sidebar 多断点) ===== */
@media(max-width:480px){#sidebar{width:170px;min-width:170px;font-size:var(--fs-floor);padding:6px}}
@media(min-width:481px) and (max-width:720px){#sidebar{width:200px;min-width:200px;font-size:var(--fs-sm)}}
@media(min-width:721px) and (max-width:1024px){#sidebar{width:230px;min-width:230px}}
@media(min-width:1025px) and (max-width:1440px){#sidebar{width:250px;min-width:250px}}
@media(min-width:1441px){#sidebar{width:280px;min-width:280px;font-size:var(--fs-base)}}
@media(max-width:600px){#sidebar{display:none}#touch-controls{display:block}#log-panel{height:60px;min-height:60px}}
@media(pointer:coarse){#touch-controls{display:block}}
```
（原 768 档里对 `.bar`/`#log-panel`/`#hotbar`/`.hb-slot` 的微调,合并进 480 档或保留——以现有 L270 内容为准迁移,不丢。）

- [ ] **Step D:`style/main.css` 降密度 token**

按 spec 逐字改:
- [L80](https://github.com/xieyj22/darkhollow_win/blob/e55ace2/style/main.css#L80) `.sr{...padding:2px 0...}` → `padding:3px 0`
- [L84](https://github.com/xieyj22/darkhollow_win/blob/e55ace2/style/main.css#L84) `.bar{...margin:3px 0 4px 0...}` → `margin:4px 0 5px 0`
- [L79](https://github.com/xieyj22/darkhollow_win/blob/e55ace2/style/main.css#L79) `#sidebar h3{...margin:8px 0 4px 0...}` → `margin:10px 0 5px 0`
- [L78](https://github.com/xieyj22/darkhollow_win/blob/e55ace2/style/main.css#L78) `#sidebar{...padding:8px...}` → `padding:10px`

- [ ] **Step E1:typecheck + build**

Run: `npm run typecheck` → 必须无错(尤其 `sb-stat` 删除后 `updateLangUI` 不再引用它)。
Run: `npm run build` → `tsc && vite build` 成功。

- [ ] **Step E2:手动 QA(各断点 + 折叠 + 拥挤 + i18n)**

Run: `npm run dev`,浏览器拖窗口宽度跨越 480/720/1024/1440 各档,逐项确认:
- sidebar 宽度/字号随档位变;窄档不溢出、不破布局。
- Stats 已并入 Hero(无独立 h3)、Equipment 是 2 列 grid。
- Objective 头 `▸` 点击展开/`▼` 收起;折叠时常驻 summary(F X/40 + 进度条)显示。
- Legend 折叠仍正常。
- 拥挤主观改善(纵向变短、留白增加)。
- `≤600px` sidebar 隐藏 + 触屏控制出现。
- L 切中英:Objective 标签、summary/panel 文案都正常,箭头不丢。

- [ ] **Step E3:Commit**

```bash
git add index.html style/main.css src/main.ts src/render.ts
git commit -m "feat(ui): sidebar 减拥挤(合并/折叠/降密度)+ 四断点 responsive"
```

---

## Self-Review

- **Spec coverage**:分段合并(A1-3)✓、Objective 折叠(B1-4)✓、四断点(C)✓、降密度(D)✓、手动 QA(E2)✓。TECH.md 的 Proposed A/B/C/D 与验证全覆盖。
- **Placeholder scan**:每步含实际 HTML/CSS/TS 代码与命令;`≤768` 档的 `.bar`/`#hotbar` 微调迁移以现有 L270 为准(标注不丢)。
- **Type consistency**:新增 id/class(`#objective-summary`/`#obj-arrow`/`#obj-label`/`.stat-inline`/`.eq-grid`)在 B1 定义、B2/B3/B4 与 A3 引用,名字一致;`toggleObjective` 抄 `toggleLegend` 模式签名一致。
- **YAGNI**:不改 canvas/gameplay/补间;不引入测试框架;不并行(紧耦合)。
