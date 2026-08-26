// Batch3A: pure focus-navigation utilities for gamepad menu navigation.
// spatialNext/stepRange operate on plain numbers / elements without reading
// layout internally (callers pass rects read from the live DOM) so unit tests
// never depend on happy-dom layout. Zero project imports — leaf module.
export interface FocusRect { x: number; y: number; w: number; h: number; }
export interface FocusCand { el: HTMLElement; r: FocusRect; }

export const FOCUSABLE_SEL =
  'button,[href],input:not([type=hidden]),select,textarea,[tabindex]:not([tabindex="-1"])';

export function focusablesIn(container: HTMLElement): HTMLElement[] {
  const els = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SEL));
  return els.filter(el => !(el as HTMLButtonElement).disabled && el.offsetParent !== null);
}

// Spatial nearest-in-direction: filter to the direction half-plane (candidate
// center must be ≥1px beyond the current rect on each pressed axis), then pick
// the minimum score = primary-axis distance + 2 × orthogonal offset; ties fall
// back to nearest center distance.
export function spatialNext(
  cur: FocusRect, cands: FocusCand[], dx: -1 | 0 | 1, dy: -1 | 0 | 1,
): HTMLElement | null {
  if (!dx && !dy) return null;
  const ccx = cur.x + cur.w / 2, ccy = cur.y + cur.h / 2;
  let best: HTMLElement | null = null, bestScore = Infinity, bestDist = Infinity;
  for (const c of cands) {
    const offX = c.r.x + c.r.w / 2 - ccx;
    const offY = c.r.y + c.r.h / 2 - ccy;
    if (dx !== 0 && (Math.sign(offX) !== dx || offX * dx < 1)) continue;
    if (dy !== 0 && (Math.sign(offY) !== dy || offY * dy < 1)) continue;
    const diag = dx !== 0 && dy !== 0;
    const pri = diag ? Math.max(Math.abs(offX), Math.abs(offY))
      : dx !== 0 ? Math.abs(offX) : Math.abs(offY);
    const orth = diag ? Math.min(Math.abs(offX), Math.abs(offY))
      : dx !== 0 ? Math.abs(offY) : Math.abs(offX);
    const score = pri + 2 * orth;
    const dist = Math.hypot(offX, offY);
    if (score < bestScore || (score === bestScore && dist < bestDist)) {
      best = c.el; bestScore = score; bestDist = dist;
    }
  }
  return best;
}

// Adjust a range input by one step (manual value math — deterministic across
// browsers/test DOMs) and notify listeners with bubbling input+change events.
export function stepRange(el: HTMLInputElement, dir: -1 | 1): boolean {
  if (el.type !== 'range') return false;
  const min = parseFloat(el.min || '0') || 0;
  const max = parseFloat(el.max || '100');
  const step = parseFloat(el.step || '1') || 1;
  const v = parseFloat(el.value) || min;
  el.value = String(Math.min(max, Math.max(min, v + dir * step)));
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

// Gamepad focus: programmatic focus() does not reliably trigger :focus-visible,
// so we mirror the ring with an explicit .gp-focus class (see style/main.css).
let gpFocused: HTMLElement | null = null;
export function gpFocus(el: HTMLElement): void {
  if (gpFocused && gpFocused !== el) gpFocused.classList.remove('gp-focus');
  gpFocused = el;
  el.classList.add('gp-focus');
  el.focus();
  try { el.scrollIntoView({ block: 'nearest' }); } catch { /* happy-dom no-op */ }
}
export function clearGpFocus(): void {
  if (gpFocused) { gpFocused.classList.remove('gp-focus'); gpFocused = null; }
}

// Sequential focus (LB/RB) — DOM order with wraparound, Tab-equivalent escape
// hatch for dense panels where spatial movement feels jumpy.
export function seqFocus(container: HTMLElement, dir: -1 | 1): HTMLElement | null {
  const list = focusablesIn(container);
  if (!list.length) return null;
  const active = document.activeElement as HTMLElement | null;
  const idx = active && list.includes(active) ? list.indexOf(active) : -1;
  const next = idx < 0
    ? (dir > 0 ? list[0] : list[list.length - 1])
    : list[(idx + dir + list.length) % list.length];
  gpFocus(next);
  return next;
}
