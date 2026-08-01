# Playtest #9 Phase 2 — 多结局 (Endings at the Creator) — Design Spec

Brainstorm design spec.对应 `darkhollow`. #9 Phase 2(Phase 1 腐化度之后;Phase 3 遗志将单独开)。本规格是 Phase 2 实现与验收的对照基准。

提交基准:`0023f8f`(Phase 1 合并后的 main HEAD)。

---

## Goal

在创世者(F40,普通模式)击杀时,把当前的"直接胜利屏"换成一个**抉择**:玩家选 **Slay(击碎封印)** 或 **Refuse(承担守护)**;**Refuse 仅在 `corruption < 50` 时可选**,高腐化被迫 Slay。抉择 + 腐化共同决定 3 个结局之一(悲壮英雄 / 末日使者 / 守誓者),并记录为成就。让 Phase 1 的腐化机制真正影响结局走向。

## Context (current state, 本规格改动)

- [`playerVictory()` combat.ts](src/combat.ts):F40 普通模式击杀创世者时调用(`grantKillRewards` 内 `if (G.floor===FINAL && !G.branchMode && !G.endless)`)。当前:设 gameOver/won → 消息/音效 → `checkAch('win'/'creator_kill')` → 算 echoes/记 run 统计 → 显示 `#victory-screen`(`#vic-stats` + `#vic-echoes`)→ 删存档。无尽模式 F40 不触发(Wave 6d)。
- `checkAch(id)` (combat.ts) 持久化到 `MetaSave.achievements` + Steam 桥;新结局**复用成就系统**记录(不新增 MetaSave 字段)。
- `ACH_DEFS`(data.ts):成就定义;新增 3 个结局成就。
- `index.html`:有 `#victory-screen`、`#vic-stats`、`#vic-echoes`;新增 `#ending-choice` 抉择 overlay + 胜利屏的 `#vic-ending` 区。

---

## Design

### 1. 新模块 `src/endings.ts`(纯数据 + 判定,可单测)

```ts
export type EndingId = 'pyrrhic' | 'doombringer' | 'guardian';
export type CreatorChoice = 'slay' | 'refuse';
export const REFUSE_CORRUPTION_THRESHOLD = 50; // Refuse 仅 corruption < 50 可选

export interface EndingDef { id: EndingId; ach: string; title: I18nText; body: I18nText; }
export const ENDINGS: Record<EndingId, EndingDef> = {
  pyrrhic:    { id:'pyrrhic',    ach:'end_pyrrhic', title:{en:'Pyrrhic Victor',zh:'悲壮英雄'}, body:{en:'The Creator thanks you as they fall. The seal shatters — and through the crack, the true abyss begins to seep. You did your duty. You also ended the world.',zh:'创世者在倒下时向你致谢。封印碎裂——真深渊从裂隙中渗出。你完成了使命,也终结了世界。'} },
  doombringer:{ id:'doombringer',ach:'end_doom',    title:{en:'Doombringer',    zh:'末日使者'}, body:{en:'It was not your hand that moved — it was the abyss moving through you. The seal breaks, the real abyss pours forth, and you stand at its vanguard: the doombringer it shaped you to be.',zh:'动手的不是你,是深渊借你的手。封印崩塌,真深渊奔涌而出,你站在它最前——它把你塑造成的末日使者。'} },
  guardian:   { id:'guardian',   ach:'end_guardian',title:{en:'The Guardian',   zh:'守誓者'},   body:{en:'You lower your blade. You will not be the one to break the seal. You take the Creator\'s place at the heart of the wound, and bear the thousand-year burden they finally lay down.',zh:'你放下剑。你不会是击碎封印的那个人。你走到伤口的心脏,接过创世者的位置,担起 Ta 终于卸下的千年重负。'} },
};

// 抉择 + 腐化 → 结局。Refuse 永远 → guardian;Slay 按腐化分 pyrrhic(<50)/doombringer(>=50)。
export function endingForChoice(choice: CreatorChoice, corruption: number): EndingId {
  if (choice === 'refuse') return 'guardian';
  return corruption >= REFUSE_CORRUPTION_THRESHOLD ? 'doombringer' : 'pyrrhic';
}
export function canRefuse(corruption: number): boolean { return corruption < REFUSE_CORRUPTION_THRESHOLD; }
```
(结局 body 双语文本取自 lore:创世者求死 / 封印碎真深渊涌出 / 守誓者接过封印之心。impl 阶段写全。)

