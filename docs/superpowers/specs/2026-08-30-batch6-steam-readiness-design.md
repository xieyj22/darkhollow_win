# TECH — 批6「Steam 上架·代码侧」：云存档闭环 + nsis 打包 + steamworks 接线

- 基线 commit：`3402fd4`（main，2026-08-29，批5 已合入）
- 来源：2026-08-28 五路审计 Steam 就绪段（memory `darkhollow-audit-2026-08-28`）批6 提案；本 spec 撰写前已派 Explore 于 3402fd4 逐项复核（审计各项未变 + 三个审计未展开的坑，见 Context）
- 范围裁决（用户已批 2026-08-30「做批6」）：①存档回读+meta/设置文件镜像 ②打包 portable→nsis+dir ③steamworks.js 真接线。审计小时级的 pads[0] standard 过滤**批4 已做，跳过**。外部流程（$100 Steam Direct/税表/素材/Auto-Cloud 后台录入/steamcmd）不在本批——代码侧完成后即可并行启动
- 原则：浏览器/dev server 行为零变化（一切新路径 feature-detect `window.dh`）；Electron 侧改动全部优雅降级

---

## 1. Context（现状与证据，行号为 3402fd4 实测）

### 现状 A：存档只写不读 + 18/19 个 key 无文件镜像

- 双写只有写方向：`persistSave`（save.ts:25-29）同步写 `localStorage['dh_save']` + fire-and-forget `dh.saveFile(data)`；preload.cjs:8 暴露的 `loadFile()` **renderer 全库零调用**；main.cjs:40-43 的 `dh:load` handler（existsSync+readFileSync→userData/darkhollow-save.json）完整可用，链路只缺 renderer 侧。
- `loadGame()`（save.ts:59）同步只读 localStorage——Steam Cloud 把文件拉下来，游戏也看不见。
- **localStorage 生产 key 共 19 个，只有 dh_save 有镜像**（Explore 全量清单）：`dh_meta`（meta.ts:36 读/57 写——魂响/Forge/成就/统计/无尽榜/图鉴/Warden 名册，9 个 saveMeta 调用点）、`dh_keybinds`（keybinds.ts:262-265）、state.ts:45-114 的 **11 个**设置 key（lang/minimap_scale/zoom/reduced_motion/safe_zone/shake_scale/text_scale/colorblind/bar_cues/intro_enabled/hc）、audio.ts:14-17 的 4 个音频 key。换机/清存储即全丢。
- **坑①（审计未展开）**：设置/音频 key 的读取发生在 **ESM import 期**（state.ts/audio.ts 模块级 `let x = localStorage.getItem(...)`），早于 main.ts 顶层语句与 window.load（main.ts:211 起）——任何 async 回读都来不及，**必须 sendSync 同步回读且在 main.ts import 列表最前**。
- **坑②（审计未展开）**：死亡/胜利清档只删 localStorage（combat.ts:479/503/557 三处 `removeItem('dh_save')`），preload 无删除通道——`userData/darkhollow-save.json` 残留。一旦加"启动文件回读"，死档会在换机/清 localStorage 后经 Cloud 复活。**必须配套 delete channel**。

### 现状 B：portable 打包不适合 Steam

package.json `build` 块（:18-39）：`win.target=[{target:"portable",arch:["x64"]}]`，`files:["dist/**/*","electron/**/*"]`，无 nsis 块无 asarUnpack。`"dist": "npm run build && electron-builder --win portable"`（:15）。Steam depot 需要 win-unpacked（`dir` target）；portable 自解压慢 + file:// localStorage 按解压路径分区有跨运行丢档隐患（1.4.0 只冒烟了标题未验存档连续性）。附带：package-lock.json 根 version 停在 1.0.0（陈旧，本批顺带重生成）。

### 现状 C：steamworks 空转

main.cjs:47-66：`require('steamworks.js')` 在 try/catch（包未装→恒 null）→ `dh:unlock` handler 与 `steamworks.init()` 全部 no-op。renderer 侧链路其实**已通**：combat.ts:566 `checkAch` → steam.ts:9-12 `unlockAchievement(id)` → `dh:unlock`——只差主进程侧真包。成就 ID：ACH_DEFS 29 条（data.ts:306-344，`{id:'first_kill', n/d 双语}`），snake_case id 本身就是合法 Steamworks API Name，**零映射直用**（后台录入照抄 29 个 id；双语 n/d 正好做成就本地化 display_name）。
**坑③（审计未展开）**：`files` 白名单只有 dist+electron——就算装了 steamworks.js（native module），packaged app 里 `require('steamworks.js')` 也因模块不在包内恒走 catch。**必须 files+asarUnpack 同步加**。
CI 影响（Explore 评估）：tsc（include 只有 src）/vite build（renderer 图不含 electron/）/vitest（8 个测试文件已 mock steam.js）均不受影响；唯一接触点 `npm ci` 在 ubuntu 上多拉一个原生绑定包——需重生成 lock。

