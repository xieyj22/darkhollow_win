# Smoke test for feat/settings-core (B-core) — 6 user-facing scenarios.
# Covers: ①4-tab schema+desc+reset-defaults ②Keybinds capture/conflict/reset
# ③rebind takes effect in gameplay ④overlay_close rebind consistency
# ⑤12 overlays no regression ⑥mute single source of truth.
# Task 6 (settings-surface): + SURF block (hc / textScale slider / tablist aria /
# arrow-nav / tab icons) + screenshot matrix (options tabs / hc on / forge /
# radius-lg-affected surfaces: .tb touch buttons, #event-popup, .talent-cell).
# Run: npm run build && start preview on :4173 ("npm run preview -- --port 4173 --strictPort"),
#      then: python scripts/smoke_settings_core.py  (expects the server up; uses system Chrome)
import io
import json
import re
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from playwright.sync_api import sync_playwright

BASE = 'http://localhost:4173'
OUT = 'scripts/smoke_out'
results = []          # (scenario, check, ok, detail)
console_errors = []


def check(scenario, name, ok, detail=''):
    results.append((scenario, name, bool(ok), detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ''))


def overlay_active(page, oid):
    return page.evaluate(
        "id => { const el = document.getElementById(id); return !!(el && el.classList.contains('active') && getComputedStyle(el).display !== 'none'); }",
        oid)


def start_game(page):
    """New Game -> default race/class/mode -> Begin."""
    page.click('#btn-new')
    page.click('#start-btn')
    page.wait_for_timeout(600)
    assert page.evaluate("document.getElementById('game-container').style.display") == 'flex'


def open_options(page):
    page.click('#btn-options')
    page.wait_for_timeout(150)
    assert overlay_active(page, 'options-overlay')


def click_tab(page, tab_id):
    page.click(f'.opt-tab[data-tab="{tab_id}"]')
    page.wait_for_timeout(120)


def open_overlay_via(page, oid):
    """Open each overlay the way a player would (key or button)."""
    key_map = {
        'inventory-overlay': 'i', 'help-overlay': '?', 'skill-overlay': 'k',
        'achievement-overlay': 't', 'talent-overlay': 'n',
        'pause-overlay': 'Escape',
    }
    btn_map = {
        'forge-overlay': '#btn-forge', 'records-overlay': '#btn-records',
        'codex-overlay': '#btn-codex',
    }
    if oid in key_map:
        page.keyboard.press(key_map[oid])
    else:
        page.click(btn_map[oid])
    page.wait_for_timeout(200)


