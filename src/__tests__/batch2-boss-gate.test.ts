// 批2 ② fix round 1: the boss priority gate is the ONLY skill gate for bosses
// (exactly one chance roll per turn at every range); the generic gate stays for
// everyone else (incl. the Warden, which is isWarden — never isBoss).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../state.js', () => ({ get G() { return (globalThis as any).G; }, lang: 'en' }));
vi.mock('../meta.js', () => ({ bonusExp: (e: number) => e, unlockLore: () => {}, getMeta: () => ({ upgrades: {}, stats: {}, achievements: [] }) }));
vi.mock('../effects.js', () => ({ flt: () => {}, shake: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: vi.fn() }));
vi.mock('../combat.js', () => ({ attack: vi.fn(), killEnemy: () => {}, checkLevelUp: () => {}, playerDeath: () => {}, recalc: () => {} }));
vi.mock('../talents.js', () => ({ onPlayerDamaged: () => false, onEnemyHitPlayer: () => {}, onPlayerDodged: () => {}, onPlayerDeath: () => false, getManaShieldReduction: () => 0 }));
vi.mock('../relics.js', () => ({ relicOnDodge: () => {} }));
vi.mock('../render.js', () => ({ setEnemyTween: () => {} }));
vi.mock('../warden.js', () => ({
  wardenStats: () => ({}),
  // batch2 ④: enemies → item-intro → ui-panels → lore reads WARDEN_MEMORIES
  // at module load; provide an empty array so the mock satisfies it.
  WARDEN_MEMORIES: [],
}));
// Real shouldCastSkill (it owns the per-turn chance roll); executeEnemySkill is
// mocked because its handlers need a fuller game world than this fixture.
vi.mock('../enemy-skills.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../enemy-skills.js')>();
  return { ...actual, executeEnemySkill: vi.fn() };
});
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tMsg: (k: string) => k, tx: (f: any) => f?.en ?? '' }));
vi.mock('../audio.js', () => ({ snd: () => {} }));

import { processEnemies } from '../enemies.js';
import { executeEnemySkill } from '../enemy-skills.js';
import { attack } from '../combat.js';
import { TL } from '../config.js';
import type { Enemy, EnemySkill } from '../types.js';

const SK: EnemySkill = { name: { en: 'Gate Probe', zh: '闸门探针' }, effect: 'debuff_weaken', chance: 0.3, cd: 4, range: 6 };

const mk = (over: Partial<Enemy> = {}): Enemy => ({
  name: 'Gate Boss', ch: 'B', c: '#fff', x: 5, y: 5,
  hp: 100, maxHp: 100, atk: 20, def: 5, exp: 10, goldDrop: 10,
  ai: 'chase', stunned: 0, feared: 0, isAlly: false,
  el: 'none', res: {}, skillCd: 0, atkBuffTurns: 0, atkBuffVal: 0,
  ...over,
} as Enemy);

beforeEach(() => {
  vi.mocked(executeEnemySkill).mockClear();
  vi.mocked(attack).mockClear();
  (globalThis as any).G = {
    floor: 43, branchMode: false, gameOver: false,   // floor 43: no BOSSES table match
    enemies: [] as Enemy[],
    items: [],
    player: { x: 9, y: 9, hp: 100, maxHp: 100, buffs: [], dodgeChance: 0,
      visible: Array.from({ length: 30 }, () => Array(30).fill(true)) },
    dungeon: { map: Array.from({ length: 30 }, () => Array(30).fill(TL.FLOOR)), rooms: [], stair: { x: 0, y: 0 }, traps: [] },
  };
});
afterEach(() => { vi.restoreAllMocks(); });

describe('batch2 ② boss skill gate (fix round 1)', () => {
  it('(a) boss adjacent casts through the priority gate instead of melee-attacking', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);    // chance roll always passes
    (globalThis as any).G.player.x = 5; (globalThis as any).G.player.y = 6;   // d = 1
    const boss = mk({ isBoss: true, skill: SK });
    (globalThis as any).G.enemies = [boss];
    processEnemies();
    expect(executeEnemySkill).toHaveBeenCalledTimes(1);
    expect(executeEnemySkill).toHaveBeenCalledWith(boss, SK);
    expect(boss.skillCd).toBe(SK.cd);               // cast consumed the cooldown
    expect(attack).not.toHaveBeenCalled();          // no melee attack that turn
  });

  it('(b) boss beyond melee rolls the chance exactly ONCE per turn (no generic-gate re-roll)', () => {
    // d = sqrt(32) ≈ 5.66 — inside range 6, beyond melee 1.5.
    const rnd = vi.spyOn(Math, 'random').mockReturnValueOnce(0.4).mockReturnValueOnce(0.2);
    const boss = mk({ isBoss: true, skill: SK });
    (globalThis as any).G.enemies = [boss];
    processEnemies();
    expect(rnd).toHaveBeenCalledTimes(1);            // the 0.4 (> 0.3) fail was the only roll
    expect(executeEnemySkill).not.toHaveBeenCalled(); // 0.2 must NOT get a second chance
  });

  it('(c) non-boss casters (Warden shape: isWarden, not isBoss) keep the generic gate', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2);  // 0.2 < 0.3 → cast
    const warder = mk({ isBoss: false, isWarden: true, skill: SK });
    (globalThis as any).G.enemies = [warder];
    processEnemies();
    expect(executeEnemySkill).toHaveBeenCalledTimes(1);  // generic gate still fires
    expect(warder.skillCd).toBe(SK.cd);
  });
});
