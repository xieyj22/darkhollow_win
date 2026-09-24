# 批18 电池: 标题屏分级 + 退出按钮 + 地图跟随 UI 缩放 — 游戏内真验证
# 前置: npm run dev -- --port 5173 --strictPort (或本脚本自起)
# 检查:
#   T1 标题屏分级: 继续/新游戏=primary实心, 熔炉=secondary, 记录/图鉴=small双列, 底部3文字链
#   T2 退出按钮: 浏览器UA→DOM移除; Electron UA→在位且可聚焦
#   T3 地图缩放: dh_zoom=1.3 进局 → canvas backing=整格数, CSS/backing≈1.3, 每格显示≈TS*1.3
#   T4 zoom=1.0 基线不受影响 (CSS/backing≈1.0)
#   T5 选项面板滑条实时改 zoom → canvas 即时重算 (POST_CHANGE 链)
#   T0 全程零 console error (favicon 404 白名单 — 批7 M7 纪律)
# 产物: E:/tmp/batch18-title.png + batch18-zoom13.png + batch18-zoom10.png (用户目检)
import subprocess, time, sys, os, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

URL = 'http://localhost:5173'
OUT = 'E:/tmp'

started = None
try:
    import urllib.request
    urllib.request.urlopen(URL, timeout=2)
except Exception:
    started = subprocess.Popen(
        ['cmd', '/c', 'npm run dev -- --port 5173 --strictPort'],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, shell=False)
    time.sleep(6)

RESULTS = []
def check(name, ok, detail=''):
    RESULTS.append((name, ok)); print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ''))

def canvas_metrics(pg):
    return pg.evaluate("""(() => {
      const c = document.getElementById('game-canvas');
      const r = c.getBoundingClientRect();
      return { w: c.width, h: c.height, rw: r.width, rh: r.height,
               cssW: parseFloat(c.style.width), cssH: parseFloat(c.style.height) };
    })()""")

def enter_game(pg, zoom):
    pg.evaluate(f"localStorage.setItem('dh_zoom','{zoom}')")
    pg.goto(URL); pg.reload(); pg.wait_for_timeout(1200)
    pg.click('#btn-new'); pg.wait_for_timeout(400)
    pg.click('#start-btn'); pg.wait_for_timeout(900)

