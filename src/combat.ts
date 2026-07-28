// Combat system — attack, level up, death, victory
import type { Enemy, Element, Item } from './types.js';
import { G, lang } from './state.js';
import { FINAL } from './config.js';
import { rng, dst } from './utils.js';
import { snd, setBgmScene } from './audio.js';
import { flt, shake } from './effects.js';
import { fxFlash, fxBurst } from './fx.js';
import { applyRelicBonuses, relicOnHitEnemy, relicOnDamaged, relicOnDeath, getRelicGoldMult, getRelicExpMult, grantRandomRelic, relicOnKill, relicOnDodge, relicOnCrit } from './relics.js';
import { unlockAchievement } from './steam.js';
import { t } from './i18n.js';
import { ACH_DEFS, EQUIPMENT_SETS } from './data.js';
import { addMsg } from './messages.js';
import { processBossPhase } from './enemies.js';
import {
  applyTalentBonuses, onPlayerHitEnemy, onPlayerKill, onPlayerDodged,
  onPlayerDamaged, onPlayerDeath, onEnemyHitPlayer, checkDoubleStrike,
  getCritMultiplier, getManaShieldReduction,
} from './talents.js';
import { calculateSoulEchoes, updateRunStats, persistAchievement, renderEchoBreakdown, bonusGold, bonusExp, getMeta, creditSoulEchoes } from './meta.js';

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

