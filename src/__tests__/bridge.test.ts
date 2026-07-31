import { describe, it, expect } from 'vitest';
import { bridge } from '../bridge.js';

describe('bridge registry', () => {
  it('defaults: muted false, data arrays empty, fns unset', () => {
    expect(bridge.muted).toBe(false);
    expect(bridge.classes).toEqual([]);
    expect(bridge.achDefs).toEqual([]);
    expect(bridge.talentTrees).toEqual([]);
    expect(bridge.render).toBeUndefined();
  });
  it('typed set/get round-trips for a fn and a value', () => {
    const fn = () => {};
    bridge.render = fn; expect(bridge.render).toBe(fn);
    bridge.muted = true; expect(bridge.muted).toBe(true);
    bridge.classes = [{ n:{en:'C',zh:'C'}, /*…ClassDef 必填…*/ } as any];
    expect(bridge.classes.length).toBe(1);
    // 清理(避免跨用例泄漏)
    bridge.render = undefined; bridge.muted = false; bridge.classes = [];
  });
  it('calling an unset fn via ?.() is a no-op (does not throw)', () => {
    expect(() => { bridge.render?.(); bridge.openPause?.(); }).not.toThrow();
  });
});
