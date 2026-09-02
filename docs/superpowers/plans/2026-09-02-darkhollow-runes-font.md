# Darkhollow Runes 专属字体 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 darkhollow 构建代码定义的铭文石刻风专属像素字体（拉丁+数字+符号，85 字形 + 36 字形侵蚀变体），接入主页与 HUD 关键位。

**Architecture:** 字形以参数化画笔原语（竖 3px/横 2px/对角 2px）组装成位图 → 构建期机检（网格/完备性）→ fontTools 合成 TTF → WOFF2 → CSS `@font-face` 接入 `--font-runes` 栈首位。风格一致性由原语构造保证（改原语参数=全局生效），侵蚀变体为种子化后处理。

**Tech Stack:** Python 3（fontTools + brotli，pip 安装）、Vitest（CSS 源门）、Playwright（e2e 电池）。

**Spec:** `docs/superpowers/specs/2026-09-02-darkhollow-runes-font-design.md`

## Global Constraints

- 网格：大写 10×14、数字 8×14、小写 8×11（x-height 7）、符号各异；统一 advance = 12px
- 笔宽：竖 3px、横 2px、对角 2px（原语参数，全局常量）
- 字符集 = A-Z(26) + 0-9(10) + a-z(26) + 标点(≈16) + 游戏符 ♥✦★(3) = 85
- 侵蚀变体仅大写+数字(36)；固定种子；侵蚀后着墨率 ≥85%
- 每份 woff2 < 60KB（构建门）
- 中文位不接（自动落 `var(--font-mono)` fallback）；键帽 `.kb-key` 与正文不动
- 度量：units_per_em=1024，1px=64 units；1 单位 = 1px×64
- Python 侧测试用自带 `check()` 的自检脚本（`python tools/font/test_*.py`，exit 0/1），不引入 pytest

---

### Task 1: 字形核心 + 画笔原语 + 首批字形（H I T L E 7）

**Files:**
- Create: `tools/font/glyphs.py`
- Create: `tools/font/test_glyphs.py`

**Interfaces:**
- Produces: `class Glyph`（`width/height/baseline` 属性 + `px(x,y)->bool` + `ink_ratio()->float`）、画笔原语 `vline(g,x,y0,y1)/hline(g,y,x0,x1)/diag(g,x0,y0,x1,y1,thick)/serif_tip(g,x,y,dir)`、`GLYPHS: dict[str,Glyph]`、机检 `validate_glyphs(chars:set[str])->list[str]`（返回违规清单，空=过）
- 后续任务消费：向 `GLYPHS` 增补字形条目；T4 消费 `Glyph.px` 做侵蚀；T5 消费 `GLYPHS` 构建

- [ ] **Step 1: 写失败测试**

```python
# tools/font/test_glyphs.py — self-check harness（电池惯例）
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
RESULTS = []
def check(name, ok, detail=''):
    RESULTS.append((name, ok)); print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ''))

from glyphs import Glyph, GLYPHS, validate_glyphs, VW, HW

check('glyph H exists and is 10x14', 'H' in GLYPHS and GLYPHS['H'].width == 10 and GLYPHS['H'].height == 14)
check('validate passes for the seeded set', validate_glyphs(set('HIELT')) == [])
bad = validate_glyphs({'X'})  # X not seeded yet in Task 1
check('validate flags missing glyph', bad != [])
check('H ink present on both stems', GLYPHS['H'].px(1, 7) and GLYPHS['H'].px(7, 7))
check('stem width is 3 (竖笔)', GLYPHS['H'].px(0, 7) and GLYPHS['H'].px(1, 7) and GLYPHS['H'].px(2, 7) and not GLYPHS['H'].px(3, 7))

fails = [n for n, ok in RESULTS if not ok]
print(f"TOTAL {len(RESULTS)-len(fails)}/{len(RESULTS)}")
sys.exit(1 if fails else 0)
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd tools/font && python test_glyphs.py`
Expected: FAIL（`ModuleNotFoundError: glyphs` / ImportError）

