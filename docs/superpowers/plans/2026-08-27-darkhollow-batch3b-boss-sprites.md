# 批3B：Boss 专属模板 + 地图实体 sprite 化 + 净化入 Clean 反馈 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 9 Boss 各得专属 16×16 像素模板（消解同剪影/撞紫），8 事件站+3 商人从 C_POUCH 撞脸改为专属 sprite，净化打回 clean 档时补齐反馈。

**Architecture:** 照 batch2 ⑥ 的 `spriteKind` 显式路由先例——BossDef/EnemyDef/Enemy/EventSiteDef 加 `spriteKind` 字段，`drawBossSprite` 加可选参+fallback，`drawItemSprite` 引入 `ENTITY_PAL` 固定多色 palette 表（收编死代码 CHEST_PAL）。模板数据全进 `sprites.ts` 的 `TEMPLATES`（`Record<string, Template>`，`Template = string[]` 16 行×16 字符）。零行为变更（除 T4 反馈分支）。

**Tech Stack:** TypeScript + Canvas 2D + Vite；vitest + happy-dom（无 canvas2d——渲染逻辑靠 shape/routing/real-data 单测 + 游戏内 e2e PIL 判据）。

**Spec:** `docs/superpowers/specs/2026-08-27-batch3b-boss-sprites-design.md`

## Global Constraints

- 分支 `feat/batch3b-boss-sprites`（spec commit `2c8a283` 已在其上）。每 task 一 commit，message 前缀 `feat(sprites)`/`feat(nav)` 惯例照批3A（`feat(batch3b)` 可）。
- **模板纪律**：每模板 16 行、每行**恰好 16 字符**；字母含义在 palette 表里定义；`K` 惯用描边黑 `#140a0a`。`sprites.test.ts` 的 shape 守卫遍历 `Object.keys(TEMPLATES)` 自动覆盖所有新键——新增模板不需要为 shape 单独写测。
- **测试计数规则**：基线 **439**（49 文件）。本计划新增测试数按 task 标注；任何测计数疑问一律"基线+N"重算，不信任累计预测。
- **执行顺序**：T1 → T2 → T3 严格串行（同改 `sprites.ts` TEMPLATES 段必撞——[[subagent-parallel-gotchas]]）；T4 与 T2/T3 文件不叠可并行；T5 最后。若撞 GLM 429 杀 subagent：主 Agent 内联接手 + 自审（6b/6d/POLISH-A 先例），final opus 兜底。
- **门禁**：每 task 收尾 `npx tsc --noEmit && npx vitest run`（显式核 exit code，防 `&&` 链被管道掩码——批2 Phase2/3 教训）；全批收尾 `npm run build` + smoke 65 + e2e。
- **i18n**：新增键照 `cb.tierCleansed` 风格（🟢 前缀、半角逗号内句号中文句号）；本批仅 T4 加 1 键。
- **不动清单**：Boss 的 thickness=2 描边/金 aura/金血条/深红底（render.ts:106-131）、NPC 实体描边框背景（render.ts:311-314）、`ch` 字段全库保留、minimap 不动。

---

### Task 1: 路由地基（类型 + drawBossSprite 扩参 + ENTITY_PAL + makeEnemy 拷贝）

**Files:**
- Modify: `src/types.ts:201-216`（EnemyDef）、`src/types.ts:218-252`（BossDef）、`src/types.ts:257-297`（Enemy）
- Modify: `src/enemy-factory.ts:53-56`（makeEnemy meta 拷贝）
- Modify: `src/sprites.ts:1588-1596`（drawBossSprite）、`src/sprites.ts:1487`（CHEST_PAL 区）、`src/sprites.ts:1698-1706`（drawItemSprite）
- Modify: `src/render.ts:122`
- Test: `src/__tests__/batch3b-sprites.test.ts`（新建）、`src/__tests__/makeEnemy.test.ts`（扩展）

**Interfaces:**
- Consumes: 现有 `TEMPLATES: Record<string, Template>`（sprites.ts:17）、`buildPalette(main: string): Record<string,string>`、`getSprite(tpl, pal, sig)`、`blitOutlined(c, x, y, sprite, sig, thickness)`。
- Produces（后续 task 依赖的精确签名）:
  - `drawBossSprite(c: CanvasRenderingContext2D, x: number, y: number, color: string, spriteKind?: string): void`
  - `export const ENTITY_PAL: Record<string, Record<string, string>>`（sprites.ts 导出，测试硬门用）
  - `BossDef.spriteKind?: string` / `EnemyDef.spriteKind?: string` / `Enemy.spriteKind?: string`
  - makeEnemy 产出实例携带 `spriteKind?: string`

