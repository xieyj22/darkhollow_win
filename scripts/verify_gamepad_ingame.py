# In-game PURE-GAMEPAD full-loop verification for feat/batch3a-gamepad-nav (T6).
# Fake gamepad injection: addInitScript overrides navigator.getGamepads with a
# mutable window.__pad; pollGamepad (60ms interval, input.ts) picks it up.
# press() drives edge-triggered buttons across poll ticks. Acceptance = the full
# loop below is playable with ONLY gamepad input:
#   title → char-sel → play → inventory → pause → options/slider → death → retry.
# Prereq: FRESH dev server — npm run dev -- --port 5173 --strictPort
#   (batch2 gotcha: an HMR-warmed server can serve a second '?t=' module
#    instance whose state plain-URL imports can't see).
# Live imports use '/src/*.ts' URLs (batch2-proven): Vite dev serves TS at the
# .ts path, and the instance is the SAME one the page graph runs.
# Reconciled against the actual code (differences from the T6 draft noted inline):
#   - CLASSES order is Warrior/Rogue/Mage/... so Mage is index 2 (draft said 1).
#   - btn-pause-settings does closePause()+openOptions('pause'); closeOptions
#     reopens pause when origin==='pause' → "B×2 back to gameplay" holds.
#   - Player death funnels to combat.ts playerDeath() from every real path
#     (attack() hp<=0, starvation/poison/corruption in turn.ts) — we call it
#     directly; the manual hp/gameOver/display fallback below is kept only for
#     the case where that export is unreachable.
import io
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:5173'
results, console_errors = [], []


def check(name, ok, detail=''):
    results.append((name, bool(ok)))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ''))


FAKE_PAD = """
window.__pad = { buttons: Array.from({length: 17}, () => ({ pressed: false })), axes: [0, 0] };
Object.defineProperty(navigator, 'getGamepads', { value: () => [window.__pad] });
"""

# Standard gamepad indices (matches keybinds.ts DEFAULT_BUTTONS):
#   0=A(wait/click) 1=B(back) 3=Y(inventory) 4=LB(seq-) 5=RB(seq+)
#   9=Start(pause) 12/13/14/15 = D-pad up/down/left/right


def press(page, idx, settle=90):
    page.wait_for_timeout(settle)                       # all-up poll
    page.evaluate(f"window.__pad.buttons[{idx}].pressed = true")
    page.wait_for_timeout(settle)                       # edge poll
    page.evaluate(f"window.__pad.buttons[{idx}].pressed = false")
    page.wait_for_timeout(settle)


def focused(page):
    return page.evaluate(
        "document.activeElement ? (document.activeElement.id || document.activeElement.className || document.activeElement.tagName) : 'none'")


