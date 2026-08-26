// Batch3A: character selection overlay — extracted from main.ts for testability
// and made keyboard/gamepad-focusable: options carry tabindex="0" role="button"
// + aria-pressed so spatial focus navigation and keyboard Tab reach them;
// Enter/Space activate. Dependencies are injected (no main.ts import cycle).
import { RACES, CLASSES } from './data.js';
import { t, tx } from './i18n.js';

export interface CharSelDeps {
  onStart: (race: number, cls: number, endless: boolean) => void;
  onBack: () => void;
}

export function showCharSelect(deps: CharSelDeps): void {
  let selRace = 0, selCls = 0;
  const ov = document.createElement('div');
  ov.id = 'char-sel';
  ov.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(10,10,15,.95);z-index:1000;display:flex;align-items:center;justify-content:center;flex-direction:column';
  const opt = (cls: string, idx: number, inner: string) =>
    `<div class="${cls}" data-idx="${idx}" tabindex="0" role="button" aria-pressed="${idx === 0}" style="padding:8px 15px;margin:4px 0;cursor:pointer;border:1px solid ${idx === 0 ? '#e63946' : '#333'};border-radius:3px;color:${idx === 0 ? '#ddd' : '#888'}">${inner}</div>`;
  const raceHtml = RACES.map((r, i) =>
    opt('race-opt', i, `<b>${tx(r.name)}</b> <span style="color:#666;font-size:.9em">${tx(r.desc)}</span>`)).join('');
  const classHtml = CLASSES.map((c, i) => {
    const sk = c.skill;
    return opt('class-opt', i, `<b>${tx(c.name)}</b> <span style="color:#666;font-size:.9em">${tx(c.desc)}</span><br><span style="color:#9b5de5;font-size:.8em">⚡ ${tx(sk.name)} — ${tx(sk.desc)}</span>`);
  }).join('');
  // Mode selector: 0 = Normal (F40 Creator = victory), 1 = Endless. Resets each open.
  let selMode = 0;
  const modeOpts = [
    { n: t('mn.modeNormal'), d: t('mn.modeNormalDesc') },
    { n: t('mn.modeEndless'), d: t('mn.modeEndlessDesc') },
  ];
  const modeHtml = modeOpts.map((m, i) =>
    opt('mode-opt', i, `<b>${m.n}</b> <span style="color:#666;font-size:.9em">${m.d}</span>`)).join('');
  ov.innerHTML = `<h2 style="color:#e63946;margin-bottom:20px;font-size:1.8em">${t('createHero')}</h2>
  <div style="display:flex;gap:30px;margin-bottom:20px;flex-wrap:wrap;justify-content:center">
  <div><h3 style="color:#8888aa;margin-bottom:10px">${t('race')}</h3>${raceHtml}</div>
  <div><h3 style="color:#8888aa;margin-bottom:10px">${t('cls')}</h3>${classHtml}</div>
  <div><h3 style="color:#8888aa;margin-bottom:10px">${t('mn.mode')}</h3>${modeHtml}</div></div>
  <div style="display:flex;gap:10px;align-items:center">
  <button class="menu-btn" id="start-btn" style="margin-top:10px">${t('begin')}</button>
  <button class="menu-btn" id="char-back-btn" style="margin-top:10px;border-color:#888;color:#888">${t('mn.back')}</button>
  </div>`;
  document.body.appendChild(ov);
  // Batch3A: keyboard activation — Enter/Space on an option behaves like a click
  // (divs with tabindex don't get native button key activation).
  ov.addEventListener('keydown', (e: KeyboardEvent) => {
    const el = (e.target as HTMLElement).closest('.race-opt,.class-opt,.mode-opt') as HTMLElement | null;
    if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); el.click(); }
  });
  const selectGroup = (group: string, idx: number) => {
    ov.querySelectorAll(group).forEach((n, i) => {
      const el = n as HTMLElement;
      el.style.borderColor = i === idx ? '#e63946' : '#333';
      el.style.color = i === idx ? '#ddd' : '#888';
      el.setAttribute('aria-pressed', String(i === idx));
    });
  };
  ov.querySelectorAll('.race-opt').forEach((el: any) => {
    el.onclick = () => { selRace = parseInt(el.dataset.idx); selectGroup('.race-opt', selRace); };
  });
  ov.querySelectorAll('.class-opt').forEach((el: any) => {
    el.onclick = () => { selCls = parseInt(el.dataset.idx); selectGroup('.class-opt', selCls); };
  });
  ov.querySelectorAll('.mode-opt').forEach((el: any) => {
    el.onclick = () => { selMode = parseInt(el.dataset.idx); selectGroup('.mode-opt', selMode); };
  });
  document.getElementById('start-btn')!.onclick = () => {
    ov.remove();
    deps.onStart(selRace, selCls, selMode === 1);
  };
  document.getElementById('char-back-btn')!.onclick = () => {
    ov.remove();
    deps.onBack();
  };
}
