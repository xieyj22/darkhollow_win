// batch17: 伤害公式=百分比减伤 dmg=max(1,floor((atk+rng(-2,2))*100/(100+def)))
// 真实 attack() + 最小 G 桩。Math.random()=0.5 ⇒ rng(-2,2)=floor(0.5*5)-2=0，
// 断言值按 floor(atk*100/(100+def)) 自算（brief 笔误已修正：16/40 非 12/30）。
// Mock 面板增量（裁决#2）：state.G 是 `let` 导出、combat.ts 读的是模块绑定而非
// globalThis —— 静态 `G: null` 会让 attack() 直接短路，必须用 getter（同
// combat.test.ts / enemy-skills.test.ts 既有模式）；combat.ts import 集上其余
// 缺口（eventOpen/shake/setBgmScene/RARITY_C/talents/relics/meta 全集等）按
// combat.test.ts 已验证面板最小补齐，生产 import 结构未动。
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../state.js', () => ({
  get G(): unknown { return (globalThis as { G?: unknown }).G; },
  lang: 'en',
  eventOpen: false,
  setGameState: () => {},
}));
vi.mock('../i18n.js', () => ({ t: () => '', tMsg: () => '', tx: () => '', RARITY_C: {} }));
vi.mock('../messages.js', () => ({ addMsg: () => {} }));
vi.mock('../audio.js', () => ({ snd: () => {}, setBgmScene: () => {} }));
vi.mock('../effects.js', () => ({ flt: () => {}, shake: () => {} }));
vi.mock('../fx.js', () => ({ fxFlash: () => {}, fxBurst: () => {}, fxAura: () => {} }));
vi.mock('../enemies.js', () => ({ processBossPhase: () => {} }));
vi.mock('../data.js', () => ({ ACH_DEFS: [], EQUIPMENT_SETS: [] }));
vi.mock('../steam.js', () => ({ unlockAchievement: () => {} }));
vi.mock('../item-gen.js', () => ({ genEndlessGear: () => ({}), endlessLuckMult: () => 1 }));
vi.mock('../endings.js', () => ({
  ENDINGS: { pyrrhic: { ach: 'ach_ending_pyrrhic', title: { en: 'T' }, body: { en: 'B' } } },
  endingForChoice: () => 'pyrrhic',
  canRefuse: () => true,
}));
vi.mock('../item-intro.js', () => ({ queueMechanicIntro: () => {}, resetIntros: () => {} }));
vi.mock('../warden.js', () => ({
  pickWardenRelic: () => null,
  nextWardenMemory: () => null,
  wardenMemoryText: () => ({ en: 'm', zh: '忆' }),
  WARDEN_MEMORIES: [],
}));
vi.mock('../talents.js', () => ({
  onPlayerHitEnemy: (_e: unknown, d: number) => d,
  onPlayerKill: () => {},
  onPlayerDodged: () => {},
  onPlayerDamaged: () => false,
  onPlayerDeath: () => false,
  onEnemyHitPlayer: () => {},
  checkDoubleStrike: () => false,
  getCritMultiplier: () => 2,
  getManaShieldReduction: () => 0,
  applyTalentBonuses: () => {},
}));
vi.mock('../relics.js', () => ({
  relicOnHitEnemy: (_e: unknown, d: number) => d,
  relicOnCrit: () => {},
  relicOnDodge: () => {},
  relicOnDamaged: () => {},
  relicOnDeath: () => false,
  relicOnKill: () => {},
  getRelicGoldMult: () => 1,
  getRelicExpMult: () => 1,
  grantRandomRelic: () => {},
  grantRelic: () => {},
  hasRelic: () => false,
  applyRelicBonuses: () => {},
}));
vi.mock('../corruption.js', () => ({
  corruptionMods: () => ({ spellPct: 0, critPct: 0, atk: 0, healPct: 0, dmgTakenPct: 0 }) as never,
  addCorruption: () => ({ maxed: false, crossed: false }),
  TIER_LABEL: {},
  TIER_COLOR: {},
}));
vi.mock('../meta.js', () => ({
  getMeta: () => ({ upgrades: {} }) as never,
  bonusGold: (g: number) => g,
  bonusExp: (e: number) => e,
  calculateSoulEchoes: () => ({ total: 0 }),
  updateRunStats: () => {},
  persistAchievement: () => {},
  renderEchoBreakdown: () => {},
  creditSoulEchoes: () => {},
  recordRun: () => {},
  unlockLore: () => {},
  recordWardenLegacy: () => {},
  corruptionWardMult: () => 0,
  recordEcho: () => {},
  pickKeepsake: () => null,
}));

import { attack } from '../combat.js';
import type { Enemy, EnemySkill, Player } from '../types.js';

const mkEnemy = (hp: number, def: number): Enemy =>
  ({ name: 'T', x: 2, y: 2, hp, maxHp: hp, atk: 1, def, exp: 5, goldDrop: 5, el: 'none', res: {}, isAlly: false } as unknown as Enemy);

function seedG(player: Partial<Player>, enemy: Enemy) {
  (globalThis as any).G = {
    player: { critChance: 0, dodgeChance: 0, spellPower: 1, elDmgBonus: {}, elRes: {}, healBonus: 0, corruption: 0, buffs: [], x: 1, y: 1, ...player } as unknown as Player,
    enemies: [enemy], gameOver: false, won: false, floor: 1, endless: false, branchMode: false,
  };
}

