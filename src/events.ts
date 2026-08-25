// Random events, traps, tile effects
import type { Trap, Item } from './types.js';
import { G, lang, eventOpen, eventActions, setEventOpen, setEventActions } from './state.js';
import { MH, MW, TL } from './config.js';
import { rng, pick, dst } from './utils.js';
import { snd } from './audio.js';
import { flt, shake } from './effects.js';
import { fxAura } from './fx.js';
import { t, tMsg, tx } from './i18n.js';
import { bridge } from './bridge.js';
import { addMsg } from './messages.js';
import { genItem, genWeapon, genArmor, genAcc, addItemWithOverflow, itemToGold } from './items.js';
import { recalc, playerDeath, applyCorruption } from './combat.js';
import { genEndlessGear } from './item-gen.js';
import { grantRelic, hasRelic } from './relics.js';
import { RELICS, ENEMIES } from './data.js';
import { updateUI, render } from './render.js';
import { enterBranch, exitBranch } from './game.js';
import { EVENT_SITES, type EventSiteDef, type EventSiteId } from './event-sites.js';
import { makeEnemy } from './enemy-factory.js';

// Re-export for late-binding
export { updateUI, render } from './render.js';

// --- Random events ---

// Wandering merchant price scales with progression so gold keeps draining
// deeper into the run (point 3).
export function merchantPrice(): number {
  if (!G) return 30;
  return 30 + (G.floor - 1) * 8 + Math.floor(G.player.turns / 12) * 3;
}

export function showEvent(type: string): void {
  const popup = document.getElementById('event-popup')!;
  let actions: Array<() => void> = [];
  if (type === 'merchant') {
    const price = merchantPrice();
    document.getElementById('ev-title')!.textContent = t('merchantTitle');
    document.getElementById('ev-desc')!.textContent = t('merchantDesc');
    document.getElementById('ev-buttons')!.innerHTML =
      `<button class="evb" data-ea="0">[1] ${t('ev.buyMystery')} (-${price}💰)</button>` +
      `<button class="evb" data-ea="1">[2] ${t('ev.openBagSell')}</button>` +
      `<button class="evb" data-ea="2">[3] ${t('merchantLeave')}</button>`;
    actions = [merchantBuy, merchantSell, closeEvent];
  } else if (type === 'chest') {
    document.getElementById('ev-title')!.textContent = t('chestTitle');
    document.getElementById('ev-desc')!.textContent = t('chestDesc');
    document.getElementById('ev-buttons')!.innerHTML = `<button class="evb" data-ea="0">[1] ${t('chestOpen')}</button><button class="evb" data-ea="1">[2] ${t('chestLeave')}</button>`;
    actions = [chestOpen, closeEvent];
  }
  setEventOpen(true);
  setEventActions(actions);
  _bindEventBtns(actions);
  popup.style.display = 'block';
}

function _bindEventBtns(actions: Array<() => void>): void {
  const container = document.getElementById('ev-buttons')!;
  // Replace buttons to remove old listeners
  const btns = container.querySelectorAll('.evb');
  btns.forEach((btn, i) => {
    const clone = btn.cloneNode(true) as HTMLElement;
    btn.replaceWith(clone);
    clone.addEventListener('click', () => actions[i]());
  });
}

export function closeEvent(): void {
  setEventOpen(false);
  setEventActions([]);
  document.getElementById('event-popup')!.style.display = 'none';
  if (G) render(); // refresh the snapshot so consumed map entities (merchant/chest) disappear immediately
}

function merchantBuy(): void {
  if (!G) return;
  const price = merchantPrice();
  if (G.player.gold < price) { addMsg(t('merchantNoGold'), 'mi'); closeEvent(); return; }
  G.player.gold -= price;
  const item = genItem(G.floor + 3);
  if (item.rarity !== undefined) item.rarity = Math.min(4, item.rarity + 1);
  addMsg(t('merchantBought') + ' ' + item.name, 'me');
  addItemWithOverflow(item);
  snd('pickup'); closeEvent(); updateUI(); render();
}

