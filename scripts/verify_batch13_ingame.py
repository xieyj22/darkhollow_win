# In-game verification for feat/batch13-dpad-repeat-rm-floor (批13 手柄 D-pad
# 长按连发 + rm 换层即时化). Same-instance ESM harness (batch2-proven), zero
# console errors enforced (favicon whitelisted), fake gamepad via addInitScript
# (batch3A-proven: window.__pad + navigator.getGamepads override; the real
# 60ms pollGamepad interval drives it).
#   S1 (rm ctx) enterFloor lands instantly: live enterFloor(floor+1) returns
#      in <50ms with the floor already set and canvas opacity NEVER driven to
#      '0' — no dead black gap for reduced-motion users.
#   S2 (normal ctx) the classic fade survives: enterFloor returns with floor
#      NOT yet set + opacity '0'; ~350ms later floor is set and opacity '1'.
#   S3 (normal ctx) menu D-pad hold repeats focus: pause menu open, D-pad↓
#      held ~1.3s → focus advanced beyond the first step; held to 2.6s →
#      reaches the last menu button (btn-pause-quit).
#   S4 (normal ctx) menu D-pad tap = exactly one step: an ~80ms press (inside
#      the 480ms window) moves focus exactly once.
#   S5 (normal ctx) gameplay D-pad hold walks repeatedly: player teleported to
#      open ground, D-pad→ held 1.5s → x advanced ≥2; a tap advances exactly 1.
# Screenshots: smoke_out/batch13/{rm_floor,nm_menu_hold}.png
# Run: npm run dev -- --port 5173 --strictPort (FRESH server), then:
#      python scripts/verify_batch13_ingame.py
import io
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from playwright.sync_api import sync_playwright

BASE = 'http://localhost:5173'
OUT = os.path.join(os.path.dirname(__file__), 'smoke_out', 'batch13')
os.makedirs(OUT, exist_ok=True)

results = []
console_errors = []

PAD_INIT = """
window.__pad = { buttons: Array.from({length: 17}, () => ({ pressed: false })),
                 axes: [0, 0], mapping: 'standard', index: 0, id: 'bt13-pad' };
Object.defineProperty(navigator, 'getGamepads', { value: () => [window.__pad] });
"""


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


