// Audio system — Web Audio SFX + procedural generative BGM.
// Audio graph: sources → [musicGain | sfxGain] → masterGain → destination.
// BGM is fully synthesized (no asset files yet) — a per-biome ambient bed of
// detuned drones + a pad chord + a slow arpeggio, crossfaded between scenes.
// All volume prefs persist to localStorage.

import { bridge } from './bridge.js';

// ===== Persisted volume prefs =====
function loadVol(key: string, dflt: number): number {
  const v = parseFloat(localStorage.getItem(key) ?? '');
  return isNaN(v) ? dflt : Math.max(0, Math.min(1, v));
}
let masterVol = loadVol('dh_vol_master', 0.9);
let musicVol = loadVol('dh_vol_music', 0.45);
let sfxVol = loadVol('dh_vol_sfx', 0.9);
let muted = localStorage.getItem('dh_muted') === '1';

let ac: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;

export function initAudio(): void {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    masterGain = ac.createGain();
    musicGain = ac.createGain();
    sfxGain = ac.createGain();
    musicGain.connect(masterGain);
    sfxGain.connect(masterGain);
    masterGain.connect(ac.destination);
    applyVolumes();
    bridge.audioCtx = ac;
  } catch { /* audio unavailable */ }
}

export function getAudioContext(): AudioContext | null { return ac; }

function clamp01(v: number): number { return Math.max(0, Math.min(1, v)); }

function applyVolumes(): void {
  if (!ac || !masterGain || !musicGain || !sfxGain) return;
  const t = ac.currentTime;
  masterGain.gain.setTargetAtTime(muted ? 0 : masterVol, t, 0.04);
  musicGain.gain.setTargetAtTime(musicVol, t, 0.04);
  sfxGain.gain.setTargetAtTime(sfxVol, t, 0.04);
}

export function setMasterVol(v: number): void { masterVol = clamp01(v); localStorage.setItem('dh_vol_master', String(masterVol)); applyVolumes(); }
export function setMusicVol(v: number): void { musicVol = clamp01(v); localStorage.setItem('dh_vol_music', String(musicVol)); applyVolumes(); }
export function setSfxVol(v: number): void { sfxVol = clamp01(v); localStorage.setItem('dh_vol_sfx', String(sfxVol)); applyVolumes(); }
export function getMasterVol(): number { return masterVol; }
export function getMusicVol(): number { return musicVol; }
export function getSfxVol(): number { return sfxVol; }
export function isMuted(): boolean { return muted; }
export function setMutedState(m: boolean): void { muted = m; localStorage.setItem('dh_muted', m ? '1' : '0'); applyVolumes(); }