function merchantSell(): void {
  if (!G) return;
  closeEvent();
  // Open inventory in sell mode (input.ts exposes this).
  bridge.openSellInv?.();
}

function chestOpen(): void {
  if (!G) return;
  if (Math.random() < .3) {
    const dmg = rng(10, 25); G.player.hp -= dmg;
    addMsg(t('chestBad') + ' -' + dmg + 'HP', 'mt'); snd('trap'); shake();
    if (G.player.hp <= 0) { playerDeath(t('ev.mimic')); closeEvent(); return; }
  } else {
    const cnt = rng(2, 4);
    for (let i = 0; i < cnt; i++) { const item = genItem(G.floor); item.x = G.player.x; item.y = G.player.y; G.items.push(item); }
    addMsg(t('chestGood'), 'me'); snd('chest');
  }
  closeEvent(); updateUI(); render();
}

// --- Trap checking ---

export function checkTraps(): void {
  if (!G || !G.traps) return;
  for (const trap of G.traps) {
    if (trap.triggered || trap.x !== G.player.x || trap.y !== G.player.y) continue;
    if (trap.hidden) trap.hidden = false;
    trap.triggered = true;
    addMsg(tx(trap.ds ? trap.ds : trap.n), 'mt');
    if (trap.dmg > 0) {
      G.player.hp -= trap.dmg; flt(G.player.x, G.player.y, `-${trap.dmg}`, '#f4845f'); snd('trap'); shake();
      addMsg(`${tx(trap.n)} -${trap.dmg}!`, 'mt');
      if (G.player.hp <= 0) { playerDeath(tx(trap.n)); return; }
    }
    if (trap.ef === 'poison_dot') {
      if (!G.player.buffs.some(b => b.type === 'antidote')) {
        G.player.poisonTurns = trap.dur || 5; G.player.poisonDmg = Math.floor(trap.dmg / (trap.dur || 5)) + 1;
      }
    }
    if (trap.ef === 'teleport') { const rm = pick(G.dungeon.rooms); G.player.x = rm.cx; G.player.y = rm.cy; addMsg(t('ev.teleported'), 'mi'); }
    if (trap.ef === 'holy_fire') {
      // Holy fire — burning DoT for `dur` turns (searing, not a poison — antidote won't help)
      G.player.poisonTurns = trap.dur || 3;
      G.player.poisonDmg = Math.max(1, Math.floor(trap.dmg / (trap.dur || 3)));
    }
    if (trap.ef === 'void_pull') {
      // Void rift drags nearby enemies adjacent to the player
      const g = G; if (!g) continue;
      const foes = g.enemies.filter(e => !e.isAlly && dst(g.player.x, g.player.y, e.x, e.y) <= 6 && dst(g.player.x, g.player.y, e.x, e.y) > 1.5);
      for (const e of foes) {
        const adj: Array<[number, number]> = [[g.player.x - 1, g.player.y], [g.player.x + 1, g.player.y], [g.player.x, g.player.y - 1], [g.player.x, g.player.y + 1]];
        for (const [ax, ay] of adj) {
          if (ax < 0 || ax >= MW || ay < 0 || ay >= MH) continue;
          if (g.dungeon.map[ay][ax] === TL.WALL || g.dungeon.map[ay][ax] === TL.VOID) continue;
          if (g.enemies.some(o => o !== e && o.x === ax && o.y === ay)) continue;
          e.x = ax; e.y = ay; break;
        }
      }
      addMsg(t('ev.voidPullDrag'), 'mt');
    }
  }
}

