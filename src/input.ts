// Keyboard and touch input handling
import { G, invOpen, helpOpen, skillOpen, achOpen, talentOpen, eventOpen, eventActions, menuOpen, introOpen } from './state.js';
import { movePlayer, pickupItem, descendStairs, doWait } from './player.js';
import { quickQuaff, quickRead, useQuickSlot, useItem, equipItem, sellItem } from './items.js';
import { executeSkill } from './skills.js';
import { saveGame } from './save.js';
import { closeEvent } from './events.js';
import { hideOverlay } from './ui-panels.js';
import { bridge } from './bridge.js';
import { closeItemIntro } from './item-intro.js';
import { openInventory, closeInventory, openHelp, closeHelp, tryCastSkill, openSkillPanel, closeSkillPanel, openAchievements, closeAchievements, openTalentPanel, closeTalentPanel, sellMode } from './panels.js';
import { keyToAction, buttonToAction, getCapturing, setCapturing, rebind, rebindButton, bindingFor, gamepadBtnLabel, loadKeybinds, type Action } from './keybinds.js';
import { t, tMsg } from './i18n.js';
import { activeMenuContext, menuBack, closeActiveOverlay } from './menu-context.js';
import { focusablesIn, spatialNext, stepRange, gpFocus, seqFocus, type FocusRect } from './focus-nav.js';

