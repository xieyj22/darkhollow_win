# Playtest #7 — Item FX Pass (Scrolls/Potions Unique Animations)

Brainstorm design spec.对应 `darkhollow`. 本规格是 #7 实现与验收的对照基准。

提交基准:`11058c1`(Wave 8 合并后的 main HEAD)。代码引用 pin 此 commit。

---

## Goal

让 `useItem` 的每一个 scroll/potion/consumable 效果都有一个**贴合、视觉可辨**的动画。当前约 12 个效果(持续型自身 buff + 几个工具)只打印日志消息、无任何视觉反馈。本 pass 新增 **一个** FX 原语 `fxAura`(扩张描边环)给持续自身 buff 族,其余裸效果接到既有原语。

## Context (current state)

- `src/fx.ts` 导出 5 个原语:`fxFlash`(扩张填充径向辉光)、`fxBeam`(锯齿能量束)、`fxBolt`(飞行光弹)、`fxDash`(位移残影)、`fxBurst`(粒子爆裂)。全部在 `reducedMotion` 下自退避;全部 tile 坐标→屏幕经由 `G.vx/vy`;池化有上限(`MAX_FX=48` / `MAX_SPARKS=220`)。
- `src/items.ts useItem` 已给战斗道具(fireball/lightning/blizzard/holy_blast/bomb/throw_knife/holy_water)、teleport、summon_ally、以及 heal/mana/ward/haste 接了 fx;`smoke_bomb` 用自带的 `burstSmoke`。
- **裸效果(仅 addMsg,无 fx)**,共 12 个:`str_buff`、`def_buff`、`el_res_fire`、`el_res_ice`、`shield`、`torch`、`invis`、`antidote`、`mapping`、`fear`、`bear_trap`、`recall`。

---

## Design

### 1. 新原语:`fxAura`

`fx.ts` 加一个 `FxKind = 'aura'`,导出 `fxAura(x, y, color, scale = 1)`:一个**描边圆环**,从中心向外扩张并淡出 —— 与 `fxFlash` 的"填充径向辉光"视觉区分。

```ts
// type 扩展: kind: 'flash' | 'beam' | 'bolt' | 'dash' | 'aura'
export function fxAura(x: number, y: number, color: string, scale = 1): void {
  if (reducedMotion) return;
  fxs.push({ kind: 'aura', x, y, tx: x, ty: y, life: 0, maxLife: 12, color, size: TS * 0.6 * scale });
  trim(fxs, MAX_FX);
}
```

`drawFx` 内新增 `aura` 分支:半径随 `t` 从 0.4× 扩张到 ~2.2×,`globalAlpha = 1-t` 淡出,`strokeStyle` 为该色,`lineWidth` 从 ~3.5 收窄,`shadowBlur=10` 给一点辉光(用完归零)。`maxLife=12`(略长于 flash 的 9,让环多停一拍,读作"buff 已施加")。

**词汇表(可读性约定)**:持续自身 buff → 环(aura);瞬时/冲击 → 闪光/爆裂(flash/burst);指向性伤害 → 束/弹(beam/bolt);位移 → 残影(dash)。所以持续 buff 一眼能从冲击闪光里区分出来。

### 2. 逐效果映射(12 个裸效果)

| 效果 | 接的 fx | 颜色 | 说明 |
|---|---|---|---|
| `str_buff` | `fxAura(p.x,p.y,c)` | `#ff6b6b` | 力量环 |
| `def_buff`(铁皮) | `fxAura` | `#8d99ae` | 钢色环 |
| `shield`(魔法盾) | `fxAura` | `#4895ef` | 奥术蓝环 |
| `el_res_fire` | `fxAura` | `#ff7a45` | 火焰环 |
| `el_res_ice` | `fxAura` | `#7ec8e3` | 冰霜环 |
| `torch` | `fxAura(_,_,_,1.4)` | `#ffae42` | 加大琥珀环(视野扩散感) |
| `invis` | `fxAura` | `#9a2be2` | 淡紫环(渐隐) |
| `mapping` | `fxAura(_,_,_,2)` | `#ffd700` | 大金环(知识扩散) |
| `antidote` | `fxBurst(p.x,p.y,c,14)` | `#80ed99` | 绿色净化粒子 |
| `fear` | 每个受影响敌人 `fxBurst(e.x,e.y,c,10)` | `#6a3a8a` | 每敌脚下暗紫涟漪 |
| `bear_trap` | `fxBurst(p.x,p.y,c,8)` | `#a0522d` | 放置点金属咬合碎屑 |
| `recall` | 旧位 `fxFlash` + 新位 `fxFlash` | `#9b5de5` | 传送起终点闪光(旧位在移动赋值前取) |

- `fxAura` 覆盖 8 个(buff 族 + mapping),`fxBurst` 覆盖 3 个,`fxFlash` 覆盖 1 个(recall)。
- 附带 `flt`(浮动文字)补 2-3 处:`bear_trap` → `flt(p.x,p.y,'🐾','#a0522d')`、`recall` → 旧位 `flt('⮐','#9b5de5')`。核心交付是 fx 调用,flt 是可选增甜。
- **`recall` 实现注意**:先取 `const ox=p.x, oy=p.y;` 再赋值 `p.x=rm.cx; p.y=rm.cy;`,然后 `fxFlash(ox,oy,...)` + `fxFlash(p.x,p.y,...)`,否则旧位坐标已被覆盖。
- **`fear` 实现注意**:既有 `fear` 分支已 `filter` 出 `nb`(半径 5 内非盟友敌)并 `forEach(e => e.feared=...)`;fx 在同一 `forEach` 里对每个 `e` 加 `fxBurst(e.x,e.y,'#6a3a8a',10)` 即可。

### 3. 文件改动面

- `src/fx.ts`:`FxKind` 加 `'aura'`;新增 `fxAura` 导出;`drawFx` 加 `aura` 分支。
- `src/items.ts`:在 `useItem` 的 12 个裸 `case` 里加对应 fx 调用(其中 `fear` 在既有 forEach 内、`recall` 注意旧位取值)。

---

## Non-goals

- **不改**已有 fx 的项(heal/mana/ward/haste/fireball/lightning/blizzard/holy_blast/summon_ally/bomb/throw_knife/holy_water/teleport/smoke_bomb)——它们动画已就位,不碰。
- **不做 buff 到期 fx**(str_buff 等到期时无动画)——超出"使用卷轴/药水"的反馈范围,YAGNI。
- **不做新原语以外的引擎重构**——`fxAura` 是 additive,不动既有 4 种 kind 的行为。
- reducedMotion 继承(既已守卫),无额外工作。

---

## Testing and validation

- `npm run typecheck` + `npm run build` 必过。
- **无单元测试**(针对新 aura 分支)——happy-dom 无 canvas2d `getContext`,fx 类热路径没法单测(与既有 `fx.ts` 全无单测一致);靠 typecheck + build + 视觉确认。
- **视觉确认**(headless 或手动):挨个用这 12 个道具,确认各触发一个可辨动画;确认 reducedMotion 下全静默;确认既有道具的 fx 无回归。
