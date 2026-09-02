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

    # ---- Task 2: 余下大写（plan 结构表逐字） ----
    g = cap()                                             # A：双竖 + 顶拱 + 中横
    vline(g, 1, 0, 13); vline(g, 6, 0, 13)
    hline(g, 0, 1, 8); hline(g, 6, 1, 8); G['A'] = g

    g = cap()                                             # B：左竖 + 三横 + 右双腔竖
    vline(g, 0, 0, 13)
    hline(g, 0, 0, 7); hline(g, 6, 0, 7); hline(g, 12, 0, 7)
    vline(g, 7, 1, 5); vline(g, 7, 7, 11); G['B'] = g

    g = cap()                                             # C：顶/底横 + 左竖
    hline(g, 0, 1, 8); hline(g, 12, 1, 8); vline(g, 1, 2, 11); G['C'] = g

    g = cap()                                             # D：左竖 + 顶/底横 + 右竖
    vline(g, 0, 0, 13); serif_tip(g, 0, 0, -1); serif_tip(g, 0, 13, -1)
    hline(g, 0, 0, 6); hline(g, 12, 0, 6); vline(g, 7, 2, 11); G['D'] = g

    g = cap()                                             # F：E 去底横
    vline(g, 0, 0, 13)
    hline(g, 0, 0, 9); hline(g, 6, 0, 8); G['F'] = g

    g = cap()                                             # G：C + 右下竖 + 入笔横
    hline(g, 0, 1, 8); hline(g, 12, 1, 8); vline(g, 1, 2, 11)
    vline(g, 7, 7, 11); hline(g, 7, 5, 7); G['G'] = g

    g = cap()                                             # J：右竖 + 底横 + 左短竖
    vline(g, 7, 0, 11); hline(g, 12, 2, 9); vline(g, 2, 10, 11); G['J'] = g

    g = cap()                                             # K：左竖 + 双对角腿
    vline(g, 0, 0, 13); serif_tip(g, 0, 0, -1); serif_tip(g, 0, 13, -1)
    diag(g, 3, 5, 9, 0); diag(g, 3, 5, 9, 13); G['K'] = g

    g = cap()                                             # M：双竖 + V 形穹顶
    vline(g, 0, 0, 13); vline(g, 7, 0, 13)
    serif_tip(g, 0, 0, -1); serif_tip(g, 0, 13, -1); serif_tip(g, 7, 0, 1); serif_tip(g, 7, 13, 1)
    diag(g, 2, 2, 5, 6); diag(g, 5, 6, 8, 2); G['M'] = g

    g = cap()                                             # N：双竖 + 主对角
    vline(g, 0, 0, 13); vline(g, 7, 0, 13)
    serif_tip(g, 0, 0, -1); serif_tip(g, 0, 13, -1); serif_tip(g, 7, 0, 1); serif_tip(g, 7, 13, 1)
    diag(g, 2, 2, 8, 13); G['N'] = g

    g = cap()                                             # O：左/右竖 + 顶/底横
    vline(g, 1, 2, 11); vline(g, 6, 2, 11)
    hline(g, 0, 1, 8); hline(g, 12, 1, 8); G['O'] = g

    g = cap()                                             # P：左竖 + 顶/中横 + 右上竖
    vline(g, 0, 0, 13); serif_tip(g, 0, 0, -1); serif_tip(g, 0, 13, -1)
    hline(g, 0, 0, 7); hline(g, 6, 0, 7); vline(g, 7, 1, 6); G['P'] = g

    g = cap()                                             # Q：O + 对角尾
    vline(g, 1, 2, 11); vline(g, 6, 2, 11)
    hline(g, 0, 1, 8); hline(g, 12, 1, 8); diag(g, 5, 10, 9, 13); G['Q'] = g

    g = cap()                                             # R：P + 对角腿
    vline(g, 0, 0, 13); serif_tip(g, 0, 0, -1); serif_tip(g, 0, 13, -1)
    hline(g, 0, 0, 7); hline(g, 6, 0, 7); vline(g, 7, 1, 6)
    diag(g, 3, 7, 9, 13); G['R'] = g

    g = cap()                                             # S：三横 + 左上/右下短竖
    hline(g, 0, 1, 8); hline(g, 6, 1, 8); hline(g, 12, 1, 8)
    vline(g, 1, 1, 5); vline(g, 7, 7, 11); G['S'] = g

    g = cap()                                             # U：双竖 + 底横
    vline(g, 0, 0, 13); vline(g, 7, 0, 13)
    serif_tip(g, 0, 0, -1); serif_tip(g, 7, 0, 1)
    hline(g, 12, 0, 9); G['U'] = g

    g = cap()                                             # V：双斜汇聚
    diag(g, 1, 0, 5, 13); diag(g, 8, 0, 5, 13); G['V'] = g

    g = cap()                                             # W：双竖到底 + Λ 形底连
    vline(g, 0, 0, 13); vline(g, 7, 0, 13)
    serif_tip(g, 0, 0, -1); serif_tip(g, 7, 0, 1)
    diag(g, 2, 12, 5, 8); diag(g, 5, 8, 8, 12); G['W'] = g

    g = cap()                                             # X：双对角交叉
    diag(g, 1, 1, 8, 13); diag(g, 8, 1, 1, 13); G['X'] = g

    g = cap()                                             # Y：双斜 + 中竖
    diag(g, 1, 0, 5, 6); diag(g, 9, 0, 5, 6); vline(g, 5, 6, 13); G['Y'] = g

    g = cap()                                             # Z：顶/底横 + 主对角
    hline(g, 0, 0, 9); hline(g, 12, 0, 9); diag(g, 8, 1, 1, 12); G['Z'] = g

    return G


