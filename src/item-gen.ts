// Item generation — extracted from items.ts (Polish-B Q6) for focus + testability.
// Pure-ish leaf: data tables + utils + state.lang + i18n.itemName. No combat/render deps.
import type { Item } from './types.js';
import { lang } from './state.js';
import { rng, pick } from './utils.js';
import { itemName, t, tMsg, tx } from './i18n.js';
import { ALL_WEAPONS, ALL_ARMORS, ALL_ACCESSORIES, ALL_POTIONS, ALL_SCROLLS, ALL_CONSUMABLES, FOODS, ENDLESS_GEAR } from './data.js';

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
  return { type: 'weapon', id: b.id, name: itemName(b), atk: a, rarity: b.r, ch: b.ch, c: '#f4845f', desc: tMsg('ig.atkPlus', String(a)), x: 0, y: 0, el: b.el, set: b.set };
}

export function genArmor(f: number): Item {
  const mr = Math.min(4, Math.floor(f / 3));
  const el = ALL_ARMORS.filter(a => a.r <= mr);
  const b = pick(el);
  const rarityMult = 1 + b.r * 0.4;
  const bn = f > 5 ? Math.floor(rng(0, Math.floor(f / 5)) * rarityMult) : 0;
  const d = b.d + bn;
  return { type: 'armor', id: b.id, name: itemName(b), def: d, rarity: b.r, ch: b.ch, c: '#7ec8e3', desc: tMsg('ig.defPlus', String(d)), x: 0, y: 0, el: b.el, set: b.set };
}

export function genAcc(f: number): Item {
  const mr = Math.min(4, Math.floor(f / 4));
  const el = ALL_ACCESSORIES.filter(a => a.r <= mr);
  const b = pick(el);
  return { type: 'accessory', id: b.id, name: itemName(b), atk: b.a, def: b.d, hp: b.h, rarity: b.r, ch: b.ch, c: '#06d6a0', desc: tMsg('ig.accStats', String(b.a), String(b.d), String(b.h)), x: 0, y: 0, set: b.set };
}

export function genPotion(f: number): Item {
  const mi = Math.min(ALL_POTIONS.length - 1, Math.floor(f / 2) + 2);
  const b = ALL_POTIONS[rng(0, mi)];
  const fs = 1 + f * .04;
  const v = Math.floor(b.v * fs);
  const desc = b.ef === 'heal' ? tMsg('ig.hpPlus', String(v)) :
    b.ef === 'mana' ? tMsg('ig.mpPlus', String(v)) :
    b.ef === 'str_buff' ? tMsg('ig.atkBuff', String(b.v), String(b.dur)) :
    b.ef === 'def_buff' ? tMsg('ig.defBuff', String(b.v), String(b.dur)) :
    b.ef === 'restore' ? t('ig.fullRestore') :
    b.ef === 'poison' ? tMsg('ig.hpMinus', String(v)) :
    b.ef === 'el_res_fire' ? tMsg('ig.fireResist', String(b.dur)) :
    b.ef === 'el_res_ice' ? tMsg('ig.iceResist', String(b.dur)) : '???';
  return { type: 'potion', id: b.id, name: itemName(b), ef: b.ef, val: v, dur: b.dur || 0, rarity: 0, ch: b.ch, c: b.c, desc, x: 0, y: 0 };
}

export function genScroll(f: number): Item {
  const mi = Math.min(ALL_SCROLLS.length - 1, Math.floor(f / 2) + 2);
  const b = ALL_SCROLLS[rng(0, mi)];
  const fs = 1 + f * .15;
  const v = Math.floor(b.v * fs);
  const desc = b.ef === 'fireball' ? tMsg('ig.fireball', String(v)) :
    b.ef === 'lightning' ? tMsg('ig.lightning', String(v)) :
    b.ef === 'teleport' ? t('ig.teleport') :
    b.ef === 'mapping' ? t('ig.mapping') :
    b.ef === 'shield' ? tMsg('ig.defBuff', String(v), String(b.dur)) :
    b.ef === 'blizzard' ? tMsg('ig.blizzard', String(v)) :
    b.ef === 'holy_blast' ? tMsg('ig.holyBlast', String(v)) :
    b.ef === 'summon_ally' ? t('ig.summonAlly') :
    t('ig.fearEnemies');
  return { type: 'scroll', id: b.id, name: itemName(b), ef: b.ef, val: v, dur: b.dur || 0, rarity: 1, ch: b.ch, c: b.c, desc, x: 0, y: 0 };
}

