// In-game UI panels: legend, objective, keys, tooltip, overlay animation,
// pause menu, records, codex. Extracted from main.ts (Polish-B Q6).
// Pure relocation — function bodies verbatim.
import { G, lang, legendVisible, setLegendVisible, keysVisible, setKeysVisible, setMenuOpen } from './state.js';
import { TS, MW, MH, TL } from './config.js';
import { dst } from './utils.js';
import { RARITY_C, rareName } from './i18n.js';
import { paintIcon } from './sprites.js';
import { getMeta } from './meta.js';
import { CLASSES } from './data.js';
import { LORE_ENTRIES, LORE_CATS } from './lore.js';
import { bridge } from './bridge.js';

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
export function initTooltip(): void {
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
export function openPause(): void {
  if (!G || G.gameOver) return;
  setMenuOpen(true);
  showOverlay('pause-overlay');
}
export function closePause(): void {
  setMenuOpen(false);
  hideOverlay('pause-overlay');
}

// ===== Records / Leaderboard (Wave 7b) =====
export function renderRecords(): void {
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
export function renderCodex(): void {
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
