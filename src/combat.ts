// Combat system — attack, level up, death, victory
import type { Enemy, Combatant, Element, Item, SoulEchoBreakdown, Player } from './types.js';
import { G, lang, eventOpen } from './state.js';
import { clearCloudSave } from './cloud-sync.js';
import { FINAL } from './config.js';
import { rng, dst, escHtml } from './utils.js';
import { snd, setBgmScene } from './audio.js';
import { flt, shake } from './effects.js';
import { fxFlash, fxBurst, fxAura } from './fx.js';
import { applyRelicBonuses, relicOnHitEnemy, relicOnDamaged, relicOnDeath, getRelicGoldMult, getRelicExpMult, grantRandomRelic, grantRelic, relicOnKill, relicOnDodge, relicOnCrit, hasRelic } from './relics.js';
import { unlockAchievement } from './steam.js';
import { t, tMsg, tx, RARITY_C } from './i18n.js';
import { ACH_DEFS, EQUIPMENT_SETS } from './data.js';
import { addMsg } from './messages.js';
import { processBossPhase } from './enemies.js';
import { pickWardenRelic, nextWardenMemory, wardenMemoryText } from './warden.js';
import { corruptionMods, addCorruption, TIER_LABEL, TIER_COLOR } from './corruption.js';
import { ENDINGS, endingForChoice, canRefuse } from './endings.js';
import {
  applyTalentBonuses, onPlayerHitEnemy, onPlayerKill, onPlayerDodged,
  onPlayerDamaged, onPlayerDeath, onEnemyHitPlayer, checkDoubleStrike,
  getCritMultiplier, getManaShieldReduction,
} from './talents.js';
import { genEndlessGear, endlessLuckMult } from './item-gen.js';
import { calculateSoulEchoes, updateRunStats, persistAchievement, renderEchoBreakdown, bonusGold, bonusExp, getMeta, creditSoulEchoes, recordRun, unlockLore, recordWardenLegacy, corruptionWardMult, recordEcho, pickKeepsake } from './meta.js';
import { queueMechanicIntro, resetIntros } from './item-intro.js';
import { buildEpitaph, quoteFlavor, type DeathCause } from './epitaph.js';
import { bridge } from './bridge.js';

// Late-bound dependency to break circular import with items.ts
let _genItem: ((floor: number) => any) | null = null;
export function setGenItemFn(fn: (floor: number) => any): void { _genItem = fn; }

// ===== Element System =====

const ELEMENT_SYMBOLS: Record<string, string> = {
  fire: '🔥', ice: '❄', lightning: '⚡', shadow: '💀', holy: '✨', none: '',
};

const ELEMENT_CHART: Record<string, { strong: string[], weak: string[] }> = {
  fire:      { strong: ['ice'],       weak: ['lightning'] },
  ice:       { strong: ['lightning'], weak: ['fire'] },
  lightning: { strong: ['shadow'],    weak: ['ice'] },
  shadow:    { strong: ['holy'],      weak: ['lightning'] },
  holy:      { strong: ['shadow'],    weak: ['fire'] },
};

export function getElementMult(atkEl: Element, defEl: Element): number {
  if (atkEl === 'none' || defEl === 'none') return 1;
  const chart = ELEMENT_CHART[atkEl];
  if (!chart) return 1;
  if (chart.strong.includes(defEl)) return 1.5;
  if (chart.weak.includes(defEl)) return 0.5;
  return 1;
}

export function getElementSymbol(el: string): string {
  return ELEMENT_SYMBOLS[el] || '';
}

// Element → flash/particle color for combat FX
const FX_EL_COLOR: Record<string, string> = {
  fire: '#ff7a45', ice: '#7ec8e3', lightning: '#fff2a8', shadow: '#b583f6', holy: '#ffd700', none: '#ffffff',
};

/**
 * Decide whether a melee-kill loot drop should come from the endless-exclusive
 * pool (genEndlessGear) vs the normal _genItem bridge. Boss/elite kills on F41+
 * endless ALWAYS yield exclusive gear (spec §2.2: "boss/精英 F41+ 必掉一件专属
 * 装备"); other F41+ foes roll against 0.5×luckMult. The caller passes the random
 * roll (0..1) so this is a pure, fully-testable predicate. Returns false for any
 * non-endless / sub-F41 scenario so normal-mode (F1-40) drops are entirely unchanged.
 */
export function endlessLootIsExclusive(
  floor: number, isBoss: boolean | undefined, isElite: boolean | undefined,
  endless: boolean | undefined, roll: number, luckMult: number,
): boolean {
  if (!endless || floor < 41) return false;
  if (isBoss || isElite) return true;
  return roll < 0.5 * luckMult;
}

