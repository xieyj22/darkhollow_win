// Steam Cloud mirror — MUST stay the first import: it runs a sendSync read-back
// of the mirrored files into localStorage at module-evaluation time, which has
// to land BEFORE state.ts/audio.ts read their persisted keys below.
import './cloud-sync.js';

// Localized fonts — replaces the Google Fonts @import so the game runs fully offline.
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';

// Main entry point — wires all modules together
import { G, setGameState, setLang, lang, setUiZoom, uiZoom, setMinimapScale, minimapScale, setLegendVisible, legendVisible, setKeysVisible, keysVisible, setHelpOpen, setSkillOpen, setAchOpen, setTalentOpen, setSafeZone, safeZone, setReducedMotion, reducedMotion, setMenuOpen } from './state.js';
import { MH, MW, FOV, MAX_INV, FINAL, TL, TS } from './config.js';
import { rng, pick, clamp, dst, darken } from './utils.js';
import { L, t, tMsg, rareName, itemName, tx, RARITY_C } from './i18n.js';
import { CLASSES, WEAPONS, ARMORS, ACCESSORIES, POTIONS, SCROLLS, CONSUMABLES, TRAPS, ELITE_PREFIX, ENEMIES, BOSSES, ACH_DEFS, TALENT_TREES } from './data.js';
import { initAudio, getAudioContext, snd, setBgmScene, setMasterVol, setMusicVol, setSfxVol, getMasterVol, getMusicVol, getSfxVol, isMuted, setMutedState } from './audio.js';
import { flt, shake } from './effects.js';
import { genDungeon, computeFOV } from './dungeon.js';
import { addMsg } from './messages.js';
import { attack, checkLevelUp, recalc, playerDeath, playerVictory, checkAch, checkAchs, setGenItemFn as setCombatGenItem, killEnemy, resolveEnding } from './combat.js';
import { genItem, genWeapon, genArmor, genAcc, genPotion, genScroll, genFood, genConsumable, useItem, equipItem, quickQuaff, quickRead, renderHotbar, useQuickSlot, addItemWithOverflow, setEndTurnFn as setItemsEndTurn, setFindNearestEnemyFn } from './items.js';
import { spawnEnemies, processEnemies, checkPlayerTraps } from './enemies.js';
import { findNearestEnemy, executeSkill, setEndTurnFn as setSkillsEndTurn } from './skills.js';
import { showEvent, closeEvent, checkTraps, checkTiles } from './events.js';
import { createPlayer, movePlayer, pickupItem, descendStairs, doWait, setEndTurnFn as setPlayerEndTurn, setEnterFloorFn } from './player.js';
import { endTurn, setPlayerDeathFn } from './turn.js';
import { initGame, enterFloor } from './game.js';
import { render, renderMinimap, resizeCanvas, updateUI, markMinimapDirty, drawPlayerLayer, drawEnemyLayer } from './render.js';
import { initInput, initTouchControls } from './input.js';
import { saveGame, loadGame } from './save.js';
import { setRecalcFn, setKillEnemyFn } from './relics.js';
import { paintIcon } from './sprites.js';
import { renderForge, renderTitleStats, getMeta } from './meta.js';
import { LORE_ENTRIES, LORE_CATS } from './lore.js';
import { startParticles, stopParticles, setDrawPlayerLayerFn, setDrawEnemyLayerFn } from './particles.js';
import { openOptions, closeOptions, renderOptions, applyOptionsUI } from './options.js';
import { bridge } from './bridge.js';
import { updateLangUI, toggleLang, toggleSound, updateSoundBtn, applyAudioUI, minimapZoom } from './ui-settings.js';
import { applyAll } from './settings.js';
import { toggleLegend, toggleObjective, toggleKeys, initTooltip, initFocusTooltips, validateTooltip, showOverlay, hideOverlay, openPause, closePause, renderRecords, renderCodex } from './ui-panels.js';
import { closeItemIntro } from './item-intro.js';
import { clearTransientUi } from './menu-context.js';
import { showCharSelect } from './char-select.js';
import { closeInventory } from './panels.js';

