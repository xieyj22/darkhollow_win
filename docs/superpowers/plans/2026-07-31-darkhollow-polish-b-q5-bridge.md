# Polish-B / Q5:typed `bridge.ts` 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: 用 superpowers:subagent-driven-development(或 executing-plans)逐 task 实现。步骤用 `- [ ]` 跟踪。

**Goal:** 新建 typed `src/bridge.ts` 叶子模块,把 78 处 `(window as any).__*`(25 个全局)全部迁移到 `bridge`,清零 `as any`,零行为变更。

**Architecture:** bridge.ts 只 import type(叶子)→ 打破原来靠 `window.__` 避循环依赖的格局;写点 `bridge.foo = X`、读点 `bridge.foo?.()`,语义与原 window 间接等价(只是有类型)。硬门 `grep "(window as any)\.__" src/` 必须为 0。

**Tech Stack:** TS 5.7 + Vite 6 + vitest3(happy-dom,Polish-A 已引入)。Pin 基准 `e9b7004`。

## Global Constraints

- **零行为变更**:bridge 是引用语义(`bridge.classes = CLASSES` 与 `window.__CLASSES = CLASSES` 同引用);未绑定的函数读点用 `?.()` 保持原"未初始化则 no-op"语义。
- **硬门**:`grep -rn "(window as any)\.__" src/ | wc -l` === 0(25 个全局全迁移,无残留)。
- **不碰** `window.dh`(Electron 桥,保留);不改 data.ts/types.ts(Q5 只读写点 + 新建 bridge.ts);Q6/Q3。
- **验证三件套**:vitest(`bridge.test.ts`)+ typecheck + build clean + 有头冒烟(0 pageerror,渲染/暂停/语言/音效切换照常)。
- **分支** `polish-b-q5` off `main`(@ e9b7004);429 则主 Agent 内联。

---

## File Structure

- **Create** `src/bridge.ts` — typed 叶子注册表(25 字段)。
- **Create** `src/__tests__/bridge.test.ts` — set/get 往返 + 默认值 + 未设 no-op。
- **Modify** `src/main.ts` — 顶部 window 挂载块(~L48-55)改 bridge 赋值;各处读 `__foo` 改 `bridge.foo`。
- **Modify** `src/render.ts` — canvas/ctx/miniCtx/markMinimapDirty 的写读点。
- **Modify** `src/audio.ts` — `__audioCtx`/`__muted` 写读点。
- **Modify** 读点散布的文件:`input.ts` `items.ts` `dungeon.ts` `particles.ts` `options.ts` `save.ts` `events.ts` `game.ts`(按 grep `(window as any)\.__` 实际命中)。

---

## Task 1: 建 bridge.ts + 迁移全部 78 站点(subagent,机械)

**Files:** 如上(create 2 + modify ~10)。

**Interfaces:**
- Produces: `bridge` 对象(`src/bridge.ts`),25 字段(见规格 §1)。

- [ ] **Step 1: 建 `src/bridge.ts`**

按规格 §1 的代码块落地(25 字段,默认值 `muted:false, classes:[], achDefs:[], talentTrees:[]`,其余 optional)。只 `import type { ClassDef, AchievementDef, TalentTree } from './types.js'`(DOM 类型走 lib.dom)。

- [ ] **Step 2: 写 `bridge.test.ts` 先行(TDD 锁契约)**

```ts
import { describe, it, expect } from 'vitest';
import { bridge } from '../bridge.js';

describe('bridge registry', () => {
  it('defaults: muted false, data arrays empty, fns unset', () => {
    expect(bridge.muted).toBe(false);
    expect(bridge.classes).toEqual([]);
    expect(bridge.achDefs).toEqual([]);
    expect(bridge.talentTrees).toEqual([]);
    expect(bridge.render).toBeUndefined();
  });
  it('typed set/get round-trips for a fn and a value', () => {
    const fn = () => {};
    bridge.render = fn; expect(bridge.render).toBe(fn);
    bridge.muted = true; expect(bridge.muted).toBe(true);
    bridge.classes = [{ n:{en:'C',zh:'C'}, /*…ClassDef 必填…*/ } as any];
    expect(bridge.classes.length).toBe(1);
    // 清理(避免跨用例泄漏)
    bridge.render = undefined; bridge.muted = false; bridge.classes = [];
  });
  it('calling an unset fn via ?.() is a no-op (does not throw)', () => {
    expect(() => { bridge.render?.(); bridge.openPause?.(); }).not.toThrow();
  });
});
```
Run: `npm test -- bridge` → PASS。