export function checkTiles(): void {
  if (!G) return;
  const tile = G.dungeon.map[G.player.y]?.[G.player.x];
  if (tile === undefined) return;

  if (tile === TL.FOUNTAIN) {
    const h = Math.floor(G.player.maxHp * .3);
    const healed = Math.min(h, G.player.maxHp - G.player.hp);
    const corrupt = G.player.corruption > 0;
    // Consume when the player benefits any way: HP, MP, or a corruption
    // cleanse (② reconnect — the -15 fountain cleanse was dead popup code).
    if (healed <= 0 && G.player.mp >= G.player.maxMp && !corrupt) {
      addMsg(t('ev.fountainQuiet'), 'mi');
    } else {
      G.player.hp += healed;
      G.player.mp = Math.min(G.player.maxMp, G.player.mp + Math.floor(G.player.maxMp * .2));
      addMsg(tMsg('ev.fountainRestore', String(healed)), 'mh');
      if (corrupt) { applyCorruption(-15); addMsg(t('ev.fountainPurify'), 'md'); }
      flt(G.player.x, G.player.y, `+${healed}`, '#80ed99'); snd('heal');
      G.dungeon.map[G.player.y][G.player.x] = TL.WATER;
    }
  }
  if (tile === TL.SHRINE) {
    // Batch2 ⑨: 20% powerful blessing (revives the dead shrineBuff key).
    if (Math.random() < 0.2) {
      G.player.baseAtk += 2; G.player.baseDef += 2;
      G.player.baseMaxHp += 10; G.player.maxHp += 10; G.player.hp += 10;
      addMsg(t('shrineBuff'), 'ml');
      recalc(); snd('levelup'); fxAura(G.player.x, G.player.y, '#ffd700', 2);
      G.dungeon.map[G.player.y][G.player.x] = TL.FLOOR;
      return;
    }
    const b = rng(1, 3);
    if (b === 1) { G.player.baseAtk += rng(1, 2); addMsg(t('ev.shrineAtk'), 'ml'); }
    else if (b === 2) { G.player.baseDef += rng(1, 2); addMsg(t('ev.shrineDef'), 'ml'); }
    else { G.player.maxHp += rng(5, 10); G.player.baseMaxHp += rng(5, 10); G.player.hp += rng(5, 10); addMsg(t('ev.shrineHp'), 'ml'); }
    if (G.player.corruption > 0) { applyCorruption(-20); addMsg(t('ev.shrinePurify'), 'md'); }
    recalc(); snd('levelup'); flt(G.player.x, G.player.y, '+STAT', '#ffd700');
    G.dungeon.map[G.player.y][G.player.x] = TL.FLOOR;
  }
  // LAVA — deals damage when stepped on
  if (tile === TL.LAVA) {
    const dmg = Math.max(1, Math.floor(G.floor * 0.5));
    G.player.hp -= dmg;
    addMsg(tMsg('ev.lavaBurns', String(dmg)), 'mt');
    flt(G.player.x, G.player.y, `-${dmg}`, '#ff4500'); snd('trap'); shake();
    if (G.player.hp <= 0) { playerDeath(t('ev.lava')); return; }
  }
  // ABYSS_WATER — slows player (set slowed counter)
  if (tile === TL.ABYSS_WATER) {
    G.player.slowed = 3;
    applyCorruption(1); // wading the abyss corrupts (Playtest #9)
    addMsg(t('ev.abyssSlow'), 'mi');
  }
  // VOID_FLOOR — chance to teleport
  if (tile === TL.VOID_FLOOR && Math.random() < 0.15) {
    const rm = pick(G.dungeon.rooms);
    G.player.x = rm.cx; G.player.y = rm.cy;
    addMsg(t('ev.voidRiftTeleport'), 'me');
    flt(G.player.x, G.player.y, '⚡WARP', '#8a2be2');
  }
  // CRYSTAL — restores MP, consumed after use (only when mana is missing)
  if (tile === TL.CRYSTAL) {
    if (G.player.mp >= G.player.maxMp) {
      addMsg(t('ev.crystalFull'), 'mi');
    } else {
      const mp = rng(5, 15);
      G.player.mp = Math.min(G.player.maxMp, G.player.mp + mp);
      addMsg(tMsg('ev.crystalRestore', String(mp)), 'mh');
      flt(G.player.x, G.player.y, `+${mp}MP`, '#4895ef'); snd('heal');
      G.dungeon.map[G.player.y][G.player.x] = TL.FLOOR;
    }
  }
  // MOSS — restores hunger, consumed
  if (tile === TL.MOSS) {
    const h = 5;
    G.player.hunger = Math.min(G.player.maxHunger, G.player.hunger + h);
    addMsg(tMsg('ev.mossSnack', String(h)), 'mh');
    flt(G.player.x, G.player.y, `+${h}`, '#6b8e3a'); snd('heal');
    G.dungeon.map[G.player.y][G.player.x] = TL.FLOOR;
  }
  // CURSE — drains MP (distinct from LAVA's HP damage; not consumed)
  if (tile === TL.CURSE) {
    const drain = Math.max(2, Math.floor(G.player.maxMp * 0.2));
    G.player.mp = Math.max(0, G.player.mp - drain);
    addMsg(tMsg('ev.cursedDrain', String(drain)), 'mc');
    flt(G.player.x, G.player.y, `-${drain}MP`, '#8a2be2'); snd('hit');
  }
  // ALARM — aggros nearby enemies (consumed)
  if (tile === TL.ALARM) {
    let n = 0;
    for (const e of G.enemies) {
      if (!e.isAlly && !e.isBoss && dst(G.player.x, G.player.y, e.x, e.y) <= 8) { e.ai = 'chase'; n++; }
    }
    addMsg(tMsg('ev.alarmSound', String(n)), 'me');
    flt(G.player.x, G.player.y, '⚠ALARM', '#daa520'); snd('trap'); shake();
    G.dungeon.map[G.player.y][G.player.x] = TL.FLOOR;
  }
  // PORTAL — branch biome transport. Not consumed: stepping on a portal on a
  // main floor enters the Fungal Hollow; stepping on the branch's return portal
  // (branchMode) exits back to the recorded main-floor position.
  if (tile === TL.PORTAL) {
    if (G.branchMode) exitBranch();
    else enterBranch();
  }
}

