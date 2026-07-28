// Electron main process — wraps the Vite build output (dist/index.html) in a desktop window.
// Run with `electron .` after `npm run build`.
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const SAVE_FILE = 'darkhollow-save.json';

function savePath() {
  return path.join(app.getPath('userData'), SAVE_FILE);
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
  try { if (steamworks) steamworks.init(); } catch { /* Steam not running / no AppID */ }
  Menu.setApplicationMenu(null); // hide default menu bar; the game has its own UI
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
