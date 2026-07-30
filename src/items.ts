// Item generation, use, equip, inventory management
import type { Item } from './types.js';
import { G, lang } from './state.js';
import { MH, MW, TL, getMaxInv, getMaxConsInv, getGearInvMax } from './config.js';
import { rng, pick, dst, clamp } from './utils.js';
import { snd } from './audio.js';
import { flt, shake, burstSmoke } from './effects.js';
import { fxBeam, fxBolt, fxBurst, fxFlash } from './fx.js';
import { t, rareName, itemName, RARITY_C } from './i18n.js';
import { ALL_WEAPONS, ALL_ARMORS, ALL_ACCESSORIES, ALL_POTIONS, ALL_SCROLLS, ALL_CONSUMABLES, FOODS } from './data.js';
import { addMsg } from './messages.js';
import { recalc, checkLevelUp, killEnemy } from './combat.js';

// --- Item generation ---

export function genItem(floor: number): Item {
  // Gear (weapon+armor+accessory) drop chance deliberately lowered so the
  // tightly-capped gear pool isn't constantly overflowing to gold. Consumables
  // and scrolls dominate instead, matching their larger inventory cap.
  const r = Math.random();
  if (r < .12) return genWeapon(floor);   // 12% (was 24%)
  if (r < .22) return genArmor(floor);    // 10% (was 20%)
  if (r < .34) return genAcc(floor);      // 12%
  if (r < .52) return genPotion(floor);   // 18%
  if (r < .70) return genScroll(floor);   // 18%
  if (r < .88) return genConsumable(floor);// 18%
  return genFood(floor);                  // 12%
}

// --- Inventory category helpers (per-pool caps) ---

export function isGear(it: Item): boolean {
  return it.type === 'weapon' || it.type === 'armor' || it.type === 'accessory';
}
export function isConsumable(it: Item): boolean {
  return it.type === 'scroll' || it.type === 'consumable' || it.type === 'potion';
}

export function genWeapon(f: number): Item {
  const mr = Math.min(4, Math.floor(f / 3));
  const el = ALL_WEAPONS.filter(w => w.r <= mr);
  const b = pick(el);
  // Rarity scales bonus: higher rarity = larger bonus multiplier
  const rarityMult = 1 + b.r * 0.4;
  const bn = f > 5 ? Math.floor(rng(0, Math.floor(f / 5)) * rarityMult) : 0;
  const a = b.a + bn;
  return { type: 'weapon', name: itemName(b), atk: a, rarity: b.r, ch: b.ch, c: '#f4845f', desc: lang === 'zh' ? `攻击+${a}` : `ATK +${a}`, x: 0, y: 0, el: b.el, set: b.set };
}

export function genArmor(f: number): Item {
  const mr = Math.min(4, Math.floor(f / 3));
  const el = ALL_ARMORS.filter(a => a.r <= mr);
  const b = pick(el);
  const rarityMult = 1 + b.r * 0.4;
  const bn = f > 5 ? Math.floor(rng(0, Math.floor(f / 5)) * rarityMult) : 0;
  const d = b.d + bn;
  return { type: 'armor', name: itemName(b), def: d, rarity: b.r, ch: b.ch, c: '#7ec8e3', desc: lang === 'zh' ? `防御+${d}` : `DEF +${d}`, x: 0, y: 0, el: b.el, set: b.set };
}

export function genAcc(f: number): Item {
  const mr = Math.min(4, Math.floor(f / 4));
  const el = ALL_ACCESSORIES.filter(a => a.r <= mr);
  const b = pick(el);
  return { type: 'accessory', name: itemName(b), atk: b.a, def: b.d, hp: b.h, rarity: b.r, ch: b.ch, c: '#06d6a0', desc: lang === 'zh' ? `攻击+${b.a} 防御+${b.d} HP+${b.h}` : `ATK+${b.a} DEF+${b.d} HP+${b.h}`, x: 0, y: 0, set: b.set };
}

export function genPotion(f: number): Item {
  const mi = Math.min(ALL_POTIONS.length - 1, Math.floor(f / 2) + 2);
  const b = ALL_POTIONS[rng(0, mi)];
  const fs = 1 + f * .04;
  const v = Math.floor(b.v * fs);
  const desc = b.ef === 'heal' ? (lang === 'zh' ? `+${v} HP` : `+${v} HP`) :
    b.ef === 'mana' ? (lang === 'zh' ? `+${v} MP` : `+${v} MP`) :
    b.ef === 'str_buff' ? (lang === 'zh' ? `+${b.v}攻击 ${b.dur}回合` : `+${b.v} ATK ${b.dur}t`) :
    b.ef === 'def_buff' ? (lang === 'zh' ? `+${b.v}防御 ${b.dur}回合` : `+${b.v} DEF ${b.dur}t`) :
    b.ef === 'restore' ? (lang === 'zh' ? '完全恢复' : 'Full restore') :
    b.ef === 'poison' ? (lang === 'zh' ? `-${v} HP` : `-${v} HP`) :
    b.ef === 'el_res_fire' ? (lang === 'zh' ? `火焰抗性 ${b.dur}回合` : `Fire resist ${b.dur}t`) :
    b.ef === 'el_res_ice' ? (lang === 'zh' ? `冰霜抗性 ${b.dur}回合` : `Ice resist ${b.dur}t`) : '???';
  return { type: 'potion', name: itemName(b), ef: b.ef, val: v, dur: b.dur || 0, rarity: 0, ch: b.ch, c: b.c, desc, x: 0, y: 0 };
}