// ===== SFX — oscillator bank, routed through sfxGain =====
export function snd(type: string): void {
  const c = ac;
  if (!c || muted || !sfxGain) return;
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    o.connect(g); g.connect(sfxGain);
    const n = c.currentTime;
    switch (type) {
      case 'hit':
        o.type = 'sawtooth'; o.frequency.setValueAtTime(200, n); o.frequency.exponentialRampToValueAtTime(80, n + .1);
        g.gain.setValueAtTime(.12, n); g.gain.exponentialRampToValueAtTime(.001, n + .1); o.start(n); o.stop(n + .1); break;
      case 'crit':
        o.type = 'sawtooth'; o.frequency.setValueAtTime(400, n); o.frequency.exponentialRampToValueAtTime(100, n + .2);
        g.gain.setValueAtTime(.18, n); g.gain.exponentialRampToValueAtTime(.001, n + .2); o.start(n); o.stop(n + .2); break;
      case 'pickup':
        o.type = 'sine'; o.frequency.setValueAtTime(600, n); o.frequency.exponentialRampToValueAtTime(900, n + .1);
        g.gain.setValueAtTime(.08, n); g.gain.exponentialRampToValueAtTime(.001, n + .15); o.start(n); o.stop(n + .15); break;
      case 'levelup':
        o.type = 'sine'; o.frequency.setValueAtTime(400, n); o.frequency.setValueAtTime(500, n + .1); o.frequency.setValueAtTime(700, n + .2);
        g.gain.setValueAtTime(.1, n); g.gain.exponentialRampToValueAtTime(.001, n + .4); o.start(n); o.stop(n + .4); break;
      case 'death':
        o.type = 'sawtooth'; o.frequency.setValueAtTime(300, n); o.frequency.exponentialRampToValueAtTime(30, n + .8);
        g.gain.setValueAtTime(.18, n); g.gain.exponentialRampToValueAtTime(.001, n + .8); o.start(n); o.stop(n + .8); break;
      case 'stairs':
        o.type = 'triangle'; o.frequency.setValueAtTime(300, n); o.frequency.exponentialRampToValueAtTime(600, n + .3);
        g.gain.setValueAtTime(.08, n); g.gain.exponentialRampToValueAtTime(.001, n + .3); o.start(n); o.stop(n + .3); break;
      case 'trap':
        o.type = 'square'; o.frequency.setValueAtTime(100, n); o.frequency.exponentialRampToValueAtTime(50, n + .15);
        g.gain.setValueAtTime(.12, n); g.gain.exponentialRampToValueAtTime(.001, n + .15); o.start(n); o.stop(n + .15); break;
      case 'heal':
        o.type = 'sine'; o.frequency.setValueAtTime(500, n); o.frequency.exponentialRampToValueAtTime(800, n + .2);
        g.gain.setValueAtTime(.06, n); g.gain.exponentialRampToValueAtTime(.001, n + .25); o.start(n); o.stop(n + .25); break;
      case 'victory':
        o.type = 'sine'; o.frequency.setValueAtTime(523, n); o.frequency.setValueAtTime(659, n + .15);
        o.frequency.setValueAtTime(784, n + .3); o.frequency.setValueAtTime(1047, n + .45);
        g.gain.setValueAtTime(.12, n); g.gain.exponentialRampToValueAtTime(.001, n + .7); o.start(n); o.stop(n + .7); break;
      case 'spell':
        o.type = 'sine'; o.frequency.setValueAtTime(800, n); o.frequency.exponentialRampToValueAtTime(200, n + .25);
        g.gain.setValueAtTime(.1, n); g.gain.exponentialRampToValueAtTime(.001, n + .3); o.start(n); o.stop(n + .3); break;
      case 'ach':
        o.type = 'sine'; o.frequency.setValueAtTime(600, n); o.frequency.setValueAtTime(800, n + .1); o.frequency.setValueAtTime(1000, n + .2);
        g.gain.setValueAtTime(.1, n); g.gain.exponentialRampToValueAtTime(.001, n + .4); o.start(n); o.stop(n + .4); break;
      case 'boss':
        o.type = 'sawtooth'; o.frequency.setValueAtTime(110, n); o.frequency.linearRampToValueAtTime(55, n + .6);
        g.gain.setValueAtTime(.2, n); g.gain.exponentialRampToValueAtTime(.001, n + .9); o.start(n); o.stop(n + .9); break;
      case 'chest':
        o.type = 'triangle'; o.frequency.setValueAtTime(523, n); o.frequency.setValueAtTime(659, n + .08); o.frequency.setValueAtTime(880, n + .16);
        g.gain.setValueAtTime(.1, n); g.gain.exponentialRampToValueAtTime(.001, n + .3); o.start(n); o.stop(n + .3); break;
      default:
        o.type = 'square'; o.frequency.setValueAtTime(440, n);
        g.gain.setValueAtTime(.06, n); g.gain.exponentialRampToValueAtTime(.001, n + .08); o.start(n); o.stop(n + .08); break;
    }
  } catch { /* ignore */ }
}

// ===== Procedural BGM engine =====
// Each scene = a bed of detuned drones + a pad chord (with slow tremolo LFO) +
// an arpeggio that plucks notes from a scale. Scenes crossfade for smooth cuts.

