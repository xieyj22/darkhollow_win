// Message logging system — shared by all modules
import type { GameState } from './types.js';
import { G } from './state.js';

export function addMsg(text: string, type: string = ''): void {
  if (!G) return;
  G.msgs.push({ text, type });
  // Keep the in-memory log bounded (the DOM node list is already capped at 100);
  // otherwise it grows without limit over a long run.
  if (G.msgs.length > 200) G.msgs.splice(0, G.msgs.length - 200);
  const p = document.getElementById('log-panel');
  if (!p) return;
  // 批7: consecutive identical text aggregates into the last row (×N) — display
  // layer only; G.msgs (save data) keeps every entry verbatim.
  const last = p.lastElementChild as HTMLElement | null;
  if (last?.dataset?.mtext === text) {
    const n = (Number(last.dataset.mcount || '1') || 1) + 1;
    last.dataset.mcount = String(n);
    last.textContent = `${text} ×${n}`;
    p.scrollTop = p.scrollHeight;
    return;
  }
  const d = document.createElement('div');
  d.className = 'msg ' + type;
  d.dataset.mtext = text;
  d.textContent = text;
  p.appendChild(d);
  p.scrollTop = p.scrollHeight;
  while (p.children.length > 100) { const first = p.firstChild; if (first) p.removeChild(first); }
}