export function attack(atk: Combatant, def: Combatant, isP: boolean): boolean {
  if (!G) return false;
  let dmg = Math.max(1, atk.atk - def.def + rng(-2, 2));

  // Dodge / ward — player dodging enemy attack
  if (!isP && G.player.warded) {
    G.player.warded = false;
    addMsg(t('cb.wardBlocks'), 'mi');
    flt(G.player.x, G.player.y, 'WARD!', '#4895ef'); snd('heal'); return false;
  }
  if (!isP && Math.random() < G.player.dodgeChance) {
    addMsg(t('dodgeMsg'), 'mi');
    onPlayerDodged(); // talent trigger: r_shadow_dance
    relicOnDodge(); // relic trigger: wind_step
    return false;
  }

  // Element damage calculation
  const atkEl: Element = atk.el || 'none';
  const defEl: Element = def.el || 'none';
  let elMult = getElementMult(atkEl, defEl);
  // Apply player element damage bonus from talents/sets
  if (isP && atkEl !== 'none' && G.player.elDmgBonus[atkEl]) {
    elMult += G.player.elDmgBonus[atkEl]! / 100;
  }
  // Apply defender resistance (negative = vulnerability, boosts damage)
  const defRes = def.res?.[atkEl] ?? 0;
  if (atkEl !== 'none' && defRes !== 0) {
    elMult *= (1 - defRes);
  }
  dmg = Math.max(1, Math.floor(dmg * elMult));

  // Mana Shield — reduce incoming damage when MP > 50%
  if (!isP) {
    const msr = getManaShieldReduction();
    if (msr > 0) dmg = Math.max(1, Math.floor(dmg * (1 - msr)));
  }

  const elSym = atkEl !== 'none' ? ' ' + ELEMENT_SYMBOLS[atkEl] : '';

  // Player attacks enemy
  if (isP) {
    // Talent trigger: modify damage before applying (executioner, etc.)
    dmg = onPlayerHitEnemy(def as Enemy, dmg);
    // Relic on-hit (execute, elemental bonus, lifesteal)
    dmg = relicOnHitEnemy(def as Enemy, dmg);

    // Critical hit (with talent crit multiplier)
    if (Math.random() < G.player.critChance) {
      const critMult = getCritMultiplier();
      dmg = Math.floor(dmg * critMult);
      relicOnCrit(def as Enemy, dmg); // relic trigger: executioner_pact
      addMsg(tx({ en: `CRIT! You deal ${dmg}${elSym} to ${def.name}!`, zh: `暴击！对${def.name}造成${dmg}伤害${elSym}！` }), 'mc');
      fxFlash(def.x, def.y, atkEl !== 'none' ? FX_EL_COLOR[atkEl] : '#ffd700', 1.6);
      flt(def.x, def.y, `-${dmg} CRIT!${elSym}`, '#ffd700', 'crit'); snd('crit'); shake(2, def.x - G.player.x, def.y - G.player.y);
    } else {
      addMsg(tMsg('cb.hitEnemy', String(def.name), String(dmg), elSym), 'mc');
      fxFlash(def.x, def.y, atkEl !== 'none' ? FX_EL_COLOR[atkEl] : (def.c || '#ff6b6b'));
      flt(def.x, def.y, `-${dmg}${elSym}`, '#ff6b6b'); snd('hit'); shake(1, def.x - G.player.x, def.y - G.player.y);
    }
  } else {
    // Enemy attacks player
    addMsg(tMsg('cb.enemyHitsYou', atk.name || 'Enemy', String(dmg), elSym), 'mc');
    fxFlash(G.player.x, G.player.y, '#e63946');
    flt(G.player.x, G.player.y, `-${dmg}${elSym}`, '#e63946'); snd('hit'); shake(1.4, G.player.x - atk.x, G.player.y - atk.y);
  }

  // Corruption: deeper tiers take extra damage (Playtest #9; def is the player here when !isP).
  if (!isP) dmg = Math.floor(dmg * (1 + corruptionMods(G.player.corruption).dmgTakenPct / 100));

  def.hp -= dmg;

  // Corruption accrual: a shadow-element hit corrupts the player (Playtest #9)
  if (!isP && atkEl === 'shadow') applyCorruption(1);

  // Lifesteal
  if (atk.ai === 'lifesteal' && dmg > 0 && atk.hp !== undefined && atk.maxHp !== undefined) {
    const h = Math.floor(dmg / 3);
    (atk as Enemy).hp = Math.min(atk.maxHp, atk.hp + h);
    addMsg(tMsg('cb.lifesteal', String(atk.name), String(h)), 'mc');
  }

  // Boss phase check
  if ((def as Enemy).isBoss && def.hp > 0) {
    processBossPhase(def as Enemy);
  }

  if (def.hp <= 0) {
    if (isP) {
      fxBurst(def.x, def.y, def.c || (atkEl !== 'none' ? FX_EL_COLOR[atkEl] : '#ff6b6b'), def.isBoss ? 26 : 12, def.isBoss ? 1.6 : 1);
      // Melee-only gold flavor message + pickup cue — fired BEFORE grantKillRewards
      // so they still play on an F40 Creator-kill victory (OLD had these at L146-147,
      // before the boss/victory block). killEnemy never printed these.
      addMsg(tMsg('cb.foundGold', String(bonusGold((def as Enemy).goldDrop))), 'mp');
      snd('pickup');
      grantKillRewards(def as Enemy);
      // Boss-victory guard: grantKillRewards just called playerVictory(); preserve
      // the old early `return true` which fired before loot drop / double-strike.
      if (G.won) return true;
      // Loot drop — melee-only (skill/scroll/ally kills via killEnemy drop no loot)
      // Endless F41+: bosses/elite always drop AND the drop is forced to exclusive
      // endless gear (spec §2.2); other F41+ foes roll 0.5×luckMult for exclusive
      // gear, else the normal _genItem bridge. Normal mode F1-40 unchanged.
      const endlessBossGuarantee = G.endless && G.floor >= 41 && (def.isBoss || def.isElite);
      if ((endlessBossGuarantee || Math.random() < .3) && _genItem) {
        const loot = endlessLootIsExclusive(G.floor, def.isBoss, def.isElite, G.endless, Math.random(), endlessLuckMult())
          ? genEndlessGear(G.floor) : _genItem(G.floor);
        loot.x = def.x; loot.y = def.y;
        G.items.push(loot);
        // Batch2 ⑧: loot lands with a rarity-colored burst.
        fxBurst(loot.x, loot.y, RARITY_C[loot.rarity] || loot.c || '#c0c0c0', 6, 0.5);
        addMsg(tMsg('cb.enemyDropped', String(def.name), String(loot.name)), 'mp');
        if (loot.rarity >= 4) checkAch('legendary');
      }

      // Talent trigger: double strike (15% chance to attack again)
      if (checkDoubleStrike() && (def as Enemy).hp <= 0) {
        // Find another adjacent enemy to hit
        const nextTarget = G!.enemies.find(e => !e.isAlly && dst(e.x, e.y, G!.player.x, G!.player.y) <= 1.5);
        if (nextTarget) {
          addMsg(t('cb.doubleStrike'), 'mc');
          attack(G.player, nextTarget, true);
        }
      }
    } else {
      // Player takes fatal damage — check talent survival effects
      onPlayerDamaged(dmg);

      // Check if player died even after damage mods
      if (G.player.hp <= 0) {
        // Talent auto-revive check
        if (onPlayerDeath()) return false;
        // Relic revive (Phoenix Heart)
        if (relicOnDeath()) return false;
        // In the !isP branch `atk` is the attacking enemy and `def` is the player
        // (which has no `name`), so the killer's name is atk.name — not def.name
        // (which previously printed "slain by undefined").
        playerDeath(atk.name || 'Enemy');
      } else {
        // Player survived via cheat death / damage prevention
        // Enemy still gets counter-attack trigger
        onEnemyHitPlayer(atk as Enemy);
      }
    }
    return def.hp <= 0;
  }

  // Non-lethal enemy hit on player — talent triggers
  if (!isP) {
    onPlayerDamaged(dmg);
    onEnemyHitPlayer(atk as Enemy);
    relicOnDamaged(atk as Enemy, dmg);
  }

  return false;
}

