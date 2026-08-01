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

// ===== Legend toggle =====
export function toggleLegend(): void {
  const newVis = !legendVisible;
  setLegendVisible(newVis);
  const panel = document.getElementById('legend-panel')!;
  const arrow = document.getElementById('legend-arrow')!;
  panel.style.display = newVis ? 'block' : 'none';
  arrow.textContent = newVis ? '▲' : '▼';
  if (newVis) renderLegend();
}

// ===== Objective toggle =====
export function toggleObjective(): void {
  const panel = document.getElementById('objective-panel')!;
  const arrow = document.getElementById('obj-arrow')!;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  arrow.textContent = open ? '▸' : '▼';
}

function renderLegend(): void {
  const zh = lang === 'zh';
  const charItems = [
    { ch: '#', c: '#666', t: zh ? '墙壁' : 'Wall' }, { ch: '·', c: '#555', t: zh ? '地面' : 'Floor' },
    { ch: '+', c: '#8b4513', t: zh ? '门' : 'Door' }, { ch: '≈', c: '#1a5276', t: zh ? '水域' : 'Water' },
    { ch: '*', c: '#ff4500', t: zh ? '岩浆(伤血)' : 'Lava (dmg)' }, { ch: '~', c: '#00ced1', t: zh ? '深渊水' : 'Abyss Water' },
  ];
  const spr: Array<[string, string, string]> = [
    ['STAIR', '#7ec8e3', zh ? '楼梯' : 'Stairs'],
    ['WARRIOR', '#ffd700', zh ? '玩家' : 'You'],
    ['GOBLIN', '#228b22', zh ? '敌人' : 'Enemy'],
    ['BOSS', '#ffd700', zh ? 'Boss' : 'Boss'],
    ['DRAGON', '#ff6347', zh ? '飞龙' : 'Dragon'],
    ['GOLEM', '#696969', zh ? '魔像' : 'Golem'],
    ['WRAITH', '#4682b4', zh ? '怨灵' : 'Wraith'],
    ['ELEMENTAL', '#ff4500', zh ? '元素' : 'Elemental'],
    ['CULTIST', '#8b0000', zh ? '信徒' : 'Cultist'],
    ['W_SWORD', '#f4845f', zh ? '武器' : 'Weapon'],
    ['I_SHIELD', '#7ec8e3', zh ? '护甲' : 'Armor'],
    ['I_RING', '#daa520', zh ? '饰品' : 'Accessory'],
    ['P_HEALTH', '#e63946', zh ? '药水' : 'Potion'],
    ['I_SCROLL', '#9b5de5', zh ? '卷轴' : 'Scroll'],
    ['I_FOOD', '#f4845f', zh ? '食物' : 'Food'],
    ['I_GOLD', '#ffd700', zh ? '金币' : 'Gold'],
    ['FOUNTAIN', '#4895ef', zh ? '喷泉' : 'Fountain'],
    ['SHRINE', '#06d6a0', zh ? '神殿' : 'Shrine'],
    ['TRAP', '#a0522d', zh ? '陷阱' : 'Trap'],
  ];
  const panel = document.getElementById('legend-panel')!;
  panel.innerHTML = `<div class="legend-items">` +
    charItems.map(i => `<div class="legend-item"><span class="ls" style="color:${i.c}">${i.ch}</span><span class="ld">${i.t}</span></div>`).join('') +
    spr.map(([k, c, t]) => `<div class="legend-item"><canvas class="lic" width="16" height="16" data-kind="${k}" data-color="${c}"></canvas><span class="ld">${t}</span></div>`).join('') +
    `</div>`;
  panel.querySelectorAll<HTMLCanvasElement>('canvas.lic').forEach(cv => paintIcon(cv, cv.dataset.kind || 'GOBLIN', cv.dataset.color || '#ccc'));
}

// ===== Keys toggle =====
export function toggleKeys(): void {
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
  const tt = document.getElementById('tooltip')!;
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;

  const showTooltip = (e: MouseEvent) => {
    if (!G) return;
    const g = G; // narrow type for closure
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const cvs = bridge.canvas as HTMLCanvasElement;
    const effectiveTS = cvs ? rect.width / (cvs.width / TS) : TS;
    const mx = Math.floor((e.clientX - rect.left) / effectiveTS) + g.vx;
    const my = Math.floor((e.clientY - rect.top) / effectiveTS) + g.vy;
    const enemy = g.enemies.find(en => en.x === mx && en.y === my && g.player.visible?.[my]?.[mx]);
    const item = g.items.find(it => it.x === mx && it.y === my && g.player.visible?.[my]?.[mx] && dst(g.player.x, g.player.y, it.x, it.y) <= 3);
    const trap = g.traps ? g.traps.find(tr => tr.x === mx && tr.y === my && !tr.triggered && !tr.hidden && g.player.visible?.[my]?.[mx]) : null;
    const tile = mx >= 0 && mx < MW && my >= 0 && my < MH ? g.dungeon.map[my][mx] : null;
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
  };

  gameCanvas.addEventListener('mousemove', (e: MouseEvent) => {
    if (!G) return;
    // Debounce so the tooltip doesn't flicker while sweeping the mouse across tiles
    if (hoverTimer) clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => { hoverTimer = null; showTooltip(e); }, 250);
  });
  gameCanvas.addEventListener('mouseleave', () => {
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
    tt.style.display = 'none';
    tt.style.borderColor = '';
  });
}

