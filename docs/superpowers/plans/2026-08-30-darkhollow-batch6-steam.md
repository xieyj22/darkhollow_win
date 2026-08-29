# 批6「Steam 上架·代码侧」Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 云存档闭环（启动文件回读+profile 镜像+清档通道）+ 打包 nsis/dir + steamworks.js 真接线——Steam 上架的全部代码侧缺口清零。

**Architecture:** 新 `src/cloud-sync.ts`（零依赖副作用模块，main.ts 首个 import，sendSync 同步回读早于 state.ts/audio.ts 的 import 期读取）；两文件镜像（save 已有 + 新 profile 单文件聚合 17 个 localStorage 键）；"文件赢除非印记更新"冲突语义（mtime vs `dh_save_ts`/`dh_profile_ts`，双写顺序天然保证正确性）；Electron 侧 3 新 IPC channel + 打包三件套（dependencies/files/asarUnpack）。

**Tech Stack:** TS+Vite renderer / Electron cjs 主进程 / electron-builder / steamworks.js / vitest(happy-dom) / Playwright（CDP 连真 Electron）。

**Spec:** `docs/superpowers/specs/2026-08-30-batch6-steam-readiness-design.md`（两处计划期修正已回写 spec：①Continue 时二次回读裁掉——Auto-Cloud 只在进程边界同步，启动回读即完整；②持久化 setter 数为 11+4 而非 13）

## Global Constraints

- 基线 `main@3402fd4`（批5 已合，vitest **493/493** + tsc 0 + e2e 五套绿）；分支 `feat/batch6-steam`。
- **浏览器/dev server 行为零变化**：一切新路径 feature-detect `window.dh`，缺失即跳过——dev server 无 window.dh，e2e 五套照绿即回归证明。
- `npx tsc --noEmit` 裸跑贴原文；测试计数**基线+N 实跑为准**（当前基线 493）。
- source 门读文件用动态路径形式 `new URL('../' + f, import.meta.url)`（Vite 改写字面量 URL 的坑，批4 裁决）。
- Electron 侧（main.cjs/preload.cjs）不在 tsc/vitest 范围——其正确性由 Task 4 的真 Electron 冒烟覆盖。
- steamworks.js 未装 Steam/无 AppID 时必须优雅降级为本地成就（现状行为），console 只允许 warn 不允许 error。

---

### Task 1: cloud-sync renderer 侧（回读+镜像+清档）

**Files:**
- Create: `src/cloud-sync.ts`
- Modify: `src/main.ts:1`（首个 import）、`src/state.ts`（11 个持久化 setter）、`src/audio.ts`（4 个 setter）、`src/keybinds.ts:262-265`（saveKeybinds）、`src/meta.ts:56-58`（saveMeta）、`src/combat.ts:479/503/557`（三处清档）、`src/save.ts:25-29`（persistSave 记 ts 印记）
- Test: `src/__tests__/batch6-cloud-sync.test.ts`（新建）

**Interfaces:**
- Consumes: `window.dh.{loadFileSync, saveFile, saveProfile, deleteSave}`（Task 2 定义；本 task 测试全 mock，不依赖 T2 完成即可绿）。
- Produces: `initCloudSync()`（模块导入副作用自执行）、`scheduleProfileSync(): void`、`clearCloudSave(): void`、常量 `PROFILE_KEYS: string[]`（17 键）。

- [ ] **Step 1: 写失败测试** — 新建 `src/__tests__/batch6-cloud-sync.test.ts`：

