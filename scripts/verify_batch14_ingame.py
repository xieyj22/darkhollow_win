# In-game verification for feat/batch14-runes-font (批14 Darkhollow Runes).
# Same-instance harness, zero console errors (favicon whitelisted).
#   S1 fonts load: document.fonts.check for both families (loaded status too)
#   S2 title screen wiring: #title-h1 computed family contains 'Eroded',
#      #title-h2/.menu-btn/.title-stats contain 'Darkhollow Runes'
#   S3 HUD wiring in-game: #floor-label/.bt-text/.panel h2 contain Runes
#   S4 中文位 fallback: a Chinese-only panel title falls through to the mono
#      stack (family chain still contains JetBrains Mono)
#   S5 negative anchors: body & .kb-key keep the mono stack
# Screenshots: smoke_out/batch14/{title,runes_hud}.png
# Run: npm run dev -- --port 5173 --strictPort (FRESH), then this script.
import io
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from playwright.sync_api import sync_playwright

BASE = 'http://localhost:5173'
OUT = os.path.join(os.path.dirname(__file__), 'smoke_out', 'batch14')
os.makedirs(OUT, exist_ok=True)

results = []
console_errors = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ''))


def fam(page, sel):
    return page.evaluate(
        "s => { const el = document.querySelector(s); return el ? getComputedStyle(el).fontFamily : null; }", sel)


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel='chrome')
        page = browser.new_page(viewport={'width': 1280, 'height': 800})
        page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' and '/favicon' not in ((m.location or {}).get('url') or '') else None)
        page.on('pageerror', lambda e: console_errors.append(str(e)))
        page.on('dialog', lambda d: d.accept())
        page.goto(BASE)
        page.wait_for_selector('#btn-new', state='visible')
        page.wait_for_timeout(600)   # font-display: swap → let fonts settle

        loaded = page.evaluate("""async () => {
          await document.fonts.load("16px 'Darkhollow Runes'", 'A');
          await document.fonts.load("16px 'Darkhollow Runes Eroded'", 'A');
          return {
            reg: document.fonts.check("16px 'Darkhollow Runes'"),
            ero: document.fonts.check("16px 'Darkhollow Runes Eroded'"),
          };
        }""")
        check('S1a both families load', loaded['reg'] and loaded['ero'], str(loaded))

        h1 = fam(page, '#title-h1')
        h2 = fam(page, '#title-h2')
        mb = fam(page, '.menu-btn')
        ts = fam(page, '.title-stats')
        check('S2a #title-h1 uses Eroded first', 'Eroded' in (h1 or ''), str(h1))
        check('S2b #title-h2/.menu-btn/.title-stats use Runes',
              all('Darkhollow Runes' in (x or '') for x in (h2, mb, ts)), f'{h2} | {mb}')
        page.screenshot(path=os.path.join(OUT, 'title.png'))

        page.click('#btn-new')
        page.click('#start-btn')
        page.wait_for_timeout(800)
        fl = fam(page, '#floor-label')
        bt = fam(page, '.bt-text')
        sf = fam(page, '#s-floor')
        check('S3 HUD (#floor-label/.bt-text/#s-floor) use Runes',
              all('Darkhollow Runes' in (x or '') for x in (fl, bt, sf)), f'{fl} | {bt}')

        # 中文位 fallback：打开记录面板（标题是中文 i18n），字体链仍含 mono
        page.keyboard.press('r')
        page.wait_for_timeout(300)
        ph2 = fam(page, '.panel h2')
        check('S4 panel h2 (Chinese title) falls through to mono stack',
              'Darkhollow Runes' in (ph2 or '') and 'JetBrains Mono' in (ph2 or ''), str(ph2))
        page.keyboard.press('Escape')
        page.wait_for_timeout(200)

        body = fam(page, 'body')
        kb = fam(page, '.kb-key')
        check('S5 negative anchors: body/.kb-key keep mono (no Runes)',
              'Darkhollow Runes' not in (body or '') and 'Darkhollow Runes' not in (kb or ''),
              f'{(body or "")[:40]}')
        page.screenshot(path=os.path.join(OUT, 'runes_hud.png'))
        browser.close()

    print()
    fails = [r for r in results if not r[1]]
    gate = not console_errors
    print(f"console errors: {len(console_errors)}" + (f" -> {console_errors[:3]}" if console_errors else ''))
    for name, ok, detail in results:
        if not ok:
            print(f"FAILED: {name} [{detail}]")
    print(f"TOTAL {len(results)-len(fails)}/{len(results)} passed, console gate {'CLEAN' if gate else 'DIRTY'}")
    sys.exit(0 if not fails and gate else 1)


if __name__ == '__main__':
    main()
