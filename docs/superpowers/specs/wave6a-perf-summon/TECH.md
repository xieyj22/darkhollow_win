# Wave 6a:光环渐变缓存化 + summon.kind 精确召唤

技术规格。对应 `darkhollow`。本规格是 Wave 6a 实现与验收的唯一对照基准。Wave 6 内容扩展的第 1 波(共 4 波:6a 性能+召唤 / 6b 现有 area 多样性 / 6c 新生物群系 / 6d 无尽模式)。

提交基准:`17d4b42`(Wave 5 merge + push 后的 main HEAD)。代码引用 pin 此 commit。

---

## Context

两块独立小债:

1. **每帧重建径向渐变(已知 P3)**。Wave 5 把敌人迁入动态层 `drawEnemyLayer` 后,3 处径向渐变在 `particles.tick` 的每帧为每个实体重建:
   - [`render.ts` drawPlayerLayer L73 @ 17d4b42](https://github.com/xieyj22/darkhollow_win/blob/17d4b42/src/render.ts#L73) — 玩家金色光晕(`createRadialGradient` 内径 2 / 外径 TS*1.5,色阶 0.12/0.05/0,绘 TS*2 见方)。
   - [`render.ts` drawEnemyLayer L99 @ 17d4b42](https://github.com/xieyj22/darkhollow_win/blob/17d4b42/src/render.ts#L99) — boss 金光环(同几何,色阶 0.18/0.08/0)。
   - [`render.ts` drawEnemyLayer L108 @ 17d4b42](https://github.com/xieyj22/darkhollow_win/blob/17d4b42/src/render.ts#L108) — elite 元素光(内径 1 / 外径 TS,5 色 fire/ice/lightning/shadow/holy,色阶 0.12/0)。
   每帧 `createRadialGradient` 分配对象 + `fillStyle` 赋值 + `fillRect`;敌人多时(≤~15 + 玩家)每帧十几次,纯浪费——这些渐变是**固定图案**(中心+色阶固定,只随实体屏幕位置平移)。vignette([L281](https://github.com/xieyj22/darkhollow_win/blob/17d4b42/src/render.ts#L281))是 `render()` 每回合一次,非热路径,不动。

2. **boss 召唤随机池,不贴主题**。[`BossDef.summon`](https://github.com/xieyj22/darkhollow_win/blob/17d4b42/src/types.ts#L202-L207) = `{ chance, cd, maxAdds }`,无种类字段;[`bossSummonAdd` enemies.ts](https://github.com/xieyj22/darkhollow_win/blob/17d4b42/src/enemies.ts#L268-L295) 从 `ENEMIES.filter(mf 窗口)` 随机 `pick`。结果:哥布林王可能召出蝙蝠、龙皇可能召出骷髅——不贴 boss 主题。6 个 boss 有 summon 定义([data.ts:165-195](https://github.com/xieyj22/darkhollow_win/blob/17d4b42/src/data.ts#L165-L195))。

关键既有机制(本规格复用):
- `ENEMIES` 各项有稳定的 `n.en` 唯一名(无 `id` 字段)。
- `bossSummonAdd` 已用 `fs = 1 + (fl-1)*.12` 缩放被召敌人;运行时敌人构造见 [enemies.ts makeIn](https://github.com/xieyj22/darkhollow_win/blob/17d4b42/src/enemies.ts#L21-L45)。
- 项目 sprite/渲染缓存范式:`sprites.ts` 的 `spriteCache`/`silCache`(Map 按 sig 缓存 offscreen canvas);本规格的渐变缓存沿用同模式。

---

## 目标与范围(6a)

- **Part A — 渐变缓存**:`drawPlayerLayer` 玩家光晕 + `drawEnemyLayer` boss 光环 + elite 元素光,改为预渲染 offscreen canvas(按 key 缓存)每帧 `drawImage`;视觉与 reducedMotion 行为零变化。
- **Part B — summon.kind**:`BossDef.summon` 加可选 `kind?: string`;`bossSummonAdd` 优先按 `kind`(= `n.en`)召唤指定敌人(跳过 mf 窗口、照常 `fs` 缩放),查不到回退现池;给 6 个会召唤的 boss 配主题小弟。

非目标:6b/6c/6d(后续波);vignette 缓存;给 ENEMIES 加 `id` 字段;`summon.kind` 支持多类型 list(后续扩展)。

---

## Proposed changes

### Part A — 渐变缓存(`src/render.ts`)

1. **新 helper `getGlow`**(放在 `render.ts` 顶部缓存区,近 `getScanlineOverlay`):
```ts
// Cached radial-gradient sprites (offscreen canvases). Each glow is a fixed
// pattern centered locally — only its screen position changes per frame — so
// we paint it once and drawImage it, instead of createRadialGradient per frame.
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
   每个 key 在首次使用时建一张 offscreen(size×size,渐变居中,填满),之后每帧只 `drawImage`。

2. **drawPlayerLayer(L73-77)** 用 cache 替换:
```ts
const glow = getGlow('player-glow', TS * 2, 2, TS * 1.5,
  [[0, 'rgba(255,215,0,0.12)'], [0.5, 'rgba(255,215,0,0.05)'], [1, 'rgba(255,215,0,0)']]);
c.drawImage(glow, px - TS * 0.5, py - TS * 0.5);
```
   (替换原 `pGrad` 三行 + `fillRect`;`drawPlayerSprite` 行不动。)

3. **drawEnemyLayer boss 光环(L98-104)** 替换为:
```ts
if (e.isBoss) {
  const aura = getGlow('boss-aura', TS * 2, 2, TS * 1.5,
    [[0, 'rgba(255,215,0,0.18)'], [0.5, 'rgba(255,215,0,0.08)'], [1, 'rgba(255,215,0,0)']]);
  c.drawImage(aura, sx - TS * 0.5, sy - TS * 0.5);
}
```

4. **drawEnemyLayer elite 元素光(L105-112)** 替换为:
```ts
if (e.isElite && e.el !== 'none') {
  const elColors: Record<string, string> = { fire: '255,69,0', ice: '100,149,237', lightning: '255,215,0', shadow: '128,0,128', holy: '255,255,200' };
  const ecg = elColors[e.el] || '255,255,255';
  const eg = getGlow('elite-glow:' + e.el, TS + 8, 1, TS,
    [[0, `rgba(${ecg},0.12)`], [1, `rgba(${ecg},0)`]]);
  c.drawImage(eg, sx - 4, sy - 4);
}
```
   共 7 张缓存(player-glow / boss-aura / elite-glow:fire|ice|lightning|shadow|holy)。`drawImage` 1:1 无缩放(目标尺寸 = offscreen 尺寸),与原 `fillRect` 像素一致。

5. **TS 变化时清缓存**:`resizeCanvas` 已使 `scanlineCanvas = null`;同处加 `glowCache.clear()`(TS 不变,但保险)。实际 TS 是常量(`config.ts`),可省,但加上更稳。

### Part B — summon.kind(`src/types.ts` + `src/data.ts` + `src/enemies.ts`)

1. **`types.ts` `BossDef.summon`** 加可选字段([L202-207](https://github.com/xieyj22/darkhollow_win/blob/17d4b42/src/types.ts#L202-L207)):
```ts
summon?: {
  chance: number;
  cd: number;
  maxAdds: number;
  kind?: string;   // 指定召唤敌人的 n.en;省略则用楼层随机池
};
```

2. **`enemies.ts` `bossSummonAdd`** 优先按 kind([L268-295](https://github.com/xieyj22/darkhollow_win/blob/17d4b42/src/enemies.ts#L268-L295)):把开头取 `base` 的逻辑改为:
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
  // ……(下方原召唤生成逻辑不变:找空位、构造 sn、push、flt、addMsg)
```
   注意:`cfg.kind` 引用的敌人 mf 可能不在 fl 窗口内(如龙皇 F25 召 Dragon Whelp mf11)——**刻意跳过窗口**,照常 `fs` 缩放,使主题小弟能出现且数值贴当前层。无 `kind` 时行为与现状一致(向后兼容)。

3. **`data.ts`** 给 6 个会召唤的 boss 加 `kind`(在现有 `summon: {...}` 里加字段):
   - 哥布林王(F5,L166)→ `kind: 'Goblin'`
   - 蜘蛛女王(F10,L169)→ `kind: 'Spider'`
   - 吸血鬼领主(F15,L172)→ `kind: 'Vampire'`
   - 远古巫妖(F20,L175)→ `kind: 'Skeleton'`
   - 龙皇(F25,L178)→ `kind: 'Dragon Whelp'`
   - 虚空君主(F35,L189)→ `kind: 'Void Wraith'`
   创世者(F40,L195)不加 kind(造物主题,留随机池)。

---

## Global Constraints

- **视觉零回归(Part A 硬约束)**:缓存的 offscreen 渐变在尺寸/中心/内径/外径/色阶上与原 `createRadialGradient` 逐项一致;`drawImage` 1:1 无缩放到原 `fillRect` 的同一矩形。boss 金光环、elite 元素光、玩家光晕外观必须不变。
- **向后兼容(Part B)**:无 `kind` 的 boss 召唤走原随机池,行为不变;旧存档不受影响(纯运行时逻辑,`summon.kind` 是新可选字段)。
- **性能预算**:Part A 只减不增(每帧从十几次 createRadialGradient 降到 0 次分配 + 若干 drawImage)。
- 无测试框架;验证 = `npm run typecheck` + `npm run build` + playwright 冒烟 + 手动 QA。
- 代码引用 pin `17d4b42`。

---

## Testing and validation

- `npm run typecheck` + `npm run build` 必过。
- **playwright 冒烟**(沿用 Wave 5 的 smoke 脚本范式,`npm run dev` + headless):
  - 载入、开局、控制台无新报错(渐变缓存不应产生异常)。
  - 截图:玩家/boss/elite 光环**视觉与 Wave 5 一致**(金光环 + 元素光仍在,外观无变化)。
  - 到 F5(可用 meta/调试进入)触发哥布林王召唤:召出的小弟名是 `Goblin`(flt/消息或截图),非随机。
- 手动 QA(`npm run dev`):光环外观无变化、boss 召唤主题小弟、无 kind 的 boss(创世者)仍随机、reducedMotion 下光环仍正常。
- 回归:Wave 5 的敌人补间/bob/描边/legend 不受影响(Part A 只改光晕绘制路径,Part B 只改召唤取敌)。

---

## Parallelization

两 task 文件不重叠,**可并行**:
- **轨 A(渐变缓存)** — subagent,owns `src/render.ts`:`getGlow` + 3 处替换 + resize 清缓存。local 同一 checkout。
- **轨 B(summon.kind)** — subagent,owns `src/types.ts` / `src/data.ts` / `src/enemies.ts`:`BossDef.summon.kind` + `bossSummonAdd` kind 优先 + 6 boss 配 kind。local 同一 checkout。
- 收口(主 Agent):集成 typecheck/build + playwright 冒烟 + 手动 QA + ff-merge main + push。

文件归属不重叠(render.ts vs types/data/enemies),并发≤2 避 429。

---

## Follow-ups

- 6b:现有 8 个 area 加专属敌人/机制多样性。
- 6c:新增中段生物群系。
- 6d:F40+ 无尽模式。
- 可选:`summon.kind` 支持多类型 list;vignette 缓存;给 ENEMIES 加 `id` 字段替 `n.en` 引用。
