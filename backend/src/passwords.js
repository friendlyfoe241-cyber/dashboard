// Password hashing using Node's built-in scrypt (no external deps).
// Stored format: "scrypt:<saltHex>:<hashHex>". verify() also accepts a legacy
// plaintext value (timing-safe) so rows hand-entered into the Sheet still work.

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const PREFIX = 'scrypt';

export function hashPassword(plain) {
  const salt = randomBytes(16);
  const derived = scryptSync(String(plain), salt, 32);
  return `${PREFIX}:${salt.toString('hex')}:${derived.toString('hex')}`;
}

export function verifyPassword(plain, stored) {
  if (!stored) return false;

  if (stored.startsWith(`${PREFIX}:`)) {
    const [, saltHex, hashHex] = stored.split(':');
    if (!saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(String(plain), Buffer.from(saltHex, 'hex'), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  // Legacy plaintext fallback (still constant-time).
  const a = Buffer.from(String(plain));
  const b = Buffer.from(String(stored));
  return a.length === b.length && timingSafeEqual(a, b);
}

export const isHashed = (v) => typeof v === 'string' && v.startsWith(`${PREFIX}:`);
