// Preload — exposes a minimal, safe bridge to the renderer under contextIsolation.
// window.dh is present only under Electron (not in `vite dev`), so save.ts / steam.ts
// can feature-detect and fall back to localStorage / no-op when running in a browser.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dh', {
  isElectron: true,
  saveFile: (data) => ipcRenderer.invoke('dh:save', data),
  loadFile: () => ipcRenderer.invoke('dh:load'),
  toggleFullscreen: () => ipcRenderer.invoke('dh:fullscreen'),
  unlockAchievement: (id) => ipcRenderer.invoke('dh:unlock', id),
});
