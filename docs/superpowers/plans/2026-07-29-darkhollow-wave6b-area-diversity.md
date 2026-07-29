# darkhollow Wave 6b(area 主题敌人 + 新机制 tile)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给中段加 8 个主题敌人(Burning Depths 火系/Crypts 亡灵/Caves/Dark Fortress)+ 给 caves/crypts/fortress 三个缺 signature 的区各加一个新机制 tile(MOSS 回饥饿 / CURSE 抽 MP / ALARM 激怒敌人)。

**Architecture:** 敌人 = `ENEMIES` 追加(纯数据,自动 spawn,镜像 Wave 4-C1)。新 tile = 既有四点:config TL 常量 + render tile switch case + render minimap 色号 + events checkTiles effect 块 + data area.specialTiles;dungeon 生成已泛型(读 type/count),不改。

**Tech Stack:** TypeScript 5.7 + Vite 6 + Canvas2D;无测试框架。

## Global Constraints

- **无测试框架**。验证 = `npm run typecheck` + `npm run build` + playwright 冒烟 + 手动 QA。
- **字形/渲染硬约束**:新敌人 ch + 新 tile ch 在 JetBrains Mono 下可渲染、不与现有字形冲突(QA 验,豆腐即换)。
- **机制族互斥**:MOSS(饥饿)/CURSE(MP)/ALARM(aggro)两两不同,且与现有 tile 不重叠。
- `events.ts` 已 import `dst`+`shake`;`data.ts` 已 import `TL`——**不新增 import**。
- 代码引用 pin `9861248`。每 Task 一 commit。
- **顺序执行**:Task 1(敌人)与 Task 2(tile)都改 `data.ts`(不同区:ENEMIES 末尾 vs AREAS caves/crypts/fortress),顺序执行避并发同文件冲突。

---

## File Structure

| 文件 | 动作 | 责任 |
|------|------|------|
| `src/data.ts` | Modify | Task 1:`ENEMIES` 追加 8 条;Task 2:caves/crypts/fortress 加 `specialTiles` |
| `src/config.ts` | Modify | Task 2:`MOSS/CURSE/ALARM` TL 常量 |
| `src/render.ts` | Modify | Task 2:tile switch 3 case + minimap 3 色号 |
| `src/events.ts` | Modify | Task 2:`checkTiles` 加 MOSS/CURSE/ALARM 效果块 |

---

## Task 1: 8 个主题敌人

**Files:**
- Modify: `src/data.ts`(仅 `ENEMIES` 数组末尾追加)

**Interfaces:** 无(纯数据,自动 spawn)。

- [ ] **Step 1: `data.ts` ENEMIES 末尾追加 8 条**

