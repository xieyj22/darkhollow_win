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
# 批15 runicize Hᚻ：单竖 + 双横枝（旧双竖断言随字形退役）
check('H runic: single stem + both cross-arms', GLYPHS['H'].px(3, 7) and GLYPHS['H'].px(6, 2) and GLYPHS['H'].px(6, 8) and not GLYPHS['H'].px(8, 6))
check('stem width is 3 (竖笔，取纯竖行 y=4 避开横枝)', GLYPHS['H'].px(2, 4) and GLYPHS['H'].px(3, 4) and GLYPHS['H'].px(4, 4) and not GLYPHS['H'].px(5, 4))
check('unified advance is 12px', ADV == 12)

# ---- 批15：runicize 扩展 +6（Lᛚ Hᚻ Kᚲ Wᚹ Sᛋ Pᛈ）特征断言 ----
check('L runic ᛚ: full-height stem + low diagonal branch, no bottom bar',
      GLYPHS['L'].px(3, 0) and GLYPHS['L'].px(8, 13) and not GLYPHS['L'].px(5, 12))
check('K runic ᚲ: stem + twin short down-diagonals (direction pinned — mirror fails)',
      GLYPHS['K'].px(3, 0) and GLYPHS['K'].px(6, 4) and GLYPHS['K'].px(6, 9) and not GLYPHS['K'].px(6, 2))
check('W runic ᚹ: stem + rising apex arm, clean below',
      GLYPHS['W'].px(3, 7) and GLYPHS['W'].px(7, 2) and not GLYPHS['W'].px(7, 10))
check('S runic ᛋ: two offset steep strokes, no full-height stem',
      GLYPHS['S'].px(3, 3) and GLYPHS['S'].px(5, 10)
      and not (GLYPHS['S'].px(2, 0) and GLYPHS['S'].px(2, 7) and GLYPHS['S'].px(2, 13)))
check('P runic ᛈ: stem + right wall + floor bar + open top mouth',
      GLYPHS['P'].px(8, 3) and GLYPHS['P'].px(5, 8) and not GLYPHS['P'].px(5, 3))

# Task 2 增补：A-Z + 0-9 完备
import string
ALNUM = set(string.ascii_uppercase + string.digits)
errs = validate_glyphs(ALNUM)
check('A-Z + 0-9 complete (36 glyphs)', errs == [], str(errs[:3]))
for ch in 'AOHK27':
    g = GLYPHS[ch]
    # 批15 后仅 O 保留双竖全高；Hᚻ/Aᚨ 已单竖化，72% 上限沿用（O 竖 3px×2 占 6/10 列仍是最密）
    check(f'{ch} ink 10%-72% sanity', 0.10 <= g.ink_ratio() <= 0.72, f'{g.ink_ratio():.2f}')

# Task 3 增补：全字符集 85
FULL = set(string.ascii_letters + string.digits + ".,:;!?-'\"-+/()<>= %*#♥✦★")
errs = validate_glyphs(FULL)
check('full charset 85 complete', len(errs) == 0, f'missing={sorted(set(e.split()[-1] for e in errs))[:5]}' if errs else '')
check('charset cardinality', len(FULL & set(GLYPHS)) >= 85, str(len(FULL & set(GLYPHS))))

fails = [n for n, ok in RESULTS if not ok]
print(f"TOTAL {len(RESULTS)-len(fails)}/{len(RESULTS)}")
sys.exit(1 if fails else 0)
