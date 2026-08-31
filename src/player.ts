// Player creation, movement, actions
import type { Player } from './types.js';
import { G, lang } from './state.js';
import { MW, MH, TL, FOV, MAX_INV } from './config.js';
import { RACES, CLASSES } from './data.js';
import { addMsg } from './messages.js';
import { dst } from './utils.js';
import { snd } from './audio.js';
import { flt } from './effects.js';
import { fxFlash } from './fx.js';
import { setPlayerTween } from './render.js';
import { t, tMsg, tx } from './i18n.js';
import { attack, applyCorruption } from './combat.js';
import { addItemWithOverflow } from './items.js';
import { checkTraps, checkTiles, triggerNpc } from './events.js';
import { npcPersists } from './npc-rules.js';
import { applyMetaUpgrades, bonusGold } from './meta.js';

let _endTurn: (() => void) | null = null;
export function setEndTurnFn(fn: () => void): void { _endTurn = fn; }

export function createPlayer(ri: number, ci: number, endless: boolean): Player {
  const race = RACES[ri], cls = CLASSES[ci];
  const hp = cls.hp + race.hpM, mp = cls.mp + race.mpM;
  const player: Player = {
    x: 0, y: 0, hp, maxHp: hp, mp, maxMp: mp,
    atk: cls.atk + race.atkM, def: cls.def + race.defM,
    baseAtk: cls.atk + race.atkM, baseDef: cls.def + race.defM, baseMaxHp: hp,
    level: 1, exp: 0, expNext: 20, gold: 0, turns: 0,
    raceName: tx(race.name),
    clsName: tx(cls.name),
    ri, ci,
    inv: [], eq: { weapon: null, armor: null, accessory: null, accessory2: null },
    buffs: [], visible: null,
    explored: Array.from({ length: MH }, () => Array(MW).fill(false)),
    kills: 0, deepestFloor: 1,
    critChance: ci === 1 ? .15 : .05,
    baseCritChance: ci === 1 ? .15 : .05,
    spellPower: ci === 2 ? 1.5 : ci === 3 ? 1.1 : 1,
    baseSpellPower: ci === 2 ? 1.5 : ci === 3 ? 1.1 : 1,
    dodgeChance: ci === 1 ? .12 : .05,
    baseDodgeChance: ci === 1 ? .12 : .05,
    poisonTurns: 0, poisonDmg: 0,
    hunger: 100, maxHunger: 100,
    quickSlots: new Array(9).fill(null),
    warded: false, freeTurn: false,
    skillCd: 0, streak: 0, bestStreak: 0,
    achievements: new Set<string>(),
    talents: { talents: {}, points: 0 },
    elRes: {}, setBonusActive: {}, elDmgBonus: {}, healBonus: 0,
    slowed: 0,
    critDamageBonus: 0,
    hasRevived: false,
    bossCheatDeathUsed: false,
    combatReviveUsed: false,
    bossesKilledThisRun: 0,
    relics: [],
    corruption: 0,
  };
  // Apply meta upgrades (permanent bonuses from The Forge). `endless` is threaded
  // through so the endless-only gate in applyMetaUpgrades doesn't depend on G
  // (which isn't bound yet — createPlayer runs before setGameState in initGame).
  applyMetaUpgrades(player, endless);
  return player;
}

