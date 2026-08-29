// Keybinds core — the single source of truth for keyboard/gamepad → Action mapping.
//
// This module owns the REBINDABLE action layer. Each input key (or gamepad
// button) maps to exactly ONE Action; input.ts (Task 4) reads that Action and
// dispatches the gameplay side-effect. Meta keys that must stay hardcoded
// (Ctrl+S save, F11 fullscreen) are deliberately excluded — keyToAction
// returns null for them so input.ts can intercept.
//
// One key = one Action (the "strict equivalence" ruling). Keys with secondary
// context behaviors (keyboard `b` also closes overlays; gamepad B also picks
// up when no overlay is open) map to their PRIMARY action here; input.ts
// preserves the secondary behavior via context checks. Do not encode dual
// semantics in this module.
//
// Persistence: the full current key/button map is stored under `dh_keybinds`
// as `{ keys, buttons }`. On first load (no stored data) defaults are used.
// `resetKeybinds()` restores defaults and re-persists.

import { scheduleProfileSync } from './cloud-sync.js';

// ===== Action enum =====
//
// Every rebindable gameplay action. `pause` is gamepad-only (keyboard has no
// dedicated pause key — Escape is `overlay_close`, which input.ts maps to
// open-pause when no overlay is open). `quick1`..`quick9` cover the quickslot
// bar; their digit keys are first-class entries in DEFAULT_KEYS so they are
// uniformly rebindable and reverse-lookupable.

export type Action =
  | 'move_up' | 'move_down' | 'move_left' | 'move_right'
  | 'pickup' | 'descend' | 'wait'
  | 'inventory' | 'quaff' | 'read' | 'help'
  | 'skill' | 'achieve' | 'talent' | 'lang' | 'mute'
  | 'overlay_close'
  | 'quick1' | 'quick2' | 'quick3' | 'quick4' | 'quick5'
  | 'quick6' | 'quick7' | 'quick8' | 'quick9'
  | 'pause';

// Map shapes: normalized key string / button index → Action.
type KeyMap = Record<string, Action>;
type ButtonMap = Record<number, Action>;

// ===== Default maps (extracted from input.ts current behavior) =====
//
// Behavior-equivalent with the pre-refactor input.ts switch (L122-145) and
// pollGamepad (L188-210). Any change here is a behavior regression — T4's
// input.ts rewrite reads exclusively from these maps.

export const DEFAULT_KEYS: KeyMap = {
  // movement (WASD + arrows)
  w: 'move_up', arrowup: 'move_up',
  s: 'move_down', arrowdown: 'move_down',
  a: 'move_left', arrowleft: 'move_left',
  d: 'move_right', arrowright: 'move_right',
  // gameplay
  g: 'pickup',
  '.': 'descend', '>': 'descend',
  ' ': 'wait', f: 'wait',
  i: 'inventory', b: 'inventory',
  q: 'quaff',
  r: 'read',
  '?': 'help',
  k: 'skill',
  t: 'achieve',
  n: 'talent',
  l: 'lang',
  m: 'mute',
  escape: 'overlay_close',
  // quickslots 1-9
  '1': 'quick1', '2': 'quick2', '3': 'quick3', '4': 'quick4', '5': 'quick5',
  '6': 'quick6', '7': 'quick7', '8': 'quick8', '9': 'quick9',
};

export const DEFAULT_BUTTONS: ButtonMap = {
  // D-pad
  12: 'move_up', 13: 'move_down', 14: 'move_left', 15: 'move_right',
  // action buttons
  0: 'wait',           // A
  1: 'overlay_close',  // B
  2: 'skill',          // X
  3: 'inventory',      // Y
  4: 'quaff',          // LB
  5: 'descend',        // RB
  9: 'pause',          // Start
};

// ===== Runtime (mutable) maps =====
//
// Initialized to copies of the defaults at module load. loadKeybinds() (called
// by main.ts/input.ts at startup) overwrites these from localStorage if a saved
// mapping exists. All lookups read these, not the frozen defaults — so a rebind
// takes effect immediately for subsequent keyToAction/buttonToAction calls.

let currentKeys: KeyMap = { ...DEFAULT_KEYS };
let currentButtons: ButtonMap = { ...DEFAULT_BUTTONS };

// ===== Lookup =====

