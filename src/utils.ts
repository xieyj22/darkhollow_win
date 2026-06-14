// Utility functions

export function rng(a: number, b: number): number {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

export function pick<T>(a: T[]): T {
  if (a.length === 0) { console.warn('pick() called on empty array'); return undefined as T; }
  return a[rng(0, a.length - 1)];
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function dst(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function darken(col: string, f: number): string {
  const h = col.replace('#', '');
  if (h.length !== 6) return col;
  return `rgb(${Math.floor(parseInt(h.substr(0, 2), 16) * f)},${Math.floor(parseInt(h.substr(2, 2), 16) * f)},${Math.floor(parseInt(h.substr(4, 2), 16) * f)})`;
}

// Darken a hex color and blend toward a tint color (for FOV fog-of-war)
export function darkenTinted(col: string, f: number, tint: string = '#05050f'): string {
  const parse = (s: string) => {
    const h = s.replace('#', '');
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
  };
  const [cr, cg, cb] = parse(col);
  const [tr, tg, tb] = parse(tint);
  // Darken then blend 30% toward tint
  const r = Math.floor(cr * f * 0.7 + tr * 0.3);
  const g = Math.floor(cg * f * 0.7 + tg * 0.3);
  const b = Math.floor(cb * f * 0.7 + tb * 0.3);
  return `rgb(${r},${g},${b})`;
}