export function attack(atk: { atk: number; name?: string; ai?: string; hp?: number; maxHp?: number; def?: number; el?: Element; res?: Partial<Record<Element, number>> }, def: { hp: number; maxHp: number; def: number; name: string; x: number; y: number; exp: number; goldDrop: number; isBoss?: boolean; isAlly?: boolean; el?: Element; res?: Partial<Record<Element, number>> }, isP: boolean): boolean {
  if (!G) return false;
  let dmg = Math.max(1, atk.atk - def.def + rng(-2, 2));

  // Dodge / ward — player dodging enemy attack
  if (!isP && G.player.warded) {
    G.player.warded = false;
    addMsg(lang === 'zh' ? '🛡 护身石抵挡了攻击！' : '🛡 Ward blocks the attack!', 'mi');
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
      addMsg(lang === 'zh' ? `暴击！对${def.name}造成${dmg}伤害${elSym}！` : `CRIT! You deal ${dmg}${elSym} to ${def.name}!`, 'mc');
      fxFlash(def.x, def.y, atkEl !== 'none' ? FX_EL_COLOR[atkEl] : '#ffd700', 1.6);
      flt(def.x, def.y, `-${dmg} CRIT!${elSym}`, '#ffd700', 'crit'); snd('crit'); shake(2, def.x - G.player.x, def.y - G.player.y);
    } else {
      addMsg(lang === 'zh' ? `你击中${def.name}，造成${dmg}伤害${elSym}。` : `You hit ${def.name} for ${dmg}${elSym}.`, 'mc');
      fxFlash(def.x, def.y, atkEl !== 'none' ? FX_EL_COLOR[atkEl] : ((def as any).c || '#ff6b6b'));
      flt(def.x, def.y, `-${dmg}${elSym}`, '#ff6b6b'); snd('hit'); shake(1, def.x - G.player.x, def.y - G.player.y);
    }
  } else {
    // Enemy attacks player
    addMsg(lang === 'zh' ? `${atk.name || 'Enemy'}击中你，造成${dmg}伤害${elSym}！` : `${atk.name || 'Enemy'} hits you for ${dmg}${elSym}!`, 'mc');
    fxFlash(G.player.x, G.player.y, '#e63946');
    flt(G.player.x, G.player.y, `-${dmg}${elSym}`, '#e63946'); snd('hit'); shake(1.4, G.player.x - (atk as any).x, G.player.y - (atk as any).y);
  }

  def.hp -= dmg;

  // Lifesteal
  if (atk.ai === 'lifesteal' && dmg > 0 && atk.hp !== undefined && atk.maxHp !== undefined) {
    const h = Math.floor(dmg / 3);
    (atk as Enemy).hp = Math.min(atk.maxHp, atk.hp + h);
    addMsg(lang === 'zh' ? `${atk.name}吸取了${h}生命！` : `${atk.name} drains ${h} life!`, 'mc');
  }

  // Boss phase check
  if ((def as Enemy).isBoss && def.hp > 0) {
    processBossPhase(def as Enemy);
  }

  if (def.hp <= 0) {
    if (isP) {
      fxBurst(def.x, def.y, (def as any).c || (atkEl !== 'none' ? FX_EL_COLOR[atkEl] : '#ff6b6b'), def.isBoss ? 26 : 12, def.isBoss ? 1.6 : 1);
      addMsg(lang === 'zh' ? `${def.name}被击败！+${bonusExp(def.exp)}经验` : `${def.name} defeated! +${bonusExp(def.exp)} XP`, 'mc');
      G.player.exp += Math.floor(bonusExp(def.exp) * getRelicExpMult());
      G.player.gold += Math.floor(bonusGold(def.goldDrop) * getRelicGoldMult());
      G.player.kills++;
      addMsg(lang === 'zh' ? `获得${bonusGold(def.goldDrop)}金币。` : `Found ${bonusGold(def.goldDrop)} gold.`, 'mp');
      snd('pickup');

      G.player.streak++;
      if (G.player.streak > G.player.bestStreak) G.player.bestStreak = G.player.streak;
      if (G.player.streak >= 3) {
        const bonus = bonusExp(Math.floor(def.exp * .2 * G.player.streak));
        G.player.exp += bonus;
        addMsg(`🔥 ${G.player.streak}x${t('streakMsg')} +${bonus}XP`, 'ml');
        checkAch('streak5');
      }

      if (def.isBoss) {
        G.player.bossesKilledThisRun++;
        checkAch('boss_kill');
        if (G.floor === FINAL) { playerVictory(); return true; }
      }

      // Talent trigger: on kill
      onPlayerKill(def as Enemy);
      relicOnKill(def as Enemy); // relic trigger: soul_harvester

      // Relic drop — bosses always, elites often
      if ((def as Enemy).isBoss || ((def as Enemy).isElite && Math.random() < 0.4)) {
        grantRandomRelic(def.x, def.y, G.floor);
      }

      // Loot drop — uses late-bound genItem
      if (Math.random() < .3 && _genItem) {
        const loot = _genItem(G.floor);
        loot.x = def.x; loot.y = def.y;
        G.items.push(loot);
        addMsg(lang === 'zh' ? `${def.name}掉落了${loot.name}！` : `${def.name} dropped ${loot.name}!`, 'mp');
        if (loot.rarity >= 4) checkAch('legendary');
      }

      checkLevelUp(); checkAchs();

      // Talent trigger: double strike (15% chance to attack again)
      if (checkDoubleStrike() && (def as Enemy).hp <= 0) {
        // Find another adjacent enemy to hit
        const nextTarget = G!.enemies.find(e => !e.isAlly && dst(e.x, e.y, G!.player.x, G!.player.y) <= 1.5);
        if (nextTarget) {
          addMsg(lang === 'zh' ? '⚔ 双重打击！' : '⚔ Double Strike!', 'mc');
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
        playerDeath(def.name);
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
    addMsg(lang === 'zh' ? `升级！你现在是${p.level}级！` : `LEVEL UP! Level ${p.level}!`, 'ml');
    addMsg(`+${hg}HP +${mg}MP +${ag}ATK +${dg}DEF`, 'ml');
    flt(p.x, p.y, 'LEVEL UP!', '#ffd700'); snd('levelup'); checkAchs();
  }
}

export function recalc(): void {
  if (!G) return;
  const p = G.player;
  p.atk = p.baseAtk; p.def = p.baseDef; p.maxHp = p.baseMaxHp;
  p.elRes = {}; p.elDmgBonus = {}; p.healBonus = (getMeta().upgrades['heal_bonus'] || 0) * 0.05;
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
    case 'heal_bonus': p.healBonus += value / 100; break;
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

export function playerDeath(killer: string): void {
  if (!G) return;
  G.gameOver = true;
  addMsg(lang === 'zh' ? `你被${killer}杀死了……` : `You were slain by ${killer}...`, 'md');
  snd('death'); setBgmScene('death');

  // Calculate soul echoes and update meta stats
  const p = G.player;
  const echoes = calculateSoulEchoes(p.kills, G.floor, p.bossesKilledThisRun, p.gold, p.bestStreak, false);
  creditSoulEchoes(echoes.total);
  updateRunStats({
    floor: G.floor, kills: p.kills, bossesKilled: p.bossesKilledThisRun,
    gold: p.gold, turns: p.turns, won: false, level: p.level,
    bestStreak: p.bestStreak, classIdx: p.ci,
  });

  document.getElementById('death-screen')!.style.display = 'flex';
  document.getElementById('death-stats')!.innerHTML =
    `${lang === 'zh' ? '到达第' : 'Reached Floor'} ${G.floor} · ${lang === 'zh' ? '等级' : 'Level'} ${G.player.level}<br>` +
    `${G.player.kills} ${lang === 'zh' ? '敌人击杀' : 'enemies slain'} · ${G.player.gold} ${lang === 'zh' ? '金币' : 'gold'}<br>` +
    `${lang === 'zh' ? '存活' : 'Survived'} ${G.player.turns} ${lang === 'zh' ? '回合' : 'turns'}`;
  renderEchoBreakdown('death-echoes', echoes);
  localStorage.removeItem('dh_save');
}

export function playerVictory(): void {
  if (!G) return;
  G.gameOver = true; G.won = true;
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

  document.getElementById('victory-screen')!.style.display = 'flex';
  document.getElementById('vic-stats')!.innerHTML =
    `<span style="color:#ffd700">🏆 ${lang === 'zh' ? '暗渊英雄' : 'HERO OF DARKHOLLOW'} 🏆</span><br><br>` +
    `${lang === 'zh' ? '等级' : 'Level'} ${G.player.level} ${G.player.raceName} ${G.player.clsName}<br>` +
    `${lang === 'zh' ? '到达第' : 'Floor'} ${G.floor}<br>${G.player.kills} ${lang === 'zh' ? '击杀' : 'kills'}<br>` +
    `${G.player.gold} ${lang === 'zh' ? '金币' : 'gold'}<br>${G.player.turns} ${lang === 'zh' ? '回合' : 'turns'}`;
  renderEchoBreakdown('vic-echoes', echoes);
  localStorage.removeItem('dh_save');
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
  addMsg('🏆 ' + (lang === 'zh' ? def.n.zh : def.n.en) + ' — ' + (lang === 'zh' ? def.d.zh : def.d.en), 'mach');
  snd('ach');
  flt(G.player.x, G.player.y, '🏆', '#ffd700');
}

export function killEnemy(e: Enemy): void {
  if (!G) return;
  fxBurst(e.x, e.y, e.c || '#ff6b6b', e.isBoss ? 26 : 12, e.isBoss ? 1.6 : 1);
  // Relic drop — bosses always, elites often (covers skill/scroll/trap/thorns kills
  // which route through killEnemy rather than the melee attack() path).
  if (e.isBoss || (e.isElite && Math.random() < 0.4)) grantRandomRelic(e.x, e.y, G.floor);
  G.enemies = G.enemies.filter(en => en !== e);
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
  addMsg(lang === 'zh' ? `${e.name}被击败！+${e.exp}XP` : `${e.name} defeated! +${e.exp}XP`, 'mc');

  // Boss kill — keep in sync with attack() so skill/scroll/AOE kills also count
  if (e.isBoss) {
    G.player.bossesKilledThisRun++;
    checkAch('boss_kill');
    if (G.floor === FINAL) { playerVictory(); return; }
  }

  // Talent trigger: on kill
  onPlayerKill(e);
  relicOnKill(e); // relic trigger: soul_harvester

  checkLevelUp(); checkAchs();

  // Talent trigger: double strike
  if (checkDoubleStrike()) {
    const nextTarget = G!.enemies.find(en => !en.isAlly && dst(en.x, en.y, G!.player.x, G!.player.y) <= 1.5);
    if (nextTarget) {
      addMsg(lang === 'zh' ? '⚔ 双重打击！' : '⚔ Double Strike!', 'mc');
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
