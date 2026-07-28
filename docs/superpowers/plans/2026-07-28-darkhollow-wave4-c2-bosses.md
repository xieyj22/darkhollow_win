# darkhollow Wave 4-C2(前5 boss 加 phases)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development。合并 spec 角色(explore 已给详细实现依据,方案明确)。

**Goal:** 给前 5 个 boss(Goblin King/Spider Queen/Vampire Lord/Elder Lich/Dragon Emperor)加 phases/summon 机制,让 boss 战不再纯面板。

**Architecture:** 纯数据——只改 `data.ts` 的 `BOSSES` 5 条,加 `phases`/`summon`/`el` 字段。`processBossPhase`(enemies.ts:75-97,combat.ts:133-135 触发)与 `tryBossSummon`(enemies.ts:251,processEnemies 调)是通用管线,后 3 boss 已用,**零代码改动**。

**Tech Stack:** TypeScript 5.7。

## Global Constraints

- **纯数据**:只改 `src/data.ts`;不动 `enemies.ts`/`combat.ts`/`types.ts`/AI。
- **汉化硬约束**:boss 名 `n:{zh,en}` 保持现有(不改名);新机制不需要新文案(phase 触发消息由 `processBossPhase` 内置 `⚡ PHASE!`,summon 无文案)。
- phases 用方案 A(纯数据);**不用** summon.kind(精确召唤特定敌人需改 code,留 follow-up)。
- 提交基准:`4a523ba`(C1 merge 后 main HEAD)。

---

## Context(explore 摘要)

- `BossDef.phases`:`[{hpThreshold, atkM, newAi?, newEl?}]`,`boss.hp/maxHp <= hpThreshold` 时触发一次(`phasesTriggered` 去重),`atkM` 乘在原始面板 atk 上(防叠乘)。
- `BossDef.summon`:`{chance, cd, maxAdds}`,每回合先于 AI 触发,召唤池 = `ENEMIES.filter(mf∈[fl-8,fl])`(按楼层,非指定)。
- boss 初始 `ai:'chase'` 硬编码(enemies.ts:61),但 phase `newAi` 会覆盖。
- 前 5 boss 现状:Goblin King 纯面板 / Spider Queen summon / Vampire Lord 纯面板 / Elder Lich summon / Dragon Emperor summon。

---

## Proposed(5 boss 改动)

在 [`BOSSES` data.ts:153](https://github.com/xieyj22/darkhollow_win/blob/4a523ba/src/data.ts#L153) 改这 5 条(现有字段不动,只追加 `phases`/`summon`/`el`):

| Boss | 楼层 | 新增 | 设计意图 |
|------|----|------|---------|
| Goblin King | F5 | `summon:{0.4,3,2}` + `phases:[{0.4,1.4,'chase'}]` | 召唤哥布林 + 低血狂暴(入门 boss 教学 phase) |
| Spider Queen | F10 | `phases:[{0.5,1.3,'ambush'}]` | summon 保留;半血转伏击 |
| Vampire Lord | F15 | `el:'shadow'` + `phases:[{0.5,1.3,'lifesteal'}]` + `summon:{0.5,3,4}` | 半血切吸血 + 召唤仆从(纯面板→有机制) |
| Elder Lich | F20 | `phases:[{0.5,1.4,'ranged'}]` | summon 保留;半血转远程 |
| Dragon Emperor | F25 | `el:'fire'` + `phases:[{0.3,1.6,'chase','fire'}]` | summon 保留;低血狂暴+火元素 |

完整新定义(逐字用于实现):

```ts
  { n: { en: 'Goblin King', zh: '哥布林王' }, ch: '♚', c: '#ffd700', hp: 60, atk: 10, def: 4, exp: 100, g: [50, 80], fl: 5,
    summon: { chance: 0.4, cd: 3, maxAdds: 2 },
    phases: [{ hpThreshold: 0.4, atkM: 1.4, newAi: 'chase' }] },
  { n: { en: 'Spider Queen', zh: '蜘蛛女王' }, ch: '♛', c: '#8a2be2', hp: 90, atk: 14, def: 6, exp: 180, g: [70, 120], fl: 10,
    summon: { chance: 0.4, cd: 3, maxAdds: 2 },
    phases: [{ hpThreshold: 0.5, atkM: 1.3, newAi: 'ambush' }] },
  { n: { en: 'Vampire Lord', zh: '吸血鬼领主' }, ch: '▼', c: '#dc143c', hp: 120, atk: 18, def: 8, exp: 280, g: [100, 180], fl: 15, el: 'shadow',
    summon: { chance: 0.5, cd: 3, maxAdds: 4 },
    phases: [{ hpThreshold: 0.5, atkM: 1.3, newAi: 'lifesteal' }] },
  { n: { en: 'Elder Lich', zh: '远古巫妖' }, ch: '☯', c: '#9932cc', hp: 150, atk: 22, def: 10, exp: 400, g: [150, 250], fl: 20,
    summon: { chance: 0.4, cd: 3, maxAdds: 3 },
    phases: [{ hpThreshold: 0.5, atkM: 1.4, newAi: 'ranged' }] },
  { n: { en: 'Dragon Emperor', zh: '龙皇' }, ch: '♜', c: '#ff8c00', hp: 200, atk: 28, def: 14, exp: 600, g: [250, 500], fl: 25, el: 'fire',
    summon: { chance: 0.35, cd: 4, maxAdds: 2 },
    phases: [{ hpThreshold: 0.3, atkM: 1.6, newAi: 'chase', newEl: 'fire' }] },
```

---

## Task 1: 改 5 boss 定义

**Files:** `src/data.ts`

- [ ] **Step 1:** 用上面 5 条完整新定义替换 `BOSSES` 数组里对应的前 5 条(后 3 条 Leviathan/Void Sovereign/The Creator 不动)。先读 data.ts 定位再替换。
- [ ] **Step 2:** `npm run typecheck` + `npm run build` 必绿。
- [ ] **Step 3:** 手动 QA(`npm run dev`,调到 boss 楼层):打 Goblin King 到 40% HP 看 `⚡ PHASE!` + atk 提升 + 召唤哥布林;Vampire Lord 半血切 lifesteal(攻击回血);各 boss summon 正常。中英 `L` boss 名不变。
- [ ] **Step 4:** `git add src/data.ts && git commit -m "feat(content): 前5 boss 加 phases/summon 机制"`

---

## Self-Review

- **覆盖**:5 boss 各加 phase(+ 部分 summon/el),纯数据。
- **No placeholder**:5 条完整 BossDef,逐字。
- **一致性**:phases 字段与后 3 boss 模板一致;`n:{zh,en}` 保持(汉化不破)。
- **YAGNI**:不用 summon.kind(留 follow-up);不改 code。