# ---- 数字 8×14, baseline=13 ----

def _digits() -> dict:
    G = {}

    def dig() -> Glyph:
        return Glyph(8, 14, 13)

    g = dig()                                             # 0：双竖 + 顶/底横
    vline(g, 0, 2, 11); vline(g, 5, 2, 11)
    hline(g, 0, 0, 7); hline(g, 12, 0, 7); G['0'] = g

    g = dig()                                             # 1：中竖 + 顶入笔斜 + 底横
    vline(g, 3, 2, 11); diag(g, 1, 3, 3, 1); hline(g, 12, 0, 7); G['1'] = g

    g = dig()                                             # 2：顶横+右上竖+中对角+左下竖+底横
    hline(g, 0, 0, 7); vline(g, 5, 1, 5)
    diag(g, 5, 5, 0, 9); vline(g, 0, 8, 11); hline(g, 12, 0, 7); G['2'] = g

    g = dig()                                             # 3：顶/中/底横 + 右竖两段
    hline(g, 0, 0, 7); hline(g, 6, 0, 6); hline(g, 12, 0, 7)
    vline(g, 5, 1, 6); vline(g, 5, 7, 11); G['3'] = g

    g = dig()                                             # 4：左竖上半 + 中横 + 右竖全高
    vline(g, 0, 0, 7); hline(g, 6, 0, 5); vline(g, 5, 0, 13); G['4'] = g

    g = dig()                                             # 5：左竖上段 + 顶/中横 + 右下竖 + 底横
    vline(g, 0, 0, 6); hline(g, 0, 0, 7); hline(g, 6, 0, 6)
    vline(g, 5, 7, 11); hline(g, 12, 0, 7); G['5'] = g

    g = dig()                                             # 6：左竖全高 + 顶/中横 + 右下竖 + 底横
    vline(g, 0, 0, 13); hline(g, 0, 0, 7); hline(g, 6, 0, 6)
    vline(g, 5, 7, 11); hline(g, 12, 0, 7); G['6'] = g

    g = dig()                                             # 7：顶横 + 长斜腿
    hline(g, 0, 0, 7); diag(g, 6, 1, 1, 13); G['7'] = g

    g = dig()                                             # 8：左竖全高 + 三横 + 右竖两段
    vline(g, 0, 0, 13); hline(g, 0, 0, 7); hline(g, 6, 0, 7); hline(g, 12, 0, 7)
    vline(g, 5, 1, 5); vline(g, 5, 7, 11); G['8'] = g

    g = dig()                                             # 9：左竖上段 + 顶/中横 + 右竖全高 + 底横
    vline(g, 0, 0, 6); hline(g, 0, 0, 7); hline(g, 6, 0, 6)
    vline(g, 5, 0, 13); hline(g, 12, 0, 7); G['9'] = g

    return G


# ---- 小写 8×11, baseline=8（ascender y0..8 / x-height y2..8 / descender 尾 y9..10；
#      构建期按各字形 baseline 换算，与大写基线自动对齐；小写无 serif） ----

