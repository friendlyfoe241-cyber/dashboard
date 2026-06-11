/* Journal data layer for the static site.
 *
 * Tries the live Track 2 backend (http://localhost:4000/api/journal/publications)
 * first; if it isn't running, falls back to the embedded sample set below. Both
 * share the same shape as backend/src/seed.js so the page renders identically
 * either way. Point API_BASE at your deployed backend in production. */

// Where the Track 2 backend lives. Defaults to localhost for local testing.
// To point a deployed static site at a deployed backend, set it before this
// script loads, e.g. in the page <head>:
//   <script>window.SYNTHICA_API_BASE = 'https://synthica-backend.onrender.com';</script>
const API_BASE = (window.SYNTHICA_API_BASE || 'http://localhost:4000').replace(/\/$/, '');

// Embedded fallback — mirrors the backend publication shape (Nature-style metadata).
const SAMPLE_PUBLICATIONS = [
  {
    id: 'pub_0001',
    doi: '10.55555/synthica.2025.0001',
    title: 'Quantifying Microplastic Uptake in Freshwater Daphnia',
    articleType: 'Article',
    authors: [{ name: 'Hana Lee', affiliation: 'Synthica Research Group' }],
    correspondingAuthor: 'Hana Lee',
    category: 'Biology',
    abstract:
      'A controlled exposure study measuring microplastic accumulation in Daphnia magna over a 14-day window, with implications for freshwater food-web transfer.',
    keywords: ['microplastics', 'Daphnia magna', 'freshwater ecology'],
    receivedAt: '2024-11-02',
    acceptedAt: '2025-02-18',
    publishedAt: '2025-03-15',
    volume: 1,
    issue: 1,
    pages: '1–14',
    pdfUrl: '#',
    license: 'CC BY 4.0',
    openAccess: true,
    sections: [
      { heading: 'Introduction', body: 'Microplastic pollution in freshwater systems is rising, yet uptake at the base of the food web is under-characterized.' },
      { heading: 'Methods', body: 'Daphnia magna were exposed to fluorescent polystyrene beads; accumulation was quantified by fluorescence microscopy over 14 days.' },
      { heading: 'Results', body: 'Uptake scaled with concentration and plateaued by day 9, with measurable gut retention after depuration.' },
      { heading: 'Discussion', body: 'Findings suggest Daphnia are an efficient vector for microplastic transfer to higher trophic levels.' },
    ],
    metrics: { accesses: 3120, citations: 4, altmetric: 18 },
  },
  {
    id: 'pub_0002',
    doi: '10.55555/synthica.2025.0002',
    title: 'Benchmarking Small Language Models for Math Word Problems',
    articleType: 'Analysis',
    authors: [
      { name: 'Ravi Shah', affiliation: 'Synthica Research Group' },
      { name: 'Mei Tan', affiliation: 'Synthica Research Group' },
    ],
    correspondingAuthor: 'Ravi Shah',
    category: 'Computer Science',
    abstract:
      'We evaluate sub-3B-parameter language models on GSM8K-style problems and analyze the failure modes that distinguish them from larger systems.',
    keywords: ['language models', 'mathematical reasoning', 'benchmarking'],
    receivedAt: '2024-10-20',
    acceptedAt: '2025-01-30',
    publishedAt: '2025-03-15',
    volume: 1,
    issue: 1,
    pages: '15–29',
    pdfUrl: '#',
    license: 'CC BY 4.0',
    openAccess: true,
    sections: [
      { heading: 'Introduction', body: 'Small models are attractive for on-device use but their arithmetic reasoning is uneven.' },
      { heading: 'Methods', body: 'Five open models were evaluated zero-shot and with chain-of-thought prompting on a 1k-problem set.' },
      { heading: 'Results', body: 'Chain-of-thought closed roughly half the gap to larger models; most errors were arithmetic slips, not setup errors.' },
      { heading: 'Discussion', body: 'Targeted arithmetic fine-tuning is a promising, cheap intervention.' },
    ],
    metrics: { accesses: 5400, citations: 6, altmetric: 27 },
  },
  {
    id: 'pub_0003',
    doi: '10.55555/synthica.2025.0003',
    title: 'A Tabletop Bound on Dark-Photon Coupling in the Sub-eV Regime',
    articleType: 'Letter',
    authors: [{ name: 'Caleb Ortiz', affiliation: 'Synthica Research Group' }],
    correspondingAuthor: 'Caleb Ortiz',
    category: 'Physics',
    abstract:
      'Using a student-built Michelson interferometer, we place a competitive upper bound on dark-photon coupling at sub-eV masses.',
    keywords: ['dark photon', 'interferometry', 'beyond standard model'],
    receivedAt: '2024-12-05',
    acceptedAt: '2025-03-01',
    publishedAt: '2025-04-10',
    volume: 1,
    issue: 2,
    pages: '30–37',
    pdfUrl: '#',
    license: 'CC BY 4.0',
    openAccess: true,
    sections: [
      { heading: 'Introduction', body: 'Dark photons are a well-motivated portal to hidden sectors.' },
      { heading: 'Methods', body: 'A modified Michelson interferometer searched for length oscillations consistent with dark-photon coupling.' },
      { heading: 'Results', body: 'No signal was observed; we report a 95% confidence upper bound.' },
      { heading: 'Discussion', body: 'The result is competitive with early lab-scale searches and is achievable on a student budget.' },
    ],
    metrics: { accesses: 1980, citations: 2, altmetric: 11 },
  },
];

