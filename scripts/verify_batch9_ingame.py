# In-game verification for feat/batch9-experience-polish (批9 体验打磨 T8).
# Runs against the Vite DEV server so page.evaluate can `import('/src/*.ts')`
# and reach the SAME live module instances the game loop uses (batch2/3B/3C/4/5/
# 7-proven harness; same-instance ESM injection dodges the HMR '?t=' second-
# instance trap). Zero console errors enforced (favicon 404 whitelisted).
# Seven assertion groups over the batch's seven review-gated fixes + the
# final-review riders:
#   S1 商人常驻 (merchant persists): place a merchant entity adjacent via the
#      live G — WITH a gold pile co-located on its tile (final-review F1 net:
#      the pre-fix npc branch never picked up non-NPC items on that tile) —
#      then REAL movePlayer() onto it -> event popup opens; gold increased
#      (pile picked up) AND entity still in G.items (sweep spares NPCs); ESC ->
#      closed; walk away + back -> popup opens again (re-interactable shop);
#      rider: live pickupItem() ('g') on the merchant keeps it in G.items AND
#      picks co-located non-gold loot (gold is auto-pickup-only by design).
#   S2 售卖收口 (sell-mode scoping): from the open merchant popup press [2]
#      (eventActions digit -> merchantSell -> bridge.openSellInv) -> inventory
#      overlay active + sellMode true (live `export let` read) + hint rendered;
#      digit [1] sells (gold up, inv empty); ✕ (#btn-close-inv) closes and
#      resets; plain reopen via 'b' -> sellMode false; a digit key then does
#      NOT sell (gold exactly unchanged — the pre-fix leak sold on digits).
#   S3 tooltip 死亡: dispatch a real mousemove over an adjacent live enemy's
#      tile (the same rect math initTooltip uses) -> after the 250ms debounce
#      #tooltip shows the enemy; remove the enemy + real updateUI() ->
#      validateTooltip hides it within that one pass.
#   S4 道具栏: .hb-slot computed width === 50px; focusing a slot carrying an
#      item syncs the full name into #hb-name (container-delegated focusin);
#      no .hb-slot carries a native title attribute.
#   S5 小地图持久: setMinimapScale(5) -> window resize event (320ms debounce)
#      AND a direct resizeCanvas() -> minimap-canvas.width === 70*5; descend
#      two floors (teleport to stairs + real descendStairs) -> still 350 after
#      each transition (zoom survives floor change).
#   S6 宝藏价格 + 售罄: G.floor pinned to 5 -> live treasurePrice({rarity:3/4})
#      === 460 / 920; a crafted treasure merchant (pre-seeded r3+r4 stock)
#      renders its buy buttons with exactly -460💰 / -920💰; final-review F2:
#      an entity with stock:[] shows the sold-out desc + exactly 1 (leave)
#      button, and a second triggerNpc keeps the SAME empty stock array (no
#      re-roll).
#   S7 移动端视口 (final-review F3): viewport 400x800 -> .hb-slot computed
#      max-width <= 54px, #hotbar scrollWidth <= clientWidth + 2 (no
#      horizontal overflow), hotbar height > slot height after a re-render
#      (flex-wrap rows accommodated, not clipped); restore 1280x800.
# Screenshots: smoke_out/batch9/{sell_mode,inv_normal,hud_final}.png
# Run: npm run dev -- --port 5173 --strictPort (FRESH server), then:
#      python scripts/verify_batch9_ingame.py
import io
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from playwright.sync_api import sync_playwright

