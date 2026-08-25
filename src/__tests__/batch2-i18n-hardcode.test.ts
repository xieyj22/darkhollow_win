// 批2 ⑤: rendered-path strings go through L keys; html lang tracks language.
// NOTE: critHit / shieldBash / shadowStrike stay as inline tx() literals —
// their en/zh placeholder orders differ (Polish-B ruling: keep both originals;
// a single tMsg key with sequential {} cannot express both orders).
// Only same-order strings migrate into L here.
import { describe, it, expect } from 'vitest';
import { setLang, lang } from '../state.js';
import { t, tMsg } from '../i18n.js';

describe('hardcoded string cleanup', () => {
  it('new keys resolve in both languages', () => {
    const saved = lang;
    for (const l of ['en', 'zh']) {
      setLang(l);
      for (const k of ['gold', 'buff.nullCrown', 'cb.levelStats', 'it.atkGain', 'it.defGain', 'it.shieldGain']) {
        expect(t(k), `${k}(${l})`).not.toBe(k);   // t() falls back to the key itself when missing
      }
    }
    setLang(saved);
  });
  it('levelStats renders four numbers in order (both languages)', () => {
    const saved = lang;
    for (const l of ['en', 'zh']) {
      setLang(l);
      expect(tMsg('cb.levelStats', '5', '2', '1', '0'), l).toMatch(/5.*2.*1.*0/);
    }
    setLang(saved);
  });
  it('setLang updates documentElement.lang', () => {
    setLang('zh');
    expect(document.documentElement.lang).toBe('zh');
    setLang('en');
    expect(document.documentElement.lang).toBe('en');
  });
});
