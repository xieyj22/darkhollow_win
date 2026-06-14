// Localized fonts — replaces the Google Fonts @import so the game runs fully offline.
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';

// Main entry point — wires all modules together
import { G, setGameState, setLang, lang, setMuted, muted, setUiZoom, uiZoom, setMinimapScale, minimapScale, setLegendVisible, legendVisible, setKeysVisible, keysVisible, setInvOpen, setHelpOpen, setSkillOpen, setAchOpen, setTalentOpen } from './state.js';
import { MH, MW, FOV, MAX_INV, FINAL, TL, TS } from './config.js';
import { rng, pick, clamp, dst, darken } from './utils.js';
import { L, t, tMsg, rareName, itemName, RARITY_C } from './i18n.js';
import { RACES, CLASSES, WEAPONS, ARMORS, ACCESSORIES, POTIONS, SCROLLS, CONSUMABLES, TRAPS, ELITE_PREFIX, ENEMIES, BOSSES, ACH_DEFS, TALENT_TREES } from './data.js';
import { initAudio, getAudioContext, snd } from './audio.js';
import { flt, shake } from './effects.js';
import { genDungeon, computeFOV } from './dungeon.js';
import { addMsg } from './messages.js';
import { attack, checkLevelUp, recalc, playerDeath, playerVictory, checkAch, checkAchs, setGenItemFn as setCombatGenItem, killEnemy } from './combat.js';
import { genItem, genWeapon, genArmor, genAcc, genPotion, genScroll, genFood, genConsumable, useItem, equipItem, quickQuaff, quickRead, renderHotbar, useQuickSlot, addItemWithOverflow, setEndTurnFn as setItemsEndTurn, setFindNearestEnemyFn } from './items.js';
import { spawnEnemies, processEnemies, checkPlayerTraps } from './enemies.js';
import { findNearestEnemy, executeSkill, setEndTurnFn as setSkillsEndTurn } from './skills.js';
import { maybeEvent, showEvent, closeEvent, checkTraps, checkTiles } from './events.js';
import { createPlayer, movePlayer, pickupItem, descendStairs, doWait, setEndTurnFn as setPlayerEndTurn, setEnterFloorFn } from './player.js';
import { endTurn, setPlayerDeathFn } from './turn.js';
import { initGame, enterFloor } from './game.js';
import { render, renderMinimap, resizeCanvas, updateUI, markMinimapDirty } from './render.js';
import { initInput, initTouchControls } from './input.js';
import { saveGame, loadGame } from './save.js';
import { renderForge, renderTitleStats } from './meta.js';
import { startParticles, stopParticles } from './particles.js';

// ===== Wire up late-bound dependencies =====
setCombatGenItem(genItem);
setItemsEndTurn(endTurn);
setFindNearestEnemyFn(findNearestEnemy);
setSkillsEndTurn(endTurn);
setPlayerEndTurn(endTurn);
setEnterFloorFn(enterFloor);
setPlayerDeathFn(playerDeath);

