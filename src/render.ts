// Canvas rendering + minimap
import { G, canvas, ctx, miniCtx, minimapScale, lang, reducedMotion } from './state.js';
import { setCanvas, setMiniCanvas } from './state.js';
import { TS, MW, MH, TL, FINAL } from './config.js';
import { clamp, dst, darken, darkenTinted } from './utils.js';
import { RARITY_C, rareName } from './i18n.js';
import { AREAS, EQUIPMENT_SETS } from './data.js';
import { drawPlayerSprite, drawEnemySprite, drawBossSprite, drawItemSprite, drawStairSprite, drawTrapSprite, drawFountainSprite, drawShrineSprite } from './sprites.js';
import { captureSnapshot } from './particles.js';

// Themed monospace font matching CSS --font-mono
const FONT = "'JetBrains Mono', Consolas, 'Courier New', monospace";

// Player tween — player lives in the dynamic layer (particles.tick) so its
// position can slide between tiles. Logic stays discrete (turn-based).
interface PlayerTween { fx: number; fy: number; tx: number; ty: number; t0: number; }
let _playerTween: PlayerTween | null = null;
const TWEEN_DUR_MS = 90;

export function setPlayerTween(fx: number, fy: number, tx: number, ty: number): void {
  if (reducedMotion) { _playerTween = null; return; } // reduced-motion: instant
  _playerTween = { fx, fy, tx, ty, t0: performance.now() };
}

// Called every frame by particles.ts tick() on top of the snapshot.
export function drawPlayerLayer(c: CanvasRenderingContext2D): void {
  if (!G) return;
  let lx = G.player.x, ly = G.player.y;
  if (_playerTween) {
    const p = Math.min(1, (performance.now() - _playerTween.t0) / TWEEN_DUR_MS);
    const e = 1 - (1 - p) * (1 - p); // easeOutQuad
    lx = _playerTween.fx + (_playerTween.tx - _playerTween.fx) * e;
    ly = _playerTween.fy + (_playerTween.ty - _playerTween.fy) * e;
    if (p >= 1) _playerTween = null;
  }
  const px = (lx - G.vx) * TS, py = (ly - G.vy) * TS;
  const pGrad = c.createRadialGradient(px + TS / 2, py + TS / 2, 2, px + TS / 2, py + TS / 2, TS * 1.5);
  pGrad.addColorStop(0, 'rgba(255,215,0,0.12)');
  pGrad.addColorStop(0.5, 'rgba(255,215,0,0.05)');
  pGrad.addColorStop(1, 'rgba(255,215,0,0)');
  c.fillStyle = pGrad; c.fillRect(px - TS * 0.5, py - TS * 0.5, TS * 2, TS * 2);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  drawPlayerSprite(c, px, py, G.player.ci);
}

// Cached minimap — redrawn only when the game state changes, not every frame
let minimapCanvas: HTMLCanvasElement | null = null;
let minimapDirty = true;
export function markMinimapDirty(): void { minimapDirty = true; }

// Pre-rendered scanline overlay (avoids 300+ fillRect calls per frame)
let scanlineCanvas: HTMLCanvasElement | null = null;
function getScanlineOverlay(w: number, h: number): HTMLCanvasElement {
  if (scanlineCanvas && scanlineCanvas.width === w && scanlineCanvas.height === h) return scanlineCanvas;
  scanlineCanvas = document.createElement('canvas');
  scanlineCanvas.width = w;
  scanlineCanvas.height = h;
  const sc = scanlineCanvas.getContext('2d')!;
  sc.fillStyle = 'rgba(0,0,0,0.02)';
  for (let y = 0; y < h; y += 2) sc.fillRect(0, y, w, 1);
  return scanlineCanvas;
}

export function resizeCanvas(): void {
  const c = document.getElementById('game-canvas') as HTMLCanvasElement;
  const mc = document.getElementById('minimap-canvas') as HTMLCanvasElement;
  if (!c || !mc) return;
  const area = document.getElementById('map-area');
  if (!area) return;
  (window as any).__canvas = c;
  (window as any).__ctx = c.getContext('2d');
  (window as any).__miniCtx = mc.getContext('2d');
  // Also set state.ts refs so effects.ts (flt/shake) can access canvas
  setCanvas(c);
  setMiniCanvas(mc);
  mc.width = MW * 3;
  mc.height = MH * 3;
  c.width = Math.floor((area.clientWidth - 20) / TS) * TS;
  c.height = Math.floor((area.clientHeight - 20) / TS) * TS;
  // Invalidate cached scanline overlay since canvas size changed
  scanlineCanvas = null;
  // Invalidate minimap cache (canvas size or zoom may have changed)
  minimapCanvas = null;
}

