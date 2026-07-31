// Options / Settings system — a unified, tabbed settings panel reachable from the title
// screen, the in-game sidebar, and the pause menu. Consolidates settings that were previously
// scattered across the sidebar footer (zoom / safe-zone / motion / audio) and adds accessibility
// options (fullscreen, screen-shake scale, color-blindness filter, text-size tiers).
//
// Reuses existing persisted setters in state.ts / audio.ts wherever possible; the only new
// application logic here is text-scale (CSS --fs-scale) and color-blindness (body class).

import { t } from './i18n.js';
import {
  lang, setLang,
  uiZoom, setUiZoom,
  safeZone, setSafeZone,
  reducedMotion, setReducedMotion,
  minimapScale, setMinimapScale,
  legendVisible, keysVisible,
  shakeScale, setShakeScale,
  textScale, setTextScale,
  colorblind, setColorblind,
  barCues, setBarCues,
} from './state.js';
import {
  isMuted, setMutedState,
  getMasterVol, setMasterVol,
  getMusicVol, setMusicVol,
  getSfxVol, setSfxVol,
} from './audio.js';
import { MW, MH } from './config.js';
import { renderMinimap } from './render.js';
import { showOverlay, hideOverlay, toggleLegend, toggleKeys } from './main.js';
import { bridge } from './bridge.js';

type OptOrigin = 'title' | 'game' | 'pause';
const TABS = ['audio', 'display', 'access', 'game'] as const;
type TabId = (typeof TABS)[number];

let optActiveTab: TabId = 'audio';
let optionsOrigin: OptOrigin = 'game';

// ===== Application helpers (write the setting to the DOM) =====

export function applyTextScale(): void {
  document.documentElement.style.setProperty('--fs-scale', String(textScale));
}

export function applyColorblind(): void {
  document.body.classList.remove('cb-proto', 'cb-deutan', 'cb-tritan');
  if (colorblind !== 'off') document.body.classList.add('cb-' + colorblind);
}

export function applyBarCues(): void {
  document.body.classList.toggle('bar-cues', barCues);
}

function applyUiZoom(): void {
  document.documentElement.style.setProperty('--ui-zoom', String(uiZoom));
}

function applySafe(): void {
  document.documentElement.style.setProperty('--safe', safeZone + 'px');
}

function applyReducedMotion(): void {
  document.body.classList.toggle('reduced-motion', reducedMotion);
}

function applyMinimap(): void {
  const c = document.getElementById('minimap-canvas') as HTMLCanvasElement | null;
  if (!c) return;
  c.width = MW * minimapScale;
  c.height = MH * minimapScale;
  renderMinimap();
}

export function toggleFullscreen(): void {
  const dh = (window as any).dh;
  if (dh && typeof dh.toggleFullscreen === 'function') { dh.toggleFullscreen(); return; }
  // Browser fallback
  const doc = document as any;
  if (!document.fullscreenElement) {
    const el = document.documentElement as any;
    el?.requestFullscreen?.call(el)?.catch?.(() => { /* ignore */ });
  } else {
    doc.exitFullscreen?.call(doc)?.catch?.(() => { /* ignore */ });
  }
}

// ===== Open / close =====

export function openOptions(from: OptOrigin = 'game'): void {
  optionsOrigin = from;
  showOverlay('options-overlay');
  renderOptions();
}

export function closeOptions(): void {
  hideOverlay('options-overlay');
  // Opened from the pause menu → return to it so ESC/B flows back to Resume/Quit.
  if (optionsOrigin === 'pause') bridge.openPause?.();
}

export function applyOptionsUI(): void {
  // Refresh the panel from persisted prefs when it's already on screen.
  if (document.getElementById('options-overlay')?.classList.contains('active')) renderOptions();
}

// ===== Render =====

export function renderOptions(): void {
  const tabsEl = document.getElementById('opt-tabs');
  const bodyEl = document.getElementById('opt-body');
  if (!tabsEl || !bodyEl) return;

  const tabLabels: Record<TabId, string> = {
    audio: t('optTabAudio'), display: t('optTabDisplay'), access: t('optTabAccess'), game: t('optTabGame'),
  };
  tabsEl.innerHTML = TABS.map(id =>
    `<button class="opt-tab${id === optActiveTab ? ' active' : ''}" data-tab="${id}" role="tab">${tabLabels[id]}</button>`,
  ).join('');
  tabsEl.querySelectorAll<HTMLElement>('.opt-tab').forEach(btn => {
    btn.onclick = () => { optActiveTab = (btn.dataset.tab as TabId) || 'audio'; renderOptions(); };
  });

  bodyEl.innerHTML = '';
  if (optActiveTab === 'audio') renderAudio(bodyEl);
  else if (optActiveTab === 'display') renderDisplay(bodyEl);
  else if (optActiveTab === 'access') renderAccess(bodyEl);
  else renderGame(bodyEl);

  // Focus the first control so keyboard/controller nav lands inside the tab.
  const first = bodyEl.querySelector<HTMLElement>('button, input, .toggle input');
  first?.focus();
}