def main():
    with sync_playwright() as p:
        # Use system Chrome (CDN download stalls on CN network).
        browser = p.chromium.launch(headless=True, channel='chrome')
        page = browser.new_page(viewport={'width': 1280, 'height': 800})
        # favicon.ico 404 is expected under vite preview (no icon shipped) —
        # whitelist it so console_errors can gate the CI exit code honestly.
        # NB: the console-error text ("Failed to load resource: …404") does NOT
        # contain "favicon"; the URL lives in m.location.
        page.on('console', lambda m: console_errors.append(f'{m.text} :: {m.location.get("url", "?")}') if m.type == 'error' and 'favicon' not in m.text and 'favicon' not in (m.location.get('url') or '') else None)
        page.on('response', lambda r: console_errors.append(f'HTTP {r.status} {r.url}') if r.status >= 400 and 'favicon' not in r.url else None)
        page.on('pageerror', lambda e: console_errors.append(str(e)))
        # auto-accept native confirm() dialogs (reset + conflict alerts)
        page.on('dialog', lambda d: d.accept())

        page.goto(BASE)
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(800)
        start_game(page)

        # ============ Scenario ① 4 schema tabs + row desc + reset defaults ============
        print('\n== S1: schema tabs / desc / reset defaults ==')
        open_options(page)
        tabs = page.eval_on_selector_all('.opt-tab', 'els => els.map(e => e.dataset.tab)')
        check('S1', '5 tabs present (4 schema + keybinds)', tabs == ['audio', 'display', 'access', 'game', 'keybinds'], str(tabs))

        # audio: 4 rows (mute toggle + 3 sliders), no desc by design
        rows = page.eval_on_selector_all('#opt-body .opt-row', 'els => els.length')
        check('S1', 'audio tab 4 rows (mute/master/music/sfx)', rows == 4, f'{rows}')
        mute_cb = page.query_selector('#opt-body input[type="checkbox"][data-optkey="mute"]')
        check('S1', 'mute toggle rendered', mute_cb is not None)
        sliders = page.eval_on_selector_all('#opt-body input[type="range"][data-optkey]',
                                             'els => els.map(e => e.dataset.optkey)')
        check('S1', 'audio sliders master/music/sfx', sliders == ['master', 'music', 'sfx'], str(sliders))

        # display: 5 rows; safeZone carries a desc
        click_tab(page, 'display')
        rows = page.eval_on_selector_all('#opt-body .opt-row', 'els => els.length')
        row_labels = page.eval_on_selector_all('#opt-body .opt-label', "els => els.map(e => e.textContent.slice(0,30))")
        has_fs = page.query_selector('#opt-body [data-extra="fullscreen"]') is not None
        check('S1', 'display tab = 5 schema rows + fullscreen extra', rows == 6 and has_fs, f'{rows} labels={row_labels}')
        fs_switch = page.eval_on_selector('#opt-body [data-extra="fullscreen"]',
            'el => el.getAttribute("role") === "switch" && el.getAttribute("aria-checked") === "false" && !!el.getAttribute("aria-label")')
        check('S1', 'fullscreen extra = switch with aria state/label', fs_switch)
        n_desc = page.eval_on_selector_all('#opt-body .opt-desc', 'els => els.length')
        check('S1', 'display rows with desc (safeZone)', n_desc >= 1, f'{n_desc}')

        # access: 5 rows (was 4 before settings-surface Task 1 added the hc
        # toggle: motion / shake / colorblind / barCues / hc); reducedMotion
        # desc + shake disabled-when guard
        click_tab(page, 'access')
        rows = page.eval_on_selector_all('#opt-body .opt-row', 'els => els.length')
        check('S1', 'access tab 5 rows (4 + hc)', rows == 5, f'{rows}')
        guard_off = page.eval_on_selector_all(
            "#opt-body .opt-row.disabled input[data-optkey='shake']", 'els => els.length')
        check('S1', 'shake slider NOT disabled when motion on', guard_off == 0)

        # game tab: intro toggle + desc
        click_tab(page, 'game')
        has_intro = page.query_selector('#opt-body input[type="checkbox"][data-optkey="introEnabled"]')
        check('S1', 'game tab intro toggle', has_intro is not None)
        n_desc = page.eval_on_selector_all('#opt-body .opt-desc', 'els => els.length')
        check('S1', 'game tab desc present', n_desc >= 1, f'{n_desc}')
        has_lk = page.query_selector('#opt-body [data-extra="legend"]') is not None and page.query_selector('#opt-body [data-extra="keys"]') is not None
        check('S1', 'game tab legend/keys extras rendered', has_lk)
        lk_switch = page.eval_on_selector_all('#opt-body [data-extra="legend"], #opt-body [data-extra="keys"]',
            'els => els.length === 2 && els.every(e => e.getAttribute("role") === "switch" && !!e.getAttribute("aria-label"))')
        check('S1', 'legend/keys extras = switches with aria labels', lk_switch)

        # reset defaults: dirty every mutable setting, then #opt-reset restores
        click_tab(page, 'audio')
        page.evaluate("""() => {
          const set = (k, v) => { const el = document.querySelector(`[data-optkey="${k}"]`); if (!el) throw new Error('missing ' + k); el.value = v; el.dispatchEvent(new Event('input')); };
          set('master', 20); set('music', 10); set('sfx', 30);
        }""")
        page.click('#opt-reset')
        page.wait_for_timeout(200)
        click_tab(page, 'audio')
        vals = page.eval_on_selector_all('#opt-body input[type="range"][data-optkey]',
                                          'els => els.map(e => e.value)')
        stored = page.evaluate("localStorage.getItem('dh_vol_master')")
        check('S1', 'reset restores default volumes', vals == ['0.9', '0.45', '0.9'], str(vals))
        check('S1', 'reset persists to localStorage', stored == '0.9', str(stored))

        # minimap POST_CHANGE hook: seg change keeps minimap canvas wired
        click_tab(page, 'display')
        page.click("#opt-body .seg[data-optkey='minimap'] [data-seg='3']")
        page.wait_for_timeout(200)
        ok = page.evaluate("!!document.getElementById('minimap-canvas')")
        stored_mm = page.evaluate("localStorage.getItem('dh_minimap_scale')")
        check('S1', 'minimap seg change persists (POST_CHANGE no crash)', ok and stored_mm == '3', str(stored_mm))
        page.click("#opt-body .seg[data-optkey='minimap'] [data-seg='2']")  # restore

        # capture-cancel safety: reset hides on keybinds tab
        page.click('.opt-tab[data-tab="keybinds"]')
        page.wait_for_timeout(100)
        vis = page.evaluate("() => { const b = document.getElementById('opt-reset'); return b && b.offsetParent !== null; }")
        check('S1', 'schema reset hidden on keybinds tab', not vis)

        # ---- Task 6 SURF assertions (settings-surface: hc / textScale / aria / arrow-nav / icons) ----
        print('\n== SURF: hc / textScale slider / tablist aria / arrow nav / tab icons ==')
        # (a) hc toggle on access tab: rendered, persists dh_hc=1 + body.hc, restores off
        click_tab(page, 'access')
        hc_cb = page.query_selector('#opt-body input[data-optkey="hc"]')
        check('SURF', 'hc toggle rendered on access tab', hc_cb is not None)
        if hc_cb:
            page.click('#opt-body input[data-optkey="hc"]')
            page.wait_for_timeout(150)
            ls_hc = page.evaluate("localStorage.getItem('dh_hc')")
            body_hc = page.evaluate("document.body.classList.contains('hc')")
            check('SURF', 'hc toggle persists dh_hc=1 + body.hc', ls_hc == '1' and body_hc, f'ls={ls_hc} body={body_hc}')
            page.click('#opt-body input[data-optkey="hc"]')  # restore off
            page.wait_for_timeout(150)
        # (b) textScale is a continuous slider (85%-150%), drives --fs-scale live
        click_tab(page, 'display')
        ts_is_slider = page.query_selector('#opt-body input[type="range"][data-optkey="textScale"]') is not None
        check('SURF', 'textScale rendered as slider (was 3-tier seg)', ts_is_slider)
        ts_attrs = page.evaluate("""() => {
          const el = document.querySelector('[data-optkey="textScale"]');
          return el ? {min: el.min, max: el.max, step: el.step} : {};
        }""")
        check('SURF', 'textScale slider range 0.85–1.5 step 0.05',
              ts_attrs.get('min') == '0.85' and ts_attrs.get('max') == '1.5' and ts_attrs.get('step') == '0.05', str(ts_attrs))
        page.evaluate("""() => { const el = document.querySelector('[data-optkey="textScale"]'); el.value = 1.5; el.dispatchEvent(new Event('input')); }""")
        page.wait_for_timeout(150)
        fs = page.evaluate("document.documentElement.style.getPropertyValue('--fs-scale')")
        check('SURF', 'textScale slider 1.5 → --fs-scale=1.5', fs.strip() in ('1.5', '1.50'), str(fs))
        ls_ts = page.evaluate("localStorage.getItem('dh_text_scale')")
        check('SURF', 'textScale persists dh_text_scale=1.5', ls_ts is not None and abs(float(ls_ts) - 1.5) < 1e-9, str(ls_ts))
        page.evaluate("""() => { const el = document.querySelector('[data-optkey="textScale"]'); el.value = 1; el.dispatchEvent(new Event('input')); }""")
        page.wait_for_timeout(150)
        # (c) tablist aria: role=tab + aria-selected on tabs, tabpanel on #opt-body
        aria_ok = page.evaluate("""() => {
          const a = document.querySelector('.opt-tab.active');
          return !!(a && a.getAttribute('role') === 'tab' && a.getAttribute('aria-selected') === 'true'
            && document.getElementById('opt-body').getAttribute('role') === 'tabpanel');
        }""")
        check('SURF', 'tablist aria (tab/aria-selected/tabpanel)', aria_ok)
        # (d) tab icons: every tab label carries its emoji prefix
        icons = page.eval_on_selector_all('.opt-tab', 'els => els.map(e => e.textContent.trim().slice(0,2))')
        check('SURF', 'tabs carry icons', all(any(i in t for i in ['🔊', '🖥', '♿', '⚔', '⌨']) for t in icons), str(icons))
        # (e) arrow-key tab traversal. NOTE: the handler is a CONTAINER onkeydown —
        # dispatching KeyboardEvent via evaluate works (bubbles to #opt-tabs), but
        # element.focus() inside evaluate does NOT move document.activeElement in
        # the same tick it returns. The handler looks up document.activeElement,
        # so evaluate-focus + dispatch in ONE call risks reading stale focus.
        # Two steps: (1) real .focus() via evaluate, (2) dispatch keydown in a
        # separate evaluate after a settle wait. Active tab flips via next.click().
        page.click('.opt-tab[data-tab="audio"]')
        page.wait_for_timeout(120)
        page.evaluate("() => document.querySelector('.opt-tab[data-tab=\"audio\"]').focus()")
        page.wait_for_timeout(80)
        page.evaluate("""() => {
          document.querySelector('.opt-tab[data-tab="audio"]')
            .dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}));
        }""")
        page.wait_for_timeout(150)
        active_tab = page.evaluate("() => document.querySelector('.opt-tab.active').dataset.tab")
        check('SURF', 'ArrowRight activates next tab (audio→display)', active_tab == 'display', str(active_tab))
        # wrap last→first: focus keybinds (last), ArrowRight wraps to audio
        page.evaluate("() => document.querySelector('.opt-tab[data-tab=\"keybinds\"]').focus()")
        page.wait_for_timeout(80)
        page.evaluate("""() => {
          document.querySelector('.opt-tab[data-tab="keybinds"]')
            .dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}));
        }""")
        page.wait_for_timeout(150)
        active_tab = page.evaluate("() => document.querySelector('.opt-tab.active').dataset.tab")
        check('SURF', 'ArrowRight wraps last→first (keybinds→audio)', active_tab == 'audio', str(active_tab))
        # wrap first→last: focus audio (first), ArrowLeft wraps to keybinds
        page.evaluate("() => document.querySelector('.opt-tab[data-tab=\"audio\"]').focus()")
        page.wait_for_timeout(80)
        page.evaluate("""() => {
          document.querySelector('.opt-tab[data-tab="audio"]')
            .dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft', bubbles: true}));
        }""")
        page.wait_for_timeout(150)
        active_tab = page.evaluate("() => document.querySelector('.opt-tab.active').dataset.tab")
        check('SURF', 'ArrowLeft wraps first→last (audio→keybinds)', active_tab == 'keybinds', str(active_tab))
        # back to a schema tab for the S6 section that follows
        page.click('.opt-tab[data-tab="audio"]')
        page.wait_for_timeout(100)

        # ============ Scenario ⑥ mute single source ============
        # (run before rebinding pollutes anything)
        print('\n== S6: mute single source ==')
        open_game_options = overlay_active(page, 'options-overlay')
        # toggle via schema audio tab
        click_tab(page, 'audio')
        page.click('#opt-body input[data-optkey="mute"]')
        page.wait_for_timeout(150)
        ls_muted = page.evaluate("localStorage.getItem('dh_muted')")
        check('S6', 'schema mute persists dh_muted=1', ls_muted == '1', str(ls_muted))
        # 'm' key dispatches same source
        page.keyboard.press('Escape')  # close options
        page.wait_for_timeout(150)
        page.keyboard.press('m')       # unmute via keybind
        page.wait_for_timeout(150)
        ls_muted = page.evaluate("localStorage.getItem('dh_muted')")
        check('S6', "key 'm' unmutes same source (dh_muted=0)", ls_muted == '0', str(ls_muted))

        # ============ Scenario ② Keybinds tab: capture / conflict / reset ============
        print('\n== S2: keybinds capture / conflict / reset ==')
        open_options(page)
        page.click('.opt-tab[data-tab="keybinds"]')
        page.wait_for_timeout(150)
        n_rebind = page.eval_on_selector_all('[data-rebind]', 'els => els.length')
        check('S2', '27 rebindable actions rendered', n_rebind == 27, f'{n_rebind}')
        multi = page.evaluate(
            "() => {"
            "  const row = [...document.querySelectorAll('#opt-body .opt-row')].find(r => r.textContent.includes('Move Up'));"
            "  return row ? row.textContent : '';"
            "}")
        check('S2', 'move_up shows multi-key display (w, arrowup)', 'w' in multi and 'arrowup' in multi, multi[:60])

        # capture: rebind quaff q -> p
        page.click('[data-rebind="quaff"]')
        page.wait_for_timeout(100)
        page.keyboard.press('p')
        page.wait_for_timeout(150)
        binds = page.evaluate("JSON.parse(localStorage.getItem('dh_keybinds')||'{}').keys")
        check('S2', 'capture rebind q->p persisted', binds.get('p') == 'quaff' if hasattr(binds, 'get') else binds.get('p') == 'quaff' if isinstance(binds, dict) else binds['p'] == 'quaff', str(binds.get('p') if hasattr(binds, 'get') else ''))
        check('S2', 'old key q freed', ('q' not in (binds if isinstance(binds, dict) else {})), '')

        # conflict: try binding inventory to p (occupied by quaff) -> dialog, binding unchanged
        page.click('[data-rebind="inventory"]')
        page.wait_for_timeout(100)
        page.keyboard.press('p')
        page.wait_for_timeout(200)
        binds2 = page.evaluate("JSON.parse(localStorage.getItem('dh_keybinds')||'{}').keys")
        p_still = binds2.get('p')
        check('S2', 'conflict rejected: p stays on quaff', p_still == 'quaff', str(p_still))

        # capture cancel via Escape
        page.click('[data-rebind="talent"]')
        page.wait_for_timeout(100)
        page.keyboard.press('Escape')
        page.wait_for_timeout(150)
        binds3 = page.evaluate("JSON.parse(localStorage.getItem('dh_keybinds')||'{}').keys")
        check('S2', 'Escape cancels capture (n untouched)', binds3.get('n') == 'talent', str(binds3.get('n')))

        # keybinds reset button
        page.click('#kb-reset-btn')
        page.wait_for_timeout(150)
        binds4 = page.evaluate("JSON.parse(localStorage.getItem('dh_keybinds')||'{}').keys")
        check('S2', 'kb reset restores q=quaff & frees p', binds4.get('q') == 'quaff' and 'p' not in binds4, str(binds4.get('q')))

        # ============ Scenario ③ rebind takes effect in gameplay ============
        print('\n== S3: rebind effective in gameplay ==')
        # rebind inventory i -> u, close options, press u in gameplay
        page.click('[data-rebind="inventory"]')
        page.wait_for_timeout(100)
        page.keyboard.press('u')
        page.wait_for_timeout(150)
        page.keyboard.press('Escape')  # close options overlay
        page.wait_for_timeout(200)
        check('S3', 'options closed after rebind', not overlay_active(page, 'options-overlay'))
        page.keyboard.press('u')
        page.wait_for_timeout(250)
        inv_open = overlay_active(page, 'inventory-overlay')
        check('S3', "new key 'u' opens inventory", inv_open)
        # old key i must NOT open it (freed)
        page.keyboard.press('Escape')  # close inventory
        page.wait_for_timeout(200)
        page.keyboard.press('i')
        page.wait_for_timeout(250)
        inv_open2 = overlay_active(page, 'inventory-overlay')
        check('S3', "old key 'i' no longer opens inventory", not inv_open2)

        # restore defaults for later scenarios
        open_options(page)
        page.click('.opt-tab[data-tab="keybinds"]')
        page.click('#kb-reset-btn')
        page.wait_for_timeout(100)
        page.keyboard.press('Escape')
        page.wait_for_timeout(150)

        # ============ Scenario ④ overlay_close rebind consistency ============
        print('\n== S4: overlay_close rebind consistency ==')
        # rebind overlay_close escape -> backspace
        open_options(page)
        page.click('.opt-tab[data-tab="keybinds"]')
        page.click('[data-rebind="overlay_close"]')
        page.wait_for_timeout(100)
        page.keyboard.press('Backspace')
        page.wait_for_timeout(150)
        binds5 = page.evaluate("JSON.parse(localStorage.getItem('dh_keybinds')||'{}').keys")
        check('S4', 'overlay_close bound to backspace', binds5.get('backspace') == 'overlay_close', str(binds5.get('backspace')))
        # new key closes options
        page.keyboard.press('Backspace')
        page.wait_for_timeout(200)
        check('S4', 'backspace closes options overlay', not overlay_active(page, 'options-overlay'))
        # new key closes other overlays too (help)
        page.keyboard.press('?')
        page.wait_for_timeout(250)
        check('S4', 'help opens via ?', overlay_active(page, 'help-overlay'))
        page.keyboard.press('Backspace')
        page.wait_for_timeout(250)
        check('S4', 'backspace closes help overlay', not overlay_active(page, 'help-overlay'))
        # old Escape must NOT close anymore
        page.keyboard.press('i')
        page.wait_for_timeout(250)
        page.keyboard.press('Escape')
        page.wait_for_timeout(300)
        still_open = overlay_active(page, 'inventory-overlay')
        check('S4', 'freed Escape no longer closes inventory', still_open)
        if still_open:
            page.keyboard.press('Backspace')
            page.wait_for_timeout(200)
        # pause overlay also honors rebound overlay_close
        page.keyboard.press('Escape')  # escape now unbound -> nothing (pause was bound to escape? no, pause is gamepad only + Esc fallback)
        page.wait_for_timeout(150)
        check('S4', 'no overlay leak after escape press', not overlay_active(page, 'pause-overlay'))
        # restore defaults
        open_options(page)
        page.click('.opt-tab[data-tab="keybinds"]')
        page.click('#kb-reset-btn')
        page.wait_for_timeout(100)
        page.keyboard.press('Escape')
        page.wait_for_timeout(150)

        # ============ Scenario ⑤ 12 overlays no regression ============
        print('\n== S5: 12 overlays open/close no regression ==')
        # In-game overlays opened via their default key/button
        in_game = [
            ('inventory-overlay', 'i'), ('help-overlay', '?'),
            ('achievement-overlay', 't'), ('talent-overlay', 'n'), ('pause-overlay', 'Escape'),
        ]
        for oid, key in in_game:
            page.keyboard.press(key)
            page.wait_for_timeout(250)
            opened = overlay_active(page, oid)
            page.keyboard.press('Escape')
            page.wait_for_timeout(250)
            closed = not overlay_active(page, oid)
            # pause needs second escape? Escape opens pause (overlay_close unbound conflict handled) — verify closed via button fallback
            if oid == 'pause-overlay' and not closed:
                closed = page.evaluate("() => !document.getElementById('pause-overlay').classList.contains('active')")
            check('S5', f'{oid} open+ESC-close', opened and closed, f'open={opened} closed={closed}')

        # forge/records/codex buttons live on the TITLE screen (hidden in-game);
        # in-game they open via bridge handlers. Drive the same handlers via JS click
        # dispatch on the bound button elements (playwright click would fail on
        # hidden elements), then verify ESC closes each.
        import json as _json
        for oid, btn in [('forge-overlay', '#btn-forge'), ('records-overlay', '#btn-records'), ('codex-overlay', '#btn-codex')]:
            page.evaluate("id => document.getElementById(id).click()", btn.lstrip('#') and btn) if False else None
            page.evaluate(f"() => document.querySelector('{btn}').dispatchEvent(new MouseEvent('click', {{bubbles: true}}))")
            page.wait_for_timeout(250)
            opened = overlay_active(page, oid)
            # records/codex are title-screen panels closed via ✕ (same as main branch)
            close_btn = {'forge-overlay': '#btn-close-forge', 'records-overlay': '#btn-close-records', 'codex-overlay': '#btn-close-codex'}[oid]
            page.evaluate(f"() => document.querySelector('{close_btn}').dispatchEvent(new MouseEvent('click', {{bubbles: true}}))")
            page.wait_for_timeout(250)
            closed = not overlay_active(page, oid)
            check('S5', f'{oid} handler+✕-close', opened and closed, f'open={opened} closed={closed}')

        # skill-overlay via keyboard 'k': k = tryCastSkill. Default Warrior has
        # full MP and cd 0 -> the skill CASTS in gameplay (panel NOT shown).
        # After burning MP/cd, k opens the panel instead. Verify both branches.
        page.keyboard.press('k')  # cast attempt (mp full) — panel should NOT open
        page.wait_for_timeout(250)
        cast_no_panel = not overlay_active(page, 'skill-overlay')
        check('S5', "'k' casts skill when ready (no panel)", cast_no_panel)
        # burn remaining MP by casting more, then k opens panel
        for _ in range(3):
            page.keyboard.press('k')
            page.wait_for_timeout(120)
        page.keyboard.press('k')
        page.wait_for_timeout(250)
        panel_now = overlay_active(page, 'skill-overlay')
        check('S5', "'k' opens skill panel when on cd/no mp", panel_now)
        if panel_now:
            page.keyboard.press('Escape')
            page.wait_for_timeout(200)

        # item-intro overlay: force-open via JS API, then close via b / Escape
        page.evaluate("""() => {
          const html = document.documentElement;
          // synthesize via exposed module is not trivial; instead open the overlay through queue API if reachable
        }""")
        intro_js = page.evaluate("""() => {
          try {
            // item-intro module is bundled; reach it via a synthetic event is overkill.
            // Instead: verify overlay element exists and can be shown/closed by the input path.
            return !!document.getElementById('item-intro-overlay');
          } catch (e) { return false; }
        }""")
        check('S5', 'item-intro overlay element present', intro_js)
        # ending-choice + event-modal verified structurally (need boss kill / npc — JS-level presence only)
        endings_el = page.evaluate("!!document.getElementById('ending-choice')")
        check('S5', 'ending-choice overlay element present', endings_el)
        # (removed a constant-True "dynamic event modal" check — a failed events-module
        # import already surfaces via console_errors/pageerror, which gate the exit code)

        # b-key dual semantics: b opens inventory (map main action) when nothing open
        page.keyboard.press('b')
        page.wait_for_timeout(250)
        b_inv = overlay_active(page, 'inventory-overlay')
        check('S5', "dual-key 'b' opens inventory (map main action)", b_inv)
        page.keyboard.press('Escape')
        page.wait_for_timeout(200)
        # i re-opens inventory from the closed state (dispatch guard: only when no overlay)
        page.keyboard.press('i')
        page.wait_for_timeout(250)
        i_inv = overlay_active(page, 'inventory-overlay')
        check('S5', "'i' opens inventory (b-closed state, guard path)", i_inv)

        page.screenshot(path=f'{OUT}/final_game_state.png')

        # ============ Task 6 screenshot matrix (settings-surface) ============
        print('\n== MATRIX: screenshot matrix (options tabs / hc / forge / radius-affected) ==')
        # S5's last press ('i') leaves the inventory overlay open — close it so
        # the sidebar #btn-options is clickable again.
        page.keyboard.press('Escape')
        page.wait_for_timeout(250)
        # --- A. options tabs, default skin ---
        open_options(page)
        for tab in ['audio', 'display', 'access', 'game', 'keybinds']:
            page.evaluate(f"() => document.querySelector('.opt-tab[data-tab=\"{tab}\"]').click()")
            page.wait_for_timeout(200)
            page.screenshot(path=f'{OUT}/surface-opt-{tab}.png')
        # --- B. hc on → access + keybinds → restore off ---
        click_tab(page, 'access')
        page.evaluate("() => document.querySelector('[data-optkey=\"hc\"]').click()")
        page.wait_for_timeout(200)
        for tab in ['access', 'keybinds']:
            page.evaluate(f"() => document.querySelector('.opt-tab[data-tab=\"{tab}\"]').click()")
            page.wait_for_timeout(200)
            page.screenshot(path=f'{OUT}/surface-hc-{tab}.png')
        # The hc toggle lives only in the ACCESS tab's DOM (tabs re-render
        # #opt-body) — re-select access before the restore-off click.
        click_tab(page, 'access')
        page.evaluate("() => document.querySelector('[data-optkey=\"hc\"]').click()")  # hc off
        page.wait_for_timeout(150)
        page.keyboard.press('Escape')
        page.wait_for_timeout(200)

        # --- C. radius-lg affected surfaces (--radius-lg 6→10px, T5 user ruling) ---
        # 1. .talent-cell: talent overlay via 'n' (in-game).
        page.keyboard.press('n')
        page.wait_for_timeout(300)
        talent_open = overlay_active(page, 'talent-overlay')
        check('MATRIX', 'talent overlay open for .talent-cell shot', talent_open)
        if talent_open:
            page.screenshot(path=f'{OUT}/radius-talent-cells.png')
            page.keyboard.press('Escape')
            page.wait_for_timeout(200)
        # 2. .tb touch buttons: #touch-controls is display:none in headless desktop
        #    (visible only via max-width:600px / pointer:coarse media queries). Make
        #    it visible non-destructively JUST for the shot, then restore.
        tb_visible = page.evaluate("""() => {
          const tc = document.getElementById('touch-controls');
          if (!tc) return false;
          tc.dataset.prevDisplay = tc.style.display || '';
          tc.style.display = 'block';
          return !!document.querySelector('#touch-controls .tb');
        }""")
        if tb_visible:
            page.screenshot(path=f'{OUT}/radius-tb-touch.png')
            page.evaluate("() => { const tc = document.getElementById('touch-controls'); tc.style.display = tc.dataset.prevDisplay; delete tc.dataset.prevDisplay; }")
        check('MATRIX', '.tb touch buttons shot (forced visible, media-gated by design)', tb_visible)
        # 3. #event-popup: events.ts is module-bundled with no window/bridge hook
        #    (window.dh bridge only exposes fullscreen; showEvent not reachable).
        #    Deterministic alternative: place a merchant entity on the tile the
        #    player stands on and walk the same pickup path input.ts uses.
        ev_open = page.evaluate("""() => {
          const mod = document.querySelector('script[src*=\"src/main.ts\"]'); // probe (unused)
          const popup = document.getElementById('event-popup');
          return popup && getComputedStyle(popup).display !== 'none';
        }""")
        if not ev_open:
            popup_ok = False
            placed = page.evaluate("""() => {
              // Reuse the game's own state via the hotbar/inventory path is not
              // possible without module access; instead synthesize the popup by
              // invoking the same DOM the bundled showEvent('merchant') writes.
              // This is a CSS-visual matrix (radius/border), not a logic test —
              // structural fidelity of the popup markup is what matters.
              const p = document.getElementById('event-popup');
              document.getElementById('ev-title').textContent = 'Wandering Merchant';
              document.getElementById('ev-desc').textContent = 'A hooded figure offers wares from the dark.';
              document.getElementById('ev-buttons').innerHTML =
                '<button class="evb">[1] Buy mystery item (-30 gold)</button>' +
                '<button class="evb">[2] Open bag to sell</button>' +
                '<button class="evb">[3] Leave</button>';
              p.style.display = 'block';
              return true;
            }""")
            if placed:
                page.wait_for_timeout(200)
                popup_ok = page.evaluate("() => document.getElementById('event-popup').style.display === 'block' && document.getElementById('ev-title').textContent !== ''")
                page.screenshot(path=f'{OUT}/radius-event-popup.png')
                page.evaluate("() => { document.getElementById('event-popup').style.display = 'none'; }")
            check('MATRIX', '#event-popup synthesized popup visible for shot', popup_ok)

        # --- D. forge overlay: same control set new skin spot-check ---
        page.evaluate("() => document.querySelector('#btn-forge').dispatchEvent(new MouseEvent('click', {bubbles: true}))")
        page.wait_for_timeout(300)
        forge_open = overlay_active(page, 'forge-overlay')
        check('MATRIX', 'forge overlay open for seg-skin shot', forge_open)
        if forge_open:
            page.screenshot(path=f'{OUT}/surface-forge-seg.png')
            page.evaluate("() => document.querySelector('#btn-close-forge').dispatchEvent(new MouseEvent('click', {bubbles: true}))")
            page.wait_for_timeout(200)

        # --- E. hc × colorblind composite HUD view (follow-up screenshot 1/2) ---
        # colorblind is a SEG control (off/proto/deutan/tritan) — click its option
        # button, not a checkbox. Screenshot the HUD (options closed) to show the
        # hc tokens + cb color-matrix filter applied together.
        open_options(page)
        click_tab(page, 'access')
        page.evaluate("() => document.querySelector('[data-optkey=\"hc\"]').click()")                                # hc on
        page.evaluate("() => document.querySelector('[data-optkey=\"colorblind\"] [data-seg=\"deutan\"]').click()")  # cb deutan
        page.wait_for_timeout(250)
        page.keyboard.press('Escape')  # close options → HUD view
        page.wait_for_timeout(250)
        page.screenshot(path=f'{OUT}/surface-hc-cb-hud.png')
        open_options(page)
        click_tab(page, 'access')
        page.evaluate("() => document.querySelector('[data-optkey=\"colorblind\"] [data-seg=\"off\"]').click()")     # cb off
        page.evaluate("() => document.querySelector('[data-optkey=\"hc\"]').click()")                                # hc off
        page.wait_for_timeout(150)

        # --- F. textScale 1.5 HUD overflow doc (follow-up screenshot 2/2) ---
        # sidebar hardcodes 13px (immune); this documents hotbar/log/panels at max
        # text scale + guards the hotbar stays inside the viewport.
        click_tab(page, 'display')
        page.evaluate("() => { const el = document.querySelector('[data-optkey=\"textScale\"]'); el.value = 1.5; el.dispatchEvent(new Event('input', {bubbles:true})); }")
        page.wait_for_timeout(250)
        page.keyboard.press('Escape')
        page.wait_for_timeout(250)
        page.screenshot(path=f'{OUT}/surface-ts15-hud.png')
        hud_ok = page.evaluate("() => document.getElementById('hotbar').getBoundingClientRect().right <= window.innerWidth + 1")
        check('MATRIX', 'textScale 1.5 — hotbar stays within viewport', hud_ok)
        open_options(page)
        click_tab(page, 'display')
        page.evaluate("() => { const el = document.querySelector('[data-optkey=\"textScale\"]'); el.value = 1; el.dispatchEvent(new Event('input', {bubbles:true})); }")
        page.wait_for_timeout(150)
        page.keyboard.press('Escape')
        page.wait_for_timeout(150)

        browser.close()

    # ============ Report ============
    print('\n================ SMOKE SUMMARY ================')
    fails = [r for r in results if not r[2]]
    for sc, name, ok, detail in results:
        print(f"{'✅' if ok else '❌'} [{sc}] {name}" + (f"  ({detail})" if detail and not ok else ''))
    print(f"\nTotal {len(results)} checks, {len(fails)} failed")
    if console_errors:
        print(f"\nConsole errors ({len(console_errors)}):")
        for e in console_errors[:20]:
            print('  ' + e[:300])
    else:
        print('Console errors: 0')
    sys.exit(1 if fails or console_errors else 0)


if __name__ == '__main__':
    import os
    os.makedirs(OUT, exist_ok=True)
    main()
