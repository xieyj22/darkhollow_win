// 批9 ⑥: 售卖态生命周期 = 本次背包开启。✕ 关闭走 closeInventory 收口；
// 非商人入口重开背包必须重置 sellMode（此前鼠标流泄漏：数字键继续卖货）。
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../state.js', () => ({
  G: { gameOver: false, player: { inv: [], quickSlots: [] } },
  lang: 'en',
  setInvOpen: vi.fn(),
}));
vi.mock('../ui-panels.js', () => ({ showOverlay: vi.fn(), hideOverlay: vi.fn() }));
vi.mock('../items.js', () => ({
  sellItem: vi.fn(), equipItem: vi.fn(), useItem: vi.fn(), dropItem: vi.fn(),
  assignToQuickSlot: vi.fn(), itemToGold: () => 10, useQuickSlot: vi.fn(),
}));
vi.mock('../skills.js', () => ({ executeSkill: vi.fn() }));
vi.mock('../meta.js', () => ({ getMeta: () => ({}) }));
vi.mock('../i18n.js', () => ({
  t: (k: string) => k, tMsg: (k: string) => k, tx: (k: string) => k,
  RARITY_C: ['#888', '#8bc34a', '#4fc3f7', '#b39ddb', '#ffd700'],
}));
vi.mock('../data.js', () => ({ RELICS: [] }));
vi.mock('../sprites.js', () => ({ paintIcon: vi.fn(), paintItemIcon: vi.fn(), paintRelicIcon: vi.fn() }));
vi.mock('../bridge.js', () => ({ bridge: {} }));
vi.mock('../combat.js', () => ({ recalc: () => {}, checkLevelUp: () => {} }));
vi.mock('../messages.js', () => ({ addMsg: vi.fn() }));

import { readFileSync } from 'node:fs';
import { sellMode, openInventory, closeInventory } from '../panels.js';

describe('批9 ⑥ sellMode 生命周期', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="inv-content"></div>';
  });
  it('openInventory({sell:true}) 置售卖态', () => {
    openInventory({ sell: true });
    expect(sellMode).toBe(true);
  });
  it('普通 openInventory() 重置售卖态（bug 修复点）', () => {
    openInventory({ sell: true });
    openInventory();               // 键盘 b / 手柄重开路径
    expect(sellMode).toBe(false);  // 现状: true ← 红
  });
  it('closeInventory 清售卖态（回归）', () => {
    openInventory({ sell: true });
    closeInventory();
    expect(sellMode).toBe(false);
  });
  it('source-gate: main.ts ✕ 按钮走 closeInventory 收口', () => {
    // Dynamic '../' + f form on purpose — a string LITERAL first arg makes Vite
    // statically rewrite the URL to a dev-server http:// path (batch4 gotcha).
    const f = 'main.ts';
    const text = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    expect(text).toContain("on('btn-close-inv', () => { closeInventory(); })");
    expect(text).not.toContain("on('btn-close-inv', () => { setInvOpen(false); hideOverlay('inventory-overlay'); })");
  });
});