TS = 22
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome')
    pg = b.new_page(viewport={'width': 1280, 'height': 800}, device_scale_factor=1)
    errors = []
    pg.on('console', lambda m: errors.append(f"{m.text} @{(m.location or {}).get('url', '')}") if m.type == 'error' else None)
    pg.on('response', lambda r: errors.append(f'{r.status} {r.url}') if r.status >= 400 else None)

    pg.goto(URL)
    pg.evaluate("localStorage.setItem('dh_lang','zh')")
    pg.reload(); pg.wait_for_timeout(1500)

    # —— T1 标题屏分级 ——
    prim = pg.evaluate("getComputedStyle(document.getElementById('btn-cont'))")
    check('T1a btn-cont 实心红 (background=accent-red)', prim['backgroundColor'] == 'rgb(230, 57, 70)', prim['backgroundColor'])
    check('T1b btn-cont 深色字 (对比)', prim['color'] == 'rgb(10, 10, 15)', prim['color'])
    prim2 = pg.evaluate("getComputedStyle(document.getElementById('btn-new'))")
    check('T1c btn-new 同为 primary', prim2['backgroundColor'] == 'rgb(230, 57, 70)')
    sec = pg.evaluate("getComputedStyle(document.getElementById('btn-forge'))")
    check('T1d btn-forge secondary 无填充+暗边框', sec['backgroundColor'] == 'rgba(0, 0, 0, 0)' and '85, 85, 85' in sec['borderTopColor'], sec['borderTopColor'])
    sm = pg.evaluate("getComputedStyle(document.getElementById('btn-records'))")
    check('T1e btn-records small (min-width 150px)', sm['minWidth'] == '150px', sm['minWidth'])
    links = pg.evaluate("document.querySelectorAll('.title-link').length")
    check('T1f 浏览器态底部 2 文字链 (说明/选项; 退出仅 Electron)', links == 2, f'links={links}')
    order = pg.evaluate("[...document.querySelectorAll('.menu-btn')].map(b=>b.id)")
    check('T1g 视觉顺序 cont→new→forge→records/codex', order[:5] == ['btn-cont', 'btn-new', 'btn-forge', 'btn-records', 'btn-codex'], str(order))
    pg.screenshot(path=f'{OUT}/batch18-title.png')

    # —— T2 退出按钮 ——
    gone = pg.evaluate("document.getElementById('btn-quit') === null")
    check('T2a 浏览器 UA → btn-quit 已从 DOM 移除', gone)
    dot_gone = pg.evaluate("document.getElementById('dot-quit') === null")
    check('T2b 分隔点同步移除 (无悬挂 ·)', dot_gone)

    pe = b.new_page(user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) Electron/33 app/Darkhollow',
                    viewport={'width': 1280, 'height': 800})
    pe.goto(URL)
    pe.evaluate("localStorage.setItem('dh_lang','zh')")
    pe.reload(); pe.wait_for_timeout(1200)
    q = pe.evaluate("(() => { const el = document.getElementById('btn-quit'); if (!el) return null; el.focus(); return { txt: el.textContent, focused: document.activeElement === el }; })()")
    check('T2c Electron UA → btn-quit 在位/中文文案/可聚焦', bool(q) and q['txt'] == '退出' and q['focused'], str(q))
    pe.close()

    # —— T3 地图缩放 1.3 ——
    enter_game(pg, 1.3)
    m = canvas_metrics(pg)
    ratio = m['cssW'] / m['w'] if m['w'] else 0
    check('T3a backing 保持整格 (w%TS==0)', m['w'] % TS == 0, f"w={m['w']}")
    check('T3b CSS/backing ≈ 1.3', abs(ratio - 1.3) < 0.02, f'ratio={ratio:.3f}')
    cols = m['w'] / TS
    tile_px = m['rw'] / cols
    check('T3c 每格显示 ≈ TS*1.3 (28.6px)', abs(tile_px - TS * 1.3) < 0.6, f'tile={tile_px:.2f}')
    area = pg.evaluate("document.getElementById('map-area').clientWidth")
    expect_cols = max(8, int((area - 20) / (TS * 1.3)))
    check('T3d 可见格数=容器/(TS*zoom)', cols == expect_cols, f'cols={cols} expect={expect_cols}')
    pg.screenshot(path=f'{OUT}/batch18-zoom13.png')

    # —— T5 滑条实时改 zoom (POST_CHANGE 链) ——
    pg.evaluate("document.getElementById('btn-options').click()")
    pg.wait_for_timeout(400)
    opened = pg.evaluate("getComputedStyle(document.getElementById('options-overlay')).display")
    check('T5a 选项面板打开', opened == 'flex', opened)
    pg.evaluate("""(() => {
      const tabs = [...document.querySelectorAll('.opt-tab')];
      const disp = tabs.find(t => /显示|Display/.test(t.textContent)); if (disp) disp.click();
    })()""")
    pg.wait_for_timeout(300)
    before = canvas_metrics(pg)
    pg.evaluate("""(() => {
      const sl = document.querySelector('input[type=range][data-optkey=zoom]');
      sl.value = '1'; sl.dispatchEvent(new Event('input', { bubbles: true }));
    })()""")
    pg.wait_for_timeout(300)
    after = canvas_metrics(pg)
    check('T5b 滑条 1.3→1.0 后 CSS 尺寸即时变化', after['cssW'] != before['cssW'], f"{before['cssW']}→{after['cssW']}")
    ratio10 = after['cssW'] / after['w']
    check('T5c 改后 CSS/backing ≈ 1.0', abs(ratio10 - 1.0) < 0.02, f'ratio={ratio10:.3f}')
    check('T5d 可见格数回升 (zoom 变小视野变大)', after['w'] > before['w'], f"w {before['w']}→{after['w']}")
    pg.screenshot(path=f'{OUT}/batch18-zoom10.png')

    # —— T4/T0 收尾 ——
    check('T4 zoom=1.0 基线 CSS 尺寸=backing', abs(after['cssW'] - after['w']) < 1, f"css={after['cssW']} backing={after['w']}")
    real_errors = [e for e in errors if 'favicon' not in e]
    check('T0 零 console error / 4xx', not real_errors, '; '.join(real_errors[:3]))

    b.close()

fails = [n for n, ok in RESULTS if not ok]
print(f"\n== 批18 in-game: {len(RESULTS) - len(fails)}/{len(RESULTS)} PASS ==")
if fails:
    print("FAILED: " + ', '.join(fails)); sys.exit(1)
if started:
    started.terminate()