```ts
// 批6 T1: cloud mirror read-back + profile snapshot + clear channel.
// cloud-sync self-inits on import → every case controls window.dh BEFORE a
// fresh dynamic import (vi.resetModules + delete window.dh in beforeEach).
import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => { localStorage.clear(); vi.resetModules(); delete (window as any).dh; });

describe('initCloudSync (startup read-back, file wins unless ts stamp newer)', () => {
  it('fresh machine (no ts) → file wins for save + profile kv', async () => {
    localStorage.setItem('dh_lang', 'en');
    (window as any).dh = { loadFileSync: () => ({
      save: { data: '{"floor":7}', mtime: 2000 },
      profile: { data: JSON.stringify({ v: 1, kv: { dh_lang: 'zh', dh_meta: '{"soulEchoes":9}' } }), mtime: 2000 },
    }) };
    await import('../cloud-sync.js');
    expect(localStorage.getItem('dh_lang')).toBe('zh');
    expect(localStorage.getItem('dh_meta')).toBe('{"soulEchoes":9}');
    expect(localStorage.getItem('dh_save')).toBe('{"floor":7}');
  });
  it('local ts newer than file mtime → localStorage stands (crash-window guard)', async () => {
    localStorage.setItem('dh_save', '{"floor":9}');
    localStorage.setItem('dh_save_ts', '5000');
    localStorage.setItem('dh_lang', 'zh');
    localStorage.setItem('dh_profile_ts', '5000');
    (window as any).dh = { loadFileSync: () => ({
      save: { data: '{"floor":2}', mtime: 2000 },
      profile: { data: JSON.stringify({ v: 1, kv: { dh_lang: 'en' } }), mtime: 2000 },
    }) };
    await import('../cloud-sync.js');
    expect(localStorage.getItem('dh_save')).toBe('{"floor":9}');
    expect(localStorage.getItem('dh_lang')).toBe('zh');
  });
  it('no window.dh (browser/dev) → nothing read, nothing thrown', async () => {
    localStorage.setItem('dh_lang', 'en');
    await import('../cloud-sync.js');   // no dh at all
    expect(localStorage.getItem('dh_lang')).toBe('en');
  });
  it('corrupt profile JSON → save side still applied, profile skipped, no throw', async () => {
    (window as any).dh = { loadFileSync: () => ({
      save: { data: '{"floor":3}', mtime: 100 },
      profile: { data: '{not json', mtime: 100 },
    }) };
    await expect(import('../cloud-sync.js')).resolves.toBeTruthy();
    expect(localStorage.getItem('dh_save')).toBe('{"floor":3}');
  });
});

describe('scheduleProfileSync (debounced single-file snapshot)', () => {
  it('two quick calls → one saveProfile with all 17 keys present-or-absent correctly, ts stamped on resolve', async () => {
    vi.useFakeTimers();
    const saveProfile = vi.fn(() => Promise.resolve(true));
    (window as any).dh = { saveProfile };
    const cs = await import('../cloud-sync.js');
    localStorage.setItem('dh_lang', 'zh');
    localStorage.setItem('dh_meta', '{"a":1}');
    cs.scheduleProfileSync(); cs.scheduleProfileSync();
    expect(saveProfile).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(saveProfile).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(saveProfile.mock.calls[0][0]);
    expect(payload.v).toBe(1);
    expect(payload.kv.dh_lang).toBe('zh');
    expect(payload.kv.dh_meta).toBe('{"a":1}');
    expect(payload.kv.dh_zoom).toBeUndefined();      // absent key stays absent
    await Promise.resolve();                          // microtask: ts stamp after resolve
    expect(localStorage.getItem('dh_profile_ts')).toBeTruthy();
    vi.useRealTimers();
  });
  it('a state.ts setter feeds the snapshot (integration: setLang → kv carries it)', async () => {
    vi.useFakeTimers();
    const saveProfile = vi.fn(() => Promise.resolve(true));
    (window as any).dh = { saveProfile };
    const cs = await import('../cloud-sync.js');
    const st = await import('../state.js');
    st.setLang('zh');
    await vi.advanceTimersByTimeAsync(500);
    expect(JSON.parse(saveProfile.mock.calls[0][0]).kv.dh_lang).toBe('zh');
    vi.useRealTimers();
  });
});

describe('clearCloudSave (death/victory delete channel)', () => {
  it('removes dh_save + ts, calls dh.deleteSave', async () => {
    const deleteSave = vi.fn();
    (window as any).dh = { deleteSave };
    localStorage.setItem('dh_save', 'x'); localStorage.setItem('dh_save_ts', '1');
    const cs = await import('../cloud-sync.js');
    cs.clearCloudSave();
    expect(localStorage.getItem('dh_save')).toBeNull();
    expect(localStorage.getItem('dh_save_ts')).toBeNull();
    expect(deleteSave).toHaveBeenCalledTimes(1);
  });
  it('combat clear points route through clearCloudSave (source gate, dynamic URL form)', async () => {
    const { readFileSync } = await import('node:fs');
    const f = 'combat.ts';
    const text = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    expect((text.match(/clearCloudSave\(\)/g) ?? []).length).toBe(3);
    expect(text).not.toContain("removeItem('dh_save')");
  });
});

describe('persistSave stamps dh_save_ts on successful file write (source gate)', () => {
  it('save.ts resolve path writes the stamp', async () => {
    const { readFileSync } = await import('node:fs');
    const f = 'save.ts';
    const text = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    expect(text).toContain("dh_save_ts");
  });
});
```

