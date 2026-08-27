# 批3C emoji 全量 sprite 化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把天赋 86 / 成就 31 / Forge 27 共 144 个 def 的 emoji icon 与 HUD buff 行纯文字全部换成像素 sprite（~20 个 `T_*` 主题模板 + def 级 hue 换色）。

**Architecture:** 三张 def 表加 `tpl?: string; hue?: string` 字段（emoji `icon` 保留作回退）；sprites.ts 新增主题模板 + `THEME_PAL` 固定多色表 + `iconPalette(kind,color)` 纯函数（paintIcon 改调它）；三个渲染点与 buff 行换 `<canvas class="lic">` + innerHTML 后 paintIcon（codex 面板 [ui-panels.ts:66-68](https://github.com/xieyj22/darkhollow_win/blob/f401f47/src/ui-panels.ts#L66-L68) 先例）。

**Tech Stack:** TypeScript + Canvas 2D + vitest/happy-dom + playwright(channel='chrome')+PIL e2e。

**Spec:** `docs/superpowers/specs/2026-08-27-batch3c-emoji-sprites-design.md`（约束权威，冲突以 spec 为准）

## Global Constraints

- **Shape 守卫**：每个新模板 16 行 × 每行恰 16 字符（`src/__tests__/sprites.test.ts` 既有守卫遍历 `Object.keys(TEMPLATES)` 自动覆盖全部 `T_*` 新键）。
- **字母/palette 覆盖**：单色主题模板只能用 buildPalette 字母集 `{M,D,L,E,K,W,C,G,N,V}`（M=主色/D=暗/L=亮/K 描边/W 亮体，E 橙/G 金/C 灰/N 棕/V 青固定）；THEME_PAL 多色模板的每个用字母必须在 palette 有映射（未映射字母=静默透明洞，C_BOMB bug 类）。
- **键前缀**：新主题模板一律 `T_` 前缀（已 grep 核实 84+ 现键零占用）；添加前 implementer 再 grep 一次防撞。
- **emoji `icon` 字段全保留**（文本语境回退，3B `ch` 惯例）；渲染点替换为 canvas 但 def 数据不删 emoji。
- **行为等价**：`iconPalette` 对 STAIR/玩家职业键的返回必须与现 `paintIcon` 内联特例逐字节等价（legend/help 消费者零回归）；Forge `💀` 价签 emoji 不动（批外）。
- **测试计数纪律**：按"基线+N 新增"算，不信累计预测。基线 448（main@f401f47）；T1 +2=450 · T2 +1=451 · T3 +2=453 · T4 +1=454 · T5 +0=454。
- **门禁**：每任务 `npx tsc --noEmit; echo "exit:$?"` 显式核 exit=0 + `npx vitest run` 全绿（禁止管道掩退出码）。
- **串行执行 T1→T5**（T2/T3 同改 data.ts；模板绘制集中在 T1 单 implementer 保风格统一）。
- happy-dom 无 canvas2d：canvas 路径不单测，靠 `iconPalette` 纯函数单测 + typecheck + e2e。

---

### Task 1: 类型字段 + T_* 主题模板 + THEME_PAL + iconPalette 路由

**Files:**
- Modify: `src/types.ts:364,548,644`（三接口加字段）
- Modify: `src/sprites.ts`（TEMPLATES 尾部加 ~20 模板、STAIR_PAL 旁加 THEME_PAL、paintIcon:2108 改调 iconPalette、export iconPalette）
- Create: `src/__tests__/batch3c-sprites.test.ts`

**Interfaces:**
- Produces: `TalentNode.tpl?: string; TalentNode.hue?: string`（同 AchievementDef/MetaUpgradeDef 三处）；`iconPalette(kind: string, color?: string): Record<string, string>`；`THEME_PAL: Record<string, Record<string, string>>`（含 STAIR 键=现 STAIR_PAL 内容）；`TEMPLATES.T_SWORD/T_HEART/...` ~20 键。T2/T3/T4 消费这些名字。

- [ ] **Step 1: 写失败测试**（`src/__tests__/batch3c-sprites.test.ts`）

```ts
import { describe, it, expect } from 'vitest';
import { TEMPLATES, THEME_PAL, iconPalette } from '../sprites.js';
import { TALENT_TREES, ACH_DEFS, META_UPGRADES } from '../data.js';

describe('batch3c T1: iconPalette routing', () => {
  it('falls back to buildPalette(color) for unknown/plain kinds', () => {
    const pal = iconPalette('T_SWORD', '#aa3311');
    expect(pal.M).toBe('#aa3311');
    expect(pal.K).toBe('#140a0a');
  });
  it('returns THEME_PAL entry for multi-hue themes and STAIR, PLAYER_PAL for classes', () => {
    expect(iconPalette('T_FIRE', '#000000')).toBe(THEME_PAL.T_FIRE);
    expect(iconPalette('T_ICE', '#000000')).toBe(THEME_PAL.T_ICE);
    expect(iconPalette('STAIR', '#000000')).toEqual({ K: '#3a4a5a', C: '#5a6a7a', W: '#9aaab8', L: '#b8c8d8', V: '#7ec8e3' });
    expect(iconPalette('WARRIOR', '#000000')).toBe(iconPalette('MAGE', '#000000'));
  });
});

describe('batch3c T1: theme templates present & single-hue letter discipline', () => {
  const SINGLE = new Set(['M', 'D', 'L', 'E', 'K', 'W', 'C', 'G', 'N', 'V']);
  it('every T_ template is 16x16 (shape guard covers) and single-hue ones only use buildPalette letters', () => {
    for (const [k, rows] of Object.entries(TEMPLATES)) {
      if (!k.startsWith('T_')) continue;
      expect(rows.length, `${k} rows`).toBe(16);
      const multi = THEME_PAL[k] !== undefined;
      const letters = new Set(rows.join('').split(''));
      if (!multi) {
        for (const ch of letters) {
          if (ch === '.') continue;
          expect(SINGLE.has(ch), `${k} uses non-buildPalette letter ${ch} but has no THEME_PAL entry`).toBe(true);
        }
      } else {
        for (const ch of letters) {
          if (ch === '.') continue;
          expect(THEME_PAL[k]![ch] !== undefined, `${k} letter ${ch} unmapped in THEME_PAL`).toBe(true);
        }
      }
    }
  });
});
```

- [ ] **Step 2: 跑红**

Run: `npx vitest run src/__tests__/batch3c-sprites.test.ts`
Expected: FAIL（iconPalette/THEME_PAL 未导出）

- [ ] **Step 3: 实现**

types.ts 三接口（TalentNode/AchievementDef/MetaUpgradeDef 的 `icon: string;` 行后）各加：

```ts
  /** Batch3c: T_ theme template key for panel sprite; undefined = legacy emoji icon. */
  tpl?: string;
  /** Batch3c: main hue for buildPalette; table default applies when absent. */
  hue?: string;
```

sprites.ts：

```ts
// Batch3c theme palettes — fixed multi-hue themes. STAIR entry migrates the old
// STAIR_PAL special case verbatim (iconPalette behavior-equivalent).
export const THEME_PAL: Record<string, Record<string, string>> = {
  STAIR: { K: '#3a4a5a', C: '#5a6a7a', W: '#9aaab8', L: '#b8c8d8', V: '#7ec8e3' },
  T_FIRE: { K: '#1a0a04', M: '#ff5a1e', D: '#b83a0c', L: '#ffd54a', W: '#fff0c8' },
  T_ICE: { K: '#0a1420', M: '#7ec8e3', D: '#3a6a8a', L: '#d8f4ff', W: '#ffffff' },
  T_HOLY: { K: '#3a3210', M: '#ffe98a', D: '#c8a83a', L: '#fff8d8', W: '#ffffff' },
  T_SHADOW: { K: '#0a0a14', M: '#5a3a7a', D: '#2a1a3a', L: '#9a5de8', W: '#d8c8f0' },
};

// Batch3c: palette resolution for panel icons — pure, testable without canvas.
export function iconPalette(kind: string, color = '#cccccc'): Record<string, string> {
  if (kind === 'WARRIOR' || kind === 'ROGUE' || kind === 'MAGE' || kind === 'PALADIN') return PLAYER_PAL;
  return THEME_PAL[kind] || buildPalette(color);
}
```

paintIcon（sprites.ts:2108）删内联三特例，改 `let pal = iconPalette(kind, color);`（STAIR_PAL 常量本体删除，内容已迁 THEME_PAL.STAIR；PLAYER_PAL 保留原常量，iconPalette 引用）。

**主题模板**（TEMPLATES 尾部，B_MYCONID 后）。3 个全样例（shippable v1，implementer 可在锚点内精修）：

```ts
  T_SWORD: [
    '................',
    '.............K..',
    '............KML.',
    '...........KML..',
    '..........KML...',
    '.........KML....',
    '........KML.....',
    '.K.....KML......',
    '.KG...KML.......',
    '..KG.KML........',
    '...KGML.........',
    '....KG..........',
    '...K.KG.........',
    '..K...K.........',
    '................',
    '................',
  ],
  T_HEART: [
    '................',
    '................',
    '...KK.....KK....',
    '..KMMK...KMMK...',
    '.KMLLLK.KMLLLK..',
    '.KMLLLLKMLLLLK..',
    '.KMLLLLLLLLLLK..',
    '.KMMLLLLLLLLMK..',
    '..KMMLLLLLLMK...',
    '...KMMMMMMMK....',
    '....KMMMMMK.....',
    '.....KMMMK......',
    '......KMK.......',
    '.......K........',
    '................',
    '................',
  ],
  T_COIN: [
    '................',
    '................',
    '.....KKKKK......',
    '....KMMMMMK.....',
    '...KMLLMMMMK....',
    '...KMLLMMMMMK...',
    '..KMLLMMMMMMK...',
    '..KMLLMMMMMMK...',
    '..KMLLMMMMMMK...',
    '...KMLLMMMMK....',
    '...KMLLMMMMK....',
    '....KMMMMMK.....',
    '.....KKKKK......',
    '................',
    '................',
    '................',
  ],
```

其余 17 个锚点表（单色=仅用 buildPalette 字母；多色=列 THEME_PAL 键，palette 已在上方 THEME_PAL 定义）：

| 键 | 锚点 | 类型 |
|---|---|---|
| T_SHIELD | 盾形轮廓+中线纹章+顶部弧 | 单色 |
| T_STAR | 五角星实心+短光芒线 | 单色 |
| T_BOOK | 合拢书本+G 书签线垂出 | 单色 |
| T_MEAT | 肉腿（N 骨柄+M 肉体） | 单色 |
| T_EYE | 横睑包裹+L 高光+W 瞳 | 单色 |
| T_RUNE | 立石片+M 符文刻线 | 单色 |
| T_WING | 左右对称双翼展+中脊 | 单色 |
| T_BOOT | 侧视靴（靴筒+靴头+跟） | 单色 |
| T_STAFF | 竖杖+顶端 G 球+缠绕线 | 单色 |
| T_CROWN | 三尖冠+底环+G 珠 | 单色 |
| T_FLASK | 锥形瓶+软木塞+M 液面+L 气泡 | 单色 |
| T_TROPHY | 双耳杯+柱柄+底座+G 高光 | 单色 |
| T_SKULL | 颅骨（W 骨体+K 眼窝+齿缝） | 单色 |
| T_FIRE | 跳动火苗（W 焰心+L 内焰+M 外焰+D 底座） | **THEME_PAL.T_FIRE** |
| T_ICE | 六向冰晶（L 高光棱+M 晶面+W 闪点） | **THEME_PAL.T_ICE** |
| T_HOLY | 光芒十字/四射光（W 核心+M 光束） | **THEME_PAL.T_HOLY** |
| T_SHADOW | 烟团轮廓+L 裂纹眼（无实体感） | **THEME_PAL.T_SHADOW** |
| T_HEART | （上方全样例） | 单色 |
| T_COIN | （上方全样例） | 单色 |

共 20 键。**画前先读** TEMPLATES 邻近模板（B_* 尾部、CHEST/DOOR）找风格密度；每模板字母对照本表类型自检（Step 1 测试也会拦）。

- [ ] **Step 4: 跑绿 + 全量门**

Run: `npx vitest run src/__tests__/batch3c-sprites.test.ts` → 2 passed；`npx vitest run` → **450**；`npx tsc --noEmit; echo "exit:$?"` → 0

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/sprites.ts src/__tests__/batch3c-sprites.test.ts
git commit -m "feat(sprites): 20 T_ theme templates + THEME_PAL + iconPalette routing (batch3c T1)"
```

---

### Task 2: 天赋 86 行 tpl/hue 数据 + 天赋格接线

**Files:**
- Modify: `src/data.ts`（TALENT_TREES 86 node 加 tpl/hue）
- Modify: `src/panels.ts:362`（天赋格 emoji→canvas + paint 循环）
- Modify: `style/main.css`（.tc-ic canvas 尺寸适配）
- Modify: `src/__tests__/batch3c-sprites.test.ts`（real-data 门）

**Interfaces:**
- Consumes: T1 的 `tpl/hue` 字段、`T_*` 模板、`paintIcon`；表默认 hue 常量。
- Produces: `TALENT_DEFAULT_HUE = '#c9a227'`（panels.ts 内 const，T3/T4 不消费但与本表语义一致）。

- [ ] **Step 1: 写失败测试**（batch3c-sprites.test.ts 追加）

```ts
describe('batch3c T2: talent real-data gate', () => {
  it('every talent node has tpl in TEMPLATES', () => {
    let n = 0;
    for (const tree of TALENT_TREES) for (const node of tree.nodes) {
      expect(node.tpl, `talent ${node.id} missing tpl`).toBeTruthy();
      expect(TEMPLATES[node.tpl!], `talent ${node.id} tpl ${node.tpl} not in TEMPLATES`).toBeTruthy();
      n++;
    }
    expect(n).toBeGreaterThanOrEqual(86);
  });
});
```

- [ ] **Step 2: 跑红**（86 个 node 现无 tpl → FAIL）

Run: `npx vitest run src/__tests__/batch3c-sprites.test.ts`

- [ ] **Step 3: 实现**

**data.ts 逐 node 配 tpl+hue。** effect 语义路由表（全量规则，行级 hue 在此基色上做 ±明度/色相微调避免同主题相邻撞色）：

| effect 族 | tpl | 树倾向 hue |
|---|---|---|
| atk/atkPct/low_hp_atk/crit 族 | T_SWORD | 战士 #e05545 / 盗贼 #6cc46c / 法师 #5a8ad6 / 圣骑 #e8c84a |
| def/defPct/盾系 | T_SHIELD | 同上四色偏蓝 #5a8ad6 系 |
| maxHp/heal/吸血/再生 | T_HEART | #e05560 基准 |
| maxMp/法力/施法系 | T_RUNE | #8a5de8 基准 |
| 火系伤害 | T_FIRE | 多色（hue 不生效，可省） |
| 冰系/减速 | T_ICE | 多色（可省 hue） |
| 暗影/隐身/偷袭 | T_SHADOW | 多色（可省） |
| 圣光/治疗强化 | T_HOLY | 多色（可省） |
| 移动/闪避/攻速 | T_BOOT | #6cc46c 基准 |
| 视野/侦察 | T_EYE | #6ad4d4 基准 |
| 金币/掉落 | T_COIN | #ffd54a 基准 |
| 经验/知识 | T_BOOK | #c8a86a 基准 |
| 召唤/宠物资 | T_WING | #b8a0d8 基准 |
| 大招/终局技能节点 | T_STAR | 按树主色 |
| 控制系（眩晕/打断） | T_STAFF | #8a5de8 基准 |

worked examples（4 例示格式，其余 82 行同法；多色模板省略 hue 字段）：

```ts
{ id: 'w_iron_skin', ..., tpl: 'T_SHIELD', hue: '#5a8ad6' },
{ id: 'w_battle_fury', ..., tpl: 'T_SWORD', hue: '#e05545' },
{ id: 'w_shield_mastery', ..., tpl: 'T_SHIELD', hue: '#7a9ae8' },
{ id: 'w_berserker', ..., tpl: 'T_SWORD', hue: '#ff6a3c' },
```

**panels.ts:362 接线**（顶部 import 加 `import { paintIcon } from './sprites.js';`）：

```ts
const TALENT_DEFAULT_HUE = '#c9a227';
// cell.innerHTML 行替换：
cell.innerHTML = `<div class="tc-icon"><canvas class="lic tc-ic" width="16" height="16" data-kind="${node.tpl || 'T_RUNE'}" data-color="${node.hue || TALENT_DEFAULT_HUE}"></canvas></div><div class="tc-name">${name}</div><div class="tc-dots">${dots}</div>`;
```

天赋面板 innerHTML 全部拼装完成后（cells 挂进容器处之后）加：

```ts
container.querySelectorAll<HTMLCanvasElement>('canvas.lic').forEach(cv => paintIcon(cv, cv.dataset.kind || 'T_RUNE', cv.dataset.color || TALENT_DEFAULT_HUE));
```

（`container` = 天赋格实际挂载的父节点变量名，按现场代码取；找不到单一挂载点则在逐 cell append 循环内 paint 该 cell 的 canvas。）

**style/main.css**（.tc-icon 既有规则附近加）：

```css
.tc-icon .tc-ic { width: 20px; height: 20px; image-rendering: pixelated; vertical-align: middle; }
```

（尺寸若致格子塌陷，按 .tc-icon 现有布局调到 16-22px 区间，smoke 必须仍绿。）

- [ ] **Step 4: 跑绿 + 全量门** → vitest **451** / tsc 0 / `npm run build` 绿

- [ ] **Step 5: Commit**

```bash
git add src/data.ts src/panels.ts style/main.css src/__tests__/batch3c-sprites.test.ts
git commit -m "feat(talents): per-node tpl/hue theme sprites wired into talent cells (batch3c T2)"
```

---

### Task 3: 成就 31 + Forge 27 数据 + 两处接线

**Files:**
- Modify: `src/data.ts`（ACH_DEFS 31 + META_UPGRADES 27 加 tpl/hue）
- Modify: `src/panels.ts:299`（成就行）+ `src/meta.ts:361`（Forge 行）+ paint 循环 ×2
- Modify: `style/main.css`（.aic/.fu-icon 内 canvas 适配）
- Modify: `src/__tests__/batch3c-sprites.test.ts`

**Interfaces:**
- Consumes: T1 `T_*` 模板/paintIcon；T2 接线模式（canvas.lic + paint 循环）。
- Produces: `ACH_DEFAULT_HUE = '#8a5de5'`（panels.ts）、`META_DEFAULT_HUE = '#4ad6c0'`（meta.ts）。

- [ ] **Step 1: 写失败测试**（追加两个 describe，同 T2 形态）

```ts
describe('batch3c T3: achievement + forge real-data gates', () => {
  it('every ACH_DEFS entry has tpl in TEMPLATES', () => {
    expect(ACH_DEFS.length).toBeGreaterThanOrEqual(31);
    for (const a of ACH_DEFS) {
      expect(a.tpl, `ach ${a.id} missing tpl`).toBeTruthy();
      expect(TEMPLATES[a.tpl!], `ach ${a.id} tpl ${a.tpl} not in TEMPLATES`).toBeTruthy();
    }
  });
  it('every META_UPGRADES entry has tpl in TEMPLATES', () => {
    expect(META_UPGRADES.length).toBeGreaterThanOrEqual(27);
    for (const m of META_UPGRADES) {
      expect(m.tpl, `meta ${m.id} missing tpl`).toBeTruthy();
      expect(TEMPLATES[m.tpl!], `meta ${m.id} tpl ${m.tpl} not in TEMPLATES`).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: 跑红** → FAIL（无 tpl）

- [ ] **Step 3: 实现**

**ACH_DEFS 31 条路由**（id 族 → tpl；hue 紫 #8a5de5 基准按族偏色）：

| id 族 | tpl | hue 基准 |
|---|---|---|
| kill_10/50/100/200、first_kill | T_SWORD / T_SKULL / T_SWORD / T_SWORD | #b85a4a 系渐变（量大色深） |
| boss_kill/boss 群、warden 系 | T_CROWN / T_TROPHY | #ffd54a 金 |
| floor_*/depth 系 | T_BOOT | #6cc46c |
| endless_* 系 | T_SHADOW | 多色省 hue |
| 金币/gold 系 | T_COIN | #ffd54a |
| 全收集/图鉴系 | T_BOOK | #c8a86a |
| 职业/技能系 | T_STAR | #8a5de8 |
| 存档/杂项 | T_RUNE | #8a8a96 |

worked examples：`first_kill→T_SWORD #b85a4a`、`kill_50→T_SKULL #8a3a2a`、`boss_kill→T_CROWN #ffd54a`、`endless50→T_SHADOW`（无 hue）。

**META_UPGRADES 27 条路由 = 既有 icon 语义就近迁移**（❤→T_HEART、💧→T_FLASK、⚔→T_SWORD、🛡→T_SHIELD、🗡→T_SWORD hue 橙、💨→T_BOOT、💰→T_COIN、💚→T_HEART hue 绿、🍖→T_MEAT、🌟→T_STAR、📖→T_BOOK、👁→T_EYE、🎒→T_BOOT hue 棕、💎→T_COIN hue 青、💀→T_SKULL；category 无对应语义者：stats→T_HEART 系、survival→T_MEAT/T_HEART、talent→T_STAR、utility→T_RUNE、endless→T_SHADOW）。hue 基准青 #4ad6c0 保留给元资源系（echoes/soul），效果系按上表。

**panels.ts:299 接线**：

```ts
const ACH_DEFAULT_HUE = '#8a5de5';
d.innerHTML = `<span class="aic"><canvas class="lic ach-ic" width="16" height="16" data-kind="${a.tpl || 'T_RUNE'}" data-color="${a.hue || ACH_DEFAULT_HUE}"></canvas></span><div><div class="ain">${tx(a.n)}</div><div class="aid">${tx(a.d)}</div></div>`;
```

成就列表容器 innerHTML 完成后 paint 循环（同 T2 模式；renderAch 的列表容器变量按现场取名）。

**meta.ts:361 接线**（顶部 `import { paintIcon } from './sprites.js';` + `const META_DEFAULT_HUE = '#4ad6c0';`）：

```ts
<div class="fu-icon"><canvas class="lic fu-ic" width="16" height="16" data-kind="${def.tpl || 'T_RUNE'}" data-color="${def.hue || META_DEFAULT_HUE}"></canvas></div>
```

`content.innerHTML = html;`（meta.ts:366）后、绑 buy 按钮前加：

```ts
content.querySelectorAll<HTMLCanvasElement>('canvas.lic').forEach(cv => paintIcon(cv, cv.dataset.kind || 'T_RUNE', cv.dataset.color || META_DEFAULT_HUE));
```

**style/main.css**：

```css
.aic .ach-ic { width: 18px; height: 18px; image-rendering: pixelated; vertical-align: middle; }
.fu-icon .fu-ic { width: 20px; height: 20px; image-rendering: pixelated; vertical-align: middle; }
```

- [ ] **Step 4: 跑绿 + 全量门** → vitest **453** / tsc 0 / build 绿（Forge 是 smoke 覆盖面板之一，`npm run preview` + 冒烟必跑）

- [ ] **Step 5: Commit**

```bash
git add src/data.ts src/panels.ts src/meta.ts style/main.css src/__tests__/batch3c-sprites.test.ts
git commit -m "feat(ach/forge): tpl/hue theme sprites for 31 achievements + 27 meta upgrades (batch3c T3)"
```

---

### Task 4: HUD buff 行 sprite 化

**Files:**
- Modify: `src/sprites.ts`（export `BUFF_TPL` + fallback，置 THEME_PAL 旁）
- Modify: `src/render.ts:470-487`（buff 行 innerHTML 化 + paint 循环）
- Modify: `style/main.css`（.buff-ic）
- Modify: `src/__tests__/batch3c-sprites.test.ts`

**Interfaces:**
- Consumes: T1 `T_*` 模板、`paintIcon`。
- Produces: `BUFF_TPL: Record<string, { kind: string; color: string }>` + `BUFF_TPL_FALLBACK`。

- [ ] **Step 1: 写失败测试**

```ts
import { BUFF_TPL, BUFF_TPL_FALLBACK } from '../sprites.js';

describe('batch3c T4: BUFF_TPL gate', () => {
  it('every mapped buff kind exists in TEMPLATES, fallback too', () => {
    expect(Object.keys(BUFF_TPL.length ? BUFF_TPL : {}).length).toBeGreaterThanOrEqual(19);
    for (const [type, bp] of Object.entries(BUFF_TPL)) {
      expect(TEMPLATES[bp.kind], `buff ${type} kind ${bp.kind} not in TEMPLATES`).toBeTruthy();
      expect(bp.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(TEMPLATES[BUFF_TPL_FALLBACK.kind]).toBeTruthy();
  });
});
```

（注意 `BUFF_TPL.length` 是故意防呆写法会短路——实际写 `Object.keys(BUFF_TPL).length`，implementer 以可运行版为准。）

- [ ] **Step 2: 跑红** → FAIL（BUFF_TPL 未导出）

- [ ] **Step 3: 实现**

sprites.ts（THEME_PAL 后）：

```ts
// Batch3c: HUD buff row sprite routing (render.ts buff-list).
export const BUFF_TPL: Record<string, { kind: string; color: string }> = {
  str_buff: { kind: 'T_SWORD', color: '#e05545' },
  def_buff: { kind: 'T_SHIELD', color: '#5a8ad6' },
  shield: { kind: 'T_SHIELD', color: '#c8d4e8' },
  maxhp: { kind: 'T_HEART', color: '#e05560' },
  crit: { kind: 'T_SWORD', color: '#ff9a3c' },
  dodge: { kind: 'T_BOOT', color: '#6cc46c' },
  dodge_next: { kind: 'T_BOOT', color: '#a8e8a8' },
  heal_bonus: { kind: 'T_HEART', color: '#7de89a' },
  gold: { kind: 'T_COIN', color: '#ffd54a' },
  food: { kind: 'T_MEAT', color: '#d69555' },
  torch: { kind: 'T_FIRE', color: '#ff9a3c' },
  invis: { kind: 'T_SHADOW', color: '#b8a0d8' },
  mapping: { kind: 'T_EYE', color: '#6ad4d4' },
  el_res_fire: { kind: 'T_SHIELD', color: '#ff6a3c' },
  el_res_ice: { kind: 'T_SHIELD', color: '#6ac8ff' },
  el_res_holy: { kind: 'T_SHIELD', color: '#ffe98a' },
  el_dmg_fire: { kind: 'T_FIRE', color: '#ff5a2c' },
  el_dmg_ice: { kind: 'T_ICE', color: '#5ad4ff' },
  el_dmg_holy: { kind: 'T_HOLY', color: '#ffe98a' },
  el_dmg_shadow: { kind: 'T_SHADOW', color: '#9a5de8' },
  slow: { kind: 'T_ICE', color: '#7a8ae8' },
};
export const BUFF_TPL_FALLBACK: { kind: string; color: string } = { kind: 'T_RUNE', color: '#8a8a96' };
```

render.ts:470-478 buff 循环改（import BUFF_TPL/BUFF_TPL_FALLBACK/paintIcon；`bd.innerHTML = '';` 后逐行 append 的结构保留，行内改 innerHTML）：

```ts
for (const b of p.buffs) {
  const s = document.createElement('div'); s.className = b.type === 'slow' ? 'buff neg' : 'buff';
  const bp = BUFF_TPL[b.type] || BUFF_TPL_FALLBACK;
  s.innerHTML = `<canvas class="lic buff-ic" width="16" height="16" data-kind="${bp.kind}" data-color="${bp.color}"></canvas><span>${b.name}(${b.turns}t)${b.value ? '+' + b.value : ''}</span>`;
  bd.appendChild(s);
}
```

poisonTurns / slowed 两个特控行同法（slow 行 `🐌 ` 文字前缀删除，改 canvas T_ICE；poison 用 `{ kind: 'T_FLASK', color: '#7de84a' }` 内联同构）。循环后：

```ts
bd.querySelectorAll<HTMLCanvasElement>('canvas.lic').forEach(cv => paintIcon(cv, cv.dataset.kind || 'T_RUNE', cv.dataset.color || '#8a8a96'));
```

（set bonus 行不动——纯文字，批外。）

style/main.css：

```css
.buff .buff-ic, .buff.neg .buff-ic { width: 14px; height: 14px; image-rendering: pixelated; vertical-align: -2px; margin-right: 3px; }
```

- [ ] **Step 4: 跑绿 + 全量门** → vitest **454** / tsc 0 / build 绿

- [ ] **Step 5: Commit**

```bash
git add src/sprites.ts src/render.ts style/main.css src/__tests__/batch3c-sprites.test.ts
git commit -m "feat(hud): buff row sprites via BUFF_TPL routing (batch3c T4)"
```

---

### Task 5: e2e + 全量验证

**Files:**
- Create: `scripts/verify_batch3c_ingame.py`（克隆 `scripts/verify_batch3b_ingame.py` harness：Vite dev server + `page.evaluate(async()=>await import('/src/state.ts'))` live-module + playwright `channel='chrome'` + PIL；三坑防：HMR 第二模块实例/`_genItem` 晚绑定/恒定 random 塌缩；dialog handler 在首次 confirm 前注册；favicon 404 白名单双 handler）
- 截图输出: `scripts/smoke_out/batch3c/`

**Interfaces:** Consumes: T1-T4 全部落地的运行时行为。

- [ ] **Step 1: 写脚本，断言至少覆盖**

1. **三面板 sprite 渲染**：开天赋面板 → 全部 `canvas.tc-ic` 非空像素（PIL 逐 canvas 裁剪判非背景）+ 同主题不同 hue 的两个天赋格像素相异（选 T_SWORD 族任意两格）；成就面板/Forge 面板同法（ach-ic/fu-ic）。
2. **buff 行**：live module 注入 `str_buff`(5t,+3) 与 `torch`(10t,+2) 两个 buff → 断言 `#buff-list` 出现 2 个 `canvas.buff-ic` 且非空像素、两者像素相异（剑红 vs 火橙）。
3. **emoji 残留门**：三面板 innerHTML 不含原 emoji 字符（每表抽 3 个已知 emoji：天赋 ⚔🛡💢、成就 ⚔💀☠️、Forge ❤💧⚔）。
4. **回归**：批3B Boss sprite 仍渲染（放 1 个 boss 相邻截图非空）+ 0 console error（favicon 白名单）。

- [ ] **Step 2: 迭代到绿**（判据失败=真 bug 报 BLOCKED，不许放水）

- [ ] **Step 3: 全量门**（每条显式 exit）：`npx vitest run` → **454** / `npx tsc --noEmit` → 0 / `npm run build` → 绿 / smoke（`python scripts/smoke_settings_core.py`）→ 65/65 / 手柄 e2e → 22/22 / 批3B e2e → 18/18

- [ ] **Step 4: 截图矩阵**：三面板 + buff 行大图存 `scripts/smoke_out/batch3c/`（panel_*.png + buff_row.png），报告贴绝对路径供用户目检

- [ ] **Step 5: Commit**

```bash
git add scripts/verify_batch3c_ingame.py
git commit -m "test(e2e): in-game verification for batch3c — panel/buff sprites + emoji residue gate (batch3c T5)"
```

---

## Self-Review 记录

- **Spec 覆盖**：spec §2 T1-T5 五块 ↔ plan 五任务一一对应；144 def 数据（T2 86+T3 58）+ buff 行（T4）+ e2e（T5）+ iconPalette/THEME_PAL/模板（T1）全有落点。
- **占位符扫描**：无 TBD/TODO；86/58 行数据用"全量路由表+worked examples"表达（3B 锚点表先例，implementer 逐行应用）；20 模板 3 全样例+17 锚点（同先例）。
- **类型一致**：`tpl/hue` 字段名、`T_*` 键名、`paintIcon(target,kind,color)` 签名、`BUFF_TPL/BUFF_TPL_FALLBACK`、`iconPalette(kind,color)` 各任务间一致；T4 Step 1 测试里 `BUFF_TPL.length` 防呆笔误已注明以可运行版为准。
- **计数**：448→450→451→453→454→454（T5 +0），与 spec "~455" 相符。
