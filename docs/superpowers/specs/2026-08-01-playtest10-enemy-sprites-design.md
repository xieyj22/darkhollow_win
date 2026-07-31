# Playtest #10 — Enemy Pixel-Sprite Variety (Comprehensive) — Design Spec

Brainstorm design spec.对应 `darkhollow`. 本规格是 #10 实现与验收的对照基准。

提交基准:`0d1e831`(#7 合并后的 main HEAD)。代码引用 pin 此 commit。

---

## Goal

让 ~70 个敌人有**更高的视觉辨识度**:修 `pickEnemyTemplate` 的路由(语言无关、英文模式不再误显成哥布林),并新增 **11 个**像素模板,使大多数敌人各显其形(从 10 模板/~70 敌人 → 21 模板/~70 敌人,平均 ~3.3 敌人/模板,新模板显著分流)。

## Context (current state)

- `src/sprites.ts` `TEMPLATES` 有 **10 个敌人模板**(GOBLIN/SKELETON/SLIME/BEAST/DEMON/DRAGON/GOLEM/WRAITH/ELEMENTAL/CULTIST)+ BOSS。
- `pickEnemyTemplate(e)`:先按 **tag**(dragon/construct/spirit/elemental/cultist/undead/demon,按此顺序)路由,再按 **name 正则**(`/slime|.../` 等,**无 `i` flag,大小写敏感**)路由,兜底 GOBLIN。
- **路由 bug**:name 正则大小写敏感,英文模式下未 tag 的敌人(Wolf/Rat/Bat/Spider/Slime/Orc/...)不匹配小写正则 → 兜底 **GOBLIN**(中文模式靠 zh 子串如 狼/鼠/蜘/史莱 还能工作,故未被察觉)。
- `tags` 的**玩法用途**(不只 sprite):`items.ts` holy_water 检查 `undead`/`demon` 加成;`enemies.ts` bossSummonAdd 过滤 `boss`。→ 改 tag 时**必须保留 `undead`/`demon`**(玩法),只调整 sprite 路由 tag。

---

## Design

### 1. 路由修法(`pickEnemyTemplate` 重写)

**tag 优先级链**(最具体在前;`undead`/`demon` 靠后,以便 seraph/knight/mage/fungi 等"覆盖"它们):

```
dragon→DRAGON · seraph→SERAPH · aberration→ABERRATION · spirit→WRAITH · fungi→FUNGI
bat→BAT · hound→HOUND · insect→INSECT · rodent→RODENT · aquatic→AQUATIC
knight→KNIGHT · mage→MAGE · brute→BRUTE · construct→GOLEM · elemental→ELEMENTAL
cultist→CULTIST · demon→DEMON · undead→SKELETON · slime→SLIME · beast→BEAST
[name 正则兜底,全部加 i-flag] · default GOBLIN
```

- **规则**:每个敌人 `tags` 设为其**一个 sprite 路由 tag**(+ 保留原有 `undead`/`demon` 供玩法)。冲突的旧 sprite-only tag(dragon/beast/elemental/construct/spirit/cultist)直接替换为新路由 tag。
- name 正则全部加 `i` flag(双保险,英文小写也能匹配)。

### 2. 新模板(11 个,16×16,沿用 `buildPalette`:M/D/L/E/K)

| 模板 | 视觉意图 |
|---|---|
| **BAT** | 张开的双翼 + 小身体 + 两只尖耳 |
| **HOUND** | 四足猛兽,前突口鼻,四肢,尾 |
| **INSECT** | 分节身体 + 多腿(蜘蛛/甲虫通用) |
| **RODENT** | 小圆身 + 长尾 + 两耳 |
| **AQUATIC** | 鱼/蛇形身 + 背鳍 + 尾鳍(水母/深潜者/塞壬/克拉肯共用) |
| **KNIGHT** | 板甲人形 + 头盔 + 盾/剑轮廓 |
| **BRUTE** | 壮硕人形,躯干巨大、头小 |
| **MAGE** | 长袍 + 兜帽 + 法杖/光球 |
| **ABERRATION** | 触手/无形虚空团块,不对称,独眼 |
| **SERAPH** | 翼人形 + 头光圈,直立 |
| **FUNGI** | 菇帽身 + 菌柄 + 斑点 |

每个模板 ~16 行像素矩阵,impl 阶段手绘;视觉在 playtest 验(像素 art 无法在 markdown 审)。

### 3. 逐敌人 tag/模板映射(~50)

格式:敌人(mf)| 设 tags(粗体=新增/改动)| →模板。`undead`/`demon` 保留供 holy_water。

**原始/早期(mf1-14)**
- Rat(1) | **rodent** | RODENT
- Bat(1) | **bat** | BAT
- Goblin(1) | —(兜底)| GOBLIN
- Slime(1) | **slime** | SLIME
- Mushroom(2) | **fungi** | FUNGI
- Cave Fish(3) | **aquatic** | AQUATIC
- Kobold(3) | — | GOBLIN
- Skeleton(2) | undead | SKELETON
- Spider(2) | **insect** | INSECT
- Orc(3) | **brute** | BRUTE
- Wolf(4) | **hound** | HOUND
- Cultist(5) | **cultist** | CULTIST
- Wraith(4) | **spirit**,undead | WRAITH
- Ogre(5) | **brute** | BRUTE
- Dark Mage(4) | **mage** | MAGE
- Harpy(6) | **beast** | BEAST
- Mimic(7) | —(兜底)| GOBLIN *(注:无宝箱牙模板,留 follow-up)*
- Wyvern(8) | **dragon** | DRAGON
- Dark Knight(9) | **knight** | KNIGHT
- Troll(7) | **brute** | BRUTE
- Vampire(7) | undead | SKELETON *(保留;vampire-as-skeleton 可接受)*
- Golem(8) | **construct** | GOLEM
- Lich(10) | **mage**,undead | MAGE
- Demon(10) | demon | DEMON
- Necromancer(10) | **mage** | MAGE
- Dragon Whelp(11) | **dragon** | DRAGON
- Ancient Dragon(14) | dragon | DRAGON
- Death Knight(14) | **knight**,undead | KNIGHT

**暗黑堡垒/龙域(mf16-25)**
- Castellan(16) | **knight**(替 construct)| KNIGHT
- Gargoyle(17) | construct | GOLEM
- Inquisitor(18) | cultist | CULTIST
- Siege Golem(19) | construct | GOLEM
- Pyro Drake(21) | dragon | DRAGON
- Drake Zealot(22) | cultist | CULTIST
- Magma Behemoth(23) | elemental | ELEMENTAL
- Drakeborn Knight(24) | **knight**(替 dragon)| KNIGHT
- Storm Wraith(25) | spirit | WRAITH

**深渊(mf26-30)**
- Abyssal Jellyfish(26) | **aquatic** | AQUATIC
- Deep One(26) | **aquatic** | AQUATIC
- Void Leech(27) | **aberration** | ABERRATION
- Coral Golem(28) | **construct** | GOLEM
- Siren(29) | **aquatic** | AQUATIC
- Kraken Spawn(30) | **aquatic** | AQUATIC

**虚空(mf31-35)**
- Void Wraith(31) | **spirit** | WRAITH
- Chaos Elemental(32) | **elemental** | ELEMENTAL
- Rift Stalker(33) | **aberration** | ABERRATION
- Void Mage(34) | **mage** | MAGE
- Reality Shard(35) | **aberration** | ABERRATION

**最终圣殿(mf36-40)**
- Seraphim(36) | **seraph** | SERAPH
- Fallen Seraph(37) | **seraph**,undead,demon | SERAPH
- Divine Golem(38) | **construct** | GOLEM
- Cosmic Horror(39) | **aberration**,demon | ABERRATION
- Archon(40) | **seraph** | SERAPH

**Wave 6b 主题敌**
- Cave Beetle(2) | **insect** | INSECT
- Dire Bat(3) | **bat** | BAT
- Bone Pile(7) | undead | SKELETON
- Crypt Warden(9) | undead | SKELETON
- Fire Imp(12) | demon | DEMON
- Magma Hound(13) | **hound**(替 beast)| HOUND
- Cinder Wraith(15) | spirit | WRAITH
- Dread Legionnaire(18) | **knight**(替 construct)| KNIGHT

**Wave 6c 秘境(mf0)**
- Mushroom Brute(0) | **fungi**(替 construct)| FUNGI
- Spore Mother(0) | **fungi**(替 spirit)| FUNGI
- Myconid(0) | **fungi**(替 cultist)| FUNGI
- Fungal Knight(0) | **fungi**,undead | FUNGI
- Glow Slime(0) | **slime**(替 elemental)| SLIME

**Wave 6d 无尽(mf40+)**
- Void Titan(42) | **aberration**(替 construct)| ABERRATION
- Doom Seraph(45) | **seraph**,demon | SERAPH
- Entropy Beast(48) | **aberration**(替 elemental)| ABERRATION
- Abyssal Tyrant(50) | demon | DEMON

> 模板分布(共 70):GOBLIN×3 · SKELETON×4 · SLIME×2 · BEAST×1 · DEMON×3 · DRAGON×4 · GOLEM×5 · WRAITH×4 · ELEMENTAL×2 · CULTIST×3 · **BAT×2 · HOUND×2 · INSECT×2 · RODENT×1 · AQUATIC×5 · KNIGHT×5 · BRUTE×3 · MAGE×4 · ABERRATION×6 · SERAPH×4 · FUNGI×5**。Boss 仍走 BOSS 模板(不变)。

---

## Non-goals

- **不新增 Mimic 专属模板**(宝箱牙)——留 follow-up;Mimic 暂兜底 GOBLIN。
- **不动 BOSS 模板**(boss 走 drawBossSprite)。
- **不改 enemy 的 `ch`/`c`/数值**——只改 `tags` + 新模板 + 路由。
- **不改 holy_water 的 undead/demon 判定**——这些 tag 保留。
- reducedMotion 与 sprite 无关(sprite 是静态绘制,无 motion);不涉及。

---

## Testing and validation

- `npm run typecheck` + `npm run build` 必过。
- **dev-time 模板行长校验**(sprites.ts 已有,对新模板自动生效):每行 === 16。
- **无单测**(sprite 像素无法在 happy-dom 验);靠 typecheck+build + 代码审查(逐敌人 tag/模板映射是否如上表)+ **legend 面板/实机 playtest 视觉确认**。
- **回归校验**:挑几个 holy_water 相关敌人(Fallen Seraph/Cosmic Horror undead|demon)确认仍吃圣水加成(玩法 tag 保留)。
