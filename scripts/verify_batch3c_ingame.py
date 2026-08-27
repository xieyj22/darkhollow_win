# In-game verification for feat/batch3c-emoji-sprites (批3C, T5).
# Runs against the Vite DEV server so page.evaluate can `import('/src/*.ts')`
# and get the SAME live module instances the game loop uses (batch2/3B-proven
# harness; same-instance ESM injection dodges the HMR '?t=' second-instance
# trap). Everything is exercised through the REAL render paths (panels.ts /
# meta.ts / render.ts + sprites.ts caches), not unit mocks:
#   A  talent panel: all 4 class trees (G.player.ci 0..3 -> openTalentPanel)
#      render 16 canvas.tc-ic each (64 total), every canvas painted + multi-
#      hue, same-template different-hue T_SWORD cells pixel-distinct
#   B  achievements panel: 29 rows -> 29 canvas.ach-ic all painted + multi-hue
#   C  forge panel: 5 category tabs -> 22 canvas.fu-ic total, all painted;
#      💀 cost currency STILL rendered (batch-out by design)
#   D  HUD buff row: live-module injection of str_buff + torch -> 2
#      canvas.buff-ic in #buff-list, painted + pixel-distinct (sword vs flame)
#   E  emoji residue gate: the ACTUAL icon: values from data.ts's three tables
#      (extracted at runtime by regex — never a hand-typed sample list) are
#      absent from the respective panel innerHTML; 🐌 absent from #buff-list
#   F  batch3B regression: one boss sprite still renders via BOSS_PAL
#   G  0 console errors for the whole session (favicon 404 whitelisted,
#      console + response double handler)
# Counts are the controller-verified ground truth (64/29/22 — the plan's
# 86/31/27 were spec miscounts).
# Run: npm run dev -- --port 5173 --strictPort (FRESH server), then:
#      python scripts/verify_batch3c_ingame.py
import base64
import io
import json
import os
import re
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:5173'
OUT = os.path.join(os.path.dirname(__file__), 'smoke_out', 'batch3c')
DATA_TS = os.path.join(os.path.dirname(__file__), '..', 'src', 'data.ts')

CLASS_NAMES = ['Warrior', 'Rogue', 'Mage', 'Paladin']
FORGE_TABS = ['stats', 'survival', 'talent', 'utility', 'endless']
MIN_PAINTED_PX = 20         # opaque pixels (of 256) required per panel icon
MIN_COLORS = 3              # unique RGB values among painted pixels
MIN_DIFF_PX = 8             # changed pixels required to call two icons distinct
TOL = 30                    # per-pixel channel-sum tolerance (anti-alias headroom)

results = []
console_errors = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ''))


# ---------- emoji extraction (source of truth = data.ts itself) ----------

def table_icons(start_marker, end_marker):
    """Distinct characters used by `icon: '...'` values inside one data.ts table."""
    with open(DATA_TS, encoding='utf-8') as f:
        text = f.read()
    seg = text.split(start_marker, 1)[1].split(end_marker, 1)[0]
    vals = re.findall(r"icon:\s*'([^']*)'", seg)
    return {ch for v in vals for ch in v}, len(vals)


ACH_ICONS, ACH_N = table_icons('export const ACH_DEFS', 'export const NEW_WEAPONS')
TAL_ICONS, TAL_N = table_icons('export const TALENT_TREES', 'export const META_UPGRADES')
META_ICONS, META_N = table_icons('export const META_UPGRADES', 'export const ENDLESS_GEAR')
# 💀 is the forge cost currency glyph, deliberately batch-OUT (renderForgeContent
# cost lines `cost + ' 💀'`) — its ABSENCE would mean overreach, not success.
FORGE_FORBIDDEN = META_ICONS - {'\N{SKULL}'}