export function initInput(): void {
  // Load persisted keybinds before registering any input listener, so the very
  // first keydown / gamepad poll consults the user's saved bindings (not just
  // the DEFAULT_KEYS copy from module load). Safe no-op if localStorage is empty.
  loadKeybinds();
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    // Keybind capture mode — intercept ALL keys before anything else. When the
    // user clicks "Rebind" in the Keybinds tab, getCapturing() returns the
    // action being rebound. The next key press completes the rebind; Escape (or
    // the overlay_close key) cancels without rebinding (standard capture UX).
    const cap = getCapturing();
    if (cap) {
      // Defense-in-depth: if capturing is set but the options overlay is NOT
      // open, treat it as a stale flag (closeOptions or another path missed it).
      // Clear and fall through to normal dispatch — never silently rebind.
      const optOv = document.getElementById('options-overlay');
      if (!optOv || !optOv.classList.contains('active')) {
        setCapturing(null);
      } else {
        e.preventDefault();
        // Escape / overlay_close key cancels capture without rebinding.
        if (e.key === 'Escape' || keyToAction(e) === 'overlay_close') {
          setCapturing(null);
          bridge.renderOptions?.();
          return;
        }
        // Reject modifier-chord keys (Ctrl+K, Alt+K, etc.) and bare modifier
        // keys (Shift/Control/Alt/Meta). Stay in capturing mode — don't commit,
        // don't cancel — so the user presses a clean key.
        if (e.ctrlKey || e.altKey || e.metaKey ||
            e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
          return;
        }
        const r = rebind(cap, e.key.toLowerCase(), bindingFor(cap) ?? undefined);
        setCapturing(null);
        if (r.conflict) {
          // Conflict: the pressed key already belongs to another action.
          alert(tMsg('kb.conflict', e.key.toLowerCase(), t('kb.' + r.conflict)));
        }
        bridge.renderOptions?.();
        return;
      }
    }

    // Batch3A: ending-choice is a mandatory modal outside the open-flag
    // bookkeeping — without this gate gameplay keys (movement!) leak through
    // while the Slay/Refuse popup is up. Tab stays TRAPPED in the popup
    // (wrap-around cycle) — escaping to HUD controls the gate itself keeps
    // unactivatable would strand the player outside the choice.
    const endingOv = document.getElementById('ending-choice');
    if (endingOv && endingOv.classList.contains('active')) {
      if (e.key === 'Tab') {
        // Same selector + visibility filter as the generic overlay trap below.
        const foci = Array.from(endingOv.querySelectorAll<HTMLElement>('button,[tabindex="0"]'))
          .filter(el => el.offsetParent !== null); // visible only
        if (foci.length) {
          const idx = foci.indexOf(document.activeElement as HTMLElement);
          e.preventDefault();
          (foci[e.shiftKey ? (idx <= 0 ? foci.length - 1 : idx - 1)
                            : (idx === foci.length - 1 ? 0 : idx + 1)] as HTMLElement).focus();
        }
      } else { e.preventDefault(); }
      return;
    }

    // F11 toggles real (windowed) fullscreen under Electron; browsers handle their own.
    // (Meta key — stays hardcoded, not routed through the action map.)
    if (e.key === 'F11' && (window as any).dh?.toggleFullscreen) { e.preventDefault(); (window as any).dh.toggleFullscreen(); }
    if (G && G.gameOver && !invOpen && !helpOpen && !skillOpen && !achOpen && !talentOpen && !eventOpen && !menuOpen && !introOpen) return;

    // Focus trap: when an overlay is open, let Tab cycle only within it (don't swallow it).
    if (e.key === 'Tab') {
      const openOv = document.querySelector<HTMLElement>('.overlay.active');
      if (openOv) {
        const f = Array.from(openOv.querySelectorAll<HTMLElement>('button,[tabindex="0"]'))
          .filter(el => el.offsetParent !== null); // visible only
        if (f.length) {
          const first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); return; }
          if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); return; }
        }
        return; // allow native Tab within the overlay (no preventDefault)
      }
    }

    // Options panel — overlay_close (ESC) closes it. Tab nav is handled by the focus trap above;
    // every other key is swallowed so it never reaches the global "ESC opens pause" below.
    const optOv = document.getElementById('options-overlay');
    if (optOv && optOv.classList.contains('active')) {
      if (keyToAction(e) === 'overlay_close') { bridge.closeOptions?.(); e.preventDefault(); }
      return;
    }
    // Item intro card — overlay_close (ESC) or `b` closes it; swallow all other keys while open.
    // (`b` is kept literal here — it maps to `inventory` in the action map, but its secondary
    //  behavior of closing these overlays must not also make `i` close them.)
    if (introOpen) {
      if (keyToAction(e) === 'overlay_close' || e.key.toLowerCase() === 'b') { closeItemIntro(); e.preventDefault(); return; }
      e.preventDefault(); return;
    }
    // Pause menu — overlay_close (ESC) or `b` closes it; swallow all other keys while open.
    if (menuOpen) {
      if (keyToAction(e) === 'overlay_close' || e.key.toLowerCase() === 'b') { bridge.closePause?.(); e.preventDefault(); return; }
      e.preventDefault(); return;
    }

    // Event popup handling
    if (eventOpen) {
      const n = parseInt(e.key);
      if (n >= 1 && n <= eventActions.length) { eventActions[n - 1](); e.preventDefault(); return; }
      if (keyToAction(e) === 'overlay_close') { closeEvent(); e.preventDefault(); return; }
      e.preventDefault(); return;
    }

    // Inventory modal — overlay_close (ESC) or `b` closes; digits 1-9 operate items (hardcoded,
    // overlay-internal — not routed through the action map per the rebind boundary).
    if (invOpen) {
      if (keyToAction(e) === 'overlay_close' || e.key.toLowerCase() === 'b') { closeInventory(); e.preventDefault(); return; }
      const n = parseInt(e.key);
      if (n >= 1 && n <= 9 && G && n <= G.player.inv.length) {
        if (sellMode) {
          sellItem(n - 1);
        } else {
          const it = G.player.inv[n - 1];
          if (it.type === 'weapon' || it.type === 'armor' || it.type === 'accessory') equipItem(n - 1);
          else useItem(n - 1);
        }
        // Re-render inventory
        if (bridge.renderInv) bridge.renderInv();
        bridge.updateUI?.();
        bridge.render?.();
      }
      e.preventDefault(); return;
    }

    // Help modal — overlay_close (ESC) or `?` closes (`?` is overlay-internal, stays literal)
    if (helpOpen) { if (keyToAction(e) === 'overlay_close' || e.key === '?') { closeHelp(); e.preventDefault(); } return; }
    // Skill modal — K or Enter to execute (overlay-internal, literal), overlay_close (ESC) to close
    if (skillOpen) {
      if (keyToAction(e) === 'overlay_close') { closeSkillPanel(); e.preventDefault(); return; }
      if (e.key === 'k' || e.key === 'K' || e.key === 'Enter') {
        // Try to execute skill if usable
        if (G) {
          const p = G.player, cls = bridge.classes[p.ci];
          if (cls) {
            const sk = cls.skill;
            const cdLeft = Math.max(0, p.skillCd);
            if (cdLeft === 0 && p.mp >= sk.cost) {
              executeSkill(sk);
              closeSkillPanel();
              e.preventDefault(); return;
            }
            // Not usable (cooldown / low MP): keep the panel open so the player
            // can still read the remaining cooldown. Escape still closes it.
          }
        }
        e.preventDefault(); return;
      }
      e.preventDefault(); return;
    }
    // Achievement modal — overlay_close (ESC) or `t`/`T` closes (overlay-internal, literal)
    if (achOpen) { if (keyToAction(e) === 'overlay_close' || e.key === 't' || e.key === 'T') { closeAchievements(); e.preventDefault(); } return; }
    // Talent modal — overlay_close (ESC) or `n`/`N` closes (overlay-internal, literal)
    if (talentOpen) { if (keyToAction(e) === 'overlay_close' || e.key === 'n' || e.key === 'N') { closeTalentPanel(); e.preventDefault(); } return; }
    // Forge overlay — close on overlay_close (ESC)
    const forgeEl = document.getElementById('forge-overlay');
    if (forgeEl && getComputedStyle(forgeEl).display !== 'none') { if (keyToAction(e) === 'overlay_close') { hideOverlay('forge-overlay'); e.preventDefault(); } return; }

    // overlay_close (ESC): records/codex are shown via showOverlay but have no
    // open-flag rung above — close them first (title screen included, where
    // openPause is a G=null no-op), else fall through to the pause menu.
    if (keyToAction(e) === 'overlay_close') {
      for (const id of ['records-overlay', 'codex-overlay']) {
        const el = document.getElementById(id);
        if (el?.classList.contains('active')) { hideOverlay(id); e.preventDefault(); return; }
      }
      bridge.openPause?.(); e.preventDefault(); return;
    }

    if (!G) return;

    // Ctrl+S save (meta key — stays hardcoded, not routed through the action map)
    if ((e.key === 's' || e.key === 'S') && e.ctrlKey) { e.preventDefault(); saveGame(); return; }

    // Gameplay dispatch — table-driven via keyToAction. Unmapped keys (a === null) skip the
    // switch but still hit preventDefault below, preserving the original unconditional behavior.
    const a = keyToAction(e);
    if (a) dispatchKeyboardAction(a);
    e.preventDefault();
  });

  // Poll connected gamepads every 60ms for Steam Deck / controller play.
  setInterval(pollGamepad, 60);
}

