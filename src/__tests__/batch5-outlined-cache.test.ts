// 批5 T1: pre-baked outlined sprite cache. happy-dom has no canvas2d
// (getContext('2d') → null), so pixels can't render here — we stub a no-op 2d
// context and assert what IS unit-testable: the cache KEY discipline (Boss
// t=2 must never collide with t=1), bounded cache growth, and the perf
// contract itself (ONE drawImage per blit, was 9/25). Pixel equivalence is
// the e2e battery's job, not this file's.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { drawPlayerSprite, drawBossSprite, outlinedKey, outlinedCacheSize } from '../sprites.js';

function fakeCtx(): any {
  return {
    imageSmoothingEnabled: false,
    fillStyle: '',
    globalCompositeOperation: 'source-over',
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
  };
}

describe('批5 T1: outlinedKey cache-key discipline', () => {
  it('thickness is part of the key — Boss t=2 never collides with t=1', () => {
    expect(outlinedKey('X', 1)).not.toBe(outlinedKey('X', 2));
  });
  it('contains the sig (sigs themselves embed ":")', () => {
    expect(outlinedKey('PLAYER:WARRIOR', 1).startsWith('PLAYER:WARRIOR')).toBe(true);
  });
  it('deterministic and sig-sensitive: same (sig,t) equal, different sigs differ', () => {
    expect(outlinedKey('A', 1)).toBe(outlinedKey('A', 1));
    expect(outlinedKey('A', 1)).not.toBe(outlinedKey('B', 1));
  });
});

describe('批5 T1: outlined cache growth + blit call count', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fakeCtx());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('repeated blits of one sprite add exactly ONE cache entry and cost ONE drawImage each', () => {
    const c = fakeCtx();
    const before = outlinedCacheSize();
    drawPlayerSprite(c, 3.4, 5.6, 1);
    drawPlayerSprite(c, 7.2, 9.9, 1);
    expect(outlinedCacheSize()).toBe(before + 1);
    expect(c.drawImage).toHaveBeenCalledTimes(2); // old path: 9 per blit (8 stamps + sprite)
  });

  it('Boss (t=2) bakes its own entry: distinct (sig,t) keys, still one drawImage per blit', () => {
    const c = fakeCtx();
    const before = outlinedCacheSize();
    drawPlayerSprite(c, 0, 0, 3); // ci=3 → PALADIN: distinct sig from other tests' bakes
    drawBossSprite(c, 0, 0, '#ff0000');
    expect(outlinedCacheSize()).toBe(before + 2);
    expect(c.drawImage).toHaveBeenCalledTimes(2); // old path: 9 + 25 = 34
  });

  it('the single blit draws the (TS+2t)² bake at offset -t (t=1, x=y=0 → 24×24 at (-1,-1))', () => {
    const c = fakeCtx();
    drawPlayerSprite(c, 0, 0, 2);
    expect(c.drawImage).toHaveBeenLastCalledWith(expect.anything(), -1, -1, 24, 24);
  });
});
