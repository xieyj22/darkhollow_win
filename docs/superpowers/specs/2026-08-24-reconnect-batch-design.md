# TECH — 批1「断线重连」：8 处断裂系统修复

- 基线 commit：`85e4e3d`（main，2026-08-24）
- 来源：2026-08-24 五维审计（3 并行 agent 全文存档于 memory `darkhollow-audit-2026-08-24`）——本批覆盖其全部"断裂级"发现 + 顺手清债
- 原则：**普通模式（F1-40 主线）行为零变化**（除②净化与③CC 两处"接通已设计但断线"的系统）；无尽/分支/天赋等断线系统恢复到各自 spec 已声明的意图

---

## 1. Context（现状与证据）

① **无尽 F45+ Boss 相位/召唤静默失效**。三处按楼层查表：`processBossPhase`（enemies.ts:141 `BOSSES.find(b => b.fl === fl)`，fl=G.floor）、`tryBossSummon`（enemies.ts:333）、`bossSummonAdd`（enemies.ts:348）。无尽 Boss 由 `pick(BOSSES)` 复用主线 def 生成（enemies.ts:64-69），实例上不带 phases/summon，F45/50/… 查表恒空 → 相位、召唤全不触发；且复用池含菌穴白板 Boss（`fl:0` Myconid Sovereign，data.ts:291，无 phases 无 summon）。`makeEnemy`（enemy-factory.ts:32-62）当前只拷贝 `skill`（深拷贝）与 `res`/`tags`（浅拷贝），不拷贝 phases/summon。

② **腐化净化是死代码**。写有 `applyCorruption(-15/-20)` 的 `fountainDrink`/`shrinePray`（events.ts:122-142）与 `showEvent` 的 `fountain_event`/`shrine_event` 分支（events.ts:54-64）从未被触发；活体喷泉/神龛走 `checkTiles`（events.ts:192-213），只回血/MP 与加属性，**不净化**。`maybeEvent()`（events.ts:24-28）是显式 no-op 但 turn.ts:101 每回合仍调用。后果：法系一局腐化轻松 50+（下楼+1 player.ts:147 / 施法+1 skills.ts:55 / 暗影受击+1 combat.ts:152 / 深渊水+1 events.ts:225），Guardian 结局（endings.ts:12 要求 <50）近乎不可达。

③ **3 个死天赋 + 玩家 CC 系统缺席**。
- `w_shield_mastery`（data.ts:638，effect `skill_stun_dmg`，+20%/rank×2）：`getSkillModifiers`（talents.ts:285-338）无任何分支消费；它是 `w_whirlwind` 前置。战士唯一职业技能就是盾击（skills.ts case 'stun'）。
- `m_elemental_storm`（data.ts:695，effect `skill_random_el`）：talents.ts:335 置 `mods.randomElement=true`，但 `executeSkill`（skills.ts:44-218）从不消费；它是 `m_reality_tear` 前置。
- `p_sanctuary`（data.ts:712，effect `cc_immune`）：`isCCImmune()`（talents.ts:377-379）全库无调用；且玩家 CC 来源不存在——`castDebuff('stun')`（enemy-skills.ts:118-122）完整有测试但 0 个敌人配 `debuff_stun`（`player.stunned` 的 7 个行动入口守卫与 executeSkill 消费已就位）。它是 `p_intervention` 前置。

④ **renderTitleStats 死 UI**。meta.ts:373 定义、main.ts:28 导入，全库无调用——`#title-stats`（index.html:22）永远为空。

⑤ **lore 死解锁**。game.ts:125 `unlockLore('area:' + area.id)` 在 F41 命中 `id:'endless'`（data.ts:620）、分支入口真菌区 `id:'fungal'`（data.ts:609）——但 `LORE_ENTRIES`（lore.ts:16-54）只有 8 主线区域，两条解锁落空；且 `enterBranch`（game.ts:171）从不解锁 fungal（分支内 G.floor 留入口层，area 永远解析为主线区）。

