// Focused tests for the schema-driven options renderer + reset-defaults button.
// Verifies: row counts per tab (schema defs + display extras), reset button
// wiring (resetDefaults → applyAll → re-render), and desc rendering.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock leaf modules that options.ts transitively imports. vi.mock is global —
// the same mock instances are used by settings.js and options.js imports.
vi.mock('../audio.js', () => ({
  isMuted: vi.fn(() => false), setMutedState: vi.fn(),
  getMasterVol: vi.fn(() => 0.9), setMasterVol: vi.fn(),
  getMusicVol: vi.fn(() => 0.45), setMusicVol: vi.fn(),
  getSfxVol: vi.fn(() => 0.9), setSfxVol: vi.fn(),
}));
vi.mock('../state.js', () => ({
  G: {}, lang: 'en', setLang: vi.fn(),
  uiZoom: 1, setUiZoom: vi.fn(), minimapScale: 3, setMinimapScale: vi.fn(),
  reducedMotion: false, setReducedMotion: vi.fn(), safeZone: 16, setSafeZone: vi.fn(),
  shakeScale: 1, setShakeScale: vi.fn(), textScale: 1, setTextScale: vi.fn(),
  colorblind: 'off', setColorblind: vi.fn(), barCues: true, setBarCues: vi.fn(),
  introEnabled: true, setIntroEnabled: vi.fn(),
  legendVisible: false, keysVisible: false,
  hc: false, setHc: vi.fn(),
}));
vi.mock('../config.js', () => ({ MW: 48, MH: 32 }));
vi.mock('../render.js', () => ({
  renderMinimap: vi.fn(), render: vi.fn(), resizeCanvas: vi.fn(),
  updateUI: vi.fn(), markMinimapDirty: vi.fn(),
  drawPlayerLayer: vi.fn(), drawEnemyLayer: vi.fn(),
}));
vi.mock('../ui-panels.js', () => ({
  showOverlay: vi.fn(), hideOverlay: vi.fn(),
  toggleLegend: vi.fn(), toggleKeys: vi.fn(),
  toggleObjective: vi.fn(), initTooltip: vi.fn(),
  openPause: vi.fn(), closePause: vi.fn(),
  renderRecords: vi.fn(), renderCodex: vi.fn(),
}));

import { SETTING_DEFS } from '../settings.js';
import { renderOptions } from '../options.js';
// Import the mocked setters so we can assert they were called by resetDefaults.
import { setMutedState, setMasterVol } from '../audio.js';
import { setUiZoom, setReducedMotion, setBarCues, setIntroEnabled } from '../state.js';

/** Build the options-overlay DOM that renderOptions() expects. */
function setupPanel(): void {
  document.body.innerHTML =
    '<div id="options-overlay" class="overlay active">' +
    '<div id="options-panel" class="panel">' +
    '<div class="opt-tabs" id="opt-tabs" role="tablist"></div>' +
    '<div class="opt-body" id="opt-body"></div>' +
    '</div></div>';
}

/** Switch to a tab by clicking its tab button. */
function switchTab(tab: string): void {
  document.querySelector<HTMLElement>(`.opt-tab[data-tab="${tab}"]`)?.click();
}

beforeEach(() => {
  vi.clearAllMocks();
  setupPanel();
  renderOptions();
});

describe('schema-driven options render — row counts', () => {
  it('audio tab: one row per schema def', () => {
    switchTab('audio');
    const rows = document.querySelectorAll('#opt-body .opt-row');
    expect(rows.length).toBe(SETTING_DEFS.filter(d => d.tab === 'audio').length);
  });

  it('display tab: schema defs + fullscreen extra', () => {
    switchTab('display');
    const rows = document.querySelectorAll('#opt-body .opt-row');
    const schemaCount = SETTING_DEFS.filter(d => d.tab === 'display').length;
    expect(rows.length).toBe(schemaCount + 1); // fullscreen only
    const extras = document.querySelectorAll('#opt-body [data-extra]');
    expect(extras.length).toBe(1);
    expect(extras[0].getAttribute('data-extra')).toBe('fullscreen');
  });

  it('access tab: one row per schema def', () => {
    switchTab('access');
    const rows = document.querySelectorAll('#opt-body .opt-row');
    expect(rows.length).toBe(SETTING_DEFS.filter(d => d.tab === 'access').length);
  });

  it('game tab: schema defs + legend/keys extras', () => {
    switchTab('game');
    const rows = document.querySelectorAll('#opt-body .opt-row');
    const schemaCount = SETTING_DEFS.filter(d => d.tab === 'game').length;
    expect(rows.length).toBe(schemaCount + 2); // legend + keys
    const extras = document.querySelectorAll('#opt-body [data-extra]');
    const extraKeys = Array.from(extras).map(e => e.getAttribute('data-extra'));
    expect(extraKeys).toContain('legend');
    expect(extraKeys).toContain('keys');
  });
});

describe('row descriptions', () => {
  it('renders .opt-desc under rows whose def has a descKey', () => {
    switchTab('access');
    const descs = document.querySelectorAll('#opt-body .opt-desc');
    const expected = SETTING_DEFS.filter(d => d.tab === 'access' && d.descKey).length;
    expect(descs.length).toBe(expected);
    expect(expected).toBeGreaterThanOrEqual(3);
  });

  it('renders .opt-desc for introEnabled on game tab', () => {
    switchTab('game');
    const descs = document.querySelectorAll('#opt-body .opt-desc');
    expect(descs.length).toBeGreaterThanOrEqual(1);
  });
});

describe('reset-defaults button', () => {
  it('creates a single #opt-reset button in the panel', () => {
    const btn = document.querySelector<HTMLButtonElement>('#opt-reset');
    expect(btn).toBeTruthy();
    expect(btn?.parentElement?.id).toBe('options-panel');
    expect(btn?.textContent).toMatch(/↺/);
  });

  it('does not duplicate across tab switches', () => {
    switchTab('display');
    switchTab('access');
    switchTab('audio');
    expect(document.querySelectorAll('#opt-reset').length).toBe(1);
  });

  it('calls all schema setters via resetDefaults when confirmed', () => {
    const spy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    document.querySelector<HTMLButtonElement>('#opt-reset')!.click();
    // resetDefaults calls d.set(default) for every SETTING_DEFS entry.
    // Spot-check one setter per tab:
    expect(setMutedState).toHaveBeenCalledWith(false);     // audio
    expect(setUiZoom).toHaveBeenCalledWith(1);              // display
    expect(setReducedMotion).toHaveBeenCalledWith(false);   // access
    expect(setIntroEnabled).toHaveBeenCalledWith(true);     // game
    spy.mockRestore();
  });

  it('does nothing when confirm is cancelled', () => {
    const spy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.clearAllMocks();
    document.querySelector<HTMLButtonElement>('#opt-reset')!.click();
    expect(setMutedState).not.toHaveBeenCalled();
    expect(setMasterVol).not.toHaveBeenCalled();
    expect(setBarCues).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
