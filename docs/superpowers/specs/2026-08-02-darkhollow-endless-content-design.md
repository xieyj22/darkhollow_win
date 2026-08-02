# 无尽专属内容 (Endless Content) — 技术规格

**日期**: 2026-08-02  **分支**: feat/endless-content (from main `3cb52a0`)  **范围**: F41+ 扭曲虚空的专属装备(8件3套装) + 专属圣物(6个 rarity5) + 专属商人(endless_merchant) + 转生(endless 死亡→soulEchoes→5 个无尽 meta 升级)

## 1. Context（问题与现状）

无尽模式（Wave 6d）已有**机制骨架**：`G.endless` + Mode 栏选（[`game.ts:19 initGame(endless)`](https://github.com/xieyj22/darkhollow_win/blob/3cb52a0/src/game.ts#L19)）+ F41+ 扭曲虚空 area + 4 强敌（Void Titan mf42 / Doom Seraph mf45 / Entropy Beast mf48 / Abyssal Tyrant mf50）+ 成就 endless50/75/100 + endlessLeaderboard。但 **F41+ 缺专属内容**——掉落/商店仍是 F1-40 的通用池，深层进度感薄；死亡除排行榜外无永久进度回报。

本特性补齐 4 子系统（全在 `G.endless && G.floor >= 41` 门内，**普通模式 F1-40 零影响**）：

- **专属装备**：复用 [`item-gen.ts genWeapon/genArmor/genAcc`](https://github.com/xieyj22/darkhollow_win/blob/3cb52a0/src/item-gen.ts#L32-L58) 模式（rarity cap + bonus 缩放），新 rarity 5 表 + 独立缩放。
- **专属圣物**：复用 [`relics.ts`](https://github.com/xieyj22/darkhollow_win/blob/3cb52a0/src/relics.ts) effect handler 模式（applyRelicBonuses/onHit/...）+ [`grantRandomRelic` rarity cap](https://github.com/xieyj22/darkhollow_win/blob/3cb52a0/src/relics.ts#L171-L188)（现 `floor>=30→4`，F41+ 放宽 5）。
- **专属商人**：复用 `events.ts` 现有 merchant/treasure_merchant npc + 弹窗 UI。
- **转生**：复用 [`meta.ts applyMetaUpgrades`](https://github.com/xieyj22/darkhollow_win/blob/3cb52a0/src/meta.ts#L126) + `META_UPGRADES`(data.ts，按 `category` 分 forge tab，[`meta.ts:297`](https://github.com/xieyj22/darkhollow_win/blob/3cb52a0/src/meta.ts#L297)) + soulEchoes 货币。

## 2. Proposed Changes

### 2.1 共通门
所有新内容只在 `G.endless && G.floor >= 41` 触发。普通模式 F1-40 行为不变。

### 2.2 专属装备（8 件 / 3 套装）

**数据 `data.ts`**：新 `ENDLESS_GEAR` 表（rarity 5，base 高于现有 rarity 4 ~20%）+ `EQUIPMENT_SETS` 加 3 套装。8 件按 3 套装分布（void 3 / abyss 3 / astral 2）：

| 件 | type | base | el | set |
|---|---|---|---|---|
| 虚空之刃 Void Blade | weapon | a14 | shadow | void |
| 深渊法杖 Abyss Staff | weapon | a11 | shadow | abyss |
| 星辰长弓 Star Bow | weapon | a13 | holy | astral |
| 虚空护甲 Void Armor | armor | d12 | shadow | void |
| 深渊斗篷 Abyss Cape | armor | d8 | — | abyss |
| 星辰护盾 Astral Aegis | armor | d11 | holy | astral |
| 虚空戒指 Void Ring | accessory | a3/d2/h30 | — | void |
| 深渊护符 Abyss Amulet | accessory | a2/d3/h40 | — | abyss |

**套装 bonus**（`EQUIPMENT_SETS` 新 3 项，复用现有 bonus type + 1 新 `corruption_resist`）：
- `void`: 2件 `el_dmg_shadow +15%` / 3件 `corruption_resist`（每层 enterFloor -3 腐化）
- `abyss`: 2件 `crit +10%` / 3件 `heal_bonus +15%`
- `astral`: 2件 `el_dmg_holy +15%`

新 bonus type `corruption_resist`：`applySetBonus`（[`combat.ts:308`](https://github.com/xieyj22/darkhollow_win/blob/3cb52a0/src/combat.ts#L308)）加 case 存到 `p` 新字段 `setCorruptionResist?`，`enterFloor` 检查并 `applyCorruption(-setCorruptionResist)`。

**生成 `item-gen.ts`**：新 `genEndlessGear(floor, type?)`：从 `ENDLESS_GEAR`（按 type filter）pick + 缩放 `bonus = floor((floor-41)/5) × 2`（F41:0 / F60:7.6 / F100:23.6），weapon atk=base.a+bonus、armor def=base.d+bonus、acc 不缩放（base 已高）。返回 Item（含 set/el）。`genItem(floor)`（[`L9`](https://github.com/xieyj22/darkhollow_win/blob/3cb52a0/src/item-gen.ts#L9)）**不改**——无尽装备不走 genItem，而是 F41+ 掉落/商人专用 `genEndlessGear`。

**掉落接入**：`combat.ts::attack` loot 分支（[`L161 _genItem`](https://github.com/xieyj22/darkhollow_win/blob/3cb52a0/src/combat.ts#L161)）+ `killEnemy`/`grantKillRewards`：F41+ 击杀 loot 用 `genEndlessGear`（受 endless_luck meta 加成影响掉率，见 2.5）。boss/精英 F41+ 必掉一件专属装备。

### 2.3 专属圣物（6 个 rarity 5）

**数据 `data.ts` RELICS** 加 6 项 rarity 5；`relics.ts` handler 接线：

| id | effect | 接入点 |
|---|---|---|
| `void_heart` | spellPower += floor×0.01 | applyRelicBonuses |
| `abyss_eye` | +30% dmg vs tag spirit/aberration/demon 敌人 | relicOnHitEnemy（查 defender.tags） |
| `eternal_sand` | 腐化获取 -50% | applyCorruption 入口（[`combat.ts:338`](https://github.com/xieyj22/darkhollow_win/blob/3cb52a0/src/combat.ts#L338)） |
| `star_core` | crit dmg +floor×0.5% | getCritMultiplier（talents.ts） |
| `chaos_egg` | atk += floor(soulEchoes/50) | applyRelicBonuses（读 `getMeta().soulEchoes`，meta 进度联动） |
| `null_crown` | 每层 enterFloor +1 随机 buff（str/def/shield，3 回合） | enterFloor（game.ts） |

`grantRandomRelic`（[`L171-188`](https://github.com/xieyj22/darkhollow_win/blob/3cb52a0/src/relics.ts#L171-L188)）：`maxR = floor>=41 ? 5 : floor>=30 ? 4 : floor>=15 ? 3 : 2`（F41+ 放宽到 5）。

### 2.4 专属商人（endless_merchant）

**`events.ts`** 新 npc 类型 `'endless_merchant'`，F41+ 每 ~3 层在 endless area 刷 1 个（spawnMerchant/endless area 房间生成处加分支）。商品表（复用现有 merchant 弹窗 UI，4 类商品）：

| 商品 | 价(gold) | 来源 |
|---|---|---|
| 2-3 件专属装备 | floor×80 | `genEndlessGear(floor)` roll |
| 1 专属圣物 | floor×200 | rarity 5 RELICS 池 grantRelic |
| 服务·净化腐化 -20 | floor×40 | `applyCorruption(-20)` |
| 服务·治疗满血 | floor×30 | `p.hp = p.maxHp` |

用 **gold**（run 内货币，与现有商人一致；soulEchoes 只在转生 meta 层，不混）。

### 2.5 转生（endless 死亡 → soulEchoes → meta 永久升级）

**bonus echoes**：`combat.ts::playerDeath` endless 分支（[`L387`](https://github.com/xieyj22/darkhollow_win/blob/3cb52a0/src/combat.ts#L387)）在 `calculateSoulEchoes` 基础上加 `(floor-40)×10`（F41+ 才有，F50 +100 / F100 +600）。

**5 个 `MetaUpgradeDef category='endless'`**（data.ts META_UPGRADES 加，标题屏 forge 加"无尽"tab）：

| id | 效果（仅 endless run，initGame/applyMetaUpgrades gate `G.endless`） | maxLevel | costs |
|---|---|---|---|
| `deep_start` | endless 开局楼层 +5×rank（跳早期，initGame 起始 floor） | 5 | [200,400,700,1100,1600] |
| `void_resist` | +裸装全元素抗 10%×rank（applyMetaUpgrades，所有 elRes） | 5 | [150,300,500,800,1200] |
| `endless_luck` | +专属装备/圣物掉率 20%×rank（genEndlessGear/grantRandomRelic 掉率） | 5 | [200,400,700,1100,1600] |
| `corruption_ward` | 腐化获取 -15%×rank（applyCorruption 入口） | 5 | [150,300,500,800,1200] |
| `endless_might` | +baseAtk/baseSpellPower 5%×rank（applyMetaUpgrades） | 5 | [300,600,1000,1500,2200] |

**接入**：`meta.ts::applyMetaUpgrades(p)`（[`L126`](https://github.com/xieyj22/darkhollow_win/blob/3cb52a0/src/meta.ts#L126)）加 `if (G.endless)` 块应用 void_resist/endless_might；`endless_luck` 在 genEndlessGear/grantRandomRelic 掉率公式读 rank；`corruption_ward` 在 applyCorruption 入口读 rank（与 eternal_sand 圣物乘算叠加）；`deep_start` 在 `initGame(endless=true)` 改起始 floor（需配套：跳层后初始 lore/area 正确，深度起跳 = 直接进 F(41+5N)）。

## 3. End-to-end Flow

```
标题屏选 Mode=endless + 职业 → initGame(endless): apply deep_start(起始 F41+5N) + void_resist/endless_might/corruption_ward(applyMetaUpgrades gate)
→ F41+ 扭曲虚空: spawn 强敌 + endless_merchant(每3层) + 掉落(genEndlessGear, endless_luck 加成)
→ 击杀: 专属装备(loot)/圣物(grantRandomRelic rarity5) → 装备/圣物提升 + 套装 bonus + null_crown 每层 buff
→ 商人: gold 买专属装备/圣物/净化/治疗
→ 死亡: bonus echoes (floor-40)×10 → 标题屏 forge"无尽"tab 换永久升级 → 下次 endless 越深
```

## 4. Testing and Validation

沿用现 152 测基座（vitest + happy-dom）。

- **`endless-content.test.ts`（新）**：`genEndlessGear` 缩放（F41/F60/F100 atk 值 + set/el 携带）；3 套装 bonus 应用（applySetBonus void/abyss/astral + corruption_resist 每层减腐化）；6 圣物 effect（mock combat，void_heart spellPower 缩放 / abyss_eye vs tag / eternal_sand 腐化减半 / chaos_egg echoes 联动 / null_crown 每层 buff）；endless_merchant 商品生成（gold 价 + 4 类）；5 meta 升级 apply（endless gate，普通模式不应用）；deep_start 起始楼层；bonus echoes 公式。
- **扩 `makeEnemy-real-data.test.ts`** 或新测：ENDLESS_GEAR/RELICS/META_UPGRADES 新数据 shape 守卫。
- **回归**：`genItem`（普通模式）不改，现有测应全绿；普通模式 F1-40 零影响（所有新内容 `G.endless && floor>=41` gate）。
- **验证**：`npm run build`(tsc+vite) + 全量 vitest + 无头冒烟（playwright：起 endless run 进 F41+，确认专属装备/圣物掉落、商人交互、死亡 bonus echoes + 标题换升级，不崩）。

## 5. Parallelization

4 子系统在 `data.ts` 高度共享（ENDLESS_GEAR + EQUIPMENT_SETS / RELICS / META_UPGRADES 都在 data.ts）→ **顺序执行避撞**（darkhollow 教训：同文件并发 build+commit 撞 + skill 禁并行 implementation subagent）。

依赖与文件归属：
- **T1 装备**：data.ts(ENDLESS_GEAR+EQUIPMENT_SETS) + item-gen.ts(genEndlessGear) + combat.ts(loot F41+) + types.ts(setCorruptionResist) + enterFloor(corruption_resist)
- **T2 圣物**：data.ts(RELICS+6) + relics.ts(handler) + talents.ts(star_core getCritMultiplier) + game.ts/enterFloor(null_crown) + combat.ts(applyCorruption eternal_sand) + relics.ts(grantRandomRelic cap)
- **T3 商人**：events.ts(endless_merchant npc + 商品) + spawn 接入 — 文件较独立但 data.ts 不改
- **T4 转生**：data.ts(META_UPGRADES+5) + meta.ts(applyMetaUpgrades endless + forge tab) + combat.ts(playerDeath bonus echoes + applyCorruption corruption_ward) + game.ts(initGame deep_start) + item-gen/relics(endless_luck 掉率)

**顺序**：T1 → T2 → T3 → T4（data.ts 共享 + 部分函数跨 task 如 applyCorruption 被 eternal_sand/corruption_ward 共改）。每 task implementer+reviewer，final opus whole-branch review，ff-merge main。撞 429 主 Agent 内联。

## 6. Risks & Mitigations

- **deep_start 跳层副作用**：F(41+5N) 起跳可能跳过 area lore 解锁 / 初始平衡（玩家裸装进高 floor）。**缓解**：deep_start 起跳仍走正常 enterFloor（unlockLore/area 正确）；起跳 floor 的敌人缩放正常（fs 公式自动）；rank 1 只跳 F46，渐进。**playtest 验证**起跳不致死。
- **数值通胀**：F100+ 装备/圣物缩放（chaos_egg echoes 联动、void_heart spellPower×floor）可能 OP。**缓解**：缩放公式保守（`/5` `/0.01`）；标记 playtest 调；无尽本就是"看能多深"，一定 OP 可接受。
- **eternal_sand + corruption_ward 叠加**：腐化 -50%（圣物）×(1-15%×rank)（meta）可能让腐化系统失效。**缓解**：两者乘算叠加后仍非 0（rank5+eternal_sand = 1×0.5×0.25=12.5% 残留），且占用圣物槽 + meta 投入，合理 trade-off。
- **data.ts 共享并发**：顺序执行已避（§5）。
- **普通模式回归**：所有新内容 `G.endless && floor>=41` gate，普通模式 F1-40 零改动；现有 152 测应全绿。

## 7. Follow-ups

- 更多无尽装备/圣物（playtest 后按需求加）
- 转生 meta 升级扩（更多 endless 专属升级）
- 无尽 boss 专属技能（敌人技能系统已就位，boss 可配 skill）
- F60+ 软封顶（记忆标的无尽数值 hp 巨高，playtest 后定是否软封顶）
