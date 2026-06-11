// Stateless session tokens, HMAC-signed so they can't be forged.
//
// Token = base64url(payload).base64url(hmacSHA256(payload, secret))
// payload = { id, exp }  (exp = unix seconds)
//
// Set AUTH_SECRET in production. A dev fallback is used locally with a warning.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { authenticate, getEditorById, getResearcherById } from './store.js';

const TTL_SECONDS = 60 * 60 * 12; // 12 hours

const SECRET =
  process.env.AUTH_SECRET ||
  (() => {
    console.warn('[auth] AUTH_SECRET not set — using an insecure dev secret. Set it in production.');
    return 'dev-insecure-secret-change-me';
  })();

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function sign(payloadB64) {
  return createHmac('sha256', SECRET).update(payloadB64).digest('base64url');
}

export function issueToken(user) {
  const payload = { id: user.id, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS };
  const payloadB64 = b64url(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64)}`;
}

// Short-lived, purpose-scoped tokens (email verification, password reset).
// Stateless (HMAC-signed) so no storage is needed.
export function issuePurposeToken(userId, purpose, ttlSeconds = 60 * 60) {
  const payload = { id: userId, p: purpose, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const b = b64url(JSON.stringify(payload));
  return `${b}.${sign(b)}`;
}

export function verifyPurposeToken(token, purpose) {
  if (!token || !token.includes('.')) return null;
  const [b, sig] = token.split('.');
  const a = Buffer.from(sig || '');
  const c = Buffer.from(sign(b));
  if (a.length !== c.length || !timingSafeEqual(a, c)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(b, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (payload.p !== purpose || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload.id;
}

export function login(username, password) {
  const user = authenticate(username, password);
  if (!user) return null;
  return { token: issueToken(user), user };
}

export function userFromToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return null;

  // Constant-time signature check.
  const expected = sign(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload?.id || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;

  const user = getEditorById(payload.id) || getResearcherById(payload.id);
  if (!user) return null;
  const { password, twoFactorSecret, ...safe } = user;
  return safe;
}

// Express middleware: attaches req.user or 401s.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = userFromToken(token);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  req.user = user;
  next();
}
