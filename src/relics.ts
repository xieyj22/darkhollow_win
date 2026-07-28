// Relic system — run-defining passive artifacts (auto-drop MVP).
// Effects hook into combat via the SAME pattern as talents.ts:
//   applyRelicBonuses (recalc) · relicOnHitEnemy · relicOnDamaged · relicOnDeath
// plus gold/XP multipliers. Acquired automatically on boss (always) & elite (40%) kills.
// Relic list lives in data.ts (RELICS); this module owns effect interpretation + grants.
import type { Player, Enemy } from './types.js';
import { G, lang } from './state.js';
import { RELICS } from './data.js';
import { addMsg } from './messages.js';
import { flt } from './effects.js';
import { fxFlash, fxBurst } from './fx.js';
import { snd } from './audio.js';

// Late-bound combat fns to avoid a circular import with combat.ts
let _recalc: (() => void) | null = null;
let _killEnemy: ((e: Enemy) => void) | null = null;
export function setRecalcFn(fn: () => void): void { _recalc = fn; }
export function setKillEnemyFn(fn: (e: Enemy) => void): void { _killEnemy = fn; }

export function hasRelic(id: string): boolean {
  return !!G?.player.relics?.includes(id);
}

// ===== Static stat bonuses — called from recalc(), after talent bonuses =====
export function applyRelicBonuses(p: Player): void {
  for (const id of (p.relics || [])) {
    switch (id) {
      case 'war_totem': p.atk += Math.floor(p.baseAtk * 0.15); break;
      case 'assassin_sigil': p.critChance += 0.12; break;
      case 'stone_skin': p.def += 5; break;
      case 'giants_belt': p.maxHp += 40; break;
      case 'worn_amulet': p.maxHp += 10; break;
      case 'arcane_focus': p.spellPower += 0.25; break;
    }
  }
}

// ===== On-hit — returns possibly-modified damage, may apply bonus effects =====
export function relicOnHitEnemy(defender: Enemy, dmg: number): number {
  if (!G) return dmg;
  const p = G.player;

  // executioners_axe: +40% dmg to foes below 30% HP
  if (hasRelic('executioners_axe') && defender.hp / defender.maxHp < 0.3) {
    dmg = Math.floor(dmg * 1.4);
  }

  // ember_core: bonus fire damage every hit
  if (hasRelic('ember_core') && defender.hp > 0) {
    const bonus = 5 + Math.floor(p.level * 0.5);
    defender.hp -= bonus;
    flt(defender.x, defender.y, `-${bonus}🔥`, '#ff7a45');
    if (defender.hp <= 0) return dmg;
  }

  // frost_heart: bonus ice + 20% chance to slow
  if (hasRelic('frost_heart') && defender.hp > 0) {
    const bonus = 4 + Math.floor(p.level * 0.4);
    defender.hp -= bonus;
    flt(defender.x, defender.y, `-${bonus}❄`, '#7ec8e3');
    if (Math.random() < 0.2) defender.stunned = Math.max(defender.stunned, 1);
  }

  // vampiric_fang: heal 15% of damage dealt
  if (hasRelic('vampiric_fang') && dmg > 0) {
    const heal = Math.floor(dmg * 0.15);
    if (heal > 0) {
      p.hp = Math.min(p.maxHp, p.hp + heal);
      flt(p.x, p.y, `+${heal}`, '#b5179e');
    }
  }

  return dmg;
}

// ===== On taking damage — thorns reflect =====
export function relicOnDamaged(attacker: Enemy, dmg: number): void {
  if (!G) return;
  if (hasRelic('thorned_bramble') && dmg > 0 && attacker.hp > 0) {
    const reflect = Math.max(1, Math.floor(dmg * 0.3));
    attacker.hp -= reflect;
    flt(attacker.x, attacker.y, `-${reflect}🌵`, '#06d6a0');
    if (attacker.hp <= 0 && _killEnemy) _killEnemy(attacker);
  }
}

