// Dungeon generation and FOV computation
import type { Room, Dungeon, Trap, Player } from './types.js';
import { MH, MW, TL, FINAL, FOV } from './config.js';
import { rng, pick } from './utils.js';
import { ALL_TRAPS, AREAS } from './data.js';
import { getMetaFovBonus } from './meta.js';

export function genDungeon(floor: number): Dungeon {
  const map: number[][] = Array.from({ length: MH }, () => Array(MW).fill(TL.WALL));
  const rooms: Room[] = [];
  let att = 0;
  // More rooms for deeper floors
  const rc = rng(8, 14) + Math.floor(floor / 3);

  // Generate rooms
  while (rooms.length < rc && att < 300) {
    att++;
    const w = rng(5, 12), h = rng(4, 9), x = rng(1, MW - w - 1), y = rng(1, MH - h - 1);
    let ov = false;
    for (const r of rooms) {
      if (x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y) { ov = true; break; }
    }
    if (!ov) {
      rooms.push({ x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) });
      for (let ry = y; ry < y + h; ry++) for (let rx = x; rx < x + w; rx++) map[ry][rx] = TL.FLOOR;
    }
  }

  // Carve corridors
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1], b = rooms[i];
    carve(map, a.cx, a.cy, b.cx, b.cy);
  }
  for (let i = 0; i < Math.floor(rooms.length / 3); i++) {
    const a = pick(rooms), b = pick(rooms);
    if (a !== b) carve(map, a.cx, a.cy, b.cx, b.cy);
  }

  // Stairs (only if not final floor)
  const lr = rooms[rooms.length - 1];
  if (floor < FINAL) {
    map[lr.cy][lr.cx] = TL.STAIR;
  }

  // Water
  for (let i = 0; i < rng(3, 8); i++) {
    const rx = rng(1, MW - 2), ry = rng(1, MH - 2);
    if (map[ry][rx] === TL.FLOOR) map[ry][rx] = TL.WATER;
  }

  // Fountains — roughly 40% chance per floor
  const fr: Room[] = [];
  if (Math.random() < 0.4) {
    const candidates = rooms.slice(1, -1);
    if (candidates.length > 0) fr.push(pick(candidates));
  }
  for (const rm of fr) {
    const fx = rng(rm.x + 1, rm.x + rm.w - 2), fy = rng(rm.y + 1, rm.y + rm.h - 2);
    if (map[fy][fx] === TL.FLOOR) map[fy][fx] = TL.FOUNTAIN;
  }

  // Shrines — ~15% base, slowly increasing
  if (Math.random() < .10 + floor * .008) {
    const sr = rooms.slice(1, -1).filter(r => !fr.includes(r));
    if (sr.length > 0) {
      const rm = pick(sr);
      const sx = rng(rm.x + 1, rm.x + rm.w - 2), sy = rng(rm.y + 1, rm.y + rm.h - 2);
      if (map[sy][sx] === TL.FLOOR) map[sy][sx] = TL.SHRINE;
    }
  }

  // Area-specific special tiles
  const area = AREAS.find(a => floor >= a.floorStart && floor <= a.floorEnd);
  if (area?.specialTiles) {
    const st = area.specialTiles;
    const count = rng(st.count[0], st.count[1]);
    for (let i = 0; i < count; i++) {
      const rx = rng(1, MW - 2), ry = rng(1, MH - 2);
      if (map[ry][rx] === TL.FLOOR) map[ry][rx] = st.type;
    }
  }

  // Traps
  const tc = rng(1, 2) + Math.floor(floor / 4);
  const traps: Trap[] = [];
  for (let i = 0; i < tc; i++) {
    const rm = rooms[rng(1, rooms.length - 1)];
    if (!rm) continue;
    const tx = rng(rm.x + 1, rm.x + rm.w - 2), ty = rng(rm.y + 1, rm.y + rm.h - 2);
    if (map[ty][tx] === TL.FLOOR) {
      const tt = ALL_TRAPS[Math.min(ALL_TRAPS.length - 1, rng(0, Math.floor(floor / 3)))];
      const fs = 1 + (floor - 1) * .15;
      traps.push({ x: tx, y: ty, n: tt.n, dmg: Math.floor(tt.dmg * fs), c: tt.c, ds: tt.ds, triggered: false, hidden: Math.random() < .35, ef: tt.ef, dur: tt.dur });
    }
  }

  return { map, rooms, stair: { x: lr.cx, y: lr.cy }, traps };
}

function carve(map: number[][], x1: number, y1: number, x2: number, y2: number): void {
  let x = x1, y = y1;
  while (x !== x2) { if (map[y][x] === TL.WALL) map[y][x] = TL.CORR; x += x < x2 ? 1 : -1; }
  while (y !== y2) { if (map[y][x] === TL.WALL) map[y][x] = TL.CORR; y += y < y2 ? 1 : -1; }
}

export function computeFOV(map: number[][], px: number, py: number, rad: number): boolean[][] {
  const v: boolean[][] = Array.from({ length: MH }, () => Array(MW).fill(false));
  v[py][px] = true;
  for (let a = 0; a < 360; a += 1) {
    const r = a * Math.PI / 180, dx = Math.cos(r), dy = Math.sin(r);
    let x = px + .5, y = py + .5;
    for (let d = 0; d < rad; d++) {
      x += dx; y += dy;
      const ix = Math.floor(x), iy = Math.floor(y);
      if (ix < 0 || ix >= MW || iy < 0 || iy >= MH) break;
      v[iy][ix] = true;
      if (map[iy][ix] === TL.WALL) break;
    }
  }
  return v;
}

/** Unified FOV update: computes visibility, marks explored, reveals hidden traps. */
export function updatePlayerFOV(player: Player, map: number[][], traps?: Trap[]): void {
  let rad = FOV;
  for (const b of player.buffs) { if (b.type === 'torch') rad += b.value; }
  rad += getMetaFovBonus();
  if (player.talents?.talents?.['r_night_vision']) rad += 2;
  player.visible = computeFOV(map, player.x, player.y, rad);
  let exploredNew = false;
  for (let y = 0; y < MH; y++)
    for (let x = 0; x < MW; x++)
      if (player.visible[y][x] && !player.explored[y][x]) { player.explored[y][x] = true; exploredNew = true; }
  if (exploredNew && (window as any).__markMinimapDirty) (window as any).__markMinimapDirty();
  if (traps) for (const trap of traps) if (player.visible[trap.y]?.[trap.x] && trap.hidden) trap.hidden = false;
}