/**
 * Gameplay keyboard dispatch — action → side effect. Extracted from the keydown
 * listener so the action→dispatch mapping is unit-testable without a DOM listener.
 *
 * `overlay_close` and `pause` never reach here from the keyboard handler: the
 * standalone ESC-opens-pause check (above the `!G` guard) intercepts
 * overlay_close before the gameplay section, and keyboard has no pause action.
 */
export function dispatchKeyboardAction(a: Action): void {
  switch (a) {
    case 'move_up': movePlayer(0, -1); break;
    case 'move_down': movePlayer(0, 1); break;
    case 'move_left': movePlayer(-1, 0); break;
    case 'move_right': movePlayer(1, 0); break;
    case 'pickup': pickupItem(); break;
    case 'descend': descendStairs(); break;
    case 'wait': doWait(); break;
    case 'inventory': openInventory(); break;
    case 'quaff': quickQuaff(); break;
    case 'read': quickRead(); break;
    case 'help': openHelp(); break;
    case 'skill': tryCastSkill(); break;
    case 'achieve': openAchievements(); break;
    case 'talent': openTalentPanel(); break;
    case 'lang': bridge.toggleLang?.(); break;
    case 'mute': bridge.toggleSound?.(); break;
    case 'quick1': useQuickSlot(0); break;
    case 'quick2': useQuickSlot(1); break;
    case 'quick3': useQuickSlot(2); break;
    case 'quick4': useQuickSlot(3); break;
    case 'quick5': useQuickSlot(4); break;
    case 'quick6': useQuickSlot(5); break;
    case 'quick7': useQuickSlot(6); break;
    case 'quick8': useQuickSlot(7); break;
    case 'quick9': useQuickSlot(8); break;
  }
}

