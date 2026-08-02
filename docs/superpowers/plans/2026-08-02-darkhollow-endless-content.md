# 无尽专属内容 (Endless Content) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给无尽模式 F41+ 补专属内容——8 件装备(3套装) + 6 圣物 + endless_merchant 商人 + 转生(5 meta 升级)，让扭曲虚空深层有进度感与回报。

**Architecture:** 全部新内容在 `G.endless && G.floor >= 41` 门内（普通模式 F1-40 零影响）。复用现有模式：装备走 `item-gen.ts genWeapon/genArmor/genAcc` 的 rarity+缩放模式；圣物走 `relics.ts` effect handler；商人走 `events.ts` treasure_merchant 的 stock+按钮+buy splice 模式；转生走 `meta.ts applyMetaUpgrades` + `META_UPGRADES`(category 分 forge tab)。

**Tech Stack:** TypeScript + Vite + Canvas 2D + Electron；vitest + happy-dom（现 152 测基座）；i18n `t/tMsg/tx`。

**Spec:** `docs/superpowers/specs/2026-08-02-darkhollow-endless-content-design.md`（分支 `feat/endless-content` @ `e06a87b`，从 main `3cb52a0`）

## Global Constraints

- **所有新内容 `G.endless && G.floor >= 41` 门内**——普通模式 F1-40 行为不变，现有 152 测应全绿（回归判据）。
- 数据加进 `data.ts` 对应数组；**套装 id 用 `void_gear`/`abyss_gear`/`astral_gear`**（避撞现有 `abyssal`/`fire_lord`/`frost_mage`/`shadow_set`/`divine`）。
- 新 bonus type `corruption_resist`（每层 enterFloor 减腐化）；圣物 `eternal_sand` 与 meta `corruption_ward` 在 `applyCorruption` 入口**乘算叠加**（T2 先加 eternal_sand，T4 再加 corruption_ward）。
- i18n 新键走 `t/tMsg/tx`，进 `i18n.ts` 的 `L` 表（zh+en），`tMsg` 占位符用 `{}`（非 `{1}`）。命名前缀 `el.*`(endless loot) / `em.*`(endless merchant) / `er.*`(endless rebirth)。
- TDD：先失败测后实现；`npx tsc --noEmit; echo "tsc=$?"` + `npx vitest run; echo $?` 显式核验（**不**用 `| grep`/`| tail` 掩退出码）；commit message 前缀 `Endless content Task N: ...`。
- **顺序执行 T1→T2→T3→T4**（data.ts 多 task 共享 + applyCorruption 跨 T2/T4 共改）。

## File Structure

| 文件 | 责任 | 任务 |
|---|---|---|
| `src/data.ts` | ENDLESS_GEAR 表 + EQUIPMENT_SETS(+3) + RELICS(+6) + META_UPGRADES(+5) | T1/T2/T4 |
| `src/types.ts` | `Player.setCorruptionResist?` | T1 |
| `src/item-gen.ts` | `genEndlessGear(floor,type?)` + `endlessLuckMult()` | T1/T4 |
| `src/combat.ts` | `applySetBonus` corruption_resist case + attack loot F41+ + applyCorruption eternal_sand/corruption_ward + playerDeath bonus echoes | T1/T2/T4 |
| `src/game.ts` | `enterFloor` corruption_resist 减腐化 + null_crown buff + `initGame` deep_start 起始 floor | T1/T2/T4 |
| `src/relics.ts` | 6 圣物 handler 接线 + `grantRandomRelic` cap F41→5 | T2 |
| `src/talents.ts` | `getCritMultiplier` star_core | T2 |
| `src/events.ts` | endless_merchant npc + rollEndlessStock + openEndlessMerchant + buy + 服务 | T3 |
| `src/meta.ts` | `applyMetaUpgrades` endless 块 + forge tab 'endless' + endless_luck/corruption_ward/deep_start 应用 | T4 |
| `src/i18n.ts` | el.*/em.*/er.* 键 | 各 task |
| `src/__tests__/endless-content.test.ts` (**新**) | 各子系统 characterization | T1-T4 |
| `src/__tests__/makeEnemy-real-data.test.ts` | 新数据 shape 守卫 | T1/T2/T4 |

