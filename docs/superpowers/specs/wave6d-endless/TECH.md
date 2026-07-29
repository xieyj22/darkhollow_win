# Wave 6d:无尽模式(F40+)

技术规格。对应 `darkhollow`。本规格是 Wave 6d 实现与验收的唯一对照基准。Wave 6 第 4 波(6a / 6b / 6c / **6d 无尽模式**)。

提交基准:`85718ff`(Wave 6b merge + push 后的 main HEAD)。代码引用 pin 此 commit。

---

## Context

主线 F1–40 击败创世者即胜利结束([`playerVictory()` combat.ts:366 @ 85718ff](https://github.com/xieyj22/darkhollow_win/blob/85718ff/src/combat.ts#L366))。玩家要「打完后继续」。无尽模式 = 击败创世者后,选择继续下探 F41+ 无限楼层:难度递增、专属强敌池、每 5 层一 scaled boss、分数(最深楼层)记入 meta。

关键既有机制(本规格复用 / 改动):
- [`enterFloor(floor)` game.ts:31](https://github.com/xieyj22/darkhollow_win/blob/85718ff/src/game.ts#L31):`AREAS.find(floor 在区间)` 选 area;`spawnEnemies(floor, rooms)`;floor%5===0 铺 boss([spawnEnemies boss 段 enemies.ts:56](https://github.com/xieyj22/darkhollow_win/blob/85718ff/src/enemies.ts#L56))。F41+ 无 area 覆盖(当前 fallback AREAS[0]——是 bug,本规格修)。
- [`playerVictory()` combat.ts:366-384](https://github.com/xieyj22/darkhollow_win/blob/85718ff/src/combat.ts#L366-L384):设 `gameOver/won`、算 soul echoes、`updateRunStats({won:true, floor})`、显 victory-screen。
- victory-screen(`index.html:96`):按钮 `btn-play-again` / `btn-vic-title`。加 `btn-vic-endless`。
- [`updateRunStats` meta.ts:194-208](https://github.com/xieyj22/darkhollow_win/blob/85718ff/src/meta.ts#L194-L208):`stats.bestFloor = max(...)` 等。
- [`MetaStats` types.ts](https://github.com/xieyj22/darkhollow_win/blob/85718ff/src/types.ts):加 `bestEndlessFloor`(+ `endlessScore`)。
- [`BOSSES` data.ts:164](https://github.com/xieyj22/darkhollow_win/blob/85718ff/src/data.ts#L164):fl 5-40;F45+ 无 boss def,需 scaled 规则。
- [`GameState` types.ts](https://github.com/xieyj22/darkhollow_win/blob/85718ff/src/types.ts):加 `endless`。
- 死亡 [`playerDeath` combat.ts](https://github.com/xieyj22/darkhollow_win/blob/85718ff/src/combat.ts):算 echoes + 显 death-screen。

---

## 目标与范围(6d)

- F40 击败创世者 → 胜利屏「进入无尽」按钮 → `G.endless=true`、继续 `enterFloor(41)`。
- F41+:新「无尽深渊」area + 难度递增(`fs` 继续缩放)+ 少量 endless 专属强敌 + 每 5 层一 **scaled boss**。
- 分数 = 最深楼层(+ 击杀/金币加权);死亡记 `MetaStats.bestEndlessFloor` + endless 成就(F50/75/100)。
- UI:秘境外显「无尽 X 层」+ 分数。

非目标:6c(秘境);无尽专属装备/圣物体系;在线排行榜(本地 meta 即可);无尽结束的「通关」(理论上无限)。

---

## Proposed changes

### 1. endless area(`data.ts`)
新 `AreaDef` `id:'endless'`,`floorStart: 41, floorEnd: 9999`:
- 主题:扭曲虚空+各 area 混色(`wallColor:'#1a0a2a'` 等)、wallChar `▓`、`enemyScaleBonus: 0.15`(无尽更狠)。
- `specialTiles`:混合(随机 LAVA / ABYSS_WATER / VOID_FLOOR,体现「混沌」)——可给 `specialTiles` 支持多类型数组,或固定 VOID_FLOOR。
- `lore`:几句「现实崩塌 / 深渊无尽」氛围。

### 2. endless 状态(`types.ts` + `state.ts` + `save.ts`)
- `GameState` 加 `endless?: boolean`、`endlessStartFloor?: number`(进无尽时的楼层,算分数用)。
- `save.ts`:旧档迁移加 `endless=false`。

### 3. 进无尽的入口(`combat.ts` + `index.html` + `main.ts`)
- `playerVictory()`:保持算 echoes + `updateRunStats({won:true})`(F40 胜利仍计一次)——但**不立刻强制结束**,而是显 victory-screen 让玩家选。
- `index.html` victory-screen 加按钮 `<button id="btn-vic-endless">进入无尽 / Endless</button>`(在 play-again 前)。
- `main.ts bindButtons`:点 `btn-vic-endless` → `enterEndless()`:
  ```ts
  function enterEndless() {
    if (!G) return;
    hideOverlay('victory-screen');
    G.gameOver = false; G.won = false; G.endless = true; G.endlessStartFloor = 41;
    enterFloor(41);
  }
  ```
  (不重复发胜利 echoes;进无尽后 death 才结算 endless 分数。)

### 4. enterFloor > FINAL(`game.ts` + `enemies.ts`)
- `enterFloor`:`floor === FINAL` 的 lore 检查保持;F41+ 自然命中 endless area(§1)。BGM `setBgmScene` 对未知 areaId 需容错(已有 fallback)。
- boss 规则:`spawnEnemies` 末段(`BOSSES.find(b => b.fl === floor)`)对 F45+ 找不到 → 加 endless boss 生成:`if (floor > FINAL && floor % 5 === 0) { pick(BOSSES) 按 floor 缩放生成 scaled boss;isBoss=true; }`。即随机选一个主线 boss def,hp/atk/exp 按 `fs=1+(floor-1)*.12` 重算。

### 5. endless 专属强敌(`data.ts`)
- 加 3-5 个 `mf` 在 40+ 区间的强敌(如 `Void Titan` mf45 / `Doom Seraph` mf48 / `Entropy Beast` mf50),仅在 F41+ 的 mf 窗口刷出。带强 tag/skill。数值对标 F40+(hp 300+/atk 60+)。

### 6. 分数 + meta(`meta.ts` + `combat.ts`)
- `MetaStats` 加 `bestEndlessFloor: number`(+ 可选 `bestEndlessScore`);`defaultStats` + 旧档迁移。
- endless 死亡(`playerDeath`,或 endless 专属结算):`endlessScore = G.floor + p.kills*0.1 + p.gold*0.01`;`meta.stats.bestEndlessFloor = max(..., G.floor)`;`updateRunStats` 传 endless 标志。
- 成就:无尽里程碑(`endless50` / `endless75` / `endless100`)加 `ACH_DEFS` + `checkAch` 触发。

### 7. UI(`render.ts` / `main.ts`)
- `renderObjective` / floor label:`G.endless` 时显「♾ 无尽 {floor} 层 · 分数 {score}」(替代主线「F40/40 + BOSS」)。
- death-screen:endless 死亡时显无尽最深楼层 + 分数 +「新纪录」提示(若破 bestEndlessFloor)。

---

## Global Constraints

- **主线胜利不受损**:F40 击败创世者仍正确触发胜利屏 + 计 echoes + win/creator_kill 成就;无尽是「可选继续」。
- **向后兼容**:旧存档(`endless` 字段不存在)迁移默认 false;无 endless 的存档/读档路径不变。
- **难度曲线**:F41+ `fs` 继续缩放(F60 fs≈8.1,F100 fs≈12)——会极硬,这是无尽模式本意;不额外封顶(或软封顶 fs at F99,见风险)。
- **汉化**:endless area lore / 新敌人 / 成就 / UI 文案双语完整。
- 无测试框架;验证 = typecheck + build + 冒烟 + 手动 QA。
- 代码引用 pin `85718ff`。

---

## Testing and validation

- `npm run typecheck` + `npm run build` 必过。
- **冒烟**:载入无报错;主线 F1-40 不受影响(endless area 不进 1-40 区间)。
- **手动 QA**(调试直跳 F40 击败创世者):
  - 胜利屏出现「进入无尽」按钮;点 → 进 F41(endless area 主题/强敌可见)。
  - 下到 F45 → scaled boss 出现(非空)。
  - 死亡 → death-screen 显无尽楼层 + 分数;meta `bestEndlessFloor` 更新;F50 成就触发(若到)。
  - 主线胜利路径(不点无尽,直接 play-again)仍正常。

---

## Risks and mitigations

- **数值爆炸**:F100+ fs 极高 → 玩家/敌人伤害天文数字。缓解:`fs` 在 F60+ 改线性放缓(如 `fs = 1 + 7 + (floor-60)*0.05`),或伤害公式内置软上限。本规格先沿用现公式,**测试期观察**,必要时加曲线。
- **boss 缩放复用**:scaled boss 用主线 BOSSES def 重算 hp/atk——其 phases/summon 仍按原 def 的 hpThreshold 比例 + summon.kind(Wave6a),逻辑兼容。
- **enterFloor 的 FINAL lore / setBgmScene**:F41+ area id `'endless'` 不在既有 BGM 场景表——`setBgmScene('explore', 'endless')` 需 fallback 到默认 explore 旋律(已有 fallback 机制,确认不崩)。
- **存档大小**:无尽楼层深时玩家 inventory/状态可能膨胀——autoSave 每 5 回合一次,JSON 大小可控;不特殊处理。

---

## Parallelization

- **轨 A(内容)**:`data.ts`(endless area + 3-5 强敌 + 成就 def)。
- **轨 B(机制)**:`types/state/save`(endless 字段)+ `combat`/`main`/`index.html`(入口按钮 + enterEndless + 死亡结算)+ `game`/`enemies`(enterFloor>FINAL + scaled boss)+ `meta`(bestEndlessFloor + 成就触发)+ `render`(UI)。
- 轨 A 纯数据,轨 B 改逻辑;`data.ts` 仅轨 A 碰(`events`/`render`/`types` 等轨 B),基本不重叠,可并行;主 Agent 收口 typecheck/build/QA/merge。

---

## Follow-ups

- 无尽专属装备 / 圣物 / 商人。
- 在线排行榜(本地 meta → 远程)。
- 无尽「转生」(达到某深度后重置换永久加成)。
- 6c 秘境分支。