const qs = (k) => new URLSearchParams(location.search).get(k);

async function loadPublications() {
  try {
    const res = await fetch(`${API_BASE}/api/journal/publications`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) return data;
    }
  } catch {
    /* backend not running — fall back */
  }
  return SAMPLE_PUBLICATIONS;
}

// Resolve a single article by its permalink DOI. Uses the by-id/doi endpoint so
// permalinks work even for self-archived papers not in the public list yet.
async function loadPublication(doi) {
  if (doi) {
    try {
      const res = await fetch(`${API_BASE}/api/journal/publications/${encodeURIComponent(doi)}`);
      if (res.ok) return await res.json();
    } catch {
      /* fall through to the cached list / samples */
    }
    const pubs = await loadPublications();
    return pubs.find((x) => x.doi === doi) || null;
  }
  return (await loadPublications())[0] || null;
}

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
const authorLine = (authors) => authors.map((a) => a.name).join(', ');

// Escape arbitrary user-supplied strings before injecting into HTML. Profile
// data comes straight from the API/users, so guard against markup injection.
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

// Build initials (max two) from a display name for the fallback avatar.
const initialsOf = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('') || '?';

// Resolve a previewable embed URL for a paper's pdfUrl, or null if it isn't a
// real, embeddable document (e.g. the "#" placeholder in the sample data).
// - Google Drive file links (.../file/d/<id>/...) -> the /preview viewer.
// - Direct .pdf URLs            -> embedded as-is.
function pdfEmbedSrc(url) {
  if (typeof url !== 'string' || !url || url === '#') return null;
  const drive = url.match(/\/file\/d\/([^/]+)\//);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
  if (/\.pdf($|[?#])/i.test(url)) return url;
  return null;
}

// ---- Archive listing render ----------------------------------------------
const PER_PAGE = 6;

async function renderArchive() {
  const root = document.getElementById('archive-list');
  if (!root) return;
  const pubs = await loadPublications();

  const chips = document.getElementById('archive-filters');
  const searchEl = document.getElementById('archive-search');
  const sortEl = document.getElementById('archive-sort');
  const countEl = document.getElementById('archive-count');
  const pagerEl = document.getElementById('archive-pager');
  const rssEl = document.getElementById('archive-rss');
  if (rssEl) rssEl.href = `${API_BASE}/api/journal/rss`;

  const cats = ['All', ...new Set(pubs.map((p) => p.category))];
  let active = 'All';
  let page = 1;

  const sorters = {
    newest: (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt),
    oldest: (a, b) => new Date(a.publishedAt) - new Date(b.publishedAt),
    title: (a, b) => a.title.localeCompare(b.title),
    accessed: (a, b) => (b.metrics?.accesses || 0) - (a.metrics?.accesses || 0),
  };

  const draw = () => {
    const q = (searchEl?.value || '').trim().toLowerCase();
    let shown = pubs.filter((p) => active === 'All' || p.category === active);
    if (q) shown = shown.filter((p) => p.title.toLowerCase().includes(q) || p.authors.some((a) => a.name.toLowerCase().includes(q)));
    shown = shown.slice().sort(sorters[sortEl?.value || 'newest'] || sorters.newest);

    const total = shown.length;
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    if (page > pages) page = pages;
    const slice = shown.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    if (countEl) countEl.textContent = `${total} article${total === 1 ? '' : 's'}`;

    root.innerHTML = total === 0
      ? '<p class="muted" style="padding:1.5rem 0;">No articles match your search.</p>'
      : slice
          .map(
            (p) => `
        <article class="article-item">
          <div class="article-item-type">${esc(p.articleType)}${p.openAccess ? ' · <span class="oa-badge">Open Access</span>' : ''}</div>
          <h3 class="article-item-title"><a href="article.html?doi=${encodeURIComponent(p.doi)}">${esc(p.title)}</a></h3>
          <p class="article-item-authors">${esc(authorLine(p.authors))}</p>
          <p class="article-item-abstract">${esc(p.abstract)}</p>
          <div class="article-item-meta">
            <span class="badge-cat">${esc(p.category)}</span>
            <span>${fmtDate(p.publishedAt)}</span>
            <span>Vol ${esc(p.volume)}, Issue ${esc(p.issue)}</span>
            <span class="article-item-doi">${esc(p.doi)}</span>
          </div>
        </article>`
          )
          .join('');

    if (pagerEl) {
      pagerEl.innerHTML = pages <= 1
        ? ''
        : `<button class="btn btn-ghost" id="pg-prev" ${page === 1 ? 'disabled' : ''}>← Prev</button>
           <span class="muted">Page ${page} of ${pages}</span>
           <button class="btn btn-ghost" id="pg-next" ${page === pages ? 'disabled' : ''}>Next →</button>`;
      const prev = document.getElementById('pg-prev');
      const next = document.getElementById('pg-next');
      if (prev) prev.onclick = () => { page--; draw(); };
      if (next) next.onclick = () => { page++; draw(); };
    }
  };

  if (chips) {
    chips.innerHTML = cats
      .map((c) => `<button class="chip${c === active ? ' chip-active' : ''}" data-cat="${c}">${c}</button>`)
      .join('');
    chips.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      active = btn.dataset.cat;
      page = 1;
      chips.querySelectorAll('.chip').forEach((b) => b.classList.toggle('chip-active', b.dataset.cat === active));
      draw();
    });
  }
  let t;
  if (searchEl) searchEl.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { page = 1; draw(); }, 150); });
  if (sortEl) sortEl.addEventListener('change', () => { page = 1; draw(); });
  draw();
}