---

## 2. Proposed changes

### ① 云存档闭环：两文件 + ts 印记 + 文件赢语义

**文件布局**（userData 下，正是 Steam Auto-Cloud 默认同步目录）：
- `darkhollow-save.json`（已有，格式不变=裸 SaveData JSON）——高频写（每 5 回合 autoSave）
- `darkhollow-profile.json`（新）——低频写：`{ v:1, updatedAt:number, meta?:object, kv?:Record<string,string>（15 个设置/音频 key 的原样字符串值）, keybinds?:object }`

**冲突判定（两个文件同规则）**：**文件赢，除非 localStorage 侧印记更新**。
- 每次**成功**落盘后写印记：`localStorage['dh_save_ts']`（persistSave 的 saveFile promise resolve 时）/ `localStorage['dh_profile_ts']`（persistProfile 落盘后）。
- 回读时主进程返回 `{data, mtime}`（dh:load 与新 dh:loadProfile 均改此形状）；renderer 比较 `mtime vs 印记`：印记新（=本会话文件写失败/崩溃残留）→ 保 localStorage；否则文件覆盖 localStorage 对应 key。
- 语义覆盖 Steam 双机场景（Cloud 冲突由 Steam 在文件层解决→文件=最新→文件赢）；本机崩溃场景（localStorage 新于文件）由印记保护。

**新增 `src/cloud-sync.ts`**（零依赖、只碰 window.dh+localStorage——可在 main.ts import 链最前求值）：
- `initCloudSync(): void`——main.ts **第一个** import（state.js 之前）。流程：`window.dh?.loadFileSync` 不存在（浏览器/dev）→ 全跳过；存在 → sendSync 一次取 `{save:{data,mtime}, profile:{data,mtime}}` → 按印记规则把 dh_save/15 设置 key/dh_meta/dh_keybinds 写回 localStorage（**先于 state.ts/audio.ts 模块级读**）→ 写回对应印记。
- `persistProfile(): void`——组装 profile（getMeta() 不调，由调用方传 meta 对象防循环依赖；kv=15 个 key 现值快照；keybinds）→ `dh.saveProfile(json)` 异步 + resolve 后写 `dh_profile_ts`。
- `scheduleProfileSync(): void`——debounce 500ms 合并连发改动；`window.addEventListener('beforeunload', flush)` 兜底崩溃尾差。

**写点挂钩（17 处一行改动，计划期计数订正）**：state.ts 11 个持久化 setter + audio.ts 4 个 setter 各加 `scheduleProfileSync()`；keybinds.ts saveKeybinds 出口 + meta.ts saveMeta 出口各加（profile 的 kv 快照直接读 localStorage 原串，meta 无需传对象——挂点只触发时机，组包集中在 persistProfile）。

**save 侧回读（计划期简化）**：Steam Auto-Cloud 只在进程边界同步（启动前/退出后），**启动时 sendSync 回读即完整**——原设计的"Continue 按下时二次读文件"裁掉（Auto-Cloud 无会话中同步场景），loadGame 本体与 btn-cont handler 零改动。死亡/胜利三处清档点（combat.ts:479/503/557）统一改走新 `clearCloudSave()`（删 dh_save+dh_save_ts+文件）。

**electron 侧**：preload.cjs 加 `loadFileSync`（sendSync 'dh:loadSync'，一次返回两文件 {data,mtime}）、`saveProfile(json)`、`deleteSave()`；main.cjs：新增 `dh:loadSync`（readFileSync+statSync.mtimeMs，sendSync handler 同步安全）、`dh:saveProfile`、`dh:delete`（unlinkSync+存在性守卫）；现有 `dh:load` 保持原样（e2e 冒烟的断言通道用 loadFileSync，dh:load 留作裸读备用）。

### ② 打包：nsis + dir（portable 移到可选 script）

- `build.win.target` → `[{target:"nsis",arch:["x64"]},{target:"dir",arch:["x64"]}]`；加 `nsis: { oneClick:false, allowToChangeInstallationDirectory:true, artifactName:"${productName} Setup ${version}.${ext}" }`（发朋友/Itch 用安装器；dir 出 win-unpacked 供 Steam depot/steamcmd）。
- scripts：`"dist": "npm run build && electron-builder --win nsis dir"`；新增 `"dist:portable": "npm run build && electron-builder --win portable"`（playtest 旧路保留）。
- steamworks.js（native）打包三件套：dependencies 加入 `steamworks.js`；`files` 加 `"node_modules/steamworks.js/**/*"`；`asarUnpack: ["node_modules/steamworks.js/**"]`。
- `npm install` 重生成 package-lock（顺带治愈 lock version 1.0.0 陈旧项）——CI npm ci 依赖 lock 同步。
- steam_appid.txt：**不进仓库不进包**（files 白名单天然排除根目录文件）。AppID 拿到后放根目录供 dev/本地 Steam 客户端测试——README 补一段三步说明（放 AppID→npm run dev→Steam 客户端在线）。