export function checkLevelUp(): void {
  if (!G) return;
  const p = G.player;
  while (p.exp >= p.expNext) {
    p.exp -= p.expNext; p.level++; p.expNext = Math.floor(p.expNext * 1.5);
    const hg = rng(5, 12) + (p.ci === 0 ? 5 : p.ci === 3 ? 3 : 0);
    const mg = rng(2, 6) + (p.ci === 2 ? 5 : 0);
    const ag = rng(1, 3); const dg = rng(0, 2);
    p.maxHp += hg; p.maxMp += mg;
    p.hp = Math.min(p.hp + hg, p.maxHp); p.mp = Math.min(p.mp + mg, p.maxMp);
    p.baseAtk += ag; p.baseDef += dg; p.baseMaxHp += hg;
    // Grant talent point on level up (starting from level 2)
    p.talents.points++;
    recalc();
    addMsg(tMsg('cb.levelUp', String(p.level)), 'ml');
    addMsg(tMsg('cb.levelStats', String(hg), String(mg), String(ag), String(dg)), 'ml');
    // Batch2 ⑧: golden aura pulse on level-up.
    fxAura(p.x, p.y, '#ffd700', 1.6);
    flt(p.x, p.y, 'LEVEL UP!', '#ffd700'); snd('levelup'); checkAchs();
  }
}