- [ ] **Step 2: 跑测试确认失败** — `npx vitest run src/__tests__/batch6-cloud-sync.test.ts`；期望全部 FAIL（模块不存在）。

- [ ] **Step 3: 最小实现**

新建 `src/cloud-sync.ts`（完整文件）：

```ts
// 批6: Steam Cloud mirror — the bridge between localStorage and the two JSON
// files Steam Auto-Cloud syncs (userData dir). Self-initializing side-effect
// module: MUST be main.ts's first import so the sendSync read-back lands in
// localStorage BEFORE state.ts/audio.ts read their keys at module-evaluation
// time (any async read would be too late — that's why sendSync).
// Browser / dev-server: window.dh is undefined → every path degrades to no-op.

// All persisted localStorage keys except dh_save (which has its own file) and
// the two ts stamps. Raw strings — the mirror is format-agnostic.
export const PROFILE_KEYS = [
  'dh_lang', 'dh_minimap_scale', 'dh_zoom', 'dh_reduced_motion', 'dh_safe_zone',
  'dh_shake_scale', 'dh_text_scale', 'dh_colorblind', 'dh_bar_cues', 'dh_intro_enabled', 'dh_hc',
  'dh_muted', 'dh_vol_master', 'dh_vol_music', 'dh_vol_sfx',
  'dh_keybinds', 'dh_meta',
];

interface FileSnap { data: string; mtime: number }

// "File wins unless the local stamp is newer." Write ordering guarantees this
// is right: localStorage is written first, the file second, and the stamp only
// after the file write resolves — so after every healthy save stamp >= mtime.
// File newer than stamp therefore means another machine's Steam Cloud copy
// (take it); a crash between the two writes leaves the file at its OLD mtime
// == last stamp → comparison is false → the newer localStorage stands.
function applySnap(key: string, snap: FileSnap | null | undefined): void {
  if (!snap?.data) return;
  const stamp = Number(localStorage.getItem(key === 'dh_save' ? 'dh_save_ts' : 'dh_profile_ts') || 0);
  if (snap.mtime > stamp) localStorage.setItem(key, snap.data);
}

export function initCloudSync(): void {
  const dh = (window as any).dh;
  if (!dh?.loadFileSync) return;                     // browser / dev server
  try {
    const snap = dh.loadFileSync() as { save?: FileSnap | null; profile?: FileSnap | null };
    applySnap('dh_save', snap?.save);
    if (snap?.profile?.data) {
      const p = JSON.parse(snap.profile.data) as { v?: number; kv?: Record<string, string> };
      if (p?.kv) {
        // profile writes are all-or-nothing per key set; stamp check on the whole file
        const stamp = Number(localStorage.getItem('dh_profile_ts') || 0);
        if (snap.profile.mtime > stamp) for (const [k, v] of Object.entries(p.kv)) localStorage.setItem(k, String(v));
      }
    }
  } catch { /* corrupt mirror — localStorage stands */ }
}

let syncTimer: number | null = null;
function persistProfile(): void {
  const dh = (window as any).dh;
  if (!dh?.saveProfile) return;
  const kv: Record<string, string> = {};
  for (const k of PROFILE_KEYS) { const v = localStorage.getItem(k); if (v !== null) kv[k] = v; }
  const payload = JSON.stringify({ v: 1, updatedAt: Date.now(), kv });
  try {
    Promise.resolve(dh.saveProfile(payload) as Promise<unknown>)
      .then(ok => { if (ok) localStorage.setItem('dh_profile_ts', String(Date.now())); })
      .catch(() => { /* file write failed — stamp stays old, next boot file loses */ });
  } catch { /* ignore */ }
}

/** Debounced (500ms) profile snapshot — call from every persisted setter. */
export function scheduleProfileSync(): void {
  if (syncTimer !== null) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { syncTimer = null; persistProfile(); }, 500);
}

/** Death/victory clear: drop localStorage save + stamp + the mirrored file. */
export function clearCloudSave(): void {
  localStorage.removeItem('dh_save');
  localStorage.removeItem('dh_save_ts');
  const dh = (window as any).dh;
  if (dh?.deleteSave) { try { dh.deleteSave(); } catch { /* ignore */ } }
}

// Crash-tail guard: flush a pending debounced write on unload.
window.addEventListener('beforeunload', () => { if (syncTimer !== null) { clearTimeout(syncTimer); syncTimer = null; persistProfile(); } });

initCloudSync();
```