export function genScroll(f: number): Item {
  const mi = Math.min(ALL_SCROLLS.length - 1, Math.floor(f / 2) + 2);
  const b = ALL_SCROLLS[rng(0, mi)];
  const fs = 1 + f * .15;
  const v = Math.floor(b.v * fs);
  const desc = b.ef === 'fireball' ? (lang === 'zh' ? `${v}火焰范围伤害` : `${v} fire AoE`) :
    b.ef === 'lightning' ? (lang === 'zh' ? `${v}闪电伤害` : `${v} lightning`) :
    b.ef === 'teleport' ? (lang === 'zh' ? '传送' : 'Teleport') :
    b.ef === 'mapping' ? (lang === 'zh' ? '揭示地图' : 'Reveal map') :
    b.ef === 'shield' ? (lang === 'zh' ? `+${v}防御 ${b.dur}回合` : `+${v} DEF ${b.dur}t`) :
    b.ef === 'blizzard' ? (lang === 'zh' ? `${v}冰霜范围伤害` : `${v} ice AoE`) :
    b.ef === 'holy_blast' ? (lang === 'zh' ? `${v}神圣范围伤害` : `${v} holy AoE`) :
    b.ef === 'summon_ally' ? (lang === 'zh' ? '召唤友军' : 'Summon ally') :
    (lang === 'zh' ? '恐惧敌人' : 'Fear enemies');
  return { type: 'scroll', name: itemName(b), ef: b.ef, val: v, dur: b.dur || 0, rarity: 1, ch: b.ch, c: b.c, desc, x: 0, y: 0 };
}

export function genFood(f: number): Item {
  // Use FOODS array — higher rarity foods only appear on deeper floors
  const maxR = Math.min(3, Math.floor(f / 5));
  const eligible = FOODS.filter(fd => fd.r <= maxR);
  const b = eligible.length > 0 ? pick(eligible) : FOODS[0];
  const name = lang === 'zh' ? b.n.zh : b.n.en;
  const hpHeal = b.hpHeal || 0;
  const descParts = [lang === 'zh' ? `+${b.hungerRestore}饱食度` : `+${b.hungerRestore} hunger`];
  if (hpHeal > 0) descParts.push(lang === 'zh' ? `+${hpHeal}HP` : `+${hpHeal} HP`);
  return { type: 'food', name, ef: 'food', val: b.hungerRestore, hp: hpHeal, rarity: b.r, ch: b.ch, c: b.c, desc: descParts.join(' '), x: 0, y: 0 };
}

export function genConsumable(f: number): Item {
  // Bear Trap is a niche placeable — rare standalone roll (~7%, was a uniform
  // 15-25% share of consumables); otherwise pick from the rest by floor tier.
  const bt = ALL_CONSUMABLES.find(c => c.ef === 'bear_trap');
  const useTrap = f >= 3 && !!bt && Math.random() < 0.07;
  const pool = useTrap ? [bt!] : ALL_CONSUMABLES.filter(c => c.ef !== 'bear_trap');
  const mi = Math.min(pool.length - 1, Math.floor(f / 2) + 2);
  const b = pool[rng(0, mi)];
  const fs = 1 + f * .12;
  const v = Math.floor(b.v * fs);
  // Dynamic-value items show their scaled damage; everything else uses the
  // canonical description from the ConsumableDef (so holy_water/recall/invis/
  // antidote/smoke_bomb/ward/haste all show their real text, not a fallback).
  const desc = b.ef === 'bomb' ? (lang === 'zh' ? `${v}范围伤害` : `${v} AoE dmg`) :
    b.ef === 'throw_knife' ? (lang === 'zh' ? `${v}远程伤害` : `${v} ranged dmg`) :
    b.ef === 'torch' ? (lang === 'zh' ? `视野+${b.v} ${b.dur}回合` : `+${b.v} FOV ${b.dur}t`) :
    b.ef === 'bear_trap' ? (lang === 'zh' ? `${v}伤害陷阱` : `${v} dmg trap`) :
    (lang === 'zh' ? b.desc.zh : b.desc.en);
  return { type: 'consumable', name: itemName(b), ef: b.ef, val: v, dur: b.dur || 0, rarity: b.r, ch: b.ch, c: b.c, desc, x: 0, y: 0 };
}

// --- Late-bound: findNearestEnemy from skills/enemies module ---
let _findNearestEnemy: (() => any) | null = null;
export function setFindNearestEnemyFn(fn: () => any): void { _findNearestEnemy = fn; }

// --- Item use ---

