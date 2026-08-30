# In-game verification for feat/batch6-steam (批6 Steam 上架·代码侧, T4) — the
# batch's ONLY Electron-side coverage (main.cjs/preload.cjs are outside vitest).
# Unlike the dev-server batteries, this launches the PACKAGED exe
# (release/win-unpacked) with --remote-debugging-port and drives it over CDP.
# page.evaluate can't import ES modules from the bundle, so every interaction
# is real DOM clicks / real key presses (btn-new → start-btn → Ctrl+S, 'l' for
# language) — exactly the surface Steam players get.
#   S1  dual-file landing: new run → Ctrl+S → dh.loadFileSync().save parses
#       with fresh mtime; 'l' toggles lang → debounced profile snapshot lands
#       with kv.dh_lang flipped.
#   S2  fresh-machine restore (THE core scenario): localStorage.clear() →
#       kill → relaunch → the sendSync read-back restores dh_lang + dh_save
#       before the title screen renders; clicking Continue actually enters.
#   S3  clear channel: clearCloudSave's exact ops (removeItem×2 + dh.deleteSave)
#       → loadFileSync().save === null → relaunch → nothing restored. Continue
#       is never CLICKED here: no-save loadGame() alert()s, a BLOCKING native
#       dialog under Electron — dh_save absence is the availability gate.
#   S4  steamworks graceful degrade: steamworks.js is bundled but no
#       steam_appid.txt / no Steam context → main must WARN and null out (warn
#       in main stdout is the allowed outcome); renderer console stays
#       error-free across all three launches; dh:unlock IPC still resolves.
# clearCloudSave's in-combat death routing is unit-covered (T1 source gate) and
# the death flow is dev-server-covered — only the packaged IPC channel is
# proven here. PASS = all checks green AND zero renderer console/page errors.
#
# HARNESS GOTCHA (found the hard way on first run): taskkill /F hard-kills the
# renderer BEFORE Chromium's localStorage idle-commit (~5s) runs, so disk
# localStorage keeps whatever an ancient session last committed while the FILE
# mirror (fs.writeFileSync) commits instantly — the boot restore then "heals"
# from files, exactly the designed crash-window semantics. Players quit
# GRACEFULLY, so the battery kills gracefully too: taskkill WITHOUT /F posts
# WM_CLOSE → window closes → app quits → storage commits. /F is only fallback.
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request

from playwright.sync_api import sync_playwright

EXE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'release',
                                   'win-unpacked', 'Depths of Darkhollow.exe'))
PORT = 9333
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

R = []          # (name, ok, detail)
console_errors = []   # (phase, text)
page_errors = []      # (phase, text)
main_logs = []        # temp-file paths, one per launch
proc = None
out_f = None


def check(name, ok, detail=''):
    R.append((name, bool(ok), detail))
    print(('PASS ' if ok else 'FAIL ') + name + ((' — ' + str(detail)[:200]) if detail and not ok else ''))


def http_ready():
    try:
        with urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json/version', timeout=1) as r:
            return json.loads(r.read().decode()).get('Browser')
    except Exception:
        return None


