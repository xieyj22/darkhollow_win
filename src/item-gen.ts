// Item generation — extracted from items.ts (Polish-B Q6) for focus + testability.
// Pure-ish leaf: data tables + utils + state.lang + i18n.itemName. No combat/render deps.
import type { Item } from './types.js';
import { lang } from './state.js';
import { rng, pick } from './utils.js';
import { itemName } from './i18n.js';
import { ALL_WEAPONS, ALL_ARMORS, ALL_ACCESSORIES, ALL_POTIONS, ALL_SCROLLS, ALL_CONSUMABLES, FOODS } from './data.js';

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
