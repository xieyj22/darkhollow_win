# tools/font/build_font.py — Darkhollow Runes 构建管线（spec §5）
# 位图字形 → fontTools 矢量轮廓（每像素一个方形 contour）→ TTF → WOFF2。
# 用法：python tools/font/build_font.py   （产物落 public/fonts/）
import os

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

from glyphs import GLYPHS, ADV, validate_glyphs
from erode import erode

SCALE = 64            # 1px = 64 units
UPM = 1024            # units per em（=16px 语义网格）
SEED = 13             # 侵蚀种子（spec：固定种子=确定性）
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'fonts')


def _bitmap_to_glyph(g, pen: TTGlyphPen, x_off: int = 0):
    """每着墨像素画一个 1px 方形 contour（重叠无碍，non-zero fill）。
    x_off：字形在 advance 内的水平偏移（窄字形居中 —— spec §5，review I2）。"""
    for y in range(g.height):
        for x in range(g.width):
            if g.g[y][x]:
                x0, y0 = (x + x_off) * SCALE, (g.baseline - y) * SCALE
                pen.moveTo((x0, y0))
                pen.lineTo((x0 + SCALE, y0))
                pen.lineTo((x0 + SCALE, y0 + SCALE))
                pen.lineTo((x0, y0 + SCALE))
                pen.closePath()


def build(subset: dict, family: str, style: str, woff2_path: str) -> None:
    errs = validate_glyphs(set(subset))
    if errs:
        raise SystemExit(f'glyph validation failed: {errs}')

    fb = FontBuilder(UPM, isTTF=True)
    adv = ADV * SCALE
    glyph_order = ['.notdef'] + [ch if ch != ' ' else 'space' for ch in subset]
    cmap = {ord(ch): (ch if ch != ' ' else 'space') for ch in subset}  # M2: 空格也映射（本字体 advance）

    fb.setupGlyphOrder(glyph_order)
    fb.setupCharacterMap(cmap)

    glyphs = {'.notdef': TTGlyphPen(None).glyph()}
    offs = {}
    for ch, g in subset.items():
        pen = TTGlyphPen(None)
        offs[ch] = max(0, (ADV - g.width) // 2)      # review I2: 窄字形居中
        _bitmap_to_glyph(g, pen, offs[ch])
        glyphs[ch if ch != ' ' else 'space'] = pen.glyph()
    fb.setupGlyf(glyphs)
    hm = {'.notdef': (adv, 0)}
    hm.update({(ch if ch != ' ' else 'space'): (adv, offs[ch] * SCALE) for ch in subset})
    fb.setupHorizontalMetrics(hm)
    fb.setupHorizontalHeader(ascent=14 * SCALE, descent=-3 * SCALE)
    fb.setupOS2(sTypoAscender=14 * SCALE, sTypoDescender=-3 * SCALE, usWinAscent=14 * SCALE, usWinDescent=3 * SCALE)
    fb.setupNameTable({
        'familyName': family,
        'styleName': style,
        'uniqueFontIdentifier': f'{family} {style} 1.0',
        'fullName': f'{family} {style}',
        'psName': family.replace(' ', '') + '-' + style,
        'version': 'Version 1.0',
    })
    # format 3.0（无 glyph 名）—— ♥✦★ 等字形名超出 latin-1，format 2.0 会炸
    fb.setupPost(keepGlyphNames=False)

    ttf_tmp = woff2_path + '.tmp.ttf'
    fb.save(ttf_tmp)

    f = TTFont(ttf_tmp)
    f.flavor = 'woff2'
    f.save(woff2_path)
    os.remove(ttf_tmp)
    print(f'built {woff2_path} ({os.path.getsize(woff2_path)/1024:.1f} KB, {len(subset)} glyphs)')


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)

    build(GLYPHS, 'Darkhollow Runes', 'Regular',
          os.path.join(OUT_DIR, 'darkhollow-runes.woff2'))

    import string
    eroded = {ch: erode(GLYPHS[ch], SEED) for ch in string.ascii_uppercase + string.digits}
    build(eroded, 'Darkhollow Runes Eroded', 'Regular',
          os.path.join(OUT_DIR, 'darkhollow-runes-eroded.woff2'))


if __name__ == '__main__':
    main()
