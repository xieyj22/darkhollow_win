// Enemy generation and AI
import type { Enemy, Room, Element } from './types.js';
import { G, lang } from './state.js';
import { MW, MH, TL, FINAL } from './config.js';
import { rng, pick, dst } from './utils.js';
import { bonusExp } from './meta.js';
import { flt, shake } from './effects.js';
import { ENEMIES, BOSSES, ELITE_PREFIX, AREAS } from './data.js';
import { addMsg } from './messages.js';
import { attack, killEnemy, checkLevelUp } from './combat.js';
import { onPlayerDamaged, onEnemyHitPlayer, onPlayerDodged, onPlayerDeath, getManaShieldReduction } from './talents.js';
import { relicOnDodge } from './relics.js';
import { setEnemyTween } from './render.js';
import { makeEnemy } from './enemy-factory.js';
import { wardenStats } from './warden.js';

export function spawnEnemies(floor: number, rooms: Room[]): Enemy[] {
  const ens: Enemy[] = [];
  // mf >= 1 excludes branch-only enemies (mf === 0) from main-floor spawns.
  const el = ENEMIES.filter(e => e.mf <= floor && e.mf >= 1);
  // Scale enemy count with floor, more enemies in deeper areas
  const area = AREAS.find(a => floor >= a.floorStart && floor <= a.floorEnd);

  // Build one enemy inside a given room (returns null for the start room).
  const makeIn = (rm: Room): Enemy | null => {
    if (rm === rooms[0]) return null;
    const x = rng(rm.x + 1, rm.x + rm.w - 2), y = rng(rm.y + 1, rm.y + rm.h - 2);
    const se = el.filter(e => e.mf <= floor && e.mf >= Math.max(1, floor - 4) && e.mf >= 1);
    const base = se.length > 0 ? pick(se) : pick(el);
    const fs = 1 + (floor - 1) * .12 + (area ? area.enemyScaleBonus : 0);
    let nm = lang === 'zh' ? base.n.zh : base.n.en;
    let hpM = 1, atkM = 1, defAdd = 0, expM = 1, goldM = 1, isElite = false;
    if (floor >= 3 && Math.random() < Math.min(.25, .05 + floor * .01)) {
      const pf = pick(ELITE_PREFIX);
      nm = (lang === 'zh' ? pf.n.zh : pf.n.en) + nm;
      hpM = pf.hpM; atkM = pf.atkM; defAdd = pf.defM || 0; expM = pf.expM; goldM = pf.goldM; isElite = true;
    }
    return makeEnemy(base, x, y, fs, { hpM, atkM, defAdd, expM, goldM, isElite }, nm);
  };

  // Guarantee at least one enemy in every non-start room, then scatter extras
  // so no cleared-out rooms feel empty.
  const otherRooms = rooms.filter(r => r !== rooms[0]);
  for (const rm of otherRooms) { const e = makeIn(rm); if (e) ens.push(e); }
  const extra = rng(2, 5) + Math.floor(floor / 3);
  for (let i = 0; i < extra; i++) {
    const rm = otherRooms.length ? pick(otherRooms) : pick(rooms);
    const e = makeIn(rm); if (e) ens.push(e);
  }
  const bd = BOSSES.find(b => b.fl === floor);
  if (bd) {
    const br = rooms.length > 2 ? rooms[rooms.length - 2] : rooms[rooms.length - 1];
    const bs = 1 + (floor - 1) * .1;
    ens.push(makeEnemy(bd, br.cx, br.cy, bs, { isBoss: true }, lang === 'zh' ? bd.n.zh : bd.n.en));
  }
  // Endless scaled boss: every 5 floors past FINAL, reuse a random main-line
  // BossDef with floor scaling so F45/F50/... always have a boss. Only fires
  // in endless runs (normal mode ends at FINAL), but the floor>FINAL gate makes
  // it self-guarding regardless.
  if (floor > FINAL && floor % 5 === 0 && G) {
    const base = pick(BOSSES);
    const fs = 1 + (floor - 1) * .1; // boss scale (.1), not enemy scale (.12)
    const br = rooms.length > 2 ? rooms[rooms.length - 2] : rooms[rooms.length - 1];
    ens.push(makeEnemy(base, br.cx, br.cy, fs, { isBoss: true }, lang === 'zh' ? base.n.zh : base.n.en));
  }
  return ens;
}

