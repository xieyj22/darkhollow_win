// Settings core — schema-driven setting metadata + dispatch layer.
//
// This module is the single source of truth for the SETTING LIST (order, tabs,
// labels, defaults, control kind). The actual getter/setter per setting still
// live in state.ts (UI prefs) and audio.ts (audio prefs) — settings.ts only
// DISPATCHES. Per the 渐进兼容 constraint it owns no new mutable state: every
// get/set points at the existing state/audio exports so the ~12 modules that
// read state.ts keep working unchanged.
//
// Consumers:
//   - options.ts renders the panel from SETTING_DEFS (Task 2).
//   - main.ts calls applyAll() at startup to write persisted prefs into the DOM.
//   - A reset-defaults button (Task 4) calls resetDefaults().

import {
  lang, setLang,
  uiZoom, setUiZoom,
  minimapScale, setMinimapScale,
  reducedMotion, setReducedMotion,
  safeZone, setSafeZone,
  shakeScale, setShakeScale,
  textScale, setTextScale,
  colorblind, setColorblind,
  barCues, setBarCues,
  introEnabled, setIntroEnabled,
} from './state.js';
import {
  isMuted, setMutedState,
  getMasterVol, setMasterVol,
  getMusicVol, setMusicVol,
  getSfxVol, setSfxVol,
} from './audio.js';
import { bridge } from './bridge.js';

// ===== Types =====

export type SettingTab = 'audio' | 'display' | 'access' | 'game';
export type ControlKind = 'toggle' | 'seg' | 'slider';

/**
 * A single setting's metadata + dispatch. `get`/`set` route to the canonical
 * state.ts/audio.ts exports; `apply` (optional) writes the DOM side-effect
 * (CSS var / body class) that makes the setting visible. `default` is the
 * value resetDefaults() restores.
 *
 * `set` is typed `(v: unknown) => void` so the heterogeneous SETTING_DEFS
 * array stays simple; concrete setters (e.g. `(v: number) => void`) are
 * upcast via `asSetter`. At runtime `set` IS the underlying setter, so
 * tests spying on the mocked setter see the call directly.
 */
export interface SettingDef {
  key: string;
  tab: SettingTab;
  labelKey: string;
  /** Optional description i18n key rendered under the label. */
  descKey?: string;
  control: ControlKind;
  /** Current value — reads from the canonical source. */
  get: () => unknown;
  /** Write a new value — dispatches to the canonical setter. */
  set: (v: unknown) => void;
  /** Optional DOM side-effect to apply after set (e.g. write a CSS var). */
  apply?: () => void;
  /** Default value used by resetDefaults. */
  default: unknown;
  // ----- control-specific options -----
  min?: number;
  max?: number;
  step?: number;
  /** Segment options: id + label i18n key (if the key is unknown to i18n it is rendered as-is, so literal digits like '2' work). */
  options?: Array<{ id: string; labelKey: string }>;
  /** Human-readable formatter for the current value (e.g. "90%"). */
  toDisplay?: (v: unknown) => string;
  /** Key of another setting that, when truthy, disables this control. */
  disabledWhen?: string;
}

// Upcast helper so each def can assign its typed setter directly while the
// array stays SettingDef[] (set typed as (v: unknown) => void). Erased at
// compile time — at runtime `set` is the original function reference.
type AnySetter = (v: unknown) => void;
const asSetter = <T,>(fn: (v: T) => void): AnySetter => fn as AnySetter;

// ===== Apply helpers (DOM side-effects) =====
// Inlined here so settings.ts is self-contained — no circular import into
// options.ts (which will consume SETTING_DEFS in Task 2) or ui-settings.ts.
// These mirror the one-liners options.ts already uses; the older duplicates
// in ui-settings.ts (applyZoom/applySafe/applyReducedMotion with stale
// #zoom-label / #safe-label lookups) are removed in Task 1 Step 5.

function applyMute(): void {
  // Sync the bridge flag read by render.ts (sound icon) + the DOM button state.
  bridge.muted = isMuted();
  bridge.updateSoundBtn?.();
}
function applyUiZoom(): void {
  document.documentElement.style.setProperty('--ui-zoom', String(uiZoom));
}
function applyTextScale(): void {
  document.documentElement.style.setProperty('--fs-scale', String(textScale));
}
function applySafeZone(): void {
  document.documentElement.style.setProperty('--safe', safeZone + 'px');
}
function applyReducedMotion(): void {
  document.body.classList.toggle('reduced-motion', reducedMotion);
}
function applyColorblind(): void {
  document.body.classList.remove('cb-proto', 'cb-deutan', 'cb-tritan');
  if (colorblind !== 'off') document.body.classList.add('cb-' + colorblind);
}
function applyBarCues(): void {
  document.body.classList.toggle('bar-cues', barCues);
}

// ===== Schema (14 settings across 4 tabs) =====
//
// Tab layout follows the design spec: audio (mute + 3 volumes),
// display (zoom / text / minimap / safe-zone / language), access (motion /
// shake / color-blind / bar-cues), game (item-intro). Fullscreen and the
// non-persisted legend/keys toggles are intentionally omitted from v1: their
// setters aren't in the state/audio canonical layer (fullscreen reads the DOM
// live; legend/keys go through ui-panels togglers), so including them would
// either duplicate state or break the "set is the canonical setter" contract
// the test asserts. They can be added later as a separate toggle kind.

