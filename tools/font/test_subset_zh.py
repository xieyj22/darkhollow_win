# tools/font/test_subset_zh.py — 批16 zh pixel 子集管线自检（产物门 + 覆盖门 + 确定性三向门）
# 模式照抄 test_build.py：check() + TOTAL + 非零退出；PIN 隐含绑定 fontTools/brotli 版本
#（本 pin 产自 fontTools 4.63.0 + brotli 1.2.0，与 CI 一致）。
import sys, io, os, hashlib
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
RESULTS = []
def check(name, ok, detail=''):
    RESULTS.append((name, ok)); print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ''))

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
ART = os.path.join(ROOT, 'public', 'fonts', 'darkhollow-zh-pixel.woff2')
OFL = os.path.join(ROOT, 'public', 'fonts', 'FusionPixel-OFL.txt')
SRC = os.path.join(HERE, 'fusion-pixel-12px-monospaced.full.woff2')

check('artifact woff2 exists', os.path.isfile(ART))
check('OFL license text ships alongside (OFL 1.1 redistribution duty)', os.path.isfile(OFL))
check('vendored source font exists', os.path.isfile(SRC))

if all(os.path.isfile(p) for p in (ART, OFL, SRC)):
    from fontTools.ttLib import TTFont
    import subset_zh

    # —— 产物门 ——
    f = TTFont(ART)
    check('woff2 flavor', f.flavor == 'woff2', str(f.flavor))
    name = f['name'].getDebugName(1)
    check('family renamed to Darkhollow Zh Pixel (子集=Modified Version, 源无 RFN 故改名合法)', name == 'Darkhollow Zh Pixel', str(name))
    sz = os.path.getsize(ART)
    check('size < 400KB gate', sz < 400 * 1024, f'{sz/1024:.1f}KB')

    # —— 覆盖门 ——
    cs = subset_zh.scan_charset(subset_zh.default_sources(ROOT))
    check('charset extraction non-trivial (1000..5000)', 1000 < len(cs) < 5000, f'{len(cs)} chars')
    cmap = f.getBestCmap()
    src_cmap = TTFont(SRC).getBestCmap()
    # 覆盖语义（review I1 后）：源字体有的字形必须全收；源没有的（emoji/符文等）按设计
    # 过滤 → CSS 栈 fallback 系统 emoji 字体，不算缺失
    missing = [c for c in cs if ord(c) not in cmap and ord(c) in src_cmap]
    skipped = ''.join(c for c in cs if ord(c) not in src_cmap)[:30]
    check('source-covered charset 100% in artifact (源有必收)', len(missing) == 0, ''.join(missing[:20]))
    check('source-absent chars intentionally skipped to fallback', all(ord(c) not in cmap for c in cs if ord(c) not in src_cmap), skipped)
    # review I1: zh 串里的伴随符号（⚒ — … ·）必须收编——否则像素标题里混 JBM 入侵者。
    # 伴随符号 = 出现在「含汉字的字面量」里的全部非 ASCII；en 独有符号不收（en 模式锚位零扰动）。
    for sym in ['⚒', '—', '…', '·']:
        check(f'companion symbol {sym!r} collected (review I1)', sym in cs)

    # —— 扫描器行为锁定（字符串字面量粒度, RED-first）——
    import tempfile, pathlib as _pl
    with tempfile.TemporaryDirectory() as td:
        probe = _pl.Path(td) / 'probe.ts'
        probe.write_text(
            "// 注释里的汉字铸不收\n"
            "const enOnly = '★ Soul Forge';\n"
            "const zhLit = '⚒ 铸魂炉 — 永久';\n"
            "const url = 'https://x//深渊.example';\n",
            encoding='utf-8')
        got = subset_zh.scan_charset([probe])
        check('scanner: zh literal companions collected (⚒—)', '⚒' in got and '—' in got)
        check('scanner: en-only literal symbols excluded (★)', '★' not in got)
        check('scanner: comment zh excluded', '注' not in got)
        check('scanner: // inside string literal does not truncate scan (深渊 after // collected)',
              '深' in got and '渊' in got)

    # —— 确定性门（批15 纪律：recalcTimestamp=False + 固定源 → 字节可复现）——
    # 单次重建对比产物即可证确定性（产物由上次运行产出 = 跨进程对照）;省 CI ~30s（review M3）
    def _h(b): return hashlib.sha256(b).hexdigest()[:16]
    art_bytes = open(ART, 'rb').read()
    b1 = subset_zh.build_subset(SRC, cs)
    check('rebuild == committed artifact (3-way sync)', b1 == art_bytes, f'rebuilt={_h(b1)} art={_h(art_bytes)}')

fails = [n for n, ok in RESULTS if not ok]
print(f"TOTAL {len(RESULTS)-len(fails)}/{len(RESULTS)}")
sys.exit(1 if fails else 0)
