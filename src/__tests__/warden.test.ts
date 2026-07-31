import { describe, it, expect, vi, beforeEach } from 'vitest';
// All module mocks consolidated at the top (vitest hoists these anyway; merging
// duplicate vi.mock calls for the same module here avoids linter/tsc noise and
// lets us fix two partial-factory gaps: state.js needs `G`, utils.js needs
// `pick`/`dst`, since spawnWarden lives in enemies.ts not warden.ts).
// warden.ts imports rng from utils only for goldDrop, which we don't assert.
vi.mock('../utils.js', () => ({ rng: () => 0, pick: (arr: any[]) => arr[0], dst: () => 0 }));
// enemies.ts reads G (mutated per-test via globalThis.G) + lang.
vi.mock('../state.js', () => ({ lang: 'en', get G() { return (globalThis as any).G; } }));
vi.mock('../config.js', () => ({ MW: 80, MH: 40, TL: { WALL: 1, VOID: 0 }, FINAL: 40 }));
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../effects.js', () => ({ flt: () => {}, shake: () => {} }));
vi.mock('../fx.js', () => ({ fxFlash: () => {}, fxBurst: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: () => {} }));
vi.mock('../render.js', () => ({ setEnemyTween: () => {} }));
vi.mock('../combat.js', () => ({ attack: () => false, killEnemy: () => {}, checkLevelUp: () => {} }));
vi.mock('../talents.js', () => ({ onPlayerDamaged: () => {}, onEnemyHitPlayer: () => {}, onPlayerDodged: () => {}, onPlayerDeath: () => false, getManaShieldReduction: () => 0 }));
vi.mock('../meta.js', () => ({ bonusExp: () => 0 }));
vi.mock('../data.js', () => ({ ENEMIES: [], BOSSES: [], ELITE_PREFIX: [], AREAS: [] }));

import { wardenStats, pickWardenRelic, nextWardenMemory, WARDEN_RELIC_IDS, WARDEN_MEMORIES } from '../warden.js';
import { spawnWarden } from '../enemies.js';

describe('wardenStats', () => {
  it('floor 1 (fs=1): deterministic baseline', () => {
    const s = wardenStats(1);            // fs = 1 + 0*.12 = 1
    expect(s.hp).toBe(50);               // (45 + 1*5) * 1
    expect(s.maxHp).toBe(50);
    expect(s.atk).toBe(11);              // floor((10 + 1*1.6) * 1) = floor(11.6)
    expect(s.def).toBe(4);               // floor(4 + 1*0.6) = floor(4.6) — NOT fs-scaled
    expect(s.exp).toBe(44);              // 40 + 1*4
  });
  it('floor 10 scales hp/atk by fs, def stays linear', () => {
    const s = wardenStats(10);           // fs = 1 + 9*.12 = 2.08
    expect(s.hp).toBe(Math.floor((45 + 50) * 2.08));   // 197
    expect(s.atk).toBe(Math.floor((10 + 16) * 2.08));  // floor(54.08) = 54
    expect(s.def).toBe(Math.floor(4 + 10 * 0.6));      // 10
    expect(s.exp).toBe(80);             // 40 + 40
  });
  it('grows with floor (hp monotonic)', () => {
    expect(wardenStats(20).hp).toBeGreaterThan(wardenStats(10).hp);
  });
});

describe('pickWardenRelic', () => {
  it('returns the first unowned warden relic', () => {
    expect(pickWardenRelic([])).toBe(WARDEN_RELIC_IDS[0]);
    expect(pickWardenRelic([WARDEN_RELIC_IDS[0]])).toBe(WARDEN_RELIC_IDS[1]);
  });
  it('returns null when all owned', () => {
    expect(pickWardenRelic(WARDEN_RELIC_IDS)).toBeNull();
  });
});

describe('nextWardenMemory', () => {
  it('unlocks memory1 -> memory2 -> memory3 in order', () => {
    expect(nextWardenMemory([])).toBe('warden:memory1');
    expect(nextWardenMemory(['warden:memory1'])).toBe('warden:memory2');
    expect(nextWardenMemory(['warden:memory1', 'warden:memory2'])).toBe('warden:memory3');
    expect(nextWardenMemory(['warden:memory1', 'warden:memory2', 'warden:memory3'])).toBeNull();
  });
});

describe('WARDEN_MEMORIES', () => {
  it('has exactly 3 bilingual entries', () => {
    expect(WARDEN_MEMORIES).toHaveLength(3);
    for (const m of WARDEN_MEMORIES) { expect(typeof m.en).toBe('string'); expect(typeof m.zh).toBe('string'); }
  });
});

describe('spawnWarden', () => {
  beforeEach(() => {
    (globalThis as any).G = {
      player: { x: 5, y: 5 },
      enemies: [],
      dungeon: { rooms: [{ x: 0, y: 0, w: 5, h: 5, cx: 2, cy: 2 }, { x: 10, y: 10, w: 6, h: 6, cx: 13, cy: 13 }] },
    };
  });
  it('pushes one isWarden + isElite enemy with wardenStats hp', () => {
    spawnWarden(10);
    const G = (globalThis as any).G;
    expect(G.enemies).toHaveLength(1);
    const w = G.enemies[0];
    expect(w.isWarden).toBe(true);
    expect(w.isElite).toBe(true);
    expect(w.ai).toBe('chase');
    expect(w.tags).toContain('spirit');
    expect(w.maxHp).toBe(wardenStats(10).hp);
  });
  it('no-ops when there is no non-start room', () => {
    (globalThis as any).G.dungeon.rooms = [{ x: 0, y: 0, w: 5, h: 5, cx: 2, cy: 2 }];
    spawnWarden(5);
    expect((globalThis as any).G.enemies).toHaveLength(0);
  });
});
