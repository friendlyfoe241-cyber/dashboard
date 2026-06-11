// Google Sign-In verification. The frontend uses Google Identity Services to get
// an ID token (a JWT), POSTs it here, and we verify it with Google's tokeninfo
// endpoint and check the audience matches our client id.
//
// Set GOOGLE_CLIENT_ID on the backend (and VITE_GOOGLE_CLIENT_ID on the
// dashboards build) to enable. Without it, Google login is simply disabled.

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

export const googleEnabled = () => !!CLIENT_ID;

export async function verifyGoogleIdToken(idToken) {
  if (!CLIENT_ID) throw httpError(501, 'Google login is not configured');
  if (!idToken) throw httpError(400, 'Missing Google credential');

  let payload;
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!res.ok) throw new Error('bad token');
    payload = await res.json();
  } catch {
    throw httpError(401, 'Could not verify Google sign-in');
  }

  // aud must match our client id; token must be issued by Google and unexpired.
  if (payload.aud !== CLIENT_ID) throw httpError(401, 'Google token audience mismatch');
  if (!/(^|\.)accounts\.google\.com$/.test(payload.iss) && payload.iss !== 'accounts.google.com')
    throw httpError(401, 'Untrusted token issuer');
  if (payload.exp && Number(payload.exp) * 1000 < Date.now()) throw httpError(401, 'Google token expired');
  if (payload.email_verified === 'false') throw httpError(401, 'Google email not verified');

  return { email: payload.email, name: payload.name || payload.email, googleId: payload.sub };
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