export const SETTING_DEFS: readonly SettingDef[] = [
  // ----- Audio tab -----
  {
    key: 'mute', tab: 'audio', labelKey: 'optMute', control: 'toggle',
    get: () => isMuted(), set: asSetter(setMutedState),
    apply: applyMute, default: false,
  },
  {
    key: 'master', tab: 'audio', labelKey: 'volMaster', control: 'slider',
    min: 0, max: 1, step: 0.01,
    get: () => getMasterVol(), set: asSetter(setMasterVol),
    toDisplay: v => `${Math.round((v as number) * 100)}`, default: 0.9,
  },
  {
    key: 'music', tab: 'audio', labelKey: 'volMusic', control: 'slider',
    min: 0, max: 1, step: 0.01,
    get: () => getMusicVol(), set: asSetter(setMusicVol),
    toDisplay: v => `${Math.round((v as number) * 100)}`, default: 0.45,
  },
  {
    key: 'sfx', tab: 'audio', labelKey: 'volSfx', control: 'slider',
    min: 0, max: 1, step: 0.01,
    get: () => getSfxVol(), set: asSetter(setSfxVol),
    toDisplay: v => `${Math.round((v as number) * 100)}`, default: 0.9,
  },

  // ----- Display tab -----
  {
    key: 'zoom', tab: 'display', labelKey: 'optZoom', control: 'slider',
    min: 0.7, max: 1.5, step: 0.05,
    get: () => uiZoom, set: asSetter(setUiZoom),
    apply: applyUiZoom,
    toDisplay: v => `${Math.round((v as number) * 100)}%`, default: 1,
  },
  {
    key: 'textScale', tab: 'display', labelKey: 'optTextSize', control: 'seg',
    options: [
      { id: '0.85', labelKey: 'tsSmall' },
      { id: '1', labelKey: 'tsMedium' },
      { id: '1.15', labelKey: 'tsLarge' },
    ],
    get: () => textScale, set: asSetter(setTextScale),
    apply: applyTextScale, default: 1,
  },
  {
    key: 'minimap', tab: 'display', labelKey: 'optMinimap', control: 'seg',
    // Literal digit labels — t('2') returns '2' for unknown keys, so these
    // render as-is without needing dedicated i18n entries.
    options: [
      { id: '2', labelKey: '2' }, { id: '3', labelKey: '3' },
      { id: '4', labelKey: '4' }, { id: '5', labelKey: '5' },
    ],
    // No apply: minimap canvas resize depends on game state and is driven by
    // options.ts/render.ts on change, not by applyAll() at startup.
    get: () => minimapScale, set: asSetter(setMinimapScale), default: 3,
  },
  {
    key: 'safeZone', tab: 'display', labelKey: 'optSafeZone', control: 'slider',
    descKey: 'opt.safeZoneDesc',
    min: 0, max: 64, step: 1,
    get: () => safeZone, set: asSetter(setSafeZone),
    apply: applySafeZone,
    toDisplay: v => `${v}`, default: 16,
  },
  {
    key: 'lang', tab: 'display', labelKey: 'optLanguage', control: 'seg',
    // Each language shown in its own script (EN / 中文) — literals, not keys.
    options: [
      { id: 'en', labelKey: 'EN' }, { id: 'zh', labelKey: '中文' },
    ],
    get: () => lang, set: asSetter(setLang),
    // Refresh every visible label — updateLangUI lives in ui-settings.ts and
    // is late-bound via bridge to avoid a settings↔ui-settings cycle.
    apply: () => bridge.updateLangUI?.(),
    default: 'en',
  },

  // ----- Accessibility tab -----
  {
    key: 'reducedMotion', tab: 'access', labelKey: 'optReducedMotion', control: 'toggle',
    descKey: 'opt.reducedMotionDesc',
    get: () => reducedMotion, set: asSetter(setReducedMotion),
    apply: applyReducedMotion, default: false,
  },
  {
    key: 'shake', tab: 'access', labelKey: 'optShake', control: 'slider',
    descKey: 'opt.shakeDesc',
    min: 0, max: 1, step: 0.05, disabledWhen: 'reducedMotion',
    get: () => shakeScale, set: asSetter(setShakeScale),
    toDisplay: v => `${Math.round((v as number) * 100)}%`, default: 1,
  },
  {
    key: 'colorblind', tab: 'access', labelKey: 'optColorblind', control: 'seg',
    descKey: 'opt.colorblindDesc',
    options: [
      { id: 'off', labelKey: 'cbOff' }, { id: 'proto', labelKey: 'cbProto' },
      { id: 'deutan', labelKey: 'cbDeutan' }, { id: 'tritan', labelKey: 'cbTritan' },
    ],
    get: () => colorblind, set: asSetter(setColorblind),
    apply: applyColorblind, default: 'off',
  },
  {
    key: 'barCues', tab: 'access', labelKey: 'optBarCues', control: 'toggle',
    descKey: 'opt.barCuesDesc',
    get: () => barCues, set: asSetter(setBarCues),
    apply: applyBarCues, default: true,
  },

  // ----- Gameplay tab -----
  {
    key: 'introEnabled', tab: 'game', labelKey: 'opt.introEnabled', control: 'toggle',
    descKey: 'opt.introEnabledDesc',
    get: () => introEnabled, set: asSetter(setIntroEnabled), default: true,
  },
];

// ===== Dispatch helpers =====

/**
 * Reset every setting to its documented default. Iterates SETTING_DEFS in
 * declaration order: set(default) first, then apply?.() so the DOM catches
 * up. Volume setters in audio.ts already re-apply the gain graph internally,
 * so those defs have no separate apply.
 */
export function resetDefaults(): void {
  for (const d of SETTING_DEFS) {
    d.set(d.default);
    d.apply?.();
  }
}

/**
 * Apply every setting's DOM side-effect without changing the underlying value.
 * Used at startup (main.ts window.load) to write persisted prefs into the DOM
 * in one pass, replacing the old sequence of applyZoom/applySafe/apply… calls.
 */
export function applyAll(): void {
  for (const d of SETTING_DEFS) d.apply?.();
}