- [ ] **Step 3: 迁移写点(集中)**

`grep -rn "(window as any)\.__.*= " src/` 列出全部写点。逐处:
- `main.ts:48-55` 整块:`(window as any).__CLASSES = CLASSES;` → `bridge.classes = CLASSES;`(achDefs/talentTrees 同);`(window as any).__render = render;` → `bridge.render = render;`(updateUI/recalc/markMinimapDirty/renderInv/renderHotbar/…/toggleLang/… 同)。
- `render.ts:181-182`:`bridge.canvas = c; bridge.ctx = c.getContext('2d');`;minimap 的 `__miniCtx` 同。
- `audio.ts`:`__audioCtx`/`__muted` 写点改 bridge。
- 顶部各文件加 `import { bridge } from './bridge.js';`(仅引入它的文件)。

- [ ] **Step 4: 迁移读点(散布,10 文件)**

`grep -rn "(window as any)\.__" src/` 列出剩余(读点)。逐处按形态:
- `if ((window as any).__foo) (window as any).__foo();` → `bridge.foo?.();`
- `(window as any).__foo?.();` → `bridge.foo?.();`
- 数据读 `(window as any).__CLASSES` → `bridge.classes`(`__ACH_DEFS`→`achDefs`、`__TALENT_TREES`→`talentTrees`)。
- canvas 读 `(window as any).__ctx` → `bridge.ctx` 等。

- [ ] **Step 5: 硬门 grep 必须为 0**

Run: `grep -rn "(window as any)\.__" src/ | wc -l` → **0**。非 0 则定位漏改处补上(常见:漏 import bridge、或某文件少改一行)。

- [ ] **Step 6: typecheck + build + 全测**

Run: `npm run typecheck && npm run build && npm test` → 全 clean / 全绿。tsc 应无 `as any` 相关新错(若某 bridge 字段类型不符,核对规格 §1 类型)。

- [ ] **Step 7: 有头冒烟**

`npm run dev`(或 preview,rebuild 后)→ 用 smoke.mjs(已加移动序列)起 run + 移动 + 开背包/技能/暂停/切语言/切音效 → 0 pageerror;渲染/小地图/暂停弹窗/语言切换照常。

- [ ] **Step 8: Commit**

```bash
git add src/bridge.ts src/__tests__/bridge.test.ts src/*.ts
git commit -m "refactor(polish-b): Q5 typed bridge.ts 替 78 处 (window as any).__*(零行为变更)"
```

---

## Final: final opus 全分支审查 + 合并

- [ ] **F1**:`review-package e9b7004 HEAD`;opus 全分支审查,逐项核验:25 字段类型正确、78 站点无遗漏(grep 0 已证)、无新循环依赖、data 引用语义未漂移、可选链语义等价。
- [ ] **F2**:按 review 修 + scoped re-review,Critical/Important 清零。
- [ ] **F3**:ff-merge `main` + push origin。
- [ ] **F4**:更新 memory(`darkhollow-steam-optimization.md`):Q5 完成;Polish-B 剩 Q6/Q3。

---

## Self-Review(spec 覆盖核对)

- bridge.ts 25 字段 → Task 1 Step 1 ✓
- 写点迁移 → Step 3 ✓;读点迁移 → Step 4 ✓
- 硬门 grep 0 → Step 5 ✓
- bridge.test → Step 2 ✓;typecheck/build → Step 6 ✓;冒烟 → Step 7 ✓
- 非目标守住:window.dh 不碰 ✓;Q6/Q3 不碰 ✓;data 去间接列为 follow-up ✓
- 类型一致:`bridge.foo` 全程同名(写读一致)✓
