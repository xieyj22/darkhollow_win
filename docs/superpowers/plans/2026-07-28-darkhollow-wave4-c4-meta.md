# darkhollow Wave 4-C4(meta 玩法向升级)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development。合并 spec 角色。

**Goal:** 加 2 个玩法向 meta 升级(改变开局规则,非纯数值),开启 meta 的"玩法向"维度。

**Architecture:** `data.ts` META_UPGRADES 加 2 条 + `meta.ts` `applyMetaUpgrades` 加 2 分支。`start_relic` 直接 push 随机 r1 圣物到 `p.relics`(需 import RELICS);`blood_pact` 改 `p.baseMaxHp`(`recalc` 基于此,生效且不被覆盖)+ `p.talents.points`。两件都放已有 category(utility / talent),免改 Forge tab。

**Tech Stack:** TypeScript 5.7。

## Global Constraints

- **汉化硬约束**:`n:{zh,en}` / `d:{zh,en}` 双语。
- 不改 `player.ts`(`applyMetaUpgrades` 已在 `createPlayer` L58 调用,自动生效);不动 Forge UI tab(用已有 category)。
- 提交基准:`24dfa63`(C3 merge 后 main HEAD)。

---

## Context(explore 摘要)

- `meta.ts:103` `applyMetaUpgrades(p)`:一串 `if (u['id'])` 静态加成,在 `createPlayer` return 前调用(`player.ts:58`)——是注入"开局带 X"的唯一接入点。**此时 G 未绑定,不能用 `grantRelic`**(依赖 G/addMsg/fx),只能 `p.relics.push(id)`。
- `p.baseMaxHp`(`player.ts:26`):`recalc` 基于此算 maxHp——改 baseMaxHp 生效且不被 recalc 覆盖(改 maxHp 会被覆盖)。
- Forge tab 硬编码(`meta.ts:208-213`):新 category 不会自动出现;用已有 `utility`/`talent` 免改。
- `applyRelicBonuses`(`relics.ts:25`)在 `recalc` 调,故 start_relic 给的静态型圣物(r1 全是 passive)会被正确应用。

---

## Proposed

### 2 个新 meta(`data.ts` META_UPGRADES 末尾追加)

```ts
  { id: 'start_relic', n: { en: 'Heirloom', zh: '传家宝' },
    d: { en: 'Start each run with a random rarity-1 relic', zh: '每局开局获得一个随机稀有度1圣物' },
    icon: '🏺', maxLevel: 1, costs: [40], effect: 'start_relic',
    valuePerLevel: 1, category: 'utility' },
  { id: 'blood_pact', n: { en: 'Blood Pact', zh: '鲜血契约' },
    d: { en: '-10 max HP per level, +1 talent point per level', zh: '每级-10最大生命,+1天赋点' },
    icon: '🩸', maxLevel: 2, costs: [30, 60], effect: 'blood_pact',
    valuePerLevel: 1, category: 'talent' },
```

### `meta.ts` 改动

**顶部 import 追加 RELICS**(当前 `meta.ts:4` 只 import `META_UPGRADES, ACH_DEFS`):
```ts
import { META_UPGRADES, ACH_DEFS, RELICS } from './data.js';
```

**`applyMetaUpgrades` 加 2 分支**(在现有 `extra_talent` 分支之后,约 `meta.ts:121` 后):
```ts
  if (u['start_relic']) {
    const pool = RELICS.filter(r => r.rarity === 1);
    if (pool.length) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (!p.relics) p.relics = [];
      if (!p.relics.includes(pick.id)) p.relics.push(pick.id);
    }
  }
  if (u['blood_pact']) {
    const lv = u['blood_pact'];
    p.baseMaxHp -= 10 * lv;        // recalc 基于 baseMaxHp,生效且不被覆盖
    p.talents.points += lv;
  }
```

---

## Task 1: 加 2 meta + applyMetaUpgrades 分支

**Files:** `src/data.ts`、`src/meta.ts`

- [ ] **Step 1: `data.ts`** META_UPGRADES 末尾追加 2 条(上)。
- [ ] **Step 2: `meta.ts`** import 追加 `RELICS` + `applyMetaUpgrades` 加 2 分支(上)。
- [ ] **Step 3:** `npm run typecheck` + `npm run build` 必绿。
- [ ] **Step 4: 手动 QA**(dev + Forge):在 Forge 买 `传家宝`→新游戏看 `p.relics` 多一个 r1 圣物(`applyRelicBonuses` 生效,如 +15%ATK 的 war_totem);买 `鲜血契约`→新游戏看 maxHP -10/级 + 天赋点 +1/级;`L` 切中英 2 meta 名/desc 正常。
- [ ] **Step 5:** commit `feat(content): +2 玩法向 meta(传家宝/鲜血契约)`,提交 2 文件。

---

## Self-Review

- **覆盖**:2 meta + 2 分支 + import。
- **No placeholder**:每步含代码。
- **关键**:`blood_pact` 用 `baseMaxHp`(非 maxHp,避 recalc 覆盖);`start_relic` 用 `p.relics.push`(非 grantRelic,G 未绑定)。
- **汉化**:2 meta `n`/`d` 双语。
- **YAGNI**:不做 extra_acc_slot(6 文件大改,留 follow-up);不改 Forge tab(用已有 category)。