- [ ] **Step 1: 写失败测试**（新建 `src/__tests__/batch3b-sprites.test.ts`）

```ts
// 批3B: boss/entity sprite 路由地基守卫。
import { describe, it, expect } from 'vitest';
import { TEMPLATES, ENTITY_PAL, pickItemTemplate } from '../sprites.js';
import { makeEnemy } from '../enemy-factory.js';
import { BOSSES } from '../data.js';

describe('batch3b routing foundation', () => {
  it('ENTITY_PAL exported and absorbs CHEST (multi-hue chest palette wired)', () => {
    expect(ENTITY_PAL['CHEST']).toBeDefined();
    expect(ENTITY_PAL['CHEST']['K']).toBe('#140a0a');
    expect(ENTITY_PAL['CHEST']['G']).toBe('#ffd54a');
  });
  it('makeEnemy copies spriteKind from def to instance', () => {
    const bd = BOSSES[0];
    const e = makeEnemy({ ...bd, spriteKind: 'B_PROBE' } as never, 3, 3, 1, { isBoss: true });
    expect(e.spriteKind).toBe('B_PROBE');
  });
  it('makeEnemy without spriteKind leaves instance field undefined', () => {
    const e = makeEnemy({ n: { en: 'X', zh: 'X' }, ch: 'x', c: '#fff', hp: 5, atk: 1, def: 0, exp: 1, g: [1, 2], ai: 'chase', mf: 1 } as never, 1, 1, 1);
    expect(e.spriteKind).toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑测确认失败**

Run: `npx vitest run src/__tests__/batch3b-sprites.test.ts`
Expected: FAIL —— `ENTITY_PAL` 未导出（import 报 undefined / `e.spriteKind` undefined）。

- [ ] **Step 3: 实现**

① `src/types.ts` 三处各加一行（带注释）：

```ts
// EnemyDef（:213 `skill?: EnemySkill;` 后加）
  // 批3B: unique-model override — set on defs with a dedicated TEMPLATES entry.
  spriteKind?: string;
// BossDef（:229 `el?: Element;` 后加同样的两行）
// Enemy（:297 `tags?: string[];` 后加）
  // 批3B: copied from def by makeEnemy; legacy saves lack it (fallback path).
  spriteKind?: string;
```

② `src/enemy-factory.ts` makeEnemy 返回对象里 `ch: base.ch, c: base.c, x, y,` 行后加：

```ts
    spriteKind: base.spriteKind,
```

③ `src/sprites.ts` —— CHEST_PAL 定义行（:1487）改为 ENTITY_PAL 表并导出（保留原四键值不动，纯搬家）：

```ts
// 批3B: fixed multi-hue palettes for map entities, keyed by spriteKind.
// drawItemSprite prefers these over buildPalette(item.c); keys without an
// entry keep the single-hue derived path (backward compatible).
export const ENTITY_PAL: Record<string, Record<string, string>> = {
  CHEST: { K: '#140a0a', N: '#8a5a30', W: '#c89a5a', G: '#ffd54a' },
};
```

④ `drawItemSprite`（:1704）palette 行改：

```ts
  const pal = (item.spriteKind && ENTITY_PAL[item.spriteKind]) || buildPalette(item.c);
  blitOutlined(c, x, y, getSprite(tpl, pal, sig), sig);
```

⑤ `drawBossSprite`（:1590-1593）整函数替换：

```ts
export function drawBossSprite(c: CanvasRenderingContext2D, x: number, y: number, color: string, spriteKind?: string): void {
  // 批3B: per-boss template + fixed palette when routed; legacy saves / unknown
  // kinds fall back to the shared BOSS silhouette + single-hue palette.
  const sk = spriteKind && TEMPLATES[spriteKind] ? spriteKind : null;
  const sig = sk || ('BOSS:' + color);
  const pal = sk && BOSS_PAL[sk] ? BOSS_PAL[sk] : buildPalette(color);
  blitOutlined(c, x, y, getSprite(sk ? TEMPLATES[sk] : TEMPLATES.BOSS, pal, sig), sig, 2);
}
```

同文件加空表（T2 填充；放 ENTITY_PAL 定义之后）：

```ts
// 批3B: per-boss fixed palettes, keyed by BossDef.spriteKind. Populated in T2.
export const BOSS_PAL: Record<string, Record<string, string>> = {};
```

⑥ `src/render.ts:122` 改：

```ts
    if (e.isBoss) drawBossSprite(c, sx, sy + bob, ec, e.spriteKind); else drawEnemySprite(c, sx, sy + bob, ec, e);
