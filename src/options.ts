// Options / Settings system — a unified, tabbed settings panel reachable from the title
// screen, the in-game sidebar, and the pause menu. Consolidates settings that were previously
// scattered across the sidebar footer (zoom / safe-zone / motion / audio) and adds accessibility
// options (fullscreen, screen-shake scale, color-blindness filter, text-size tiers).
//
// Architecture (Task 2): the four tab renderers are now schema-driven via
// `renderSchemaTab(body, tab)` which filters SETTING_DEFS by tab and emits a row per
// def. Three display-tab rows that don't fit the schema's set(v) contract — fullscreen
// (async/DOM-read), legend, keys (ui-panels togglers) — remain hand-rendered.

import { t } from './i18n.js';
import { legendVisible, keysVisible, minimapScale } from './state.js';
import { SETTING_DEFS, resetDefaults, applyAll } from './settings.js';
import type { SettingDef, SettingTab } from './settings.js';
import { MW, MH } from './config.js';
import { renderMinimap } from './render.js';
import { showOverlay, hideOverlay, toggleLegend, toggleKeys } from './ui-panels.js';
import { bridge } from './bridge.js';

type OptOrigin = 'title' | 'game' | 'pause';
const TABS: readonly SettingTab[] = ['audio', 'display', 'access', 'game'];

let optActiveTab: SettingTab = 'audio';
let optionsOrigin: OptOrigin = 'game';

// ===== Local apply helpers (not in settings.ts schema) =====
// applyMinimap resizes the minimap canvas — it needs config + render imports
// that don't belong in the schema module. Wired as a post-change hook.

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

  const tabLabels: Record<SettingTab, string> = {
    audio: t('optTabAudio'), display: t('optTabDisplay'), access: t('optTabAccess'), game: t('optTabGame'),
  };
  tabsEl.innerHTML = TABS.map(id =>
    `<button class="opt-tab${id === optActiveTab ? ' active' : ''}" data-tab="${id}" role="tab">${tabLabels[id]}</button>`,
  ).join('');
  tabsEl.querySelectorAll<HTMLElement>('.opt-tab').forEach(btn => {
    btn.onclick = () => { optActiveTab = (btn.dataset.tab as SettingTab) || 'audio'; renderOptions(); };
  });

  bodyEl.innerHTML = '';
  if (optActiveTab === 'audio') renderAudio(bodyEl);
  else if (optActiveTab === 'display') renderDisplay(bodyEl);
  else if (optActiveTab === 'access') renderAccess(bodyEl);
  else renderGame(bodyEl);

  // Focus the first control so keyboard/controller nav lands inside the tab.
  const first = bodyEl.querySelector<HTMLElement>('button, input, .toggle input');
  first?.focus();

  // Reset-defaults button — lives after opt-body, persists across tab switches.
  ensureResetButton(bodyEl);
}

/** Create or refresh the reset-defaults button below the options body. */
function ensureResetButton(bodyEl: HTMLElement): void {
  const panel = bodyEl.parentElement;
  if (!panel) return;
  let btn = panel.querySelector<HTMLButtonElement>('#opt-reset');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'opt-reset';
    panel.appendChild(btn);
  }
  btn.textContent = `↺ ${t('opt.resetDefaults')}`;
  btn.onclick = () => {
    if (confirm(t('opt.confirmReset'))) {
      resetDefaults();
      applyAll();
      // Run post-change hooks that schema apply?.() skips (e.g. minimap canvas
      // resize) so the canvas matches the reset value, not just the checkbox.
      for (const fn of Object.values(POST_CHANGE)) fn();
      renderOptions();
    }
  };
}

// ----- row + control builders -----

/**
 * Render an options row. When `desc` is non-empty, a small gray helper line is
 * rendered under the label. When `disabled` is true the row gets the `disabled`
 * class (CSS dims it and blocks pointer events on the control).
 */
