# 道具图标统一与差异化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把道具图标从"地图 sprite / 背包 glyph / 遗物 emoji 三套割裂"统一为全位置像素 sprite，并用稀有度换色 + 子类型模板让同类道具可区分。

**Architecture:** 全部复用 `sprites.ts` 程序化 sprite 架构（零图片）。新增 `paintItemIcon(target,item)`（HTML 面板接入）、`rarityTint(base,rarity)`（武器/护甲/饰品换色）、catalog `subType` 字段 + ~20 子类型模板 + ~10 遗物模板。

**Tech Stack:** TypeScript（strict，ESM `.js` import）、Vite（HMR 实时看 sprite）、vitest + happy-dom、Canvas 程序化像素（`sprites.ts` 字符串矩阵 + `buildPalette`）。

## Global Constraints

- **基线**：`feat/item-intro @ 12308eb`（继续此分支；复用子系统 A 的弹窗/Codex 代码；最终与子系统 A 一起 merge）。
- **TS strict / ESM**：所有 import 带 `.js` 扩展名。禁用 `any`（bridge/DOM 边界 `as any` 例外）。
- **零图片资源**：所有新图标都是 `sprites.ts` 的 16×16 字符串矩阵（M/D/L/E/K/W/C/G/N 码），走 `buildPalette(color)` 派生调色板。不引入 PNG/SVG/字体图标。
- **rarity 策略**：类型色为基 + rarity 增强明度/饱和（保类型色相识别）。rarity 5（无尽）用紫 `#9b5de5`。地图 rarity≥4 金光晕保留。
- **subType 可选**：catalog 加 `subType?: string`，旧存档无 subType 时 `pickItemTemplate` 回退默认模板，无迁移。
- **i18n**：新文案双语 `{en,zh}`，dotted 前缀。helper：`t`/`tMsg`/`tx`。
- **测试**：vitest，mock 仿 `src/__tests__/codex.test.ts`。运行 `npx vitest run`（全量）/ `npx vitest run <file>`（聚焦）。
- **不破现有**：地图 sprite 渲染逻辑（drawItemSprite）只在 sig 加 subType，不改绘制；item-gen 除武器/护甲/饰品的 `c` 外不动。

---

## File Structure

| 文件 | 责任 | 动作 |
|---|---|---|
| `src/utils.ts` 或 `src/sprites.ts` | `rarityTint(base,rarity)` 颜色工具 | Modify/Create |
| `src/item-gen.ts:40,50,57` | 武器/护甲/饰品 `c` 改用 rarityTint | Modify |
| `src/sprites.ts` | `pickItemTemplate` 返回 key、新增 `itemSpriteKind`/`paintItemIcon`、扩 TEMPLATES、遗物路由 | Modify |
| `src/types.ts` | 目录类型加 `subType?`、RelicDef 加 `spriteKind?` | Modify |
| `src/data.ts` | catalog 填 subType + 遗物 spriteKind | Modify（subagent 批量） |
| `src/panels.ts:83` | 背包 renderInv glyph → paintItemIcon | Modify |
| `src/items.ts:287` | renderHotbar glyph → paintItemIcon | Modify |
| `src/item-intro.ts:106` | renderCard 普通道具 glyph → paintItemIcon | Modify |
| `src/ui-panels.ts:241-269` | Codex renderItemSection 加 sprite | Modify |
| `src/item-intro.ts:81` + `src/panels.ts`(遗物行) | 遗物 emoji → paintItemIcon | Modify |
| `style/main.css` | `.lic` canvas pixelated + hotbar 图标尺寸 | Modify |
| `src/__tests__/item-icons.test.ts` | rarityTint + itemSpriteKind + subType 完整性 | Create |
| `index.html` | （若需）hotbar canvas 基础样式 | Modify |

---

## Task 1: rarityTint 工具 + item-gen 武器/护甲/饰品换色