BASE = 'http://localhost:5173'
OUT = os.path.join(os.path.dirname(__file__), 'smoke_out', 'batch9')
os.makedirs(OUT, exist_ok=True)

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
        # Chrome's favicon fetch often bypasses the response event — the URL
        # lives on the console message's location (batch7 crib: whitelist there).
        page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' and '/favicon' not in ((m.location or {}).get('url') or '') else None)
        page.on('pageerror', lambda e: console_errors.append(str(e)))
        page.on('response', lambda r: http_404s.append(r.url) if r.status == 404 else None)   # secondary evidence
        page.on('dialog', lambda d: d.accept())
        page.goto(BASE)
        page.wait_for_selector('#btn-new', state='visible')
        start_game(page)

        # ---- S1  商人常驻 -----------------------------------------------------------
        placed = page.evaluate("""async () => {
          const st = await import('/src/state.ts');
          const cfg = await import('/src/config.ts');
          const g = st.G, p = g.player;
          // Keep the away/back walk deterministic: no near enemies interfering.
          g.enemies = g.enemies.filter(e => Math.abs(e.x - p.x) + Math.abs(e.y - p.y) > 6);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const x = p.x + dx, y = p.y + dy;
            if (x < 0 || y < 0 || x >= cfg.MW || y >= cfg.MH) continue;
            const t = g.dungeon.map[y][x];
            if (t === cfg.TL.WALL || t === cfg.TL.VOID) continue;
            if (g.enemies.some(e => e.x === x && e.y === y)) continue;
            if (g.items.some(i => i.x === x && i.y === y)) continue;
            const ent = { type: 'consumable', name: '漂流商人', ch: '§', c: '#9b5de5', desc: '',
                          x, y, rarity: 1, npc: 'merchant', spriteKind: 'MERCHANT' };
            ent.__bt9m = 'm1';   // identity tag on the LIVE object
            g.items.push(ent);
            // Final-review F1 net: a gold pile co-located on the merchant tile.
            // Pre-fix the npc branch skipped the pickup loop entirely, so this
            // pile (and any enemy death-drop on the tile) would strand there.
            const pile = { type: 'gold', name: '冒烟金币堆', ch: '$', c: '#ffd700', desc: '',
                           x, y, rarity: 0, value: 123 };
            pile.__bt9g = 'g1';
            g.items.push(pile);
            return { dx, dy, gold: g.player.gold };
          }
          return null;
        }""")
        check('S1a merchant placed on a walkable adjacent tile', bool(placed), str(placed))
        page.evaluate("async () => { const { movePlayer } = await import('/src/player.ts'); movePlayer(%d, %d); }" % (placed['dx'], placed['dy']))
        page.wait_for_timeout(120)
        opened = page.evaluate("""(() => {
          const pop = document.getElementById('event-popup');
          return { disp: pop.style.display, title: document.getElementById('ev-title').textContent };
        })()""")
        check('S1b stepping on the merchant opens the shop popup', opened['disp'] == 'block' and bool(opened['title'].strip()), str(opened))
        picked = page.evaluate("""(async () => {
          const { G } = await import('/src/state.ts');
          return { gold: G.player.gold, merchant: G.items.some(i => i.__bt9m === 'm1'),
                   pile: G.items.some(i => i.__bt9g === 'g1') };
        })()""")
        check('S1b2 co-located gold picked up while the merchant survives the sweep',
              picked['gold'] > placed['gold'] and picked['merchant'] and not picked['pile'],
              f"gold {placed['gold']} -> {picked['gold']}, merchant={picked['merchant']}, pileLeft={picked['pile']}")
        page.keyboard.press('Escape')
        page.wait_for_timeout(80)
        closed = page.evaluate("document.getElementById('event-popup').style.display")
        persists = page.evaluate("(async () => { const { G } = await import('/src/state.ts'); return G.items.some(i => i.__bt9m === 'm1'); })()")
        check('S1c ESC closes AND the entity survives in G.items', closed == 'none' and persists, f'disp={closed} persists={persists}')
        page.evaluate("async () => { const { movePlayer } = await import('/src/player.ts'); movePlayer(%d, %d); }" % (-placed['dx'], -placed['dy']))
        page.wait_for_timeout(80)
        page.evaluate("async () => { const { movePlayer } = await import('/src/player.ts'); movePlayer(%d, %d); }" % (placed['dx'], placed['dy']))
        page.wait_for_timeout(120)
        again = page.evaluate("document.getElementById('event-popup').style.display")
        check('S1d walk away + back re-opens the shop (re-interactable)', again == 'block', again)
        # Final-review rider: the 'g' path (pickupItem) must respect merchant
        # persistence too — pre-rider it deleted ANY npc by identity and its
        # early return also stranded co-located loot (the F1 shape). Gold is
        # excluded from this path by design (`type !== 'gold'` filter), so the
        # co-located loot probe is a potion.
        page.keyboard.press('Escape')   # start from a closed popup, as a player would
        page.wait_for_timeout(80)
        gpath = page.evaluate("""(async () => {
          const st = await import('/src/state.ts');
          const meta = await import('/src/meta.ts');
          const g = st.G, p = g.player;
          // Pre-discover the probe item: the real pickup path routes through
          // queueItemIntro, whose first-pickup card sets introOpen — which
          // swallows every key except ESC/b and would starve S2's [2] press.
          // discoverItem-once = the "already discovered -> no card" branch.
          meta.discoverItem('potion:冒烟拾取药剂');
          const pot = { type: 'potion', name: '冒烟拾取药剂', ch: '!', c: '#e05555',
                        desc: 'battery junk', rarity: 1, ef: 'heal', x: p.x, y: p.y };
          pot.__bt9p = 'p1';
          g.items.push(pot);   // co-located non-NPC loot under the merchant
          const { pickupItem } = await import('/src/player.ts');
          pickupItem();
          return { merchant: g.items.some(i => i.__bt9m === 'm1'),
                   potionGone: !g.items.some(i => i.__bt9p === 'p1'),
                   invHas: p.inv.some(i => i.__bt9p === 'p1'),
                   pop: document.getElementById('event-popup').style.display };
        })()""")
        check("S1e 'g' on the merchant: popup opens, merchant survives, co-located loot picked",
              gpath['merchant'] and gpath['potionGone'] and gpath['invHas'] and gpath['pop'] == 'block', str(gpath))
        # S1e's pickupItem re-opened the merchant popup — exactly the state S2
        # expects when it presses [2], so it is deliberately left open.

        # ---- S2  售卖收口 -----------------------------------------------------------
        prep = page.evaluate("""async () => {
          const st = await import('/src/state.ts');
          const g = st.G;
          window.__bt9proto = g.enemies[0] || null;   // S3 fallback template
          g.enemies = [];                             // deterministic rest of battery
          g.player.inv.length = 0;
          g.player.inv.push({ type: 'potion', name: '冒烟旧药水', ch: '!', c: '#e05555',
                              desc: 'battery junk', rarity: 1, ef: 'heal', x: 0, y: 0 });
          return { gold: g.player.gold, inv: g.player.inv.length };
        }""")
        page.keyboard.press('2')   # eventActions digit -> merchantSell -> openSellInv
        page.wait_for_timeout(150)
        sell_open = page.evaluate("""(async () => {
          const panels = await import('/src/panels.ts');
          const ov = document.getElementById('inventory-overlay');
          const hint = [...document.querySelectorAll('#inv-content > div')].map(d => d.textContent).join('|');
          return { active: ov.classList.contains('active'), sellMode: panels.sellMode,
                   hintHasSell: hint.includes('售卖模式') || hint.includes('Sell mode') };
        })()""")
        check('S2a [2] opens inventory in sell mode (flag + hint)', sell_open['active'] and sell_open['sellMode'] and sell_open['hintHasSell'], str(sell_open))
        page.screenshot(path=os.path.join(OUT, 'sell_mode.png'))
        page.keyboard.press('1')   # sellItem(0) — digits DO sell while sellMode
        page.wait_for_timeout(120)
        sold = page.evaluate("(async () => { const { G } = await import('/src/state.ts'); return { gold: G.player.gold, inv: G.player.inv.length }; })()")
        check('S2b digit sells the item in sell mode (gold up, inv empty)', sold['gold'] > prep['gold'] and sold['inv'] == 0, f"gold {prep['gold']} -> {sold['gold']}, inv {sold['inv']}")
        page.click('#btn-close-inv')   # the ✕ path — must funnel through closeInventory
        page.wait_for_timeout(120)
        xclosed = page.evaluate("""(async () => {
          const panels = await import('/src/panels.ts');
          const ov = document.getElementById('inventory-overlay');
          return { active: ov.classList.contains('active'), sellMode: panels.sellMode };
        })()""")
        check('S2c ✕ (btn-close-inv) closes and resets sellMode', not xclosed['active'] and xclosed['sellMode'] is False, str(xclosed))
        page.keyboard.press('b')   # plain reopen — the pre-fix leak path
        page.wait_for_timeout(120)
        reopened = page.evaluate("""(async () => {
          const panels = await import('/src/panels.ts');
          const ov = document.getElementById('inventory-overlay');
          return { active: ov.classList.contains('active'), sellMode: panels.sellMode };
        })()""")
        check('S2d plain reopen via b has sellMode === false', reopened['active'] and reopened['sellMode'] is False, str(reopened))
        page.screenshot(path=os.path.join(OUT, 'inv_normal.png'))
        probe = page.evaluate("""async () => {
          const { G } = await import('/src/state.ts');
          G.player.inv.push({ type: 'potion', name: '冒烟诱饵药剂', ch: '!', c: '#e05555',
                              desc: 'battery junk', rarity: 1, ef: 'heal', x: 0, y: 0 });
          return { gold: G.player.gold, inv: G.player.inv.length };
        }""")
        page.keyboard.press('1')   # normal mode: use/equip at most — NEVER a sale
        page.wait_for_timeout(120)
        after = page.evaluate("(async () => { const { G } = await import('/src/state.ts'); return { gold: G.player.gold, inv: G.player.inv.length, intro: (await import('/src/state.ts')).introOpen }; })()")
        check('S2e digit after plain reopen does NOT sell (gold unchanged)', after['gold'] == probe['gold'], f"gold {probe['gold']} -> {after['gold']} (leak would add >=18), intro={after['intro']}")
        page.click('#btn-close-inv')
        page.wait_for_timeout(80)

        # ---- S3  tooltip 死亡 -------------------------------------------------------
        tt = page.evaluate("""async () => {
          const st = await import('/src/state.ts');
          const dun = await import('/src/dungeon.ts');
          const cfg = await import('/src/config.ts');
          const render = await import('/src/render.ts');
          const g = st.G, p = g.player;
          let spot = null;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const x = p.x + dx, y = p.y + dy;
            if (x < 0 || y < 0 || x >= cfg.MW || y >= cfg.MH) continue;
            const t = g.dungeon.map[y][x];
            if (t === cfg.TL.WALL || t === cfg.TL.VOID) continue;
            spot = { x, y }; break;
          }
          if (!spot) return { ok: false, why: 'no walkable neighbor' };
          const proto = window.__bt9proto || { name: '影子', ch: 'e', c: '#ff5555', hp: 10, maxHp: 10, atk: 1, def: 0,
                                               exp: 1, goldDrop: 1, ai: 'chase', stunned: 0, feared: 0,
                                               isAlly: false, el: 0, res: {}, skillCd: 0 };
          const e = Object.assign({}, proto, { x: spot.x, y: spot.y, hp: 10, maxHp: 10, name: '冒烟悬影' });
          g.enemies.push(e);
          dun.updatePlayerFOV(p, g.dungeon.map, g.traps);   // make the tile visible
          render.render();                                   // ensure G.vx/vy are set
          const cvs = document.getElementById('game-canvas');
          const rect = cvs.getBoundingClientRect();
          const effTS = rect.width / (cvs.width / 22);       // initTooltip's own math
          cvs.dispatchEvent(new MouseEvent('mousemove', {
            clientX: rect.left + (spot.x - g.vx + 0.5) * effTS,
            clientY: rect.top + (spot.y - g.vy + 0.5) * effTS, bubbles: true }));
          return { ok: true, visible: !!(p.visible && p.visible[spot.y] && p.visible[spot.y][spot.x]) };
        }""")
        check('S3a mousemove dispatched over a visible live enemy', tt.get('ok') and tt.get('visible'), str(tt))
        page.wait_for_timeout(420)   # 250ms tooltip debounce
        shown = page.evaluate("(() => { const t = document.getElementById('tooltip'); return { disp: t.style.display, txt: t.textContent }; })()")
        check('S3b tooltip shows the enemy after the debounce', shown['disp'] == 'block' and '冒烟悬影' in shown['txt'], str(shown)[:100])
        killed = page.evaluate("""async () => {
          const st = await import('/src/state.ts');
          const render = await import('/src/render.ts');
          st.G.enemies = st.G.enemies.filter(e => e.name !== '冒烟悬影');
          render.updateUI();   // one real validation pass (validateTooltip at its tail)
          return document.getElementById('tooltip').style.display;
        }""")
        check('S3c kill + updateUI hides the tooltip in one pass', killed == 'none', killed)

        # ---- S4  道具栏 -------------------------------------------------------------
        hb = page.evaluate("""async () => {
          const st = await import('/src/state.ts');
          const items = await import('/src/items.ts');
          const g = st.G, p = g.player;
          const it = { type: 'potion', name: '冒烟回春药剂', ch: '!', c: '#7ec8e3',
                       desc: 'battery hotbar item', rarity: 2, ef: 'heal', x: 0, y: 0 };
          p.inv.push(it);
          p.quickSlots[0] = it;
          items.renderHotbar();
          const slot = document.querySelector('.hb-slot[data-qs="0"]');
          const w = getComputedStyle(slot).width;
          slot.focus();   // real focus -> container-delegated focusin -> syncNameplate
          const plate = document.getElementById('hb-name');
          const titled = [...document.querySelectorAll('.hb-slot')].filter(s => s.hasAttribute('title')).length;
          return { w, name: plate.textContent, aria: plate.getAttribute('aria-hidden'), titled };
        }""")
        check('S4a focused slot computed width === 50px', hb['w'] == '50px', hb['w'])
        check('S4b #hb-name carries the full item name', '冒烟回春药剂' in (hb['name'] or ''), str(hb['name']))
        check('S4c no .hb-slot carries a native title attribute', hb['titled'] == 0, f"titled={hb['titled']} aria={hb['aria']}")

        # ---- S5  小地图持久 ---------------------------------------------------------
        page.evaluate("""async () => {
          const st = await import('/src/state.ts');
          st.setMinimapScale(5);
          window.dispatchEvent(new Event('resize'));   // main.ts 320ms-debounced resizeCanvas
        }""")
        page.wait_for_timeout(700)
        mm1 = page.evaluate("""(async () => {
          const st = await import('/src/state.ts');
          const render = await import('/src/render.ts');
          render.resizeCanvas();   // direct call too — the pre-fix bug lived here (MW*3)
          const mc = document.getElementById('minimap-canvas');
          return { w: mc.width, h: mc.height, scale: st.minimapScale };
        })()""")
        check('S5a scale 5 survives resize + direct resizeCanvas (70*5 x 45*5)', mm1['w'] == 350 and mm1['h'] == 225 and mm1['scale'] == 5, str(mm1))
        for leg in (1, 2):
            page.evaluate("""async () => {
              const st = await import('/src/state.ts');
              const cfg = await import('/src/config.ts');
              const g = st.G;
              for (let y = 0; y < cfg.MH; y++) for (let x = 0; x < cfg.MW; x++)
                if (g.dungeon.map[y][x] === cfg.TL.STAIR) { g.player.x = x; g.player.y = y; return; }
            }""")
            page.evaluate("async () => { const { descendStairs } = await import('/src/player.ts'); descendStairs(); }")
            page.wait_for_timeout(650)   # enterFloor's 200ms opacity transition + re-render
            mm = page.evaluate("(async () => { const st = await import('/src/state.ts'); return { floor: st.G.floor, w: document.getElementById('minimap-canvas').width, scale: st.minimapScale }; })()")
            check(f'S5b descent #{leg} keeps the minimap at 70*5', mm['floor'] == 1 + leg and mm['w'] == 350 and mm['scale'] == 5, str(mm))

        # ---- S6  宝藏价格 -----------------------------------------------------------
        tp = page.evaluate("""(async () => {
          const st = await import('/src/state.ts');
          const ev = await import('/src/events.ts');
          st.G.floor = 5;   // pin: base 420/880 + 5*8
          const p3 = ev.treasurePrice({ rarity: 3 }), p4 = ev.treasurePrice({ rarity: 4 });
          const ent = { type: 'consumable', name: '宝藏商人', ch: '¤', c: '#ffd700', desc: '',
                        x: st.G.player.x, y: st.G.player.y, rarity: 4, npc: 'treasure_merchant',
                        stock: [ { type: 'weapon', name: '冒烟宝刃', ch: '†', c: '#ffd700', desc: 'r3', rarity: 3, atk: 5, x: 0, y: 0 },
                                 { type: 'weapon', name: '冒烟神刃', ch: '†', c: '#ffd700', desc: 'r4', rarity: 4, atk: 9, x: 0, y: 0 } ] };
          ev.triggerNpc(ent);   // stock pre-seeded -> no re-roll
          return { p3, p4, btns: [...document.querySelectorAll('#ev-buttons .evb')].map(b => b.textContent) };
        })()""")
        check('S6a treasurePrice(F5) === 460 / 920', tp['p3'] == 460 and tp['p4'] == 920, f"r3={tp['p3']} r4={tp['p4']}")
        btn_txt = ' | '.join(tp['btns'])
        check('S6b treasure merchant UI prices are exactly -460💰 / -920💰', '-460💰' in btn_txt and '-920💰' in btn_txt, btn_txt[:110])
        # Final-review F2: behavioral net for the soldOut branch (desc swap, single
        # leave button, stock rolled exactly once — empty array is truthy so
        # `if (!entity.stock)` must NOT re-roll it on repeat visits).
        so = page.evaluate("""(async () => {
          const st = await import('/src/state.ts');
          const ev = await import('/src/events.ts');
          const ent = { type: 'consumable', name: '售罄宝藏商人', ch: '¤', c: '#ffd700', desc: '',
                        x: st.G.player.x, y: st.G.player.y, rarity: 4,
                        npc: 'treasure_merchant', stock: [] };
          ev.triggerNpc(ent);
          const first = { desc: document.getElementById('ev-desc').textContent,
                          btns: document.querySelectorAll('#ev-buttons .evb').length,
                          stock: ent.stock };
          ev.triggerNpc(ent);   // second visit — must keep the SAME stock
          return { desc: first.desc, btns: first.btns,
                   desc2: document.getElementById('ev-desc').textContent,
                   btns2: document.querySelectorAll('#ev-buttons .evb').length,
                   sameStock: ent.stock === first.stock };
        })()""")
        so_desc = so['desc'] or ''
        check('S6c sold-out merchant shows the sold-out copy + leave button only',
              (('售罄' in so_desc) or ('Sold out' in so_desc)) and so['btns'] == 1,
              f"btns={so['btns']} desc={so_desc[:40]}")
        check('S6d second triggerNpc keeps the SAME empty stock (no re-roll)',
              so['sameStock'] and so['btns2'] == 1 and so['desc'] == so['desc2'],
              f"sameStock={so['sameStock']} btns={so['btns']}->{so['btns2']}")
        page.keyboard.press('Escape')
        page.wait_for_timeout(120)

        # ---- S7  移动端视口 (final-review F3) ---------------------------------------
        page.set_viewport_size({'width': 400, 'height': 800})
        page.wait_for_timeout(250)   # media queries apply synchronously; debounce settle
        mob = page.evaluate("""(async () => {
          const items = await import('/src/items.ts');
          items.renderHotbar();   // re-render at the narrow width
          const hb = document.getElementById('hotbar');
          const slot = document.querySelector('.hb-slot');
          const rows = new Set([...document.querySelectorAll('.hb-slot')].map(s => s.offsetTop)).size;
          return { maxW: parseFloat(getComputedStyle(slot).maxWidth),
                   sw: hb.scrollWidth, cw: hb.clientWidth,
                   hbH: hb.offsetHeight, slotH: slot.offsetHeight, rows };
        })()""")
        check('S7a 400px viewport: .hb-slot computed max-width <= 54px', mob['maxW'] <= 54, f"maxWidth={mob['maxW']}px")
        check('S7b #hotbar has no horizontal overflow (scrollWidth <= clientWidth + 2)', mob['sw'] <= mob['cw'] + 2, f"sw={mob['sw']} cw={mob['cw']}")
        check('S7c hotbar height accommodates its rows (hbH > slot height, no clipping)', mob['hbH'] > mob['slotH'], f"hb={mob['hbH']}px slot={mob['slotH']}px rows={mob['rows']}")
        page.set_viewport_size({'width': 1280, 'height': 800})
        page.wait_for_timeout(450)   # let the 320ms-debounced resizeCanvas repaint before the shot

        # ---- final HUD shot ---------------------------------------------------------
        page.screenshot(path=os.path.join(OUT, 'hud_final.png'))

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