def _lower() -> dict:
    G = {}

    def low() -> Glyph:
        return Glyph(8, 11, 8)

    g = low()                                             # a：腔 + 右下出口
    hline(g, 2, 1, 6); vline(g, 1, 3, 7); vline(g, 5, 3, 8)
    hline(g, 7, 1, 6); hline(g, 7, 5, 7); G['a'] = g

    g = low()                                             # b：左竖全高 + 腔
    vline(g, 0, 0, 8); hline(g, 4, 0, 7); vline(g, 5, 4, 8); hline(g, 7, 0, 7); G['b'] = g

    g = low()                                             # c：顶/底横 + 左竖
    hline(g, 2, 1, 6); hline(g, 7, 1, 6); vline(g, 1, 3, 6); G['c'] = g

    g = low()                                             # d：右竖全高 + 腔（b 镜像）
    vline(g, 5, 0, 8); hline(g, 4, 0, 7); vline(g, 1, 4, 8); hline(g, 7, 0, 7); G['d'] = g

    g = low()                                             # e：左竖 + 三横
    vline(g, 1, 2, 7); hline(g, 2, 1, 6); hline(g, 5, 1, 6); hline(g, 7, 1, 6); G['e'] = g

    g = low()                                             # f：竖 + 顶横 + 中钩
    vline(g, 4, 0, 8); hline(g, 0, 1, 7); hline(g, 4, 4, 7); G['f'] = g

    g = low()                                             # g：o 腔 + 下沉尾
    hline(g, 2, 1, 6); vline(g, 1, 2, 6); vline(g, 5, 2, 10); hline(g, 7, 1, 6); G['g'] = g

    g = low()                                             # h：左竖全高 + 拱 + 右腿
    vline(g, 0, 0, 8); hline(g, 5, 0, 5); vline(g, 5, 5, 8); G['h'] = g

    g = low()                                             # i：短竖 + 顶点
    vline(g, 2, 2, 8); g.set(2, 0); g.set(3, 0); G['i'] = g

    g = low()                                             # j：右短竖 + 底钩 + 顶点
    vline(g, 5, 2, 8); hline(g, 9, 1, 5); g.set(5, 0); g.set(6, 0); G['j'] = g

    g = low()                                             # k：左竖全高 + 双斜腿
    vline(g, 0, 0, 8); diag(g, 2, 5, 5, 2); diag(g, 2, 5, 5, 8); G['k'] = g

    g = low()                                             # l：中竖全高
    vline(g, 3, 0, 8); G['l'] = g

    g = low()                                             # m：左竖 + 双拱
    vline(g, 0, 2, 8); hline(g, 5, 0, 6); vline(g, 3, 5, 8); vline(g, 6, 5, 8); G['m'] = g

    g = low()                                             # n：左竖 + 拱 + 右腿
    vline(g, 0, 2, 8); hline(g, 5, 0, 5); vline(g, 5, 5, 8); G['n'] = g

    g = low()                                             # o：腔
    vline(g, 1, 2, 7); vline(g, 5, 2, 7); hline(g, 2, 1, 6); hline(g, 7, 1, 6); G['o'] = g

    g = low()                                             # p：左竖下沉 + 腔
    vline(g, 0, 2, 10); hline(g, 4, 0, 7); vline(g, 5, 4, 8); hline(g, 7, 0, 7); G['p'] = g

    g = low()                                             # q：右竖下沉 + 腔（p 镜像）
    vline(g, 5, 2, 10); hline(g, 4, 0, 7); vline(g, 1, 4, 8); hline(g, 7, 0, 7); G['q'] = g

    g = low()                                             # r：左竖 + 上斜
    vline(g, 0, 2, 8); diag(g, 2, 4, 5, 2); G['r'] = g

    g = low()                                             # s：三横 + 两短竖（S 缩窄）
    hline(g, 2, 1, 6); hline(g, 5, 1, 6); hline(g, 8, 1, 6)
    vline(g, 1, 3, 4); vline(g, 6, 6, 7); G['s'] = g

    g = low()                                             # t：竖 + 中横
    vline(g, 3, 0, 7); hline(g, 4, 1, 6); G['t'] = g

    g = low()                                             # u：双竖 + 底横
    vline(g, 0, 2, 8); vline(g, 5, 2, 8); hline(g, 7, 0, 7); G['u'] = g

    g = low()                                             # v：双斜汇聚
    diag(g, 1, 2, 4, 8); diag(g, 6, 2, 4, 8); G['v'] = g

    g = low()                                             # w：双竖 + Λ 底连
    vline(g, 0, 2, 7); vline(g, 6, 2, 7); diag(g, 1, 7, 3, 4); diag(g, 3, 4, 5, 7); G['w'] = g

    g = low()                                             # x：双对角交叉
    diag(g, 1, 3, 6, 8); diag(g, 6, 3, 1, 8); G['x'] = g

    g = low()                                             # y：v 形 + 下沉尾
    diag(g, 1, 2, 4, 6); diag(g, 6, 2, 4, 6); diag(g, 4, 6, 1, 10); G['y'] = g

    g = low()                                             # z：双横 + 主对角（Z 缩窄）
    hline(g, 2, 1, 6); hline(g, 7, 1, 6); diag(g, 5, 3, 2, 7); G['z'] = g

    return G