describe('batch17 T1 percentage-mitigation formula', () => {
  beforeEach(() => { vi.clearAllMocks(); Math.random = () => 0.5; });  // rng(-2,2) = 0

  it('low-def equivalence: atk100 vs def3 → 97 (old subtraction: 97)', () => {
    const e = mkEnemy(999, 3); seedG({ atk: 100, def: 0 }, e);
    attack({ atk: 100, el: 'none' } as any, e, true);
    expect(999 - e.hp).toBe(97);  // floor(100*100/103)=floor(97.09)=97
  });

  it('percentage mitigation: atk100 vs def100 → 50 (old: 1)', () => {
    const e = mkEnemy(999, 100); seedG({ atk: 100, def: 0 }, e);
    attack({ atk: 100, el: 'none' } as any, e, true);
    expect(999 - e.hp).toBe(50);  // floor(100*100/200)=50 — def=100 ⇒ 50% 减伤
  });

  it('no wall at def≥atk: atk50 vs def200 → 16 (old: 1)', () => {
    const e = mkEnemy(999, 200); seedG({ atk: 50, def: 0 }, e);
    attack({ atk: 50, el: 'none' } as any, e, true);
    expect(999 - e.hp).toBe(16);  // floor(50*100/300)=floor(16.67)=16
  });

  it('floor 1: applies symmetrically to enemy attacks (def-side)', () => {
    const e = mkEnemy(999, 0); e.atk = 60;
    seedG({ atk: 0, def: 50, maxHp: 999, hp: 999, warded: false } as Partial<Player>, e);
    attack(e as any, (globalThis as any).G.player, false);
    expect(999 - (globalThis as any).G.player.hp).toBe(40);  // floor(60*100/150)=40 (old: 10)
  });
});

// batch17 T2: enemy fs slope .12 → .10 (enemies.ts 4 sites + warden mirror) and
// sanctum/endless area-bonus trim. data.js/warden.js are mocked above (combat.ts
// import surface), so pin the real math via vi.importActual.
describe('batch17 T2 enemy scale slope', () => {
  it('sanctum area bonus 0.12 → 0.05, endless 0.15 → 0.10', async () => {
    const { AREAS } = await vi.importActual<typeof import('../data.js')>('../data.js');
    const sanctum = AREAS.find(a => a.id === 'sanctum')!;
    const endless = AREAS.find(a => a.id === 'endless')!;
    expect(sanctum.enemyScaleBonus).toBe(0.05);
    expect(endless.enemyScaleBonus).toBe(0.10);
  });

  it('wardenStats mirrors .10 slope (fs = 1 + 10*.10 = 2.0 at F11)', async () => {
    const { wardenStats } = await vi.importActual<typeof import('../warden.js')>('../warden.js');
    const s = wardenStats(11);  // fs = 1 + 10*0.10 = 2.0
    expect(s.atk).toBe(Math.floor((10 + 11 * 1.6) * 2.0));   // floor(55.2) = 55 (warden.ts base atk)
    expect(s.hp).toBe(Math.floor((45 + 11 * 5) * 2.0));      // floor(200) = 200
  });
});

// batch17 R6 riders (spec T1 global-formula semantics): the two remaining
// subtraction-formula copies switch to percentage mitigation, K=100.
describe('batch17 R6 formula-mirror riders', () => {
  it('w_retaliation counter: atk10 vs def3 → max(1,floor((atk+rng(-2,2))*100/103)) = 7..11 (old: 7)', async () => {
    const { onEnemyHitPlayer } = await vi.importActual<typeof import('../talents.js')>('../talents.js');
    for (let i = 0; i <= 4; i++) {                 // rng sweep: Math.random=i/5 → rng(-2,2)=i-2
      const attacker = mkEnemy(999, 3);
      (globalThis as any).G = {
        player: { atk: 10, talents: { talents: { w_retaliation: 1 } } } as unknown as Player,
        enemies: [attacker], gameOver: false,
      };
      let calls = 0;
      Math.random = () => (calls++ === 0 ? 0 : i / 5);   // 1st roll < 0.1 fires the counter
      onEnemyHitPlayer(attacker);
      expect(999 - attacker.hp).toBe(7 + i);      // floor((8+i)*100/103) = 7+i for i∈[0,4]
    }
  });

  it('dmg_aoe ally direct damage: atk10 vs def3, rng=0 → floor(10*100/103) = 9 (old: 7)', async () => {
    const { executeEnemySkill } = await import('../enemy-skills.js');   // not mocked in this file
    Math.random = () => 0.5;                       // rng(-2,2) = 0
    const caster = mkEnemy(999, 0); caster.atk = 10;
    const ally = mkEnemy(999, 3); ally.isAlly = true; ally.x = 2; ally.y = 3;  // dst(caster)=1 ≤ radius
    seedG({ atk: 0, def: 0, hp: 999, maxHp: 999, warded: false } as Partial<Player>, caster);
    (globalThis as any).G.enemies = [caster, ally];
    const sk: EnemySkill = { name: { en: 'Z', zh: 'Z' }, effect: 'dmg_aoe', chance: 1, cd: 1, dmg: 1, aoe: 2 };
    executeEnemySkill(caster, sk);
    expect(999 - ally.hp).toBe(9);
  });
});
