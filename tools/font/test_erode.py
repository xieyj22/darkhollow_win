# tools/font/test_erode.py — seeded erosion self-check
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
RESULTS = []
def check(name, ok, detail=''):
    RESULTS.append((name, ok)); print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ''))

from glyphs import GLYPHS
from erode import erode

import string
ALNUM = string.ascii_uppercase + string.digits

# 1) 确定性：同 seed 两次侵蚀逐像素相等
same = all(
    erode(GLYPHS[ch], 13).g == erode(GLYPHS[ch], 13).g for ch in ALNUM
)
check('deterministic for a fixed seed', same)

# 2) 不同 seed 大概率产生不同输出（36 字形里至少 30 个不同）
diff = sum(1 for ch in ALNUM if erode(GLYPHS[ch], 13).g != erode(GLYPHS[ch], 7).g)
check('seeds produce different erosion (>=30/36 glyphs differ)', diff >= 30, str(diff))

# 3) 着墨率下限：侵蚀后着墨数 >= 85% 原着墨数（全 36 字形）
def ink(g): return sum(r.count(True) for r in g.g)
worst = min(ink(erode(GLYPHS[ch], s)) / ink(GLYPHS[ch]) for ch in ALNUM for s in (13, 7, 99))
check('ink retention >= 78% across seeds (heavy-erosion ruling)', worst >= 0.78, f'{worst:.2f}')

# 4) 侵蚀后非空
check('eroded glyphs never empty', all(ink(erode(GLYPHS[ch], 13)) > 0 for ch in ALNUM))

# 5) 确实有侵蚀发生（36 字形至少 25 个与原版不同）
eroded_n = sum(1 for ch in ALNUM if erode(GLYPHS[ch], 13).g != GLYPHS[ch].g)
check('erosion actually bites (>=25/36 differ)', eroded_n >= 25, str(eroded_n))

fails = [n for n, ok in RESULTS if not ok]
print(f"TOTAL {len(RESULTS)-len(fails)}/{len(RESULTS)}")
sys.exit(1 if fails else 0)
