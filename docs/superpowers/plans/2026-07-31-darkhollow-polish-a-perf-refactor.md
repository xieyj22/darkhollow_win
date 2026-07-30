# Polish-A(性能 + 受控重构)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地自审剩余 7 项(P2/P4/P5/P6 性能 + Q1/Q2/Q4 受控重构)+ 引入 vitest 测试基座,零行为变更。

**Architecture:** Task 1(主 Agent)先引入 vitest+happy-dom 并 TDD 提取 `makeEnemy`(新 `enemy-factory.ts`),确立测试范式;Task 2/3/4(顺序 subagent,429 则主 Agent 内联)分别处理不相交文件——fx 性能(P2+P4)、FOV 性能(P5+P6,带 characterization 测试)、combat 重构(Q2+Q4)。所有任务共享 typecheck+build+有头冒烟验收;仅提取出的纯模块(`makeEnemy`/`grantKillRewards`/`computeFOV`)加单测。

**Tech Stack:** TypeScript 5.7 + Vite 6 + Canvas 2D + Electron;新增 vitest + happy-dom(仅测试)。Pin 基准 commit `d159a15`。

## Global Constraints

- **无行为变更**:除 Q2 顺带统一击败消息的 XP 措辞(统一用 `bonusExp(e.exp)`),所有改动纯性能/重构;同一输入产出与原代码逐字段相等。
- **验证三件套**:`npm run typecheck`(tsc --noEmit)+ `npm run build`(tsc && vite build)clean;有头冒烟(playwright 控台 0 error + analyze_image 视觉核对);final opus 全分支 code-level 审查。
- **测试范围**:只给被提取的纯模块写 vitest 单测(`makeEnemy`、`computeFOV`、`grantKillRewards`);性能热点 P2/P4 与类型重构 Q4 不写单测(分别由冒烟视觉核对 / tsc 类型兜底)。
- **vitest env**:`happy-dom`(`state.ts:43` 在模块加载时读 `localStorage`,需 DOM env)。
- **分支**:`polish-a` off `main`;顺序 subagent(避 429/build 撞);final review 后 ff-merge `main` + push origin(仅当用户要求才 push)。
- **不碰**:Polish-B 的 Q3/Q5/Q6;P6 的 `boolean[][]` 分配本身。

---

## File Structure

- **Create** `src/enemy-factory.ts` — 纯函数 `makeEnemy`(导入链仅 state+utils+types,便于单测)。Task 1。
- **Create** `src/__tests__/makeEnemy.test.ts` — `makeEnemy` 单测。Task 1。
- **Create** `src/__tests__/computeFOV.test.ts` — `computeFOV` characterization 测试(P5/P6 重构护栏)。Task 3。
- **Create** `src/__tests__/grantKillRewards.test.ts` — `grantKillRewards` 单测。Task 4。
- **Modify** `package.json` — 加 vitest+happy-dom devDep、test 脚本。Task 1。
- **Modify** `vite.config.ts` — 加 vitest `test` 配置。Task 1。
- **Modify** `src/enemies.ts` — 6 处 Enemy 字面量改调 `makeEnemy`。Task 1。
- **Modify** `src/fx.ts` — P2 径向光晕缓存 + P4 原地压缩。Task 2。
- **Modify** `src/particles.ts` — P4 原地压缩。Task 2。
- **Modify** `src/dungeon.ts` — P5 FOV_DIRS 预计算 + P6 explored 融合。Task 3。
- **Modify** `src/types.ts` — 加 `Combatant` 接口。Task 4。
- **Modify** `src/combat.ts` — Q2 提取 `grantKillRewards` + Q4 `attack()` 用 `Combatant`。Task 4。

---

## Task 1: vitest 基座 + Q1 `makeEnemy`(主 Agent 执行)

**Files:**
- Modify: `package.json`, `vite.config.ts`, `src/enemies.ts`(6 处:`:36-46`、`:62-72`、`:82-92`、`:112-120`、`:267-275`、`:367-375`)
- Create: `src/enemy-factory.ts`, `src/__tests__/makeEnemy.test.ts`

**Interfaces:**
- Produces: `makeEnemy(base: EnemyBase, x, y, fs, m?, nameOverride?): Enemy`(导出自 `src/enemy-factory.ts`);`EnemyBase` 结构类型(同文件导出);vitest 运行环境就绪,后续 task 可加测试。

- [ ] **Step 1: 加 vitest + happy-dom 依赖与脚本**

`package.json` devDependencies 加:
```json
"happy-dom": "^15.0.0",
"vitest": "^2.1.0"
```
scripts 加:
```json
"test": "vitest run",
"test:watch": "vitest"
```
运行:`npm install`(国内网络无须代理,vitest/happy-dom 走默认 registry)。

- [ ] **Step 2: 配 vitest(happy-dom env)**

