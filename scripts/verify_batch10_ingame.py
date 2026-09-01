# In-game verification for feat/batch10-abyss-ledger-echoes (批10 T6 battery).
# Launcher cribbed verbatim from scripts/verify_batch9_ingame.py: Vite DEV
# server so page.evaluate can `import('/src/*.ts')` and reach the SAME live
# module instances the game loop uses (same-instance ESM injection dodges the
# HMR '?t=' second-instance trap). Zero console errors enforced (favicon 404
# whitelisted). Six independently try/except'd assertion groups:
#   G1 回响全环 (echo full loop): recordEcho a crafted snapshot (keepsake
#      included) into dh_meta → real enterFloor(2) looping until the 35% gate
#      fires NATURALLY (bounded 20 rolls; deterministic fallback pushes an
#      entity via the same literal shape game.ts uses) → real movePlayer onto
#      it → popup with the epitaph → all three interactions on fresh echoes:
#      掠夺 (+10🩸 + keepsake lands in inv), 超度 (-10🩸 + 40% maxHp heal),
#      继承 (dh_meta soulEchoes +30) — plus the keepsake-less 掠夺 fallback
#      (+5🩸 +50💰), and the 95-hard-line block (final-review I1): corruption
#      pinned 90 → loot rendered disabled+dimmed, attempt changes nothing and
#      the popup stays open; 超度 is the escape.
#   G2 宝藏双价签 (dual price tags): crafted treasure merchant at floor 5
#      renders 💰 AND 🩸 legs per item (-460💰/-🩸10 for r3, -920💰/-🩸20 for
#      r4); corruption purchase: corruption +10, gold byte-unchanged, stock
#      spliced, LIVE ev.boughtCorrupt('10') message lock (batch11 A, G5b
#      crib); gold leg regression: gold -920, corruption untouched, keeps the
#      ORIGINAL ev.boughtTreasure(name, 920) message (exact-element diff).
#   G3 神龛暗黑契约 (shrine dark pact): corruption-0 player steps a SHRINE
#      tile → two-choice popup → [2] dark pact → baseAtk +4 (baseDef +4,
#      baseMaxHp +20) and corruption 15.
#   G4 支付封锁 (payment block): corruption 85 → the r4 🩸 button (cost 20)
#      is disabled + opacity .45 while the 💰 leg stays enabled; cost.ts leaf
#      assertions (corruptionPriceOf(920)=20, 95-boundary inclusive).
#   G5 无尽商人双腿 (endless merchant dual-price legs, batch11 F): crafted
#      endless trader at floor 5 (stock pre-seeded → no re-roll) renders 11
#      buttons — gear×3 + relic each a 💰/🩸 pair (🩸 9,9,9,22 per cost.ts),
#      purge/heal gold-only single legs, leave with NO [11] prefix (keyTag
#      drops numbering past 9); first gear 🩸 leg: corruption +9, gold
#      unchanged, live ev.boughtCorrupt message (batch11 A), pair spliced
#      (11 → 9 buttons); relic 💰 leg regression: gold -1000, corruption
#      untouched; Leave closes the shop.
#   G6 真死亡回响闭环 (real-death echo closed loop, batch11 F): REAL
#      playerDeath on a live run (injected r4 weapon beats the r0 filler
#      through pickKeepsake's real path) → recordEcho snapshot lands in
#      dh_meta (newest first; cause/killer/floor/classIdx/corruption/ts/
#      epitaph all captured); then the pool is trimmed to that record, a
#      fresh run via the death screen's Try Again draws it at F2 (35% gate,
#      bounded rolls + deterministic push fallback — G1 crib) and the popup
#      carries this death's epitaph with the killer's name — the loop
#      closes. The pre-G6 pool is restored afterwards (re-runnable).
# Screenshots: smoke_out/batch10/{echo_popup,dual_shop,endless_shop}.png
# Run: npm run dev -- --port 5173 --strictPort (FRESH server), then:
#      python scripts/verify_batch10_ingame.py
import io
import os
import sys
import traceback

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from playwright.sync_api import sync_playwright

BASE = 'http://localhost:5173'
OUT = os.path.join(os.path.dirname(__file__), 'smoke_out', 'batch10')
os.makedirs(OUT, exist_ok=True)

results = []
console_errors = []
http_404s = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ''))


def group(page, title, fn):
    print(f'---- {title} ----')
    try:
        fn()
    except Exception as e:
        check(f'{title} ERROR', False, f'{type(e).__name__}: {str(e)[:200]}')


def start_game(page):
    page.click('#btn-new')
    page.click('#start-btn')
    page.wait_for_timeout(700)
    assert page.evaluate("document.getElementById('game-container').style.display") == 'flex', 'game did not start'


# Close the event popup via the REAL Escape key — but only if it is actually
# open: a blind ESC with nothing open falls through to the pause menu
# (input.ts "ESC opens pause"), which would cover the next popup and starve
# the following page.click of its hit-target.
def close_popup(page):
    if page.evaluate("document.getElementById('event-popup').style.display") == 'block':
        page.keyboard.press('Escape')
        page.wait_for_timeout(100)


# Click an event button with a real trusted mouse event. Playwright's
# actionability gate (stability/hit-target) can flake against the popup's CSS
# animation and time out; the fallback dispatches a DOM click on the SAME
# element, which still runs the real listener _bindEventBtns attached.
def click_btn(page, selector):
    try:
        page.click(selector, timeout=8000)
    except Exception as e:
        print(f"  (real click on {selector} failed -> DOM click fallback: {type(e).__name__}: {str(e)[:110]})")
        page.evaluate("sel => { const b = document.querySelector(sel); if (!b) throw new Error('no button: ' + sel); b.click(); }", selector)
        page.wait_for_timeout(60)


# Quit the current run to the title screen through the REAL pause menu (ESC →
# quit → confirm() auto-accepted by the dialog handler), so a following group
# can start_game a fresh run (G4 leaves the event popup open + a live run).
def quit_to_title(page):
    close_popup(page)
    page.keyboard.press('Escape')   # nothing open now -> input.ts falls through to openPause
    page.wait_for_timeout(150)
    click_btn(page, '#btn-pause-quit')
    page.wait_for_timeout(400)
    assert page.evaluate("document.getElementById('title-screen').style.display") == 'flex', 'did not return to title'


