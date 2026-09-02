# In-game verification for feat/batch12-motion-gate (批12 legacy transition 全量收编).
# Runs against the Vite DEV server (same-instance ESM harness as batch2/3B/3C/4/5/7/9/10/11).
# Zero console errors enforced (favicon whitelisted). Three contexts:
#   S1 系统 rm 全静态: reduced_motion='reduce' context — every family representative
#      (.menu-btn main menu; .sb-btn/.hb-slot/.bar .fill/#sidebar/canvas#game-canvas
#      in-game) computes transition-duration '0s'. This is the batch's whole point:
#      static states no longer depend on the body.reduced-motion class propagating.
#   S2 允许动画值逐字保留 (equivalence evidence): no-preference context — the same
#      selectors keep their pre-batch durations verbatim: .menu-btn .3s, .bar .fill
#      .35s, canvas .05s/.25s, .hb-slot .15s, #sidebar .3s×4, .sb-btn === .close-btn
#      (③ token family, 0.12s from --dur-fast) and both non-zero.
#   S3 手动 toggle 静态: same no-preference context, live setReducedMotion(true)
#      (adds body.reduced-motion via the real path) → all representatives '0s';
#      setReducedMotion(false) → values restored (toggle round-trips).
#   S4 rm 下游戏冒烟: in the reduce context one real wait-key turn advances
#      G.player.turns — CSS static must not have broken the loop.
# Screenshots: smoke_out/batch12/{rm_menu,rm_game,nm_game}.png
# Run: npm run dev -- --port 5173 --strictPort (FRESH server), then:
#      python scripts/verify_batch12_ingame.py
import io
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from playwright.sync_api import sync_playwright

BASE = 'http://localhost:5173'
OUT = os.path.join(os.path.dirname(__file__), 'smoke_out', 'batch12')
os.makedirs(OUT, exist_ok=True)

results = []
console_errors = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ''))


def arm_page(page):
    page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' and '/favicon' not in ((m.location or {}).get('url') or '') else None)
    page.on('pageerror', lambda e: console_errors.append(str(e)))
    page.on('dialog', lambda d: d.accept())


def start_game(page):
    page.click('#btn-new')
    page.click('#start-btn')
    page.wait_for_timeout(700)
    assert page.evaluate("document.getElementById('game-container').style.display") == 'flex', 'game did not start'


# (selector, label) — main-menu family first, then in-game family.
# .toggle .track is settings-panel-only DOM (absent in-game); its CSS is locked
# by the batch12 static gate test, so the runtime battery skips it here.
MENU_SEL = ['.menu-btn', 'canvas#game-canvas', '.overlay']
GAME_SEL = ['.sb-btn', '.hb-slot', '.bar .fill', '#sidebar']