`vite.config.ts` 顶部加 triple-slash,`defineConfig` 加 `test` 字段:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  build: { outDir: 'dist', assetsDir: 'assets' },
  test: { environment: 'happy-dom', include: ['src/**/__tests__/*.test.ts'] },
});
```

- [ ] **Step 3: 写 harness 冒烟测试,验证跑得起来**

`src/__tests__/makeEnemy.test.ts` 先放一个冒烟用例:
```ts
import { describe, it, expect } from 'vitest';
describe('harness smoke', () => { it('runs', () => { expect(1 + 1).toBe(2); }); });
```
Run: `npm test`
Expected: PASS(确认 vitest+happy-dom 装好)。若报 `localStorage is not defined` → 确认 `test.environment` 是 `happy-dom`。

- [ ] **Step 4: 写 `makeEnemy` 失败测试(替换冒烟用例)**

`src/__tests__/makeEnemy.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { makeEnemy } from '../enemy-factory.js';
import type { EnemyDef } from '../types.js';

const base: EnemyDef = {
  n: { zh: '哥布林', en: 'Goblin' }, ch: 'g', c: '#90ee90',
  hp: 20, atk: 6, def: 2, exp: 8, g: [3, 7], ai: 'chase', mf: 1, el: 'none', tags: ['goblin'],
  res: { fire: 0.5 },
};

describe('makeEnemy', () => {
  it('applies fs scaling to hp/atk/def/exp', () => {
    const e = makeEnemy(base, 5, 7, 2.0);
    expect(e.hp).toBe(40); expect(e.maxHp).toBe(40);
    expect(e.atk).toBe(12); expect(e.def).toBe(4); expect(e.exp).toBe(16);
  });
  it('applies multiplicative mults', () => {
    const e = makeEnemy(base, 1, 1, 1, { hpM: 1.5, atkM: 1.2, defM: 0.5, expM: 2 });
    expect(e.hp).toBe(30); expect(e.atk).toBe(7); expect(e.def).toBe(1); expect(e.exp).toBe(16);
  });
  it('applies additive defAdd then mult + fs', () => {
    expect(makeEnemy(base, 0, 0, 1, { defAdd: 3 }).def).toBe(5);          // (2+3)*1
    expect(makeEnemy(base, 0, 0, 2, { defAdd: 3 }).def).toBe(10);         // (2+3)*2
    expect(makeEnemy(base, 0, 0, 1, { defAdd: 3, defM: 0.5 }).def).toBe(2); // (2+3)*0.5
  });
  it('goldDrop stays within scaled gold range', () => {
    for (let i = 0; i < 50; i++) {
      const g = makeEnemy(base, 0, 0, 1).goldDrop;
      expect(g).toBeGreaterThanOrEqual(3); expect(g).toBeLessThanOrEqual(7);
    }
    for (let i = 0; i < 50; i++) {
      const g = makeEnemy(base, 0, 0, 1, { goldM: 0.4 }).goldDrop;        // floor(rng(3,7)*0.4) in [1,2]
      expect(g).toBeGreaterThanOrEqual(1); expect(g).toBeLessThanOrEqual(2);
    }
  });
  it('nameOverride wins; default name follows lang (en)', () => {
    expect(makeEnemy(base, 0, 0, 1).name).toBe('Goblin');                 // happy-dom localStorage 空 → lang='en'
    expect(makeEnemy(base, 0, 0, 1, {}, '精英哥布林').name).toBe('精英哥布林');
  });
  it('passes through flags + defaults (isAlly false, ai from base, el, skillCd 0)', () => {
    const e = makeEnemy(base, 1, 2, 1, { isBoss: true });
    expect(e.isBoss).toBe(true); expect(e.isAlly).toBe(false);
    expect(e.ai).toBe('chase'); expect(e.el).toBe('none'); expect(e.skillCd).toBe(0);
    expect(e.x).toBe(1); expect(e.y).toBe(2);
  });
  it('deep-copies res and tags', () => {
    const e = makeEnemy(base, 0, 0, 1);
    expect(e.res).toEqual({ fire: 0.5 }); expect(e.res).not.toBe(base.res);
    expect(e.tags).toEqual(['goblin']); expect(e.tags).not.toBe(base.tags);
    e.tags!.push('mut'); expect(base.tags).toEqual(['goblin']);           // 改副本不影响 base
  });
});
```

- [ ] **Step 5: 运行测试,确认失败**

Run: `npm test`
Expected: FAIL(`Cannot find module '../enemy-factory.js'`)。

- [ ] **Step 6: 实现 `src/enemy-factory.ts`**

```ts
import type { Enemy, EnemyDef, BossDef, Element, I18nText } from './types.js';
import { lang } from './state.js';
import { rng } from './utils.js';

