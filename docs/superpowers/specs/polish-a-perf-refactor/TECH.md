# Polish-A:性能优化 + 受控重构(自审 P1剩余/P2/Q1·Q2·Q4)

技术规格。对应 `darkhollow`。本规格是 Polish-A 实现与验收的唯一对照基准。

提交基准:`d159a15`(自审 P0+P1+P3 修复后的 main HEAD)。代码引用 pin 此 commit。

---

## Context

`d159a15` 与 `31715ec` 两个提交来自一次全码库「上 Steam 前自审」(3 维度:P0 真 bug / P1 每帧性能 / P2 每回合性能 / P3 代码质量)。P0(B1 盟友击杀/B2 无尽 boss 缩放/B3 音频节点泄漏)、P1 层的 P1(fx spark rgb 预解析)、P3 层的 P3(render 元素表 hoist)已修。**本规格处理剩余 7 项**,分两批:**Polish-A**(本规格,7 项安全/受控项 + 引入 vitest)、**Polish-B**(后续独立规格,Q3 i18n 大迁移 / Q5 typed bridge / Q6 文件拆分)。

关键既有代码(本规格改动 / 复用):

- FX 引擎 [`fx.ts`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/fx.ts):`drawFx()` 每帧绘制 sparks 与 fxs。两处每帧 `createRadialGradient`——flash [`fx.ts:131`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/fx.ts#L131)、bolt [`fx.ts:169`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/fx.ts#L169),结构同为 白核→颜色→透明,颜色在 Fx 生命周期内不变。两处「分配 `alive[]`→push→`length=0`→回灌」压缩模式:sparks [`fx.ts:101-117`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/fx.ts#L101-L117)、fxs [`fx.ts:121-180`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/fx.ts#L121-L180)。`Spark` 已有 `r,g,b`(`fx.ts:24`)。
- 粒子循环 [`particles.ts:126-155`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/particles.ts#L126-L155):同样的 `alive[]` 压缩,末尾 `particles = alive` 重赋值。
- FOV [`dungeon.ts`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/dungeon.ts):`computeFOV()` [`:112`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/dungeon.ts#L112) 每步 360 次 `cos/sin`([`:116`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/dungeon.ts#L116),方向向量是常量)+ 每步分配 `boolean[MH][MW]`(`:113`)。`updatePlayerFOV()` [`:130`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/dungeon.ts#L130) 拿到 visible 后又**全图扫描 3150 格**把 visible 并入 explored([`:137-139`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/dungeon.ts#L137-L139))——这是冗余的第二遍。
- Enemy 构造:`Enemy` 接口 [`types.ts:220`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/types.ts#L220)、`EnemyDef` [`:162`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/types.ts#L162)。**6 处重复对象字面量**:`spawnEnemies` 普通敌 [`enemies.ts:36`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/enemies.ts#L36)(含 elite)、boss [`:62`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/enemies.ts#L62)、无尽 boss [`:82`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/enemies.ts#L82)、分支敌 `spawnBranchEnemies` [`:112`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/enemies.ts#L112)、召唤 AI [`:267`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/enemies.ts#L267)、boss 召唤 `bossSummonAdd` [`:367`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/enemies.ts#L367)。形状一致,差异在 fs 缩放(.1 boss / .12 普通 / .12+area)、乘数(elite 的 hpM/atkM/defAdd/expM/goldM;分支 .7;召唤 .5/.7/.3;boss 召唤 .6/.8/.4)、isBoss/isElite 标志。
- 战斗 [`combat.ts`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/combat.ts):`attack()` [`:58`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/combat.ts#L58) 用**两个巨型内联类型字面量**描述 atk/def,致 3 处 `as any`([`:115`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/combat.ts#L115) `(def as any).c`、[`:122`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/combat.ts#L122) `(atk as any).x/y`、[`:141`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/combat.ts#L141))与多处 `as Enemy`。**奖励管线重复两处**:玩家近战击杀走 `attack()` 内联([`:142-186`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/combat.ts#L142-L186)),技能/卷轴/盟友/陷阱击杀走 `killEnemy()`([`:436-480`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/combat.ts#L436-L480));两处 exp/gold/kills/streak/boss计数/胜利/talent-on-kill/relic-drop 几乎一致,且消息 XP 措辞不一致(`attack` 用 `bonusExp(def.exp)`,`killEnemy` 用原始 `e.exp`)。

---

## 目标与范围(Polish-A)

7 项 + vitest 测试基座。**全部零行为变更**(除 Q2 顺带统一消息 XP 措辞),纯性能 + 可维护性。

**性能(每帧/每回合,P1剩余 + P2):**
- **P2**:`fx.ts` flash/bolt 每帧 `createRadialGradient` → 每色预渲染一个 offscreen 径向 sprite,`drawImage` 缩放(复用 `render.ts` `glowCache` 模式)。
- **P4**:`fx.ts` + `particles.ts` 的 `alive[]` 压缩 → 原地 write-index 压缩,零分配。
- **P5**:`computeFOV` 每步 360 次 `cos/sin` → 模块级预计算 `const FOV_DIRS`。
- **P6**:`updatePlayerFOV` 冗余的 3150 格 explored 全图扫描 → 在射线投射时同步标记 explored,删第二遍。

**受控重构(提取→测试):**
- **Q1**:6 处 Enemy 字面量 → 提取 `makeEnemy(base, x, y, fs, mult)`。
- **Q2**:`attack()` 与 `killEnemy()` 重复奖励管线 → 提取 `grantKillRewards(e)`,两处共用。
- **Q4**:`attack()` 内联类型 → 定义 `Combatant` 接口(Player 与 Enemy 都满足),消除 `as any`。

**非目标**:Polish-B 的 Q3(241 处 i18n 迁移)/ Q5(78 处 bridge)/ Q6(拆 input·items·main);P6 的 `boolean[][]` 分配本身(改 `player.visible` 形状会波及所有 `visible[y][x]` 读取者,回归风险大于收益,留待性能剖析驱动);fx.ts 中 `rgb(f.color)` 每帧调用(48 fx 上限,微小,非本批)。

---

## Proposed changes

### 1. vitest 测试基座(新)
- 加 devDep `vitest` + 轻量 `happy-dom`(被测模块经 `state.ts`/`combat.ts`→`fx.ts` 传递触及 DOM-ish 加载,需 DOM env)。`vite.config.ts` 加 `test: { environment: 'happy-dom', include: ['src/**/__tests__/*.test.ts'] }`。`package.json` 加 `"test": "vitest run"`、`"test:watch": "vitest"`。
- 测试只覆盖被提取的纯模块:`makeEnemy`、`grantKillRewards`。`G` 用最小 fixture(局部构造 `{player:{exp,gold,kills,streak,bestStreak,bossesKilledThisRun,...}, enemies:[], floor:1}`),不引真实 Canvas/存档。

### 2. Q1 `makeEnemy`(新文件 `enemy-factory.ts`,被 `enemies.ts` 引入)

> 放在独立文件而非 `enemies.ts` 内:`enemies.ts` 顶部 import 了 `combat`/`render`/`talents`/`relics` 等重模块,在 vitest 里加载整链过重;`makeEnemy` 只需 `lang`(state)+`rng`(utils)+类型,独立文件让单测导入链干净。`EnemyDef` 与 `BossDef` 共有的字段用结构化基类型 `EnemyBase`(n/ch/c/hp/atk/def/exp/g/el + 可选 res/tags/ai)收编,使 6 处(含 boss 的 BossDef)都能调用。
```ts
makeEnemy(base: EnemyBase, x: number, y: number, fs: number,
          m?: { hpM?: number; atkM?: number; defM?: number; defAdd?: number;
                expM?: number; goldM?: number; isBoss?: boolean; isElite?: boolean; isAlly?: boolean },
          nameOverride?: string): Enemy
```
- 统一公式:`hp/maxHp = floor(base.hp*fs*(hpM??1))`;`atk = floor(base.atk*fs*(atkM??1))`;`def = floor((base.def + (defAdd??0))*fs*(defM??1))`(同时收编 elite 的加性 defAdd 与分支/召唤的乘性 defM);`exp = floor(base.exp*fs*(expM??1))`;`goldDrop = floor(rng(base.g[0],base.g[1])*(goldM??1))`;`name = lang==='zh'?base.n.zh:base.n.en`;`res = base.res?{...base.res}:{}`;`tags = base.tags?[...base.tags]:[]`;`stunned:0,feared:0,skillCd:0,isAlly:m?.isAlly??false,isBoss?,isElite?`。
- **签名再加可选 `nameOverride?: string`**:elite 名字是「前缀名 + base 名」、boss 名直传,都由调用方拼好经 `nameOverride` 传入,覆盖默认的 `lang==='zh'?base.n.zh:base.n.en`。
- 6 处字面量逐一替换为 `makeEnemy(...)` 调用,保留各自 fs/mult/位置参数与外层逻辑(房间选择、elite 前缀拼接、召唤位置校验等)。
- 行为不变:同一 base+fs+mult 产出与原字面量逐字段相等的 Enemy。

### 3. Q2 `grantKillRewards(e: Enemy)`(`combat.ts`)
提取两处共享的奖励核心,两处都调用:
```ts
function grantKillRewards(e: Enemy): void {
  // exp/gold(含 relic 倍率)、kills++、streak++(+>=3 连杀 bonus)、boss计数(bossesKilledThisRun++)、
  // FINAL 胜利/无尽守卫、onPlayerKill、relicOnKill、relic drop(boss必/elite40%)、checkLevelUp、checkAchs
}
```
- **留在调用点**(两处 genuine 差异):`fxBurst` 死亡爆裂、从 `G.enemies` 移除、**战利品掉落(仅近战,保留现行行为)**、`killEnemy` 的 double-strike。
- **顺带修措辞不一致**:`grantKillRewards` 内击败消息统一用 `bonusExp(e.exp)`(与经验实发一致)。
- `attack()` isP-kill 段([`:142-186`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/combat.ts#L142-L186))与 `killEnemy()`([`:443-471`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/combat.ts#L443-L471))的共享部分都改为调 `grantKillRewards`。

### 4. Q4 `Combatant` 接口(`types.ts` + `combat.ts`)
```ts
export interface Combatant {
  name: string; x: number; y: number;
  hp: number; maxHp: number; atk: number; def: number;
  exp: number; goldDrop: number;
  el?: Element; res?: Partial<Record<Element, number>>;
  ai?: string; c?: string;
  isBoss?: boolean; isElite?: boolean; isAlly?: boolean;
}
```
- `Player` 与 `Enemy` 都已满足(字段全部存在或可选)。`attack(atk: Combatant, def: Combatant, isP: boolean)` 替换内联字面量。
- 消除 3 处 `as any`(`.c`/`.x`/`.y` 现为合法可选字段);`as Enemy` 转型按需保留(`processBossPhase(def as Enemy)` 等仍要具体类型,但数量减少)。

### 5. P2 径向光晕缓存(`fx.ts`)
- 模块级 `fxGlowCache: Map<string, HTMLCanvasElement>`,key=color。`getFxGlow(color)` 懒生成:offscreen canvas 画 白核→color→透明 的径向(reference radius,如 32px),全程 alpha=1(淡出靠 `globalAlpha`)。
- flash(`:128-137`)/ bolt(`:164-175`)改为 `c.drawImage(sprite, cx-rad, cy-rad, rad*2, rad*2)` + `c.globalAlpha = a`,半径当前帧计算。视觉与原 gradient 等价(终审逐参数核验几何/色阶/目标矩形)。

### 6. P4 原地压缩(`fx.ts` + `particles.ts`)
- sparks / fxs / particles 三处的 `const alive=[];…alive.push;arr.length=0;for push` 改为:
  ```ts
  let w = 0;
  for (const s of arr) { … if (alive) arr[w++] = s; }
  arr.length = w;
  ```
- `particles.ts` 的 `particles = alive` 重赋值改为原地截断。语义不变(存活判定条件原样保留)。

### 7. P5 FOV 方向预计算 + P6 explored 融合(`dungeon.ts`)
- P5:模块级 `const FOV_DIRS: { dx: number; dy: number }[]`(360 项,启动算一次)。`computeFOV` 循环读 `FOV_DIRS[a]` 替代 `cos/sin`。
- P6:`updatePlayerFOV` 不再事后全图扫 visible→explored。改为在 `computeFOV` 射线点亮 `v[iy][ix]=true` 的同时标记 explored——具体:`computeFOV` 增可选 `explored?: boolean[][]` 入参,点亮时 `if (explored && !explored[iy][ix]) { explored[iy][ix]=true; }`,`updatePlayerFOV` 传入 `player.explored` 并删 [`:137-139`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/dungeon.ts#L137-L139) 第二遍。陷阱揭示(`:141`)与 minimap-dirty(`:140`)逻辑保留。

---

## Testing and validation

- **vitest 单测(新)**:
  - `makeEnemy.test.ts`:多组 `(fs, mult)` 组合断言 hp/atk/def/exp 逐字段;`defAdd`(加性)与 `defM`(乘性)同时生效;`nameOverride` 覆盖;`res`/`tags` 为深拷贝(改副本不影响 base)。
  - `grantKillRewards.test.ts`:击杀后 `exp/gold`(含 relic 倍率)/`kills`/`streak`/`bestStreak`/连杀 bonus 正确;boss 击杀 `bossesKilledThisRun++`;非 boss 不触发胜利;elite 40% relic 掉落用固定随机断言。
- **typecheck + build**:`npm run build`(tsc + vite)clean——Q4 `Combatant` 类型错误、所有回归由 tsc 兜住。
- **有头冒烟 QA**(沿用项目 playwright + analyze_image 法):dev server 起来 0 console error;analyze_image 核验 P2 光晕渲染与优化前视觉等价;FOV/explored 仍正确(已探明格保持、隐藏陷阱入视野揭示);战斗奖励照常结算(经验/金币/连杀/boss 计数)。
- **final opus 全分支审查**(code-level 逐项核验):光晕几何/色阶 parity、压缩语义不变、FOV explored 融合无遗漏点亮、奖励管线单一来源无重复结算、`Combatant` 满足 Player+Enemy 无类型收窄。

---

## Parallelization

**不并行,顺序 subagent SDD。** 7 项虽落在不相交文件上(Q1→`enemies.ts`;P2+P4→`fx.ts`+`particles.ts`;P5+P6→`dungeon.ts`;Q2+Q4→`combat.ts`+`types.ts`),但本仓库历史上并发 subagent 反复撞 GLM-5.1 5h 用量上限(429)且即便文件不重叠 `npm run build`/checkout 仍会相撞(见项目教训 [[subagent-parallel-gotchas]])。本批规模小,顺序执行更稳。

任务划分(每 task = implementer + task-review,429 则主 Agent 内联接手):

1. **主 Agent(先):vitest 基座 + Q1 `makeEnemy`**(`enemies.ts` + `package.json`/`vite.config.ts` + `src/__tests__/makeEnemy.test.ts`)。先落地测试框架与第一个 TDD 范式。
2. **Subagent A — fx 性能**:P2 + P4(`fx.ts`、`particles.ts`)。
3. **Subagent B — FOV 性能**:P5 + P6(`dungeon.ts`)。
4. **Subagent C — combat 重构**:Q2 + Q4(`combat.ts`、`types.ts`)——含 `grantKillRewards.test.ts`(依赖步骤 1 的 vitest)。

分支 `polish-a` off `main`;每个 task 在该分支上顺序提交;final opus 审查通过后 ff-merge `main` + push origin。

---

## Risks and mitigations

- **P2 光晕视觉回归**:预渲染 sprite 与逐帧 gradient 几何/色阶需一致。缓解:终审逐参数核验;淡出一律走 `globalAlpha` 不烘焙进 sprite。
- **P6 explored 融合**:射线只点亮「可见」格,explored 也只在这些格标记——与原「visible 并入 explored」语义等价,但须保证 `explored` 一旦为 true 不被改回(只置 true)。缓解:单测/冒烟验证已探明格持久 + 隐藏陷阱入视野揭示。
- **Q2 行为保真**:战利品保持「仅近战掉落」、double-strike 保持「仅 killEnemy」——这是两处 genuine 差异,提取时不抹平。缓解:测试 + 冒烟;终审确认调用点保留差异。
- **Q4 类型收窄**:`Combatant` 须不窄到使任一调用方编译失败。缓解:字段全可选化(`c/ai/isBoss/...`),tsc 兜底。
- **vitest 引入**:`happy-dom` env + 最小 G fixture;若被测模块加载链仍有 DOM 访问失败,改用 `vi.mock('./state.js')` 等隔离。缓解:步骤 1 先跑通 makeEnemy 测试再展开。

---

## Follow-ups

- **Polish-B(独立规格)**:Q3 241 处 `lang==='zh'?'…':'…'` → `t('key')`(`t()` 已存在 [`i18n.ts:148`](https://github.com/xieyj22/darkhollow_win/blob/d159a15/src/i18n.ts#L148));Q5 78 处 `(window as any).__*` → typed `bridge.ts`;Q6 拆 `input.ts`(595)/`items.ts`(629)/`main.ts`(606)。
- P6 的 `boolean[][]` 分配:若性能剖析指明是热点,再改 `player.visible` 为 flat `Uint8Array`(波及所有读取者,需独立规格)。
- fx.ts `rgb(f.color)` 每帧调用(48 上限):Polish-B 顺手可按 Spark 模式预解析进 Fx 对象。
