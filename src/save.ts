// Save / Load system
import type { SaveData, Enemy } from './types.js';
import { G, setGameState, lang } from './state.js';
import { t } from './i18n.js';
import { addMsg } from './messages.js';
import { updateUI, render, resizeCanvas } from './render.js';
import { MH, MW } from './config.js';
import { updatePlayerFOV } from './dungeon.js';
import { snd } from './audio.js';

function serializeEnemies(enemies: Enemy[]): any[] {
  return enemies.map(e => ({
    ...e,
    phasesTriggered: e.phasesTriggered ? Array.from(e.phasesTriggered) : undefined,
  }));
}

export function saveGame(): void {
  if (!G || G.gameOver) return;
  const g = G;
  const qs = g.player.quickSlots.map(it => it ? g.player.inv.indexOf(it) : -1);
  // Convert Set to array for JSON serialization (JSON.stringify turns Set into {})
  const playerData = { ...g.player, achievements: Array.from(g.player.achievements as Set<string>) };
  localStorage.setItem('dh_save', JSON.stringify({
    player: playerData, floor: g.floor, dungeon: g.dungeon,
    enemies: serializeEnemies(g.enemies), items: g.items, traps: g.traps,
    msgs: g.msgs.slice(-20), qs,
  }));
  addMsg(t('saved'), 'mi'); snd('pickup');
}

export function loadGame(): void {
  const d = localStorage.getItem('dh_save');
  if (!d) { alert(t('noSave')); return; }
  try {
    const s: SaveData = JSON.parse(d);
    const gameState = {
      player: s.player, floor: s.floor, dungeon: s.dungeon,
      enemies: s.enemies, items: s.items, traps: s.traps || [],
      msgs: s.msgs || [], gameOver: false, won: false, vx: 0, vy: 0,
    };

    // Fix Set deserialization — achievements may be an array after JSON parse
    if (Array.isArray(gameState.player.achievements))
      gameState.player.achievements = new Set(gameState.player.achievements as any as string[]);
    else if (!(gameState.player.achievements instanceof Set))
      gameState.player.achievements = new Set(gameState.player.achievements || []);
    if (!gameState.player.quickSlots) gameState.player.quickSlots = new Array(9).fill(null);
    if (gameState.player.warded === undefined) gameState.player.warded = false;
    if (gameState.player.freeTurn === undefined) gameState.player.freeTurn = false;
    // Migrate equipment to two accessory slots.
    if (!gameState.player.eq) gameState.player.eq = { weapon: null, armor: null, accessory: null, accessory2: null } as any;
    if (gameState.player.eq.accessory2 === undefined) gameState.player.eq.accessory2 = null;

    // Migration: add new fields for old saves
    if (!gameState.player.talents) gameState.player.talents = { talents: {}, points: Math.max(0, gameState.player.level - 1) };
    if (!gameState.player.elRes) gameState.player.elRes = {};
    if (!gameState.player.setBonusActive) gameState.player.setBonusActive = {};
    if (!gameState.player.elDmgBonus) gameState.player.elDmgBonus = {};
    if (gameState.player.healBonus === undefined) gameState.player.healBonus = 0;
    if (gameState.player.slowed === undefined) gameState.player.slowed = 0;
    // recalc() reads baseMaxHp/baseAtk/baseDef as the reset baseline each turn —
    // if an old save predates these fields, fall back to the current derived value.
    if (gameState.player.baseMaxHp === undefined) gameState.player.baseMaxHp = gameState.player.maxHp;
    if (gameState.player.baseAtk === undefined) gameState.player.baseAtk = gameState.player.atk;
    if (gameState.player.baseDef === undefined) gameState.player.baseDef = gameState.player.def;
    if (gameState.player.baseCritChance === undefined) gameState.player.baseCritChance = gameState.player.critChance;
    if (gameState.player.baseDodgeChance === undefined) gameState.player.baseDodgeChance = gameState.player.dodgeChance;
    if (gameState.player.baseSpellPower === undefined) gameState.player.baseSpellPower = gameState.player.spellPower;
    if (gameState.player.critDamageBonus === undefined) gameState.player.critDamageBonus = 0;
    if (gameState.player.hasRevived === undefined) gameState.player.hasRevived = false;
    if (gameState.player.bossCheatDeathUsed === undefined) gameState.player.bossCheatDeathUsed = false;
    if (gameState.player.combatReviveUsed === undefined) gameState.player.combatReviveUsed = false;
    if (gameState.player.bossesKilledThisRun === undefined) gameState.player.bossesKilledThisRun = 0;
    // Migrate enemies missing new fields
    for (const e of gameState.enemies as Enemy[]) {
      if (e.el === undefined) (e as any).el = 'none';
      if (!e.res) (e as any).res = {};
      if (e.skillCd === undefined) (e as any).skillCd = 0;
      if (!e.tags) (e as any).tags = [];
      // Restore phasesTriggered from array to Set
      if ((e as any).phasesTriggered && Array.isArray((e as any).phasesTriggered)) {
        e.phasesTriggered = new Set((e as any).phasesTriggered as number[]);
      } else {
        e.phasesTriggered = new Set();
      }
    }

    const qsData = s.qs || [];
    gameState.player.quickSlots = qsData.map((idx: number) =>
      idx >= 0 && idx < gameState.player.inv.length ? gameState.player.inv[idx] : null
    );

    setGameState(gameState);

    document.getElementById('title-screen')!.style.display = 'none';
    document.getElementById('game-container')!.style.display = 'flex';
    resizeCanvas();
    document.getElementById('log-panel')!.innerHTML = '';
    for (const m of gameState.msgs.slice(-20)) addMsg(m.text, m.type);

    // Rebuild FOV (unified with game.ts and turn.ts via updatePlayerFOV)
    updatePlayerFOV(gameState.player, gameState.dungeon.map, gameState.traps);

    addMsg(lang === 'zh' ? '存档已加载！' : 'Game loaded!', 'mi');
    updateUI(); render();
    (window as any).__initAudio();
  } catch (e: any) {
    alert('Load failed: ' + e.message);
  }
}
