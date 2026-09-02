# Darkhollow Runes 专属字体设计（spec）

日期：2026-09-02 · 状态：待用户审定 · 范围裁决：主页 + HUD 关键位（非全 UI）

## 1. 背景与动机

当前全站字栈为 `'JetBrains Mono', Consolas, 'Courier New', monospace`（`style/main.css:26`
`--font-mono`）。拉丁部分吃 JetBrains Mono（@fontsource，dist 内 woff2 子集），**中文全部
落系统 fallback**（微软雅黑等）——与 16×16 像素 sprite 的游戏美学脱节，是"传统字体观感"
的来源。本设计为游戏引入第一套**代码定义、可版本控制、可迭代**的专属字体，服务于主页
（标题屏）与 HUD 关键位，锚定"深渊 / 腐化 / 守渊人"世界观。

## 2. 目标

- 一套铭文石刻风像素字体（窄长锐角、竖粗横细、顶/底尖角 serif），拉丁 + 数字 + 符号
- 标题位侵蚀变体（display 字重）增强"被深渊侵蚀"叙事
- 生成管线：改字形模板 → 30 秒重出字体（字形美学迭代是多轮的，管线为此存在）
- 全部资产与规则进版本控制

## 3. 非目标（本期不做）

- 中文字形（中文位自动落现有 fallback；全中文像素化留待后续阶段，届时评估开源中文
  像素字体子集化方案）
- 全 UI 覆盖：正文、长说明、键帽 `.kb-key`（功能对照位，可读性优先）保留现状
- 游戏内 Canvas 世界文本（HUD 均为 DOM；Canvas 位图文本是另一管线）

## 4. 字形资产（tools/font/glyphs.py）

### 4.1 网格与风格规则

| 类目 | 网格 | 备注 |
|---|---|---|
| 大写 A-Z | 10 宽 × 14 高 | 窄长 3:4 比例，与方块字体形成对比 |
| 数字 0-9 | 8 × 14 | |
| 小写 a-z | 8 × 11 | x-height 7，ascender/descender 按字形 |
| 标点/符号 | 各异 | ~20 个：`. , : ; ! ? ' " - + / % ( ) < > = ␣` |
| 游戏符号 | ♥ ✦ ★ | 与 bar-cues 用符一致，替换 emoji fallback 观感 |

风格规则（构建时程序化校验，违反即 build 失败）：
- 竖笔 3px 宽，横笔 2px，对角线 2px
- 大写竖笔顶/底末端横向伸出 1px 尖角 serif（凿刻感）
- 所有字形基线对齐、网格边界内

字形以字符串模板定义（`#` = 着墨，`.` = 空），例如：

```python
A = """
..##......
.####.....
##..##....
##..##....
######....
##..##....
##..##....
...
"""
```

### 4.2 侵蚀变体（Darkhollow Runes Eroded）

- 只做大写 + 数字（36 字形）——服务 `#title-h1` 等大标题位
- 在干净版位图上**程序化施加**（固定随机种子 → 确定性输出）：
  - 边缘啃噬：1-2px 缺口
  - 笔划断裂：每字形 ≤1 处
  - 细裂纹：≤2 条 1px 对角短线
- 可读性下限：侵蚀后着墨率 ≥ 85%（单测锁定）

## 5. 生成管线（tools/font/build_font.py）

- fontTools（免费开源）逐字形位图 → 矢量轮廓（每像素方形，TTGlyphPen）→ 合成 TTF
  → WOFF2 压缩
- 字距/度量：monospaced 语义——**统一 advance = 12px**（容纳最宽的 10px 大写网格 +
  两侧各 1px bearing），窄字形（数字/小写 8px）在 advance 内居中；与现有 mono 栈的
  排版习惯一致
- 产物：`public/fonts/darkhollow-runes.woff2` 与 `darkhollow-runes-eroded.woff2`
- 体积预算：每份 < 60KB（纯拉丁+符号，预计 10-30KB；单测门锁定）
- JetBrains Mono（@fontsource）保留：fallback 与正文位不动

## 6. UI 接入

新变量 `--font-runes: 'Darkhollow Runes', var(--font-mono);`，`@font-face` 两份（常规 +
Eroded）。接入位清单：

| 选择器 | 用哪份 |
|---|---|
| `#title-h1` | Eroded |
| `#title-h2`、`.menu-btn`、`.title-stats`、选人屏标题 | 常规 |
| 楼层显示、`.bar` 数值文本、`.ft` 浮动数字、`#objective-panel` 标题 | 常规 |
| `.panel h2` | 常规 |

- 中文位：Runes 无中文字形 → 自动落 `var(--font-mono)` 的中文 fallback（设计意图）
- 兼容性核销：`--fs-*` 相对字号 ✓；textScale/hc/reduced-motion 与字体无关 ✓；
  `image-rendering: pixelated` 不适用于 DOM 文本（WOFF2 矢量自带像素方正轮廓）

## 7. 测试与验证

- **单测（glyphs/管线）**：风格规则断言（竖 3/横 2/网格/字符集完备 85 字形）；侵蚀
  确定性（同种子输出一致）；侵蚀着墨率 ≥85%；woff2 体积 < 60KB/份
- **单测（CSS 源门）**：接入位清单锁定（批12 静态门模式——读 main.css 断言各接入位
  字栈含 Runes，防回归）
- **e2e**：computed `font-family` 断言（title-h1 含 Eroded、HUD 位含 Runes）+ 标题屏
  截图；并入电池套件
- **目检闭环**：截图 → PIL 像素统计（Win 路径坑规避）+ 呈现用户目检 → 调模板重出

## 8. 迭代闭环（预期 2-3 轮）

初版程序化字形 → 截图呈现 → 用户目检反馈（太宽/太瘦/尖角过重等）→ 调整网格或规则
参数重出 → 循环。管线保证每轮 < 1 分钟。

## 9. 风险与对策

| 风险 | 对策 |
|---|---|
| 程序化字形美学不达标 | 迭代闭环 + 规则参数化（竖宽/尖角尺寸可调）；单字覆写逃生口 |
| 小字号可读性 | HUD 位仅用干净常规版；侵蚀版限大标题位 |
| fontTools 管线意外复杂 | 备选：位图→BDF→fontTools 导入的成熟路径 |
| dist 体积回归 | 体积门单测 |

## 10. 交付物清单

- `tools/font/glyphs.py`（字形模板 + 规则 + 侵蚀器）
- `tools/font/build_font.py`（fontTools 构建，含风格校验）
- `public/fonts/darkhollow-runes.woff2`、`darkhollow-runes-eroded.woff2`
- `style/main.css`：`@font-face` ×2 + `--font-runes` + 接入位
- `src/__tests__/batch14-runes-font.test.ts`（风格/侵蚀/体积/CSS 源门）
- `scripts/verify_batch14_ingame.py`（e2e 电池）
