// Meta progression system — Soul Echoes, The Forge, persistent achievements, run stats
import type { MetaSave, MetaStats, SoulEchoBreakdown, Player, RunRecord } from './types.js';
import { lang } from './state.js';
import { META_UPGRADES, ACH_DEFS, RELICS } from './data.js';
import { snd } from './audio.js';
import { t, tx } from './i18n.js';
import { addMsg } from './messages.js';
import { paintIcon } from './sprites.js';

const META_KEY = 'dh_meta';

// ===== Core Meta Save =====

function defaultStats(): MetaStats {
  return {
    totalRuns: 0, bestFloor: 0, totalKills: 0, totalBossKills: 0,
    totalGold: 0, totalTurns: 0, wins: 0, deaths: 0,
    bestStreak: 0, highestLevel: 0, classesWon: [], bestEndlessFloor: 0,
  };
}

export function initMeta(): MetaSave {
  return {
    version: 1, soulEchoes: 0, totalSpent: 0,
    upgrades: {}, achievements: [], stats: defaultStats(),
    runHistory: [], endlessLeaderboard: [],
    unlockedLore: [],
    discoveredItems: [],
    seenMechanics: [],
    wardens: [],
  };
}

export function getMeta(): MetaSave {
  try {
    const d = localStorage.getItem(META_KEY);
    if (d) {
      const m = JSON.parse(d) as MetaSave;
      if (!m.stats) m.stats = defaultStats();
      if (!m.upgrades) m.upgrades = {};
      if (!m.achievements) m.achievements = [];
      if (m.stats.classesWon === undefined) m.stats.classesWon = [];
      if (m.stats.bestEndlessFloor === undefined) m.stats.bestEndlessFloor = 0;
      if (!m.runHistory) m.runHistory = [];
      if (!m.endlessLeaderboard) m.endlessLeaderboard = [];
      if (!m.unlockedLore) m.unlockedLore = [];
      if (!m.discoveredItems) m.discoveredItems = [];
      if (!m.seenMechanics) m.seenMechanics = [];
      if (!m.wardens) m.wardens = [];
      return m;
    }
  } catch { /* fall through */ }
  return initMeta();
}

export function saveMeta(m: MetaSave): void {
  localStorage.setItem(META_KEY, JSON.stringify(m));
}

// Record a finished run: push to recent history (newest first, cap 20); endless
// runs also enter the leaderboard ranked by floor then kills (cap 10).
export function recordRun(rec: RunRecord): void {
  const m = getMeta();
  m.runHistory.unshift(rec);
  if (m.runHistory.length > 20) m.runHistory.length = 20;
  if (rec.mode === 'endless') {
    m.endlessLeaderboard.push({ floor: rec.floor, kills: rec.kills, classIdx: rec.classIdx, turns: rec.turns, gold: rec.gold, ts: rec.ts });
    m.endlessLeaderboard.sort((a, b) => b.floor - a.floor || b.kills - a.kills);
    if (m.endlessLeaderboard.length > 10) m.endlessLeaderboard.length = 10;
  }
  saveMeta(m);
}

// ===== Soul Echo Calculation =====

export function calculateSoulEchoes(
  kills: number, floor: number, bossesKilled: number,
  gold: number, bestStreak: number, victory: boolean,
): SoulEchoBreakdown {
  const b: SoulEchoBreakdown = {
    kills: Math.floor(kills * 0.5),
    floor: floor * 3,
    bosses: bossesKilled * 15,
    gold: Math.floor(gold * 0.02),
    streak: bestStreak * 2,
    victory: victory ? 500 : 0,
    total: 0,
  };
  b.total = b.kills + b.floor + b.bosses + b.gold + b.streak + b.victory;

  // Apply soul_bonus meta upgrade
  const meta = getMeta();
  const soulBonusLevel = meta.upgrades['soul_bonus'] || 0;
  if (soulBonusLevel > 0) {
    b.total = Math.floor(b.total * (1 + soulBonusLevel * 0.1));
  }

  return b;
}

// ===== Upgrade Purchasing =====

export function purchaseUpgrade(id: string): boolean {
  const meta = getMeta();
  const def = META_UPGRADES.find(u => u.id === id);
  if (!def) return false;
  const level = meta.upgrades[id] || 0;
  if (level >= def.maxLevel) return false;
  const cost = def.costs[level];
  if (cost === undefined || meta.soulEchoes < cost) return false;
  meta.soulEchoes -= cost;
  meta.totalSpent += cost;
  meta.upgrades[id] = level + 1;
  saveMeta(meta);
  return true;
}

export function getUpgradeLevel(id: string): number {
  return (getMeta().upgrades[id] || 0);
}

