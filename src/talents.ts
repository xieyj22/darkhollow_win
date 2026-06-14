// Talent system — all talent effect implementations
import type { Player, Enemy, Element } from './types.js';
import { G, lang } from './state.js';
import { flt } from './effects.js';
import { addMsg } from './messages.js';
import { TALENT_TREES } from './data.js';
import { rng, dst } from './utils.js';
import { bonusGold, bonusExp } from './meta.js';

// Helper: get rank of a talent (0 if not learned)
function tr(p: Player, id: string): number {
  return p.talents?.talents?.[id] || 0;
}

// ===== PASSIVE STAT BONUSES (called from recalc) =====
export function applyTalentBonuses(p: Player): void {
  const t = p.talents?.talents as Record<string, number> || {};
  for (const [id, rank] of Object.entries(t)) {
    if (rank <= 0) continue;
    switch (id) {
      // Warrior — already implemented in combat.ts, keep them
      case 'w_iron_skin': p.def += 2 * rank; break;
      case 'w_blood': p.maxHp += 15 * rank; break;
      case 'w_battle_fury': p.atk += 2 * rank; break;
      case 'w_weapon_mastery': p.atk += 3 * rank; break;
      // Warrior — NEW conditional bonuses
      case 'w_berserker': if (p.hp / p.maxHp < 0.5) p.atk += Math.floor(p.baseAtk * 0.15 * rank); break;
      case 'w_fortify': if (p.hp / p.maxHp > 0.8) p.def += 3 * rank; break;
      case 'w_last_stand': if (p.hp / p.maxHp < 0.2) p.atk += Math.floor(p.baseAtk * 0.5 * rank); break;
      // Rogue — already implemented
      case 'r_keen_eye': p.critChance += 0.05 * rank; break;
      case 'r_swift_feet': p.dodgeChance += 0.03 * rank; break;
      case 'r_evasion': p.dodgeChance += 0.05 * rank; break;
      // Rogue — NEW
      case 'r_backstab': p.critDamageBonus += 0.25 * rank; break;
      // Mage — already implemented
      case 'm_arcane_power': p.spellPower += 0.1 * rank; break;
      case 'm_mana_flow': p.maxMp += 5 * rank; break;
      // Mage — NEW
      case 'm_elemental_affinity':
        for (const el of ['fire', 'ice', 'lightning', 'shadow', 'holy'] as Element[])
          p.elDmgBonus[el] = (p.elDmgBonus[el] || 0) + 10 * rank;
        break;
      case 'm_fire_mastery': p.elDmgBonus['fire'] = (p.elDmgBonus['fire'] || 0) + 20 * rank; break;
      case 'm_arcane_barrier': p.def += 3 * rank; break;
      case 'm_archmage': p.spellPower += 0.3 * rank; break;
      // Paladin — already implemented
      case 'p_holy_str': p.atk += 2 * rank; break;
      case 'p_divine_shield': p.def += 2 * rank; break;
      case 'p_healing_light': p.healBonus += 0.1 * rank; break;
      case 'p_blessed_endurance': p.maxHp += 15 * rank; break;
      // Paladin — NEW
      case 'p_champion': p.atk += 3 * rank; p.def += 3 * rank; break;
      case 'p_aura': p.dodgeChance += 0.05 * rank; break;
    }
  }
}

// ===== COMBAT TRIGGERS =====