// EnemyDef 与 BossDef 共有的、makeEnemy 实际读取的字段。两者结构上都满足。
export type EnemyBase = {
  n: I18nText; ch: string; c: string;
  hp: number; atk: number; def: number; exp: number; g: [number, number];
  el?: Element; res?: Partial<Record<Element, number>>; tags?: string[]; ai?: string;
};

export interface EnemyMult {
  hpM?: number; atkM?: number; defM?: number; defAdd?: number;
  expM?: number; goldM?: number; isBoss?: boolean; isElite?: boolean; isAlly?: boolean;
}

export function makeEnemy(
  base: EnemyBase | EnemyDef | BossDef, x: number, y: number, fs: number,
  m?: EnemyMult, nameOverride?: string,
): Enemy {
  const hpM = m?.hpM ?? 1, atkM = m?.atkM ?? 1, defM = m?.defM ?? 1, defAdd = m?.defAdd ?? 0;
  const expM = m?.expM ?? 1, goldM = m?.goldM ?? 1;
  const hp = Math.floor(base.hp * fs * hpM);
  return {
    name: nameOverride ?? (lang === 'zh' ? base.n.zh : base.n.en),
    ch: base.ch, c: base.c, x, y,
    hp, maxHp: hp,
    atk: Math.floor(base.atk * fs * atkM),
    def: Math.floor((base.def + defAdd) * fs * defM),
    exp: Math.floor(base.exp * fs * expM),
    goldDrop: Math.floor(rng(base.g[0], base.g[1]) * goldM),
    ai: base.ai ?? 'chase',
    stunned: 0, feared: 0,
    isAlly: m?.isAlly ?? false,
    isBoss: m?.isBoss, isElite: m?.isElite,
    el: (base.el || 'none') as Element,
    res: base.res ? { ...base.res } : {},
    skillCd: 0,
    tags: base.tags ? [...base.tags] : [],
  };
}
```
> 注:`base` 形参类型写 `EnemyBase | EnemyDef | BossDef` 以兼容 BossDef(无 `ai`/`res`/`tags`/`mf`);TS 结构化会让三者都接受。

- [ ] **Step 7: 运行测试,确认通过**

Run: `npm test`
Expected: PASS(全部用例)。

- [ ] **Step 8: 替换 `enemies.ts` 6 处字面量为 `makeEnemy` 调用**

`src/enemies.ts` 顶部加 import:`import { makeEnemy } from './enemy-factory.js';`

逐处替换(保留外层房间/位置/elite 前缀逻辑,只换对象字面量):
1. `makeIn`(`:36-46`):非 elite → `return makeEnemy(base, x, y, fs);`;elite → 名字先拼 `nm`(`pf名+base名`),`return makeEnemy(base, x, y, fs, { hpM: pf.hpM, atkM: pf.atkM, defAdd: pf.defM || 0, expM: pf.expM, goldM: pf.goldM, isElite: true }, nm);`(`fs` 已含 area bonus)。
2. boss(`:62-72`):`ens.push(makeEnemy(bd, br.cx, br.cy, bs, { isBoss: true }, lang === 'zh' ? bd.n.zh : bd.n.en));`(`bs = 1+(floor-1)*.1`,ai 默认 'chase' 由 makeEnemy 兜底)。
3. 无尽 boss(`:82-92`):同 boss,`base = pick(BOSSES)`、`fs = 1+(floor-1)*.1`。
4. 分支敌(`:112-120`):`ens.push(makeEnemy(base, x, y, fs, { hpM: .7, atkM: .7, defM: .7, expM: .7, goldM: .7 }));`(`fs = 1+(entryFloor-1)*.12`)。
5. 召唤 AI(`:267-275`):`const sn = makeEnemy(base, sx, sy, fs, { hpM: .5, atkM: .7, defM: .5, expM: .3, goldM: .3 });`(`fs = 1+(fl-1)*.12`)。
6. bossSummonAdd(`:367-375`):`const sn = makeEnemy(base, sx, sy, fs, { hpM: .6, atkM: .8, defM: .6, expM: .4, goldM: .4 });`。

> 数值核对(必做):逐处比对 makeEnemy 产出的 hp/atk/def/exp 公式与原字面量逐字段相等——尤其 elite 的 `(base.def+defAdd)*fs`(加性)与分支/召唤的 `base.def*fs*defM`(乘性)都已由统一公式 `(base.def+defAdd)*fs*defM` 覆盖。

- [ ] **Step 9: typecheck + build + 冒烟**

Run: `npm run typecheck && npm run build`
Expected: clean。再起 `npm run dev`,playwright 打开页面 0 console error;进入战斗确认敌人正常生成/受伤/死亡(数值无异常)。

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/enemy-factory.ts src/__tests__/makeEnemy.test.ts src/enemies.ts
git commit -m "feat(polish-a): vitest 基座 + makeEnemy 提取(Q1)替换 6 处 Enemy 字面量"
```

---

