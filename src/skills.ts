// Skill system
import type { Enemy } from './types.js';
import { G, lang } from './state.js';
import { dst, rng } from './utils.js';
import { snd } from './audio.js';
import { flt, shake } from './effects.js';
import { fxFlash, fxBolt, fxBeam, fxBurst } from './fx.js';
import { addMsg } from './messages.js';
import { recalc, killEnemy, checkLevelUp, checkAch, checkAchs, playerVictory, applyCorruption } from './combat.js';
import { FINAL } from './config.js';
import { CLASSES } from './data.js';
import { bonusGold, bonusExp } from './meta.js';
import { getSkillModifiers, onPlayerKill, getSpellPenMult } from './talents.js';
import { grantRandomRelic, relicOnKill } from './relics.js';
import { t, tMsg, tx } from './i18n.js';

let _endTurn: (() => void) | null = null;
export function setEndTurnFn(fn: () => void): void { _endTurn = fn; }

// Helper: process AOE kills with talent triggers, streak, and achievement checks
function processAoeKills(killedEnemies: Enemy[]): void {
  if (!G) return;
  const p = G.player;
  for (const e of killedEnemies) {
    fxBurst(e.x, e.y, e.c || '#ff6b6b', e.isBoss ? 26 : 10, e.isBoss ? 1.6 : 0.9);
    if (e.isBoss || (e.isElite && Math.random() < 0.4)) grantRandomRelic(e.x, e.y, G.floor);
    // Streak
    p.streak++;
    if (p.streak > p.bestStreak) p.bestStreak = p.streak;
    if (p.streak >= 3) {
      const bonus = bonusExp(Math.floor(e.exp * .2 * p.streak));
      p.exp += bonus;
      addMsg(`🔥 ${p.streak}x${t('sk.killStreak')}+${bonus}XP`, 'ml');
      checkAch('streak5');
    }
    // Boss kill — keep in sync with attack() / killEnemy()
    if (e.isBoss) {
      p.bossesKilledThisRun++;
      checkAch('boss_kill');
      if (G.floor === FINAL) { playerVictory(); break; }
    }
    // Talent on-kill triggers
    onPlayerKill(e);
    relicOnKill(e); // relic trigger: soul_harvester
  }
  checkAchs();
}

export function findNearestEnemy(): Enemy | null {
  if (!G) return null;
  let best: Enemy | null = null, bd = 999;
  for (const e of G.enemies) {
    if (e.isAlly) continue;
    const d = dst(G.player.x, G.player.y, e.x, e.y);
    if (d < bd && d <= 6) { bd = d; best = e; }
  }
  return best;
}