export function getUpgradeCost(id: string): number {
  const def = META_UPGRADES.find(u => u.id === id);
  if (!def) return 0;
  const level = getUpgradeLevel(id);
  if (level >= def.maxLevel) return 0;
  return def.costs[level];
}

// ===== Apply Meta Upgrades to New Player =====

export function applyMetaUpgrades(p: Player, endless: boolean): void {
  const meta = getMeta();
  const u = meta.upgrades;

  // Stats
  if (u['start_hp']) { const v = u['start_hp'] * 10; p.maxHp += v; p.hp += v; p.baseMaxHp += v; }
  if (u['start_mp']) { const v = u['start_mp'] * 5; p.maxMp += v; p.mp += v; }
  if (u['start_atk']) { const v = u['start_atk']; p.atk += v; p.baseAtk += v; }
  if (u['start_def']) { const v = u['start_def']; p.def += v; p.baseDef += v; }
  if (u['start_gold']) { p.gold += u['start_gold'] * 15; }
  if (u['start_food']) { p.hunger = Math.min(p.maxHunger, p.hunger + u['start_food'] * 20); }

  // Derived stats
  if (u['crit_bonus']) { const v = u['crit_bonus'] * 0.03; p.critChance += v; p.baseCritChance += v; }
  if (u['dodge_bonus']) { const v = u['dodge_bonus'] * 0.02; p.dodgeChance += v; p.baseDodgeChance += v; }
  if (u['heal_bonus']) { p.healBonus += u['heal_bonus'] * 0.05; }

  // Talent points
  if (u['extra_talent']) { p.talents.points += u['extra_talent']; }

  // Gameplay-altering metas (Wave 4-C4)
  if (u['start_relic']) {
    const pool = RELICS.filter(r => r.rarity === 1);
    if (pool.length) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (!p.relics) p.relics = [];
      if (!p.relics.includes(pick.id)) p.relics.push(pick.id);
    }
  }
  if (u['blood_pact']) {
    const lv = u['blood_pact'];
    const delta = 10 * lv;
    p.baseMaxHp -= delta;
    p.maxHp -= delta;
    p.hp -= delta;
    p.talents.points += lv;
  }
  // Endless-only meta upgrades (Task 4): apply only during endless runs.
  // `endless` is passed explicitly by createPlayer (called from initGame BEFORE
  // setGameState binds G), so we must NOT read G here — it would be stale/undefined.
  if (endless) {
    const voidResist = u['void_resist'] || 0;
    for (const el of ['fire', 'ice', 'lightning', 'shadow', 'holy'] as const) {
      p.elRes[el] = (p.elRes[el] || 0) + voidResist * 0.10;
    }
    const might = u['endless_might'] || 0;
    p.atk += Math.floor(p.baseAtk * might * 0.05);
    p.spellPower += p.baseSpellPower * might * 0.05;
  }
}

// Endless meta multipliers (Task 4): consumed by item-gen (drop rate) + combat (corruption).
export function endlessLuckMult(): number {
  return 1 + (getMeta().upgrades['endless_luck'] || 0) * 0.20;
}
export function corruptionWardMult(): number {
  return 1 - (getMeta().upgrades['corruption_ward'] || 0) * 0.15;
}

// Get meta FOV bonus
export function getMetaFovBonus(): number {
  return (getMeta().upgrades['fov_bonus'] || 0);
}

// Get meta gold bonus multiplier
export function getMetaGoldBonus(): number {
  const level = getMeta().upgrades['gold_bonus'] || 0;
  return 1 + level * 0.1;
}

// Apply gold bonus to a raw gold amount (for convenience)
export function bonusGold(raw: number): number {
  return Math.floor(raw * getMetaGoldBonus());
}

// Get meta EXP bonus multiplier
export function getMetaExpBonus(): number {
  const level = getMeta().upgrades['exp_bonus'] || 0;
  return 1 + level * 0.1;
}

// Apply EXP bonus to a raw XP amount (for convenience)
export function bonusExp(raw: number): number {
  return Math.floor(raw * getMetaExpBonus());
}

// ===== Achievement Persistence =====

export function creditSoulEchoes(amount: number): void {
  if (amount <= 0) return;
  const meta = getMeta();
  meta.soulEchoes += amount;
  saveMeta(meta);
}

export function persistAchievement(id: string): void {
  const meta = getMeta();
  if (!meta.achievements.includes(id)) {
    meta.achievements.push(id);
    saveMeta(meta);
  }
}

// Unlock a Lore Codex entry (Wave 8). Idempotent + persisted to dh_meta.
export function unlockLore(id: string): void {
  const meta = getMeta();
  if (!meta.unlockedLore.includes(id)) {
    meta.unlockedLore.push(id);
    saveMeta(meta);
    addMsg(t('codex.updated'), 'mi');   // Batch2 ④: silent unlocks no more
  }
}

