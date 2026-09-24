// 批18: 标题屏主次分级 + 退出按钮 + 地图跟随 UI 缩放 —— 静态源门（同批14/16模式）。
// 三条线各有回归风险：新 CSS 类被误删、zoom 公式退回 1:1、POST_CHANGE 漏挂。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const rd = (p: string) => readFileSync(join(here, '../' + p), 'utf8');
const css = rd('../style/main.css');
const html = rd('../index.html');
const mainTs = rd('main.ts');
const renderTs = rd('render.ts');
const effectsTs = rd('effects.ts');
const optionsTs = rd('options.ts');
const i18nTs = rd('i18n.ts');

function ruleBlock(selector: string): string {
  const i = css.indexOf(selector);
  expect(i, `selector ${selector} not found in main.css`).toBeGreaterThan(-1);
  const open = css.indexOf('{', i);
  const close = css.indexOf('}', open);
  return css.slice(open, close);
}

describe('批18: 标题屏层级 CSS', () => {
  it('primary 实心主按钮（继续/新游戏）', () => {
    const b = ruleBlock('.menu-btn.primary');
    expect(b).toContain('var(--accent-red)');
    expect(b).toContain('min-width:260px');
  });
  it('secondary 弱化描边 + small 双列小按钮', () => {
    expect(ruleBlock('.menu-btn.secondary')).toContain('var(--border-bright)');
    expect(ruleBlock('.menu-btn.small')).toContain('min-width:150px');
  });
  it('footer 文字链样式 + 字体栈沿用 zh-px→runes（与 menu-btn 一致）', () => {
    const b = ruleBlock('.title-link');
    expect(b).toContain('var(--font-zh-px)');
    expect(b.indexOf('--font-zh-px')).toBeLessThan(b.indexOf('--font-runes'));
    expect(ruleBlock('.title-footer')).toContain('display:flex');
  });
  it('布局容器：title-main 竖排 / title-row 双列', () => {
    expect(ruleBlock('.title-main')).toContain('flex-direction:column');
    expect(ruleBlock('.title-row')).toContain('display:flex');
  });
});

describe('批18: 标题屏 HTML 结构与退出按钮', () => {
  it('主区顺序：继续 → 新游戏 → 熔炉 → 记录|图鉴双列', () => {
    const order = ['btn-cont', 'btn-new', 'btn-forge', 'btn-records', 'btn-codex']
      .map(id => html.indexOf(`id="${id}"`));
    order.forEach(i => expect(i).toBeGreaterThan(-1));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toMatch(/class="menu-btn primary" id="btn-cont"/);
    expect(html).toMatch(/class="menu-btn small" id="btn-records"/);
  });
  it('footer 文字链含 说明/选项/退出，退出带分隔点（浏览器态随按钮一起移除）', () => {
    expect(html).toMatch(/class="title-link" id="btn-help"/);
    expect(html).toMatch(/class="title-link" id="btn-options-title"/);
    expect(html).toMatch(/class="title-link" id="btn-quit"/);
    expect(html).toContain('id="dot-quit"');
  });
  it('main.ts: window.close() 接线 + 非 Electron 移除退出与分隔点', () => {
    expect(mainTs).toContain(`on('btn-quit', () => window.close())`);
    expect(mainTs).toMatch(/electron\/i\.test\(navigator\.userAgent\)/);
    expect(mainTs).toContain(`getElementById('dot-quit')?.remove()`);
  });
  it('i18n: btnQuit 双语', () => {
    expect(i18nTs).toContain(`btnQuit: { en: 'Quit', zh: '退出' }`);
  });
});

describe('批18: 地图跟随 UI 缩放', () => {
  it('resizeCanvas 按 TS*uiZoom 算格数 + CSS 尺寸乘 uiZoom', () => {
    expect(renderTs).toContain('/ (TS * uiZoom)');
    expect(renderTs).toContain('cols * TS * uiZoom');
    expect(renderTs).toContain("c.style.width = (cols * TS * uiZoom) + 'px'");
  });
  it('flt / burstSmoke DOM 覆盖层按显示比例换算（不再假设 1:1）', () => {
    expect(effectsTs.match(/r\.width \/ canvas\.width/g)?.length).toBe(2);
    expect(effectsTs).toContain('sx * k');
  });
  it('options.ts: zoom 注册 POST_CHANGE 且 slider oninput 也派发', () => {
    expect(optionsTs).toContain('zoom: applyMapZoom');
    expect(optionsTs).toMatch(/applyMapZoom[\s\S]*?resizeCanvas\(\)/);
    // slider 分支此前只有 seg 分支派发 POST_CHANGE —— 批18 补齐
    const sliderBranch = optionsTs.slice(optionsTs.indexOf('sl.oninput'));
    expect(sliderBranch.slice(0, 400)).toContain('POST_CHANGE[d.key]?.()');
  });
});
