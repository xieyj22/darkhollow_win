// Game initialization and floor entry
import type { GameState, Item } from './types.js';
import { G, setGameState, lang } from './state.js';
import { MH, MW, FINAL, TL } from './config.js';
import { genDungeon, updatePlayerFOV } from './dungeon.js';
import { spawnEnemies } from './enemies.js';
import { genItem, genFood } from './items.js';
import { createPlayer } from './player.js';
import { updateUI, render, resizeCanvas } from './render.js';
import { snd } from './audio.js';
import { t } from './i18n.js';
import { addMsg } from './messages.js';
import { rng, pick } from './utils.js';
import { AREAS } from './data.js';

export function initGame(ri: number, ci: number): void {
  const gameState: GameState = {
    player: createPlayer(ri, ci),
    floor: 1, dungeon: null as any,
    enemies: [], items: [], traps: [],
    msgs: [], gameOver: false, won: false, vx: 0, vy: 0,
  };
  setGameState(gameState);
  enterFloor(1);
  addMsg(t('loreIntro'), 'mst');
  addMsg(t('loreTip1'), 'mi');
  addMsg(t('loreTip2'), 'mi');
}

export function enterFloor(floor: number): void {
  if (!G) return;

  // Fade transition for floor changes
  const cvs = document.getElementById('game-canvas') as HTMLCanvasElement;
  const doTransition = floor > 1 && cvs;

  const setup = () => {
    G!.floor = floor;
    G!.dungeon = genDungeon(floor);
    G!.traps = G!.dungeon.traps;
    const sr = G!.dungeon.rooms[0];
    G!.player.x = sr.cx; G!.player.y = sr.cy;
    G!.player.explored = Array.from({ length: MH }, () => Array(MW).fill(false));
    G!.enemies = spawnEnemies(floor, G!.dungeon.rooms);
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
    const placeEntity = (npc: Item['npc'], ch: string, c: string, nameZh: string, nameEn: string, rarity: number) => {
      const rooms = G!.dungeon.rooms.slice(1); // never in the start room
      if (!rooms.length) return;
      const rm = pick(rooms);
      const x = rng(rm.x + 1, rm.x + rm.w - 2), y = rng(rm.y + 1, rm.y + rm.h - 2);
      if (G!.dungeon.map[y][x] === TL.STAIR) return; // don't bury under stairs
      G!.items.push({ type: 'consumable', name: lang === 'zh' ? nameZh : nameEn, ch, c, desc: '', x, y, rarity, npc } as Item);
    };
    if (Math.random() < 0.5) placeEntity('chest', '▣', '#daa520', '宝箱', 'Chest', 2);
    if (Math.random() < 0.35) placeEntity('merchant', '§', '#9b5de5', '流浪商人', 'Merchant', 1);
    if (floor % 5 === 0) placeEntity('treasure_merchant', '¤', '#ffd700', '宝藏商人', 'Treasure Merchant', 4);

    if (floor > 1) {
      addMsg(lang === 'zh' ? `你下到了第${floor}层……` : `You descend to floor ${floor}...`, 'mi');
      snd('stairs');
    }

    // Boss floor warning
    if (floor % 5 === 0) addMsg(t('loreBoss'), 'md');

    // Final floor warning
    if (floor === FINAL) addMsg(t('loreFinal'), 'md');

    // Area-specific lore
    const area = AREAS.find(a => floor >= a.floorStart && floor <= a.floorEnd);
    if (area && area.lore.length > 0) {
      const desc = pick(area.lore);
      addMsg(lang === 'zh' ? desc.zh : desc.en, 'mst');
    }

    updatePlayerFOV(G!.player, G!.dungeon.map, G!.traps);
  };

  if (doTransition) {
    cvs.style.opacity = '0';
    setTimeout(() => {
      setup();
      // Need to import render/updateUI — use late binding
      if ((window as any).__render) (window as any).__render();
      if ((window as any).__updateUI) (window as any).__updateUI();
      cvs.style.opacity = '1';
    }, 200);
  } else {
    setup();
  }
}
