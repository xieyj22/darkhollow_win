// Transient combat FX — hit-flash, death bursts, spell beams & bolts.
// Drawn on top of the rendered snapshot every frame by particles.ts tick().
// All coordinates are MAP TILE coords; converted to screen px at draw time so
// they stay aligned with the camera viewport (G.vx/G.vy). Short-lived & pooled.
import { G, reducedMotion } from './state.js';
import { TS } from './config.js';

type FxKind = 'flash' | 'beam' | 'bolt' | 'dash' | 'aura';

interface Fx {
  kind: FxKind;
  x: number; y: number;     // origin tile
  tx: number; ty: number;   // target tile (beam endpoint / bolt destination)
  life: number; maxLife: number;
  color: string;
  size: number;             // base radius in px
}

interface Spark {
  x: number; y: number;     // screen px
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number; color: string;
  r: number; g: number; b: number;
}

const fxs: Fx[] = [];
const sparks: Spark[] = [];
const MAX_FX = 48;
const MAX_SPARKS = 220;

function trim<T>(arr: T[], max: number): void {
  if (arr.length > max) arr.splice(0, arr.length - max);
}

function pxX(tx: number): number { return G ? (tx - G.vx) * TS + TS / 2 : tx * TS; }
function pxY(ty: number): number { return G ? (ty - G.vy) * TS + TS / 2 : ty * TS; }

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (h.length !== 6) return [255, 255, 255];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// Cached radial glow sprites for flash/bolt — avoids createRadialGradient every
// frame. Per-kind base stop alphas are baked in; the per-frame fade (`a`) is
// applied via globalAlpha at draw time, which is mathematically identical to the
// old per-frame `rgba(...,X*a)` stops with globalAlpha=1.
const fxGlowCache = new Map<string, HTMLCanvasElement>();
const FX_GLOW_R = 32; // reference radius; drawImage scales to the live radius
const FX_GLOW_STOPS: Record<'flash' | 'bolt', [number, number]> = {
  flash: [0.85, 0.55], // [white-center alpha, color-ring alpha]
  bolt: [1.0, 0.8],
};
function getFxGlow(color: string, kind: 'flash' | 'bolt'): HTMLCanvasElement {
  const key = kind + ':' + color;
  const cached = fxGlowCache.get(key);
  if (cached) return cached;
  const cv = document.createElement('canvas');
  cv.width = cv.height = FX_GLOW_R * 2;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(FX_GLOW_R, FX_GLOW_R, 0, FX_GLOW_R, FX_GLOW_R, FX_GLOW_R);
  const [r, gg, b] = rgb(color);
  const [ca, ra] = FX_GLOW_STOPS[kind];
  grad.addColorStop(0, `rgba(255,255,255,${ca})`);
  grad.addColorStop(0.4, `rgba(${r},${gg},${b},${ra})`);
  grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, cv.width, cv.height);
  fxGlowCache.set(key, cv);
  return cv;
}

// Expanding flash at a tile — hit confirmation / impact glow.
export function fxFlash(x: number, y: number, color: string, scale = 1): void {
  if (reducedMotion) return;
  fxs.push({ kind: 'flash', x, y, tx: x, ty: y, life: 0, maxLife: 9, color, size: TS * 0.75 * scale });
  trim(fxs, MAX_FX);
}

// Expanding stroked ring on a tile — sustained self-buff / aura. Visually distinct
// from fxFlash's filled radial glow: reads as "buff applied to self".
export function fxAura(x: number, y: number, color: string, scale = 1): void {
  if (reducedMotion) return;
  fxs.push({ kind: 'aura', x, y, tx: x, ty: y, life: 0, maxLife: 12, color, size: TS * 0.6 * scale });
  trim(fxs, MAX_FX);
}

// Jagged energy beam between two tiles — chain lightning / judgment.
export function fxBeam(x1: number, y1: number, x2: number, y2: number, color: string): void {
  if (reducedMotion) return;
  fxs.push({ kind: 'beam', x: x1, y: y1, tx: x2, ty: y2, life: 0, maxLife: 8, color, size: 2 });
  trim(fxs, MAX_FX);
}

// Travelling projectile orb from origin to destination tile — spell bolt.
export function fxBolt(x1: number, y1: number, x2: number, y2: number, color: string): void {
  if (reducedMotion) return;
  fxs.push({ kind: 'bolt', x: x1, y: y1, tx: x2, ty: y2, life: 0, maxLife: 7, color, size: TS * 0.4 });
  trim(fxs, MAX_FX);
}

// Quick motion trail between two tiles — player movement feedback (softer than a beam).
export function fxDash(x1: number, y1: number, x2: number, y2: number, color: string): void {
  if (reducedMotion) return;
  fxs.push({ kind: 'dash', x: x1, y: y1, tx: x2, ty: y2, life: 0, maxLife: 5, color, size: 0 });
  trim(fxs, MAX_FX);
}

