# Playtest #9 Phase 3 — 守渊人转化 (Warden Legacy) — Design Spec

Brainstorm design spec.对应 `darkhollow`. #9 Phase 3(arc 收尾;Phase 1 腐化度 + Phase 2 多结局之后)。本规格是 Phase 3 实现与验收的对照基准。

提交基准:`957781d`(Phase 2 合并后的 main HEAD)。

---

## Goal

让 Phase 1 的"100 腐化 → 化作守渊人"真正兑现:**100 腐化死的下探者被记录为一条 WardenLegacy**;未来 run 的 `spawnWarden` 随机抽一条,把守渊人的名字改成"**守渊人 · 前<下探者>**"—— 你正在和一个曾经的自己作战。击杀这种"前任你"的守渊人解锁"弑前"成就。把 Phase 1(守渊人死)→ Phase 3(你成了它)→ 未来 run 的守渊人 串成闭环。

## Context (current state, 本规格改动)

- [`wardenDeath()` combat.ts](src/combat.ts):Phase 1 的 100 腐化终结;在此**记录 legacy**。
- [`spawnWarden()` enemies.ts](src/enemies.ts):Phase 1 的随机冷却召唤;在此**用 legacy 改名**。
- [`grantKillRewards()` combat.ts](src/combat.ts):Phase 1 的 warden 击杀分支;在此**判 self-slayer 成就**。
- [`MetaSave` types.ts](src/types.ts):加 `wardens: WardenLegacy[]`。
- `getMeta`/`initMeta`(meta.ts):wardens 迁移 + `recordWardenLegacy`。

---

## Design

### 1. 数据(types.ts + meta.ts)

```ts
// types.ts
export interface WardenLegacy { name: string; cls: number; race: number; floor: number; ts: number; }
// MetaSave 加: wardens: WardenLegacy[];
// Enemy 加: legacyWarden?: boolean;  // 该守渊人是一个"前任下探者"(运行时,楼层敌不跨层)
```
`meta.ts`:`initMeta` 加 `wardens: []`;`getMeta` 迁移 `if (!m.wardens) m.wardens = [];`;新增
```ts
export function recordWardenLegacy(name: string, cls: number, race: number, floor: number): void {
  const m = getMeta();
  m.wardens.unshift({ name, cls, race, floor, ts: Date.now() });
  if (m.wardens.length > 10) m.wardens.length = 10; // 封顶 10(最新在前)
  saveMeta(m);
}
```

### 2. 转化(combat.ts `wardenDeath`)
Phase 1 的 `wardenDeath()` 触发时(100 腐化),**记录 legacy**:
```ts
function wardenDeath(): void {
  if (!G) return;
  const p = G.player;
  const nm = (lang === 'zh' ? p.raceName + p.clsName : p.raceName + ' ' + p.clsName);
  recordWardenLegacy(nm, p.ci, p.ri, G.floor);
  addMsg(lang === 'zh' ? '你不复是你……你加入了守渊人的行列,将在未来阻挡后来的下探者。' : 'You are no longer you... you join the Wardens, and will hunt future Descenders.', 'md');
  playerDeath(lang === 'zh' ? '化作守渊人' : 'became the Warden');
}
```
**仅 100 腐化死转化**;普通战死/结局不转化。

### 3. 未来 run 的守渊人 = 前任你(enemies.ts `spawnWarden`)
Phase 1 的 spawnWarden 里,name 改为:
```ts
import { getMeta } from './meta.js';
// ...
const wardens = getMeta().wardens;
let name = lang === 'zh' ? '守渊人' : 'The Warden';
let legacyWarden = false;
if (wardens.length) {
  const leg = wardens[Math.floor(Math.random() * wardens.length)];
  name = lang === 'zh' ? `守渊人 · 前${leg.name}` : `The Warden — formerly ${leg.name}`;
  legacyWarden = true;
}
// push enemy with: name, ..., legacyWarden,
```
(无 legacy 时原名 + legacyWarden false = Phase 1 行为。击杀仍走 Phase 1 的 WARDEN_RELIC 掉落,不变。)

### 4. 弑前成就(combat.ts `grantKillRewards` + data.ts)
warden 击杀分支(Phase 1)末尾:`if (e.legacyWarden) checkAch('warden_self_slay');`
`ACH_DEFS` 加:
```ts
{ id: 'warden_self_slay', icon: '🗡', n: { en: 'Self-Slayer', zh: '弑前' }, d: { en: 'Slay a Warden that was once you', zh: '击杀一个曾是你的守渊人' } },
```

---

## Non-goals (Phase 3)

- **不做 ghost/遗物/笔记遭遇**(那是方向 B)。
- **不做"掉落前任遗物"**(stretch;warden 击杀仍掉 Phase 1 的 WARDEN_RELIC)。
- **不做典籍动态列表**(warden:encestation 条目是静态文本,列出 wardens 需动态渲染,留 follow-up)。
- 普通死亡/结局不转化;不改战斗/腐化/结局数值。

---

## Testing and validation

- `npm run typecheck` + `npm run build` 必过。
- **可单测**:`recordWardenLegacy` 封顶 10(用 happy-dom localStorage,同 codex.test 模式);`Enemy.legacyWarden` 默认 undefined 不破坏既有 Enemy 字面量。
- spawnWarden 改名 / grantKillRewards 成就判 / wardenDeath 记录:靠 typecheck + build + playtest(打到 100 腐化死 → 新 run 守渊人显"前<名>" → 击杀弹弑前成就)。
- **回归**:无 wardens 时 spawnWarden 行为 = Phase 1;wardenCd/守渊人强度不变。
