// One-shot (批7 T3): normalize half-width , ; : ? ! adjacent to CJK into full-width
// inside zh: '…' literals of i18n.ts / data.ts. en lines untouched.
// Run: node scripts/fix_zh_punct.mjs   (gate: src/__tests__/batch7-zh-punct.test.ts)
import { readFileSync, writeFileSync } from 'node:fs';

for (const f of ['src/i18n.ts', 'src/data.ts']) {
  const before = readFileSync(f, 'utf8');
  const after = before.split('\n').map(line => {
    if (!/zh:\s*['"`]/.test(line)) return line;
    return line
      .replace(/([一-鿿]),/g, '$1，')
      .replace(/([一-鿿]);/g, '$1；')
      .replace(/([一-鿿]):/g, '$1：')
      .replace(/([一-鿿])\?/g, '$1？')
      .replace(/([一-鿿])!/g, '$1！')
      .replace(/,(?=[一-鿿])/g, '，');
  }).join('\n');
  if (after !== before) { writeFileSync(f, after); console.log(f, 'rewritten'); }
  else console.log(f, 'no change');
}
console.log('done');