```

- [ ] **Step 4: 跑测确认通过**

Run: `npx vitest run src/__tests__/batch3b-sprites.test.ts && npx tsc --noEmit; echo "exit:$?"`
Expected: 3 PASS；tsc exit 0。全量 `npx vitest run` 439 基线不降（本 task 净 +3）。

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/enemy-factory.ts src/sprites.ts src/render.ts src/__tests__/batch3b-sprites.test.ts
git commit -m "feat(sprites): spriteKind routing foundation — BossDef/Enemy field, drawBossSprite param, ENTITY_PAL absorbing CHEST_PAL (batch3b T1)"
```

---

### Task 2: 九个 Boss 专属模板 + BOSS_PAL + data 接线

**Files:**
- Modify: `src/sprites.ts`（TEMPLATES 尾部 `};` 前，:1399 附近 插 9 键；ENTITY_PAL/BOSS_PAL 区填 BOSS_PAL）
- Modify: `src/data.ts:257-303`（BOSSES 9 条各加 `spriteKind`）
- Test: `src/__tests__/batch3b-sprites.test.ts`（扩展）

**Interfaces:**
- Consumes: T1 的 `BOSS_PAL` 空表、`drawBossSprite(c,x,y,color,spriteKind?)`、`BossDef.spriteKind?`。
- Produces: TEMPLATES 键 `B_GOBLIN_KING/B_SPIDER_QUEEN/B_VAMPIRE_LORD/B_ELDER_LICH/B_DRAGON_EMPEROR/B_LEVIATHAN/B_VOID_SOVEREIGN/B_CREATOR/B_MYCONID`；`BOSS_PAL` 同名 9 键。

- [ ] **Step 1: 写失败测试**（batch3b-sprites.test.ts 追加）

```ts
describe('batch3b boss templates (real-data gate)', () => {
  it('every BOSSES def has a spriteKind that resolves to template + palette', () => {
    expect(BOSSES.length).toBe(9);
    for (const b of BOSSES) {
      expect(b.spriteKind, b.n.en).toBeDefined();
      expect(TEMPLATES[b.spriteKind!], b.n.en).toBeDefined();
      expect(BOSS_PAL[b.spriteKind!], b.n.en).toBeDefined();
    }
  });
  it('boss templates are pairwise distinct (no shared row arrays)', () => {
    const arrs = BOSSES.map(b => TEMPLATES[b.spriteKind!]);
    expect(new Set(arrs).size).toBe(9);
  });
});
```

文件顶部 import 行补 `BOSS_PAL`：`import { TEMPLATES, ENTITY_PAL, BOSS_PAL, pickItemTemplate } from '../sprites.js';`

- [ ] **Step 2: 跑测确认失败**

Run: `npx vitest run src/__tests__/batch3b-sprites.test.ts`
Expected: FAIL —— BOSSES 无 spriteKind（`expect(b.spriteKind).toBeDefined()` 红）。

- [ ] **Step 3: 画模板 + 填 BOSS_PAL + 接 data**

**样例（结构参考，可直接作为 B_GOBLIN_KING v1 落盘；正式稿允许在锚点内精修）**——满幅构图、K 描边、palette 字母自定义、每行恰好 16 字符：

```ts
  // 批3B: 哥布林王 — 歪冠/尖耳/宽壮身板（金冠红眼白獠牙）。
  B_GOBLIN_KING: [
    "................",
    "....Y...Y...Y...",
    "....YYYYYYYY....",
    "...KKKKKKKKKK...",
    "..KGGGGGGGGGGK..",
    ".KKGGGGGGGGGGKK.",
    "KGGGRRGGGGRRGGGK",
    "KGGGGGGGGGGGGGGK",
    ".KKGGDDDDDDGGKK.",
    "..KKGGWWGGWWKK..",
    "...KKKKKKKKKK...",
    "..KGGGGGGGGGGK..",
    ".KGGYGGGGGGYGGK.",
    ".KGGGGGGGGGGGGK.",
    ".KDGGKKKKKKGGDK.",
    "..KK...KK...KK..",
  ],
```