export function movePlayer(dx: number, dy: number): void {
  if (!G || G.gameOver) return;
  if (G.player.stunned && G.player.stunned > 0) {
    G.player.stunned--;
    addMsg(t('esk.playerStunned'), 'mi');
    if (_endTurn) _endTurn();
    return;
  }
  const nx = G.player.x + dx, ny = G.player.y + dy;
  if (nx < 0 || nx >= MW || ny < 0 || ny >= MH) return;
  const tile = G.dungeon.map[ny][nx];
  if (tile === TL.WALL || tile === TL.VOID) return;

  // Attack enemy if present
  const enemy = G.enemies.find(e => e.x === nx && e.y === ny && !e.isAlly);
  if (enemy) {
    attack(G.player, enemy, true);
    if (enemy.hp <= 0) G.enemies = G.enemies.filter(e => e !== enemy);
    if (_endTurn) _endTurn();
    return;
  }

  const pfx = G.player.x, pfy = G.player.y;
  G.player.x = nx; G.player.y = ny;

  // Auto-pickup items
  const itemsHere = G.items.filter(i => i.x === nx && i.y === ny);
  if (itemsHere.length) {
    const npcEntity = itemsHere.find(i => i.npc);
    const loot = itemsHere.filter(i => !i.npc);
    // Pick up co-located loot BEFORE triggering the NPC: chestOpen spawns its
    // loot onto this very tile, and a later sweep would delete it.
    if (loot.length) {
      // Final-review fix: non-NPC items sharing the stepped tile with an NPC
      // (dropped while standing on the merchant, an enemy dying there…) ride
      // along through the same pickup loop. The tile sweep spares NPCs — the
      // `!i.npc` guard keeps the persisting merchant from being deleted with
      // the pile it happens to sit under.
      G.items = G.items.filter(i => !i.npc ? (i.x !== nx || i.y !== ny) : true);
      // Batch2 ⑧: pickup flash on the grabbed tile.
      fxFlash(nx, ny, '#ffd700', 0.9);
      for (const it of loot) {
        if (it.type === 'gold') { const g = bonusGold(it.value || 0); G.player.gold += g; addMsg(tMsg('pl.pickupGold', String(g)), 'mp'); snd('pickup'); }
        else addItemWithOverflow(it);
      }
    }
    if (npcEntity) {
      // Batch9 ④: merchants persist on the map — only chests/event sites are consumed.
      if (!npcPersists(npcEntity.npc)) G.items = G.items.filter(i => i !== npcEntity);
      triggerNpc(npcEntity);
    }
  }

  checkTraps();
  if (G.gameOver) return;
  checkTiles();
  // Teleport-style tiles (e.g. abyss, traps) rewrite G.player.x/y during checkTiles().
  // In that case the move's (nx,ny) is no longer the player's position, so the old→new
  // slide would visually cross the map — skip the tween and let the player snap.
  if (G.player.x === nx && G.player.y === ny) setPlayerTween(pfx, pfy, nx, ny);
  if (_endTurn) _endTurn();
}

export function pickupItem(): void {
  if (!G || G.gameOver) return;
  if (G.player.stunned && G.player.stunned > 0) {
    G.player.stunned--;
    addMsg(t('esk.playerStunned'), 'mi');
    if (_endTurn) _endTurn();
    return;
  }
  const g = G;
  const itemsHere = g.items.filter(i => i.x === g.player.x && i.y === g.player.y && i.type !== 'gold');
  if (!itemsHere.length) { addMsg(t('nothingHere'), 'mi'); return; }
  // A map entity underfoot (e.g. stepped on via teleport): trigger rather than grab.
  const npcEntity = itemsHere.find(i => i.npc);
  if (npcEntity) { g.items = g.items.filter(i => i !== npcEntity); triggerNpc(npcEntity); return; }
  for (const it of itemsHere) { g.items = g.items.filter(i => i !== it); addItemWithOverflow(it); }
  if (_endTurn) _endTurn();
}

export function descendStairs(): void {
  if (!G || G.gameOver) return;
  if (G.player.stunned && G.player.stunned > 0) {
    G.player.stunned--;
    addMsg(t('esk.playerStunned'), 'mi');
    if (_endTurn) _endTurn();
    return;
  }
  if (G.branchMode) { addMsg(t('pl.noStairsHollow'), 'mi'); return; }
  if (G.dungeon.map[G.player.y][G.player.x] !== TL.STAIR) { addMsg(t('noStairs'), 'mi'); return; }
  G.player.deepestFloor = Math.max(G.player.deepestFloor, G.floor + 1);
  enterFloor(G.floor + 1);
  applyCorruption(1); // descending corrupts (Playtest #9)
  if (_endTurn) _endTurn();
}

let _enterFloor: ((floor: number) => void) | null = null;
export function setEnterFloorFn(fn: (floor: number) => void): void { _enterFloor = fn; }
function enterFloor(floor: number) { if (_enterFloor) _enterFloor(floor); }

export function doWait(): void {
  if (!G || G.gameOver) return;
  if (G.player.stunned && G.player.stunned > 0) {
    G.player.stunned--;
    addMsg(t('esk.playerStunned'), 'mi');
    if (_endTurn) _endTurn();
    return;
  }
  addMsg(t('wait'), 'mi');
  if (_endTurn) _endTurn();
}
