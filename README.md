# Depths of Darkhollow

一款 ASCII roguelike 地下城 crawler。纯 TypeScript + Canvas 2D,程序化音频与像素 sprite,无外部美术/音频资源。jam 原型,持续打磨中。

## 运行

```bash
npm install        # 装依赖(electron 二进制走 .npmrc 镜像)
npm run dev        # Vite dev server(浏览器,:5173)
npm run build      # tsc + vite build(类型检查 + 产物)
npm run electron:preview   # build 后用 Electron 打开
npm run dist       # build + electron-builder 打 Win portable exe → release/
npm run gen:icon   # 重新生成 build/icon.ico
```

## 操作

| 键 | 动作 | | 键 | 动作 |
|----|------|-|----|------|
| WASD / 方向键 | 移动 | | F | 等待 |
| 1-9 | 快捷道具 | | Q | 喝药 |
| B | 背包 | | R | 读卷 |
| G | 拾取 | | T | 成就 |
| > | 下楼 | | L | 切语言 |
| K | 技能 | | M | 静音 |
| Ctrl+S | 保存 | | ESC | 暂停 |

**目标**:下到第 40 层击败创世者。每 5 层一个 Boss。手柄亦支持(Start 暂停)。

## 技术栈

TypeScript 5 · Vite 6 · Canvas 2D · Electron 42 · electron-builder 26 · Web Audio API(程序化 BGM/SFX)。

## 架构要点

- **渲染双轨**:`render()` 每回合整屏重绘 + `captureSnapshot()`;`particles.ts` 持续 rAF 循环在 snapshot 上叠加粒子 / FX / 震屏 / 玩家补间层。
- **late-binding**(`setXxxFn`)解模块间循环依赖。
- **存档双写**:localStorage(同步)+ Electron 文件 `userData/darkhollow-save.json`(异步,供 Steam Cloud)。
- 表驱动内容:`data.ts` 的 `ENEMIES` / `RELICS` / `META_UPGRADES` / `ACH_DEFS`。

## License

MIT。
