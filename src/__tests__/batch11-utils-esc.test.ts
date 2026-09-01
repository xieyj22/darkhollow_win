// 批11 C: lock the two distinct escaper semantics now living in utils.ts —
// escAttr (attribute context: & < > ") vs escHtml (text-node context: & < > only).
// The difference is the reason both names exist; merging them is a regression.
import { describe, it, expect } from 'vitest';
import { escAttr, escHtml } from '../utils.js';

describe('批11 C escAttr (attribute context)', () => {
  it('attribute-injection payload loses every raw <, > and double quote', () => {
    const evil = '<img onerror=x "\'> ';
    const out = escAttr(evil);
    // Single quote stays raw — harmless inside the double-quoted title="…"/aria-label="…" values this serves.
    expect(out).toBe('&lt;img onerror=x &quot;\'&gt; ');
    expect(out).not.toMatch(/[<>"]/);
  });
});

describe('批11 C escHtml (text context)', () => {
  it('escapes & < > and deliberately leaves quotes alone', () => {
    expect(escHtml('<b>&</b>')).toBe('&lt;b&gt;&amp;&lt;/b&gt;');
    expect(escHtml('"<>"')).toBe('"&lt;&gt;"');
  });
});
