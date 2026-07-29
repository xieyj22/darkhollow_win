# darkhollow Wave 6c(秘境分支生物群系)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通过传送门进入一个自包含「荧光菌穴」秘境 1 层(专属敌 + 迷你 boss + 奖励房),打完传送回原楼层原位置;主线 F1-40 零改动。

**Architecture:** 新 `TL.PORTAL` tile(罕见,3 区)→ `enterBranch()` 存 `branchReturn`+设 `branchMode`,用 area override 生成秘境层 + `spawnBranchEnemies`(从 `mf=0` 池)+ 静态迷你 boss + 奖励;`exitBranch()` 回原层原位。秘境敌 `mf=0`/迷你 boss `fl=0` 与主线刷池隔离(`spawnEnemies` 加 `mf>=1` 守卫)。

**Tech Stack:** TypeScript 5.7 + Vite 6 + Canvas2D;无测试框架。

## Global Constraints

- **无测试框架**。验证 = `npm run typecheck` + `npm run build` + playwright 冒烟 + 手动 QA。
- **主线零改动**:F1-40 编号/FINAL=40/主线 boss/成就不变;秘境是正交旁路。
- **spawn 隔离**:秘境敌(`mf=0`)/迷你 boss(`fl=0`)绝不进主线刷池(`spawnEnemies` 加 `e.mf >= 1` 守卫)。
- **返回安全**:`branchReturn` 进秘境时存、返回时清;秘境内**禁用下楼**(`descendStairs` 在 `branchMode` 时拦截)。
- **迷你 boss 简化**:静态强 boss(`isBoss`,无 phases/summon),避免 `processBossPhase` 的 `BOSSES.find(fl===G.floor)` fl 耦合(秘境 G.floor 保留为主线楼层)。
- `genDungeon` 加**可选** `areaOverride` 参数(默认 undefined 走原逻辑),所有既有调用点不破。
- 代码引用 pin `3d51936`(6b + 剪影修复后的 HEAD)。每 Task 一 commit。
- **顺序执行**:Task 1(机制,含 types)→ Task 2(内容+tile+UI,render label 引用 Task1 的 branchMode)→ Task 3(集成QA+merge)。

---

## File Structure

| 文件 | 动作 | 责任 |
|------|------|------|
| `src/types.ts` | Modify | T1:`GameState.branchMode?:boolean` + `branchReturn?:{floor,x,y}\|null}` |
| `src/state.ts` | Modify | T1:`setGameState` 默认值 |
| `src/save.ts` | Modify | T1:旧档迁移 `branchMode=false/branchReturn=null` |
| `src/dungeon.ts` | Modify | T1:`genDungeon(floor, areaOverride?)` |
| `src/enemies.ts` | Modify | T1:`spawnEnemies` 加 `mf>=1` 守卫 + 新 `spawnBranchEnemies` |
| `src/game.ts` | Modify | T1:`enterBranch()` + `exitBranch()` |
| `src/events.ts` | Modify | T1:`TL.PORTAL` 效果(进/退秘境) |
| `src/player.ts` | Modify | T1:`descendStairs` branchMode 守卫 |
| `src/config.ts` | Modify | T2:`TL.PORTAL = 16` |
| `src/data.ts` | Modify | T2:fungal AreaDef + 5 敌(mf=0)+ 迷你 boss(fl=0)+ 3 区 PORTAL specialTiles |
| `src/render.ts` | Modify | T2:PORTAL tile switch + minimap + branch 楼层 label |

---

## Task 1: 秘境机制(types/state/save/dungeon/enemies/game/events/player)

**Files:** `types.ts`/`state.ts`/`save.ts`/`dungeon.ts`/`enemies.ts`/`game.ts`/`events.ts`/`player.ts`

**Interfaces:**
- Produces:`GameState.branchMode?/branchReturn?`;`genDungeon(floor, areaOverride?: AreaDef)`;`spawnBranchEnemies(rooms: Room[], entryFloor: number): Enemy[]`;`enterBranch()/exitBranch()`(game.ts 导出)。
- Consumes:无(独立;运行时引用 Task 2 的 fungal area/秘境敌,但编译不依赖——filter 为空即不刷)。

- [ ] **Step 1: `types.ts` GameState 加字段**

