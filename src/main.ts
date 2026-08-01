// Localized fonts — replaces the Google Fonts @import so the game runs fully offline.
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';

// Main entry point — wires all modules together
import { G, setGameState, setLang, lang, setMuted, muted, setUiZoom, uiZoom, setMinimapScale, minimapScale, setLegendVisible, legendVisible, setKeysVisible, keysVisible, setInvOpen, setHelpOpen, setSkillOpen, setAchOpen, setTalentOpen, setSafeZone, safeZone, setReducedMotion, reducedMotion, setMenuOpen } from './state.js';
import { MH, MW, FOV, MAX_INV, FINAL, TL, TS } from './config.js';
import { rng, pick, clamp, dst, darken } from './utils.js';
import { L, t, tMsg, rareName, itemName, RARITY_C } from './i18n.js';
import { RACES, CLASSES, WEAPONS, ARMORS, ACCESSORIES, POTIONS, SCROLLS, CONSUMABLES, TRAPS, ELITE_PREFIX, ENEMIES, BOSSES, ACH_DEFS, TALENT_TREES } from './data.js';
import { initAudio, getAudioContext, snd, setBgmScene, setMasterVol, setMusicVol, setSfxVol, getMasterVol, getMusicVol, getSfxVol, isMuted, setMutedState } from './audio.js';
import { flt, shake } from './effects.js';
import { genDungeon, computeFOV } from './dungeon.js';
import { addMsg } from './messages.js';
import { attack, checkLevelUp, recalc, playerDeath, playerVictory, checkAch, checkAchs, setGenItemFn as setCombatGenItem, killEnemy, resolveEnding } from './combat.js';
import { genItem, genWeapon, genArmor, genAcc, genPotion, genScroll, genFood, genConsumable, useItem, equipItem, quickQuaff, quickRead, renderHotbar, useQuickSlot, addItemWithOverflow, setEndTurnFn as setItemsEndTurn, setFindNearestEnemyFn } from './items.js';
import { spawnEnemies, processEnemies, checkPlayerTraps } from './enemies.js';
import { findNearestEnemy, executeSkill, setEndTurnFn as setSkillsEndTurn } from './skills.js';
import { maybeEvent, showEvent, closeEvent, checkTraps, checkTiles } from './events.js';
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
import { openOptions, closeOptions, renderOptions, applyOptionsUI, applyTextScale, applyColorblind, applyBarCues } from './options.js';
import { bridge } from './bridge.js';
import { updateLangUI, toggleLang, toggleSound, updateSoundBtn, applyAudioUI, applyZoom, applySafe, applyReducedMotion, minimapZoom } from './ui-settings.js';
import { toggleLegend, toggleObjective, toggleKeys, initTooltip, showOverlay, hideOverlay, openPause, closePause, renderRecords, renderCodex } from './ui-panels.js';

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
bridge.muted = muted;
bridge.classes = CLASSES;
bridge.achDefs = ACH_DEFS;
bridge.talentTrees = TALENT_TREES;
bridge.recalc = recalc;
bridge.renderHotbar = renderHotbar;
bridge.updateUI = updateUI;
bridge.render = render;
bridge.markMinimapDirty = markMinimapDirty;
bridge.toggleLang = toggleLang;
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
let selRace = 0, selCls = 0;

function startNewGame(): void {
  document.getElementById('title-screen')!.style.display = 'none';
  document.getElementById('death-screen')!.style.display = 'none';
  document.getElementById('victory-screen')!.style.display = 'none';
  showCharSelect();
}

