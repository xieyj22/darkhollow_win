# Polish-B / Q5:typed `bridge.ts`(替 78 处 `(window as any).__*`)

技术规格。对应 `darkhollow`。本规格是 Q5 实现与验收的唯一对照基准。Polish-B 三件(Q5 typed bridge / Q6 拆文件 / Q3 i18n)各自独立 spec,本批先做 **Q5**(顺序 Q5→Q6→Q3)。

提交基准:`e9b7004`(Polish-A + playerDeath 修复合并并 push 后的 main HEAD)。代码引用 pin 此 commit。

---

## Context

为打破循环依赖,前端各模块用 `window.__foo` 做 late-binding 手动桥(例如 render.ts 要调 main.ts 的 `markMinimapDirty`,但 main.ts 又 import render.ts → 循环;于是 main.ts 把函数挂 `window.__markMinimapDirty`,render.ts 经 window 反查)。全码库 **78 处** `(window as any).__*`,共 **25 个不同全局**,全 `as any` 无类型。

- **仅 TS bundle 内部访问**:preload.cjs / index.html / electron 都不碰 `__*`(已 grep 确认)。注意 `window.dh`(Electron preload 的全屏/存档/steam 桥)是另一套,**不在本规格范围**。
- 25 个全局分三类:
  - **canvas/audio**(render.ts:181-182 / audio.ts 设):`__canvas` `__ctx` `__miniCtx` `__audioCtx` `__muted`。
  - **data**(main.ts:48-50 设一次):`__CLASSES`(ClassDef[])`__ACH_DEFS`(AchievementDef[])`__TALENT_TREES`(TalentTree[])。
  - **late-bound 函数**(main.ts:51-55 等,定义后挂窗):17 个,全部 `() => void`——`__render __updateUI __recalc __markMinimapDirty __renderInv __renderHotbar __renderHelp __renderOptions __openPause __closePause __closeOptions __openSellInv __toggleLang __toggleSound __updateLangUI __updateSoundBtn __initAudio`(全部无参调用,已核 `__markMinimapDirty()`/`__updateUI()`/`__render()`/`__renderHotbar?.()` 等)。
- 调用形态:`(window as any).__render = render;`(写)、`if ((window as any).__render) (window as any).__render();`(读)、`(window as any).__renderHotbar?.();`(可选链读)。

