import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { getDefaultHomePath } from '../views.js';
import { Card, Badge } from '../components/ui.jsx';
import { embedSrc } from '../files.js';
import { useReloadOnFocus } from '../useReload.js';
import Icon, { BrandMark } from '../components/Icon.jsx';

const CATS = ['Biology', 'Chemistry', 'Physics', 'Mathematics', 'Computer Science', 'Humanities', 'Economics', 'Psychology'];

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
const authorLine = (p) => (p.authors || []).map((a) => a.name).join(', ');

// Citation strings in the formats people actually paste.
function citations(p) {
  const year = new Date(p.publishedAt).getFullYear();
  const authors = p.authors || [];
  const apaNames = authors.map((a) => {
    const parts = a.name.trim().split(/\s+/);
    const last = parts.pop();
    return `${last}, ${parts.map((n) => n[0] + '.').join(' ')}`;
  }).join(', ');
  const vol = p.volume ? `${p.volume}${p.issue ? `(${p.issue})` : ''}` : '';
  const pages = p.pages ? `, ${p.pages}` : '';
  const apa = `${apaNames} (${year}). ${p.title}. Synthica Journal${vol ? `, ${vol}` : ''}${pages}. https://doi.org/${p.doi}`;
  const mla = `${authors[0]?.name || ''}${authors.length > 1 ? ', et al' : ''}. “${p.title}.” Synthica Journal${vol ? `, vol. ${p.volume}${p.issue ? `, no. ${p.issue}` : ''}` : ''}, ${year}${p.pages ? `, pp. ${p.pages}` : ''}. doi:${p.doi}.`;
  const key = `${(authors[0]?.name || 'synthica').split(' ').pop().toLowerCase()}${year}`;
  const bibtex = `@article{${key},
  title   = {${p.title}},
  author  = {${authors.map((a) => a.name).join(' and ')}},
  journal = {Synthica Journal},${p.volume ? `\n  volume  = {${p.volume}},` : ''}${p.issue ? `\n  number  = {${p.issue}},` : ''}${p.pages ? `\n  pages   = {${p.pages}},` : ''}
  year    = {${year}},
  doi     = {${p.doi}}
}`;
  return { APA: apa, MLA: mla, BibTeX: bibtex };
}

