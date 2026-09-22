# tools/font/subset_zh.py — 批16 Darkhollow Zh Pixel 子集管线
#
# 源字体: Fusion Pixel Font 12px monospaced zh_hans — TakWolf, SIL OFL 1.1（无 Reserved
# Font Name，子集化+改名合法；随包分发义务=附带 OFL 文本 → public/fonts/FusionPixel-OFL.txt）。
# 字符集=src 全量 TS+index.html 剥注释后的中文区间（未来新增字不在子集 → CSS 栈回退
# JetBrains Mono→雅黑，不豆腐块；重跑本脚本收编）。
#
# 用法: python tools/font/subset_zh.py   → 重建 public/fonts/darkhollow-zh-pixel.woff2
# 确定性: 源为固定 vendored 文件 + recalcTimestamp=False → 字节可复现（批15 纪律），
# pin 见 test_subset_zh.py（隐含绑定 fontTools/brotli 版本，与 CI 同 pin）。
import io, os, re, pathlib
from fontTools import subset
from fontTools.ttLib import TTFont

FAMILY = 'Darkhollow Zh Pixel'
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
SRC_FONT = os.path.join(HERE, 'fusion-pixel-12px-monospaced.full.woff2')
OUT = os.path.join(ROOT, 'public', 'fonts', 'darkhollow-zh-pixel.woff2')


def _is_zh(c: str) -> bool:
    o = ord(c)
    # CJK 统一表意+部首/康熙 等 2E80-9FFF + 全角形式 FF00-FFEF + CJK 标点 3000-303F
    return (0x2E80 <= o <= 0x9FFF) or (0xFF00 <= o <= 0xFFEF) or (0x3000 <= o <= 0x303F)


# 字符串字面量提取（review I1）：只从「含汉字的字面量」收集全部非 ASCII——
# 伴随符号（⚒ — … ·）随中文串收编避免像素标题混 JBM 入侵者；en 独有符号不收
# （en 模式锚位零扰动）；注释里的汉字天然不进字面量。不处理转义/插值=优雅降级（漏→fallback）。
_LIT_RE = re.compile(r"'([^'\\\n]*)'|\"([^\"\\\n]*)\"|`([^`\\]*)`")


def default_sources(root: str) -> list:
    src = pathlib.Path(root) / 'src'
    files = [p for p in src.rglob('*.ts') if not p.name.endswith('.test.ts')]
    files.append(pathlib.Path(root) / 'index.html')
    return files


def scan_charset(files) -> str:
    chars = set()
    for p in files:
        txt = p.read_text(encoding='utf-8')
        for m in _LIT_RE.finditer(txt):
            lit = next(g for g in m.groups() if g is not None)
            if any(_is_zh(c) for c in lit):
                chars.update(c for c in lit if ord(c) > 0x7E)
    return ''.join(sorted(chars))


def build_subset(src_font: str, charset: str) -> bytes:
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.hinting = False            # 12px 方角轮廓，hinting 无谓体积
    opts.desubroutinize = True
    opts.drop_tables += ['DSIG']
    font = TTFont(src_font)
    font.recalcTimestamp = False    # 保留源内时间戳 → 同源重建字节一致
    # 源没有的字形（如 emoji）静默跳过 → 留在 CSS 栈 fallback（系统 emoji 字体）
    have = ''.join(c for c in charset if ord(c) in font.getBestCmap())
    ss = subset.Subsetter(options=opts)
    ss.populate(text=have)
    ss.subset(font)
    # 改名（OFL 无 RFN → Modified Version 可改名）；Mac(1,0,0)+Win(3,1,0x409) 双记录
    nm = font['name']
    nm.names = [r for r in nm.names if r.nameID not in (16, 17, 18, 20, 22)]  # 防旧 typographic family 残留
    for pid, eid, lid in ((3, 1, 0x409), (1, 0, 0)):
        nm.setName(FAMILY, 1, pid, eid, lid)
        nm.setName('Regular', 2, pid, eid, lid)
        nm.setName(FAMILY, 4, pid, eid, lid)
        nm.setName('DarkhollowZhPixel', 6, pid, eid, lid)
    buf = io.BytesIO()
    font.save(buf)                  # flavor 自 woff2 源继承
    return buf.getvalue()


def main() -> None:
    cs = scan_charset(default_sources(ROOT))
    data = build_subset(SRC_FONT, cs)
    with open(OUT, 'wb') as f:
        f.write(data)
    print(f'{FAMILY}: {len(cs)} chars -> {OUT} ({len(data)/1024:.1f}KB)')


if __name__ == '__main__':
    main()