⑥ **F55+ 敌人生成退化**。`makeIn`（enemies.ts:29-30）：窗口 `mf∈[max(1,floor-4), floor]` 为空时回退 `pick(el)` 全池均匀（el 已滤 `mf∈[1,floor]`，enemies.ts:21）。mf 最高 50 → F55+ 窗口恒空，F1 老鼠与 Void Titan 同权重。

⑦ **corruption_ward 漏 endless 门**。combat.ts:383 `if (n > 0 && Math.random() < (1 - corruptionWardMult()))`——该升级 category:'endless'（data.ts META_UPGRADES），但 applyCorruption 不看 `G.endless`，普通局也生效，违反"普通零影响"。

⑧ **图标两瑕疵**。C_BOMB 模板行含空格（sprites.ts:1063 `".....DMMMM K...."`，空格不在调色板→炸弹体与引信间 1px 透明洞）；I_CROWN 中央尖顶 col 5-8（sprites.ts:783-800），视觉中心 6.5 vs 画布中心 7.5，左尖距 1px / 右尖距 3px 不对称。

⑨ **3 条过期注释**：game.ts:170（"enterBranch no-ops"——菌穴已存在）、enemies.ts:74（"returns []"——mf0 数据已在）、combat.ts:395（"Phase 3 will persist…"——recordWardenLegacy 已实现）。

## 2. Proposed changes

### ① Boss 定义随实例走（enemy-factory.ts + types.ts + enemies.ts）

- `types.ts`：`Enemy` 增可选 `phases?: BossDef['phases']`、`summon?: BossDef['summon']`、`bossAtkBase?: number`。`enemy-factory.ts` 的 `EnemyBase` 同步增可选 `phases`/`summon`（BossDef 结构仍满足）。
- `makeEnemy`：`isBoss` 时拷贝 `base.phases`/`base.summon`（**配置引用**即可——它们是只读静态数据，无 per-instance 改写；与 `skill` 深拷贝的差异在注释说明），并记 `bossAtkBase = atk`（出生缩放后攻击，等价旧公式 `bd.atk*(1+(fl-1)*.1)`，因 makeEnemy 的 fs 即 `.1` boss 缩放）。
- `processBossPhase`（enemies.ts:141-144）：改读 `boss.phases ?? BOSSES.find(b=>b.fl===fl)?.phases`；`origAtk = boss.bossAtkBase ?? <旧表查路径>`。`tryBossSummon`/`bossSummonAdd`（:333/:348）同理改 `boss.summon ?? <表查>`。**表查回退保留**——老档里的 boss 实例无这些字段，主线行为不变；无尽旧档 boss 本就不工作，无回归面。
- 无尽复用池排除菌穴 Boss：enemies.ts:65 `pick(BOSSES)` → `pick(BOSSES.filter(b => b.fl >= 5))`。
- `branchMode` 守卫保留（双保险，菌穴 mini-boss 本身无 phases/summon，改后自然 no-op）。

### ② 腐化净化接入活体地形（events.ts + i18n.ts + turn.ts）

- `checkTiles` FOUNTAIN 分支（events.ts:192-204）：`corruption > 0` 时 `applyCorruption(-15)` + 新键 `ev.fountainPurify` 消息；**满血满蓝但腐化>0 也消耗喷泉**（改 quiet 分支判断：`healed<=0 && mp满 && corruption===0` 才 quiet）。
- SHRINE 分支（events.ts:206-213）：祝福照旧，追加 `corruption > 0 → applyCorruption(-20)` + `ev.shrinePurify`。
- 删除死代码：`fountainDrink`/`shrinePray`（events.ts:122-142）、`showEvent` 的两个死分支（:54-64）及对应类型字符串、`maybeEvent`（:24-28）+ turn.ts:101 调用点。
- 数值沿用死代码原设计（-15/-20），不另调。

### ③ 三个死天赋复活 + 玩家 CC 上线（talents.ts + skills.ts + enemy-skills.ts + data.ts + i18n.ts）

