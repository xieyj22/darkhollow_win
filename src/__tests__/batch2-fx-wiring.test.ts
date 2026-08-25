// 批2 ⑧: level-up / loot-drop / pickup fire fx (mock fx counts).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../state.js', () => ({ get G() { return (globalThis as any).G; }, lang: 'en' }));
vi.mock('../fx.js', () => ({ fxFlash: vi.fn(), fxAura: vi.fn(), fxBeam: () => {}, fxBolt: () => {}, fxBurst: vi.fn() }));
vi.mock('../effects.js', () => ({ flt: () => {}, shake: () => {} }));
vi.mock('../audio.js', () => ({ snd: () => {}, setBgmScene: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: vi.fn() }));
vi.mock('../enemies.js', () => ({ processBossPhase: () => {}, checkBossReveal: () => {} }));
vi.mock('../utils.js', () => ({ rng: () => 1, dst: () => 3, pick: (a: any[]) => a[0] }));
vi.mock('../config.js', async (im) => { const real = await im<typeof import('../config.js')>(); return { ...real, FINAL: 40 }; });
vi.mock('../meta.js', () => ({ getMeta: () => ({ upgrades: {}, stats: {}, achievements: [], unlockedLore: [], discoveredItems: [], seenMechanics: [], runHistory: [], endlessLeaderboard: [], wardens: [] }), checkAchs: vi.fn(), unlockLore: vi.fn(), persistAchievement: vi.fn(), calculateSoulEchoes: () => ({ total: 0 }), updateRunStats: () => {}, renderEchoBreakdown: () => '', bonusGold: (g: number) => g, bonusExp: (e: number) => e, creditSoulEchoes: () => {}, recordRun: () => {}, recordWardenLegacy: () => {}, corruptionWardMult: () => 1 }));
vi.mock('../talents.js', () => ({ getCritMultiplier: () => 1.5, getSkillModifiers: () => ({ dmgMult: 1 }), isCCImmune: () => false, applyTalentBonuses: () => {} }));
vi.mock('../relics.js', () => ({ hasRelic: () => false, relicOnCrit: vi.fn(), relicOnKill: vi.fn(), grantRelic: vi.fn(), applyRelicBonuses: () => {} }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tMsg: (k: string, ...a: string[]) => k + a.join(''), tx: (f: any) => f?.en ?? '', RARITY_C: ['#c0c0c0', '#06d6a0', '#4895ef', '#9b5de5', '#ffd700'] }));
vi.mock('../items.js', () => ({ _genItem: undefined, checkAch: vi.fn() }));
vi.mock('../item-intro.js', () => ({ queueMechanicIntro: vi.fn() }));
vi.mock('../steam.js', () => ({ unlockAchievement: vi.fn() }));

import { checkLevelUp } from '../combat.js';
import { fxAura } from '../fx.js';

const mkPlayer = () => ({
  x: 5, y: 5, level: 1, exp: 999, expNext: 10,
  hp: 50, maxHp: 100, mp: 10, maxMp: 20,
  baseAtk: 5, baseDef: 5, baseMaxHp: 100,
  atk: 5, def: 5, critChance: 0, dodgeChance: 0,
  talents: { points: 0 }, buffs: [], elRes: {}, elDmgBonus: {},
  healBonus: 0, corruption: 0, setCorruptionResist: 0,
  ci: 0, ri: 0, raceName: 'r', clsName: 'c',
  stunned: 0, slowed: 0, poisonTurns: 0, poisonDmg: 0,
  gold: 0, hunger: 100, maxHunger: 100, kills: 0, turns: 0,
  achievements: new Set<string>(), setBonusActive: {},
  eq: { weapon: null, armor: null, accessory: null, accessory2: null }, inv: [], relics: [],
});

beforeEach(() => { vi.clearAllMocks(); });

describe('⑧ level-up fires fxAura', () => {
  it('checkLevelUp calls fxAura with gold color', () => {
    (globalThis as any).G = { player: mkPlayer(), enemies: [], items: [], floor: 1, gameOver: false, won: false };
    checkLevelUp();
    expect(fxAura).toHaveBeenCalledWith(5, 5, '#ffd700', 1.6);
  });
});
