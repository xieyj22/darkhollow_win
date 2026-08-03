// In-game UI panels: legend, objective, keys, tooltip, overlay animation,
// pause menu, records, codex. Extracted from main.ts (Polish-B Q6).
// Pure relocation — function bodies verbatim.
import { G, lang, legendVisible, setLegendVisible, keysVisible, setKeysVisible, setMenuOpen } from './state.js';
import { TS, MW, MH, TL } from './config.js';
import { dst } from './utils.js';
import { RARITY_C, rareName, t, tx } from './i18n.js';
import { paintIcon, paintItemIcon, paintRelicIcon, catalogSpriteColor } from './sprites.js';
import type { ItemType } from './types.js';
import { getMeta } from './meta.js';
import { CLASSES, ALL_WEAPONS, ALL_ARMORS, ALL_ACCESSORIES, ALL_POTIONS, ALL_SCROLLS, ALL_CONSUMABLES, FOODS, ENDLESS_GEAR, RELICS } from './data.js';
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
  const charItems = [
    { ch: '#', c: '#666', t: t('up.wall') }, { ch: '·', c: '#555', t: t('up.floor') },
    { ch: '+', c: '#8b4513', t: t('up.door') }, { ch: '≈', c: '#1a5276', t: t('up.water') },
    { ch: '*', c: '#ff4500', t: t('up.lava') }, { ch: '~', c: '#00ced1', t: t('up.abyssWater') },
  ];
  const spr: Array<[string, string, string]> = [
    ['STAIR', '#7ec8e3', t('up.stairs')],
    ['WARRIOR', '#ffd700', t('up.you')],
    ['GOBLIN', '#228b22', t('up.enemy')],
    ['BOSS', '#ffd700', t('up.boss')],
    ['DRAGON', '#ff6347', t('up.dragon')],
    ['GOLEM', '#696969', t('up.golem')],
    ['WRAITH', '#4682b4', t('up.wraith')],
    ['ELEMENTAL', '#ff4500', t('up.elemental')],
    ['CULTIST', '#8b0000', t('up.cultist')],
    ['W_SWORD', '#f4845f', t('up.weapon')],
    ['I_SHIELD', '#7ec8e3', t('up.armor')],
    ['I_RING', '#daa520', t('up.accessory')],
    ['P_HEALTH', '#e63946', t('up.potion')],
    ['I_SCROLL', '#9b5de5', t('up.scroll')],
    ['I_FOOD', '#f4845f', t('up.food')],
    ['I_GOLD', '#ffd700', t('up.gold')],
    ['FOUNTAIN', '#4895ef', t('up.fountain')],
    ['SHRINE', '#06d6a0', t('up.shrine')],
    ['TRAP', '#a0522d', t('up.trap')],
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
  const pairs = [
    { k: 'WASD', t: t('up.move') }, { k: '1-9', t: t('up.quickItem') },
    { k: 'G', t: t('up.pickup') }, { k: '>', t: t('up.descend') },
    { k: 'B', t: t('up.inv') }, { k: 'K', t: t('up.skill') },
    { k: 'T', t: t('up.achv') }, { k: 'Q', t: t('up.quaff') },
    { k: 'R', t: t('up.read') }, { k: 'F', t: t('up.wait') },
    { k: 'L', t: t('up.lang') }, { k: 'M', t: t('up.mute') },
  ];
  document.getElementById('keys-panel')!.innerHTML =
    `<div class="keys-hdr"><span>⌨ ${t('up.keys')}</span><button class="keys-x" onclick="document.getElementById('keys-panel').style.display='none';document.getElementById('keys-toggle').style.display='block'">✕</button></div><div class="keys-g">${pairs.map(p => `<span class="kk">${p.k}</span><span class="kd">${p.t}</span>`).join('')}</div>`;
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
      tt.innerHTML = `<div class="ttn" style="color:${trap.c}">◆ ${tx(trap.n)}</div><div class="ttd">${trap.dmg > 0 ? '-' + trap.dmg + 'HP' : ''}</div>`;
    } else if (tile === TL.FOUNTAIN) {
      tt.style.display = 'block'; tt.style.left = (e.clientX + 15) + 'px'; tt.style.top = (e.clientY + 15) + 'px';
      tt.style.borderColor = '#4895ef44';
      tt.innerHTML = `<div class="ttn" style="color:#4895ef">◆ ${t('up.magicFountain')}</div><div class="ttd">${t('up.stepToHeal')}</div>`;
    } else if (tile === TL.SHRINE) {
      tt.style.display = 'block'; tt.style.left = (e.clientX + 15) + 'px'; tt.style.top = (e.clientY + 15) + 'px';
      tt.style.borderColor = '#06d6a044';
      tt.innerHTML = `<div class="ttn" style="color:#06d6a0">◆ ${t('up.ancientShrine')}</div><div class="ttd">${t('up.stepForBoost')}</div>`;
    } else if (tile === TL.STAIR) {
      tt.style.display = 'block'; tt.style.left = (e.clientX + 15) + 'px'; tt.style.top = (e.clientY + 15) + 'px';
      tt.style.borderColor = '#7ec8e344';
      tt.innerHTML = `<div class="ttn" style="color:#7ec8e3">◆ ${t('up.stairsDown')}</div><div class="ttd">${t('up.pressDescend')}</div>`;
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
  const m = getMeta();
  const cls = (i: number) => { const c = CLASSES[i]; return c ? tx(c.name) : '?'; };
  const row = (cols: string[], color = '#ccc') =>
    `<div style="display:flex;gap:8px;padding:3px 6px;border-bottom:1px solid #1c1c1c;color:${color};font-size:.88em">${cols.map(c => `<span style="flex:1">${c}</span>`).join('')}</div>`;
  const hdr = (cols: string[]) => row(cols, '#777');
  const hist = m.runHistory.length
    ? m.runHistory.map(r => row([r.mode === 'endless' ? '♾' : '◐', cls(r.classIdx), `F${r.floor}`, `${r.kills}${t('up.killUnit')}`, r.result === 'win' ? '🏆' : '💀'], r.result === 'win' ? '#ffd700' : '#e63946')).join('')
    : `<div style="color:#555;padding:8px">${t('up.noRuns')}</div>`;
  const lb = m.endlessLeaderboard.length
    ? m.endlessLeaderboard.map((r, i) => row([`#${i + 1}`, cls(r.classIdx), `F${r.floor}`, `${r.kills}${t('up.killUnit')}`], i === 0 ? '#ffd700' : '#999')).join('')
    : `<div style="color:#555;padding:8px">${t('up.noEndlessRuns')}</div>`;
  (document.getElementById('records-content')!).innerHTML =
    `<div style="color:#888;margin:6px 2px;font-size:.95em">🕐 ${t('up.recentRuns')}</div>` +
    hdr([t('up.mode'), t('up.class'), t('up.floorHdr'), t('up.kills'), t('up.result')]) + hist +
    `<div style="color:#888;margin:14px 2px 6px;font-size:.95em">♾ ${t('up.endlessLeaderboard')}</div>` +
    hdr([t('up.rank'), t('up.class'), t('up.deepest'), t('up.kills')]) + lb;
  (document.getElementById('records-title')!).textContent = t('up.records');
}