- [ ] **Step 3: 实现 glyphs.py 核心**

```python
# tools/font/glyphs.py
"""Darkhollow Runes — 铭文石刻风像素字形。风格由原语构造保证：
竖笔 VW=3、横笔 HW=2、对角 2（spec §4.1），改这三个常量即全局改风格。"""
VW, HW, DW = 3, 2, 2          # 竖/横/对角笔宽（px）
ADV = 12                       # 统一 advance（spec §5）

class Glyph:
    def __init__(self, width, height, baseline):
        self.width, self.height, self.baseline = width, height, baseline
        self.g = [[False]*width for _ in range(height)]
    def px(self, x, y): return 0 <= x < self.width and 0 <= y < self.height and self.g[y][x]
    def set(self, x, y):
        if 0 <= x < self.width and 0 <= y < self.height: self.g[y][x] = True
    def ink_ratio(self): return sum(r.count(True) for r in self.g) / (self.width*self.height)

def vline(g: Glyph, x, y0, y1):
    """竖笔：以 x 为左缘画 VW 宽，含两端。"""
    for y in range(y0, y1+1):
        for dx in range(VW): g.set(x+dx, y)

def hline(g: Glyph, y, x0, x1):
    """横笔：以 y 为上缘画 HW 厚，含两端。"""
    for x in range(x0, x1+1):
        for dy in range(HW): g.set(x, y+dy)

def serif_tip(g: Glyph, x, y, dx):
    """尖角 serif：竖笔末端向 dx 方向伸 1px（凿刻感）。"""
    g.set(x, y); g.set(x+VW-1+dx, y)

def diag(g: Glyph, x0, y0, x1, y1):
    """对角线（步进方波，DW 厚），用于 N K M V W X Y Z 等。"""
    import math
    n = max(abs(x1-x0), abs(y1-y0))
    for i in range(n+1):
        x = round(x0 + (x1-x0)*i/n) if n else x0
        y = round(y0 + (y1-y0)*i/n) if n else y0
        for t in range(DW):
            g.set(x+ (1 if x1>=x0 else -1)*0 + t, y)   # 横向增厚
            g.set(x, y+t)                                # 纵向增厚（方波感）

def _caps():   # 10x14, baseline=13（底行 y=13），首批 5 字形
    G = {}
    def cap():
        return Glyph(10, 14, 13)
    g = cap()                                            # H：双竖 + 中横
    vline(g, 0, 0, 13); vline(g, 7, 0, 13)
    serif_tip(g, 0, 0, -1); serif_tip(g, 0, 13, -1); serif_tip(g, 7, 0, 1); serif_tip(g, 7, 13, 1)
    hline(g, 6, 2, 7); G['H'] = g
    g = cap()                                            # I：中竖 + 顶/底全宽横
    vline(g, 4, 2, 11); hline(g, 0, 2, 7); hline(g, 12, 2, 7); G['I'] = g
    g = cap()                                            # T：顶横 + 中竖
    hline(g, 0, 0, 9); vline(g, 4, 2, 13); G['T'] = g
    g = cap()                                            # L：左竖 + 底横
    vline(g, 0, 0, 13); serif_tip(g, 0, 0, -1); hline(g, 12, 0, 9); G['L'] = g
    g = cap()                                            # E：左竖 + 三横
    vline(g, 0, 0, 13); hline(g, 0, 0, 9); hline(g, 6, 0, 8); hline(g, 12, 0, 9); G['E'] = g
    return G

GLYPHS = {**_caps()}

def validate_glyphs(chars: set[str]) -> list[str]:
    """机检：网格边界（渲染期 set 已夹边界，这里查行数/列数与声明一致 + 非空 +
    advance 度量在 Glyph 上可用）。构造保证笔宽。返回违规清单。"""
    errs = []
    for ch in chars:
        if ch not in GLYPHS:
            errs.append(f'missing glyph: {ch!r}'); continue
        g = GLYPHS[ch]
        if len(g.g) != g.height or any(len(r) != g.width for r in g.g):
            errs.append(f'{ch!r}: grid shape mismatch')
        if g.ink_ratio() == 0:
            errs.append(f'{ch!r}: empty glyph')
    return errs
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd tools/font && python test_glyphs.py` → Expected: TOTAL 6/6, exit 0

