# 批17「平衡大修」技术规格 — 公式+数值组合拳

日期: 2026-09-22 · 来源: 平衡审计 Spike（`scripts/balance_audit.mts` + `docs/balance-audit-2026-09-22.json`） · 用户已批方向（公式+数值组合拳）与难度目标（标准肉鸽曲线）

## 1. 审计结论（为什么必须动公式）

- **1-伤害墙**: `dmg = max(1, atk - def)`，敌 def 随 fs×5.8@F40 → 圣殿敌 def 93-145 ≥ 玩家 atk 88-106 → 每击 1 伤害。Paladin 打创世者 TTK=2649 回合，不可玩。
- **受击死跳水**: F35-40 普通敌 1-2.5 击杀死玩家（Cosmic Horror 278/击 vs maxHp 290-455）。
- **腐化死亡陷阱**: Mage @F40 ≈165 腐化（技能每放+1），100 即守渊人死亡；Guardian 结局（<50）施法系结构性不可达。
- **职业断崖**: F40 有效 TTK Rogue 12t vs Paladin 885t（70 倍）。
- **meta 无感**: fresh vs estab 画像 F20+ 曲线重合。
- **掉落无加权**: F40 仍 1/26 掉锈剑(atk2)。
- **无尽倒挂**: F50(h2d 1.8-2.3) 比 F55(4.5-6) 更难——mf 窗口在 F51+ 断供，回退池均值更弱。

**健康部分不动**: F1-30 主线 TTK 曲线（0.5→10t）、等级曲线（F40≈Lv21）、Boss F5-F25 节奏。

## 2. 目标曲线（验收基准，审计脚本 fixSim 输出须落入）

| 指标 | 目标 | 修复模拟实测(estab) |
|---|---|---|
| 普通敌 TTK | F1-10: 0.5-3t / F15-30: 2-7t / F35-40: 4-13t | 0.4-12.5t ✓ |
| 受击死(普通敌) | F15-30: 4-10h / F35-40: ≥2.8h | 3.6-5.2h @F35, 2.8-3.9h @F40 ✓ |
| Boss TTK | F5: 2-5t / F25: 5-11t / F40: 20-60t | 2-56t ✓ |
| Boss 受击死 | F5-30: ≥3.6h / F35-40: ≥2.1h(带药水/复活实际 3-4h, playtest 校准点) | 2.1-2.9h @F40 ✓(边缘) |
| 职业差(F40 TTK) | ≤2.5× | 2.3× ✓ |
| 腐化 @F40 | 全职业 ≤60, 法师努力后 <50(Guardian 可达) | 战5/贼5/骑5/法85 → T6 后目标 ~40-50 |
| 无尽墙 | 大众磨死于 F45-55, 不倒挂 | F45-50 墙 + T9 消除倒挂 |

## 3. 变更清单

### T1 伤害公式改造（combat.ts `attack()`，核心）
```
旧: dmg = max(1, atk - def + rng(-2, 2))
新: dmg = max(1, floor((atk + rng(-2, 2)) * 100 / (100 + def)))
```
- **双向同公式**（玩家打敌 / 敌打玩家），K=100。元素乘区/暴击/法穿/mana shield/corruption 乘区位置不变（全部在新基础伤害之后叠加）。
- 低层等价性: def≤3 时偏差 <1（F1 Goblin def1: 10-1=9 vs floor(10×100/101)=9）。F1-15 体感不变。
- 消除墙: F40 圣殿敌 def 108 vs atk 106: 旧 1 伤害 → 新 51。
- 注释里写明 K 的语义（def=100 即 50% 减伤）与调参入口。

### T2 敌人缩放放缓（enemies.ts + data.ts AREAS）
- 敌人 fs: `.12` → `.10`（enemies.ts:39 及所有同源站点 grep `.12` 逐一核对：spawnEnemies/spawnBranchEnemies L88/L312/L403；**boss fs `.1` 不动**）。
- AREAS `enemyScaleBonus`: sanctum `0.12→0.05`、endless `0.15→0.10`、abyss/void 不动。

### T3 Boss 数值（data.ts BOSSES，仅 fl≥25）
- atk ×0.75: Dragon Emperor 28→21、Leviathan 35→26、Void Sovereign 45→34、Creator 55→41（hp/def/exp 不动）。
- phases atkM 上限 1.6: Void Sovereign 2.0→1.6、Creator 2.0→1.6（1.4 不动）。Leviathan 1.5 不动。

