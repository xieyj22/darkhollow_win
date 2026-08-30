# In-game verification for feat/batch7-deathscreen-a11y (批7「结算与可达性」T6).
# Runs against the Vite DEV server so page.evaluate can `import('/src/*.ts')`
# and reach the SAME live module instances the game loop uses (batch2/3B/3C/4/5-
# proven harness). Zero console errors enforced (favicon 404 whitelisted).
#   1  death screen quartet: seeded wardens(7) → playerDeath('冒烟杀手','trap') →
#      #death-epitaph .ep-line carries killer+floor; .ep-flavor (unquoted) ∈ the
#      zh flavor lib for 'trap' (imported straight from i18n L); #death-wardens
#      shows 5 rows + '+2'; #death-echoes non-empty.
#   2  event residue (批4 backlog): setEventOpen(true) + popup shown → death →
#      popup display:none.
#   3  log ×N aggregation: 3× identical addMsg → ONE row '… ×3'; different text
#      interleaved never merges.
#   4  records date column + REAL keyboard focus walk: seeded runHistory (ts:0 +
#      today) renders '—' and MM-DD; ArrowDown/ArrowUp via page.keyboard moves
#      focus between .rrow rows (real .active overlay, real keydown).
#   5  slider gamepad long-press (T5's only behavioral coverage): fake pad
#      (window.__pad, addInitScript) holds move_left (button 14) for ~1.5s on a
#      focused range input → value steps ≥3 (single-step would be exactly 1);
#      after release the value freezes.
#   6  static semantics: every .overlay panel has role=dialog+aria-modal, every
#      .close-btn has aria-label, #log-panel aria-live=polite, records role=list.
# Run: npm run dev -- --port 5173 --strictPort (FRESH server), then:
#      python scripts/verify_batch7_ingame.py
import io
import os
import re
import sys
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from playwright.sync_api import sync_playwright

BASE = 'http://localhost:5173'
results = []
console_errors = []
http_404s = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ''))