export function useItem(idx: number): void {
  if (!G || G.gameOver || idx < 0 || idx >= G.player.inv.length) return;
  const item = G.player.inv[idx];
  const p = G.player;

  if (item.type === 'food') { useFood(idx); return; }

  if (item.type === 'potion') {
    switch (item.ef) {
      case 'heal': { const raw = Math.floor((item.val || 0) * (1 + (p.healBonus || 0))); const h = Math.min(raw, p.maxHp - p.hp); p.hp += h; addMsg(lang === 'zh' ? `恢复${h}HP` : `Healed ${h} HP`, 'mh'); fxFlash(p.x, p.y, '#80ed99'); flt(p.x, p.y, `+${h}`, '#80ed99'); snd('heal'); break; }
      case 'mana': { const h = Math.min(item.val || 0, p.maxMp - p.mp); p.mp += h; addMsg(lang === 'zh' ? `恢复${h}MP` : `Restored ${h} MP`, 'mh'); fxFlash(p.x, p.y, '#4895ef'); flt(p.x, p.y, `+${h}MP`, '#4895ef'); snd('heal'); break; }
      case 'str_buff': p.buffs.push({ name: lang === 'zh' ? '力量' : 'Strength', type: 'str_buff', value: item.val || 0, turns: item.dur || 30 }); addMsg(`+${item.val} ATK ${item.dur}t`, 'mi'); break;
      case 'def_buff': p.buffs.push({ name: lang === 'zh' ? '铁皮' : 'Iron Skin', type: 'def_buff', value: item.val || 0, turns: item.dur || 30 }); addMsg(`+${item.val} DEF ${item.dur}t`, 'mi'); break;
      case 'restore': p.hp = p.maxHp; p.mp = p.maxMp; addMsg(lang === 'zh' ? '完全恢复！' : 'Fully restored!', 'mh'); flt(p.x, p.y, 'FULL', '#ffd700'); snd('heal'); break;
      case 'poison': p.hp -= item.val || 0; addMsg(lang === 'zh' ? `毒药！-${item.val}HP！` : `Poison! -${item.val} HP!`, 'mc'); flt(p.x, p.y, `-${item.val}`, '#32cd32'); snd('trap'); if (p.hp <= 0) playerDeath(lang === 'zh' ? '毒药' : 'poison'); break;
      case 'el_res_fire': p.buffs.push({ name: lang === 'zh' ? '火焰抗性' : 'Fire Resist', type: 'el_res_fire', value: item.val || 50, turns: item.dur || 30 }); addMsg(lang === 'zh' ? `🔥 火焰抗性提升！` : `🔥 Fire resistance up!`, 'mi'); break;
      case 'el_res_ice': p.buffs.push({ name: lang === 'zh' ? '冰霜抗性' : 'Ice Resist', type: 'el_res_ice', value: item.val || 50, turns: item.dur || 30 }); addMsg(lang === 'zh' ? `❄ 冰霜抗性提升！` : `❄ Ice resistance up!`, 'mi'); break;
    }
    p.inv.splice(idx, 1); recalc(); endTurn();
  } else if (item.type === 'scroll') {
    if (p.mp < 3) { addMsg(t('noMP'), 'mi'); return; }
    p.mp -= 3; snd('spell');
    switch (item.ef) {
      case 'fireball': {
        let k = 0;
        const es = G.enemies.filter(e => !e.isAlly && dst(p.x, p.y, e.x, e.y) <= 4);
        fxFlash(p.x, p.y, '#ff4500', 1.4);
        for (const e of es) { fxBurst(e.x, e.y, '#ff4500', 10, 1); const d = Math.floor((item.val || 0) * p.spellPower); e.hp -= d; flt(e.x, e.y, `-${d}`, '#ff4500'); if (e.hp <= 0) { k++; killEnemy(e); } }
        G.enemies = G.enemies.filter(e => e.hp > 0 || e.isAlly);
        addMsg(lang === 'zh' ? `火球术！命中${es.length}个，击杀${k}个！` : `Fireball! Hit ${es.length}, killed ${k}!`, 'mc'); shake(); checkLevelUp(); break;
      }
      case 'lightning': {
        let k = 0;
        const es = G.enemies.filter(e => !e.isAlly && p.visible?.[e.y]?.[e.x]);
        for (const e of es) { fxBeam(p.x, p.y, e.x, e.y, '#ffd700'); const d = Math.floor((item.val || 0) * p.spellPower); e.hp -= d; flt(e.x, e.y, `-${d}`, '#ffd700'); if (e.hp <= 0) { k++; killEnemy(e); } }
        G.enemies = G.enemies.filter(e => e.hp > 0 || e.isAlly);
        addMsg(lang === 'zh' ? `闪电！命中${es.length}个！` : `Lightning! Hit ${es.length}!`, 'mc'); shake(); checkLevelUp(); break;
      }
      case 'teleport': {
        // Teleport to a room far from the current position (so the move is
        // always meaningful and never lands the player on top of a boss).
        const ranked = G.dungeon.rooms
          .map(rm => ({ rm, d: dst(rm.cx, rm.cy, p.x, p.y) }))
          .sort((a, b) => b.d - a.d);
        const pool = ranked.slice(0, Math.max(3, Math.ceil(ranked.length / 2)));
        const { rm } = pick(pool);
        p.x = rm.cx; p.y = rm.cy;
        addMsg(lang === 'zh' ? '传送！' : 'Teleported!', 'mi');
        fxFlash(p.x, p.y, '#9b5de5', 1.4); flt(p.x, p.y, '⚡传送', '#9b5de5');
        break;
      }
      case 'mapping': for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) p.explored[y][x] = true; addMsg(lang === 'zh' ? '地图已揭示！' : 'Map revealed!', 'mi'); break;
      case 'shield': p.buffs.push({ name: lang === 'zh' ? '魔法盾' : 'Magic Shield', type: 'shield', value: item.val || 0, turns: item.dur || 30 }); addMsg(`+${item.val} DEF ${item.dur}t`, 'mi'); break;
      case 'fear': { const nb = G.enemies.filter(e => !e.isAlly && dst(p.x, p.y, e.x, e.y) <= 5); nb.forEach(e => e.feared = rng(5, 10)); addMsg(lang === 'zh' ? `${nb.length}个敌人被恐惧！` : `${nb.length} enemies flee!`, 'mi'); break; }
      case 'blizzard': {
        let k = 0;
        const es = G.enemies.filter(e => !e.isAlly && dst(p.x, p.y, e.x, e.y) <= 5);
        for (const e of es) { fxBurst(e.x, e.y, '#00ced1', 8, 0.8); const d = Math.floor((item.val || 0) * p.spellPower); e.hp -= d; flt(e.x, e.y, `-${d}❄`, '#00ced1'); if (e.hp <= 0) { k++; killEnemy(e); } }
        G.enemies = G.enemies.filter(e => e.hp > 0 || e.isAlly);
        addMsg(lang === 'zh' ? `暴风雪！命中${es.length}个，击杀${k}个！` : `Blizzard! Hit ${es.length}, killed ${k}!`, 'mc'); shake(); checkLevelUp(); break;
      }
      case 'holy_blast': {
        let k = 0;
        const es = G.enemies.filter(e => !e.isAlly && dst(p.x, p.y, e.x, e.y) <= 5);
        for (const e of es) { fxBeam(p.x, p.y, e.x, e.y, '#ffd700'); const d = Math.floor((item.val || 0) * p.spellPower * (e.el === 'shadow' ? 1.5 : 1)); e.hp -= d; flt(e.x, e.y, `-${d}✨`, '#ffd700'); if (e.hp <= 0) { k++; killEnemy(e); } }
        G.enemies = G.enemies.filter(e => e.hp > 0 || e.isAlly);
        addMsg(lang === 'zh' ? `圣光！命中${es.length}个，击杀${k}个！` : `Holy blast! Hit ${es.length}, killed ${k}!`, 'mc'); shake(); checkLevelUp(); break;
      }
      case 'summon_ally': {
        const ally: any = {
          name: t('allyName'), ch: '☆', c: '#06d6a0', x: p.x, y: p.y,
          hp: Math.floor(p.maxHp * .3), maxHp: Math.floor(p.maxHp * .3),
          atk: Math.floor(p.atk * .6), def: Math.floor(p.def * .5),
          exp: 0, goldDrop: 0, ai: 'chase', stunned: 0, feared: 0,
          isAlly: true, el: 'holy', res: {}, skillCd: 0,
        };
        // Place near player — try all 4 cardinal directions
        const offsets: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [odx, ody] of offsets) {
          const nx = p.x + odx, ny = p.y + ody;
          if (nx >= 0 && nx < MW && ny >= 0 && ny < MH && G.dungeon.map[ny][nx] !== TL.WALL && G.dungeon.map[ny][nx] !== TL.VOID && !G.enemies.some(e => e.x === nx && e.y === ny)) {
            ally.x = nx; ally.y = ny; break;
          }
        }
        G.enemies.push(ally);
        addMsg(t('allyMsg'), 'msk'); fxFlash(ally.x, ally.y, '#06d6a0', 1.4); flt(ally.x, ally.y, '☆SUMMON', '#06d6a0'); break;
      }
    }
    p.inv.splice(idx, 1); recalc(); endTurn();
  } else if (item.type === 'consumable') {
    snd('spell');
    switch (item.ef) {
      case 'bomb': {
        const es = G.enemies.filter(e => !e.isAlly && dst(p.x, p.y, e.x, e.y) <= 3); let k = 0;
        fxBurst(p.x, p.y, '#ff4500', 24, 1.6); fxFlash(p.x, p.y, '#ff4500', 1.8);
        for (const e of es) { const d = Math.floor((item.val || 0) * p.spellPower); e.hp -= d; flt(e.x, e.y, `-${d}`, '#ff4500'); if (e.hp <= 0) { k++; killEnemy(e); } }
        G.enemies = G.enemies.filter(e => e.hp > 0 || e.isAlly);
        addMsg(lang === 'zh' ? `💣 炸弹！命中${es.length}个，击杀${k}个！` : `💣 Bomb! Hit ${es.length}, killed ${k}!`, 'mc'); shake(); checkLevelUp(); break;
      }
      case 'throw_knife': {
        const e = _findNearestEntity();
        if (e) { fxBolt(p.x, p.y, e.x, e.y, '#c0c0c0'); const d = Math.floor((item.val || 0) * p.spellPower); e.hp -= d; flt(e.x, e.y, `-${d}`, '#c0c0c0'); addMsg(lang === 'zh' ? `飞刀命中${e.name}！-${d}` : `Knife hits ${e.name}! -${d}`, 'mc'); snd('hit'); if (e.hp <= 0) killEnemy(e); }
        else addMsg(lang === 'zh' ? '没有目标' : 'No target', 'mi'); break;
      }
      case 'torch': p.buffs.push({ name: lang === 'zh' ? '照明' : 'Torch', type: 'torch', value: item.val || 5, turns: item.dur || 30 }); addMsg(lang === 'zh' ? `🔥 火把！视野+${item.val || 5}` : `🔥 Torch! +${item.val || 5} FOV`, 'mi'); break;
      case 'bear_trap': {
        const trap = { x: p.x, y: p.y, n: { en: 'Bear Trap', zh: '捕兽夹' }, dmg: item.val || 20, c: '#a0522d', ds: { en: 'The bear trap snaps!', zh: '捕兽夹咬合！' }, triggered: false, hidden: false, playerTrap: true };
        G.traps.push(trap); addMsg(lang === 'zh' ? '🐾 捕兽夹已放置！' : '🐾 Bear trap placed!', 'mi'); break;
      }
      case 'smoke_bomb': {
        // Real smoke cloud: particle burst + nearby enemies stop chasing (feared).
        const nb = G.enemies.filter(e => !e.isAlly && dst(p.x, p.y, e.x, e.y) <= 6);
        nb.forEach(e => { e.feared = rng(6, 11); flt(e.x, e.y, '💨', '#888'); });
        burstSmoke(p.x, p.y);
        addMsg(lang === 'zh' ? `💨 烟雾弹！浓烟弥漫，${nb.length}个敌人不再追击！` : `💨 Smoke bomb! ${nb.length} enemies stop chasing!`, 'mi'); snd('spell');
        break;
      }
      case 'ward': p.warded = true; fxFlash(p.x, p.y, '#4895ef', 1.2); addMsg(lang === 'zh' ? '🛡 护身石激活！下次受伤无效！' : '🛡 Ward activated! Next hit blocked!', 'mi'); break;
      case 'haste': p.freeTurn = true; fxFlash(p.x, p.y, '#ffd700', 1.2); addMsg(lang === 'zh' ? '⚡ 加速！获得额外行动！' : '⚡ Haste! Extra action!', 'mi'); break;
      case 'antidote': p.poisonTurns = 0; p.poisonDmg = 0; p.buffs.push({ name: lang === 'zh' ? '抗毒' : 'Antidote', type: 'antidote', value: 0, turns: 15 }); addMsg(lang === 'zh' ? '✨ 解毒！中毒已治愈！' : '✨ Poison cured!', 'mi'); snd('heal'); break;
      case 'holy_water': {
        const e = _findNearestEntity();
        if (e) { fxBolt(p.x, p.y, e.x, e.y, '#ffd700'); const isHolyWeak = (e.tags?.includes('undead') || e.tags?.includes('demon') || e.el === 'shadow'); const mult = isHolyWeak ? 2 : 1; const d = Math.floor((item.val || 0) * mult); e.hp -= d; flt(e.x, e.y, `-${d}✨`, '#ffd700'); addMsg(lang === 'zh' ? `圣水命中${e.name}！-${d}` : `Holy water hits ${e.name}! -${d}`, 'mc'); snd('spell'); if (e.hp <= 0) killEnemy(e); }
        else addMsg(lang === 'zh' ? '没有目标' : 'No target', 'mi'); break;
      }
      case 'recall': { const rm = G.dungeon.rooms[0]; p.x = rm.cx; p.y = rm.cy; addMsg(lang === 'zh' ? '传送回起点！' : 'Recalled to start!', 'mi'); break; }
      case 'invis': p.buffs.push({ name: lang === 'zh' ? '隐身' : 'Invisible', type: 'invis', value: 1, turns: 10 }); addMsg(lang === 'zh' ? '👁 你变得隐形了！10回合内敌人无法发现你。' : '👁 You are invisible for 10 turns!', 'mi'); break;
    }
    p.inv.splice(idx, 1); recalc(); endTurn();
  } else if (item.type === 'weapon' || item.type === 'armor' || item.type === 'accessory') {
    equipItem(idx);
  }
}