## Task 2: P2 径向光晕缓存 + P4 原地压缩(Subagent A — `fx.ts`/`particles.ts`)

> 无单测(Canvas 渲染热点,视觉 parity 由冒烟 + final review 核验)。

**Files:**
- Modify: `src/fx.ts`(`:100-118`、`:120-181`、`:128-137`、`:164-175`)
- Modify: `src/particles.ts`(`:126-155`)

**Interfaces:**
- Consumes: Task 1 的 vitest 基座(本任务不写测试,但后续 task 共享)。
- Produces: `drawFx`/`tick` 行为零变化、性能提升。

- [ ] **Step 1: P4 — `fx.ts` sparks 原地压缩(`:100-118`)**

把:
```ts
const alive: Spark[] = [];
for (const s of sparks) { … alive.push(s); }
sparks.length = 0; for (const s of alive) sparks.push(s);
```
改为:
```ts
let w = 0;
for (const s of sparks) {
  s.life++; s.x += s.vx; s.y += s.vy; s.vx *= 0.92; s.vy *= 0.92; s.vy += 0.05;
  const t = s.life / s.maxLife;
  if (t >= 1) continue;
  …(绘制不变)…
  sparks[w++] = s;
}
sparks.length = w;
```

- [ ] **Step 2: P4 — `fx.ts` fxs 原地压缩(`:120-181`)**

同理:`const alive: Fx[]=[]` → `let w=0; … if(t>=1) continue; … fxs[w++]=f; fxs.length=w;`(绘制分支 flash/beam/dash/bolt 原样保留)。

- [ ] **Step 3: P4 — `particles.ts` 原地压缩(`:126-155`)**

`const alive: Particle[]=[]; … alive.push(p); particles = alive;` 改为:
```ts
let w = 0;
for (const p of particles) {
  …(更新/绘制/存活判定不变)…
  if (p.life < p.maxLife && p.x > -10 && p.x < w_ + 10 && p.y > -10 && p.y < h_ + 10) particles[w++] = p;
}
particles.length = w;
```
> 注意:`w`/`h` 已用作 cvs 宽高变量名(`:124-125`);压缩写索引用 `wi` 避免遮蔽。

- [ ] **Step 4: P2 — `fx.ts` 径向光晕缓存(`:128-137` flash、`:164-175` bolt)**

模块级加缓存 + 懒生成(仿 `render.ts` `glowCache`):
```ts
const fxGlowCache = new Map<string, HTMLCanvasElement>();
const FX_GLOW_R = 32; // 参考 radius;drawImage 时缩放到实际 rad
function getFxGlow(color: string): HTMLCanvasElement {
  const c = fxGlowCache.get(color);
  if (c) return c;
  const cv = document.createElement('canvas');
  cv.width = cv.height = FX_GLOW_R * 2;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(FX_GLOW_R, FX_GLOW_R, 0, FX_GLOW_R, FX_GLOW_R, FX_GLOW_R);
  const [r, gg, b] = rgb(color);
  grad.addColorStop(0, `rgba(255,255,255,1)`);
  grad.addColorStop(0.4, `rgba(${r},${gg},${b},0.6)`);
  grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grad; g.fillRect(0, 0, cv.width, cv.height);
  fxGlowCache.set(color, cv);
  return cv;
}
```
flash 分支(`:128-137`)替换 `createRadialGradient` 三停止 + arc fill 为:
```ts
const cx = pxX(f.x), cy = pxY(f.y);
const rad = Math.max(0.5, f.size * (0.5 + t * 1.5));
const spr = getFxGlow(f.color);
c.globalAlpha = a;              // 淡出走 globalAlpha,不烘焙
c.drawImage(spr, cx - rad, cy - rad, rad * 2, rad * 2);
```
bolt 分支(`:164-175`)同理:`const spr = getFxGlow(f.color); c.globalAlpha = a; c.drawImage(spr, bx - rad*2.6, by - rad*2.6, rad*5.2, rad*5.2);`(bolt 目标矩形半径 `rad*2.6`,故绘制直径 `rad*5.2`)。
> 保留 `c.globalCompositeOperation = 'lighter'`(加色叠加)与 flash/bolt 原有 `globalAlpha` 语义。终审逐参数核验:白核→color→透明的色阶、半径、目标矩形与原 gradient 等价。

- [ ] **Step 5: typecheck + build + 冒烟视觉核对**

Run: `npm run typecheck && npm run build` → clean。
`npm run dev`,playwright 触发:近战命中(fxFlash)、闪电链(fxBeam)、法术投射(fxBolt)、敌人死亡爆裂(fxBurst)、移动(dash)。analyze_image 对比优化前后截图:光晕形状/颜色/亮度无回归;0 console error。

- [ ] **Step 6: Commit**

```bash
git add src/fx.ts src/particles.ts
git commit -m "perf(polish-a): P2 径向光晕 sprite 缓存 + P4 alive[] 原地压缩(fx/particles)"
```

