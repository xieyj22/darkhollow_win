# darkhollow Wave 3 bugfix(P0+P1)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development。轻量流程:bug 已由审查定位(根因+行号+修复方向明确),无需 brainstorm;本文件合并 spec 角色。

**Goal:** 修审查发现的 P0(3 真 bug)+ P1(3 体感)共 6 条。

**Architecture:** 单 implementer 顺序修 6 条(分散在 combat/render/player/main.css,不同函数/文件,顺序做不冲突)。#4/#5 都涉及 `setPlayerTween`,协同修。

**Tech Stack:** TS 5.7 + Vite 6 + 纯 CSS。

## Global Constraints

- 无测试框架;验证 = `npm run typecheck` + `npm run build` + 手动 QA(`npm run dev` 复现)。
- 只改必要文件;不动 gameplay 逻辑、补间架构、Wave 1/2 既有改动。
- 单 implementer 顺序(不并行)。
- 提交基准:`3f01da8`(main HEAD)。
- 修复时参考同文件既有模式(如 `attack()` 的遗物倍率写法、`toggleLegend` 模式)。

---

## Task 1: bugfix batch(P0×3 + P1×3)

**Files:** `src/combat.ts`、`src/render.ts`、`src/player.ts`、`style/main.css`

- [ ] **#1(P0) `combat.ts` `killEnemy` 补遗物经验/金币倍率**

