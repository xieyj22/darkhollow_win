// Overlay panel UI: inventory, help, skill, achievements, talent.
// Extracted from input.ts (Polish-B Q6). Pure relocation — function bodies verbatim.
import { G, lang } from './state.js';
import { setInvOpen, setHelpOpen, setSkillOpen, setAchOpen, setTalentOpen } from './state.js';
import { equipItem, useItem, sellItem, dropItem, assignToQuickSlot, itemToGold } from './items.js';
import { executeSkill } from './skills.js';
import { getMeta } from './meta.js';
import { t, tMsg, tx, RARITY_C } from './i18n.js';
import { RELICS } from './data.js';
import { paintIcon, paintItemIcon, paintRelicIcon } from './sprites.js';
import { showOverlay, hideOverlay } from './ui-panels.js';
import { bridge } from './bridge.js';

// --- Inventory UI ---

export let sellMode = false;       // when true, clicking an item sells it for gold (point 3)
let assignTarget: any = null; // item currently expanding the quick-slot picker (point 9)

export function openInventory(): void {
  setInvOpen(true);
  showOverlay('inventory-overlay');
  renderInv();
}
function openInventorySell(): void { sellMode = true; openInventory(); }
export function closeInventory(): void {
  setInvOpen(false);
  sellMode = false;
  assignTarget = null;
  hideOverlay('inventory-overlay');
}

function mkInvBtn(label: string, color: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'inv-act';
  b.textContent = label;
  b.style.cssText = `background:none;border:1px solid ${color};color:${color};font-family:inherit;font-size:var(--fs-sm);padding:4px 8px;border-radius:3px;cursor:pointer;white-space:nowrap`;
  return b;
}