// Branch-biome enemy spawn (portal "Fungal Hollow"). Pulls only enemies
// tagged mf===0 and the fl===0 mini-boss (Task 2 data). Until Task 2 lands,
// both filters come up empty and this returns [] — no branch enemies spawn.
// Mini-boss is a STATIC isBoss (no phases/summon) so it does NOT couple to
// G.floor via processBossPhase (the branch keeps G.floor = main floor).
export function spawnBranchEnemies(rooms: Room[], entryFloor: number): Enemy[] {
  const pool = ENEMIES.filter(e => e.mf === 0);
  if (!pool.length) return [];
  const fs = 1 + (entryFloor - 1) * .12;
  const ens: Enemy[] = [];
  // Branch enemies are tuned ~0.7x main-line strength (side content, not critical path).
  const otherRooms = rooms.filter(r => r !== rooms[0]);
  for (const rm of otherRooms) {
    const x = rng(rm.x + 1, rm.x + rm.w - 2), y = rng(rm.y + 1, rm.y + rm.h - 2);
    const base = pick(pool);
    ens.push(makeEnemy(base, x, y, fs, { hpM: .7, atkM: .7, defM: .7, expM: .7, goldM: .7 }));
  }
  // Static mini-boss (fl===0) at the second-to-last room center.
  const mb = BOSSES.find(b => b.fl === 0);
  if (mb) {
    const br = rooms.length > 2 ? rooms[rooms.length - 2] : rooms[rooms.length - 1];
    ens.push(makeEnemy(mb, br.cx, br.cy, fs, { isBoss: true }, lang === 'zh' ? mb.n.zh : mb.n.en));
  }
  return ens;
}

// The Warden (Wave 8): a stalking nemesis that spawns on a random cd. Strong
// chase elite; killing it (combat.grantKillRewards) drops a specific relic +
// unlocks a memory. It is a normal floor enemy, so descending (enterFloor)
// naturally despawns it — "fight or flight". tag 'spirit' -> WRAITH sprite.
export function spawnWarden(floor: number): void {
  if (!G) return;
  const rooms = G.dungeon.rooms.slice(1); // never in the start room
  if (!rooms.length) return;
  const rm = pick(rooms);
  const s = wardenStats(floor);
  G.enemies.push({
    name: lang === 'zh' ? '守渊人' : 'The Warden', ch: 'Ѡ', c: '#9a2be2',
    x: rng(rm.x + 1, rm.x + rm.w - 2), y: rng(rm.y + 1, rm.y + rm.h - 2),
    hp: s.hp, maxHp: s.maxHp, atk: s.atk, def: s.def, exp: s.exp,
    goldDrop: rng(30, 60) + floor * 3,
    ai: 'chase', stunned: 0, feared: 0, isAlly: false, isElite: true, isWarden: true,
    el: 'shadow', res: { shadow: 0.5, holy: -0.5 }, skillCd: 0, tags: ['spirit'],
  });
  addMsg(lang === 'zh' ? '👁 守渊人正在追猎你……' : '👁 The Warden is hunting you...', 'me');
  flt(G.player.x, G.player.y, '⚠WARDEN', '#9a2be2'); snd('boss'); shake();
}

// Boss phase check — call after boss takes damage
export function processBossPhase(boss: Enemy): void {
  if (!G || !boss.isBoss) return;
  // Branch mini-boss is static (no phases). G.floor stays = main entry floor
  // inside a branch, so without this guard a boss-floor entry (entry % 5 === 0)
  // would resolve the entry floor's boss def and wrongly apply its phases to
  // the mini-boss. branchMode is always false on the main line (F1-40), so this
  // is a zero-impact change to main-line behavior.
  if (G.branchMode) return;
  const fl = G.floor;
  const bd = BOSSES.find(b => b.fl === fl);
  if (!bd || !bd.phases) return;
  if (!boss.phasesTriggered) boss.phasesTriggered = new Set();
  const origAtk = bd.atk * (1 + (fl - 1) * .1);
  for (let i = 0; i < bd.phases.length; i++) {
    const phase = bd.phases[i];
    if (boss.phasesTriggered.has(i)) continue;
    const hpRatio = boss.hp / boss.maxHp;
    if (hpRatio <= phase.hpThreshold) {
      boss.phasesTriggered.add(i);
      if (phase.newAi) boss.ai = phase.newAi;
      if (phase.newEl) boss.el = phase.newEl;
      if (phase.atkM) {
        boss.atk = Math.floor(origAtk * phase.atkM);
        addMsg(lang === 'zh' ? `⚠ ${boss.name}进入新阶段！攻击力大增！` : `⚠ ${boss.name} enters a new phase! ATK surges!`, 'me');
        flt(boss.x, boss.y, '⚡ PHASE!', '#ff4500');
      }
    }
  }
}