**Files:**
- Create/Modify: `src/sprites.ts`（加 `rarityTint`，复用其内部 `lighten`/`darken`）或 `src/utils.ts`（加 `lighten`/`rarityTint`）
- Modify: `src/item-gen.ts:40,50,57`（武器/护甲/饰品 `c`）+ `src/item-gen.ts:147,151`（genEndlessGear 三分支，rarity 5 紫）
- Test: `src/__tests__/item-icons.test.ts`（Create）

**Interfaces:**
- Produces: `rarityTint(base: string, rarity: number): string` —— 类型基色 + rarity 增强。rarity 5 返回 `#9b5de5`；rarity 0 偏暗（darken ~0.7）；rarity 3-4 增亮（lighten ~0.3）；rarity 1-2 接近基色。
- 武器基色 `#f4845f`、护甲 `#7ec8e3`、饰品 `#06d6a0`（保留为常量）。

- [ ] **Step 1: 写失败测试**（Create `src/__tests__/item-icons.test.ts`）

```ts
import { describe, it, expect, vi } from 'vitest';
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../state.js', () => ({ lang: 'en' }));

import { rarityTint } from '../sprites.js';

describe('rarityTint', () => {
  it('rarity 5 (endless) returns void purple', () => {
    expect(rarityTint('#f4845f', 5)).toBe('#9b5de5');
  });
  it('higher rarity → lighter (more luminance)', () => {
    const r0 = rarityTint('#f4845f', 0);
    const r4 = rarityTint('#f4845f', 4);
    // r4 should be lighter than r0 (parse rgb, compare sum)
    const lum = (s: string) => { const m = s.match(/\d+/g)!; return +m[0] + +m[1] + +m[2]; };
    expect(lum(r4)).toBeGreaterThan(lum(r0));
  });
  it('deterministic (same input → same output)', () => {
    expect(rarityTint('#06d6a0', 3)).toBe(rarityTint('#06d6a0', 3));
  });
  it('preserves hue family roughly (weapon stays warm)', () => {
    // r-channel dominant over b-channel for the warm weapon base
    const m = rarityTint('#f4845f', 2).match(/\d+/g)!;
    expect(+m[0]).toBeGreaterThan(+m[2]);
  });
});
```

- [ ] **Step 2: 跑测试验证失败**

Run: `cd /e/claude/darkhollow && npx vitest run src/__tests__/item-icons.test.ts`
Expected: FAIL —— `rarityTint is not a function`（未 export）。

- [ ] **Step 3: 实现 rarityTint**（Modify `src/sprites.ts`，在 `buildPalette` 附近，复用其 `lighten`/`darken`）

```ts
// Type-base color + rarity luminance boost. Preserves hue family so weapon/armor/
// accessory stay recognizable; rarity stretches lightness. rarity 5 (endless) → void purple.
export function rarityTint(base: string, rarity: number): string {
  if (rarity >= 5) return '#9b5de5';
  switch (rarity) {
    case 0: return darken(base, 0.70);
    case 1: return darken(base, 0.88);
    case 2: return base;
    case 3: return lighten(base, 0.18);
    default: return lighten(base, 0.34);   // rarity 4
  }
}
```
（若 sprites.ts 内部的 `lighten`/`darken` 未 export，在同文件内直接用；rarityTint 必须 `export`。）

- [ ] **Step 4: item-gen 武器/护甲/饰品换色**（Modify `src/item-gen.ts`）

import 加 `rarityTint`：
```ts
import { rarityTint } from './sprites.js';
```
genWeapon（L40）：`c: '#f4845f'` → `c: rarityTint('#f4845f', b.r)`
genArmor（L50）：`c: '#7ec8e3'` → `c: rarityTint('#7ec8e3', b.r)`
genAcc（L57）：`c: '#06d6a0'` → `c: rarityTint('#06d6a0', b.r)`
genEndlessGear 三分支（L147/151/154）：武器/护甲的 `c: '#9b5de5'`/`'#7ec8e3'` → 保持 rarity 5（紫 `#9b5de5`），饰品 `'#06d6a0'` → `'#9b5de5'`（endless 统一紫）。或调 `rarityTint(base, 5)`。

- [ ] **Step 5: 跑测试 + tsc + 全量**