// Helper for throw_knife
function _findNearestEntity() {
  if (!G || !_findNearestEnemy) return null;
  return _findNearestEnemy();
}

// Late-bound endTurn to avoid circular dep with turn.ts
let _endTurn: (() => void) | null = null;
export function setEndTurnFn(fn: () => void): void { _endTurn = fn; }
function endTurn() { if (_endTurn) _endTurn(); }

// Late-bound playerDeath from combat
import { playerDeath } from './combat.js';

export function useFood(idx: number): void {
  if (!G) return;
  const item = G.player.inv[idx];
  const hungerVal = item.val || 30;
  const hpHeal = item.hp || 0;
  G.player.inv.splice(idx, 1);
  G.player.hunger = Math.min(G.player.maxHunger, G.player.hunger + hungerVal);
  let healMsg = '';
  if (hpHeal > 0) {
    const actual = Math.min(hpHeal, G.player.maxHp - G.player.hp);
    G.player.hp += actual;
    healMsg = ` +${actual}HP`;
    flt(G.player.x, G.player.y, `+${actual}`, '#80ed99');
  }
  addMsg(lang === 'zh' ? `食用${item.name}！饱食度+${hungerVal}${healMsg}` : `Ate ${item.name}! +${hungerVal} hunger${healMsg}`, 'mh'); snd('heal');
  endTurn();
}