- [ ] **Step 5: Commit**

```bash
git add tools/font/glyphs.py tools/font/test_glyphs.py
git commit -m "feat(runes): glyph core — pen primitives (VW3/HW2/DW2) + first five caps"
```

---

### Task 2: 大写余 21 + 数字 10

**Files:**
- Modify: `tools/font/glyphs.py`（`_caps()` 增补）
- Modify: `tools/font/test_glyphs.py`（断言集扩展）

**Interfaces:**
- Consumes: Task 1 的 Glyph/原语
- Produces: `GLYPHS` 覆盖 A-Z + 0-9（36 字形）

**字形结构表**（实现者按表用原语绘制；美学迭代轮再调）：

| 字 | 结构（10×14, baseline 13；serif 只给"双竖字形"标注 S） |
|---|---|
| A | 左竖 x1(全高)、右竖 x6(全高) S；顶拱 hline y0 x1..8；中横 y6 x1..8 |
| B | 左竖 x0(全高)；三横 y0/y6/y12 各 x0..7；右短竖 x7 连 y1..5 与 y7..11（两腔） |
| C | 顶横 y0 x1..8、底横 y12 x1..8、左竖 x1 y2..11 |
| D | 左竖 x0(全高) S；顶横 y0 x0..6、底横 y12 x0..6、右竖 x7 y2..11 |
| F | E 去底横：左竖+顶横+中横 y6 |
| G | C + 右短竖 x7 y7..11 + 中横 y7 x5..7（入笔） |
| J | 右竖 x7 y0..11、底横 y12 x2..9、左短竖 x2 y10..11 |
| K | 左竖 x0(全高) S；对角 (3,5)→(9,0) 与 (3,5)→(9,13) |
| M | 左竖 x0、右竖 x7（全高）S；对角 (2,2)→(5,6)→(8,2)（V 形穹顶） |
| N | 左竖 x0、右竖 x7(全高) S；对角 (2,2)→(8,13) |
| O | 左竖 x1、右竖 x6（y2..11）、顶横 y0 x1..8、底横 y12 x1..8 |
| P | 左竖 x0(全高) S；顶横 y0、中横 y6 x0..7、右短竖 x7 y1..6 |
| Q | O + 对角尾 (5,10)→(9,13) |
| R | P + 对角腿 (3,7)→(9,13) |
| S | 顶横 y0 x1..8、中横 y6 x1..8、底横 y12 x1..8、左短竖 x1 y1..5、右短竖 x7 y7..11 |
| U | 左竖 x0、右竖 x7（全高）S；底横 y12 x0..9 |
| V | 对角 (1,0)→(5,13) 与 (8,0)→(5,13)（双斜汇聚） |
| W | M 倒置：左右竖 y0..11、对角 (2,11)→(5,7)→(8,11) |
| X | 对角 (1,1)→(8,13) 与 (8,1)→(1,13) |
| Y | 对角 (1,0)→(5,6) 与 (9,0)→(5,6)；中竖 x4..6 y6..13（vline x5） |
| Z | 顶横 y0 x0..9、底横 y12 x0..9、对角 (8,1)→(1,12) |

数字（8×14，同 baseline；结构同风格缩窄）：
`0`=O 缩窄（竖 x0/x5、横 y0/y12 全宽）；`1`=中竖 x3 + 顶入笔对角 (1,2)→(3,0) + 底横 y12 全宽；`2`=顶横+右上竖+中对角+左下竖+底横；`3`=顶/中/底横+右竖两段；`4`=左竖 y0..7 + 中横 y7 + 右竖全高；`5`=左竖 y0..6 + 顶横+中横+右竖 y7..11 + 底横；`6`=左竖全高+顶横+中横+右竖下段+底横；`7`=顶横+对角长腿 (6,1)→(1,13)；`8`=B 缩窄（三横+右竖两段+左竖全高）；`9`=P 镜像+右竖全高。