---

### Task 1: 专属装备（8 件 3 套装 + corruption_resist）

**Files:** Modify `data.ts`(ENDLESS_GEAR+EQUIPMENT_SETS) / `types.ts` / `item-gen.ts` / `combat.ts`(applySetBonus+loot) / `game.ts`(enterFloor) / `i18n.ts` / 新 `__tests__/endless-content.test.ts`

**Interfaces:**
- Produces: `genEndlessGear(floor, type?): Item`（T3 商人 + combat loot 用）；`Player.setCorruptionResist?`；EQUIPMENT_SETS 3 新套装 + bonus type `corruption_resist`（recalc/applySetBonus + enterFloor 消费）。

- [ ] **Step 1: data.ts 加 ENDLESS_GEAR 表（8 件，rarity 5）**

在 RELICS 之前加（ch 字符若与现有 ALL_WEAPONS/ALL_ARMORS/ALL_ACCESSORIES 撞则换近似）：
```ts
export const ENDLESS_GEAR = {
  weapons: [
    { n: { en: 'Void Blade', zh: '虚空之刃' }, r: 5, a: 14, ch: '/', el: 'shadow', set: 'void_gear' },
    { n: { en: 'Abyss Staff', zh: '深渊法杖' }, r: 5, a: 11, ch: '|', el: 'shadow', set: 'abyss_gear' },
    { n: { en: 'Star Bow', zh: '星辰长弓' }, r: 5, a: 13, ch: ')', el: 'holy', set: 'astral_gear' },
  ],
  armors: [
    { n: { en: 'Void Armor', zh: '虚空护甲' }, r: 5, d: 12, ch: '[', el: 'shadow', set: 'void_gear' },
    { n: { en: 'Abyss Cape', zh: '深渊斗篷' }, r: 5, d: 8, ch: ']', set: 'abyss_gear' },
    { n: { en: 'Astral Aegis', zh: '星辰护盾' }, r: 5, d: 11, ch: '}', el: 'holy', set: 'astral_gear' },
  ],
  accessories: [
    { n: { en: 'Void Ring', zh: '虚空戒指' }, r: 5, a: 3, d: 2, h: 30, ch: '"', set: 'void_gear' },
    { n: { en: 'Abyss Amulet', zh: '深渊护符' }, r: 5, a: 2, d: 3, h: 40, ch: '"', set: 'abyss_gear' },
  ],
};
```

- [ ] **Step 2: data.ts EQUIPMENT_SETS 加 3 套装**（在现有数组末尾，`abyssal` 项之后）
```ts
  { id: 'void_gear', n: { en: 'Void', zh: '虚空' }, pieces: 3, bonuses: [
    { required: 2, type: 'el_dmg_shadow', value: 15, desc: { en: '+15% Shadow Dmg', zh: '+15%暗影伤害' } },
    { required: 3, type: 'corruption_resist', value: 3, desc: { en: '-3 Corruption/floor', zh: '每层-3腐化' } },
  ] },
  { id: 'abyss_gear', n: { en: 'Abyss', zh: '深渊' }, pieces: 3, bonuses: [
    { required: 2, type: 'crit', value: 10, desc: { en: '+10% Crit', zh: '+10%暴击' } },
    { required: 3, type: 'heal_bonus', value: 15, desc: { en: '+15% Healing', zh: '+15%治疗' } },
  ] },
  { id: 'astral_gear', n: { en: 'Astral', zh: '星辰' }, pieces: 2, bonuses: [
    { required: 2, type: 'el_dmg_holy', value: 15, desc: { en: '+15% Holy Dmg', zh: '+15%神圣伤害' } },
  ] },
```

- [ ] **Step 3: types.ts Player 加 `setCorruptionResist?: number;`**（在 `corruption` 字段后）

