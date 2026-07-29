# darkhollow Wave 5 视觉与手感打磨 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 darkhollow 加敌人移动 tile 补间 + 闲置呼吸动画(手感),并把 ~25 个敌人从 5 个轮廓模板扩充(加 5 个标志性模板)+ 全实体深色 stamp 轮廓(可读性)。

**Architecture:** 补间 = 把敌人 sprite 从 `render()` 静态 snapshot 层抽出到动态层 `drawEnemyLayer`(镜像玩家补间 `drawPlayerLayer`),经 `WeakMap<Enemy, tween>` 按格 easeOutQuad 插值(90ms,reducedMotion 瞬切),在 `tryMove` 咽喉点 hook。闲置 bob 复用同一动态层。sprite 升级 = `sprites.ts` 加 5 个 16×16 模板 + `pickEnemyTemplate` 改 tag 优先路由 + `blitOutlined`(深色 silhouette stamp,签名不变)。

**Tech Stack:** TypeScript 5.7 + Vite 6 + Canvas2D;程序化像素 sprite(16×16 矩阵 + offscreen 缓存);无测试框架。

## Global Constraints

- **无自动化测试框架**。验证 = `npm run typecheck` + `npm run build` + 手动 QA。每个 Task 的"测试"步骤即这三项。
- **reducedMotion 硬约束**:补间与闲置 bob 在 reducedMotion 下退化为瞬切/静止。
- **不改 `Enemy` 类型、不污染 save**:补间状态走 `WeakMap<Enemy, ...>`,绝不落 `Enemy` 字段。
- **签名稳定**:sprites.ts 对外 `draw*` 签名不变(轮廓内置),确保 Task 1/2 文件不重叠可并行。
- 补间参数:duration 90ms,easeOutQuad;bob ±1px、~2s 周期、按 entity 相位偏移。
- 代码引用 pin 到 commit `d6e2305`(TECH.md 同款)。
- **频繁 commit**:每个 Task 结束一个 commit。
- **并行机会**:Task 1(`render.ts`/`enemies.ts`/`particles.ts`/`main.ts`)与 Task 2(`sprites.ts`/`data.ts`)**文件集不重叠,可并行**;Task 3 依赖 Task 1+2 完成。

---

## File Structure

| 文件 | 动作 | 责任 |
|------|------|------|
| `src/render.ts` | Modify | 加 enemy tween(`_enemyTweens` WeakMap + `setEnemyTween` + `enemyVisualPos`)+ 抽 `drawEnemyLayer`(含 bob);移除 `render()` 里敌人静态块(L198-245) |
| `src/enemies.ts` | Modify | hook `tryMove` + `phase` AI 触发 `setEnemyTween`;teleport 不补 |
| `src/particles.ts` | Modify | 加 `_drawEnemyLayer`/`setDrawEnemyLayerFn`;`tick()` 里在玩家层之前调用 |
| `src/main.ts` | Modify | 接线 `setDrawEnemyLayerFn(drawEnemyLayer)`(Task 1);legend 加 5 新种类(Task 3) |
| `src/sprites.ts` | Modify | 加 5 新模板 + 行长校验;`pickEnemyTemplate` 返回 `{tpl,key}` tag 优先;`blitOutlined`+silhouette 缓存;`draw*` 改用 outline |
| `src/data.ts` | Modify | 10 个敌人补 `tags`(dragon/construct/spirit/elemental/cultist) |

---

## Task 1: 敌人动态层(移动补间 + 闲置 bob)

**Files:**
- Modify: `src/render.ts`、`src/enemies.ts`、`src/particles.ts`、`src/main.ts`

**Interfaces:**
- Produces: `setEnemyTween(e: Enemy, fx: number, fy: number, tx: number, ty: number): void`、`drawEnemyLayer(c: CanvasRenderingContext2D): void`(均 `render.ts` 导出);`setDrawEnemyLayerFn(fn: ((c: CanvasRenderingContext2D) => void) | null): void`(`particles.ts` 导出)。
- Consumes: 玩家补间既有设施(`_playerTween`/`TWEEN_DUR_MS`/late-binding 模式)。

- [ ] **Step 1: `render.ts` import `Enemy` 类型**