// Expose to window for cross-module access
(window as any).__initAudio = initAudio;
(window as any).__muted = muted;
(window as any).__CLASSES = CLASSES;
(window as any).__ACH_DEFS = ACH_DEFS;
(window as any).__TALENT_TREES = TALENT_TREES;
(window as any).__recalc = recalc;
(window as any).__renderHotbar = renderHotbar;
(window as any).__updateUI = updateUI;
(window as any).__render = render;
(window as any).__markMinimapDirty = markMinimapDirty;
(window as any).__toggleLang = toggleLang;
(window as any).__toggleSound = toggleSound;

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
    return `<div class="class-opt" data-idx="${i}" style="padding:8px 15px;margin:4px 0;cursor:pointer;border:1px solid ${i === 0 ? '#e63946' : '#333'};border-radius:3px;color:${i === 0 ? '#ddd' : '#888'}"><b>${cn}</b> <span style="color:#666;font-size:.9em">${cd}</span></div>`;
  }).join('');
  ov.innerHTML = `<h2 style="color:#e63946;margin-bottom:20px;font-size:1.8em">${t('createHero')}</h2>
  <div style="display:flex;gap:30px;margin-bottom:20px;flex-wrap:wrap;justify-content:center">
  <div><h3 style="color:#8888aa;margin-bottom:10px">${t('race')}</h3>${raceHtml}</div>
  <div><h3 style="color:#8888aa;margin-bottom:10px">${t('cls')}</h3>${classHtml}</div></div>
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
  document.getElementById('start-btn')!.onclick = () => {
    ov.remove();
    document.getElementById('game-container')!.style.display = 'flex';
    initAudio();
    initGame(selRace, selCls);
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
  initTitleParticles();
}

// ===== i18n UI Update =====

function updateLangUI(): void {
  const $ = (id: string) => document.getElementById(id);
  $('title-h1')!.textContent = lang === 'zh' ? '暗 渊 深 处' : 'DEPTHS OF DARKHOLLOW';
  $('title-h2')!.textContent = t('titleH2');
  $('btn-new')!.textContent = t('btnNew'); $('btn-cont')!.textContent = t('btnCont'); $('btn-help')!.textContent = t('btnHelp');
  $('btn-forge')!.textContent = t('forgeBtn');
  $('lang-btn')!.textContent = lang === 'en' ? '中文' : 'EN';
  $('sb-hero')!.textContent = '⚔ ' + t('hero'); $('sb-nl')!.textContent = t('name'); $('sb-rl')!.textContent = t('race');
  $('sb-cl')!.textContent = t('cls'); $('sb-lv')!.textContent = t('level'); $('sb-stat')!.textContent = '📊 ' + t('stats');
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
  $('sb-obj')!.textContent = '🎯 ' + (lang === 'zh' ? '游戏目标' : 'Objective');
  $('keys-toggle')!.textContent = t('keysToggle');
  if (G) updateUI();
}

function toggleLang(): void {
  const newLang = lang === 'en' ? 'zh' : 'en';
  setLang(newLang);
  (window as any).__muted = muted;
  updateLangUI();
  if (G) addMsg(t('langChanged'), 'mi');
}

// ===== Sound toggle =====
function toggleSound(): void {
  const newMuted = !muted;
  setMuted(newMuted);
  (window as any).__muted = newMuted;
  updateSoundBtn();
  addMsg(newMuted ? t('muted') : t('unmuted'), 'mi');
}

function updateSoundBtn(): void {
  const on = document.getElementById('btn-sound');
  const off = document.getElementById('btn-mute');
  if (on && off) {
    if (muted) { on.style.display = 'none'; off.style.display = 'block'; off.classList.add('active'); }
    else { on.style.display = 'block'; on.classList.add('active'); off.style.display = 'none'; }
  }
}

// ===== Zoom =====
function adjustZoom(dir: number): void {
  let newZoom = dir === 0 ? 1 : clamp(+(uiZoom + dir * 0.1).toFixed(1), 0.7, 1.5);
  setUiZoom(newZoom);
  applyZoom();
}

function applyZoom(): void {
  document.documentElement.style.setProperty('--ui-zoom', String(uiZoom));
  const lbl = document.getElementById('zoom-label');
  if (lbl) lbl.textContent = Math.round(uiZoom * 100) + '%';
}

function minimapZoom(dir: number): void {
  const newScale = clamp(minimapScale + dir, 2, 5);
  setMinimapScale(newScale);
  const c = document.getElementById('minimap-canvas') as HTMLCanvasElement;
  c.width = MW * newScale; c.height = MH * newScale;
  if (G) renderMinimap();
}

// ===== Legend toggle =====
function toggleLegend(): void {
  const newVis = !legendVisible;
  setLegendVisible(newVis);
  const panel = document.getElementById('legend-panel')!;
  const arrow = document.getElementById('legend-arrow')!;
  panel.style.display = newVis ? 'block' : 'none';
  arrow.textContent = newVis ? '▲' : '▼';
  if (newVis) renderLegend();
}

function renderLegend(): void {
  const zh = lang === 'zh';
  const items = [
    { ch: '#', c: '#555', t: zh ? '墙壁' : 'Wall' }, { ch: '·', c: '#444', t: zh ? '地面' : 'Floor' },
    { ch: '>', c: '#7ec8e3', t: zh ? '楼梯' : 'Stairs' }, { ch: '≈', c: '#1a5276', t: zh ? '水域' : 'Water' },
    { ch: '*', c: '#ff4500', t: zh ? '岩浆(伤血)' : 'Lava (dmg)' }, { ch: '~', c: '#00ced1', t: zh ? '深渊水' : 'Abyss Water' },
    { ch: 'Ø', c: '#4895ef', t: zh ? '喷泉' : 'Fountain' }, { ch: '♦', c: '#06d6a0', t: zh ? '神殿' : 'Shrine' },
    { ch: '^', c: '#f4845f', t: zh ? '陷阱' : 'Trap' }, { ch: '@', c: '#ffd700', t: zh ? '玩家' : 'You' },
    { ch: 'g', c: '#228b22', t: zh ? '敌人' : 'Enemy' }, { ch: '★', c: '#ffd700', t: zh ? 'Boss' : 'Boss' },
    { ch: '♥', c: '#e63946', t: zh ? '药水' : 'Potion' }, { ch: '☀', c: '#9b5de5', t: zh ? '卷轴' : 'Scroll' },
    { ch: '†', c: '#f4845f', t: zh ? '武器' : 'Weapon' }, { ch: '▣', c: '#7ec8e3', t: zh ? '护甲' : 'Armor' },
    { ch: '◯', c: '#daa520', t: zh ? '食物' : 'Food' }, { ch: '$', c: '#ffd700', t: zh ? '金币' : 'Gold' },
    { ch: '○', c: '#06d6a0', t: zh ? '饰品' : 'Accessory' },
  ];
  document.getElementById('legend-panel')!.innerHTML =
    `<div class="legend-items">${items.map(i => `<div class="legend-item"><span class="ls" style="color:${i.c}">${i.ch}</span><span class="ld">${i.t}</span></div>`).join('')}</div>`;
}

// ===== Keys toggle =====
function toggleKeys(): void {
  const newVis = !keysVisible;
  setKeysVisible(newVis);
  document.getElementById('keys-panel')!.style.display = newVis ? 'block' : 'none';
  document.getElementById('keys-toggle')!.style.display = newVis ? 'none' : 'block';
  if (newVis) renderKeyHints();
}

function renderKeyHints(): void {
  const zh = lang === 'zh';
  const pairs = [
    { k: 'WASD', t: zh ? '移动' : 'Move' }, { k: '1-9', t: zh ? '快捷道具' : 'Quick Item' },
    { k: 'G', t: zh ? '拾取' : 'Pickup' }, { k: '>', t: zh ? '下楼' : 'Descend' },
    { k: 'B', t: zh ? '背包' : 'Inv' }, { k: 'K', t: zh ? '技能' : 'Skill' },
    { k: 'T', t: zh ? '成就' : 'Achv' }, { k: 'Q', t: zh ? '喝药' : 'Quaff' },
    { k: 'R', t: zh ? '读卷' : 'Read' }, { k: 'F', t: zh ? '等待' : 'Wait' },
    { k: 'L', t: zh ? '语言' : 'Lang' }, { k: 'M', t: zh ? '静音' : 'Mute' },
  ];
  document.getElementById('keys-panel')!.innerHTML =
    `<div class="keys-hdr"><span>⌨ ${zh ? '键位' : 'Keys'}</span><button class="keys-x" onclick="document.getElementById('keys-panel').style.display='none';document.getElementById('keys-toggle').style.display='block'">✕</button></div><div class="keys-g">${pairs.map(p => `<span class="kk">${p.k}</span><span class="kd">${p.t}</span>`).join('')}</div>`;
}

// ===== Tooltip =====
function initTooltip(): void {
  const gameCanvas = document.getElementById('game-canvas')!;
  gameCanvas.addEventListener('mousemove', (e: MouseEvent) => {
    if (!G) return;
    const g = G; // narrow type for closure
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const cvs = (window as any).__canvas as HTMLCanvasElement;
    const effectiveTS = cvs ? rect.width / (cvs.width / TS) : TS;
    const mx = Math.floor((e.clientX - rect.left) / effectiveTS) + g.vx;
    const my = Math.floor((e.clientY - rect.top) / effectiveTS) + g.vy;
    const enemy = g.enemies.find(en => en.x === mx && en.y === my && g.player.visible?.[my]?.[mx]);
    const item = g.items.find(it => it.x === mx && it.y === my && g.player.visible?.[my]?.[mx] && dst(g.player.x, g.player.y, it.x, it.y) <= 3);
    const trap = g.traps ? g.traps.find(tr => tr.x === mx && tr.y === my && !tr.triggered && !tr.hidden && g.player.visible?.[my]?.[mx]) : null;
    const tile = mx >= 0 && mx < MW && my >= 0 && my < MH ? g.dungeon.map[my][mx] : null;
    const tt = document.getElementById('tooltip')!;
    if (enemy) {
      tt.style.display = 'block'; tt.style.left = (e.clientX + 15) + 'px'; tt.style.top = (e.clientY + 15) + 'px';
      tt.style.borderColor = enemy.c + '66';
      tt.innerHTML = `<div class="ttn" style="color:${enemy.c}">◆ ${enemy.name}${enemy.isBoss ? ' ★BOSS' : ''}${enemy.isElite ? ' ⚡' : ''}${enemy.isAlly ? ' (Ally)' : ''}</div><div class="ttd">HP:${enemy.hp}/${enemy.maxHp} ATK:${enemy.atk} DEF:${enemy.def}</div>`;
    } else if (item) {
      tt.style.display = 'block'; tt.style.left = (e.clientX + 15) + 'px'; tt.style.top = (e.clientY + 15) + 'px';
      tt.style.borderColor = RARITY_C[item.rarity] + '66';
      tt.innerHTML = `<div class="ttn" style="color:${RARITY_C[item.rarity]}">◆ ${item.name} [${rareName(item.rarity)}]</div><div class="ttd">${item.desc}</div>`;
    } else if (trap) {
      tt.style.display = 'block'; tt.style.left = (e.clientX + 15) + 'px'; tt.style.top = (e.clientY + 15) + 'px';
      tt.style.borderColor = trap.c + '66';
      tt.innerHTML = `<div class="ttn" style="color:${trap.c}">◆ ${lang === 'zh' ? trap.n.zh : trap.n.en}</div><div class="ttd">${trap.dmg > 0 ? '-' + trap.dmg + 'HP' : ''}</div>`;
    } else if (tile === TL.FOUNTAIN) {
      tt.style.display = 'block'; tt.style.left = (e.clientX + 15) + 'px'; tt.style.top = (e.clientY + 15) + 'px';
      tt.style.borderColor = '#4895ef44';
      tt.innerHTML = `<div class="ttn" style="color:#4895ef">◆ ${lang === 'zh' ? '魔法喷泉' : 'Magic Fountain'}</div><div class="ttd">${lang === 'zh' ? '踩上去恢复' : 'Step to heal'}</div>`;
    } else if (tile === TL.SHRINE) {
      tt.style.display = 'block'; tt.style.left = (e.clientX + 15) + 'px'; tt.style.top = (e.clientY + 15) + 'px';
      tt.style.borderColor = '#06d6a044';
      tt.innerHTML = `<div class="ttn" style="color:#06d6a0">◆ ${lang === 'zh' ? '古代神殿' : 'Ancient Shrine'}</div><div class="ttd">${lang === 'zh' ? '踩上去强化' : 'Step for boost'}</div>`;
    } else if (tile === TL.STAIR) {
      tt.style.display = 'block'; tt.style.left = (e.clientX + 15) + 'px'; tt.style.top = (e.clientY + 15) + 'px';
      tt.style.borderColor = '#7ec8e344';
      tt.innerHTML = `<div class="ttn" style="color:#7ec8e3">◆ ${lang === 'zh' ? '下楼楼梯' : 'Stairs Down'}</div><div class="ttd">${lang === 'zh' ? '按>下楼' : 'Press >'}</div>`;
    } else {
      tt.style.display = 'none';
      tt.style.borderColor = '';
    }
  });
  gameCanvas.addEventListener('mouseleave', () => { document.getElementById('tooltip')!.style.display = 'none'; });
}

// ===== Overlay Animation Helpers =====
export function showOverlay(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'flex';
  requestAnimationFrame(() => el.classList.add('active'));
}
export function hideOverlay(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('active');
  setTimeout(() => { if (!el.classList.contains('active')) el.style.display = 'none'; }, 200);
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
  on('btn-help', () => { setHelpOpen(true); showOverlay('help-overlay'); (window as any).__renderHelp?.(); });
  on('lang-btn', toggleLang);

  on('btn-close-inv', () => { setInvOpen(false); hideOverlay('inventory-overlay'); });
  on('btn-close-help', () => { setHelpOpen(false); hideOverlay('help-overlay'); });
  on('btn-close-skill', () => { setSkillOpen(false); hideOverlay('skill-overlay'); });
  on('btn-close-ach', () => { setAchOpen(false); hideOverlay('achievement-overlay'); });
  on('btn-close-talent', () => { setTalentOpen(false); hideOverlay('talent-overlay'); });
  on('btn-close-forge', () => { hideOverlay('forge-overlay'); });
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
  on('btn-zoom-out', () => adjustZoom(-1));
  on('zoom-label', () => adjustZoom(0));
  on('btn-zoom-in', () => adjustZoom(1));
  on('btn-mm-out', () => minimapZoom(-1));
  on('btn-mm-in', () => minimapZoom(1));

  document.getElementById('sb-legend')!.addEventListener('click', toggleLegend);
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
  initTitleParticles();
  bindButtons();
  initInput();
  initTouchControls();
  initTooltip();

  window.addEventListener('resize', () => {
    const c = document.getElementById('title-particles') as HTMLCanvasElement;
    if (c) { c.width = window.innerWidth; c.height = window.innerHeight; }
    if (G) { resizeCanvas(); render(); }
  });
});