export function recalc(): void {
  if (!G) return;
  const p = G.player;
  p.atk = p.baseAtk; p.def = p.baseDef; p.maxHp = p.baseMaxHp;
  p.elRes = {}; p.elDmgBonus = {}; p.healBonus = (getMeta().upgrades['heal_bonus'] || 0) * 0.05;
  // Reset set-grant stats so recalc can re-apply them from active set bonuses.
  p.setCorruptionResist = 0;
  // Reset derived stats to base values (set by class in createPlayer)
  p.critChance = p.baseCritChance;
  p.dodgeChance = p.baseDodgeChance;
  p.spellPower = p.baseSpellPower;
  p.critDamageBonus = 0; // Must reset to 0 before re-applying talent bonuses

  if (p.eq.weapon) {
    p.atk += p.eq.weapon.atk || 0;
  }
  if (p.eq.armor) {
    p.def += p.eq.armor.def || 0;
  }
  // Two accessory slots — bonuses from both stack (identical or different).
  for (const acc of [p.eq.accessory, p.eq.accessory2]) {
    if (acc) {
      p.atk += acc.atk || 0; p.def += acc.def || 0;
      p.maxHp += acc.hp || 0;
    }
  }

  // Buffs
  for (const b of p.buffs) {
    if (b.type === 'str_buff') p.atk += b.value;
    if (b.type === 'def_buff' || b.type === 'shield') p.def += b.value;
    if (b.type === 'el_res_fire') p.elRes['fire'] = (p.elRes['fire'] || 0) + b.value / 100;
    if (b.type === 'el_res_ice') p.elRes['ice'] = (p.elRes['ice'] || 0) + b.value / 100;
  }

  // Set bonuses
  p.setBonusActive = {};
  const equipped: Item[] = [p.eq.weapon, p.eq.armor, p.eq.accessory, p.eq.accessory2].filter((i): i is Item => i !== null);
  for (const item of equipped) {
    if (item.set) {
      p.setBonusActive[item.set] = (p.setBonusActive[item.set] || 0) + 1;
    }
  }
  // Apply set bonuses
  for (const setId of Object.keys(p.setBonusActive)) {
    const setDef = EQUIPMENT_SETS.find(s => s.id === setId);
    if (!setDef) continue;
    const count = p.setBonusActive[setId];
    for (const bonus of setDef.bonuses) {
      if (count >= bonus.required) {
        applySetBonus(p, bonus.type, bonus.value);
      }
    }
  }

  // Talent bonuses — delegated to talents.ts
  applyTalentBonuses(p);

  // Relic bonuses
  applyRelicBonuses(p);

  // Corruption tier mods (Playtest #9): deeper tiers trade survival for power.
  const cm = corruptionMods(p.corruption);
  p.spellPower += p.baseSpellPower * cm.spellPct / 100;
  p.critChance += cm.critPct / 100;
  p.atk += cm.atk;
  p.healBonus += cm.healPct / 100;

  // Clamp derived combat stats to sane caps (avoid 100%+ invincibility)
  p.critChance = Math.min(0.85, p.critChance);
  p.dodgeChance = Math.min(0.75, p.dodgeChance);
  for (const el of Object.keys(p.elRes) as Element[]) {
    if (p.elRes[el]! > 0.8) p.elRes[el] = 0.8;
  }

  if (p.hp > p.maxHp) p.hp = p.maxHp;
  if (p.hp < 0) p.hp = 0;
}

function applySetBonus(p: any, type: string, value: number): void {
  switch (type) {
    case 'dodge': p.dodgeChance += value / 100; break;
    case 'crit': p.critChance += value / 100; break;
    case 'maxhp': p.maxHp += value; break;
    case 'el_res_fire': p.elRes['fire'] = (p.elRes['fire'] || 0) + value / 100; break;
    case 'el_res_ice': p.elRes['ice'] = (p.elRes['ice'] || 0) + value / 100; break;
    case 'el_res_holy': p.elRes['holy'] = (p.elRes['holy'] || 0) + value / 100; break;
    case 'el_dmg_fire': p.elDmgBonus['fire'] = (p.elDmgBonus['fire'] || 0) + value; break;
    case 'el_dmg_ice': p.elDmgBonus['ice'] = (p.elDmgBonus['ice'] || 0) + value; break;
    case 'el_dmg_shadow': p.elDmgBonus['shadow'] = (p.elDmgBonus['shadow'] || 0) + value; break;
    case 'el_dmg_holy': p.elDmgBonus['holy'] = (p.elDmgBonus['holy'] || 0) + value; break;
    case 'heal_bonus': p.healBonus += value / 100; break;
    case 'corruption_resist': (p as Player).setCorruptionResist = ((p as Player).setCorruptionResist ?? 0) + value; break;
  }
}