// Record a discovered item/relic for the Item Codex + first-pickup intro popup.
// Returns true the first time a key is seen (caller uses this to decide whether
// to show the intro card), false on repeats. Idempotent + persisted to dh_meta.
export function discoverItem(key: string): boolean {
  const meta = getMeta();
  if (!meta.discoveredItems.includes(key)) {
    meta.discoveredItems.push(key);
    saveMeta(meta);
    return true;
  }
  return false;
}

// Batch2 ④: mechanic tutorial cards — once per career, like item intros.
export function discoverMechanic(key: string): boolean {
  const meta = getMeta();
  if (!meta.seenMechanics.includes(key)) {
    meta.seenMechanics.push(key);
    saveMeta(meta);
    return true;
  }
  return false;
}

// Record a descender who died at 100 corruption — they become a Warden that
// hunts future runs (Playtest #9 Phase 3). Cap 10, newest first.
export function recordWardenLegacy(name: string, cls: number, race: number, floor: number): void {
  const m = getMeta();
  m.wardens.unshift({ name, cls, race, floor, ts: Date.now() });
  if (m.wardens.length > 10) m.wardens.length = 10;
  saveMeta(m);
}

// ===== Run Stats Update =====

export function updateRunStats(stats: {
  floor: number; kills: number; bossesKilled: number;
  gold: number; turns: number; won: boolean; level: number;
  bestStreak: number; classIdx: number;
  endless?: boolean; endlessFloor?: number;
}): void {
  const meta = getMeta();
  meta.stats.totalRuns++;
  meta.stats.bestFloor = Math.max(meta.stats.bestFloor, stats.floor);
  meta.stats.totalKills += stats.kills;
  meta.stats.totalBossKills += stats.bossesKilled;
  meta.stats.totalGold += stats.gold;
  meta.stats.totalTurns += stats.turns;
  if (stats.won) {
    meta.stats.wins++;
    if (!meta.stats.classesWon.includes(stats.classIdx)) {
      meta.stats.classesWon.push(stats.classIdx);
    }
  } else {
    meta.stats.deaths++;
  }
  meta.stats.bestStreak = Math.max(meta.stats.bestStreak, stats.bestStreak);
  meta.stats.highestLevel = Math.max(meta.stats.highestLevel, stats.level);
  // Endless score: deepest floor reached in an endless run.
  if (stats.endless && stats.endlessFloor) {
    meta.stats.bestEndlessFloor = Math.max(meta.stats.bestEndlessFloor, stats.endlessFloor);
  }
  saveMeta(meta);
}

// ===== Forge UI Rendering =====

let forgeActiveTab = 'stats';

export function renderForge(): void {
  const meta = getMeta();
  const countEl = document.getElementById('forge-se-count');
  if (countEl) countEl.textContent = String(meta.soulEchoes);

  // Render tab buttons (rebuild every render so language switches update labels)
  const tabsEl = document.getElementById('forge-tabs');
  if (tabsEl) {
    const categories = [
      { id: 'stats', kind: 'T_SWORD', color: '#e05545', label: t('mt.catStats') },
      { id: 'survival', kind: 'T_HEART', color: '#80ed99', label: t('mt.catSurvival') },
      { id: 'talent', kind: 'T_STAR', color: '#ffd700', label: t('mt.catTalent') },
      { id: 'utility', kind: 'T_RUNE', color: '#4ad6c0', label: t('mt.catUtility') },
      { id: 'endless', kind: 'T_INFINITY', color: '#b266ff', label: t('mt.catEndless') },
    ];
    tabsEl.innerHTML = categories.map(c =>
      `<button class="forge-tab${c.id === forgeActiveTab ? ' active' : ''}" data-tab="${c.id}"><canvas class="lic ft-ic" width="16" height="16" data-kind="${c.kind}" data-color="${c.color}" aria-hidden="true"></canvas> ${c.label}</button>`
    ).join('');
    tabsEl.querySelectorAll<HTMLCanvasElement>('canvas.lic').forEach(cv => paintIcon(cv, cv.dataset.kind || 'T_RUNE', cv.dataset.color || META_DEFAULT_HUE));
    tabsEl.querySelectorAll('.forge-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        forgeActiveTab = (btn as HTMLElement).dataset.tab || 'stats';
        tabsEl!.querySelectorAll('.forge-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderForgeContent();
      });
    });
  }

  renderForgeContent();
}

// Batch3c T3: fallback hue for Forge upgrade defs without a per-def hue
// (multi-hue THEME_PAL templates ignore it). Cyan base marks the soul-echo
// meta-resource system.
const META_DEFAULT_HUE = '#4ad6c0';

