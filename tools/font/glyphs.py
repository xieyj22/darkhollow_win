# tools/font/glyphs.py
"""Darkhollow Runes — 铭文石刻风像素字形（spec: 2026-09-02-darkhollow-runes-font-design.md §4.1）。

风格由原语构造保证：竖笔 VW=3、横笔 HW=2、对角 DW=2 —— 改这三个常量即全局改风格
（spec §8 迭代闭环的支点）。构建期机检网格边界与字符集完备（validate_glyphs）。
"""
VW, HW, DW = 3, 2, 2          # 竖/横/对角笔宽（px）
ADV = 12                       # 统一 advance（spec §5：容纳 10px 大写网格 + 两侧 bearing）


class Glyph:
    def __init__(self, width: int, height: int, baseline: int):
        self.width, self.height, self.baseline = width, height, baseline
        self.g = [[False] * width for _ in range(height)]

    def px(self, x: int, y: int) -> bool:
        return 0 <= x < self.width and 0 <= y < self.height and self.g[y][x]

    def set(self, x: int, y: int) -> None:
        if 0 <= x < self.width and 0 <= y < self.height:
            self.g[y][x] = True

    def ink_ratio(self) -> float:
        return sum(row.count(True) for row in self.g) / (self.width * self.height)

    def render_ascii(self) -> str:
        return '\n'.join(''.join('#' if c else '.' for c in row) for row in self.g)


def vline(g: Glyph, x: int, y0: int, y1: int) -> None:
    """竖笔：以 x 为左缘画 VW 宽，y0..y1 含两端。"""
    for y in range(y0, y1 + 1):
        for dx in range(VW):
            g.set(x + dx, y)


def hline(g: Glyph, y: int, x0: int, x1: int) -> None:
    """横笔：以 y 为上缘画 HW 厚，x0..x1 含两端。"""
    for x in range(x0, x1 + 1):
        for dy in range(HW):
            g.set(x, y + dy)


def serif_tip(g: Glyph, x: int, y: int, dx: int) -> None:
    """尖角 serif：竖笔末端向 dx 方向伸 1px（凿刻感）。x 为该竖笔左缘。"""
    g.set(x, y)
    g.set(x + VW - 1 + dx, y)


def diag(g: Glyph, x0: int, y0: int, x1: int, y1: int) -> None:
    """对角线（步进方波，DW 厚）——N K M Q R V W X Y Z 7 等的斜笔。"""
    n = max(abs(x1 - x0), abs(y1 - y0))
    for i in range(n + 1):
        x = x0 + round((x1 - x0) * i / n) if n else x0
        y = y0 + round((y1 - y0) * i / n) if n else y0
        for t in range(DW):
            g.set(x + t, y)
            g.set(x, y + t)


# ---- 大写 10×14, baseline=13（底行 y=13）----

def _caps() -> dict:
    G = {}

    def cap() -> Glyph:
        return Glyph(10, 14, 13)

    g = cap()                                             # H：双竖 + 中横 + 四尖角
    vline(g, 0, 0, 13); vline(g, 7, 0, 13)
    serif_tip(g, 0, 0, -1); serif_tip(g, 0, 13, -1)
    serif_tip(g, 7, 0, 1); serif_tip(g, 7, 13, 1)
    hline(g, 6, 2, 8); G['H'] = g

    g = cap()                                             # I：中竖 + 顶/底全宽横
    vline(g, 4, 2, 11); hline(g, 0, 2, 7); hline(g, 12, 2, 7); G['I'] = g

    g = cap()                                             # T：顶横 + 中竖
    hline(g, 0, 0, 9); vline(g, 4, 2, 13); G['T'] = g

    g = cap()                                             # L：左竖 + 底横
    vline(g, 0, 0, 13); serif_tip(g, 0, 0, -1)
    hline(g, 12, 0, 9); G['L'] = g

    g = cap()                                             # E：左竖 + 三横
    vline(g, 0, 0, 13)
    hline(g, 0, 0, 9); hline(g, 6, 0, 8); hline(g, 12, 0, 9); G['E'] = g

    return G


GLYPHS: dict = {**_caps()}


def validate_glyphs(chars: set) -> list:
    """机检（build 前置门）：字符集完备、网格形状与声明一致、非空。
    笔宽风格由原语构造保证，不在此重复检测。返回违规清单（空=过）。"""
    errs = []
    for ch in sorted(chars):
        if ch not in GLYPHS:
            errs.append(f'missing glyph: {ch!r}')
            continue
        g = GLYPHS[ch]
        if len(g.g) != g.height or any(len(r) != g.width for r in g.g):
            errs.append(f'{ch!r}: grid shape mismatch')
        if g.ink_ratio() == 0 and ch != ' ':
            errs.append(f'{ch!r}: empty glyph')
    return errs


if __name__ == '__main__':
    # 开发目检：python glyphs.py A H
    import sys
    for ch in sys.argv[1:]:
        print(f'--- {ch} ({GLYPHS[ch].width}x{GLYPHS[ch].height}) ---')
        print(GLYPHS[ch].render_ascii())