// Helper to get total talent bonus for a given effect
export function getTalentBonus(p: any, effectId: string): number {
  const talents = p.talents?.talents as Record<string, number> || {};
  const rank = talents[effectId] || 0;
  if (rank <= 0) return 0;
  const values: Record<string, number> = {
    w_iron_skin: 2, w_blood: 15, w_battle_fury: 2, w_weapon_mastery: 3,
    r_keen_eye: 5, r_swift_feet: 3, r_evasion: 5,
    m_arcane_power: 10, m_mana_flow: 5,
    p_holy_str: 2, p_divine_shield: 2, p_healing_light: 10, p_blessed_endurance: 15,
  };
  return (values[effectId] || 0) * rank;
}

// Apply a corruption delta to the player with cross-tier feedback + warden-death at 100.
// Single entry point for all accrual/cleanse sites (Playtest #9).
export function applyCorruption(n: number): void {
  if (!G) return;
  const p = G.player;
  // Endless (Task 2): eternal_sand halves corruption GAIN. Gate on n>0 so we
  // never amplify negative (cleanse) deltas — e.g. void_gear's per-floor
  // applyCorruption(-resist) must not be doubled/halved by relic effects.
  // T4's corruption_ward stacks after this with the same n>0 gate.
  // eternal_sand halves corruption GAIN. Math.ceil(n/2) is correct for n>=2 but
  // rounds n=1 (every accrual site) back to 1 → the relic did nothing in practice.
  // For n=1, roll a 50% chance to negate instead. n>0 gate keeps cleanse (-n) safe.
  if (hasRelic('eternal_sand') && n > 0) {
    n = n === 1 ? (Math.random() < 0.5 ? 0 : 1) : Math.ceil(n / 2);
  }
  // Task 4: corruption_ward (endless meta upgrade — ⑦ gated to G.endless so
  // normal runs are untouched) multiplies (same n>0 gate — never amplify cleanse).
  // Probabilistic gate, not Math.ceil: ceil(1*mult) always rounds back to 1 for
  // the n=1 sources, which made this meta upgrade a no-op. Each +1 now has
  // (1-mult) chance to be negated entirely — expected reduction = n*(1-mult).
  if (G.endless && n > 0 && Math.random() < (1 - corruptionWardMult())) n -= 1;
  const r = addCorruption(p, n);
  if (r.maxed) { wardenDeath(); return; }
  if (r.crossed && r.after === 'clean') {
    // 批3B: dropping all the way back to Clean is the cleanse payoff — its own
    // message + green flt + aura (no shake; relief, not violence).
    addMsg(t('cb.tierClean'), 'md');
    flt(p.x, p.y, tx(TIER_LABEL.clean).toUpperCase(), '#80ed99');
    fxAura(p.x, p.y, '#80ed99', 1.4);
    recalc(); // clean tier mods are all zeros, but keep the symmetric recalc
  } else if (r.crossed) {
    queueMechanicIntro('corruption');
    const label = tx(TIER_LABEL[r.after]);
    if (n < 0) {
      // Batch2 ⑩: a cleanse that DROPS a tier reads as relief — green, no shake.
      addMsg(tMsg('cb.tierCleansed', label), 'md');
      flt(p.x, p.y, label.toUpperCase(), '#80ed99');
    } else {
      addMsg(`🟪 ${label}${t('cb.ellipsis')}`, 'md');
      flt(p.x, p.y, label.toUpperCase(), TIER_COLOR[r.after]);
      shake(1.5);
    }
    recalc(); // apply the new tier's mods immediately (both directions)
  }
}

// 100 corruption → run ends; you become the next Warden.
// (recordWardenLegacy persists the run as a warden entity.)
function wardenDeath(): void {
  if (!G) return;
  const p = G.player;
  const nm = tMsg('cb.className', p.raceName, p.clsName);
  recordWardenLegacy(nm, p.ci, p.ri, G.floor);
  addMsg(t('cb.wardenJoin'), 'md');
  playerDeath(t('cb.becameWarden'), 'warden');
}

