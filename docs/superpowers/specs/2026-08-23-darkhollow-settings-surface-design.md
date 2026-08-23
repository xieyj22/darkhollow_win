# Settings B-表层：Options 面板视觉精修 + 无障碍增强 — 设计规格

**日期**: 2026-08-23
**状态**: Approved (brainstorming 定稿)
**前置**: B-核心（feat/settings-core，已 ff-merge main `962ee29..09f3940`，322 测）
**范围**: `feat/settings-surface` 分支；方案 A = 纯 CSS/令牌层精修 + 无障碍两项 + ARIA/键盘 + 同套控件皮肤同步。

**用户四决策**（2026-08-23 brainstorming 锁定）：
1. 视觉档位 = **系统化精修**（不换设计语言，暗色+血红体系内做精致）
2. 无障碍 = **预告两项 + ARIA/键盘**（文字大小连续调节 + 高对比模式 + aria 角色补齐 + tab 方向键）
3. 波及面 = **options + 同套控件同步**（.toggle/.seg 皮肤全局生效，其他面板零 HTML 改动）
4. overlay 数字键改键 = **不做**（维持 B-核心裁决：语义耦合，YAGNI）

---

## 1. 视觉精修规范（CSS 层，渲染结构不动）

### 1.1 设计令牌（`:root` 新增）

| 令牌 | 值 | 用途 |
|---|---|---|
| `--opt-gap` | `14px` | opt-row 统一行距节奏 |
| `--radius-lg` | `10px` | 面板内大圆角（tab 条容器） |
| `--hover-bg` | `#ffffff08` | 行/项 hover 反馈 |

所有动效遵守现有 reducedMotion 体系：动效全部提供静态降级（transition 写在 reduced-motion media query 外时须在 `body.reduce-motion` 下显式归零）。

### 1.2 Tab 条（`.opt-tabs` / `.opt-tab`）

- 每个 tab 加 emoji 图标前缀：🔊 Audio / 🖥 Display / ♿ Accessibility / ⚔ Gameplay / ⌨ Keybinds（i18n `optTabAudio` 等 label 不动，图标在 `renderOptions` 拼 HTML 时前置；与 title 屏 menu-btn emoji 惯例一致，零新资源）
- active 指示从"整块边框盒子"改为**下划线滑条**：`.opt-tab::after` 红色 2px 下划线，active 时展开（scaleX 0→1 过渡 150ms）
- hover：文字变亮（`--text-bright`），不下划线（区别于 active）
- tab 容器底部 1px 边框保留作下划线轨道

### 1.3 行与控件

- **`.opt-row`**：hover 时整行背景 `--hover-bg`；行间距统一 `--opt-gap`（替换现在 margin:10px 0）
- **toggle**：轨道加 inset 阴影质感；checked 态轨道 `#e6394633`→血红边+微光（对齐 capturing 按钮的 glow 语义）；thumb 过渡 cubic-bezier(.4,0,.2,1.4) 轻弹
- **seg**：按钮间分隔线 `--border-subtle`（减淡）；active 态 `background:#e6394622` 保留 + 加 `box-shadow: inset 0 0 0 1px #e6394655` 内亮边；44px 触控目标不变
- **slider**：`accent-color` 保留为降级；主路径自定义 `::-webkit-slider-thumb`（14px 血红圆点，hover 发光 `box-shadow:0 0 8px #e6394688`）+ `::-webkit-slider-runnable-track`（细轨道 4px）；Firefox `::-moz-range-thumb` 同款
- **keybinds tab**：
  - `.kb-group` 前加分组小标题行：`🎮 Gameplay` / `1️⃣ Quick Slots` / `⚙ Meta`（新增 i18n key `kb.grpGameplay`/`kb.grpQuick`/`kb.grpMeta`，双语）
  - `.kb-key` 键帽化：底边 3px 厚边（`border-bottom:3px solid`）+ 轻微上亮下暗渐变，模拟机械键帽；KB/GP 双源显示格式不变
  - `.kb-rebind` capturing 态保留现有金色 glow（已有）

