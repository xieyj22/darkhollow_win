# In-game verification for feat/batch4-breakage (批4, T6).
# Runs against the Vite DEV server so page.evaluate can `import('/src/*.ts')`
# and get the SAME live module instances the game loop uses (batch2/3B/3C-proven
# harness; same-instance ESM injection dodges the HMR '?t=' second-instance
# trap). Four scenarios, one per batch4 fix, all through the real code paths:
#   1  P1 eventFlags save roundtrip: flag a once-site -> autoSave -> reload ->
#      #btn-cont Continue -> flag survives in G AND eligibleEventSites(G.floor)
#      excludes it (non-vacuous: floor pinned to 10 so every site is in range,
#      sealed_box must still be present)
#   2  quit-to-title clears UI: queueMechanicIntro('fungal') card OPEN -> real
#      openPause() -> #btn-pause-quit (confirm auto-accepted) -> no .overlay
#      .active left, introOpen false, WASD on the title screen raises no
#      console/page errors (the swallowed-input freeze), #event-popup hidden
#   3  death screen not covered: queueMechanicIntro('corruption') card OPEN ->
#      combat.playerDeath('test') -> #item-intro-overlay loses .active (the
#      z-1100 cover bug), #death-screen visible
#   4  localized teleport float: setLang('en') -> real useItem() on an injected
#      Scroll of Teleport (built exactly like item-gen genScroll's output) ->
#      the ⚡ float reads '⚡Teleport' with zero CJK; then setLang('zh') ->
#      '⚡传送' (the old bug was hardcoded zh text under the EN UI)
#   +  0 console/page errors for the whole session (favicon 404 whitelisted,
#      console + response double handler; dialogs accepted BEFORE first confirm)
# Mechanic cards are once-per-career in MetaSave.seenMechanics, so each queue
# is preceded by a scrub (splice + saveMeta) to stay deterministic across
# reruns on a warm profile.
# Run: npm run dev -- --port 5173 --strictPort (FRESH server), then:
#      python scripts/verify_batch4_ingame.py
import io
import json
import os
import re
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from playwright.sync_api import sync_playwright

BASE = 'http://localhost:5173'
OUT = os.path.join(os.path.dirname(__file__), 'smoke_out', 'batch4')
CJK = re.compile(r'[㐀-䶿一-鿿]')

results = []
console_errors = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ''))


def start_game(page):
    page.click('#btn-new')
    page.click('#start-btn')
    page.wait_for_timeout(700)
    assert page.evaluate("document.getElementById('game-container').style.display") == 'flex'


# Scrub a mechanic card's once-per-career flag so queueMechanicIntro is
# deterministic even on a localStorage-warm profile / rerun.
def scrub_mechanic(page, mid):
    page.evaluate("""async (mid) => {
        const meta = await import('/src/meta.ts');
        const m = meta.getMeta();
        const i = m.seenMechanics.indexOf(mid);
        if (i >= 0) { m.seenMechanics.splice(i, 1); meta.saveMeta(m); }
    }""", mid)


def overlay_active(page, oid):
    return page.evaluate(
        "(id) => { const el = document.getElementById(id); return !!el && el.classList.contains('active'); }", oid)


def intro_open(page):
    # ESM live binding — re-importing the same URL returns the same module
    # instance, so .introOpen reads the CURRENT value of state.ts's `let`.
    return page.evaluate("async () => (await import('/src/state.ts')).introOpen")


