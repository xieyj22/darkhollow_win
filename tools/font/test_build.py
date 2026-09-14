# tools/font/test_build.py — build pipeline self-check (artifacts + gates)
import sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
RESULTS = []
def check(name, ok, detail=''):
    RESULTS.append((name, ok)); print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ''))

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'fonts')
REG = os.path.join(OUT_DIR, 'darkhollow-runes.woff2')
ERO = os.path.join(OUT_DIR, 'darkhollow-runes-eroded.woff2')

check('regular woff2 exists', os.path.isfile(REG))
check('eroded woff2 exists', os.path.isfile(ERO))

if os.path.isfile(REG) and os.path.isfile(ERO):
    from fontTools.ttLib import TTFont
    for path, family, coverage in ((REG, 'Darkhollow Runes', 'A09a%'),
                                   (ERO, 'Darkhollow Runes Eroded', 'A09')):  # Eroded 仅大写+数字，无小写无符号
        f = TTFont(path)
        check(f'{family}: woff2 flavor', f.flavor == 'woff2')
        sz = os.path.getsize(path)
        check(f'{family}: size < 60KB gate', sz < 60 * 1024, f'{sz/1024:.1f}KB')
        cmap = f.getBestCmap()
        check(f'{family}: cmap covers {coverage!r}', all(ord(c) in cmap for c in coverage))
        name = f['name'].getDebugName(1)
        check(f'{family}: familyName correct', name == family, str(name))
        # advance 一致性：所有字形统一 advance（monospaced 语义）
        hm = f['hmtx']
        advs = {hm[ch][0] for ch in f.getGlyphOrder() if ch != '.notdef'}
        check(f'{family}: unified advance', len(advs) == 1, str(advs))

# M5: artifact-drift pin（批15 重制为真同步门）——
# 批14 版缺陷①：fontTools 默认 recalcTimestamp 使每次 build 字节必变，pin 语义反转
# （"改字形不 build"时产物未变反而绿、正常 rebuild 必红）。缺陷②：即便字节稳定，
# pin 只比对"已提交产物 vs 常量"，仍检测不到"改了 glyphs.py 但没重 build"。
# 现构建已确定性（STAMP 常量 + recalcTimestamp=False），门升级为三向同步：
# 源码重建 hash == pin == 已提交产物。任一侧漂移即红。
import hashlib
import subprocess
import tempfile
PIN = {'reg': '9d6a912d184cbe12', 'ero': 'b472f97744d734d3'}
def _h(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()[:16]
check('artifact drift pin (regular)', _h(REG) == PIN['reg'], _h(REG))
check('artifact drift pin (eroded)', _h(ERO) == PIN['ero'], _h(ERO))
# 三向同步：从当前源码重建（落临时目录，不触碰 public/），重建结果须与 pin 一致。
# 字节级 pin 隐含绑定 fontTools/brotli 编码器版本 —— 换版本致重建 hash 漂移时，
# 先升级本机与 CI 的 pin 版本再重 build（本 pin 产自 fontTools 4.63.0 + brotli 1.2.0）。
with tempfile.TemporaryDirectory() as td:
    code = (
        'import sys, os; sys.path.insert(0, %r); import build_font as bf\n'
        'bf.OUT_DIR = %r\n'
        'bf.main()' % (os.path.dirname(os.path.abspath(__file__)), td)
    )
    r = subprocess.run([sys.executable, '-c', code], capture_output=True, text=True)
    # rc!=0 时产物可能缺失——先判存在再 hash，保证 FAIL 行能打出 stderr 尾部而非 traceback
    _reg_p, _ero_p = os.path.join(td, 'darkhollow-runes.woff2'), os.path.join(td, 'darkhollow-runes-eroded.woff2')
    rb_reg = _h(_reg_p) if os.path.isfile(_reg_p) else ''
    rb_ero = _h(_ero_p) if os.path.isfile(_ero_p) else ''
    check('rebuild-from-source is deterministic & matches pin (regular)', r.returncode == 0 and rb_reg == PIN['reg'],
          f'rc={r.returncode} {rb_reg}' + (r.stderr[-200:] if r.returncode else ''))
    check('rebuild-from-source is deterministic & matches pin (eroded)', r.returncode == 0 and rb_ero == PIN['ero'],
          f'rc={r.returncode} {rb_ero}')

fails = [n for n, ok in RESULTS if not ok]
print(f"TOTAL {len(RESULTS)-len(fails)}/{len(RESULTS)}")
sys.exit(1 if fails else 0)
