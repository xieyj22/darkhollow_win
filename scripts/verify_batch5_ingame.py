# In-game verification for feat/batch5-perf (批5 性能三连, T5) — the batch's
# safety net. T1 rewrote the hottest render path (blitOutlined: per-frame
# 8/24 silhouette stamps -> ONE pre-baked (TS+2t)^2 drawImage), so correctness
# rests on this battery proving PIXEL EQUIVALENCE against the pre-T1 algorithm.
# Runs against the Vite DEV server so page.evaluate can `import('/src/*.ts')`
# and get the SAME live module instances the game loop uses (batch2/3B/3C-proven
# harness; same-instance ESM injection dodges the HMR '?t=' second-instance
# trap). Zero console errors enforced (favicon 404 whitelisted).
#   A  pixel equivalence OLD-vs-NEW for the 4 exported outlined draw routes:
#      player t=1 (WARRIOR/PLAYER_PAL) · boss-color t=2 (TEMPLATES.BOSS +
#      mirrored buildPalette) · boss-kind t=2 (B_ELDER_LICH/BOSS_PAL) ·
#      entity item t=1 (spriteKind CHEST/ENTITY_PAL). The OLD path is
#      reimplemented INLINE in the evaluate: pixel-paint the 16x16 source from
#      the exported TEMPLATES + palette (getSprite's exact fillRect pass), build
#      the #0a0a0a source-in silhouette, then stamp it at every
#      (round(x+dx), round(y+dy)) for dx,dy in [-t,t]^2 \ (0,0) — verbatim
#      pre-57b51b0 blitOutlined (darken/lighten/buildPalette ported verbatim
#      from utils.ts/sprites.ts). Both crops compared over a 3x3-tile (66x66)
#      region around the blit center — NOT TSxTS, the whole point is the
#      +/-1/+-2px outline ring a tight crop would clip away. Tolerance: NONE
#      (exact RGBA incl. alpha), expected diff = 0 px per route, AND an
#      anti-vacuous floor per route: both crops must be substantially painted
#      with a visible dark outline ring (painted>=150, dark>=40 of 4356 — a
#      0-diff on two blank canvases would pass hollowly). Plus a
#      fractional-coordinate probe (player at 33.4,32.7): round(x+dx) ===
#      round(x)+dx for integer dx, so equivalence must hold off-grid too.
#   B  paintIcon no-pollution: T_SWORD/T_EYE/T_MUSHROOM alpha>0 px count ==
#      non-'.' template letter count (outline leaking into the shared getSprite
#      path would inflate the painted count).
#   C  thickness key separation: player t=1 tile vs boss t=2 tile rendered
#      crops differ (>0 px); every route's 2nd draw (cache HIT) is
#      pixel-identical to its 1st; outlinedCacheSize() does not grow on
#      redraws and a FRESH sig adds exactly +1 exactly once;
#      outlinedKey(sig,1) !== outlinedKey(sig,2).
#   D  buff pool + vignette smoke:
#      D-buff: inject str_buff + torch -> real updateUI() -> 2 canvas.buff-ic;
#      mark nodes (dataset + window refs), mutate turns, updateUI() again ->
#      text updated AND the SAME pooled canvas node identities survive the
#      rebuild (the pool's whole point).
#      D-vig: setReducedMotion(true) + stopParticles + clearFx -> render()
#      twice -> main canvas toDataURL identical (determinism; NOTE the
#      "corner vs center on a fully-lit map" variant was NOT used: the
#      vignette's alpha-0 core radius (~0.3*max(w,h)*0.7 ~ 255px) exceeds the
#      FOV (10 tiles = 220px), so every VISIBLE tile sits inside the core and
#      the gradient is only observable over fog — instead presence is proven
#      directly on the composited overlay itself by instrumenting drawImage:
#      the first full-size source per render must be a radial overlay with
#      alpha 0 at the player center, alpha > 30 at the corners and a wide
#      alpha histogram (gradient, not the 2-3-value scanline pattern), and the
#      SAME canvas node must be reused by the next render (cache, no churn).
# Run: npm run dev -- --port 5173 --strictPort (FRESH server), then:
#      python scripts/verify_batch5_ingame.py
import base64
import io
import json
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from PIL import Image
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:5173'
OUT = os.path.join(os.path.dirname(__file__), 'smoke_out', 'batch5')

results = []
console_errors = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ''))