- [ ] **Step 1: 扩展测试**（test_glyphs.py 追加）

```python
import string
ALNUM = set(string.ascii_uppercase + string.digits)
check('A-Z + 0-9 complete (36 glyphs)', validate_glyphs(ALNUM) == [],
      str([e for e in validate_glyphs(ALNUM)][:3]))
for ch in 'AOHK27':
    g = GLYPHS[ch]
    check(f'{ch} ink 10%-60% sanity', 0.10 <= g.ink_ratio() <= 0.60, f'{g.ink_ratio():.2f}')
```

- [ ] **Step 2: 跑确认失败** → `python tools/font/test_glyphs.py`（缺 A 等字形 → FAIL）
- [ ] **Step 3: 按结构表实现余下字形**（`_caps()` 扩展 + `_digits()` 新函数并入 GLYPHS）
- [ ] **Step 4: 跑确认通过** → TOTAL 全绿
- [ ] **Step 5: ASCII 目检**（临时打印 `GLYPHS['A'].g` 为 `#/.` 行，肉眼确认铭文感；不写入测试）
- [ ] **Step 6: Commit** `feat(runes): remaining caps + digits per structure table`

---

### Task 3: 小写 26 + 符号

**Files:** Modify `tools/font/glyphs.py`、`tools/font/test_glyphs.py`

**Interfaces:** Produces: `GLYPHS` 全 85 字形（A-Z a-z 0-9 + 下表符号）

小写（8×11，baseline=10，x-height=7 即 y4..10）规则：`b d h k l t` 带 ascender（y0 起）；`g p q y` 带 descender（基线下 1 行内，网格 11 高容纳）；其余 x-height 字形。结构=对应大写的缩窄简化（无 serif，竖笔仍 VW=3 —— 8 宽网格内两竖 x0-2/x5-7 恰好）。

符号（各自网格，全部 baseline 对齐大写 y=13 语义）：
`. , : ; ! ? ' " - + / ( ) < > = ␣`（␣=空字形，仅 advance）与 `♥ ✦ ★`。

- ♥（9×9）：两圆腔+下尖（像素心形，经典 9×9 模板）
- ✦（9×9）：四向星芒（横竖各 3 宽 + 对角 2 宽交叉）
- ★（9×9）：五角星近似（上三角+两斜腿+底横）

- [ ] **Step 1: 测试扩展**（完备性 85 + 抽样 ink sanity）
- [ ] **Step 2: 失败 → 实现 → 通过 → ASCII 目检 → Commit**（同 Task 2 节奏）
  `feat(runes): lowercase + punctuation + game symbols (85/85)`

---

### Task 4: 侵蚀器（Eroded 变体）

**Files:**
- Create: `tools/font/erode.py`
- Modify: `tools/font/test_glyphs.py`（或新建 `test_erode.py` 同款 harness）

**Interfaces:**
- Consumes: `Glyph.px/ink_ratio`
- Produces: `erode(g: Glyph, seed: int) -> Glyph`（确定性；只用于大写+数字）