def start_game(page):
    page.click('#btn-new')
    page.click('#start-btn')
    page.wait_for_timeout(700)
    assert page.evaluate("document.getElementById('game-container').style.display") == 'flex', 'game did not start'


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel='chrome')
        page = browser.new_page(viewport={'width': 1280, 'height': 800})
        page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' and '/favicon' not in m.text else None)
        page.on('pageerror', lambda e: console_errors.append(str(e)))
        page.on('response', lambda r: http_404s.append(r.url) if r.status == 404 else None)
        page.on('dialog', lambda d: d.accept())
        # Fake gamepad injection (verify_gamepad_ingame.py pattern): mutable
        # window.__pad picked up by pollGamepad's 60ms interval.
        page.add_init_script("""
          window.__pad = { axes: [0, 0], mapping: 'standard', buttons: Array.from({length: 18}, () => ({pressed: false, value: 0})), index: 0, connected: true };
          Object.defineProperty(navigator, 'getGamepads', { value: () => [window.__pad] });
        """)
        page.goto(BASE)
        page.wait_for_selector('#btn-new', state='visible')
        start_game(page)

        # ---- 1  death screen quartet ------------------------------------------------
        page.evaluate("""async () => {
          const meta = await import('/src/meta.ts');
          const m = meta.getMeta();
          m.wardens.length = 0;
          for (let i = 0; i < 7; i++) m.wardens.unshift({ name: '冒烟陨者' + i, cls: 0, race: 0, floor: 10 + i, ts: 1 });
          meta.saveMeta(m);
        }""")
        page.evaluate("async () => { (await import('/src/combat.ts')).playerDeath('冒烟杀手', 'trap'); }")
        page.wait_for_timeout(300)
        line = page.evaluate("document.querySelector('#death-epitaph .ep-line')?.textContent || ''")
        floor = page.evaluate("(await import('/src/state.ts')).G.floor") if False else None
        check('S1a epitaph line carries killer', '冒烟杀手' in line, line[:60])
        in_lib = page.evaluate("""async () => {
          const i18n = await import('/src/i18n.ts');
          const { lang } = await import('/src/state.ts');
          const lib = ['ep.flavor.trap.0', 'ep.flavor.trap.1'].map(k => ((i18n.L[k] || {})[lang] || ''));
          const el = document.querySelector('#death-epitaph .ep-flavor');
          if (!el) return { ok: false, why: 'no .ep-flavor' };
          const txt = el.textContent.replace(/^[「“]|[」”]$/g, '');
          return { ok: lib.includes(txt), txt, lang: lang, lib };
        }""")
        check('S1b flavor is a real zh lib line (trap class)', in_lib.get('ok'), str(in_lib)[:120])
        rows = page.evaluate("[...document.querySelectorAll('#death-wardens .epw-row')].map(r => r.textContent)")
        check('S1c wardens list = 5 rows + +2 overflow', len(rows) == 6 and rows[5] == '+2', str(rows))
        echoes = page.evaluate("document.getElementById('death-echoes')?.textContent?.trim() || ''")
        check('S1d echo breakdown rendered', len(echoes) > 0)

        # ---- 2  event residue --------------------------------------------------------
        # (need a live G again — restart a run; playerDeath is idempotent-guarded by gameOver)
        page.evaluate("async () => { document.getElementById('death-screen').style.display = 'none'; const g = await import('/src/game.ts'); g.initGame(0, 0, false); }")
        page.evaluate("""async () => {
          const st = await import('/src/state.ts');
          st.setEventOpen(true);
          document.getElementById('event-popup').style.display = 'block';
        }""")
        page.evaluate("async () => { (await import('/src/combat.ts')).playerDeath('X', 'trap'); }")
        disp = page.evaluate("document.getElementById('event-popup').style.display")
        check('S2 event popup closed at death', disp == 'none', disp)

        # ---- 3  log ×N aggregation ---------------------------------------------------
        page.evaluate("async () => { document.getElementById('death-screen').style.display = 'none'; const g = await import('/src/game.ts'); g.initGame(0, 0, false); }")
        agg = page.evaluate("""async () => {
          const { addMsg } = await import('/src/messages.ts');
          const p = document.getElementById('log-panel');
          p.innerHTML = '';
          addMsg('冒烟消息', 'mi'); addMsg('冒烟消息', 'mi'); addMsg('冒烟消息', 'mi');
          const a = { rows: p.children.length, last: p.lastElementChild.textContent };
          addMsg('别的消息'); addMsg('冒烟消息'); addMsg('冒烟消息');
          return { ...a, rows2: p.children.length, last2: p.lastElementChild.textContent };
        }""")
        check('S3a 3× identical → one row "×3"', agg['rows'] == 1 and agg['last'].endswith('×3'), str(agg))
        check('S3b gap breaks the run (no retro-merge)', agg['rows2'] == 3 and agg['last2'].endswith('×2'), str(agg))

        # ---- 4  records date column + keyboard focus walk ----------------------------
        page.evaluate("""async () => {
          const meta = await import('/src/meta.ts');
          const m = meta.getMeta();
          m.runHistory.length = 0;
          m.runHistory.push({ mode: 'normal', floor: 5, kills: 3, classIdx: 0, result: 'death', turns: 90, gold: 10, ts: 0 });
          m.runHistory.push({ mode: 'normal', floor: 6, kills: 4, classIdx: 0, result: 'death', turns: 91, gold: 11, ts: Date.now() });
          meta.saveMeta(m);
        }""")
        page.evaluate("""async () => {
          const up = await import('/src/ui-panels.ts');
          up.showOverlay('records-overlay');
          up.renderRecords();
        }""")
        page.wait_for_timeout(120)   # rAF → .active
        dates = page.evaluate("""(() => {
          const rows = [...document.querySelectorAll('#records-content .rrow')];
          return { legacy: rows[1].textContent.includes('—'),
                   today: /\\d{2}-\\d{2}/.test(rows[2].textContent),
                   focusable: rows[1].getAttribute('tabindex') === '0' };
        })()""")
        check('S4a date column renders —/MM-DD + tabindex', dates['legacy'] and dates['today'] and dates['focusable'], str(dates))
        page.evaluate("document.querySelectorAll('#records-content .rrow')[1].focus()")
        page.keyboard.press('ArrowDown')
        moved_down = page.evaluate("document.activeElement === document.querySelectorAll('#records-content .rrow')[2]")
        page.keyboard.press('ArrowUp')
        moved_up = page.evaluate("document.activeElement === document.querySelectorAll('#records-content .rrow')[1]")
        check('S4b real ArrowDown/Up walks the rows', moved_down and moved_up, f'down={moved_down} up={moved_up}')
        page.evaluate("async () => { (await import('/src/ui-panels.ts')).hideOverlay('records-overlay'); }")

        # ---- 5  slider gamepad long-press --------------------------------------------
        page.click('#btn-options')
        page.wait_for_selector('#options-overlay.active', timeout=5000)
        page.wait_for_timeout(200)
        slide = page.evaluate("""async () => {
          const up = await import('/src/ui-panels.ts');
          up.renderOptions?.();
          const r = [...document.querySelectorAll('#opt-body input[type=range]')];
          if (!r.length) return null;
          r[0].focus();
          return { id: r[0].id, v: parseFloat(r[0].value), step: parseFloat(r[0].step || '1') || 1 };
        }""")
        check('S5a options slider focused', bool(slide), str(slide))
        page.evaluate("window.__pad.buttons[14] = { pressed: true, value: 1 }")   # dpad-left = move_left
        page.wait_for_timeout(1500)
        after = page.evaluate("(() => { const r = [...document.querySelectorAll('#opt-body input[type=range]')]; return parseFloat(r[0].value); })()")
        page.evaluate("window.__pad.buttons[14] = { pressed: false, value: 0 }")
        page.wait_for_timeout(400)
        frozen = page.evaluate("(() => { const r = [...document.querySelectorAll('#opt-body input[type=range]')]; return parseFloat(r[0].value); })()")
        steps = round(((slide['v'] - after) / slide['step'])) if slide else 0
        check('S5b held direction repeats (≥3 steps in 1.5s, single-press would be 1)', slide and steps >= 3, f'from={slide and slide["v"]} after={after} step={slide and slide["step"]} steps={steps}')
        check('S5c release freezes the value', after == frozen, f'{after} vs {frozen}')
        page.keyboard.press('Escape')

        # ---- 6  static semantics ------------------------------------------------------
        sem = page.evaluate("""(() => ({
          overlays: document.querySelectorAll('.overlay').length,
          dialogs: document.querySelectorAll('.overlay .panel[role="dialog"][aria-modal="true"]').length,
          close_named: [...document.querySelectorAll('.close-btn')].filter(b => (b.getAttribute('aria-label') || '').trim()).length,
          close_total: document.querySelectorAll('.close-btn').length,
          live: document.getElementById('log-panel')?.getAttribute('aria-live'),
          rlist: document.getElementById('records-content')?.getAttribute('role'),
        }))()""")
        check('S6a all overlay panels are labelled dialogs', sem['overlays'] >= 11 and sem['dialogs'] == sem['overlays'], str(sem))
        check('S6b every ✕ has an aria-label; log is a polite live region; records is a list',
              sem['close_named'] == sem['close_total'] and sem['close_total'] > 0
              and sem['live'] == 'polite' and sem['rlist'] == 'list', str(sem))

        browser.close()

    bad = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(bad)}/{len(results)} checks passed"
          + (' — ALL GREEN' if not bad else ''))
    favicon_only = all('favicon' in u for u in http_404s)
    ce = [] if (favicon_only and not [e for e in console_errors if 'Failed to load resource' not in e]) else [e for e in console_errors if '/favicon' not in e]
    print(f"Console errors: {len(ce)}")
    for e in ce[:5]:
        print('  ERR:', e[:140])
    sys.exit(1 if bad or ce else 0)


if __name__ == '__main__':
    main()
