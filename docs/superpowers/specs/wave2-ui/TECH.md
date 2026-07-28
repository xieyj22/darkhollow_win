# Wave 2 UI 打磨:左边栏减拥挤 + 多断点 responsive

技术规格。对应 `darkhollow`(TS+Canvas2D+Vite+Electron 的 ASCII roguelike)。产品意图以 brainstorming 口头获批为准(方案 A)。本规格是 Wave 2 实现与验收的唯一对照基准。

提交基准:`f5aaf49`(Wave 1 merge 后的 `main` HEAD)。代码引用 pin 到此 commit。

---

## Context

游戏内 HUD:左 `#sidebar`(角色信息)+ 右 `#right-panel`(map / hotbar / log)。用户反馈:**sidebar 拥挤 + 窗口缩放时不能自适应**。

- [`#sidebar` (style/main.css L78) @ f5aaf49](https://github.com/xieyj22/darkhollow_win/blob/f5aaf49/style/main.css#L78) —— 固定 `width:260px; min-width:260px`。
- [`@media(max-width:768px/600px)` (main.css L269-272) @ f5aaf49](https://github.com/xieyj22/darkhollow_win/blob/f5aaf49/style/main.css#L269-L272) —— 仅 `≤768→180`、`≤600→隐藏` 两个粗断点。窗口在 600–1900px 之间时 sidebar 恒 260px,窗口缩小时占比变大 → 显挤。
- [sidebar 结构 (index.html L24-64) @ f5aaf49](https://github.com/xieyj22/darkhollow_win/blob/f5aaf49/index.html#L24-L64) —— 内容密集:`Hero`(h3)+ 4 条 bar + `Stats`(h3)+ 6 项 + `Equipment`(h3)+ 4 行 + `Effects`(h3)+ buffs + `Legend`(h3,可折叠)+ `Objective`(h3)+ footer。
- canvas 自适应([`resizeCanvas` main.ts L540-544](https://github.com/xieyj22/darkhollow_win/blob/f5aaf49/src/main.ts#L540-L544)),但 sidebar 不自适应。
- Legend 已有折叠机制可仿照:[`toggleLegend` (main.ts L290-298) @ f5aaf49](https://github.com/xieyj22/darkhollow_win/blob/f5aaf49/src/main.ts#L290-L298) + [`#sb-legend` (index.html L48)](https://github.com/xieyj22/darkhollow_win/blob/f5aaf49/index.html#L48)。

---

## 目标与范围(Wave 2)

- **范围**:左边栏为主(hotbar/log/minimap 仅顺带微调)。
- **减拥挤**(四管齐下):合并分段 + 默认折叠次要面板 + 降密度加留白 + 重排分组。
- **自适应**:多断点 responsive(480 / 720 / 1024 / 1440)。
- **参考**:DCSS 紧凑表格 + STS 分区清晰 + Cogmind 密度控制 + ToME 侧栏布局。
- **不动**:canvas/render 逻辑、gameplay、Wave 1 的 tile 补间。

---

## Proposed changes

### A. 分段合并(`index.html` + `main.css`)

- **Hero + Stats 合为「角色」区**:删除 Stats 的 h3;ATK/DEF/Gold/Floor 压成 inline 紧凑行(新 `.stat-inline`);Turns/Combo 小字一行。改 [index.html L34-40](https://github.com/xieyj22/darkhollow_win/blob/f5aaf49/index.html#L34-L40)(Stats 段)合并进 Hero 段。
- **Equipment 紧凑 grid**:[index.html L42-45](https://github.com/xieyj22/darkhollow_win/blob/f5aaf49/index.html#L42-L45) 从 4 个 `<div class="eq">` 改为 2 行 × 2 列 grid(新 `.eq-grid`,label:inline)。纵向 4 行 → 2 行。
- 新增 CSS:`.stat-inline`(inline 紧凑数值行)、`.eq-grid`(2 列 grid)。

### B. Objective 折叠(仿 Legend 机制)

- **HTML**:[index.html L50-51](https://github.com/xieyj22/darkhollow_win/blob/f5aaf49/index.html#L50-L51) 加 toggle 头(结构对齐 `#sb-legend` L48),`#objective-panel` 默认折叠;折叠时常驻一行 `F{floor}/40` + 进度条。
- **`main.ts`**:新增 `toggleObjective()`,抄 [`toggleLegend` (L290-298)](https://github.com/xieyj22/darkhollow_win/blob/f5aaf49/src/main.ts#L290-L298) 模式;在 `bindButtons` 绑定 `#sb-obj` click。
- **i18n**:折叠用 `▸/▼` 箭头(与 Legend 一致),无新文案。
- 折叠状态走 session(不持久化,与 Legend 一致)。

### C. 四断点 responsive(替换 `main.css` L269-272 粗断点)

`#sidebar` 从 `width:260; min-width:260` 改为**断点驱动**(用 CSS 变量 `--sidebar-w` + media query 覆盖,或直接在每个 media query 设 `width`/`min-width`):

| 窗口宽度 | sidebar 宽 | base 字号 | 备注 |
|----------|-----------|----------|------|
| ≤480px | 170px | 12px(`--fs-floor`) | 超紧凑,Equipment 用缩写 |
| 481–720 | 200px | 13px | 紧凑 |
| 721–1024 | 230px | 13px | 标准 |
| 1025–1440 | 250px | 13px | 标准(Electron 常见档) |
| ≥1441 | 280px | 14px(`--fs-base`) | 宽松,留白+ |

**保留** `≤600px 隐藏 sidebar + 显示触屏控制` 的现有逻辑([L271](https://github.com/xieyj22/darkhollow_win/blob/f5aaf49/style/main.css#L271))。

### D. 降密度 token(`main.css`,加留白、字号不动)

- `.sr` padding:`2px 0` → `3px 0`([L80](https://github.com/xieyj22/darkhollow_win/blob/f5aaf49/style/main.css#L80))
- `.bar` margin:`3px 0 4px 0` → `4px 0 5px 0`([L84](https://github.com/xieyj22/darkhollow_win/blob/f5aaf49/style/main.css#L84))
- `#sidebar h3` margin:`8px 0 4px 0` → `10px 0 5px 0`([L79](https://github.com/xieyj22/darkhollow_win/blob/f5aaf49/style/main.css#L79))
- `#sidebar` padding:`8px` → `10px`([L78](https://github.com/xieyj22/darkhollow_win/blob/f5aaf49/style/main.css#L78))

---

## Testing and validation

- `npm run typecheck` + `npm run build` 必过。
- 手动 QA:拖拽 Electron 窗口(或 `npm run dev` 浏览器)跨越各断点(480 / 720 / 1024 / 1440),sidebar 宽度 / 字号 / grid 自适应;折叠/展开 Objective 与 Legend;拥挤主观改善;`≤600px` sidebar 隐藏 + 触屏控制正常;中英 i18n 正常。
- 无单测(项目有意不引入);实现时用 darkhollow 自带 `ui-ux-pro-max` skill 辅助样式。

---

## Parallelization

UI 改动**紧耦合**(`index.html` 结构 + `main.css` 样式 + `main.ts` 折叠 + `i18n` 都围绕同一 sidebar),不适合并行 implementer(会冲突)。单 implementer 顺序完成 A → B → C → D,最后统一手动 QA。

---

## Risks and mitigations

- **断点边界**:Electron 窗口可能有最小宽度限制,`≤480px` 档在 exe 里触发不了。mitigation:QA 时用 `npm run dev` 浏览器拖窗口覆盖全断点。
- **折叠一致性**:`toggleObjective` 严格抄 `toggleLegend` 模式,避免引入新机制导致行为分叉。
- **i18n**:折叠交互用箭头,无新文案,中英都不会破。

---

## Follow-ups

- hotbar / log-panel / minimap 的响应式微调(本 Wave 顺带;若要深做另立)。
- 敌人补间(评估)、程序化美术升级(`sprites.ts`)、内容扩展(新敌人/圣物/meta + 平衡 → 新生物群系/新机制)、Steamworks 真激活(待 AppID)。
