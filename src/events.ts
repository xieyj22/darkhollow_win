// Random events, traps, tile effects
import type { Trap, Item } from './types.js';
import { G, lang, eventOpen, eventActions, setEventOpen, setEventActions } from './state.js';
import { MH, MW, TL } from './config.js';
import { rng, pick, dst } from './utils.js';
import { snd } from './audio.js';
import { flt, shake } from './effects.js';
import { t, tMsg, tx } from './i18n.js';
import { bridge } from './bridge.js';
import { addMsg } from './messages.js';
import { genItem, genWeapon, genArmor, genAcc, addItemWithOverflow, itemToGold } from './items.js';
import { recalc, playerDeath, applyCorruption } from './combat.js';
import { genEndlessGear } from './item-gen.js';
import { grantRelic, hasRelic } from './relics.js';
import { RELICS } from './data.js';
import { updateUI, render } from './render.js';
import { enterBranch, exitBranch } from './game.js';

// Re-export for late-binding
export { updateUI, render } from './render.js';

// --- Random events ---

export function maybeEvent(): void {
  // Random popup events removed — merchants/chests now spawn as map entities
  // the player steps on (point 1). Fountains/shrines are terrain tiles.
  return;
}

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
  } else if (type === 'fountain_event') {
    document.getElementById('ev-title')!.textContent = t('fountainTitle');
    document.getElementById('ev-desc')!.textContent = t('fountainDesc');
    document.getElementById('ev-buttons')!.innerHTML = `<button class="evb" data-ea="0">[1] ${t('fountainDrink')}</button><button class="evb" data-ea="1">[2] ${t('fountainSkip')}</button>`;
    actions = [fountainDrink, closeEvent];
  } else if (type === 'shrine_event') {
    document.getElementById('ev-title')!.textContent = t('shrineTitle');
    document.getElementById('ev-desc')!.textContent = t('shrineDesc');
    document.getElementById('ev-buttons')!.innerHTML = `<button class="evb" data-ea="0">[1] ${t('shrinePray')}</button><button class="evb" data-ea="1">[2] ${t('shrineSkip')}</button>`;
    actions = [shrinePray, closeEvent];
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

function fountainDrink(): void {
  if (!G) return;
  const h = Math.floor(G.player.maxHp * .35);
  G.player.hp = Math.min(G.player.maxHp, G.player.hp + h);
  G.player.mp = Math.min(G.player.maxMp, G.player.mp + Math.floor(G.player.maxMp * .3));
  addMsg(t('fountainHeal'), 'mh'); snd('heal');
  applyCorruption(-15); // fountain cleanses corruption (Playtest #9)
  flt(G.player.x, G.player.y, `+${h}`, '#80ed99');
  closeEvent(); updateUI(); render();
}

function shrinePray(): void {
  if (!G) return;
  const b = rng(1, 3);
  if (b === 1) { G.player.baseAtk += 2; addMsg(t('ev.shrineBlessingAtk2'), 'ml'); }
  else if (b === 2) { G.player.baseDef += 2; addMsg(t('ev.shrineBlessingDef2'), 'ml'); }
  else { G.player.maxHp += 10; G.player.baseMaxHp += 10; G.player.hp += 10; addMsg(t('ev.shrineBlessingHp10'), 'ml'); }
  applyCorruption(-20); // shrine cleanses corruption (Playtest #9)
  recalc(); snd('levelup'); flt(G.player.x, G.player.y, '✨', '#ffd700');
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
    // Only consume the fountain if the player actually benefits (HP or MP not full)
    if (healed <= 0 && G.player.mp >= G.player.maxMp) {
      addMsg(t('ev.fountainQuiet'), 'mi');
    } else {
      G.player.hp += healed;
      G.player.mp = Math.min(G.player.maxMp, G.player.mp + Math.floor(G.player.maxMp * .2));
      addMsg(tMsg('ev.fountainRestore', String(healed)), 'mh');
      flt(G.player.x, G.player.y, `+${healed}`, '#80ed99'); snd('heal');
      G.dungeon.map[G.player.y][G.player.x] = TL.WATER;
    }
  }
  if (tile === TL.SHRINE) {
    const b = rng(1, 3);
    if (b === 1) { G.player.baseAtk += rng(1, 2); addMsg(t('ev.shrineAtk'), 'ml'); }
    else if (b === 2) { G.player.baseDef += rng(1, 2); addMsg(t('ev.shrineDef'), 'ml'); }
    else { G.player.maxHp += rng(5, 10); G.player.baseMaxHp += rng(5, 10); G.player.hp += rng(5, 10); addMsg(t('ev.shrineHp'), 'ml'); }
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