在第 8 行 sprites import 之后加:
```ts
import type { Enemy } from './types.js';
```
(`reducedMotion` 已在 [L2 @ d6e2305](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/render.ts#L2) 导入,无需重复。)

- [ ] **Step 2: `render.ts` 加 enemy tween 状态 + `setEnemyTween` + `enemyVisualPos`**

在 `setPlayerTween`(约 [L37](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/render.ts#L37))之后、`drawPlayerLayer` 之前插入:
```ts
// Enemy tween — enemies also live in the dynamic layer so they slide between
// tiles like the player. WeakMap keyed by the Enemy object: auto-cleared on GC,
// so it never pollutes the Enemy type or save data.
interface EnemyTween { fx: number; fy: number; tx: number; ty: number; t0: number; }
const _enemyTweens = new WeakMap<Enemy, EnemyTween>();

export function setEnemyTween(e: Enemy, fx: number, fy: number, tx: number, ty: number): void {
  if (reducedMotion) { _enemyTweens.delete(e); return; }      // reduced-motion: instant
  if (fx === tx && fy === ty) { _enemyTweens.delete(e); return; } // no displacement
  _enemyTweens.set(e, { fx, fy, tx, ty, t0: performance.now() });
}

// Visual position of an enemy: tweened while a tween is in flight, else its
// logical tile. Clears the entry once the tween finishes.
function enemyVisualPos(e: Enemy): { lx: number; ly: number } {
  const tw = _enemyTweens.get(e);
  if (!tw) return { lx: e.x, ly: e.y };
  const p = Math.min(1, (performance.now() - tw.t0) / TWEEN_DUR_MS);
  if (p >= 1) { _enemyTweens.delete(e); return { lx: e.x, ly: e.y }; }
  const ee = 1 - (1 - p) * (1 - p); // easeOutQuad
  return { lx: tw.fx + (tw.tx - tw.fx) * ee, ly: tw.fy + (tw.ty - tw.fy) * ee };
}
```

- [ ] **Step 3: `render.ts` 新增 `drawEnemyLayer`(抽取 + 补间位置 + bob)**

在 `drawPlayerLayer`(约 [L56](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/render.ts#L56))之后新增。这是把 [render.ts:198-245](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/render.ts#L198-L245) 原样搬过来,**位置源改为 `enemyVisualPos(e)`**,并在 sprite 绘制处叠加 `bob`(bg/光环/HP 条/元素角标保持锚定 `sy`,只让 sprite 本体 bob):
```ts
// Enemies live in the dynamic layer too (like the player): tweened position
// via setEnemyTween + a subtle idle bob. Drawn under the player layer.
export function drawEnemyLayer(c: CanvasRenderingContext2D): void {
  if (!G) return;
  const cvs = (window as any).__canvas as HTMLCanvasElement;
  c.font = `bold ${TS - 4}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const e of G.enemies) {
    if (!G.player.visible?.[e.y]?.[e.x]) continue;
    const { lx, ly } = enemyVisualPos(e);
    const sx = (lx - G.vx) * TS, sy = (ly - G.vy) * TS;
    if (sx < 0 || sy < 0 || sx >= cvs.width || sy >= cvs.height) continue;

    const lowHp = e.hp > 0 && e.hp / e.maxHp <= 0.25;
    c.fillStyle = e.isBoss ? '#3a0000' : e.isElite ? '#2a1a00' : lowHp ? '#250a0a' : '#1a0a0a';
    c.fillRect(sx, sy, TS, TS);

    if (e.isBoss) {
      const grad = c.createRadialGradient(sx + TS / 2, sy + TS / 2, 2, sx + TS / 2, sy + TS / 2, TS * 1.5);
      grad.addColorStop(0, 'rgba(255,215,0,0.18)');
      grad.addColorStop(0.5, 'rgba(255,215,0,0.08)');
      grad.addColorStop(1, 'rgba(255,215,0,0)');
      c.fillStyle = grad; c.fillRect(sx - TS * 0.5, sy - TS * 0.5, TS * 2, TS * 2);
    }
    if (e.isElite && e.el !== 'none') {
      const elColors: Record<string, string> = { fire: '255,69,0', ice: '100,149,237', lightning: '255,215,0', shadow: '128,0,128', holy: '255,255,200' };
      const ecg = elColors[e.el] || '255,255,255';
      const grad = c.createRadialGradient(sx + TS / 2, sy + TS / 2, 1, sx + TS / 2, sy + TS / 2, TS);
      grad.addColorStop(0, `rgba(${ecg},0.12)`);
      grad.addColorStop(1, `rgba(${ecg},0)`);
      c.fillStyle = grad; c.fillRect(sx - 4, sy - 4, TS + 8, TS + 8);
    }

    // Idle bob — subtle vertical sine, desynced per enemy; off in reduced-motion.
    const bob = reducedMotion ? 0 : Math.sin(performance.now() / 350 + (e.x * 1.7 + e.y * 2.3));

    const ec = e.isAlly ? '#06d6a0' : e.c;
    if (e.isBoss) drawBossSprite(c, sx, sy + bob, ec); else drawEnemySprite(c, sx, sy + bob, ec, e);
    if (e.el && e.el !== 'none') {
      const elIndSym: Record<string, string> = { fire: '▲', ice: '✻', lightning: '⚡', shadow: '◔', holy: '✦' };
      const elIndColor: Record<string, string> = { fire: '#ff7a45', ice: '#7ec8e3', lightning: '#fff2a8', shadow: '#b583f6', holy: '#ffd700' };
      c.font = `${Math.floor(TS / 3)}px ${FONT}`;
      c.fillStyle = elIndColor[e.el] || '#fff';
      c.fillText(elIndSym[e.el] || '', sx + TS - 4, sy + 4);
    }
    if (e.hp < e.maxHp) {
      const bw = TS - 2, bh = e.isBoss ? 6 : 4, by = e.isBoss ? sy - 5 : sy - 3;
      c.fillStyle = e.isBoss ? '#332' : '#300'; c.fillRect(sx + 1, by, bw, bh);
      c.fillStyle = e.isBoss ? '#ffd700' : '#e63946'; c.fillRect(sx + 1, by, Math.max(1, bw * (e.hp / e.maxHp)), bh - 1);
      c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(sx + 1, by, Math.max(1, bw * (e.hp / e.maxHp)), 1);
    }
  }
}
```
> 注:原块里 elite-glow 的局部变量也叫 `ec`,这里改名 `ecg` 避免与实体色 `ec` 冲突(原代码靠块作用域隔离,新写法显式改名更安全)。

- [ ] **Step 4: `render.ts` 从 `render()` 删除敌人静态块**

删除 [render.ts:198-245](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/render.ts#L198-L245)(含 `// Enemies — improved rendering` 注释和整个 `for (const e of G.enemies) {...}`)。删后 `render()` 从物品块(L196 `}`)直接接到 [L247](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/render.ts#L247) `// Player screen position (used by vignette)`。敌人不再进 snapshot;由 `drawEnemyLayer` 在动态层画。

- [ ] **Step 5: `enemies.ts` import + hook `tryMove` + `phase`**

import 区([L1-12](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/enemies.ts#L1-L12))加(render 不导入 enemies,无循环依赖,同 player.ts→render.ts 直连):
```ts
import { setEnemyTween } from './render.js';
```
改 [`tryMove` L304-312](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/enemies.ts#L304-L312) 成功路径:
```ts
function tryMove(e: Enemy, dx: number, dy: number): boolean {
  if (!G) return false;
  const nx = e.x + dx, ny = e.y + dy;
  if (nx < 0 || nx >= MW || ny < 0 || ny >= MH) return false;
  if (G.dungeon.map[ny][nx] === TL.WALL || G.dungeon.map[ny][nx] === TL.VOID) return false;
  if (G.enemies.some(o => o !== e && o.x === nx && o.y === ny)) return false;
  if (nx === G.player.x && ny === G.player.y) return false;
  const ox = e.x, oy = e.y;
  e.x = nx; e.y = ny;
  setEnemyTween(e, ox, oy, nx, ny);
  return true;
}
```
改 `phase` AI 内直接移动处([L138](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/enemies.ts#L138)),把 `{ e.x = nx; e.y = ny; }` 改为:
```ts
{ const ox = e.x, oy = e.y; e.x = nx; e.y = ny; setEnemyTween(e, ox, oy, nx, ny); }
```
**teleport AI([L223](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/enemies.ts#L223))不改**——瞬移不补间(对齐 Wave 3 玩家传送修复 #4),已有 `⚡BLINK` fx。

- [ ] **Step 6: `particles.ts` 加 enemy-layer sink + `tick()` 调用**

在 [`_drawPlayerLayer`/`setDrawPlayerLayerFn` L9-12](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/particles.ts#L9-L12) 之后加:
```ts
// Late-bound enemy-layer drawer (set from render.ts via main.ts wiring).
let _drawEnemyLayer: ((c: CanvasRenderingContext2D) => void) | null = null;
export function setDrawEnemyLayerFn(fn: ((c: CanvasRenderingContext2D) => void) | null): void {
  _drawEnemyLayer = fn;
}
```
在 `tick()` 的玩家层调用([L105](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/particles.ts#L105) `if (_drawPlayerLayer) _drawPlayerLayer(c);`)**之前**插入(敌人在玩家之下):
```ts
  // Enemy layer — tweened positions + idle bob, drawn under the player.
  if (_drawEnemyLayer) _drawEnemyLayer(c);
```

- [ ] **Step 7: `main.ts` 接线**

[L23](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/main.ts#L23) render import 末尾加 `drawEnemyLayer`:
```ts
import { render, renderMinimap, resizeCanvas, updateUI, markMinimapDirty, drawPlayerLayer, drawEnemyLayer } from './render.js';
```
[L29](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/main.ts#L29) particles import 加 `setDrawEnemyLayerFn`:
```ts
import { startParticles, stopParticles, setDrawPlayerLayerFn, setDrawEnemyLayerFn } from './particles.js';
```
在 [L42](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/main.ts#L42) `setDrawPlayerLayerFn(drawPlayerLayer);` 之后加:
```ts
setDrawEnemyLayerFn(drawEnemyLayer);
```

- [ ] **Step 8: typecheck + build**

Run: `npm run typecheck` → Expected: 无错误。
Run: `npm run build` → Expected: `tsc && vite build` 成功。

- [ ] **Step 9: 手动 QA(补间 + bob 专项)**

Run: `npm run dev`,新游戏进关卡,在敌人附近移动/等待。
- 敌人 chase 时 tile 间**平滑滑动**(~90ms),不再硬切。
- 玩家不动时敌人**轻微上下呼吸**(±1px,各敌人不同步),不抢眼。
- 有 teleport AI 的敌人(深层)瞬移仍为瞬切 + `⚡BLINK`,不滑动。
- Options→Accessibility 开 reducedMotion:敌人瞬切、无 bob。
- 玩家补间/震屏/粒子/fx/HP 条/元素角标/tooltip/minimap 无异常。
- save(Ctrl+S)→ 关闭重开 → 继续:敌人位置正常,无幽灵补间残留。

- [ ] **Step 10: Commit**

```bash
git add src/render.ts src/enemies.ts src/particles.ts src/main.ts
git commit -m "feat: 敌人移动补间 + 闲置 bob(动态层)"
```

---

## Task 2: sprite 美术升级(5 新模板 + tag 路由 + stamp 轮廓)

**Files:**
- Modify: `src/sprites.ts`、`src/data.ts`

**Interfaces:**
- Produces: `TEMPLATES` 加 DRAGON/GOLEM/WRAITH/ELEMENTAL/CULTIST;`pickEnemyTemplate(e)` 返回 `{ tpl: Template; key: string }`;`blitOutlined(c, x, y, sprite, sig, thickness?)` 内部 helper。对外 `drawEnemySprite`/`drawBossSprite`/`drawItemSprite`/`drawPlayerSprite` **签名不变**。
- Consumes: 无(独立于 Task 1;`draw*` 被 Task 1 的 `drawEnemyLayer` 调用,签名不变故无冲突)。

- [ ] **Step 1: `sprites.ts` 加 5 个新模板**

在 [`TEMPLATES` L16](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/sprites.ts#L16) 的 `DEMON` 之后、`BOSS` 之前插入 5 个模板(沿用 16 行×16 字符矩阵;M=主体/D=暗/L=亮/E=眼辉/K=黑/W=白)。色彩走 `buildPalette` 单色派生,故只用结构码:
```ts
  DRAGON: [
    "...K........K...",
    "..KK........KK..",
    ".KDMMMMMMMMDK...",
    "KDMMMMMMMMMMDMDK",
    "DMMMMMKKKKMMMMMD",
    "DMMMMEEMMEEMMMMD",
    "DMMMMMMMMMMMMMMD",
    "..DMMMMMMMMMMD..",
    "...DMMMMMMMMMD..",
    "...DKMMMMMMMKD..",
    "..DDMMMMMMMMDD..",
    "...DKMMKKMMD....",
    "....DMMMMMD.....",
    ".....DMMMD......",
    "......KKK.......",
    "................",
  ],
  GOLEM: [
    "....KKKKKKKK....",
    "..KKMMMMMMMMKK..",
    "..KMMEMMMEMMMK..",
    "..KMMMMMMMMMMK..",
    ".KMMMMMMMMMMMMK.",
    "KMMMMMMMMMMMMMMK",
    "KMDMMMMMMMMMDMMK",
    "KMMMMMMMMMMMMMMK",
    "DKMMMMMMMMMMMMKD",
    ".KMMMMMMMMMMMMK.",
    "..KMMMMMMMMMMK..",
    "..KMMMMMMMMMMK..",
    "..KMMMMMMMMMMK..",
    "..KKMMMMMMMMKK..",
    "...KKKKKKKKKK...",
    "................",
  ],
  WRAITH: [
    "......KKKK......",
    ".....KMMMMK.....",
    "...KMMMMMMMMK...",
    "..KMMWMMMMWMMK..",
    "..KMMEMMMMMEMK..",
    "..KMMMMMMMMMMK..",
    "..KMMMMMMMMMMK..",
    "..DMMMMMMMMMMD..",
    "...DMMMMMMMMD...",
    "....DKMMMMKD....",
    "....DMMWWMMD....",
    ".....DMMWMD.....",
    ".....DWMMWD.....",
    "......DWWD......",
    "................",
    "................",
  ],
  ELEMENTAL: [
    "......LLLL......",
    "....LLMMMMLL....",
    "...LMMMMMMMML...",
    "..LMMMEMMMEMML..",
    "..LMMMMMMMMMML..",
    ".LMMMMMMMMMMMML.",
    ".LMMMMMMMMMMMML.",
    ".LMMMMMMMMMMMML.",
    ".LMMMDMMMMDMMML.",
    ".LMMMMMMMMMMMML.",
    "..LMMMMMMMMMML..",
    "..LMMMMMMMMMML..",
    "...LMMMMMMMML...",
    "....DMMMMMMD....",
    ".....DMMMMD.....",
    "................",
  ],
  CULTIST: [
    "......KKKK......",
    ".....KMMMMK.....",
    "...KMMMMMMMMK...",
    "..KMMEMMMMEMMK..",
    "..KMMMMMMMMMMK..",
    "..DMMMMMMMMMMD..",
    ".DMMMMMMMMMMMMD.",
    "DMMMMMMMMMMMMMMD",
    "DMMMDMMMMMMDMMMD",
    "DMMMMMMMMMMMMMMD",
    ".DMMMMMMMMMMMMD.",
    "..DMMMMMMMMMMD..",
    "..DMMMMMMMMMMD..",
    "..KKMMMMMMMMKK..",
    ".KKKKKKKKKKKKKK.",
    "................",
  ],
```
> ⚠️ **行长校验(必做)**:每行必须正好 16 字符。模板写完后,在 `TEMPLATES` 定义之后立刻加这段 dev-time 校验,`npm run dev` 打开控制台,若有 `bad row len` 报错就修正对应行(常见漏/多一个点),全清后**保留这段校验进 commit**(运行时几乎零成本):
```ts
// Dev-time sanity: every template row must be exactly N(16) chars.
for (const [k, tpl] of Object.entries(TEMPLATES)) {
  for (const row of tpl) if (row.length !== N) console.error(`TEMPLATE ${k} bad row len ${row.length}: "${row}"`);
}
```
> 像素是程序员美术,可在 QA 阶段微调像素改善剪影,但 5 个剪影必须互相可辨(龙=展翼+尾/魔像=方肩无颈/怨灵=兜帽+尖尾/元素=火焰锥/信徒=长袍+兜帽)。

- [ ] **Step 2: `sprites.ts` 改 `pickEnemyTemplate` 返回 `{tpl,key}` + tag 优先**

替换 [`pickEnemyTemplate` L701-710](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/sprites.ts#L701-L710):
```ts
function pickEnemyTemplate(e: Enemy): { tpl: Template; key: string } {
  const tags = e.tags || [];
  if (tags.includes('dragon'))    return { tpl: TEMPLATES.DRAGON,    key: 'DRAGON' };
  if (tags.includes('construct')) return { tpl: TEMPLATES.GOLEM,     key: 'GOLEM' };
  if (tags.includes('spirit'))    return { tpl: TEMPLATES.WRAITH,    key: 'WRAITH' };
  if (tags.includes('elemental')) return { tpl: TEMPLATES.ELEMENTAL, key: 'ELEMENTAL' };
  if (tags.includes('cultist'))   return { tpl: TEMPLATES.CULTIST,   key: 'CULTIST' };
  if (tags.includes('undead'))    return { tpl: TEMPLATES.SKELETON,  key: 'SKELETON' };
  if (tags.includes('demon'))     return { tpl: TEMPLATES.DEMON,     key: 'DEMON' };
  const n = e.name;
  if (/slime|ooze|blob|gel|史莱|黏|胶|果冻/.test(n)) return { tpl: TEMPLATES.SLIME, key: 'SLIME' };
  if (/dragon|drake|wyrm|wyvern|龙|蛟/.test(n))     return { tpl: TEMPLATES.DRAGON, key: 'DRAGON' };
  if (/golem|gargoyle|construct|魔像|巨像/.test(n)) return { tpl: TEMPLATES.GOLEM,  key: 'GOLEM' };
  if (/wraith|ghost|spirit|specter|怨灵|幽/.test(n))return { tpl: TEMPLATES.WRAITH, key: 'WRAITH' };
  if (/elemental|behemoth|熔岩|元素/.test(n))       return { tpl: TEMPLATES.ELEMENTAL, key: 'ELEMENTAL' };
  if (/cultist|zealot|inquisitor|信徒|裁官/.test(n))return { tpl: TEMPLATES.CULTIST, key: 'CULTIST' };
  if (/bat|raven|bird|spider|rat|wolf|hound|beast|serpent|snak|蝙蝠|蜘|鼠|狼|蛛|蛇/.test(n)) return { tpl: TEMPLATES.BEAST, key: 'BEAST' };
  return { tpl: TEMPLATES.GOBLIN, key: 'GOBLIN' };
}
```

- [ ] **Step 3: `sprites.ts` 加 silhouette 缓存 + `blitOutlined`**

在 [`spriteCache` L646](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/sprites.ts#L646) 之后、`getSprite` 之前加:
```ts
const OUTLINE_COLOR = '#0a0a0a';
// Dark silhouette cache (all opaque pixels -> outline color), keyed by sprite sig.
const silCache = new Map<string, HTMLCanvasElement>();
function getSilhouette(sig: string, sprite: HTMLCanvasElement): HTMLCanvasElement {
  const cached = silCache.get(sig);
  if (cached) return cached;
  const cv = document.createElement('canvas');
  cv.width = N; cv.height = N;
  const cc = cv.getContext('2d')!;
  cc.drawImage(sprite, 0, 0);
  cc.globalCompositeOperation = 'source-in';
  cc.fillStyle = OUTLINE_COLOR;
  cc.fillRect(0, 0, N, N);
  silCache.set(sig, cv);
  return cv;
}
```
在 [`blit` L667-672](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/sprites.ts#L667-L672) 之后加(`blit` 本身保留,地形 sprite 继续用):
```ts
// Blit with a dark outline: stamp the silhouette at ±thickness on all 8(ish)
// neighbor offsets, then the real sprite. Pixel-art readability on busy tiles.
function blitOutlined(c: CanvasRenderingContext2D, x: number, y: number, sprite: HTMLCanvasElement, sig: string, thickness = 1): void {
  const sil = getSilhouette(sig, sprite);
  const prev = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  for (let dy = -thickness; dy <= thickness; dy++)
    for (let dx = -thickness; dx <= thickness; dx++)
      if (dx !== 0 || dy !== 0) c.drawImage(sil, Math.round(x + dx), Math.round(y + dy), TS, TS);
  c.drawImage(sprite, Math.round(x), Math.round(y), TS, TS);
  c.imageSmoothingEnabled = prev;
}
```

- [ ] **Step 4: `sprites.ts` 把实体 `draw*` 改用 `blitOutlined`(签名不变)**

[`drawPlayerSprite` L676-679](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/sprites.ts#L676-L679):
```ts
export function drawPlayerSprite(c: CanvasRenderingContext2D, x: number, y: number, ci: number): void {
  const key = ci === 1 ? 'ROGUE' : ci === 2 ? 'MAGE' : ci === 3 ? 'PALADIN' : 'WARRIOR';
  const sig = 'PLAYER:' + key;
  blitOutlined(c, x, y, getSprite(TEMPLATES[key], PLAYER_PAL, sig), sig);
}
```
[`drawBossSprite` L697-699](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/sprites.ts#L697-L699)(boss 略厚 thickness=2):
```ts
export function drawBossSprite(c: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  const sig = 'BOSS:' + color;
  blitOutlined(c, x, y, getSprite(TEMPLATES.BOSS, buildPalette(color), sig), sig, 2);
}
```
[`drawEnemySprite` L712-716](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/sprites.ts#L712-L716)(sig 用模板 key):
```ts
export function drawEnemySprite(c: CanvasRenderingContext2D, x: number, y: number, color: string, e: Enemy): void {
  const { tpl, key } = pickEnemyTemplate(e);
  const sig = key + ':' + color;
  blitOutlined(c, x, y, getSprite(tpl, buildPalette(color), sig), sig);
}
```
[`drawItemSprite` L750-753](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/sprites.ts#L750-L753):
```ts
export function drawItemSprite(c: CanvasRenderingContext2D, x: number, y: number, item: Item): void {
  const tpl = pickItemTemplate(item);
  const sig = item.type + ':' + item.ef + ':' + item.name + ':' + item.c;
  blitOutlined(c, x, y, getSprite(tpl, buildPalette(item.c), sig), sig);
}
```
**不改** `drawStairSprite`/`drawTrapSprite`/`drawFountainSprite`/`drawShrineSprite`(地形,留 `blit`)、`paintIcon`(legend 1:1,留原样)。

- [ ] **Step 5: `data.ts` 给 10 个敌人补 `tags`**

在 [`ENEMIES` L96](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/data.ts#L96) 对应条目末尾加 `tags`(纯数据;运行时 `enemies.ts:43` 已 `tags: base.tags ? [...base.tags] : []` 透传):
- [L130 Ancient Dragon](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/data.ts#L130):加 `tags: ['dragon']`
- [L133 Castellan](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/data.ts#L133):加 `tags: ['construct']`
- [L134 Gargoyle](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/data.ts#L134):加 `tags: ['construct']`
- [L135 Inquisitor](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/data.ts#L135):加 `tags: ['cultist']`
- [L136 Siege Golem](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/data.ts#L136):加 `tags: ['construct']`
- [L138 Pyro Drake](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/data.ts#L138):加 `tags: ['dragon']`
- [L139 Drake Zealot](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/data.ts#L139):加 `tags: ['cultist']`
- [L140 Magma Behemoth](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/data.ts#L140):加 `tags: ['elemental']`
- [L141 Drakeborn Knight](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/data.ts#L141):加 `tags: ['dragon']`
- [L142 Storm Wraith](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/data.ts#L142):加 `tags: ['spirit']`

- [ ] **Step 6: typecheck + build**

Run: `npm run typecheck` → Expected: 无错误(`pickEnemyTemplate` 返回值已更新调用方同步)。
Run: `npm run build` → Expected: 成功。

- [ ] **Step 7: 手动 QA(sprite 专项)**

Run: `npm run dev`,调到 F14+ 看 Wave 4 敌人(meta 解锁或调试进入)。
- Pyro Drake / Drakeborn Knight / Ancient Dragon = **龙形**(展翼+尾),不再是 DEMON。
- Castellan / Gargoyle / Siege Golem = **魔像**(方肩无颈),不再是 GOBLIN。
- Storm Wraith = **怨灵**(兜帽+尖尾),不再是 SKELETON。
- Magma Behemoth = **元素**(火焰锥)。
- Drake Zealot / Inquisitor = **信徒**(长袍+兜帽),区别于 goblin。
- 所有敌人/boss/物品/玩家有**清晰深色描边**,在暗色地形上可读性提升;boss 描边略厚。
- 开 `npm run dev` 控制台**无 `bad row len` 报错**(Step 1 校验全过)。
- legend 暂未列新模板(Task 3 补),不影响游戏内渲染。

- [ ] **Step 8: Commit**

```bash
git add src/sprites.ts src/data.ts
git commit -m "feat: sprite 升级(5 新模板 + tag 路由 + stamp 轮廓)"
```

---

## Task 3: legend 补全 + 集成 QA + merge

**Files:**
- Modify: `src/main.ts`(legend)
- 依赖:Task 1 + Task 2 均完成。

**Interfaces:** 无新导出。

- [ ] **Step 1: `main.ts` legend 加 5 个新种类**

在 [`renderLegend` 的 `spr` 数组 L317-332](https://github.com/xieyj22/darkhollow_win/blob/d6e2305/src/main.ts#L317-L332) 的 `['BOSS', '#ffd700', ...]` 行之后插入:
```ts
    ['DRAGON', '#ff6347', zh ? '飞龙' : 'Dragon'],
    ['GOLEM', '#696969', zh ? '魔像' : 'Golem'],
    ['WRAITH', '#4682b4', zh ? '怨灵' : 'Wraith'],
    ['ELEMENTAL', '#ff4500', zh ? '元素' : 'Elemental'],
    ['CULTIST', '#8b0000', zh ? '信徒' : 'Cultist'],
```
(`paintIcon` 共享 `TEMPLATES`,Task 2 已加这些 key,自动渲染。)

- [ ] **Step 2: typecheck + build**

Run: `npm run typecheck && npm run build` → Expected: 全过。

- [ ] **Step 3: 全流程集成 QA**

`npm run dev` 通关一条路径,逐项过/不过:
- **补间+bob**(Task 1):敌人滑动、呼吸、teleport 瞬移、reducedMotion 瞬切静止。
- **sprite**(Task 2):5 新剪影各自可辨、全实体描边、控制台无 `bad row len`。
- **legend**:展开 sidebar legend,5 个新种类图标正确显示,中英(`L` 切)名字正常。
- **回归**:玩家补间/震屏/粒子/fx/HP 条/元素角标/tooltip/minimap/save-load/手柄/选项面板均无异常。
- 视觉确认描边无穿帮(±1px 渗到邻格可接受,但不应明显遮挡相邻敌人)。

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat(ui): legend 补 5 个新敌人模板图标"
```

- [ ] **Step 5: ff-merge main(收尾)**

在 Wave 5 分支上(若用了 subagent/worktree 分支)fast-forward 合入 `main`;若直接在 main 上逐 task commit,则跳过。push origin(撞 TLS reset 用重试循环,Clash 7897 已启)。
- (可选)若要更新发行 exe:`npm run dist` 重建 portable → `release/`(gitignored,不 commit)。

- [ ] **Step 6: 记录与收尾**

QA 结果记录。全过 → Wave 5 完成。有 bug → 回对应 Task 小修 + commit,不改成功标准。更新 memory(TECH/plan 路径、待续项:boss gradient 缓存化 / 物品 sprite 大改 / 内容扩展续 / Steam 激活)。

---

## Self-Review(plan 写完后自检结果)

- **Spec coverage**:Part A 补间(Task 1 Step 2-7)✓;Part B.1 模板+路由(Task 2 Step 1-2,5)✓;Part B.2 stamp 轮廓(Task 2 Step 3-4)✓;Part B.3 调色(新模板用 M/D/L,显式不引入 T 中间调——YAGNI,spec 标注"可加")✓;Part B.4 idle bob(Task 1 Step 3,折入 drawEnemyLayer 同文件,spec 授权 bob 写入轨 A)✓;legend(Part B.5,Task 3 Step 1)✓;teleport 不补(Global Constraints + Task 1 Step 5)✓;reducedMotion(Global Constraints + 各处)✓。
- **Placeholder scan**:每步含实际代码/命令/预期;模板给了真实像素矩阵 + 行长校验 snippet(校验消除手抄 16 字符行的误差,非占位)。
- **Type consistency**:`setEnemyTween`/`drawEnemyLayer`/`setDrawEnemyLayerFn`/`enemyVisualPos` 在 Task 1 各 step 与 Interfaces 名字一致;`pickEnemyTemplate` 返回 `{tpl,key}` 在 Step 2 定义、Step 4 `drawEnemySprite` 消费一致;`blitOutlined(c,x,y,sprite,sig,thickness=1)` 定义与所有调用一致。
- **YAGNI**:不引入 T 中间调、不加 slime squish(需 blit API 改,会耦合 Task 1/2;统一 bob 已满足"活起来")、不改地形 sprite/paintIcon。
