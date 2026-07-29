# Wave 6b:现有 area 主题敌人 + 新机制 tile

技术规格。对应 `darkhollow`。本规格是 Wave 6b 实现与验收的唯一对照基准。Wave 6 内容扩展第 2 波(共 4 波:6a 性能+召唤 / 6b area 多样性 / 6c 新生物群系 / 6d 无尽模式)。

提交基准:`9861248`(Wave 6a merge + push 后的 main HEAD)。代码引用 pin 此 commit。

---

## Context

游戏 8 个 area 干净覆盖 F1–40,但「辨识度」有两处缺口:

1. **中段敌人主题薄弱**。spawn 走 mf 滚动窗口 `mf ∈ [floor-4, floor]`([enemies.ts makeIn L23-25 @ 9861248](https://github.com/xieyj22/darkhollow_win/blob/9861248/src/enemies.ts#L23-L25))。后段 area(F16-40)经 Wave 4-C1 已各有 4-6 个专属主题敌人;**中段弱**:
   - **Burning Depths(F11-15)** 是熔岩/火区,但专属敌人只有 Dragon Whelp(mf11)/ Ancient Dragon(mf14)/ Death Knight(mf14)三个,且后两者是龙/亡灵——火系小怪几乎靠 bleed,主题不贴。
   - **Crypts(F6-10)** 数量够(~10)但主题杂(墓穴里不全是亡灵)。
   - **Caves(F1-5)** 数量足(~15)但早期 run 看到的就那几只,缺变化。
   - **Dark Fortress(F16-20)** 仅 4 个专属(Wave 4-C1)。
2. **3 个 area 无 signature tile**。specialTiles 配置([data.ts AreaDef L356-431 @ 9861248](https://github.com/xieyj22/darkhollow_win/blob/9861248/src/data.ts#L356-L431)):depths/dragon 有 LAVA,abyss 有 ABYSS_WATER,void 有 VOID_FLOOR,sanctum 有 CRYSTAL;**caves / crypts / fortress 三个区没有任何 special tile**,机制上没辨识度。

关键既有机制(本规格复用,均为已验证模式):
- 加敌人 = [`ENEMIES` data.ts L97](https://github.com/xieyj22/darkhollow_win/blob/9861248/src/data.ts#L97) 追加一条(纯数据,自动 spawn,镜像 Wave 4-C1)。
- special tile 系统:**生成泛型**([dungeon.ts L72-81](https://github.com/xieyj22/darkhollow_win/blob/9861248/src/dungeon.ts#L72-L81) 读 `area.specialTiles.type/count` 随机铺到 FLOOR);**渲染** [render.ts tile switch](https://github.com/xieyj22/darkhollow_win/blob/9861248/src/render.ts#L134-L148)(每 TL 一个 case,hardcode char/fg/bg);**效果** [events.ts checkTiles L206-237](https://github.com/xieyj22/darkhollow_win/blob/9861248/src/events.ts#L206-L237)(每 TL 一个 `if(tile===TL.X)` 块,消费 = `map[y][x]=TL.FLOOR`)。TL 常量在 [config.ts L46-53](https://github.com/xieyj22/darkhollow_win/blob/9861248/src/config.ts#L46-L53)(现到 ABYSS_WATER=12)。
- `events.ts` 已 import `dst`+`shake`([L5/L7](https://github.com/xieyj22/darkhollow_win/blob/9861248/src/events.ts#L5));`data.ts` 已 import `TL`([L353](https://github.com/xieyj22/darkhollow_win/blob/9861248/src/data.ts#L353))——本规格不新增 import。

---

## 目标与范围(6b)

- **Part A — 8 个主题敌人**(纯 `data.ts`):填 Burning Depths 火系×3 / Crypts 亡灵×2 / Caves 早期×2 / Dark Fortress×1。
- **Part B — 3 个新机制 tile**(每个 4 文件小改):caves/crypts/fortress 各加一个 signature tile,效果属**不同机制族**(饥饿/MP/aggro),互不重叠也避开现有 tile。

非目标:6c(新生物群系)/ 6d(无尽模式);给 depths/dragon/abyss/void/sanctum 加 tile(已有);改 spawn/AI 核心逻辑。

---

## Proposed changes

### Part A — 8 个主题敌人(`src/data.ts`)

在 `ENEMIES` 末尾(`Archon` mf40 之后)追加。数值对标同档既有敌人(`fs=1+(floor-1)*0.12` 缩放):

| en / zh | ch(建议) | c | hp | atk | def | exp | g | ai | mf | el | tags |
|---------|----------|----|----|-----|-----|-----|------|------|----|----|------|
| Cave Beetle / 洞穴甲虫 | ⬟ | #7a5230 | 14 | 5 | 4 | 8 | [2,6] | ambush | 2 | — | — |
| Dire Bat / 巨蝠 | ⬣ | #4a4a4a | 12 | 6 | 1 | 9 | [3,7] | erratic | 3 | — | — |
| Bone Pile / 骸骨堆 | ≡ | #dcdcdc | 45 | 8 | 10 | 25 | [8,18] | ambush | 7 | — | undead |
| Crypt Warden / 墓穴守卫 | ☩ | #8a8a8a | 55 | 16 | 8 | 40 | [14,30] | chase | 9 | — | undead |
| Fire Imp / 火焰小妖 | æ | #ff7847 | 50 | 16 | 5 | 38 | [12,26] | erratic | 12 | fire | demon |
| Magma Hound / 熔岩犬 | Ð | #b22222 | 70 | 18 | 8 | 45 | [15,30] | chase | 13 | fire | beast |
| Cinder Wraith / 余烬怨灵 | § | #ff6347 | 60 | 22 | 6 | 50 | [18,35] | phase | 15 | fire | spirit |
| Dread Legionnaire / 恐惧军团兵 | ☨ | #5a5a6a | 110 | 30 | 14 | 85 | [30,60] | chase | 18 | shadow | — |

每条结构(示例,Fire Imp):
```ts
{ n: { en: 'Fire Imp', zh: '火焰小妖' }, ch: 'æ', c: '#ff7847', hp: 50, atk: 16, def: 5, exp: 38, g: [12, 26], ai: 'erratic', mf: 12, el: 'fire', tags: ['demon'] },
```
- `ch`:建议字形,实现时确认 **(a) 与现有 53 敌人 + tile 字形不冲突 (b) 在 JetBrains Mono 字体下能渲染**(QA 时若显示豆腐/空白即换)。Dire Bat 名含 'bat' → BEAST 模板(name 正则);Magma Hound tag `beast` → BEAST;Cinder Wraith tag `spirit` → WRAITH;Fire Imp tag `demon` → DEMON;Bone Pile/Crypt Warden tag `undead` → SKELETON。皆走 Wave 5 的 `pickEnemyTemplate` tag 路由,带 stamp 描边。
- `ai` 取现有 8 种之一。`el` 仅渲染+combat 元素(已支持 fire/shadow)。

### Part B — 3 个新机制 tile

**B.1 `config.ts` TL 常量**([L46-53](https://github.com/xieyj22/darkhollow_win/blob/9861248/src/config.ts#L46-L53),`ABYSS_WATER = 12` 之后):
```ts
  MOSS = 13,
  CURSE = 14,
  ALARM = 15,
```

**B.2 `render.ts` tile switch**(在 [CRYSTAL case L146](https://github.com/xieyj22/darkhollow_win/blob/9861248/src/render.ts#L146) 之后、`default` 之前):
```ts
      case TL.MOSS: ch = '"'; fg = '#6b8e3a'; bg = '#1a2a10'; break;
      case TL.CURSE: ch = '☣'; fg = '#8a2be2'; bg = '#1a0a2a'; break;
      case TL.ALARM: ch = '※'; fg = '#daa520'; bg = '#2a2a10'; break;
```

**B.3 `render.ts` minimap**(在 [renderMinimap 的 CRYSTAL 行 L304](https://github.com/xieyj22/darkhollow_win/blob/9861248/src/render.ts#L304) 之后,给新 tile 小地图辨识色):
```ts
      if (tile === TL.MOSS) off.fillStyle = '#6b8e3a';
      if (tile === TL.CURSE) off.fillStyle = '#8a2be2';
      if (tile === TL.ALARM) off.fillStyle = '#daa520';
```

**B.4 `events.ts` checkTiles**(在 [CRYSTAL 块 L227-237](https://github.com/xieyj22/darkhollow_win/blob/9861248/src/events.ts#L227-L237) 之后、函数末尾 `}` 之前):
```ts
  // MOSS — restores hunger, consumed
  if (tile === TL.MOSS) {
    const h = 5;
    G.player.hunger = Math.min(G.player.maxHunger, G.player.hunger + h);
    addMsg(lang === 'zh' ? `🌿 苔藓充饥！+${h} 饥饿` : `🌿 Moss snacks! +${h} hunger`, 'mh');
    flt(G.player.x, G.player.y, `+${h}`, '#6b8e3a'); snd('heal');
    G.dungeon.map[G.player.y][G.player.x] = TL.FLOOR;
  }
  // CURSE — drains MP (distinct from LAVA's HP damage)
  if (tile === TL.CURSE) {
    const drain = Math.max(2, Math.floor(G.player.maxMp * 0.2));
    G.player.mp = Math.max(0, G.player.mp - drain);
    addMsg(lang === 'zh' ? `⛧ 诅咒之地吸取了 ${drain} MP！` : `⛧ Cursed ground drains ${drain} MP!`, 'mc');
    flt(G.player.x, G.player.y, `-${drain}MP`, '#8a2be2'); snd('hit');
  }
  // ALARM — aggros nearby enemies (distinct mob-behavior mechanic)
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
- MOSS/ALARM 消费(踩后变 FLOOR);CURSE 不消费(持续诅咒之地,像 LAVA)。`dst`/`shake`/`snd`/`flt`/`addMsg` 均已 import。
- ALARM 把半径 8 内非 boss/非盟友敌人 `ai` 改 `chase`(永久,本层有效)——主题贴(堡垒警报)。

**B.5 `data.ts` area.specialTiles**(给 caves/crypts/fortress 三区各加字段):
- [caves L357-364](https://github.com/xieyj22/darkhollow_win/blob/9861248/src/data.ts#L357-L364):加 `specialTiles: { type: TL.MOSS, ch: '"', fg: '#6b8e3a', bg: '#1a2a10', count: [2, 4] },`
- [crypts L366-373](https://github.com/xieyj22/darkhollow_win/blob/9861248/src/data.ts#L366-L373):加 `specialTiles: { type: TL.CURSE, ch: '☣', fg: '#8a2be2', bg: '#1a0a2a', count: [2, 4] },`
- [fortress L385-392](https://github.com/xieyj22/darkhollow_win/blob/9861248/src/data.ts#L385-L392):加 `specialTiles: { type: TL.ALARM, ch: '※', fg: '#daa520', bg: '#2a2a10', count: [1, 2] },`

---

## Global Constraints

- **纯数据 + 既有模式**:Part A 只追加 `ENEMIES`;Part B 每个 tile 走既有 TL/render/events/specialTiles 四点,不改 spawn/AI/dungeon 生成核心。`events.ts`/`data.ts` 不新增 import。
- **机制族互斥**:MOSS(饥饿)/ CURSE(MP)/ ALARM(aggro)三效果两两不同,且与现有 tile(LAVA-HP伤/ABYSS_WATER-减速/VOID_FLOOR-传送/CRYSTAL-回MP/SHRINE-属性/FOUNTAIN-回HP)不重叠——CURSE 抽 MP 与 CRYSTAL 回 MP 是相反方向,允许共存。
- **字形/渲染硬约束**:新敌人 ch + 新 tile ch 必须在 JetBrains Mono 下可渲染、不与现有字形冲突(QA 验,豆腐即换)。
- **汉化**:`n.zh`/`n.en` 双语完整;tile 文案中英都写。
- 无测试框架;验证 = `npm run typecheck` + `npm run build` + 冒烟 + 手动 QA。
- 代码引用 pin `9861248`。

---

## Testing and validation

- `npm run typecheck` + `npm run build` 必过。
- **playwright 冒烟**(`npm run dev` + headless,沿用 Wave 5/6a smoke 范式):
  - 载入、控制台无报错。
  - F1-2(Caves)能看到 Cave Beetle / Dire Bat + 踩 MOSS tile 触发 +饥饿(消息/flt)。
  - (Crypts/Fortress/Burning Depths 需下楼,冒烟可选;核心验 Caves 区即可证明 tile+敌人管线通)。
- 手动 QA(`npm run dev`,meta 解锁/调试下楼):
  - 各新敌人在对应区 spawn(Burning Depths 火系三只、Crypts 亡灵两只等),剪影正确(demon/beast/spirit/undead 模板)。
  - MOSS(+饥饿,消耗)/ CURSE(-MP,持续)/ ALARM(aggro 半径内敌人)三效果触发正确。
  - 新 tile 在主画布 + minimap 都有辨识色,字形不豆腐。
  - 回归:既有 tile/敌人/Wave5-6a 功能不受影响。

---

## Parallelization

两轨可并行(文件重叠仅在 `data.ts`——需协调,见下):
- **轨 A(敌人)** — subagent,owns `data.ts` ENEMIES 追加。
- **轨 B(tile)** — subagent,owns `config.ts` + `render.ts` + `events.ts` + `data.ts` area.specialTiles。
- **冲突点**:两轨都改 `data.ts`(A 追加 ENEMIES 末尾,B 改 AREAS 的 caves/crypts/fortress)——不同区域,但同一文件。**建议顺序执行**(A 先,B 后)避免并发改同文件;或主 Agent 收口时合并 data.ts 两处改动。并发≤2 避 429。
- 收口(主 Agent):typecheck/build + 冒烟 + 手动 QA + ff-merge + push。

---

## Follow-ups

- 6c:新增中段生物群系(新 area + tile + 专属敌 + boss)。
- 6d:F40+ 无尽模式。
- 可选:ALARM aggro 改临时(回合数)而非永久;CURSE 叠加 debuff 效果。