Run: `cd /e/claude/darkhollow && npx vitest run src/__tests__/item-icons.test.ts && npx tsc --noEmit && npx vitest run`
Expected: 新测试 GREEN；tsc 0；全量绿（注意：现有测试若断言固定颜色值需同步更新——grep `#f4845f` 等看测试是否硬编码）。

- [ ] **Step 6: Commit**

```bash
git add src/sprites.ts src/item-gen.ts src/__tests__/item-icons.test.ts
git commit -m "feat(item-icons): rarityTint — type-base color + rarity luminance boost for gear"
```

---

## Task 2: paintItemIcon 基础设施 + 接入背包/Hotbar

**Files:**
- Modify: `src/sprites.ts`（`pickItemTemplate` 返回 `{tpl,key}`；新增 `itemSpriteKind` + `paintItemIcon`）
- Modify: `src/panels.ts:83`（背包 renderInv）、`src/items.ts:287`（renderHotbar）
- Modify: `style/main.css`（`.lic` canvas pixelated + hotbar 图标）
- Test: 扩展 `src/__tests__/item-icons.test.ts`

**Interfaces:**
- Produces:
  - `itemSpriteKind(item: Item): string` —— 返回 TEMPLATES key（如 `W_SWORD`/`I_SHIELD`/`P_HEALTH`）。
  - `paintItemIcon(target: HTMLCanvasElement, item: Item): void` —— `paintIcon(target, itemSpriteKind(item), item.c)` 的封装，HTML 面板统一入口。
  - `drawItemSprite`（sprites.ts:1104）改用 `pickItemTemplate` 返回的 `{tpl,key}`，sig 用 key。

- [ ] **Step 1: 加测试**（追加 `src/__tests__/item-icons.test.ts`）

```ts
import { itemSpriteKind } from '../sprites.js';
import { ALL_WEAPONS, ALL_POTIONS } from '../data.js';
import { genWeapon, genPotion } from '../item-gen.js';

describe('itemSpriteKind', () => {
  it('a sword maps to W_SWORD', () => {
    const it = genWeapon(1);
    expect(itemSpriteKind(it)).toMatch(/^W_/);
  });
  it('a heal potion maps to P_HEALTH', () => {
    const it = { type: 'potion', ef: 'heal', c: '#e63946', rarity: 0 } as any;
    expect(itemSpriteKind(it)).toBe('P_HEALTH');
  });
  it('armor maps to I_SHIELD (pre-W2 default)', () => {
    const it = { type: 'armor', c: '#7ec8e3', rarity: 0 } as any;
    expect(itemSpriteKind(it)).toBe('I_SHIELD');
  });
});
```

- [ ] **Step 2: 跑测试验证失败**（itemSpriteKind 未 export）

- [ ] **Step 3: 改 pickItemTemplate 返回 {tpl,key} + 新增 itemSpriteKind/paintItemIcon**（Modify `src/sprites.ts`）

把 `pickItemTemplate`（L1084）+ `pickWeaponTemplate`（L1073）改为返回 `{ tpl: Template; key: string }`（仿 `pickEnemyTemplate` L1067）。`drawItemSprite`（L1104）改：
```ts
export function drawItemSprite(c, x, y, item) {
  const { tpl, key } = pickItemTemplate(item);
  const sig = key + ':' + item.c;   // sig 用 key（含未来 subType）
  blitOutlined(c, x, y, getSprite(tpl, buildPalette(item.c), sig), sig);
}
export function itemSpriteKind(item: Item): string {
  return pickItemTemplate(item).key;
}
export function paintItemIcon(target: HTMLCanvasElement, item: Item): void {
  paintIcon(target, itemSpriteKind(item), item.c);
}
```
（各 case 的 `return TEMPLATES.X` 改为 `return { tpl: TEMPLATES.X, key: 'X' }`。）

- [ ] **Step 4: 接入背包 renderInv**（Modify `src/panels.ts:83`）

