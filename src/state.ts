// Global game state and shared references
import type { GameState } from './types.js';
import { MH, MW } from './config.js';

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

export function setInvOpen(v: boolean) { invOpen = v; }
export function setHelpOpen(v: boolean) { helpOpen = v; }
export function setSkillOpen(v: boolean) { skillOpen = v; }
export function setAchOpen(v: boolean) { achOpen = v; }
export function setTalentOpen(v: boolean) { talentOpen = v; }
export function setEventOpen(v: boolean) { eventOpen = v; }
export function setEventActions(a: Array<() => void>) { eventActions = a; }

// Language
export let lang: string = localStorage.getItem('dh_lang') || 'en';
export function setLang(l: string) { lang = l; localStorage.setItem('dh_lang', l); }

// Audio
export let audioCtx: AudioContext | null = null;
export let muted = false;
export function setAudioCtx(a: AudioContext | null) { audioCtx = a; }
export function setMuted(m: boolean) { muted = m; }

// Minimap
export let minimapScale = 3;
export function setMinimapScale(s: number) { minimapScale = s; }

// Legend/Keys
export let legendVisible = false;
export let keysVisible = false;
export function setLegendVisible(v: boolean) { legendVisible = v; }
export function setKeysVisible(v: boolean) { keysVisible = v; }

// Zoom
export let uiZoom: number = parseFloat(localStorage.getItem('dh_zoom') || '1') || 1;
export function setUiZoom(z: number) { uiZoom = z; localStorage.setItem('dh_zoom', String(z)); }