```ts
  B_GOBLIN_KING: { K: '#140a0a', G: '#5da83a', D: '#3d7326', Y: '#ffd54a', R: '#ff4b4b', W: '#eaeaf0' },
```

**其余 8 个按锚点表创作**（每模板一段注释写锚点；palette 字母自由命名但须全字母有映射）：

| 键 | 剪影锚点 | 色彩锚点（palette 必含） |
|---|---|---|
| B_SPIDER_QUEEN | 上身直立+两侧 4 对展开步足+下腹卵袋 | 紫身 #8a2be2 系+白卵 #eaeaf0 |
| B_VAMPIRE_LORD | 竖高领口+披风下摆展开+獠牙 | 黑袍 #1a1a24+红内衬/红眼 #dc143c |
| B_ELDER_LICH | 骷髅头(黑眼窝绿火)+右侧长杖+曳地袍（与 CASTER 区分：骨感+杖） | 紫袍 #9932cc 系+绿火 #7fff5e |
| B_DRAGON_EMPEROR | 双翼收拢两侧+双角+吻部前伸+尾（与 DRAGON 区分：角冠+体量满幅） | 橙鳞 #ff8c00 系+金角 #ffd54a |
| B_LEVIATHAN | S 形蛇形长体纵贯+背鳍锯齿+巨口 | 青蓝 #00ced1 系+白腹 #eaeaf0 |
| B_VOID_SOVEREIGN | 人形但轮廓撕裂缺口+悬浮断冠+周身斜裂纹 | 暗紫体 #4a0d78+品红裂纹 #ff2bd6 |
| B_CREATOR | 头顶光环+几何对称宽袍+无面部 | 纯白袍 #f5f5f5+金环 #ffd700 |
| B_MYCONID | 大蘑菇冠盖+粗短干体+底部菌根须（与 FUNGI 区分：冠盖体量+斑点） | 菌紫 #9370db+荧光青斑 #52f2d8 |

data.ts 9 条各加一行（示例=Goblin King，其余 8 条同位替换键名）：

```ts
  { n: { en: 'Goblin King', zh: '哥布林王' }, ch: '♚', c: '#ffd700', hp: 60, atk: 10, def: 4, exp: 100, g: [50, 80], fl: 5, spriteKind: 'B_GOBLIN_KING',
```

键名映射：F5→B_GOBLIN_KING / F10→B_SPIDER_QUEEN / F15→B_VAMPIRE_LORD / F20→B_ELDER_LICH / F25→B_DRAGON_EMPEROR / F30→B_LEVIATHAN / F35→B_VOID_SOVEREIGN / F40→B_CREATOR / fl:0→B_MYCONID。

- [ ] **Step 4: 跑测确认通过**

Run: `npx vitest run && npx tsc --noEmit; echo "exit:$?"`
Expected: 全绿 444（439+3 基础 +2 本 task——shape 由 sprites.test.ts 既有守卫自动覆盖新键）。

- [ ] **Step 5: Commit**

```bash
git add src/sprites.ts src/data.ts src/__tests__/batch3b-sprites.test.ts
git commit -m "feat(sprites): nine per-boss 16x16 templates + BOSS_PAL + data wiring (batch3b T2)"
```

---

### Task 3: 八事件站 + 三商人实体模板（含别名键）

**Files:**
- Modify: `src/sprites.ts`（TEMPLATES 尾部插 7 实体键+3 别名；ENTITY_PAL 填 10 键）
- Modify: `src/event-sites.ts:9-26`（EventSiteDef 加必填 spriteKind；8 行数据）
- Modify: `src/game.ts:107-112`（placeEntity 三商人调用传参）、`src/game.ts:126`（事件站 push 透传）
- Test: `src/__tests__/batch3b-sprites.test.ts`（扩展）

**Interfaces:**
- Consumes: T1 `ENTITY_PAL`、`pickItemTemplate` spriteKind-wins 分支（sprites.ts:1655）、`Item.spriteKind`（types.ts:181）。
- Produces: TEMPLATES 键 `ES_ALTAR_CURSED/ES_ALTAR_GAMBLER(别名)/ES_HOUSE/ES_COFFIN/ES_POOL/ES_STELE/ES_SEALED/ES_WELL/MERCHANT/MERCHANT_TREASURE(别名)/MERCHANT_ENDLESS(别名)`；`EventSiteDef.spriteKind: string`（required）。

