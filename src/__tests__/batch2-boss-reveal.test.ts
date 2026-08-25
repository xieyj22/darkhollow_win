// 批2 ⑦: boss intro fx fires exactly once, on first sight.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../state.js', () => ({ get G() { return (globalThis as any).G; }, lang: 'en' }));
vi.mock('../fx.js', () => ({ fxFlash: () => {}, fxAura: vi.fn(), fxBeam: () => {}, fxBolt: () => {}, fxBurst: () => {} }));
vi.mock('../effects.js', () => ({ flt: vi.fn(), shake: vi.fn() }));
vi.mock('../audio.js', () => ({ snd: vi.fn(), setBgmScene: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: vi.fn() }));
vi.mock('../combat.js', () => ({ attack: vi.fn(), playerDeath: vi.fn() }));
vi.mock('../enemy-skills.js', () => ({ shouldCastSkill: () => false, executeEnemySkill: vi.fn() }));
vi.mock('../enemy-factory.js', () => ({ makeEnemy: vi.fn() }));
vi.mock('../warden.js', () => ({ wardenStats: () => ({ hp: 1, maxHp: 1, atk: 1, def: 1, exp: 1 }), WARDEN_MEMORIES: [] }));
vi.mock('../relics.js', () => ({ grantRelic: vi.fn(), hasRelic: () => false }));
vi.mock('../meta.js', () => ({ getMeta: () => ({ upgrades: {}, wardens: [], unlockedLore: [] }), unlockLore: vi.fn() }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tMsg: (k: string, ...a: string[]) => k + a.join(''), tx: (f: any) => f?.en ?? '' }));
vi.mock('../render.js', () => ({ setEnemyTween: vi.fn(), updateUI: () => {}, render: () => {} }));
vi.mock('../item-intro.js', () => ({ queueMechanicIntro: vi.fn() }));

import { shouldBossReveal, checkBossReveal } from '../enemies.js';
import { fxAura } from '../fx.js';
import { shake } from '../effects.js';

const boss = (over: any = {}) => ({ isBoss: true, introPlayed: false, x: 3, y: 3, c: '#ffd700', name: 'Goblin King', ...over });

beforeEach(() => { vi.clearAllMocks(); });

describe('shouldBossReveal (pure)', () => {
  it('boss + visible + not played → true', () => expect(shouldBossReveal(boss(), true)).toBe(true));
  it('already played → false', () => expect(shouldBossReveal(boss({ introPlayed: true }), true)).toBe(false));
  it('not visible → false', () => expect(shouldBossReveal(boss(), false)).toBe(false));
  it('non-boss → false', () => expect(shouldBossReveal(boss({ isBoss: false }), true)).toBe(false));
});

describe('checkBossReveal', () => {
  it('fires fx once, then idempotent', () => {
    const b = boss();
    (globalThis as any).G = { enemies: [b], player: { x: 0, y: 0, visible: { 3: { 3: true } } }, gameOver: false };
    checkBossReveal();
    expect(fxAura).toHaveBeenCalledWith(3, 3, '#ffd700', 2.5);
    expect(shake).toHaveBeenCalledWith(2);
    checkBossReveal();   // second call: no more fx
    expect(fxAura).toHaveBeenCalledTimes(1);
    expect(b.introPlayed).toBe(true);
  });
});