---

## Task 3: P5 FOV 方向预计算 + P6 explored 融合(Subagent B — `dungeon.ts`)

**Files:**
- Modify: `src/dungeon.ts`(`:112-127` computeFOV、`:130-142` updatePlayerFOV)
- Create: `src/__tests__/computeFOV.test.ts`(characterization 护栏)

**Interfaces:**
- Consumes: Task 1 vitest 基座。
- Produces: `computeFOV(map, px, py, rad, explored?) => boolean[][]`(新增可选 `explored` 入参,点亮时同步标 explored)。

- [ ] **Step 1: 写 characterization 测试(对当前代码,P5 前)**

`src/__tests__/computeFOV.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeFOV } from '../dungeon.js';
import { MH, MW, TL } from '../config.js';

const px = Math.floor(MW / 2), py = Math.floor(MH / 2), rad = 6;
function openMap(): number[][] { return Array.from({ length: MH }, () => Array(MW).fill(TL.FLOOR)); }

describe('computeFOV (characterization)', () => {
  it('origin always visible; no visible cell beyond radius', () => {
    const v = computeFOV(openMap(), px, py, rad);
    expect(v[py][px]).toBe(true);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++)
      if (v[y][x]) expect(Math.hypot(x - px, y - py)).toBeLessThanOrEqual(rad + 0.5);
  });
  it('open map: all cells within rad-1 are visible (dense ray coverage)', () => {
    const v = computeFOV(openMap(), px, py, rad);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++)
      if (Math.hypot(x - px, y - py) <= rad - 1) expect(v[y][x]).toBe(true);
  });
});
```
Run: `npm test -- computeFOV` → PASS(基线)。

- [ ] **Step 2: P5 — 预计算 `FOV_DIRS`,循环改读**

`dungeon.ts` 模块级加:
```ts
const FOV_DIRS: { dx: number; dy: number }[] = (() => {
  const arr: { dx: number; dy: number }[] = [];
  for (let a = 0; a < 360; a++) { const r = a * Math.PI / 180; arr.push({ dx: Math.cos(r), dy: Math.sin(r) }); }
  return arr;
})();
```
`computeFOV`(`:115-116`)循环体:
```ts
for (let i = 0; i < FOV_DIRS.length; i++) {
  const { dx, dy } = FOV_DIRS[i];
  let x = px + .5, y = py + .5;
  for (let d = 0; d < rad; d++) { …(不变)… }
}
```
Run: `npm test -- computeFOV` → 仍 PASS(P5 不改变 visible 集合)。

- [ ] **Step 3: Commit P5**

```bash
git add src/dungeon.ts
git commit -m "perf(polish-a): P5 computeFOV 预计算 360 方向(免每步 cos/sin)"
```

- [ ] **Step 4: P6 — 扩展测试:explored 融合断言**

`computeFOV.test.ts` 加用例(此时 computeFOV 还没 explored 入参,先写好待失败):
```ts
it('marks explored exactly for the visible set when explored grid passed', () => {
  const explored = Array.from({ length: MH }, () => Array(MW).fill(false));
  const v = computeFOV(openMap(), px, py, rad, explored);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++)
    expect(explored[y][x]).toBe(v[y][x]);
});
```
Run: `npm test -- computeFOV` → 该用例 FAIL(签名无第 5 参 / explored 未被标)。

- [ ] **Step 5: P6 — `computeFOV` 加 explored 入参 + `updatePlayerFOV` 删全图扫描**

`computeFOV`(`:112`):
```ts
export function computeFOV(map: number[][], px: number, py: number, rad: number, explored?: boolean[][]): boolean[][] {
  const v: boolean[][] = Array.from({ length: MH }, () => Array(MW).fill(false));
  v[py][px] = true;
  if (explored) explored[py][px] = true;
  for (let i = 0; i < FOV_DIRS.length; i++) {
    const { dx, dy } = FOV_DIRS[i];
    let x = px + .5, y = py + .5;
    for (let d = 0; d < rad; d++) {
      x += dx; y += dy;
      const ix = Math.floor(x), iy = Math.floor(y);
      if (ix < 0 || ix >= MW || iy < 0 || iy >= MH) break;
      v[iy][ix] = true;
      if (explored) explored[iy][ix] = true;     // 融合:射线点亮即标 explored
      if (map[iy][ix] === TL.WALL) break;
    }
  }
  return v;
}
```
`updatePlayerFOV`(`:135-139`)改为传 explored 并删第二遍扫描:
```ts
player.visible = computeFOV(map, player.x, player.y, rad, player.explored);
// 删原 :137-139 的 for(y)for(x) visible→explored 全图扫描
let exploredNew = false;   // 仍需驱动 minimap-dirty:用一个脏标志
```
> minimap-dirty:`updatePlayerFOV` 原靠 `exploredNew` 触发 `__markMinimapDirty`。融合后无第二遍,改为在 `computeFOV` 点亮新 explored 格时置脏——最简方案:`computeFOV` 多返回一个 `touchedNew` 布尔(或 `updatePlayerFOV` 比对 visible 与上一次 visible)。**采用**:给 `computeFOV` 额外返回 `{ v, dirty }` 会改返回类型波及调用者;更稳的是 `updatePlayerFOV` 内保留一个 `before` 计数快照:
```ts
const before = countExplored(player.explored);          // 累加已探明格数
player.visible = computeFOV(map, player.x, player.y, rad, player.explored);
const exploredNew = countExplored(player.explored) > before;
if (exploredNew && (window as any).__markMinimapDirty) (window as any).__markMinimapDirty();
```
`countExplored` 为本文件私有 helper(双层循环计数 true)。代价:多一遍 3150 计数,但**只计数不分配、不写**,远廉于原「分配 visible[][] + 写 explored + 再扫」;且 P6 的主收益是删掉原第二遍的 explored 写扫描与(未来)visible 分配。若剖析显示 countExplored 是热点,再改用 computeFOV 内置 dirty 标志(独立 follow-up)。