// ===== Wire up late-bound dependencies =====
setCombatGenItem(genItem);
setItemsEndTurn(endTurn);
setFindNearestEnemyFn(findNearestEnemy);
setSkillsEndTurn(endTurn);
setPlayerEndTurn(endTurn);
setEnterFloorFn(enterFloor);
setPlayerDeathFn(playerDeath);
setRecalcFn(recalc);
setKillEnemyFn(killEnemy);
setDrawPlayerLayerFn(drawPlayerLayer);
setDrawEnemyLayerFn(drawEnemyLayer);

// Expose to typed bridge registry for cross-module access
bridge.initAudio = initAudio;
bridge.muted = isMuted();
bridge.classes = CLASSES;
bridge.achDefs = ACH_DEFS;
bridge.talentTrees = TALENT_TREES;
bridge.recalc = recalc;
bridge.renderHotbar = renderHotbar;
bridge.updateUI = updateUI;
bridge.validateTooltip = validateTooltip; // 批9 ⑧: per-turn tooltip target validation
bridge.render = render;
bridge.markMinimapDirty = markMinimapDirty;
bridge.toggleLang = toggleLang;
bridge.closeEvent = closeEvent;
bridge.toggleSound = toggleSound;
bridge.updateSoundBtn = updateSoundBtn;
bridge.updateLangUI = updateLangUI;
bridge.openPause = openPause;
bridge.closePause = closePause;
bridge.closeOptions = closeOptions;
bridge.renderOptions = renderOptions;

// ===== Title Screen Particles =====
let titleAnim: number | null = null;

function initTitleParticles(): void {
  if (reducedMotion) return; // accessibility: skip the title particle storm
  const c = document.getElementById('title-particles') as HTMLCanvasElement;
  if (!c) return;
  const pc = c.getContext('2d')!;
  c.width = window.innerWidth;
  c.height = window.innerHeight;
  const ps: Array<{ x: number; y: number; vx: number; vy: number; sz: number; a: number; c: string }> = [];
  for (let i = 0; i < 90; i++) ps.push({
    x: Math.random() * c.width, y: Math.random() * c.height,
    vx: (Math.random() - .5) * .5, vy: -Math.random() * .5 - .2,
    sz: Math.random() * 2 + .5, a: Math.random() * .5 + .1,
    c: Math.random() < .5 ? '#e63946' : '#ffd700',
  });
  function anim() {
    pc.clearRect(0, 0, c.width, c.height);
    for (const p of ps) {
      p.x += p.vx; p.y += p.vy; p.a -= .001;
      if (p.y < -10 || p.a <= 0) { p.y = c.height + 10; p.x = Math.random() * c.width; p.a = Math.random() * .5 + .1; }
      pc.fillStyle = p.c; pc.globalAlpha = p.a;
      pc.beginPath(); pc.arc(p.x, p.y, p.sz, 0, Math.PI * 2); pc.fill();
    }
    pc.globalAlpha = 1;
    if (document.getElementById('title-screen')!.style.display !== 'none') titleAnim = requestAnimationFrame(anim);
  }
  if (titleAnim) cancelAnimationFrame(titleAnim);
  anim();
}

// ===== Character Selection =====
function startNewGame(): void {
  document.getElementById('title-screen')!.style.display = 'none';
  document.getElementById('death-screen')!.style.display = 'none';
  document.getElementById('victory-screen')!.style.display = 'none';
  showCharSelect({
    onStart: (r, c, endless) => {
      document.getElementById('game-container')!.style.display = 'flex';
      initAudio();
      initGame(r, c, endless);
      resizeCanvas();
      startParticles();
      updateUI();
      render();
    },
    onBack: () => {
      document.getElementById('title-screen')!.style.display = 'flex';
      initTitleParticles();
      renderTitleStats();   // ④ refresh after a run may have changed meta stats
    },
  });
}

function returnToTitle(): void {
  clearTransientUi();   // 批4: quit-to-title — drop intro queue + close any open overlay
  document.getElementById('death-screen')!.style.display = 'none';
  document.getElementById('victory-screen')!.style.display = 'none';
  document.getElementById('game-container')!.style.display = 'none';
  document.getElementById('title-screen')!.style.display = 'flex';
  setGameState(null);
  stopParticles();
  setBgmScene('title');
  initTitleParticles();
  renderTitleStats();   // ④ refresh after a run may have changed meta stats
}