（注意 applySnap 里 save 与 profile 的 stamp 逻辑——写完可把 applySnap 内联进 initCloudSync 只保留一份 profile 逻辑，实现者自洁；两处语义必须一致：`mtime > stamp ? 覆盖 : 保持`。）

挂点改动（每处一行）：
- `src/main.ts` 最顶（现有 fontsource import 之前）加：`import './cloud-sync.js';`
- `src/state.ts` 11 个持久化 setter（setLang:49/setMinimapScale:61/setUiZoom:71/setReducedMotion:82/setSafeZone:86/setShakeScale:90/setTextScale:94/setColorblind:99/setBarCues:103/setIntroEnabled:108/setHc:114）函数体末尾各加：`scheduleProfileSync();`（顶部加 `import { scheduleProfileSync } from './cloud-sync.js';`——cloud-sync 零依赖无循环）。
- `src/audio.ts` 4 个 setter（setMasterVol/setMusicVol/setSfxVol:53-55 与 setMutedState:60 一带，先读文件确认函数名）同样各加一行 + import。
- `src/keybinds.ts` saveKeybinds（:262-265）末尾加 `scheduleProfileSync();` + import。
- `src/meta.ts` saveMeta（:56-58）末尾加 `scheduleProfileSync();` + import（meta 进 profile 靠 kv 快照读 `dh_meta` 原串，无需传对象）。
- `src/combat.ts` 三处 `localStorage.removeItem('dh_save');`（:479/:503/:557）各替换为 `clearCloudSave();` + 顶部 import（combat.ts 已有的 import 区加一行）。
- `src/save.ts` persistSave（:25-29）的 fire-and-forget 改为记印记：

```ts
function persistSave(data: string): void {
  try { localStorage.setItem(SAVE_KEY, data); } catch { /* quota / private mode */ }
  const dh = (window as any).dh;
  if (dh?.saveFile) { try { Promise.resolve(dh.saveFile(data)).then(ok => { if (ok) localStorage.setItem('dh_save_ts', String(Date.now())); }).catch(() => {}); } catch { /* ignore */ } }
}
```

- [ ] **Step 4: 跑测试确认通过** — `npx vitest run src/__tests__/batch6-cloud-sync.test.ts` 全 PASS；再全量 `npx vitest run`（基线 493 + 新增 ~10）+ `npx tsc --noEmit` 裸跑 0。

- [ ] **Step 5: 提交**

```bash
git add src/cloud-sync.ts src/main.ts src/state.ts src/audio.ts src/keybinds.ts src/meta.ts src/combat.ts src/save.ts src/__tests__/batch6-cloud-sync.test.ts
git commit -m "feat(cloud): startup file-mirror read-back + debounced profile snapshot + clear channel (batch6 T1)"
```

---

### Task 2: Electron IPC 侧（loadSync/saveProfile/delete + mtime）

**Files:**
- Modify: `electron/preload.cjs`（+3 暴露）
- Modify: `electron/main.cjs:7-45`（PROFILE_FILE 常量 + readSnap helper + 3 handler）

**Interfaces:**
- Consumes: Task 1 定义的 window.dh 面：`loadFileSync(): {save?:{data,mtime}|null, profile?:{data,mtime}|null}`（sendSync）、`saveProfile(json:string): Promise<boolean>`、`deleteSave(): Promise<boolean>`。
- Produces: renderer 可用的完整 mirror 通道。**无单测**（cjs 不在 vitest 范围）——Task 4 真 Electron 冒烟覆盖；本 task 验证 = `node --check electron/main.cjs && node --check electron/preload.cjs` 语法门。

- [ ] **Step 1: main.cjs** — 在 SAVE_FILE 常量区（:7-11）扩展：

```js
const SAVE_FILE = 'darkhollow-save.json';
const PROFILE_FILE = 'darkhollow-profile.json';

function savePath() {
  return path.join(app.getPath('userData'), SAVE_FILE);
}
// 批6: mirror snapshot with mtime for the "file wins unless stamp newer" rule.
function readSnap(file) {
  try {
    const p = path.join(app.getPath('userData'), file);
    if (!fs.existsSync(p)) return null;
    return { data: fs.readFileSync(p, 'utf8'), mtime: fs.statSync(p).mtimeMs };
  } catch { return null; }
}
```