export function processEnemies(): void {
  if (!G) return;
  const playerInvis = G.player.buffs.some(b => b.type === 'invis');
  // Snapshot the list at the start of the turn: enemies pushed during the loop
  // (summon AI / boss summon) must NOT act on the same turn they appear, and
  // enemies removed mid-loop (killed by an ally/counter) must be skipped.
  const queue = G.enemies.slice();
  for (const e of queue) {
    if (G.gameOver) return;
    if (!G.enemies.includes(e)) continue;
    if (e.isAlly) { processAlly(e); continue; }
    if (e.stunned > 0) { e.stunned--; continue; }
    if (e.skillCd > 0) e.skillCd--;
    // Boss summon adds (point 4) — fires independently of the AI / CC state.
    if (e.isBoss) tryBossSummon(e);
    const d = dst(e.x, e.y, G.player.x, G.player.y);

    if (e.feared > 0) {
      e.feared--;
      const dx = e.x > G.player.x ? 1 : e.x < G.player.x ? -1 : 0;
      const dy = e.y > G.player.y ? 1 : e.y < G.player.y ? -1 : 0;
      tryMove(e, dx, dy); continue;
    }
    // Melee attack still works even when invisible (enemy is adjacent)
    if (d <= 1.5) { attack(e, G.player, false); if (G.gameOver) return; continue; }

    // When player is invisible, enemies can only detect at very close range
    if (playerInvis) { randMove(e); continue; }

    switch (e.ai) {
      case 'chase': if (d < 8 || G.player.visible?.[e.y]?.[e.x]) moveTo(e, G.player.x, G.player.y); else randMove(e); break;
      case 'erratic': if (d < 6) Math.random() < .6 ? moveTo(e, G.player.x, G.player.y) : randMove(e); else randMove(e); break;
      case 'wander': if (d < 4) moveTo(e, G.player.x, G.player.y); else randMove(e); break;
      case 'ambush': if (d < 5) moveTo(e, G.player.x, G.player.y); else randMove(e); break;
      case 'phase':
        if (d < 8) {
          const dx = Math.sign(G.player.x - e.x), dy = Math.sign(G.player.y - e.y);
          const nx = e.x + dx, ny = e.y + dy;
          if (nx >= 0 && nx < MW && ny >= 0 && ny < MH && G.dungeon.map[ny][nx] !== TL.VOID && !G.enemies.some(o => o !== e && o.x === nx && o.y === ny) && !(nx === G.player.x && ny === G.player.y)) { const ox = e.x, oy = e.y; e.x = nx; e.y = ny; setEnemyTween(e, ox, oy, nx, ny); }
        } else randMove(e); break;
      case 'ranged':
        if (d < 2) { attack(e, G.player, false); if (G.gameOver) return; }
        else if (d < 7 && G.player.visible?.[e.y]?.[e.x]) {
          // Check ward
          if (G.player.warded) {
            G.player.warded = false;
            addMsg(lang === 'zh' ? '🛡 护身石抵挡了远程攻击！' : '🛡 Ward blocks the blast!', 'mi');
            flt(G.player.x, G.player.y, 'WARD!', '#4895ef'); snd('heal'); break;
          }
          // Check dodge — also trigger onPlayerDodged for talent effects (shadow dance)
          if (Math.random() < G.player.dodgeChance) {
            addMsg(lang === 'zh' ? `你闪避了${e.name}的远程攻击！` : `You dodge ${e.name}'s blast!`, 'mi');
            onPlayerDodged();
            relicOnDodge(); // relic trigger: wind_step
            break;
          }
          let dmg = Math.max(1, Math.floor(e.atk * .7) - G.player.def + rng(-1, 1));
          // Ranged attacks previously bypassed attack() — apply Mana Shield here
          // so the talent isn't useless against ranged enemies.
          const msr = getManaShieldReduction();
          if (msr > 0) dmg = Math.max(1, Math.floor(dmg * (1 - msr)));
          G.player.hp -= dmg;
          addMsg(lang === 'zh' ? `${e.name}远程攻击-${dmg}！` : `${e.name} blasts you for ${dmg}!`, 'mc');
          flt(G.player.x, G.player.y, `-${dmg}`, '#9b5de5'); snd('hit');
          // Trigger talent effects: onPlayerDamaged and onEnemyHitPlayer
          onPlayerDamaged(dmg);
          onEnemyHitPlayer(e);
          if (G.player.hp <= 0) {
            // Talent auto-revive check
            if (onPlayerDeath()) {
              // Player was revived
            } else {
              playerDeath(e.name); return;
            }
          }
        }
        else if (d < 8) moveTo(e, G.player.x, G.player.y); else randMove(e); break;
      case 'lifesteal': if (d < 8) moveTo(e, G.player.x, G.player.y); else randMove(e); break;
      case 'summon':
        // Summon AI: chase like normal, but every 4 turns summon an ally-like enemy
        if (d < 8 || G.player.visible?.[e.y]?.[e.x]) moveTo(e, G.player.x, G.player.y); else randMove(e);
        if (e.skillCd <= 0 && G.enemies.length < 30) {
          e.skillCd = 4;
          // Find eligible enemies for current floor
          const fl = G.floor;
          const summonPool = ENEMIES.filter(en => en.mf <= fl && en.mf >= Math.max(1, fl - 6) && en.ai !== 'summon');
          if (summonPool.length > 0) {
            const base = pick(summonPool);
            const fs = 1 + (fl - 1) * .12;
            // Spawn near the summoner
            const sx = e.x + rng(-2, 2), sy = e.y + rng(-2, 2);
            if (sx >= 0 && sx < MW && sy >= 0 && sy < MH &&
                G.dungeon.map[sy]?.[sx] !== TL.WALL && G.dungeon.map[sy]?.[sx] !== TL.VOID &&
                !G.enemies.some(o => o.x === sx && o.y === sy)) {
              const sn: Enemy = makeEnemy(base, sx, sy, fs, { hpM: .5, atkM: .7, defM: .5, expM: .3, goldM: .3 });
              G.enemies.push(sn);
              addMsg(lang === 'zh' ? `${e.name}召唤了${sn.name}！` : `${e.name} summons a ${sn.name}!`, 'me');
              flt(sx, sy, '⚡SUMMON', '#9b5de5');
            }
          }
        }
        break;
      case 'teleport':
        // Teleport AI: every 3 turns, teleport near player then chase
        if (e.skillCd <= 0 && d > 2) {
          e.skillCd = 3;
          // Try to teleport to a visible tile 4-6 tiles from player
          const attempts = 10;
          for (let i = 0; i < attempts; i++) {
            const tx = G.player.x + rng(-6, 6), ty = G.player.y + rng(-6, 6);
            if (tx >= 0 && tx < MW && ty >= 0 && ty < MH &&
                G.dungeon.map[ty][tx] !== TL.WALL && G.dungeon.map[ty][tx] !== TL.VOID &&
                dst(tx, ty, G.player.x, G.player.y) >= 3 &&
                !G.enemies.some(o => o !== e && o.x === tx && o.y === ty) &&
                !(tx === G.player.x && ty === G.player.y)) {
              e.x = tx; e.y = ty;
              addMsg(lang === 'zh' ? `${e.name}瞬移了！` : `${e.name} teleports!`, 'me');
              flt(tx, ty, '⚡BLINK', '#8a2be2');
              break;
            }
          }
        } else {
          if (d < 8) moveTo(e, G.player.x, G.player.y); else randMove(e);
        }
        break;
      default: randMove(e);
    }
  }
}

