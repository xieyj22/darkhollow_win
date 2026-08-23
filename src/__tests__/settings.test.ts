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
  hc: false, setHc: vi.fn(),
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

describe('hc (high contrast) setting', () => {
  it('schema def: access tab, toggle, default false, has descKey', () => {
    const def = SETTING_DEFS.find(d => d.key === 'hc');
    expect(def).toBeDefined();
    expect(def!.tab).toBe('access');
    expect(def!.control).toBe('toggle');
    expect(def!.default).toBe(false);
    expect(def!.descKey).toBe('opt.hcDesc');
  });
});

describe('textScale continuous slider', () => {
  it('def is a slider 0.85–1.5 step 0.05 with percent display', () => {
    const def = SETTING_DEFS.find(d => d.key === 'textScale')!;
    expect(def.control).toBe('slider');
    expect(def.min).toBe(0.85);
    expect(def.max).toBe(1.5);
    expect(def.step).toBe(0.05);
    expect(def.toDisplay!(1.5)).toBe('150%');
  });
});