// --- Map-entity events (point 1): chests & merchants spawn on the map ---

// Trigger the event associated with a stepped-on NPC entity.
export function triggerNpc(entity: Item): void {
  if (!G) return;
  if (entity.npc === 'chest') showEvent('chest');
  else if (entity.npc === 'merchant') showEvent('merchant');
  else if (entity.npc === 'treasure_merchant') openTreasureMerchant(entity);
  else if (entity.npc === 'endless_merchant') openEndlessMerchant(entity);
  else if (entity.npc === 'event' && entity.eventId) showEventSite(entity);
}

// --- Treasure merchant (point 11): expensive shop-only powerful gear ---

function treasurePrice(it: Item): number {
  const base = [150, 320, 640, 1200, 2400][it.rarity] || 150;
  return base + (G ? G.floor * 18 : 0);
}

function rollTreasureStock(): Item[] {
  if (!G) return [];
  const stock: Item[] = [];
  const f = G.floor + 6;
  for (let i = 0; i < 3; i++) {
    const r = Math.random();
    let item: Item;
    if (r < 0.4) item = genWeapon(f);
    else if (r < 0.7) item = genArmor(f);
    else item = genAcc(f);
    item.rarity = Math.max(3, Math.min(4, item.rarity + 1));
    stock.push(item);
  }
  return stock;
}

export function openTreasureMerchant(entity: Item): void {
  if (!G) return;
  if (!entity.stock || entity.stock.length === 0) entity.stock = rollTreasureStock();
  const popup = document.getElementById('event-popup')!;
  document.getElementById('ev-title')!.textContent = t('ev.treasureTitle');
  document.getElementById('ev-desc')!.textContent = t('ev.treasureDesc');
  const btns = document.getElementById('ev-buttons')!;
  btns.innerHTML = '';
  const actions: Array<() => void> = [];
  entity.stock.forEach((it, i) => {
    const price = treasurePrice(it);
    const btn = document.createElement('button');
    btn.className = 'evb';
    btn.innerHTML = `[${i + 1}] ${it.ch} ${it.name} <span class="ek">-${price}💰</span>`;
    btn.title = it.desc;
    actions.push(() => buyTreasure(entity, i));
    btns.appendChild(btn);
  });
  const leaveIdx = entity.stock.length;
  const leaveBtn = document.createElement('button');
  leaveBtn.className = 'evb';
  leaveBtn.textContent = `[${leaveIdx + 1}] ${t('merchantLeave')}`;
  actions.push(closeEvent);
  btns.appendChild(leaveBtn);

  setEventOpen(true);
  setEventActions(actions);
  _bindEventBtns(actions);
  popup.style.display = 'block';
}

