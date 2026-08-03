// P0-1 regression: a save taken inside a portal branch (秘境) must NEVER overwrite
// the main-line snapshot. autoSave / saveGame must short-circuit while branchMode.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../state.js', () => ({
  get G(): unknown { return (globalThis as { G?: unknown }).G; },
  lang: 'en',
  setGameState: () => {},
}));
vi.mock('../i18n.js', () => ({ t: (k: string) => k }));
vi.mock('../messages.js', () => ({ addMsg: () => {} }));
vi.mock('../render.js', () => ({ updateUI: () => {}, render: () => {}, resizeCanvas: () => {} }));
vi.mock('../particles.js', () => ({ startParticles: () => {} }));
vi.mock('../config.js', () => ({ MH: 30, MW: 40 }));
vi.mock('../dungeon.js', () => ({ updatePlayerFOV: () => {} }));
vi.mock('../audio.js', () => ({ snd: () => {} }));
vi.mock('../bridge.js', () => ({ bridge: {} }));

import { autoSave, saveGame } from '../save.js';

function fixtureG(branch = false): any {
  return {
    player: {
      quickSlots: [null, null, null, null, null], inv: [],
      achievements: new Set<string>(), x: 1, y: 1,
    },
    floor: 10, dungeon: { map: [], rooms: [] }, enemies: [], items: [],
    traps: [], msgs: [], endless: false, wardenCd: 4,
    branchMode: branch, gameOver: false,
  };
}

describe('P0-1 branch (秘境) never overwrites main-line save', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });

  it('autoSave is a no-op while inside a branch', () => {
    localStorage.setItem('dh_save', 'MAINLINE_SNAPSHOT');
    (globalThis as any).G = fixtureG(true);
    autoSave();
    expect(localStorage.getItem('dh_save')).toBe('MAINLINE_SNAPSHOT');
  });

  it('saveGame (Ctrl+S) is a no-op while inside a branch', () => {
    localStorage.setItem('dh_save', 'MAINLINE_SNAPSHOT');
    (globalThis as any).G = fixtureG(true);
    saveGame();
    expect(localStorage.getItem('dh_save')).toBe('MAINLINE_SNAPSHOT');
  });

  it('autoSave still writes on the main line (branchMode false)', () => {
    (globalThis as any).G = fixtureG(false);
    autoSave();
    const saved = localStorage.getItem('dh_save');
    expect(saved).not.toBeNull();
    expect(saved).not.toBe('MAINLINE_SNAPSHOT');
  });
});