关键既有定义(本规格复用,不改):`t()`/`L` 字典([`i18n.ts`](https://github.com/xieyj22/darkhollow_win/blob/e9b7004/src/i18n.ts))、`render()` [`render.ts:212`](https://github.com/xieyj22/darkhollow_win/blob/e9b7004/src/render.ts#L212)、`updateUI()` [`render.ts:418`](https://github.com/xieyj22/darkhollow_win/blob/e9b7004/src/render.ts#L418)、`markMinimapDirty()` [`render.ts:143`](https://github.com/xieyj22/darkhollow_win/blob/e9b7004/src/render.ts#L143)、`recalc()` [`combat.ts:222`](https://github.com/xieyj22/darkhollow_win/blob/e9b7004/src/combat.ts#L222)、`CLASSES/ACH_DEFS/TALENT_TREES` [`data.ts:16/230/507`](https://github.com/xieyj22/darkhollow_win/blob/e9b7004/src/data.ts#L16)、`ClassDef/AchievementDef/TalentTree` [`types.ts:36/476/314`](https://github.com/xieyj22/darkhollow_win/blob/e9b7004/src/types.ts#L36)。

---

## 目标与范围(Q5)

- 新建 `src/bridge.ts`:**叶子模块**(只 import type),导出单一 typed 可变 `bridge` 对象,承载上述 25 个字段(干净 camelCase,去 `__` 前缀)。
- 78 处 `(window as any).__*` 全部迁移:写 `(window as any).__foo = X` → `bridge.foo = X`;读 `(window as any).__foo` → `bridge.foo?.()` 或 `bridge.foo`。
- **硬验收**:`grep -rn "(window as any)\.__" src/` 返回 0(证明 25 个全局全部迁移,无残留)。

**非目标**:`window.dh`(Electron 桥,保留);把 data 全局改成 data.ts 直接 import(Q5 只做"typed 桥",不做架构级去间接——那会触发循环依赖逐项分析,属可选 follow-up);Q6/Q3。

---

## Proposed changes

### 1. `src/bridge.ts`(新)

```ts
// Typed late-binding registry. Leaf module (imports only types) — breaks the
// cycles that previously put these on `window`. Setters assign after their
// definitions; readers call via optional-chain so unset fns no-op gracefully.
// DOM 类型(HTMLCanvasElement / CanvasRenderingContext2D / AudioContext)走 lib.dom,无需 import
import type { ClassDef, AchievementDef, TalentTree } from './types.js';
type VoidFn = () => void;

export const bridge: {
  // canvas / audio (render.ts / audio.ts init 时设)
  canvas?: HTMLCanvasElement;
  ctx?: CanvasRenderingContext2D;
  miniCtx?: CanvasRenderingContext2D;
  audioCtx?: AudioContext;
  muted: boolean;
  // data (main.ts 加载时设一次)
  classes: ClassDef[];
  achDefs: AchievementDef[];
  talentTrees: TalentTree[];
  // late-bound UI/render fns (main.ts 定义后设)
  render?: VoidFn; updateUI?: VoidFn; recalc?: VoidFn; markMinimapDirty?: VoidFn;
  renderInv?: VoidFn; renderHotbar?: VoidFn; renderHelp?: VoidFn; renderOptions?: VoidFn;
  openPause?: VoidFn; closePause?: VoidFn; closeOptions?: VoidFn; openSellInv?: VoidFn;
  toggleLang?: VoidFn; toggleSound?: VoidFn; updateLangUI?: VoidFn; updateSoundBtn?: VoidFn;
  initAudio?: VoidFn;
} = { muted: false, classes: [], achDefs: [], talentTrees: [] };
```

> `HTMLCanvasElement`/`CanvasRenderingContext2D`/`AudioContext` 来自 TS lib.dom(无需 import)。`bridge.ts` 只 `import type { ClassDef, AchievementDef, TalentTree }`,确为叶子。

### 2. 写点迁移(集中,约 25 处)

- `main.ts:48-55`:`(window as any).__CLASSES = CLASSES;` → `bridge.classes = CLASSES;`(同理 `achDefs/talentTrees/render/updateUI/recalc/markMinimapDirty/...`,把 main.ts 顶部那段 window 挂载块整体改为 bridge 赋值)。
- `render.ts:181-182`:`(window as any).__canvas = c;` → `bridge.canvas = c;`(同理 `ctx`);minimap 的 `__miniCtx` 同。
- `audio.ts`:`__audioCtx`/`__muted` 同。
- 其余 setter 按各自定义文件 grep `__foo =` 定位。

### 3. 读点迁移(分散,10 文件,约 53 处)

- 形态 1:`if ((window as any).__foo) (window as any).__foo();` → `bridge.foo?.();`
- 形态 2:`(window as any).__foo?.();` → `bridge.foo?.();`
- 形态 3(数据读):`(window as any).__CLASSES` → `bridge.classes`(如 `input.ts:454 await_getClasses`、各处读 `__ACH_DEFS`/`__TALENT_TREES`)。
- 形态 4(canvas/ctx 读):`(window as any).__ctx` / `__canvas` / `__miniCtx` → `bridge.ctx` / `bridge.canvas` / `bridge.miniCtx`(按 grep 实际站点定位,不预判文件)。

### 4. 循环依赖正确性

`bridge.ts` 只 import type → 叶子。所有原 `window.__` 读写方改为 import `bridge`(而非拥有该函数的模块),不引入新环;原 window 间接本就是为避环,语义不变(只是有类型了)。

---

## Testing and validation

- **`src/__tests__/bridge.test.ts`(新)**:typed set/get 往返(`bridge.render = fn; expect(bridge.render).toBe(fn)`);默认值(`muted===false`、三数组为空);未设函数 `bridge.nope?.()` 不抛(可选链 no-op);`bridge.classes = CLASSES` 后 `bridge.classes.length` 正确。锁契约。
- **硬门**:`grep -rn "(window as any)\.__" src/ | wc -l` === 0。
- **typecheck + build**:`tsc --noEmit` + `vite build` clean(`as any` 清零由 tsc 兜底)。
- **有头冒烟**(沿用 Polish-A 的 smoke.mjs):起 run + 移动 + 开背包/技能/暂停/切语言/切音效 → 0 pageerror;渲染/小地图/暂停/语言切换照常(这些路径正是被迁移的 late-bound 函数)。
- **final opus 全分支审查**:code-level 核验 25 字段类型正确、78 站点无遗漏、无新循环依赖(build 兜底)、data 字段未被重复直接 import 致语义漂移。

---

## Parallelization

**不并行,单 subagent task**(Q5 规模适中、站点跨 10 文件但纯机械)。一次 implementer + 一次 task-reviewer;final opus 全分支审查。429 则主 Agent 内联(沿用 Polish-A 经验)。

分支 `polish-b-q5` off `main`(@ e9b7004);顺序提交;final review 通过后 ff-merge `main` + push origin。

可拆点(若 implementer 觉得太大):Task A 建 bridge.ts + 迁写点;Task B 迁读点。但单 task 更稳(grep 硬门要全量迁移才通过)。

---

## Risks and mitigations

- **迁移遗漏**:某处 `__foo` 漏改 → 硬门 grep 返回非 0 直接失败,过不了。缓解:grep 硬门 + tsc(window.__ 无类型,漏改处仍 `as any` 编译过,但 grep 抓到)。
- **data 全局语义漂移**:`bridge.classes = CLASSES` 是引用赋值,与原 `window.__CLASSES = CLASSES` 同;读方拿到的还是同一数组。缓解:不变(引用语义);测试断言 length。
- **可选链语义**:`bridge.foo?.()` 与原 `if(window.__foo) window.__foo()` 等价(未绑定则 no-op)。缓解:逐处核对原"是否守卫"形态,守卫的一律 `?.()`,无守卫的(确信已绑定,如 canvas 读)直接 `bridge.foo`(必要时 `?.` 防御)。
- **新循环依赖**:bridge.ts 是叶子,不会;但若某站点错误地 import 了拥有函数的模块而非 bridge,可能引入环。缓解:build(tsc/vite)兜底报环。

---

## Follow-ups

- **data 全局去间接(可选)**:`__CLASSES/__ACH_DEFS/__TALENT_TREES` 实为 data.ts 导出,若各读方能直接 import data.ts 而无环,可去掉 bridge 里的 data 字段(更纯)。需逐项循环依赖分析,非本批。
- **Q6**(Polish-B 下一件):拆 input.ts/items.ts/main.ts——Q5 的 typed bridge 让拆分时 `as any` 更少、更安全。
- **Q3**(Polish-B 最后):241 处 i18n 迁移。