- [ ] **Step 6: 运行测试**

Run: `npm test -- computeFOV` → 全 PASS(含 explored 融合用例)。

- [ ] **Step 7: typecheck + build + 冒烟**

Run: `npm run typecheck && npm run build` → clean。`npm run dev`:走动玩家确认视野正常更新、已探明格保持点亮、隐藏陷阱进入视野后揭示、小地图随探明刷新;0 console error。

- [ ] **Step 8: Commit P6**

```bash
git add src/dungeon.ts src/__tests__/computeFOV.test.ts
git commit -m "perf(polish-a): P6 computeFOV 融合 explored 标记(删 3150 格全图第二扫)"
```

---

## Task 4: Q2 `grantKillRewards` + Q4 `Combatant`(Subagent C — `combat.ts`/`types.ts`)

**Files:**
- Modify: `src/types.ts`(加 `Combatant`)
- Modify: `src/combat.ts`(`:58` attack 签名、`:139-186` isP-kill、`:436-480` killEnemy)
- Create: `src/__tests__/grantKillRewards.test.ts`

**Interfaces:**
- Consumes: Task 1 vitest 基座;`Enemy`/`Player` 类型。
- Produces: `grantKillRewards(e: Enemy): void`(`combat.ts` 内导出);`Combatant` 接口(`types.ts` 导出)。

- [ ] **Step 1: Q4 — 加 `Combatant` 接口(`types.ts`)**

```ts
// attack() 的攻防双方共有形状;Player 与 Enemy 都满足。可选字段覆盖单方特有。
export interface Combatant {
  name: string; x: number; y: number;
  hp: number; maxHp: number; atk: number; def: number;
  exp: number; goldDrop: number;
  el?: Element; res?: Partial<Record<Element, number>>;
  ai?: string; c?: string;
  isBoss?: boolean; isElite?: boolean; isAlly?: boolean;
}
```

- [ ] **Step 2: Q4 — `attack()` 用 `Combatant`,删 `as any`**

`combat.ts:58` 签名改为:
```ts
export function attack(atk: Combatant, def: Combatant, isP: boolean): boolean {
```
`:115` `(def as any).c` → `def.c`;`:122` `(atk as any).x/y` → `atk.x/atk.y`;`:141` `(def as any).c` → `def.c`。其余 `as Enemy`(processBossPhase/onPlayerHitEnemy 等)按 tsc 提示逐处保留或删(这些函数要具体 `Enemy`,`Combatant` 不够具体,转型保留即可,目标只是消 3 处 `as any`)。
Run: `npm run typecheck` → clean(确认 Player+Enemy 都满足 Combatant)。

- [ ] **Step 3: Q2 — 写 `grantKillRewards` 失败测试**

`src/__tests__/grantKillRewards.test.ts`(mock 掉跨模块倍率/触发器,锁重复的奖励数学):
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../meta.js', () => ({
  bonusExp: (e: number) => e * 2,        // 放大倍率便于断言
  bonusGold: (g: number) => g * 3,
  getMetaFovBonus: () => 0,
}));
vi.mock('../relics.js', () => ({
  getRelicExpMult: () => 1.5, getRelicGoldMult: () => 2,
  relicOnKill: () => {}, grantRandomRelic: () => {}, relicOnHitEnemy: (d:number)=>d,
  relicOnCrit: () => {}, relicOnDodge: () => {}, setKillEnemyFn: () => {},
}));
vi.mock('../talents.js', () => ({
  onPlayerKill: () => {}, onPlayerHitEnemy:(d:number)=>d, onPlayerDodged:()=>{},
  onPlayerDamaged:()=>{}, onEnemyHitPlayer:()=>{}, getManaShieldReduction:()=>0, getCritMultiplier:()=>2,
}));
vi.mock('../steam.js', () => ({ checkAch: () => {}, checkAchs: () => {} }));

