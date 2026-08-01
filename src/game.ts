// Game initialization and floor entry
import type { GameState, Item } from './types.js';
import { G, setGameState, lang } from './state.js';
import { MH, MW, FINAL, TL } from './config.js';
import { genDungeon, updatePlayerFOV } from './dungeon.js';
import { spawnEnemies, spawnBranchEnemies, spawnWarden } from './enemies.js';
import { genItem, genFood } from './items.js';
import { createPlayer } from './player.js';
import { updateUI, render, resizeCanvas } from './render.js';
import { snd, setBgmScene } from './audio.js';
import { autoSave } from './save.js';
import { t, tMsg, tx } from './i18n.js';
import { addMsg } from './messages.js';
import { rng, pick } from './utils.js';
import { AREAS } from './data.js';
import { unlockLore } from './meta.js';
import { bridge } from './bridge.js';

export function initGame(ri: number, ci: number, endless = false): void {
  const gameState: GameState = {
    player: createPlayer(ri, ci),
    floor: 1, dungeon: null as any,
    enemies: [], items: [], traps: [],
    msgs: [], gameOver: false, won: false, vx: 0, vy: 0,
    branchMode: false, branchReturn: null,
    endless,
    wardenCd: rng(4, 6),
  };
  setGameState(gameState);
  enterFloor(1);
  unlockLore('world:descent');
  addMsg(t('loreIntro'), 'mst');
  addMsg(t('loreTip1'), 'mi');
  addMsg(t('loreTip2'), 'mi');
}

export function enterFloor(floor: number, skipFade?: boolean): void {
  if (!G) return;

  // Fade transition for floor changes. skipFade is used by exitBranch so the
  // branch-exit setup runs synchronously (otherwise the 200ms setTimeout would
  // overwrite the restored player position after we set it).
  const cvs = document.getElementById('game-canvas') as HTMLCanvasElement;
  const doTransition = !skipFade && floor > 1 && cvs;

  const setup = () => {
    G!.floor = floor;
    G!.dungeon = genDungeon(floor);
    G!.traps = G!.dungeon.traps;
    const sr = G!.dungeon.rooms[0];
    G!.player.x = sr.cx; G!.player.y = sr.cy;
    // Reset transient combat state so debuffs/buffs from the previous floor
    // don't bleed into the new one (e.g. poison ticking, slow, invisibility
    // letting you walk past every enemy for free).
    G!.player.buffs = [];
    G!.player.poisonTurns = 0;
    G!.player.poisonDmg = 0;
    G!.player.slowed = 0;
    G!.player.explored = Array.from({ length: MH }, () => Array(MW).fill(false));
    G!.enemies = spawnEnemies(floor, G!.dungeon.rooms);
    // Warden stalking timer (Wave 8): ticks once per main-line floor entry; at 0
    // the nemesis spawns and the timer resets. Not inside portal branches.
    if (!G!.branchMode) {
      G!.wardenCd--;
      if (G!.wardenCd <= 0) { spawnWarden(floor); G!.wardenCd = rng(6, 9); }
    }
    G!.items = [];

    // Scatter items
    const ic = rng(5, 10) + Math.floor(floor / 3);
    for (let i = 0; i < ic; i++) {
      const rm = pick(G!.dungeon.rooms);
      G!.items.push({ ...genItem(floor), x: rng(rm.x + 1, rm.x + rm.w - 2), y: rng(rm.y + 1, rm.y + rm.h - 2) });
    }

    // Gold piles
    for (let i = 0; i < rng(3, 7); i++) {
      const rm = pick(G!.dungeon.rooms);
      G!.items.push({ type: 'gold', name: 'Gold', value: rng(5, 15) + floor * 3, ch: '$', c: '#ffd700', x: rng(rm.x + 1, rm.x + rm.w - 2), y: rng(rm.y + 1, rm.y + rm.h - 2), id: true, rarity: 0, desc: '' });
    }

    // Food drops
    for (let i = 0; i < rng(1, 3); i++) {
      const rm = pick(G!.dungeon.rooms);
      G!.items.push({ ...genFood(floor), x: rng(rm.x + 1, rm.x + rm.w - 2), y: rng(rm.y + 1, rm.y + rm.h - 2) });
    }

    // Map entities: chests, wandering merchants, treasure merchants (point 1/3/11).
    // These appear as icons on the map; stepping on them triggers the event.
    const placeEntity = (npc: Item['npc'], ch: string, c: string, nameKey: string, rarity: number) => {
      const rooms = G!.dungeon.rooms.slice(1); // never in the start room
      if (!rooms.length) return;
      const rm = pick(rooms);
      const x = rng(rm.x + 1, rm.x + rm.w - 2), y = rng(rm.y + 1, rm.y + rm.h - 2);
      if (G!.dungeon.map[y][x] === TL.STAIR) return; // don't bury under stairs
      G!.items.push({ type: 'consumable', name: t(nameKey), ch, c, desc: '', x, y, rarity, npc } as Item);
    };
    if (Math.random() < 0.5) placeEntity('chest', '▣', '#daa520', 'gm.chest', 2);
    if (Math.random() < 0.35) placeEntity('merchant', '§', '#9b5de5', 'gm.merchant', 1);
    if (floor % 5 === 0) placeEntity('treasure_merchant', '¤', '#ffd700', 'gm.treasureMerchant', 4);

    if (floor > 1) {
      addMsg(tMsg('gm.descend', String(floor)), 'mi');
      snd('stairs');
    }

    // Boss floor warning
    if (floor % 5 === 0) addMsg(t('loreBoss'), 'md');

    // Final floor warning
    if (floor === FINAL) addMsg(t('loreFinal'), 'md');

    // Area-specific lore
    const area = AREAS.find(a => floor >= a.floorStart && floor <= a.floorEnd);
    if (area && !G!.branchMode) unlockLore('area:' + area.id);
    if (area && area.lore.length > 0) {
      const desc = pick(area.lore);
      addMsg(tx(desc), 'mst');
    }

    updatePlayerFOV(G!.player, G!.dungeon.map, G!.traps);
    // BGM: biome explore theme, or boss theme on boss floors.
    setBgmScene(floor % 5 === 0 ? 'boss' : 'explore', area?.id);
    if (floor % 5 === 0) snd('boss');
    autoSave();
  };

  if (doTransition) {
    cvs.style.opacity = '0';
    setTimeout(() => {
      setup();
      // Need to import render/updateUI — use late binding
      if (bridge.render) bridge.render();
      if (bridge.updateUI) bridge.updateUI();
      cvs.style.opacity = '1';
    }, 200);
  } else {
    setup();
  }
}