def main():
    os.makedirs(OUT, exist_ok=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel='chrome', headless=True)
        page = browser.new_page()
        # favicon 404s are dev-server noise (see verify_reconnect_ingame.py) —
        # console + response double handler, both whitelisting it.
        page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' and 'favicon' not in (m.location or {}).get('url', '') else None)
        page.on('response', lambda r: print(f'    [404] {r.url}') if r.status == 404 and 'favicon' not in r.url else None)
        page.on('pageerror', lambda e: console_errors.append(str(e)))
        # Dialogs auto-accepted BEFORE anything can fire one (batch2 pit) —
        # #btn-pause-quit fires confirm(t('quitConfirm')).
        page.on('dialog', lambda dlg: dlg.accept())
        page.goto(BASE)
        page.wait_for_timeout(1200)

        # ============ 1: P1 eventFlags save roundtrip ============
        print('[1] eventFlags roundtrip: once-site flag survives save/reload/Continue')
        start_game(page)
        saved = page.evaluate("""async () => {
            const st = await import('/src/state.ts');
            const save = await import('/src/save.ts');
            st.G.floor = 10;                                  // every site's minFloor met
            st.G.eventFlags = { ...(st.G.eventFlags || {}), cursed_altar: true };
            save.autoSave();
            return { flag: (JSON.parse(localStorage.getItem('dh_save')).eventFlags || {}).cursed_altar,
                     floor: JSON.parse(localStorage.getItem('dh_save')).floor };
        }""")
        check('1a autoSave wrote eventFlags.cursed_altar into dh_save', saved['flag'] is True,
              f"saved flag={saved['flag']} floor={saved['floor']}")
        page.reload()
        page.wait_for_timeout(1200)
        page.click('#btn-cont')
        page.wait_for_timeout(800)
        check('1b Continue re-enters the game (game-container flex)',
              page.evaluate("document.getElementById('game-container').style.display") == 'flex')
        loaded = page.evaluate("""async () => {
            const st = await import('/src/state.ts');
            const es = await import('/src/event-sites.ts');
            return { flag: st.G.eventFlags ? st.G.eventFlags.cursed_altar : undefined,
                     floor: st.G.floor,
                     ids: es.eligibleEventSites(st.G.floor).map(s => s.id) };
        }""")
        check('1c loaded G.eventFlags.cursed_altar === true (no re-farmable once-site)',
              loaded['flag'] is True, f"flag={loaded['flag']}")
        check('1d eligibleEventSites excludes cursed_altar (and is non-vacuous)',
              loaded['floor'] == 10 and 'cursed_altar' not in loaded['ids'] and 'sealed_box' in loaded['ids'],
              f"floor={loaded['floor']} ids={loaded['ids']}")

        # ============ 2: quit-to-title clears transient UI ============
        print('[2] quit-to-title: intro card + pause cleared, title keys not swallowed')
        scrub_mechanic(page, 'fungal')
        page.evaluate("async () => { const ii = await import('/src/item-intro.ts'); ii.queueMechanicIntro('fungal'); }")
        page.wait_for_timeout(250)   # showOverlay adds .active in a rAF
        check('2a setup: fungal mechanic intro card is open (#item-intro-overlay.active)',
              overlay_active(page, 'item-intro-overlay') and intro_open(page))
        page.evaluate("async () => { const u = await import('/src/ui-panels.ts'); u.openPause(); }")
        page.wait_for_timeout(150)
        check('2b setup: pause menu open with the intro still queued beneath it',
              overlay_active(page, 'pause-overlay') and overlay_active(page, 'item-intro-overlay'))
        errs_before = len(console_errors)
        page.click('#btn-pause-quit')   # confirm() auto-accepted -> closePause + returnToTitle
        page.wait_for_timeout(700)
        leftover = page.evaluate("Array.from(document.querySelectorAll('.overlay.active')).map(e => e.id)")
        check('2c no .overlay.active remains after quit-to-title', not leftover, f"leftover={leftover}")
        check('2d introOpen flag cleared (no swallowed-input residue)', intro_open(page) is False)
        check('2e back on the title screen (game-container hidden)',
              page.evaluate("document.getElementById('game-container').style.display") == 'none'
              and page.evaluate("document.getElementById('title-screen').style.display") == 'flex')
        for k in ('w', 'a', 's', 'd', 'w'):
            page.keyboard.press(k)
            page.wait_for_timeout(120)
        check('2f WASD on the title screen raises zero console/page errors',
              len(console_errors) == errs_before,
              f"errors_before={errs_before} after={len(console_errors)}")
        check('2g #event-popup stays hidden (no phantom event window)',
              page.evaluate("(() => { const el = document.getElementById('event-popup'); return !el || el.offsetParent === null; })()"))

        # ============ 3: death screen not covered by intro ============
        print('[3] playerDeath: queued intro card does not cover the death screen')
        start_game(page)
        scrub_mechanic(page, 'corruption')
        page.evaluate("async () => { const ii = await import('/src/item-intro.ts'); ii.queueMechanicIntro('corruption'); }")
        page.wait_for_timeout(250)
        check('3a setup: corruption mechanic intro card is open',
              overlay_active(page, 'item-intro-overlay') and intro_open(page))
        page.evaluate("async () => { const cb = await import('/src/combat.ts'); cb.playerDeath('test'); }")
        page.wait_for_timeout(500)
        check('3b #item-intro-overlay dropped .active on death (no z-1100 cover)',
              not overlay_active(page, 'item-intro-overlay'))
        check('3c #death-screen visible',
              page.evaluate("document.getElementById('death-screen').style.display") == 'flex')
        check('3d introOpen false after playerDeath', intro_open(page) is False)

        # ============ 4: localized teleport float ============
        print('[4] teleport scroll float: EN reads Teleport, zh reads 传送')
        page.click('#btn-try-again')   # startNewGame from the death screen
        page.click('#start-btn')
        page.wait_for_timeout(700)
        assert page.evaluate("document.getElementById('game-container').style.display") == 'flex'
        USE_TP = """async (lang) => {
            const st = await import('/src/state.ts');
            const items = await import('/src/items.ts');
            const d = await import('/src/data.ts');
            const i18n = await import('/src/i18n.ts');
            st.setLang(lang);
            st.G.enemies = [];
            st.G.player.mp = 50;
            // Mirror item-gen genScroll's output for the teleport def exactly
            // (val 0 at any floor: b.v === 0) — a real Item, not a stub.
            const b = d.ALL_SCROLLS.find(s => s.id === 'teleport_scroll');
            st.G.player.inv.push({ type: 'scroll', id: b.id, name: i18n.itemName(b), ef: b.ef,
                                   val: 0, dur: 0, rarity: 1, ch: b.ch, c: b.c,
                                   desc: i18n.t('ig.teleport'), x: 0, y: 0, subType: b.subType });
            const before = { x: st.G.player.x, y: st.G.player.y };
            items.useItem(st.G.player.inv.length - 1);
            return { before, after: { x: st.G.player.x, y: st.G.player.y },
                     // .ft floats self-remove after 1200ms — read synchronously
                     fts: Array.from(document.querySelectorAll('.ft')).map(e => e.textContent || '') };
        }"""
        en = page.evaluate(USE_TP, 'en')
        bolts = [f for f in en['fts'] if f.startswith('⚡')]
        check('4a teleport moved the player (scroll branch really ran)',
              (en['after']['x'], en['after']['y']) != (en['before']['x'], en['before']['y']),
              f"{en['before']} -> {en['after']}")
        check("4b EN float reads '⚡Teleport'", any('Teleport' in f for f in bolts), f"bolts={bolts}")
        check('4c EN float has zero CJK characters', not any(CJK.search(f) for f in bolts), f"bolts={bolts}")
        zh = page.evaluate(USE_TP, 'zh')
        bolts_zh = [f for f in zh['fts'] if f.startswith('⚡')]
        check("4d zh float reads '⚡传送' (localization is live, not hardcoded)",
              any('传送' in f for f in bolts_zh), f"bolts={bolts_zh}")
        page.screenshot(path=os.path.join(OUT, 'end_state.png'))

        browser.close()

    fails = [r for r in results if not r[1]]
    print(f"\nTotal {len(results)} checks, {len(fails)} failed")
    print(f"Console errors: {len(console_errors)}")
    for e in console_errors[:10]:
        print('  ERR:', e[:200])
    with open(os.path.join(OUT, 'verify_batch4_results.json'), 'w', encoding='utf-8') as f:
        json.dump({'checks': results, 'console_errors': console_errors}, f, ensure_ascii=False, indent=1)
    sys.exit(1 if fails or console_errors else 0)


if __name__ == '__main__':
    main()
