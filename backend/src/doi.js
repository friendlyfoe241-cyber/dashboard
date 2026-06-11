// DOI registration hook. Synthica mints an internal DOI on publish; if Crossref
// credentials are configured, we also (fire-and-forget) deposit the metadata so
// the DOI resolves publicly. Without credentials this is a no-op (internal DOI
// still works for the site/RSS).
//
// Env: CROSSREF_DEPOSIT_URL, CROSSREF_USER, CROSSREF_PASS (and a real registered
// DOI prefix). Crossref deposits are XML; this posts a minimal record. Treat as
// a starting point for a real integration.

const URL = process.env.CROSSREF_DEPOSIT_URL || '';
const USER = process.env.CROSSREF_USER || '';
const PASS = process.env.CROSSREF_PASS || '';

export const doiRegistrationEnabled = () => !!(URL && USER && PASS);

export function registerDoi(pub) {
  if (!doiRegistrationEnabled()) return; // internal DOI only
  const params = new URLSearchParams({ operation: 'doMDUpload', login_id: USER, login_passwd: PASS });
  // A full integration builds Crossref deposit XML; we send title/doi/url as a stub.
  const body = `<doi_batch><doi>${pub.doi}</doi><title>${pub.title}</title><resource>https://doi.org/${pub.doi}</resource></doi_batch>`;
  fetch(`${URL}?${params}`, { method: 'POST', headers: { 'Content-Type': 'application/xml' }, body })
    .catch((e) => console.error('[doi] deposit failed:', e.message));
}
