# In-game verification for feat/batch3b-boss-sprites (批3B).
# Runs against the Vite DEV server so page.evaluate can `import('/src/*.ts')`
# and get the SAME live module instances the game loop uses (batch2-proven
# harness; same-instance ESM injection dodges the HMR '?t=' second-instance
# trap). Checks exercised through the REAL render path (render.ts + sprites.ts
# caches + palettes), not unit mocks:
#   A  9 boss spriteKinds render via per-boss templates — 36/36 pairwise
#      tile pixel-diffs (makeEnemy isBoss -> drawBossSprite -> BOSS_PAL)
#   B  8 event sites render as distinct sprites (EVENT_SITES wiring), incl.
#      the two altars = same silhouette + DIFFERENT palette (color-only diff)
#   C  merchant trio pairwise distinct (shared silhouette, 3 palettes)
#   D  CHEST still renders multi-hue (gold + wood clusters via ENTITY_PAL)
#   E  cleanse-into-clean: corruption 25 -> applyCorruption(-30) -> dedicated
#      cb.tierClean message in the log, corruption === 0
#   F  0 console errors for the whole session (favicon 404 whitelisted)
# Determinism: setReducedMotion(true) kills the idle bob; particles.ts
# stopParticles() freezes the rAF composite; each snap then manually runs
# render() + drawEnemyLayer + drawPlayerLayer and reads toDataURL() INSIDE the
# same evaluate — nothing can interleave, so pixel diffs are exact.
# Run: npm run dev -- --port 5173 --strictPort (FRESH server), then:
#      python scripts/verify_batch3b_ingame.py
import base64
import io
import json
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:5173'
OUT = os.path.join(os.path.dirname(__file__), 'smoke_out', 'batch3b')
BOSS_KINDS = [
    'B_GOBLIN_KING', 'B_SPIDER_QUEEN', 'B_VAMPIRE_LORD', 'B_ELDER_LICH',
    'B_DRAGON_EMPEROR', 'B_LEVIATHAN', 'B_VOID_SOVEREIGN', 'B_CREATOR', 'B_MYCONID',
]
# Merchant trio — mirrors game.ts placeEntity calls (colors/ch/rarity verbatim).
MERCHANTS = [
    ('merchant',         'MERCHANT',          '#9b5de5', '§', 1),
    ('treasure_merchant', 'MERCHANT_TREASURE', '#ffd700', '¤', 4),
    ('endless_merchant',  'MERCHANT_ENDLESS',  '#9b5de5', '∞', 5),
]
MIN_DIFF_PX = 8          # changed pixels (of 484) required to call two tiles distinct
TOL = 30                 # per-pixel channel-sum tolerance (anti-alias headroom)

results = []
console_errors = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ''))


def log_text(page):
    return page.evaluate("document.getElementById('log-panel')?.textContent ?? ''")


def start_game(page):
    page.click('#btn-new')
    page.click('#start-btn')
    page.wait_for_timeout(700)
    assert page.evaluate("document.getElementById('game-container').style.display") == 'flex'