def load_rgba(dataurl):
    return Image.open(io.BytesIO(base64.b64decode(dataurl.split(',', 1)[1]))).convert('RGBA')


def save(img, name):
    img.save(os.path.join(OUT, name))
    return name


# ---------- in-page probes ----------

def start_game(page):
    page.click('#btn-new')
    page.click('#start-btn')
    page.wait_for_timeout(700)
    assert page.evaluate("document.getElementById('game-container').style.display") == 'flex'


# Block A + C: old-vs-new equivalence for the 4 outlined routes, fractional
# probe, t1-vs-t2 tile distinctness, cache size observations.
EQUIV_JS = """async () => {
  const spr = await import('/src/sprites.ts');
  const cfg = await import('/src/config.ts');
  const TS = cfg.TS;              // 22
  const N = 16;

  // --- verbatim ports of utils.ts darken / sprites.ts lighten + buildPalette ---
  const darken = (col, f) => {
    const h = col.replace('#', '');
    if (h.length !== 6) return col;
    return 'rgb(' + Math.floor(parseInt(h.substr(0, 2), 16) * f) + ','
                 + Math.floor(parseInt(h.substr(2, 2), 16) * f) + ','
                 + Math.floor(parseInt(h.substr(4, 2), 16) * f) + ')';
  };
  const lighten = (hex, amt) => {
    const h = hex.replace('#', '');
    if (h.length !== 6) return hex;
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    const mix = (c) => Math.floor(c + (255 - c) * amt);
    return 'rgb(' + mix(r) + ',' + mix(g) + ',' + mix(b) + ')';
  };
  const buildPalette = (main) => ({
    M: main, D: darken(main, 0.5), L: lighten(main, 0.45),
    E: '#ff7a3c', K: '#140a0a', W: '#eaeaf0', C: '#8a8a96',
    G: '#ffd54a', N: '#6b4423', V: '#7ec8e3',
  });

  // --- mirrors of getSprite / getSilhouette / PRE-T1 blitOutlined ---
  const paintTpl = (tpl, pal) => {                 // == getSprite pixel pass
    const cv = document.createElement('canvas'); cv.width = N; cv.height = N;
    const cc = cv.getContext('2d');
    for (let r = 0; r < tpl.length; r++) {
      const row = tpl[r];
      for (let c = 0; c < row.length; c++) {
        const col = pal[row[c]];
        if (!col) continue;
        cc.fillStyle = col; cc.fillRect(c, r, 1, 1);
      }
    }
    return cv;
  };
  const makeSil = (src) => {                       // == getSilhouette
    const cv = document.createElement('canvas'); cv.width = N; cv.height = N;
    const cc = cv.getContext('2d');
    cc.drawImage(src, 0, 0);
    cc.globalCompositeOperation = 'source-in';
    cc.fillStyle = '#0a0a0a'; cc.fillRect(0, 0, N, N);
    return cv;
  };
  const oldBlitOutlined = (c, x, y, sprite, sil, t) => {   // == pre-57b51b0
    const prev = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = false;
    for (let dy = -t; dy <= t; dy++)
      for (let dx = -t; dx <= t; dx++)
        if (dx !== 0 || dy !== 0) c.drawImage(sil, Math.round(x + dx), Math.round(y + dy), TS, TS);
    c.drawImage(sprite, Math.round(x), Math.round(y), TS, TS);
    c.imageSmoothingEnabled = prev;
  };

  const W = 128, H = 128, X = 33, Y = 33;
  const mkCtx = () => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; return cv.getContext('2d'); };
  const CROP = 66;   // 3x3 tiles around the blit center — covers the t=2 ring
  const CX = Math.round(X + TS / 2 - CROP / 2), CY = Math.round(Y + TS / 2 - CROP / 2);
  const cropUrl = (ctx) => {
    const t = document.createElement('canvas'); t.width = CROP; t.height = CROP;
    t.getContext('2d').drawImage(ctx.canvas, CX, CY, CROP, CROP, 0, 0, CROP, CROP);
    return t.toDataURL('image/png');
  };
  const cropData = (ctx) => ctx.getImageData(CX, CY, CROP, CROP).data;
  const diffPx = (a, b) => {
    let n = 0, maxd = 0;
    for (let i = 0; i < a.length; i += 4) {
      const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]),
                         Math.abs(a[i + 2] - b[i + 2]), Math.abs(a[i + 3] - b[i + 3]));
      if (d > 0) n++;
      if (d > maxd) maxd = d;
    }
    return { n, maxd };
  };
  // Anti-vacuous-pass stats (batch3d lesson): a 0-diff on two BLANK crops
  // would pass hollowly — every crop must be substantially painted AND carry
  // the dark outline ring (the whole point of the bake). Floors sit ~40%
  // below the observed minima (player t=1: 262 painted / 82 dark of 4356).
  const statsData = (d) => {
    let painted = 0, dark = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 0) painted++;
      if (d[i + 3] > 0 && d[i] < 40 && d[i + 1] < 40 && d[i + 2] < 40) dark++;
    }
    return { painted, dark };
  };

  const routes = [];
  const runRoute = (name, t, drawReal, tpl, pal) => {
    const src = paintTpl(tpl, pal);
    const sil = makeSil(src);
    const ctxA = mkCtx(), ctxB = mkCtx(), ctxC = mkCtx();
    oldBlitOutlined(ctxA, X, Y, src, sil, t);   // OLD algorithm
    drawReal(ctxB);                             // NEW exported draw fn
    drawReal(ctxC);                             // NEW again (cache-hit pass)
    const dA = cropData(ctxA), dB = cropData(ctxB);
    const d = diffPx(dA, dB);
    const dHit = diffPx(cropData(ctxB), cropData(ctxC));
    const sA = statsData(dA), sB = statsData(dB);
    routes.push({ name, thickness: t, diff: d.n, maxd: d.maxd, hitDiff: dHit.n,
                  oldPainted: sA.painted, oldDark: sA.dark,
                  newPainted: sB.painted, newDark: sB.dark,
                  oldUrl: cropUrl(ctxA), newUrl: cropUrl(ctxB) });
  };

  const CHEST_ITEM = { type: 'consumable', name: 'Chest', rarity: 0, ch: '$',
                       c: '#8a5a30', desc: 'x', x: 0, y: 0,
                       spriteKind: 'CHEST', subType: 'pouch', ef: 'heal' };

  runRoute('player_t1', 1,
           (c) => spr.drawPlayerSprite(c, X, Y, 0),
           spr.TEMPLATES.WARRIOR, spr.iconPalette('WARRIOR', '#cccccc'));
  runRoute('bossColor_t2', 2,
           (c) => spr.drawBossSprite(c, X, Y, '#7a1f2b'),
           spr.TEMPLATES.BOSS, buildPalette('#7a1f2b'));
  runRoute('bossKind_t2', 2,
           (c) => spr.drawBossSprite(c, X, Y, '#7a1f2b', 'B_ELDER_LICH'),
           spr.TEMPLATES.B_ELDER_LICH, spr.BOSS_PAL.B_ELDER_LICH);
  runRoute('entityItem_t1', 1,
           (c) => spr.drawItemSprite(c, X, Y, CHEST_ITEM),
           spr.TEMPLATES.CHEST, spr.ENTITY_PAL.CHEST);

  // fractional-coordinate probe (player): round(x+dx) === round(x)+dx math
  const fx = 33.4, fy = 32.7;
  const srcF = paintTpl(spr.TEMPLATES.WARRIOR, spr.iconPalette('WARRIOR', '#cccccc'));
  const silF = makeSil(srcF);
  const ctxA = mkCtx(), ctxB = mkCtx();
  oldBlitOutlined(ctxA, fx, fy, srcF, silF, 1);
  spr.drawPlayerSprite(ctxB, fx, fy, 0);
  const fd = diffPx(cropData(ctxA), cropData(ctxB));
  const fractional = { diff: fd.n, maxd: fd.maxd };

  // C-block: t=1 vs t=2 rendered TILE distinctness (22x22 at the blit origin)
  const pa = mkCtx(), pb = mkCtx();
  spr.drawPlayerSprite(pa, X, Y, 0);
  spr.drawBossSprite(pb, X, Y, '#7a1f2b');
  const td = diffPx(pa.getImageData(X, Y, TS, TS).data, pb.getImageData(X, Y, TS, TS).data);

  // C-block: cache bounded by distinct (sig, thickness); hits add nothing
  const before = spr.outlinedCacheSize();
  spr.drawPlayerSprite(mkCtx(), X, Y, 0);
  spr.drawBossSprite(mkCtx(), X, Y, '#7a1f2b');
  spr.drawBossSprite(mkCtx(), X, Y, '#7a1f2b', 'B_ELDER_LICH');
  spr.drawItemSprite(mkCtx(), X, Y, CHEST_ITEM);
  const afterRedraws = spr.outlinedCacheSize();
  spr.drawBossSprite(mkCtx(), 33, 33, '#0b5f51');   // FRESH sig, first draw
  const afterFresh = spr.outlinedCacheSize();
  spr.drawBossSprite(mkCtx(), 34, 34, '#0b5f51');   // same sig, cache hit
  const afterFresh2 = spr.outlinedCacheSize();
  const keySep = spr.outlinedKey('BOSS:#0b5f51', 1) !== spr.outlinedKey('BOSS:#0b5f51', 2);

  return { routes, fractional, tileDiff: td.n,
           cache: { before, afterRedraws, afterFresh, afterFresh2, keySep } };
}"""

