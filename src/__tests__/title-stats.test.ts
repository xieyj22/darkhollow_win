// ④ reconnect: #title-stats must actually render on the title screen.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../state.js', () => ({ get G() { return (globalThis as any).G; }, lang: 'en' }));
vi.mock('../i18n.js', () => ({ t: (k: string) => k, tx: (f: any) => f?.en ?? '' }));
vi.mock('../data.js', () => ({ ACH_DEFS: [] }));
vi.mock('../audio.js', () => ({ snd: () => {} }));

import { renderTitleStats } from '../meta.js';

beforeEach(() => {
  document.body.innerHTML = '<div id="title-stats"></div>';
  localStorage.clear();
  localStorage.setItem('dh_meta', JSON.stringify({
    soulEchoes: 5,
    stats: { totalRuns: 3, bestFloor: 12, wins: 1, totalKills: 40 },
    achievements: [],
  }));
});

describe('④ renderTitleStats', () => {
  it('fills #title-stats with echoes/runs/best/wins/kills/achv', () => {
    renderTitleStats();
    const html = document.getElementById('title-stats')!.innerHTML;
    expect(html).toContain('>5<');        // soul echoes
    expect(html).toContain('F12');        // best floor
    expect(html).toContain('mt.runs');
    expect(html).toContain('mt.achv');
  });
});
