import { describe, it, expect } from 'vitest';
import { endingForChoice, canRefuse } from '../endings.js';

describe('endingForChoice', () => {
  it('refuse → guardian regardless of corruption', () => {
    expect(endingForChoice('refuse', 0)).toBe('guardian');
    expect(endingForChoice('refuse', 99)).toBe('guardian');
  });
  it('slay splits at corruption 50', () => {
    expect(endingForChoice('slay', 0)).toBe('pyrrhic');
    expect(endingForChoice('slay', 49)).toBe('pyrrhic');
    expect(endingForChoice('slay', 50)).toBe('doombringer');
    expect(endingForChoice('slay', 99)).toBe('doombringer');
  });
});

describe('canRefuse', () => {
  it('true below 50, false at/above', () => {
    expect(canRefuse(0)).toBe(true);
    expect(canRefuse(49)).toBe(true);
    expect(canRefuse(50)).toBe(false);
    expect(canRefuse(99)).toBe(false);
  });
});