function row(label: string, controlHtml: string, desc = '', disabled = false): string {
  const descHtml = desc ? `<small class="opt-desc">${desc}</small>` : '';
  return `<div class="opt-row${disabled ? ' disabled' : ''}"><span class="opt-label">${label}${descHtml}</span>${controlHtml}</div>`;
}

function toggleHtml(checked: boolean, extraKey = ''): string {
  const attr = extraKey ? ` data-extra="${extraKey}"` : '';
  return `<label class="toggle"><input type="checkbox"${attr}${checked ? ' checked' : ''}><span class="track"></span><span class="thumb"></span></label>`;
}
function segHtml(opts: { id: string; label: string; active: boolean }[]): string {
  return `<div class="seg">` + opts.map(o =>
    `<button data-seg="${o.id}" class="${o.active ? 'active' : ''}">${o.label}</button>`,
  ).join('') + `</div>`;
}

/** Build control HTML for a schema-driven SettingDef. */
function schemaControlHtml(d: SettingDef): string {
  if (d.control === 'toggle') {
    return `<label class="toggle"><input type="checkbox" data-optkey="${d.key}"${d.get() ? ' checked' : ''}><span class="track"></span><span class="thumb"></span></label>`;
  }
  if (d.control === 'seg') {
    const opts = d.options ?? [];
    const cur = String(d.get());
    return `<div class="seg" data-optkey="${d.key}">` + opts.map(o =>
      `<button data-seg="${o.id}" class="${o.id === cur ? 'active' : ''}">${t(o.labelKey)}</button>`,
    ).join('') + `</div>`;
  }
  // slider — uses schema min/max/step directly; value IS the setting value.
  const v = d.get() as number;
  const min = d.min ?? 0;
  const max = d.max ?? 100;
  const step = d.step ?? 1;
  const display = d.toDisplay ? d.toDisplay(v) : String(v);
  return `<input type="range" class="vol-slider" data-optkey="${d.key}" min="${min}" max="${max}" step="${step}" value="${v}"><span class="opt-val" data-optlabel="${d.key}">${display}</span>`;
}

/** True when the def's disabledWhen guard setting is currently truthy. */
function isDisabledBy(def: SettingDef): boolean {
  if (!def.disabledWhen) return false;
  const guard = SETTING_DEFS.find(d => d.key === def.disabledWhen);
  return guard ? !!guard.get() : false;
}

/** Seg change handler — parses seg id to number when the default is numeric. */
function segValue(d: SettingDef, id: string): unknown {
  return typeof d.default === 'number' ? Number(id) : id;
}

function bindToggle(input: HTMLInputElement, fn: (checked: boolean) => void): void {
  input.onchange = () => fn(input.checked);
}

// ===== Schema-driven tab renderer =====

/**
 * Post-change hooks for settings whose DOM side-effects can't live in
 * settings.ts (minimap canvas resize needs render.ts + config.ts imports).
 */
const POST_CHANGE: Record<string, () => void> = { minimap: applyMinimap };

/**
 * Schema-driven tab renderer: filters SETTING_DEFS by tab, emits a row per def
 * (label from labelKey, optional desc from descKey, control from d.control),
 * and wires each control to d.set → d.apply → optional post-hook → refresh.
 *
 * Sliders update their display label inline (no panel refresh — preserves drag
 * focus). Toggles and segs refresh the panel after change so cross-row effects
 * propagate (e.g. toggling reduced-motion disables the shake slider).
 */