// --- Equipment ---

// When gear is swapped out of an equipment slot, return it to inventory —
// unless the gear pool is already at its cap, in which case convert to gold.
function returnOldGearToInvOrGold(old: Item): void {
  if (!G) return;
  const p = G.player;
  let gearCount = 0;
  for (const it of p.inv) if (isGear(it)) gearCount++;
  if (gearCount < getGearInvMax()) {
    p.inv.push(old);
  } else {
    const gv = itemToGold(old); p.gold += gv;
    addMsg(lang === 'zh' ? `📦 ${old.name}（${rareName(old.rarity)}）→ ${gv}💰` : `📦 ${old.name} (${rareName(old.rarity)}) → ${gv}💰`, 'mp');
  }
}

export function equipItem(idx: number): void {
  if (!G) return;
  const p = G.player;
  const item = p.inv[idx];
  if (!item || (item.type !== 'weapon' && item.type !== 'armor' && item.type !== 'accessory')) return;

  let old: Item | null = null;
  if (item.type === 'accessory') {
    // Two accessory slots: prefer an empty one; if both filled, replace the weaker.
    if (!p.eq.accessory) p.eq.accessory = item;
    else if (!p.eq.accessory2) p.eq.accessory2 = item;
    else {
      const target: 'accessory' | 'accessory2' = itemScore(p.eq.accessory) <= itemScore(p.eq.accessory2) ? 'accessory' : 'accessory2';
      old = p.eq[target];
      p.eq[target] = item;
    }
  } else {
    old = p.eq[item.type];
    p.eq[item.type] = item;
  }
  const realIdx = p.inv.indexOf(item);
  if (realIdx >= 0) p.inv.splice(realIdx, 1);
  for (let i = 0; i < 9; i++) { if (p.quickSlots[i] === item) p.quickSlots[i] = null; }
  if (old) returnOldGearToInvOrGold(old);
  recalc();
  addMsg(t('equipped') + item.name, 'mi');
  snd('pickup');
  endTurn();
}

