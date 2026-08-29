// 批5 T2: buff-row canvas pool + whole-segment signature early-out.
// Drives the REAL updateUI (first test suite to do so) — every render.ts
// dependency is an import-safe leaf, so no vi.mock roster is needed: we set
// G via setGameState and lay down the DOM ids updateUI touches.
// happy-dom has no canvas2d (paintIcon no-ops on null ctx), so these tests
// assert DOM node identity, not pixels — exactly what the pool preserves.
import { describe, it, expect, beforeEach } from 'vitest';
import { updateUI } from '../render.js';
import { setGameState, setLang } from '../state.js';
import type { GameState } from '../types.js';

function buildDom(): void {
  document.body.innerHTML = `
    <span id="s-name"></span><span id="s-race"></span><span id="s-class"></span>
    <span id="s-level"></span><span id="s-atk"></span><span id="s-def"></span>
    <span id="s-gold"></span><span id="s-floor"></span><span id="s-turns"></span>
    <span id="s-combo"></span>
    <div class="bar"><div id="hp-fill"></div></div><span id="hp-text"></span>
    <div id="mp-fill"></div><span id="mp-text"></span>
    <div id="xp-fill"></div><span id="xp-text"></span>
    <div id="hunger-fill"></div><span id="hunger-text"></span>
    <div id="corruption-fill"></div><span id="corruption-text"></span>
    <span id="eq-weapon"></span><span id="eq-armor"></span>
    <span id="eq-accessory"></span><span id="eq-accessory2"></span>
    <div id="buff-list"></div>
    <div id="floor-label"></div><div id="streak-display"></div>
    <div id="objective-summary"></div><div id="objective-panel"></div>
  `;
}

function mkBuff(type: string, turns: number, value = 0): any {
  return { type, name: type, turns, value };
}

let G: any;

function mkG(playerOver: Record<string, unknown> = {}): void {
  G = {
    floor: 1, endless: false, branchMode: false,
    player: {
      raceName: 'Human', clsName: 'Warrior', level: 1, atk: 3, def: 1, gold: 0,
      turns: 0, streak: 0, hp: 10, maxHp: 10, mp: 5, maxMp: 5, exp: 0, expNext: 10,
      hunger: 80, maxHunger: 100, corruption: 0,
      eq: { weapon: null, armor: null, accessory: null, accessory2: null },
      buffs: [], poisonTurns: 0, poisonDmg: 0, slowed: 0,
      setBonusActive: {}, bossesKilledThisRun: 0,
      ...playerOver,
    },
  };
  setGameState(G as GameState);
}

beforeEach(() => { buildDom(); setLang('en'); });

describe('batch5 T2: buff-list signature early-out', () => {
  it('identical state re-rendered → DOM untouched (same nodes, same innerHTML)', () => {
    mkG({ buffs: [mkBuff('str_buff', 5)] });
    updateUI();
    const bd = document.getElementById('buff-list')!;
    const cv1 = bd.querySelector('canvas')!;
    const span1 = bd.querySelector('span')!;
    const html1 = bd.innerHTML;
    updateUI();
    expect(bd.querySelector('canvas')).toBe(cv1);
    expect(bd.querySelector('span')).toBe(span1);
    expect(bd.innerHTML).toBe(html1);
  });

  it('language switch with identical counts still rebuilds rendered strings (sig covers i18n output)', () => {
    mkG({ poisonTurns: 3, poisonDmg: 2 });
    updateUI();
    const bd = document.getElementById('buff-list')!;
    const cv1 = bd.querySelector('canvas')!;
    const txtEn = bd.querySelector('span')!.textContent;
    setLang('zh');
    updateUI();
    const txtZh = bd.querySelector('span')!.textContent;
    expect(txtZh).not.toBe(txtEn);
    expect(txtZh).toContain('中毒');
    // rebuilt — but the poison icon must come from the pool, same node
    expect(bd.querySelector('canvas')).toBe(cv1);
  });
});

describe('batch5 T2: buff icon canvas pool', () => {
  it('turns 5→4 updates span text, canvas node is reused (pool, not fresh)', () => {
    mkG({ buffs: [mkBuff('str_buff', 5)] });
    updateUI();
    const bd = document.getElementById('buff-list')!;
    const cv1 = bd.querySelector('canvas')!;
    G.player.buffs[0].turns = 4;
    updateUI();
    expect(bd.querySelector('canvas')).toBe(cv1);
    expect(bd.querySelector('span')!.textContent).toContain('(4t)');
    expect(bd.querySelector('span')!.textContent).not.toContain('(5t)');
  });

  it('add/remove cycles track rows exactly and pooled nodes survive list wipes', () => {
    mkG({ buffs: [mkBuff('str_buff', 5)] });
    updateUI();
    const bd = document.getElementById('buff-list')!;
    const cvA = bd.querySelector('canvas')!;

    G.player.buffs.push(mkBuff('gold', 3));
    updateUI();
    expect(bd.querySelectorAll('canvas').length).toBe(2);

    G.player.buffs.pop();
    updateUI();
    expect(bd.querySelectorAll('canvas').length).toBe(1);

    G.player.buffs.pop();
    updateUI(); // empty state
    expect(bd.querySelectorAll('canvas').length).toBe(0);
    expect(bd.textContent).toContain('None');

    G.player.buffs.push(mkBuff('str_buff', 2));
    updateUI();
    // pool retained the str_buff icon node across the empty-state wipe
    expect(bd.querySelector('canvas')).toBe(cvA);
  });

  it('two rows with the same (kind,color) each keep their own canvas (pool must not steal)', () => {
    mkG({ buffs: [mkBuff('str_buff', 5), mkBuff('str_buff', 2)] });
    updateUI();
    const bd = document.getElementById('buff-list')!;
    const rows = Array.from(bd.children) as HTMLElement[];
    expect(rows.length).toBe(2);
    expect(bd.querySelectorAll('canvas').length).toBe(2);
    for (const r of rows) expect(r.querySelectorAll('canvas').length).toBe(1);
  });
});