// Called after player hits an enemy — returns modified damage
export function onPlayerHitEnemy(defender: Enemy, dmg: number): number {
  if (!G) return dmg;
  const p = G.player;
  let modifiedDmg = dmg;

  // r_backstab is a passive — crit damage bonus is applied in the crit calculation
  // w_executioner: +30% dmg to HP<30% foes
  if (tr(p, 'w_executioner') > 0 && defender.hp / defender.maxHp < 0.3) {
    modifiedDmg = Math.floor(modifiedDmg * 1.3);
  }

  // r_assassinate: instakill foes <10% HP
  if (tr(p, 'r_assassinate') > 0 && defender.hp / defender.maxHp < 0.1) {
    defender.hp = 0;
    addMsg(lang === 'zh' ? `💀 暗杀！${defender.name}被一击必杀！` : `💀 Assassinate! ${defender.name} is instantly killed!`, 'mc');
    flt(defender.x, defender.y, '💀INSTAKILL', '#ff0000');
    return 9999;
  }

  // r_poison_blade: 20% chance to poison on hit
  if (tr(p, 'r_poison_blade') > 0 && Math.random() < 0.2) {
    // Poison the enemy (we add a simple poison-like effect by reducing HP next turn)
    // Since enemies don't have a poison system, we apply direct bonus damage
    const poisonDmg = Math.max(1, Math.floor(p.atk * 0.3));
    defender.hp -= poisonDmg;
    flt(defender.x, defender.y, `-${poisonDmg}🐍`, '#32cd32');
    addMsg(lang === 'zh' ? `🐍 毒刃效果！额外${poisonDmg}毒素伤害！` : `🐍 Poison Blade! +${poisonDmg} poison dmg!`, 'mc');
    if (defender.hp <= 0) return modifiedDmg;
  }

  // p_angelic_wrath: holy dmg on every attack
  if (tr(p, 'p_angelic_wrath') > 0) {
    const holyDmg = Math.max(1, Math.floor(p.level * 1.5));
    defender.hp -= holyDmg;
    flt(defender.x, defender.y, `-${holyDmg}✨`, '#ffd700');
    addMsg(lang === 'zh' ? `⚡ 天使之怒！${holyDmg}神圣伤害！` : `⚡ Angelic Wrath! ${holyDmg} holy dmg!`, 'mc');
    if (defender.hp <= 0) return modifiedDmg;
  }

  // r_phantom_blade: 30% chance extra full damage
  if (tr(p, 'r_phantom_blade') > 0 && Math.random() < 0.3) {
    defender.hp -= modifiedDmg;
    flt(defender.x, defender.y, `-${modifiedDmg}👻`, '#8a2be2');
    addMsg(lang === 'zh' ? `👻 幻影刃！额外${modifiedDmg}伤害！` : `👻 Phantom Blade! +${modifiedDmg} phantom dmg!`, 'mc');
    if (defender.hp <= 0) return modifiedDmg;
  }

  // p_righteous_fury: +3 ATK vs shadow foes
  if (tr(p, 'p_righteous_fury') > 0 && defender.el === 'shadow') {
    const bonus = 3 * tr(p, 'p_righteous_fury');
    defender.hp -= bonus;
    flt(defender.x, defender.y, `-${bonus}🔥`, '#ffd700');
  }

  // m_frost_touch: 15% chance to slow (stun 1 turn) on hit
  if (tr(p, 'm_frost_touch') > 0 && Math.random() < 0.15 && defender.hp > 0) {
    defender.stunned = Math.max(defender.stunned, 1);
    flt(defender.x, defender.y, '❄SLOW', '#4895ef');
  }

  return modifiedDmg;
}

// Called after player kills an enemy
export function onPlayerKill(enemy: Enemy): void {
  if (!G) return;
  const p = G.player;

  // r_shadow_step: dodge next attack after kill
  if (tr(p, 'r_shadow_step') > 0) {
    p.buffs.push({ name: lang === 'zh' ? '暗影步' : 'Shadow Step', type: 'dodge_next', value: 1, turns: 3 });
    addMsg(lang === 'zh' ? '👤 暗影步！下次攻击将被闪避！' : '👤 Shadow Step! Next attack will be dodged!', 'mi');
  }

  // m_mana_surge: kill restores 10% MP
  if (tr(p, 'm_mana_surge') > 0) {
    const mpRestore = Math.floor(p.maxMp * 0.1);
    p.mp = Math.min(p.maxMp, p.mp + mpRestore);
    flt(p.x, p.y, `+${mpRestore}MP`, '#4895ef');
  }
}

// Called when player dodges an attack
export function onPlayerDodged(): void {
  if (!G) return;
  const p = G.player;

  // r_shadow_dance: +30% ATK buff for 3 turns after dodge
  if (tr(p, 'r_shadow_dance') > 0) {
    const buffVal = Math.floor(p.baseAtk * 0.3);
    p.buffs.push({ name: lang === 'zh' ? '暗影之舞' : 'Shadow Dance', type: 'str_buff', value: buffVal, turns: 3 });
    addMsg(lang === 'zh' ? `💃 暗影之舞！+${buffVal}攻击力3回合！` : `💃 Shadow Dance! +${buffVal} ATK for 3 turns!`, 'mi');
  }
}

