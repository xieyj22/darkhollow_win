// Visual effects — floating damage text, screen shake
import { G, canvas, reducedMotion, shakeScale } from './state.js';
import { TS } from './config.js';

// Floating-text pool — caps simultaneous combat numbers so AoE/multi-hit bursts don't
// stack dozens of DOM nodes. Oldest is recycled when at capacity.
const MAX_FT = 8;
const activeFts: HTMLDivElement[] = [];
const ftTimers = new WeakMap<HTMLDivElement, ReturnType<typeof setTimeout>>();

export function flt(x: number, y: number, txt: string, col: string, type?: 'crit' | 'heal' | 'poison' | 'miss'): void {
  if (!G || !canvas) return;
  const sx = (x - G.vx) * TS + TS / 2;
  const sy = (y - G.vy) * TS;
  const r = canvas.getBoundingClientRect();
  let d: HTMLDivElement;
  if (activeFts.length >= MAX_FT) {
    d = activeFts.shift()!;
    const h = ftTimers.get(d); if (h) clearTimeout(h);
    d.remove();
  } else {
    d = document.createElement('div');
  }
  d.className = 'ft' + (type ? ' ' + type : '');
  d.textContent = txt;
  d.style.color = col;
  d.style.left = (r.left + sx) + 'px';
  d.style.top = (r.top + sy) + 'px';
  document.body.appendChild(d);
  activeFts.push(d);
  ftTimers.set(d, setTimeout(() => {
    d.remove();
    const i = activeFts.indexOf(d);
    if (i >= 0) activeFts.splice(i, 1);
  }, 1200));
}

// ===== Screen shake (JS-driven decay, strength + directional kick) =====
// Replaces the old CSS .shake class so amplitude scales with hit weight and the
// nudge biases toward the impact direction. The transform is applied each frame
// by particles.ts tick() via applyShakeFrame().
let shakeAmp = 0, shakeT = 0, shakeMax = 0, shakeDx = 0, shakeDy = 0;

export function shake(strength = 1, dirX = 0, dirY = 0): void {
  // Vestibular stimulus — skip entirely under reduced motion or when shake is disabled.
  if (reducedMotion || shakeScale <= 0 || !canvas) return;
  const amp = (3 + strength * 4.5) * shakeScale;   // str 1 ~7.5px, crit str 2 ~12px, scaled by user pref
  // Don't let a weak late-decay shake overwrite a fresh strong one mid-burst.
  if (amp >= shakeAmp || shakeT > shakeMax * 0.6) {
    shakeAmp = amp; shakeMax = 14; shakeT = 0;
    const m = Math.hypot(dirX, dirY) || 1;
    shakeDx = dirX / m; shakeDy = dirY / m;
  }
}

// Called once per frame by particles.ts — applies the shake transform to the canvas.
export function applyShakeFrame(): void {
  if (!canvas) return;
  if (shakeT >= shakeMax || shakeAmp <= 0) {
    if (shakeAmp !== 0) { canvas.style.transform = ''; canvas.style.transition = ''; shakeAmp = 0; }
    return;
  }
  const t = shakeT / shakeMax;
  const decay = (1 - t) * (1 - t);            // ease-out quadratic
  const amp = shakeAmp * decay;
  const jx = (Math.random() - 0.5) * 2 * amp;
  const jy = (Math.random() - 0.5) * 2 * amp;
  const bias = amp * 0.45;                     // nudge toward impact direction
  canvas.style.transition = 'none';
  canvas.style.transform = `translate(${(jx + shakeDx * bias).toFixed(2)}px,${(jy + shakeDy * bias).toFixed(2)}px)`;
  shakeT++;
}

// Force-clear any active shake (e.g. when leaving the game mid-shake so the
// canvas isn't left with a stuck translate transform).
export function resetShake(): void {
  shakeAmp = 0; shakeT = 0; shakeMax = 0;
  if (canvas) { canvas.style.transform = ''; canvas.style.transition = ''; }
}

// Smoke bomb visual: a burst of grey particles that expand and fade around a tile.
export function burstSmoke(x: number, y: number): void {
  if (!G || !canvas) return;
  const r = canvas.getBoundingClientRect();
  const cx = r.left + (x - G.vx) * TS + TS / 2;
  const cy = r.top + (y - G.vy) * TS + TS / 2;
  for (let i = 0; i < 20; i++) {
    const d = document.createElement('div');
    d.className = 'smoke-p';
    const ang = Math.random() * Math.PI * 2;
    const dist = Math.random() * 46;
    d.style.left = (cx + Math.cos(ang) * dist) + 'px';
    d.style.top = (cy + Math.sin(ang) * dist) + 'px';
    const sz = 14 + Math.random() * 22;
    d.style.width = sz + 'px'; d.style.height = sz + 'px';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1400);
  }
}