// ---- Single article render ------------------------------------------------
async function renderArticle() {
  const root = document.getElementById('article-root');
  if (!root) return;
  const doi = qs('doi');
  const p = await loadPublication(doi);
  if (!p) {
    root.innerHTML = '<p>Article not found. <a href="journal-archive.html">Back to the archive</a>.</p>';
    return;
  }
  document.title = `${p.title} — Synthica Journal`;

  const embedSrc = pdfEmbedSrc(p.pdfUrl);
  const embedBlock = embedSrc
    ? `<section class="article-embed-wrap">
          <iframe class="article-embed" src="${embedSrc}" title="PDF preview: ${esc(p.title)}" loading="lazy"></iframe>
        </section>`
    : '';

  root.innerHTML = `
    <nav class="breadcrumb"><a href="journal.html">Synthica Journal</a> › <a href="journal-archive.html">Articles</a> › <span>${esc(p.articleType)}</span></nav>
    <div class="article-grid">
      <article class="article-main">
        <div class="article-type-label">${esc(p.articleType)}${p.openAccess ? ' · <span class="oa-badge">Open Access</span>' : ''} · Published ${fmtDate(p.publishedAt)}</div>
        ${p.verified === false ? '<div class="article-type-label" style="color:#8a6d00">Preprint · awaiting verification</div>' : ''}
        <h1 class="article-title">${esc(p.title)}</h1>
        <p class="article-authors">${p.authors
          .map((a) => {
            // Link each author to their own profile when known; fall back to the
            // primary author link for single-author legacy records.
            const uid = a.userId || (p.authors.length === 1 ? p.authorUserId : null);
            return uid
              ? `<a href="profile.html?id=${encodeURIComponent(uid)}">${esc(a.name)}</a>`
              : `<span>${esc(a.name)}</span>`;
          })
          .join(', ')}</p>
        <p class="article-affil">${esc([...new Set(p.authors.map((a) => a.affiliation))].join('; '))}</p>

        <section class="article-abstract">
          <h2>Abstract</h2>
          <p>${esc(p.abstract)}</p>
        </section>

        ${embedBlock}

        ${(p.sections || [])
          .map((s) => `<section class="article-section"><h2>${esc(s.heading)}</h2><p>${esc(s.body)}</p></section>`)
          .join('')}

        ${
          p.keywords?.length
            ? `<div class="article-keywords"><strong>Keywords:</strong> ${esc(p.keywords.join(', '))}</div>`
            : ''
        }
      </article>

      <aside class="article-side">
        <a class="btn btn-primary article-pdf" href="${esc(p.pdfUrl)}" target="_blank" rel="noopener">Download PDF</a>
        <div class="side-card">
          <h3>Article info</h3>
          <dl class="meta-dl">
            <dt>DOI</dt><dd><a href="https://doi.org/${encodeURIComponent(p.doi)}" target="_blank" rel="noopener">${esc(p.doi)}</a></dd>
            <dt>Type</dt><dd>${esc(p.articleType)}</dd>
            <dt>Subject</dt><dd>${esc(p.category)}</dd>
            <dt>Received</dt><dd>${fmtDate(p.receivedAt)}</dd>
            <dt>Accepted</dt><dd>${fmtDate(p.acceptedAt)}</dd>
            <dt>Published</dt><dd>${fmtDate(p.publishedAt)}</dd>
            <dt>Volume</dt><dd>${esc(p.volume)}, Issue ${esc(p.issue)}, pp. ${esc(p.pages)}</dd>
            <dt>Corresponding</dt><dd>${esc(p.correspondingAuthor)}</dd>
            <dt>License</dt><dd>${esc(p.license)}</dd>
          </dl>
        </div>
        <div class="side-card">
          <h3>Metrics</h3>
          <div class="metric-row"><span>${(p.metrics?.accesses ?? 0).toLocaleString()}</span> Accesses</div>
          <div class="metric-row"><span>${p.metrics?.citations ?? 0}</span> Citations</div>
          <div class="metric-row"><span>${p.metrics?.altmetric ?? 0}</span> Altmetric</div>
        </div>
        <div class="side-card">
          <h3>Cite this article</h3>
          <p class="cite-text">${esc(authorLine(p.authors))} (${new Date(p.publishedAt).getFullYear()}). ${esc(p.title)}. <em>Synthica Journal</em>, ${esc(p.volume)}(${esc(p.issue)}), ${esc(p.pages)}. https://doi.org/${esc(p.doi)}</p>
        </div>
      </aside>
    </div>`;
}