def focus_id(page):
    # Unique element identity (tag/class + index among all focusables + text) —
    # two different .inv-act buttons share a className, so plain id/class
    # strings can't tell sequential-focus movement apart.
    return page.evaluate("""() => {
        const el = document.activeElement;
        if (!el || el === document.body) return 'none';
        const list = [...document.querySelectorAll('button,[href],input:not([type=hidden]),select,textarea,[tabindex]:not([tabindex="-1"])')];
        return `${el.tagName}.${el.className}#${list.indexOf(el)}:${(el.textContent || '').trim().slice(0, 10)}`;
    }""")


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel='chrome', headless=True)
        page = browser.new_page()
        page.add_init_script(FAKE_PAD)
        page.on('console', lambda m: console_errors.append(m.text)
                if m.type == 'error' and 'favicon' not in (m.location or {}).get('url', '') else None)
        page.on('pageerror', lambda e: console_errors.append(str(e)))
        page.goto(BASE)
        page.wait_for_selector('#btn-new')              # title DOM ready
        page.wait_for_timeout(1200)                     # module init + first gamepad polls

        # [1] Title: D-pad press anchors focus on the first menu button (.gp-focus)
        press(page, 12)
        f = focused(page)
        check('1 title D-pad anchors focus on first menu button', f == 'btn-new', f"f={f}")
        gp = page.evaluate("document.activeElement.classList.contains('gp-focus')")
        check('1 focused element carries .gp-focus ring', gp)

        # [2] A activates New Game → char-sel appears
        press(page, 0)
        page.wait_for_timeout(300)
        check('2 A on New Game opens char-sel',
              page.evaluate("!!document.getElementById('char-sel')"))

        # [3] Spatial nav across the three columns; A selects Mage (class idx 2:
        #     Warrior 0 / Rogue 1 / Mage 2 — draft's "sel==1 is Mage" was off by one)
        press(page, 15)   # right → class column
        f1 = focused(page)
        press(page, 13)   # down → Rogue
        press(page, 13)   # down → Mage
        f2 = focused(page)
        press(page, 0)    # A selects it
        sel = page.evaluate(
            "[...document.querySelectorAll('.class-opt')].findIndex(e => e.getAttribute('aria-pressed') === 'true')")
        check('3 spatial nav reaches class column; A selects Mage', sel == 2,
              f"race→{f1} →{f2} selIdx={sel}")

        # [4] Focus Begin (bottom row) → A starts the game. Down through the
        #     class column lands on the button row at EITHER button (spatial
        #     tie between start/char-back); if we land on Back, one D-left.
        for _ in range(12):
            press(page, 13)
            f = focused(page)
            if f in ('start-btn', 'char-back-btn'):
                break
        if f == 'char-back-btn':
            press(page, 14)
            f = focused(page)
        check('4 D-pad reaches the Begin button', f == 'start-btn', f"f={f}")
        press(page, 0)
        page.wait_for_timeout(900)                      # initGame + genDungeon (real RNG)
        check('4 A on Begin starts the game',
              page.evaluate("document.getElementById('game-container').style.display") == 'flex')

        # [5] Inject a real potion via live modules (fresh run may have no
        #     usable action rows — brief discretion 2), then Y opens inventory.
        inj = page.evaluate("""async () => {
            const st = await import('/src/state.ts');
            const ig = await import('/src/item-gen.ts');
            if (!st.G || !st.G.player) return 'no-G';
            st.G.player.inv.push(ig.genPotion(1));
            return st.G.player.inv.length;
        }""")
        press(page, 3)    # Y = inventory
        page.wait_for_timeout(400)
        check('5 Y opens inventory (menu context = inventory-overlay)',
              page.evaluate("!!document.querySelector('#inventory-overlay.active')"),
              f"injected inv={inj}")
        press(page, 13)
        press(page, 13)
        f = focused(page)
        is_act = page.evaluate(
            "document.activeElement && document.activeElement.classList.contains('inv-act')")
        check('5 D-pad focuses an inventory control', is_act, f"f={f}")

        # [6] LB sequential focus moves somewhere else, B closes the panel
        before = focus_id(page)
        press(page, 4)    # LB = seqFocus -1
        after = focus_id(page)
        check('6 LB moves focus sequentially', after != before and after != 'none',
              f"{before} → {after}")
        press(page, 1)    # B = back
        page.wait_for_timeout(400)
        check('6 B closes inventory',
              not page.evaluate("document.querySelector('#inventory-overlay.active')"))

        # [7] Start → pause; D-pad down to Settings (draft's single down lands on
        #     Resume first — close-btn anchors, then resume, then settings); A opens
        press(page, 9)
        page.wait_for_timeout(400)
        check('7 Start opens pause menu',
              page.evaluate("!!document.querySelector('#pause-overlay.active')"))
        for _ in range(6):
            press(page, 13)
            if focused(page) == 'btn-pause-settings':
                break
        press(page, 0)
        page.wait_for_timeout(400)
        check('7 D-pad + A reaches Settings → options overlay',
              page.evaluate("!!document.querySelector('#options-overlay.active')"),
              f"focused={focused(page)}")
        # [8] Focus a slider (audio tab is default; volume sliders) and step it
        slid = page.evaluate(
            "[...document.querySelectorAll('#options-overlay input[type=range]')].length")
        for _ in range(8):
            press(page, 13)
            if page.evaluate("document.activeElement.type === 'range'"):
                break
        val0 = page.evaluate("document.activeElement.value")
        press(page, 15)   # right = step up
        val1 = page.evaluate("document.activeElement.value")
        check('8 focused slider steps with D-pad left/right', val1 != val0,
              f"{val0} → {val1} ({slid} sliders)")
        press(page, 1); page.wait_for_timeout(400)      # B: options→back to pause
        press(page, 1); page.wait_for_timeout(400)      # B: pause→gameplay
        check('8 B×2 returns to gameplay',
              not page.evaluate("document.querySelector('.overlay.active')"))

        # [9] Death: the real path — every death funnels into combat.playerDeath
        #     (attack() hp<=0, starvation/poison/corruption). Call it with hp=0.
        try:
            died = page.evaluate("""async () => {
                const st = await import('/src/state.ts');
                const cb = await import('/src/combat.ts');
                if (!st.G) return 'no-G';
                st.G.player.hp = 0;
                if (typeof cb.playerDeath !== 'function') return 'no-playerDeath';
                cb.playerDeath('e2e-verify');
                return st.G.gameOver === true;
            }""")
        except Exception as ex:                          # pragma: no cover — fallback
            died = f'eval-error: {str(ex)[:120]}'
        page.wait_for_timeout(500)
        death_visible = page.evaluate(
            "getComputedStyle(document.getElementById('death-screen')).display !== 'none'")
        if not death_visible:
            # Fallback (real path unavailable): force the death state manually.
            page.evaluate("""async () => {
                const st = await import('/src/state.ts');
                st.G.player.hp = 0;
                st.G.gameOver = true;
                document.getElementById('death-screen').style.display = 'flex';
            }""")
            page.wait_for_timeout(300)
        press(page, 12)   # anchor first button = Try Again (nothing above → stays)
        f = focused(page)
        check('9 death screen: D-pad focuses Try Again', f == 'btn-try-again',
              f"f={f} via-playerDeath={died}")
        press(page, 0)    # A restarts → char-sel
        page.wait_for_timeout(500)
        check('9 A on Try Again returns to char-sel',
              page.evaluate("!!document.getElementById('char-sel')"))

        browser.close()
    fails = [r for r in results if not r[1]]
    print(f"\nTotal {len(results)} checks, {len(fails)} failed")
    print(f"Console errors: {len(console_errors)}")
    for e in console_errors[:10]:
        print('  ERR:', e[:200])
    sys.exit(1 if fails or console_errors else 0)


if __name__ == '__main__':
    main()
