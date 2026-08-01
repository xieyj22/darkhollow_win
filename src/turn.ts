// Turn processing — central game loop tick
import { G, lang } from './state.js';
import { rng } from './utils.js';
import { updatePlayerFOV } from './dungeon.js';
import { t } from './i18n.js';
import { addMsg } from './messages.js';
import { recalc, checkAchs } from './combat.js';
import { corruptionMods } from './corruption.js';
import { processEnemies, checkPlayerTraps } from './enemies.js';
import { maybeEvent } from './events.js';
import { updateUI, render } from './render.js';
import { flt } from './effects.js';
import { autoSave } from './save.js';
import { modifyPoisonDamage, getBonusMpRegen, onPlayerDeath } from './talents.js';
import { relicOnDeath } from './relics.js';

export function endTurn(): void {
  if (!G) return;
  if (G.gameOver) { updateUI(); render(); return; }

  G.player.turns++;

  // Free turn (haste)
  if (G.player.freeTurn) { G.player.freeTurn = false; updatePlayerFOV(G.player, G.dungeon.map, G.traps); updateUI(); render(); return; }

  // Skill cooldown
  if (G.player.skillCd > 0) G.player.skillCd--;

  // Buffs tick
  G.player.buffs = G.player.buffs.filter(b => {
    b.turns--;
    if (b.turns <= 0) { addMsg(b.name + ' ' + t('effectsOff'), 'mi'); return false; }
    return true;
  });
  recalc();

  // Hunger
  if (G.player.turns % 20 === 0) {
    G.player.hunger = Math.max(0, G.player.hunger - 1);
    if (G.player.hunger <= 20 && G.player.hunger % 5 === 0) addMsg(t('hungerWarn'), 'mt');
    if (G.player.hunger <= 0) {
      const dmg = rng(2, 5); G.player.hp -= dmg;
      addMsg(t('hungerDmg') + dmg + t('hungerDmgSuf'), 'mt');
      flt(G.player.x, G.player.y, `-${dmg}`, '#f4845f');
      if (G.player.hp <= 0) {
        if (onPlayerDeath() || relicOnDeath()) { /* revived */ }
        else { playerDeath(lang === 'zh' ? '饥饿' : 'starvation'); updateUI(); render(); return; }
      }
    }
  }

  // Slow effect — player loses this turn (enemies don't act either)
  if (G.player.slowed > 0) {
    G.player.slowed--;
    addMsg(lang === 'zh' ? '🐌 你被减速了，无法行动！' : '🐌 Slowed! You lose a turn!', 'mi');
    updatePlayerFOV(G.player, G.dungeon.map, G.traps); updateUI(); render();
    return;
  }

  // Poison (modified by iron_will talent)
  if (G.player.poisonTurns > 0) {
    const actualPoisonDmg = modifyPoisonDamage(G.player.poisonDmg);
    G.player.poisonTurns--; G.player.hp -= actualPoisonDmg;
    addMsg(t('poisonTurn') + actualPoisonDmg + t('poisonTurnSuf'), 'mc');
    flt(G.player.x, G.player.y, `-${actualPoisonDmg}`, '#32cd32');
    if (G.player.hp <= 0) {
      if (onPlayerDeath() || relicOnDeath()) { /* revived */ }
      else { playerDeath(lang === 'zh' ? '中毒' : 'poison'); updateUI(); render(); return; }
    }
  }

  // Corruption per-turn HP cost (mutated tier; Playtest #9)
  const cm = corruptionMods(G.player.corruption);
  if (cm.perTurnHp > 0) {
    G.player.hp -= cm.perTurnHp;
    flt(G.player.x, G.player.y, `-${cm.perTurnHp}`, '#9a2be2');
    if (G.player.hp <= 0) {
      if (onPlayerDeath() || relicOnDeath()) { /* revived */ }
      else { playerDeath(lang === 'zh' ? '腐化' : 'corruption'); updateUI(); render(); return; }
    }
  }

  // Enemy turns
  if (!G.gameOver) processEnemies();
  // Player traps
  if (!G.gameOver) checkPlayerTraps();
  if (G.gameOver) { updateUI(); render(); return; }

  // Streak decay
  if (G.player.streak > 0 && G.player.turns % 8 === 0) G.player.streak = Math.max(0, G.player.streak - 1);

  // Regen
  if (G.player.turns % 5 === 0 && G.player.hp < G.player.maxHp && G.player.poisonTurns <= 0 && G.player.hunger > 20)
    G.player.hp = Math.min(G.player.maxHp, G.player.hp + 1);
  if (G.player.turns % 8 === 0 && G.player.mp < G.player.maxMp) {
    const mpRegen = 1 + getBonusMpRegen();
    G.player.mp = Math.min(G.player.maxMp, G.player.mp + mpRegen);
  }

  // Random events
  maybeEvent();

  updatePlayerFOV(G.player, G.dungeon.map, G.traps);
  updateUI();
  render();
  // Autosave every 5 turns — protects progress without spamming storage.
  if (G.player.turns % 5 === 0) autoSave();
}

// Late-bound playerDeath to avoid importing combat.ts circularly
let _playerDeath: ((killer: string) => void) | null = null;
export function setPlayerDeathFn(fn: (killer: string) => void): void { _playerDeath = fn; }
function playerDeath(killer: string) { if (_playerDeath) _playerDeath(killer); }
