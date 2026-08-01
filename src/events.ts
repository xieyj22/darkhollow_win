// Random events, traps, tile effects
import type { Trap, Item } from './types.js';
import { G, lang, eventOpen, eventActions, setEventOpen, setEventActions } from './state.js';
import { MH, MW, TL } from './config.js';
import { rng, pick, dst } from './utils.js';
import { snd } from './audio.js';
import { flt, shake } from './effects.js';
import { t } from './i18n.js';
import { bridge } from './bridge.js';
import { addMsg } from './messages.js';
import { genItem, genWeapon, genArmor, genAcc, addItemWithOverflow, itemToGold } from './items.js';
import { recalc, playerDeath, applyCorruption } from './combat.js';
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
      `<button class="evb" data-ea="0">[1] ${lang === 'zh' ? '购买神秘物品' : 'Buy Mystery Item'} (-${price}💰)</button>` +
      `<button class="evb" data-ea="1">[2] ${lang === 'zh' ? '打开背包售卖' : 'Open Bag to Sell'}</button>` +
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
    if (G.player.hp <= 0) { playerDeath(lang === 'zh' ? '宝箱怪' : 'Mimic'); closeEvent(); return; }
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
  if (b === 1) { G.player.baseAtk += 2; addMsg(lang === 'zh' ? '神殿祝福！+2攻击' : 'Shrine blessing! +2 ATK', 'ml'); }
  else if (b === 2) { G.player.baseDef += 2; addMsg(lang === 'zh' ? '神殿祝福！+2防御' : 'Shrine blessing! +2 DEF', 'ml'); }
  else { G.player.maxHp += 10; G.player.baseMaxHp += 10; G.player.hp += 10; addMsg(lang === 'zh' ? '神殿祝福！+10HP' : 'Shrine blessing! +10 HP', 'ml'); }
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
    addMsg(lang === 'zh' ? (trap.ds ? trap.ds.zh : trap.n.zh) : ((trap.ds ? trap.ds.en : trap.n.en)), 'mt');
    if (trap.dmg > 0) {
      G.player.hp -= trap.dmg; flt(G.player.x, G.player.y, `-${trap.dmg}`, '#f4845f'); snd('trap'); shake();
      addMsg(`${lang === 'zh' ? trap.n.zh : trap.n.en} -${trap.dmg}!`, 'mt');
      if (G.player.hp <= 0) { playerDeath(lang === 'zh' ? trap.n.zh : trap.n.en); return; }
    }
    if (trap.ef === 'poison_dot') {
      if (!G.player.buffs.some(b => b.type === 'antidote')) {
        G.player.poisonTurns = trap.dur || 5; G.player.poisonDmg = Math.floor(trap.dmg / (trap.dur || 5)) + 1;
      }
    }
    if (trap.ef === 'teleport') { const rm = pick(G.dungeon.rooms); G.player.x = rm.cx; G.player.y = rm.cy; addMsg(lang === 'zh' ? '你被传送了！' : 'Teleported!', 'mi'); }
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
      addMsg(lang === 'zh' ? '🌀 虚空裂缝将敌人拉向你！' : '🌀 The void rift drags enemies toward you!', 'mt');
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
      addMsg(lang === 'zh' ? '魔法喷泉静静流淌，你已无需恢复。' : 'The fountain flows quietly; you need no restoration.', 'mi');
    } else {
      G.player.hp += healed;
      G.player.mp = Math.min(G.player.maxMp, G.player.mp + Math.floor(G.player.maxMp * .2));
      addMsg(lang === 'zh' ? `魔法喷泉恢复了${healed}HP！` : `Fountain restores ${healed} HP!`, 'mh');
      flt(G.player.x, G.player.y, `+${healed}`, '#80ed99'); snd('heal');
      G.dungeon.map[G.player.y][G.player.x] = TL.WATER;
    }
  }
  if (tile === TL.SHRINE) {
    const b = rng(1, 3);
    if (b === 1) { G.player.baseAtk += rng(1, 2); addMsg(lang === 'zh' ? '神殿强化！+ATK' : 'Shrine +ATK', 'ml'); }
    else if (b === 2) { G.player.baseDef += rng(1, 2); addMsg(lang === 'zh' ? '神殿强化！+DEF' : 'Shrine +DEF', 'ml'); }
    else { G.player.maxHp += rng(5, 10); G.player.baseMaxHp += rng(5, 10); G.player.hp += rng(5, 10); addMsg(lang === 'zh' ? '神殿强化！+HP' : 'Shrine +HP', 'ml'); }
    recalc(); snd('levelup'); flt(G.player.x, G.player.y, '+STAT', '#ffd700');
    G.dungeon.map[G.player.y][G.player.x] = TL.FLOOR;
  }
  // LAVA — deals damage when stepped on
  if (tile === TL.LAVA) {
    const dmg = Math.max(1, Math.floor(G.floor * 0.5));
    G.player.hp -= dmg;
    addMsg(lang === 'zh' ? `🔥 岩浆灼烧！-${dmg}HP` : `🔥 Lava burns! -${dmg}HP`, 'mt');
    flt(G.player.x, G.player.y, `-${dmg}`, '#ff4500'); snd('trap'); shake();
    if (G.player.hp <= 0) { playerDeath(lang === 'zh' ? '岩浆' : 'lava'); return; }
  }
  // ABYSS_WATER — slows player (set slowed counter)
  if (tile === TL.ABYSS_WATER) {
    G.player.slowed = 3;
    applyCorruption(1); // wading the abyss corrupts (Playtest #9)
    addMsg(lang === 'zh' ? '🌊 深海水流减缓了你的行动！' : '🌊 Abyssal currents slow you down!', 'mi');
  }
  // VOID_FLOOR — chance to teleport
  if (tile === TL.VOID_FLOOR && Math.random() < 0.15) {
    const rm = pick(G.dungeon.rooms);
    G.player.x = rm.cx; G.player.y = rm.cy;
    addMsg(lang === 'zh' ? '✦ 虚空裂缝将你传送了！' : '✦ A void rift teleports you!', 'me');
    flt(G.player.x, G.player.y, '⚡WARP', '#8a2be2');
  }
  // CRYSTAL — restores MP, consumed after use (only when mana is missing)
  if (tile === TL.CRYSTAL) {
    if (G.player.mp >= G.player.maxMp) {
      addMsg(lang === 'zh' ? '✨ 水晶闪烁着光芒，但你的魔力已满。' : '✨ The crystal glimmers, but your mana is full.', 'mi');
    } else {
      const mp = rng(5, 15);
      G.player.mp = Math.min(G.player.maxMp, G.player.mp + mp);
      addMsg(lang === 'zh' ? `✨ 水晶能量恢复了${mp}MP！` : `✨ Crystal energy restores ${mp} MP!`, 'mh');
      flt(G.player.x, G.player.y, `+${mp}MP`, '#4895ef'); snd('heal');
      G.dungeon.map[G.player.y][G.player.x] = TL.FLOOR;
    }
  }
  // MOSS — restores hunger, consumed
  if (tile === TL.MOSS) {
    const h = 5;
    G.player.hunger = Math.min(G.player.maxHunger, G.player.hunger + h);
    addMsg(lang === 'zh' ? `🌿 苔藓充饥！+${h} 饥饿` : `🌿 Moss snacks! +${h} hunger`, 'mh');
    flt(G.player.x, G.player.y, `+${h}`, '#6b8e3a'); snd('heal');
    G.dungeon.map[G.player.y][G.player.x] = TL.FLOOR;
  }
  // CURSE — drains MP (distinct from LAVA's HP damage; not consumed)
  if (tile === TL.CURSE) {
    const drain = Math.max(2, Math.floor(G.player.maxMp * 0.2));
    G.player.mp = Math.max(0, G.player.mp - drain);
    addMsg(lang === 'zh' ? `⛧ 诅咒之地吸取了 ${drain} MP！` : `⛧ Cursed ground drains ${drain} MP!`, 'mc');
    flt(G.player.x, G.player.y, `-${drain}MP`, '#8a2be2'); snd('hit');
  }
  // ALARM — aggros nearby enemies (consumed)
  if (tile === TL.ALARM) {
    let n = 0;
    for (const e of G.enemies) {
      if (!e.isAlly && !e.isBoss && dst(G.player.x, G.player.y, e.x, e.y) <= 8) { e.ai = 'chase'; n++; }
    }
    addMsg(lang === 'zh' ? `🚨 警报锣响！${n} 个敌人被激怒！` : `🚨 The alarm sounds! ${n} enemies enraged!`, 'me');
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
  document.getElementById('ev-title')!.textContent = lang === 'zh' ? '💰 宝藏商人' : '💰 Treasure Merchant';
  document.getElementById('ev-desc')!.textContent = lang === 'zh' ? '神秘商人摆出稀世珍宝，价格不菲，但件件精品（仅此有售）……' : 'Rare treasures — pricey, but only available here.';
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
  addMsg(lang === 'zh' ? `购买 ${it.name}！（-${price}💰）` : `Bought ${it.name}! (-${price}💰)`, 'me');
  addItemWithOverflow(it);
  entity.stock.splice(idx, 1);
  snd('pickup');
  if (entity.stock.length === 0) { closeEvent(); addMsg(lang === 'zh' ? '宝藏商人售罄，悄然离去。' : 'The treasure merchant sells out and vanishes.', 'mi'); }
  else { openTreasureMerchant(entity); }
  updateUI(); render();
}