export function playerDeath(killer: string, cause: DeathCause = 'combat'): void {
  if (!G || G.gameOver) return;
  G.gameOver = true;
  resetIntros();   // 批4: the death screen takes over — drop any queued intro cards
  if (eventOpen) bridge.closeEvent?.();   // 批7 D: an event popup must not outlive the player
  addMsg(tMsg('cb.slainBy', killer), 'md');
  snd('death'); setBgmScene('death');

  // Capture the previous endless best BEFORE updateRunStats so we can flag a new
  // record on the death screen (updateRunStats raises bestEndlessFloor in-place).
  const prevEndlessBest = G.endless ? (getMeta().stats.bestEndlessFloor || 0) : 0;

  // Calculate soul echoes and update meta stats
  const p = G.player;
  const echoes = calculateSoulEchoes(p.kills, G.floor, p.bossesKilledThisRun, p.gold, p.bestStreak, false);
  // Task 4: endless death bonus echoes = (floor - 40) × 10, added to total before single credit.
  if (G.endless && G.floor > 40) {
    const bonus = (G.floor - 40) * 10;
    echoes.total += bonus;
    addMsg(tMsg('er.bonusEchoes', String(bonus)), 'ml');
  }
  creditSoulEchoes(echoes.total);
  updateRunStats({
    floor: G.floor, kills: p.kills, bossesKilled: p.bossesKilledThisRun,
    gold: p.gold, turns: p.turns, won: false, level: p.level,
    bestStreak: p.bestStreak, classIdx: p.ci,
    endless: G.endless === true, endlessFloor: G.floor,
  });
  recordRun({ mode: G.endless ? 'endless' : 'normal', floor: G.floor, kills: p.kills, classIdx: p.ci, result: 'death', turns: p.turns, gold: p.gold, ts: Date.now() });

  // Endless score = deepest floor. Milestone achievements resolve via Task 2's
  // ACH_DEFS; checkAch no-ops gracefully (persists ID, no message) until then.
  if (G.endless) {
    if (G.floor >= 50) checkAch('endless50');
    if (G.floor >= 75) checkAch('endless75');
    if (G.floor >= 100) checkAch('endless100');
  }

  document.getElementById('death-screen')!.style.display = 'flex';
  if (G.endless) {
    const isRecord = G.floor > prevEndlessBest;
    document.getElementById('death-stats')!.innerHTML =
      `<span style="color:#9b5de5">♾ ${t('cb.endlessMode')}</span><br>` +
      `${t('cb.descendedToFloor')} ${G.floor}${t('cb.floorUnit')}<br>` +
      (isRecord ? `<span style="color:#ffd700">★ ${t('cb.newRecord')} ★</span><br>` : (prevEndlessBest > 0 ? `${t('cb.best')}: F${prevEndlessBest}<br>` : '')) +
      `${t('cb.levelLabel')} ${G.player.level} · ${G.player.kills} ${t('cb.killsLabel')} · ${G.player.gold} ${t('cb.goldLabel')}<br>` +
      `${t('cb.survivedLabel')} ${G.player.turns} ${t('cb.turnsLabel')}`;
  } else {
    document.getElementById('death-stats')!.innerHTML =
      `${t('cb.reachedFloor')} ${G.floor} · ${t('cb.levelLabel')} ${G.player.level}<br>` +
      `${G.player.kills} ${t('cb.enemiesSlain')} · ${G.player.gold} ${t('cb.goldLabel')}<br>` +
      `${t('cb.survivedLabel')} ${G.player.turns} ${t('cb.turnsLabel')}`;
  }
  // 批7 A: epitaph (template + quoted flavor) + the fallen-wardens roll.
  const ep = buildEpitaph(cause, killer, G.floor, p.turns);
  document.getElementById('death-epitaph')!.innerHTML =
    `<div class="ep-line">${escHtml(ep.template)}</div>` +
    `<div class="ep-flavor">${quoteFlavor(escHtml(ep.flavor))}</div>`;
  // Batch10 B1: persist the death snapshot — later runs may meet this echo on the map.
  recordEcho({
    cause, killer, floor: G.floor, turns: p.turns, classIdx: p.ci,
    corruption: p.corruption, keepsake: pickKeepsake(p),
    epitaph: { template: ep.template, flavor: ep.flavor }, ts: Date.now(),
  });
  const wardens = getMeta().wardens || [];
  document.getElementById('death-wardens')!.innerHTML = wardens.length
    ? `<div class="epw-title">${t('ep.fallen')}</div>` +
      wardens.slice(0, 5).map(w => `<span class="epw-row">${escHtml(w.name)} F${w.floor}</span>`).join('') +
      (wardens.length > 5 ? `<span class="epw-row">+${wardens.length - 5}</span>` : '')
    : '';
  renderEchoBreakdown('death-echoes', echoes);
  clearCloudSave();
}