// Called when player takes damage — returns true if damage was prevented (cheat death / revive)
export function onPlayerDamaged(dmg: number): boolean {
  if (!G) return false;
  const p = G.player;

  // w_unbreakable: survive lethal hit once per boss fight
  if (tr(p, 'w_unbreakable') > 0 && p.hp <= 0 && !p.bossCheatDeathUsed) {
    const bossNearby = G.enemies.some(e => e.isBoss && dst(e.x, e.y, p.x, p.y) < 10);
    if (bossNearby) {
      p.hp = 1;
      p.bossCheatDeathUsed = true;
      addMsg(lang === 'zh' ? '💎 不屈！你勉强抵挡了致命一击！' : '💎 Unbreakable! You survive the lethal blow!', 'ml');
      flt(p.x, p.y, '💎CHEAT DEATH', '#4895ef');
      return true;
    }
  }

  // r_vanish: invisible 3t when HP<25%
  if (tr(p, 'r_vanish') > 0 && p.hp > 0 && p.hp / p.maxHp < 0.25) {
    if (!p.buffs.some(b => b.type === 'invis')) {
      p.buffs.push({ name: lang === 'zh' ? '消失' : 'Vanish', type: 'invis', value: 1, turns: 3 });
      addMsg(lang === 'zh' ? '🚫 HP过低！自动隐身3回合！' : '🚫 Low HP! Auto-vanish for 3 turns!', 'mi');
    }
  }

  // p_lay_on_hands: auto-heal 20% when HP<20%
  if (tr(p, 'p_lay_on_hands') > 0 && p.hp > 0 && p.hp / p.maxHp < 0.2) {
    const heal = Math.floor(p.maxHp * 0.2);
    p.hp = Math.min(p.maxHp, p.hp + heal);
    addMsg(lang === 'zh' ? `🤲 圣疗！自动回复${heal}HP！` : `🤲 Lay on Hands! Auto-heal ${heal} HP!`, 'mh');
    flt(p.x, p.y, `+${heal}`, '#80ed99');
  }

  return false;
}

// Called from playerDeath — returns true if death should be prevented (auto-revive)
export function onPlayerDeath(): boolean {
  if (!G) return false;
  const p = G.player;

  // p_resurrection: auto-revive to 100% once
  if (tr(p, 'p_resurrection') > 0 && !p.hasRevived) {
    p.hp = p.maxHp;
    p.mp = p.maxMp;
    p.hasRevived = true;
    p.buffs = [];
    p.poisonTurns = 0;
    addMsg(lang === 'zh' ? '🌟 复活！你从死亡中完全恢复！' : '🌟 Resurrection! Fully restored from death!', 'ml');
    flt(p.x, p.y, '🌟REVIVE', '#ffd700');
    return true;
  }

  // p_intervention: revive to 50% once per run
  if (tr(p, 'p_intervention') > 0 && !p.hasRevived) {
    p.hp = Math.floor(p.maxHp * 0.5);
    p.mp = Math.floor(p.maxMp * 0.5);
    p.hasRevived = true;
    p.buffs = [];
    p.poisonTurns = 0;
    addMsg(lang === 'zh' ? '👼 神圣干预！你复活至50%生命！' : '👼 Divine Intervention! Revived to 50% HP!', 'ml');
    flt(p.x, p.y, '👼INTERVENE', '#ffd700');
    return true;
  }

  // w_undying: auto-revive to 30% once per combat
  if (tr(p, 'w_undying') > 0 && !p.combatReviveUsed) {
    p.hp = Math.floor(p.maxHp * 0.3);
    p.combatReviveUsed = true;
    p.buffs = [];
    p.poisonTurns = 0;
    addMsg(lang === 'zh' ? '✨ 不死！你从死亡中复活至30%HP！' : '✨ Undying! Revived to 30% HP!', 'ml');
    flt(p.x, p.y, '✨REVIVE', '#ffd700');
    return true;
  }

  return false;
}

// Called when enemy hits player — returns extra damage from counter-attack
export function onEnemyHitPlayer(attacker: Enemy): void {
  if (!G) return;
  const p = G.player;

  // w_retaliation: 10% chance counter-attack
  if (tr(p, 'w_retaliation') > 0 && Math.random() < 0.1) {
    const counterDmg = Math.max(1, p.atk - attacker.def);
    attacker.hp -= counterDmg;
    flt(attacker.x, attacker.y, `-${counterDmg}↩`, '#ffd700');
    addMsg(lang === 'zh' ? `↩ 反击！对${attacker.name}造成${counterDmg}伤害！` : `↩ Counter! ${counterDmg} to ${attacker.name}!`, 'mc');
    if (attacker.hp <= 0) {
      G.player.exp += bonusExp(attacker.exp); G.player.gold += bonusGold(attacker.goldDrop); G.player.kills++;
      G.enemies = G.enemies.filter(e => e !== attacker);
      addMsg(lang === 'zh' ? `${attacker.name}被反击击败！` : `${attacker.name} killed by counter!`, 'mc');
    }
  }
}

