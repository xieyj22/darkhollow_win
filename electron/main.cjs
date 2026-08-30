// Electron main process — wraps the Vite build output (dist/index.html) in a desktop window.
// Run with `electron .` after `npm run build`.
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

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

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#0a0a14',
    title: 'Depths of Darkhollow',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // Fixed loadFile keeps localStorage on a stable origin so saves persist between launches.
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

// ===== Save-file IPC (mirrors localStorage under userData so saves survive app-storage
// clears and can be synced by Steam Cloud once wired). =====
ipcMain.handle('dh:save', (_e, data) => {
  try { fs.writeFileSync(savePath(), data, 'utf8'); return true; } catch { return false; }
});
ipcMain.handle('dh:load', () => {
  try { return fs.existsSync(savePath()) ? fs.readFileSync(savePath(), 'utf8') : null; } catch { return null; }
});
// 批6: one synchronous round-trip feeding BOTH mirrors into localStorage
// before the renderer's ES modules evaluate (state.ts reads at import time).
ipcMain.on('dh:loadSync', (e) => { e.returnValue = { save: readSnap(SAVE_FILE), profile: readSnap(PROFILE_FILE) }; });
ipcMain.handle('dh:saveProfile', (_e, data) => {
  try { fs.writeFileSync(path.join(app.getPath('userData'), PROFILE_FILE), data, 'utf8'); return true; } catch { return false; }
});
ipcMain.handle('dh:delete', (_e) => {
  try { const p = savePath(); if (fs.existsSync(p)) fs.unlinkSync(p); return true; } catch { return false; }
});
ipcMain.handle('dh:fullscreen', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) { win.setFullScreen(!win.isFullScreen()); return true; }
  return false;
});

// ===== Optional Steamworks integration =====
// Active only if steamworks.js is installed (`npm i steamworks.js`) AND
// steam_appid.txt is present. Otherwise achievements are local-only (no-op).
// Cloud saves already work via the userData file — Steam auto-syncs that directory
// once Cloud is enabled for the app, so no extra code is needed.
let steamworks = null;
try { steamworks = require('steamworks.js'); } catch { /* not installed */ }

ipcMain.handle('dh:unlock', (_e, id) => {
  try {
    if (steamworks) {
      // NOTE: steamworks.js API varies by version — adjust if yours differs.
      steamworks.achievement.activate(id);
    }
  } catch { /* Steam client not running / no AppID */ }
  return true;
});

app.whenReady().then(() => {
  if (steamworks) {
    try {
      // steamworks.js init() returns false when Steam isn't running / no AppID.
      if (!steamworks.init()) { console.warn('[steam] init failed (Steam not running / no steam_appid.txt) — achievements local-only'); steamworks = null; }
    } catch (e) { console.warn('[steam] init threw:', e && e.message, '— achievements local-only'); steamworks = null; }
  }
  Menu.setApplicationMenu(null); // hide default menu bar; the game has its own UI
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