def taskkill_all():
    # Best-effort sweep so a leftover Electron from an earlier run can't hold the CDP port.
    subprocess.run(['taskkill', '/F', '/IM', 'Depths of Darkhollow.exe', '/T'],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def kill():
    global proc
    if proc is not None and proc.poll() is None:
        # Graceful first (WM_CLOSE → quit → localStorage commits; see header note).
        subprocess.run(['taskkill', '/PID', str(proc.pid), '/T'],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        deadline = time.time() + 10
        while time.time() < deadline and proc.poll() is None:
            time.sleep(0.5)
        if proc.poll() is None:   # hung? take it out the hard way
            subprocess.run(['taskkill', '/PID', str(proc.pid), '/T', '/F'],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    proc = None
    deadline = time.time() + 15
    while time.time() < deadline and http_ready():
        time.sleep(0.5)


def attach(page, phase):
    def on_console(m):
        if m.type == 'error':
            console_errors.append((phase, m.text))
    page.on('console', on_console)
    page.on('pageerror', lambda e: page_errors.append((phase, str(e))))


def boot(pw, phase):
    """Launch the packaged exe, wait for its CDP endpoint + page, attach collectors."""
    global proc, out_f
    out_f = tempfile.NamedTemporaryFile(mode='w+', delete=False, suffix='.dh-main.log')
    main_logs.append(out_f.name)
    proc = subprocess.Popen([EXE, f'--remote-debugging-port={PORT}'],
                            stdout=out_f, stderr=subprocess.STDOUT)
    deadline = time.time() + 30
    while time.time() < deadline:
        if http_ready():
            break
        if proc.poll() is not None:
            out_f.close()
            print(f'FAIL boot({phase}): exe exited early rc={proc.returncode}')
            sys.exit(1)
        time.sleep(0.5)
    else:
        out_f.close()
        print(f'FAIL boot({phase}): CDP endpoint never came up on :{PORT}')
        sys.exit(1)
    browser = pw.chromium.connect_over_cdp(f'http://127.0.0.1:{PORT}')
    page = None
    deadline = time.time() + 15
    while time.time() < deadline:
        for ctx in browser.contexts:
            for p in ctx.pages:
                if p.url.startswith('file:'):
                    page = p
                    break
        if page is not None:
            break
        time.sleep(0.5)
    if page is None:
        out_f.close()
        print(f'FAIL boot({phase}): no file:// page appeared')
        sys.exit(1)
    attach(page, phase)
    page.wait_for_selector('#btn-new', state='visible', timeout=20000)
    return browser, page


def main():
    global out_f
    if not os.path.exists(EXE):
        print(f'FAIL: packaged exe missing — run `npm run dist` first: {EXE}')
        sys.exit(1)
    taskkill_all()
    with sync_playwright() as pw:
        # ---- S1 dual-file landing -------------------------------------------------
        browser, page = boot(pw, 'S1')
        t_before = time.time() * 1000
        page.evaluate("localStorage.removeItem('dh_save');"
                      "localStorage.removeItem('dh_save_ts');"
                      "window.dh.deleteSave()")
        page.click('#btn-new')
        page.wait_for_selector('#start-btn', state='visible', timeout=10000)
        page.click('#start-btn')
        page.wait_for_selector('#game-container', state='visible', timeout=10000)
        page.keyboard.press('w')
        page.wait_for_timeout(200)
        page.keyboard.press('w')
        page.wait_for_timeout(200)
        page.keyboard.press('Control+s')     # input.ts:198 hardcoded saveGame()
        page.wait_for_timeout(500)
        snap = page.evaluate('window.dh.loadFileSync()')
        save = (snap or {}).get('save')
        try:
            parsed = bool(save) and isinstance(json.loads(save['data']), dict)
        except Exception:
            parsed = False
        check('S1a save file lands (parses, fresh mtime)',
              parsed and save['mtime'] > t_before - 2000,
              f'save={bool(save)} mtime={save and save.get("mtime")}')

        lang_before = page.evaluate("localStorage.getItem('dh_lang')")
        page.keyboard.press('l')             # input action 'lang' → toggleLang → setLang
        page.wait_for_timeout(1000)          # 500ms debounce + IPC + write
        lang_after = page.evaluate("localStorage.getItem('dh_lang')")
        snap2 = page.evaluate('window.dh.loadFileSync()')
        prof = ((snap2 or {}).get('profile') or {})
        kv_lang = None
        try:
            kv_lang = json.loads(prof['data']).get('kv', {}).get('dh_lang')
        except Exception:
            pass
        check('S1b profile file lands w/ flipped dh_lang',
              kv_lang is not None and kv_lang == lang_after and kv_lang != lang_before,
              f'kv={kv_lang} after={lang_after} before={lang_before}')

        # ---- S2 fresh-machine restore ---------------------------------------------
        page.evaluate('localStorage.clear()')   # wipes dh_save_ts / dh_profile_ts too
        browser.close()
        kill()
        out_f.close()
        browser, page = boot(pw, 'S2')
        restored_lang = page.evaluate("localStorage.getItem('dh_lang')")
        restored_save = page.evaluate("localStorage.getItem('dh_save')")
        try:
            rs_turns = json.loads(restored_save).get('player', {}).get('turns')
        except Exception:
            rs_turns = None
        # turns<50 proves the restore is OUR S1 save (fresh char, ~3 turns),
        # not some ancient localStorage survivor satisfying a bare truthy check.
        check('S2a fresh-machine restore (lang + save back from files)',
              restored_lang == lang_after and bool(restored_save)
              and isinstance(rs_turns, int) and rs_turns < 50,
              f'lang={restored_lang} want={lang_after} turns={rs_turns}')
        page.click('#btn-cont')
        try:
            page.wait_for_selector('#game-container', state='visible', timeout=5000)
            check('S2b Continue enters the game', True)
        except Exception as e:
            check('S2b Continue enters the game', False, str(e)[:120])

        # ---- S3 clear channel ------------------------------------------------------
        # clearCloudSave()'s exact operations (its combat routing is unit-covered in T1;
        # the no-save Continue click is deliberately skipped — loadGame() alert()s).
        page.evaluate("localStorage.removeItem('dh_save');"
                      "localStorage.removeItem('dh_save_ts');"
                      "window.dh.deleteSave()")
        snap3 = page.evaluate('window.dh.loadFileSync()')
        check('S3a save file deleted via channel', (snap3 or {}).get('save') is None)
        browser.close()
        kill()
        out_f.close()
        browser, page = boot(pw, 'S3')
        save3 = page.evaluate("localStorage.getItem('dh_save')")
        snap3b = page.evaluate('window.dh.loadFileSync()')
        check('S3b relaunch restores nothing (Continue unavailable)',
              save3 is None and (snap3b or {}).get('save') is None,
              f'ls={save3!r} file={(snap3b or {}).get("save")}')

        # ---- S4 steamworks degrade + console hygiene --------------------------------
        ok_unlock = page.evaluate("window.dh.unlockAchievement('first_kill')")
        check('S4a unlock IPC alive under degrade', ok_unlock is True, repr(ok_unlock))
        browser.close()
        kill()
        out_f.close()

    # Main-process stdout: degrade must be warn-only. steam_appid.txt is excluded
    # from the package (files whitelist), so init() failing is the DETERMINISTIC
    # outcome — its warn line is the proof the guard path executed.
    combined = ''
    for pth in main_logs:
        with open(pth, 'r', errors='replace') as fh:
            combined += fh.read()
        os.unlink(pth)
    warned = '[steam] init failed' in combined or '[steam] init threw' in combined
    crashed = 'UncaughtException' in combined or 'TypeError:' in combined
    check('S4b steam degrade is warn-only (guard fired, no crash)', warned and not crashed,
          combined[-400:] if not warned or crashed else '')
    check('S4c zero renderer console errors across all launches', not console_errors,
          '; '.join(f'{p}:{t[:80]}' for p, t in console_errors[:5]))
    check('S4d zero page errors across all launches', not page_errors,
          '; '.join(f'{p}:{t[:80]}' for p, t in page_errors[:5]))

    bad = [r for r in R if not r[1]]
    print(f'\n{len(R) - len(bad)}/{len(R)} checks passed' + (' — ALL GREEN' if not bad else ''))
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    try:
        main()
    finally:
        kill()
        taskkill_all()
        for pth in list(main_logs):
            if os.path.exists(pth):
                os.unlink(pth)