### 1.4 同套控件同步（被动生效）

`.toggle`/`.seg`/`.vol-slider` 是全局类——forge 的 tab、records/codex 内的 seg/toggle 自动继承新皮肤。**不改任何其他面板的 HTML/TS**。`.forge-tab` 是独立类不动（避免波及）。

### 1.5 明确不做

- 不动 `settings.ts` schema 结构与 `options.ts` 渲染函数骨架（row/control HTML 拼接保持）
- 不动 keybinds 27 行列表结构（搜索/折叠留 follow-up）
- 不做毛玻璃/侧边栏导航/面板头部描述区（方案 B 特性，YAGNI）
- overlay 数字键改键（用户裁决不做）

---

## 2. 无障碍增强

### 2.1 文字大小连续调节

- `settings.ts` `textScale` def：`control: 'seg'`（3 档）→ `control: 'slider'`，`min:0.85 / max:1.5 / step:0.05`，`toDisplay: v => \`${Math.round(v*100)}%\``
- `state.ts:90` clamp 上限 `1.2` → `1.5`（否则 slider 拉过 1.2 被静默截断）
- 老档兼容：`dh_text_scale` 存值语义不变，直接生效
- `tsSmall/tsMedium/tsLarge` 三个 i18n key：引用站点仅 settings.ts 的 textScale options（i18n.ts:178-180 定义）——seg→slider 后引用消失，**key 本体一并删除**（已 grep 确认无其他引用）；三个 mock（settings/options/keybinds.test 的 `textScale:1` mock 行）不需动（mock 的是 state source 非 i18n）

### 2.2 高对比模式（新 setting `hc`）

- `SETTING_DEFS` 新增：`{ key:'hc', tab:'access', labelKey:'optHc', descKey:'opt.hcDesc', control:'toggle', default:false }`
- `state.ts` 加 source：`hc: boolean`（`dh_hc` 持久化，false 默认）+ setter；apply 走 `settings.ts` 既有 body-class 模式（对齐 settings.ts:109-113 的 cb-*/bar-cues：`applyAll` 内 `document.body.classList.toggle('hc', hc)`）
- CSS `body.hc` 覆盖：
  - `--text-secondary` / `--text-muted` 提亮（≥ #b8b8cc / #999）
  - `--border-default` / `--border-subtle` 加亮一档
  - `.panel` 背景渐变换纯色 `#141420`（去渐变对比损耗）
  - 半透明背景类（`#0f0f1aee` 等 keys-panel/legend）`body.hc` 下加实为不透明
  - 色弱滤镜（body.cb-*）与 hc 可叠加（filter 与 color 覆盖不冲突，现有机制 A 注释已说明可组合）
- 自动获得：schema 渲染 / 持久化 / reset-defaults / desc 行——零额外接线

### 2.3 ARIA / 键盘

- **tablist**：`.opt-tab` 补 `role="tab"`（tablist 已有）+ `aria-selected`（随 active）+ `aria-controls="opt-body"`；`.opt-body` 加 `role="tabpanel"` + `tabindex="0"`
- **方向键切 tab**：tablist 内 ←/→ 移动 focus 到相邻 tab 并激活（keydown 在 tabs 容器上，preventDefault + stopPropagation）。**注意**：方向键在 DEFAULT_KEYS 绑定 move_*（arrowleft 等），options overlay 的 keydown 块会 swallow 一切非 overlay_close 键（input.ts:79-84），所以 tablist 方向键 handler 必须挂容器级且在事件冒泡到 document 前消费（或用捕获阶段）；与 overlay_close 改键无冲突
- **toggle**：input 加 `role="switch"` + `aria-checked`（checked 同步）+ `aria-label`（行 label 文本，渲染时传入）
- **slider**：加 `aria-valuetext`（复用 toDisplay 输出，如 "90%"）；range 原生方向键 step 已有，验证不新写
- **seg**：加 `role="radiogroup"`（容器）+ `role="radio"` + `aria-checked`（button 天生可 tab，键盘语义够用）