### 2. 创世者抉择流程(combat.ts `playerVictory` + 新 `resolveEnding`)

- **`playerVictory`**:保留现有(gameOver/won、消息/音效、`checkAch('win'/'creator_kill')`、echoes/统计/recordRun)。**改为**:统计记录后**不直接显示胜利屏**,而是**呈现抉择** —— 显示 `#ending-choice` overlay:标题"创世者倒下了",文案"Ta 渴望解脱。你将……",两按钮 `[1] 击碎封印(Slay)` / `[2] 拒绝,承担守护(Refuse)`;若 `!canRefuse(p.corruption)`,Refuse 按钮 `disabled` + 文案提示"你已被深渊侵蚀太深,无法抗拒"。
- **`resolveEnding(choice)`**(combat.ts 导出,main.ts 绑定按钮调用):
  1. 隐藏 `#ending-choice`。
  2. `const id = endingForChoice(choice, p.corruption); const e = ENDINGS[id];`
  3. `checkAch(e.ach);`(记录结局成就 + Steam)。
  4. 显示 `#victory-screen`,在 `#vic-ending` 区写入 `e.title` + `e.body`(双语,按 lang);`#vic-stats`/`#vic-echoes` 保留现有内容。
  5. 删存档(`localStorage.removeItem('dh_save')`)。
- 抉择按钮在 main.ts `bindButtons` 绑定:`#btn-ending-slay` → `resolveEnding('slay')`;`#btn-ending-refuse` → `resolveEnding('refuse')`(从 combat.js 导入)。

### 3. UI(index.html)

- 新增 `#ending-choice` overlay(同 records/codex overlay 结构:panel + close-btn 隐藏不用 + 标题 + 文案 + 两按钮 `#btn-ending-slay` / `#btn-ending-refuse`)。
- `#victory-screen` 内新增 `<div id="vic-ending"></div>`(结局标题 + 正文)。

### 4. 成就(data.ts `ACH_DEFS`)

```ts
{ id:'end_pyrrhic', icon:'🏆', n:{en:'Pyrrhic Victor',zh:'悲壮英雄'}, d:{en:'Slay the Creator (low corruption)',zh:'击杀创世者(低腐化)'} },
{ id:'end_doom',    icon:'💀', n:{en:'Doombringer',   zh:'末日使者'}, d:{en:'Slay the Creator while deeply corrupted',zh:'高腐化下击杀创世者'} },
{ id:'end_guardian',icon:'🛡', n:{en:'The Guardian',  zh:'守誓者'},   d:{en:'Refuse to slay the Creator',zh:'拒绝击杀创世者'} },
```

---

## Non-goals (Phase 2)

- **只在创世者(F40)有抉择**;不做 boss 放生 / 神殿道德抉择(留后续)。
- **不做 Phase 3 遗志**(失败/结局 run 持久化为 ghost)—— 结局只通过成就记录到 meta,不生成 ghost/遗物。
- 不改战斗/腐化数值;不改无尽模式(F40 不触发)。
- 不新增 MetaSave 字段(复用 achievements 记结局)。

---

## Testing and validation

- `npm run typecheck` + `npm run build` 必过。
- **可单测**:`src/__tests__/endings.test.ts` —— `endingForChoice('slay', 0/49)→pyrrhic`、`('slay', 50/99)→doombringer`、`('refuse', *)→guardian`;`canRefuse(49)→true`、`canRefuse(50)→false`。纯函数。
- 抉择流程 + UI:typecheck + build + playtest(F40 击杀创世者 → 抉择弹窗;低腐化可 Refuse;高腐化 Refuse 灰;各结局屏文本 + 成就弹)。
- **回归**:无尽模式 F40 击杀仍不触发抉择;Phase 1 腐化累积/守渊人死不受影响。