# Block B: paintIcon alpha-count == template letter count (no outline leak).
POLLUTE_JS = """async () => {
  const spr = await import('/src/sprites.ts');
  const out = [];
  for (const kind of ['T_SWORD', 'T_EYE', 'T_MUSHROOM']) {
    const cv = document.createElement('canvas');
    spr.paintIcon(cv, kind, '#06d6a0');
    const d = cv.getContext('2d').getImageData(0, 0, 16, 16).data;
    let painted = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) painted++;
    const letters = spr.TEMPLATES[kind].join('').split('').filter(ch => ch !== '.').length;
    out.push({ kind, painted, letters });
  }
  return out;
}"""

# Block D-buff, pass 1: inject two buffs + real updateUI, mark the canvas nodes.
BUFF1_JS = """async () => {
  const st = await import('/src/state.ts');
  const r = await import('/src/render.ts');
  const i18n = await import('/src/i18n.ts');
  st.G.player.buffs.push({ name: i18n.t('it.strengthBuff'), type: 'str_buff', value: 3, turns: 5 });
  st.G.player.buffs.push({ name: i18n.t('it.torchBuff'),    type: 'torch',    value: 2, turns: 10 });
  r.updateUI();
  const nodes = [...document.querySelectorAll('#buff-list canvas.buff-ic')];
  nodes.forEach((n, i) => { n.dataset.b5Mark = 'one' + i; });
  window.__b5BuffNodes = nodes;
  return { count: nodes.length, kinds: nodes.map(n => n.dataset.kind),
           text: document.getElementById('buff-list').textContent };
}"""