function renderInv(): void {
  if (!G) return;
  const p = G.player, div = document.getElementById('inv-content')!;
  div.innerHTML = '';
  // Relics owned this run — shown at the top of the inventory.
  if (p.relics && p.relics.length) {
    const rsec = document.createElement('div'); rsec.className = 'is';
    rsec.innerHTML = `<h4>${t('pn.relics')}</h4>`;
    for (const rid of p.relics) {
      const def = RELICS.find(r => r.id === rid);
      if (!def) continue;
      const row = document.createElement('div');
      row.className = `ii rc${def.rarity}`;
      row.innerHTML = `<span style="display:flex;gap:6px;align-items:center;flex:1"><canvas class="lic" width="16" height="16" data-relic="${rid}" style="image-rendering:pixelated"></canvas><span style="color:${RARITY_C[def.rarity]}">${tx(def.n)}</span></span><span class="id">${tx(def.d)}</span>`;
      rsec.appendChild(row);
    }
    div.appendChild(rsec);
  }
  if (sellMode) {
    const hint = document.createElement('div');
    hint.style.cssText = 'color:#ffd700;padding:6px 8px;font-size:var(--fs-base);text-align:center;border:1px solid #ffd70044;border-radius:3px;margin-bottom:8px';
    hint.textContent = t('pn.sellModeHint');
    div.appendChild(hint);
  }
  if (!p.inv.length) { const e = document.createElement('div'); e.style.cssText = 'color:#555;padding:10px'; e.textContent = t('empty'); div.appendChild(e); return; }
  const grps: Record<string, Array<{ it: any; i: number }>> = { weapon: [], armor: [], accessory: [], potion: [], scroll: [], food: [], consumable: [] };
  for (let i = 0; i < p.inv.length; i++) { const it = p.inv[i]; if (grps[it.type]) grps[it.type].push({ it, i }); }
  const labels: Record<string, string> = {
    weapon: t('weaponGrp'), armor: t('armorGrp'), accessory: t('accGrp'),
    potion: t('potGrp'), scroll: t('scrGrp'), food: '🍖 ' + t('foodName'), consumable: t('conGrp'),
  };
  const usable = (tp: string) => tp === 'potion' || tp === 'scroll' || tp === 'food' || tp === 'consumable';
  for (const [type, items] of Object.entries(grps)) {
    if (!items.length || !labels[type]) continue;
    const sec = document.createElement('div'); sec.className = 'is';
    sec.innerHTML = `<h4>${labels[type]}</h4>`;
    for (const { it } of items) {
      const row = document.createElement('div');
      row.className = `ii rc${it.rarity}`;
      const qsIdx = p.quickSlots ? p.quickSlots.indexOf(it) : -1;
      const qsTag = qsIdx >= 0 ? `<span style="color:#ffd700;font-size:var(--fs-floor);margin-left:3px">⚡${qsIdx + 1}</span>` : '';
      const name = document.createElement('span');
      name.style.cssText = 'display:flex;align-items:center;gap:5px;flex:1;min-width:0';
      const _idx = p.inv.indexOf(it);
      name.innerHTML = `<span class="ik">[${_idx + 1}]</span><canvas class="lic" width="16" height="16" data-idx="${_idx}"></canvas><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${it.name}${qsTag}</span>`;
      const desc = document.createElement('span');
      desc.className = 'id'; desc.textContent = it.desc; desc.style.cssText = 'margin:0 8px;text-align:right;flex-shrink:0';
      const acts = document.createElement('span');
      acts.style.cssText = 'display:flex;gap:3px;align-items:center;flex-wrap:wrap;justify-content:flex-end';

      if (sellMode) {
        const gv = Math.floor(itemToGold(it) * 1.5);
        const b = mkInvBtn(tMsg('pn.sell', String(gv)), '#ffd700');
        b.onclick = (ev) => { ev.stopPropagation(); const ci = p.inv.indexOf(it); if (ci >= 0) sellItem(ci); renderInv(); bridge.updateUI?.(); bridge.render?.(); };
        acts.appendChild(b);
      } else {
        // Drop (converts to gold) — point 9
        const db = mkInvBtn(t('pn.drop'), '#e63946');
        db.onclick = (ev) => { ev.stopPropagation(); const ci = p.inv.indexOf(it); if (ci >= 0) dropItem(ci); renderInv(); bridge.updateUI?.(); bridge.render?.(); };
        acts.appendChild(db);
        // Assign to quick slot — point 9
        if (usable(it.type)) {
          const ub = mkInvBtn(t('pn.use'), '#06d6a0');
          ub.onclick = (ev) => { ev.stopPropagation(); const ci = p.inv.indexOf(it); if (ci >= 0) useItem(ci); renderInv(); bridge.updateUI?.(); bridge.render?.(); };
          acts.appendChild(ub);
          const ab = mkInvBtn(t('pn.slot'), '#4895ef');
          ab.onclick = (ev) => { ev.stopPropagation(); assignTarget = (assignTarget === it ? null : it); renderInv(); };
          acts.appendChild(ab);
          if (assignTarget === it) {
            for (let s = 0; s < 9; s++) {
              const sb = mkInvBtn(String(s + 1), '#ffd700');
              sb.style.minWidth = '20px'; sb.style.padding = '2px 0';
              const occ = p.quickSlots && p.quickSlots[s];
              if (occ) sb.style.opacity = '0.5';
              sb.onclick = (ev) => { ev.stopPropagation(); const ci = p.inv.indexOf(it); if (ci >= 0) assignToQuickSlot(ci, s); assignTarget = null; renderInv(); bridge.renderHotbar?.(); bridge.render?.(); };
              acts.appendChild(sb);
            }
          }
        }
      }

      row.appendChild(name); row.appendChild(desc); row.appendChild(acts);
      if (!sellMode) {
        row.style.cursor = 'pointer';
        row.onclick = () => {
          const currentIdx = p.inv.indexOf(it);
          if (currentIdx === -1) return;
          if (it.type === 'weapon' || it.type === 'armor' || it.type === 'accessory') equipItem(currentIdx);
          else useItem(currentIdx);
          renderInv(); bridge.updateUI?.(); bridge.render?.();
        };
      }
      sec.appendChild(row);
    }
    div.appendChild(sec);
  }
  // Paint pixel sprites into every <canvas class="lic"> in the inventory.
  // Done once at the end (after all rows are in the DOM) so each canvas has its
  // final parent; idx maps back to p.inv for the live Item (color stays in sync).
  // Relic rows carry data-relic (the relic id) instead of data-idx.
  div.querySelectorAll<HTMLCanvasElement>('canvas.lic').forEach(cv => {
    const rid = cv.dataset.relic;
    if (rid) {
      const rdef = RELICS.find(r => r.id === rid);
      if (rdef) paintRelicIcon(cv, rdef);
      return;
    }
    const idx = +(cv.dataset.idx || 0);
    const it = p.inv[idx];
    if (it) paintItemIcon(cv, it);
  });
}

