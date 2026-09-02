# tools/font/test_glyphs.py — self-check harness（电池惯例，exit 0/1）
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
RESULTS = []
def check(name, ok, detail=''):
    RESULTS.append((name, ok)); print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ''))

from glyphs import Glyph, GLYPHS, validate_glyphs, VW, HW, ADV

check('glyph H exists and is 10x14', 'H' in GLYPHS and GLYPHS['H'].width == 10 and GLYPHS['H'].height == 14)
check('validate passes for the seeded set', validate_glyphs(set('HIELT')) == [])
bad = validate_glyphs({'Ø'})  # a glyph that will never exist
check('validate flags missing glyph', bad != [])
check('H ink present on both stems', GLYPHS['H'].px(1, 7) and GLYPHS['H'].px(7, 7))
check('stem width is 3 (竖笔，取纯竖行 y=4 避开中横)', GLYPHS['H'].px(0, 4) and GLYPHS['H'].px(1, 4) and GLYPHS['H'].px(2, 4) and not GLYPHS['H'].px(3, 4))
check('unified advance is 12px', ADV == 12)

# Task 2 增补：A-Z + 0-9 完备
import string
ALNUM = set(string.ascii_uppercase + string.digits)
errs = validate_glyphs(ALNUM)
check('A-Z + 0-9 complete (36 glyphs)', errs == [], str(errs[:3]))
for ch in 'AOHK27':
    g = GLYPHS[ch]
    # 双竖全高字形（H/A/O）竖 3px×2 已占 6/10 列，着墨率上限放宽到 72%
    check(f'{ch} ink 10%-72% sanity', 0.10 <= g.ink_ratio() <= 0.72, f'{g.ink_ratio():.2f}')

# Task 3 增补：全字符集 85
FULL = set(string.ascii_letters + string.digits + ".,:;!?-'\"-+/()<>= ♥✦★")
errs = validate_glyphs(FULL)
check('full charset 85 complete', len(errs) == 0, f'missing={sorted(set(e.split()[-1] for e in errs))[:5]}' if errs else '')
check('charset cardinality', len(FULL & set(GLYPHS)) >= 85, str(len(FULL & set(GLYPHS))))

fails = [n for n, ok in RESULTS if not ok]
print(f"TOTAL {len(RESULTS)-len(fails)}/{len(RESULTS)}")
sys.exit(1 if fails else 0)