- [ ] **Step 1: 写失败测试**（batch3b-sprites.test.ts 追加；import 行补 `import { EVENT_SITES } from '../event-sites.js';`）

```ts
describe('batch3b event-site & merchant entities', () => {
  it('every EVENT_SITES def has spriteKind resolving to template + ENTITY_PAL', () => {
    expect(EVENT_SITES.length).toBe(8);
    for (const s of EVENT_SITES) {
      expect(TEMPLATES[s.spriteKind], s.id).toBeDefined();
      expect(ENTITY_PAL[s.spriteKind], s.id).toBeDefined();
    }
  });
  it('shared-silhouette aliases reference the same rows (altar pair + merchant trio)', () => {
    expect(TEMPLATES['ES_ALTAR_GAMBLER']).toBe(TEMPLATES['ES_ALTAR_CURSED']);
    expect(TEMPLATES['MERCHANT_TREASURE']).toBe(TEMPLATES['MERCHANT']);
    expect(TEMPLATES['MERCHANT_ENDLESS']).toBe(TEMPLATES['MERCHANT']);
  });
  it('merchant trio gets three distinct ENTITY_PAL palettes', () => {
    const ps = ['MERCHANT', 'MERCHANT_TREASURE', 'MERCHANT_ENDLESS'].map(k => JSON.stringify(ENTITY_PAL[k]));
    expect(new Set(ps).size).toBe(3);
  });
});
```

- [ ] **Step 2: 跑测确认失败**

Run: `npx vitest run src/__tests__/batch3b-sprites.test.ts`
Expected: FAIL —— EventSiteDef 无 spriteKind 字段（tsc 也会红，属预期红）。

- [ ] **Step 3: 实现**

① `event-sites.ts`：接口加字段+8 行数据加值（整表替换）：

```ts
export interface EventSiteDef {
  id: EventSiteId;
  ch: string;        // fallback glyph (legacy saves render via type routing)
  c: string;         // glyph/frame color
  minFloor: number;
  once: boolean;     // once per run (G.eventFlags)
  spriteKind: string; // 批3B: TEMPLATES key — map rendering via pickItemTemplate
}

export const EVENT_SITES: EventSiteDef[] = [
  { id: 'cursed_altar',    ch: '⛧', c: '#c0392b', minFloor: 4,  once: true,  spriteKind: 'ES_ALTAR_CURSED' },
  { id: 'gambler_altar',   ch: '⚄', c: '#f39c12', minFloor: 3,  once: true,  spriteKind: 'ES_ALTAR_GAMBLER' },
  { id: 'trapped_npc',     ch: '⌂', c: '#7ec8e3', minFloor: 5,  once: true,  spriteKind: 'ES_HOUSE' },
  { id: 'ancient_remains', ch: '⚰', c: '#95a5a6', minFloor: 3,  once: false, spriteKind: 'ES_COFFIN' },
  { id: 'blood_pool',      ch: '♨', c: '#8b0000', minFloor: 8,  once: false, spriteKind: 'ES_POOL' },
  { id: 'ancient_stele',   ch: 'ᛘ', c: '#daa520', minFloor: 6,  once: true,  spriteKind: 'ES_STELE' },
  { id: 'sealed_box',      ch: '⊞', c: '#9b5de5', minFloor: 10, once: true,  spriteKind: 'ES_SEALED' },
  { id: 'sacrifice_well',  ch: '◍', c: '#06d6a0', minFloor: 7,  once: false, spriteKind: 'ES_WELL' },
];
```

② `sprites.ts` TEMPLATES 尾部插 7 键（锚点：祭坛=阶梯状石台+顶部供物；居所=坡顶小屋+门窗；石棺=棺盖+基座；血泊=不规则泼溅+边缘滴点；石碑=竖长圆顶碑+刻线；封印匣=立方箱+锁扣符文；献祭井=井口石圈+内里水面）。画法照 T2 样例习惯。TEMPLATES 字面量结束后（`};` 后一行）加别名（Record 类型允许）：

```ts
// 批3B: shared-silhouette aliases — same array reference, palette differs via ENTITY_PAL.
TEMPLATES.ES_ALTAR_GAMBLER = TEMPLATES.ES_ALTAR_CURSED;
TEMPLATES.MERCHANT_TREASURE = TEMPLATES.MERCHANT;
TEMPLATES.MERCHANT_ENDLESS = TEMPLATES.MERCHANT;
```