- `w_shield_mastery`：`getSkillModifiers` 增 `if (tr(p,'w_shield_mastery')>0) mods.dmgMult += 0.2*rank`。职业树按 classIdx 隔离，语义精确等于"盾击+20%/rank"（盾击是战士唯一技能）。
- `m_elemental_storm`：skills.ts case 'aoe' 内消费 `mods.randomElement`——施法时随机选元素（fire/ice/lightning/shadow），对每个敌人 `dmg ×= 抗性系数（与 combat.attack 的抗性公式同号同形，实现时以 attack 内现公式为准对齐）`，flt 颜色/后缀用 `ELEMENT_SYMBOLS` + 对应元素色（combat.ts 已导出符号表；skills.ts 已 import combat 无环）。
- `p_sanctuary`：enemy-skills.ts `castDebuff` stun 分支顶部 `if (isCCImmune()) { addMsg(t('esk.stunImmune')); return; }`（enemy-skills.ts 增 import talents——检查无环：talents 不 import enemy-skills，安全）。
- **CC 数据上线**：给 3 个中后期敌人加 `skill: { name:{en,zh}, effect:'debuff_stun', chance:0.25, cd:5, aoe:1 }`（aoe 字段在此语义=持续回合，handler `turns = sk.aoe ?? 3`，取 1 回合；handler 上限 Math.min(2,…) 兜底）：
  - Dread Legionnaire（mf≈16，恐惧军团兵——军团+震慑主题）
  - Thunder Wraith（mf≈21，雷霆怨灵——雷电麻痹主题）
  - 虚空区一名施法者（mf≥36，实现时从 ENEMIES 现有 void/abyss caster 中选定，避免新增敌人）
  - 精确 mf/name 以 data.ts 现值为准，本批不新增敌人条目。

### ④ renderTitleStats 复活（main.ts）

所有显示 `#title-screen` 的站点后调用：boot 初始化（main.ts 标题 rAF 启动处）、`returnToTitle()`（main.ts:184）、main.ts:179 的 title-show 站点。

### ⑤ lore 补两条 + fungal 解锁（lore.ts + game.ts）

- `LORE_ENTRIES` 补 `area:fungal`（荧光菌穴：孢子/菌丝/秘境一隅的图注体，80-120 字）与 `area:endless`（无尽深渊：F40 之后的扭曲虚空）双语条目，分类沿区域条目现有 cat。
- `enterBranch`（game.ts:171 内、设置 branchMode 后）加 `unlockLore('area:fungal')`。

### ⑥ F55+ 距离加权回退（enemy-factory.ts + enemies.ts）

- enemy-factory.ts 新增纯函数 `pickWeightedByMf(pool, floor, rand=Math.random)`：`w = Math.exp(-(floor - e.mf) / 15)`，累积权重抽取。F60 参考权重：mf50→0.72、mf42→0.41、mf1→0.027。
- `makeIn`（enemies.ts:30）回退分支 `pick(el)` → `pickWeightedByMf(el, floor)`；**窗口非空分支不动**（F1-54 零变化，F55+ 才进回退）。

### ⑦ corruption_ward 加 endless 门（combat.ts + 测试）

combat.ts:383 → `if (G.endless && n > 0 && Math.random() < (1 - corruptionWardMult()))`。受影响既有测试（combat.test.ts mock corruptionWardMult 0.5 的用例）在其 G setup 中补 `endless: true`；eternal_sand 系测试 mock=1（1-mult=0 恒假）不受影响，逐一复跑确认。

### ⑧ 图标两像素修（sprites.ts）

C_BOMB 空格→`M`（sprites.ts:1063）；I_CROWN 中央尖顶整体右移 1 列（col 5-8→6-9，sprites.ts:785-787）。`sprites.test.ts` shape 守卫（每行 16 字符）自动把关。

### ⑨ 过期注释更新

game.ts:170 / enemies.ts:74 / combat.ts:395 三处改为描述现状。

### 新增 i18n key 清单（en/zh）