export function quickQuaff(): void {
  if (!G || G.gameOver) return;
  const i = G.player.inv.findIndex(x => x.type === 'potion' && (x.ef === 'heal' || x.ef === 'mana'));
  if (i === -1) { addMsg(t('noPotion'), 'mi'); return; }
  useItem(i);
}

export function quickRead(): void {
  if (!G || G.gameOver) return;
  const i = G.player.inv.findIndex(x => x.type === 'scroll');
  if (i === -1) { addMsg(t('noScroll'), 'mi'); return; }
  useItem(i);
}

// --- Hotbar ---

export function renderHotbar(): void {
  if (!G) return;
  const hb = document.getElementById('hotbar');
  if (!hb) return;
  const p = G.player;
  let html = '';
  for (let i = 0; i < 9; i++) {
    const item = p.quickSlots[i];
    if (item) {
      const invIdx = p.inv.indexOf(item);
      if (invIdx === -1) {
        p.quickSlots[i] = null;
        html += `<div class="hb-slot empty"><span class="hb-key">${i + 1}</span><span class="hb-icon" style="color:#555">·</span></div>`;
        continue;
      }
      html += `<div class="hb-slot" tabindex="0" role="button" style="border-color:${RARITY_C[item.rarity]}44" data-qs="${i}" title="${item.name}: ${item.desc}"><span class="hb-key">${i + 1}</span><span class="hb-icon" style="color:${item.c}">${item.ch}</span><span class="hb-sub" style="color:${RARITY_C[item.rarity]}">${item.name}</span></div>`;
    } else {
      html += `<div class="hb-slot empty" data-qs="${i}"><span class="hb-key">${i + 1}</span><span class="hb-icon" style="color:#555">·</span></div>`;
    }
  }
  hb.innerHTML = html;
  // Bind click + keyboard activation (Enter/Space) so slots are reachable without a mouse
  hb.querySelectorAll('.hb-slot').forEach(el => {
    const slot = el as HTMLElement;
    const handler = () => {
      const qsIdx = parseInt(slot.dataset.qs || '0');
      useQuickSlot(qsIdx);
    };
    slot.addEventListener('click', handler);
    slot.addEventListener('keydown', (ev: KeyboardEvent) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); handler(); }
    });
  });
}

export function useQuickSlot(slotIdx: number): void {
  if (!G || G.gameOver) return;
  const p = G.player;
  const item = p.quickSlots[slotIdx];
  if (!item) { addMsg(lang === 'zh' ? '该快捷栏位为空' : 'Empty quick slot', 'mi'); return; }
  const invIdx = p.inv.indexOf(item);
  if (invIdx === -1) { p.quickSlots[slotIdx] = null; renderHotbar(); return; }
  useItem(invIdx);
  if (!p.inv.includes(item)) {
    p.quickSlots[slotIdx] = null;
    refillQuickSlot(slotIdx, item); // point 7: auto-refill from bag
  }
  renderHotbar();
}

// When a quick-slot consumable is used up, randomly refill that slot from the
// bag, preferring the same item type / effect for continuity (point 7).
function refillQuickSlot(slotIdx: number, consumed: Item): void {
  if (!G) return;
  const p = G.player;
  const candidates = p.inv.filter(it =>
    (it.type === 'potion' || it.type === 'scroll' || it.type === 'consumable' || it.type === 'food')
    && !p.quickSlots.includes(it)
  );
  if (!candidates.length) return;
  let pool = candidates.filter(it => it.type === consumed.type);
  if (!pool.length) pool = candidates;
  const sameEf = pool.filter(it => it.ef === consumed.ef);
  const chosen = sameEf.length ? pick(sameEf) : pick(pool);
  p.quickSlots[slotIdx] = chosen;
  addMsg(lang === 'zh' ? `⚡ ${chosen.name} 已自动装入快捷栏 ${slotIdx + 1}` : `⚡ ${chosen.name} auto-filled slot ${slotIdx + 1}`, 'mi');
}

