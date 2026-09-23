// batch17 T7: rogue 必暴 1.75 / 圣光附带伤害 / mage hp 38
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('batch17 T7 class tuning', () => {
  it('death-mark crit mult 1.75 (both branches)', () => {
    const src = readFileSync('src/skills.ts', 'utf-8');
    const burst = src.slice(src.indexOf("case 'burst'"), src.indexOf("case 'aoe'"));
    // R1 裁决: /\* 2\b/ 会误匹配 `* 2.5`(2 与 . 之间是词边界), 锚定右括号
    expect(burst).not.toMatch(/\* 2\)/);
    expect(burst).toMatch(/1\.75/);
  });
  it('mage base hp 38', async () => {
    const { CLASSES } = await import('../data.js');
    expect(CLASSES[2].hp).toBe(38);
  });
  it('paladin skill desc mentions holy damage (both langs)', async () => {
    const { CLASSES } = await import('../data.js');
    const d = CLASSES[3].skill.desc;
    expect(d.zh).toContain('神圣伤害'); expect(d.en).toContain('holy dmg');
  });
  it('heal case deals holy damage to ≤4 range foes', () => {
    const src = readFileSync('src/skills.ts', 'utf-8');
    const heal = src.slice(src.indexOf("case 'heal'"), src.indexOf('case ', src.indexOf("case 'heal'") + 10));
    expect(heal).toMatch(/p\.atk \* 1\.2/);
    expect(heal).toMatch(/<= 4/);
  });
});