type BgmScene = 'title' | 'explore' | 'boss' | 'victory' | 'death';

interface BgmTheme {
  root: number;       // base frequency Hz
  scale: number[];    // semitone offsets (arp picks from these, one octave up)
  pad: number[];      // chord semitone offsets over root
  osc: OscillatorType;
  tempo: number;      // arp interval (seconds)
  filter: number;     // lowpass cutoff Hz for the bed
  bright: number;     // arp note peak gain
}

const SCENES: Record<BgmScene, BgmTheme> = {
  title:   { root: 65.41, scale: [0, 7, 12, 7, 3, 10], pad: [0, 7, 12], osc: 'sine',     tempo: 1.1, filter: 900,  bright: 0.04 },
  explore: { root: 55,    scale: [0, 3, 5, 7, 10, 12], pad: [0, 3, 7],  osc: 'triangle', tempo: 1.4, filter: 700,  bright: 0.03 },
  boss:    { root: 73.42, scale: [0, 1, 3, 6, 7, 8, 10], pad: [0, 3, 6], osc: 'sawtooth', tempo: 0.45, filter: 1400, bright: 0.05 },
  victory: { root: 65.41, scale: [0, 4, 7, 12, 16, 19], pad: [0, 4, 7, 12], osc: 'triangle', tempo: 0.4, filter: 1500, bright: 0.05 },
  death:   { root: 41.2,  scale: [0, 1, 3, 5], pad: [0, 1, 3], osc: 'sine', tempo: 2.2, filter: 400, bright: 0.02 },
};

// Per-biome tuning for the explore scene (matches AREAS ids).
const BIOME_TUNING: Record<string, { root: number; scale: number[]; pad: number[]; filter: number }> = {
  caverns:        { root: 55,    scale: [0, 3, 5, 7, 10], pad: [0, 3, 7], filter: 750 },
  crypts:         { root: 49,    scale: [0, 2, 4, 7, 9],  pad: [0, 2, 7], filter: 600 },
  burning_depths: { root: 58.27, scale: [0, 1, 4, 5, 7],  pad: [0, 4, 7], filter: 1300 },
  dark_fortress:  { root: 52,    scale: [0, 2, 3, 7, 8],  pad: [0, 3, 7], filter: 900 },
  dragons_domain: { root: 61.74, scale: [0, 1, 5, 7, 8],  pad: [0, 5, 7], filter: 1400 },
  abyss:          { root: 46,    scale: [0, 2, 3, 7, 10], pad: [0, 2, 7], filter: 500 },
  void_realm:     { root: 43.65, scale: [0, 3, 6, 9],    pad: [0, 3, 6], filter: 700 },
  final_sanctum:  { root: 49,    scale: [0, 1, 4, 7],     pad: [0, 4, 7], filter: 1000 },
};

interface Layer {
  gain: GainNode;
  nodes: AudioScheduledSourceNode[];  // drones + pads + LFO (stopped on dispose)
  timer: ReturnType<typeof setInterval> | null;
}

let bgmOut: GainNode | null = null;
let activeLayer: Layer | null = null;
let currentScene: BgmScene | null = null;

export function startBgm(): void {
  if (!ac || !musicGain || bgmOut) return;
  bgmOut = ac.createGain();
  bgmOut.gain.value = 1;
  bgmOut.connect(musicGain);
}

