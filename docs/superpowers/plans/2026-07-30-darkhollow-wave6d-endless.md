# darkhollow Wave 6d(无尽模式 · 开局选模式)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新游戏角色选择加「普通 / 无尽」模式栏;无尽模式 F40 击败创世者不结束,继续 F41+ 无限楼层(endless area + 递增缩放 + 每 5 层 scaled boss + 专属强敌),死即结算分数。普通模式原封不动。

**Architecture:** `G.endless` 在 initGame 时按 Mode 栏设定;胜利判定加 `&& !G.endless`(替代旧胜利屏续接);F41+ 命中 endless area + spawnEnemies 加 endless scaled boss;死亡结算 endless 分数入 `MetaStats.bestEndlessFloor` + 成就。

**Tech Stack:** TypeScript 5.7 + Vite 6 + Canvas2D;无测试框架。

## Global Constraints

- **无测试框架**。验证 = `npm run typecheck` + `npm run build` + playwright 冒烟 + 手动 QA。
- **普通模式零改动**:F1-40 胜利/win/creator_kill 成就/echoes 全不变。
- **向后兼容**:旧存档(`endless` 缺)迁移默认 false。
- **难度**:F41+ `fs` 继续涨(沿用现公式,测试期观察,必要时 F60+ 软封顶)。
- **汉化**:Mode 栏 / endless area lore / 强敌 / 成就 / UI 双语完整。
- 代码引用 pin `6becd3a`(spec commit 后 HEAD)。每 Task 一 commit。
- **并行**:Task 1(机制:types/save/main/game/combat/enemies/meta/render)与 Task 2(内容:`data.ts`)文件不重叠,可并行;Task 3 依赖 1+2。

---

## File Structure

| 文件 | 动作 | 责任 |
|------|------|------|
| `src/types.ts` | Modify | T1:`GameState.endless?` + `MetaStats.bestEndlessFloor` |
| `src/save.ts` | Modify | T1:旧档迁移 `endless=false` + `stats.bestEndlessFloor=0` |
| `src/main.ts` | Modify | T1:showCharSelect 加 Mode 栏 + 传 initGame |
| `src/game.ts` | Modify | T1:`initGame(ri,ci,endless)` + enterFloor>FINAL endless area + endless boss 规则 |
| `src/combat.ts` | Modify | T1:胜利判定 `!G.endless` + endless 死亡结算分数 |
| `src/enemies.ts` | Modify | T1:spawnEnemies 加 F45+ scaled boss |
| `src/meta.ts` | Modify | T1:updateRunStats 记 bestEndlessFloor + 成就触发 |
| `src/render.ts` | Modify | T1:endless UI(floor label + death-screen 分数) |
| `src/data.ts` | Modify | T2:endless AreaDef + 3-5 强敌(mf40+)+ 3 成就 def |

---

## Task 1: 无尽机制(模式入口 + 胜利门 + F41+ 无限 + 分数)

**Files:** `types.ts`/`save.ts`/`main.ts`/`game.ts`/`combat.ts`/`enemies.ts`/`meta.ts`/`render.ts`

**Interfaces:**
- Produces:`GameState.endless?`;`initGame(ri,ci,endless=false)`;`MetaStats.bestEndlessFloor`。
- Consumes:无(运行时引用 Task 2 的 endless area/强敌/成就 def;编译不依赖——AREAS.find 未命中走 fallback)。

- [ ] **Step 1: `types.ts` 字段**
`GameState` 加 `endless?: boolean`;`MetaStats` 加 `bestEndlessFloor: number`。

- [ ] **Step 2: `save.ts` 迁移**
loadGame:`if (gameState.endless === undefined) gameState.endless = false;`;meta 迁移 `if (m.stats.bestEndlessFloor === undefined) m.stats.bestEndlessFloor = 0;`(沿用既有 meta 迁移区)。

