// Enemy skill system — data-driven casting, mirrors player executeSkill.
import type { Enemy, EnemySkill } from './types.js';
import { G } from './state.js';
import { dst, rng, pick } from './utils.js';
import { MW, MH, TL } from './config.js';
import { attack } from './combat.js';
import { addMsg } from './messages.js';
import { fxBeam, fxBurst, fxFlash, fxAura } from './fx.js';
import { flt, shake } from './effects.js';
import { snd } from './audio.js';
import { makeEnemy } from './enemy-factory.js';
import { ENEMIES } from './data.js';
import { tMsg } from './i18n.js';

// Pure decision — extracted so it is unit-testable without G/enemies.
export function shouldCastSkill(e: Enemy, dist: number, visible: boolean, playerInvis: boolean): boolean {
  if (!e.skill || e.skillCd > 0) return false;
  if (playerInvis && dist > 2) return false;       // invis: only point-blank
  if (!playerInvis && !visible) return false;       // normal: must see player
  const range = e.skill.range ?? 5;
  if (dist > range) return false;
  return Math.random() < e.skill.chance;
}

const EL_COLOR: Record<string, string> = { fire: '#ff7a45', ice: '#7ec8e3', lightning: '#fff2a8', shadow: '#b583f6', holy: '#ffd700', none: '#b583f6' };

export function executeEnemySkill(caster: Enemy, sk: EnemySkill): void {
  if (!G || G.gameOver) return;
  const col = EL_COLOR[sk.el ?? caster.el] ?? '#b583f6';
  switch (sk.effect) {
    case 'dmg_bolt':      return castDamageBolt(caster, sk, col);
    case 'dmg_aoe':       return castDamageAoe(caster, sk, col);
    case 'heal':          return castHeal(caster, sk);
    case 'buff':          return castBuff(caster, sk);
    case 'debuff_poison': return castDebuff(caster, sk, 'poison');
    case 'debuff_slow':   return castDebuff(caster, sk, 'slow');
    case 'debuff_weaken': return castDebuff(caster, sk, 'weaken');
    case 'debuff_stun':   return castDebuff(caster, sk, 'stun');
    case 'blink':         return castBlink(caster);
    case 'summon':        return castSummon(caster);
  }
}

function castDamageBolt(caster: Enemy, sk: EnemySkill, col: string): void {
  if (!G) return;
  const orig = caster.atk;
  caster.atk = Math.floor(orig * (sk.dmg ?? 1.5));
  fxBeam(caster.x, caster.y, G.player.x, G.player.y, col);
  attack(caster, G.player, false);
  caster.atk = orig;
  addMsg(tMsg('esk.bolt', String(caster.name)), 'me');
}

function castDamageAoe(caster: Enemy, sk: EnemySkill, col: string): void {
  if (!G) return;
  const radius = sk.aoe ?? 2;
  const orig = caster.atk;
  caster.atk = Math.floor(orig * (sk.dmg ?? 1.3));
  fxBurst(G.player.x, G.player.y, col, 18, 1.3);
  // Player: AOE ignores dodge — temporarily suppress (don't modify attack() body).
  const od = G.player.dodgeChance;
  G.player.dodgeChance = 0;
  attack(caster, G.player, false);
  G.player.dodgeChance = od;
  // Allies in radius: direct damage (attack() would treat ally as player — see spec §2.4).
  const allies = G.enemies.filter(a => a.isAlly && a !== caster && dst(caster.x, caster.y, a.x, a.y) <= radius);
  for (const ally of allies) {
    const raw = Math.max(1, caster.atk - ally.def);
    ally.hp -= raw; flt(ally.x, ally.y, `-${raw}`, col);
    if (ally.hp <= 0) { fxBurst(ally.x, ally.y, ally.c, 10, 0.8); }
  }
  G.enemies = G.enemies.filter(a => a.hp > 0 || (!a.isAlly));
  caster.atk = orig;
  addMsg(tMsg('esk.aoe', String(caster.name)), 'me');
}

function castHeal(caster: Enemy, sk: EnemySkill): void {
  // v1: no caster uses this effect yet (see spec §7 follow-ups); kept complete per spec §2.2 deliverable.
  if (!G) return;
  const amt = Math.floor(caster.maxHp * 0.25 * (sk.dmg ?? 1));
  const hurtAllies = G.enemies.filter(a => a.isAlly && a.hp < a.maxHp);
  const target = (caster.hp < caster.maxHp) ? caster : (hurtAllies[0] ?? caster);
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + amt);
  fxFlash(target.x, target.y, '#80ed99', 1.2);
  flt(target.x, target.y, `+${target.hp - before}`, '#80ed99');
  addMsg(tMsg('esk.heal', String(caster.name)), 'mc');
}

