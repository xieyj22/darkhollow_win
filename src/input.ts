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

export function initInput(): void {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    // F11 toggles real (windowed) fullscreen under Electron; browsers handle their own.
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

    // Options panel — ESC closes it. Tab nav is handled by the focus trap above;
    // every other key is swallowed so it never reaches the global "ESC opens pause" below.
    const optOv = document.getElementById('options-overlay');
    if (optOv && optOv.classList.contains('active')) {
      if (e.key === 'Escape') { bridge.closeOptions?.(); e.preventDefault(); }
      return;
    }
    // Item intro card — ESC / B closes it; swallow all other keys while open.
    if (introOpen) {
      if (e.key === 'Escape' || e.key === 'b' || e.key === 'B') { closeItemIntro(); e.preventDefault(); return; }
      e.preventDefault(); return;
    }
    // Pause menu — ESC / B closes it; swallow all other keys while open.
    if (menuOpen) {
      if (e.key === 'Escape' || e.key === 'b' || e.key === 'B') { bridge.closePause?.(); e.preventDefault(); return; }
      e.preventDefault(); return;
    }

    // Event popup handling
    if (eventOpen) {
      const n = parseInt(e.key);
      if (n >= 1 && n <= eventActions.length) { eventActions[n - 1](); e.preventDefault(); return; }
      if (e.key === 'Escape') { closeEvent(); e.preventDefault(); return; }
      e.preventDefault(); return;
    }

    // Inventory modal
    if (invOpen) {
      if (e.key === 'b' || e.key === 'B' || e.key === 'Escape') { closeInventory(); e.preventDefault(); return; }
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

    // Help modal
    if (helpOpen) { if (e.key === 'Escape' || e.key === '?') { closeHelp(); e.preventDefault(); } return; }
    // Skill modal — K or Enter to execute, Escape to close
    if (skillOpen) {
      if (e.key === 'Escape') { closeSkillPanel(); e.preventDefault(); return; }
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
    // Achievement modal
    if (achOpen) { if (e.key === 'Escape' || e.key === 't' || e.key === 'T') { closeAchievements(); e.preventDefault(); } return; }
    // Talent modal
    if (talentOpen) { if (e.key === 'Escape' || e.key === 'n' || e.key === 'N') { closeTalentPanel(); e.preventDefault(); } return; }
    // Forge overlay — close on Escape
    const forgeEl = document.getElementById('forge-overlay');
    if (forgeEl && getComputedStyle(forgeEl).display !== 'none') { if (e.key === 'Escape') { hideOverlay('forge-overlay'); e.preventDefault(); } return; }

    // ESC opens the in-game pause menu when no other overlay is open. (Options/pause are
    // intercepted earlier, so reaching here means nothing else is open — safe to toggle pause.)
    if (e.key === 'Escape') { bridge.openPause?.(); e.preventDefault(); return; }

    if (!G) return;

    // Ctrl+S save
    if ((e.key === 's' || e.key === 'S') && e.ctrlKey) { e.preventDefault(); saveGame(); return; }

    switch (e.key.toLowerCase()) {
      case 'w': case 'arrowup': movePlayer(0, -1); break;
      case 's': case 'arrowdown': movePlayer(0, 1); break;
      case 'a': case 'arrowleft': movePlayer(-1, 0); break;
      case 'd': case 'arrowright': movePlayer(1, 0); break;
      case 'g': pickupItem(); break;
      case '.': case '>': descendStairs(); break;
      case ' ': doWait(); break;
      case 'f': doWait(); break;
      case 'i': case 'b': openInventory(); break;
      case 'q': quickQuaff(); break;
      case 'r': quickRead(); break;
      case '?': openHelp(); break;
      case 'k': tryCastSkill(); break;
      case 't': openAchievements(); break;
      case 'n': openTalentPanel(); break;
      case 'l': bridge.toggleLang?.(); break;
      case 'm': bridge.toggleSound?.(); break;
      default: {
        const n = parseInt(e.key);
        if (n >= 1 && n <= 9) useQuickSlot(n - 1);
        break;
      }
    }
    e.preventDefault();
  });

  // Poll connected gamepads every 60ms for Steam Deck / controller play.
  setInterval(pollGamepad, 60);
}