export function executeSkill(sk: { cost: number; effect: string; cd: number }): void {
  if (!G) return;
  if (G.player.stunned && G.player.stunned > 0) {
    G.player.stunned--;
    addMsg(t('esk.playerStunned'), 'mi');
    if (_endTurn) _endTurn();
    return;
  }
  const p = G.player;
  if (p.mp < sk.cost || p.skillCd > 0) { addMsg(t('sk.cdNoMp'), 'mi'); return; }
  p.mp -= sk.cost; p.skillCd = sk.cd; snd('spell');
  applyCorruption(1); // drawing on the seal's power corrupts (Playtest #9)

  const mods = getSkillModifiers(p.ci);

  switch (sk.effect) {
    case 'stun': {
      // Warrior — Shield Bash (possibly AOE via whirlwind talent)
      if (mods.aoe) {
        // Whirlwind: hit all adjacent enemies
        fxFlash(p.x, p.y, '#4895ef', 1.3);
        const enemies = G.enemies.filter(e => !e.isAlly && dst(p.x, p.y, e.x, e.y) <= 1.5);
        const killed: Enemy[] = [];
        for (const e of enemies) {
          let dmg = Math.floor(p.atk * 1.5 * mods.dmgMult);
          e.hp -= dmg; e.stunned = 2;
          fxFlash(e.x, e.y, '#4895ef'); flt(e.x, e.y, `-${dmg} ⚡`, '#4895ef');
          if (e.hp <= 0) killed.push(e);
          if (mods.alsoFear) e.feared = rng(3, 5);
        }
        G.enemies = G.enemies.filter(e => e.hp > 0 || e.isAlly);
        for (const e of killed) { p.exp += bonusExp(e.exp); p.gold += bonusGold(e.goldDrop); p.kills++; }
        processAoeKills(killed);
        addMsg(tMsg('sk.whirlwind', String(enemies.length)), 'msk');
        if (killed.length > 0) checkLevelUp();
      } else {
        const e = findNearestEnemy();
        if (e) {
          let dmg = Math.floor(p.atk * 1.5 * mods.dmgMult);
          e.hp -= dmg; e.stunned = 2;
          addMsg(tx({ en: `Shield Bash! ${dmg} dmg to ${e.name}, stunned!`, zh: `盾击！对${e.name}造成${dmg}伤害并眩晕！` }), 'msk');
          fxBolt(p.x, p.y, e.x, e.y, '#4895ef'); fxFlash(e.x, e.y, '#4895ef'); flt(e.x, e.y, `-${dmg} ⚡`, '#4895ef');
          if (e.hp <= 0) killEnemy(e);
          if (mods.alsoFear) {
            const nearby = G.enemies.filter(en => !en.isAlly && dst(p.x, p.y, en.x, en.y) <= 5);
            nearby.forEach(en => en.feared = rng(3, 5));
            if (nearby.length) addMsg(tMsg('sk.warCry', String(nearby.length)), 'mi');
          }
        }
      }
      break;
    }
    case 'burst': {
      // Rogue — Shadow Strike
      const e = findNearestEnemy();
      if (e) {
        let dmg = Math.floor(p.atk * 2.5 * mods.dmgMult);
        // Death mark: force crit
        if (mods.forceCrit) {
          dmg = Math.floor(dmg * 2);
          addMsg(t('sk.deathMarkCrit'), 'mc');
        }
        // AOE: fan of knives
        if (mods.aoe) {
          const enemies = G.enemies.filter(en => !en.isAlly && dst(p.x, p.y, en.x, en.y) <= 3);
          const killed: Enemy[] = [];
          for (const en of enemies) {
            const d = mods.forceCrit ? Math.floor(p.atk * 2.5 * mods.dmgMult * 2) : Math.floor(p.atk * 2.5 * mods.dmgMult);
            en.hp -= d; fxFlash(en.x, en.y, '#9b5de5'); flt(en.x, en.y, `-${d} 💀`, '#9b5de5');
            if (en.hp <= 0) killed.push(en);
          }
          G.enemies = G.enemies.filter(en => en.hp > 0 || en.isAlly);
          for (const en of killed) { p.exp += bonusExp(en.exp); p.gold += bonusGold(en.goldDrop); p.kills++; }
          processAoeKills(killed);
          addMsg(tMsg('sk.fanOfKnives', String(enemies.length)), 'msk');
          if (killed.length > 0) checkLevelUp();
        } else {
          e.hp -= dmg;
          addMsg(tx({ en: `Shadow Strike! ${dmg} to ${e.name}!`, zh: `暗影突袭！对${e.name}造成${dmg}伤害！` }), 'msk');
          fxBolt(p.x, p.y, e.x, e.y, '#9b5de5'); fxFlash(e.x, e.y, '#9b5de5'); flt(e.x, e.y, `-${dmg} 💀`, '#9b5de5'); shake(1.5);
          if (e.hp <= 0) killEnemy(e);
        }
      }
      break;
    }
    case 'aoe': {
      // Mage — Arcane Blast
      fxFlash(p.x, p.y, '#7ec8e3', 2.2);
      const baseRadius = 5 + mods.radiusBonus;
      const spellPen = getSpellPenMult();
      const enemies = G.enemies.filter(e => !e.isAlly && dst(p.x, p.y, e.x, e.y) <= baseRadius);
      const killed: Enemy[] = [];
      for (const e of enemies) {
        let dmg = Math.floor((p.atk + p.level * 3) * p.spellPower * mods.dmgMult * spellPen);
        e.hp -= dmg; fxFlash(e.x, e.y, '#4895ef'); flt(e.x, e.y, `-${dmg}`, '#4895ef');
        if (e.hp <= 0) killed.push(e);
        if (mods.alsoSlow) {
          // Slow effect — reduce enemy effectiveness (simplified as losing next turn)
          e.stunned = Math.max(e.stunned, 1);
        }
      }
      // Chain lightning: hit up to 2 extra enemies further away
      // Filter out already-dead enemies before selecting chain targets
      if (mods.chainCount > 0) {
        const chainTargets = G.enemies.filter(e => !e.isAlly && e.hp > 0 && dst(p.x, p.y, e.x, e.y) > baseRadius && dst(p.x, p.y, e.x, e.y) <= baseRadius + 4);
        for (let i = 0; i < Math.min(mods.chainCount, chainTargets.length); i++) {
          const ct = chainTargets[i];
          const chainDmg = Math.floor((p.atk + p.level * 2) * p.spellPower * mods.dmgMult * 0.6);
          ct.hp -= chainDmg; fxBeam(p.x, p.y, ct.x, ct.y, '#ffd700'); fxFlash(ct.x, ct.y, '#fff2a8'); flt(ct.x, ct.y, `-${chainDmg}⚡`, '#ffd700');
          if (ct.hp <= 0) killed.push(ct);
          addMsg(tMsg('sk.chainHit', String(ct.name), String(chainDmg)), 'mc');
        }
      }
      G.enemies = G.enemies.filter(e => e.hp > 0 || e.isAlly);
      for (const e of killed) { p.exp += bonusExp(e.exp); p.gold += bonusGold(e.goldDrop); p.kills++; }
      processAoeKills(killed);
      addMsg(tMsg('sk.arcaneBlast', String(enemies.length)), 'msk'); shake(2); checkLevelUp();
      break;
    }
    case 'heal': {
      // Paladin — Holy Light
      const baseHeal = Math.floor(p.maxHp * .4);
      const healMult = 1 + (p.healBonus || 0);
      const heal = Math.floor(baseHeal * healMult * mods.dmgMult);
      p.hp = Math.min(p.maxHp, p.hp + heal); p.poisonTurns = 0;
      addMsg(tMsg('sk.holyLight', String(heal)), 'mh');
      fxFlash(p.x, p.y, '#80ed99', 1.5); flt(p.x, p.y, `+${heal} ❤️`, '#80ed99'); snd('heal');

      // Consecrate: also deal holy damage to nearby enemies
      if (mods.alsoHolyDmg) {
        const enemies = G.enemies.filter(e => !e.isAlly && dst(p.x, p.y, e.x, e.y) <= 4);
        const holyKilled: Enemy[] = [];
        for (const e of enemies) {
          const holyDmg = Math.floor(p.level * 2 * p.spellPower);
          e.hp -= holyDmg; fxFlash(e.x, e.y, '#ffd700'); flt(e.x, e.y, `-${holyDmg}✨`, '#ffd700');
          if (e.hp <= 0) holyKilled.push(e);
        }
        G.enemies = G.enemies.filter(e => e.hp > 0 || e.isAlly);
        for (const e of holyKilled) { p.exp += bonusExp(e.exp); p.gold += bonusGold(e.goldDrop); p.kills++; }
        processAoeKills(holyKilled);
        if (enemies.length) addMsg(tMsg('sk.consecrate', String(enemies.length)), 'mc');
        if (holyKilled.length > 0) checkLevelUp();
      }

      // Judgment: also stun nearest enemy
      if (mods.alsoStun) {
        const e = findNearestEnemy();
        if (e) {
          e.stunned = 2;
          addMsg(tMsg('sk.judgment', String(e.name)), 'mc');
          fxBeam(p.x, p.y, e.x, e.y, '#ffd700'); fxFlash(e.x, e.y, '#ffd700'); flt(e.x, e.y, '⚡STUN', '#ffd700');
        }
      }

      // Holy Nova: also heal allies
      if (mods.alsoHeal) {
        const allies = G.enemies.filter(e => e.isAlly && dst(p.x, p.y, e.x, e.y) <= 5);
        for (const a of allies) {
          const allyHeal = Math.floor(p.maxHp * 0.2);
          a.hp = Math.min(a.maxHp, a.hp + allyHeal);
          fxFlash(a.x, a.y, '#80ed99'); flt(a.x, a.y, `+${allyHeal}`, '#80ed99');
        }
        if (allies.length) addMsg(tMsg('sk.holyNova', String(allies.length)), 'mh');
      }
      break;
    }
  }
  // Smoke Screen — blind (stun) enemies near the player after the skill fires
  if (mods.alsoBlind) {
    const blindTargets = G.enemies.filter(e => !e.isAlly && dst(p.x, p.y, e.x, e.y) <= 4);
    for (const e of blindTargets) e.stunned = Math.max(e.stunned, 2);
    if (blindTargets.length) addMsg(tMsg('sk.smokeScreen', String(blindTargets.length)), 'mi');
  }
  if (_endTurn) _endTurn();
}