[`GameState` L435-447](https://github.com/xieyj22/darkhollow_win/blob/3d51936/src/types.ts#L435-L447) 加:
```ts
  branchMode?: boolean;
  branchReturn?: { floor: number; x: number; y: number } | null;
```

- [ ] **Step 2: `state.ts` setGameState 默认 + `save.ts` 迁移**

`setGameState` 处(或 initGame 的 GameState 字面量 [`game.ts:18-23`](https://github.com/xieyj22/darkhollow_win/blob/3d51936/src/game.ts#L18-L23))补 `branchMode: false, branchReturn: null`。`save.ts` loadGame 迁移:若缺则 `branchMode=false; branchReturn=null`。

- [ ] **Step 3: `dungeon.ts` genDungeon 加 areaOverride**

[`genDungeon(floor)` dungeon.ts](https://github.com/xieyj22/darkhollow_win/blob/3d51936/src/dungeon.ts#L73) 签名改 `genDungeon(floor: number, areaOverride?: AreaDef)`,内部 `const area = areaOverride ?? AREAS.find(a => floor >= a.floorStart && floor <= a.floorEnd);`。import `AreaDef` type。既有调用点(`game.ts:40`)不传 → 走原逻辑。

- [ ] **Step 4: `enemies.ts` spawn 隔离 + spawnBranchEnemies**

- [`spawnEnemies` L16-25](https://github.com/xieyj22/darkhollow_win/blob/3d51936/src/enemies.ts#L16-L25) 两处 mf 过滤加 `&& e.mf >= 1`(窗口 `se` + fallback `el`),排除 `mf=0` 秘境敌。
- 新增导出:
```ts
export function spawnBranchEnemies(rooms: Room[], entryFloor: number): Enemy[] {
  const pool = ENEMIES.filter(e => e.mf === 0);
  if (!pool.length) return [];
  const fs = 1 + (entryFloor - 1) * .12;
  const ens: Enemy[] = [];
  const otherRooms = rooms.filter(r => r !== rooms[0]);
  // 普通秘境敌
  for (const rm of otherRooms) {
    const x = rng(rm.x+1, rm.x+rm.w-2), y = rng(rm.y+1, rm.y+rm.h-2);
    const base = pick(pool);
    ens.push({ /* 同 makeIn 结构,hp/atk/def/exp 按 fs 缩放,约 0.7 倍(秘境敌不是主线强度)*/ } as Enemy);
  }
  // 迷你 boss(fl=0)放倒数第二个房间中心
  const mb = BOSSES.find(b => b.fl === 0);
  if (mb) {
    const br = rooms.length > 2 ? rooms[rooms.length-2] : rooms[rooms.length-1];
    ens.push({ name:..., ch:mb.ch, c:mb.c, x:br.cx, y:br.cy, ai:'chase',
      hp:Math.floor(mb.hp*fs), maxHp:Math.floor(mb.hp*fs), atk:Math.floor(mb.atk*fs), def:Math.floor(mb.def*fs),
      exp:Math.floor(mb.exp*fs), goldDrop:rng(mb.g[0],mb.g[1]), isBoss:true, stunned:0,feared:0,isAlly:false, el:mb.el||'none', res:{}, skillCd:0 });
  }
  return ens;
}
```
(迷你 boss `isBoss:true` 静态——killEnemy 正常处理掉落/经验;不依赖 processBossPhase。)

- [ ] **Step 5: `game.ts` enterBranch / exitBranch**

import fungal area:`import { AREAS } from './data.js'` 已有;`const FUNGAL = AREAS.find(a => a.id === 'fungal')!`(Task 2 提供,运行时解析)。
```ts
export function enterBranch(): void {
  if (!G || !FUNGAL) return;
  G.branchReturn = { floor: G.floor, x: G.player.x, y: G.player.y };
  G.branchMode = true;
  const entry = G.floor;
  G.dungeon = genDungeon(entry, FUNGAL);
  G.traps = G.dungeon.traps;
  const sr = G.dungeon.rooms[0];
  G.player.x = sr.cx; G.player.y = sr.cy;
  G.player.buffs = []; G.player.poisonTurns = 0; G.player.poisonDmg = 0; G.player.slowed = 0;
  G.player.explored = Array.from({length:MH}, () => Array(MW).fill(false));
  G.enemies = spawnBranchEnemies(G.dungeon.rooms, entry);
  // 奖励房(末房):保底 1 圣物 + 金币(Task 2 数据外,这里 genItem/genRelic)
  // 末房放返回门 tile
  const last = G.dungeon.rooms[G.dungeon.rooms.length-1];
  G.dungeon.map[last.cy][last.cx] = TL.PORTAL; // 返回门
  G.items = []; // 奖励物(圣物/金)散布见下
  addMsg(lang==='zh'?'🌀 你被吸入荧光菌穴……':'🌀 You are pulled into the Fungal Hollow...','md');
  updatePlayerFOV(G.player, G.dungeon.map, G.traps); setBgmScene('explore', FUNGAL.id);
  if ((window as any).__render) (window as any).__render();
  if ((window as any).__updateUI) (window as any).__updateUI();
}
export function exitBranch(): void {
  if (!G || !G.branchReturn) return;
  const ret = G.branchReturn;
  G.branchMode = false; G.branchReturn = null;
  enterFloor(ret.floor);
  G.player.x = ret.x; G.player.y = ret.y; // 回原位(enterFloor 会把玩家放 start room,这里覆盖回原位)
  updatePlayerFOV(G.player, G.dungeon.map, G.traps);
  addMsg(lang==='zh'?'✨ 你回到了第'+ret.floor+'层。':'✨ You return to floor '+ret.floor+'.','mi');
  if ((window as any).__render) (window as any).__render();
  if ((window as any).__updateUI) (window as any).__updateUI();
}
```
> 注:奖励(圣物/金)可用 `grantRelic`/`genItem` 在末房散布——若 `grantRelic` 不可达,改末房放一个 r3-r4 item + 金堆即可。迷你 boss 击杀后玩家拾取。

- [ ] **Step 6: `events.ts` PORTAL 效果**

import `enterBranch/exitBranch`(late-binding 避循环:game.ts 已 import events? 检查——events.ts 与 game.ts 无循环则直连,否则用 setXxxFn)。checkTiles 加:
```ts
if (tile === TL.PORTAL) {
  if (G.branchMode) { exitBranch(); }
  else { enterBranch(); }
}
```
(PORTAL 不消费——秘境内再踩=返回;主线踩=进入。进秘境后原楼层的 PORTAL 仍在,但 branchReturn 已记,无副作用。)

- [ ] **Step 7: `player.ts` descendStairs branchMode 守卫**

[`descendStairs` L120-126](https://github.com/xieyj22/darkhollow_win/blob/3d51936/src/player.ts#L120-L126) 开头加:
```ts
if (G.branchMode) { addMsg(lang === 'zh' ? '秘境中没有向下的楼梯(找传送门返回)。' : 'No stairs down in the hollow (find a portal to return).', 'mi'); return; }
```

- [ ] **Step 8: typecheck + build**

`npm run typecheck` + `npm run build` 必过(fungal area/秘境敌 Task 2 提供,filter 为空不报错)。

- [ ] **Step 9: Commit**

```bash
git add src/types.ts src/state.ts src/save.ts src/dungeon.ts src/enemies.ts src/game.ts src/events.ts src/player.ts
git commit -m "feat: 秘境分支机制(enterBranch/exitBranch + spawn 隔离 + genDungeon areaOverride)"
```

---

## Task 2: 秘境内容 + PORTAL tile + UI(config/data/render)

**Files:** `config.ts`/`data.ts`/`render.ts`

**Interfaces:** 产出 `TL.PORTAL`、fungal AreaDef(id 'fungal')、5 个 mf=0 敌、1 个 fl=0 迷你 boss、3 区 PORTAL specialTiles、render PORTAL case + branch label。
- Consumes:Task 1 的 `G.branchMode`(render label)。

- [ ] **Step 1: `config.ts` TL.PORTAL**

`MOSS/CURSE/ALARM=13/14/15` 之后加 `PORTAL = 16,`。

- [ ] **Step 2: `data.ts` fungal AreaDef + 5 秘境敌 + 迷你 boss**

- AREAS 末尾加 fungal area(`floorStart:1000, floorEnd:1002` 哨兵——仅作 genDungeon areaOverride 标识,不进主线 1-40):
```ts
{ id: 'fungal', n:{en:'Fungal Hollow',zh:'荧光菌穴'}, floorStart:1000, floorEnd:1002,
  wallColor:'#2a1a3a', floorColor:'#1a2a1a', corrColor:'#151a15', bgColor:'#0a1a0a',
  wallChar:'♣', floorChar:'·', enemyScaleBonus:0.1,
  specialTiles:{ type: TL.MOSS, ch:'"', fg:'#6b8e3a', bg:'#1a2a10', count:[3,6] },
  lore:[{en:'Spores thick in the air.',zh:'空气中孢子浓密。'},{en:'Something vast blooms in the dark.',zh:'黑暗中有什么庞然大物在绽放。'}] },
```
- ENEMIES 末尾加 5 个 `mf:0` 秘境敌(Mushroom Brute/Spore Mother/Myconid/Fungal Knight/Glow Slime,数值对标 F8-15,带 tag:beast via name regex 'slime'/'brute'?——确保至少有合适 tag/regex 路由)。例:
```ts
{ n:{en:'Mushroom Brute',zh:'菇蛮'}, ch:'♭', c:'#8b4513', hp:60, atk:14, def:6, exp:35, g:[10,25], ai:'chase', mf:0, tags:['beast'] },
{ n:{en:'Myconid',zh:'蕈人'}, ch:' mushroom'... , mf:0, tags:['spirit'] },  // → WRAITH? 不贴。改 tag 'demon' 或留名 regex
... (5 条,mf:0,数值 F8-15 档)
```
> 字形查重 + tag 路由确认('slime'→SLIME name regex;'beast' tag 不被检查→靠 name 'brute'? 无 regex→落 GOBLIN。**给秘境敌明确 tag**:spirit→WRAITH / demon→DEMON / construct→GOLEM / undead→SKELETON / 或扩展 regex。实现时确保每个秘境敌有非-GOBLIN 路由)。
- BOSSES 末尾加 `fl:0` 迷你 boss:
```ts
{ n:{en:'Myconid Sovereign',zh:'菌主'}, ch:'♫', c:'#9370db', hp:150, atk:24, def:10, exp:300, g:[100,200], fl:0, el:'shadow' },
```
(静态,无 phases/summon;tag 可加 'spirit'→WRAITH 描边。fl=0 不被主线 spawnEnemies 的 `BOSSES.find(fl===floor)` 命中。)

- [ ] **Step 3: `data.ts` 3 区 PORTAL specialTiles**

Crypts/Depths/Fortress 的 area 各加 `specialTiles` 覆盖/追加 PORTAL(count [0,1] 罕见)。注意 Crypts 已在 6b 加了 CURSE specialTiles——一个 area 只能有一个 `specialTiles` 字段,需合并:要么 PORTAL 与 CURSE 二选一机制(改 specialTiles 为数组),要么只给 Depths/Fortress 加 PORTAL(Crypts 留 CURSE)。**简化**:给 **Depths + Fortress** 加 PORTAL(Depths 现有 LAVA → 改 specialTiles 支持多类型,或 Depths 留 LAVA、仅 Fortress 加 PORTAL)。**最简**:仅给 **Fortress** 加 `specialTiles: PORTAL count[0,1]`(Fortress 6b 未加 tile,无冲突),Crypts/Depths 保持 6b 现状。实现时确认无 specialTiles 字段冲突。

- [ ] **Step 4: `render.ts` PORTAL tile switch + minimap**

tile switch 加 `case TL.PORTAL: ch='◯'; fg='#b266ff'; bg='#1a0a2a'; break;`;minimap 加 `if (tile===TL.PORTAL) off.fillStyle='#b266ff';`。

- [ ] **Step 5: `render.ts` branch 楼层 label**

[`renderObjective`/floor label L419-425](https://github.com/xieyj22/darkhollow_win/blob/3d51936/src/render.ts#L419-L425):`G.branchMode` 时显 `🍄 荧光菌穴(秘境)` 替代楼层号。

- [ ] **Step 6: typecheck + build + Commit**

```bash
git add src/config.ts src/data.ts src/render.ts
git commit -m "feat: 荧光菌穴秘境内容(5敌+迷你boss+PORTAL tile+UI)"
```

---

## Task 3: 集成 QA + merge + push

- [ ] **Step 1: typecheck + build**(全过)。
- [ ] **Step 2: 冒烟 + QA**(`npm run dev`,调试/反复进 Depths-Fortress 找传送门):
  - 踩 `◯` → 进荧光菌穴(主题色/专属敌/迷你 boss 可见);主线刷怪不含 mf=0 秘境敌。
  - 击败迷你 boss、踩返回门 → 回原楼层**原位置**;主线进度未变。
  - renderObjective 显「秘境」;save/load 正常(branchMode 不持久化为 true——秘境是临时)。
- [ ] **Step 3: ff-merge main → push**(TLS 重试)。可选 `npm run dist`。
- [ ] **Step 4: 收尾**(更新 memory:6c done,待续 6d)。

---

## Self-Review

- **Spec coverage**:PORTAL tile + enterBranch/exitBranch + branchReturn + spawnBranchEnemies + mf>=1 隔离 + genDungeon override + 秘境 area/敌/迷你 boss + UI(Task 1+2)✓;主线零改动 + 返回安全(Global)✓。
- **Placeholder**:Task 1 Step 4/5 给骨架代码(makeIn 结构需 implementer 按既有 makeIn 填全——非占位,是引用同文件模式);秘境敌 5 条数值在 Step 2 给样例 + 路由要求。
- **Type consistency**:`branchMode/branchReturn`、`genDungeon(floor, areaOverride?)`、`spawnBranchEnemies(rooms, entryFloor)`、`enterBranch()/exitBranch()` 跨 task 一致。
- **YAGNI**:迷你 boss 静态(无 phases/summon,避 fl 耦合);秘境 1 层 1 个;PORTAL 仅 Fortress(避 specialTiles 冲突);秘境不存档(临时)。
- **风险**:specialTiles 单字段限制(Task2 Step3 简化为仅 Fortress);enterBranch 奖励(grantRelic 可达性——fallback 散 item+金)。