把 `<span style="color:${it.c}">${it.ch}</span>` 换成 `<canvas class="lic" width="16" height="16" data-idx="${p.inv.indexOf(it)}"></canvas>`。renderInv 末尾（innerHTML 后）加：
```ts
name.querySelectorAll<HTMLCanvasElement>('canvas.lic').forEach(cv => {
  const idx = +(cv.dataset.idx || 0); paintItemIcon(cv, p.inv[idx]);
});
```
（注意 renderInv 的 DOM 结构 —— 若 name 是行内 span，canvas 需 inline-block；按实际结构调整。）

- [ ] **Step 5: 接入 renderHotbar**（Modify `src/items.ts:287`）

`<span class="hb-icon" style="color:${item.c}">${item.ch}</span>` → `<canvas class="lic hb-icon" width="16" height="16" data-slot="${i}"></canvas>`。renderHotbar 末尾加遍历（hotbar 容器 querySelectorAll canvas.lic → paintItemIcon(cv, quickSlots[+cv.dataset.slot])）。

- [ ] **Step 6: CSS**（Modify `style/main.css`）

```css
canvas.lic { image-rendering: pixelated; vertical-align: middle; }
.hb-slot canvas.hb-icon { width: 20px; height: 20px; }  /* 15px→20px 防糊 */
```

- [ ] **Step 7: 跑测试 + tsc + 全量 + 手动**

Run: `cd /e/claude/darkhollow && npx vitest run src/__tests__/item-icons.test.ts && npx tsc --noEmit && npx vitest run`
手动（dev server HMR）：开背包 → 道具显示像素 sprite（非字符）；Hotbar 图标清晰。

- [ ] **Step 8: Commit**

```bash
git add src/sprites.ts src/panels.ts src/items.ts style/main.css src/__tests__/item-icons.test.ts
git commit -m "feat(item-icons): paintItemIcon + wire inventory & hotbar to pixel sprites"
```

---

## Task 3: paintItemIcon 接入拾取弹窗 + Codex 图鉴

**Files:**
- Modify: `src/item-intro.ts:106`（renderCard 普通道具图标）、`:81`（遗物图标暂保留，Task 6 统一）
- Modify: `src/ui-panels.ts:241-269`（renderItemSection 加 sprite）

**Interfaces:**
- Consumes: `paintItemIcon`（Task 2）。

- [ ] **Step 1: 接入 renderCard 普通道具**（Modify `src/item-intro.ts`）

import 加 `paintItemIcon`。renderCard 普通道具分支（L104-113）的图标 `<div ...>${item.ch}</div>` 换成 `<canvas class="lic intro-icon" width="16" height="16"></canvas>`，并在 showNext 渲染后遍历调 paintItemIcon（content 容器 querySelectorAll）。
（遗物分支 L81 暂保留 `def.ch`，Task 6 统一。）

- [ ] **Step 2: 接入 Codex renderItemSection**（Modify `src/ui-panels.ts`）

import 加 `paintItemIcon`。renderItemSection 每行（L255 / L264）的 `name` 前加 `<canvas class="lic codex-icon" width="16" height="16" data-type="${type}" data-id="${d.id||''}"></canvas>`（遗物 `data-type="relic"` `data-id="${r.id}"`）。renderCodex 末尾遍历 canvas.lic → 反查 catalog def → paintItemIcon。
（反查 def：复用 item-intro.ts 的 `findCatalogDef` 或直接 data-type+id 查表；构造一个最小 Item-like `{type, id, c}` 给 paintItemIcon —— 注意 paintItemIcon 需要 item.c，catalog def 的颜色武器/护甲/饰品现在没存 c，用 rarityTint(typeBase, def.r) 推导，或加一个 `catalogIconColor(def)` 辅助。）

- [ ] **Step 3: 处理 catalog def 无 c 的问题**

武器/护甲/饰品 def 无 `c` 字段。Codex 图标需要一个颜色。新增辅助 `catalogSpriteColor(def, type)`：武器 `rarityTint('#f4845f', def.r)`、护甲 `rarityTint('#7ec8e3', def.r)`、饰品 `rarityTint('#06d6a0', def.r)`、药水/卷轴/消耗品/食物用 def.c、遗物用 def.c。Codex 遍历时用它构造 `{type, id, c: catalogSpriteColor(...)}` 传 paintItemIcon。