function castBuff(caster: Enemy, sk: EnemySkill): void {
  if (!G) return;
  // Enemy has no buffs[] system (only Player does) — use lightweight temp-atk fields.
  const val = sk.dmg ?? 6, turns = sk.aoe ?? 3;
  caster.atkBuffVal = (caster.atkBuffVal ?? 0) + val;
  caster.atkBuffTurns = turns;
  caster.atk += val;
  fxAura(caster.x, caster.y, '#ffd700');
  addMsg(tMsg('esk.buff', String(caster.name)), 'mc');
}

function castDebuff(caster: Enemy, sk: EnemySkill, kind: 'poison' | 'slow' | 'weaken' | 'stun'): void {
  if (!G) return;
  const p = G.player;
  const turns = sk.aoe ?? 3;
  if (kind === 'poison') {
    p.poisonTurns = Math.max(p.poisonTurns, turns);
    p.poisonDmg = Math.max(p.poisonDmg, sk.dmg ?? 4);
    fxBurst(p.x, p.y, '#7ec8e3', 10, 0.8);
  } else if (kind === 'slow') {
    p.slowed = Math.max(p.slowed ?? 0, turns);
    fxFlash(p.x, p.y, '#7ec8e3');
  } else if (kind === 'weaken') {
    // Reuse player buff system with negative value (recalc L258: str_buff adds value → negative subtracts).
    p.buffs.push({ name: 'weakened', type: 'str_buff', value: -(sk.dmg ?? 6), turns });
    fxFlash(p.x, p.y, '#b583f6');
  } else { // stun
    // v1: no caster uses the 'stun' kind yet (see spec §7 follow-ups); kept complete per spec §2.2 deliverable.
    p.stunned = Math.min(2, Math.max(p.stunned ?? 0, turns));
    fxFlash(p.x, p.y, '#fff2a8'); shake(1);
  }
  addMsg(tMsg(`esk.${kind}`, String(caster.name)), 'me');
}

function castBlink(caster: Enemy): void {
  // v1: no caster uses this effect yet (see spec §7 follow-ups); kept complete per spec §2.2 deliverable.
  if (!G) return;
  for (let i = 0; i < 10; i++) {
    const tx = G.player.x + rng(-1, 1), ty = G.player.y + rng(-1, 1);
    if (tx === caster.x && ty === caster.y) continue;
    if (tx < 0 || tx >= MW || ty < 0 || ty >= MH) continue;
    if (G.dungeon.map[ty][tx] === TL.WALL || G.dungeon.map[ty][tx] === TL.VOID) continue;
    if (G.enemies.some(o => o !== caster && o.x === tx && o.y === ty)) continue;
    if (tx === G.player.x && ty === G.player.y) continue;
    caster.x = tx; caster.y = ty;
    flt(tx, ty, '⚡BLINK', '#8a2be2');
    addMsg(tMsg('esk.blink', String(caster.name)), 'me');
    return;
  }
}

function castSummon(caster: Enemy): void {
  // v1: no caster uses this effect yet (see spec §7 follow-ups); kept complete per spec §2.2 deliverable.
  if (!G || G.enemies.length >= 30) return;
  const fl = G.floor;
  const pool = ENEMIES.filter(en => en.mf <= fl && en.mf >= Math.max(1, fl - 6) && !en.tags?.includes('boss'));
  if (!pool.length) return;
  const base = pick(pool);
  const fs = 1 + (fl - 1) * 0.12;
  for (let attempt = 0; attempt < 8; attempt++) {
    const sx = caster.x + rng(-2, 2), sy = caster.y + rng(-2, 2);
    if (sx < 0 || sx >= MW || sy < 0 || sy >= MH) continue;
    if (G.dungeon.map[sy][sx] === TL.WALL || G.dungeon.map[sy][sx] === TL.VOID) continue;
    if (G.enemies.some(o => o.x === sx && o.y === sy)) continue;
    if (sx === G.player.x && sy === G.player.y) continue;
    const sn = makeEnemy(base, sx, sy, fs, { hpM: 0.6, atkM: 0.8, defM: 0.6, expM: 0.4, goldM: 0.4 });
    G.enemies.push(sn);
    flt(sx, sy, '⚡SUMMON', '#9b5de5');
    addMsg(tMsg('esk.summon', String(caster.name), String(sn.name)), 'me');
    return;
  }
}