// ===== Bind HTML buttons =====
function bindButtons(): void {
  const on = (id: string, fn: () => void) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  };

  on('btn-new', startNewGame);
  on('btn-cont', () => { clearTransientUi(); loadGame(); });
  on('btn-forge', () => { showOverlay('forge-overlay'); renderForge(); });
  on('btn-help', () => { setHelpOpen(true); showOverlay('help-overlay'); bridge.renderHelp?.(); });
  on('lang-btn', toggleLang);

  on('btn-close-inv', () => { closeInventory(); });
  on('btn-close-help', () => { setHelpOpen(false); hideOverlay('help-overlay'); });
  on('btn-close-skill', () => { setSkillOpen(false); hideOverlay('skill-overlay'); });
  on('btn-close-ach', () => { setAchOpen(false); hideOverlay('achievement-overlay'); });
  on('btn-close-talent', () => { setTalentOpen(false); hideOverlay('talent-overlay'); });
  on('btn-close-forge', () => { hideOverlay('forge-overlay'); });
  on('btn-records', () => { showOverlay('records-overlay'); renderRecords(); });
  on('btn-close-records', () => { hideOverlay('records-overlay'); });
  on('btn-codex', () => { showOverlay('codex-overlay'); renderCodex(); });
  on('btn-close-codex', () => { hideOverlay('codex-overlay'); });
  on('btn-close-intro', closeItemIntro);
  on('btn-ending-slay', () => resolveEnding('slay'));
  on('btn-ending-refuse', () => resolveEnding('refuse'));
  on('btn-back-title', () => {
    if (G && !G.gameOver) {
      // Confirm before leaving an active game
      if (confirm(t('mn.confirmReturnTitle'))) {
        returnToTitle();
      }
    } else {
      returnToTitle();
    }
  });

  on('btn-try-again', startNewGame);
  on('btn-death-title', returnToTitle);
  on('btn-play-again', startNewGame);
  on('btn-vic-title', returnToTitle);

  on('btn-sound', toggleSound);
  on('btn-mute', toggleSound);
  // Options + pause menu entries (audio/zoom/safe/motion now live in the Options panel)
  on('btn-options', () => openOptions('game'));
  on('btn-options-title', () => openOptions('title'));
  on('btn-close-options', closeOptions);
  on('btn-close-pause', closePause);
  on('btn-pause-resume', closePause);
  on('btn-pause-settings', () => { closePause(); openOptions('pause'); });
  on('btn-pause-quit', () => { if (confirm(t('quitConfirm'))) { closePause(); returnToTitle(); } });
  on('btn-mm-out', () => minimapZoom(-1));
  on('btn-mm-in', () => minimapZoom(1));

  document.getElementById('sb-legend')!.addEventListener('click', toggleLegend);
  document.getElementById('sb-obj')!.addEventListener('click', toggleObjective);
  on('keys-toggle', toggleKeys);

  // Sidebar toggle (class on game-container so the toggle button is never clipped)
  on('btn-sidebar-toggle', () => {
    const gc = document.getElementById('game-container')!;
    const btn = document.getElementById('btn-sidebar-toggle')!;
    gc.classList.toggle('sidebar-collapsed');
    btn.textContent = gc.classList.contains('sidebar-collapsed') ? '▶' : '◀';
    setTimeout(() => { if (G) { resizeCanvas(); render(); } }, 320);
  });
}

// ===== Window Init =====
window.addEventListener('load', () => {
  updateLangUI();
  // One-pass apply of every persisted setting's DOM side-effect (CSS vars +
  // body classes for zoom / safe-zone / reduced-motion / text-scale / colorblind
  // / bar-cues, plus the mute bridge flag). Replaces the old per-apply chain.
  applyAll();
  applyAudioUI();
  initTitleParticles();
  renderTitleStats();   // ④ first paint of the title stats row (was imported, never called)
  bindButtons();
  initInput();
  initTouchControls();
  initTooltip();
  initFocusTooltips();

  // Browsers suspend AudioContext until a user gesture — unlock on first input,
  // then start the title BGM if we're still on the title screen.
  const unlock = () => {
    initAudio();
    if (document.getElementById('title-screen')!.style.display !== 'none') setBgmScene('title');
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('keydown', unlock);
  };
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);

  window.addEventListener('resize', () => {
    const c = document.getElementById('title-particles') as HTMLCanvasElement;
    if (c) { c.width = window.innerWidth; c.height = window.innerHeight; }
    if (G) { resizeCanvas(); render(); }
  });
});