③ ENTITY_PAL 填 10 键（MERCHANT 模板锚点：兜帽斗篷+背囊+身前货担）：

```ts
  ES_ALTAR_CURSED:  { K: '#140a0a', S: '#6b4a4a', D: '#46303a', R: '#c0392b', W: '#e8d8d8' },
  ES_ALTAR_GAMBLER: { K: '#140a0a', S: '#8a7a5a', D: '#5a4e3a', Y: '#f39c12', W: '#f5efdf' },
  ES_HOUSE:         { K: '#140a0a', N: '#6b4423', W: '#4a3728', B: '#7ec8e3', D: '#3a2a1e' },
  ES_COFFIN:        { K: '#140a0a', N: '#5a5a66', W: '#95a5a6', D: '#3a3a44', B: '#c9c9d4' },
  ES_POOL:          { K: '#140a0a', R: '#8b0000', D: '#5a0000', W: '#b83a3a', K2: '#2a0000' },
  ES_STELE:         { K: '#140a0a', N: '#8a8a90', Y: '#daa520', D: '#5a5a60' },
  ES_SEALED:        { K: '#140a0a', P: '#9b5de5', D: '#5a2f8a', Y: '#f0c94a', W: '#d8c2f0' },
  ES_WELL:          { K: '#140a0a', N: '#6b6b70', G: '#06d6a0', D: '#04443c', W: '#b0e8d8' },
  MERCHANT:         { K: '#140a0a', P: '#9b5de5', D: '#5a2f8a', W: '#e8e0f5', Y: '#ffd54a' },
  MERCHANT_TREASURE:{ K: '#140a0a', P: '#d4a017', D: '#8a6a10', W: '#fff5d0', Y: '#ffd700' },
  MERCHANT_ENDLESS: { K: '#0a0015', P: '#3a0d5c', M: '#ff2bd6', W: '#b8a0d8', Y: '#7df9ff' },
```

（palette 值是起点参考，implementer 画完可微调使色和谐；键字母须与模板行内用到的字母一致——ES_POOL 里 `K2` 这种是示例笔误，**别用**，字母保持单字符。）

④ `game.ts:111-114` 三商人调用加第 6 参：

```ts
    if (Math.random() < 0.35) placeEntity('merchant', '§', '#9b5de5', 'gm.merchant', 1, 'MERCHANT');
    if (floor % 5 === 0) placeEntity('treasure_merchant', '¤', '#ffd700', 'gm.treasureMerchant', 4, 'MERCHANT_TREASURE');
    if (G!.endless && floor >= 41 && floor % 3 === 0) placeEntity('endless_merchant', '∞', '#9b5de5', 'enm.entityName', 5, 'MERCHANT_ENDLESS');
```

⑤ `game.ts:126` 事件站 push 对象加字段（`rarity: 2,` 后）：

```ts
            G!.items.push({ type: 'consumable', name: t('ev2.' + s.id + 'Title'), ch: s.ch, c: s.c, desc: '', x, y, rarity: 2, npc: 'event', eventId: s.id, spriteKind: s.spriteKind } as Item);
```

- [ ] **Step 4: 跑测确认通过**

Run: `npx vitest run && npx tsc --noEmit; echo "exit:$?"`
Expected: 全绿 447（+3 本 task）。`npm run build` 顺手过一遍。

- [ ] **Step 5: Commit**

```bash
git add src/sprites.ts src/event-sites.ts src/game.ts src/__tests__/batch3b-sprites.test.ts
git commit -m "feat(sprites): event-site + merchant entity templates with shared-silhouette aliases (batch3b T3)"
```

---

### Task 4: 净化入 Clean 档反馈（可与 T2/T3 并行）

**Files:**
- Modify: `src/combat.ts:383-401`（applyCorruption tier 反馈段）
- Modify: `src/i18n.ts:235`（cb.tierCleansed 后加 1 键）
- Test: `src/__tests__/batch3b-clean-feedback.test.ts`（新建）

**Interfaces:**
- Consumes: `applyCorruption(n: number): void`（combat.ts 导出）、`addCorruption` 返回 `{crossed, after, maxed}`、`TIER_LABEL`/`fxAura`/`flt`/`addMsg`/`recalc`（combat 内部）。
- Produces: i18n 键 `cb.tierClean`。

