// Settings UI: language, sound, zoom, safe-zone, reduced-motion, minimap zoom.
// Extracted from main.ts (Polish-B Q6). Pure relocation — function bodies verbatim.
import { G, lang, muted, setLang, setMuted, uiZoom, setUiZoom, minimapScale, setMinimapScale, legendVisible, safeZone, setSafeZone, reducedMotion, setReducedMotion } from './state.js';
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
  $('title-h1')!.textContent = lang === 'zh' ? '暗 渊 深 处' : 'DEPTHS OF DARKHOLLOW';
  $('title-h2')!.textContent = t('titleH2');
  $('btn-new')!.textContent = t('btnNew'); $('btn-cont')!.textContent = t('btnCont'); $('btn-help')!.textContent = t('btnHelp');
  $('btn-forge')!.textContent = t('forgeBtn');
  $('btn-records')!.textContent = lang === 'zh' ? '📋 记录' : '📋 Records';
  $('btn-codex')!.textContent = lang === 'zh' ? '📜 典籍' : '📜 Codex';
  $('lang-btn')!.textContent = lang === 'en' ? '中文' : 'EN';
  $('sb-hero')!.textContent = '⚔ ' + t('hero'); $('sb-nl')!.textContent = t('name'); $('sb-rl')!.textContent = t('race');
  $('sb-cl')!.textContent = t('cls'); $('sb-lv')!.textContent = t('level');
  $('sb-gl')!.textContent = t('gold'); $('sb-fl')!.textContent = t('floor'); $('sb-tl')!.textContent = t('turns');
  $('sb-co')!.textContent = t('combo'); $('sb-eq')!.textContent = '🛡 ' + t('equip');
  $('sb-wp')!.textContent = t('weapon'); $('sb-ar')!.textContent = t('armor'); $('sb-ac')!.textContent = t('accessory'); $('sb-ac2')!.textContent = t('accessory');
  $('sb-ef')!.textContent = '✨ ' + t('effects');
  $('inv-title')!.textContent = t('inventory'); $('help-title')!.textContent = t('howToPlay');
  $('sk-title')!.textContent = t('skills'); $('ach-title')!.textContent = t('achievements');
  $('forge-title')!.textContent = t('forgeTitle'); $('forge-se-label')!.textContent = t('soulEchoes');
  $('btn-back-title')!.textContent = '← ' + (lang === 'zh' ? '标题画面' : 'Title');
  $('death-h1')!.textContent = t('deathH1'); $('vic-sub')!.textContent = t('victorySub');
  $('btn-try-again')!.textContent = t('tryAgain'); $('btn-death-title')!.textContent = t('titleScreen');
  $('btn-play-again')!.textContent = t('playAgain'); $('btn-vic-title')!.textContent = t('titleScreen');
  $('title-hint')!.innerHTML = lang === 'zh'
    ? '<span>WASD/方向键</span> 移动 · <span>1-9</span> 快捷道具 · <span>B</span> 背包 · <span>G</span> 拾取 · <span>&gt;</span> 下楼 · <span>K</span> 技能 · <span>F</span> 等待 · <span>Ctrl+S</span> 保存'
    : '<span>WASD/Arrows</span> move · <span>1-9</span> quick items · <span>B</span> inventory · <span>G</span> pickup · <span>&gt;</span> descend · <span>K</span> skill · <span>F</span> wait · <span>Ctrl+S</span> save';
  $('sb-legend')!.innerHTML = '🗺 ' + t('legendToggle') + ' <span id="legend-arrow">' + (legendVisible ? '▲' : '▼') + '</span>';
  $('obj-label')!.textContent = lang === 'zh' ? '游戏目标' : 'Objective';
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
  bridge.muted = muted;
  updateLangUI();
  if (G) addMsg(t('langChanged'), 'mi');
}

// ===== Sound toggle =====
export function toggleSound(): void {
  const newMuted = !isMuted();
  setMutedState(newMuted);            // audio.ts owns the persisted mute state
  setMuted(newMuted);                 // mirror into state.muted for UI reads
  bridge.muted = newMuted;
  updateSoundBtn();
  addMsg(newMuted ? t('muted') : t('unmuted'), 'mi');
}

export function updateSoundBtn(): void {
  const on = document.getElementById('btn-sound');
  const off = document.getElementById('btn-mute');
  if (on && off) {
    if (muted) { on.style.display = 'none'; off.style.display = 'block'; off.classList.add('active'); }
    else { on.style.display = 'block'; on.classList.add('active'); off.style.display = 'none'; }
  }
}

// Sync audio-panel sliders + mute mirror from persisted prefs.
export function applyAudioUI(): void {
  const set = (id: string, v: number) => { const el = document.getElementById(id) as HTMLInputElement | null; if (el) el.value = String(Math.round(v * 100)); };
  set('vol-master', getMasterVol());
  set('vol-music', getMusicVol());
  set('vol-sfx', getSfxVol());
  const m = isMuted();
  setMuted(m);                        // mirror so updateSoundBtn reads correctly
  bridge.muted = m;
  updateSoundBtn();
}

// ===== Zoom =====
// NOTE: adjustZoom is retained verbatim from the pre-split main.ts; the live zoom
// controls now live in options.ts, which has its own slider handling. Kept here so
// the settings module stays cohesive (no behavior change).
function adjustZoom(dir: number): void {
  let newZoom = dir === 0 ? 1 : clamp(+(uiZoom + dir * 0.1).toFixed(1), 0.7, 1.5);
  setUiZoom(newZoom);
  applyZoom();
}

export function applyZoom(): void {
  document.documentElement.style.setProperty('--ui-zoom', String(uiZoom));
  const lbl = document.getElementById('zoom-label');
  if (lbl) lbl.textContent = Math.round(uiZoom * 100) + '%';
}

// ===== Safe zone (accessibility) — mirrors adjustZoom/applyZoom =====
// NOTE: adjustSafe is retained verbatim; live safe-zone controls are in options.ts.
function adjustSafe(dir: number): void {
  const n = dir === 0 ? 16 : clamp(safeZone + dir * 4, 0, 64);
  setSafeZone(n);
  applySafe();
}
export function applySafe(): void {
  document.documentElement.style.setProperty('--safe', safeZone + 'px');
  const lbl = document.getElementById('safe-label');
  if (lbl) lbl.textContent = String(safeZone);
}

// ===== Reduced motion (accessibility) =====
export function applyReducedMotion(): void {
  document.body.classList.toggle('reduced-motion', reducedMotion);
  const btn = document.getElementById('btn-motion');
  if (btn) btn.textContent = (reducedMotion ? '🎞️ On' : '🎞️ Off');
}
// NOTE: toggleReducedMotion is retained verbatim; the live toggle is in options.ts.
function toggleReducedMotion(): void {
  setReducedMotion(!reducedMotion);
  applyReducedMotion();
}

export function minimapZoom(dir: number): void {
  const newScale = clamp(minimapScale + dir, 2, 5);
  setMinimapScale(newScale);
  const c = document.getElementById('minimap-canvas') as HTMLCanvasElement;
  c.width = MW * newScale; c.height = MH * newScale;
  if (G) renderMinimap();
}