# Distinct palette letters per T_* template (from sprites.ts itself) + a
# Python mirror of iconPalette()/buildPalette() so the multi-hue floor is
# EXACT: a fully-painted icon shows one distinct RGB per template letter,
# minus slots that legitimately collide (e.g. hue #ffd54a makes M==G in
# T_CROWN/T_TROPHY — buildPalette's G is the same gold). THEME_PAL kinds are
# parsed from the same file; darken/lighten mirror utils.ts exactly.
SPRITES_TS = os.path.join(os.path.dirname(__file__), '..', 'src', 'sprites.ts')
with open(SPRITES_TS, encoding='utf-8') as f:
    _spr = f.read()
_seg = _spr[_spr.index('export const TEMPLATES'):_spr.index('TEMPLATES.ES_ALTAR_GAMBLER')]
TEMPLATE_LETTERS = {m.group(1): frozenset(re.findall(r'[A-Z]', m.group(2)))
                    for m in re.finditer(r'(T_\w+):\s*\[(.*?)\]', _seg, re.S)}
_tp = _spr[_spr.index('export const THEME_PAL'):]
THEME_PAL = {}
for m in re.finditer(r"(T_\w+|STAIR):\s*\{([^}]*)\}", _tp[:_tp.index('};')]):
    THEME_PAL[m.group(1)] = {k: v for k, v in re.findall(r"(\w):\s*'(#[0-9a-fA-F]{6})'", m.group(2))}


def _hex(c):
    return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))


def build_palette(main):
    """Mirror of sprites.ts buildPalette for hex main colors."""
    m = _hex(main)
    mix = lambda t: tuple(int(v + (255 - v) * 0.45) for v in m)  # lighten(main, 0.45)
    return {
        'M': m, 'D': tuple(int(v * 0.5) for v in m), 'L': mix(m),
        'E': _hex('#ff7a3c'), 'K': _hex('#140a0a'), 'W': _hex('#eaeaf0'),
        'C': _hex('#8a8a96'), 'G': _hex('#ffd54a'), 'N': _hex('#6b4423'),
        'V': _hex('#7ec8e3'),
    }


def expected_colors(kind, color):
    letters = TEMPLATE_LETTERS.get(kind)
    if not letters:
        return MIN_COLORS
    if kind in THEME_PAL:
        pal = {k: _hex(v) for k, v in THEME_PAL[kind].items()}
    elif re.fullmatch(r'#[0-9a-fA-F]{6}', color or ''):
        pal = build_palette(color)
    else:
        return len(letters)
    return max(2, len({pal[l] for l in letters if l in pal}))

# ---------- image helpers ----------

def load_rgba(dataurl):
    return Image.open(io.BytesIO(base64.b64decode(dataurl.split(',', 1)[1]))).convert('RGBA')


def _px(img):
    # Pillow 12+ deprecates getdata (removal in 14) — prefer get_flattened_data.
    return list(img.get_flattened_data()) if hasattr(img, 'get_flattened_data') else list(img.getdata())


def painted_stats(img):
    """(painted_px, unique_rgb_count) — painted = alpha > 0."""
    px = _px(img)
    painted = [p[:3] for p in px if p[3] > 0]
    return len(painted), len(set(painted))


def px_diff(a, b):
    """(changed_px, mean_channel_diff) between two RGBA icon canvases.
    A pixel counts as changed when either side is opaque and the RGB channel
    sum differs beyond TOL (silhouettes are identical for same-template pairs)."""
    pa, pb = _px(a), _px(b)
    n = total = 0
    for u, v in zip(pa, pb):
        if u[3] == 0 and v[3] == 0:
            continue
        dsum = abs(u[0] - v[0]) + abs(u[1] - v[1]) + abs(u[2] - v[2])
        if dsum > TOL:
            n += 1
        total += dsum
    return n, total / (len(pa) * 3)


def upscale(img, k):
    w, h = img.size
    return img.resize((w * k, h * k), Image.NEAREST)


