// 程序化生成 build/icon.ico(256×256)。运行:node scripts/gen-icon.mjs
import { createCanvas } from '@napi-rs/canvas';
import pngToIco from 'png-to-ico';
import { writeFileSync, mkdirSync } from 'node:fs';

const S = 256;
const c = createCanvas(S, S);
const x = c.getContext('2d');

// 背景:深黑 + 淡紫径向
x.fillStyle = '#05050a'; x.fillRect(0, 0, S, S);
let bg = x.createRadialGradient(S / 2, S / 2, 8, S / 2, S / 2, S / 1.4);
bg.addColorStop(0, 'rgba(60,20,80,0.5)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
x.fillStyle = bg; x.fillRect(0, 0, S, S);

// 金色断环
x.strokeStyle = '#ffd700'; x.lineWidth = 10;
x.beginPath(); x.arc(S / 2, S / 2, 92, 0, Math.PI * 2); x.stroke();

// 中心深渊之眼:红径向
let eye = x.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, 60);
eye.addColorStop(0, '#ff5544'); eye.addColorStop(0.6, '#7a0a0a'); eye.addColorStop(1, '#1a0000');
x.fillStyle = eye; x.beginPath(); x.arc(S / 2, S / 2, 58, 0, Math.PI * 2); x.fill();

// 几粒金点
x.fillStyle = '#ffd700';
for (const [dx, dy, r] of [[-70, -70, 3], [80, -60, 2], [-60, 80, 2.5], [70, 70, 2]]) {
  x.beginPath(); x.arc(S / 2 + dx, S / 2 + dy, r, 0, Math.PI * 2); x.fill();
}

mkdirSync('build', { recursive: true });
const pngBuf = c.toBuffer('image/png');
const icoBuf = await pngToIco(pngBuf);
writeFileSync('build/icon.ico', icoBuf);
console.log('wrote build/icon.ico');
