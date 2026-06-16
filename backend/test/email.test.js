import { describe, it, expect } from 'vitest';
import { emailLayout, welcomeEmail, emailBox } from '../src/email.js';

describe('branded emails', () => {
  it('welcome email builds branded HTML + a plaintext fallback', () => {
    const w = welcomeEmail({ name: 'Ben V', verifyUrl: 'https://app.x/verify?token=abc' });
    expect(w.subject).toMatch(/Welcome/);
    expect(w.html).toContain('<!DOCTYPE html>');
    expect(w.html).toMatch(/Welcome to .*, Ben/);
    expect(w.html).toContain('https://app.x/verify?token=abc'); // CTA link present
    expect(w.text).toMatch(/Welcome/); // plaintext fallback
    expect(w.text).not.toMatch(/<[a-z]/i); // no HTML tags in the text part
  });

  it('layout escapes HTML in headings (no injection)', () => {
    const html = emailLayout({ heading: '<script>x</script>', intro: 'hi', blocks: [] });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('emailBox renders a titled callout', () => {
    expect(emailBox('To-dos', 'do this')).toMatch(/To-dos/);
  });
});
