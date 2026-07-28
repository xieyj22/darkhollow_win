// Steam achievement bridge — renderer side.
// Forwards unlock events to the Electron main process via the preload bridge
// (window.dh). Under a plain browser, or before steamworks.js is installed,
// unlockAchievement is a silent no-op. When you install steamworks.js + drop in
// steam_appid.txt, achievements flow to Steam automatically with no code changes.
//
// Cloud saves already work: save.ts writes to Electron's userData directory, which
// Steam Cloud auto-syncs once enabled for the app — no code needed.
export function unlockAchievement(id: string): void {
  const dh = (window as any).dh;
  if (dh?.unlockAchievement) { try { dh.unlockAchievement(id); } catch { /* ignore */ } }
}