/**
 * Gamepad action dispatch — action → side effect, gated by overlay state.
 * Extracted for unit-testability of the button→action→dispatch chain.
 *
 * Preserves the original pollGamepad semantics:
 *   - D-pad / move: only when !overlay
 *   - wait (A): only when !overlay (batch3A: in a menu context, pollGamepad's
 *     menu branch reinterprets A as a click on the focused element instead)
 *   - overlay_close (B): closes an open overlay; ELSE (no overlay) picks up an item.
 *     The B-pickup behavior MUST survive the refactor.
 *   - skill/inventory/quaff/descend: only when !overlay
 *   - pause (Start): toggles pause regardless of overlay
 */
export function dispatchGamepadAction(a: Action, overlay: boolean): void {
  switch (a) {
    case 'move_up': if (!overlay) movePlayer(0, -1); break;
    case 'move_down': if (!overlay) movePlayer(0, 1); break;
    case 'move_left': if (!overlay) movePlayer(-1, 0); break;
    case 'move_right': if (!overlay) movePlayer(1, 0); break;
    case 'wait': if (!overlay) doWait(); break;
    case 'overlay_close': if (!closeActiveOverlay() && !overlay) pickupItem(); break;
    case 'skill': if (!overlay) openSkillPanel(); break;
    case 'inventory': if (!overlay) openInventory(); break;
    case 'quaff': if (!overlay) quickQuaff(); break;
    case 'descend': if (!overlay) descendStairs(); break;
    case 'pause': menuOpen ? bridge.closePause?.() : bridge.openPause?.(); break;
  }
}

// ===== Gamepad support (Steam Deck / controller) =====
// Edge-triggered buttons + a move repeat cooldown so holding a direction steps tile-by-tile.
let gpPrevBtn: boolean[] = [];
let gpMoveCd = 0;
// Exported (batch3a T3) as the test injection point: tests stub
// navigator.getGamepads and call pollGamepad() directly to simulate edges.
export function pollGamepad(): void {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = pads.find(p => p && p.mapping === 'standard');
  if (!gp) return;
  const btn = (i: number) => !!(gp!.buttons[i] && gp!.buttons[i].pressed);
  const edge = (i: number) => btn(i) && !gpPrevBtn[i];

  // Keybind capture mode — first pressed (edge) gamepad button captures. Mirrors
  // the keyboard capture hook at the top of the keydown handler. The next button
  // press rebinds the action via rebindButton(); conflicts are alerted.
  const cap = getCapturing();
  if (cap) {
    // Defense-in-depth: only honor capture while the options overlay is open.
    // A stale flag (options closed via a path that didn't clear capture) is
    // treated as cancelled — clear and fall through to normal gamepad dispatch.
    const optOv = document.getElementById('options-overlay');
    if (!optOv || !optOv.classList.contains('active')) {
      setCapturing(null);
    } else {
      for (let i = 0; i < gp.buttons.length; i++) {
        if (edge(i)) {
          const r = rebindButton(cap, i);
          setCapturing(null);
          if (r.conflict) {
            alert(tMsg('kb.conflict', gamepadBtnLabel(i), t('kb.' + r.conflict)));
          }
          bridge.renderOptions?.();
          break;
        }
      }
      // Maintain edge-detection state + cooldown even during capture.
      gpPrevBtn = gp.buttons.map(b => !!(b && b.pressed));
      if (gpMoveCd > 0) gpMoveCd--;
      return;
    }
  }

  // Batch3A: menu contexts take precedence over gameplay dispatch. Focus
  // navigation runs regardless of G / gameOver — this is what makes title,
  // char-sel, death, victory and ending screens reachable by gamepad.
  const menu = activeMenuContext();
  if (menu) {
    // Anchor: if nothing inside the menu holds focus, focus the first element.
    const active = document.activeElement as HTMLElement | null;
    if (!active || !menu.contains(active)) {
      const first = focusablesIn(menu)[0];
      if (first) gpFocus(first);
    }
    // Left stick — directional focus movement, same repeat cooldown as walking.
    const axes = gp!.axes || [];
    const ax = axes[0] || 0, ay = axes[1] || 0;
    if (gpMoveCd <= 0 && (Math.abs(ax) > 0.5 || Math.abs(ay) > 0.5)) {
      menuMoveFocus(menu,
        Math.abs(ax) > 0.5 ? Math.sign(ax) as -1 | 1 : 0,
        Math.abs(ay) > 0.5 ? Math.sign(ay) as -1 | 1 : 0);
      gpMoveCd = 8;
    }
    if (gpMoveCd > 0 && Math.abs(ax) <= 0.5 && Math.abs(ay) <= 0.5) gpMoveCd = 0;
    // Buttons — edge-triggered, reinterpreted through the user's own bindings:
    // move_* = spatial focus, wait = activate, overlay_close = back,
    // quaff/descend (LB/RB) = sequential focus, pause stays pause.
    for (let i = 0; i < gp.buttons.length; i++) {
      if (!edge(i)) continue;
      const a = buttonToAction(i);
      if (!a) continue;
      if (a === 'move_up') menuMoveFocus(menu, 0, -1);
      else if (a === 'move_down') menuMoveFocus(menu, 0, 1);
      else if (a === 'move_left') menuMoveFocus(menu, -1, 0);
      else if (a === 'move_right') menuMoveFocus(menu, 1, 0);
      else if (a === 'wait') {
        const el = document.activeElement as HTMLElement | null;
        if (el && menu.contains(el)) el.click();
      }
      else if (a === 'overlay_close') menuBack();
      else if (a === 'quaff') seqFocus(menu, -1);
      else if (a === 'descend') seqFocus(menu, 1);
      else if (a === 'pause') {
        if (menuOpen) bridge.closePause?.();
        else if (G && !G.gameOver) bridge.openPause?.();
      }
    }
  } else if (G && !G.gameOver) {
    // ---- gameplay dispatch (pre-batch3A behavior, unchanged) ----
    // Left stick — 8-direction, 0.5 deadzone, repeat cooldown (NOT a button action)
    const axes = gp!.axes || [];
    const ax = axes[0] || 0, ay = axes[1] || 0;
    if (gpMoveCd <= 0 && (Math.abs(ax) > 0.5 || Math.abs(ay) > 0.5)) {
      const dx = Math.abs(ax) > 0.5 ? Math.sign(ax) : 0;
      const dy = Math.abs(ay) > 0.5 ? Math.sign(ay) : 0;
      movePlayer(dx, dy);
      gpMoveCd = 8; // ~480ms at 60ms poll — controllable stepping pace
    }
    if (gpMoveCd > 0 && Math.abs(ax) <= 0.5 && Math.abs(ay) <= 0.5) gpMoveCd = 0;
    // Action buttons (edge-triggered) — dispatch via table lookup.
    for (let i = 0; i < gp.buttons.length; i++) {
      if (edge(i)) {
        const a = buttonToAction(i);
        if (a) dispatchGamepadAction(a, false);
      }
    }
  }
  if (gpMoveCd > 0) gpMoveCd--;
  gpPrevBtn = gp.buttons.map(b => !!(b && b.pressed));
}