function buyTreasure(entity: Item, idx: number): void {
  if (!G || !entity.stock) return;
  const it = entity.stock[idx];
  if (!it) return;
  const price = treasurePrice(it);
  if (G.player.gold < price) { addMsg(t('merchantNoGold'), 'mi'); return; }
  G.player.gold -= price;
  addMsg(tMsg('ev.boughtTreasure', String(it.name), String(price)), 'me');
  addItemWithOverflow(it);
  entity.stock.splice(idx, 1);
  snd('pickup');
  if (entity.stock.length === 0) { closeEvent(); addMsg(t('ev.treasureSoldOut'), 'mi'); }
  else { openTreasureMerchant(entity); }
  updateUI(); render();
}

// --- Endless merchant (F41+): endless gear + rarity5 relics + purge/heal services ---

type EndlessStockEntry = {
  kind: 'gear' | 'relic' | 'purge' | 'heal';
  item?: Item;
  relicId?: string;
  price: number;
  label: string;
  desc: string;
  ch: string;
};

export function rollEndlessStock(): EndlessStockEntry[] {
  if (!G) return [];
  const f = G.floor;
  const stock: EndlessStockEntry[] = [];
  for (let i = 0; i < 3; i++) {
    const it = genEndlessGear(f);
    stock.push({ kind: 'gear', item: it, price: f * 80, label: it.name, desc: it.desc, ch: it.ch });
  }
  const owned = new Set(G.player.relics || []);
  const r5 = RELICS.filter(r => r.rarity === 5 && !owned.has(r.id));
  if (r5.length) {
    const r = pick(r5);
    stock.push({ kind: 'relic', relicId: r.id, price: f * 200, label: tx(r.n), desc: tx(r.d), ch: r.ch });
  }
  stock.push({ kind: 'purge', price: f * 40, label: t('enm.purgeLabel'), desc: t('enm.purgeDesc'), ch: '🜔' });
  stock.push({ kind: 'heal', price: f * 30, label: t('enm.healLabel'), desc: t('enm.healDesc'), ch: '❤' });
  return stock;
}

export function openEndlessMerchant(entity: Item): void {
  if (!G) return;
  if (!entity.stock || (entity.stock as unknown as EndlessStockEntry[]).length === 0) {
    entity.stock = rollEndlessStock() as unknown as Item[];
  }
  const entries = entity.stock as unknown as EndlessStockEntry[];
  const popup = document.getElementById('event-popup')!;
  document.getElementById('ev-title')!.textContent = t('enm.title');
  document.getElementById('ev-desc')!.textContent = t('enm.desc');
  const btns = document.getElementById('ev-buttons')!;
  btns.innerHTML = '';
  const actions: Array<() => void> = [];
  entries.forEach((e, i) => {
    const btn = document.createElement('button');
    btn.className = 'evb';
    btn.innerHTML = `[${i + 1}] ${e.ch} ${e.label} <span class="ek">-${e.price}💰</span>`;
    btn.title = e.desc;
    actions.push(() => buyEndless(entity, i));
    btns.appendChild(btn);
  });
  const leaveBtn = document.createElement('button');
  leaveBtn.className = 'evb';
  leaveBtn.textContent = `[${entries.length + 1}] ${t('merchantLeave')}`;
  actions.push(closeEvent);
  btns.appendChild(leaveBtn);
  setEventOpen(true);
  setEventActions(actions);
  _bindEventBtns(actions);
  popup.style.display = 'block';
}