# ---- 符号（网格各异，baseline 与大写 13 语义对齐） ----

def _symbols() -> dict:
    G = {}
    big = lambda w, h, b: Glyph(w, h, b)

    g = big(4, 14, 13)                                    # . 方点
    for x in (1, 2):
        for y in (12, 13): g.set(x, y)
    G['.'] = g

    g = big(4, 14, 13)                                    # , 点 + 左斜尾
    for x in (1, 2):
        for y in (11, 12): g.set(x, y)
    g.set(0, 13); G[','] = g

    g = big(4, 14, 13)                                    # : 双点
    for x in (1, 2):
        for y in (5, 6, 11, 12): g.set(x, y)
    G[':'] = g

    g = big(4, 14, 13)                                    # ; 双点 + 尾
    for x in (1, 2):
        for y in (5, 6, 11, 12): g.set(x, y)
    g.set(0, 13); G[';'] = g

    g = big(4, 14, 13)                                    # ! 竖 + 点
    vline(g, 1, 0, 9)
    for x in (1, 2):
        for y in (12, 13): g.set(x, y)
    G['!'] = g

    g = big(8, 14, 13)                                    # ? 钩 + 点
    hline(g, 0, 1, 6); vline(g, 5, 1, 4); diag(g, 5, 4, 2, 7); vline(g, 2, 7, 9)
    for x in (2, 3):
        for y in (12, 13): g.set(x, y)
    G['?'] = g

    g = big(4, 14, 13)                                    # ' 短竖点
    for x in (1, 2):
        for y in (0, 1, 2): g.set(x, y)
    G["'"] = g

    g = big(6, 14, 13)                                    # " 双点
    for x in (1, 2, 4, 5):
        for y in (0, 1, 2): g.set(x, y)
    G['"'] = g

    g = big(8, 6, 5)                                      # - 连字横（视觉中线）
    hline(g, 2, 0, 7); G['-'] = g

    g = big(8, 10, 7)                                     # + 十字
    hline(g, 4, 0, 7); vline(g, 3, 1, 8); G['+'] = g

    g = big(8, 14, 13)                                    # / 全高斜
    diag(g, 0, 13, 7, 0); G['/'] = g

    g = big(6, 14, 13)                                    # ( 左弧
    diag(g, 4, 0, 1, 6); diag(g, 1, 6, 4, 13); G['('] = g

    g = big(6, 14, 13)                                    # ) 右弧
    diag(g, 1, 0, 4, 6); diag(g, 4, 6, 1, 13); G[')'] = g

    g = big(8, 12, 9)                                     # < 左角
    diag(g, 6, 1, 1, 6); diag(g, 1, 6, 6, 11); G['<'] = g

    g = big(8, 12, 9)                                     # > 右角
    diag(g, 1, 1, 6, 6); diag(g, 6, 6, 1, 11); G['>'] = g

    g = big(8, 10, 7)                                     # = 双横
    hline(g, 3, 0, 7); hline(g, 6, 0, 7); G['='] = g

    g = big(8, 14, 13)                                    # % 双实心小方 + 主斜
    diag(g, 0, 13, 7, 0)
    for x in range(0, 3):
        for y in range(1, 4): g.set(x, y)
    for x in range(5, 8):
        for y in range(9, 12): g.set(x, y)
    G['%'] = g

    g = big(8, 10, 7)                                     # * 六向星
    vline(g, 3, 1, 8); hline(g, 4, 0, 7); diag(g, 1, 1, 6, 6); diag(g, 6, 1, 1, 6); G['*'] = g

    g = big(8, 14, 13)                                    # # 双竖 + 双横
    vline(g, 1, 1, 12); vline(g, 5, 1, 12); hline(g, 4, 0, 6); hline(g, 8, 0, 6); G['#'] = g

    G[' '] = Glyph(4, 4, 2)                               # ␣ 空字形（仅 advance）

    g = big(9, 9, 8)                                      # ♥ 像素心（经典 9×9 模板逐行）
    g.set(2, 0); g.set(6, 0)
    for x in (1, 7): g.set(x, 1)
    for x in (0, 8):
        for y in (2, 3, 4): g.set(x, y)
    for y in range(1, 5):
        for x in range(1, 8): g.set(x, y)
    for x in range(1, 8): g.set(x, 5)
    for x in range(2, 7): g.set(x, 6)
    for x in range(3, 6): g.set(x, 7)
    g.set(4, 8)
    G['♥'] = g

    g = big(9, 9, 8)                                      # ✦ 四向星芒
    hline(g, 4, 0, 8); vline(g, 4, 0, 8); diag(g, 2, 2, 6, 6); diag(g, 6, 2, 2, 6); G['✦'] = g

    g = big(9, 9, 8)                                      # ★ 五角星（中竖+横杠+双腿+底收）
    vline(g, 4, 0, 6); hline(g, 3, 1, 7)
    diag(g, 1, 4, 3, 8); diag(g, 7, 4, 5, 8); hline(g, 7, 3, 5); G['★'] = g

    return G


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


