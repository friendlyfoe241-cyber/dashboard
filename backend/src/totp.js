// TOTP (RFC 6238) two-factor auth — HMAC-SHA1, 30s step, 6 digits. No deps.

import { createHmac, randomBytes } from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32encode(buf) {
  let bits = 0, val = 0, out = '';
  for (const b of buf) {
    val = (val << 8) | b;
    bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}

function base32decode(s) {
  const clean = s.replace(/=+$/, '').toUpperCase();
  let bits = 0, val = 0;
  const out = [];
  for (const c of clean) {
    const idx = B32.indexOf(c);
    if (idx < 0) continue;
    val = (val << 5) | idx;
    bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

function hotp(secret, counter) {
  const key = base32decode(secret);
  const buf = Buffer.alloc(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) { buf[i] = c & 0xff; c = Math.floor(c / 256); }
  const h = createHmac('sha1', key).update(buf).digest();
  const off = h[h.length - 1] & 0xf;
  const bin = ((h[off] & 0x7f) << 24) | ((h[off + 1] & 0xff) << 16) | ((h[off + 2] & 0xff) << 8) | (h[off + 3] & 0xff);
  return String(bin % 1_000_000).padStart(6, '0');
}

export const generateSecret = () => base32encode(randomBytes(20));

// Accept the current step ± 1 to tolerate small clock drift.
export function verifyTotp(secret, token) {
  if (!secret || !token) return false;
  const step = Math.floor(Date.now() / 1000 / 30);
  const t = String(token).replace(/\s/g, '');
  for (let w = -1; w <= 1; w++) if (hotp(secret, step + w) === t) return true;
  return false;
}

// The code for the current time step (used in tests / server-side checks).
export const currentCode = (secret) => hotp(secret, Math.floor(Date.now() / 1000 / 30));

export const otpauthUrl = (secret, label) =>
  `otpauth://totp/Synthica:${encodeURIComponent(label)}?secret=${secret}&issuer=Synthica&period=30&digits=6`;