function processAlly(ally: Enemy): void {
  if (!G) return;
  let nearest: Enemy | null = null, nd = 999;
  for (const e of G.enemies) { if (e.isAlly) continue; const d = dst(ally.x, ally.y, e.x, e.y); if (d < nd) { nd = d; nearest = e; } }
  if (nearest && nd <= 1.5) {
    const dmg = Math.max(1, ally.atk - nearest.def + rng(-1, 1));
    nearest.hp -= dmg;
    addMsg(t('allyHit') + nearest.name + ' -' + dmg, 'mc');
    flt(nearest.x, nearest.y, `-${dmg}`, '#06d6a0');
    if (nearest.hp <= 0) { killEnemy(nearest); G.enemies = G.enemies.filter(e => e !== nearest); addMsg(t('allyKill') + nearest.name + '!', 'mc'); }
  } else if (nearest && nd < 8) moveTo(ally, nearest.x, nearest.y);
  else moveTo(ally, G.player.x, G.player.y);
}

// --- Boss summon (point 4): bosses with a summon def randomly call adds ---
function tryBossSummon(boss: Enemy): void {
  if (!G) return;
  // Branch mini-boss is static (no summon). Same fl-coupling hole as
  // processBossPhase: G.floor = main entry floor in a branch, so a boss-floor
  // entry (entry % 5 === 0) would resolve the entry floor's boss def and the
  // mini-boss would summon that floor's adds. branchMode is always false on
  // the main line (F1-40), so zero main-line impact.
  if (G.branchMode) return;
  const fl = G.floor;
  const bd = BOSSES.find(b => b.fl === fl);
  if (!bd || !bd.summon) return;
  if (boss.skillCd > 0) return;                 // on cooldown
  const cfg = bd.summon;
  // Count nearby adds so the boss doesn't flood the floor.
  const nearbyAdds = G.enemies.filter(en => !en.isBoss && !en.isAlly && dst(en.x, en.y, boss.x, boss.y) <= 8).length;
  if (nearbyAdds >= cfg.maxAdds) return;
  if (Math.random() > cfg.chance) { boss.skillCd = 1; return; } // small backoff, re-roll next turn
  boss.skillCd = cfg.cd;
  bossSummonAdd(boss);
}