// --- Help ---

export function openHelp(): void {
  setHelpOpen(true);
  showOverlay('help-overlay');
  renderHelp();
}
export function closeHelp(): void {
  setHelpOpen(false);
  hideOverlay('help-overlay');
}
function renderHelp(): void {
  const div = document.getElementById('help-body')!;
  // sprite icon cell — matches in-game pixel art exactly
  const ic = (kind: string, color: string) => `<td><canvas class="hic" width="16" height="16" data-kind="${kind}" data-color="${color}"></canvas></td>`;
  div.innerHTML = `
  <h3 style="color:#e63946;margin-top:10px">${t('pn.objective')}</h3>
  <p style="color:#aaa;line-height:1.6;padding:4px 0">${t('pn.objectiveDesc')}</p>
  <h3 style="color:#e63946;margin-top:10px">${t('pn.controls')}</h3>
  <table><tr><td>WASD / ${t('pn.arrows')}</td><td>${t('pn.moveAttack')}</td></tr>
  <tr><td>G</td><td>${t('pn.pickup')}</td></tr>
  <tr><td>&gt; / .</td><td>${t('pn.descendStairs')}</td></tr>
  <tr><td>1-9</td><td>${t('pn.quickbar')}</td></tr>
  <tr><td>K</td><td>${t('pn.openSkill')}</td></tr>
  <tr><td>N</td><td>${t('pn.openTalent')}</td></tr>
  <tr><td>T</td><td>${t('pn.viewAch')}</td></tr>
  <tr><td>B</td><td>${t('pn.toggleInv')}</td></tr>
  <tr><td>Q</td><td>${t('pn.quaff')}</td></tr>
  <tr><td>R</td><td>${t('pn.readScroll')}</td></tr>
  <tr><td>F / Space</td><td>${t('pn.wait')}</td></tr>
  <tr><td>Ctrl+S</td><td>${t('pn.save')}</td></tr>
  <tr><td>M</td><td>${t('pn.toggleSound')}</td></tr>
  <tr><td>L</td><td>${t('pn.switchLang')}</td></tr></table>
  <h3 style="color:#e63946;margin-top:10px">${t('pn.elements')}</h3>
  <p style="color:#aaa;line-height:1.6;padding:4px 0">${t('pn.elementsDesc')}</p>
  <h3 style="color:#e63946;margin-top:10px">${t('pn.potions')}</h3>
  <table>
  <tr>${ic('P_HEALTH', '#e63946')}<td>${t('pn.hpPot')}</td></tr>
  <tr>${ic('P_MANA', '#4895ef')}<td>${t('pn.mpPot')}</td></tr>
  <tr>${ic('P_GENERIC', '#f4845f')}<td>${t('pn.strElixir')}</td></tr>
  <tr>${ic('P_GENERIC', '#7ec8e3')}<td>${t('pn.ironSkin')}</td></tr>
  <tr>${ic('P_GENERIC', '#ffd700')}<td>${t('pn.restoration')}</td></tr>
  <tr>${ic('P_POISON', '#32cd32')}<td>${t('pn.poison')}</td></tr>
  <tr>${ic('P_GENERIC', '#ff4500')}<td>${t('pn.fireResist')}</td></tr>
  <tr>${ic('P_GENERIC', '#00ced1')}<td>${t('pn.iceResist')}</td></tr></table>
  <h3 style="color:#e63946;margin-top:10px">${t('pn.scrolls')}</h3>
  <table>
  <tr>${ic('I_SCROLL', '#f4845f')}<td>${t('pn.fireball')}</td></tr>
  <tr>${ic('I_SCROLL', '#ffd700')}<td>${t('pn.lightning')}</td></tr>
  <tr>${ic('I_SCROLL', '#9b5de5')}<td>${t('pn.teleport')}</td></tr>
  <tr>${ic('I_SCROLL', '#4895ef')}<td>${t('pn.mapping')}</td></tr>
  <tr>${ic('I_SCROLL', '#7ec8e3')}<td>${t('pn.shield')}</td></tr>
  <tr>${ic('I_SCROLL', '#aaa')}<td>${t('pn.fear')}</td></tr>
  <tr>${ic('I_SCROLL', '#00ced1')}<td>${t('pn.blizzard')}</td></tr>
  <tr>${ic('I_SCROLL', '#ffd700')}<td>${t('pn.holyBlast')}</td></tr>
  <tr>${ic('I_SCROLL', '#06d6a0')}<td>${t('pn.summoning')}</td></tr></table>
  <h3 style="color:#e63946;margin-top:10px">${t('pn.consumables')}</h3>
  <table>
  <tr>${ic('C_BOMB', '#ff4500')}<td>${t('pn.bomb')}</td></tr>
  <tr>${ic('W_DAGGER', '#c0c0c0')}<td>${t('pn.throwingKnife')}</td></tr>
  <tr>${ic('C_POUCH', '#f4845f')}<td>${t('pn.torch')}</td></tr>
  <tr>${ic('C_POUCH', '#a0522d')}<td>${t('pn.bearTrap')}</td></tr>
  <tr>${ic('C_POUCH', '#888')}<td>${t('pn.smokeBomb')}</td></tr>
  <tr>${ic('C_POUCH', '#4895ef')}<td>${t('pn.wardStone')}</td></tr>
  <tr>${ic('P_GENERIC', '#06d6a0')}<td>${t('pn.haste')}</td></tr>
  <tr>${ic('P_GENERIC', '#80ed99')}<td>${t('pn.antidote')}</td></tr>
  <tr>${ic('C_POUCH', '#ffd700')}<td>${t('pn.holyWater')}</td></tr>
  <tr>${ic('C_POUCH', '#4895ef')}<td>${t('pn.recallStone')}</td></tr>
  <tr>${ic('C_POUCH', '#2f4f4f')}<td>${t('pn.shadowCloak')}</td></tr></table>
  <h3 style="color:#e63946;margin-top:10px">${t('pn.specialTiles')}</h3>
  <table><tr>${ic('FOUNTAIN', '#4895ef')}<td>${t('pn.fountainTile')}</td></tr>
  <tr>${ic('SHRINE', '#06d6a0')}<td>${t('pn.shrineTile')}</td></tr>
  <tr>${ic('STAIR', '#7ec8e3')}<td>${t('pn.stairsTile')}</td></tr>
  <tr>${ic('TRAP', '#a0522d')}<td>${t('pn.trapTile')}</td></tr></table>
  <h3 style="color:#e63946;margin-top:10px">${t('pn.tips')}</h3>
  <ul style="color:#aaa;padding-left:20px;line-height:1.8">
  <li>${t('pn.tip1')}</li>
  <li>${t('pn.tip2')}</li>
  <li>${t('pn.tip3')}</li>
  <li>${t('pn.tip4')}</li>
  <li>${t('pn.tip5')}</li>
  <li>${t('pn.tip6')}</li></ul>`;
  // Paint sprite icons so the help panel matches in-game art.
  div.querySelectorAll<HTMLCanvasElement>('canvas.hic').forEach(cv => paintIcon(cv, cv.dataset.kind || 'C_POUCH', cv.dataset.color || '#ccc'));
}

