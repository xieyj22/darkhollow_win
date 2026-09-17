# Steam 上架运营侧清单（后台操作）

代码侧批6 已就绪（steamworks.js 接线+降级守卫+云镜像）。本清单只剩 Steamworks 后台手工操作。
分工：**你点后台，我出数据/脚本/图标**。

## 0. 前置（唯一硬阻塞）

- [ ] Steamworks 合作伙伴账号（一次性 $100/款）
- [ ] 付费拿到 AppID → 告诉我数字，我配 steam_appid.txt + depot 脚本

## 1. 成就录入（29 条）

后台路径：App → 成就统计 → 成就。
先在「商店语言」里启用 **简体中文**，然后逐条录入（每条 = 1 行下表）。

**图标**：✅ 已生成 `build/achievements/{id}.png`（29 张 64×64，2026-09-17）。重新生成：`npx vite-node scripts/gen-achievement-icons.mts`。预览拼图 `build/achievements/_sheet.png`。与游戏内成就面板同源（T_* 模板+iconPalette）；T_SKULL 无 M 字母，脚本把主体字母注入 hue 区分 kill_10/kill_50/end_doom；endless 三连（T_SHADOW 固定色系）有意同脸=家族感。

| API 名称 | 英文名 | 英文描述 | 简中名 | 简中描述 |
|---|---|---|---|---|
| first_kill | First Blood | Kill your first enemy | 初见血 | 击杀第一个敌人 |
| kill_10 | Monster Slayer | Kill 10 enemies | 怪物猎人 | 击杀10个敌人 |
| kill_50 | Massacre | Kill 50 enemies | 屠杀者 | 击杀50个敌人 |
| kill_100 | Century Slayer | Kill 100 enemies | 百人斩 | 击杀100个敌人 |
| kill_200 | Army Breaker | Kill 200 enemies | 破军 | 击杀200个敌人 |
| boss_kill | Boss Slayer | Defeat a boss | Boss杀手 | 击败一个Boss |
| floor5 | Deep Explorer | Reach floor 5 | 深层探索者 | 到达第5层 |
| floor15 | Abyss Walker | Reach floor 15 | 深渊行者 | 到达第15层 |
| floor25 | Dragon Slayer | Reach floor 25 | 屠龙者 | 到达第25层 |
| floor30 | Abyssal Diver | Reach floor 30 | 深渊潜水者 | 到达第30层 |
| floor35 | Void Walker | Reach floor 35 | 虚空行者 | 到达第35层 |
| floor40 | Sanctum Conqueror | Reach floor 40 | 圣殿征服者 | 到达第40层 |
| legendary | Legendary Find | Find a legendary item | 传说发现 | 找到一件传说装备 |
| streak5 | On Fire! | 5 kill streak | 火力全开！ | 5连杀 |
| gold500 | Rich | Accumulate 500 gold | 富翁 | 累积500金币 |
| gold1000 | Tycoon | Accumulate 1000 gold | 大富翁 | 累积1000金币 |
| gold5000 | Dragon's Hoard | Accumulate 5000 gold | 龙之宝库 | 累积5000金币 |
| lvl10 | Veteran | Reach level 10 | 老兵 | 到达10级 |
| lvl20 | Elite | Reach level 20 | 精英 | 到达20级 |
| lvl30 | Legend | Reach level 30 | 传奇 | 到达30级 |
| win | Champion | Beat the game | 冠军 | 通关游戏 |
| creator_kill | Godslayer | Defeat The Creator | 弑神者 | 击败创世者 |
| endless50 | Abyss Delver | Reach floor 50 in Endless | 深渊掘进者 | 无尽模式到达50层 |
| endless75 | Void Walker | Reach floor 75 in Endless | 虚空行者 | 无尽模式到达75层 |
| endless100 | The Bottomless | Reach floor 100 in Endless | 无底之人 | 无尽模式到达100层 |
| end_pyrrhic | Pyrrhic Victor | Slay the Creator (low corruption) | 悲壮英雄 | 击杀创世者(低腐化) |
| end_doom | Doombringer | Slay the Creator while deeply corrupted | 末日使者 | 高腐化下击杀创世者 |
| end_guardian | The Guardian | Refuse to slay the Creator | 守誓者 | 拒绝击杀创世者 |
| warden_self_slay | Self-Slayer | Slay a Warden that was once you | 弑前 | 击杀一个曾是你的守渊人 |

注意：`floor25` 与 `endless75` 中文名相同（屠龙者/虚空行者）但 API 名不同，Steam 允许，照录即可。

## 2. Auto-Cloud 配置

后台路径：App → Steam Cloud → Steam Auto-Cloud。

存档落在 Electron userData（Roaming AppData）：
- 文件：`darkhollow-save.json`（单局存档）+ `darkhollow-profile.json`（跨局 meta/成就/回响）

配置：
- Root 选 **Roaming AppData**（应用数据漫游目录）
- 相对路径：`Depths of Darkhollow/`（**先跑一次打包 exe，去 `%APPDATA%` 确认真实文件夹名**——由 productName 决定，若实际是 `darkhollow` 就照实际的填）
- 文件掩码：`darkhollow-*.json`

代码侧批6 已做「文件赢除非印记新」冲突逻辑，Auto-Cloud 只负责搬运，无需再改代码。

## 3. Depot 与首次上传

1. App 后台 → SteamPipe → 建 **Depot 1（Windows 内容）**，记下 DepotID
2. 上传内容 = `release/win-unpacked/` **整目录**（steamworks.js 已 unpack 在位；不是 Setup 安装包）
3. 启动项：Launch executable = `Depths of Darkhollow.exe`
4. 上传方式：Steamworks 自带 contentbuilder（GUI 脚本）或 steamcmd —— ** DepotID/AppID 到手后我写好 vdf + 一键 bat**
5. 上传后 → App 后台把默认启动项指到该 depot → 设 internal/preview 测试

## 4. 本地验证（AppID 到手后）

- exe 同目录放 `steam_appid.txt`（内容=纯数字 AppID）→ 直接跑 exe，成就应弹 Steam 通知
- 无 Steam/无 AppID 时自动降级本地成就（批6 设计，勿当 bug）

## 5. 后续（不阻塞，另开任务）

- 商店页材料：短描述/长描述/标签/胶囊图（文案我写，图可用截图脚本批量出）
- 29 张成就图标生成（sprite 管线，半天内）