function autoAssignQuickSlot(item: Item): void {
  if (!G) return;
  const p = G.player;
  if (item.type !== 'potion' && item.type !== 'scroll' && item.type !== 'food' && item.type !== 'consumable') return;
  if (p.quickSlots.includes(item)) return;
  for (let i = 0; i < 9; i++) { if (!p.quickSlots[i]) { p.quickSlots[i] = item; return; } }
}

// --- Manual item management (drop / assign quick slot) — point 9 ---

// Drop an inventory item: convert to gold (best available sink for unwanted gear/consumables).
export function dropItem(idx: number): void {
  if (!G || G.gameOver || idx < 0 || idx >= G.player.inv.length) return;
  const p = G.player;
  const item = p.inv[idx];
  const gv = itemToGold(item);
  for (let i = 0; i < 9; i++) { if (p.quickSlots[i] === item) p.quickSlots[i] = null; }
  p.inv.splice(idx, 1); p.gold += gv;
  addMsg(lang === 'zh' ? `🗑 丢弃了 ${item.name}（${rareName(item.rarity)}）→ ${gv}💰` : `🗑 Dropped ${item.name} (${rareName(item.rarity)}) → ${gv}💰`, 'mp');
  snd('pickup');
}

// Sell an inventory item to a merchant for gold (slightly better than auto-convert).
export function sellItem(idx: number): void {
  if (!G || G.gameOver || idx < 0 || idx >= G.player.inv.length) return;
  const p = G.player;
  const item = p.inv[idx];
  const gv = Math.floor(itemToGold(item) * 1.5);
  for (let i = 0; i < 9; i++) { if (p.quickSlots[i] === item) p.quickSlots[i] = null; }
  p.inv.splice(idx, 1); p.gold += gv;
  addMsg(lang === 'zh' ? `💰 卖出 ${item.name}（${rareName(item.rarity)}）→ ${gv}💰` : `💰 Sold ${item.name} (${rareName(item.rarity)}) → ${gv}💰`, 'mp');
  snd('pickup');
}

// Assign an inventory item to a chosen quick slot (only usable item types).
export function assignToQuickSlot(idx: number, slotIdx: number): void {
  if (!G || slotIdx < 0 || slotIdx > 8 || idx < 0 || idx >= G.player.inv.length) return;
  const p = G.player;
  const item = p.inv[idx];
  if (item.type !== 'potion' && item.type !== 'scroll' && item.type !== 'food' && item.type !== 'consumable') {
    addMsg(lang === 'zh' ? '该物品无法放入快捷栏' : 'Cannot put that in a quick slot', 'mi'); return;
  }
  for (let i = 0; i < 9; i++) { if (p.quickSlots[i] === item) p.quickSlots[i] = null; }
  p.quickSlots[slotIdx] = item;
  addMsg(lang === 'zh' ? `⚡ 已将 ${item.name} 装入快捷栏 ${slotIdx + 1}` : `⚡ ${item.name} → quick slot ${slotIdx + 1}`, 'mi');
  renderHotbar();
}

// --- Inventory management ---

export function itemToGold(item: Item): number {
  return ([5, 12, 25, 50, 100][item.rarity] || 5) + rng(1, Math.max(1, G?.floor || 1));
}

function isBetter(ni: Item, oi: Item): boolean {
  if (ni.type === 'weapon') return (ni.atk || 0) > (oi.atk || 0);
  if (ni.type === 'armor') return (ni.def || 0) > (oi.def || 0);
  if (ni.type === 'accessory') return ((ni.atk || 0) + (ni.def || 0) + (ni.hp || 0)) > ((oi.atk || 0) + (oi.def || 0) + (oi.hp || 0));
  return false;
}

function itemScore(it: Item): number {
  if (it.type === 'weapon') return it.atk || 0;
  if (it.type === 'armor') return it.def || 0;
  if (it.type === 'accessory') return (it.atk || 0) + (it.def || 0) + (it.hp || 0);
  return it.val || 0;
}

// Would picking up `item` auto-equip it (fill an empty slot or beat a worn piece)?
// Used so better-than-worn gear equips even when the gear pool is full, instead of
// being sold as overflow (the old "sometimes sells" bug).
function isEquipUpgrade(item: Item): boolean {
  if (!G) return false;
  const p = G.player;
  if (item.type === 'weapon' || item.type === 'armor') {
    const cur = p.eq[item.type];
    return !cur || isBetter(item, cur);
  }
  if (item.type === 'accessory') {
    const a1 = p.eq.accessory, a2 = p.eq.accessory2;
    if (!a1 || !a2) return true;                       // empty slot → equip
    const weaker = itemScore(a1) <= itemScore(a2) ? a1 : a2;
    return isBetter(item, weaker);
  }
  return false;
}