### ③ steamworks 真接线

- `npm i steamworks.js`（dependencies）。
- main.cjs:47-66 精修：`init()` 返回值检查（steamworks.js init 返 bool）——失败置 `steamworks=null` 并 console.warn（防后续 activate 白调）；`dh:unlock` 保持 try/catch；成就激活即 ACH_DEFS.id 直用（零映射）。
- 不做：Steam Cloud 的 IPC 接线（Auto-Cloud 配 %APPDATA%/.../userData 目录由后台配置，代码侧零改动——main.cjs 现有注释的假设随本批成真）、rich presence/overlay/云冲突 UI（YAGNI）。

---

## 3. Testing and validation

| 项 | 测试 | 形态 |
|---|---|---|
| cloud-sync 回读规则 | 文件赢/印记赢/浏览器跳过/坏 JSON 兜底/15 key+meta+keybinds 全量写回 | 单测（happy-dom mock `window.dh.loadFileSync` 返回各 fixture；cloud-sync 纯逻辑零 DOM） |
| persistProfile/scheduleProfileSync | 组装形状/debounce 合并/beforeunload flush/saveMeta 挂钩后 profile 落盘 | 单测（fake timers） |
| 清档 delete | 三清档点调 deleteSave + 印记删除 | 单测（combat 侧已有 mock 惯例，grep 三处 run 既有测试加断言） |
| preload/main IPC | 5 channel 形状（{data,mtime}/unlink 守卫/sendSync 同步性） | main.cjs 无 electron 难单测——**出包冒烟覆盖**（下行）+ code review |
| 打包 | `npm run dist` 出 nsis+dir；`release/win-unpacked/resources/app.asar.unpacked/node_modules/steamworks.js` 存在；安装器可运行；**存档连续性冒烟**（批6 新增：打包版起→开局存档→杀进程重启→Continue 档在） | 本地脚本化冒烟（沿用 1.4.0 打包+MainWindowTitle 轮询法，portable 换 nsis/dir 后窗口仍 ~10s） |
| steamworks | 未装 Steam/无 AppID→init false→warn+null（行为=现状 no-op，成就仍进本地 dh_meta） | 出包冒烟（无 Steam 环境跑）+ code review |
| 回归 | tsc 0（裸跑）/vitest 全绿/e2e 五套（batch4 19/batch5 28/3c 64/3b 18/pad 22/rc 10）零 console 错——dev server 无 window.dh，全部走跳过分支=回归证明浏览器路径零变化 | 七门 |

**游戏内冒烟脚本** `scripts/verify_batch6_electron.py`：nsis/dir 出包产物（或 electron:preview dev-electron）驱动——起 Electron（无 Steam）→ 新局→自动存档→验证 userData 两文件存在且内容可解析→重启→Continue 回读成功→死亡清档→文件消失。Electron 侧真实 IPC 链路的唯一覆盖。

---

## 4. Parallelization

**同分支串行，3 实现 task**（沿用批4 SDD 形态；spec+plan 文档随分支走）：

- **T1 云存档闭环**（cloud-sync.ts 新建 + state/audio/keybinds/meta/save 挂钩 + preload/main 5 channel + combat 清档 + 单测）——最大 task，renderer+electron 两侧；
- **T2 打包改造**（package.json target/nsis/files/asarUnpack/scripts + npm i steamworks.js 重生成 lock + main.cjs init 精修 + README Steam 段）；
- **T3 出包冒烟+七门回归**（verify_batch6_electron.py + 全量门 + verify_batch4/5 复跑）。

T1/T2 文件不相交可并行，但 T3 依赖两者、且 lock 重生成会动 package-lock.json（全树共享）——**串行**最稳。分支 `feat/batch6-steam`。

### 风险与缓解
- sendSync 阻塞 renderer：启动一次、两文件 <100KB，实测无感；浏览器无此路径。
- npm ci 拉 steamworks 原生绑定失败→CI 红：绑定包很小（~2MB），且 npmmirror 镜像已在 .npmrc 生效范围；若仍失败，CI 可加 `STEAMWORKS_SKIP` 类跳过（steamworks.js 无此机制则回退：把依赖移 devDeps+files 手工带——**不预设，撞了再裁**）。
- 文件赢语义的残余风险：autoSave 双写间隔内崩溃→Steam 同步旧档→本机印记随 localStorage 同在（印记也在 localStorage！换机后印记没了→文件赢=对的）。本机重启场景印记保护成立。可接受。
- asar unpack 后 app.asar.unpacked 路径 require：electron-builder 自动处理 unpacked require 重定向，无需代码改动。

### Follow-ups（不在本批）
- Steam 后台录入（29 成就 id 照抄 + Auto-Cloud 配 userData + depot 上传）——外部流程文档化进 README Steam 段。
- nsis 安装器代码签名（无证书，Steam 渠道不需要）。
- 云冲突 UI（Steam 自己的同步对话框够用）。