function buyEndless(entity: Item, idx: number): void {
  if (!G || !entity.stock) return;
  const entries = entity.stock as unknown as EndlessStockEntry[];
  const e = entries[idx];
  if (!e) return;
  if (G.player.gold < e.price) { addMsg(t('merchantNoGold'), 'mi'); return; }
  G.player.gold -= e.price;
  if (e.kind === 'gear' && e.item) {
    addItemWithOverflow(e.item);
    addMsg(tMsg('enm.boughtGear', String(e.item.name), String(e.price)), 'me');
  } else if (e.kind === 'relic' && e.relicId) {
    grantRelic(e.relicId, G.player.x, G.player.y);
    addMsg(tMsg('enm.boughtRelic', String(e.label), String(e.price)), 'me');
  } else if (e.kind === 'purge') {
    applyCorruption(-20);
    addMsg(tMsg('enm.purged', String(e.price)), 'mh');
  } else if (e.kind === 'heal') {
    G.player.hp = G.player.maxHp;
    addMsg(tMsg('enm.healed', String(e.price)), 'mh');
  }
  snd('pickup');
  // gear/relic are one-shot (splice); purge/heal repeatable (no splice).
  if (e.kind === 'gear' || e.kind === 'relic') {
    entries.splice(idx, 1);
    if (entries.length === 0) { closeEvent(); addMsg(t('enm.soldOut'), 'mi'); updateUI(); render(); return; }
  }
  updateUI(); render();
  openEndlessMerchant(entity);
}

// --- Batch2 ③: random event sites (8 low-frequency map events) ---

export function showEventSite(entity: Item): void {
  if (!G || !entity.eventId) return;
  const def = EVENT_SITES.find(s => s.id === entity.eventId);
  if (!def) return;
  if (def.once) {
    G.eventFlags = G.eventFlags || {};
    G.eventFlags[def.id] = true;
  }
  const popup = document.getElementById('event-popup')!;
  document.getElementById('ev-title')!.textContent = t('ev2.' + def.id + 'Title');
  document.getElementById('ev-desc')!.textContent = t('ev2.' + def.id + 'Desc');
  const btns = document.getElementById('ev-buttons')!;
  btns.innerHTML = '';
  const actions: Array<() => void> = [];
  const addBtn = (label: string, action: () => void) => {
    const b = document.createElement('button');
    b.className = 'evb';
    b.textContent = `[${actions.length + 1}] ${label}`;
    btns.appendChild(b);
    actions.push(action);
  };
  addBtn(t('ev2.' + def.id + 'Act'), () => runEventAction(def));
  addBtn(t('merchantLeave'), closeEvent);
  setEventOpen(true);
  setEventActions(actions);
  _bindEventBtns(actions);
  popup.style.display = 'block';
}

