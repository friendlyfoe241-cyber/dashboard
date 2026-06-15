import { describe, it, expect } from 'vitest';
import { safeUrl, isSafeUrl } from '../src/url.js';

describe('safeUrl — XSS scheme guard', () => {
  it('passes through http/https/mailto', () => {
    expect(safeUrl('https://github.com/x')).toBe('https://github.com/x');
    expect(safeUrl('http://example.com')).toBe('http://example.com');
    expect(safeUrl('mailto:a@b.com')).toBe('mailto:a@b.com');
  });

  it('rejects dangerous schemes (case-insensitive)', () => {
    for (const bad of ['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,x', 'vbscript:msgbox', 'file:///etc/passwd']) {
      expect(safeUrl(bad)).toBe('');
      expect(isSafeUrl(bad)).toBe(false);
    }
  });

  it('upgrades a scheme-less host to https', () => {
    expect(safeUrl('github.com/sam')).toBe('https://github.com/sam');
  });

  it('trims, length-caps, and handles empties', () => {
    expect(safeUrl('  https://ok.com  ')).toBe('https://ok.com');
    expect(safeUrl('')).toBe('');
    expect(safeUrl(null)).toBe('');
    expect(safeUrl(undefined)).toBe('');
    expect(safeUrl('https://x.com/' + 'a'.repeat(999)).length).toBeLessThanOrEqual(300);
  });
});
