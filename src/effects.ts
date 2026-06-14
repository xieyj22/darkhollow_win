// Visual effects — floating damage text, screen shake
import { G, canvas } from './state.js';
import { TS } from './config.js';

export function flt(x: number, y: number, txt: string, col: string, type?: 'crit' | 'heal' | 'poison' | 'miss'): void {
  if (!G || !canvas) return;
  const sx = (x - G.vx) * TS + TS / 2;
  const sy = (y - G.vy) * TS;
  const r = canvas.getBoundingClientRect();
  const d = document.createElement('div');
  d.className = 'ft' + (type ? ' ' + type : '');
  d.textContent = txt;
  d.style.color = col;
  d.style.left = (r.left + sx) + 'px';
  d.style.top = (r.top + sy) + 'px';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 1200);
}

export function shake(): void {
  if (!canvas) return;
  canvas.classList.add('shake');
  setTimeout(() => canvas!.classList.remove('shake'), 150);
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