# Block D-buff, pass 2: mutate turns -> rebuild must reuse the SAME nodes.
BUFF2_JS = """async () => {
  const st = await import('/src/state.ts');
  const r = await import('/src/render.ts');
  st.G.player.buffs[0].turns = 3;
  st.G.player.buffs[1].turns = 7;
  r.updateUI();
  const nodes = [...document.querySelectorAll('#buff-list canvas.buff-ic')];
  const stored = window.__b5BuffNodes || [];
  return { count: nodes.length, kinds: nodes.map(n => n.dataset.kind),
           marks: nodes.map(n => n.dataset.b5Mark || null),
           sameIdentity: nodes.length === stored.length && nodes.every((n, i) => n === stored[i]),
           text: document.getElementById('buff-list').textContent };
}"""

# Block D-vig: render determinism + composited vignette presence (drawImage
# instrumentation — first full-size source per render is the vignette cache).
VIG_JS = """async () => {
  const st = await import('/src/state.ts');
  const r = await import('/src/render.ts');
  const pt = await import('/src/particles.ts');
  const fx = await import('/src/fx.ts');
  st.setReducedMotion(true);
  pt.stopParticles();
  fx.clearFx();
  const cvs = document.getElementById('game-canvas');
  r.render();
  const url1 = cvs.toDataURL('image/png');
  r.render();
  const url2 = cvs.toDataURL('image/png');

  const proto = CanvasRenderingContext2D.prototype;
  const orig = proto.drawImage;
  let full = [];
  const wrapped = function (src, ...rest) {
    if (src && src.width === cvs.width && src.height === cvs.height) full.push(src);
    return orig.apply(this, [src, ...rest]);
  };
  proto.drawImage = wrapped;
  let vigInfo = null, sameNode = null;
  try {
    r.render();
    const vig = full[0] || null;   // vignette is drawn BEFORE the scanline overlay
    if (vig) {
      const d = vig.getContext('2d').getImageData(0, 0, vig.width, vig.height).data;
      const aAt = (x, y) => d[(y * vig.width + x) * 4 + 3];
      const center = aAt(Math.floor(vig.width / 2), Math.floor(vig.height / 2));
      const corners = [aAt(0, 0), aAt(vig.width - 1, 0), aAt(0, vig.height - 1), aAt(vig.width - 1, vig.height - 1)];
      const alphas = new Set();
      for (let i = 3; i < d.length; i += 4) alphas.add(d[i]);
      vigInfo = { w: vig.width, h: vig.height, fullSources: full.length,
                  center, cornerMax: Math.max(...corners), distinctAlphas: alphas.size };
    }
    full = [];
    r.render();
    const vig2 = full[0] || null;
    sameNode = !!vig && !!vig2 && vig2 === vig;   // cache hit: same canvas node
  } finally {
    proto.drawImage = orig;
  }
  return { url1, url2, vigInfo, sameNode, canvasW: cvs.width, canvasH: cvs.height };
}"""