- [ ] **Step 4: combat.ts applySetBonus 加 corruption_resist case**（[`combat.ts:308 applySetBonus`](https://github.com/xieyj22/darkhollow_win/blob/3cb52a0/src/combat.ts#L308) switch 末尾）
```ts
    case 'corruption_resist': (p as Player).setCorruptionResist = ((p as Player).setCorruptionResist ?? 0) + value; break;
```
（recalc 开头 L235 `p.elRes = {}` 旁加 `p.setCorruptionResist = 0;` 重置）

- [ ] **Step 5: item-gen.ts 加 genEndlessGear**
```ts
import { ENDLESS_GEAR } from './data.js';
// endless_luck meta multiplier (T4 wires the rank; T1 stub returns 1)
export function endlessLuckMult(): number { return 1; }

export function genEndlessGear(floor: number, type?: 'weapon' | 'armor' | 'accessory'): Item {
  const t = type ?? (['weapon', 'armor', 'accessory'] as const)[Math.floor(Math.random() * 3)];
  const pool = t === 'weapon' ? ENDLESS_GEAR.weapons : t === 'armor' ? ENDLESS_GEAR.armors : ENDLESS_GEAR.accessories;
  const b = pick(pool);
  const bonus = Math.floor((floor - 41) / 5) * 2;  // F41:0 / F60:7 / F100:23
  if (t === 'weapon') return { type: 'weapon', name: tx(b.n), atk: b.a + bonus, rarity: 5, ch: b.ch, c: '#9b5de5', desc: tMsg('el.atkPlus', String(b.a + bonus)), x: 0, y: 0, el: b.el, set: b.set };
  if (t === 'armor')  return { type: 'armor',  name: tx(b.n), def: b.d + bonus, rarity: 5, ch: b.ch, c: '#7ec8e3', desc: tMsg('el.defPlus', String(b.d + bonus)), x: 0, y: 0, el: b.el, set: b.set };
  return { type: 'accessory', name: tx(b.n), atk: b.a, def: b.d, hp: b.h, rarity: 5, ch: b.ch, c: '#06d6a0', desc: tMsg('el.accStats', String(b.a), String(b.d), String(b.h)), x: 0, y: 0, set: b.set };
}
```
（`pick`/`tx`/`tMsg` 已 import；`tx` 需 `import { tx } from './i18n.js'` 若未导入）

- [ ] **Step 6: combat.ts attack loot F41+ 用 genEndlessGear**（[`combat.ts:161` `_genItem` loot 分支](https://github.com/xieyj22/darkhollow_win/blob/3cb52a0/src/combat.ts#L161)）
改 `const loot = _genItem(G.floor);` 为：
```ts
        const loot = (G.endless && G.floor >= 41 && Math.random() < 0.5 * endlessLuckMult())
          ? genEndlessGear(G.floor) : _genItem(G.floor);
```
（import `genEndlessGear, endlessLuckMult` from item-gen；`_genItem` 桥不变，加 endless 分支。boss/精英 F41+ 必掉：在 loot 概率判断加 `|| def.isBoss || def.isElite`）

- [ ] **Step 7: game.ts enterFloor corruption_resist 每层减腐化**（enterFloor 函数体，unlockLore/area 之后、spawn 之前）
```ts
  if (G.endless && G.player.setCorruptionResist && G.player.setCorruptionResist > 0) {
    applyCorruption(-G.player.setCorruptionResist);
  }
```
（import `applyCorruption` from combat —— game.ts 已 import combat 多个 fn，加 applyCorruption）

- [ ] **Step 8: i18n.ts 加 el.* 键**（`el.atkPlus`/`el.defPlus`/`el.accStats`，zh+en，参照现有 `ig.atkPlus` 文案）

- [ ] **Step 9: 写测试（endless-content.test.ts）**
```ts
import { genEndlessGear, endlessLuckMult } from '../item-gen.js';
it('genEndlessGear scales with floor + carries set/el', () => {
  const w41 = genEndlessGear(41, 'weapon'); const w100 = genEndlessGear(100, 'weapon');
  expect(w41.rarity).toBe(5); expect(w41.set).toMatch(/_gear$/);
  expect(w100.atk).toBeGreaterThan(w41.atk);  // F100 > F41
});
it('genEndlessGear armor/accessory produce correct types', () => {
  expect(genEndlessGear(50, 'armor').type).toBe('armor');
  expect(genEndlessGear(50, 'accessory').type).toBe('accessory');
});
```
（加 applySetBonus corruption_resist 测：构造 player 装备 void_gear 2 件 → setCorruptionResist 累加；mock G 如现有测）

- [ ] **Step 10: 跑测试 + typecheck + commit**
`npx vitest run; echo $?` + `npx tsc --noEmit; echo "tsc=$?"` 全绿。`git add` 涉及文件，commit `Endless content Task 1: endless gear (8 items, 3 sets) + corruption_resist bonus`。

---

### Task 2: 专属圣物（6 rarity5 + handler 接线）

**Files:** Modify `data.ts`(RELICS+6) / `relics.ts`(handler+grantRandomRelic) / `talents.ts`(getCritMultiplier) / `game.ts`(enterFloor null_crown) / `combat.ts`(applyCorruption eternal_sand) / `i18n.ts`

**Interfaces:**
- Produces: 6 圣物 effect 在 relics.ts/applyCorruption/getCritMultiplier/enterFloor 接线；`grantRandomRelic` F41+ rarity cap 5。
- Consumes: T1 的 `genEndlessGear`（无）、applyCorruption 入口（T4 也会改，T2 先加 eternal_sand）。

- [ ] **Step 1: data.ts RELICS 加 6 项**（rarity 5，在 RELICS 数组末尾）
```ts
  { id: 'void_heart', n: { en: 'Void Heart', zh: '虚空之心' }, d: { en: '+spellPower by floor', zh: '法强随楼层增长' }, ch: '♥', c: '#9b5de5', rarity: 5, effect: 'spell_floor', value: 0 },
  { id: 'abyss_eye', n: { en: 'Abyss Eye', zh: '深渊之眼' }, d: { en: '+30% dmg vs void foes', zh: '对虚空系敌人+30%伤害' }, ch: '◉', c: '#7b2fbe', rarity: 5, effect: 'dmg_void', value: 30 },
  { id: 'eternal_sand', n: { en: 'Eternal Sand', zh: '永恒之沙' }, d: { en: '-50% corruption', zh: '腐化获取减半' }, ch: '⌛', c: '#e0c060', rarity: 5, effect: 'corruption_half', value: 0 },
  { id: 'star_core', n: { en: 'Star Core', zh: '星辰之核' }, d: { en: '+crit dmg by floor', zh: '暴伤随楼层增长' }, ch: '✦', c: '#ffd700', rarity: 5, effect: 'crit_floor', value: 0 },
  { id: 'chaos_egg', n: { en: 'Chaos Egg', zh: '混沌之卵' }, d: { en: '+atk by echoes', zh: '攻击随回响增长' }, ch: '◎', c: '#ff1493', rarity: 5, effect: 'atk_echoes', value: 0 },
  { id: 'null_crown', n: { en: 'Null Crown', zh: '虚无之冕' }, d: { en: 'buff each floor', zh: '每层随机增益' }, ch: '♔', c: '#e0e0ff', rarity: 5, effect: 'buff_floor', value: 0 },
```

- [ ] **Step 2: relics.ts applyRelicBonuses 加 void_heart/chaos_egg**（[`relics.ts:27 switch`](https://github.com/xieyj22/darkhollow_win/blob/3cb52a0/src/relics.ts#L27)）
```ts
      case 'void_heart': p.spellPower += Math.floor(G!.floor * 0.01); break;
      case 'chaos_egg': p.atk += Math.floor(getMetaEchoes() / 50); break;
```
（新 helper `getMetaEchoes()`：import `getMeta` from meta，`return getMeta().soulEchoes`;——relics.ts 顶部 import）

- [ ] **Step 3: relics.ts relicOnHitEnemy 加 abyss_eye**（[`relics.ts:42`](https://github.com/xieyj22/darkhollow_win/blob/3cb52a0/src/relics.ts#L42)，vampiric_fang 之后）
```ts
  if (hasRelic('abyss_eye') && dmg > 0 && defender.tags?.some(t => ['spirit', 'aberration', 'demon'].includes(t))) {
    dmg = Math.floor(dmg * 1.3);
  }
```

- [ ] **Step 4: talents.ts getCritMultiplier 加 star_core**（getCritMultiplier 函数体）
```ts
  let m = /* existing base */;
  if (hasRelic('star_core')) m += G!.floor * 0.005;
  return m;
```
（import `hasRelic` from relics + `G` from state；注意循环依赖——talents 已 import G，hasRelic via late-binding 或直接 import 若无环。若环，用 `import { hasRelic } from './relics.js'` 测试 build 是否报环）

- [ ] **Step 5: combat.ts applyCorruption 加 eternal_sand（×0.5）**（[`combat.ts:338 applyCorruption`](https://github.com/xieyj22/darkhollow_win/blob/3cb52a0/src/combat.ts#L338) 入口，`const r = addCorruption(p, n);` 之前）
```ts
  if (hasRelic('eternal_sand') && n > 0) n = Math.ceil(n / 2);
```
（import `hasRelic` from relics。**注意**：T4 会在此再加 corruption_ward meta，T2 占位。）

- [ ] **Step 6: game.ts enterFloor null_crown 每层 buff**（enterFloor，corruption_resist 减腐化之后）
```ts
  if (G.endless && G.floor >= 41 && hasRelic('null_crown')) {
    const kinds = [['str_buff', 5], ['def_buff', 5], ['shield', 5]] as const;
    const k = kinds[Math.floor(Math.random() * kinds.length)];
    G.player.buffs.push({ name: 'null_crown', type: k[0], value: k[1], turns: 3 });
  }
```
（import hasRelic from relics）

- [ ] **Step 7: relics.ts grantRandomRelic rarity cap F41→5**（[`relics.ts:176`](https://github.com/xieyj22/darkhollow_win/blob/3cb52a0/src/relics.ts#L176)）
改 `const maxR = floor >= 30 ? 4 : floor >= 15 ? 3 : 2;` 为 `const maxR = floor >= 41 ? 5 : floor >= 30 ? 4 : floor >= 15 ? 3 : 2;`

- [ ] **Step 8: i18n.ts** 加圣物名/描述（`tx` 从 RelicDef.n/.d 自动，无需新键，除非有消息）

- [ ] **Step 9: 测试（endless-content.test.ts 追加）**：void_heart spellPower 按 floor、abyss_eye vs tag、eternal_sand applyCorruption 减半、star_core crit mult、chaos_egg echoes 联动（mock getMeta echoes）、null_crown enterFloor 加 buff、grantRandomRelic F41+ 可出 rarity5（mock RELICS 池）。每 effect 一个 characterization。

- [ ] **Step 10: 跑测试 + typecheck + commit** `Endless content Task 2: endless relics (6 rarity5) + handler wiring`。

---

### Task 3: 专属商人（endless_merchant）

**Files:** Modify `events.ts` / `game.ts`(spawn) / `data.ts`(或 events 内联商品) / `i18n.ts`

**Interfaces:**
- Consumes: T1 `genEndlessGear`、T2 rarity5 RELICS 池 + `grantRelic`、`applyCorruption`。
- Produces: `endless_merchant` npc 类型（triggerNpc 分支 + map-entity spawn F41+ 每3层 + 商品 stock UI）。

- [ ] **Step 1: events.ts triggerNpc 加 endless_merchant 分支**（[`events.ts:285`](https://github.com/xieyj22/darkhollow_win/blob/3cb52a0/src/events.ts#L285)）
```ts
  else if (entity.npc === 'endless_merchant') openEndlessMerchant(entity);
```

- [ ] **Step 2: events.ts 加 endlessMerchantPrice + rollEndlessStock + openEndlessMerchant + buy + 服务**（参照 treasure_merchant L288-355 模式）
```ts
function endlessMerchantPrice(base: number): number { return base + (G ? G.floor * 1 : 0); }  // base 见下各商品

function rollEndlessStock(): { kind: 'gear'|'relic'|'purge'|'heal'; item?: Item; relicId?: string; price: number; label: string; }[] {
  if (!G) return [];
  const f = G.floor; const stock: any[] = [];
  for (let i = 0; i < 3; i++) { const it = genEndlessGear(f); stock.push({ kind: 'gear', item: it, price: endlessMerchantPrice(f * 80), label: `${it.ch} ${it.name}` }); }
  // 1 rarity5 relic
  import('../relics.js').then(() => {});  // 静态 import 在文件顶
  // ... (静态 import grantRelic/RELICS；pick 一个未拥有 rarity5)
  return stock;
}
```
（实现要点：商品 4 类——3 genEndlessGear(gold=floor×80) + 1 rarity5 圣物(floor×200) + 净化腐化-20(floor×40, applyCorruption(-20)) + 治疗满血(floor×30, p.hp=maxHp)。**静态 import** `genEndlessGear`/`grantRelic`/`RELICS`/`hasRelic` 在文件顶，**勿用动态 import**。openEndlessMerchant 复用 openTreasureMerchant 的 stock 按钮 + setEventOpen/bindEventBtns 模式；服务类商品买后不 splice（可重复）或 splice（一次性），选 splice 一致。）

- [ ] **Step 3: events.ts openEndlessMerchant + buyEndless**（克隆 openTreasureMerchant L311-355 结构：stock 按钮 + leave + buy 检查 gold + addItemWithOverflow/grantRelic/applyCorruption/p.hp + splice + rerender）

- [ ] **Step 4: map-entity spawn F41+ 每3层刷 endless_merchant**（找 spawn merchant/treasure_merchant 的 map-entity 生成处——`grep -n "treasure_merchant" src/` 定位 spawn 逻辑；在 F41+ endless area 每 3 层（`G.floor % 3 === 0`）push 一个 `{npc:'endless_merchant', ...}` map entity）

- [ ] **Step 5: types.ts Item.npc 联合类型加 `'endless_merchant'`**（[`types.ts:155`](https://github.com/xieyj22/darkhollow_win/blob/3cb52a0/src/types.ts#L155) npc 字段联合）

- [ ] **Step 6: i18n.ts 加 em.* 键**（em.title/em.desc/em.purge/em.heal/em.soldOut，zh+en）

- [ ] **Step 7: 测试**：rollEndlessStock 生成 4 类商品 + 价=floor×N；buyEndless gold 检查 + 圣物 grant + 净化 applyCorruption(-20) + 治疗 hp=max。mock G。

- [ ] **Step 8: 跑测试 + typecheck + commit** `Endless content Task 3: endless merchant (gear/relic/purge/heal)`。

---

### Task 4: 转生（endless death bonus echoes + 5 meta 升级）

**Files:** Modify `data.ts`(META_UPGRADES+5) / `meta.ts`(applyMetaUpgrades endless + forge tab + endless_luck rank getter + corruption_ward) / `combat.ts`(playerDeath bonus echoes + applyCorruption corruption_ward) / `game.ts`(initGame deep_start) / `item-gen.ts`(endlessLuckMult 接 meta rank) / `i18n.ts`

**Interfaces:**
- Consumes: T1 `endlessLuckMult`（stub return 1 → T4 接 meta rank）、T2 applyCorruption eternal_sand（T4 在同入口加 corruption_ward 乘算）。
- Produces: 5 个 `category='endless'` meta 升级；`applyMetaUpgrades` 的 `G.endless` gate 块；deep_start 起始 floor。

- [ ] **Step 1: data.ts META_UPGRADES 加 5 项 category='endless'**（[`data.ts:607`](https://github.com/xieyj22/darkhollow_win/blob/3cb52a0/src/data.ts#L607) 数组末尾，参照现有 MetaUpgradeDef 格式）
```ts
  { id: 'deep_start', n: { en: 'Deep Start', zh: '深度起跳' }, d: { en: 'Endless starts +5 floors/rank', zh: '无尽开局楼层+5/级' }, icon: '↓', maxLevel: 5, costs: [200,400,700,1100,1600], effect: 'deep_start', valuePerLevel: 5, category: 'endless' },
  { id: 'void_resist', n: { en: 'Void Resist', zh: '虚空抗性' }, d: { en: '+10% all resist/rank (endless)', zh: '全抗+10%/级(无尽)' }, icon: '◈', maxLevel: 5, costs: [150,300,500,800,1200], effect: 'void_resist', valuePerLevel: 10, category: 'endless' },
  { id: 'endless_luck', n: { en: 'Endless Luck', zh: '无尽幸运' }, d: { en: '+20% endless drop rate/rank', zh: '无尽掉率+20%/级' }, icon: '★', maxLevel: 5, costs: [200,400,700,1100,1600], effect: 'endless_luck', valuePerLevel: 20, category: 'endless' },
  { id: 'corruption_ward', n: { en: 'Corruption Ward', zh: '腐化守护' }, d: { en: '-15% corruption/rank', zh: '腐化-15%/级' }, icon: '🜔', maxLevel: 5, costs: [150,300,500,800,1200], effect: 'corruption_ward', valuePerLevel: 15, category: 'endless' },
  { id: 'endless_might', n: { en: 'Endless Might', zh: '无尽之力' }, d: { en: '+5% atk/spell/rank (endless)', zh: '攻击法强+5%/级(无尽)' }, icon: '⚔', maxLevel: 5, costs: [300,600,1000,1500,2200], effect: 'endless_might', valuePerLevel: 5, category: 'endless' },
```

- [ ] **Step 2: meta.ts applyMetaUpgrades 加 G.endless 块**（[`meta.ts:126 applyMetaUpgrades`](https://github.com/xieyj22/darkhollow_win/blob/3cb52a0/src/meta.ts#L126) 末尾，`if (G && G.endless)` gate）
```ts
  if (G && G.endless) {
    const up = getMeta().upgrades;
    const voidResist = (up['void_resist'] || 0);
    for (const el of ['fire','ice','lightning','shadow','holy'] as const) p.elRes[el] = (p.elRes[el] || 0) + voidResist * 0.10;
    const might = (up['endless_might'] || 0);
    p.atk += Math.floor(p.baseAtk * might * 0.05);
    p.spellPower += p.baseSpellPower * might * 0.05;
  }
```
（`G` import from state；`getMeta` 已在 meta.ts）

- [ ] **Step 3: meta.ts 新 endlessLuckMult + corruptionWardMult export**（供 item-gen/combat 用）
```ts
export function endlessLuckMult(): number { return 1 + (getMeta().upgrades['endless_luck'] || 0) * 0.20; }
export function corruptionWardMult(): number { return 1 - (getMeta().upgrades['corruption_ward'] || 0) * 0.15; }
```

- [ ] **Step 4: item-gen.ts endlessLuckMult 接 meta**（T1 stub 改为 `import { endlessLuckMult } from './meta.js'; export { endlessLuckMult };` 或 item-gen 内 re-export meta 的）

- [ ] **Step 5: combat.ts applyCorruption 加 corruption_ward（与 eternal_sand 乘算）**（T2 加的 eternal_sand 之后）
```ts
  if (n > 0) n = Math.ceil(n * corruptionWardMult());
```
（import corruptionWardMult from meta。最终：eternal_sand ×0.5 再 × corruptionWardMult）

- [ ] **Step 6: combat.ts playerDeath endless bonus echoes**（[`combat.ts:387` endless 分支](https://github.com/xieyj22/darkhollow_win/blob/3cb52a0/src/combat.ts#L387)，`creditSoulEchoes(echoes.total)` 之前）
```ts
  if (G.endless && G.floor > 40) { const bonus = (G.floor - 40) * 10; echoes.kills += bonus; echoes.total += bonus; creditSoulEchoes(bonus); addMsg(tMsg('er.bonusEchoes', String(bonus)), 'ml'); }
```
（注意 creditSoulEchoes 调一次——调整顺序避免双计；SoulEchoBreakdown 加 bonus 进 total 后统一 credit）

- [ ] **Step 7: game.ts initGame deep_start 起始 floor**（[`game.ts:19 initGame`](https://github.com/xieyj22/darkhollow_win/blob/3cb52a0/src/game.ts#L19)，endless=true 时）
```ts
  if (endless) { const ds = (getMeta().upgrades['deep_start'] || 0) * 5; if (ds > 0) startFloor = 41 + ds; }
```
（需配套：deep_start 起跳走 enterFloor(startFloor) —— 玩家进 F(41+5N)，enterFloor 正常 unlockLore/area/spawn；起跳 floor 的敌人 fs 缩放自动。`getMeta` import from meta）

- [ ] **Step 8: forge tab 'endless'**（[`meta.ts:297` forgeActiveTab 过滤](https://github.com/xieyj22/darkhollow_win/blob/3cb52a0/src/meta.ts#L297)——找 forge tab UI 定义处加 'endless' tab 选项，让 category='endless' 升级可见可买。`grep -n 'forgeActiveTab\|forge' src/` 定位 UI）

- [ ] **Step 9: i18n.ts 加 er.* 键**（er.bonusEchoes，zh+en；meta 升级名/描述从 MetaUpgradeDef.n/.d 自动）

- [ ] **Step 10: 测试**：applyMetaUpgrades endless gate（void_resist elRes / endless_might atk，普通模式不应用）、endlessLuckMult/corruptionWardMult 公式、playerDeath endless bonus echoes=(floor-40)×10、deep_start 起始 floor=41+5×rank、forge 'endless' tab 含 5 升级。

- [ ] **Step 11: 跑测试 + typecheck + commit** `Endless content Task 4: rebirth (bonus echoes + 5 endless meta upgrades)`。

---

## Self-Review

**1. Spec coverage**: §2.2 装备(8件3套装+genEndlessGear+loot+corruption_resist)→T1 ✓ / §2.3 圣物(6+handler+grantRandomRelic cap)→T2 ✓ / §2.4 商人(endless_merchant+4商品+每3层)→T3 ✓ / §2.5 转生(bonus echoes+5 meta升级+applyMetaUpgrades endless+deep_start+endless_luck/corruption_ward)→T4 ✓ / §4 测试→各 Task Step 测 + 冒烟(final) / §5 顺序→Global Constraints 顺序执行。
**2. Placeholder scan**: 无 TBD；T3 Step 2 给了 rollEndlessStock 框架 + 明确"静态 import + 4 类商品 + 克隆 openTreasureMerchant 模式"，implementer 按模式 + 行号定位落地；其余步骤含真实代码。数值全精确（base/缩放/gold 价/costs）。
**3. Type consistency**: `genEndlessGear`/`endlessLuckMult`/`corruptionWardMult`/`setCorruptionResist` 全链路命名一致；applyCorruption 的 eternal_sand（T2）+ corruption_ward（T4）乘算叠加在 T2 Step5/T4 Step5 明确；套装 id `void_gear`/`abyss_gear`/`astral_gear` 全文档一致避撞现有 `abyssal`。

**注**：spec §2.5 deep_start 起跳 F(41+5N) 的副作用（跳层 balance）spec §6 已标 playtest 验证；T4 Step7 实现走 enterFloor(startFloor) 保证 lore/area 正确。