/**
 * Resolve a KeyboardEvent to its bound Action, or null.
 *
 * Returns null for:
 *   - meta keys (Ctrl held, or F11) — input.ts handles these specially
 *     (Ctrl+S save, F11 fullscreen) and they are NOT rebindable here;
 *   - any key not currently bound.
 *
 * The key is normalized via `e.key.toLowerCase()` before lookup, so both 'b'
 * and 'B' resolve to the same Action.
 */
export function keyToAction(e: KeyboardEvent): Action | null {
  // Meta keys stay hardcoded in input.ts (non-rebindable).
  if (e.ctrlKey || e.key === 'F11') return null;
  const k = e.key.toLowerCase();
  return currentKeys[k] ?? null;
}

/**
 * Resolve a gamepad button index to its bound Action, or null if unmapped.
 */
export function buttonToAction(i: number): Action | null {
  return currentButtons[i] ?? null;
}

/**
 * Reverse-lookup: which key is currently bound to `action`? Returns the
 * normalized key string (e.g. 'g') or null if the action is unbound.
 */
export function bindingFor(action: Action): string | null {
  for (const k in currentKeys) {
    if (currentKeys[k] === action) return k;
  }
  return null;
}

/**
 * Reverse-lookup: ALL keys currently bound to `action`. Multi-key actions
 * (e.g. move_up has both 'w' and 'arrowup') return every key. Empty array if
 * the action has no key binding. Used by the Keybinds tab so multi-key actions
 * display fully instead of showing only the first match.
 */
export function bindingsFor(action: Action): string[] {
  const out: string[] = [];
  for (const k in currentKeys) {
    if (currentKeys[k] === action) out.push(k);
  }
  return out;
}

// Friendly labels for standard gamepad button indices (Xbox layout).
const GAMEPAD_BTN_LABELS: Record<number, string> = {
  0: 'A', 1: 'B', 2: 'X', 3: 'Y',
  4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT',
  8: 'Back', 9: 'Start', 10: 'LS', 11: 'RS',
  12: 'D-pad↑', 13: 'D-pad↓', 14: 'D-pad←', 15: 'D-pad→',
};

/**
 * Friendly label for a single gamepad button index (e.g. 0 → 'A', 12 → 'D-pad↑').
 * Shared by the Keybinds tab display and the capture-conflict alert so they
 * always agree on button naming. Falls back to `B<index>` for unknown indices.
 */
export function gamepadBtnLabel(i: number): string {
  return GAMEPAD_BTN_LABELS[i] ?? `B${i}`;
}

/**
 * Reverse-lookup: ALL gamepad buttons currently bound to `action`, returned as
 * friendly labels (e.g. ['A', 'LB']). Empty array if no button is bound. Used
 * by the Keybinds tab so the user can see gamepad bindings alongside keyboard
 * bindings in the same row. Raw indices are recoverable but not needed for
 * display — capture/conflict logic operates on indices via rebindButton().
 */
export function buttonBindingsFor(action: Action): string[] {
  const out: string[] = [];
  for (const b in currentButtons) {
    if (currentButtons[b] === action) {
      out.push(gamepadBtnLabel(Number(b)));
    }
  }
  return out;
}

// ===== Rebind =====

export interface RebindResult {
  /** Present only when the rebind was rejected because newKey was occupied. */
  conflict?: Action;
}

/**
 * Rebind `action` to `newKey` (keyboard). Behavior:
 *
 *   - If `newKey` already maps to a DIFFERENT action → return `{ conflict }`
 *     and change nothing (caller can prompt the user to confirm a swap).
 *   - Otherwise: clear the action's previous binding(s), set newKey→action,
 *     persist, and return `{}`.
 *
 * The optional `oldKey` param controls WHICH previous binding is freed:
 *   - When OMITTED (legacy behavior): ALL keys currently bound to `action` are
 *     freed. This is what T3's original test exercises, so the signature stays
 *     backward-compatible.
 *   - When PROVIDED: ONLY `oldKey` is freed (if it currently belongs to
 *     `action`). Sibling keys survive. This resolves the multi-key regression
 *     where rebinding `move_up` (default 'w' + 'arrowup') to 'p' would
 *     otherwise free BOTH keys and break arrow-key movement.
 *
 * Rebinding an action to the key it already owns is a no-op success (no
 * conflict). `newKey` and `oldKey` are normalized via toLowerCase().
 */