function buildLayer(theme: BgmTheme, time: number): Layer {
  const c = ac!;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, time);
  gain.connect(bgmOut!);

  const filt = c.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = theme.filter;
  filt.Q.value = 0.7;
  filt.connect(gain);

  const nodes: AudioScheduledSourceNode[] = [];

  // Sub-octave drone — two detuned oscillators for thickness
  for (const det of [-0.4, 0.4]) {
    const o = c.createOscillator();
    o.type = theme.osc;
    o.frequency.value = theme.root * 0.5 + det;
    const dg = c.createGain(); dg.gain.value = 0.11;
    o.connect(dg); dg.connect(filt);
    o.start(time); nodes.push(o);
  }

  // Pad chord with a slow tremolo LFO on its gain
  const padGain = c.createGain(); padGain.gain.value = 0.07; padGain.connect(filt);
  const lfo = c.createOscillator(); lfo.frequency.value = 0.1;
  const lfoGain = c.createGain(); lfoGain.gain.value = 0.035;
  lfo.connect(lfoGain); lfoGain.connect(padGain.gain);
  lfo.start(time); nodes.push(lfo);
  for (const semi of theme.pad) {
    const o = c.createOscillator();
    o.type = theme.osc;
    o.frequency.value = theme.root * Math.pow(2, semi / 12);
    o.connect(padGain); o.start(time); nodes.push(o);
  }

  // Arpeggio — pluck one scale note per tempo beat, one octave up
  let step = 0;
  const tempo = theme.tempo;
  const timer = setInterval(() => {
    if (!ac || ac.state !== 'running') return;
    const t0 = ac.currentTime;
    const semi = theme.scale[step % theme.scale.length];
    step++;
    const o = ac.createOscillator();
    o.type = theme.osc === 'sawtooth' ? 'square' : 'triangle';
    o.frequency.value = theme.root * 2 * Math.pow(2, semi / 12);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(theme.bright, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
    const af = ac.createBiquadFilter(); af.type = 'lowpass'; af.frequency.value = theme.filter * 1.5;
    o.connect(g); g.connect(af); af.connect(bgmOut!);
    o.start(t0); o.stop(t0 + 0.7);
    o.onended = () => { try { g.disconnect(); af.disconnect(); } catch {} };
  }, tempo * 1000);

  return { gain, nodes, timer };
}

function crossfade(theme: BgmTheme): void {
  if (!ac || !bgmOut) return;
  const t = ac.currentTime;
  const newLayer = buildLayer(theme, t);
  newLayer.gain.gain.linearRampToValueAtTime(1, t + 1.6);
  if (activeLayer) {
    const old = activeLayer;
    old.gain.gain.cancelScheduledValues(t);
    old.gain.gain.setValueAtTime(old.gain.gain.value, t);
    old.gain.gain.linearRampToValueAtTime(0, t + 1.4);
    if (old.timer) clearInterval(old.timer);
    setTimeout(() => { for (const n of old.nodes) { try { n.stop(); } catch { /* already stopped */ } } }, 1700);
  }
  activeLayer = newLayer;
}

export function setBgmScene(scene: BgmScene, biome?: string): void {
  if (!ac) return;
  if (!bgmOut) startBgm();
  if (scene === currentScene && scene !== 'explore') return; // explore varies by biome, always reapply
  currentScene = scene;
  if (scene === 'explore') {
    const bt = BIOME_TUNING[biome || 'caverns'] || BIOME_TUNING.caverns;
    const base = SCENES.explore;
    crossfade({ ...base, root: bt.root, scale: bt.scale, pad: bt.pad, filter: bt.filter });
    return;
  }
  crossfade(SCENES[scene]);
}

export function stopBgm(): void {
  if (!ac || !bgmOut) return;
  if (activeLayer) {
    const t = ac.currentTime;
    activeLayer.gain.gain.cancelScheduledValues(t);
    activeLayer.gain.gain.linearRampToValueAtTime(0, t + 0.8);
    if (activeLayer.timer) clearInterval(activeLayer.timer);
    const old = activeLayer; activeLayer = null;
    setTimeout(() => {
      for (const n of old.nodes) { try { n.stop(); } catch { /* already stopped */ } }
      try { bgmOut?.disconnect(); } catch { /* gone */ }
      bgmOut = null;
    }, 1000);
  } else {
    try { bgmOut.disconnect(); } catch { /* gone */ }
    bgmOut = null;
  }
  currentScene = null;
}
