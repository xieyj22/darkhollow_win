# Wave 6c:秘境分支生物群系(传送门)

技术规格。对应 `darkhollow`。本规格是 Wave 6c 实现与验收的唯一对照基准。Wave 6 第 3 波(6a 性能+召唤 / 6b area 多样性 / **6c 秘境生物群系** / 6d 无尽模式)。

提交基准:`85718ff`(Wave 6b merge + push 后的 main HEAD)。代码引用 pin 此 commit。

---

## Context

用户要求新增一个生物群系,但不破坏 F1–40 主线(8 个 area 各 5 层 + 每 5 层一 boss 的结构)。选定方案:**秘境分支**——通过传送门进入一个**自包含的 1 层秘境**,专属敌 + 迷你 boss + 奖励房,打完传送回原楼层原位置。不动主线编号、不动 FINAL/boss/成就。

关键既有机制(本规格复用 / 改动):
- [`enterFloor(floor)` game.ts:31 @ 85718ff](https://github.com/xieyj22/darkhollow_win/blob/85718ff/src/game.ts#L31):按 `AREAS.find(floor 在区间)` 选 area → `genDungeon(floor)` → `spawnEnemies(floor, rooms)`。秘境**不走这个 floor-range 路径**,用独立 `enterBranch()`。
- [`genDungeon(floor)` dungeon.ts](https://github.com/xieyj22/darkhollow_win/blob/85718ff/src/dungeon.ts#L72-L81):内部 `AREAS.find` 选 area + 铺 `specialTiles`。秘境需要 area override。
- [`spawnEnemies(floor, rooms)` enemies.ts:14](https://github.com/xieyj22/darkhollow_win/blob/85718ff/src/enemies.ts#L14):`ENEMIES.filter(e => e.mf <= floor && e.mf >= max(1, floor-4))` 滚动窗口 + fallback `pick(el)`(`el = e.mf <= floor`)。**秘境敌用 `mf=0` 约定**(窗口 + fallback 都排除)→ 主线永不刷,仅 `spawnBranchEnemies` 用。
- [`checkTiles` events.ts](https://github.com/xieyj22/darkhollow_win/blob/85718ff/src/events.ts#L195-L258):每 tile 一个 `if(tile===TL.X)` 效果块(传送门 = 进秘境)。
- [`GameState` types.ts:435-447](https://github.com/xieyj22/darkhollow_win/blob/85718ff/src/types.ts#L435-L447):加 `branchReturn`。
- 装备掉落 [`genItem` items.ts](https://github.com/xieyj22/darkhollow_win/blob/85718ff/src/items.ts) + 圣物 [`RELICS` data.ts](https://github.com/xieyj22/darkhollow_win/blob/85718ff/src/data.ts):奖励房复用。

---

## 目标与范围(6c)

- 新 `TL.PORTAL` tile:罕见出现在 Crypts/Depths/Fortress(各 `count:[0,1]`),踩上 → 进秘境。
- 独立「荧光菌穴(Fungal Hollow)」秘境 **1 层**:新 area(主题色 + signature tile)+ 4-5 专属敌(`mf=0`)+ 1 迷你 boss + 奖励房(保底圣物 + 金币)+ 返回门。
- 机制:`enterBranch()` / `exitBranch()`,`GameState.branchReturn` 记原楼层+位置,返回时回原位。
- 主线零改动(FINAL/boss/成就/楼层编号不变)。

非目标:6d(无尽);多秘境/多层秘境(先 1 个 1 层);秘境专属装备体系。

---

## Proposed changes

### 1. 新 tile `TL.PORTAL`
- `config.ts`:`PORTAL = 16`(MOSS/CURSE/ALARM=13/14/15 之后)。
- `render.ts` tile switch + minimap:`PORTAL` char `◯`、fg `#b266ff`、bg `#1a0a2a`。
- `data.ts` specialTiles:Crypts/Depths/Fortress 各加 `specialTiles: { type: TL.PORTAL, ch:'◯', fg:'#b266ff', bg:'#1a0a2a', count:[0,1] }`(count 0-1 = 罕见,可能不出)。

### 2. 秘境 area + 内容(`data.ts`)
- 新 `AreaDef` `id:'fungal'`(floorStart/floorEnd 不进 1-40 主线,用哨兵如 floorStart:1000 仅作 genDungeon override 标识;或 enterBranch 直接传 area 对象,见 §4):
  - 主题色:紫绿荧光(`wallColor:'#2a1a3a'`/`floorColor:'#1a2a1a'`/紫绿 `bgColor`)、wallChar `♣`/floorChar `·`。
  - `specialTiles`:菌毯(复用 MOSS 视觉或新 TL;先复用 MOSS 的 `"` 渲染,效果也可复用 +饥饿,或新建发光 tile 纯视觉——本规格先**纯视觉**,用 MOSS tile 贴图无效果,见风险)。
  - `lore`:2-3 句荧光菌穴氛围。
- 新 4-5 个秘境敌(`ENEMIES`,`mf:0` 标记仅秘境):Mushroom Brute / Spore Mother / Myconid / Fungal Knight / Glowing Slime(数值对标 F8-15 中段,因秘境从中段进入)。带合适 tag(demon/beast/undead/spirit/elemental)走 Wave5 sprite 模板。
- 新 1 迷你 boss(`BOSSES`,`fl:0` 标记):「菌主(Myconid Sovereign)」,phases + summon(用 Wave6a summon.kind 召 Mushroom Brute)。`spawnBranchEnemies` 显式放置。
- 奖励:秘境末房保底 1 件 r3-r4 圣物(`grantRelic` 风格)+ 一堆金币。

### 3. 状态(`types.ts` + `state.ts`)
- `GameState` 加 `branchReturn?: { floor: number; x: number; y: number } | null`。
- `state.ts` 持久化默认 null(save.ts 旧档迁移加 `branchReturn = null`)。

### 4. 传送 / 返回逻辑(`game.ts` + `events.ts`)
- `game.ts` 加 `enterBranch()`:
  1. `G.branchReturn = { floor: G.floor, x: G.player.x, y: G.player.y }`。
  2. 用秘境 area 生成:`genDungeon` 加可选 `areaOverride?: AreaDef` 参数(秘境传 fungal area);dungeon.ts 内 `const area = areaOverride ?? AREAS.find(...)`。
  3. `G.floor` 设一个哨兵显示值(如 `-1` 或保留原值 + `G.branchMode=true` 标志),spawn 用 `spawnBranchEnemies(rooms)`(从 `ENEMIES.filter(mf===0)` + 显式迷你 boss)。
  4. 末房放返回门 tile(`TL.PORTAL` 或专用 `TL.PORTAL_EXIT`)、奖励。
- `game.ts` 加 `exitBranch()`:读 `G.branchReturn` → `enterFloor(ret.floor)` 后把 `G.player.x/y` 设回 `ret.x/y` + 清 `branchReturn`。
- `events.ts`:`if (tile === TL.PORTAL) { if (G.branchReturn) exitBranch(); else enterBranch(); }`(秘境内再踩门 = 返回)。消费(变 FLOOR)避免反复触发。

### 5. spawn 隔离(`enemies.ts`)
- `spawnEnemies` 的 fallback 池 `el` 加 `e.mf >= 1`:排除 `mf=0` 秘境敌,防主线误刷。
- 新 `spawnBranchEnemies(rooms)`:从 `ENEMIES.filter(e => e.mf === 0)` + 中段数值缩放 + 末房迷你 boss(读 `BOSSES.find(fl===0)`)。

### 6. UI(`render.ts` / `main.ts`)
- 玩家在秘境时:`renderObjective` / floor label 显示「🍄 荧光菌穴(秘境)」而非主线楼层号;minimap 标题同步。
- 楼层 label 现有逻辑 [`render.ts:419-425`](https://github.com/xieyj22/darkhollow_win/blob/85718ff/src/render.ts#L419-L425) 按 area 显示——秘境 area 自带 name,自动生效,只需 floor 号显示为「秘境」。

---

## Global Constraints

- **主线零改动**:F1-40 编号、FINAL=40、主线 boss/成就、area 数量结构都不变;秘境是正交旁路。
- **spawn 隔离**:秘境敌(`mf=0`)/ 迷你 boss(`fl=0`)绝不进主线刷池(§5 守卫)。
- **返回安全**:`branchReturn` 必须在进秘境时存、返回时清;save 中途不持久化「在秘境中」状态(进秘境属临时,存档点在主线楼层)——若在秘境内 Ctrl+S,读档回到 `branchReturn.floor`(秘境进度不存档,见风险)。
- **汉化**:新 area lore / 敌人 `n.zh/n.en` / 文案双语完整。
- 无测试框架;验证 = typecheck + build + 冒烟 + 手动 QA。
- 代码引用 pin `85718ff`。

---

## Testing and validation

- `npm run typecheck` + `npm run build` 必过。
- **冒烟**(`npm run dev` + headless):载入无报错;主线 F1-10 刷怪正常(秘境敌不混入——验 mf=0 不出现在主线)。
- **手动 QA**(调试/反复进 Crypts-Depths 找传送门):
  - 踩 `◯` 传送门 → 进荧光菌穴(主题色/专属敌/迷你 boss/奖励房可见)。
  - 击败迷你 boss、拾奖励、踩返回门 → 回原楼层**原位置**。
  - 主线进度不受影响(下楼/boss/成就正常)。
  - Ctrl+S 存档行为符合§风险约定。

---

## Risks and mitigations

- **秘境内 genDungeon area override**:改动 `genDungeon` 签名(加可选参数)是侵入点——确认所有调用点(game.ts:40 等)不破(可选参数,默认 undefined 走原逻辑)。
- **秘境内存档**:若允许秘境内 Ctrl+S,`branchReturn` 序列化 + 读档恢复秘境较复杂。**先约定**:秘境内禁用存档(或存档即视为回到 `branchReturn.floor`)。简化:进入秘境是一次性副本体验,离开后才能存档。
- **迷你 boss 复用 boss 机制**:`processBossPhase`/`tryBossSummon` 按 `BOSSES.find(fl===G.floor)` 取 def——秘境 floor 是哨兵值,需 `spawnBranchEnemies` 显式设 `e.isBoss` + 迷你 boss 的 phases/summon 按 fl=0 取。确保 phase 逻辑能找到 fl=0 def。

---

## Parallelization

- **轨 A(tile + area + 内容)**:`config/render/data`(PORTAL tile + fungal area + 5 敌 + 迷你 boss + 3 区传送门配置)。
- **轨 B(机制)**:`types/state/game/events/enemies/dungeon`(branchReturn + enterBranch/exitBranch + spawnBranchEnemies + spawn 隔离 + genDungeon override)。
- 轨 A 纯数据,轨 B 改逻辑;文件重叠 `data.ts`(A 写 area/enemies/boss,B 不碰)与 `events.ts`(B 写)——基本不重叠,可并行;主 Agent 收口集成 typecheck/build/QA/merge。

---

## Follow-ups

- 6d 无尽模式。
- 多种秘境 / 多层秘境(本规格 1 个 1 层)。
- 秘境专属装备 / 圣物体系。