# playerDeath leaves the death screen up — its Try Again button is the real-UI
# entry into the char select (#btn-new sits on the hidden title screen behind).
def restart_from_death(page):
    click_btn(page, '#btn-try-again')
    page.click('#start-btn')
    page.wait_for_timeout(700)
    assert page.evaluate("document.getElementById('game-container').style.display") == 'flex', 'game did not restart'


# Push a fresh echo entity next to the player via the same literal shape
# game.ts:125 uses, on a clean FLOOR tile; returns the move delta onto it.
PLACE_ECHO = """async () => {
  const st = await import('/src/state.ts');
  const cfg = await import('/src/config.ts');
  const { t } = await import('/src/i18n.ts');
  const g = st.G, p = g.player;
  const rec = window.__bt10rec2;   // caller swaps this stash per interaction
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = p.x + dx, y = p.y + dy;
    if (x < 0 || y < 0 || x >= cfg.MW || y >= cfg.MH) continue;
    if (g.dungeon.map[y][x] !== cfg.TL.FLOOR) continue;
    if (g.enemies.some(e => e.x === x && e.y === y)) continue;
    if (g.items.some(i => i.x === x && i.y === y)) continue;
    g.items.push({ type: 'consumable', name: t('ev.echoTitle'), ch: 'Ω', c: '#9d8df1',
                   desc: '', x, y, rarity: 2, npc: 'echo', echo: rec, spriteKind: 'ECHO' });
    return { dx, dy };
  }
  return null;
}"""


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel='chrome')
        page = browser.new_page(viewport={'width': 1280, 'height': 800})
        # Chrome's favicon fetch often bypasses the response event — the URL
        # lives on the console message's location (batch7 crib: whitelist there).
        page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' and '/favicon' not in ((m.location or {}).get('url') or '') else None)
        page.on('pageerror', lambda e: console_errors.append(str(e)))
        page.on('response', lambda r: http_404s.append(r.url) if r.status == 404 else None)   # secondary evidence
        page.on('dialog', lambda d: d.accept())
        page.goto(BASE)
        page.wait_for_selector('#btn-new', state='visible')
        start_game(page)

        # ---- G1  回响全环 -----------------------------------------------------------
        def g1():
            seed = page.evaluate("""async () => {
              const st = await import('/src/state.ts');
              const cfg = await import('/src/config.ts');
              const meta = await import('/src/meta.ts');
              const game = await import('/src/game.ts');
              const { t } = await import('/src/i18n.ts');
              const g = st.G;
              // Crafted snapshot: keepsake is a POTION so the 掠夺 branch provably
              // lands it in inv (a weapon could auto-equip and leave inv empty).
              const keepsake = { type: 'potion', name: '冒烟遗物药剂', ch: '!', c: '#e05555',
                                 desc: 'battery keepsake', rarity: 3, ef: 'heal', x: 0, y: 0 };
              const rec = { cause: 'combat', killer: '冒烟深渊行者', floor: 7, turns: 214, classIdx: 0,
                            corruption: 42, keepsake,
                            epitaph: { template: '冒烟墓志·第7层', flavor: '冒烟风味·它还记得' }, ts: Date.now() };
              window.__bt10rec = rec;         // stash: the record the pushed echoes carry
              const m = meta.getMeta(); m.echoes = []; meta.saveMeta(m);
              meta.recordEcho(rec);           // B1: the real persistence entry
              meta.discoverItem('potion:冒烟遗物药剂');   // pre-discover -> no intro card
              // Natural 35% gate: real floor-2 entries, bounded loop; the push
              // fallback below keeps the gate deterministic (0.65^20 ~ 2e-5 miss).
              let natural = null, rolls = 0;
              for (let i = 0; i < 20 && !natural; i++) {
                game.enterFloor(2, true); rolls++;
                natural = g.items.find(it => it.npc === 'echo' && it.echo) || null;
              }
              let ent = natural;
              if (!ent) {
                const p = g.player;
                let spot = null;
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                  const x = p.x + dx, y = p.y + dy;
                  if (x < 0 || y < 0 || x >= cfg.MW || y >= cfg.MH) continue;
                  if (g.dungeon.map[y][x] !== cfg.TL.FLOOR) continue;
                  if (g.items.some(i => i.x === x && i.y === y)) continue;
                  spot = { x, y }; break;
                }
                if (!spot) return { ok: false, why: 'no clean neighbor for the fallback push' };
                ent = { type: 'consumable', name: t('ev.echoTitle'), ch: 'Ω', c: '#9d8df1', desc: '',
                        x: spot.x, y: spot.y, rarity: 2, npc: 'echo', echo: rec, spriteKind: 'ECHO' };
                g.items.push(ent);
              }
              // Deterministic walk: no enemies/traps, plain tiles, stand next to it.
              g.enemies = []; g.traps = [];
              g.dungeon.map[ent.y][ent.x] = cfg.TL.FLOOR;
              g.items = g.items.filter(i => !(i.x === ent.x && i.y === ent.y && !i.npc));
              let stand = null;
              for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const x = ent.x + dx, y = ent.y + dy;
                if (x < 0 || y < 0 || x >= cfg.MW || y >= cfg.MH) continue;
                if (g.dungeon.map[y][x] !== cfg.TL.FLOOR) continue;
                stand = { x, y }; break;
              }
              if (!stand) return { ok: false, why: 'echo has no walkable neighbor' };
              g.player.x = stand.x; g.player.y = stand.y;
              const ls = JSON.parse(localStorage.getItem('dh_meta') || '{}');
              return { ok: true, natural: !!natural, rolls,
                       dx: ent.x - stand.x, dy: ent.y - stand.y,
                       lsEcho: (ls.echoes || [])[0] || null,
                       floor: g.floor, echoesOnMap: g.items.filter(i => i.npc === 'echo').length };
            }""")
            if not seed or not seed.get('ok'):
                check('G1 seed/spawn', False, str(seed))
                return
            e0 = seed['lsEcho'] or {}
            check('G1a recordEcho persists the snapshot to dh_meta (newest first)',
                  e0.get('killer') == '冒烟深渊行者' and (e0.get('epitaph') or {}).get('template') == '冒烟墓志·第7层' and e0.get('keepsake', {}).get('name') == '冒烟遗物药剂',
                  f"killer={e0.get('killer')} tpl={(e0.get('epitaph') or {}).get('template')}")
            check('G1b an echo entity is present on a floor-2 map (35% gate; push fallback deterministic)',
                  seed['floor'] == 2 and seed['echoesOnMap'] >= 1,
                  f"floor={seed['floor']} natural={seed['natural']} rolls={seed['rolls']}")
            page.evaluate("async () => { const { movePlayer } = await import('/src/player.ts'); movePlayer(%d, %d); }" % (seed['dx'], seed['dy']))
            page.wait_for_timeout(150)
            pop = page.evaluate("""(() => {
              const pop = document.getElementById('event-popup');
              const btns = [...document.querySelectorAll('#ev-buttons .evb')];
              return { disp: pop.style.display,
                       title: document.getElementById('ev-title').textContent,
                       desc: document.getElementById('ev-desc').textContent,
                       n: btns.length, eas: btns.map(b => b.getAttribute('data-ea')),
                       loot: (btns[0] || {}).textContent || '' };
            })()""")
            title_ok = '回响' in pop['title'] or 'Echo of the Fallen' in pop['title']
            check('G1c stepping on the echo opens the popup with the epitaph (consumed entity)',
                  pop['disp'] == 'block' and title_ok and '冒烟墓志·第7层' in pop['desc'] and '冒烟风味·它还记得' in pop['desc'],
                  f"disp={pop['disp']} title={pop['title']} desc={pop['desc'][:40]}")
            check('G1c2 three actions rendered, loot leg names the keepsake',
                  pop['n'] == 3 and pop['eas'] == ['0', '1', '2'] and '冒烟遗物药剂' in pop['loot'],
                  f"n={pop['n']} eas={pop['eas']} loot={pop['loot'][:40]}")
            page.screenshot(path=os.path.join(OUT, 'echo_popup.png'))
            # --- 掠夺 (loot the keepsake): +10 corruption, keepsake lands in inv ---
            pre = page.evaluate("""async () => {
              const { G } = await import('/src/state.ts');
              G.player.corruption = 12; G.player.gold = 500;
              return { c: G.player.corruption, invLen: G.player.inv.length,
                       echoLeft: G.items.filter(i => i.npc === 'echo').length };
            }""")
            click_btn(page, '#ev-buttons .evb[data-ea="0"]')
            page.wait_for_timeout(150)
            post = page.evaluate("""async () => {
              const { G } = await import('/src/state.ts');
              return { c: G.player.corruption, hasK: G.player.inv.some(i => i.name === '冒烟遗物药剂'),
                       disp: document.getElementById('event-popup').style.display };
            }""")
            check('G1d 掠夺: corruption +10 and the keepsake lands in inv',
                  post['c'] == 22 and post['hasK'] and post['disp'] == 'none',
                  f"corruption {pre['c']} -> {post['c']} hasK={post['hasK']} disp={post['disp']}")
            # --- 掠夺 blocked by the 95 hard line (final-review I1): pin 90, the
            # loot button renders disabled+dimmed; the digit key '1' (input.ts
            # dispatches eventActions[0] past any disabled button) hits the
            # closure re-validation — nothing changes, popup stays open; then
            # 超度 (data-ea=1) works as the escape. ---
            page.evaluate("async () => { window.__bt10rec2 = window.__bt10rec; }")
            # Pin 90 BEFORE the step: the render-time disable is computed when
            # the popup opens (90+10 > 95 hard line).
            page.evaluate("(async () => { const { G } = await import('/src/state.ts'); G.player.corruption = 90; })()")
            spot = page.evaluate(PLACE_ECHO)
            page.evaluate("async () => { const { movePlayer } = await import('/src/player.ts'); movePlayer(%d, %d); }" % (spot['dx'], spot['dy']))
            page.wait_for_timeout(150)
            blocked = page.evaluate("""async () => {
              const { G } = await import('/src/state.ts');
              const b = document.querySelector('#ev-buttons .evb[data-ea="0"]');
              return { c: G.player.corruption, invLen: G.player.inv.length,
                       dis: b.disabled, op: b.style.opacity,
                       disp: document.getElementById('event-popup').style.display };
            }""")
            page.keyboard.press('1')
            page.wait_for_timeout(150)
            post = page.evaluate("(async () => { const { G } = await import('/src/state.ts'); return { c: G.player.corruption, invLen: G.player.inv.length, disp: document.getElementById('event-popup').style.display }; })()")
            check('G1d2 掠夺 blocked at the 95 line: rendered disabled+dimmed, digit-key attempt changes nothing, popup stays open',
                  blocked['dis'] and blocked['op'] == '0.45' and post['c'] == 90
                  and post['invLen'] == blocked['invLen'] and post['disp'] == 'block',
                  f"disabled={blocked['dis']} opacity={blocked['op']} corruption {blocked['c']} -> {post['c']} inv {blocked['invLen']} -> {post['invLen']} disp={post['disp']}")
            click_btn(page, '#ev-buttons .evb[data-ea="1"]')
            page.wait_for_timeout(150)
            esc = page.evaluate("(async () => { const { G } = await import('/src/state.ts'); return { c: G.player.corruption, disp: document.getElementById('event-popup').style.display }; })()")
            check('G1d3 超度 is the escape from the blocked loot: corruption -10 and the popup closes',
                  esc['c'] == 80 and esc['disp'] == 'none',
                  f"corruption 90 -> {esc['c']} disp={esc['disp']}")
            # --- 超度 (purify): -10 corruption + 40% maxHp heal ---
            page.evaluate("async () => { window.__bt10rec2 = window.__bt10rec; }")
            spot = page.evaluate(PLACE_ECHO)
            page.evaluate("async () => { const { movePlayer } = await import('/src/player.ts'); movePlayer(%d, %d); }" % (spot['dx'], spot['dy']))
            page.wait_for_timeout(150)
            pre = page.evaluate("""async () => {
              const { G } = await import('/src/state.ts');
              G.player.corruption = 30;
              G.player.hp = Math.floor(G.player.maxHp * 0.2);
              return { c: G.player.corruption, hp: G.player.hp, maxHp: G.player.maxHp };
            }""")
            click_btn(page, '#ev-buttons .evb[data-ea="1"]')
            page.wait_for_timeout(150)
            post = page.evaluate("(async () => { const { G } = await import('/src/state.ts'); return { c: G.player.corruption, hp: G.player.hp }; })()")
            expect_hp = min(pre['maxHp'], pre['hp'] + int(pre['maxHp'] * 0.4))
            check('G1e 超度: corruption -10 and hp healed by 40% maxHp (capped)',
                  post['c'] == 20 and post['hp'] == expect_hp,
                  f"corruption {pre['c']} -> {post['c']}, hp {pre['hp']} -> {post['hp']} (expected {expect_hp}, maxHp {pre['maxHp']})")
            # --- 继承 (inherit): dh_meta soulEchoes +30 ---
            spot = page.evaluate(PLACE_ECHO)
            page.evaluate("async () => { const { movePlayer } = await import('/src/player.ts'); movePlayer(%d, %d); }" % (spot['dx'], spot['dy']))
            page.wait_for_timeout(150)
            pre = page.evaluate("(async () => { const { getMeta } = await import('/src/meta.ts'); return getMeta().soulEchoes; })()")
            click_btn(page, '#ev-buttons .evb[data-ea="2"]')
            page.wait_for_timeout(150)
            post = page.evaluate("(async () => { const { getMeta } = await import('/src/meta.ts'); return getMeta().soulEchoes; })()")
            check('G1f 继承: dh_meta soulEchoes +30', post == pre + 30, f"{pre} -> {post}")
            # --- 掠夺 fallback (keepsake-less record): +5 corruption, +50 gold ---
            page.evaluate("""async () => {
              const rec = Object.assign({}, window.__bt10rec, { keepsake: null });
              window.__bt10rec2 = rec;
            }""")
            spot = page.evaluate(PLACE_ECHO)
            page.evaluate("async () => { const { movePlayer } = await import('/src/player.ts'); movePlayer(%d, %d); }" % (spot['dx'], spot['dy']))
            page.wait_for_timeout(150)
            lbl = page.evaluate("(() => document.querySelector('#ev-buttons .evb[data-ea=\"0\"]').textContent)()")
            pre = page.evaluate("(async () => { const { G } = await import('/src/state.ts'); G.player.corruption = 7; return { c: G.player.corruption, gold: G.player.gold }; })()")
            click_btn(page, '#ev-buttons .evb[data-ea="0"]')
            page.wait_for_timeout(150)
            post = page.evaluate("(async () => { const { G } = await import('/src/state.ts'); return { c: G.player.corruption, gold: G.player.gold }; })()")
            empty_ok = '翻捡残烬' in lbl or 'Sift the ashes' in lbl
            check('G1g 掠夺 fallback (no keepsake): +5 corruption, +50 gold, ashes label',
                  empty_ok and post['c'] == 12 and post['gold'] == pre['gold'] + 50,
                  f"label={lbl[:30]} corruption {pre['c']} -> {post['c']}, gold {pre['gold']} -> {post['gold']}")

        group(page, 'G1 回响全环', g1)

        # ---- G2  宝藏双价签 ---------------------------------------------------------
        def g2():
            close_popup(page)
            prep = page.evaluate("""async () => {
              const st = await import('/src/state.ts');
              const ev = await import('/src/events.ts');
              const meta = await import('/src/meta.ts');
              st.G.floor = 5;   // pin: r3=420+40=460, r4=880+40=920 -> 🩸10 / 🩸20
              st.G.player.corruption = 0;
              st.G.player.gold = 2000;
              meta.discoverItem('weapon:冒烟宝刃'); meta.discoverItem('weapon:冒烟神刃');
              const ent = { type: 'consumable', name: '宝藏商人', ch: '¤', c: '#ffd700', desc: '',
                            x: st.G.player.x, y: st.G.player.y, rarity: 4, npc: 'treasure_merchant',
                            stock: [ { type: 'weapon', name: '冒烟宝刃', ch: '†', c: '#ffd700', desc: 'r3', rarity: 3, atk: 5, x: 0, y: 0 },
                                     { type: 'weapon', name: '冒烟神刃', ch: '†', c: '#ffd700', desc: 'r4', rarity: 4, atk: 9, x: 0, y: 0 } ] };
              window.__bt10shop = ent;
              window.__bt10r3 = ent.stock[0];   // identity survives the splice
              ev.triggerNpc(ent);   // stock pre-seeded -> no re-roll
              return { btns: [...document.querySelectorAll('#ev-buttons .evb')].map(b => ({ txt: b.textContent, dis: b.disabled, op: b.style.opacity })),
                       c: st.G.player.corruption, gold: st.G.player.gold, stock: ent.stock.length,
                       disp: document.getElementById('event-popup').style.display };
            }""")
            btn_txt = ' | '.join(b['txt'] or '' for b in prep['btns'])
            check('G2a dual price tags render: 💰 AND 🩸 legs per item (5 buttons, none disabled)',
                  prep['disp'] == 'block' and len(prep['btns']) == 5 and '-460💰' in btn_txt and '-🩸10' in btn_txt
                  and '-920💰' in btn_txt and '-🩸20' in btn_txt and not any(b['dis'] for b in prep['btns']),
                  btn_txt[:120])
            page.screenshot(path=os.path.join(OUT, 'dual_shop.png'))
            # 🩸 purchase (r3): corruption +10, gold byte-unchanged, stock spliced.
            # msgs snapshot BEFORE the click (G5b crib) — the message lock below
            # diffs the slice added by this purchase only.
            pre_b = page.evaluate("(async () => { const { G } = await import('/src/state.ts'); return G.msgs.length; })()")
            click_btn(page, '#ev-buttons .evb:nth-child(2)')
            page.wait_for_timeout(150)
            bought = page.evaluate("""(async () => {
              const st = await import('/src/state.ts');
              const i18n = await import('/src/i18n.ts');
              const ent = window.__bt10shop;
              const p = st.G.player;
              const it = window.__bt10r3;   // the pre-splice stock identity
              const held = p.inv.includes(it) || Object.values(p.eq || {}).includes(it);
              return { c: p.corruption, gold: p.gold, stock: ent.stock.length, held,
                       disp: document.getElementById('event-popup').style.display,
                       btns: document.querySelectorAll('#ev-buttons .evb').length,
                       msgs: st.G.msgs.slice(%d).map(m => m.text),
                       expect: i18n.tMsg('ev.boughtCorrupt', '10') };
            })()""" % pre_b)
            check('G2b 🩸 purchase: corruption +10, gold unchanged, stock spliced, item held, popup re-rendered',
                  bought['c'] == 10 and bought['gold'] == 2000 and bought['stock'] == 1 and bought['held']
                  and bought['disp'] == 'block' and bought['btns'] == 3,
                  f"corruption={bought['c']} gold={bought['gold']} stock={bought['stock']} held={bought['held']} btns={bought['btns']} disp={bought['disp']}")
            check('G2b2 🩸 leg success message = LIVE ev.boughtCorrupt with the 🩸 figure 10 (batch11 A lock; gold figure would fail)',
                  bought['expect'] in bought['msgs'],
                  f"msgs={bought['msgs'][:2]}")
            # 💰 leg regression (r4 at 920): gold -920, corruption untouched.
            # Message lock mirrors G5b: the gold leg keeps its ORIGINAL
            # ev.boughtTreasure(name, price) message — batch11 A must have
            # touched only the corruption leg.
            pre_g = page.evaluate("(async () => { const { G } = await import('/src/state.ts'); return G.msgs.length; })()")
            click_btn(page, '#ev-buttons .evb:nth-child(1)')
            page.wait_for_timeout(150)
            gold_leg = page.evaluate("""(async () => {
              const st = await import('/src/state.ts');
              const i18n = await import('/src/i18n.ts');
              const ent = window.__bt10shop;
              const p = st.G.player;
              return { c: p.corruption, gold: p.gold, stock: ent.stock.length,
                       held: p.inv.some(i => i.name === '冒烟神刃') || Object.values(p.eq || {}).some(i => i && i.name === '冒烟神刃'),
                       disp: document.getElementById('event-popup').style.display,
                       msgs: st.G.msgs.slice(%d).map(m => m.text),
                       expect: i18n.tMsg('ev.boughtTreasure', '冒烟神刃', '920') };
            })()""" % pre_g)
            check('G2c 💰 leg regression: gold -920, corruption untouched, sold-out shop closes',
                  gold_leg['gold'] == 1080 and gold_leg['c'] == 10 and gold_leg['stock'] == 0 and gold_leg['held'] and gold_leg['disp'] == 'none',
                  f"gold=2000 -> {gold_leg['gold']} corruption={gold_leg['c']} stock={gold_leg['stock']} held={gold_leg['held']} disp={gold_leg['disp']}")
            check('G2c2 💰 leg keeps the ORIGINAL gold message: LIVE ev.boughtTreasure(冒烟神刃, 920) in its msgs diff',
                  gold_leg['expect'] in gold_leg['msgs'],
                  f"msgs={gold_leg['msgs'][:3]}")

        group(page, 'G2 宝藏双价签', g2)

        # ---- G3  神龛暗黑契约 -------------------------------------------------------
        def g3():
            close_popup(page)
            prep = page.evaluate("""async () => {
              const st = await import('/src/state.ts');
              const cfg = await import('/src/config.ts');
              const g = st.G, p = g.player;
              g.enemies = []; g.traps = [];
              p.corruption = 0;   // A3 gate: clean players get the choice popup
              for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const x = p.x + dx, y = p.y + dy;
                if (x < 0 || y < 0 || x >= cfg.MW || y >= cfg.MH) continue;
                if (g.dungeon.map[y][x] !== cfg.TL.FLOOR) continue;
                if (g.items.some(i => i.x === x && i.y === y)) continue;
                g.dungeon.map[y][x] = cfg.TL.SHRINE;
                return { dx, dy, atk: p.baseAtk, def: p.baseDef, mhp: p.baseMaxHp, c: p.corruption, x, y };
              }
              return null;
            }""")
            if not prep:
                check('G3 prep', False, 'no clean adjacent tile for the shrine')
                return
            page.evaluate("async () => { const { movePlayer } = await import('/src/player.ts'); movePlayer(%d, %d); }" % (prep['dx'], prep['dy']))
            page.wait_for_timeout(150)
            pop = page.evaluate("""(() => {
              const btns = [...document.querySelectorAll('#ev-buttons .evb')];
              return { disp: document.getElementById('event-popup').style.display,
                       title: document.getElementById('ev-title').textContent,
                       desc: document.getElementById('ev-desc').textContent,
                       n: btns.length, pact: (btns[1] || {}).textContent || '' };
            })()""")
            title_ok = '古代神殿' in pop['title'] or 'Ancient Shrine' in pop['title']
            desc_ok = '神龛低鸣' in pop['desc'] or 'shrine hums' in pop['desc']
            check('G3a corruption-0 shrine step opens the two-choice popup',
                  pop['disp'] == 'block' and title_ok and desc_ok and pop['n'] == 2 and '+15🩸' in pop['pact'],
                  f"disp={pop['disp']} title={pop['title']} desc={pop['desc'][:24]} n={pop['n']} pact={pop['pact'][:34]}")
            click_btn(page, '#ev-buttons .evb[data-ea="1"]')   # [2] 暗黑契约
            page.wait_for_timeout(150)
            post = page.evaluate("""(async () => {
              const cfg = await import('/src/config.ts');
              const { G } = await import('/src/state.ts');
              return { atk: G.player.baseAtk, def: G.player.baseDef, mhp: G.player.baseMaxHp,
                       c: G.player.corruption,
                       tile: G.dungeon.map[%d][%d], floorTile: cfg.TL.FLOOR,
                       disp: document.getElementById('event-popup').style.display };
            })()""" % (prep['y'], prep['x']))
            check('G3b dark pact: baseAtk +4 (baseDef +4, baseMaxHp +20), corruption 15, tile consumed',
                  post['atk'] == prep['atk'] + 4 and post['def'] == prep['def'] + 4 and post['mhp'] == prep['mhp'] + 20
                  and post['c'] == 15 and post['tile'] == post['floorTile'] and post['disp'] == 'none',
                  f"atk {prep['atk']}->{post['atk']} def {prep['def']}->{post['def']} baseMaxHp {prep['mhp']}->{post['mhp']} corruption={post['c']} tile={post['tile']}")

        group(page, 'G3 神龛暗黑契约', g3)

        # ---- G4  支付封锁 -----------------------------------------------------------
        def g4():
            close_popup(page)
            blocked = page.evaluate("""async () => {
              const st = await import('/src/state.ts');
              const ev = await import('/src/events.ts');
              const cost = await import('/src/cost.ts');
              st.G.player.corruption = 85;   // 85+20 > 95 hard line
              const leaf = { p920: cost.corruptionPriceOf(920),
                             blocked: !cost.canPayCorruption(85, 20),
                             boundary: cost.canPayCorruption(85, 10) };   // 95 itself allowed
              const ent = { type: 'consumable', name: '封锁宝藏商人', ch: '¤', c: '#ffd700', desc: '',
                            x: st.G.player.x, y: st.G.player.y, rarity: 4, npc: 'treasure_merchant',
                            stock: [ { type: 'weapon', name: '冒烟封锁神刃', ch: '†', c: '#ffd700', desc: 'r4', rarity: 4, atk: 9, x: 0, y: 0 } ] };
              ev.triggerNpc(ent);
              const btns = [...document.querySelectorAll('#ev-buttons .evb')];
              return { leaf, goldBtn: { dis: btns[0].disabled, txt: btns[0].textContent },
                       cBtn: { dis: btns[1].disabled, op: btns[1].style.opacity, txt: btns[1].textContent,
                               title: btns[1].getAttribute('title') || btns[1].title || '' },
                       n: btns.length };
            }""")
            check('G4a cost.ts leaf: corruptionPriceOf(920)=20; 85+20 blocked; 85+10 boundary allowed',
                  blocked['leaf']['p920'] == 20 and blocked['leaf']['blocked'] and blocked['leaf']['boundary'],
                  str(blocked['leaf']))
            check('G4b at corruption 85 the 🩸20 button is disabled+dimmed while the 💰 leg stays enabled',
                  blocked['n'] == 3 and blocked['cBtn']['dis'] and blocked['cBtn']['op'] == '0.45'
                  and not blocked['goldBtn']['dis'] and '-🩸20' in blocked['cBtn']['txt'] and '-920💰' in blocked['goldBtn']['txt'],
                  f"cBtn(dis={blocked['cBtn']['dis']}, op={blocked['cBtn']['op']}, txt={blocked['cBtn']['txt'][:36]}) goldBtn(dis={blocked['goldBtn']['dis']})")

        group(page, 'G4 支付封锁', g4)

        # ---- G5  无尽商人双腿 -------------------------------------------------------
        def g5():
            quit_to_title(page)   # G4 leaves a live run + open popup -> fresh run
            start_game(page)
            prep = page.evaluate("""async () => {
              const st = await import('/src/state.ts');
              const ev = await import('/src/events.ts');
              const meta = await import('/src/meta.ts');
              const { t, tx } = await import('/src/i18n.ts');
              const { RELICS } = await import('/src/data.ts');
              st.G.floor = 5;   // pin: gear 5*80=400 -> 🩸9, relic 5*200=1000 -> 🩸22 (cost.ts leaf)
              st.G.player.corruption = 0;
              st.G.player.gold = 5000;
              const mk = (name) => ({ type: 'weapon', name, ch: '↯', c: '#f4845f', desc: '+12 攻击',
                                      rarity: 5, atk: 12, x: 0, y: 0 });
              const g1 = mk('冒烟虚空刃·甲'), g2 = mk('冒烟虚空刃·乙'), g3 = mk('冒烟虚空刃·丙');
              // pre-discover -> no first-pickup intro card over the shop (G2 crib)
              meta.discoverItem('weapon:冒烟虚空刃·甲'); meta.discoverItem('weapon:冒烟虚空刃·乙');
              meta.discoverItem('weapon:冒烟虚空刃·丙'); meta.discoverItem('relic:void_heart');
              const rdef = RELICS.find(r => r.id === 'void_heart');
              const stock = [
                { kind: 'gear', item: g1, price: 400, label: g1.name, desc: g1.desc, ch: g1.ch },
                { kind: 'gear', item: g2, price: 400, label: g2.name, desc: g2.desc, ch: g2.ch },
                { kind: 'gear', item: g3, price: 400, label: g3.name, desc: g3.desc, ch: g3.ch },
                { kind: 'relic', relicId: 'void_heart', price: 1000, label: rdef ? tx(rdef.n) : '虚空之心', desc: '', ch: rdef ? rdef.ch : '♥' },
                { kind: 'purge', price: 200, label: '净化腐化', desc: '', ch: '🜔' },
                { kind: 'heal', price: 150, label: '完全治疗', desc: '', ch: '❤' },
              ];
              const ent = { type: 'consumable', name: t('enm.entityName'), ch: '∞', c: '#9b5de5', desc: '',
                            x: st.G.player.x, y: st.G.player.y, rarity: 5, npc: 'endless_merchant',
                            spriteKind: 'MERCHANT_ENDLESS', stock };
              window.__bt11shop = ent;
              ev.triggerNpc(ent);   // stock pre-seeded -> no rollEndlessStock re-roll
              return { btns: [...document.querySelectorAll('#ev-buttons .evb')].map(b => ({ txt: b.textContent, dis: b.disabled })),
                       c: st.G.player.corruption, gold: st.G.player.gold,
                       disp: document.getElementById('event-popup').style.display };
            }""")
            if not prep or prep.get('disp') != 'block':
                check('G5 seed/endless shop opens', False, str(prep)[:200])
                return
            txt = [b['txt'] or '' for b in prep['btns']]
            # pairs: g1/g2/g3 (400💰 / 🩸9) then relic (1000💰 / 🩸22), in DOM order
            pairs_ok = all(f'-{p}💰' in txt[2 * i] and f'-🩸{c}' in txt[2 * i + 1]
                           for i, (p, c) in enumerate([(400, 9), (400, 9), (400, 9), (1000, 22)]))
            services_ok = '-200💰' in txt[8] and '🩸' not in txt[8] and '-150💰' in txt[9] and '🩸' not in txt[9]
            check('G5a full stock: 11 buttons, gear×3+relic dual-leg pairs (🩸 9,9,9,22), purge/heal gold-only, leave without [11] prefix',
                  len(prep['btns']) == 11 and pairs_ok and services_ok and '[11]' not in txt[10]
                  and not any(b['dis'] for b in prep['btns']),
                  ' | '.join(txt)[:150])
            page.screenshot(path=os.path.join(OUT, 'endless_shop.png'))
            # 🩸 leg of the FIRST gear (button 2): corruption +9, gold untouched,
            # success message = live ev.boughtCorrupt (batch11 A), one PAIR spliced.
            pre = page.evaluate("(async () => { const { G } = await import('/src/state.ts'); return { c: G.player.corruption, gold: G.player.gold, msgs: G.msgs.length }; })()")
            click_btn(page, '#ev-buttons .evb:nth-child(2)')
            page.wait_for_timeout(150)
            bought = page.evaluate("""async () => {
              const st = await import('/src/state.ts');
              const i18n = await import('/src/i18n.ts');
              const p = st.G.player;
              return { c: p.corruption, gold: p.gold,
                       held: p.inv.some(i => i.name === '冒烟虚空刃·甲') || Object.values(p.eq || {}).some(i => i && i.name === '冒烟虚空刃·甲'),
                       msgs: st.G.msgs.slice(%d).map(m => m.text),
                       expect: i18n.tMsg('ev.boughtCorrupt', '9'),
                       stock: window.__bt11shop.stock.length,
                       btns: document.querySelectorAll('#ev-buttons .evb').length,
                       disp: document.getElementById('event-popup').style.display };
            }""" % pre['msgs'])
            check('G5b gear 🩸 leg: corruption +9, gold unchanged, boughtCorrupt message, pair spliced (11 -> 9 buttons)',
                  bought['c'] == 9 and bought['gold'] == 5000 and bought['expect'] in bought['msgs']
                  and bought['stock'] == 5 and bought['btns'] == 9 and bought['disp'] == 'block' and bought['held'],
                  f"c={bought['c']} gold={bought['gold']} stock={bought['stock']} btns={bought['btns']} msgs={bought['msgs'][:2]}")
            # relic 💰 leg (button 5 after the re-render): gold -1000, corruption untouched.
            click_btn(page, '#ev-buttons .evb:nth-child(5)')
            page.wait_for_timeout(150)
            gold_leg = page.evaluate("""(async () => {
              const st = await import('/src/state.ts');
              const p = st.G.player;
              return { c: p.corruption, gold: p.gold, relic: (p.relics || []).includes('void_heart'),
                       stock: window.__bt11shop.stock.length,
                       btns: document.querySelectorAll('#ev-buttons .evb').length,
                       disp: document.getElementById('event-popup').style.display };
            })()""")
            check('G5c relic 💰 leg regression: gold -1000, corruption untouched, relic granted',
                  gold_leg['gold'] == 4000 and gold_leg['c'] == 9 and gold_leg['relic']
                  and gold_leg['stock'] == 4 and gold_leg['disp'] == 'block',
                  f"gold 5000 -> {gold_leg['gold']} c={gold_leg['c']} relic={gold_leg['relic']} stock={gold_leg['stock']} btns={gold_leg['btns']}")
            click_btn(page, '#ev-buttons .evb:nth-child(%d)' % gold_leg['btns'])   # Leave
            page.wait_for_timeout(150)
            closed = page.evaluate("document.getElementById('event-popup').style.display")
            check('G5 teardown Leave closes the endless shop (no dangling state)',
                  closed == 'none', f"disp={closed}")

        group(page, 'G5 无尽商人双腿', g5)

        # ---- G6  真死亡回响闭环 -----------------------------------------------------
        def g6():
            quit_to_title(page)   # fresh run: playerDeath must fire on a real, live one
            start_game(page)
            death = page.evaluate("""async () => {
              const st = await import('/src/state.ts');
              const meta = await import('/src/meta.ts');
              const combat = await import('/src/combat.ts');
              const g = st.G, p = g.player;
              const before = (meta.getMeta().echoes || []).slice();   // pool snapshot — restored at the end
              window.__bt11pool = before;
              // Keepsake rig: r4 weapon + r0 filler -> pickKeepsake deterministically
              // picks the weapon through the REAL death path (pool = inv + eq slots).
              p.inv.push({ type: 'weapon', name: '验尸剑', ch: '†', c: '#ffd700', desc: 'battery keepsake (high)',
                           rarity: 4, atk: 9, x: 0, y: 0 });
              p.inv.push({ type: 'armor', name: '验尸布袍', ch: '[', c: '#9b9b9b', desc: 'battery keepsake (low)',
                           rarity: 0, def: 1, x: 0, y: 0 });
              p.corruption = 33;   // distinctive: the record must snapshot the live value
              const pre = { floor: g.floor, ci: p.ci, c: p.corruption, turns: p.turns };
              combat.playerDeath('闭环验证者', 'combat');   // the REAL death path (combat.ts:429)
              const m = JSON.parse(localStorage.getItem('dh_meta') || '{}');
              return { pre, beforeLen: before.length, before0: before[0] || null,
                       rec: (m.echoes || [])[0] || null, next: (m.echoes || [])[1] || null,
                       nowMs: Date.now(), deathScreen: document.getElementById('death-screen').style.display };
            }""")
            if not death or not death.get('rec'):
                check('G6 real playerDeath wrote an echo record', False, str(death)[:200])
                return
            rec, pre = death['rec'], death['pre']
            ep = rec.get('epitaph') or {}
            newest_ok = death['beforeLen'] == 0 or death['next'] == death['before0']
            check('G6a real playerDeath -> recordEcho to dh_meta: newest first (echoes[0]), cause/killer/floor/classIdx/corruption snapshot, ts fresh, epitaph filled',
                  rec.get('cause') == 'combat' and rec.get('killer') == '闭环验证者'
                  and rec.get('floor') == pre['floor'] and rec.get('classIdx') == pre['ci']
                  and rec.get('corruption') == pre['c'] and abs(death['nowMs'] - rec.get('ts', 0)) < 120000
                  and isinstance(ep.get('template'), str) and ep.get('template')
                  and isinstance(ep.get('flavor'), str) and ep.get('flavor')
                  and newest_ok and death['deathScreen'] == 'flex',
                  f"killer={rec.get('killer')} floor={rec.get('floor')}/{pre['floor']} ci={rec.get('classIdx')}/{pre['ci']} "
                  f"c={rec.get('corruption')}/{pre['c']} tsΔ={death['nowMs'] - rec.get('ts', 0)}ms beforeLen={death['beforeLen']}")
            ks = rec.get('keepsake') or {}
            check('G6b pickKeepsake real path picked the highest-rarity injected piece (验尸剑 r4 over the r0 filler)',
                  ks.get('name') == '验尸剑' and ks.get('rarity') == 4,
                  f"keepsake={ks.get('name')} rarity={ks.get('rarity')}")
            # Closed loop, second half: trim the pool to exactly this record (determinism),
            # start a NEW run through the real death-screen UI, draw the echo at F2
            # (35% gate, bounded 20 rolls + deterministic push fallback — G1 crib),
            # step on it: THIS run's epitaph greets the next run.
            page.evaluate("""async () => {
              const meta = await import('/src/meta.ts');
              const m = meta.getMeta();
              const rec = m.echoes[0];
              window.__bt11rec = rec;
              meta.saveMeta({ ...m, echoes: [rec] });
            }""")
            restart_from_death(page)
            seed = page.evaluate("""async () => {
              const st = await import('/src/state.ts');
              const cfg = await import('/src/config.ts');
              const game = await import('/src/game.ts');
              const { t } = await import('/src/i18n.ts');
              const g = st.G;
              const rec = window.__bt11rec;
              let natural = null, rolls = 0;
              for (let i = 0; i < 20 && !natural; i++) {
                game.enterFloor(2, true); rolls++;
                natural = g.items.find(it => it.npc === 'echo' && it.echo) || null;
              }
              let ent = natural;
              if (!ent) {
                const p = g.player;
                let spot = null;
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                  const x = p.x + dx, y = p.y + dy;
                  if (x < 0 || y < 0 || x >= cfg.MW || y >= cfg.MH) continue;
                  if (g.dungeon.map[y][x] !== cfg.TL.FLOOR) continue;
                  if (g.items.some(i => i.x === x && i.y === y)) continue;
                  spot = { x, y }; break;
                }
                if (!spot) return { ok: false, why: 'no clean neighbor for the fallback push' };
                ent = { type: 'consumable', name: t('ev.echoTitle'), ch: 'Ω', c: '#9d8df1', desc: '',
                        x: spot.x, y: spot.y, rarity: 2, npc: 'echo', echo: rec, spriteKind: 'ECHO' };
                g.items.push(ent);
              }
              g.enemies = []; g.traps = [];
              g.dungeon.map[ent.y][ent.x] = cfg.TL.FLOOR;
              g.items = g.items.filter(i => !(i.x === ent.x && i.y === ent.y && !i.npc));
              let stand = null;
              for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const x = ent.x + dx, y = ent.y + dy;
                if (x < 0 || y < 0 || x >= cfg.MW || y >= cfg.MH) continue;
                if (g.dungeon.map[y][x] !== cfg.TL.FLOOR) continue;
                stand = { x, y }; break;
              }
              if (!stand) return { ok: false, why: 'echo has no walkable neighbor' };
              g.player.x = stand.x; g.player.y = stand.y;
              return { ok: true, natural: !!natural, rolls,
                       dx: ent.x - stand.x, dy: ent.y - stand.y,
                       floor: g.floor, tpl: rec.epitaph.template };
            }""")
            if not seed or not seed.get('ok'):
                check('G6c echo spawn seed (35% gate, bounded rolls + fallback)', False, str(seed))
            else:
                page.evaluate("async () => { const { movePlayer } = await import('/src/player.ts'); movePlayer(%d, %d); }" % (seed['dx'], seed['dy']))
                page.wait_for_timeout(150)
                pop = page.evaluate("""(() => ({
                  disp: document.getElementById('event-popup').style.display,
                  title: document.getElementById('ev-title').textContent,
                  desc: document.getElementById('ev-desc').textContent,
                }))()""")
                title_ok = '回响' in pop['title'] or 'Echo of the Fallen' in pop['title']
                check('G6c closed loop: the NEXT run meets this death on the map — popup carries the real epitaph (killer on screen)',
                      pop['disp'] == 'block' and title_ok and '闭环验证者' in pop['desc'] and seed['tpl'] in pop['desc']
                      and seed['floor'] == 2,
                      f"disp={pop['disp']} title={pop['title']} natural={seed['natural']} rolls={seed['rolls']} desc={pop['desc'][:44]}")
            # Restore the pre-G6 pool — G1's crafted records stay, this group leaves
            # no trace (the script must be re-runnable with identical state).
            restored = page.evaluate("""async () => {
              const meta = await import('/src/meta.ts');
              const m = meta.getMeta();
              meta.saveMeta({ ...m, echoes: window.__bt11pool });
              return (JSON.parse(localStorage.getItem('dh_meta') || '{}').echoes || []).length;
            }""")
            check('G6 teardown restores the pre-G6 echo pool (re-runnable, no pollution)',
                  restored == death['beforeLen'], f"restored={restored} before={death['beforeLen']}")

        group(page, 'G6 真死亡回响闭环', g6)

        browser.close()

    bad = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(bad)}/{len(results)} checks passed"
          + (' — ALL GREEN' if not bad else ''))
    favicon_only = bool(http_404s) and all('favicon' in u for u in http_404s)
    ce = [] if (favicon_only and not [e for e in console_errors if 'Failed to load resource' not in e]) else [e for e in console_errors if '/favicon' not in e]
    print(f"Console errors: {len(ce)}")
    for e in ce[:5]:
        print('  ERR:', e[:140])
    print(f"Screenshots: {OUT}")
    sys.exit(1 if bad or ce else 0)


if __name__ == '__main__':
    main()