[combat.ts:410](https://github.com/xieyj22/darkhollow_win/blob/3f01da8/src/combat.ts#L410) 现状:
```ts
G.player.exp += bonusExp(e.exp); G.player.gold += bonusGold(e.goldDrop); G.player.kills++;
```
改为(与 `attack()` 的 L141-142 一致——先读 attack 确认 `getRelicExpMult`/`getRelicGoldMult` 的确切写法与是否已 import;若未 import 则加 `import { getRelicExpMult, getRelicGoldMult } from './relics.js'`):
```ts
G.player.exp += Math.floor(bonusExp(e.exp) * getRelicExpMult());
G.player.gold += Math.floor(bonusGold(e.goldDrop) * getRelicGoldMult());
G.player.kills++;
```

- [ ] **#2(P0) `render.ts` `updateUI` 空占位不覆盖 slowed 图标**

[render.ts:379](https://github.com/xieyj22/darkhollow_win/blob/3f01da8/src/render.ts#L379) 的「None」条件,把:
```ts
if (!p.buffs.length && p.poisonTurns <= 0 && setIds.every(id => (p.setBonusActive[id] || 0) < 2)) {
```
改为(加 `&& p.slowed <= 0`):
```ts
if (!p.buffs.length && p.poisonTurns <= 0 && p.slowed <= 0 && setIds.every(id => (p.setBonusActive[id] || 0) < 2)) {
```

- [ ] **#3(P0) `render.ts` `renderObjective` 读真实 boss 计数**

[render.ts:407](https://github.com/xieyj22/darkhollow_win/blob/3f01da8/src/render.ts#L407) 把估算:
```ts
const bossesKilled = Math.floor((fl - 1) / 5);
```
改为读真实值(`bossesKilledThisRun` 在 `createPlayer` 初始化、`killEnemy` boss 时 `++`):
```ts
const bossesKilled = G.player.bossesKilledThisRun;
```

- [ ] **#4(P1) `player.ts` `movePlayer` 传送时不补间(避免穿帮)**

[player.ts:78-102](https://github.com/xieyj22/darkhollow_win/blob/3f01da8/src/player.ts#L78-L102):把 `setPlayerTween(pfx, pfy, nx, ny)` 从 [L80](https://github.com/xieyj22/darkhollow_win/blob/3f01da8/src/player.ts#L80)(改坐标后立即)**移到** `checkTiles()` 之后、`_endTurn()` 之前,并加坐标守卫——传送会改 `G.player.x/y`,此时不补间(玩家直接在新位置):
```ts
  // 删掉原 L80 的 setPlayerTween
  // ... pickup / checkTraps / if(G.gameOver) return / checkTiles 不变 ...
  // 只有未传送(玩家仍在本次移动目的地)才补间
  if (G.player.x === nx && G.player.y === ny) setPlayerTween(pfx, pfy, nx, ny);
  if (_endTurn) _endTurn();
```

- [ ] **#5(P1) `render.ts` 补间可中断(按住移动不卡顿)**

提取 easing 计算,`setPlayerTween` 时若上次 tween 仍存活,从**当前视觉位置**继续(而非旧目标→回退)。在 `drawPlayerLayer` 附近加 helper 并改 `setPlayerTween`:
```ts
function currentTweenPos(): { lx: number; ly: number } | null {
  if (!_playerTween) return null;
  const p = Math.min(1, (performance.now() - _playerTween.t0) / TWEEN_DUR_MS);
  const e = 1 - (1 - p) * (1 - p); // easeOutQuad
  return { lx: _playerTween.fx + (_playerTween.tx - _playerTween.fx) * e,
           ly: _playerTween.fy + (_playerTween.ty - _playerTween.fy) * e };
}

export function setPlayerTween(fx: number, fy: number, tx: number, ty: number): void {
  if (reducedMotion) { _playerTween = null; return; }
  const cur = currentTweenPos();           // 上次未完成 → 从视觉当前位置继续
  _playerTween = { fx: cur ? cur.lx : fx, fy: cur ? cur.ly : fy, tx, ty, t0: performance.now() };
}
```
`drawPlayerLayer` 复用 `currentTweenPos()` 算显示位置(progress≥1 清除)。

- [ ] **#6(P1) `main.css` sidebar 折叠按钮跟随宽度**

[main.css:78](https://github.com/xieyj22/darkhollow_win/blob/3f01da8/style/main.css#L78) `#sidebar` 与 [L332](https://github.com/xieyj22/darkhollow_win/blob/3f01da8/style/main.css#L332) `#btn-sidebar-toggle{left:260px}` 硬编码。改用 CSS 变量:
- `:root` 加 `--sidebar-w: 250px;`(默认档)
- `#sidebar` 的 `width`/`min-width` 改为 `var(--sidebar-w)`(L78 与各 media query 的 sidebar 行)
- 五个断点 media query 各设 `--sidebar-w`(170/200/230/250/280)
- `#btn-sidebar-toggle` 的 `left: 260px` 改为 `left: var(--sidebar-w)`
- `#game-container.sidebar-collapsed #btn-sidebar-toggle{left:0}` 保留

- [ ] **验证**

Run: `npm run typecheck` → 必须无错。
Run: `npm run build` → 必须成功。
手动 QA(`npm run dev`):
- #1:用法术/卷轴杀怪,经验/金币有遗物倍率(对比近战)。
- #2:只有减速(slowed)无其他 buff 时,🐌 图标显示、不被「无」覆盖。
- #3:跳过 boss 楼层(用楼梯)/击杀 boss 后逗留,boss 计数正确。
- #4:踩传送陷阱/深渊传送,玩家直接在新位置(不穿墙滑动)。
- #5:按住方向键持续移动,无回退顿挫。
- #6:拖窗口跨断点,sidebar 折叠按钮始终贴在 sidebar 右边缘。

- [ ] **Commit**

```bash
git add src/combat.ts src/render.ts src/player.ts style/main.css
git commit -m "fix: Wave3 P0+P1 bugfix(遗物倍率/None覆盖/boss计数/传送穿帮/补间卡顿/toggle位置)"
```

---

## Self-Review

- **覆盖**:P0(#1/#2/#3)+ P1(#4/#5/#6)全 6 条,各有根因+修复+验证。
- **No placeholder**:每条给具体代码或明确改法;#1 标注先读 attack 确认 import。
- **一致性**:`currentTweenPos` 在 #5 定义、`drawPlayerLayer` 复用;`--sidebar-w` 在 #6 定义、`#sidebar`/`#btn-sidebar-toggle` 引用。
- **YAGNI**:只修 P0+P1,P2/P3 不在本批;不动 gameplay/补间架构。