# One deterministic snapshot per entity. spec: {mode:'boss'|'item', ...}.
# Returns {tile:<dataURL 22x22>, ctx:<dataURL 66x66>, kind} — crops are taken
# in-page so only ~2KB crosses the wire, and the composite is atomic.
SNAP_JS = """async (spec) => {
    const st = await import('/src/state.ts');
    const d = await import('/src/data.ts');
    const fac = await import('/src/enemy-factory.ts');
    const r = await import('/src/render.ts');
    const pt = await import('/src/particles.ts');
    const fx = await import('/src/fx.ts');
    const cfg = await import('/src/config.ts');
    st.setReducedMotion(true);      // idle bob -> 0, tweens instant
    fx.clearFx();
    pt.stopParticles();             // freeze the rAF composite (restart later)

    const p = st.G.player;
    const x = p.x + 1, y = p.y;     // always the tile right of the player
    st.G.enemies = [];
    st.G.items = st.G.items.filter(i => !i.__t3b);
    st.G.dungeon.map[y][x] = cfg.TL.FLOOR;   // neutral background under the entity
    st.G.player.visible[y][x] = true;
    if (st.G.player.explored) st.G.player.explored[y][x] = true;

    let kind = null;
    if (spec.mode === 'boss') {
        const bd = d.BOSSES.find(b => b.spriteKind === spec.kind);
        if (!bd) return { error: 'no BOSSES def for ' + spec.kind };
        st.G.enemies = [fac.makeEnemy(bd, x, y, 1, { isBoss: true })];
        kind = bd.spriteKind;
    } else {
        const it = { type: 'consumable', name: spec.name, ch: spec.ch, c: spec.c,
                     desc: '', x, y, rarity: spec.rarity, npc: spec.npc,
                     spriteKind: spec.kind, __t3b: true };
        if (spec.eventId) it.eventId = spec.eventId;
        st.G.items.push(it);
        kind = spec.kind;
    }

    const cvs = document.getElementById('game-canvas');
    const ctx = cvs.getContext('2d');
    r.render();                    // static layers (items live here) + snapshot
    r.drawEnemyLayer(ctx);         // enemies composite on top (as the rAF loop does)
    r.drawPlayerLayer(ctx);
    const sx = (x - st.G.vx) * cfg.TS, sy = (y - st.G.vy) * cfg.TS;

    const grab = (gx, gy, gw, gh) => {
        const t = document.createElement('canvas');
        t.width = gw; t.height = gh;
        t.getContext('2d').drawImage(cvs, gx, gy, gw, gh, 0, 0, gw, gh);
        return t.toDataURL('image/png');
    };
    return { tile: grab(sx, sy, cfg.TS, cfg.TS),
             ctx: grab(sx - cfg.TS, sy - cfg.TS, cfg.TS * 3, cfg.TS * 3),
             kind, sx, sy, ts: cfg.TS };
}"""


def snap(page, spec):
    out = page.evaluate(SNAP_JS, spec)
    if out.get('error'):
        raise RuntimeError(out['error'])
    return out


def load(dataurl):
    return Image.open(io.BytesIO(base64.b64decode(dataurl.split(',', 1)[1]))).convert('RGB')


def pixels(img):
    # Pillow 12.2 deprecates getdata (removal in 14) — prefer get_flattened_data.
    return list(img.get_flattened_data()) if hasattr(img, 'get_flattened_data') else list(img.getdata())


def px_diff(a, b):
    """(changed_pixel_count, mean_channel_diff) between two same-size RGB images."""
    pa, pb = pixels(a), pixels(b)
    n, total = 0, 0
    for u, v in zip(pa, pb):
        dsum = abs(u[0] - v[0]) + abs(u[1] - v[1]) + abs(u[2] - v[2])
        if dsum > TOL:
            n += 1
        total += dsum
    return n, total / (len(pa) * 3)


def near(img, hexcol, tol=70):
    """Pixel count within tol (channel-sum) of hexcol."""
    t = tuple(int(hexcol[i:i + 2], 16) for i in (1, 3, 5))
    return sum(1 for u in pixels(img)
               if abs(u[0] - t[0]) + abs(u[1] - t[1]) + abs(u[2] - t[2]) <= tol)


def upscale(img, k):
    w, h = img.size
    return img.resize((w * k, h * k), Image.NEAREST)