function getAreaForFloor(floor: number) {
  return AREAS.find(a => floor >= a.floorStart && floor <= a.floorEnd) || AREAS[0];
}

export function render(): void {
  if (!G) return;
  const cvs = (window as any).__canvas as HTMLCanvasElement;
  const c = (window as any).__ctx as CanvasRenderingContext2D;
  if (!cvs || !c) return;

  const vc = Math.floor(cvs.width / TS), vr = Math.floor(cvs.height / TS);
  G.vx = clamp(G.player.x - Math.floor(vc / 2), 0, Math.max(0, MW - vc));
  G.vy = clamp(G.player.y - Math.floor(vr / 2), 0, Math.max(0, MH - vr));

  const area = getAreaForFloor(G.floor);
  const fovRad = 10 + (G.player.talents?.talents?.['r_night_vision'] ? 2 : 0); // approximate for falloff calc

  c.fillStyle = '#000';
  c.fillRect(0, 0, cvs.width, cvs.height);

  // Shared text settings (set once per render, not per tile)
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = `${TS - 4}px ${FONT}`;

  // Tiles — area-aware rendering with distance-based FOV falloff
  for (let vy = 0; vy < vr; vy++) {
    for (let vx = 0; vx < vc; vx++) {
      const mx = G.vx + vx, my = G.vy + vy;
      if (mx >= MW || my >= MH) continue;
      const sx = vx * TS, sy = vy * TS;
      const vis = G.player.visible?.[my]?.[mx];
      const exp = G.player.explored?.[my]?.[mx];
      if (!exp) continue;
      const tile = G.dungeon.map[my][mx];
      let ch: string, fg: string, bg: string;
      switch (tile) {
        case TL.WALL: ch = area.wallChar; fg = area.wallColor; bg = area.bgColor; break;
        case TL.FLOOR: ch = area.floorChar; fg = area.floorColor; bg = '#111'; break;
        case TL.CORR: ch = '·'; fg = area.corrColor; bg = '#0d0d0d'; break;
        case TL.DOOR: ch = '+'; fg = '#8b4513'; bg = '#111'; break;
        case TL.STAIR: ch = '>'; fg = '#7ec8e3'; bg = '#0a1520'; break;
        case TL.WATER: ch = '≈'; fg = '#1a5276'; bg = '#0a1a2a'; break;
        case TL.FOUNTAIN: ch = 'Ø'; fg = '#4895ef'; bg = '#0a1520'; break;
        case TL.SHRINE: ch = '♦'; fg = '#06d6a0'; bg = '#0a1a10'; break;
        case TL.LAVA: ch = '*'; fg = '#ff4500'; bg = '#2a0a0a'; break;
        case TL.ABYSS_WATER: ch = '~'; fg = '#00ced1'; bg = '#0a1520'; break;
        case TL.VOID_FLOOR: ch = ' '; fg = '#2a0040'; bg = '#0a0010'; break;
        case TL.CRYSTAL: ch = '◆'; fg = '#ffd700'; bg = '#1a1a05'; break;
        default: ch = ' '; fg = '#000'; bg = '#000';
      }
      if (!vis) {
        // Explored but not visible: dark with cool blue tint
        fg = darkenTinted(fg, 0.35);
        bg = darkenTinted(bg, 0.35);
      } else {
        // Visible: distance-based light falloff
        const d = dst(mx, my, G.player.x, G.player.y);
        const falloff = d > fovRad * 0.6 ? 0.5 + 0.5 * (1 - (d - fovRad * 0.6) / (fovRad * 0.4)) : 1;
        const f = Math.max(0.45, Math.min(1, falloff));
        if (f < 1) { fg = darken(fg, f); bg = darken(bg, f); }
      }
      c.fillStyle = bg; c.fillRect(sx, sy, TS, TS);
      if (tile === TL.STAIR) { drawStairSprite(c, sx, sy); continue; }
      if (tile === TL.FOUNTAIN) { drawFountainSprite(c, sx, sy); continue; }
      if (tile === TL.SHRINE) { drawShrineSprite(c, sx, sy); continue; }
      c.fillStyle = fg;
      c.fillText(ch, sx + TS / 2, sy + TS / 2);
    }
  }

  // Traps
  if (G.traps) for (const trap of G.traps) {
    if (trap.triggered || (!trap.playerTrap && trap.hidden) || !G.player.visible?.[trap.y]?.[trap.x]) continue;
    const sx = (trap.x - G.vx) * TS, sy = (trap.y - G.vy) * TS;
    if (sx < 0 || sy < 0 || sx >= cvs.width || sy >= cvs.height) continue;
    drawTrapSprite(c, sx, sy, trap.c);
  }

  // Items (show within full FOV) — bold glyph
  c.font = `bold ${TS - 4}px ${FONT}`;
  for (const item of G.items) {
    if (!G.player.visible?.[item.y]?.[item.x]) continue;
    const sx = (item.x - G.vx) * TS, sy = (item.y - G.vy) * TS;
    if (sx < 0 || sy < 0 || sx >= cvs.width || sy >= cvs.height) continue;
    if (item.npc) {
      // Map entities (chests/merchants) get a framed background so they stand out.
      c.fillStyle = item.c + '33'; c.fillRect(sx, sy, TS, TS);
      c.strokeStyle = item.c + 'aa'; c.lineWidth = 1; c.strokeRect(sx + 0.5, sy + 0.5, TS - 1, TS - 1);
    } else if (item.rarity >= 4) {
      // Legendary items get a brighter glow
      c.fillStyle = '#ffd70020'; c.fillRect(sx - 2, sy - 2, TS + 4, TS + 4);
      c.fillStyle = item.c + '15'; c.fillRect(sx, sy, TS, TS);
    } else {
      c.fillStyle = item.c + '15'; c.fillRect(sx, sy, TS, TS);
    }
    c.fillStyle = item.c;
    drawItemSprite(c, sx, sy, item);
  }

  // Enemies — improved rendering
  for (const e of G.enemies) {
    if (!G.player.visible?.[e.y]?.[e.x]) continue;
    const sx = (e.x - G.vx) * TS, sy = (e.y - G.vy) * TS;
    if (sx < 0 || sy < 0 || sx >= cvs.width || sy >= cvs.height) continue;

    // Low-HP red tint
    const lowHp = e.hp > 0 && e.hp / e.maxHp <= 0.25;
    c.fillStyle = e.isBoss ? '#3a0000' : e.isElite ? '#2a1a00' : lowHp ? '#250a0a' : '#1a0a0a';
    c.fillRect(sx, sy, TS, TS);

    // Boss radial aura
    if (e.isBoss) {
      const grad = c.createRadialGradient(sx + TS / 2, sy + TS / 2, 2, sx + TS / 2, sy + TS / 2, TS * 1.5);
      grad.addColorStop(0, 'rgba(255,215,0,0.18)');
      grad.addColorStop(0.5, 'rgba(255,215,0,0.08)');
      grad.addColorStop(1, 'rgba(255,215,0,0)');
      c.fillStyle = grad; c.fillRect(sx - TS * 0.5, sy - TS * 0.5, TS * 2, TS * 2);
    }
    // Elite element glow
    if (e.isElite && e.el !== 'none') {
      const elColors: Record<string, string> = { fire: '255,69,0', ice: '100,149,237', lightning: '255,215,0', shadow: '128,0,128', holy: '255,255,200' };
      const ec = elColors[e.el] || '255,255,255';
      const grad = c.createRadialGradient(sx + TS / 2, sy + TS / 2, 1, sx + TS / 2, sy + TS / 2, TS);
      grad.addColorStop(0, `rgba(${ec},0.12)`);
      grad.addColorStop(1, `rgba(${ec},0)`);
      c.fillStyle = grad; c.fillRect(sx - 4, sy - 4, TS + 8, TS + 8);
    }

    c.font = `bold ${TS - 4}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const ec = e.isAlly ? '#06d6a0' : e.c;
    if (e.isBoss) drawBossSprite(c, sx, sy, ec); else drawEnemySprite(c, sx, sy, ec, e);
    // Element indicator (colored corner glyph)
    if (e.el && e.el !== 'none') {
      const elIndSym: Record<string, string> = { fire: '▲', ice: '✻', lightning: '⚡', shadow: '◔', holy: '✦' };
      const elIndColor: Record<string, string> = { fire: '#ff7a45', ice: '#7ec8e3', lightning: '#fff2a8', shadow: '#b583f6', holy: '#ffd700' };
      c.font = `${Math.floor(TS / 3)}px ${FONT}`;
      c.fillStyle = elIndColor[e.el] || '#fff';
      c.fillText(elIndSym[e.el] || '', sx + TS - 4, sy + 4);
    }
    // HP bar — thicker and gold for bosses
    if (e.hp < e.maxHp) {
      const bw = TS - 2, bh = e.isBoss ? 6 : 4, by = e.isBoss ? sy - 5 : sy - 3;
      c.fillStyle = e.isBoss ? '#332' : '#300'; c.fillRect(sx + 1, by, bw, bh);
      c.fillStyle = e.isBoss ? '#ffd700' : '#e63946'; c.fillRect(sx + 1, by, Math.max(1, bw * (e.hp / e.maxHp)), bh - 1);
      c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(sx + 1, by, Math.max(1, bw * (e.hp / e.maxHp)), 1);
    }
  }

  // Player — radial glow
  const px = (G.player.x - G.vx) * TS, py = (G.player.y - G.vy) * TS;

  // Vignette overlay
  const vCx = px + TS / 2, vCy = py + TS / 2;
  const vMaxR = Math.max(8, Math.max(cvs.width, cvs.height) * 0.7);
  const vGrad = c.createRadialGradient(vCx, vCy, vMaxR * 0.3, vCx, vCy, vMaxR);
  vGrad.addColorStop(0, 'rgba(0,0,0,0)');
  vGrad.addColorStop(0.6, 'rgba(0,0,0,0.15)');
  vGrad.addColorStop(1, 'rgba(0,0,0,0.55)');
  c.fillStyle = vGrad; c.fillRect(0, 0, cvs.width, cvs.height);

  // Warm tint overlay
  c.fillStyle = 'rgba(20,10,0,0.03)'; c.fillRect(0, 0, cvs.width, cvs.height);

  // Scanlines (pre-rendered offscreen canvas — one drawImage instead of 300 fillRects)
  c.drawImage(getScanlineOverlay(cvs.width, cvs.height), 0, 0);

  renderMinimap();

  // Capture snapshot for ambient particle overlay
  captureSnapshot();
}

export function renderMinimap(): void {
  if (!G) return;
  const s = minimapScale;
  const mc = document.getElementById('minimap-canvas') as HTMLCanvasElement;
  const mic = mc?.getContext('2d');
  if (!mic) return;

  // Static map layer (explored tiles/walls/special tiles) is expensive O(MH*MW);
  // cache it to an offscreen canvas and only regenerate when dirty.
  if (!minimapCanvas || minimapCanvas.width !== MW * s || minimapCanvas.height !== MH * s) {
    minimapCanvas = document.createElement('canvas');
    minimapCanvas.width = MW * s;
    minimapCanvas.height = MH * s;
    minimapDirty = true;
  }
  if (minimapDirty) {
    const off = minimapCanvas.getContext('2d')!;
    off.fillStyle = '#000'; off.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (!G.player.explored[y]?.[x]) continue;
      const tile = G.dungeon.map[y][x];
      if (tile === TL.VOID) continue;
      if (tile === TL.WALL) {
        off.fillStyle = '#0d0d14';
        off.fillRect(x * s, y * s, s, s);
        continue;
      }
      off.fillStyle = '#1a1a24';
      if (tile === TL.STAIR) off.fillStyle = '#7ec8e3';
      if (tile === TL.FOUNTAIN) off.fillStyle = '#4895ef';
      if (tile === TL.SHRINE) off.fillStyle = '#06d6a0';
      if (tile === TL.LAVA) off.fillStyle = '#ff4500';
      if (tile === TL.ABYSS_WATER) off.fillStyle = '#00ced1';
      if (tile === TL.CRYSTAL) off.fillStyle = '#ffd700';
      off.fillRect(x * s, y * s, s, s);
    }
    minimapDirty = false;
  }

  mic.drawImage(minimapCanvas, 0, 0);
  if (G.traps) for (const trap of G.traps) {
    if (trap.triggered || (!trap.playerTrap && trap.hidden) || !G.player.visible?.[trap.y]?.[trap.x]) continue;
    mic.fillStyle = trap.playerTrap ? '#06d6a0' : '#f4845f'; mic.fillRect(trap.x * s, trap.y * s, s, s);
  }
  // Items on minimap (gold as tiny dots, others as slightly larger)
  for (const item of G.items) {
    if (!G.player.visible?.[item.y]?.[item.x]) continue;
    mic.fillStyle = item.type === 'gold' ? '#ffd700' : item.c;
    mic.fillRect(item.x * s, item.y * s, s, s);
  }
  for (const e of G.enemies) {
    if (!G.player.visible?.[e.y]?.[e.x] || e.isAlly) continue;
    // Filled (red / gold for boss) WITH a dark outline — shape+outline backs up the red/green cue
    mic.fillStyle = e.isBoss ? '#ffd700' : '#e63946';
    mic.fillRect(e.x * s, e.y * s, s, s);
    mic.strokeStyle = '#000'; mic.lineWidth = 1;
    mic.strokeRect(e.x * s + 0.5, e.y * s + 0.5, Math.max(1, s - 1), Math.max(1, s - 1));
  }
  for (const e of G.enemies) {
    if (!e.isAlly || !G.player.visible?.[e.y]?.[e.x]) continue;
    // Hollow green ring so allies read differently from filled enemies even without color
    mic.strokeStyle = '#06d6a0'; mic.lineWidth = 1;
    mic.strokeRect(e.x * s + 0.5, e.y * s + 0.5, Math.max(1, s - 1), Math.max(1, s - 1));
  }
  // Player dot with bright center
  mic.fillStyle = '#ffd700'; mic.fillRect(G.player.x * s - 1, G.player.y * s - 1, s + 1, s + 1);
  mic.fillStyle = '#fff'; mic.fillRect(G.player.x * s, G.player.y * s, s > 2 ? 2 : 1, s > 2 ? 2 : 1);
  // Viewport rectangle outline
  const vc = Math.floor(((window as any).__canvas as HTMLCanvasElement)?.width / TS) || 30;
  const vr = Math.floor(((window as any).__canvas as HTMLCanvasElement)?.height / TS) || 20;
  mic.strokeStyle = 'rgba(255,255,255,0.2)';
  mic.lineWidth = 1;
  mic.strokeRect(G.vx * s + 0.5, G.vy * s + 0.5, vc * s, vr * s);
}

export function updateUI(): void {
  if (!G) return;
  const p = G.player;
  const $ = (id: string) => document.getElementById(id);

  $('s-name')!.textContent = lang === 'zh' ? '冒险者' : 'Adventurer';
  $('s-race')!.textContent = p.raceName; $('s-class')!.textContent = p.clsName;
  $('s-level')!.textContent = String(p.level); $('s-atk')!.textContent = String(p.atk);
  $('s-def')!.textContent = String(p.def); $('s-gold')!.textContent = String(p.gold);
  $('s-floor')!.textContent = String(G.floor); $('s-turns')!.textContent = String(p.turns);
  $('s-combo')!.textContent = p.streak > 0 ? p.streak + 'x' : '-';

  $('hp-fill')!.style.width = `${(p.hp / p.maxHp) * 100}%`;
  $('hp-text')!.textContent = `HP ${p.hp}/${p.maxHp}`;
  // Critical HP bar pulse
  const hpBar = $('hp-fill')!.parentElement!;
  if (p.hp > 0 && p.hp / p.maxHp <= 0.25) hpBar.classList.add('critical');
  else hpBar.classList.remove('critical');
  $('mp-fill')!.style.width = `${(p.mp / p.maxMp) * 100}%`;
  $('mp-text')!.textContent = `MP ${p.mp}/${p.maxMp}`;
  $('xp-fill')!.style.width = `${(p.exp / p.expNext) * 100}%`;
  $('xp-text')!.textContent = `XP ${p.exp}/${p.expNext}`;

  const hFill = $('hunger-fill')!;
  hFill.style.width = `${(p.hunger / p.maxHunger) * 100}%`;
  hFill.className = 'fill bt' + (p.hunger <= 20 ? ' low' : '');
  $('hunger-text')!.textContent = `${lang === 'zh' ? '饥饿' : 'Hunger'} ${p.hunger}`;

  const eqN = (id: string, v: any) => {
    const el = $(id)!; el.textContent = v ? v.name : (lang === 'zh' ? '无' : 'None');
    (el as HTMLElement).style.color = v ? RARITY_C[v.rarity] : '#555';
  };
  eqN('eq-weapon', p.eq.weapon); eqN('eq-armor', p.eq.armor); eqN('eq-accessory', p.eq.accessory); eqN('eq-accessory2', p.eq.accessory2);

  // Buffs
  const bd = $('buff-list')!;
  bd.innerHTML = '';
  for (const b of p.buffs) {
    const s = document.createElement('div'); s.className = b.type === 'slow' ? 'buff neg' : 'buff';
    s.textContent = `${b.name}(${b.turns}t)${b.value ? '+' + b.value : ''}`; bd.appendChild(s);
  }
  if (p.poisonTurns > 0) {
    const s = document.createElement('div'); s.className = 'buff neg';
    s.textContent = lang === 'zh' ? `中毒(${p.poisonTurns}t) -${p.poisonDmg}/t` : `Poison(${p.poisonTurns}t) -${p.poisonDmg}/t`;
    bd.appendChild(s);
  }
  if (p.slowed > 0) {
    const s = document.createElement('div'); s.className = 'buff neg';
    s.textContent = `🐌 ${lang === 'zh' ? '减速' : 'Slowed'}(${p.slowed}t)`;
    bd.appendChild(s);
  }

  // Set bonuses display
  const setIds = Object.keys(p.setBonusActive || {});
  for (const setId of setIds) {
    const count = p.setBonusActive[setId] || 0;
    if (count < 2) continue;
    const setDef = EQUIPMENT_SETS.find(s => s.id === setId);
    if (!setDef) continue;
    for (const bonus of setDef.bonuses) {
      if (count >= bonus.required) {
        const s = document.createElement('div'); s.className = 'buff';
        const bName = lang === 'zh' ? setDef.n.zh : setDef.n.en;
        const bDesc = lang === 'zh' ? bonus.desc.zh : bonus.desc.en;
        s.textContent = `${bName}(${count}): ${bDesc}`; bd.appendChild(s);
      }
    }
  }

  if (!p.buffs.length && p.poisonTurns <= 0 && setIds.every(id => (p.setBonusActive[id] || 0) < 2)) {
    bd.innerHTML = '<div style="color:#555">' + (lang === 'zh' ? '无' : 'None') + '</div>';
  }

  // Floor label with area name
  const area = getAreaForFloor(G.floor);
  const areaName = lang === 'zh' ? area.n.zh : area.n.en;
  let ft = `${areaName} ${G.floor}F`;
  if (G.floor % 5 === 0) ft += ' ⚠ BOSS';
  if (G.floor === FINAL) ft += ' ★ FINAL';
  $('floor-label')!.textContent = ft;

  const sd = $('streak-display')!;
  if (p.streak >= 3) { sd.style.display = 'block'; sd.textContent = `🔥 ${p.streak}x ${lang === 'zh' ? '连杀' : 'STREAK'}`; }
  else { sd.style.display = 'none'; }

  renderObjective();
  // renderHotbar is imported from items — call via late binding
  if ((window as any).__renderHotbar) (window as any).__renderHotbar();
  updateSoundBtn();
}

function renderObjective(): void {
  if (!G) return;
  const zh = lang === 'zh';
  const fl = G.floor;
  const totalBosses = 8;
  const nextBoss = Math.ceil(fl / 5) * 5;
  const bossesKilled = Math.floor((fl - 1) / 5);
  const panel = document.getElementById('objective-panel')!;
  panel.innerHTML =
    `<div class="obj-row"><span class="ol">${zh ? '目标' : 'Goal'}</span><span class="ov">${zh ? '击败创世者(第40层)' : 'Beat The Creator (F40)'}</span></div>` +
    `<div class="obj-row"><span class="ol">${zh ? '进度' : 'Progress'}</span><span class="ov">${fl}/${FINAL}</span></div>` +
    `<div class="obj-bar"><div class="fill" style="width:${(fl / FINAL) * 100}%"></div></div>` +
    `<div class="obj-row"><span class="ol">${zh ? '下个Boss' : 'Next Boss'}</span><span class="ov${fl === nextBoss && fl % 5 === 0 ? ' boss' : ''}">${zh ? '第' : 'F'} ${nextBoss}${fl === nextBoss && fl % 5 === 0 ? (zh ? ' ⚠ 当前层！' : ' ⚠ HERE!') : ''}</span></div>` +
    `<div class="obj-row"><span class="ol">${zh ? 'Boss击杀' : 'Bosses'}</span><span class="ov${bossesKilled >= totalBosses ? ' done' : ''}">${bossesKilled}/${totalBosses}</span></div>`;
}

function updateSoundBtn(): void {
  const on = document.getElementById('btn-sound');
  const off = document.getElementById('btn-mute');
  const muted = (window as any).__muted;
  if (on && off) {
    if (muted) { on.style.display = 'none'; off.style.display = 'block'; off.classList.add('active'); }
    else { on.style.display = 'block'; on.classList.add('active'); off.style.display = 'none'; }
  }
}