def hold(page, idx, ms):
    page.evaluate(f"window.__pad.buttons[{idx}].pressed = true")
    page.wait_for_timeout(ms)
    page.evaluate(f"window.__pad.buttons[{idx}].pressed = false")
    page.wait_for_timeout(120)


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel='chrome')

        # ---------- S1: reduced-motion floor entry is instant -----------------------
        ctx_rm = browser.new_context(viewport={'width': 1280, 'height': 800}, reduced_motion='reduce')
        ctx_rm.add_init_script(PAD_INIT)
        page = ctx_rm.new_page()
        arm_page(page)
        page.goto(BASE)
        page.wait_for_selector('#btn-new', state='visible')
        start_game(page)
        r1 = page.evaluate("""(async () => {
          const { G } = await import('/src/state.ts');
          const { enterFloor } = await import('/src/game.ts');
          const from = G.floor;
          const t0 = performance.now();
          enterFloor(from + 1, false);
          const dt = performance.now() - t0;
          return { dt, from, to: G.floor,
                   opacity: document.getElementById('game-canvas').style.opacity };
        })()""")
        check('S1 rm enterFloor: instant (<50ms), floor set synchronously, no opacity flash',
              r1['dt'] < 50 and r1['to'] == r1['from'] + 1 and r1['opacity'] != '0', str(r1))
        page.screenshot(path=os.path.join(OUT, 'rm_floor.png'))
        ctx_rm.close()

        # ---------- S2-S5: normal context — fade intact + D-pad repeat --------------
        ctx = browser.new_context(viewport={'width': 1280, 'height': 800}, reduced_motion='no-preference')
        ctx.add_init_script(PAD_INIT)
        page = ctx.new_page()
        arm_page(page)
        page.goto(BASE)
        page.wait_for_selector('#btn-new', state='visible')
        start_game(page)

        r2a = page.evaluate("""(async () => {
          const { G } = await import('/src/state.ts');
          const { enterFloor } = await import('/src/game.ts');
          window.__from = G.floor;
          enterFloor(window.__from + 1, false);
          return { floor: G.floor,
                   opacity: document.getElementById('game-canvas').style.opacity };
        })()""")
        page.wait_for_timeout(350)
        r2b = page.evaluate("""(async () => {
          const { G } = await import('/src/state.ts');
          return { floor: G.floor,
                   opacity: document.getElementById('game-canvas').style.opacity };
        })()""")
        check('S2 classic fade intact: deferred setup + opacity 0→1 round-trip',
              r2a['floor'] == page.evaluate('window.__from') and r2a['opacity'] == '0'
              and r2b['floor'] == (page.evaluate('window.__from') + 1) and r2b['opacity'] == '1',
              f"{r2a} -> {r2b}")

        # S3/S4: pause menu focus repeat.
        page.keyboard.press('Escape')
        page.wait_for_timeout(250)
        page.evaluate("window.__pad.buttons[12].pressed = true;")   # D-up anchors first focusable
        page.wait_for_timeout(120)
        page.evaluate("window.__pad.buttons[12].pressed = false;")
        page.wait_for_timeout(120)
        anchor = page.evaluate("document.activeElement ? document.activeElement.id || document.activeElement.className : null")
        hold(page, 13, 1300)                                         # D-down held 1.3s ≈ 21 polls
        after13 = page.evaluate("document.activeElement ? document.activeElement.id || document.activeElement.className : null")
        check('S3a D-pad↓ held 1.3s: focus advanced beyond the first step', after13 != anchor, f"{anchor} -> {after13}")
        hold(page, 13, 2600)
        last = page.evaluate("document.activeElement ? document.activeElement.id : null")
        check('S3b held to 2.6s: focus reaches the last menu button', last == 'btn-pause-quit', str(last))
        page.screenshot(path=os.path.join(OUT, 'nm_menu_hold.png'))
        # S4: tap = exactly one step. Re-anchor at the top first.
        page.evaluate("window.__pad.buttons[12].pressed = true;")
        page.wait_for_timeout(120)
        page.evaluate("window.__pad.buttons[12].pressed = false;")
        page.wait_for_timeout(400)                                   # let any stray repeat window drain
        pre = page.evaluate("document.activeElement ? document.activeElement.id || document.activeElement.className : null")
        hold(page, 13, 80)                                           # ~80ms — inside the 480ms window
        post = page.evaluate("document.activeElement ? document.activeElement.id || document.activeElement.className : null")
        check('S4 D-pad↓ tap (~80ms): exactly one focus step', pre != post, f"{pre} -> {post}")
        page.keyboard.press('Escape')                                # close pause
        page.wait_for_timeout(250)

        # S5: gameplay D-pad hold walks repeatedly.
        page.evaluate("""(async () => {
          const { G } = await import('/src/state.ts');
          const cfg = await import('/src/config.ts');
          const p = G.player;
          // Open corridor to the right of the player: no walls/enemies/items for 6 tiles.
          for (let dx = 1; dx <= 6; dx++) {
            const x = p.x + dx;
            if (x < cfg.MW) G.dungeon.map[p.y][x] = cfg.TL.FLOOR;
          }
          G.enemies = G.enemies.filter(e => Math.abs(e.y - p.y) > 1 || e.x < p.x || e.x > p.x + 7);
          G.items = G.items.filter(i => Math.abs(i.y - p.y) > 1 || i.x < p.x || i.x > p.x + 7);
          window.__px0 = p.x;
        })()""")
        hold(page, 15, 1500)                                         # D-right held 1.5s
        moved = page.evaluate("(async () => (await import('/src/state.ts')).G.player.x - window.__px0)()")
        check('S5a gameplay D-pad→ held 1.5s: player advanced ≥2 tiles', moved >= 2, f"moved {moved}")
        pre = page.evaluate("(async () => (await import('/src/state.ts')).G.player.x)()")
        hold(page, 15, 80)
        post = page.evaluate("(async () => (await import('/src/state.ts')).G.player.x)()")
        check('S5b gameplay D-pad→ tap: exactly one tile', post - pre == 1, f"{pre} -> {post}")
        ctx.close()
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