function bossSummonAdd(boss: Enemy): void {
  if (!G) return;
  const fl = G.floor;
  const bd = BOSSES.find(b => b.fl === fl);
  if (!bd || !bd.summon) return;
  const cfg = bd.summon;
  // 优先主题小弟(按 n.en);查不到回退楼层随机池
  let base = cfg.kind ? ENEMIES.find(en => en.n.en === cfg.kind) : undefined;
  if (!base) {
    const pool = ENEMIES.filter(en => en.mf <= fl && en.mf >= Math.max(1, fl - 8) && !en.tags?.includes('boss'));
    base = pool.length ? pick(pool) : undefined;
  }
  if (!base) return;
  const fs = 1 + (fl - 1) * .12;
  for (let attempt = 0; attempt < 8; attempt++) {
    const sx = boss.x + rng(-2, 2), sy = boss.y + rng(-2, 2);
    if (sx < 0 || sx >= MW || sy < 0 || sy >= MH) continue;
    if (G.dungeon.map[sy][sx] === TL.WALL || G.dungeon.map[sy][sx] === TL.VOID) continue;
    if (G.enemies.some(o => o.x === sx && o.y === sy)) continue;
    if (sx === G.player.x && sy === G.player.y) continue;
    const sn: Enemy = makeEnemy(base, sx, sy, fs, { hpM: .6, atkM: .8, defM: .6, expM: .4, goldM: .4 });
    G.enemies.push(sn);
    addMsg(lang === 'zh' ? `${boss.name}召唤了${sn.name}！` : `${boss.name} summons a ${sn.name}!`, 'me');
    flt(sx, sy, '⚡SUMMON', '#ff4500');
    return;
  }
}

function moveTo(e: Enemy, tx: number, ty: number): boolean {
  const dx = Math.sign(tx - e.x), dy = Math.sign(ty - e.y);
  if (tryMove(e, dx, 0)) return true;
  if (tryMove(e, 0, dy)) return true;
  return tryMove(e, dx, dy);
}

function tryMove(e: Enemy, dx: number, dy: number): boolean {
  if (!G) return false;
  const nx = e.x + dx, ny = e.y + dy;
  if (nx < 0 || nx >= MW || ny < 0 || ny >= MH) return false;
  if (G.dungeon.map[ny][nx] === TL.WALL || G.dungeon.map[ny][nx] === TL.VOID) return false;
  if (G.enemies.some(o => o !== e && o.x === nx && o.y === ny)) return false;
  if (nx === G.player.x && ny === G.player.y) return false;
  const ox = e.x, oy = e.y;
  e.x = nx; e.y = ny;
  setEnemyTween(e, ox, oy, nx, ny);
  return true;
}

function randMove(e: Enemy): boolean {
  const ds: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  const d = ds[rng(0, 3)];
  return tryMove(e, d[0], d[1]);
}

// Late-bound imports
import { t } from './i18n.js';
import { playerDeath } from './combat.js';
import { snd } from './audio.js';

export function checkPlayerTraps(): void {
  if (!G || !G.traps) return;
  for (let i = G.traps.length - 1; i >= 0; i--) {
    const trap = G.traps[i];
    if (!trap.playerTrap || trap.triggered) continue;
    const enemy = G.enemies.find(e => !e.isAlly && e.x === trap.x && e.y === trap.y);
    if (enemy) {
      trap.triggered = true; enemy.hp -= trap.dmg;
      flt(enemy.x, enemy.y, `-${trap.dmg}`, '#a0522d');
      addMsg(lang === 'zh' ? `捕兽夹咬住了${enemy.name}！-${trap.dmg}` : `Bear trap snaps ${enemy.name}! -${trap.dmg}`, 'mc'); snd('hit');
      if (enemy.hp <= 0) { killEnemy(enemy); G.enemies = G.enemies.filter(e => e.hp > 0 || e.isAlly); }
    }
  }
}
