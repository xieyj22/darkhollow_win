# darkhollow Wave 6a(光环渐变缓存 + summon.kind)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把每帧重建的 3 处径向渐变(玩家光晕/boss 光环/elite 元素光)改成 offscreen canvas 缓存 blit(纯 perf,视觉零变化);给 boss 召唤加 `kind` 字段召唤主题小弟。

**Architecture:** 渐变缓存 = 新 `getGlow(key,size,innerR,outerR,stops)` helper(沿用项目 spriteCache/silCache 的 Map 缓存范式),3 处 `createRadialGradient+fillRect` 换成 `drawImage(getGlow(...))`。summon.kind = `BossDef.summon` 加可选 `kind?: string`(=敌人 `n.en`),`bossSummonAdd` 优先按 kind 取敌(跳过 mf 窗口、照常 fs 缩放),回退现池;6 boss 配主题小弟。

**Tech Stack:** TypeScript 5.7 + Vite 6 + Canvas2D;无测试框架。

## Global Constraints

- **无测试框架**。验证 = `npm run typecheck` + `npm run build` + playwright 冒烟 + 手动 QA。
- **视觉零回归(Part A 硬约束)**:缓存的 offscreen 渐变在 size/中心/内径/外径/色阶上与原 `createRadialGradient` 逐项一致;`drawImage` 1:1 无缩放到同一矩形。玩家光晕/boss 金光环/elite 元素光外观不变。
- **向后兼容(Part B)**:无 `kind` 的 boss 召唤走原随机池;`summon.kind` 是新可选字段,旧存档不受影响。
- 性能只减不增。代码引用 pin `17d4b42`。每 Task 一 commit。
- **并行**:Task 1(`render.ts`)与 Task 2(`types.ts`/`data.ts`/`enemies.ts`)文件不重叠,可并行;Task 3 依赖 1+2。

---

## File Structure

| 文件 | 动作 | 责任 |
|------|------|------|
| `src/render.ts` | Modify | 加 `getGlow` + `glowCache`;3 处渐变换 drawImage;resize 清缓存 |
| `src/types.ts` | Modify | `BossDef.summon` 加 `kind?: string` |
| `src/data.ts` | Modify | 6 个 boss 的 `summon` 加 `kind` |
| `src/enemies.ts` | Modify | `bossSummonAdd` 优先按 kind 取敌,回退池 |

---

## Task 1: 光环渐变缓存化

**Files:**
- Modify: `src/render.ts`

**Interfaces:**
- Produces:模块级 `getGlow(key, size, innerR, outerR, stops): HTMLCanvasElement` + `glowCache`(均不导出,文件内用)。
- Consumes:无新依赖。

- [ ] **Step 1: `render.ts` 加 `getGlow` + `glowCache`**

