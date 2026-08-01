# Polish-B: Q6 (split big files) + Q3 (i18n sweep) — Design Spec

Brainstorm design spec.对应 `darkhollow`. 本规格是 Polish-B 技术债重构的对照基准。

提交基准:`058d680`(#9 Phase 3 合并后的 main HEAD)。

---

## Goal

把三个过大的源文件拆成聚焦模块(Q6),并把 241 处 inline `lang === 'zh' ? … : …` 收敛到 `t()`(Q3)。**零行为变更** —— 纯搬迁 + import 修整 + i18n 键化;既有调用点(public 导出签名)保持稳定。memory 长期建议"先补测试再拆",本规格对**有纯函数的 items.ts** 先写 characterization 测,input/main(DOM 重)靠 typecheck+build+冒烟。

## Context

- 当前大文件:`src/input.ts`(595 行)/ `src/items.ts`(629)/ `src/main.ts`(606)。无直接单测(input/main 是 DOM;items 的纯函数未测)。
- `t(key)`(`src/i18n.js`):查 `L` 表;inline `lang===` 散落各处(input/items/main/combat/render 等共 ~241 处)。
- 既有 132 测全绿;重构后须仍 132+(items characterization 测会新增)。

---

## Design

### 1. 拆分目标(Q6)

| 原文件 | → 新模块(搬迁的函数)| 留在原文件 |
|---|---|---|
| **items.ts** | **`item-gen.ts`**:genItem / isGear / isConsumable / genWeapon / genArmor / genAcc / genPotion / genScroll / genFood / genConsumable(纯生成,~140 行)| useItem / useFood / equip* / quickslot* / drop/sell / itemScore / isBetter / isEquipUpgrade / handleAutoEquip / addItemWithOverflow(运行时)|
| **input.ts** | **`panels.ts`**:inventory/help/skill/ach/talent 五面板的 open/close/render(openInventory/closeInventory/mkInvBtn/renderInv/openInventorySell · openHelp/closeHelp/renderHelp · tryCastSkill/openSkillPanel/closeSkillPanel/renderSkillPanel/await_getClasses · openAchievements/closeAchievements/renderAch · openTalentPanel/closeTalentPanel/renderTalentPanel)| initInput / closeActiveOverlay / pollGamepad / initTouchControls(读入)|
| **main.ts** | **`ui-settings.ts`**:adjustZoom/applyZoom · adjustSafe/applySafe · applyReducedMotion/toggleReducedMotion · minimapZoom · toggleLang/updateLangUI · toggleSound/updateSoundBtn/applyAudioUI<br>**`ui-panels.ts`**:toggleLegend/renderLegend · toggleObjective · toggleKeys/renderKeyHints · initTooltip · showOverlay/hideOverlay · openPause/closePause · renderRecords/renderCodex | initTitleParticles · startNewGame · showCharSelect · returnToTitle · bindButtons · window-load |

**搬迁规则**:纯函数体逐字移动,不改逻辑;每个新模块 `import` 它需要的依赖;原文件/调用点改 `import` 来源。**public 导出签名不变**(genItem/initInput/useItem/showOverlay 等仍同名同签名),故 combat/player/main 等调用点只需改 import 路径(或经 re-export 保持)。
- **避环**:新模块单向依赖(panels→items/skills/meta;item-gen→data;ui-panels/ui-settings→state/render/i18n)。impl 时 typecheck 抓循环 import。

### 2. 测试策略

- **items.ts(先测再拆)**:characterization 测锁定纯函数行为 —— `itemScore` / `isBetter` / `isEquipUpgrade`(装备决策,纯+确定)+ `gen*`(mock `rng` 后测,同 makeEnemy-real-data 模式)。这些测在拆分**前**写、**拆分后仍绿**即证行为不变。新增 `src/__tests__/items.test.ts`。
- **input.ts / main.ts**:DOM 重,搬迁本质=改 import,**不补单测**;靠 `npm run typecheck`(抓 import 断/环)+ `npm run build` + 手动冒烟(各面板开关、设置滑块、语言切换)兜底。
- **每阶段**:`npx vitest run`(132+绿)+ typecheck + build 必过才进下一阶段。

### 3. Q3(i18n 扫清,放最后)
- 把所有 `lang === 'zh' ? A : B` inline 替换为 `t('key')`,键加进 `i18n.ts` 的 `L` 表(没有就新增)。动态字符串(含变量插值)用 `tMsg(key, ...args)`。
- ~241 处,机械量大、低逻辑风险;**Q6 拆完后扫**(避免拆分/Q3 两遍混)。
- 完成判据:grep `lang === 'zh'` 在 src/ 接近 0(允许极少数真正动态、不便键化的遗留,但须注释说明)。

### 4. 分阶段顺序(每阶段独立可验)

- **Phase A — items.ts 拆分**:写 items characterization 测 → 拆 item-gen.ts → 测仍绿 + typecheck/build。
- **Phase B — input.ts 拆分**:拆 panels.ts → typecheck/build/冒烟。
- **Phase C — main.ts 拆分**:拆 ui-settings.ts + ui-panels.ts → typecheck/build/冒烟。
- **Phase D — Q3**:扫 lang===→t() → 全测 + build + grep 硬门。

---

## Non-goals

- **不改任何函数的逻辑/行为**(纯搬迁 + 键化);不顺手重构函数体。
- 不改 public API 签名(导出名/参数);不重命名既有导出。
- 不引入新依赖;不改 vite/ts 配置(除必要 path)。
- 不做 Polish-B 以外的事(不碰 Q6/Q3 之外的 follow-up)。

---

## Testing and validation

- 每阶段:`npx vitest run`(全绿,Phase A 后 +items 测)+ `npm run typecheck` + `npm run build` 必过。
- Phase D 收尾:grep `lang === 'zh'` src/ ≈ 0(硬门);手动冒烟全面板/设置/语言。
- 最终:全测绿 + build clean → 可 push。
