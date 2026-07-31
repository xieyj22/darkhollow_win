// Ambient particle system — area-themed atmospheric particles
import { G, reducedMotion } from './state.js';
import { TS } from './config.js';
import { AREAS } from './data.js';
import { drawFx, clearFx } from './fx.js';
import { applyShakeFrame, resetShake } from './effects.js';

// Late-bound player-layer drawer (set from render.ts via main.ts wiring).
let _drawPlayerLayer: ((c: CanvasRenderingContext2D) => void) | null = null;
export function setDrawPlayerLayerFn(fn: ((c: CanvasRenderingContext2D) => void) | null): void {
  _drawPlayerLayer = fn;
}

// Late-bound enemy-layer drawer (set from render.ts via main.ts wiring).
let _drawEnemyLayer: ((c: CanvasRenderingContext2D) => void) | null = null;
export function setDrawEnemyLayerFn(fn: ((c: CanvasRenderingContext2D) => void) | null): void {
  _drawEnemyLayer = fn;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
}

const MAX_PARTICLES = 35;
let particles: Particle[] = [];
let animFrame: number | null = null;
let snapshot: ImageData | null = null;
// Offscreen canvas for fast blitting (much faster than putImageData every frame)
let offscreenCvs: HTMLCanvasElement | null = null;
let offscreenCtx: CanvasRenderingContext2D | null = null;
let snapshotDirty = false;

// Area-specific particle themes
const AREA_THEMES: Record<string, { color: string; vy: number; vx: number; size: number }> = {
  'caverns':        { color: '200,200,200', vy: -0.15, vx: 0.1,  size: 1 },
  'crypts':         { color: '180,160,220', vy: -0.1,  vx: 0.15, size: 1.5 },
  'burning_depths': { color: '255,120,30',  vy: -0.3,  vx: 0.05, size: 1.5 },
  'dark_fortress':  { color: '160,160,180', vy: -0.05, vx: 0.1,  size: 1 },
  'dragons_domain': { color: '255,80,20',   vy: -0.35, vx: 0.08, size: 1.5 },
  'abyss':          { color: '0,206,209',   vy: -0.08, vx: 0.12, size: 1.5 },
  'void_realm':     { color: '140,60,200',  vy: -0.1,  vx: 0.2,  size: 1 },
  'final_sanctum':  { color: '255,215,0',   vy: -0.2,  vx: 0.1,  size: 1.5 },
};

function getAreaId(floor: number): string {
  const area = AREAS.find(a => floor >= a.floorStart && floor <= a.floorEnd);
  return area ? area.id : 'caverns';
}

function spawnParticle(floor: number): Particle {
  const theme = AREA_THEMES[getAreaId(floor)] || AREA_THEMES['caverns'];
  const cvs = (window as any).__canvas as HTMLCanvasElement;
  const w = cvs?.width || 800;
  const h = cvs?.height || 600;
  return {
    x: Math.random() * w,
    y: theme.vy < 0 ? h + 5 : -5,
    vx: (Math.random() - 0.5) * theme.vx * 4,
    vy: theme.vy * (0.5 + Math.random()),
    life: 0,
    maxLife: 200 + Math.random() * 300,
    size: theme.size * (0.5 + Math.random() * 0.8),
    color: theme.color,
    alpha: 0,
  };
}

export function captureSnapshot(): void {
  const cvs = (window as any).__canvas as HTMLCanvasElement;
  const c = (window as any).__ctx as CanvasRenderingContext2D;
  if (!cvs || !c) return;
  // Lazily create offscreen canvas matching main canvas size
  if (!offscreenCvs || offscreenCvs.width !== cvs.width || offscreenCvs.height !== cvs.height) {
    offscreenCvs = document.createElement('canvas');
    offscreenCvs.width = cvs.width;
    offscreenCvs.height = cvs.height;
    offscreenCtx = offscreenCvs.getContext('2d');
  }
  if (offscreenCtx) {
    try { offscreenCtx.drawImage(cvs, 0, 0); snapshotDirty = true; } catch {}
  }
}

function tick(): void {
  if (!G) { animFrame = requestAnimationFrame(tick); return; }

  const cvs = (window as any).__canvas as HTMLCanvasElement;
  const c = (window as any).__ctx as CanvasRenderingContext2D;
  if (!cvs || !c) { animFrame = requestAnimationFrame(tick); return; }

  // Restore base render via fast drawImage (much faster than putImageData)
  if (offscreenCvs && snapshotDirty) {
    c.drawImage(offscreenCvs, 0, 0);
  } else if (offscreenCvs) {
    // No new snapshot yet — redraw last known good state
    c.drawImage(offscreenCvs, 0, 0);
  } else {
    animFrame = requestAnimationFrame(tick);
    return;
  }

  // Enemy layer — tweened positions + idle bob, drawn under the player.
  if (_drawEnemyLayer) _drawEnemyLayer(c);

  // Player layer — drawn from the tweened position on top of the snapshot.
  if (_drawPlayerLayer) _drawPlayerLayer(c);

  // Spawn new particles
  const aMax = reducedMotion ? 0.12 : 0.35;
  const speedMul = reducedMotion ? 0.5 : 1;
  if (particles.length < MAX_PARTICLES && Math.random() < (reducedMotion ? 0.045 : 0.15)) {
    particles.push(spawnParticle(G.floor));
  }

  // Update & draw particles
  const w = cvs.width;
  const h = cvs.height;
  let wi = 0;
  for (const p of particles) {
    p.life++;
    p.x += p.vx * speedMul;
    p.y += p.vy * speedMul;

    // Fade in then out
    const ratio = p.life / p.maxLife;
    if (ratio < 0.1) p.alpha = ratio / 0.1 * aMax;
    else if (ratio > 0.7) p.alpha = (1 - ratio) / 0.3 * aMax;
    else p.alpha = aMax;

    // Only draw if within visible FOV (approximate check)
    const tileX = Math.floor(p.x / TS) + G!.vx;
    const tileY = Math.floor(p.y / TS) + G!.vy;
    const inFov = G!.player.visible?.[tileY]?.[tileX];
    if (inFov && p.alpha > 0.01 && p.x > 0 && p.x < w && p.y > 0 && p.y < h) {
      c.globalAlpha = p.alpha;
      c.fillStyle = `rgb(${p.color})`;
      c.beginPath();
      c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      c.fill();
    }

    if (p.life < p.maxLife && p.x > -10 && p.x < w + 10 && p.y > -10 && p.y < h + 10) {
      particles[wi++] = p;
    }
  }
  c.globalAlpha = 1;
  particles.length = wi;

  // Combat FX (hit-flash, bursts, projectiles) on top of the snapshot, then the
  // per-frame screen-shake transform. Both are no-ops when nothing is active.
  drawFx(c);
  applyShakeFrame();

  animFrame = requestAnimationFrame(tick);
}

export function startParticles(): void {
  if (animFrame) return;
  animFrame = requestAnimationFrame(tick);
}

export function stopParticles(): void {
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
  particles = [];
  snapshot = null;
  offscreenCvs = null;
  offscreenCtx = null;
  snapshotDirty = false;
  clearFx();
  resetShake();
}