// ---- Public profile render ------------------------------------------------
async function renderProfile() {
  const root = document.getElementById('profile-root');
  if (!root) return;

  // Stable link: accept either ?id=<userId> or ?u=<slug>. The backend resolves
  // whichever value we pass at /api/profiles/<value>, so these links never change.
  const ref = qs('id') || qs('u');
  const notFound = (msg) => {
    root.innerHTML = `
      <div class="profile-empty">
        <h1>Profile not found</h1>
        <p class="muted">${esc(msg || "We couldn't find the profile you were looking for.")}</p>
        <a class="btn btn-ghost" href="journal-archive.html">Browse articles</a>
      </div>`;
  };

  if (!ref) {
    notFound('No profile was specified.');
    return;
  }

  let profile;
  try {
    const res = await fetch(`${API_BASE}/api/profiles/${encodeURIComponent(ref)}`);
    if (!res.ok) {
      notFound();
      return;
    }
    profile = await res.json();
  } catch {
    notFound('This profile is unavailable right now.');
    return;
  }

  if (!profile || typeof profile !== 'object' || !profile.name) {
    notFound();
    return;
  }

  document.title = `${profile.name} — Synthica`;

  // Role + institution line, e.g. "Lead Researcher · MIT".
  const isEditor = profile.kind === 'editor';
  const roleBits = [];
  if (profile.role) roleBits.push(esc(profile.role));
  if (isEditor && profile.category) roleBits.push(esc(profile.category));
  if (profile.institution) roleBits.push(esc(profile.institution));
  const roleLine = roleBits.join(' · ');

  const avatar = profile.avatarUrl
    ? `<img class="profile-avatar profile-avatar-img" src="${esc(profile.avatarUrl)}" alt="${esc(profile.name)}" />`
    : `<div class="profile-avatar" aria-hidden="true">${esc(initialsOf(profile.name))}</div>`;

  // Action buttons: LinkedIn, Website, then any custom links[] — all ghost
  // buttons that open in a new tab.
  const actions = [];
  if (profile.linkedinUrl) actions.push({ label: 'LinkedIn', url: profile.linkedinUrl });
  if (profile.websiteUrl) actions.push({ label: 'Website', url: profile.websiteUrl });
  if (Array.isArray(profile.links)) {
    for (const l of profile.links) {
      if (l && l.url) actions.push({ label: l.label || l.url, url: l.url });
    }
  }
  const linksBlock = actions.length
    ? `<div class="profile-links">${actions
        .map(
          (l) =>
            `<a class="btn btn-ghost" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(
              l.label
            )}</a>`
        )
        .join('')}</div>`
    : '';

  // Interests rendered as tag chips.
  const interests = Array.isArray(profile.interests) ? profile.interests.filter(Boolean) : [];
  const interestsBlock = interests.length
    ? `<section class="profile-section">
        <h2 class="profile-section-title">Interests</h2>
        <div class="profile-tags">${interests
          .map((t) => `<span class="tag">${esc(t)}</span>`)
          .join('')}</div>
      </section>`
    : '';

  // Current projects (internal — no links, just title + category badge).
  const projects = Array.isArray(profile.currentProjects)
    ? profile.currentProjects.filter((p) => p && p.title)
    : [];
  const projectsBlock = projects.length
    ? `<section class="profile-section">
        <h2 class="profile-section-title">Current projects</h2>
        <div class="archive-list">${projects
          .map(
            (proj) => `
          <article class="article-item">
            <h3 class="article-item-title">${esc(proj.title)}</h3>
            ${proj.category ? `<div class="article-item-meta"><span class="badge-cat">${esc(proj.category)}</span></div>` : ''}
          </article>`
          )
          .join('')}</div>
      </section>`
    : '';

  const pubs = Array.isArray(profile.publications) ? profile.publications : [];
  const pubsBlock = pubs.length
    ? `<section class="profile-section">
        <h2 class="profile-section-title">Published research <span class="profile-count">${pubs.length}</span></h2>
        <div class="archive-list">${pubs
          .map(
            (pub) => `
          <article class="article-item">
            <h3 class="article-item-title"><a href="article.html?doi=${encodeURIComponent(
              pub.doi || ''
            )}">${esc(pub.title)}</a></h3>
            <div class="article-item-meta">
              ${pub.category ? `<span class="badge-cat">${esc(pub.category)}</span>` : ''}
              ${pub.articleType ? `<span>${esc(pub.articleType)}</span>` : ''}
              ${pub.publishedAt ? `<span>${esc(fmtDate(pub.publishedAt))}</span>` : ''}
              ${pub.doi ? `<span class="article-item-doi">${esc(pub.doi)}</span>` : ''}
              ${pub.verified === false ? '<span class="badge-cat" style="background:#fff7e0;color:#8a6d00">awaiting verification</span>' : ''}
            </div>
          </article>`
          )
          .join('')}</div>
      </section>`
    : `<section class="profile-section">
        <h2 class="profile-section-title">Published research</h2>
        <p class="muted">No published research yet.</p>
      </section>`;

  root.innerHTML = `
    <div class="profile-header card">
      ${avatar}
      <div class="profile-id">
        <h1 class="profile-name">${esc(profile.name)}</h1>
        ${roleLine ? `<p class="profile-role">${roleLine}</p>` : ''}
        ${linksBlock}
      </div>
    </div>
    <div class="profile-body">
      ${interestsBlock}
      ${profile.bio ? `<section class="profile-section"><p class="profile-bio">${esc(profile.bio)}</p></section>` : ''}
      ${projectsBlock}
      ${pubsBlock}
    </div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  renderArchive();
  renderArticle();
  renderProfile();
});