// ===== Lore Codex (Wave 8) — clones the records-overlay pattern =====
let codexTab: 'lore' | 'items' = 'lore';

export function renderCodex(): void {
  const titleEl = document.getElementById('codex-title');
  if (titleEl) titleEl.textContent = t('up.codex');
  const content = document.getElementById('codex-content');
  if (!content) return;
  content.innerHTML =
    `<div class="opt-tabs" id="codex-tabs" role="tablist" style="margin-bottom:8px">
      <button class="opt-tab${codexTab === 'lore' ? ' active' : ''}" data-ctab="lore">${t('codex.tabLore')}</button>
      <button class="opt-tab${codexTab === 'items' ? ' active' : ''}" data-ctab="items">${t('codex.tabItems')}</button>
    </div>` +
    (codexTab === 'lore' ? renderLoreSection() : renderItemSection());
  content.querySelectorAll<HTMLElement>('[data-ctab]').forEach(btn => {
    btn.onclick = () => { codexTab = (btn.dataset.ctab as 'lore' | 'items') || 'lore'; renderCodex(); };
  });
  // Paint pixel sprites into each discovered item row's canvas. Reuses the
  // help-panel pattern: query all canvas.lic, then for each look up the catalog
  // def by data-type+data-id and construct a minimal Item-like carrying the
  // derived color (catalogSpriteColor) + ef/subType routing for paintItemIcon.
  content.querySelectorAll<HTMLCanvasElement>('canvas.lic').forEach(cv => {
    const type = (cv.dataset.type || '') as ItemType;
    const id = cv.dataset.id || '';
    if (!id) return;
    // Relic canvases route through paintRelicIcon (def.c-driven palette).
    if ((type as string) === 'relic') {
      const rdef = RELICS.find(r => r.id === id);
      if (rdef) paintRelicIcon(cv, rdef);
      return;
    }
    const def = findCatalogDefFull(type, id);
    if (!def) return;
    const itemLike = {
      type, id,
      name: def.n ? tx(def.n) : '',
      c: catalogSpriteColor(def, type),
      ef: def.ef,
      subType: def.subType,
      rarity: def.r ?? 0,
    } as any;
    paintItemIcon(cv, itemLike);
  });
}

