# Wave 6d:无尽模式(开局选模式)

技术规格。对应 `darkhollow`。本规格是 Wave 6d 实现与验收的唯一对照基准。Wave 6 第 4 波(6a / 6b / 6c / **6d 无尽模式**)。**本版改为「开局选模式」设计**(替代旧「F40 胜利后续」)。

提交基准:`39d17d1`(playtest fixes 后的 main HEAD)。代码引用 pin 此 commit。

---

## Context

主线 F1–40 击败创世者即胜利结束([`playerVictory()` combat.ts:366 @ 39d17d1](https://github.com/xieyj22/darkhollow_win/blob/39d17d1/src/combat.ts#L366);胜利判定 [`combat.ts:161/430`](https://github.com/xieyj22/darkhollow_win/blob/39d17d1/src/combat.ts#L161) `if (G.floor === FINAL)` 本已加 `&& !G.branchMode`(6c))。玩家要一个**无尽模式**:在**新游戏时**选「普通 / 无尽」,无尽模式 F1-40 击败创世者不结束、继续 F41+ 无限楼层,死即结算。

关键既有机制(本规格复用 / 改动):
- 角色选择 [`showCharSelect()` main.ts](https://github.com/xieyj22/darkhollow_win/blob/39d17d1/src/main.ts):现 Race + Class 两栏 + begin。**加「Mode」栏**(普通/无尽)。
- [`initGame(ri, ci)` game.ts:17](https://github.com/xieyj22/darkhollow_win/blob/39d17d1/src/game.ts#L17) → 加 `endless` 参数。
- [`enterFloor(floor)` game.ts:31](https://github.com/xieyj22/darkhollow_win/blob/39d17d1/src/game.ts#L31):`AREAS.find(floor 在区间)` 选 area;F41+ 当前无 area 覆盖(fallback AREAS[0],是 bug)。
- 胜利 [`playerVictory()` combat.ts:366](https://github.com/xieyj22/darkhollow_win/blob/39d17d1/src/combat.ts#L366):设 gameOver/won + echoes + updateRunStats + 显 victory-screen。
- [`updateRunStats` meta.ts:194](https://github.com/xieyj22/darkhollow_win/blob/39d17d1/src/meta.ts#L194);[`MetaStats` types.ts](https://github.com/xieyj22/darkhollow_win/blob/39d17d1/src/types.ts) 加 `bestEndlessFloor`。
- [`BOSSES` data.ts](https://github.com/xieyj22/darkhollow_win/blob/39d17d1/src/data.ts) fl 5-40;F45+ 无 boss def,需 scaled 规则。[`spawnEnemies` enemies.ts](https://github.com/xieyj22/darkhollow_win/blob/39d17d1/src/enemies.ts) boss 段。
- [`GameState` types.ts](https://github.com/xieyj22/darkhollow_win/blob/39d17d1/src/types.ts) 加 `endless`。

---

## 目标与范围(6d)

- **新游戏角色选择加「Mode」栏**:普通模式 / 无尽模式;选中传给 `initGame` → `G.endless`。
- **普通模式**:`endless=false`,F40 击败创世者 → 胜利结局(现行,原封不动)。
- **无尽模式**:`endless=true`,F1-40 同内容,但 F40 创世者击杀**不胜利**——继续 **F41+ 无限**:无尽深渊 area + `fs` 递增缩放 + 每 5 层一 scaled boss + 少量 endless 专属强敌。死 = 结算。
- **分数** = 最深楼层(+击杀/金币小幅加权)→ `MetaStats.bestEndlessFloor` + 无尽成就(F50/75/100)。
- **UI**:无尽模式显「♾ 无尽 X 层 · 分数」。

非目标:6c(秘境);无尽专属装备/圣物/商人;在线排行榜;无尽「通关」(理论无限);无尽模式从 F1 起的差异化内容(本版无尽 F1-40 与普通同,仅 F40 不结束)。

---

## Proposed changes

### 1. endless area(`data.ts`)
新 `AreaDef` `id:'endless'`,`floorStart: 41, floorEnd: 9999`:扭曲虚空混色主题(`wallColor:'#1a0a2a'` 等)、`wallChar:'▓'`、`enemyScaleBonus: 0.15`、`specialTiles` 混合(VOID_FLOOR 为主,体现「混沌」)、2-3 句「现实崩塌/深渊无尽」lore。

### 2. endless 状态(`types.ts` + `game.ts` + `save.ts`)
- `GameState` 加 `endless?: boolean`。
- `initGame(ri, ci, endless = false)`:gameState 字面量加 `endless`。
- `save.ts`:旧档迁移 `endless = false`。

### 3. 角色选 Mode 栏(`main.ts` showCharSelect)
- showCharSelect 加 `selMode = 0`(0=普通,1=无尽)+ Mode 选项栏(抄 race/class 的 `.race-opt` 点击切换样式),中英「普通模式 / Normal」「无尽模式 / Endless」。
- begin 按钮 onclick:`initGame(selRace, selCls, selMode === 1)`。

### 4. 胜利判定加 `!G.endless`(`combat.ts`)
两处 `if (G.floor === FINAL ...)`(L161、L430)改为 `if (G.floor === FINAL && !G.endless && !G.branchMode)`(保留 6c 的 branchMode 守卫)。无尽模式 F40 击杀创世者 → 不调 playerVictory;改为一句 flavor(`addMsg`「击败了创世者,但深渊仍在下探……」)即可。

### 5. enterFloor > FINAL(`game.ts` + `enemies.ts`)
- `enterFloor`:F41+ 命中 endless area(§1);`setBgmScene` 对未知 areaId 已有 fallback。
- boss 规则:`spawnEnemies` 末段对 `floor > FINAL && floor % 5 === 0` 加 endless boss 生成——随机 `pick(BOSSES)` def,hp/atk/def/exp 按 `fs=1+(floor-1)*.12` 重算,`isBoss:true`(phases/summon 按 6c 后的 branchMode 思路不影响——这是主线 endless,fl-lookup 用 def 自身)。

### 6. endless 专属强敌(`data.ts`)
加 3-5 个 `mf` 40+ 强敌(Void Titan mf45 / Doom Seraph mf48 / Entropy Beast mf50 等),仅 F41+ mf 窗口刷出,数值对标 F40+(hp 300+/atk 60+),带强 tag/skill。

### 7. 分数 + meta(`meta.ts` + `combat.ts` + `types.ts`)
- `MetaStats` 加 `bestEndlessFloor: number`;`defaultStats` + 旧档迁移。
- endless 死亡结算(`playerDeath`):`endlessScore = G.floor + floor(p.kills*0.1 + p.gold*0.01)`;`meta.stats.bestEndlessFloor = max(..., G.floor)`;updateRunStats 传 endless。
- 成就:`endless50`/`endless75`/`endless100` 加 `ACH_DEFS` + checkAch 触发。

### 8. UI(`render.ts` + `main.ts`)
- floor label / renderObjective:`G.endless` 时显「♾ 无尽 {floor} 层 · 分数 {score}」(替代 F40/40 + BOSS)。
- death-screen:endless 死亡显无尽最深楼层 + 分数 +「新纪录」(若破 bestEndlessFloor)。

---

## Global Constraints

- **普通模式零改动**:F1-40 胜利路径、win/creator_kill 成就、soul echoes 全不变。
- **向后兼容**:旧存档(`endless` 缺)迁移默认 false。
- **难度曲线**:F41+ `fs` 继续涨(F60≈8.1、F100≈12)——极硬是无尽本意;先沿用现公式,测试期观察,必要时 F60+ 软封顶(见风险)。
- **汉化**:endless area lore / 强敌 / 成就 / Mode 栏 / UI 文案双语完整。
- 无测试框架;验证 = typecheck + build + 冒烟 + 手动 QA。
- 代码引用 pin `39d17d1`。

---

## Testing and validation

- `npm run typecheck` + `npm run build` 必过。
- **冒烟**:载入无报错;角色选界面出现 Mode 栏;普通模式 F1 开局正常(主线不变)。
- **手动 QA**(调试直跳楼层):
  - 选**无尽模式**开局 → `G.endless=true`,F1 正常;调到 F40 击杀创世者 → **不胜利**,继续 F41(endless area 主题/强敌)。
  - F45 → scaled boss 出现;死亡 → death-screen 显无尽楼层 + 分数;meta `bestEndlessFloor` 更新;F50 成就(若到)。
  - 选**普通模式**开局 → F40 创世者 → 正常胜利屏(win/creator_kill 成就不变)。

---

## Risks and mitigations

- **数值爆炸**:F100+ fs 极高 → 伤害天文。缓解:F60+ 改线性放缓(fs = 8 + (floor-60)*0.05),或伤害公式软封顶。本版先沿用现公式,测试期观察。
- **scaled boss 复用**:主线 BOSSES def 重算 hp/atk;phases 按 hpThreshold 比例、summon 按 kind(Wave6a)逻辑兼容(endless 是主线非 branch,branchMode 守卫不影响)。
- **enterFloor setBgmScene**:area id `'endless'` 不在既有场景表 → fallback 默认 explore 旋律(已有机制,确认不崩)。
- **Mode 栏与现有 char-select 布局**:race/class 现有 `.race-opt`/`.class-opt`;加 `.mode-opt` 同模式,确认 index.html/css 不炸(纯 JS 生成,style 内联)。

---

## Parallelization

- **轨 A(内容)**:`data.ts`(endless area + 3-5 强敌 + 成就 def)。
- **轨 B(机制)**:`types`/`save`(endless 字段)+ `main`(Mode 栏 + 传 initGame)+ `game`(initGame 收 mode + enterFloor>FINAL + endless boss)+ `combat`(胜利 `!endless` + 死亡结算)+ `meta`(bestEndlessFloor + 成就)+ `render`(UI)。
- A 纯数据,B 改逻辑,文件不重叠(均不碰 data.ts 除 A),可并行;主 Agent 收口 typecheck/build/QA/merge。

---

## Follow-ups

- 无尽专属装备 / 圣物 / 商人。
- 在线排行榜。
- 无尽「转生」(深度换永久加成)。
- 无尽模式 F1-40 差异化内容(本版与普通同)。
