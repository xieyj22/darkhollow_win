# 批3C：emoji 全量 sprite 化（天赋/成就/Forge/HUD buff 行）

日期：2026-08-27 · 基线 commit：`f401f47`（main，448 测绿）· 分支：`feat/batch3c-emoji-sprites`（从 main 拉）

## 1. Context（现状）

审计（[[darkhollow-audit-2026-08-24]] 图标机会）定性的最后一大块 emoji 残留。用户 08-27 拍板范围=**核心三面板 + HUD buff 行**（杂散 emoji 如 🐌/💀 价签留批外）。

- **144 个 def 带 emoji icon**：`TALENT_TREES` 86 个 `TalentNode`（[types.ts:644](https://github.com/xieyj22/darkhollow_win/blob/f401f47/src/types.ts#L644)）/ `ACH_DEFS` 31 个 `AchievementDef`（[types.ts:548](https://github.com/xieyj22/darkhollow_win/blob/f401f47/src/types.ts#L548)）/ `META_UPGRADES` 27 个 `MetaUpgradeDef`（[types.ts:364](https://github.com/xieyj22/darkhollow_win/blob/f401f47/src/types.ts#L364)），字段 `icon: string` 全是单 emoji 字符。
- **渲染点仅 3 处**，全是 emoji 直插 innerHTML：成就列表 [panels.ts:299](https://github.com/xieyj22/darkhollow_win/blob/f401f47/src/panels.ts#L299) `<span class="aic">${a.icon}</span>`、天赋格 [panels.ts:362](https://github.com/xieyj22/darkhollow_win/blob/f401f47/src/panels.ts#L362) `<div class="tc-icon">${node.icon}</div>`、Forge 行 [meta.ts:361](https://github.com/xieyj22/darkhollow_win/blob/f401f47/src/meta.ts#L361) `<div class="fu-icon">${def.icon}</div>`。
- **HUD buff 行纯文字**：[render.ts:470-478](https://github.com/xieyj22/darkhollow_win/blob/f401f47/src/render.ts#L470-L478) `textContent = name(Nt)+V`，`Buff`（types.ts:334，name/type/value/turns）实际 type 值 ~18 种（str_buff/def_buff/shield/maxhp/crit/dodge/dodge_next/heal_bonus/gold/food/torch/invis/mapping + el_res_fire·ice·holy + el_dmg_shadow·ice·holy·fire + slow）。
- **现成先例全部可复刻**：`paintIcon(target, kind, color)`（[sprites.ts:2108](https://github.com/xieyj22/darkhollow_win/blob/f401f47/src/sprites.ts#L2108)，kind=TEMPLATES 键，palette 现为 STAIR_PAL/PLAYER_PAL 特例 + `buildPalette(color)` 兜底）；codex/legend 的 `<canvas class="lic" data-kind data-color>` + innerHTML 后 `querySelectorAll('canvas.lic').forEach(paintIcon)` 接线（[ui-panels.ts:66-68](https://github.com/xieyj22/darkhollow_win/blob/f401f47/src/ui-panels.ts#L66-L68)）；批3B 的 ENTITY_PAL 固定多色 palette 机制。
- `T_` 前缀在 TEMPLATES 零占用（已 grep 核实），本批主题模板专用。

## 2. Proposed Changes

### 方案（用户已批）：主题模板 + def 级换色

~20 个 `T_*` 16×16 语义主题模板覆盖三表，同主题共享剪影、每个 def 独立 `hue` 换色（敌人 tag 路由 + 商人三 palette 的合成先例）。拒绝 B（每表 1-4 模板同脸）与 C（144 全独绘）。

### T1 类型 + 主题模板骨架 + palette 路由

1. **types.ts**：三接口各加 `tpl?: string; hue?: string`（注释：T_ 主题模板键；hue 缺省走表默认色）。`icon` emoji 保留（文本语境回退，3B `ch` 惯例）。
2. **sprites.ts**：
   - 新增 `THEME_PAL: Record<string, Record<string, string>>`（照 BOSS_PAL/ENTITY_PAL 形态）——多色主题（火/冰/圣 等元素系）的固定 palette；单色主题不进表，走 buildPalette。
   - **`iconPalette(kind, color)` 导出纯函数**：`THEME_PAL[kind] || buildPalette(color)`，`paintIcon` 改调它（替现有 STAIR/PLAYER 特例为查 `THEME_PAL`+保留 PLAYER 特判——STAIR_PAL/PLAYER_PAL 迁进 THEME_PAL 键位，行为等价）。纯函数可单测（happy-dom 无 canvas2d，canvas 路径测不了）。
   - 主题模板初版 ~20 键（implementer 按三表语义盘点后可 ±3）：T_SWORD 剑 / T_SHIELD 盾 / T_HEART 心 / T_STAR 星 / T_COIN 币 / T_BOOK 书 / T_MEAT 肉 / T_EYE 眼 / T_RUNE 符文 / T_FIRE 火 / T_ICE 冰 / T_HOLY 圣光 / T_SHADOW 暗 / T_SKULL 颅 / T_WING 翼 / T_BOOT 靴 / T_STAFF 杖 / T_CROWN 冠 / T_FLASK 瓶 / T_TROPHY 杯。元素系（FIRE/ICE/HOLY/SHADOW）配 THEME_PAL 多色，其余单色。
3. **表默认 hue**：TALENT 默认 `#c9a227`（金）、ACH 默认 `#8a5de5`（紫）、META 默认 `#4ad6c0`（青）——数据侧常量，接线时用。

### T2 天赋 86 行数据 + 天赋格接线

- data.ts TALENT_TREES 86 个 node 逐个配 `tpl`（按效果语义：攻击系→T_SWORD、防御系→T_SHIELD、火法→T_FIRE……）+ 大多数配独立 `hue`（同主题 4-5 个天赋靠色区分；职业树主色调倾向：战士暖/盗贼绿/法师蓝/圣骑金白，implementer 可微调）。
- panels.ts:362 天赋格：`${node.icon}` → `<canvas class="lic tc-ic" width="16" height="16" data-kind="${node.tpl}" data-color="${node.hue || TALENT_DEFAULT}"></canvas>`，renderTalentPanel 的 innerHTML 赋值后加 paint 循环（照 ui-panels.ts:68）。`.tc-icon` CSS 适配 canvas 尺寸（保持格子布局不塌）。

### T3 成就 31 + Forge 27 数据 + 两处接线

- ACH_DEFS 31 条配 tpl+hue（击杀系→T_SWORD/T_SKULL、Boss 系→T_TROPHY/T_CROWN、层数系→T_BOOT、无尽系→T_SHADOW…）；panels.ts:299 同 T2 法接线（aic → canvas.lic）。
- META_UPGRADES 27 条配 tpl+hue（stats 系→T_HEART/T_SWORD/T_SHIELD…按既有 icon 语义就近迁移：❤→T_HEART、💧→T_FLASK、⚔→T_SWORD）；meta.ts:361 `fu-icon` 接线 + renderForgeContent innerHTML 后 paint 循环。
- Forge 分类 tab 不动；`💀` 价签 emoji **留**（批外语散项）。

### T4 HUD buff 行

- sprites.ts 或 render.ts 内 `BUFF_TPL: Record<string, { kind: string; color: string }>`：~18 type 全映射（str_buff→T_SWORD 红、def_buff→T_SHIELD 蓝、shield→T_SHIELD 银白、crit→T_SWORD 橙、dodge→T_BOOT 绿、heal_bonus→T_HEART 绿、maxhp→T_HEART 红、gold→T_COIN 金、food→T_MEAT 棕、torch→T_FIRE 橙、invis→T_SHADOW 灰紫、mapping→T_EYE 青、el_res_*/el_dmg_* 四元素→T_FIRE/T_ICE/T_HOLY/T_SHADOW 各自色、slow→T_ICE 蓝紫）；未知 type 兜底 T_RUNE 灰。
- render.ts:470-478 buff 行：每个 buff 行首插 16×16 canvas（class `lic buff-ic`，data-kind/color 从 BUFF_TPL 查）+ 文字 `name(Nt)+V` 保留（回合数/数值信息不动）；innerHTML 重构后 paint。poisonTurns/slowed 两个特控行同法（🐌 文字 emoji 顺带被 sprite 替换——属于本行内容不算批外）。

### T5 e2e + 全量验证

`scripts/verify_batch3c_ingame.py`（克隆批3B harness：dev server + live-module 注入 + PIL）：
1. 三面板逐个打开（天赋/成就/Forge），断言 canvas.lic 全部非空像素（sprite 真渲染）+ 同主题不同 hue 的样例对像素相异；
2. 注入 str_buff+torch buff，断言 buff 行出现 sprite 且与纯文字基线不同；
3. emoji 残留门：三面板 innerHTML 不再含原 emoji 字符（抽样天赋/成就/Forge 各 3）；
4. 0 console error（favicon 白名单惯例）。
全量门：tsc 0 / vitest 全绿 / build / smoke 65 / 手柄 e2e 22 / 批3B e2e 18（回归）。视觉矩阵：三面板 + buff 行截图供用户目检。

## 3. Testing & Validation

- **vitest（448 → 预计 ~455）**：
  - real-data 门 ×3：三表全量 def 的 `tpl`（缺省视为违规——本批数据配齐后应 100% 有 tpl 且 ∈ TEMPLATES；新 def 未来漏配会被门拦）；tpl 使用集 ∩ THEME_PAL 键一致性（多色键必须存在）。
  - `BUFF_TPL` 门：每个 value.kind ∈ TEMPLATES。
  - `iconPalette` 单测：THEME_PAL 键命中/未命中走 buildPalette/PLAYER 特判保持。
  - sprites.test.ts shape 守卫自动覆盖全部 T_* 新键。
- **门禁**：tsc 0 + build + smoke 65（settings/面板布局微动，CSS 适配须保 smoke 断言过）。
- **游戏内 e2e** 如 T5。

## 4. Parallelization

subagent-driven 串行（T2/T3 同改 data.ts，T4 渲染层相邻，T5 最后）：

| 任务 | 文件域 | 备注 |
|---|---|---|
| T1 | types/sprites(T_* 模板+THEME_PAL+iconPalette) | 地基 |
| T2 | data.ts(天赋 86)+panels.ts(天赋格)+CSS | T1 后串行 |
| T3 | data.ts(成就31+Forge27)+panels.ts(成就)+meta.ts | T2 后串行 |
| T4 | render.ts+BUFF_TPL | T3 后 |
| T5 | scripts/ + 全量门 | 最后 |

每任务 implementer+reviewer；final opus whole-branch review。模板绘制集中在 T1 单 implementer 保风格统一（batch1 icons 教训）；T2/T3 数据行分配是表格工作但需语义判断，各自独立 review。

## 5. Risks & Mitigations

- **同主题同剪影**（86 天赋 ~20 主题≈4-5 个/主题）：hue 逐 def 分配消解 + 面板语境（名称/描述常驻）——商人三 palette 先例的可接受折中；用户已批方案 A。
- **paintIcon palette 特例迁移等价性**：STAIR_PAL/PLAYER_PAL 迁 THEME_PAL 须行为逐字节等价（legend/help 消费者回归）——iconPalette 单测 + smoke 65 锁定。
- **86+58 行数据分配错误**（tpl 配错语义/hue 撞色）：real-data 门拦结构错；语义错靠 review + 用户目检矩阵。
- **buff 行每回合重绘 canvas**：getSprite 有 sig 缓存，16×16 drawImage 一次成本可忽略（legend 同模式常驻）。
- **CSS 布局塌陷**（emoji 是字体宽、canvas 是盒宽）：.tc-icon/.aic/.fu-icon 三处 CSS 适配 + smoke 断言。

## 6. Follow-ups（本批不做）

- 杂散 emoji 清扫：蜗牛行外残留（Forge 💀 价签、标题 📋 按钮、keys ⌨ 头、成就弹窗若有）——独立小批。
- tooltip hover 预览 sprite（现纯文字）。
- 主题模板不足时未来追加 `T_*` 键即插即用（机制向后兼容：无 THEME_PAL 键走 buildPalette）。
