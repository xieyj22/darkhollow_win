# Wave 4-C1:填 F12-25 敌人断层

技术规格。对应 `darkhollow`。Wave 4 内容扩展的第 1 批(共 4 批:C1 敌人断层 / C2 boss phases / C3 圣物 / C4 meta)。本规格是 C1 实现与验收的唯一对照基准。

提交基准:`888d93e`(Wave 3 merge 后的 main HEAD)。代码引用 pin 此 commit。

---

## Context

审查发现最大内容缺口:**F12-25(横跨 Burning Depths 后半 + Dark Fortress + Dragon's Domain,共 14 层)无任何新敌人引入**。spawn 机制([`enemies.ts:23` @ 888d93e](https://github.com/xieyj22/darkhollow_win/blob/888d93e/src/enemies.ts#L23))用滚动 5 层窗口 `e.mf <= floor && e.mf >= max(1, floor-4)`,窗口空时回退到 `e.mf <= floor` 全池 → **F16-25 会从全池随机抽,F20 可能刷出 Rat**(mf1),数值/沉浸感崩。

- 现有最高前段敌人 [`Ancient Dragon` mf14 / `Death Knight` mf14](https://github.com/xieyj22/darkhollow_win/blob/888d93e/src/data.ts#L130-L131)(hp70-80/atk25-28),下一段直接跳到 [`Abyss` mf26](https://github.com/xieyj22/darkhollow_win/blob/888d93e/src/data.ts#L133)(hp70-120/atk20-30)。F16-25 新敌人数值应落在两者之间。
- [`EnemyDef`](https://github.com/xieyj22/darkhollow_win/blob/888d93e/src/types.ts#L162) 字段:`n{zh,en}` / `ch` / `c` / `hp` / `atk` / `def` / `exp` / `g[min,max]` / `ai` / `mf` / `el?` / `tags?`。
- 加新敌人**只需**在 [`ENEMIES` 数组 data.ts:96](https://github.com/xieyj22/darkhollow_win/blob/888d93e/src/data.ts#L96) 追加一条 → 自动纳入 spawn(`mf` 窗口),无需改 spawn 表/掉落表/成就/i18n 文件。
- 敌人端 0 个 lightning 元素(玩家却有 chain_lightning/Thunder 系装备)——顺带补一个。

---

## 目标与范围(C1)

- 填 F16-25 断层:Dark Fortress(F16-20)4 个 + Dragon's Domain(F21-25)4 个 + Storm Wraith(F25,补 lightning)= **9 个新敌人**。
- **纯表驱动**:只改 `data.ts`(`ENEMIES` 追加);不动 spawn/combat/render/AI 逻辑。
- 不引入 `res`/`skill` 字段(审查确认 combat 未读这两项,设了不生效)。

---

## Proposed changes

在 [`ENEMIES` data.ts:96](https://github.com/xieyj22/darkhollow_win/blob/888d93e/src/data.ts#L96) 的 `Death Knight`(mf14,L131)之后、`Abyssal Jellyfish`(mf26,L133)之前插入 9 条(数值对标缩放 `fs=1+(floor-1)*0.12`,落在 F14-F26 之间):

| en / zh | ch | c | hp | atk | def | exp | g | ai | mf | el |
|---------|----|----|----|-----|-----|-----|------|------|----|----|
| Guard Captain / 护卫长 | ♝ | #4a5a6a | 95 | 26 | 16 | 70 | [25,55] | chase | 16 | — |
| Gargoyle / 石像鬼 | Γ | #708090 | 85 | 30 | 12 | 75 | [20,50] | ambush | 17 | — |
| Inquisitor / 审判官 | ✠ | #d4af37 | 75 | 32 | 8 | 80 | [30,60] | ranged | 18 | holy |
| Siege Golem / 攻城魔像 | ◍ | #696969 | 125 | 34 | 15 | 85 | [35,70] | chase | 19 | — |
| Fire Drake / 火飞龙 | ¤ | #ff6347 | 115 | 34 | 12 | 95 | [40,80] | ranged | 21 | fire |
| Dragon Cultist / 龙教徒 | ☧ | #8b0000 | 95 | 30 | 10 | 90 | [30,65] | summon | 22 | — |
| Magma Elemental / 岩浆元素 | ● | #ff4500 | 135 | 32 | 16 | 100 | [40,85] | chase | 23 | fire |
| Half-Dragon Knight / 半龙骑士 | † | #b22222 | 115 | 38 | 14 | 110 | [45,90] | chase | 24 | — |
| Storm Wraith / 风暴幽灵 | ⚡ | #4682b4 | 100 | 36 | 10 | 100 | [40,80] | ranged | 25 | lightning |

每条结构(示例,Guard Captain):
```ts
{ n: { en: 'Guard Captain', zh: '护卫长' }, ch: '♝', c: '#4a5a6a', hp: 95, atk: 26, def: 16, exp: 70, g: [25, 55], ai: 'chase', mf: 16 },
```
- `ch` 字形:选不与现有 44 敌人冲突的 Unicode;上表为建议值,实现时确认无冲突(尤其 ✠/†/⚡)。
- `c` 颜色:主题色建议,可微调。
- `ai` 取现有 8 种之一(`chase`/`ambush`/`ranged`/`summon`)。
- `el` 仅用于渲染(元素指示器,[render.ts:175 elColors](https://github.com/xieyj22/darkhollow_win/blob/888d93e/src/render.ts#L175) 已支持 fire/holy/lightning);若 combat 读 `e.el` 做元素伤害则自然生效,不读则仅渲染,两种都不破坏。

---

## Global Constraints(本批)

- **汉化是硬约束**(用户强调):每条 `n.zh` / `n.en` 双语必须完整、准确、契合主题;`L` 切换中英都要正常显示(现有 `updateUI`/渲染走 `n[lang]`,新敌人自动 i18n)。
- 只改 `data.ts`;不动 `enemies.ts`/`combat.ts`/`render.ts`/AI 逻辑。
- 不引入 `res`/`skill` 字段(combat 未读)。

---

## Testing and validation

- `npm run typecheck` + `npm run build` 必过。
- 手动 QA(`npm run dev`,可用 meta 解锁/调到 F16):
  - F16-25 各楼层实际刷出新敌人(mf 窗口命中),不再回退刷出 Rat。
  - **`L` 切中英**:9 个敌人名字都正确显示(护卫长/Guard Captain 等),无漏译/错位。
  - 元素指示器:holy/fire/lightning 敌人显示对应元素角标。
  - 数值合理:不比同档(F14 / F26)明显偏离。

---

## Parallelization

单文件纯数据追加,紧耦合度低但量小 → 单 implementer 一次做完(不并行)。

---

## Follow-ups

- C2 前 5 boss 加 phases/机制。
- C3 圣物 hook 扩充 + r0/r3。
- C4 meta 玩法向升级。
- 可选:`res`/`skill` 字段接入 combat(让 Magma Elemental 真正火抗等)——独立任务。
