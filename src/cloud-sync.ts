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

let syncTimer: ReturnType<typeof setTimeout> | null = null;
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
