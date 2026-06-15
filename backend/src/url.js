// URL sanitization — the single guard against javascript:/data:/vbscript:
// scheme injection. User-supplied URLs (profile links, project links, avatars)
// are rendered as <a href> / <img src> on PUBLIC pages, so an unchecked
// "javascript:…" value is stored-XSS that can read the localStorage session
// token. Everything user-provided that becomes a link must pass through here.

const SAFE_SCHEMES = ['http:', 'https:', 'mailto:'];

// Returns a safe URL string, or '' if it can't be made safe. Scheme-less input
// (e.g. "github.com/x") is treated as https. Anything with a non-allowlisted
// scheme (javascript:, data:, …) is rejected outright.
export function safeUrl(value, max = 300) {
  let s = String(value == null ? '' : value).trim().slice(0, max);
  if (!s) return '';
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(s);
  const candidate = hasScheme ? s : `https://${s}`;
  try {
    const u = new URL(candidate);
    return SAFE_SCHEMES.includes(u.protocol) ? candidate : '';
  } catch {
    return '';
  }
}

export const isSafeUrl = (value) => safeUrl(value) !== '';
