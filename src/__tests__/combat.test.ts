// P0 regression tests for combat.ts (playerDeath idempotency / corruption_ward
// gate / playerVictory save clear). Mock setup mirrors grantKillRewards.test.ts.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../state.js', () => ({
  get G(): unknown { return (globalThis as { G?: unknown }).G; },
  lang: 'en',
  eventOpen: false,   // 批7: combat reads it to clear a residue event popup at death
  setGameState: () => {},
}));
vi.mock('../config.js', () => ({ FINAL: 40 }));
// 批11 C: escHtml moved into utils.ts — spread the real module (same pattern as
// batch9-hotbar.test.ts) so the death-epitaph render keeps the real escaper.
vi.mock('../utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils.js')>();
  return { ...actual, rng: () => 0, dst: () => 1 };
});
vi.mock('../audio.js', () => ({ snd: () => {}, setBgmScene: () => {} }));
vi.mock('../effects.js', () => ({ flt: () => {}, shake: () => {} }));
vi.mock('../fx.js', () => ({ fxFlash: () => {}, fxBurst: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: () => {} }));
vi.mock('../enemies.js', () => ({ processBossPhase: () => {} }));
vi.mock('../i18n.js', () => ({
  t: (k: string) => k,
  tMsg: (k: string, ...a: string[]) => a.reduce((s: string, x) => s.replace('{}', x), k),
  tx: (f: { en?: string }) => (f && f.en) || '',
}));
vi.mock('../data.js', () => ({ ACH_DEFS: [], EQUIPMENT_SETS: [] }));
vi.mock('../meta.js', () => ({
  bonusExp: (e: number) => e,
  bonusGold: (g: number) => g,
  getMeta: () => ({ upgrades: {}, stats: { bestEndlessFloor: 0 } }),
  persistAchievement: () => {},
  calculateSoulEchoes: () => ({ total: 10 }),
  updateRunStats: () => {},
  renderEchoBreakdown: () => {},
  creditSoulEchoes: vi.fn(),
  recordRun: () => {},
  unlockLore: () => {},
  recordWardenLegacy: () => {},
  corruptionWardMult: () => 0.5,
  // 批10 B1: playerDeath now persists the death echo + picks a keepsake.
  recordEcho: () => {},
  pickKeepsake: () => null,
}));
vi.mock('../warden.js', () => ({
  pickWardenRelic: () => null,
  nextWardenMemory: () => null,
  wardenMemoryText: () => ({ en: 'm', zh: '忆' }),
  // batch2 ④: combat → item-intro → ui-panels → lore reads WARDEN_MEMORIES
  // at module load; provide an empty array so the mock satisfies it.
  WARDEN_MEMORIES: [],
}));
vi.mock('../relics.js', () => ({
  getRelicExpMult: () => 1,
  getRelicGoldMult: () => 1,
  relicOnKill: () => {},
  grantRandomRelic: () => {},
  grantRelic: () => {},
  relicOnHitEnemy: (d: number) => d,
  relicOnDamaged: () => {},
  relicOnDeath: () => false,
  relicOnDodge: () => {},
  relicOnCrit: () => {},
  hasRelic: () => false,
  applyRelicBonuses: () => {},
}));
vi.mock('../talents.js', () => ({
  onPlayerKill: () => {},
  onPlayerHitEnemy: (d: number) => d,
  onPlayerDodged: () => {},
  onPlayerDamaged: () => false,
  onPlayerDeath: () => false,
  onEnemyHitPlayer: () => {},
  checkDoubleStrike: () => false,
  getCritMultiplier: () => 2,
  getManaShieldReduction: () => 0,
  applyTalentBonuses: () => {},
}));
vi.mock('../steam.js', () => ({ unlockAchievement: () => {} }));
vi.mock('../item-gen.js', () => ({ genEndlessGear: () => ({}), endlessLuckMult: () => 1 }));
vi.mock('../endings.js', () => ({
  // pyrrhic entry required by resolveEnding (ENDINGS[endingForChoice(...)].ach)
  ENDINGS: { pyrrhic: { ach: 'ach_ending_pyrrhic', title: { en: 'T' }, body: { en: 'B' } } },
  endingForChoice: () => 'pyrrhic',
  canRefuse: () => true,
}));
// 批4: playerDeath/playerVictory now call resetIntros — the real one hits
// setIntroOpen, which this file's state.js mock doesn't provide.
vi.mock('../item-intro.js', () => ({ queueMechanicIntro: vi.fn(), queueRelicIntro: vi.fn(), resetIntros: vi.fn() }));
// corruption.js stays REAL (pure module) so applyCorruption's addCorruption call mutates.