export function playerVictory(): void {
  if (!G) return;
  G.gameOver = true; G.won = true;
  resetIntros();   // 批4: the victory/ending flow takes over — drop any queued intro cards
  addMsg(t('loreVictory'), 'ml'); snd('victory'); setBgmScene('victory'); checkAch('win');
  checkAch('creator_kill');

  // Calculate soul echoes and update meta stats
  const p = G.player;
  const echoes = calculateSoulEchoes(p.kills, G.floor, p.bossesKilledThisRun, p.gold, p.bestStreak, true);
  creditSoulEchoes(echoes.total);
  updateRunStats({
    floor: G.floor, kills: p.kills, bossesKilled: p.bossesKilledThisRun,
    gold: p.gold, turns: p.turns, won: true, level: p.level,
    bestStreak: p.bestStreak, classIdx: p.ci,
  });
  recordRun({ mode: 'normal', floor: G.floor, kills: p.kills, classIdx: p.ci, result: 'win', turns: p.turns, gold: p.gold, ts: Date.now() });

  // Run is over the moment the Creator falls — clear the save NOW (mirrors
  // playerDeath). Deferring to resolveEnding left a window where force-quitting on
  // the Slay/Refuse screen → Continue → re-kill the Creator → double echoes/history.
  clearCloudSave();

  // Phase 2: present the Creator choice (Slay / Refuse) instead of straight to victory-screen.
  _pendingEchoes = echoes;
  presentCreatorChoice(p);
}

// Pending echoes stashed by playerVictory so resolveEnding can render the breakdown
// after the player makes the Slay/Refuse choice.
let _pendingEchoes: SoulEchoBreakdown | null = null;

// Phase 2: Creator choice. Refuse is disabled at corruption >= 50 (the abyss's
// will overrides the player's — only the pure may show mercy).
function presentCreatorChoice(p: Player): void {
  const refuse = canRefuse(p.corruption);
  document.getElementById('ending-title')!.textContent = t('cb.creatorFalls');
  document.getElementById('ending-desc')!.textContent = refuse
    ? t('cb.creatorDescRefuse')
    : t('cb.creatorDescNoRefuse');
  const rb = document.getElementById('btn-ending-refuse') as HTMLButtonElement;
  rb.disabled = !refuse;
  rb.style.opacity = refuse ? '1' : '0.4';
  // Batch3A: join the .overlay.active lifecycle like showOverlay does — the
  // menu-context probe AND the .overlay{opacity:0}/.overlay.active{opacity:1}
  // CSS both key off .active (bare display:'flex' left the panel at opacity:0).
  const ec = document.getElementById('ending-choice')!;
  ec.classList.add('active');
  ec.style.display = 'flex';
}

// Resolve the Slay/Refuse choice → ending (title/body) + record achievement + victory screen.
export function resolveEnding(choice: 'slay' | 'refuse'): void {
  if (!G) return;
  const p = G.player;
  // Single hide site shared by both choices — drop .active with the display so
  // the menu-context probe doesn't see a dead screen (mirrors hideOverlay).
  const ec = document.getElementById('ending-choice')!;
  ec.classList.remove('active');
  ec.style.display = 'none';
  const id = endingForChoice(choice, p.corruption);
  const e = ENDINGS[id];
  checkAch(e.ach); // records the ending achievement (+ Steam)
  document.getElementById('vic-ending')!.innerHTML =
    `<h2 style="color:${id === 'guardian' ? '#06d6a0' : id === 'doombringer' ? '#e63946' : '#ffd700'}">${tx(e.title)}</h2>` +
    `<p style="color:#ccc;font-size:.95em">${tx(e.body)}</p>`;
  document.getElementById('victory-screen')!.style.display = 'flex';
  document.getElementById('vic-stats')!.innerHTML =
    `<span style="color:#ffd700">🏆 ${t('cb.heroOfDarkhollow')} 🏆</span><br><br>` +
    `${t('cb.levelLabel')} ${p.level} ${p.raceName} ${p.clsName}<br>` +
    `${t('cb.floorLabel')} ${G.floor}<br>${p.kills} ${t('cb.killsLabel')}<br>` +
    `${p.gold} ${t('cb.goldLabel')}<br>${p.turns} ${t('cb.turnsLabel')}<br>` +
    `${t('cb.corruptionLabel')} ${p.corruption}`;
  if (_pendingEchoes) renderEchoBreakdown('vic-echoes', _pendingEchoes);
  _pendingEchoes = null;
  clearCloudSave();
}

export function checkAch(id: string): void {
  if (!G || G.player.achievements.has(id)) return;
  G.player.achievements.add(id);
  // Persist to meta save
  persistAchievement(id);
  // Bridge to Steam (no-op until steamworks.js + AppID are wired)
  unlockAchievement(id);
  const def = ACH_DEFS.find(a => a.id === id);
  if (!def) return;
  addMsg('🏆 ' + tx(def.n) + ' — ' + tx(def.d), 'mach');
  snd('ach');
  flt(G.player.x, G.player.y, '🏆', '#ffd700');
}