function renderLoreSection(): string {
  const unlocked = new Set(getMeta().unlockedLore);
  return LORE_CATS.map(cat => {
    const rows = LORE_ENTRIES.filter(e => e.cat === cat.id).map(e => {
      const has = unlocked.has(e.id);
      const name = has ? tx(e.n) : '🔒 ???';
      const body = has ? tx(e.body) : t('up.notDiscovered');
      return `<div style="padding:8px 10px;margin:4px 0;border-left:3px solid ${has ? '#9a2be2' : '#333'};background:rgba(255,255,255,.02)"><div style="color:${has ? '#ddd' : '#555'};font-weight:700">${name}</div><div style="color:${has ? '#999' : '#444'};font-size:.9em;margin-top:3px">${body}</div></div>`;
    }).join('');
    return rows ? `<div style="color:#8888aa;margin:14px 2px 4px;font-size:.95em;border-bottom:1px solid #222;padding-bottom:3px">${tx(cat.label)}</div>${rows}` : '';
  }).join('') || `<div style="color:#555;padding:12px">${t('up.noEntries')}</div>`;
}

// Reverse-lookup a full catalog def (with r/c/ef/subType) by type + id — used by
// the Codex items tab to build an Item-like for paintItemIcon. Relics are
// intentionally excluded (Task 6 wires relic sprites separately).
function findCatalogDefFull(type: ItemType, id: string): { r?: number; c?: string; ef?: string; subType?: string; n?: { en: string; zh: string } } | null {
  const search = <T extends { id?: string }>(arr: T[]) => arr.find(d => d.id === id) || null;
  switch (type) {
    case 'weapon': return search([...ALL_WEAPONS, ...ENDLESS_GEAR.weapons]);
    case 'armor': return search([...ALL_ARMORS, ...ENDLESS_GEAR.armors]);
    case 'accessory': return search([...ALL_ACCESSORIES, ...ENDLESS_GEAR.accessories]);
    case 'potion': return search(ALL_POTIONS);
    case 'scroll': return search(ALL_SCROLLS);
    case 'consumable': return search(ALL_CONSUMABLES);
    case 'food': return search(FOODS);
    default: return null;
  }
}

function renderItemSection(): string {
  const disc = new Set(getMeta().discoveredItems);
  const tables: { type: ItemType; label: string; arr: { id?: string; n: { en: string; zh: string } }[] }[] = [
    { type: 'weapon', label: t('intro.type.weapon'), arr: [...ALL_WEAPONS, ...ENDLESS_GEAR.weapons] },
    { type: 'armor', label: t('intro.type.armor'), arr: [...ALL_ARMORS, ...ENDLESS_GEAR.armors] },
    { type: 'accessory', label: t('intro.type.accessory'), arr: [...ALL_ACCESSORIES, ...ENDLESS_GEAR.accessories] },
    { type: 'potion', label: t('intro.type.potion'), arr: ALL_POTIONS },
    { type: 'scroll', label: t('intro.type.scroll'), arr: ALL_SCROLLS },
    { type: 'consumable', label: t('intro.type.consumable'), arr: ALL_CONSUMABLES },
    { type: 'food', label: t('intro.type.food'), arr: FOODS },
  ];
  let html = '';
  for (const { type, label, arr } of tables) {
    const rows = arr.map(d => {
      const has = d.id ? disc.has(`${type}:${d.id}`) : false;
      const name = has ? tx(d.n) : t('codex.itemLocked');
      // Discovered rows get a pixel-sprite canvas (painted in renderCodex);
      // locked rows show nothing — keeps the 🔒 feel without an empty canvas.
      const icon = has && d.id ? `<canvas class="lic codex-icon" width="16" height="16" data-type="${type}" data-id="${d.id}" style="vertical-align:middle;margin-right:6px;image-rendering:pixelated"></canvas>` : '';
      return `<div style="padding:6px 10px;margin:3px 0;border-left:3px solid ${has ? '#ffd700' : '#333'};background:rgba(255,255,255,.02)">${icon}<span style="color:${has ? '#ddd' : '#555'};font-weight:700">${name}</span></div>`;
    }).join('');
    if (rows) html += `<div style="color:#8888aa;margin:12px 2px 4px;font-size:.95em;border-bottom:1px solid #222;padding-bottom:3px">${label}</div>${rows}`;
  }
  // Relics — discovered rows get a themed pixel sprite (Task 6).
  const rrows = RELICS.map(r => {
    const has = disc.has('relic:' + r.id);
    const name = has ? tx(r.n) : t('codex.itemLocked');
    const icon = has ? `<canvas class="lic codex-icon" width="16" height="16" data-type="relic" data-id="${r.id}" style="vertical-align:middle;margin-right:6px;image-rendering:pixelated"></canvas>` : '';
    return `<div style="padding:6px 10px;margin:3px 0;border-left:3px solid ${has ? '#9a2be2' : '#333'};background:rgba(255,255,255,.02)">${icon}<span style="color:${has ? '#ddd' : '#555'};font-weight:700">${name}</span></div>`;
  }).join('');
  html += `<div style="color:#8888aa;margin:12px 2px 4px;font-size:.95em;border-bottom:1px solid #222;padding-bottom:3px">${t('intro.relicTag')}</div>${rrows}`;
  return html || `<div style="color:#555;padding:12px">${t('up.noEntries')}</div>`;
}