// Particle burst — enemy death / explosion. count & power tune the spray.
export function fxBurst(x: number, y: number, color: string, count = 12, power = 1): void {
  if (reducedMotion) count = Math.min(count, 4);
  const cx = pxX(x), cy = pxY(y);
  const [r, g, b] = rgb(color);
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = (0.6 + Math.random() * 2.4) * power;
    sparks.push({
      x: cx, y: cy,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      life: 0, maxLife: 18 + Math.random() * 18,
      size: 1 + Math.random() * 2.2,
      color, r, g, b,
    });
  }
  trim(sparks, MAX_SPARKS);
}

export function clearFx(): void { fxs.length = 0; sparks.length = 0; }

// Test/e2e observable: total live fx entities (flashes/auras/beams + sparks).
// Zero-cost when unused; lets the in-game verify script assert that wiring
// sites (level-up aura, loot burst, pickup flash) actually fire.
export function fxCount(): number { return fxs.length + sparks.length; }

// Draw & advance every active FX/spark. Called once per frame by particles.ts.
export function drawFx(c: CanvasRenderingContext2D): void {
  if (!fxs.length && !sparks.length) return;
  c.save();
  c.globalCompositeOperation = 'lighter'; // additive — glows stack brightly

  if (sparks.length) {
    let w = 0;
    for (const s of sparks) {
      s.life++;
      s.x += s.vx; s.y += s.vy;
      s.vx *= 0.92; s.vy *= 0.92; s.vy += 0.05; // drag + slight gravity
      const t = s.life / s.maxLife;
      if (t >= 1) continue;
      const r = s.r, g = s.g, b = s.b;
      c.globalAlpha = 1 - t;
      c.fillStyle = `rgb(${r},${g},${b})`;
      c.beginPath();
      c.arc(s.x, s.y, s.size * (1 - t * 0.4), 0, Math.PI * 2);
      c.fill();
      sparks[w++] = s;
    }
    sparks.length = w;
  }

  if (fxs.length) {
    let w = 0;
    for (const f of fxs) {
      f.life++;
      const t = f.life / f.maxLife;
      if (t >= 1) continue;
      const [r, g, b] = rgb(f.color);
      const a = 1 - t;
      if (f.kind === 'aura') {
        const cx = pxX(f.x), cy = pxY(f.y);
        const rad = Math.max(1, f.size * (0.4 + t * 1.8));
        c.globalAlpha = a;
        c.strokeStyle = `rgba(${r},${g},${b},${a})`;
        c.lineWidth = 2 + (1 - t) * 1.5;
        c.shadowColor = f.color; c.shadowBlur = 10;
        c.beginPath(); c.arc(cx, cy, rad, 0, Math.PI * 2); c.stroke();
        c.shadowBlur = 0;
      } else if (f.kind === 'flash') {
        const cx = pxX(f.x), cy = pxY(f.y);
        const rad = Math.max(0.5, f.size * (0.5 + t * 1.5));
        const spr = getFxGlow(f.color, 'flash');
        c.globalAlpha = a;
        c.drawImage(spr, cx - rad, cy - rad, rad * 2, rad * 2);
      } else if (f.kind === 'beam') {
        const x1 = pxX(f.x), y1 = pxY(f.y), x2 = pxX(f.tx), y2 = pxY(f.ty);
        c.globalAlpha = a;
        c.strokeStyle = `rgba(${r},${g},${b},${a})`;
        c.lineWidth = 2 + (1 - t) * 2;
        c.shadowColor = f.color; c.shadowBlur = 8;
        c.beginPath();
        const segs = 6;
        c.moveTo(x1, y1);
        for (let i = 1; i < segs; i++) {
          const tt = i / segs;
          const jx = x1 + (x2 - x1) * tt + (Math.random() - 0.5) * 8;
          const jy = y1 + (y2 - y1) * tt + (Math.random() - 0.5) * 8;
          c.lineTo(jx, jy);
        }
        c.lineTo(x2, y2);
        c.stroke();
        c.shadowBlur = 0;
      } else if (f.kind === 'dash') {
        const x1 = pxX(f.x), y1 = pxY(f.y), x2 = pxX(f.tx), y2 = pxY(f.ty);
        c.globalAlpha = a * 0.55;
        c.strokeStyle = f.color;
        c.lineWidth = 3;
        c.shadowColor = f.color; c.shadowBlur = 6;
        c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
        c.shadowBlur = 0;
      } else { // bolt — travelling orb
        const tt = Math.min(1, t * 1.7);
        const bx = pxX(f.x) + (pxX(f.tx) - pxX(f.x)) * tt;
        const by = pxY(f.y) + (pxY(f.ty) - pxY(f.y)) * tt;
        const rad = Math.max(1, f.size);
        const R = rad * 2.6;
        const spr = getFxGlow(f.color, 'bolt');
        c.globalAlpha = a;
        c.drawImage(spr, bx - R, by - R, R * 2, R * 2);
      }
      fxs[w++] = f;
    }
    fxs.length = w;
  }

  c.globalAlpha = 1;
  c.restore();
}