function showCharSelect(): void {
  const ov = document.createElement('div');
  ov.id = 'char-sel';
  ov.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(10,10,15,.95);z-index:1000;display:flex;align-items:center;justify-content:center;flex-direction:column';
  const raceHtml = RACES.map((r, i) => {
    const rn = lang === 'zh' ? r.name.zh : r.name.en;
    const rd = lang === 'zh' ? r.desc.zh : r.desc.en;
    return `<div class="race-opt" data-idx="${i}" style="padding:8px 15px;margin:4px 0;cursor:pointer;border:1px solid ${i === 0 ? '#e63946' : '#333'};border-radius:3px;color:${i === 0 ? '#ddd' : '#888'}"><b>${rn}</b> <span style="color:#666;font-size:.9em">${rd}</span></div>`;
  }).join('');
  const classHtml = CLASSES.map((c, i) => {
    const cn = lang === 'zh' ? c.name.zh : c.name.en;
    const cd = lang === 'zh' ? c.desc.zh : c.desc.en;
    const sk = c.skill, skName = lang === 'zh' ? sk.name.zh : sk.name.en, skDesc = lang === 'zh' ? sk.desc.zh : sk.desc.en;
    return `<div class="class-opt" data-idx="${i}" style="padding:8px 15px;margin:4px 0;cursor:pointer;border:1px solid ${i === 0 ? '#e63946' : '#333'};border-radius:3px;color:${i === 0 ? '#ddd' : '#888'}"><b>${cn}</b> <span style="color:#666;font-size:.9em">${cd}</span><br><span style="color:#9b5de5;font-size:.8em">⚡ ${skName} — ${skDesc}</span></div>`;
  }).join('');
  // Mode selector (Wave 6d): 0 = Normal (F40 Creator = victory), 1 = Endless
  // (F40 kill does NOT win; F41+ continues indefinitely with score by depth).
  // Defaults to Normal; declared inside showCharSelect so it resets each open.
  let selMode = 0;
  const modeOpts = [
    { n: lang === 'zh' ? '普通模式' : 'Normal', d: lang === 'zh' ? '第40层击败创世者即胜利' : 'Beat the Creator at F40 to win' },
    { n: lang === 'zh' ? '无尽模式' : 'Endless', d: lang === 'zh' ? 'F41+ 无限下探,以楼层为分数' : 'F41+ infinite descent, score by depth' },
  ];
  const modeHtml = modeOpts.map((m, i) =>
    `<div class="mode-opt" data-idx="${i}" style="padding:8px 15px;margin:4px 0;cursor:pointer;border:1px solid ${i === 0 ? '#e63946' : '#333'};border-radius:3px;color:${i === 0 ? '#ddd' : '#888'}"><b>${m.n}</b> <span style="color:#666;font-size:.9em">${m.d}</span></div>`
  ).join('');
  ov.innerHTML = `<h2 style="color:#e63946;margin-bottom:20px;font-size:1.8em">${t('createHero')}</h2>
  <div style="display:flex;gap:30px;margin-bottom:20px;flex-wrap:wrap;justify-content:center">
  <div><h3 style="color:#8888aa;margin-bottom:10px">${t('race')}</h3>${raceHtml}</div>
  <div><h3 style="color:#8888aa;margin-bottom:10px">${t('cls')}</h3>${classHtml}</div>
  <div><h3 style="color:#8888aa;margin-bottom:10px">${lang === 'zh' ? '模式' : 'Mode'}</h3>${modeHtml}</div></div>
  <div style="display:flex;gap:10px;align-items:center">
  <button class="menu-btn" id="start-btn" style="margin-top:10px">${t('begin')}</button>
  <button class="menu-btn" id="char-back-btn" style="margin-top:10px;border-color:#888;color:#888">${lang === 'zh' ? '← 返回' : '← Back'}</button>
  </div>`;
  document.body.appendChild(ov);
  ov.querySelectorAll('.race-opt').forEach((el: any) => {
    el.onclick = () => {
      selRace = parseInt(el.dataset.idx);
      ov.querySelectorAll('.race-opt').forEach((e: any, i: number) => { e.style.borderColor = i === selRace ? '#e63946' : '#333'; e.style.color = i === selRace ? '#ddd' : '#888'; });
    };
  });
  ov.querySelectorAll('.class-opt').forEach((el: any) => {
    el.onclick = () => {
      selCls = parseInt(el.dataset.idx);
      ov.querySelectorAll('.class-opt').forEach((e: any, i: number) => { e.style.borderColor = i === selCls ? '#e63946' : '#333'; e.style.color = i === selCls ? '#ddd' : '#888'; });
    };
  });
  ov.querySelectorAll('.mode-opt').forEach((el: any) => {
    el.onclick = () => {
      selMode = parseInt(el.dataset.idx);
      ov.querySelectorAll('.mode-opt').forEach((e: any, i: number) => { e.style.borderColor = i === selMode ? '#e63946' : '#333'; e.style.color = i === selMode ? '#ddd' : '#888'; });
    };
  });
  document.getElementById('start-btn')!.onclick = () => {
    ov.remove();
    document.getElementById('game-container')!.style.display = 'flex';
    initAudio();
    initGame(selRace, selCls, selMode === 1);
    resizeCanvas();
    startParticles();
    updateUI();
    render();
  };
  document.getElementById('char-back-btn')!.onclick = () => {
    ov.remove();
    document.getElementById('title-screen')!.style.display = 'flex';
    initTitleParticles();
  };
}

function returnToTitle(): void {
  document.getElementById('death-screen')!.style.display = 'none';
  document.getElementById('victory-screen')!.style.display = 'none';
  document.getElementById('game-container')!.style.display = 'none';
  document.getElementById('title-screen')!.style.display = 'flex';
  setGameState(null);
  stopParticles();
  setBgmScene('title');
  initTitleParticles();
}

// ===== Bind HTML buttons =====
function bindButtons(): void {
  const on = (id: string, fn: () => void) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  };

  on('btn-new', startNewGame);
  on('btn-cont', loadGame);
  on('btn-forge', () => { showOverlay('forge-overlay'); renderForge(); });
  on('btn-help', () => { setHelpOpen(true); showOverlay('help-overlay'); bridge.renderHelp?.(); });
  on('lang-btn', toggleLang);

  on('btn-close-inv', () => { setInvOpen(false); hideOverlay('inventory-overlay'); });
  on('btn-close-help', () => { setHelpOpen(false); hideOverlay('help-overlay'); });
  on('btn-close-skill', () => { setSkillOpen(false); hideOverlay('skill-overlay'); });
  on('btn-close-ach', () => { setAchOpen(false); hideOverlay('achievement-overlay'); });
  on('btn-close-talent', () => { setTalentOpen(false); hideOverlay('talent-overlay'); });
  on('btn-close-forge', () => { hideOverlay('forge-overlay'); });
  on('btn-records', () => { showOverlay('records-overlay'); renderRecords(); });
  on('btn-close-records', () => { hideOverlay('records-overlay'); });
  on('btn-codex', () => { showOverlay('codex-overlay'); renderCodex(); });
  on('btn-close-codex', () => { hideOverlay('codex-overlay'); });
  on('btn-ending-slay', () => resolveEnding('slay'));
  on('btn-ending-refuse', () => resolveEnding('refuse'));
  on('btn-back-title', () => {
    if (G && !G.gameOver) {
      // Confirm before leaving an active game
      const zh = lang === 'zh';
      if (confirm(zh ? '确定要返回标题画面吗？当前进度将丢失。' : 'Return to title? Current progress will be lost.')) {
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
  applyZoom();
  applySafe();
  applyReducedMotion();
  applyTextScale();
  applyColorblind();
  applyBarCues();
  applyAudioUI();
  initTitleParticles();
  bindButtons();
  initInput();
  initTouchControls();
  initTooltip();

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