在 `getScanlineOverlay` 附近(约 [L65](https://github.com/xieyj22/darkhollow_win/blob/17d4b42/src/render.ts#L65) 之前/之后均可,缓存区)加:
```ts
// Cached radial-gradient sprites. Each glow is a fixed pattern centered locally
// (only its screen position changes per frame), so paint once + drawImage,
// instead of createRadialGradient every frame.
const glowCache = new Map<string, HTMLCanvasElement>();
function getGlow(key: string, size: number, innerR: number, outerR: number, stops: [number, string][]): HTMLCanvasElement {
  const cached = glowCache.get(key);
  if (cached) return cached;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const cc = cv.getContext('2d')!;
  const g = cc.createRadialGradient(size / 2, size / 2, innerR, size / 2, size / 2, outerR);
  for (const [off, col] of stops) g.addColorStop(off, col);
  cc.fillStyle = g; cc.fillRect(0, 0, size, size);
  glowCache.set(key, cv);
  return cv;
}
```

- [ ] **Step 2: `drawPlayerLayer` 玩家光晕(L73-77)换 drawImage**

把 [L73-77](https://github.com/xieyj22/darkhollow_win/blob/17d4b42/src/render.ts#L73-L77)(`const pGrad = ...; pGrad.addColorStop×3; c.fillStyle=pGrad; c.fillRect(...)`)替换为:
```ts
  const pGlow = getGlow('player-glow', TS * 2, 2, TS * 1.5,
    [[0, 'rgba(255,215,0,0.12)'], [0.5, 'rgba(255,215,0,0.05)'], [1, 'rgba(255,215,0,0)']]);
  c.drawImage(pGlow, px - TS * 0.5, py - TS * 0.5);
```
(其后的 `c.textAlign=...; drawPlayerSprite(...)` 不动。)

- [ ] **Step 3: `drawEnemyLayer` boss 光环(L98-104)换 drawImage**

把 [L98-104](https://github.com/xieyj22/darkhollow_win/blob/17d4b42/src/render.ts#L98-L104) 的 `if (e.isBoss) { const grad = ...; addColorStop×3; fillStyle=grad; fillRect(...) }` 替换为:
```ts
    if (e.isBoss) {
      const aura = getGlow('boss-aura', TS * 2, 2, TS * 1.5,
        [[0, 'rgba(255,215,0,0.18)'], [0.5, 'rgba(255,215,0,0.08)'], [1, 'rgba(255,215,0,0)']]);
      c.drawImage(aura, sx - TS * 0.5, sy - TS * 0.5);
    }
```

- [ ] **Step 4: `drawEnemyLayer` elite 元素光(L105-112)换 drawImage**

把 [L105-112](https://github.com/xieyj22/darkhollow_win/blob/17d4b42/src/render.ts#L105-L112) 的 `if (e.isElite && e.el!=='none') { elColors...; grad...; fillRect }` 替换为:
```ts
    if (e.isElite && e.el !== 'none') {
      const elColors: Record<string, string> = { fire: '255,69,0', ice: '100,149,237', lightning: '255,215,0', shadow: '128,0,128', holy: '255,255,200' };
      const ecg = elColors[e.el] || '255,255,255';
      const eg = getGlow('elite-glow:' + e.el, TS + 8, 1, TS,
        [[0, `rgba(${ecg},0.12)`], [1, `rgba(${ecg},0)`]]);
      c.drawImage(eg, sx - 4, sy - 4);
    }
```

- [ ] **Step 5: `resizeCanvas` 清 glow 缓存(保险)**

在 [`resizeCanvas` 的 `scanlineCanvas = null;` 处](https://github.com/xieyj22/darkhollow_win/blob/17d4b42/src/render.ts#L93)(约 L93)同处加一行:
```ts
  glowCache.clear();
```
(TS 是常量,缓存键固定 7 个,实际不会泄漏;clear 仅为 resize 保险。)

- [ ] **Step 6: typecheck + build**

Run: `npm run typecheck` → Expected: 无错误。
Run: `npm run build` → Expected: 成功。

- [ ] **Step 7: 手动/冒烟 QA(视觉零回归)**

`npm run dev`(或 playwright 冒烟截图,沿用 Wave 5 smoke 脚本):玩家金色光晕、boss 金光环、elite 元素光(fire/ice/lightning/shadow/holy)外观与 Wave 5 **一致**(无变化即对)。控制台无报错。reducedMotion 下光晕仍正常。

- [ ] **Step 8: Commit**

```bash
git add src/render.ts
git commit -m "perf: 缓存径向光晕 offscreen canvas(玩家/boss/elite 每帧不再重建渐变)"
```

---

## Task 2: summon.kind 精确召唤

**Files:**
- Modify: `src/types.ts`、`src/data.ts`、`src/enemies.ts`

**Interfaces:**
- Produces:`BossDef.summon.kind?: string`;`bossSummonAdd` 优先 kind 取敌。
- Consumes:无(独立于 Task 1)。

- [ ] **Step 1: `types.ts` `BossDef.summon` 加 `kind?`**

在 [`BossDef.summon` L202-207](https://github.com/xieyj22/darkhollow_win/blob/17d4b42/src/types.ts#L202-L207) 加字段:
```ts
  summon?: {
    chance: number;
    cd: number;
    maxAdds: number;
    kind?: string;   // 指定召唤敌人的 n.en;省略则用楼层随机池
  };
```

- [ ] **Step 2: `enemies.ts` `bossSummonAdd` 优先按 kind**

把 [`bossSummonAdd` L268-295](https://github.com/xieyj22/darkhollow_win/blob/17d4b42/src/enemies.ts#L268-L295) 开头取 `base` 的几行(原 `const pool = ENEMIES.filter(...); if (!pool.length) return; const base = pick(pool);`)替换为:
```ts
function bossSummonAdd(boss: Enemy): void {
  if (!G) return;
  const fl = G.floor;
  const bd = BOSSES.find(b => b.fl === fl);
  if (!bd || !bd.summon) return;
  const cfg = bd.summon;
  // 优先主题小弟(按 n.en);查不到回退楼层随机池
  let base = cfg.kind ? ENEMIES.find(en => en.n.en === cfg.kind) : undefined;
  if (!base) {
    const pool = ENEMIES.filter(en => en.mf <= fl && en.mf >= Math.max(1, fl - 8) && !en.tags?.includes('boss'));
    base = pool.length ? pick(pool) : undefined;
  }
  if (!base) return;
  const fs = 1 + (fl - 1) * .12;
  // ……(其下原逻辑不变:for attempt 找空位 → 构造 sn → G.enemies.push → addMsg → flt → return)
```
(保留原 for-attempt 找空位 + 构造 `sn` + push + `addMsg`/`flt` 的下半段不变;只改取 `base` 的方式。)

- [ ] **Step 3: `data.ts` 6 个 boss 加 `kind`**

在 [`BOSSES`](https://github.com/xieyj22/darkhollow_win/blob/17d4b42/src/data.ts#L164) 各 `summon: { ... }` 内加 `kind` 字段:
- [L166 哥布林王](https://github.com/xieyj22/darkhollow_win/blob/17d4b42/src/data.ts#L166):`summon: { chance: 0.4, cd: 3, maxAdds: 2, kind: 'Goblin' },`
- [L169 蜘蛛女王](https://github.com/xieyj22/darkhollow_win/blob/17d4b42/src/data.ts#L169):加 `kind: 'Spider'`
- [L172 吸血鬼领主](https://github.com/xieyj22/darkhollow_win/blob/17d4b42/src/data.ts#L172):加 `kind: 'Vampire'`
- [L175 远古巫妖](https://github.com/xieyj22/darkhollow_win/blob/17d4b42/src/data.ts#L175):加 `kind: 'Skeleton'`
- [L178 龙皇](https://github.com/xieyj22/darkhollow_win/blob/17d4b42/src/data.ts#L178):加 `kind: 'Dragon Whelp'`
- [L189 虚空君主](https://github.com/xieyj22/darkhollow_win/blob/17d4b42/src/data.ts#L189):加 `kind: 'Void Wraith'`
- **不改** [L195 创世者](https://github.com/xieyj22/darkhollow_win/blob/17d4b42/src/data.ts#L195)(留随机池)。

- [ ] **Step 4: typecheck + build**

Run: `npm run typecheck` → Expected: 无错误。
Run: `npm run build` → Expected: 成功。

- [ ] **Step 5: 手动/冒烟 QA**

`npm run dev`(meta 解锁/调试进 F5):哥布林王召唤出的小弟是 **Goblin**(非随机);龙皇(F25)召 Dragon Whelp;创世者(F40)仍随机池。无 kind 回退路径正常(改一个 kind 名为不存在的敌人验证回退——可选)。

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/data.ts src/enemies.ts
git commit -m "feat: boss 召唤加 summon.kind 精确召唤主题小弟(6 boss)"
```

---

## Task 3: 集成 QA + merge

**Files:** 无代码改动(验证 + git)。依赖 Task 1+2。

- [ ] **Step 1: typecheck + build**

Run: `npm run typecheck && npm run build` → Expected: 全过。

- [ ] **Step 2: 集成冒烟 + QA**

`npm run dev` + playwright 冒烟(沿用 Wave 5 smoke 脚本,可加到 F5 看 boss 召唤):
- 光环视觉零回归(玩家/boss/elite 光晕外观不变);控制台无报错。
- 哥布林王召 Goblin;无 kind 的 boss 回退随机池。
- 回归:Wave 5 敌人补间/bob/描边/legend 不受影响。

- [ ] **Step 3: Commit(如有冒烟脚本调整)→ ff-merge main → push**

main 上逐 task commit 则跳过 merge;push origin(撞 TLS 用重试循环)。可选 `npm run dist` 重建 exe。

- [ ] **Step 4: 收尾**

QA 记录;更新 memory(Wave 6a done,待续 6b/6c/6d)。

---

## Self-Review

- **Spec coverage**:Part A 渐变缓存(Task 1 Step 1-5)✓;Part B summon.kind(Task 2 Step 1-3)✓;6 boss kind 表(Task 2 Step 3)✓;视觉零回归(Global Constraints + Task 1 Step 7)✓;向后兼容(Global Constraints + Task 2)✓。
- **Placeholder scan**:每步含实际代码/命令/预期;Task 2 Step 2 标注「下半段不变」是引用同函数既有代码(非占位)。
- **Type consistency**:`getGlow(key,size,innerR,outerR,stops)` 定义与 3 处调用一致;`BossDef.summon.kind?: string` 定义与 data/enemies 用法一致;kind 值均核对存在于 ENEMIES。
- **YAGNI**:不缓存 vignette(每回合一次)、不加 enemy id 字段、kind 不支持 list。