// Close whichever overlay is currently open. Returns true if one was closed.
function closeActiveOverlay(): boolean {
  if (introOpen) { closeItemIntro(); return true; }
  if (eventOpen) { closeEvent(); return true; }
  if (invOpen) { closeInventory(); return true; }
  if (skillOpen) { closeSkillPanel(); return true; }
  if (talentOpen) { closeTalentPanel(); return true; }
  if (achOpen) { closeAchievements(); return true; }
  if (helpOpen) { closeHelp(); return true; }
  const forge = document.getElementById('forge-overlay');
  if (forge && getComputedStyle(forge).display !== 'none') { hideOverlay('forge-overlay'); return true; }
  const optOv = document.getElementById('options-overlay');
  if (optOv && optOv.classList.contains('active')) { bridge.closeOptions?.(); return true; }
  if (menuOpen) { bridge.closePause?.(); return true; }
  return false;
}

// ===== Gamepad support (Steam Deck / controller) =====
// Edge-triggered buttons + a move repeat cooldown so holding a direction steps tile-by-tile.
let gpPrevBtn: boolean[] = [];
let gpMoveCd = 0;
function pollGamepad(): void {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = pads && pads[0];
  if (!gp) return;
  const btn = (i: number) => !!(gp!.buttons[i] && gp!.buttons[i].pressed);
  const edge = (i: number) => btn(i) && !gpPrevBtn[i];
  const optOv = document.getElementById('options-overlay');
  const forgeOv = document.getElementById('forge-overlay');
  const overlay = invOpen || skillOpen || talentOpen || achOpen || helpOpen || eventOpen || menuOpen || introOpen
    || !!optOv?.classList.contains('active')
    || (!!forgeOv && getComputedStyle(forgeOv).display !== 'none');
  if (G && !G.gameOver) {
    if (!overlay) {
      // D-pad
      if (edge(12)) movePlayer(0, -1);
      if (edge(13)) movePlayer(0, 1);
      if (edge(14)) movePlayer(-1, 0);
      if (edge(15)) movePlayer(1, 0);
      // Left stick — 8-direction, 0.5 deadzone, repeat cooldown
      const axes = gp!.axes || [];
      const ax = axes[0] || 0, ay = axes[1] || 0;
      if (gpMoveCd <= 0 && (Math.abs(ax) > 0.5 || Math.abs(ay) > 0.5)) {
        const dx = Math.abs(ax) > 0.5 ? Math.sign(ax) : 0;
        const dy = Math.abs(ay) > 0.5 ? Math.sign(ay) : 0;
        movePlayer(dx, dy);
        gpMoveCd = 8; // ~480ms at 60ms poll — controllable stepping pace
      }
      if (gpMoveCd > 0 && Math.abs(ax) <= 0.5 && Math.abs(ay) <= 0.5) gpMoveCd = 0;
    }
    // Action buttons (edge-triggered)
    if (edge(0)) { if (!overlay) doWait(); }                       // A
    if (edge(1)) { if (!closeActiveOverlay() && !overlay) pickupItem(); } // B
    if (edge(2)) { if (!overlay) openSkillPanel(); }               // X
    if (edge(3)) { if (!overlay) openInventory(); }                 // Y
    if (edge(4)) { if (!overlay) quickQuaff(); }                    // LB
    if (edge(5)) { if (!overlay) descendStairs(); }                 // RB
    if (edge(9)) { menuOpen ? bridge.closePause?.() : bridge.openPause?.(); }   // Start = pause
  } else if (overlay) {
    if (edge(0) || edge(1)) closeActiveOverlay();
  }
  if (gpMoveCd > 0) gpMoveCd--;
  gpPrevBtn = gp.buttons.map(b => !!(b && b.pressed));
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