def montage(cells, cols, path, cell=120, pad=6, label_h=18):
    rows = (len(cells) + cols - 1) // cols
    W = cols * (cell + pad) + pad
    H = rows * (cell + label_h + pad) + pad
    m = Image.new('RGB', (W, H), (16, 16, 20))
    dr = ImageDraw.Draw(m)
    for i, (label, img) in enumerate(cells):
        cx = pad + (i % cols) * (cell + pad)
        cy = pad + (i // cols) * (cell + pad)
        m.paste(upscale(img, cell // img.size[0]), (cx, cy))
        dr.text((cx + 2, cy + cell + 3), label, fill=(220, 220, 220))
    m.save(path)
    return path


# ---------- in-page probes ----------

def start_game(page):
    page.click('#btn-new')
    page.click('#start-btn')
    page.wait_for_timeout(700)
    assert page.evaluate("document.getElementById('game-container').style.display") == 'flex'


GRAB_JS = """async (sel) => {
    const el = document.querySelector(sel);
    if (!el) return { error: 'no element ' + sel };
    const canvases = [...el.querySelectorAll('canvas')];
    return {
        html: el.innerHTML,
        rows: el.children.length,
        ics: canvases.map(c => ({ kind: c.dataset.kind || '?',
                                  color: c.dataset.color || '?',
                                  url: c.toDataURL('image/png') })),
    };
}"""

# Deterministic boss snapshot — simplified batch3b SNAP_JS (boss mode only).
BOSS_SNAP_JS = """async (kind) => {
    const st = await import('/src/state.ts');
    const d = await import('/src/data.ts');
    const fac = await import('/src/enemy-factory.ts');
    const r = await import('/src/render.ts');
    const pt = await import('/src/particles.ts');
    const fx = await import('/src/fx.ts');
    const cfg = await import('/src/config.ts');
    st.setReducedMotion(true);
    fx.clearFx();
    pt.stopParticles();
    const p = st.G.player;
    const x = p.x + 1, y = p.y;
    st.G.enemies = [];
    st.G.dungeon.map[y][x] = cfg.TL.FLOOR;
    st.G.player.visible[y][x] = true;
    if (st.G.player.explored) st.G.player.explored[y][x] = true;
    const bd = d.BOSSES.find(b => b.spriteKind === kind);
    if (!bd) return { error: 'no BOSSES def for ' + kind };
    st.G.enemies = [fac.makeEnemy(bd, x, y, 1, { isBoss: true })];
    const cvs = document.getElementById('game-canvas');
    const ctx = cvs.getContext('2d');
    r.render();
    r.drawEnemyLayer(ctx);
    r.drawPlayerLayer(ctx);
    const sx = (x - st.G.vx) * cfg.TS, sy = (y - st.G.vy) * cfg.TS;
    const t = document.createElement('canvas');
    t.width = cfg.TS; t.height = cfg.TS;
    t.getContext('2d').drawImage(cvs, sx, sy, cfg.TS, cfg.TS, 0, 0, cfg.TS, cfg.TS);
    pt.startParticles();          // resume the normal rAF loop
    return { url: t.toDataURL('image/png') };
}"""


def grab(page, sel):
    out = page.evaluate(GRAB_JS, sel)
    if out.get('error'):
        raise RuntimeError(out['error'])
    return out


def icons_ok(tag, ics):
    """Assert every canvas is painted + shows every palette letter of its
    template (template-aware multi-hue floor); returns [index]->image."""
    imgs, bad_paint, bad_color = [], [], []
    for i, ic in enumerate(ics):
        img = load_rgba(ic['url'])
        imgs.append(img)
        painted, colors = painted_stats(img)
        need = expected_colors(ic['kind'], ic['color'])
        if painted < MIN_PAINTED_PX:
            bad_paint.append(f"#{i}({ic['kind']})={painted}px")
        if colors < need:
            bad_color.append(f"#{i}({ic['kind']} {ic['color']})={colors}col<{need})")
    check(f'{tag} every icon canvas painted (>= {MIN_PAINTED_PX} opaque px of 256)',
          not bad_paint, '; '.join(bad_paint[:6]) or f"min={min(painted_stats(im)[0] for im in imgs)}px")
    check(f'{tag} every icon canvas multi-hue (>= template palette letters)',
          not bad_color, '; '.join(bad_color[:6]) or f"min={min(painted_stats(im)[1] for im in imgs)}col")
    return imgs


def same_template_pair_diff(tag, ics, imgs, kind, color_a, color_b):
    """Pixel-diff two same-template different-hue icons designated by (kind,color)."""
    ia = ib = None
    for i, ic in enumerate(ics):
        if ic['kind'] == kind and ic['color'].lower() == color_a.lower():
            ia = i
        if ic['kind'] == kind and ic['color'].lower() == color_b.lower():
            ib = i
    if ia is None or ib is None:
        check(f'{tag} {kind} hue pair {color_a}~{color_b} present in panel', False,
              f"found={[ic['kind']+':'+ic['color'] for ic in ics][:20]}")
        return
    n, mean = px_diff(imgs[ia], imgs[ib])
    check(f'{tag} {kind} different-hue cells pixel-distinct', n >= MIN_DIFF_PX,
          f"{color_a} vs {color_b}: diff_px={n} mean={mean:.2f}")


def emoji_gate(tag, forbidden, html):
    hits = sorted(ch for ch in forbidden if ch in html)
    check(f'{tag} no legacy emoji residue ({len(forbidden)} chars from data.ts icon: values)',
          not hits, f"hits={[hex(ord(h)) + ' ' + h for h in hits]}" or f"checked {len(forbidden)} chars")


def main():
    os.makedirs(OUT, exist_ok=True)
    print(f'Extracted data.ts icon chars: talents={len(TAL_ICONS)} (from {TAL_N} nodes), '
          f'achievements={len(ACH_ICONS)} (from {ACH_N} defs), forge={len(META_ICONS)} (from {META_N} defs)')

    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel='chrome', headless=True)
        page = browser.new_page()
        # favicon 404s are dev-server noise (see verify_reconnect_ingame.py) —
        # console + response double handler, both whitelisting it.
        page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' and 'favicon' not in (m.location or {}).get('url', '') else None)
        page.on('response', lambda r: print(f'    [404] {r.url}') if r.status == 404 and 'favicon' not in r.url else None)
        page.on('pageerror', lambda e: console_errors.append(str(e)))
        # Dialogs auto-dismissed BEFORE anything can fire one (batch2 pit).
        page.on('dialog', lambda dlg: dlg.accept())
        page.goto(BASE)
        page.wait_for_timeout(1200)
        start_game(page)

        # ============ A: talent panel — 4 class trees x 16 nodes ============
        print('[A] talent panel: 4 class trees render canvas.tc-ic sprites')
        total_tc = 0
        per_class = {}
        talent_cells = []          # (label, image) for the montage
        warrior_ics = warrior_imgs = None
        for ci, cname in enumerate(CLASS_NAMES):
            page.evaluate("""async (ci) => {
                const st = await import('/src/state.ts');
                const p = await import('/src/panels.ts');
                st.G.player.ci = ci;      // pick the tree the panel renders for
                p.openTalentPanel();      // exported render path (shows + paints)
            }""", ci)
            page.wait_for_timeout(120)
            g = grab(page, '#talent-grid')
            n = len(g['ics'])
            per_class[cname] = n
            total_tc += n
            imgs = icons_ok(f'A1[{cname}]', g['ics'])
            emoji_gate(f'A2[{cname}] talent grid', TAL_ICONS, g['html'])
            talent_cells += [(f"{ic['kind'].replace('T_', '')}", im) for ic, im in zip(g['ics'], imgs)]
            if ci == 0:
                warrior_ics, warrior_imgs = g['ics'], imgs
                page.screenshot(path=os.path.join(OUT, 'panel_talent.png'))
        check('A0 talent grid renders 16 canvas.tc-ic per class tree (4x4 grid)',
              all(v == 16 for v in per_class.values()), f"per_class={per_class}")
        check('A0b talent canvas total across 4 trees == 64', total_tc == 64, f"total={total_tc}")
        # same-template different-hue pair: w_battle_fury vs w_weapon_mastery
        # (both T_SWORD, hue #e05545 vs #c83a2c — same silhouette, different hue)
        same_template_pair_diff('A3', warrior_ics, warrior_imgs, 'T_SWORD', '#e05545', '#c83a2c')
        montage(talent_cells, 8, os.path.join(OUT, 'talent_matrix.png'))
        page.evaluate("""async () => {
            const p = await import('/src/panels.ts');
            p.closeTalentPanel();
        }""")
        page.wait_for_timeout(150)

        # ============ B: achievements panel — 29 rows ============
        print('[B] achievements panel: 29 canvas.ach-ic sprites')
        page.evaluate("""async () => {
            const p = await import('/src/panels.ts');
            p.openAchievements();
        }""")
        page.wait_for_timeout(150)
        g = grab(page, '#ach-content')
        check('B0 achievements panel holds 29 rendered rows in the DOM',
              g['rows'] == 29, f"rows={g['rows']}")
        check('B0b 29 canvas.ach-ic rendered', len(g['ics']) == 29, f"canvases={len(g['ics'])}")
        ach_imgs = icons_ok('B1', g['ics'])
        emoji_gate('B2 achievements list', ACH_ICONS, g['html'])
        montage([(ic['kind'].replace('T_', ''), im) for ic, im in zip(g['ics'], ach_imgs)],
                5, os.path.join(OUT, 'ach_matrix.png'))
        page.screenshot(path=os.path.join(OUT, 'panel_ach.png'))
        page.evaluate("""async () => {
            const p = await import('/src/panels.ts');
            p.closeAchievements();
        }""")
        page.wait_for_timeout(150)

        # ============ C: forge panel — 5 tabs, 22 upgrades ============
        print('[C] forge panel: 5 tabs render canvas.fu-ic sprites')
        page.evaluate("""async () => {
            const u = await import('/src/ui-panels.ts');
            const m = await import('/src/meta.ts');
            u.showOverlay('forge-overlay');
            m.renderForge();
        }""")
        page.wait_for_timeout(150)
        forge_cells = []
        per_tab = {}
        forge_ics_all = []
        for tab in FORGE_TABS:
            page.click(f'.forge-tab[data-tab="{tab}"]')
            page.wait_for_timeout(120)
            g = grab(page, '#forge-content')
            per_tab[tab] = len(g['ics'])
            forge_ics_all += list(g['ics'])
            imgs = icons_ok(f'C1[{tab}]', g['ics'])
            emoji_gate(f'C2[{tab}] forge rows', FORGE_FORBIDDEN, g['html'])
            check(f'C3[{tab}] 💀 cost currency still rendered (batch-out by design)',
                  '\N{SKULL}' in g['html'], 'soul-echo cost lines keep the glyph')
            forge_cells += [(ic['kind'].replace('T_', ''), im) for ic, im in zip(g['ics'], imgs)]
            if tab == 'stats':
                page.screenshot(path=os.path.join(OUT, 'panel_forge.png'))
        check('C0 forge tabs render rows for every category', all(v > 0 for v in per_tab.values()),
              f"per_tab={per_tab}")
        check('C0b forge canvas total across 5 tabs == 22', sum(per_tab.values()) == 22,
              f"total={sum(per_tab.values())}")
        # same-template different-hue pair: start_atk vs crit_bonus (stats tab,
        # both T_SWORD, hue #e05545 vs #ff9a3c) — loop ended on 'endless', so
        # click back to stats and re-grab that tab's icons.
        page.click('.forge-tab[data-tab="stats"]')
        page.wait_for_timeout(120)
        stats_g = grab(page, '#forge-content')
        stats_imgs = icons_ok('C1[stats-regrab]', stats_g['ics'])
        same_template_pair_diff('C4', stats_g['ics'], stats_imgs, 'T_SWORD', '#e05545', '#ff9a3c')
        montage(forge_cells, 6, os.path.join(OUT, 'forge_matrix.png'))
        page.evaluate("document.getElementById('forge-overlay').style.display = 'none'")
        page.wait_for_timeout(150)

        # ============ D: HUD buff row — injected str_buff + torch ============
        print('[D] buff row: live-module buff injection -> canvas.buff-ic sprites')
        page.evaluate("""async () => {
            const st = await import('/src/state.ts');
            const r = await import('/src/render.ts');
            const i18n = await import('/src/i18n.ts');
            st.G.player.buffs.push({ name: i18n.t('it.strengthBuff'), type: 'str_buff', value: 3, turns: 5 });
            st.G.player.buffs.push({ name: i18n.t('it.torchBuff'),    type: 'torch',    value: 2, turns: 10 });
            r.updateUI();            // the real HUD render path that owns #buff-list
        }""")
        page.wait_for_timeout(150)
        g = grab(page, '#buff-list')
        kinds = [ic['kind'] for ic in g['ics']]
        check('D0 buff row renders 2 canvas.buff-ic (str_buff + torch injected)',
              len(g['ics']) == 2 and 'T_SWORD' in kinds and 'T_FIRE' in kinds,
              f"kinds={kinds}")
        buff_imgs = icons_ok('D1', g['ics'])
        n, mean = px_diff(buff_imgs[0], buff_imgs[1])
        check('D2 the two buff icons pixel-distinct (sword-red vs fire-orange)',
              n >= MIN_DIFF_PX, f"diff_px={n} mean={mean:.2f}")
        check('D3 no legacy 🐌 in the buff row', '\N{SNAIL}' not in g['html'],
              'old emoji buff icons must be gone')
        montage([(ic['kind'].replace('T_', ''), im) for ic, im in zip(g['ics'], buff_imgs)],
                2, os.path.join(OUT, 'buff_matrix.png'))
        bb = page.evaluate("""() => {
            const r = document.getElementById('buff-list').getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height };
        }""")
        page.screenshot(path=os.path.join(OUT, 'buff_row.png'), clip={
            'x': max(0, bb['x'] - 12), 'y': max(0, bb['y'] - 12),
            'width': min(1280, bb['w'] + 24), 'height': bb['h'] + 24})

        # ============ E: batch3B regression — a boss still renders ============
        print('[E] batch3B regression: boss sprite via BOSS_PAL')
        shot = page.evaluate(BOSS_SNAP_JS, 'B_GOBLIN_KING')
        if shot.get('error'):
            raise RuntimeError(shot['error'])
        boss = load_rgba(shot['url'])
        painted, colors = painted_stats(boss)
        check('E1 boss tile non-trivially painted', painted >= 100,
              f"painted={painted}px of {boss.size[0] * boss.size[1]}, unique_colors={colors}")
        check('E2 boss tile multi-hue (BOSS_PAL)', colors >= 4, f"unique_colors={colors}")
        upscale(boss, 10).save(os.path.join(OUT, 'boss_B_GOBLIN_KING.png'))

        browser.close()

    fails = [r for r in results if not r[1]]
    print(f"\nTotal {len(results)} checks, {len(fails)} failed")
    print(f"Console errors: {len(console_errors)}")
    for e in console_errors[:10]:
        print('  ERR:', e[:200])
    print(f"Screenshots + matrices: {OUT}")
    with open(os.path.join(OUT, 'verify_batch3c_results.json'), 'w', encoding='utf-8') as f:
        json.dump({'checks': results, 'console_errors': console_errors,
                   'icon_chars': {'talents': sorted(TAL_ICONS), 'achievements': sorted(ACH_ICONS),
                                  'forge': sorted(META_ICONS)}}, f, ensure_ascii=False, indent=1)
    sys.exit(1 if fails or console_errors else 0)


if __name__ == '__main__':
    main()
