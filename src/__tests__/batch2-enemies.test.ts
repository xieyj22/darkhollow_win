// 批2 ①: the three previously-dead handlers (heal/blink/summon) gain live casters.
import { describe, it, expect } from 'vitest';
import { ENEMIES } from '../data.js';

describe('batch2 ① dead-handler enemies', () => {
  it('ENEMIES count is 73', () => expect(ENEMIES.length).toBe(73));

  it('heal effect has a live caster (enemy, not class)', () => {
    // CLASSES[3] (paladin) also has effect 'heal' — ENEMIES only here.
    expect(ENEMIES.filter(e => e.skill?.effect === 'heal').length).toBeGreaterThanOrEqual(1);
  });
  it('blink effect has a live caster', () => {
    expect(ENEMIES.filter(e => e.skill?.effect === 'blink').length).toBeGreaterThanOrEqual(1);
  });
  it('summon effect has a live caster (skill-based, distinct from ai summoners)', () => {
    expect(ENEMIES.filter(e => e.skill?.effect === 'summon').length).toBeGreaterThanOrEqual(1);
  });

  it('three new enemies are well-formed', () => {
    for (const en of ['Deep Mender', 'Crypt Summoner', 'Void Blinker']) {
      const e = ENEMIES.find(x => x.n.en === en);
      expect(e, en).toBeDefined();
      expect(e!.mf).toBeGreaterThanOrEqual(1);
      expect(e!.hp).toBeGreaterThan(0);
      expect(e!.tags!.length).toBeGreaterThan(0);          // sprite routing needs a tag
      expect(e!.skill).toBeDefined();
    }
  });
});
