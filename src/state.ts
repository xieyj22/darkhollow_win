// Global game state and shared references
import type { GameState } from './types.js';
import { MH, MW } from './config.js';
import { scheduleProfileSync } from './cloud-sync.js';

export let G: GameState | null = null;

export function setGameState(g: GameState | null): void {
  G = g;
}

// Canvas references
export let canvas: HTMLCanvasElement | null = null;
export let ctx: CanvasRenderingContext2D | null = null;
export let miniCtx: CanvasRenderingContext2D | null = null;

export function setCanvas(c: HTMLCanvasElement): void {
  canvas = c;
  ctx = c.getContext('2d');
}

export function setMiniCanvas(c: HTMLCanvasElement): void {
  miniCtx = c.getContext('2d');
}

// UI state flags
export let invOpen = false;
export let helpOpen = false;
export let skillOpen = false;
export let achOpen = false;
export let talentOpen = false;
export let eventOpen = false;
export let eventActions: Array<() => void> = [];
export let introOpen = false;

export function setInvOpen(v: boolean) { invOpen = v; }
export function setHelpOpen(v: boolean) { helpOpen = v; }
export function setSkillOpen(v: boolean) { skillOpen = v; }
export function setAchOpen(v: boolean) { achOpen = v; }
export function setTalentOpen(v: boolean) { talentOpen = v; }
export function setEventOpen(v: boolean) { eventOpen = v; }
export function setIntroOpen(v: boolean) { introOpen = v; }
export function setEventActions(a: Array<() => void>) { eventActions = a; }

// Language
export let lang: string = localStorage.getItem('dh_lang') || 'en';
// Batch2 ⑤: keep <html lang> in sync so screen readers / font shaping follow
// the in-game language switch (index.html ships lang="en").
document.documentElement.lang = lang;
export function setLang(l: string) { lang = l; localStorage.setItem('dh_lang', l); document.documentElement.lang = l; scheduleProfileSync(); }

// Audio
// NOTE: the muted/setMuted mirror used to live here (a duplicate of audio.ts's
// persisted `dh_muted` flag). Removed in settings-core Task 1 — audio.ts is now
// the single source of truth (isMuted()/setMutedState()); bridge.muted is fed
// from there at startup and on toggle. uiZoom/reducedMotion/etc. stay here.
export let audioCtx: AudioContext | null = null;
export function setAudioCtx(a: AudioContext | null) { audioCtx = a; }

// Minimap (persisted — remembers the player's preferred zoom across sessions)
export let minimapScale: number = clampInt(localStorage.getItem('dh_minimap_scale'), 3, 2, 5);
export function setMinimapScale(s: number) { minimapScale = s; localStorage.setItem('dh_minimap_scale', String(s)); scheduleProfileSync(); }

// Legend/Keys
export let legendVisible = false;
export let keysVisible = false;
export function setLegendVisible(v: boolean) { legendVisible = v; }
export function setKeysVisible(v: boolean) { keysVisible = v; }

// Zoom
export let uiZoom: number = parseFloat(localStorage.getItem('dh_zoom') || '1') || 1;
export function setUiZoom(z: number) { uiZoom = z; localStorage.setItem('dh_zoom', String(z)); scheduleProfileSync(); }

// Reduced motion (accessibility) — disables decorative loops, dims particles, kills screen shake.
// On first load (no stored pref) it follows the OS prefers-reduced-motion setting so a single
// CSS hook (body.reduced-motion) drives everything.
function readReducedMotion(): boolean {
  const stored = localStorage.getItem('dh_reduced_motion');
  if (stored !== null) return stored === '1';
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
export let reducedMotion: boolean = readReducedMotion();
export function setReducedMotion(v: boolean) { reducedMotion = v; localStorage.setItem('dh_reduced_motion', v ? '1' : '0'); scheduleProfileSync(); }

// Safe zone (accessibility) — px margin kept clear at screen edges for fixed HUD anchors
export let safeZone: number = clampInt(localStorage.getItem('dh_safe_zone'), 16, 0, 64);
export function setSafeZone(n: number) { safeZone = n; localStorage.setItem('dh_safe_zone', String(n)); scheduleProfileSync(); }

// Screen shake scale (accessibility) — 0 disables, 1 default. Reduced-motion still hard-kills shake.
export let shakeScale: number = clampFloat(localStorage.getItem('dh_shake_scale'), 1, 0, 1);
export function setShakeScale(v: number) { shakeScale = v; localStorage.setItem('dh_shake_scale', String(v)); scheduleProfileSync(); }

// Text size (accessibility) — continuous multiplier on the --fs-* font tokens, 0.85–1.5 (default 1).
export let textScale: number = clampFloat(localStorage.getItem('dh_text_scale'), 1, 0.85, 1.5);
export function setTextScale(v: number) { textScale = v; localStorage.setItem('dh_text_scale', String(v)); scheduleProfileSync(); }

// Color-blindness filter (accessibility)
export type CBMode = 'off' | 'proto' | 'deutan' | 'tritan';
export let colorblind: CBMode = (localStorage.getItem('dh_colorblind') as CBMode) || 'off';
export function setColorblind(v: CBMode) { colorblind = v; localStorage.setItem('dh_colorblind', v); scheduleProfileSync(); }

// Status-bar shape cues (accessibility) — icon redundancy for HP/MP/XP/Hunger. On by default.
export let barCues: boolean = localStorage.getItem('dh_bar_cues') !== '0';
export function setBarCues(v: boolean) { barCues = v; localStorage.setItem('dh_bar_cues', v ? '1' : '0'); scheduleProfileSync(); }

// First-pickup item intro popup (on by default). When off, pickups still record
// to discoveredItems (codex unaffected) but don't queue the intro card.
export let introEnabled: boolean = localStorage.getItem('dh_intro_enabled') !== '0';
export function setIntroEnabled(v: boolean) { introEnabled = v; localStorage.setItem('dh_intro_enabled', v ? '1' : '0'); scheduleProfileSync(); }

// High contrast (accessibility) — brighter text tokens, stronger borders, solid
// HUD backgrounds via body.hc. Off by default (unlike barCues/introEnabled,
// which are opt-out). Combinable with cb-* colorblind filters (different mechanisms).
export let hc: boolean = localStorage.getItem('dh_hc') === '1';
export function setHc(v: boolean) { hc = v; localStorage.setItem('dh_hc', v ? '1' : '0'); scheduleProfileSync(); }

// Pause menu open flag (not persisted — a transient UI state like invOpen/helpOpen)
export let menuOpen = false;
export function setMenuOpen(v: boolean) { menuOpen = v; }

function clampInt(raw: string | null, dflt: number, lo: number, hi: number): number {
  const n = parseInt(raw || '');
  if (isNaN(n)) return dflt;
  return Math.max(lo, Math.min(hi, n));
}

function clampFloat(raw: string | null, dflt: number, lo: number, hi: number): number {
  const n = parseFloat(raw || '');
  if (isNaN(n)) return dflt;
  return Math.max(lo, Math.min(hi, n));
}