```python
# tools/font/erode.py
"""Seeded erosion — 边缘啃噬/笔划断裂/细裂纹（spec §4.2）。
固定种子=确定性输出；着墨率下限由调用方门控。"""
import random
from glyphs import Glyph

def erode(g: Glyph, seed: int, keep_ratio: float = 0.85) -> Glyph:
    rng = random.Random(seed)
    out = Glyph(g.width, g.height, g.baseline)
    ink = [(x, y) for y in range(g.height) for x in range(g.width) if g.px(x, y)]
    out.g = [row[:] for row in g.g]
    # 1) 边缘啃噬：每个着墨点若上下左右≥2 个空邻居且 rng 命中 → 挖除
    edge = [(x, y) for (x, y) in ink
            if sum(1 for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)) if not g.px(x+dx, y+dy)) >= 2]
    for x, y in edge:
        if rng.random() < 0.18: out.g[y][x] = False
    # 2) 笔划断裂：≤1 处/字形 —— 随机取一个内部点，挖 2×1 缺口
    if ink and rng.random() < 0.7:
        x, y = rng.choice(ink)
        out.g[y][x] = False
        if x+1 < out.width: out.g[y][x+1] = False
    # 3) 细裂纹：≤2 条 1px 对角短线（只挖边缘点，避免破坏主干）
    for _ in range(2):
        if edge and rng.random() < 0.6:
            x, y = rng.choice(edge)
            for i in range(3):
                if 0 <= x+i < out.width and 0 <= y+i < out.height:
                    out.g[y+i][x+i] = out.g[y+i][x+i]  # no-op placeholder — see fix note
    # 门控：低于下限时撤回断裂（保可读性）
    if out.ink_ratio() < keep_ratio * g.ink_ratio() / max(g.ink_ratio(), 1e-9) or \
       sum(r.count(True) for r in out.g) < keep_ratio * len(ink):
        out.g = [row[:] for row in g.g]
        # 只施加啃噬的一半再试一次；仍不足则原样返回
        for x, y in edge:
            if rng.random() < 0.09: out.g[y][x] = False
    return out
```

（实现时把裂纹段的 no-op 改为真正的 `False` 挖除——上面是骨架示意；门控逻辑保留"侵蚀后着墨数 ≥ 0.85×原着墨数"。）

- [ ] **Step 1: 失败测试**：确定性（同 seed 两次 erode 结果逐像素相等）、着墨率 ≥85%、A-Z+0-9 全 36 字形侵蚀后 ink>0
- [ ] **Step 2: 失败 → 实现（修骨架为完整版）→ 通过 → Commit** `feat(runes): seeded erosion for display cut`

---

### Task 5: fontTools 构建 → WOFF2 + 体积门

**Files:**
- Create: `tools/font/build_font.py`
- Create: `tools/font/test_build.py`

**Interfaces:**
- Consumes: `GLYPHS`、`erode()`
- Produces: `public/fonts/darkhollow-runes.woff2`、`public/fonts/darkhollow-runes-eroded.woff2`

```python
# tools/font/build_font.py 核心骨架
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from glyphs import GLYPHS, ADV
from erode import erode

SCALE = 64            # 1px = 64 units；upm = 1024
UPM = 1024

def glyph_to_pen(px_grid, pen: TTGlyphPen, w, h, baseline):
    for y in range(h):
        for x in range(w):
            if px_grid[y][x]:
                x0, y0 = x*SCALE, (baseline - y)*SCALE
                pen.moveTo((x0, y0)); pen.lineTo((x0+SCALE, y0))
                pen.lineTo((x0+SCALE, y0+SCALE)); pen.lineTo((x0, y0+SCALE))
                pen.closePath()

def build(subset: dict, path_ttf: str):
    fb = FontBuilder(UPM, isTTF=True)
    adv = ADV*SCALE
    metrics = {ch: (adv, adv*0) for ch in subset}
    fb.setupGlyphOrder(list(subset) + ['.notdef'])
    fb.setupCharacterMap({ord(ch): ch for ch in subset if ch != ' '})
    pen_g = {}
    for ch, g in subset.items():
        pen = TTGlyphPen(None)
        if ch != ' ':
            glyph_to_pen(g.g, pen, g.width, g.height, g.baseline)
        pen_g[ch] = pen.glyph()
    pen_g['.notdef'] = TTGlyphPen(None).glyph()
    fb.setupGlyf(pen_g)
    fb.setupHorizontalMetrics({ch: (adv, 0) for ch in pen_g})
    fb.setupHorizontalHeader(ascent=13*SCALE, descent=-3*SCALE)
    fb.setupOS2(sTypoAscender=13*SCALE, sTypoDescender=-3*SCALE)
    fb.setupNameTable({'familyName': 'Darkhollow Runes', 'styleName': 'Regular'})
    fb.setupPost()
    fb.setupDLF = None  # noop guard for lint
    fb.save(path_ttf)

# Eroded 版：familyName 'Darkhollow Runes Eroded'，subset = 大写+数字 经 erode(seed=13)
# WOFF2：fontTools.ttLib.TTFont(path).flavor='woff2'; save(woff2)
```