- [ ] **Step 1: 写失败测试**（新建；mock 骨架**整块克隆** `src/__tests__/combat-eternal-sand.test.ts:1-33`，仅改下列四处）

改动点：① `effects.js` mock 改 `{ flt: vi.fn(), shake: vi.fn() }`；② `fx.js` mock 改 `{ fxFlash: vi.fn(), fxBurst: vi.fn(), fxAura: vi.fn() }`；③ `messages.js` mock 改 `{ addMsg: vi.fn() }`；④ 追加一行 mock `vi.mock('../item-intro.js', () => ({ queueMechanicIntro: vi.fn() }));`，relics 的 `hasRelic` 改 `() => false`，meta 的 `corruptionWardMult` 保持 `() => 1`。测试体：

```ts
import { applyCorruption } from '../combat.js';
import { addMsg } from '../messages.js';
import { flt, shake } from '../effects.js';
import { fxAura } from '../fx.js';
import { queueMechanicIntro } from '../item-intro.js';

const mkP = () => ({
  corruption: 25, x: 5, y: 5,
  baseAtk: 10, baseDef: 5, baseMaxHp: 100,
  baseCritChance: 0.05, baseDodgeChance: 0.05, baseSpellPower: 1,
  eq: { weapon: null, armor: null, accessory: null, accessory2: null },
  buffs: [],
});

describe('批3B: cleanse crossing INTO clean tier gets dedicated feedback', () => {
  beforeEach(() => { (globalThis as any).G = { player: mkP() }; vi.clearAllMocks(); });
  afterEach(() => vi.restoreAllMocks());

  it('touched(25) + applyCorruption(-30) → clean: message + green flt + aura, no shake/intro', () => {
    applyCorruption(-30);
    expect((globalThis as any).G.player.corruption).toBe(0);
    expect(addMsg).toHaveBeenCalledWith('cb.tierClean', 'md');
    expect(flt).toHaveBeenCalledWith(5, 5, 'CLEAN', '#80ed99');
    expect(fxAura).toHaveBeenCalledWith(5, 5, '#80ed99', 1.4);
    expect(shake).not.toHaveBeenCalled();
    expect(queueMechanicIntro).not.toHaveBeenCalled();
  });
});
```

（`t` mock 返回键名原文、`tx` mock 取 `f.en` → `TIER_LABEL.clean.en='Clean'`→`'CLEAN'`，与 i18n mock 骨架一致。）

- [ ] **Step 2: 跑测确认失败**

Run: `npx vitest run src/__tests__/batch3b-clean-feedback.test.ts`
Expected: FAIL —— `addMsg` 未被调（现状 clean 档零反馈）。

- [ ] **Step 3: 实现**

① `i18n.ts` 在 `'cb.tierCleansed'` 行后加：

```ts
  'cb.tierClean': { en: '🟢 Your mind clears — corruption fully purged.', zh: '🟢 腐化尽散，神志清明。' },
```

② `combat.ts` applyCorruption 反馈段（现 `if (r.crossed && r.after !== 'clean') {...}` 整块）改为三路：

```ts
  if (r.crossed && r.after === 'clean') {
    // 批3B: dropping all the way back to Clean is the cleanse payoff — its own
    // message + green flt + aura (no shake; relief, not violence).
    addMsg(t('cb.tierClean'), 'md');
    flt(p.x, p.y, tx(TIER_LABEL.clean).toUpperCase(), '#80ed99');
    fxAura(p.x, p.y, '#80ed99', 1.4);
    recalc(); // clean tier mods are all zeros, but keep the symmetric recalc
  } else if (r.crossed) {
    queueMechanicIntro('corruption');
    const label = tx(TIER_LABEL[r.after]);
    if (n < 0) {
      // Batch2 ⑩: a cleanse that DROPS a tier reads as relief — green, no shake.
      addMsg(tMsg('cb.tierCleansed', label), 'md');
      flt(p.x, p.y, label.toUpperCase(), '#80ed99');
    } else {
      addMsg(`🟪 ${label}${t('cb.ellipsis')}`, 'md');
      flt(p.x, p.y, label.toUpperCase(), TIER_COLOR[r.after]);
      shake(1.5);
    }
    recalc(); // apply the new tier's mods immediately (both directions)
  }
```

- [ ] **Step 4: 跑测确认通过**

Run: `npx vitest run && npx tsc --noEmit; echo "exit:$?"`
Expected: 全绿 448（+1 本 task）。