function renderSchemaTab(body: HTMLElement, tab: SettingTab): void {
  const defs = SETTING_DEFS.filter(d => d.tab === tab);
  body.innerHTML = defs.map(d => {
    const desc = d.descKey ? t(d.descKey) : '';
    const disabled = isDisabledBy(d);
    return row(t(d.labelKey), schemaControlHtml(d), desc, disabled);
  }).join('');

  // Sliders — inline label update only, no panel refresh.
  body.querySelectorAll<HTMLInputElement>('input[type="range"][data-optkey]').forEach(sl => {
    const d = defs.find(dd => dd.key === sl.dataset.optkey);
    if (!d) return;
    sl.oninput = () => {
      const v = parseFloat(sl.value);
      d.set(v);
      d.apply?.();
      const lbl = body.querySelector<HTMLElement>(`[data-optlabel="${d.key}"]`);
      if (lbl && d.toDisplay) lbl.textContent = d.toDisplay(v);
    };
  });

  // Toggles — refresh panel after change.
  body.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-optkey]').forEach(cb => {
    const d = defs.find(dd => dd.key === cb.dataset.optkey);
    if (!d) return;
    cb.onchange = () => {
      d.set(cb.checked);
      d.apply?.();
      renderOptions();
    };
  });

  // Segmented controls — refresh panel after change (lang re-renders all labels).
  body.querySelectorAll<HTMLElement>('.seg[data-optkey]').forEach(seg => {
    const d = defs.find(dd => dd.key === seg.dataset.optkey);
    if (!d) return;
    seg.querySelectorAll<HTMLElement>('[data-seg]').forEach(b => {
      b.onclick = () => {
        d.set(segValue(d, b.dataset.seg || ''));
        d.apply?.();
        POST_CHANGE[d.key]?.();
        renderOptions();
      };
    });
  });
}

// ===== Tab renderers (thin schema callers) =====

function renderAudio(body: HTMLElement): void {
  renderSchemaTab(body, 'audio');
}

function renderDisplay(body: HTMLElement): void {
  renderSchemaTab(body, 'display');
  appendFullscreenRow(body);
}

function renderAccess(body: HTMLElement): void {
  renderSchemaTab(body, 'access');
}

function renderGame(body: HTMLElement): void {
  renderSchemaTab(body, 'game');
  appendGameplayExtras(body);
}

// ===== Hand-rendered rows outside the schema =====
//
// These rows don't fit the schema's set(v) contract:
//  - Fullscreen reads the DOM live (document.fullscreenElement) and is async
//    (requestFullscreen returns a promise; state syncs via fullscreenchange).
//    Lives on the Display tab (matches base options.ts:192).
//  - Legend/keys route through ui-panels togglers that guard against redundant
//    calls, so the setter is conditional (`if (v !== legendVisible) toggle…`).
//    Live on the Gameplay tab (matches base options.ts:275-276).

/** Display-tab extra: fullscreen toggle (async, reads DOM live). */
function appendFullscreenRow(body: HTMLElement): void {
  body.insertAdjacentHTML('beforeend',
    row(t('optFullscreen'), toggleHtml(!!document.fullscreenElement, 'fullscreen')),
  );
  const fs = body.querySelector<HTMLInputElement>('[data-extra="fullscreen"]');
  if (fs) bindToggle(fs, () => toggleFullscreen());

  // Transient listener scoped to display-tab visibility: re-registered on each
  // renderOptions() when the display tab is active, auto-removed after one fire
  // ({ once: true }). Intentionally NOT a global permanent listener — if the
  // user is on another tab, renderOptions() will rebuild the checkbox with the
  // correct state from document.fullscreenElement on the next display-tab render.
  document.addEventListener('fullscreenchange', syncFs, { once: true });
}

/** Gameplay-tab extras: legend + keys toggles (conditional ui-panels togglers). */
function appendGameplayExtras(body: HTMLElement): void {
  body.insertAdjacentHTML('beforeend',
    row(t('optLegend'), toggleHtml(legendVisible, 'legend')) +
    row(t('optKeys'), toggleHtml(keysVisible, 'keys')),
  );
  const lg = body.querySelector<HTMLInputElement>('[data-extra="legend"]');
  const ky = body.querySelector<HTMLInputElement>('[data-extra="keys"]');
  if (lg) bindToggle(lg, v => { if (v !== legendVisible) toggleLegend(); });
  if (ky) bindToggle(ky, v => { if (v !== keysVisible) toggleKeys(); });
}

function syncFs(): void {
  const cb = document.querySelector<HTMLInputElement>('[data-extra="fullscreen"]');
  if (cb) cb.checked = !!document.fullscreenElement;
}