### T4 升级 HP 成长（combat.ts `checkLevelUp`）
- `rng(5, 12)` → `rng(6, 14)`（均值 8.5→10）；mp/atk/def 成长不动。

### T5 掉落稀有度楼层加权（item-gen.ts genWeapon/genArmor/genAcc）
- `pick(el)` → 按 `w = 1 + b.r * (1 + f / 40)` 加权抽取（同 mr 门不变）。
- 效果: F40 时 r4 权重 5 vs r0 权重 1（现状全 1）。锈剑占比 1/26 → ~1/70。
- 断言: F40 抽 10 万次，E[atk(武器)] 较均匀池提升 ≥15%（写进测试）。

### T6 腐化经济（skills.ts + item-gen.ts + events.ts/combat.ts 净化值）
- `executeSkill` 施法腐化: `applyCorruption(1)` → 50% 概率 +1（`Math.random() < 0.5` 才调；注释说明施法系呼吸空间）。
- 净水 `purified_water` v: 20 → 30（data.ts CONSUMABLES + desc 文案 i18n 同步「净化30」）。
- 神龛净化 -20 → -25（events.ts checkTiles 神龛分支 + i18n 若有数值文案）。
- 验收: 审计脚本 fixCorruption 法师 @F40 ≤ 55（模型）；游戏内 mage 连打验证不爆 100。

### T7 职业微调（skills.ts + data.ts CLASSES）
- Rogue 死亡标记必暴倍率 ×2 → ×1.75（skills.ts `burst` case `* 2` → `* 1.75`；data.ts 天赋 desc 无数值不需动）。
- Paladin 圣光术附带伤害: 对 ≤4 距离内所有敌人造成 120% ATK 神圣伤害（skills.ts `heal` case 加伤害段，复用 p_consecrate 也有的 holy dmg 形状；CLASSES skill desc 双语更新「恢复40%最大HP并净化,对附近敌人造成120%ATK神圣伤害」）。
- Mage CLASSES hp: 30 → 38（createPlayer 自动跟随）。

### T8 meta 升级存在感（data.ts META_UPGRADES，仅数值）
- start_hp 10→15/级、start_atk 1→2/级、start_def 1→2/级、crit_bonus 3→4%、dodge_bonus 2→3%。costs 不动。
- 效果: estab 画像 F40 有效生存 ~+12%（模型），早期 F1-10 提升明显（新手体验）。

### T9 无尽敌窗口补供（data.ts ENEMIES 4 条 mf）
- Void Titan mf 42→44、Doom Seraph 45→48、Entropy Beast 48→52、Abyssal Tyrant 50→56。
- 消除 F51+ 窗口断供→回退池倒挂；F55-60 由窗口直供。

### T0 审计脚本确定性 + 回归门（scripts/balance_audit.mts + 新测试）
- 蒙特卡洛换可注种子（mulberry32 固定 seed=13），输出确定性。
- 新增 `src/__tests__/batch17-balance-curves.test.ts`: 读取脚本同源计算（把 fixSim 核心函数抽到 `src/balance-targets.ts` 纯模块供脚本与测试共用）或直接复制曲线断言——**锁 §2 目标表的带状区间**（TTK/h2d per floor band per class），防未来数值漂移。
- 现有测试影响面: grep 锁死旧公式/旧 fs/旧 hp 成长的 characterization 测试须同步更新（预期集中在 combat/skills/grantKillRewards/enemies 相关 test 的精确伤害断言）。

## 4. 不做（显式出界）
- 不动元素克制表/暴击率/闪避率公式；不动经验曲线与 meta costs；不加新内容（新敌/新装备/新事件）；
- 不做 meta 百分比重构（T8 用放大的扁平值代替，百分比版留给后续批）；
- 不动存档结构（零 schema 变更，老档兼容）。

## 5. 验证
1. `npx tsc --noEmit` 0 + vitest 全绿（含更新后的 characterization + 新曲线门）。
2. 审计脚本重跑: fixSim 全部落 §2 带状区间（表格化 diff 进 PR 描述）。
3. 游戏内电池（复用 verify_*ingame.py 模式，5-8 检查: F1 体感等价抽查/F40 伤害不再 1/圣光术新伤害段/腐化数值/无尽 F55 窗口敌）。
4. CI 四门绿。
5. 用户冒烟: F1-5 开局手感不变（等价性）+ F35-40 可玩。
