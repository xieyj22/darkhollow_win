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

fails = [n for n, ok in RESULTS if not ok]
print(f"TOTAL {len(RESULTS)-len(fails)}/{len(RESULTS)}")
sys.exit(1 if fails else 0)