// ===== On death — revive check =====
export function relicOnDeath(): boolean {
  if (!G) return false;
  const p = G.player;
  if (hasRelic('phoenix_heart') && !p.hasRevived) {
    p.hp = Math.floor(p.maxHp * 0.5);
    p.mp = Math.floor(p.maxMp * 0.5);
    p.hasRevived = true;
    p.buffs = []; p.poisonTurns = 0;
    addMsg(lang === 'zh' ? '🔥 凤凰之心！你从灰烬中复活！' : '🔥 Phoenix Heart! You rise from the ashes!', 'ml');
    flt(p.x, p.y, '🔥REVIVE', '#ff6b35');
    fxFlash(p.x, p.y, '#ff6b35', 2); fxBurst(p.x, p.y, '#ff6b35', 24, 1.5);
    snd('victory');
    _recalc?.();
    return true;
  }
  return false;
}

// ===== On kill — restore MP (soul_harvester) =====
export function relicOnKill(_enemy: Enemy): void {
  if (!G) return;
  const p = G.player;
  if (hasRelic('soul_harvester')) {
    const mp = Math.floor(p.maxMp * 0.10);
    if (mp > 0) { p.mp = Math.min(p.maxMp, p.mp + mp); flt(p.x, p.y, `+${mp}MP`, '#9b5de5'); }
  }
}

// ===== On dodge — heal HP (wind_step) =====
export function relicOnDodge(): void {
  if (!G) return;
  const p = G.player;
  if (hasRelic('wind_step')) {
    const hp = Math.floor(p.maxHp * 0.08);
    if (hp > 0) { p.hp = Math.min(p.maxHp, p.hp + hp); flt(p.x, p.y, `+${hp}`, '#80ed99'); }
  }
}

// ===== On crit — lifesteal (executioner_pact) =====
export function relicOnCrit(_defender: Enemy, dmg: number): void {
  if (!G) return;
  const p = G.player;
  if (hasRelic('executioner_pact')) {
    const heal = Math.floor(dmg * 0.15);
    if (heal > 0) { p.hp = Math.min(p.maxHp, p.hp + heal); flt(p.x, p.y, `+${heal}`, '#ff6b6b'); }
  }
}

// ===== Economy multipliers =====
export function getRelicGoldMult(): number { return hasRelic('greed_idol') ? 1.3 : 1; }
export function getRelicExpMult(): number { return hasRelic('scholar_lens') ? 1.25 : 1; }

// ===== Grant =====
export function grantRelic(id: string, x: number, y: number): void {
  if (!G) return;
  const p = G.player;
  if (!p.relics) p.relics = [];
  if (p.relics.includes(id)) return;
  const def = RELICS.find(r => r.id === id);
  if (!def) return;
  p.relics.push(id);
  _recalc?.();
  const name = lang === 'zh' ? def.n.zh : def.n.en;
  addMsg(lang === 'zh' ? `🏺 获得圣物：${name}！` : `🏺 Relic acquired: ${name}!`, 'mach');
  flt(x, y, '🏺' + (lang === 'zh' ? '圣物' : 'RELIC'), '#ffd700');
  fxFlash(x, y, def.c, 1.8); fxBurst(x, y, def.c, 18, 1.3);
  snd('ach');
}

// Pick a weighted-random relic the player doesn't own, capped by depth.
export function grantRandomRelic(x: number, y: number, floor: number): void {
  if (!G) return;
  const owned = new Set(G.player.relics || []);
  const pool = RELICS.filter(r => !owned.has(r.id));
  if (!pool.length) return; // all owned — nothing to grant
  const maxR = floor >= 30 ? 4 : floor >= 15 ? 3 : 2;
  const avail = pool.filter(r => r.rarity <= maxR);
  const candidates = avail.length ? avail : pool;
  // Weight: lower rarity is more common (rarity r → ~100 / 2^r tickets)
  const weighted: typeof RELICS = [];
  for (const r of candidates) {
    const rar = Math.max(0, Math.min(4, r.rarity ?? 1));
    const w = Math.max(1, Math.floor(100 / Math.pow(2, rar)));
    for (let i = 0; i < w; i++) weighted.push(r);
  }
  const pick = weighted[Math.floor(Math.random() * weighted.length)];
  grantRelic(pick.id, x, y);
}
