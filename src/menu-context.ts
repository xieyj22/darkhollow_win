// Batch3A: menu-context detection for gamepad focus navigation.
// activeMenuContext() names the ONE container spatial navigation operates in;
// menuBack() performs the context-appropriate "B = back" action.
// closeActiveOverlay() moved here from input.ts (batch3a T2) so both the
// gameplay dispatch and menuBack share one close ladder — now generalized to
// any .overlay.active panel (records/codex included; ending-choice deliberately
// EXCLUDED: the Slay/Refuse choice is mandatory and has no close path).
import { invOpen, helpOpen, skillOpen, achOpen, talentOpen, eventOpen, menuOpen, introOpen } from './state.js';
import { closeEvent } from './events.js';
import { hideOverlay } from './ui-panels.js';
import { bridge } from './bridge.js';
import { closeItemIntro } from './item-intro.js';
import { closeInventory, closeSkillPanel, closeAchievements, closeTalentPanel, closeHelp } from './panels.js';

export function closeActiveOverlay(): boolean {
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
  // Batch3A: panels shown via showOverlay but absent from the open-flag list.
  for (const id of ['records-overlay', 'codex-overlay']) {
    const el = document.getElementById(id);
    if (el && el.classList.contains('active')) { hideOverlay(id); return true; }
  }
  return false;
}

function visible(id: string): HTMLElement | null {
  const el = document.getElementById(id);
  return el && getComputedStyle(el).display !== 'none' ? el : null;
}

export function activeMenuContext(): HTMLElement | null {
  const ov = document.querySelector<HTMLElement>('.overlay.active');
  if (ov && ov.id !== 'ending-choice') return ov;   // handled below via ladder-free back
  return visible('event-popup') || visible('char-sel')
    || visible('title-screen') || visible('death-screen') || visible('victory-screen')
    || ov;   // ending-choice IS a navigable menu — it just has no back action
}

export function menuBack(): boolean {
  if (closeActiveOverlay()) return true;
  if (visible('event-popup')) { closeEvent(); return true; }
  const cs = document.getElementById('char-sel');
  if (cs) { (cs.querySelector('#char-back-btn') as HTMLElement | null)?.click(); return true; }
  return false;   // title / death / victory / ending-choice: B does nothing
}