import { playerDeath, playerVictory, applyCorruption, resolveEnding } from '../combat.js';
import { creditSoulEchoes } from '../meta.js';

function fixtureG(): any {
  return {
    player: {
      exp: 0, gold: 0, kills: 5, streak: 0, bestStreak: 3,
      bossesKilledThisRun: 0, level: 5, expNext: 999999, ci: 0, ri: 0,
      achievements: new Set<string>(), corruption: 10,
      hp: 10, maxHp: 10, atk: 5, def: 1, turns: 50, raceName: 'R', clsName: 'C',
      x: 1, y: 1,
    },
    enemies: [], floor: 5, branchMode: false, endless: false,
    gameOver: false, won: false,
  };
}

const DOM_HTML = `
  <div id="death-screen"></div><div id="death-stats"></div>
  <div id="death-epitaph"></div><div id="death-wardens"></div>
  <div id="ending-title"></div><div id="ending-desc"></div>
  <button id="btn-ending-refuse"></button><div id="ending-choice"></div>
  <div id="victory-screen"></div><div id="vic-stats"></div>
  <div id="vic-ending"></div><div id="death-echoes"></div><div id="vic-echoes"></div>
`;

describe('P0-3 playerDeath idempotent', () => {
  beforeEach(() => {
    (globalThis as any).G = fixtureG();
    document.body.innerHTML = DOM_HTML;
    vi.clearAllMocks();
    localStorage.clear();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('does not double-credit soul echoes when called twice (wardenDeath + fatal hit)', () => {
    playerDeath('Shadow');
    playerDeath('Shadow'); // gameOver already true — must short-circuit
    expect(creditSoulEchoes).toHaveBeenCalledTimes(1);
  });
});

describe('P0-4 corruption_ward negates +1 sources', () => {
  beforeEach(() => {
    (globalThis as any).G = fixtureG();
    vi.clearAllMocks();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('wardMult 0.5 + random 0 → a +1 source is negated (not ceil\'d back up to 1)', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const G = (globalThis as any).G;
    G.endless = true;   // ⑦ ward is an endless meta upgrade
    G.player.corruption = 10;
    applyCorruption(1);
    expect(G.player.corruption).toBe(10); // n reduced to 0 by the ward
    spy.mockRestore();
  });

  it('⑦ normal mode ignores corruption_ward entirely (endless-gated)', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);  // would always pass the 0.5 gate
    const G = (globalThis as any).G;
    applyCorruption(1);
    expect(G.player.corruption).toBe(11);   // ward NOT applied — endless false
    spy.mockRestore();
  });
});

describe('P0-5 playerVictory clears run save immediately', () => {
  beforeEach(() => {
    (globalThis as any).G = fixtureG();
    document.body.innerHTML = DOM_HTML;
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('removes dh_save during playerVictory (not deferred to resolveEnding)', () => {
    localStorage.setItem('dh_save', JSON.stringify({ floor: 40 }));
    playerVictory();
    expect(localStorage.getItem('dh_save')).toBeNull();
  });
});

// Batch3A T2 review Imp1: #ending-choice must join the .overlay.active lifecycle.
// It has class="overlay" in index.html but was shown/hidden via bare inline display,
// so it never gained .active — menu-context's .overlay.active probe saw nothing AND
// the .overlay{opacity:0}/.overlay.active{opacity:1} CSS rendered the panel invisible.
describe('Batch3A T2 review Imp1: ending-choice .active lifecycle', () => {
  beforeEach(() => {
    (globalThis as any).G = fixtureG();
    document.body.innerHTML = DOM_HTML;
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('playerVictory → presentCreatorChoice marks #ending-choice .overlay.active', () => {
    playerVictory();
    const ec = document.getElementById('ending-choice')!;
    expect(ec.classList.contains('active')).toBe(true);
    expect(ec.style.display).toBe('flex');
  });

  it("resolveEnding('slay') removes .active (probe won't see a dead screen)", () => {
    playerVictory();
    expect(document.getElementById('ending-choice')!.classList.contains('active')).toBe(true); // pre: add worked
    resolveEnding('slay');
    expect(document.getElementById('ending-choice')!.classList.contains('active')).toBe(false);
    expect(document.getElementById('ending-choice')!.style.display).toBe('none');
  });

  it("resolveEnding('refuse') removes .active too", () => {
    playerVictory();
    expect(document.getElementById('ending-choice')!.classList.contains('active')).toBe(true); // pre: add worked
    resolveEnding('refuse');
    expect(document.getElementById('ending-choice')!.classList.contains('active')).toBe(false);
    expect(document.getElementById('ending-choice')!.style.display).toBe('none');
  });
});