`ev.fountainPurify`、`ev.shrinePurify`、`esk.stunImmune`；3 个敌人技能 `name` 为 data 内联 {en,zh}（沿既有模式，不入 L 库）。

## 3. Testing and validation

- **单测（happy-dom，目标 +12~16 条）**：
  - makeEnemy：boss 实例带 phases/summon/bossAtkBase（①）；非 boss 不带。
  - `pickWeightedByMf`：注入 rand 验证确定性选择 + 权重单调（mf 高者在深层被选中概率更高）（⑥）。
  - `checkTiles`：喷泉在 corruption>0 时净化 15 且满血满蓝也消耗；corruption=0 且满血满蓝时 quiet 不消耗（②）；神龛净化 20（②）。
  - `getSkillModifiers`：w_shield_mastery rank2 → dmgMult 1.4（③）。
  - `executeSkill` aoe + randomElement：对高抗敌人伤害按抗性折减（mock rng 锁定元素）（③）。
  - `castDebuff('stun')`：isCCImmune=true 时不施加 stunned（③）。
  - `applyCorruption`：G.endless=false 时 corruptionWardMult 不参与（mock mult 0.5、mock random 0 → n 不减）；endless=true 时参与（⑦）。
  - `renderTitleStats`：#title-stats innerHTML 含回响/场次（④）。
  - LORE_ENTRIES 含 `area:fungal`/`area:endless`（⑤）。
  - 既有 real-data 测试补硬门：ENEMIES 中 `debuff_stun` caster === 3（③）。
- **全量门**：`npx tsc --noEmit` 0 错、`npx vitest run` 全绿（332+新增）、`npm run build` 0 错、push 后 CI（typecheck+vitest+build+smoke 65 检查）绿。
- **手动/冒烟**：普通模式冒烟一条命 F1-10（喷泉净化消息出现）；无尽 F45 boss 掉相位触发消息（可用调试捷径验）；圣骑点出 sanctuary 后被军团兵晕不住。smoke 脚本不改（本批不改设置面）。

## 4. Parallelization

**不并行**。理由：①⑥ 同文件（enemies.ts）且⑥依赖①新增的 factory 函数；③ 横跨 data/talents/skills/enemy-skills 四文件，与⑦同触 combat 相关测试；单项均为小时级，并行协调（worktree+合并）开销超过收益。执行方式（subagent 顺序 SDD vs 主 Agent 内联）在 plan 阶段定。

## 5. Risks and mitigations

- **②净化强度**：-15/层 40% 出现率 vs 每层 +1 基线——净化后法系腐化曲线显著下移，Guardian 从不可达变宽松。风险是走向另一极端（腐化系统存在感变弱）。缓解：本批按死代码原值接通，数值感受交 playtest 批统一调（audit 已有无尽/腐化 playtest 待办）。
- **③玩家被晕体验**：1 回合 stun、chance 0.25、cd 5——保守起步；7 入口守卫已测过。若 playtest 反馈挫败，调 chance/cd 纯 data。
- **①表查回退双路径**：processBossPhase 同时存在实例路径与回退路径，回退仅服务老档主线 boss。用测试钉住两条路径各自行为，防止未来只删一半。
- **③randomElement 抗性符号方向**：实现时必须比对 combat.attack 的抗性公式（res>0 减伤方向）再写乘子，禁止凭记忆写——这是既往"brief one-liner 出错"的高发区。
- **⑦测试改动**：combat.test.ts 既有用例语义变化（加 endless:true）须在 commit message 注明是行为修正而非放松断言。

## 6. Follow-ups（明确不做，转后续批）

- 事件池扩充 / Boss 配技能 / 死 handler 其余三个（heal/blink/summon）启用——内容批（批2）。
- F55+ 专属新怪（mf 55/60/65…）——无尽内容批。
- 腐化×天赋联动、r4 圣物填缝——深度批。
- `w_shield_mastery` 若未来战士加第二技能，`skill_stun_dmg` 需从 dmgMult 拆为盾击专属乘区（届时再改）。
