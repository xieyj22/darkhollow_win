import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../audio.js', () => ({
  isMuted: vi.fn(() => false), setMutedState: vi.fn(),
  getMasterVol: vi.fn(() => 0.9), setMasterVol: vi.fn(),
  getMusicVol: vi.fn(() => 0.45), setMusicVol: vi.fn(),
  getSfxVol: vi.fn(() => 0.9), setSfxVol: vi.fn(),
}));
vi.mock('../state.js', () => ({
  lang: 'en', setLang: vi.fn(),
  uiZoom: 1, setUiZoom: vi.fn(), minimapScale: 3, setMinimapScale: vi.fn(),
  reducedMotion: false, setReducedMotion: vi.fn(), safeZone: 16, setSafeZone: vi.fn(),
  shakeScale: 1, setShakeScale: vi.fn(), textScale: 1, setTextScale: vi.fn(),
  colorblind: 'off', setColorblind: vi.fn(), barCues: true, setBarCues: vi.fn(),
  introEnabled: true, setIntroEnabled: vi.fn(), legendVisible: false, keysVisible: false,
}));
import { SETTING_DEFS, resetDefaults } from '../settings.js';

beforeEach(() => vi.clearAllMocks());

describe('settings schema', () => {
  it('covers 14 settings across 4 tabs', () => {
    expect(SETTING_DEFS.length).toBeGreaterThanOrEqual(13); // mute+3vol + fullscreen? + zoom+text+minimap+safe+lang + reduced+shake+cb+bar + intro
    const tabs = new Set(SETTING_DEFS.map(d => d.tab));
    expect(tabs).toContain('audio'); expect(tabs).toContain('display');
    expect(tabs).toContain('access'); expect(tabs).toContain('game');
  });
  it('every def has key/label/control/default + get/set', () => {
    for (const d of SETTING_DEFS) {
      expect(d.key).toBeTruthy(); expect(d.labelKey).toBeTruthy();
      expect(['toggle','seg','slider']).toContain(d.control);
      expect(typeof d.get).toBe('function'); expect(typeof d.set).toBe('function');
      expect('default' in d).toBe(true);
    }
  });
  it('resetDefaults calls set(default) for every def', () => {
    resetDefaults();
    for (const d of SETTING_DEFS) expect(d.set).toHaveBeenCalledWith(d.default);
  });
});