### 2.4 i18n 新 key（前缀 `opt.`/`kb.`，双语）

`optHc` / `opt.hcDesc` / `kb.grpGameplay` / `kb.grpQuick` / `kb.grpMeta`（5 个新 key，en/zh）

---

## 3. 测试与验证

### 3.1 单测（vitest，322 → 预计 ~340）

- `settings.test.ts` 扩：textScale slider def 参数（min/max/step/control 类型断言）+ hc def 存在性（tab/control/default）+ resetDefaults 覆盖 hc
- `options.test.ts` 扩：renderOptions 后 tab 有 role/aria-selected、toggle 有 role=switch、seg 容器 role=radiogroup
- 现有 322 测全绿红线（尤其 input.test 12 overlay 块——本特性不碰 input.ts）

### 3.2 冒烟（playwright，复用 `scripts/smoke_settings_core.py`）

- 现有 48 项复跑：textScale 相关断言（display tab 行数/控件类型）从 seg 改 slider 后同步更新；其余不变
- 新增：hc toggle 持久化（dh_hc）+ body.hc class 生效；tab 方向键切换；aria 抽查（tablist/tab/switch/radiogroup 各 1）；textScale slider 拉到 1.5 后 html `--fs-scale=1.5` 且 localStorage 同步
- 回归红线：B-核心 6 场景语义全绿（改键/overlay/mute 链路不许动）

### 3.3 视觉验收

- 截图矩阵：4 schema tab + keybinds tab × hc on/off（10 张）→ analyze_image 或用户开窗口肉眼
- 同套控件被动同步抽查：forge 面板 seg/toggle 新皮肤生效截图 1 张

---

## 4. 改动面清单

| 文件 | 改动 |
|---|---|
| `style/main.css` | 令牌 3 个 + tab 条重写 + 行/控件皮肤 + kb 键帽 + 分组标题样式 + body.hc 覆盖块（约 +180 行） |
| `src/settings.ts` | textScale def seg→slider；hc def 新增；import hc source（~15 行） |
| `src/state.ts` | hc source + setter；textScale clamp 1.2→1.5（~8 行） |
| `src/options.ts` | tab 图标前缀 + aria 属性（tab/tabpanel/switch/radiogroup）+ tablist 方向键 handler + kb 分组标题渲染（~40 行） |
| `src/i18n.ts` | 5 新 key（~5 行） |
| `src/__tests__/settings.test.ts` / `options.test.ts` | +~18 测 |
| `scripts/smoke_settings_core.py` | textScale 断言更新 + 新增 hc/aria/键盘断言 |

**不碰**：`input.ts`、`keybinds.ts`、`main.ts`、其他面板 TS、`.forge-tab`。

---

## 5. 风险与缓解

| 风险 | 缓解 |
|---|---|
| .toggle/.seg 全局改皮肤波及其他面板观感 | 皮肤-only（颜色/边框/阴影），不动尺寸与布局；视觉验收含 forge 抽查 |
| textScale 上限 1.5 后 HUD 布局溢出（sidebar 定宽） | 冒烟新增 1.5 档截图检查 sidebar/right-panel 溢出；如溢出，spec 允许在 body.fs-large 下对 sidebar 加 overflow 处理（实现时定） |
| tab 方向键与 overlay focus-trap 冲突 | tabs 容器局部 handler，stopPropagation；冒烟覆盖 |
| hc 与色弱滤镜叠加异常 | CSS 层面可组合（机制 A 注释已证）；冒烟 hc×cb 同开截图 |

---

## 6. Follow-ups（明确延后）

- keybinds tab 搜索/筛选框（27 行长列表结构性优化）
- overlay 内数字操作键改键（用户裁决：不做，除非 playtest 强需求）
- 高对比模式 canvas 层覆盖（当前只 DOM HUD，与色弱滤镜同边界）