export function genFood(f: number): Item {
  // Use FOODS array — higher rarity foods only appear on deeper floors
  const maxR = Math.min(3, Math.floor(f / 5));
  const eligible = FOODS.filter(fd => fd.r <= maxR);
  const b = eligible.length > 0 ? pick(eligible) : FOODS[0];
  const name = tx(b.n);
  const hpHeal = b.hpHeal || 0;
  const descParts = [tMsg('ig.hungerPlus', String(b.hungerRestore))];
  if (hpHeal > 0) descParts.push(tMsg('ig.hpFood', String(hpHeal)));
  return { type: 'food', id: b.id, name, ef: 'food', val: b.hungerRestore, hp: hpHeal, rarity: b.r, ch: b.ch, c: b.c, desc: descParts.join(' '), x: 0, y: 0 };
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
  const desc = b.ef === 'bomb' ? tMsg('ig.bomb', String(v)) :
    b.ef === 'throw_knife' ? tMsg('ig.throwKnife', String(v)) :
    b.ef === 'torch' ? tMsg('ig.torch', String(b.v), String(b.dur)) :
    b.ef === 'bear_trap' ? tMsg('ig.bearTrap', String(v)) :
    tx(b.desc);
  return { type: 'consumable', id: b.id, name: itemName(b), ef: b.ef, val: v, dur: b.dur || 0, rarity: b.r, ch: b.ch, c: b.c, desc, x: 0, y: 0 };
}

// ===== Endless-exclusive gear (Task 1) =====
// endlessLuckMult: endless-gear drop multiplier from endless_luck meta upgrade (Task 4).
export { endlessLuckMult } from './meta.js';

// genEndlessGear: pull from the ENDLESS_GEAR pool (rarity 5, themed) and scale
// stats with floor. bonus = floor((floor-41)/5*2) → F41:0 / F60:7 / F100:23.
// Weapons/armors get the scaling bonus; accessories use fixed base stats (their
// value is the set routing, not raw power). Each piece carries its `set` tag so
// the void_gear/abyss_gear/astral_gear set bonuses activate on equip.
//
// pick() is called per-branch (not on a union ternary) so TS narrows each piece
// to its exact shape (weapons have a/el, armors d/el?, accessories a/d/h).
export function genEndlessGear(floor: number, type?: 'weapon' | 'armor' | 'accessory'): Item {
  const t = type ?? (['weapon', 'armor', 'accessory'] as const)[Math.floor(Math.random() * 3)];
  // Brief documents F41:0 / F60:7 / F100:23 — that requires floor() to apply
  // AFTER the *2 (continuous scaling), i.e. Math.floor((floor-41)/5*2), not
  // Math.floor((floor-41)/5)*2 (which gives F60:6/F100:22). Implemented to
  // match the brief's documented values.
  const bonus = Math.floor((floor - 41) / 5 * 2);  // F41:0 / F60:7 / F100:23
  if (t === 'weapon') {
    const b = pick(ENDLESS_GEAR.weapons);
    return { type: 'weapon', id: b.id, name: tx(b.n), atk: b.a + bonus, rarity: 5, ch: b.ch, c: '#9b5de5', desc: tMsg('el.atkPlus', String(b.a + bonus)), x: 0, y: 0, el: b.el, set: b.set };
  }
  if (t === 'armor') {
    const b = pick(ENDLESS_GEAR.armors);
    return { type: 'armor', id: b.id, name: tx(b.n), def: b.d + bonus, rarity: 5, ch: b.ch, c: '#7ec8e3', desc: tMsg('el.defPlus', String(b.d + bonus)), x: 0, y: 0, el: b.el, set: b.set };
  }
  const b = pick(ENDLESS_GEAR.accessories);
  return { type: 'accessory', id: b.id, name: tx(b.n), atk: b.a, def: b.d, hp: b.h, rarity: 5, ch: b.ch, c: '#06d6a0', desc: tMsg('el.accStats', String(b.a), String(b.d), String(b.h)), x: 0, y: 0, set: b.set };
}
