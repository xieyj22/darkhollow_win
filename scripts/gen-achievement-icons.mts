// 生成 29 张 Steam 成就图标 64×64 PNG → build/achievements/{id}.png + _sheet.png 预览拼图。
// 复用游戏内 sprites.ts 的 T_* 模板与 iconPalette，保证与成就面板视觉一致（THEME_PAL 固定色系优先，hue 走 buildPalette）。
// 运行:npx vite-node scripts/gen-achievement-icons.mts
// 坑:sprites.ts → state.js 模块级读 localStorage → 须先塞 stub 再动态 import。
const S = 64;          // Steam 成就图标边长
const SPRITE_SCALE = 3; // 16×16 → 48×48，居中留 8px 边
const BG = '#0a0a12';

import { mkdirSync, writeFileSync } from 'node:fs';

// @ts-ignore -- stubs before sprites.ts pulls state.js → cloud-sync.js (module-level
// localStorage reads + window.addEventListener)
const g: any = globalThis;
g.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
g.addEventListener = g.addEventListener ?? (() => {});
g.window = g;
g.document = { documentElement: { lang: 'en' } };

const { createCanvas } = await import('@napi-rs/canvas');
const { TEMPLATES, iconPalette, THEME_PAL } = await import('../src/sprites.js');
const { ACH_DEFS } = await import('../src/data.js');

function renderIcon(tplKey: string, hue?: string) {
  const raw = TEMPLATES[tplKey];
  if (!raw) throw new Error(`unknown template: ${tplKey}`);
  const pal: Record<string, string> = { ...iconPalette(tplKey, hue ?? '#cccccc') };
  // 无 'M' 的模板（如 T_SKULL 只有 K/W 常量）hue 不生效 → 把出现最多的非 K 主体字母注入 hue，
  // 否则 kill_10/kill_50/end_doom 会渲染成三张一样的图标。
  if (hue && !(THEME_PAL[tplKey]) && !raw.some(r => r.includes('M'))) {
    const freq: Record<string, number> = {};
    for (const ch of raw.join('')) if (ch !== '.' && ch !== 'K') freq[ch] = (freq[ch] ?? 0) + 1;
    const body = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (body) pal[body] = hue;
  }
  // 裁掉全 '.' 边行边列后居中（模板纵向偏上是批3C 已知问题，独立图标里更扎眼）
  let top = raw.length, bot = -1, left = 16, right = -1;
  raw.forEach((row, r) => {
    for (let ci = 0; ci < row.length; ci++) {
      if (row[ci] !== '.') { top = Math.min(top, r); bot = Math.max(bot, r); left = Math.min(left, ci); right = Math.max(right, ci); }
    }
  });
  const h = bot - top + 1, w = right - left + 1;
  const c = createCanvas(S, S);
  const x = c.getContext('2d');
  x.fillStyle = BG; x.fillRect(0, 0, S, S);
  // 淡紫径向底光，呼应 app icon（gen-icon.mjs）
  const g = x.createRadialGradient(S / 2, S / 2, 6, S / 2, S / 2, S / 1.4);
  g.addColorStop(0, 'rgba(60,20,80,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const ox = Math.round((S - w * SPRITE_SCALE) / 2), oy = Math.round((S - h * SPRITE_SCALE) / 2);
  const skipped = new Set<string>();
  for (let ry = top; ry <= bot; ry++) {
    const row = raw[ry];
    for (let rx = left; rx <= right; rx++) {
      const ch = row[rx];
      if (ch === '.') continue;
      const col = pal[ch];
      if (!col) { skipped.add(`${tplKey}:${ch}`); continue; }
      x.fillStyle = col;
      x.fillRect(ox + (rx - left) * SPRITE_SCALE, oy + (ry - top) * SPRITE_SCALE, SPRITE_SCALE, SPRITE_SCALE);
    }
  }
  if (skipped.size) console.warn('skipped unmapped letters:', [...skipped].join(', '));
  return c;
}

mkdirSync('build/achievements', { recursive: true });
for (const a of ACH_DEFS) {
  writeFileSync(`build/achievements/${a.id}.png`, renderIcon(a.tpl!, a.hue).toBuffer('image/png'));
}
console.log(`wrote ${ACH_DEFS.length} icons → build/achievements/`);

// 预览拼图:6 列 × N 行，带 id 标签
const COLS = 6, CELL = S + 8, LABEL = 14;
const rows = Math.ceil(ACH_DEFS.length / COLS);
const sheet = createCanvas(COLS * CELL, rows * (CELL + LABEL));
const sx = sheet.getContext('2d');
sx.fillStyle = '#20202a'; sx.fillRect(0, 0, sheet.width, sheet.height);
sx.font = '10px sans-serif'; sx.fillStyle = '#9a9aa8';
ACH_DEFS.forEach((a, i) => {
  const cx = (i % COLS) * CELL + 4, cy = Math.floor(i / COLS) * (CELL + LABEL);
  sx.drawImage(renderIcon(a.tpl!, a.hue), cx, cy);
  sx.fillText(a.id, cx, cy + S + 11);
});
writeFileSync('build/achievements/_sheet.png', sheet.toBuffer('image/png'));
console.log('wrote build/achievements/_sheet.png');
