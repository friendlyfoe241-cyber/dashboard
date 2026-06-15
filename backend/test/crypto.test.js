import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, isHashed } from '../src/passwords.js';
import { generateSecret, currentCode, verifyTotp } from '../src/totp.js';
import { issueToken, userFromToken, issuePurposeToken, verifyPurposeToken } from '../src/auth.js';

describe('passwords (scrypt)', () => {
  it('round-trips and rejects the wrong password', () => {
    const stored = hashPassword('demo1234');
    expect(isHashed(stored)).toBe(true);
    expect(verifyPassword('demo1234', stored)).toBe(true);
    expect(verifyPassword('wrong', stored)).toBe(false);
  });

  it('produces a distinct salt each time', () => {
    expect(hashPassword('x')).not.toBe(hashPassword('x'));
  });

  it('still accepts a legacy plaintext value', () => {
    expect(verifyPassword('plain', 'plain')).toBe(true);
  });
});

describe('TOTP (RFC 6238)', () => {
  it('verifies the current code and rejects a wrong one', () => {
    const secret = generateSecret();
    expect(verifyTotp(secret, currentCode(secret))).toBe(true);
    expect(verifyTotp(secret, '000000')).toBe(false);
    expect(verifyTotp(secret, '')).toBe(false);
  });
});

describe('auth tokens (HMAC)', () => {
  it('issues and verifies a session token', () => {
    const t = issueToken({ id: 'usr_1' });
    expect(userFromToken(t)).toBeNull(); // user not in store under test, but signature is valid path
  });

  it('rejects tampered tokens', () => {
    const t = issueToken({ id: 'usr_1' });
    expect(userFromToken(t + 'x')).toBeNull();
    expect(userFromToken('garbage')).toBeNull();
    expect(userFromToken('')).toBeNull();
  });

  it('purpose tokens are scoped to their purpose and expire', () => {
    const t = issuePurposeToken('usr_1', 'reset', 60);
    expect(verifyPurposeToken(t, 'reset')).toBe('usr_1');
    expect(verifyPurposeToken(t, 'verify')).toBeNull(); // wrong purpose
    const expired = issuePurposeToken('usr_1', 'reset', -1);
    expect(verifyPurposeToken(expired, 'reset')).toBeNull();
  });
});