// --- Skill panel ---

export function tryCastSkill(): void {
  if (!G) return;
  const p = G.player, cls = bridge.classes[p.ci];
  if (cls) {
    const sk = cls.skill;
    if (p.skillCd === 0 && p.mp >= sk.cost) { executeSkill(sk); return; }
  }
  openSkillPanel(); // on cooldown / low MP → open panel so the player sees why
}
export function openSkillPanel(): void {
  setSkillOpen(true);
  showOverlay('skill-overlay');
  renderSkillPanel();
}
export function closeSkillPanel(): void {
  setSkillOpen(false);
  hideOverlay('skill-overlay');
}
function renderSkillPanel(): void {
  if (!G) return;
  const p = G.player, cls = (await_getClasses())[p.ci], sk = cls.skill;
  const div = document.getElementById('sk-content')!;
  div.innerHTML = '';
  const cdLeft = Math.max(0, p.skillCd);
  const canUse = cdLeft === 0 && p.mp >= sk.cost;
  const row = document.createElement('div');
  row.className = 'sk-row'; row.style.opacity = canUse ? '1' : '.4';
  row.innerHTML = `<div class="skn">${tx(sk.name)}</div><div class="skc">${sk.cost} MP</div><div class="skd">${tx(sk.desc)}</div>${cdLeft > 0 ? `<div class="skcd">CD: ${cdLeft}</div>` : ''}`;
  if (canUse) row.onclick = () => { executeSkill(sk); closeSkillPanel(); };
  div.appendChild(row);
}
function await_getClasses() {
  // classes are in data.ts — use window binding set by main.ts
  return bridge.classes;
}

