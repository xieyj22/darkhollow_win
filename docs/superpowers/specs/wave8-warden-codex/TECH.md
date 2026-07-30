# Wave 8:守渊人(The Warden)+ 典籍面板(Lore Codex)

技术规格。对应 `darkhollow`。本规格是 Wave 8 实现与验收的唯一对照基准。剧情基底见 `docs/lore/00-世界观设定.md` + `00-世界观百科.md`。

提交基准:`e1f165d`(lore docs commit 后的 main HEAD)。代码引用 pin 此 commit。

---

## Context

剧情设定已就绪(创世者=悲慈守护者、守渊人=前代失败下探者被改成深渊免疫猎犬)。本波把**两条最优先的「剧情→玩法」派生**落地:

1. **守渊人周期追猎**:一个跨层动态宿敌,按**随机冷却**现身追杀玩家,杀掉掉独特圣物 + 解锁记忆;可战可逃。
2. **📜 典籍/日志面板**:解锁式 lore 条目(世界/区域/Boss/圣物/守渊人),把剧情嵌入游戏,复用 records 面板模式。

关键既有机制(本规格复用/改动):
- [`enterFloor(floor)` game.ts](https://github.com/xieyj22/darkhollow_win/blob/e1f165d/src/game.ts):每下一层调用;敌人在此生成、不跨层持久化(→ 守渊人「逃跑即消失」天然成立)。
- [`spawnEnemies` enemies.ts](https://github.com/xieyj22/darkhollow_win/blob/e1f165d/src/enemies.ts):fs 缩放;守渊人按 fs 缩放。
- [`killEnemy` combat.ts](https://github.com/xieyj22/darkhollow_win/blob/e1f165d/src/combat.ts):击杀结算;守渊人击杀在此检测掉落。
- [`grantRelic`/RELICS relics.ts+data.ts](https://github.com/xieyj22/darkhollow_win/blob/e1f165d/src/relics.ts):圣物授予;守渊人掉「前任遗物」。
- [`GameState` types.ts](https://github.com/xieyj22/darkhollow_win/blob/e1f165d/src/types.ts):加 `wardenCd`、`Enemy.isWarden`。
- [`MetaSave` types.ts](https://github.com/xieyj22/darkhollow_win/blob/e1f165d/src/types.ts):加 `unlockedLore: string[]`。
- 标题/overlay 模式 [`main.ts` records 面板 @ cf4ba02](https://github.com/xieyj22/darkhollow_win/blob/e1f165d/src/main.ts):典籍面板照抄。

---

## 目标与范围(Wave 8)

- **Part A — 守渊人**:`wardenCd` 随机冷却(rng 6-9 层)触发;`enterFloor` 检测→`spawnWarden` 召唤强 chase 敌;击杀掉独特圣物 + 解锁守渊人记忆;逃跑(下楼)即消失、计时已在召唤时重置。
- **Part B — 典籍面板**:Meta `unlockedLore`;到新区/杀 boss/捡圣物/遇杀守渊人 各解锁条目;标题「📜 典籍」按钮 + codex-overlay(分类、已解锁显文本/未解锁显 ???)。

非目标:腐化度/理智值、多结局、圣物 lore 全量(先区域/boss/守渊人/世界条目,圣物条目可只解锁 id 占位)、NPC 对话树。

---

## Proposed changes

### Part A — 守渊人

**A.1 状态(`types.ts` + `game.ts` + `save.ts`)**
- `GameState` 加 `wardenCd: number`(剩余层数到下次召唤)。
- `Enemy` 加 `isWarden?: boolean`。
- `initGame`:`wardenCd: rng(4, 6)`(首次约 F4-6 引入)。
- `save.ts` 迁移:`wardenCd = m.wardenCd ?? 0`(读档不持久化「下次守渊人」也可,但持久化更自然——读档后 wardenCd 继续)。

**A.2 触发 + 召唤(`game.ts` enterFloor + 新 `spawnWarden`)**
- `enterFloor` setup 末段(`spawnEnemies` 之后):
```ts
G.wardenCd--;
if (G.wardenCd <= 0) { spawnWarden(floor); G.wardenCd = rng(6, 9); }
```
- 新 `spawnWarden(floor)`(enemies.ts 或 game.ts;放 enemies.ts 与 spawnEnemies 同域):
```ts
export function spawnWarden(floor: number): void {
  if (!G) return;
  const fs = 1 + (floor - 1) * .12;
  const rooms = G.dungeon.rooms.slice(1); // 不放起始房
  if (!rooms.length) return;
  const rm = pick(rooms);
  G.enemies.push({
    name: lang === 'zh' ? '守渊人' : 'The Warden', ch: 'Ѡ', c: '#9a2be2',
    x: rng(rm.x+1, rm.x+rm.w-2), y: rng(rm.y+1, rm.y+rm.h-2),
    hp: Math.floor((45 + floor*5) * fs), maxHp: Math.floor((45 + floor*5) * fs),
    atk: Math.floor((10 + floor*1.6) * fs), def: Math.floor((4 + floor*0.6)),
    exp: Math.floor((40 + floor*4)), goldDrop: rng(30, 60) + floor*3,
    ai: 'chase', stunned: 0, feared: 0, isAlly: false, isElite: true, isWarden: true,
    el: 'shadow', res: { shadow: 0.5, holy: -0.5 }, skillCd: 0, tags: ['spirit'],
  });
  addMsg(lang === 'zh' ? '👁 守渊人正在追猎你……' : '👁 The Warden is hunting you...', 'me');
  flt(G.player.x, G.player.y, '⚠WARDEN', '#9a2be2'); snd('boss'); shake();
}
```
(sprite:tag 'spirit' → WRAITH 模板 + Wave5 描边;`isElite` 给元素光晕 + HP 条;`isWarden` 标记击杀掉落。)

**A.3 击杀掉落(`combat.ts` killEnemy)**
- killEnemy 内,`if (e.isWarden)` 分支:`grantRelic(pick(WARDEN_RELICS))` + 解锁典籍 `warden:memory`(每杀解锁下一条,共 3 条)+ 消息「你击退了守渊人!获得 {圣物}」+ 一段记忆文本。
- 新 `WARDEN_RELICS`(data.ts):2-3 件独特圣物(前任遗物),如:
  - `warden_cloak` 守渊人斗篷(dodge+ / on-dodge 回血)
  - `fallen_blade` 前任之刃(atk+ / on-crit 吸血)
  - `memory_shard` 记忆碎片(lore 圣物,exp+)

**A.4 逃跑(无需新逻辑)**
- 守渊人是普通楼层敌人,不跨层持久化;走楼梯 → `enterFloor` 重置 `G.enemies` → Ta 消失。`wardenCd` 已在召唤时重置,下次按新冷却再来。→ 天然「可战可逃」。

### Part B — 典籍面板

**B.1 数据(`data.ts` 或新 `lore.ts`)**
- 新 `LORE_ENTRIES: { id: string; cat: 'world'|'area'|'boss'|'relic'|'warden'; n: I18nText; body: I18nText }[]`,内容取自 `docs/lore` 浓缩(world 背景 / 8 area / 8 boss / 3 warden memory / 占位 relic)。
- 新 `MetaSave.unlockedLore: string[]`;`initMeta` + getMeta 迁移 `[]`。
- 新 `unlockLore(id)`(meta.ts):push(去重)+ saveMeta。

**B.2 解锁触发**
- `enterFloor`(game.ts):首次到某 area → `unlockLore('area:'+area.id)`。
- `killEnemy`(combat.ts):boss 击杀 → `unlockLore('boss:'+fl 或 name)`。
- `grantRelic`(relics.ts):拾取圣物 → `unlockLore('relic:'+relicId)`。
- 守渊人:`spawnWarden` → `unlockLore('warden:encounter')`;击杀 → `unlockLore('warden:memory1/2/3')`(递进)。
- 开局:`initGame` → `unlockLore('world:descent')`(默认解锁世界背景条目)。

**B.3 UI(`index.html` + `main.ts`)**
- 标题加 `<button class="menu-btn" id="btn-codex">📜 Codex</button>`;加 `<div id="codex-overlay" class="overlay">...<div id="codex-content"></div></div>`。
- `renderCodex()`(main.ts):按 cat 分组,遍历 LORE_ENTRIES,已解锁(id ∈ unlockedLore)显 n+body,未解锁显 `???`(隐藏 body);set codex-content innerHTML。
- bind:`on('btn-codex', () => { showOverlay('codex-overlay'); renderCodex(); })` + close。updateLangUI 加 codex 按钮文案。

---

## Global Constraints

- **普通模式零改动**:守渊人/典籍在 normal + endless 都生效;wardenCd 默认行为不影响既有节奏(守渊人是额外威胁,不替换固定 boss)。
- **不破坏既有 boss/branch**:守渊人 `isWarden` 走 killEnemy 普通击杀(非 processBossPhase/tryBossSummon——Ta 是 isElite 非 isBoss,故 6c 的 branchMode 守卫、boss phase 逻辑都不触发)。秘境(branchMode)内守渊人是否召唤?约定:**秘境内不召唤**(enterBranch 不走 wardenCd;exitBranch 回主线继续)。
- **向后兼容**:旧存档 `wardenCd`/`unlockedLore` 缺失 → 迁移默认值。
- **reducedMotion**:守渊人召唤的 shake/fx 在 reducedMotion 下退避(既有 shake/fx 已守卫)。
- **汉化**:LORE_ENTRIES 双语;守渊人文案双语。
- 无测试框架;验证 = typecheck + build + 冒烟 + 手动 QA。
- 代码引用 pin `e1f165d`。

---

## Testing and validation

- `npm run typecheck` + `npm run build` 必过。
- **冒烟**(`npm run dev` + headless):载入无报错;标题「📜 典籍」按钮 + codex-overlay 打开(world 条目默认解锁,其余 ???);开局下探若干层,确认 wardenCd 倒计时到 0 时守渊人召唤(消息/精灵出现)、击杀掉圣物 + 解锁记忆、逃跑消失。
- **手动 QA**:打到守渊人现身 → 战/逃两条路;典籍随下探逐步解锁(区域/boss/圣物/守渊人);中英切换正常。

---

## Parallelization

- **轨 A(守渊人)**:`types`/`game`/`enemies`/`combat`/`relics`/`data`(WARDEN_RELICS)。
- **轨 B(典籍)**:`types`/`meta`(unlockedLore + unlockLore)/`data` 或 `lore.ts`(LORE_ENTRIES)/`index.html`/`main`(renderCodex + bind)+ 各解锁点。
- 重叠:`types`/`data`/`combat`/`game`/`meta` 两轨都碰——**建议顺序执行(A 先 B 后)或主 Agent 收口合并**,避并发同文件。A 的击杀掉落调用 B 的 unlockLore(运行时依赖,编译不依赖)。并发≤2 避 429。

---

## Risks and mitigations

- **守渊人强度失衡**:fs 缩放下 hp/atk 可能过强/过弱——公式 `(45+floor*5)*fs` / `(10+floor*1.6)*fs` 需 playtest 调;先偏强(mini-boss 级),玩家可逃。
- **wardenCd 持久化**:若存档中途存了 wardenCd,读档后守渊人可能立即/延迟来——可接受(增加不可预测)。或读档时 wardenCd 至少 2(避免一读档就召唤)。
- **典籍内容量**:LORE_ENTRIES 全量双语是大段文案——先写核心(world/8 area/8 boss/3 warden,约 20 条),relic 条目可先占位 id 后补。
- **isWarden 走 killEnemy**:确认 killEnemy 不对 isWarden 做特殊 phase 处理(Ta 是 isElite,不走 boss 路径)。

---

## Follow-ups

- 圣物记忆全量(每件圣物一条典籍)。
- 腐化度/理智值(用深渊之力过深 → 接近成为守渊人)。
- 多结局(圣殿「杀创世者 vs 拒绝」)。
- 守渊人变种/进化(越深形态不同)。
