# 设置面板核心优化（架构收拢 + 全改键 + 恢复默认）— 技术规格

**日期**: 2026-08-04 ｜ **基线**: `main @ ba82145` ｜ **仓库**: [xieyj22/darkhollow_win](https://github.com/xieyj22/darkhollow_win)
**范围**: 子系统 B-核心 —— 设置架构收拢（渐进兼容）+ 全自定义键位（键盘+手柄+overlay close）+ 恢复默认。**B-表层（视觉重设计 + 无障碍增强）另开 spec，本份不涉及。** 在 `main` 开 `feat/settings-core` 分支实现。

---

## Context

### 要解决的问题
1. **设置散落 + apply 重复**：设置项分布在 [`state.ts`](https://github.com/xieyj22/darkhollow_win/blob/ba82145/src/state.ts)（10 项 let+setter）和 [`audio.ts`](https://github.com/xieyj22/darkhollow_win/blob/ba82145/src/audio.ts)（4 项音量），`muted` 在两处 mirror（[state.ts:50](https://github.com/xieyj22/darkhollow_win/blob/ba82145/src/state.ts#L50) + [audio.ts:17](https://github.com/xieyj22/darkhollow_win/blob/ba82145/src/audio.ts#L17)）；apply 函数在 [`options.ts`](https://github.com/xieyj22/darkhollow_win/blob/ba82145/src/options.ts) 和 [`ui-settings.ts`](https://github.com/xieyj22/darkhollow_win/blob/ba82145/src/ui-settings.ts) 各一套（main.ts 混用）。新设置项要改 4 处（state 变量/setter/options 渲染/i18n）。
2. **键位全硬编码**：[`input.ts`](https://github.com/xieyj22/darkhollow_win/blob/ba82145/src/input.ts) 234 行，键盘 14-case switch（[L122-145](https://github.com/xieyj22/darkhollow_win/blob/ba82145/src/input.ts#L122-L145)）+ **12 个 overlay 块**直接字符串比较（ESC/B/数字，[L36-111](https://github.com/xieyj22/darkhollow_win/blob/ba82145/src/input.ts#L36-L111)）+ 手柄 pollGamepad（[L174-216](https://github.com/xieyj22/darkhollow_win/blob/ba82145/src/input.ts#L174-L216)）+ 触摸。零可配置。优秀 roguelike 的改键功能完全缺失。
3. **无恢复默认、无 hover 说明**：[`row()` 构建器](https://github.com/xieyj22/darkhollow_win/blob/ba82145/src/options.ts#L138) 缺 description 参数；`opt.introEnabledDesc` i18n key 已定义但未消费。

### 现状（基线 ba82145，可复用基础）
- **options.ts 4-Tab**（[L109 renderOptions](https://github.com/xieyj22/darkhollow_win/blob/ba82145/src/options.ts#L109)）：Audio（mute/master/music/sfx）/ Display（fullscreen/zoom/textSize/minimap/safeZone/lang）/ Accessibility（reducedMotion/shake/colorblind/barCues）/ Gameplay（introEnabled/legend/keys）。控件构建器 `row/toggleHtml/segHtml/volSliderHtml/bindToggle/bindSeg`（[L138-160](https://github.com/xieyj22/darkhollow_win/blob/ba82145/src/options.ts#L138-L160)）。
- **state.ts 设置 let**（L45-103）：lang/minimapScale/uiZoom/reducedMotion/safeZone/shakeScale/textScale/colorblind/barCues/introEnabled + 非持久化 legendVisible/keysVisible/menuOpen/introOpen。
- **audio.ts 音量**（L14-17,53-60）：masterVol/musicVol/sfxVol/muted。
- **input.ts 键位**：键盘 switch 14 case（move/pickup/descend/wait/inventory/skill/talent/achieve/help/quaff/read/lang/mute/quick1-9）+ 元键（F11/Ctrl+S/Escape/Tab）+ 12 overlay 块 + 手柄 12 按钮 + 触摸 9 元素。
- **i18n**：设置 key 在扁平 `optX` → 点号 `opt.x` 迁移中（新项用 `opt.<camelCase>` + `opt.<name>Desc`）。

---

## Proposed changes

### ① settings.ts — 设置 schema + 统一调度（新建）

**Schema 驱动**：把所有设置项（state.ts 10 + audio.ts 4）的元数据集中到一个 schema 数组，options.ts 由 schema 自动生成 row+控件+绑定，恢复默认 + hover 描述免费获得。

```ts
// src/settings.ts
export type Control = 'toggle' | 'seg' | 'slider';
export interface SettingDef {
  key: string;                 // 唯一 id（= tab 分组键）
  tab: 'audio' | 'display' | 'access' | 'game';
  labelKey: string;            // i18n key
  descKey?: string;            // 可选 hover 说明 i18n key
  control: Control;
  get: () => boolean | string | number;
  set: (v: boolean | string | number) => void;
  apply?: () => void;          // 写 DOM（applyTextScale 等）
  // seg 选项
  options?: { id: string; labelKey: string }[];
  // slider 范围
  min?: number; max?: number; step?: number; toDisplay?: (v: number) => string;
  default: boolean | string | number;
  disabled?: () => boolean;    // 如 shake 在 reducedMotion 时禁用
}
export const SETTING_DEFS: SettingDef[] = [ /* 14 项，每项 get/set 指向 state.ts/audio.ts 的 getter/setter */ ];
export function resetDefaults(): void { for (const d of SETTING_DEFS) { d.set(d.default); d.apply?.(); } }
```

- **get/set 指向现有 source of truth**：如 reducedMotion 项 `get: () => reducedMotion, set: (v) => setReducedMotion(v as boolean)`。state.ts 的 let+setter 不动（**12 文件 import 不破**），settings.ts 是元数据 + 调度层。
- **修 muted 双份**：audio.ts 的 `muted` 为唯一 source；state.ts 的 `muted`/`setMuted` 删除（grep 消费者迁移到 audio.ts 的 `isMuted`/`setMutedState`），或保留作 deprecated re-export。决策：删 state.ts 的 muted mirror，迁移 ~3 消费者。
- **合并 apply**：ui-settings.ts 的重复 apply（applyZoom/applySafe/applyReducedMotion）删除，统一用 options.ts 的版本；main.ts 启动调用收拢到 settings.ts 的 `applyAll()`。

### ② options.ts — schema 驱动重构

- `renderOptions` 仍 4 tab，但每个 tab 的行由 `SETTING_DEFS.filter(d => d.tab === tab)` 自动生成。
- `row()` 加 `desc?` 参数：`row(label, controlHtml, desc?, disabled?)` —— 渲染 label 下的灰色说明小字（消费 `descKey`，hover tooltip 或常驻小字，选常驻小字更简单）。
- 控件生成器从 schema 的 control/options/min/max 派生（复用现有 toggleHtml/segHtml/volSliderHtml）。
- 绑定：toggle → `bindToggle(input, v => { def.set(v); def.apply?.(); renderOptions(); })`；seg/slider 同理。
- **底部加「恢复默认」按钮**（每 tab 或全局）：`onclick = () => { if (confirm(t('opt.confirmReset'))) { resetDefaults(); renderOptions(); } }`。

### ③ keybinds.ts — 全改键（新建）

**Action 枚举**（覆盖 gameplay + meta + overlay-close；overlay 内数字操作键保留硬编码，见 Risks）：
```ts
export type Action =
  | 'move_up' | 'move_down' | 'move_left' | 'move_right'
  | 'pickup' | 'descend' | 'wait' | 'inventory' | 'skill' | 'talent' | 'achieve' | 'help'
  | 'quaff' | 'read' | 'lang' | 'mute' | 'save' | 'pause' | 'fullscreen'
  | 'quick1' | 'quick2' | 'quick3' | 'quick4' | 'quick5' | 'quick6' | 'quick7' | 'quick8' | 'quick9'
  | 'overlay_close';   // ESC / B — 跨所有 overlay 的关闭
```

**默认映射**（从 input.ts 现状提取，行为不变）：
```ts
export const DEFAULT_KEYS: Record<string, Action> = {
  'w': 'move_up', 'arrowup': 'move_up', 's': 'move_down', 'arrowdown': 'move_down',
  'a': 'move_left', 'arrowleft': 'move_left', 'd': 'move_right', 'arrowright': 'move_right',
  'g': 'pickup', '.': 'descend', '>': 'descend', ' ': 'wait', 'f': 'wait',
  'i': 'inventory', 'b': 'inventory', 'q': 'quaff', 'r': 'read', '?': 'help',
  'k': 'skill', 't': 'achieve', 'n': 'talent', 'l': 'lang', 'm': 'mute',
  'escape': 'overlay_close',
  // save(CTRL+S)/pause(ESC→overlay_close 复用)/fullscreen(F11) 是元键，单独处理（见下）
  // quick1-9 由数字键 default 分支处理（见 input.ts 重写）
};
export const DEFAULT_BUTTONS: Record<number, Action> = {
  12: 'move_up', 13: 'move_down', 14: 'move_left', 15: 'move_right',
  0: 'wait', 1: 'overlay_close', 2: 'skill', 3: 'inventory',
  4: 'quaff', 5: 'descend', 9: 'pause',
};
```

**API**：
- `loadKeybinds()`/`saveKeybinds()`：持久化 `dh_keybinds`（JSON，{keys, buttons}），迁移（无键 → 默认）。
- `keyToAction(e: KeyboardEvent): Action | null`：normalize `e.key.toLowerCase()`，查当前映射（含 CTRL+S/F11 元键特殊判断）。
- `buttonToAction(btnIndex: number): Action | null`。
- `rebind(action, newKey)`：更新映射 + 冲突检测（同键已被其他 action 占用 → 提示 + 拒绝或交换）+ 持久化。
- `resetKeybinds()`：恢复默认。
- `bindingFor(action): string`：反查显示（Keybinds tab 用）。

### ④ input.ts — 改键重写

- 顶部 overlay 拦截链（options/pause/event/inv/help/skill/achieve/talent/forge/intro）的"ESC/B 关"统一改为：`if (keyToAction(e) === 'overlay_close') { closeActiveOverlay(); ... }`。
- 主 gameplay switch 改为：`const a = keyToAction(e); switch (a) { case 'move_up': movePlayer(0,-1); ... }`。
- 数字键 quick1-9：`keyToAction` 对数字键返回 'quickN'（default 分支在 keyToAction 内处理 `parseInt(e.key)` 1-9）。
- 元键（CTRL+S/F11）保留特殊判断（这些不该被改键，或限定特殊处理）。
- pollGamepad：`const a = buttonToAction(i); if (a) dispatch(a)`。
- **行为等价**：重写后所有现有键位行为不变（默认映射 = 现状），仅改为查表分发。

### ⑤ Keybinds tab（options 新增第 5 tab）

- `TABS` 加 `'keybinds'`。
- `renderKeybinds(body)`：遍历 Action（分组 gameplay/meta），每行 = 动作名 + 当前键（`bindingFor(action)`）+ "点击重新绑定"按钮。点击进入捕获模式（监听下一次 keydown → `rebind(action, key)` + 冲突提示 + 重新渲染）。手柄同理（捕获下一次 gamepad 按钮）。
- 底部「恢复默认键位」按钮。

---

## Testing and validation

**单元测试**（vitest）
- `settings.ts`：`resetDefaults()` 遍历所有 def 调 set(default) + apply；每项 default 值正确；muted 单一 source（删 mirror 后无双写）。
- `keybinds.ts`：`keyToAction`/`buttonToAction` 默认映射正确（覆盖所有现状键位）；`rebind` 更新 + 冲突检测（同键占用 → 拒绝/交换）；`resetKeybinds` 恢复默认；持久化 load/save（mock localStorage）；迁移（无 dh_keybinds → 默认）。
- `options.ts` schema 驱动：SETTING_DEFS 覆盖所有现有设置项（无遗漏）；每项 get/set/apply 指向正确。
- **行为等价测试**：默认键位下，keyToAction 对每个现状键返回正确 Action（防回归）。

**手动验证**（dev server）
1. 设置面板 4 tab 由 schema 生成，所有设置项可见 + 可调 + 持久化（行为同前）。
2. row 下方有 description 小字（消费 Desc key）。
3. 「恢复默认」按钮：重置所有设置到默认 + DOM 更新。
4. Keybinds tab：所有动作显示当前键；点击捕获新键；冲突提示；重置默认。
5. 改键后：游戏内按新键执行对应动作（键盘 + 手柄）。
6. overlay close（ESC/B）改键后一致（如改 close 为 Q，所有 overlay 用 Q 关）。
7. 12 个 overlay 块行为无回归（ESC/B/数字操作）。

---

## Risks and mitigations

- **input.ts 重写是最大风险**：12 个 overlay 块 + 主 switch + 手柄全部查表化。→ 默认映射 = 现状（行为等价），加"默认键位→Action"回归测试逐键覆盖；冒烟重点验 12 overlay 块。
- **overlay 内数字操作键（inv 1-9 操作道具 / event 1-N 选动作 / skill 1-9）不纳入改键**：这些键的语义耦合具体 overlay（inv 的 1 = 操作第 1 格，event 的 1 = 选第 1 动作），改键价值低 + 实现复杂。仅 overlay_close（ESC/B）纳入改键（跨 overlay 通用）。spec 明确此边界。
- **元键（CTRL+S / F11）**：保留硬编码特殊判断（不该被自由改键，避免误改导致无法保存/全屏）。keyToAction 内特殊处理。
- **架构渐进兼容**：state.ts let+setter 保留作 source of truth（12 文件 import 不破），settings.ts 仅加元数据 + 调度层。低风险。
- **muted 双份**：删 state.ts mirror 时迁移 ~3 消费者到 audio.ts，grep 确认无遗漏。
- **i18n**：新 key（Keybinds tab 动作名 + 恢复默认确认 + rebind 提示）用 `opt.*`/`kb.*` 前缀，双语。

---

## Follow-ups（B-表层，另开 spec）

- 视觉重设计（ui-ux-pro-max skill）：4-Tab 面板精致化（图标/排版/层级/动效）。
- 无障碍增强：文字大小加更大档/连续调节；高对比模式；（可选）色弱 canvas 滤镜评估。
- overlay 内数字操作键改键（若 playtest 需求）。
