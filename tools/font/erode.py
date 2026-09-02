# tools/font/erode.py
"""Seeded erosion — Darkhollow Runes Eroded 变体（spec §4.2）。

边缘啃噬 / 笔划断裂 / 细裂纹，固定种子=确定性输出。着墨率下限门控：侵蚀后
着墨数 < 85% 原着墨数时降级（先只施加一半啃噬；仍不足则原样返回）。
"""
import random

from glyphs import Glyph


def _edge_points(g: Glyph):
    """上下左右邻居 ≥2 个为空的着墨点（可啃噬的边缘）。"""
    return [
        (x, y)
        for y in range(g.height)
        for x in range(g.width)
        if g.px(x, y)
        and sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if not g.px(x + dx, y + dy)) >= 2
    ]


def _ink(g: Glyph) -> int:
    return sum(row.count(True) for row in g.g)


def erode(g: Glyph, seed: int, keep: float = 0.85) -> Glyph:
    rng = random.Random(seed)
    out = Glyph(g.width, g.height, g.baseline)
    out.g = [row[:] for row in g.g]
    base_ink = _ink(g)
    floor_ink = keep * base_ink

    # 1) 边缘啃噬：每个边缘点 18% 概率挖除
    edge = _edge_points(g)
    for x, y in edge:
        if rng.random() < 0.18:
            out.g[y][x] = False

    # 2) 笔划断裂：≤1 处 —— 随机着墨点挖 2×1 缺口（70% 字形才发生）
    if base_ink and rng.random() < 0.7:
        inked = [(x, y) for y in range(g.height) for x in range(g.width) if g.px(x, y)]
        x, y = rng.choice(inked)
        out.g[y][x] = False
        if x + 1 < out.width:
            out.g[y][x + 1] = False

    # 3) 细裂纹：≤2 条 3px 对角短线，只挖边缘点（保主干）
    for _ in range(2):
        if edge and rng.random() < 0.6:
            x, y = rng.choice(edge)
            for i in range(3):
                if 0 <= x + i < out.width and 0 <= y + i < out.height and out.g[y + i][x + i]:
                    if rng.random() < 0.7:
                        out.g[y + i][x + i] = False

    if _ink(out) >= floor_ink:
        return out

    # 门控降级：重开一个同种子流，只施加 9% 啃噬，跳过断裂与裂纹
    rng2 = random.Random(seed)
    out2 = Glyph(g.width, g.height, g.baseline)
    out2.g = [row[:] for row in g.g]
    for x, y in edge:
        if rng2.random() < 0.09:
            out2.g[y][x] = False
    return out2 if _ink(out2) >= floor_ink else g