- [ ] **Step 4: tsc + 全量 + 手动**

Run: `cd /e/claude/darkhollow && npx tsc --noEmit && npx vitest run`
手动：拾取弹窗显示 sprite；Codex 道具 tab 每行有 sprite（未发现的 🔒 行无 canvas 或空 canvas）。

- [ ] **Step 5: Commit**

```bash
git add src/item-intro.ts src/ui-panels.ts src/sprites.ts
git commit -m "feat(item-icons): wire pickup popup & Codex items tab to pixel sprites"
```

---

## Task 4: catalog 加 subType 字段 + 填充 + integrity 测试

**Files:**
- Modify: `src/types.ts`（目录类型加 `subType?: string`）
- Modify: `src/data.ts`（填 subType：护甲/饰品/卷轴/食物/消耗品）
- Test: 扩展 `src/__tests__/item-data-integrity.test.ts`

**Interfaces:**
- Produces: catalog 各护甲/饰品/卷轴/食物/消耗品条目含合法 `subType`。
- subType 词表：护甲 `plate`/`leather`/`cloak`/`robe`/`scale`；饰品 `ring`/`amulet`/`brooch`/`crown`；卷轴 `fire`/`frost`/`arcane`/`holy`/`nature`；食物 `meat`/`bread`/`fruit`/`feast`；消耗品 `bomb`/`trap`/`pouch`/`tool`。

> **执行方式**：subagent 批量补 subType（按类别），主 agent 收口。subagent 读 data.ts 按条目语义分配 subType，产出 JSON，主 agent 回填。

- [ ] **Step 1: 加 subType 字段**（Modify `src/types.ts`）

`ArmorDef`/`AccessoryDef`/`ScrollDef`/`ConsumableDef`/`FoodDef` 各加 `subType?: string`。

- [ ] **Step 2: 写 integrity 测试**（追加 `src/__tests__/item-data-integrity.test.ts`）

```ts
import { ALL_ARMORS, ALL_ACCESSORIES, ALL_SCROLLS, ALL_CONSUMABLES, FOODS } from '../data.js';

describe('catalog subType integrity', () => {
  const VALID: Record<string, string[]> = {
    armor: ['plate','leather','cloak','robe','scale'],
    accessory: ['ring','amulet','brooch','crown'],
    scroll: ['fire','frost','arcane','holy','nature'],
    consumable: ['bomb','trap','pouch','tool'],
    food: ['meat','bread','fruit','feast'],
  };
  it('every armor/accessory/scroll/consumable/food has a valid subType', () => {
    const tables: [string, { subType?: string }[]][] = [
      ['armor', ALL_ARMORS], ['accessory', ALL_ACCESSORIES], ['scroll', ALL_SCROLLS],
      ['consumable', ALL_CONSUMABLES], ['food', FOODS],
    ];
    for (const [t, arr] of tables) for (const d of arr) {
      expect(d.subType, `${t} missing subType`).toBeTruthy();
      expect(VALID[t], `${t} invalid subType ${d.subType}`).toContain(d.subType);
    }
  });
});
```

- [ ] **Step 3: 跑测试验证失败**（subType 未填）

- [ ] **Step 4: 派 subagent 填 subType**（按类别，≤3 并发）

prompt 模板："读 `E:\claude\darkhollow\src\data.ts` 的 `<类别>` 数组，为每条按其语义分配 subType（词表：…）。只输出 JSON `[{idx, subType}]`，不改 data.ts。" 波：护甲+饰品 / 卷轴+食物+消耗品。主 agent 收口回填。

- [ ] **Step 5: 跑 integrity + tsc + 全量**

