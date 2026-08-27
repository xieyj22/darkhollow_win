# 批3B：Boss 专属模板 + 地图实体 sprite 化收尾 + 净化入 Clean 反馈

日期：2026-08-27 · 基线 commit：`92796be`（main，439 测绿）· 分支：`feat/batch3b-boss-sprites`

## 1. Context（现状）

审计（[[darkhollow-audit-2026-08-24]] 报告三 #1/#9）定性的最大单项视觉投资 + 批2 溢出两项 + 范围裁决（用户 08-27 拍板顺带商人 NPC）：

- **9 Boss 同剪影**：全部走唯一 `TEMPLATES.BOSS` 模板仅靠 def.c 换色（`drawBossSprite` [sprites.ts:1590](https://github.com/xieyj22/darkhollow_win/blob/92796be/src/sprites.ts#L1590)：`buildPalette(color)` 单色系），8 主线 Boss 互相同剪影，F20 `#9932cc` 与 F35 `#9400d3` 几乎同紫。调用点唯一：[render.ts:122](https://github.com/xieyj22/darkhollow_win/blob/92796be/src/render.ts#L122) `drawBossSprite(c, sx, sy+bob, ec)`（`ec = e.c`，相位只换 el 不换 c，色静态安全）。
- **8 事件站渲染为 C_POUCH 撞脸**：`EVENT_SITES`（[event-sites.ts:17](https://github.com/xieyj22/darkhollow_win/blob/92796be/src/event-sites.ts#L17)）定义了 ch=`⛧⚄⌂⚰♨ᛘ⊞◍`，但批2 ⑥ 后 items 循环（[render.ts:307-324](https://github.com/xieyj22/darkhollow_win/blob/92796be/src/render.ts#L307-L324)）对**所有** item（含 npc 实体）走 `drawItemSprite`→`pickItemTemplate`，无 glyph 回退分支；[game.ts:126](https://github.com/xieyj22/darkhollow_win/blob/92796be/src/game.ts#L126) 放置时不传 `spriteKind` → consumable 无 subType 路由进 `C_POUCH`——**8 个语义迥异的事件站全是同一个彩色小袋**（仅靠 item.c 换色+描边框底色区分）。
- **3 商人 NPC 同款撞脸**：`placeEntity`（[game.ts:107-112](https://github.com/xieyj22/darkhollow_win/blob/92796be/src/game.ts#L107-L112)）已留 `spriteKind?` 形参（batch2 ⑥ CHEST 先例）但商人调用未传 → 同样渲染为 C_POUCH；普通商与无尽商 item.c 同为 `#9b5de5`，连底色都不可分。
- **CHEST_PAL 死代码**：[sprites.ts:1487](https://github.com/xieyj22/darkhollow_win/blob/92796be/src/sprites.ts#L1487) 定义后无消费者（batch2 ⑥ 实际走 `buildPalette(item.c)` 单色路径）。
- **净化降入 clean 零反馈**：`applyCorruption`（combat.ts）`if (r.crossed && r.after !== 'clean')` —— 净化把腐化打回 clean 档时无消息/无浮字/无 recalc 提示（批2 ⑩ 只做了降档非 clean 的绿字分支）。

关键先例（本批全部复刻）：batch2 ⑥ 的 `item.spriteKind` 显式路由（`pickItemTemplate` spriteKind-wins 分支 [sprites.ts:1655](https://github.com/xieyj22/darkhollow_win/blob/92796be/src/sprites.ts#L1655)）；DOOR/PORTAL 的固定多色 palette 模式（`DOOR_PAL`/`PORTAL_PAL` + `getSprite(tpl, PAL, sig)`）；playtest#10 的模板 shape 测试守卫（`sprites.test.ts:9` 遍历 `Object.keys(TEMPLATES)` 全量 16×16）。

## 2. Proposed Changes

### T1 类型与路由（先行，其余任务的地基）

1. **types.ts**：`BossDef` 与 `EnemyDef` 加 `spriteKind?: string`（注释：unique-model 覆盖，缺省走类型/表路由）；`Enemy` 加 `spriteKind?: string`。
2. **enemy-factory.ts** `makeEnemy`：meta 拷贝行（:54 附近）加 `spriteKind: base.spriteKind`——无尽 F45+ 缩放 Boss 拷贝与召唤物自动继承。
3. **sprites.ts** `drawBossSprite` 签名扩为 `(c, x, y, color, spriteKind?)`：
   ```ts
   const sk = spriteKind && (TEMPLATES as Record<string, Template>)[spriteKind] ? spriteKind : null;
   const tpl = sk ? TEMPLATES[sk] : TEMPLATES.BOSS;
   const pal = sk && BOSS_PAL[sk] ? BOSS_PAL[sk] : buildPalette(color);
   const sig = sk || ('BOSS:' + color);
   blitOutlined(c, x, y, getSprite(tpl, pal, sig), sig, 2);   // thickness=2 保留
   ```
   老档（实例无 spriteKind）/查不到模板 → 现 BOSS 模板+buildPalette，零破坏。
4. **render.ts:122**：`drawBossSprite(c, sx, sy + bob, ec, e.spriteKind)`。
5. **ENTITY_PAL 机制**（收编 CHEST_PAL）：`const ENTITY_PAL: Record<string, Record<string, string>>`，键=spriteKind；`drawItemSprite`（:1704）改 `const pal = (item.spriteKind && ENTITY_PAL[item.spriteKind]) || buildPalette(item.c)`。首批键：`CHEST`（收编现 CHEST_PAL：木+金双色）+ T3 全部实体键。无 ENTITY_PAL 键的 spriteKind（未来物品）仍走 buildPalette——机制向后兼容。

### T2 九个 Boss 专属模板（`B_*`）

`TEMPLATES` 加 9 个 16×16 模板 + `BOSS_PAL: Record<string, Record<string,string>>` 每模板固定多色 palette（2-3 色锚点，字母自选照 DOOR_PAL 模式）；`data.ts` BOSSES 9 条各加 `spriteKind`。剪影意图（画稿锚点，行级像素由 implementer 按 playtest#10 教训：意图+结构参考+全样例 BAT 在案）：

| spriteKind | Boss | 剪影锚点 | 色彩锚点 |
|---|---|---|---|
| B_GOBLIN_KING | 哥布林王 F5 | 歪冠+尖耳+弯刀，比 GOBLIN 模板宽壮 | 绿皮+金冠 |
| B_SPIDER_QUEEN | 蜘蛛女王 F10 | 宽腹+8 腿展开+尾部卵袋 | 紫身+白卵囊 |
| B_VAMPIRE_LORD | 吸血鬼领主 F15 | 高领披风+獠牙+瘦削人形 | 黑袍+红内衬/红眼 |
| B_ELDER_LICH | 远古巫妖 F20 | 骷髅头+长杖+曳地长袍（与 CASTER 区分：骨感+杖） | 紫袍+绿火眼窝 |
| B_DRAGON_EMPEROR | 龙皇 F25 | 双翼收拢+角冠+长尾（与 DRAGON 区分：冠+体量） | 橙鳞+金角金冠 |
| B_LEVIATHAN | 利维坦 F30 | S 形蛇形长体+背鳍+巨口 | 青蓝+白腹 |
| B_VOID_SOVEREIGN | 虚空君主 F35 | 撕裂轮廓人形+悬浮断冠+周身裂缝 | 暗紫体+品红裂纹 |
| B_CREATOR | 创世者 F40 | 头顶光环+几何对称圣袍+无面 | 纯白袍+金环 |
| B_MYCONID | 菌主 F0 | 蘑菇冠盖+粗短干体+足部菌根 | 菌紫+荧光青斑点 |

保持不动：thickness=2 描边、金 aura（render.ts:110）、金血条、深红底——专属剪影是叠加层不是替换。F20/F35 撞紫由剪影差异消解（palette 仍各有主色）。

### T3 八事件站 + 三商人（`ES_*` / `MERCHANT*`）

- **event-sites.ts**：`EventSiteDef` 加 `spriteKind: string`（required）；两祭坛共享剪影——`TEMPLATES.ES_ALTAR_GAMBLER = TEMPLATES.ES_ALTAR_CURSED`（同数组引用别名，shape 守卫双键都过），palette 分红系/金橙系两键。`game.ts` 放置行（:126）push 时透传 `spriteKind: s.spriteKind`。
- 7 个新模板：`ES_ALTAR_CURSED`（祭坛）、`ES_HOUSE`（受困居所）、`ES_COFFIN`（石棺）、`ES_POOL`（血泊）、`ES_STELE`（石碑）、`ES_SEALED`（封印匣）、`ES_WELL`（献祭井）。
- **商人**：1 个 `MERCHANT` 模板（兜帽斗篷+背囊+货担）+2 个别名键 `MERCHANT_TREASURE`/`MERCHANT_ENDLESS`（同引用）；`ENTITY_PAL` 三键三 palette：普通紫袍 / 宝物金饰 / 虚空紫黑+品红点缀。`game.ts` 三处 `placeEntity` 调用传 spriteKind（形参已在）。无尽商 `item.c` 不动（ENTITY_PAL 键已区分，c 只留给描边框底色）。
- NPC 描边框背景（render.ts:311-314）保留——sprite 化不撤实体标记。

### T4 净化入 Clean 反馈（combat.ts，独立小任务）

`applyCorruption` 的 tier 反馈拆三路：

```ts
if (r.crossed && r.after === 'clean') {
  addMsg(t('cb.tierClean'), 'md');
  flt(p.x, p.y, tx(TIER_LABEL.clean).toUpperCase(), '#80ed99');
  fxAura(p.x, p.y, '#80ed99', 1.4);
  recalc();
} else if (r.crossed) { /* 现两分支不动：升档紫+shake / 降档绿字 */ }
```

i18n 加 1 键（照 `cb.tierCleansed` 风格带 🟢 前缀）：`'cb.tierClean': { en: '🟢 Your mind clears — corruption fully purged.', zh: '🟢 腐化尽散，神志清明。' }`。`queueMechanicIntro('corruption')` 不挂此路（只在升腐化档触发，现状保持）。fxAura combat.ts 已 import（批2 ⑧）。

## 3. Testing & Validation

- **vitest（439 → 预计 ~447）**：
  - `sprites.test.ts` shape 守卫自动覆盖全部新键+别名键（16×16 逐行）。
  - `batch2-sprites.test.ts` 扩：① `BOSSES` 9 条 def 全有 spriteKind 且 ∈ TEMPLATES 且 ∈ BOSS_PAL（real-data 硬门，防未来加 Boss 漏配）② `EVENT_SITES` 8 条同门（∈ TEMPLATES 且 ∈ ENTITY_PAL）③ 商人三 spriteKind ∈ ENTITY_PAL ④ 别名键同引用断言（ES_ALTAR_GAMBLER === ES_ALTAR_CURSED）。
  - makeEnemy 测试文件加 spriteKind 拷贝断言。
  - tier 反馈测试（batch2-polish / fx-wiring 所在文件）加 clean 入档分支：corruption 从 touched 档净化入 clean → cb.tierClean 消息+flt+无 shake。
- **门禁**：tsc 0 + `npm run build` + smoke 65（settings 面板零涉及，应零回归）。
- **游戏内 e2e**（`scripts/verify_batch3b_ingame.py`，沿用批2/3A live-module 法：dev server + `import('/src/state.ts')` 同实例注入）：
  1. 逐个把 9 Boss 放玩家旁截图，PIL 两两像素差异判据（9×8/2=36 对全非同图——坐实"不再同剪影"）；
  2. 事件站/商人实体放置后截图断言 sprite 渲染（非字符路径）+ CHEST 多色化后仍渲染；
  3. 注入 corruption=25 → `applyCorruption(-30)` → 断言 clean 消息入日志 + 无 console error。
- **视觉验收**：截图矩阵人工目检一次（9 Boss 大图），余靠 PIL 判据。

## 4. Parallelization

subagent-driven，顺序执行（T2/T3 同改 `sprites.ts` TEMPLATES，并行必撞——[[subagent-parallel-gotchas]]，batch1 图标批同款单 implementer 串行先例）：

| 任务 | 内容 | 文件域 | 可并行？ |
|---|---|---|---|
| T1 | 类型+路由+ENTITY_PAL 骨架+CHEST_PAL 收编 | types/enemy-factory/sprites(路由段)/render | 先行 |
| T2 | 9 Boss 模板+BOSS_PAL+data.ts 九条 | sprites(TEMPLATES)/data.ts | T1 后，串行 |
| T3 | 7+1 实体模板+ENTITY_PAL 键+game.ts 透传 | sprites(TEMPLATES)/event-sites/game.ts | T2 后，串行 |
| T4 | 净化 clean 反馈 | combat.ts/i18n.ts | 可与 T2 并行（文件不叠） |
| T5 | e2e 脚本+全量验证 | scripts/ | 最后 |

每任务 implementer+reviewer；final opus whole-branch review；分支 `feat/batch3b-boss-sprites`。

## 5. Risks & Mitigations

- **老档兼容**：Boss——老存档敌人实例无 spriteKind → fallback 现 BOSS 模板+buildPalette，零破坏。事件站/商人——老档实体无 spriteKind 时渲染 C_POUCH，但这**就是现状行为**（本批前人人如此），无回归；新放置即得新模板。不迁移。
- **sprite 缓存键**：boss sig 现为 `'BOSS:'+color`——改为 spriteKind 键后旧 sig 不再生成，缓存 Map 无泄漏（getSprite 按 sig 复用，新键集合有限：9+1）。
- **模板质量**：16×16 手绘 17 个新剪影是主要风险——playtest#10 三件套防御（意图锚点表+1 全样例+shape 守卫），视觉验收截图矩阵兜底；implementer 串行保风格统一（batch1 icons 教训）。
- **别名键与 shape 守卫**：`TEMPLATES.X = TEMPLATES.Y` 同引用——`Object.keys` 双键各自过守卫，无重复数组内存，无测试盲区。

## 6. Follow-ups（本批不做）

- Minimap 的 Boss/实体标记色仍单色点——sprite 化地图层不影响 minimap，留批3C 顺带评估。
- 商人之外的 NPC 类实体（无）——地图实体层经本批后全 sprite 化清零，后续新实体默认走 spriteKind。
- `ch` 字段全库保留（弹窗/日志 fallback），不清理。