// Batch3A: directional focus move within a menu context. A focused range input
// captures horizontal input for value adjustment instead of moving focus.
function menuMoveFocus(menu: HTMLElement, dx: -1 | 0 | 1, dy: -1 | 0 | 1): void {
  if (!dx && !dy) return;
  const active = document.activeElement as HTMLElement | null;
  const inMenu = !!(active && menu.contains(active));
  if (dx !== 0 && inMenu && active instanceof HTMLInputElement && active.type === 'range') {
    if (stepRange(active, dx)) return;
  }
  const list = focusablesIn(menu);
  if (!list.length) return;
  const from = inMenu && list.includes(active!) ? active! : list[0];
  const rect = (el: HTMLElement): FocusRect => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  };
  const next = spatialNext(rect(from), list.map(el => ({ el, r: rect(el) })), dx, dy);
  if (next && next !== from) gpFocus(next);
}

// Touch controls setup
export function initTouchControls(): void {
  const bind = (id: string, fn: () => void) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  };
  bind('tb-up', () => movePlayer(0, -1));
  bind('tb-down', () => movePlayer(0, 1));
  bind('tb-left', () => movePlayer(-1, 0));
  bind('tb-right', () => movePlayer(1, 0));
  bind('tb-center', () => doWait());
  bind('tb-pickup', () => pickupItem());
  bind('tb-descend', () => descendStairs());
  bind('tb-inventory', () => openInventory());
  bind('tb-skill', () => openSkillPanel());
}