- [ ] **Step 3: `game.ts` initGame 收 endless**
[`initGame(ri,ci)` L17](https://github.com/xieyj22/darkhollow_win/blob/6becd3a/src/game.ts#L17) 改 `initGame(ri: number, ci: number, endless = false)`,GameState 字面量加 `endless`。

- [ ] **Step 4: `main.ts` showCharSelect 加 Mode 栏**
[`showCharSelect` L105-155](https://github.com/xieyj22/darkhollow_win/blob/6becd3a/src/main.ts#L105-L155):
- 顶部加 `let selMode = 0;`(0=普通,1=无尽)。
- 仿 `raceHtml`/`classHtml` 构 `modeHtml`(两项 `.mode-opt`,`data-idx="0/1"`,文案「普通模式 / Normal」「无尽模式 / Endless」,默认 0 高亮)。
- overlay innerHTML 的 flex 行加一个 Mode 列(`<div><h3>...</h3>${modeHtml}</div>`)。
- 加 `.mode-opt` onclick → 设 selMode + 切 border 样式(抄 race 的 onclick)。
- begin onclick:`initGame(selRace, selCls, selMode === 1)`(注意:`startNewGame`→`showCharSelect` 流程,selMode 在 showCharSelect 作用域)。

- [ ] **Step 5: `combat.ts` 胜利判定 + endless 死亡结算**
- 两处 [`if (G.floor === FINAL ...)` L161、L430](https://github.com/xieyj22/darkhollow_win/blob/6becd3a/src/combat.ts#L161) 改 `if (G.floor === FINAL && !G.endless && !G.branchMode)`。无尽模式 F40 创世者击杀:加一句 flavor `addMsg(lang==='zh' ? '👑 你击败了创世者,但深渊仍在下探……' : '👑 You slay the Creator, yet the abyss yawns deeper...','md')`(放在 endless 不胜利的分支,可选——或在 enterFloor F41 时提示)。
- [`playerDeath` combat.ts](https://github.com/xieyj22/darkhollow_win/blob/6becd3a/src/combat.ts) 的结算:`updateRunStats` 调用处,若 `G.endless` 则传 endless 标志 + 额外 `endlessFloor: G.floor`。

- [ ] **Step 6: `enemies.ts` F45+ scaled boss**
[`spawnEnemies` boss 段 L56-71](https://github.com/xieyj22/darkhollow_win/blob/6becd3a/src/enemies.ts#L56)(`BOSSES.find(fl===floor)`),在其后加:
```ts
if (floor > FINAL && floor % 5 === 0 && G) {
  const base = pick(BOSSES);              // 随机复用一个主线 boss def
  const fs = 1 + (floor - 1) * .12;
  ens.push({ name: lang==='zh'?base.n.zh:base.n.en, ch:base.ch, c:base.c, x:br.cx, y:br.cy, ai:base.ai||'chase',
    hp:Math.floor(base.hp*fs), maxHp:Math.floor(base.hp*fs), atk:Math.floor(base.atk*fs), def:Math.floor(base.def*fs),
    exp:Math.floor(base.exp*fs), goldDrop:rng(base.g[0],base.g[1]), isBoss:true, stunned:0,feared:0,isAlly:false,
    el:base.el||'none', res:{}, skillCd:0 });
}
```
(放在 boss 段 `br`/rooms 可达处;`FINAL`/`pick`/`BOSSES` 已 import。)

- [ ] **Step 7: `game.ts` enterFloor > FINAL + setBgmScene 容错**
`enterFloor` 中 area 取得后,F41+ 自动命中 endless area(Task 2 提供,fallback AREAS[0] 兜底)。确认 `setBgmScene('explore', area?.id)` 对 `'endless'` 不崩(已有 fallback)。

- [ ] **Step 8: `meta.ts` bestEndlessFloor + 成就**
[`updateRunStats` L194-208](https://github.com/xieyj22/darkhollow_win/blob/6becd3a/src/meta.ts#L194-L208):加 `if (stats.endless && stats.endlessFloor) meta.stats.bestEndlessFloor = Math.max(meta.stats.bestEndlessFloor, stats.endlessFloor);`。`updateRunStats` 的参数类型加可选 `endless?/endlessFloor?`。成就触发:endless 死亡结算处 `if (G.endless) { if (G.floor>=50) checkAch('endless50'); ... }`(或 playerDeath 内)。

- [ ] **Step 9: `render.ts` endless UI**
[`renderObjective`/floor label L419-425](https://github.com/xieyj22/darkhollow_win/blob/6becd3a/src/render.ts#L419-L425):`G.endless` 时显 `♾ 无尽 {floor} 层`(替代 F40/40 + BOSS 标);death-screen(combat.ts playerDeath 拼 HTML)endless 时显无尽楼层 + 分数 +「新纪录」(若破)。

- [ ] **Step 10: typecheck + build + Commit**
```bash
npm run typecheck && npm run build   # 必过
git add src/types.ts src/save.ts src/main.ts src/game.ts src/combat.ts src/enemies.ts src/meta.ts src/render.ts
git commit -m "feat: 无尽模式机制(开局选模式+F41+无限+分数)"
```

---

## Task 2: 无尽内容(endless area + 强敌 + 成就)

**Files:** `src/data.ts`

- [ ] **Step 1: endless AreaDef**
AREAS 末尾加 `id:'endless'`,`floorStart:41, floorEnd:9999`:扭曲虚空主题色 + `wallChar:'▓'` + `enemyScaleBonus:0.15` + `specialTiles`(VOID_FLOOR,count [3,8])+ 2-3 lore(zh/en)。

- [ ] **Step 2: 3-5 endless 强敌**
ENEMIES 末尾加 `mf` 40+ 强敌(Void Titan mf45 / Doom Seraph mf48 / Entropy Beast mf50 等,数值 hp 300+/atk 60+,带强 tag 走 Wave5 模板 + 可能 skill)。字形查重。

- [ ] **Step 3: 3 成就 def**
`ACH_DEFS` 加 `endless50`/`endless75`/`endless100`(icon/n/d 双语,如「无尽攀登者 / Reach F50 in Endless」)。

- [ ] **Step 4: typecheck + build + Commit**
```bash
npm run typecheck && npm run build
git add src/data.ts && git commit -m "feat: 无尽内容(endless area+强敌+成就)"
```

---

## Task 3: 集成 QA + merge + push

- [ ] **Step 1: typecheck + build**(全过)。
- [ ] **Step 2: 冒烟 + QA**(`npm run dev`):
  - 角色选界面出现 Mode 栏;选普通 → F1 开局主线不变。
  - 选无尽 → `G.endless=true`(控制台或 UI 显♾);调到 F40 创世者击杀→不胜利、继续 F41(endless 主题/强敌);F45 scaled boss;死亡→分数 + bestEndlessFloor 更新。
  - 普通模式 F40 创世者→正常胜利屏。
- [ ] **Step 3: ff-merge main → push**(TLS 重试)。可选 `npm run dist`。
- [ ] **Step 4: 收尾**(更新 memory:Wave 6 全 done)。

---

## Self-Review

- **Spec coverage**:Mode 栏(Task1 Step4)✓;胜利 `!endless`(Step5)✓;endless area/强敌/成就(Task2)✓;F41+ scaled boss(Step6)✓;分数 bestEndlessFloor + 成就(Step8)✓;UI(Step9)✓;普通模式零改动(Global)✓。
- **Type consistency**:`GameState.endless`、`initGame(ri,ci,endless=false)`、`MetaStats.bestEndlessFloor`、`updateRunStats` 的 endless/endlessFloor 参数跨 task 一致。
- **YAGNI**:无尽 F1-40 与普通同(仅 F40 不结束);不引入转生/排行榜/专属装备;scaled boss 复用主线 def。
- **并行**:Task1(types/save/main/game/combat/enemies/meta/render)与 Task2(data.ts)文件不重叠,可并行;Task1 运行时引用 Task2 的 area/强敌/成就 def,编译不依赖(AREAS.find fallback)。
- **风险**:Mode 栏布局(纯 JS 生成 + 内联 style,不碰 css 文件);数值爆炸(测试期观察);scaled boss 的 phases/summon(endless 是主线非 branch,branchMode 守卫不影响)。
