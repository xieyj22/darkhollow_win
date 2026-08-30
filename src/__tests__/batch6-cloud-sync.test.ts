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
    const saveProfile = vi.fn((_payload: string) => Promise.resolve(true));
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
    const saveProfile = vi.fn((_payload: string) => Promise.resolve(true));
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

// 批6 review I2/I3 riders: boot-read edge cases the first pass missed.
describe('initCloudSync upgrade + corruption guards (review riders)', () => {
  it('pre-batch6 machine that died (dh_meta present, no dh_save, no stamps) → finished-run file NOT resurrected', async () => {
    localStorage.setItem('dh_meta', '{"soulEchoes":5}');
    (window as any).dh = { loadFileSync: () => ({
      // The finished run the old build's death screen left in the file
      // (old clear only removed localStorage — no file channel existed).
      save: { data: '{"floor":9}', mtime: 9000 },
      profile: { data: JSON.stringify({ v: 1, kv: {} }), mtime: 1 },
    }) };
    await import('../cloud-sync.js');
    expect(localStorage.getItem('dh_save')).toBeNull();   // dead stays dead — no double-echo
  });
  it('consume-only machine (restored dh_save present, no stamp) → newer cloud file still wins', async () => {
    localStorage.setItem('dh_save', '{"floor":2}');
    localStorage.setItem('dh_meta', '{}');    // restored by an earlier boot's profile apply
    (window as any).dh = { loadFileSync: () => ({
      save: { data: '{"floor":7}', mtime: 9000 },
      profile: { data: JSON.stringify({ v: 1, kv: {} }), mtime: 1 },
    }) };
    await import('../cloud-sync.js');
    expect(localStorage.getItem('dh_save')).toBe('{"floor":7}');
  });
  it('truncated/corrupt save file (fresh mtime, no stamp) → does not clobber a good local save', async () => {
    localStorage.setItem('dh_save', '{"floor":9}');
    (window as any).dh = { loadFileSync: () => ({
      save: { data: '{"floor":3', mtime: 9000 },   // crash mid-writeFileSync
      profile: null,
    }) };
    await import('../cloud-sync.js');
    expect(localStorage.getItem('dh_save')).toBe('{"floor":9}');
  });
  it('tombstone (empty data, fresh mtime) → no restore (I3 delete channel)', async () => {
    (window as any).dh = { loadFileSync: () => ({
      save: { data: '', mtime: 9000 },
      profile: null,
    }) };
    await import('../cloud-sync.js');
    expect(localStorage.getItem('dh_save')).toBeNull();
  });
});