import { grantKillRewards } from '../combat.js';
import type { Enemy, GameState } from '../types.js';

function fixtureEnemy(over: Partial<Enemy> = {}): Enemy {
  return { name:'Goblin', ch:'g', c:'#0f0', x:1, y:1, hp:0, maxHp:10, atk:3, def:1,
    exp:8, goldDrop:5, ai:'chase', stunned:0, feared:0, isAlly:false, el:'none', res:{}, skillCd:0, ...over } as Enemy;
}
function fixtureG(): any {
  return { player: { exp:0, gold:0, kills:0, streak:0, bestStreak:0, bossesKilledThisRun:0, level:1 },
           enemies: [], floor:1, branchMode:false, endless:false };
}

describe('grantKillRewards', () => {
  beforeEach(() => { (globalThis as any).G = fixtureG(); });
  it('grants exp/gold with relic mults, increments kills + streak', () => {
    const G = (globalThis as any).G;
    grantKillRewards(fixtureEnemy({ exp:8, goldDrop:5 }));
    expect(G.player.exp).toBe(Math.floor(8*2*1.5));     // bonusExp*relicExp
    expect(G.player.gold).toBe(Math.floor(5*3*2));      // bonusGold*relicGold
    expect(G.player.kills).toBe(1); expect(G.player.streak).toBe(1);
  });
  it('streak bonus at >=3 and tracks bestStreak', () => {
    const G = (globalThis as any).G; G.player.streak = 2;
    grantKillRewards(fixtureEnemy({ exp:8 }));
    expect(G.player.streak).toBe(3); expect(G.player.bestStreak).toBe(3);
    // 连杀 bonus = bonusExp(floor(8*0.2*3)) * relicExp = floor(4.8)*... 已加进 exp
    expect(G.player.exp).toBeGreaterThan(Math.floor(8*2*1.5));
  });
  it('boss kill increments bossesKilledThisRun; non-boss does not', () => {
    const G = (globalThis as any).G;
    grantKillRewards(fixtureEnemy({ isBoss:false })); expect(G.player.bossesKilledThisRun).toBe(0);
    grantKillRewards(fixtureEnemy({ isBoss:true }));  expect(G.player.bossesKilledThisRun).toBe(1);
  });
});
```
Run: `npm test -- grantKillRewards` → FAIL(`grantKillRewards` 未导出)。

> 若 combat.ts 导入链在测试加载时报错(canvas/document),在文件顶追加对应 `vi.mock`(如 `vi.mock('../fx.js',()=>({fxFlash:()=>{},fxBurst:()=>{},fxBeam:()=>{},fxBolt:()=>{},fxDash:()=>{}}))`、`vi.mock('../effects.js',()=>({flt:()=>{},shake:()=>{}}))`、`vi.mock('../messages.js',()=>({addMsg:()=>{}}))`)。先跑一次看缺哪个再补。

- [ ] **Step 4: Q2 — 实现 `grantKillRewards`(`combat.ts`)**

在 `killEnemy` 上方加(把两处共享核心抽出):
```ts
function grantKillRewards(e: Enemy): void {
  if (!G) return;
  G.player.exp += Math.floor(bonusExp(e.exp) * getRelicExpMult());
  G.player.gold += Math.floor(bonusGold(e.goldDrop) * getRelicGoldMult());
  G.player.kills++;
  G.player.streak++;
  if (G.player.streak > G.player.bestStreak) G.player.bestStreak = G.player.streak;
  if (G.player.streak >= 3) {
    const bonus = bonusExp(Math.floor(e.exp * .2 * G.player.streak));
    G.player.exp += bonus;
    addMsg(`🔥 ${G.player.streak}x${t('streakMsg')} +${bonus}XP`, 'ml');
    checkAch('streak5');
  }
  addMsg(lang === 'zh' ? `${e.name}被击败！+${bonusExp(e.exp)}经验` : `${e.name} defeated! +${bonusExp(e.exp)} XP`, 'mc');
  if (e.isBoss) {
    G.player.bossesKilledThisRun++;
    checkAch('boss_kill');
    if (G.floor === FINAL && !G.branchMode && !G.endless) { playerVictory(); return; }
    if (G.floor === FINAL && G.endless)
      addMsg(lang === 'zh' ? '👑 你击败了创世者,但深渊仍在下探……' : '👑 You slay the Creator, yet the abyss yawns deeper...', 'md');
  }
  onPlayerKill(e);
  relicOnKill(e);
  if (e.isBoss || (e.isElite && Math.random() < 0.4)) grantRandomRelic(e.x, e.y, G.floor);
  checkLevelUp(); checkAchs();
}
```
> 导出:测试 import `{ grantKillRewards }`,故加 `export`。原 `killEnemy`/`attack` 内联段改为调它。措辞统一:击败消息用 `bonusExp(e.exp)`(killEnemy 原用 `e.exp` 的 bug 由此修正)。

- [ ] **Step 5: Q2 — `attack()` isP-kill 段 + `killEnemy()` 改调 `grantKillRewards`**

`attack()` 内 `def.hp <= 0 && isP` 段(`:142-186`):删 exp/gold/kills/streak/streak-bonus/boss块/onPlayerKill/relicOnKill/relic-drop/checkLevelUp/checkAchs(这些进了 grantKillRewards),**保留** `fxBurst`(`:141`,在判断内之前)、**保留战利品掉落**(`:177-184`,近战专属)与结尾。改为:
```ts
if (def.hp <= 0) {
  if (isP) {
    fxBurst(def.x, def.y, def.c || (atkEl !== 'none' ? FX_EL_COLOR[atkEl] : '#ff6b6b'), def.isBoss ? 26 : 12, def.isBoss ? 1.6 : 1);
    grantKillRewards(def as Enemy);
    // 战利品掉落保留(近战专属)
    if (Math.random() < .3 && _genItem) { …(原 :178-184 不变)… }
    snd('pickup');
  }
}
```
`killEnemy()`(`:436-480`):保留 `fxBurst`(`:438`)、`G.enemies = G.enemies.filter(en => en !== e)`(`:442`)、结尾 double-strike(`:473-480`);中间奖励段(`:443-471`)替换为 `grantKillRewards(e);`。

- [ ] **Step 6: 运行测试**

Run: `npm test -- grantKillRewards` → PASS。`npm test` → 全套 PASS。

- [ ] **Step 7: typecheck + build + 冒烟**

Run: `npm run typecheck && npm run build` → clean。`npm run dev`:近战/技能/卷轴/陷阱/盟友各杀敌,确认经验/金币/连杀/boss 计数/成就/遗物掉落/升级照常;F40 创世者击杀普通模式胜利、无尽模式继续;0 console error。

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/combat.ts src/__tests__/grantKillRewards.test.ts
git commit -m "refactor(polish-a): Q2 提取 grantKillRewards(单一奖励管线+统一XP措辞) + Q4 Combatant 接口(消 as any)"
```