def montage(cells, cols, path, cell=220, pad=8, label_h=24):
    """cells: [(label, PIL image)] — images upscaled to cell x cell."""
    rows = (len(cells) + cols - 1) // cols
    W = cols * (cell + pad) + pad
    H = rows * (cell + label_h + pad) + pad
    m = Image.new('RGB', (W, H), (16, 16, 20))
    dr = ImageDraw.Draw(m)
    for i, (label, img) in enumerate(cells):
        cx = pad + (i % cols) * (cell + pad)
        cy = pad + (i // cols) * (cell + label_h + pad)
        m.paste(upscale(img, cell // img.size[0]), (cx, cy))
        dr.text((cx + 2, cy + cell + 4), label, fill=(220, 220, 220))
    m.save(path)
    return path


def main():
    os.makedirs(OUT, exist_ok=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel='chrome', headless=True)
        page = browser.new_page()
        # favicon 404s are dev-server noise (see verify_reconnect_ingame.py).
        page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' and 'favicon' not in (m.location or {}).get('url', '') else None)
        page.on('pageerror', lambda e: console_errors.append(str(e)))
        # Dialogs auto-dismissed BEFORE anything can fire one (batch2 pit).
        page.on('dialog', lambda dlg: dlg.accept())
        page.goto(BASE)
        page.wait_for_timeout(1200)
        start_game(page)

        # ============ A: 9 bosses, 36 pairwise diffs ============
        print('[A] nine boss spriteKinds render pairwise-distinct (36 pairs)')
        tiles = {}
        for kind in BOSS_KINDS:
            s = snap(page, {'mode': 'boss', 'kind': kind})
            tiles[kind] = load(s['tile'])
            upscale(tiles[kind], 10).save(os.path.join(OUT, f'boss_{kind}.png'))
            if kind == BOSS_KINDS[0]:   # keep one in-scene context shot for eyeballs
                upscale(load(s['ctx']), 4).save(os.path.join(OUT, 'context_B_GOBLIN_KING.png'))
        pairs = []
        for i in range(len(BOSS_KINDS)):
            for j in range(i + 1, len(BOSS_KINDS)):
                n, mean = px_diff(tiles[BOSS_KINDS[i]], tiles[BOSS_KINDS[j]])
                pairs.append((BOSS_KINDS[i], BOSS_KINDS[j], n, mean))
        worst = min(pairs, key=lambda p: p[2])
        check('A1 all 36 boss pairs pixel-distinct', all(p[2] >= MIN_DIFF_PX for p in pairs),
              f"min={worst[2]}px on {worst[0]}~{worst[1]}; max={max(p[2] for p in pairs)}px")
        check('A2 boss tiles non-trivially painted (>=100 non-bg px each)',
              all(len(set(pixels(t))) >= 4 for t in tiles.values()),
              f"unique colors per tile: {sorted(len(set(pixels(t))) for t in tiles.values())}")
        montage([(k, tiles[k]) for k in BOSS_KINDS], 3, os.path.join(OUT, 'boss_matrix.png'))

        # ============ B: 8 event sites ============
        print('[B] event sites render as distinct sprites (two altars share silhouette)')
        sites = page.evaluate("""async () => {
            const es = await import('/src/event-sites.ts');
            return es.EVENT_SITES.map(s => ({ id: s.id, kind: s.spriteKind, ch: s.ch, c: s.c }));
        }""")
        check('B0 EVENT_SITES table carries 8 spriteKinds', len(sites) == 8,
              f"kinds={[s['kind'] for s in sites]}")
        site_tiles = {}
        for s in sites:
            shot = snap(page, {'mode': 'item', 'kind': s['kind'], 'ch': s['ch'], 'c': s['c'],
                               'npc': 'event', 'eventId': s['id'], 'rarity': 2,
                               'name': s['id']})
            site_tiles[s['kind']] = load(shot['tile'])
        for s in sites:
            t = site_tiles[s['kind']]
            colors = len(set(pixels(t)))
            check(f"B1 {s['id']} renders as a multi-hue sprite (not a plain glyph box)",
                  colors >= 4, f"unique_colors={colors}")
        ac, ag = site_tiles['ES_ALTAR_CURSED'], site_tiles['ES_ALTAR_GAMBLER']
        n, mean = px_diff(ac, ag)
        check('B2 the two altars differ in COLOR despite shared silhouette', n >= MIN_DIFF_PX,
              f"diff_px={n} mean={mean:.1f}")
        spairs = []
        ks = [s['kind'] for s in sites]
        for i in range(len(ks)):
            for j in range(i + 1, len(ks)):
                spairs.append((ks[i], ks[j], *px_diff(site_tiles[ks[i]], site_tiles[ks[j]])))
        sworst = min(spairs, key=lambda p: p[2])
        check('B3 bonus: all 28 event-site pairs pairwise distinct',
              all(p[2] >= MIN_DIFF_PX for p in spairs),
              f"min={sworst[2]}px on {sworst[0]}~{sworst[1]}")

        # ============ C: merchant trio ============
        print('[C] three merchants pairwise distinct (shared silhouette, 3 palettes)')
        mtiles = {}
        for npc, kind, c, ch, rar in MERCHANTS:
            shot = snap(page, {'mode': 'item', 'kind': kind, 'ch': ch, 'c': c,
                               'npc': npc, 'rarity': rar, 'name': npc})
            mtiles[kind] = load(shot['tile'])
        mpairs = []
        ks = [m[1] for m in MERCHANTS]
        for i in range(len(ks)):
            for j in range(i + 1, len(ks)):
                mpairs.append((ks[i], ks[j], *px_diff(mtiles[ks[i]], mtiles[ks[j]])))
        check('C1 all 3 merchant pairs pixel-distinct', all(p[2] >= MIN_DIFF_PX for p in mpairs),
              f"diffs={[p[2] for p in mpairs]}px")

        # ============ D: CHEST multi-hue (ENTITY_PAL absorbed CHEST_PAL) ============
        print('[D] CHEST keeps gold + wood clusters')
        shot = snap(page, {'mode': 'item', 'kind': 'CHEST', 'ch': '▣', 'c': '#daa520',
                           'npc': 'chest', 'rarity': 2, 'name': 'chest'})
        chest = load(shot['tile'])
        gold = near(chest, '#ffd54a', 70)
        wood = near(chest, '#8a5a30', 70)
        check('D1 CHEST renders with a gold cluster', gold >= 4, f"gold_px={gold}")
        check('D2 CHEST renders with a wood cluster', wood >= 30, f"wood_px={wood}")

        # Entity montage for the human eyeball pass (Step 5).
        cells = [(s['id'], site_tiles[s['kind']]) for s in sites] \
            + [(npc, mtiles[kind]) for npc, kind, _, _, _ in MERCHANTS] \
            + [('CHEST', chest)]
        montage(cells, 4, os.path.join(OUT, 'entity_matrix.png'))

        # ============ E: cleanse into clean tier ============
        print('[E] cleanse back into the clean tier (dedicated feedback)')
        page.evaluate("""async () => {
            const st = await import('/src/state.ts');
            const cb = await import('/src/combat.ts');
            const pt = await import('/src/particles.ts');
            st.G.enemies = [];
            st.G.items = st.G.items.filter(i => !i.__t3b);
            pt.startParticles();                 // resume the normal rAF loop
            st.G.player.corruption = 25;         // touched (>=20) ...
            cb.applyCorruption(-30);             // ... cleansed all the way to clean
        }""")
        page.wait_for_timeout(300)
        cor = page.evaluate("""async () => {
            const st = await import('/src/state.ts');
            return st.G.player.corruption;
        }""")
        log = log_text(page)
        check('E1 applyCorruption(-30) from 25 lands at 0', cor == 0, f"corruption={cor}")
        check('E2 dedicated cb.tierClean message in the game log',
              ('腐化尽散' in log) or ('mind clears' in log),
              'zh/en keyword hit')

        browser.close()

    fails = [r for r in results if not r[1]]
    print(f"\nTotal {len(results)} checks, {len(fails)} failed")
    print(f"Console errors: {len(console_errors)}")
    for e in console_errors[:10]:
        print('  ERR:', e[:200])
    print(f"Visual matrix: {OUT}")
    with open(os.path.join(OUT, 'verify_batch3b_results.json'), 'w', encoding='utf-8') as f:
        json.dump({'checks': results, 'console_errors': console_errors}, f, ensure_ascii=False, indent=1)
    sys.exit(1 if fails or console_errors else 0)


if __name__ == '__main__':
    main()