handler 区（:35-45 一带）新增三个（`dh:load` 保持原样不动——Task 4 冒烟用它做断言）：

```js
// 批6: one synchronous round-trip feeding BOTH mirrors into localStorage
// before the renderer's ES modules evaluate (state.ts reads at import time).
ipcMain.on('dh:loadSync', (e) => { e.returnValue = { save: readSnap(SAVE_FILE), profile: readSnap(PROFILE_FILE) }; });
ipcMain.handle('dh:saveProfile', (_e, data) => {
  try { fs.writeFileSync(path.join(app.getPath('userData'), PROFILE_FILE), data, 'utf8'); return true; } catch { return false; }
});
ipcMain.handle('dh:delete', (_e) => {
  try { const p = savePath(); if (fs.existsSync(p)) fs.unlinkSync(p); return true; } catch { return false; }
});
```

- [ ] **Step 2: preload.cjs** — dh 对象（:6-12）加三行：

```js
  loadFileSync: () => ipcRenderer.sendSync('dh:loadSync'),
  saveProfile: (data) => ipcRenderer.invoke('dh:saveProfile', data),
  deleteSave: () => ipcRenderer.invoke('dh:delete'),
```

- [ ] **Step 3: 验证** — `node --check electron/main.cjs && node --check electron/preload.cjs` 双 0；全量 `npx vitest run` 仍绿（renderer 测试全 mock dh，不受影响）；`npx tsc --noEmit` 0。

- [ ] **Step 4: 提交**

```bash
git add electron/main.cjs electron/preload.cjs
git commit -m "feat(electron): mirror IPC — sync load both files w/ mtime, saveProfile, deleteSave (batch6 T2)"
```

---

### Task 3: 打包改造 + steamworks 真接线

**Files:**
- Modify: `package.json`（build 块 + scripts + dependencies）、`package-lock.json`（npm install 重生成，顺带治愈 version 1.0.0 陈旧）
- Modify: `electron/main.cjs:47-66`（steamworks init 精修）
- Modify: `README.md`（Steam 上架段）

**Interfaces:**
- Consumes: 无（独立于 T1/T2 的文件集，但 main.cjs 与 T2 同文件不同区域——串行无冲突）。
- Produces: `npm run dist` 出 nsis+dir；`npm run dist:portable` 保留旧路；steam_appid.txt 工作说明。

- [ ] **Step 1: 依赖安装** — `npm install steamworks.js`（进 dependencies；npmmirror 生效）。确认 package.json dependencies 块出现它、lock 重生成且根 version 变 1.4.0。

- [ ] **Step 2: package.json build 块改造**（:18-39）：

```json
"build": {
  "appId": "com.darkhollow.game",
  "productName": "Depths of Darkhollow",
  "directories": { "output": "release" },
  "files": [ "dist/**/*", "electron/**/*", "node_modules/steamworks.js/**/*" ],
  "asarUnpack": [ "node_modules/steamworks.js/**" ],
  "win": {
    "icon": "build/icon.ico",
    "target": [ { "target": "nsis", "arch": [ "x64" ] }, { "target": "dir", "arch": [ "x64" ] } ]
  },
  "nsis": { "oneClick": false, "allowToChangeInstallationDirectory": true, "artifactName": "${productName} Setup ${version}.${ext}" }
}
```

scripts：`"dist": "npm run build && electron-builder --win nsis dir"`；新增 `"dist:portable": "npm run build && electron-builder --win portable"`。

- [ ] **Step 3: main.cjs steamworks 精修**（:47-66 区域）——init 返回值检查，失败置 null 防 activate 白调：

```js
app.whenReady().then(() => {
  if (steamworks) {
    try {
      // steamworks.js init() returns false when Steam isn't running / no AppID.
      if (!steamworks.init()) { console.warn('[steam] init failed (Steam not running / no steam_appid.txt) — achievements local-only'); steamworks = null; }
    } catch (e) { console.warn('[steam] init threw:', e && e.message, '— achievements local-only'); steamworks = null; }
  }
  Menu.setApplicationMenu(null);
```

（whenReady 其余不动；`dh:unlock` handler 不动。）