// Called when player gets a double strike opportunity — returns true if double strike fires
export function checkDoubleStrike(): boolean {
  if (!G) return false;
  return tr(G.player, 'r_double_strike') > 0 && Math.random() < 0.15;
}

// ===== SKILL MODIFIERS =====

export interface SkillModifiers {
  dmgMult: number;
  forceCrit: boolean;
  aoe: boolean;
  chainCount: number;
  radiusBonus: number;
  halfCd: boolean;
  alsoFear: boolean;
  alsoStun: boolean;
  alsoHolyDmg: boolean;
  alsoHeal: boolean;
  alsoSlow: boolean;
  alsoBlind: boolean;
  randomElement: boolean;
}

export function getSkillModifiers(clsIdx: number): SkillModifiers {
  const mods: SkillModifiers = {
    dmgMult: 1, forceCrit: false, aoe: false, chainCount: 0,
    radiusBonus: 0, halfCd: false, alsoFear: false, alsoStun: false,
    alsoHolyDmg: false, alsoHeal: false, alsoSlow: false, alsoBlind: false, randomElement: false,
  };
  if (!G) return mods;
  const p = G.player;

  // Skill damage bonuses
  if (tr(p, 'w_titan_strike') > 0) mods.dmgMult += 0.5;
  if (tr(p, 'r_master_assassin') > 0) mods.dmgMult += 0.5;
  if (tr(p, 'p_smite') > 0) mods.dmgMult += 0.4;

  // Skill AOE
  if ((clsIdx === 0 && tr(p, 'w_whirlwind') > 0) || (clsIdx === 1 && tr(p, 'r_fan_knives') > 0)) {
    mods.aoe = true;
  }

  // Skill crit
  if (tr(p, 'r_death_mark') > 0) mods.forceCrit = true;

  // Chain lightning
  if (tr(p, 'm_chain_lightning') > 0) mods.chainCount = 2;

  // Meteor radius
  if (tr(p, 'm_meteor') > 0) mods.radiusBonus = 2;

  // CD halved
  if (tr(p, 'm_reality_tear') > 0) mods.halfCd = true;

  // War Cry fear
  if (tr(p, 'w_war_cry') > 0) mods.alsoFear = true;

  // Paladin judgment stun
  if (tr(p, 'p_judgment') > 0) mods.alsoStun = true;

  // Consecrate holy dmg
  if (tr(p, 'p_consecrate') > 0) mods.alsoHolyDmg = true;

  // Holy Nova heal
  if (tr(p, 'p_holy_nova') > 0) mods.alsoHeal = true;

  // Blizzard slow
  if (tr(p, 'm_blizzard') > 0) mods.alsoSlow = true;

  // Smoke Screen — skill also blinds (stuns) affected enemies
  if (tr(p, 'r_smoke_screen') > 0) mods.alsoBlind = true;

  // Elemental storm
  if (tr(p, 'm_elemental_storm') > 0) mods.randomElement = true;

  return mods;
}

// m_spell_pen — multiplier for spell/skill damage (ignoring enemy defenses)
export function getSpellPenMult(): number {
  if (!G) return 1;
  return tr(G.player, 'm_spell_pen') > 0 ? 1.2 : 1;
}

// m_mana_shield — fractional damage reduction when MP > 50%
export function getManaShieldReduction(): number {
  if (!G) return 0;
  const p = G.player;
  if (tr(p, 'm_mana_shield') > 0 && p.mp > p.maxMp * 0.5) return 0.1;
  return 0;
}

// Get the actual skill cooldown after talent modifiers
export function modifySkillCooldown(baseCd: number): number {
  if (!G) return baseCd;
  if (tr(G.player, 'm_reality_tear') > 0) return Math.max(1, Math.floor(baseCd / 2));
  return baseCd;
}

// ===== TURN-BASED EFFECTS =====

// Check poison resistance — returns modified poison damage
export function modifyPoisonDamage(baseDmg: number): number {
  if (!G) return baseDmg;
  if (tr(G.player, 'w_iron_will') > 0) return Math.max(1, Math.floor(baseDmg / 2));
  return baseDmg;
}

// Get bonus MP regen from talents
export function getBonusMpRegen(): number {
  if (!G) return 0;
  return tr(G.player, 'm_time_warp') > 0 ? 2 : 0;
}

// Check if player is immune to CC (sanctuary talent)
export function isCCImmune(): boolean {
  if (!G) return false;
  return tr(G.player, 'p_sanctuary') > 0;
}

// Get crit damage multiplier (base 2.0 + bonuses)
export function getCritMultiplier(): number {
  if (!G) return 2.0;
  return 2.0 + (G.player.critDamageBonus || 0);
}
