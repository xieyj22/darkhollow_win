// Overlay panel UI: inventory, help, skill, achievements, talent.
// Extracted from input.ts (Polish-B Q6). Pure relocation — function bodies verbatim.
import { G, lang } from './state.js';
import { setInvOpen, setHelpOpen, setSkillOpen, setAchOpen, setTalentOpen } from './state.js';
import { equipItem, useItem, sellItem, dropItem, assignToQuickSlot, itemToGold } from './items.js';
import { executeSkill } from './skills.js';
import { getMeta } from './meta.js';
import { t, RARITY_C } from './i18n.js';
import { RELICS } from './data.js';
import { paintIcon } from './sprites.js';
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
    const zh = lang === 'zh';
    const rsec = document.createElement('div'); rsec.className = 'is';
    rsec.innerHTML = `<h4>${zh ? '🏺 圣物' : '🏺 Relics'}</h4>`;
    for (const rid of p.relics) {
      const def = RELICS.find(r => r.id === rid);
      if (!def) continue;
      const row = document.createElement('div');
      row.className = `ii rc${def.rarity}`;
      row.innerHTML = `<span style="display:flex;gap:6px;align-items:center;flex:1"><span style="color:${def.c};font-size:1.1em">${def.ch}</span><span style="color:${RARITY_C[def.rarity]}">${zh ? def.n.zh : def.n.en}</span></span><span class="id">${zh ? def.d.zh : def.d.en}</span>`;
      rsec.appendChild(row);
    }
    div.appendChild(rsec);
  }
  if (sellMode) {
    const hint = document.createElement('div');
    hint.style.cssText = 'color:#ffd700;padding:6px 8px;font-size:var(--fs-base);text-align:center;border:1px solid #ffd70044;border-radius:3px;margin-bottom:8px';
    hint.textContent = lang === 'zh' ? '💰 售卖模式：点击右侧 [卖出] 把物品换成金币' : '💰 Sell mode: click [Sell] to turn items into gold';
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
      name.innerHTML = `<span class="ik">[${p.inv.indexOf(it) + 1}]</span><span style="color:${it.c}">${it.ch}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${it.name}${qsTag}</span>`;
      const desc = document.createElement('span');
      desc.className = 'id'; desc.textContent = it.desc; desc.style.cssText = 'margin:0 8px;text-align:right;flex-shrink:0';
      const acts = document.createElement('span');
      acts.style.cssText = 'display:flex;gap:3px;align-items:center;flex-wrap:wrap;justify-content:flex-end';

      if (sellMode) {
        const gv = Math.floor(itemToGold(it) * 1.5);
        const b = mkInvBtn(lang === 'zh' ? `卖出+${gv}💰` : `Sell+${gv}`, '#ffd700');
        b.onclick = (ev) => { ev.stopPropagation(); const ci = p.inv.indexOf(it); if (ci >= 0) sellItem(ci); renderInv(); bridge.updateUI?.(); bridge.render?.(); };
        acts.appendChild(b);
      } else {
        // Drop (converts to gold) — point 9
        const db = mkInvBtn(lang === 'zh' ? '丢' : 'Drop', '#e63946');
        db.onclick = (ev) => { ev.stopPropagation(); const ci = p.inv.indexOf(it); if (ci >= 0) dropItem(ci); renderInv(); bridge.updateUI?.(); bridge.render?.(); };
        acts.appendChild(db);
        // Assign to quick slot — point 9
        if (usable(it.type)) {
          const ub = mkInvBtn(lang === 'zh' ? '用' : 'Use', '#06d6a0');
          ub.onclick = (ev) => { ev.stopPropagation(); const ci = p.inv.indexOf(it); if (ci >= 0) useItem(ci); renderInv(); bridge.updateUI?.(); bridge.render?.(); };
          acts.appendChild(ub);
          const ab = mkInvBtn(lang === 'zh' ? '装' : 'Slot', '#4895ef');
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
  const zh = lang === 'zh';
  // sprite icon cell — matches in-game pixel art exactly
  const ic = (kind: string, color: string) => `<td><canvas class="hic" width="16" height="16" data-kind="${kind}" data-color="${color}"></canvas></td>`;
  div.innerHTML = `
  <h3 style="color:#e63946;margin-top:10px">${zh ? '🎯 游戏目标' : '🎯 Objective'}</h3>
  <p style="color:#aaa;line-height:1.6;padding:4px 0">${zh ? '深入暗渊40层，击败最终Boss<strong style="color:#ffd700">创世者</strong>即可获胜！每5层会遇到一个强力Boss，注意做好准备。' : 'Descend through 40 floors and defeat the final boss <strong style="color:#ffd700">The Creator</strong> to win! A powerful boss awaits every 5 floors.'}</p>
  <h3 style="color:#e63946;margin-top:10px">${zh ? '⌨️ 操控' : '⌨️ Controls'}</h3>
  <table><tr><td>WASD / ${zh ? '方向键' : 'Arrows'}</td><td>${zh ? '移动 / 攻击敌人' : 'Move & attack enemies'}</td></tr>
  <tr><td>G</td><td>${zh ? '拾取脚下的物品' : 'Pick up item on ground'}</td></tr>
  <tr><td>&gt; / .</td><td>${zh ? '沿楼梯下楼' : 'Descend stairs'}</td></tr>
  <tr><td>1-9</td><td>${zh ? '使用快捷栏对应位置的道具' : 'Use item from quickbar slot'}</td></tr>
  <tr><td>K</td><td>${zh ? '打开技能面板，再次按K或Enter释放技能' : 'Open skill panel, press K or Enter to use'}</td></tr>
  <tr><td>N</td><td>${zh ? '打开天赋树面板' : 'Open talent tree'}</td></tr>
  <tr><td>T</td><td>${zh ? '查看成就列表' : 'View achievements'}</td></tr>
  <tr><td>B</td><td>${zh ? '打开/关闭背包' : 'Open/close inventory'}</td></tr>
  <tr><td>Q</td><td>${zh ? '快速喝一瓶药水' : 'Quick quaff potion'}</td></tr>
  <tr><td>R</td><td>${zh ? '快速读一张卷轴' : 'Quick read scroll'}</td></tr>
  <tr><td>F / Space</td><td>${zh ? '原地等待一回合' : 'Wait one turn'}</td></tr>
  <tr><td>Ctrl+S</td><td>${zh ? '保存游戏进度' : 'Save game'}</td></tr>
  <tr><td>M</td><td>${zh ? '切换音效开关' : 'Toggle sound'}</td></tr>
  <tr><td>L</td><td>${zh ? '切换中英文' : 'Switch language'}</td></tr></table>
  <h3 style="color:#e63946;margin-top:10px">${zh ? '⚔️ 元素系统' : '⚔️ Elements'}</h3>
  <p style="color:#aaa;line-height:1.6;padding:4px 0">${zh ? '武器和敌人可能带有元素属性（🔥火 ❄冰 ⚡雷 💀暗 ✨圣）。存在克制关系：火>冰>雷>暗，圣与暗互克。使用克制元素可造成1.5倍伤害！' : 'Weapons and enemies may have elemental attributes (🔥Fire ❄Ice ⚡Lightning 💀Shadow ✨Holy). Elements counter each other: Fire>Ice>Lightning>Shadow, Holy and Shadow counter each other. Using a strong element deals 1.5x damage!'}</p>
  <h3 style="color:#e63946;margin-top:10px">${zh ? '🧪 药水效果' : '🧪 Potions'}</h3>
  <table>
  <tr>${ic('P_HEALTH', '#e63946')}<td>${zh ? '治疗药水 — 恢复HP' : 'Health Potion — Restores HP'}</td></tr>
  <tr>${ic('P_MANA', '#4895ef')}<td>${zh ? '魔力药水 — 恢复MP' : 'Mana Potion — Restores MP'}</td></tr>
  <tr>${ic('P_GENERIC', '#f4845f')}<td>${zh ? '力量药剂 — 临时增加攻击力' : 'Strength Elixir — Temp ATK boost'}</td></tr>
  <tr>${ic('P_GENERIC', '#7ec8e3')}<td>${zh ? '铁皮药水 — 临时增加防御力' : 'Iron Skin — Temp DEF boost'}</td></tr>
  <tr>${ic('P_GENERIC', '#ffd700')}<td>${zh ? '恢复药水 — 完全恢复HP和MP' : 'Restoration — Full HP & MP restore'}</td></tr>
  <tr>${ic('P_POISON', '#32cd32')}<td>${zh ? '毒药 — 对自己造成伤害（小心！）' : 'Poison — Damages you (careful!)'}</td></tr>
  <tr>${ic('P_GENERIC', '#ff4500')}<td>${zh ? '火焰抗性药水 — 临时火焰抗性' : 'Fire Resist — Temp fire resistance'}</td></tr>
  <tr>${ic('P_GENERIC', '#00ced1')}<td>${zh ? '冰霜抗性药水 — 临时冰霜抗性' : 'Ice Resist — Temp ice resistance'}</td></tr></table>
  <h3 style="color:#e63946;margin-top:10px">${zh ? '📜 卷轴效果' : '📜 Scrolls'}</h3>
  <table>
  <tr>${ic('I_SCROLL', '#f4845f')}<td>${zh ? '火球术卷轴 — 范围4格内所有敌人受到火焰伤害' : 'Fireball — Fire AoE dmg within range 4'}</td></tr>
  <tr>${ic('I_SCROLL', '#ffd700')}<td>${zh ? '闪电卷轴 — 对所有可见敌人造成闪电伤害' : 'Lightning — Hits all visible enemies'}</td></tr>
  <tr>${ic('I_SCROLL', '#9b5de5')}<td>${zh ? '传送卷轴 — 随机传送到某个房间' : 'Teleport — Warp to a random room'}</td></tr>
  <tr>${ic('I_SCROLL', '#4895ef')}<td>${zh ? '地图卷轴 — 揭示整层地图' : 'Mapping — Reveals entire floor'}</td></tr>
  <tr>${ic('I_SCROLL', '#7ec8e3')}<td>${zh ? '护盾卷轴 — 临时增加防御' : 'Shield — Temp DEF boost'}</td></tr>
  <tr>${ic('I_SCROLL', '#aaa')}<td>${zh ? '恐惧卷轴 — 恐惧范围5格内的敌人' : 'Fear — Enemies within range 5 flee'}</td></tr>
  <tr>${ic('I_SCROLL', '#00ced1')}<td>${zh ? '暴风雪卷轴 — 范围5格内冰霜伤害' : 'Blizzard — Ice AoE within range 5'}</td></tr>
  <tr>${ic('I_SCROLL', '#ffd700')}<td>${zh ? '圣光卷轴 — 范围5格内神圣伤害，暗影敌人1.5倍' : 'Holy Blast — Holy AoE, 1.5x vs shadow'}</td></tr>
  <tr>${ic('I_SCROLL', '#06d6a0')}<td>${zh ? '召唤卷轴 — 召唤一个友方单位协助战斗' : 'Summoning — Calls an ally to fight for you'}</td></tr></table>
  <h3 style="color:#e63946;margin-top:10px">${zh ? '🎒 消耗品效果' : '🎒 Consumables'}</h3>
  <table>
  <tr>${ic('C_BOMB', '#ff4500')}<td>${zh ? '炸弹 — 范围3格内火焰伤害' : 'Bomb — Fire AoE within range 3'}</td></tr>
  <tr>${ic('W_DAGGER', '#c0c0c0')}<td>${zh ? '飞刀 — 对最近敌人造成远程伤害' : 'Throwing Knife — Ranged dmg to nearest'}</td></tr>
  <tr>${ic('C_POUCH', '#f4845f')}<td>${zh ? '火把 — 增加视野范围30回合' : 'Torch — Increased FOV for 30 turns'}</td></tr>
  <tr>${ic('C_POUCH', '#a0522d')}<td>${zh ? '捕兽夹 — 放置一个伤害陷阱' : 'Bear Trap — Place a damage trap'}</td></tr>
  <tr>${ic('C_POUCH', '#888')}<td>${zh ? '烟幕弹 — 恐惧范围5格内敌人，使其逃跑' : 'Smoke Bomb — Fears enemies within range 5'}</td></tr>
  <tr>${ic('C_POUCH', '#4895ef')}<td>${zh ? '护身石 — 完全抵挡下一次伤害' : 'Ward Stone — Blocks next hit completely'}</td></tr>
  <tr>${ic('P_GENERIC', '#06d6a0')}<td>${zh ? '加速药水 — 获得一次额外行动机会' : 'Haste — Grants one free extra turn'}</td></tr>
  <tr>${ic('P_GENERIC', '#80ed99')}<td>${zh ? '解毒剂 — 治愈中毒并给予临时抗性' : 'Antidote — Cures poison + temp resist'}</td></tr>
  <tr>${ic('C_POUCH', '#ffd700')}<td>${zh ? '圣水 — 对亡灵/恶魔造成双倍神圣伤害' : 'Holy Water — 2x holy dmg to undead/demons'}</td></tr>
  <tr>${ic('C_POUCH', '#4895ef')}<td>${zh ? '回城石 — 传送回楼层起点' : 'Recall Stone — Teleport to floor start'}</td></tr>
  <tr>${ic('C_POUCH', '#2f4f4f')}<td>${zh ? '暗影斗篷 — 隐身10回合' : 'Shadow Cloak — Invisible for 10 turns'}</td></tr></table>
  <h3 style="color:#e63946;margin-top:10px">${zh ? '🗺️ 特殊地形' : '🗺️ Special Tiles'}</h3>
  <table><tr>${ic('FOUNTAIN', '#4895ef')}<td>${zh ? '魔法喷泉 — 踩上去恢复HP和MP（一次性）' : 'Fountain — Restores HP & MP (one use)'}</td></tr>
  <tr>${ic('SHRINE', '#06d6a0')}<td>${zh ? '古代神殿 — 踩上去随机提升属性（一次性）' : 'Shrine — Random stat boost (one use)'}</td></tr>
  <tr>${ic('STAIR', '#7ec8e3')}<td>${zh ? '下楼楼梯 — 按>键进入下一层' : 'Stairs — Press > to descend'}</td></tr>
  <tr>${ic('TRAP', '#a0522d')}<td>${zh ? '陷阱 — 踩上去受到伤害或负面效果' : 'Trap — Damage or negative effect'}</td></tr></table>
  <h3 style="color:#e63946;margin-top:10px">${zh ? '💡 新手提示' : '💡 Tips'}</h3>
  <ul style="color:#aaa;padding-left:20px;line-height:1.8">
  <li>${zh ? '每层尽量探索完所有房间再下楼' : 'Explore all rooms before descending'}</li>
  <li>${zh ? '走到物品上会自动拾取' : 'Walking over items auto-picks them up'}</li>
  <li>${zh ? '善用技能（K键），冷却时间到了就用' : 'Use your skill (K) whenever off cooldown'}</li>
  <li>${zh ? '升级后按N键分配天赋点数' : 'Press N after level-up to spend talent points'}</li>
  <li>${zh ? '收集同套装装备可获得套装加成' : 'Collect matching set pieces for set bonuses'}</li>
  <li>${zh ? 'Ctrl+S保存进度！' : 'Remember to Ctrl+S to save!'}</li></ul>`;
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
  row.innerHTML = `<div class="skn">${lang === 'zh' ? sk.name.zh : sk.name.en}</div><div class="skc">${sk.cost} MP</div><div class="skd">${lang === 'zh' ? sk.desc.zh : sk.desc.en}</div>${cdLeft > 0 ? `<div class="skcd">CD: ${cdLeft}</div>` : ''}`;
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
    d.innerHTML = `<span class="aic">${a.icon}</span><div><div class="ain">${lang === 'zh' ? a.n.zh : a.n.en}</div><div class="aid">${lang === 'zh' ? a.d.zh : a.d.en}</div></div>`;
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
  const zh = lang === 'zh';
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

      const name = zh ? node.n.zh : node.n.en;
      const desc = zh ? node.desc.zh : node.desc.en;
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