在 [`ENEMIES` 末尾 `Archon`(mf40,L161)之后、`]`(L162)之前](https://github.com/xieyj22/darkhollow_win/blob/9861248/src/data.ts#L161-L162)追加:
```ts
  // === Wave 6b: 主题敌人填中段辨识度 ===
  { n: { en: 'Cave Beetle', zh: '洞穴甲虫' }, ch: '⬟', c: '#7a5230', hp: 14, atk: 5, def: 4, exp: 8, g: [2, 6], ai: 'ambush', mf: 2 },
  { n: { en: 'Dire Bat', zh: '巨蝠' }, ch: '⬣', c: '#4a4a4a', hp: 12, atk: 6, def: 1, exp: 9, g: [3, 7], ai: 'erratic', mf: 3 },
  { n: { en: 'Bone Pile', zh: '骸骨堆' }, ch: '≡', c: '#dcdcdc', hp: 45, atk: 8, def: 10, exp: 25, g: [8, 18], ai: 'ambush', mf: 7, tags: ['undead'] },
  { n: { en: 'Crypt Warden', zh: '墓穴守卫' }, ch: '☩', c: '#8a8a8a', hp: 55, atk: 16, def: 8, exp: 40, g: [14, 30], ai: 'chase', mf: 9, tags: ['undead'] },
  { n: { en: 'Fire Imp', zh: '火焰小妖' }, ch: 'æ', c: '#ff7847', hp: 50, atk: 16, def: 5, exp: 38, g: [12, 26], ai: 'erratic', mf: 12, el: 'fire', tags: ['demon'] },
  { n: { en: 'Magma Hound', zh: '熔岩犬' }, ch: 'Ð', c: '#b22222', hp: 70, atk: 18, def: 8, exp: 45, g: [15, 30], ai: 'chase', mf: 13, el: 'fire', tags: ['beast'] },
  { n: { en: 'Cinder Wraith', zh: '余烬怨灵' }, ch: '§', c: '#ff6347', hp: 60, atk: 22, def: 6, exp: 50, g: [18, 35], ai: 'phase', mf: 15, el: 'fire', tags: ['spirit'] },
  { n: { en: 'Dread Legionnaire', zh: '恐惧军团兵' }, ch: '☨', c: '#5a5a6a', hp: 110, atk: 30, def: 14, exp: 85, g: [30, 60], ai: 'chase', mf: 18, el: 'shadow' },
```

- [ ] **Step 2: 字形查重**

确认 8 个 ch(`⬟⬣≡☩æÐ§☨`)与现有 53 敌人 ch + tile ch(`#·+>≈Ø♦*~ space◆`)都不冲突。若某字形与现有重复,换一个等价未用字形。JetBrains Mono 渲染留 QA 验。

- [ ] **Step 3: typecheck + build**

Run: `npm run typecheck` → Expected: 无错误。
Run: `npm run build` → Expected: 成功。

- [ ] **Step 4: Commit**

```bash
git add src/data.ts
git commit -m "feat(content): +8 主题敌人填中段(火系/亡灵/洞穴/堡垒)"
```

---

## Task 2: 3 个新机制 tile(MOSS / CURSE / ALARM)

**Files:**
- Modify: `src/config.ts`、`src/render.ts`、`src/events.ts`、`src/data.ts`(AREAS)

**Interfaces:** 产出 `TL.MOSS=13/CURSE=14/ALARM=15`;3 个 render case + minimap 色 + 3 个 checkTiles 效果块 + 3 区 specialTiles 配置。

- [ ] **Step 1: `config.ts` 加 TL 常量**

在 [`ABYSS_WATER = 12`(L53)](https://github.com/xieyj22/darkhollow_win/blob/9861248/src/config.ts#L53) 之后加:
```ts
  MOSS = 13,
  CURSE = 14,
  ALARM = 15,
```

- [ ] **Step 2: `render.ts` tile switch 加 3 case**

在 [tile switch 的 `case TL.CRYSTAL`(L146)](https://github.com/xieyj22/darkhollow_win/blob/9861248/src/render.ts#L146) 之后、`default` 之前加:
```ts
      case TL.MOSS: ch = '"'; fg = '#6b8e3a'; bg = '#1a2a10'; break;
      case TL.CURSE: ch = '☣'; fg = '#8a2be2'; bg = '#1a0a2a'; break;
      case TL.ALARM: ch = '※'; fg = '#daa520'; bg = '#2a2a10'; break;
```

- [ ] **Step 3: `render.ts` minimap 加 3 色号**

在 [renderMinimap 的 `if (tile === TL.CRYSTAL)`(L304)](https://github.com/xieyj22/darkhollow_win/blob/9861248/src/render.ts#L304) 之后加:
```ts
      if (tile === TL.MOSS) off.fillStyle = '#6b8e3a';
      if (tile === TL.CURSE) off.fillStyle = '#8a2be2';
      if (tile === TL.ALARM) off.fillStyle = '#daa520';
```

- [ ] **Step 4: `events.ts` checkTiles 加 3 效果块**

在 [CRYSTAL 块(L227-237)之后、checkTiles 函数末尾 `}` 之前](https://github.com/xieyj22/darkhollow_win/blob/9861248/src/events.ts#L227-L237)加:
```ts
  // MOSS — restores hunger, consumed
  if (tile === TL.MOSS) {
    const h = 5;
    G.player.hunger = Math.min(G.player.maxHunger, G.player.hunger + h);
    addMsg(lang === 'zh' ? `🌿 苔藓充饥！+${h} 饥饿` : `🌿 Moss snacks! +${h} hunger`, 'mh');
    flt(G.player.x, G.player.y, `+${h}`, '#6b8e3a'); snd('heal');
    G.dungeon.map[G.player.y][G.player.x] = TL.FLOOR;
  }
  // CURSE — drains MP (distinct from LAVA's HP damage; not consumed)
  if (tile === TL.CURSE) {
    const drain = Math.max(2, Math.floor(G.player.maxMp * 0.2));
    G.player.mp = Math.max(0, G.player.mp - drain);
    addMsg(lang === 'zh' ? `⛧ 诅咒之地吸取了 ${drain} MP！` : `⛧ Cursed ground drains ${drain} MP!`, 'mc');
    flt(G.player.x, G.player.y, `-${drain}MP`, '#8a2be2'); snd('hit');
  }
  // ALARM — aggros nearby enemies (consumed)
  if (tile === TL.ALARM) {
    let n = 0;
    for (const e of G.enemies) {
      if (!e.isAlly && !e.isBoss && dst(G.player.x, G.player.y, e.x, e.y) <= 8) { e.ai = 'chase'; n++; }
    }
    addMsg(lang === 'zh' ? `🚨 警报锣响！${n} 个敌人被激怒！` : `🚨 The alarm sounds! ${n} enemies enraged!`, 'me');
    flt(G.player.x, G.player.y, '⚠ALARM', '#daa520'); snd('trap'); shake();
    G.dungeon.map[G.player.y][G.player.x] = TL.FLOOR;
  }
```

- [ ] **Step 5: `data.ts` 三区加 specialTiles**

- [caves(L357-364)](https://github.com/xieyj22/darkhollow_win/blob/9861248/src/data.ts#L357-L364) `enemyScaleBonus: 0,` 之后加:
```ts
    specialTiles: { type: TL.MOSS, ch: '"', fg: '#6b8e3a', bg: '#1a2a10', count: [2, 4] },
```
- [crypts(L366-373)](https://github.com/xieyj22/darkhollow_win/blob/9861248/src/data.ts#L366-L373) `enemyScaleBonus: 0,` 之后加:
```ts
    specialTiles: { type: TL.CURSE, ch: '☣', fg: '#8a2be2', bg: '#1a0a2a', count: [2, 4] },
```
- [fortress(L385-392)](https://github.com/xieyj22/darkhollow_win/blob/9861248/src/data.ts#L385-L392) `enemyScaleBonus: 0,` 之后加:
```ts
    specialTiles: { type: TL.ALARM, ch: '※', fg: '#daa520', bg: '#2a2a10', count: [1, 2] },
```

- [ ] **Step 6: typecheck + build**

Run: `npm run typecheck` → Expected: 无错误。
Run: `npm run build` → Expected: 成功。

- [ ] **Step 7: Commit**

```bash
git add src/config.ts src/render.ts src/events.ts src/data.ts
git commit -m "feat: 3 新机制 tile(MOSS 回饥饿/CURSE 抽MP/ALARM 激怒)"
```

---

## Task 3: 集成 QA + merge + push

**Files:** 无代码改动(验证 + git)。依赖 Task 1+2。

- [ ] **Step 1: typecheck + build**

Run: `npm run typecheck && npm run build` → Expected: 全过。

- [ ] **Step 2: 冒烟 + QA**

`npm run dev` + playwright 冒烟(沿用 Wave 5/6a smoke;F1-2 Caves 即可验新敌 + MOSS):
- 载入无报错;F1-2 见 Cave Beetle / Dire Bat + 踩 MOSS 触发 +饥饿。
- 字形不豆腐(敌人 ch + tile ch 都正常渲染)。
- 手动下楼验:Crypts CURSE(-MP)、Fortress ALARM(aggro)、Burning Depths 火系三只;minimap 三 tile 辨识色。
- 回归:既有 tile/敌人/Wave5-6a 不受影响。

- [ ] **Step 3: ff-merge main → push**

(逐 task commit 在 main 则跳过 merge);push origin(撞 TLS 重试)。可选 `npm run dist` 重建 exe。

- [ ] **Step 4: 收尾**

QA 记录;更新 memory(Wave 6b done,待续 6c/6d)。

---

## Self-Review

- **Spec coverage**:Part A 8 敌人(Task 1)✓;Part B 3 tile 四点 config/render×2/events/data(Task 2 Step 1-5)✓;字形/渲染(Global + Task 1 Step 2 / Task 3)✓;机制族互斥(Global Constraints)✓;无新 import(Global,已核 events/data import)✓。
- **Placeholder scan**:每步实际代码/命令/预期;8 敌人完整数据行;3 tile 完整代码。
- **Type consistency**:`TL.MOSS/CURSE/ALARM` 在 config 定义、render/events/data 引用一致;`dst`/`shake`/`snd`/`flt`/`addMsg` 均已 import(events.ts L5/L7 + 既有)。
- **YAGNI**:不加 depths/dragon/abyss/void/sanctum 的 tile(已有);不改 spawn/dungeon 核心;ALARM aggro 用永久 chase(简单,临时化是 follow-up)。
- **顺序**:Task 1→Task 2 顺序(data.ts 不同区,避并发冲突);Task 2 内 config 先(data 引用 TL)。