// --- Achievements ---

export function openAchievements(): void {
  setAchOpen(true);
  showOverlay('achievement-overlay');
  renderAch();
}
export function closeAchievements(): void {
  setAchOpen(false);
  hideOverlay('achievement-overlay');
}
function renderAch(): void {
  if (!G) return;
  const div = document.getElementById('ach-content')!;
  div.innerHTML = '';
  const defs = bridge.achDefs;
  for (const a of defs) {
    // An achievement counts as unlocked if earned this run OR persisted to the
    // meta save in a previous run — otherwise prior unlocks show as locked here.
    const u = G.player.achievements.has(a.id) || getMeta().achievements.includes(a.id);
    const d = document.createElement('div');
    d.className = `ai ${u ? 'u' : 'l'}`;
    d.innerHTML = `<span class="aic">${a.icon}</span><div><div class="ain">${tx(a.n)}</div><div class="aid">${tx(a.d)}</div></div>`;
    div.appendChild(d);
  }
}

// --- Talent panel ---

export function openTalentPanel(): void {
  setTalentOpen(true);
  showOverlay('talent-overlay');
  renderTalentPanel();
}
export function closeTalentPanel(): void {
  setTalentOpen(false);
  hideOverlay('talent-overlay');
}
function renderTalentPanel(): void {
  if (!G) return;
  const p = G.player;
  const trees = bridge.talentTrees;
  if (!trees) return;
  const tree = trees.find((t: any) => t.classIdx === p.ci);
  if (!tree) return;
  const div = document.getElementById('talent-grid')!;
  const header = document.getElementById('talent-pts')!;
  header.textContent = String(p.talents.points);

  div.innerHTML = '';
  // Create 4x4 grid
  const grid: any[][] = [[], [], [], []];
  for (const node of tree.nodes) {
    if (node.row >= 0 && node.row < 4 && node.col >= 0 && node.col < 4) {
      grid[node.row][node.col] = node;
    }
  }

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const node = grid[row]?.[col];
      const cell = document.createElement('div');
      cell.className = 'talent-cell';

      if (!node) {
        cell.classList.add('empty');
        div.appendChild(cell);
        continue;
      }

      const currentRank = p.talents.talents[node.id] || 0;
      const maxed = currentRank >= node.maxRank;
      const canLearn = !maxed && p.talents.points > 0 &&
        (!node.requires || node.requires.every((req: string) => (p.talents.talents[req] || 0) > 0));

      cell.classList.add(maxed ? 'maxed' : currentRank > 0 ? 'learned' : canLearn ? 'available' : 'locked');

      const name = tx(node.n);
      const desc = tx(node.desc);
      // Rank dots
      let dots = '';
      for (let r = 0; r < node.maxRank; r++) {
        dots += r < currentRank ? '●' : '○';
      }

      cell.innerHTML = `<div class="tc-icon">${node.icon}</div><div class="tc-name">${name}</div><div class="tc-dots">${dots}</div>`;
      cell.title = `${name} (${currentRank}/${node.maxRank})\n${desc}`;

      if (canLearn) {
        cell.tabIndex = 0;
        cell.setAttribute('role', 'button');
        const activate = () => {
          p.talents.talents[node.id] = currentRank + 1;
          p.talents.points--;
          // Trigger recalc to apply passive stat bonuses
          bridge.recalc?.();
          renderTalentPanel();
          bridge.updateUI?.();
          bridge.render?.();
        };
        cell.onclick = activate;
        // Keyboard activation so the grid is reachable without a mouse
        cell.addEventListener('keydown', (ev: KeyboardEvent) => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); activate(); }
        });
      }

      div.appendChild(cell);
    }
  }
}

// Expose functions for internal use via typed bridge registry
bridge.renderInv = renderInv;
bridge.renderHelp = renderHelp;
bridge.openSellInv = openInventorySell;
// NOTE: __updateUI and __render are owned by main.ts (which binds the real
// functions). Do not reassign them here — an earlier version bound them to
// self-recursive arrows that would stack-overflow if ever called.