// ===== Overlay Animation Helpers =====
let lastFocused: HTMLElement | null = null;
export function showOverlay(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  lastFocused = document.activeElement as HTMLElement;
  el.style.display = 'flex';
  el.tabIndex = -1; // allow programmatic focus as a fallback target
  requestAnimationFrame(() => {
    el.classList.add('active');
    // Move focus into the panel — prefer the close button, else first focusable, else the panel.
    const target = el.querySelector<HTMLElement>('.close-btn')
      || el.querySelector<HTMLElement>('button,[tabindex="0"]');
    (target || el).focus();
  });
}
export function hideOverlay(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('active');
  setTimeout(() => { if (!el.classList.contains('active')) el.style.display = 'none'; }, 200);
  // Restore focus to whatever opened the overlay
  if (lastFocused) { try { lastFocused.focus(); } catch { /* element may be gone */ } lastFocused = null; }
}

// ===== Pause menu (in-game ESC / Start) =====
function openPause(): void {
  if (!G || G.gameOver) return;
  setMenuOpen(true);
  showOverlay('pause-overlay');
}
function closePause(): void {
  setMenuOpen(false);
  hideOverlay('pause-overlay');
}

// ===== Records / Leaderboard (Wave 7b) =====
function renderRecords(): void {
  const zh = lang === 'zh';
  const m = getMeta();
  const cls = (i: number) => { const c = CLASSES[i]; return c ? (zh ? c.name.zh : c.name.en) : '?'; };
  const row = (cols: string[], color = '#ccc') =>
    `<div style="display:flex;gap:8px;padding:3px 6px;border-bottom:1px solid #1c1c1c;color:${color};font-size:.88em">${cols.map(c => `<span style="flex:1">${c}</span>`).join('')}</div>`;
  const hdr = (cols: string[]) => row(cols, '#777');
  const hist = m.runHistory.length
    ? m.runHistory.map(r => row([r.mode === 'endless' ? '♾' : '◐', cls(r.classIdx), `F${r.floor}`, `${r.kills}${zh ? '杀' : 'k'}`, r.result === 'win' ? '🏆' : '💀'], r.result === 'win' ? '#ffd700' : '#e63946')).join('')
    : `<div style="color:#555;padding:8px">${zh ? '暂无记录' : 'No runs yet'}</div>`;
  const lb = m.endlessLeaderboard.length
    ? m.endlessLeaderboard.map((r, i) => row([`#${i + 1}`, cls(r.classIdx), `F${r.floor}`, `${r.kills}${zh ? '杀' : 'k'}`], i === 0 ? '#ffd700' : '#999')).join('')
    : `<div style="color:#555;padding:8px">${zh ? '暂无无尽记录' : 'No endless runs'}</div>`;
  (document.getElementById('records-content')!).innerHTML =
    `<div style="color:#888;margin:6px 2px;font-size:.95em">🕐 ${zh ? '最近 20 局' : 'Recent Runs'}</div>` +
    hdr([zh ? '模式' : 'Mode', zh ? '职业' : 'Class', zh ? '楼层' : 'Floor', zh ? '击杀' : 'Kills', zh ? '结果' : 'Result']) + hist +
    `<div style="color:#888;margin:14px 2px 6px;font-size:.95em">♾ ${zh ? '无尽排行榜 · Top 10' : 'Endless Leaderboard · Top 10'}</div>` +
    hdr([zh ? '排名' : 'Rank', zh ? '职业' : 'Class', zh ? '最深' : 'Deepest', zh ? '击杀' : 'Kills']) + lb;
  (document.getElementById('records-title')!).textContent = zh ? '📋 游戏记录' : '📋 Records';
}

// ===== Lore Codex (Wave 8) — clones the records-overlay pattern =====
function renderCodex(): void {
  const zh = lang === 'zh';
  const unlocked = new Set(getMeta().unlockedLore);
  const sections = LORE_CATS.map(cat => {
    const rows = LORE_ENTRIES.filter(e => e.cat === cat.id).map(e => {
      const has = unlocked.has(e.id);
      const name = has ? (zh ? e.n.zh : e.n.en) : '🔒 ???';
      const body = has ? (zh ? e.body.zh : e.body.en) : (zh ? '尚未发现。继续下探以解锁。' : 'Not yet discovered. Descend further to uncover.');
      return `<div style="padding:8px 10px;margin:4px 0;border-left:3px solid ${has ? '#9a2be2' : '#333'};background:rgba(255,255,255,.02)"><div style="color:${has ? '#ddd' : '#555'};font-weight:700">${name}</div><div style="color:${has ? '#999' : '#444'};font-size:.9em;margin-top:3px">${body}</div></div>`;
    }).join('');
    return rows
      ? `<div style="color:#8888aa;margin:14px 2px 4px;font-size:.95em;border-bottom:1px solid #222;padding-bottom:3px">${cat.label[zh ? 'zh' : 'en']}</div>${rows}`
      : '';
  }).join('');
  (document.getElementById('codex-content')!).innerHTML = sections || `<div style="color:#555;padding:12px">${zh ? '尚无条目。' : 'No entries yet.'}</div>`;
  (document.getElementById('codex-title')!).textContent = zh ? '📜 典籍' : '📜 Codex';
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