- [ ] **Step 4: README Steam 段** — 文末加「上架 Steam」小节，三步 dev 测试说明（拿到 AppID 后：根目录放 `steam_appid.txt`（内容=AppID 数字，**不进仓库不进包**——files 白名单天然排除）→ Steam 客户端在线 → `npm run electron:preview` 成就直通 Steam）+ 后台录入清单（29 成就 id 照抄 ACH_DEFS/snake_case 即 API Name、Auto-Cloud 配 userData 目录、depot 用 `release/win-unpacked`、`npm run dist` 出包）。

- [ ] **Step 5: 验证 + 提交** — `npm run build` 绿；`node --check electron/main.cjs`；`npx vitest run` 全绿；`npx tsc --noEmit` 0。

```bash
git add package.json package-lock.json electron/main.cjs README.md
git commit -m "build(steam): nsis+dir targets, steamworks.js wiring (deps/files/asarUnpack/init guard), lock regen, README notes (batch6 T3)"
```

（完整出包验证在 Task 4——本 task 不跑 electron-builder。）

---

### Task 4: 真 Electron 冒烟 + 七门回归

**Files:**
- Create: `scripts/verify_batch6_electron.py`
- Test: 全部门禁

**Interfaces:**
- Consumes: T1-T3 全部；`release/win-unpacked/Depths of Darkhollow.exe`（Task 4 自行出包）。
- Produces: 批6 验收证据（Electron 侧唯一覆盖）。

- [ ] **Step 1: 出包** — `npm run dist`（双镜像 env 照 1.4.0 档案：`ELECTRON_MIRROR=... ELECTRON_BUILDER_BINARIES_MIRROR=...`）；断言：`release/win-unpacked/resources/app.asar.unpacked/node_modules/steamworks.js/` 存在；nsis 安装器产物存在；无 portable 覆盖旧文件。

- [ ] **Step 2: 写 `scripts/verify_batch6_electron.py`**（playwright `chromium.connect_over_cdp`；Electron 启动带 `--remote-debugging-port=9333`；窗口出现轮询 >10s——portable 先解压的坑对 dir 产物不适用，但仍留裕量）。场景：

1. **双文件落地**：新局 → 走几步触发 autoSave（或 evaluate 调 saveGame）→ evaluate `window.dh.loadFileSync()` 断言 `save.data` 可解析且 `save.mtime>0`；改一个设置（setLang）→ 等 600ms → `profile.data` 可解析、`kv.dh_lang` 正确。
2. **换机模拟回读**（核心场景）：evaluate `localStorage.clear()`（模拟新机器——ts 印记一并清掉）→ 退出进程 → 重新启动 exe → evaluate 断言 `localStorage.getItem('dh_lang')` 已被 sendSync 回读恢复、`dh_save` 非空 → Continue 可用（title 屏 Continue 按钮未禁用/点击进得去）。
3. **清档通道**：evaluate 触发 playerDeath（或直接调 clearCloudSave）→ `window.dh.loadFileSync()` 断言 `save === null`（文件已删）→ 重启后 Continue 不可用。
4. **steamworks 优雅降级**：全程收集 console——无 error（Steam 未装/无 AppID 只允许 warn）；成就路径仍写 dh_meta（unlockLore/achievement 后 meta 检查）。

结束 kill Electron 进程树（含 --remote-debugging-port 残留）。PASS/FAIL 汇总 + 零 console error 才 exit 0。

- [ ] **Step 3: 七门** — `npx tsc --noEmit`（裸）/ `npx vitest run`（计数=493+T1 新增）/ `python scripts/verify_batch6_electron.py` / verify_batch4_ingame.py 19 / verify_batch3c_ingame.py 64 / verify_gamepad_ingame.py 22 / verify_reconnect_ingame.py 10（dev server 无 window.dh=浏览器零回归证明）+ verify_batch5_ingame.py 28。任一挂先修再继续。

- [ ] **Step 4: 提交**

```bash
git add scripts/verify_batch6_electron.py
git commit -m "test(e2e): batch6 electron roundtrip battery (mirror files / fresh-machine restore / clear channel / steam degrade) + gate run (batch6 T4)"
```

之后按总流程：final opus whole-branch review → 处理意见 → verification-before-completion → 用户令 merge → ff-merge main → push → CI 四门真跑绿 → 删分支 → 回填记忆。
