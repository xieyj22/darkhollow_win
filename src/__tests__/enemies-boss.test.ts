// ① reconnect: boss phases/summon must work from the INSTANCE (endless F45+
// reuse), with the floor-keyed table kept only as the legacy-save fallback.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../state.js', () => ({ get G() { return (globalThis as any).G; }, lang: 'en' }));
vi.mock('../meta.js', () => ({ bonusExp: (e: number) => e, unlockLore: () => {}, getMeta: () => ({ upgrades: {}, stats: {}, achievements: [] }) }));
vi.mock('../effects.js', () => ({ flt: () => {}, shake: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: vi.fn() }));
vi.mock('../combat.js', () => ({ attack: () => {}, killEnemy: () => {}, checkLevelUp: () => {}, playerDeath: () => {}, recalc: () => {} }));
vi.mock('../talents.js', () => ({ onPlayerDamaged: () => false, onEnemyHitPlayer: () => {}, onPlayerDodged: () => {}, onPlayerDeath: () => false, getManaShieldReduction: () => 0 }));
vi.mock('../relics.js', () => ({ relicOnDodge: () => {} }));
vi.mock('../render.js', () => ({ setEnemyTween: () => {} }));
vi.mock('../warden.js', () => ({ wardenStats: () => ({}) }));
vi.mock('../enemy-skills.js', () => ({ shouldCastSkill: () => false, executeEnemySkill: () => {} }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tMsg: (k: string) => k, tx: (f: any) => f?.en ?? '' }));
vi.mock('../audio.js', () => ({ snd: () => {} }));

import { processBossPhase, tryBossSummon, endlessBossPool } from '../enemies.js';
import { BOSSES } from '../data.js';
import { TL } from '../config.js';
import type { Enemy } from '../types.js';

const mkBoss = (over: Partial<Enemy> = {}): Enemy => ({
  name: 'Endless Reuse', ch: 'B', c: '#fff', x: 5, y: 5,
  hp: 40, maxHp: 100, atk: 100, def: 5, exp: 10, goldDrop: 10,
  ai: 'chase', stunned: 0, feared: 0, isAlly: false, isBoss: true,
  el: 'none', res: {}, skillCd: 0, ...over,
} as Enemy);

beforeEach(() => {
  (globalThis as any).G = {
    floor: 43, branchMode: false, gameOver: false,
    enemies: [],
    items: [],
    player: { x: 0, y: 0, hp: 100, maxHp: 100, buffs: [] },
    dungeon: { map: Array.from({ length: 30 }, () => Array(30).fill(TL.FLOOR)), rooms: [], stair: { x: 0, y: 0 }, traps: [] },
  };
});
afterEach(() => { vi.restoreAllMocks(); });

describe('① boss phases from the instance', () => {
  it('F43 endless boss with instance phases triggers + scales from bossAtkBase (no table match)', () => {
    const boss = mkBoss({ phases: [{ hpThreshold: 0.5, atkM: 1.5 }], bossAtkBase: 100 });
    processBossPhase(boss);
    expect(boss.atk).toBe(150);                       // 100 * 1.5
    expect(boss.phasesTriggered?.size).toBe(1);
  });

  it('legacy save (no instance fields) falls back to the floor table — F5 Goblin King', () => {
    (globalThis as any).G.floor = 5;
    const boss = mkBoss({ hp: 40, maxHp: 100 });       // ratio .4 <= .4
    processBossPhase(boss);
    const gk = BOSSES.find(b => b.fl === 5)!;
    const origAtk = gk.atk * (1 + (5 - 1) * .1);       // 10 * 1.4 = 14
    expect(boss.atk).toBe(Math.floor(origAtk * gk.phases![0].atkM!));  // floor(14*1.4)=19
  });
});

describe('① boss summon from the instance', () => {
  it('F43 endless boss with instance summon spawns a themed add', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const boss = mkBoss({ summon: { chance: 1, cd: 5, maxAdds: 3, kind: 'Goblin' } });
    tryBossSummon(boss);
    expect((globalThis as any).G.enemies.length).toBe(1);
    expect((globalThis as any).G.enemies[0].name).toContain('Goblin');
  });

  it('legacy save (no instance summon) falls back to the floor table — F5 Goblin King', () => {
    // Spec §5: pin BOTH summon paths so neither half can be silently deleted.
    // Deleting `?? bd?.summon` must fail here (legacy bosses stop summoning).
    vi.spyOn(Math, 'random').mockReturnValue(0);   // passes the 0.4 chance gate
    (globalThis as any).G.floor = 5;
    const boss = mkBoss();                          // no instance summon/phases
    tryBossSummon(boss);
    const gk = BOSSES.find(b => b.fl === 5)!;
    expect((globalThis as any).G.enemies.length).toBe(1);
    expect((globalThis as any).G.enemies[0].name).toContain(gk.summon!.kind!);   // 'Goblin' from the TABLE def
    expect(boss.aiCd).toBe(gk.summon!.cd);                                       // cd consumed from table cfg
  });
});

describe('① endless reuse pool excludes the branch mini-boss', () => {
  it('endlessBossPool = all main-line bosses (fl>=5), Myconid Sovereign (fl 0) out', () => {
    expect(BOSSES.some(b => b.fl === 0)).toBe(true);           // fixture exists
    const pool = endlessBossPool();
    expect(pool.every(b => b.fl >= 5)).toBe(true);
    expect(pool.length).toBe(BOSSES.length - 1);
  });
});