- [ ] **Step 5: Commit**

```bash
git add src/combat.ts src/i18n.ts src/__tests__/batch3b-clean-feedback.test.ts
git commit -m "feat(corruption): dedicated feedback when a cleanse re-enters the clean tier (batch3b T4)"
```

---

### Task 5: 游戏内 e2e + 全量验证

**Files:**
- Create: `scripts/verify_batch3b_ingame.py`
- Test: 全部门禁（vitest/tsc/build/smoke/e2e）

**Interfaces:**
- Consumes: T1-T4 全部落盘；e2e harness 模式克隆 `scripts/verify_batch2_ingame.py`（dev server `npm run dev -- --port 5173 --strictPort` 前置 + `page.evaluate(async()=>await import('/src/state.ts'))` ESM live-module 同实例注入 + PIL 像素判据）。
- Produces: e2e 报告（脚本 stdout 检查清单），0 console error。

- [ ] **Step 1: 写 e2e 脚本**（克隆 batch2 harness 骨架；检查项）：

1. **Boss 两两不同图（36 对）**：live-module 注入——清 `G.enemies`，逐个把 9 Boss def `makeEnemy(def, px+1, py, 1, {isBoss:true})` 放玩家旁，`render()` 后 canvas 截图裁 boss tile，PIL 逐对比较像素差 > 阈值（36 对全过）。
2. **事件站 sprite 渲染**：注入 `G.items.push({npc:'event', eventId:'cursed_altar', spriteKind:'ES_ALTAR_CURSED', c:'#c0392b', x:px+1, y:py, ...})`，截图断言非纯字符框（像素多样性>阈值）；8 站至少抽 4 站（含两祭坛不同色断言）。
3. **商人三态**：同法注入 MERCHANT / MERCHANT_TREASURE / MERCHANT_ENDLESS 三实体，断言三者 tile 像素两两不同。
4. **CHEST 多色化**：注入 chest 实体，断言渲染（存在金+木两色簇）。
5. **净化入 clean**：live-module 设 `G.player.corruption=25`，调 combat 模块 `applyCorruption(-30)`，断言日志含 `腐化尽散`（zh 环境）或 corruption===0 + console 无错。
6. 全程 `page.on('console')` 计数 error 必须为 0（favicon 404 白名单沿用批2 脚本过滤）。

- [ ] **Step 2: 跑 e2e**

Run: `python scripts/verify_batch3b_ingame.py`（先起 dev server）
Expected: 全部检查 PASS。**坑预案**（批2 三坑通用）：跑前重启 dev server（HMR `?t=` 第二模块实例坑）；`_genItem` 晚绑定只页面图实例；若需 mock `Math.random` 勿恒 0（房间塌缩饿死 `rooms.slice(1)`）。

- [ ] **Step 3: 全量门禁**

Run: `npx tsc --noEmit && npx vitest run && npm run build && python scripts/smoke_settings_core.py`
Expected: tsc 0；vitest **448** 全绿；build 0；smoke 65/65 exit 0。

- [ ] **Step 4: Commit**

```bash
git add scripts/verify_batch3b_ingame.py
git commit -m "test(e2e): in-game verification for batch3b — boss pairwise distinct + entity sprites + clean feedback (batch3b T5)"
```

- [ ] **Step 5: 视觉矩阵目检**

9 Boss 大图 + 事件站/商人样例图人工过目一次（PIL 判据之外的最后防线；截图法沿用批2：同 UI 态对照）。发现明显走形→回 T2/T3 修。

---

## Self-Review 记录

- **Spec 覆盖**：spec §2 T1→plan Task1（含 ENTITY_PAL 收编 CHEST_PAL）、T2→Task2、T3→Task3、T4→Task4、§3 验证→Task5+各 task 内嵌；spec 风险节两处（老档/sig 缓存）不需任务（无代码动作）。✓
- **占位符扫描**：Task2/3 的"锚点表创作"是创意资产既定交付方式（playtest#10 先例），非占位符；palette 示例已标注"起点参考可微调"。✓
- **类型一致性**：`spriteKind?: string`（types 三处+EventSiteDef required）、`drawBossSprite(c,x,y,color,spriteKind?)`、`ENTITY_PAL`/`BOSS_PAL` 均为 `Record<string, Record<string,string>>`，Task1 产出的名字与 Task2/3/5 消费一致。测试计数：439→442(T1)→444(T2)→447(T3)→448(T4)。✓