function handleAutoEquip(item: Item): void {
  if (!G) return;
  const p = G.player;
  if (item.type === 'weapon' || item.type === 'armor') {
    const cur = p.eq[item.type];
    if (!cur || isBetter(item, cur)) {
      const idx = p.inv.indexOf(item);
      if (idx >= 0) {
        p.eq[item.type] = item; p.inv.splice(idx, 1);
        for (let i = 0; i < 9; i++) { if (p.quickSlots[i] === item) p.quickSlots[i] = null; }
        if (cur) { returnOldGearToInvOrGold(cur); addMsg(lang === 'zh' ? `⚔ 装备了 ${item.name}（替换${cur.name}）` : `⚔ Equipped ${item.name} (replaced ${cur.name})`, 'mi'); }
        else { addMsg(t('equipped') + item.name, 'mi'); }
        recalc(); snd('pickup');
      }
    }
  } else if (item.type === 'accessory') {
    // Two accessory slots: fill an empty one, else replace the weaker if the new one is better.
    const a1 = p.eq.accessory, a2 = p.eq.accessory2;
    let target: 'accessory' | 'accessory2' | null = null;
    if (!a1) target = 'accessory';
    else if (!a2) target = 'accessory2';
    else {
      const weaker = itemScore(a1) <= itemScore(a2) ? a1 : a2;
      if (isBetter(item, weaker)) target = weaker === a1 ? 'accessory' : 'accessory2';
    }
    if (target) {
      const idx = p.inv.indexOf(item);
      if (idx >= 0) {
        const old = p.eq[target];
        p.eq[target] = item; p.inv.splice(idx, 1);
        for (let i = 0; i < 9; i++) { if (p.quickSlots[i] === item) p.quickSlots[i] = null; }
        if (old) { returnOldGearToInvOrGold(old); addMsg(lang === 'zh' ? `💍 装备了 ${item.name}（替换${old.name}）` : `💍 Equipped ${item.name} (replaced ${old.name})`, 'mi'); }
        else { addMsg(t('equipped') + item.name, 'mi'); }
        recalc(); snd('pickup');
      }
    }
  } else { autoAssignQuickSlot(item); }
}

export function addItemWithOverflow(item: Item): void {
  if (!G) return;
  const p = G.player;
  // Food is consumed immediately on pickup, never stored.
  if (item.type === 'food') {
    p.hunger = Math.min(p.maxHunger, p.hunger + (item.val || 30));
    // Higher-tier foods also heal HP (Elven Feast, Divine Ambrosia) — the item's
    // description advertises this, so apply it here too instead of silently
    // dropping it (food is eaten on pickup and never reaches useItem/useFood).
    const hpHeal = item.hp || 0;
    let healMsg = '';
    if (hpHeal > 0) {
      const actual = Math.min(hpHeal, p.maxHp - p.hp);
      p.hp += actual; healMsg = ` +${actual}HP`;
      flt(p.x, p.y, `+${actual}`, '#80ed99');
    }
    addMsg(lang === 'zh' ? `食用${item.name}！饱食度+${item.val || 30}${healMsg}` : `Ate ${item.name}! +${item.val || 30} hunger${healMsg}`, 'mh'); snd('heal'); return;
  }

  // A better-than-worn piece always equips (replaces the worse worn slot) and is
  // never sold as overflow — even when the gear pool is full. Push it temporarily
  // so the existing handleAutoEquip can swap it in (old gear → returnOldGearToInvOrGold).
  if (isEquipUpgrade(item)) {
    p.inv.push(item);
    handleAutoEquip(item);
    return;
  }

  // Determine which pool this item belongs to and its cap.
  const gear = isGear(item);
  const cons = isConsumable(item);
  const sameCat = (it: Item) => gear ? isGear(it) : cons ? isConsumable(it) : (!isGear(it) && !isConsumable(it));
  const cap = gear ? getGearInvMax() : cons ? getMaxConsInv() : getMaxInv();

  // Count how many items already occupy this pool.
  let poolCount = 0;
  for (const it of p.inv) if (sameCat(it)) poolCount++;

  if (poolCount < cap) {
    p.inv.push(item); addMsg(t('pickedUp') + item.name, 'mp'); snd('pickup');
    handleAutoEquip(item); return;
  }

  // Pool full — find the weakest item in the SAME pool (lowest rarity, then lowest score).
  let worstIdx = -1, worstScore = Infinity, worstItem: Item | null = null;
  for (let i = 0; i < p.inv.length; i++) {
    const it = p.inv[i];
    if (!sameCat(it)) continue;
    const sc = it.rarity * 1e6 + itemScore(it);
    if (sc < worstScore) { worstScore = sc; worstIdx = i; worstItem = it; }
  }
  const newScore = item.rarity * 1e6 + itemScore(item);

  if (worstItem && newScore > worstScore) {
    // New item is better than the weakest stored piece: convert the weakest to gold, store new.
    const gv = itemToGold(worstItem);
    for (let i = 0; i < 9; i++) { if (p.quickSlots[i] === worstItem) p.quickSlots[i] = null; }
    p.inv.splice(worstIdx, 1); p.gold += gv;
    addMsg(lang === 'zh' ? `📦 ${worstItem.name}（${rareName(worstItem.rarity)}）→ ${gv}💰` : `📦 ${worstItem.name} (${rareName(worstItem.rarity)}) → ${gv}💰`, 'mp');
    p.inv.push(item); addMsg(t('pickedUp') + item.name, 'mp'); snd('pickup'); handleAutoEquip(item);
  } else {
    // New item is the weakest: convert it straight to gold.
    const gv = itemToGold(item); p.gold += gv;
    addMsg(lang === 'zh' ? `📦 ${item.name}（${rareName(item.rarity)}）→ ${gv}💰` : `📦 ${item.name} (${rareName(item.rarity)}) → ${gv}💰`, 'mp'); snd('pickup');
  }
}