Run: `cd /e/claude/darkhollow && npx vitest run src/__tests__/item-data-integrity.test.ts && npx tsc --noEmit && npx vitest run`
Expected: 全绿。

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/data.ts src/__tests__/item-data-integrity.test.ts
git commit -m "feat(item-icons): add subType field to catalogs + integrity guard"
```

---

## Task 5: 子类型模板 ~20-25 + pickItemTemplate 按 subType 路由

**Files:**
- Modify: `src/sprites.ts`（TEMPLATES 加 `I_PLATE`/`I_LEATHER`/`I_CLOAK`/`I_ROBE`/`I_SCALE`/`I_AMULET`/`I_BROOCH`/`I_CROWN`/`SC_FIRE`/`SC_FROST`/.../`FD_MEAT`/... 等；pickItemTemplate 按 subType 路由）
- Modify: `src/sprites.ts` drawItemSprite sig（含 subType，已在 Task 2 改 key，这里 pickItemTemplate 的 key 加 subType）

> **执行方式**：subagent 按类别并行画 16×16 矩阵（仿现有 I_SHIELD/I_RING 格式），主 agent 收口 + 改路由。

- [ ] **Step 1: 派 subagent 画模板**（按类别，≤3 并发）

prompt 模板（每类一个 subagent）："为 darkhollow 画 `<类别>` 的像素 sprite 模板，16×16 字符串矩阵（16 行 × 16 字符），用调色板码 M(主)/D(暗)/L(亮)/E(发光橙)/K(描边黑)/W(白)/G(金)/N(棕)/C(灰)。风格匹配现有 `I_SHIELD`/`I_RING`（同密度、K 描边、M 主色 + L 高光）。需要这些子类型：<列表>。每个输出 `{key: 'I_PLATE', rows: [...]}`。只输出 JSON，不改 sprites.ts。"
- 波 1：护甲 5（plate/leather/cloak/robe/scale）
- 波 2：饰品 4（amulet/brooch/crown；ring 复用 I_RING）
- 波 3：卷轴 4（fire/frost/arcane/holy）+ 食物 4（meat/bread/fruit/feast）
- 波 4：消耗品细分（trap/tool 等，bomb 复用 C_BOMB，pouch 复用 C_POUCH）

- [ ] **Step 2: 主 agent 收口回填 TEMPLATES**

校验每个矩阵（16×16、码合法、风格统一），回填 sprites.ts TEMPLATES。

- [ ] **Step 3: pickItemTemplate 按 subType 路由**（Modify `src/sprites.ts:1084`）

```ts
case 'armor': {
  const k = 'I_' + (item.subType || 'shield').toUpperCase();  // I_PLATE/I_LEATHER/.../I_SHIELD
  return { tpl: TEMPLATES[k] || TEMPLATES.I_SHIELD, key: k };
}
case 'accessory': {
  const k = 'I_' + (item.subType === 'ring' ? 'RING' : (item.subType || 'ring').toUpperCase());
  return { tpl: TEMPLATES[k] || TEMPLATES.I_RING, key: k };
}
case 'scroll': {
  const k = item.subType ? 'SC_' + item.subType.toUpperCase() : 'I_SCROLL';
  return { tpl: TEMPLATES[k] || TEMPLATES.I_SCROLL, key: k };
}
// food/consumable 同理
```

- [ ] **Step 4: tsc + 全量 + 手动**

Run: `cd /e/claude/darkhollow && npx tsc --noEmit && npx vitest run`
手动：同类不同 subType 道具显示不同形状（板甲 vs 皮甲 vs 法袍）。

- [ ] **Step 5: Commit**

```bash
git add src/sprites.ts
git commit -m "feat(item-icons): ~20 subtype sprite templates + subType routing"
```

---

## Task 6: 遗物 sprite（emoji → 像素）

**Files:**
- Modify: `src/types.ts`（`RelicDef` 加 `spriteKind?: string`）
- Modify: `src/data.ts`（26 圣物填 spriteKind，按 theme/effect 分类）
- Modify: `src/sprites.ts`（TEMPLATES 加 `R_ATTACK`/`R_DEFENSE`/`R_ARCANE`/`R_SOUL`/`R_NATURE`/`R_VOID`/... ~8-10；pickItemTemplate 增 relic 或 `pickRelicTemplate`）
- Modify: `src/item-intro.ts:81`（遗物图标 emoji → paintItemIcon）、`src/panels.ts`（遗物行）、`src/ui-panels.ts`（Codex 遗物段）

> **执行方式**：subagent 画 ~8-10 遗物主题模板 + 按圣物 effect/theme 分配 spriteKind。

- [ ] **Step 1: 设计遗物主题分类 + spriteKind 映射**

26 圣物按 effect/theme 分 ~8-10 类：`R_ATTACK`（executioners_axe/ember_core/...）、`R_DEFENSE`（stone_skin/warden_cloak/...）、`R_ARCANE`（arcane_focus/scholar_lens/...）、`R_SOUL`（soul_harvester/phoenix_heart/...）、`R_NATURE`（thorned_bramble/frost_heart/...）、`R_VOID`（void_heart/abyss_eye/chaos_egg/...）、`R_UTILITY`（greed_idol/wind_step/...）。主 agent 定映射表。

- [ ] **Step 2: 派 subagent 画遗物模板**（≤3 并发）

prompt："为 darkhollow 画遗物主题 sprite，16×16 矩阵（同 I_SHIELD 格式 + 调色板码）。主题：<列表>。每个遗物主题应比普通道具更精致（可用 E 发光码 + G 金强调）。输出 `{key, rows}[]`。"

- [ ] **Step 3: 回填 TEMPLATES + RelicDef.spriteKind**

data.ts 每个圣物加 `spriteKind: 'R_ATTACK'` 等。sprites.ts 加 R_* 模板。

- [ ] **Step 4: 遗物路由 + 接入**

sprites.ts `pickItemTemplate` 不处理 relic（relic 不是 Item）。新增 `paintRelicIcon(target, def)` = `paintIcon(target, def.spriteKind || 'R_UTILITY', def.c)`。item-intro.ts:81 遗物图标 `def.ch` → `<canvas class="lic" data-relic="${def.id}">` + paintRelicIcon。panels.ts 遗物行 + ui-panels.ts Codex 遗物段同理。

- [ ] **Step 5: tsc + 全量 + 手动**

Run: `cd /e/claude/darkhollow && npx tsc --noEmit && npx vitest run`
手动：圣物显示像素 sprite（无 emoji）；不同主题圣物形状不同。

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/data.ts src/sprites.ts src/item-intro.ts src/panels.ts src/ui-panels.ts
git commit -m "feat(item-icons): relic sprites (emoji → pixel) themed by effect"
```