---

## Final: 全套测试 + final opus 全分支审查 + 合并

- [ ] **F1: 全套测试 + typecheck + build**

Run: `npm test && npm run typecheck && npm run build` → 全绿。

- [ ] **F2: final opus whole-branch review**

用 `superpowers:requesting-code-review` 发起 opus 全分支审查,逐项 code-level 核验:
- P2 光晕几何/色阶/目标矩形与原 gradient parity;
- P4 三处压缩语义不变(存活判定条件原样);
- P5/P6 visible 集合不变、explored 融合等价、minimap-dirty 仍触发;
- Q1 六处 makeEnemy 产出逐字段等于原字面量(含 elite 加性 def / 分支召唤乘性 def);
- Q2 奖励单一管线无重复结算、战利品仍近战专属、double-strike 仍仅 killEnemy、XP 措辞统一;
- Q4 `Combatant` 满足 Player+Enemy、3 处 `as any` 清零、无类型收窄回归。

- [ ] **F3: 按 review 修 + re-review,Critical/Important 清零**

- [ ] **F4: ff-merge `main` + push origin(仅当用户要求时 push)**

```bash
git checkout main && git merge --ff-only polish-a
# git push origin main   # 待用户确认
```

- [ ] **F5: 更新 memory(`darkhollow-steam-optimization.md`)**:Polish-A 完成(vitest 引入 + 7 项 + 自审教训);Polish-B(Q3/Q5/Q6)为下批。

---

## Self-Review(spec 覆盖核对)

- P2 → Task 2 Step 4 ✓;P4 → Task 2 Step 1-3 ✓;P5 → Task 3 Step 2 ✓;P6 → Task 3 Step 5 ✓
- Q1 → Task 1 Step 6-8 ✓;Q2 → Task 4 Step 4-5 ✓;Q4 → Task 4 Step 1-2 ✓
- vitest 基座 → Task 1 Step 1-3 ✓;测试仅覆盖提取模块 → makeEnemy(T1)/computeFOV(T3)/grantKillRewards(T4)✓,P2/P4/Q4 不写单测 ✓
- 非目标守住:Polish-B 不碰 ✓;P6 boolean[][] 分配未动(Task 3 Step 5 注明 follow-up)✓
- 类型一致:`makeEnemy`/`EnemyBase`/`EnemyMult`(T1)↔ T1 测试与 enemies.ts 调用 ✓;`grantKillRewards(e: Enemy)`(T4)↔ 测试与两处调用 ✓;`Combatant`(T4 types)↔ attack 签名 ✓
