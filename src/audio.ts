// Audio system — Web Audio API oscillator-based sounds
import { audioCtx, muted } from './state.js';

export function initAudio(): void {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (AC) {
      const ctx = new AC();
      // We can't directly set audioCtx from here in clean way,
      // so return it and let the caller set it
      (window as any).__audioCtx = ctx;
    }
  } catch (e) { /* ignore */ }
}

export function getAudioContext(): AudioContext | null {
  return (window as any).__audioCtx || null;
}

export function snd(type: string): void {
  const ac = getAudioContext();
  if (!ac || muted) return;
  try {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.connect(g);
    g.connect(ac.destination);
    const n = ac.currentTime;
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
    }
  } catch (e) { /* ignore */ }
}