// Synthica Archive — the public, no-login record of every verified paper.
export default function Archive() {
  const { user } = useAuth();
  const [pubs, setPubs] = useState([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [openDoi, setOpenDoi] = useState(null);

  const load = useCallback(() => api.publications().then(setPubs).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  useReloadOnFocus(load);

  const shown = useMemo(() => {
    const needle = q.toLowerCase();
    return pubs
      .filter((p) => (!cat || p.category === cat))
      .filter((p) => !needle || p.title.toLowerCase().includes(needle) || authorLine(p).toLowerCase().includes(needle) || (p.doi || '').toLowerCase().includes(needle) || (p.keywords || []).some((k) => k.toLowerCase().includes(needle)))
      .sort((a, b) => (b.featured === true) - (a.featured === true) || new Date(b.publishedAt) - new Date(a.publishedAt));
  }, [pubs, q, cat]);

  return (
    <div className="archive-page">
      <header className="archive-hero">
        <nav className="archive-topnav">
          <Link to="/" className="topbar-brand"><BrandMark size={22} />Synthica</Link>
          <span className="row" style={{ gap: '0.8rem' }}>
            {user
              ? <Link className="btn btn-ghost btn-sm" to={getDefaultHomePath(user)}>My dashboard</Link>
              : <Link className="btn btn-ghost btn-sm" to="/login">Sign in</Link>}
          </span>
        </nav>
        <h1 className="page-title" style={{ marginTop: '1rem' }}>Synthica Archive</h1>
        <p className="page-sub" style={{ marginBottom: '1rem' }}>
          Open-access research by student scientists — {pubs.length} paper{pubs.length === 1 ? '' : 's'}, free to read and cite.
        </p>
        <div className="row">
          <input placeholder="Search title, author, keyword, or DOI" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 340 }} />
          <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: 'auto' }}>
            <option value="">All subjects</option>
            {CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </header>

      <main className="archive-body" style={{ maxWidth: 920 }}>
        {shown.length === 0 ? (
          <Card><p className="muted">No papers match — try a different search.</p></Card>
        ) : (
          <div className="stack" style={{ gap: 0 }}>
            {shown.map((p) => (
              <PaperRow key={p.id || p.doi} p={p} open={openDoi === p.doi} onToggle={() => setOpenDoi(openDoi === p.doi ? null : p.doi)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function PaperRow({ p, open, onToggle }) {
  return (
    <article className={`arx-row ${open ? 'open' : ''}`}>
      <button className="arx-head" onClick={onToggle}>
        <div className="arx-meta-line">
          {p.featured && <Badge tone="gold"><span className="icon-label"><Icon name="star" size={12} /> Featured</span></Badge>}
          <Badge tone="blue">{p.category}</Badge>
          <span className="arx-type">{p.articleType || 'Article'}</span>
          {p.openAccess !== false && <span className="arx-oa">Open Access</span>}
          <span className="muted">{fmtDate(p.publishedAt)}</span>
        </div>
        <h3 className="arx-title">{p.title}</h3>
        <div className="arx-authors">
          {(p.authors || []).map((a, i) => {
            const uid = a.userId || (p.authors.length === 1 ? p.authorUserId : null);
            return (
              <span key={i}>
                {i > 0 && ', '}
                {uid ? <Link to={`/p/${uid}`} onClick={(e) => e.stopPropagation()}>{a.name}</Link> : a.name}
              </span>
            );
          })}
        </div>
        <div className="arx-doi-line">
          <span className="arx-doi">{p.doi}</span>
          {p.volume ? <span className="muted"> · Vol. {p.volume}{p.issue ? `, Issue ${p.issue}` : ''}{p.pages ? `, pp. ${p.pages}` : ''}</span> : null}
        </div>
      </button>

      {open && <PaperDetail p={p} />}
    </article>
  );
}

function PaperDetail({ p }) {
  const [tab, setTab] = useState('APA');
  const [copied, setCopied] = useState(false);
  const cites = useMemo(() => citations(p), [p]);
  const embed = embedSrc(p.pdfUrl);

  const copy = () => {
    navigator.clipboard?.writeText(cites[tab]).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="arx-detail">
      <div className="arx-detail-grid">
        <div>
          {p.abstract && (
            <>
              <h4 className="arx-h4">Abstract</h4>
              <p className="arx-abstract">{p.abstract}</p>
            </>
          )}
          {(p.keywords || []).length > 0 && (
            <div className="row" style={{ gap: '0.3rem', marginBottom: '0.8rem' }}>
              {p.keywords.map((k) => <Badge key={k} tone="gray">{k}</Badge>)}
            </div>
          )}
          {embed ? (
            <iframe className="arx-embed" src={embed} title={`Preview: ${p.title}`} loading="lazy" />
          ) : p.pdfUrl ? (
            <a className="btn btn-primary btn-sm" href={p.pdfUrl} target="_blank" rel="noreferrer">Read the full paper →</a>
          ) : null}
        </div>

        <aside className="arx-side">
          <h4 className="arx-h4">Metadata</h4>
          <dl className="arx-dl">
            <dt>Published</dt><dd>{fmtDate(p.publishedAt)}</dd>
            {p.receivedAt && <><dt>Received</dt><dd>{fmtDate(p.receivedAt)}</dd></>}
            {p.acceptedAt && <><dt>Accepted</dt><dd>{fmtDate(p.acceptedAt)}</dd></>}
            <dt>Type</dt><dd>{p.articleType || 'Article'}</dd>
            <dt>Subject</dt><dd>{p.category}</dd>
            <dt>DOI</dt><dd className="arx-break">{p.doi}</dd>
            {p.volume ? <><dt>Volume</dt><dd>{p.volume}{p.issue ? ` (${p.issue})` : ''}</dd></> : null}
            {p.pages ? <><dt>Pages</dt><dd>{p.pages}</dd></> : null}
            <dt>License</dt><dd>{p.license || 'CC BY 4.0'}</dd>
            {p.correspondingAuthor && <><dt>Corresponding</dt><dd>{p.correspondingAuthor}</dd></>}
            {typeof p.citationCount === 'number' && <><dt>Citations</dt><dd>{p.citationCount}</dd></>}
          </dl>

          <div className="row" style={{ gap: '0.4rem', margin: '0.8rem 0 0.4rem' }}>
            {p.pdfUrl && <a className="btn btn-ghost btn-sm" href={p.pdfUrl} target="_blank" rel="noreferrer"><span className="icon-label"><Icon name="external-link" size={14} /> PDF</span></a>}
            {p.sourceUrl && <a className="btn btn-ghost btn-sm" href={p.sourceUrl} target="_blank" rel="noreferrer"><span className="icon-label"><Icon name="external-link" size={14} /> Source</span></a>}
            {String(p.doi || '').startsWith('10.') && <a className="btn btn-ghost btn-sm" href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer"><span className="icon-label"><Icon name="external-link" size={14} /> doi.org</span></a>}
          </div>

          <h4 className="arx-h4" style={{ marginTop: '0.8rem' }}>Cite this paper</h4>
          <div className="seg" style={{ marginBottom: '0.45rem' }}>
            {Object.keys(cites).map((k) => (
              <button key={k} type="button" className={`seg-btn ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{k}</button>
            ))}
          </div>
          <pre className="arx-cite">{cites[tab]}</pre>
          <button className="btn btn-ghost btn-sm" onClick={copy}>{copied ? <><Icon name="check" size={14} /> Copied</> : 'Copy citation'}</button>
        </aside>
      </div>
    </div>
  );
}