GLYPHS: dict = {**_caps(), **_digits(), **_lower(), **_symbols()}




def chisel_all() -> None:
    """批14 目检轮1 强化：所有大写+数字的首/末着墨行左右各伸 1px（凿刻角全字系化）。
    在 GLYPHS 组装后调用，直接改写位图。"""
    import string
    for ch in string.ascii_uppercase + string.digits:
        g = GLYPHS[ch]
        for y in (0, g.height - 1):
            inked = [x for x in range(g.width) if g.g[y][x]]
            if not inked:
                continue
            lo, hi = min(inked), max(inked)
            if lo - 1 >= 0: g.set(lo - 1, y)
            if hi + 1 < g.width: g.set(hi + 1, y)


chisel_all()



def runicize() -> None:
    """批14 目检轮2：半符文化 —— 部分大写改北欧符文形（spec 风格"铭文石刻"的最高形态）。
    只改形状仍可辨识的字母；DEPTHS OF DARKHOLLOW 里 D/E/P/T/H/S/O/F/R/K/L/W。"""
    import glyphs as _self

    def blank(): return _self.Glyph(10, 14, 13)

    # T → ᛏ：全高竖 + 顶部上箭头（两短斜）
    g = blank(); _self.vline(g, 4, 0, 13); _self.diag(g, 1, 3, 4, 0); _self.diag(g, 9, 3, 6, 0)
    _self.GLYPHS['T'] = g

    # F → ᚠ：全高竖 + 两条上斜枝
    g = blank(); _self.vline(g, 2, 0, 13); _self.diag(g, 4, 2, 9, 0); _self.diag(g, 4, 8, 9, 6)
    _self.GLYPHS['F'] = g

    # N → ᚾ：全高竖 + 一条上斜枝（不出竖右界）
    g = blank(); _self.vline(g, 2, 0, 13); _self.diag(g, 4, 8, 9, 1)
    _self.GLYPHS['N'] = g

    # A → ᚨ：全高竖 + 两条全对角贯穿斜线
    g = blank(); _self.vline(g, 0, 0, 13)
    _self.diag(g, 0, 2, 8, 11); _self.diag(g, 0, 8, 8, 13)
    _self.GLYPHS['A'] = g

    # R → ᚱ：竖 + 三角腔 + 斜腿（原 R 强化斜腔）
    g = blank(); _self.vline(g, 0, 0, 13)
    _self.diag(g, 1, 0, 7, 4); _self.diag(g, 7, 4, 1, 8); _self.diag(g, 2, 8, 9, 13)
    _self.GLYPHS['R'] = g


runicize()

if __name__ == '__main__':
    # 开发目检：python glyphs.py A H（Win 控制台 cp936 坑 → 强制 UTF-8）
    import sys, io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    for ch in sys.argv[1:]:
        print(f'--- {ch} ({GLYPHS[ch].width}x{GLYPHS[ch].height}) ---')
        print(GLYPHS[ch].render_ascii())