// Single kill-reward pipeline shared by attack() (melee) and killEnemy()
// (skill/scroll/trap/thorns/ally). Note: loot drop is melee-only and stays in
// attack(); double-strike stays in killEnemy(); fxBurst stays at both sites.
export function grantKillRewards(e: Enemy): void {
  if (!G) return;
  G.player.exp += Math.floor(bonusExp(e.exp) * getRelicExpMult());
  G.player.gold += Math.floor(bonusGold(e.goldDrop) * getRelicGoldMult());
  G.player.kills++;
  G.player.streak++;
  if (G.player.streak > G.player.bestStreak) G.player.bestStreak = G.player.streak;
  if (G.player.streak >= 3) {
    const bonus = bonusExp(Math.floor(e.exp * .2 * G.player.streak));
    G.player.exp += bonus;
    addMsg(`🔥 ${G.player.streak}x${t('streakMsg')} +${bonus}XP`, 'ml');
    checkAch('streak5');
  }
  addMsg(tMsg('cb.enemyDefeated', e.name, String(bonusExp(e.exp))), 'mc');
  if (e.isBoss) {
    G.player.bossesKilledThisRun++;
    // 批4: boss codex is main-line only — endless F45+ scaled bosses and hollow
    // branch kills used to write boss:<floor> ids that have no LORE_ENTRIES row.
    if (!G.branchMode && !G.endless) unlockLore('boss:' + G.floor);
    // 批4: the F40 Creator kill (normal AND endless — both really slay him)
    // unlocks the previously dead-locked world:creator codex entry.
    if (G.floor === FINAL && !G.branchMode) unlockLore('world:creator');
    checkAch('boss_kill');
    if (G.floor === FINAL && !G.branchMode && !G.endless) { playerVictory(); return; }
    if (G.floor === FINAL && G.endless)
      addMsg(t('cb.slayCreator'), 'md');
  }
  onPlayerKill(e);
  relicOnKill(e); // relic trigger: soul_harvester
  // Warden kill (Wave 8): specific relic (next unowned "前任遗物") + next memory,
  // INSTEAD of the generic elite-40% random drop.
  if (e.isWarden) {
    const rid = pickWardenRelic(G.player.relics || []);
    if (rid) grantRelic(rid, e.x, e.y);
    const mem = nextWardenMemory(getMeta().unlockedLore || []);
    if (mem) {
      unlockLore(mem);
      const mt = wardenMemoryText(mem);
      if (mt) addMsg(tx(mt), 'md');
    }
    addMsg(t('cb.repelledWarden'), 'ml');
    if (e.legacyWarden) checkAch('warden_self_slay'); // Phase 3: slew a Warden that was once you
  } else if (e.isBoss || (e.isElite && Math.random() < 0.4)) {
    grantRandomRelic(e.x, e.y, G.floor);
  }
  checkLevelUp(); checkAchs();
}

export function killEnemy(e: Enemy): void {
  if (!G) return;
  fxBurst(e.x, e.y, e.c || '#ff6b6b', e.isBoss ? 26 : 12, e.isBoss ? 1.6 : 1);
  G.enemies = G.enemies.filter(en => en !== e);
  grantKillRewards(e);
  // Boss-victory guard: grantKillRewards just called playerVictory(); preserve the
  // old early `return` which fired before the double-strike check below.
  if (G.won) return;
  // Talent trigger: double strike
  if (checkDoubleStrike()) {
    const nextTarget = G!.enemies.find(en => !en.isAlly && dst(en.x, en.y, G!.player.x, G!.player.y) <= 1.5);
    if (nextTarget) {
      addMsg(t('cb.doubleStrike'), 'mc');
      attack(G.player, nextTarget, true);
    }
  }
}

export function checkAchs(): void {
  if (!G) return;
  const p = G.player;
  if (p.kills >= 1) checkAch('first_kill');
  if (p.kills >= 10) checkAch('kill_10');
  if (p.kills >= 50) checkAch('kill_50');
  if (p.kills >= 100) checkAch('kill_100');
  if (p.kills >= 200) checkAch('kill_200');
  if (p.bestStreak >= 5) checkAch('streak5');
  if (p.gold >= 500) checkAch('gold500');
  if (p.gold >= 1000) checkAch('gold1000');
  if (p.gold >= 5000) checkAch('gold5000');
  if (p.level >= 10) checkAch('lvl10');
  if (p.level >= 20) checkAch('lvl20');
  if (p.level >= 30) checkAch('lvl30');
  if (G.floor >= 5) checkAch('floor5');
  if (G.floor >= 15) checkAch('floor15');
  if (G.floor >= 25) checkAch('floor25');
  if (G.floor >= 30) checkAch('floor30');
  if (G.floor >= 35) checkAch('floor35');
  if (G.floor >= 40) checkAch('floor40');
}
