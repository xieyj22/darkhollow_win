// Settings UI: language, sound, minimap zoom.
// Extracted from main.ts (Polish-B Q6). The apply helpers (applyZoom /
// applySafe / applyReducedMotion) and their adjust*/toggle* wrappers used to
// live here as duplicates of options.ts — removed in settings-core Task 1
// (settings.ts now owns the apply dispatch via applyAll()).
import { G, lang, setLang, minimapScale, setMinimapScale, legendVisible } from './state.js';
import { clamp } from './utils.js';
import { t } from './i18n.js';
import { addMsg } from './messages.js';
import { isMuted, setMutedState, getMasterVol, getMusicVol, getSfxVol } from './audio.js';
import { MW, MH } from './config.js';
import { updateUI, renderMinimap } from './render.js';
import { renderOptions } from './options.js';
import { bridge } from './bridge.js';

// ===== i18n UI Update =====

export function updateLangUI(): void {
  const $ = (id: string) => document.getElementById(id);
  $('title-h1')!.textContent = t('us.titleH1Spaced');
  $('title-h2')!.textContent = t('titleH2');
  $('btn-new')!.textContent = t('btnNew'); $('btn-cont')!.textContent = t('btnCont'); $('btn-help')!.textContent = t('btnHelp');
  $('btn-forge')!.textContent = t('forgeBtn');
  $('btn-records')!.textContent = t('us.recordsBtn');
  $('btn-codex')!.textContent = t('us.codexBtn');
  $('lang-btn')!.textContent = t('us.langSwitchTo');
  $('sb-hero')!.textContent = '⚔ ' + t('hero'); $('sb-nl')!.textContent = t('name'); $('sb-rl')!.textContent = t('race');
  $('sb-cl')!.textContent = t('cls'); $('sb-lv')!.textContent = t('level');
  $('sb-gl')!.textContent = t('gold'); $('sb-fl')!.textContent = t('floor'); $('sb-tl')!.textContent = t('turns');
  $('sb-co')!.textContent = t('combo'); $('sb-eq')!.textContent = '🛡 ' + t('equip');
  $('sb-wp')!.textContent = t('weapon'); $('sb-ar')!.textContent = t('armor'); $('sb-ac')!.textContent = t('accessory'); $('sb-ac2')!.textContent = t('accessory');
  $('sb-ef')!.textContent = '✨ ' + t('effects');
  $('inv-title')!.textContent = t('inventory'); $('help-title')!.textContent = t('howToPlay');
  $('sk-title')!.textContent = t('skills'); $('ach-title')!.textContent = t('achievements');
  $('forge-title')!.textContent = t('forgeTitle'); $('forge-se-label')!.textContent = t('soulEchoes');
  $('btn-back-title')!.textContent = '← ' + t('us.backToTitle');
  $('death-h1')!.textContent = t('deathH1'); $('vic-sub')!.textContent = t('victorySub');
  $('btn-try-again')!.textContent = t('tryAgain'); $('btn-death-title')!.textContent = t('titleScreen');
  $('btn-play-again')!.textContent = t('playAgain'); $('btn-vic-title')!.textContent = t('titleScreen');
  $('title-hint')!.innerHTML = t('us.titleHint');
  $('sb-legend')!.innerHTML = '🗺 ' + t('legendToggle') + ' <span id="legend-arrow">' + (legendVisible ? '▲' : '▼') + '</span>';
  $('obj-label')!.textContent = t('us.objective');
  $('keys-toggle')!.textContent = t('keysToggle');
  $('pause-title')!.textContent = t('pauseTitle');
  $('btn-pause-resume')!.textContent = t('pauseResume');
  $('btn-pause-settings')!.textContent = t('pauseSettings');
  $('btn-pause-quit')!.textContent = t('pauseQuit');
  $('opt-title')!.textContent = t('optionsTitle');
  $('btn-options')!.textContent = '⚙ ' + t('options');
  $('btn-options-title')!.textContent = t('options');
  if (document.getElementById('options-overlay')?.classList.contains('active')) renderOptions();
  if (G) updateUI();
}

export function toggleLang(): void {
  const newLang = lang === 'en' ? 'zh' : 'en';
  setLang(newLang);
  bridge.muted = isMuted();
  updateLangUI();
  if (G) addMsg(t('langChanged'), 'mi');
}

// ===== Sound toggle =====
export function toggleSound(): void {
  const newMuted = !isMuted();
  setMutedState(newMuted);            // audio.ts owns the persisted mute state
  bridge.muted = newMuted;
  updateSoundBtn();
  addMsg(newMuted ? t('muted') : t('unmuted'), 'mi');
}

export function updateSoundBtn(): void {
  const on = document.getElementById('btn-sound');
  const off = document.getElementById('btn-mute');
  if (on && off) {
    if (isMuted()) { on.style.display = 'none'; off.style.display = 'block'; off.classList.add('active'); }
    else { on.style.display = 'block'; on.classList.add('active'); off.style.display = 'none'; }
  }
}

// Sync audio-panel sliders + bridge.muted from persisted prefs.
export function applyAudioUI(): void {
  const set = (id: string, v: number) => { const el = document.getElementById(id) as HTMLInputElement | null; if (el) el.value = String(Math.round(v * 100)); };
  set('vol-master', getMasterVol());
  set('vol-music', getMusicVol());
  set('vol-sfx', getSfxVol());
  const m = isMuted();
  bridge.muted = m;                   // render.ts reads this for the sound icon
  updateSoundBtn();
}

// ===== Minimap zoom (live controls are in options.ts; this handles the
// sidebar +/- buttons which call minimapZoom directly) =====
export function minimapZoom(dir: number): void {
  const newScale = clamp(minimapScale + dir, 2, 5);
  setMinimapScale(newScale);
  const c = document.getElementById('minimap-canvas') as HTMLCanvasElement;
  c.width = MW * newScale; c.height = MH * newScale;
  if (G) renderMinimap();
}
