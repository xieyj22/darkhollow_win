# darkhollow Wave 4-C1(敌人断层)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development。

**Goal:** 在 `data.ts` 的 `ENEMIES` 追加 9 条敌人,填 F12-25 内容断层(纯表驱动,自动 spawn)。

**Architecture:** 单文件纯数据追加——9 条 EnemyDef 插入 `Death Knight`(mf14)与 `Abyssal Jellyfish`(mf26)之间;`n:{zh,en}` 双语(汉化硬约束);不动 spawn/combat/render/AI 逻辑。

**Tech Stack:** TypeScript 5.7 + Vite 6。

## Global Constraints

- **汉化硬约束**:每条 `n.zh`/`n.en` 必须完整(spec 定的帅化名,逐字)。
- 只改 `src/data.ts`;不动 `enemies.ts`/`combat.ts`/`render.ts`/AI。
- 不引入 `res`/`skill` 字段(combat 未读)。
- 提交基准:`f8a1d8b`(C1 spec HEAD)。
- 字形 `ch` 若与现有 44 敌人冲突,implementer 微调(优先 spec 值)。

---

## Task 1: 追加 9 条敌人

**Files:** `src/data.ts`

- [ ] **Step 1: 插入 9 条 EnemyDef**

在 [`ENEMIES` 数组](https://github.com/xieyj22/darkhollow_win/blob/f8a1d8b/src/data.ts#L131)(`Death Knight` mf14 之后、`Abyssal Jellyfish` mf26 之前)插入:
```ts
  // === New: Dark Fortress (mf 16-19) — 填 F12-25 断层 ===
  { n: { en: 'Castellan', zh: '铁卫统领' }, ch: '♝', c: '#4a5a6a', hp: 95, atk: 26, def: 16, exp: 70, g: [25, 55], ai: 'chase', mf: 16 },
  { n: { en: 'Gargoyle', zh: '石化魔像' }, ch: 'Γ', c: '#708090', hp: 85, atk: 30, def: 12, exp: 75, g: [20, 50], ai: 'ambush', mf: 17 },
  { n: { en: 'Inquisitor', zh: '圣裁官' }, ch: '✠', c: '#d4af37', hp: 75, atk: 32, def: 8, exp: 80, g: [30, 60], ai: 'ranged', mf: 18, el: 'holy' },
  { n: { en: 'Siege Golem', zh: '破城巨像' }, ch: '◍', c: '#696969', hp: 125, atk: 34, def: 15, exp: 85, g: [35, 70], ai: 'chase', mf: 19 },
  // === New: Dragon's Domain (mf 21-25) ===
  { n: { en: 'Pyro Drake', zh: '烈焰飞龙' }, ch: '¤', c: '#ff6347', hp: 115, atk: 34, def: 12, exp: 95, g: [40, 80], ai: 'ranged', mf: 21, el: 'fire' },
  { n: { en: 'Drake Zealot', zh: '龙血信徒' }, ch: '☧', c: '#8b0000', hp: 95, atk: 30, def: 10, exp: 90, g: [30, 65], ai: 'summon', mf: 22 },
  { n: { en: 'Magma Behemoth', zh: '熔岩巨兽' }, ch: '●', c: '#ff4500', hp: 135, atk: 32, def: 16, exp: 100, g: [40, 85], ai: 'chase', mf: 23, el: 'fire' },
  { n: { en: 'Drakeborn Knight', zh: '龙裔骑士' }, ch: '†', c: '#b22222', hp: 115, atk: 38, def: 14, exp: 110, g: [45, 90], ai: 'chase', mf: 24 },
  { n: { en: 'Storm Wraith', zh: '雷霆怨灵' }, ch: '⚡', c: '#4682b4', hp: 100, atk: 36, def: 10, exp: 100, g: [40, 80], ai: 'ranged', mf: 25, el: 'lightning' },
```

- [ ] **Step 2: typecheck + build**

Run: `npm run typecheck` → 无错。
Run: `npm run build` → 成功。

- [ ] **Step 3: 手动 QA**

`npm run dev`(可用 meta `fov_bonus`/调 floor 到 F16-25 验证 spawn):
- F16-25 各楼层刷出新敌人(mf 窗口命中),不再回退刷 Rat。
- **`L` 切中英**:9 个敌人名都正确(铁卫统领/Castellan … 雷霆怨灵/Storm Wraith),无漏译。
- holy/fire/lightning 敌人显示元素角标。
- 数值不偏离同档(F14/F26)。

- [ ] **Step 4: Commit**

```bash
git add src/data.ts
git commit -m "feat(content): 填 F12-25 敌人断层 +9(汉化双语)"
```

---

## Self-Review

- **覆盖**:9 条敌人(spec 表逐字)+ 汉化 + spawn 验证。
- **No placeholder**:每条完整 EnemyDef,插入位置明确。
- **一致性**:名/数值/字形与 spec 一致;`n:{zh,en}` 双语。
- **YAGNI**:纯 data.ts,不接 res/skill/combat。