// ----- control builders -----

function row(label: string, controlHtml: string, disabled = false): string {
  return `<div class="opt-row${disabled ? ' disabled' : ''}"><span class="opt-label">${label}</span>${controlHtml}</div>`;
}
function toggleHtml(checked: boolean): string {
  return `<label class="toggle"><input type="checkbox"${checked ? ' checked' : ''}><span class="track"></span><span class="thumb"></span></label>`;
}
function segHtml(opts: { id: string; label: string; active: boolean }[]): string {
  return `<div class="seg">` + opts.map(o =>
    `<button data-seg="${o.id}" class="${o.active ? 'active' : ''}">${o.label}</button>`,
  ).join('') + `</div>`;
}
function volSliderHtml(id: string, value01: number): string {
  return `<input type="range" class="vol-slider" data-vol="${id}" min="0" max="100" value="${Math.round(value01 * 100)}"><span class="opt-val" data-vollabel="${id}">${Math.round(value01 * 100)}</span>`;
}

function bindToggle(input: HTMLInputElement, fn: (checked: boolean) => void): void {
  input.onchange = () => fn(input.checked);
}
function bindSeg(container: HTMLElement, fn: (id: string) => void): void {
  container.querySelectorAll<HTMLElement>('[data-seg]').forEach(b => {
    b.onclick = () => fn(b.dataset.seg || '');
  });
}

// ----- Audio tab -----

function renderAudio(body: HTMLElement): void {
  body.innerHTML =
    row(t('optMute'), toggleHtml(isMuted())) +
    row(t('volMaster'), volSliderHtml('master', getMasterVol())) +
    row(t('volMusic'), volSliderHtml('music', getMusicVol())) +
    row(t('volSfx'), volSliderHtml('sfx', getSfxVol()));
  const muteInput = body.querySelector<HTMLInputElement>('.toggle input');
  if (muteInput) bindToggle(muteInput, v => { setMutedState(v); bridge.muted = v; bridge.updateSoundBtn?.(); });
  body.querySelectorAll<HTMLInputElement>('[data-vol]').forEach(sl => {
    sl.oninput = () => {
      const v = parseInt(sl.value) / 100;
      const which = sl.dataset.vol;
      if (which === 'master') setMasterVol(v);
      else if (which === 'music') setMusicVol(v);
      else if (which === 'sfx') setSfxVol(v);
      const lbl = body.querySelector<HTMLElement>(`[data-vollabel="${which}"]`);
      if (lbl) lbl.textContent = String(Math.round(v * 100));
    };
  });
}

// ----- Display tab -----

function zoomToSlider(z: number): number { return Math.round(((z - 0.7) / 0.8) * 100); }
function sliderToZoom(v: number): number { return +(0.7 + (v / 100) * 0.8).toFixed(2); }