---

## Task 7: 全量验证 + 冒烟

**Files:** 全项目

- [ ] **Step 1: sprite cache 性能检查**

dev server 下开背包/Codex，devtools console 看 `spriteCache.size` 稳定（<200 条目，不膨胀）。

- [ ] **Step 2: tsc + 全量测试**

Run: `cd /e/claude/darkhollow && npx tsc --noEmit && npx vitest run`
Expected: 0 error + 全绿。

- [ ] **Step 3: 冒烟（dev server）**

1. 地图道具 = 背包/Hotbar/弹窗/Codex 图标**完全一致**（同 sprite）。
2. 同类不同 rarity 道具颜色有差异（普通暗、史诗亮、无尽紫）。
3. 同类不同 subType 形状不同（板甲 vs 法袍）。
4. 圣物显示像素 sprite（无 emoji），不同主题形状不同。
5. Hotbar 图标清晰（pixelated，20px）。
6. 中英切换图标不变（sprite 与语言无关）。

- [ ] **Step 4: Commit + 分支收尾**

```bash
git add -A && git commit -m "test(item-icons): full validation green" --allow-empty
```
（merge 决策与子系统 A 一起，由用户确认。）

---

## Self-Review 记录

- **Spec coverage**：spec §W1 渲染统一+rarity → Task 1/2/3；§W2 子类型模板 → Task 4/5；§W3 遗物 sprite → Task 6；§W4 验证 → Task 7。全覆盖。
- **Placeholder**：模板矩阵由 subagent 产出（Task 5/6 指引），非占位 —— 给了格式 + 风格 + 输出契约。
- **Type 一致性**：`rarityTint(base,rarity):string`、`itemSpriteKind(item):string`、`paintItemIcon(target,item)`、`paintRelicIcon(target,def)`、`catalogSpriteColor(def,type)` 跨 task 签名一致。