def main():
    os.makedirs(OUT, exist_ok=True)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel='chrome', headless=True)
        page = browser.new_page()
        # favicon 404s are dev-server noise — console + response double handler,
        # both whitelisting it (batch3c-proven). Handlers BEFORE anything else.
        page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' and 'favicon' not in (m.location or {}).get('url', '') else None)
        page.on('response', lambda r: print(f'    [404] {r.url}') if r.status == 404 and 'favicon' not in r.url else None)
        page.on('pageerror', lambda e: console_errors.append(str(e)))
        page.on('dialog', lambda dlg: dlg.accept())
        page.goto(BASE)
        page.wait_for_timeout(1200)
        start_game(page)

        # ============ A + C: pixel equivalence battery ============
        print('[A] old-vs-new pixel equivalence, 4 outlined draw routes (0 tolerance)')
        eq = page.evaluate(EQUIV_JS)
        saved = []
        for rt in eq['routes']:
            check(f"A0[{rt['name']}] both crops non-blank + outline ring present "
                  f"(anti-vacuous floor: painted>=150, dark>=40)",
                  rt['oldPainted'] >= 150 and rt['newPainted'] >= 150
                  and rt['oldDark'] >= 40 and rt['newDark'] >= 40,
                  f"old={rt['oldPainted']}px/{rt['oldDark']}dark new={rt['newPainted']}px/{rt['newDark']}dark of 4356")
            check(f"A[{rt['name']}] old-stamp vs pre-baked blit IDENTICAL over 66x66 "
                  f"(t={rt['thickness']}, incl. outline ring)", rt['diff'] == 0,
                  f"diff_px={rt['diff']} max_channel_delta={rt['maxd']}")
            check(f"C-hit[{rt['name']}] 2nd draw (cache hit) pixel-identical",
                  rt['hitDiff'] == 0, f"diff_px={rt['hitDiff']}")
            saved.append(save(load_rgba(rt['oldUrl']), f"eq_{rt['name']}_old.png"))
            saved.append(save(load_rgba(rt['newUrl']), f"eq_{rt['name']}_new.png"))
        check('A5 fractional coords (player @33.4,32.7): equivalence still exact',
              eq['fractional']['diff'] == 0,
              f"diff_px={eq['fractional']['diff']} max_delta={eq['fractional']['maxd']}")

        print('[C] thickness key separation + cache bounds')
        check('C1 player t=1 tile vs boss t=2 tile rendered pixel-distinct',
              eq['tileDiff'] > 0, f"tile_diff_px={eq['tileDiff']} of 484")
        c = eq['cache']
        check('C2 outlinedCacheSize does not grow on redraws (bounded by distinct sig+t)',
              c['afterRedraws'] == c['before'],
              f"before={c['before']} afterRedraws={c['afterRedraws']}")
        check('C3 a FRESH sig adds exactly +1, and only once',
              c['afterFresh'] == c['before'] + 1 and c['afterFresh2'] == c['afterFresh'],
              f"before={c['before']} +1st={c['afterFresh']} 2nd={c['afterFresh2']}")
        check('C4 outlinedKey(sig,1) !== outlinedKey(sig,2)', c['keySep'], str(c['keySep']))

        # ============ B: paintIcon no-pollution ============
        print('[B] paintIcon alpha-count == template letter count (no outline leak)')
        for row in page.evaluate(POLLUTE_JS):
            check(f"B[{row['kind']}] painted px ({row['painted']}) == non-'.' letters ({row['letters']})",
                  row['painted'] == row['letters'],
                  f"painted={row['painted']} letters={row['letters']}")

        # ============ D-buff: pooled buff-row canvases survive a rebuild ============
        print('[D] buff pool: node identity across updateUI rebuilds')
        b1 = page.evaluate(BUFF1_JS)
        check('D1 buff row renders 2 canvas.buff-ic (str_buff + torch injected)',
              b1['count'] == 2 and b1['kinds'] == ['T_SWORD', 'T_FIRE'],
              f"count={b1['count']} kinds={b1['kinds']}")
        page.wait_for_timeout(120)
        b2 = page.evaluate(BUFF2_JS)
        check('D2 rebuilt buff row still 2 canvas.buff-ic, kinds unchanged',
              b2['count'] == 2 and b2['kinds'] == ['T_SWORD', 'T_FIRE'],
              f"count={b2['count']} kinds={b2['kinds']}")
        check('D3 buff texts updated to new turns (3t/7t, no 5t/10t)',
              '(3t)' in b2['text'] and '(7t)' in b2['text']
              and '(5t)' not in b2['text'] and '(10t)' not in b2['text'],
              f"text={b2['text'][:80]!r}")
        check('D4 the pooled canvases are the SAME DOM nodes (dataset marks survived)',
              b2['marks'] == ['one0', 'one1'], f"marks={b2['marks']}")
        check('D5 the pooled canvases are the SAME object identities (pool reuse)',
              b2['sameIdentity'], f"sameIdentity={b2['sameIdentity']}")
        bb = page.evaluate("""() => {
            const r = document.getElementById('buff-list').getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height };
        }""")
        page.screenshot(path=os.path.join(OUT, 'buff_row.png'), clip={
            'x': max(0, bb['x'] - 12), 'y': max(0, bb['y'] - 12),
            'width': min(1280, bb['w'] + 24), 'height': bb['h'] + 24})

        # ============ D-vig: cached vignette determinism + presence ============
        print('[D] vignette: render determinism + composited overlay presence')
        v = page.evaluate(VIG_JS)
        check('E1 render() twice on identical state -> identical main-canvas PNG',
              v['url1'] == v['url2'], 'toDataURL differs between two renders')
        vi = v['vigInfo']
        if vi is None:
            check('E2 vignette overlay composited (full-size drawImage source captured)',
                  False, 'no full-size source observed during render()')
        else:
            check('E2 vignette overlay composited: full-size source, radial alpha '
                  '(center 0, corners > 30, wide alpha histogram)',
                  vi['center'] <= 8 and vi['cornerMax'] > 30 and vi['distinctAlphas'] > 40,
                  f"{vi['w']}x{vi['h']} center_a={vi['center']} corner_max_a={vi['cornerMax']} "
                  f"distinct_alphas={vi['distinctAlphas']} full_sources={vi['fullSources']}")
        check('E3 vignette canvas node REUSED across renders (cache, no churn)',
              v['sameNode'] is True, f"sameNode={v['sameNode']}")

        page.screenshot(path=os.path.join(OUT, 'game_state.png'))
        browser.close()

    fails = [r for r in results if not r[1]]
    print(f"\nTotal {len(results)} checks, {len(fails)} failed")
    print(f"Console errors: {len(console_errors)}")
    for e in console_errors[:10]:
        print('  ERR:', e[:200])
    print(f"Evidence PNGs: {OUT}")
    with open(os.path.join(OUT, 'verify_batch5_results.json'), 'w', encoding='utf-8') as f:
        json.dump({'checks': results, 'console_errors': console_errors,
                   'equivalence': [{'route': r['name'], 'diff_px': r['diff'],
                                    'cache_hit_diff_px': r['hitDiff'],
                                    'painted_old_new': [r['oldPainted'], r['newPainted']],
                                    'dark_old_new': [r['oldDark'], r['newDark']]} for r in eq['routes']],
                   'fractional': eq['fractional'], 'cache': eq['cache'],
                   'vignette': v.get('vigInfo')}, f, ensure_ascii=False, indent=1)
    sys.exit(1 if fails or console_errors else 0)


if __name__ == '__main__':
    main()