export function rebind(action: Action, newKey: string, oldKey?: string): RebindResult {
  const k = newKey.toLowerCase();
  const occupant = currentKeys[k];
  if (occupant && occupant !== action) {
    return { conflict: occupant };
  }
  if (oldKey !== undefined) {
    // Free ONLY the specified old key (preserves multi-key siblings).
    const ok = oldKey.toLowerCase();
    if (currentKeys[ok] === action) delete currentKeys[ok];
  } else {
    // Legacy: free ALL keys currently bound to this action.
    for (const existing in currentKeys) {
      if (currentKeys[existing] === action) delete currentKeys[existing];
    }
  }
  currentKeys[k] = action;
  saveKeybinds();
  return {};
}

/**
 * Rebind `action` to gamepad button `btnIdx`. Mirrors keyboard rebind()'s
 * conflict-detection logic for the BUTTON map. Buttons are 1:1 (each action has
 * at most one default button), so no `oldKey` param — the action's previous
 * button is freed automatically.
 */
export function rebindButton(action: Action, btnIdx: number): RebindResult {
  const occupant = currentButtons[btnIdx];
  if (occupant && occupant !== action) {
    return { conflict: occupant };
  }
  for (const existing in currentButtons) {
    if (currentButtons[existing] === action) delete currentButtons[existing];
  }
  currentButtons[btnIdx] = action;
  saveKeybinds();
  return {};
}

// ===== Persistence =====

const STORAGE_KEY = 'dh_keybinds';

interface StoredKeybinds {
  keys: KeyMap;
  buttons: ButtonMap;
}

/**
 * Write the current key/button maps to localStorage under `dh_keybinds`.
 * Called automatically by rebind() and resetKeybinds(); external callers
 * normally don't need to invoke it.
 */
export function saveKeybinds(): void {
  const data: StoredKeybinds = { keys: currentKeys, buttons: currentButtons };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  scheduleProfileSync();
}

/**
 * Load key/button maps from localStorage. On absent / corrupt data, falls back
 * to the defaults (and does NOT persist — a first-time player gets in-memory
 * defaults; the first rebind or reset writes them). Safe to call multiple times.
 *
 * The stored map is used VERBATIM (not merged over defaults): saveKeybinds()
 * writes the full current map, and a freed key (rebind moved its action
 * elsewhere) must stay freed across reloads. Merging over defaults would
 * silently restore the old binding. Forward-compat for newly added default
 * actions is handled by resetKeybinds() or a future versioned migration.
 */
export function loadKeybinds(): void {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    currentKeys = { ...DEFAULT_KEYS };
    currentButtons = { ...DEFAULT_BUTTONS };
    return;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StoredKeybinds>;
    // Verbatim: a well-formed save (from saveKeybinds) already contains every
    // binding. Falling back to defaults only when the sub-map is missing.
    currentKeys = parsed.keys ?? { ...DEFAULT_KEYS };
    currentButtons = parsed.buttons ?? { ...DEFAULT_BUTTONS };
  } catch {
    currentKeys = { ...DEFAULT_KEYS };
    currentButtons = { ...DEFAULT_BUTTONS };
  }
}

/**
 * Restore DEFAULT_KEYS / DEFAULT_BUTTONS and persist. Used by the Keybinds
 * tab's "reset to defaults" control.
 */
export function resetKeybinds(): void {
  currentKeys = { ...DEFAULT_KEYS };
  currentButtons = { ...DEFAULT_BUTTONS };
  saveKeybinds();
}

// ===== Capture mode (Keybinds settings tab) =====
//
// When the user clicks "Rebind" in the Keybinds tab, the target Action is
// stored here. input.ts polls this at the TOP of its keydown / pollGamepad
// handlers — if set, the next key / button press rebinds the action (or
// Escape cancels). This lives in keybinds.ts (not input.ts) so options.ts can
// set it without importing input.ts (which would create an import cycle:
// input → state → … → options). Getter/setter wrapping avoids `export let`
// reassignment ambiguity under TS strict.

let capturingAction: Action | null = null;

export function getCapturing(): Action | null {
  return capturingAction;
}

export function setCapturing(action: Action | null): void {
  capturingAction = action;
}
