# 批16 电池: 中文像素字体大字号锚位 — 游戏内真验证
# 前置: npm run dev -- --port 5173 --strictPort (或本脚本自起)
# 检查:
#   C1 字体真注册 (C1 教训: fonts.check 空真 — 用 family 枚举 + measureText 带回退串差分)
#   C2 标题屏 #title-h2 栈含 ZhPixel + 计算字号 24px; .menu-btn 24px
#   C3 真实 playerDeath 死亡屏 h1 48px + 栈含 ZhPixel (英文模式零变化: h1 无 runes)
#   C4 面板标题 .panel h2 24px (开局开背包面板)
#   C0 全程零 console error (favicon 404 按 location 白名单 — 批7 M7 纪律)
# 产物: E:/tmp/batch16-title.png + batch16-death.png (用户目检)
import subprocess, time, sys, os
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

with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome')
    pg = b.new_page(viewport={'width': 1280, 'height': 800}, device_scale_factor=1)
    errors = []
    pg.on('console', lambda m: errors.append(f"{m.text} @{(m.location or {}).get('url', '')}") if m.type == 'error' else None)
    pg.on('response', lambda r: errors.append(f'{r.status} {r.url}') if r.status >= 400 else None)

    pg.goto(URL)
    pg.evaluate("localStorage.setItem('dh_lang','zh')")
    pg.reload()
    pg.wait_for_timeout(1500)

    # —— C1 真注册 ——
    fams = pg.evaluate("[...document.fonts].map(f=>f.family)")
    check('C1a family registered in document.fonts', any('Darkhollow Zh Pixel' in f for f in fams), str(fams))
    diff = pg.evaluate("""(() => {
      const c = document.createElement('canvas').getContext('2d');
      c.font = '24px "Darkhollow Zh Pixel", monospace';
      const m1 = c.measureText('深渊降临');
      c.font = '24px monospace';
      const m2 = c.measureText('深渊降临');
      // 宽度差分对全角 CJK 恒 0（两族 advance 都=1em）——竖直度量差分才是真判据
      return m1.fontBoundingBoxAscent - m2.fontBoundingBoxAscent;
    })()""")
    check('C1b fontBoundingBox differential != 0 (真字形在渲染, 非空真 check)', abs(diff) > 0.5, f'diff={diff}')

    # —— C2 标题屏锚位 ——
    st = pg.evaluate("getComputedStyle(document.getElementById('title-h2'))")
    check('C2a #title-h2 stack contains ZhPixel', 'Darkhollow Zh Pixel' in st['fontFamily'], st['fontFamily'])
    check('C2b #title-h2 computed size 24px', st['fontSize'] == '24px', st['fontSize'])
    mb = pg.evaluate("getComputedStyle(document.querySelector('.menu-btn'))")
    check('C2c .menu-btn computed size 24px', mb['fontSize'] == '24px', mb['fontSize'])
    check('C2d .menu-btn stack contains ZhPixel', 'Darkhollow Zh Pixel' in mb['fontFamily'], mb['fontFamily'])
    pg.screenshot(path=f'{OUT}/batch16-title.png')

    # —— 进局 + C4 面板标题 ——
    pg.click('#btn-new'); pg.wait_for_timeout(400)
    cs = pg.evaluate("getComputedStyle(document.querySelector('#char-sel h2'))")
    check('C4a #char-sel h2 stack contains ZhPixel', 'Darkhollow Zh Pixel' in cs['fontFamily'], cs['fontFamily'])
    check('C4b #char-sel h2 inline round() resolved 24px', cs['fontSize'] == '24px', cs['fontSize'])
    pg.click('#start-btn'); pg.wait_for_timeout(900)
    pg.keyboard.press('i'); pg.wait_for_timeout(300)   # 开背包面板
    ph = pg.evaluate("getComputedStyle(document.querySelector('.panel h2'))")
    check('C4c .panel h2 size 24px (round(nearest,1.4em,12px))', ph['fontSize'] == '24px', ph['fontSize'])
    check('C4d .panel h2 stack contains ZhPixel', 'Darkhollow Zh Pixel' in ph['fontFamily'], ph['fontFamily'])
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)

    # —— C3 真实 playerDeath ——
    pg.evaluate("""(async () => {
      const c = await import('/src/combat.ts');
      c.playerDeath('批十六冒烟', 'combat');
    })()""")
    pg.wait_for_timeout(800)
    h1 = pg.evaluate("getComputedStyle(document.querySelector('#death-screen h1'))")
    check('C3a death h1 size 48px (round(nearest,3em,12px))', h1['fontSize'] == '48px', h1['fontSize'])
    check('C3b death h1 stack contains ZhPixel + mono (英文模式零变化=无 runes)', 'Darkhollow Zh Pixel' in h1['fontFamily'] and 'mono' in h1['fontFamily'] and 'Runes' not in h1['fontFamily'], h1['fontFamily'])
    vis = pg.evaluate("getComputedStyle(document.getElementById('death-screen')).display")
    check('C3c death screen visible', vis != 'none', vis)
    pg.screenshot(path=f'{OUT}/batch16-death.png')

    # —— C0 console 门 (favicon 按 location 白名单) ——
    real = [e for e in errors if 'favicon' not in e]
    check('C0 zero console errors', len(real) == 0, '; '.join(real[:3]))
    b.close()

if started:
    started.terminate()
fails = [n for n, ok in RESULTS if not ok]
print(f"TOTAL {len(RESULTS)-len(fails)}/{len(RESULTS)}")
sys.exit(1 if fails else 0)