function renderDisplay(body: HTMLElement): void {
  body.innerHTML =
    row(t('optFullscreen'), toggleHtml(!!document.fullscreenElement)) +
    row(t('optZoom'), `<input type="range" class="vol-slider" data-zoom min="0" max="100" value="${zoomToSlider(uiZoom)}"><span class="opt-val" data-zoomlabel>${Math.round(uiZoom * 100)}%</span>`) +
    row(t('optTextSize'), segHtml([
      { id: '0.85', label: t('tsSmall'), active: Math.abs(textScale - 0.85) < 0.01 },
      { id: '1', label: t('tsMedium'), active: Math.abs(textScale - 1) < 0.01 },
      { id: '1.15', label: t('tsLarge'), active: Math.abs(textScale - 1.15) < 0.01 },
    ])) +
    row(t('optMinimap'), segHtml([2, 3, 4, 5].map(n => ({ id: String(n), label: String(n), active: minimapScale === n })))) +
    row(t('optSafeZone'), `<input type="range" class="vol-slider" data-safe min="0" max="64" value="${safeZone}"><span class="opt-val" data-safelabel>${safeZone}</span>`) +
    row(t('optLanguage'), segHtml([
      { id: 'en', label: 'EN', active: lang === 'en' },
      { id: 'zh', label: '中文', active: lang === 'zh' },
    ]));

  const fsInput = body.querySelector<HTMLInputElement>('.toggle input');
  if (fsInput) bindToggle(fsInput, () => toggleFullscreen());
  // Keep the checkbox in sync with real fullscreen state (toggle is async).
  document.addEventListener('fullscreenchange', syncFs, { once: true });

  const zoom = body.querySelector<HTMLInputElement>('[data-zoom]');
  if (zoom) zoom.oninput = () => {
    setUiZoom(sliderToZoom(parseInt(zoom.value)));
    applyUiZoom();
    const lbl = body.querySelector<HTMLElement>('[data-zoomlabel]');
    if (lbl) lbl.textContent = Math.round(uiZoom * 100) + '%';
  };
  bindSeg(body, id => {
    if (id === '0.85' || id === '1' || id === '1.15') { setTextScale(parseFloat(id)); applyTextScale(); }
    else if (id === '2' || id === '3' || id === '4' || id === '5') { setMinimapScale(parseInt(id)); applyMinimap(); }
    else if (id === 'en' || id === 'zh') { setLang(id); bridge.updateLangUI?.(); }
    renderOptions();
  });
  const safe = body.querySelector<HTMLInputElement>('[data-safe]');
  if (safe) safe.oninput = () => {
    setSafeZone(parseInt(safe.value));
    applySafe();
    const lbl = body.querySelector<HTMLElement>('[data-safelabel]');
    if (lbl) lbl.textContent = String(safeZone);
  };
}

function syncFs(): void {
  const cb = document.querySelector<HTMLElement>('#opt-body .opt-row .toggle input') as HTMLInputElement | null;
  if (cb) cb.checked = !!document.fullscreenElement;
}

// ----- Accessibility tab -----

function renderAccess(body: HTMLElement): void {
  body.innerHTML =
    row(t('optReducedMotion'), toggleHtml(reducedMotion)) +
    row(t('optShake'), `<input type="range" class="vol-slider" data-shake min="0" max="100" value="${Math.round(shakeScale * 100)}"><span class="opt-val" data-shakelabel>${Math.round(shakeScale * 100)}%</span>`, reducedMotion) +
    row(t('optColorblind'), segHtml([
      { id: 'off', label: t('cbOff'), active: colorblind === 'off' },
      { id: 'proto', label: t('cbProto'), active: colorblind === 'proto' },
      { id: 'deutan', label: t('cbDeutan'), active: colorblind === 'deutan' },
      { id: 'tritan', label: t('cbTritan'), active: colorblind === 'tritan' },
    ])) +
    row(t('optBarCues'), toggleHtml(barCues));

  const rmInput = body.querySelector<HTMLInputElement>('.opt-row .toggle input');
  if (rmInput) bindToggle(rmInput, v => { setReducedMotion(v); applyReducedMotion(); renderOptions(); });
  const shake = body.querySelector<HTMLInputElement>('[data-shake]');
  if (shake) shake.oninput = () => {
    setShakeScale(parseInt(shake.value) / 100);
    const lbl = body.querySelector<HTMLElement>('[data-shakelabel]');
    if (lbl) lbl.textContent = Math.round(shakeScale * 100) + '%';
  };
  bindSeg(body, id => {
    if (id === 'off' || id === 'proto' || id === 'deutan' || id === 'tritan') { setColorblind(id as any); applyColorblind(); }
    renderOptions();
  });
  // Bar-cues toggle is the second .toggle in this tab (after reduced motion).
  const toggles = body.querySelectorAll<HTMLInputElement>('.toggle input');
  const barInput = toggles[1];
  if (barInput) bindToggle(barInput, v => { setBarCues(v); applyBarCues(); });
}

// ----- Gameplay tab -----

function renderGame(body: HTMLElement): void {
  body.innerHTML =
    row(t('optLegend'), toggleHtml(legendVisible)) +
    row(t('optKeys'), toggleHtml(keysVisible));
  const toggles = body.querySelectorAll<HTMLInputElement>('.toggle input');
  if (toggles[0]) bindToggle(toggles[0], v => { if (v !== legendVisible) toggleLegend(); });
  if (toggles[1]) bindToggle(toggles[1], v => { if (v !== keysVisible) toggleKeys(); });
}