def durations(page, sels):
    return page.evaluate(
        "(sels) => sels.map(s => { const el = document.querySelector(s);"
        " return el ? getComputedStyle(el).transitionDuration : null; })", sels)


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel='chrome')

        # ---------- S1+S4: system reduced motion ------------------------------------
        ctx_rm = browser.new_context(viewport={'width': 1280, 'height': 800}, reduced_motion='reduce')
        page = ctx_rm.new_page()
        arm_page(page)
        page.goto(BASE)
        page.wait_for_selector('#btn-new', state='visible')
        page.screenshot(path=os.path.join(OUT, 'rm_menu.png'))
        menu_d = durations(page, MENU_SEL)
        check('S1a system-rm main menu static (.menu-btn/canvas/.overlay all 0s)',
              all(d == '0s' for d in menu_d), str(menu_d))
        start_game(page)
        game_d = durations(page, GAME_SEL)
        check('S1b system-rm in-game static (.sb-btn/.hb-slot/.bar .fill/#sidebar all 0s)',
              all(d == '0s' for d in game_d), str(game_d))
        page.screenshot(path=os.path.join(OUT, 'rm_game.png'))

        # S4: the loop is alive under rm — one real wait turn.
        turns = page.evaluate("""(async () => {
          const { G } = await import('/src/state.ts');
          const before = G.player.turns;
          return { before, after: null };
        })()""")
        page.keyboard.press(' ')
        page.wait_for_timeout(150)
        after = page.evaluate("(async () => (await import('/src/state.ts')).G.player.turns)")
        check('S4 wait-key advances a turn under system rm', after == turns['before'] + 1,
              f"turns {turns['before']} -> {after}")
        ctx_rm.close()

        # ---------- S2+S3: motion allowed, then manual toggle ------------------------
        ctx_nm = browser.new_context(viewport={'width': 1280, 'height': 800}, reduced_motion='no-preference')
        page = ctx_nm.new_page()
        arm_page(page)
        page.goto(BASE)
        page.wait_for_selector('#btn-new', state='visible')
        nm_menu = durations(page, ['.menu-btn', 'canvas#game-canvas'])
        check('S2a allow-motion .menu-btn keeps 0.3s', nm_menu[0] == '0.3s', str(nm_menu))
        check('S2b allow-motion canvas keeps 0.05s, 0.25s', nm_menu[1] == '0.05s, 0.25s', str(nm_menu))
        start_game(page)
        page.screenshot(path=os.path.join(OUT, 'nm_game.png'))
        nm_game = page.evaluate("""() => {
          const d = s => { const el = document.querySelector(s); return el ? getComputedStyle(el).transitionDuration : null; };
          return { hb: d('.hb-slot'), bar: d('.bar .fill'), side: d('#sidebar'),
                   sb: d('.sb-btn'), close: d('.close-btn') };
        }""")
        check('S2c .hb-slot keeps 0.15s', nm_game['hb'] == '0.15s', str(nm_game))
        check('S2d .bar .fill keeps 0.35s', nm_game['bar'] == '0.35s', str(nm_game))
        check('S2e #sidebar keeps 0.3s ×4', nm_game['side'] == '0.3s, 0.3s, 0.3s, 0.3s', str(nm_game))
        check('S2f ③ token family: .sb-btn === .close-btn === 0.12s ×5, non-zero',
              nm_game['sb'] == '0.12s, 0.12s, 0.12s, 0.12s, 0.12s' and nm_game['close'] == '0.12s, 0.12s, 0.12s, 0.12s, 0.12s', str(nm_game))

        # S3: manual toggle through the real setter→apply chain (setReducedMotion
        # only flips state+localStorage; applyAll() is the exported code path the
        # settings UI rides to put the body.reduced-motion class on).
        page.evaluate("(async () => { const { setReducedMotion } = await import('/src/state.ts');"
                      " const { applyAll } = await import('/src/settings.ts');"
                      " setReducedMotion(true); applyAll(); })")
        page.wait_for_timeout(60)
        has_cls = page.evaluate("document.body.classList.contains('reduced-motion')")
        rm_d = page.evaluate("""() => {
          const d = s => { const el = document.querySelector(s); return el ? getComputedStyle(el).transitionDuration : null; };
          return ['.sb-btn', '.hb-slot', '.bar .fill', '#sidebar', '.menu-btn'].map(d);
        }""")
        check('S3a manual rm: body class set + all representatives 0s',
              has_cls and all(d == '0s' for d in rm_d), f"cls={has_cls} {rm_d}")
        page.evaluate("(async () => { const { setReducedMotion } = await import('/src/state.ts');"
                      " const { applyAll } = await import('/src/settings.ts');"
                      " setReducedMotion(false); applyAll(); })")
        page.wait_for_timeout(60)
        back = page.evaluate("""() => {
          const d = s => { const el = document.querySelector(s); return el ? getComputedStyle(el).transitionDuration : null; };
          return { hb: d('.hb-slot'), sb: d('.sb-btn') };
        }""")
        check('S3b un-toggle restores durations (.hb-slot 0.15s / .sb-btn 0.12s ×5)',
              back['hb'] == '0.15s' and back['sb'] == '0.12s, 0.12s, 0.12s, 0.12s, 0.12s', str(back))
        ctx_nm.close()
        browser.close()

    print()
    fails = [r for r in results if not r[1]]
    console_gate = not console_errors
    print(f"console errors: {len(console_errors)}" + (f" -> {console_errors[:3]}" if console_errors else ''))
    for name, ok, detail in results:
        if not ok:
            print(f"FAILED: {name} [{detail}]")
    print(f"TOTAL {len(results) - len(fails)}/{len(results)} passed, console gate {'CLEAN' if console_gate else 'DIRTY'}")
    sys.exit(0 if not fails and console_gate else 1)


if __name__ == '__main__':
    main()