function runEventAction(def: EventSiteDef): void {
  if (!G) return;
  const p = G.player;
  switch (def.id) {
    case 'cursed_altar': {
      // Player equipment slots live under p.eq (types.ts Equipment) — p.eq.weapon, not p.weapon.
      if (!p.eq.weapon) { addMsg(t('ev2.cursedAltarNoWeapon'), 'mi'); closeEvent(); return; }
      p.eq.weapon = null;
      p.baseAtk += 3;
      recalc();
      addMsg(tMsg('ev2.cursedAltarDone'), 'ml'); snd('levelup');
      break;
    }
    case 'gambler_altar': {
      if (p.gold < 50) { addMsg(t('merchantNoGold'), 'mi'); closeEvent(); return; }
      p.gold -= 50;
      const r = Math.random();
      if (r < 0.45) { p.gold += 100; addMsg(tMsg('ev2.gamblerWin', '100'), 'me'); snd('chest'); }
      else if (r < 0.90) { addMsg(t('ev2.gamblerLose'), 'mt'); snd('trap'); }
      else { p.gold += 150; addMsg(tMsg('ev2.gamblerJackpot', '150'), 'ml'); snd('levelup'); }
      break;
    }
    case 'trapped_npc': {
      if (Math.random() < 0.25) {
        spawnEventFoes(2);
        addMsg(t('ev2.trappedAmbush'), 'mt'); snd('trap'); shake();
      } else {
        p.gold += 10 + G.floor * 5;
        const it = genItem(G.floor + 2); it.x = p.x; it.y = p.y; G.items.push(it);
        addMsg(tMsg('ev2.trappedReward', String(10 + G.floor * 5)), 'me'); snd('chest');
      }
      break;
    }
    case 'ancient_remains': {
      const r = Math.random();
      if (r < 0.6) { const g = rng(10, 30) + G.floor * 2; p.gold += g; addMsg(tMsg('ev2.remainsGold', String(g)), 'me'); snd('pickup'); }
      else if (r < 0.9) { addMsg(t('ev2.remainsEmpty'), 'mi'); }
      else { spawnEventFoes(rng(1, 2)); addMsg(t('ev2.remainsAmbush'), 'mt'); snd('trap'); shake(); }
      break;
    }
    case 'blood_pool': {
      p.baseMaxHp += 5; p.hp += 5;
      applyCorruption(3);
      addMsg(t('ev2.bloodPoolDrunk'), 'md'); snd('heal');
      break;
    }
    case 'ancient_stele': {
      const b = rng(1, 3);
      if (b === 1) { p.baseAtk += 1; addMsg(t('ev2.steleAtk'), 'ml'); }
      else if (b === 2) { p.baseDef += 1; addMsg(t('ev2.steleDef'), 'ml'); }
      else { p.baseMaxHp += 5; p.hp += 5; addMsg(t('ev2.steleHp'), 'ml'); }
      recalc(); snd('levelup');
      break;
    }
    case 'sealed_box': {
      const r = Math.random();
      if (r < 0.5) {
        const it = genItem(G.floor + 3); it.rarity = Math.max(3, it.rarity); it.x = p.x; it.y = p.y;
        G.items.push(it); addMsg(tMsg('ev2.sealedLoot', String(it.name)), 'me'); snd('chest');
      } else if (r < 0.85) {
        applyCorruption(8); addMsg(t('ev2.sealedCorrupt'), 'mc'); snd('trap'); shake();
      } else {
        const pool = RELICS.filter(x => x.rarity <= 3);
        grantRelic(pick(pool).id, p.x, p.y); addMsg(t('ev2.sealedRelic'), 'ml'); snd('levelup');
      }
      break;
    }
    case 'sacrifice_well': {
      // Cost is clamped so the well can never kill: at most hp-1, and players
      // at hp<=1 are too weak to bleed at all (cost < 1 guard).
      const cost = Math.min(Math.max(1, Math.floor(p.hp * 0.2)), p.hp - 1);
      if (cost < 1) { addMsg(t('ev2.wellTooWeak'), 'mi'); closeEvent(); return; }
      p.hp -= cost;
      applyCorruption(-12);
      addMsg(tMsg('ev2.wellPaid', String(cost)), 'md'); snd('heal');
      break;
    }
    default: break;
  }
  closeEvent(); updateUI(); render();
}

// Shared: place n foes from the floor-appropriate pool near the player.
function spawnEventFoes(n: number): void {
  if (!G) return;
  const pool = ENEMIES.filter(en => en.mf <= G!.floor && en.mf >= Math.max(1, G!.floor - 6) && !en.tags?.includes('boss'));
  if (!pool.length) return;
  const fs = 1 + (G.floor - 1) * 0.1;
  for (let k = 0; k < n; k++) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const sx = G.player.x + rng(-3, 3), sy = G.player.y + rng(-3, 3);
      if (sx < 0 || sy < 0 || G.dungeon.map[sy]?.[sx] === undefined) continue;
      if (G.dungeon.map[sy][sx] === TL.WALL || G.dungeon.map[sy][sx] === TL.VOID) continue;
      if (G.enemies.some(o => o.x === sx && o.y === sy)) continue;
      if (sx === G.player.x && sy === G.player.y) continue;
      G.enemies.push(makeEnemy(pick(pool), sx, sy, fs, { hpM: 0.8, atkM: 0.9 }));
      break;
    }
  }
}