（实现时按 fontTools 实际 API 微调；两份字体一个函数参数化 family/style。）

- [ ] **Step 1: 失败测试**（test_build.py）：产物存在、`TTFont(woff2).flavor=='woff2'`、每份 `<60KB`、`getBestCmap()` 含 'A'(0x41) 等、名字表 familyName 正确
- [ ] **Step 2: `pip install fonttools brotli`（若未装）→ 实现 → 生成 → 测试通过**
- [ ] **Step 3: Commit**（含产物 woff2）`feat(runes): fontTools build pipeline → woff2 artifacts (<60KB gate)`

---

### Task 6: CSS 接入 + 源门单测

**Files:**
- Modify: `style/main.css`（`@font-face`×2 + `--font-runes` + 接入位）
- Create: `src/__tests__/batch14-runes-css.test.ts`

**Interfaces:**
- Produces: `--font-runes: 'Darkhollow Runes', var(--font-mono)` 与接入位（vitest 源门锁定）

接入位清单（spec §6）：`#title-h1`（Eroded）、`#title-h2 .menu-btn .title-stats`+选人屏标题（常规，实现时查实际选择器 `#char-select h2` 或同等）、楼层显示（实现时定位，如 `#floor-label`）、`.bar` 数值、`.ft`、`#objective-panel h3/.panel h2`（常规）。

- [ ] **Step 1: 失败的 vitest 源门**（读 main.css 断言：两个 @font-face 的 family 名 + 每个接入位选择器的声明块内含 `var(--font-runes)`、`.kb-key` 与 `body` 声明块**不**含——负向断言）
- [ ] **Step 2: 跑红 → CSS 实现（`@font-face` src url('/fonts/...woff2') format('woff2')；font-display: swap）→ 跑绿**
- [ ] **Step 3: 全量 vitest + tsc + build（确认无回归 + dist 含字体）**
- [ ] **Step 4: Commit** `feat(runes): @font-face + --font-runes wiring on title/HUD anchor points`

---

### Task 7: e2e 电池 + 目检迭代轮 + 收尾

**Files:**
- Create: `scripts/verify_batch14_ingame.py`
- Modify: `smoke_out/batch14/*.png`（截图产物）

- [ ] **Step 1: 电池**：dev server 起 → 断言 `document.fonts.check("1em 'Darkhollow Runes'")` 与 Eroded loaded、`getComputedStyle(#title-h1).fontFamily` 含 Eroded、HUD 位含 Runes、中文位落 mono fallback（fontFamily 串含 JetBrains Mono）、**截图 title 屏 + 游戏内 HUD** → console 零错门
- [ ] **Step 2: PIL 像素统计目检**（规避 analyze_image Win 路径坑）+ **截图呈给用户目检**（迭代轮：用户反馈 → 调 glyphs.py 原语/结构 → `python tools/font/build_font.py` 重出 → 重新截图，≤3 轮）
- [ ] **Step 3: 七门全量**（vitest/tsc/build/gamepad22/批9·13 电池/console 零）
- [ ] **Step 4: requesting-code-review → 处置 → 用户裁决合并 → push + CI + 删分支**
- [ ] **Step 5: 记忆更新**（darkhollow 文件批14 段 + MEMORY.md 索引）

---

## Self-Review 记录

- Spec 覆盖：§4.1→T1-T3、§4.2→T4、§5→T5、§6→T6、§7→T6/T7、§8→T7 Step2、§9 逃生口→T2 结构表可单字覆写、§10 交付物全落 ✓
- 占位扫描：T4 骨架的裂纹段有明确"实现时改为真挖除"指令（非 TBD——骨架+修正指令）；其余无占位 ✓
- 类型一致：`Glyph.px/ink_ratio/g/baseline`、`validate_glyphs`、`erode(g,seed)`、`build(subset,path)` 各任务引用一致 ✓