// --- Portal branch biome ("Fungal Hollow") ---
// A self-contained branch entered via a PORTAL tile on a main floor and exited
// via another PORTAL in the branch's last room. branchMode/branchReturn track
// the round-trip. Both resolve the Task-2 fungal area / branch enemy pool at
// call time; until Task 2 lands, enterBranch no-ops (no 'fungal' area found).
export function enterBranch(): void {
  if (!G) return;
  const fungal = AREAS.find(a => a.id === 'fungal');
  if (!fungal) return;
  G.branchReturn = { floor: G.floor, x: G.player.x, y: G.player.y };
  G.branchMode = true;
  const entry = G.floor;
  G.dungeon = genDungeon(entry, fungal);
  G.traps = G.dungeon.traps;
  const sr = G.dungeon.rooms[0];
  G.player.x = sr.cx; G.player.y = sr.cy;
  // Reset transient combat state (mirrors enterFloor).
  G.player.buffs = [];
  G.player.poisonTurns = 0;
  G.player.poisonDmg = 0;
  G.player.slowed = 0;
  G.player.explored = Array.from({ length: MH }, () => Array(MW).fill(false));
  G.enemies = spawnBranchEnemies(G.dungeon.rooms, entry);
  G.items = [];
  // Reward + return portal in the last room. grantRelic (relics.ts) couples to
  // the relic pool (Task 2 data); per the brief's sanctioned fallback we scatter
  // a high-rarity item + gold pile instead, picked up before stepping on the portal.
  const last = G.dungeon.rooms[G.dungeon.rooms.length - 1];
  const rit = genItem(entry + 4);
  rit.rarity = Math.max(3, Math.min(4, rit.rarity));
  rit.x = last.cx; rit.y = last.cy;
  G.items.push(rit);
  G.items.push({ type: 'gold', name: 'Gold', value: 200 + entry * 15, ch: '$', c: '#ffd700', x: last.cx, y: last.cy, id: true, rarity: 0, desc: '' });
  G.dungeon.map[last.cy][last.cx] = TL.PORTAL;
  addMsg(t('gm.fungalHollow'), 'md');
  updatePlayerFOV(G.player, G.dungeon.map, G.traps);
  setBgmScene('explore', fungal.id);
  if (bridge.render) bridge.render();
  if (bridge.updateUI) bridge.updateUI();
}

export function exitBranch(): void {
  if (!G || !G.branchReturn) return;
  const ret = G.branchReturn;
  G.branchMode = false;
  G.branchReturn = null;
  // Regenerate the main floor (brief intent: no snapshot/restore). skipFade so
  // setup is synchronous and the position override below isn't clobbered.
  enterFloor(ret.floor, true);
  // ret.x/ret.y was a floor tile in the OLD layout; the freshly-generated one
  // may have a wall/void there (~40%). Fall back to the new start-room center
  // so the player never lands inside a wall (preserves the no-snapshot intent).
  const walkable = (tx: number, ty: number) => {
    const t = G!.dungeon.map[ty]?.[tx];
    return t !== undefined && t !== TL.WALL && t !== TL.VOID;
  };
  const sr = G.dungeon.rooms[0];
  G.player.x = walkable(ret.x, ret.y) ? ret.x : sr.cx;
  G.player.y = walkable(ret.x, ret.y) ? ret.y : sr.cy;
  updatePlayerFOV(G.player, G.dungeon.map, G.traps);
  addMsg(tMsg('gm.return', String(ret.floor)), 'mi');
  if (bridge.render) bridge.render();
  if (bridge.updateUI) bridge.updateUI();
}