function renderForgeContent(): void {
  const content = document.getElementById('forge-content');
  if (!content) return;
  const meta = getMeta();
  const upgrades = META_UPGRADES.filter(u => u.category === forgeActiveTab);

  let html = '';
  for (const def of upgrades) {
    const level = meta.upgrades[def.id] || 0;
    const maxed = level >= def.maxLevel;
    const cost = maxed ? 0 : def.costs[level];
    const canBuy = !maxed && meta.soulEchoes >= cost;
    let dots = '';
    for (let i = 0; i < def.maxLevel; i++) dots += i < level ? '●' : '○';
    html += `<div class="forge-upgrade${maxed ? ' maxed' : ''}">
      <div class="fu-icon"><canvas class="lic fu-ic" width="16" height="16" data-kind="${def.tpl || 'T_RUNE'}" data-color="${def.hue || META_DEFAULT_HUE}" aria-hidden="true"></canvas></div>
      <div class="fu-info">
        <div class="fu-name">${tx(def.n)}</div>
        <div class="fu-desc">${tx(def.d)}</div>
      </div>
      <div class="fu-dots">${dots}</div>
      <div class="fu-cost">${maxed ? t('mt.maxed') : cost + ' 💀'}</div>
      <button class="fu-buy${canBuy ? '' : ' disabled'}" data-uid="${def.id}" ${canBuy ? '' : 'disabled'}>
        ${maxed ? '✓' : t('mt.buy')}
      </button>
    </div>`;
  }
  if (!upgrades.length) html = `<div style="color:#666;text-align:center;padding:20px">${t('mt.noUpgrades')}</div>`;
  content.innerHTML = html;

  // Batch3c T3: paint the theme sprites now that the rows are in the DOM.
  content.querySelectorAll<HTMLCanvasElement>('canvas.lic').forEach(cv => paintIcon(cv, cv.dataset.kind || 'T_RUNE', cv.dataset.color || META_DEFAULT_HUE));

  // Bind buy buttons
  content.querySelectorAll('.fu-buy:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      const uid = (btn as HTMLElement).dataset.uid!;
      if (purchaseUpgrade(uid)) {
        snd('pickup');
        renderForge(); // Re-render entire forge to update counts
      }
    });
  });
}

// ===== Title Screen Stats =====

export function renderTitleStats(): void {
  const el = document.getElementById('title-stats');
  if (!el) return;
  const meta = getMeta();
  const s = meta.stats;
  el.innerHTML =
    `<span class="ts-item">💀 ${t('mt.soulEchoes')}: <b>${meta.soulEchoes}</b></span>` +
    `<span class="ts-item">⚔ ${t('mt.runs')}: ${s.totalRuns}</span>` +
    `<span class="ts-item">🏔 ${t('mt.best')}: F${s.bestFloor}</span>` +
    `<span class="ts-item">🏆 ${t('mt.wins')}: ${s.wins}</span>` +
    `<span class="ts-item">💀 ${t('mt.totalKills')}: ${s.totalKills}</span>` +
    `<span class="ts-item"><canvas class="lic ts-ic" width="16" height="16" data-kind="T_BOOK" data-color="#8a5de5" aria-hidden="true"></canvas> ${t('mt.achv')}: ${meta.achievements.length}/${ACH_DEFS.length}</span>`;
  el.querySelectorAll<HTMLCanvasElement>('canvas.lic').forEach(cv => paintIcon(cv, cv.dataset.kind || 'T_RUNE', cv.dataset.color || '#8a5de5'));
}

// ===== Echo Breakdown Display =====

export function renderEchoBreakdown(containerId: string, echoes: SoulEchoBreakdown): void {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML =
    `<div class="echo-breakdown">` +
    `<h3>💀 ${t('mt.soulEchoes')}: +${echoes.total}</h3>` +
    `<div class="eb-row"><span>${t('mt.kills')}</span><span>+${echoes.kills}</span></div>` +
    `<div class="eb-row"><span>${t('mt.floor')}</span><span>+${echoes.floor}</span></div>` +
    `<div class="eb-row"><span>${t('mt.bosses')}</span><span>+${echoes.bosses}</span></div>` +
    `<div class="eb-row"><span>${t('mt.gold')}</span><span>+${echoes.gold}</span></div>` +
    `<div class="eb-row"><span>${t('mt.streak')}</span><span>+${echoes.streak}</span></div>` +
    (echoes.victory > 0 ? `<div class="eb-row"><span>${t('mt.victory')}</span><span>+${echoes.victory}</span></div>` : '') +
    `<div class="eb-row total"><span>${t('mt.total')}</span><span>+${echoes.total}</span></div>` +
    `</div>`;
}
