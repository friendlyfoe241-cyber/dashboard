import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Icon from '../components/Icon.jsx';
import { JournalMast, JournalFooter } from '../components/JournalChrome.jsx';

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '');
const authorLine = (a = []) => (a.length > 3 ? `${a.slice(0, 3).join(', ')}, et al.` : a.join(', '));

// Synthica Journal — the public, professional front page. Featured article hero,
// current issue, browse-by-subject, recent + most-read, and a volume index.
export default function Journal() {
  const [d, setD] = useState(null);
  useEffect(() => { api.journalOverview().then(setD).catch(() => setD({ })); }, []);

  return (
    <div className="jr-page">
      <JournalMast />
      {!d ? <div className="page-loading">Loading…</div> : (
        <main className="jr-body">
          {/* Masthead strapline */}
          <div className="jr-strap">
            <div>
              <h1 className="jr-title">Synthica Journal</h1>
              <p className="jr-sub">Open-access, peer-reviewed research by the next generation of scientists.</p>
            </div>
            <div className="jr-strap-stats">
              <span><b>{d.stats?.papers ?? 0}</b> articles</span>
              <span><b>{d.stats?.volumes ?? 0}</b> volumes</span>
              <span><b>{d.stats?.subjects ?? 0}</b> subjects</span>
            </div>
          </div>

          {d.featured && <FeaturedArticle p={d.featured} />}

          <div className="jr-cols">
            <div className="jr-main-col">
              {d.currentIssue?.length > 0 && (
                <section className="jr-section">
                  <div className="jr-sec-head">
                    <h2>Current issue</h2>
                    {d.latestIssue && <Link to={`/journal/vol/${d.latestIssue.volume}/issue/${d.latestIssue.issue}`} className="jr-more">Volume {d.latestIssue.volume}, Issue {d.latestIssue.issue} →</Link>}
                  </div>
                  <div className="jr-toc">
                    {d.currentIssue.map((p) => <ArticleRow key={p.id} p={p} />)}
                  </div>
                </section>
              )}

              <section className="jr-section">
                <div className="jr-sec-head"><h2>Latest articles</h2><Link to="/archive" className="jr-more">All articles →</Link></div>
                <div className="jr-toc">
                  {(d.recent || []).map((p) => <ArticleRow key={p.id} p={p} />)}
                </div>
              </section>
            </div>

            <aside className="jr-side-col">
              {(d.subjects || []).length > 0 && (
                <div className="jr-side-card">
                  <h3 className="jr-side-h">Browse by subject</h3>
                  <div className="jr-subjects">
                    {d.subjects.map((s) => (
                      <Link key={s.category} to={`/archive?subject=${encodeURIComponent(s.category)}`} className="jr-subject">
                        <span>{s.category}</span><span className="jr-subject-n">{s.count}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {(d.mostRead || []).length > 0 && (
                <div className="jr-side-card">
                  <h3 className="jr-side-h">Most read</h3>
                  <ol className="jr-mostread">
                    {d.mostRead.map((p) => (
                      <li key={p.id}><Link to={`/article/${p.id}`}>{p.title}</Link><span className="muted"> · {authorLine(p.authors)}</span></li>
                    ))}
                  </ol>
                </div>
              )}

              {(d.volumes || []).length > 0 && (
                <div className="jr-side-card">
                  <h3 className="jr-side-h">All volumes</h3>
                  <div className="jr-vol-list">
                    {d.volumes.map((v) => (
                      <div key={v.volume} className="jr-vol-row">
                        <span className="jr-vol-label">Vol. {v.volume}</span>
                        <span className="jr-vol-issues">
                          {v.issues.map((is) => (
                            <Link key={is.issue} to={`/journal/vol/${v.volume}/issue/${is.issue}`} className="jr-issue-chip">{is.issue}</Link>
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </main>
      )}
      <JournalFooter />
    </div>
  );
}

function FeaturedArticle({ p }) {
  return (
    <section className="jr-feature">
      <div className="jr-feature-body">
        <div className="jr-eyebrow">
          <span className="jr-pill-feat"><Icon name="star" size={13} /> Editor’s choice</span>
          <span className="jr-type">{p.articleType}</span>
          {p.openAccess && <span className="jr-oa">Open Access</span>}
        </div>
        <h2 className="jr-feature-title"><Link to={`/article/${p.id}`}>{p.title}</Link></h2>
        <p className="jr-feature-authors">{authorLine(p.authors)}</p>
        {p.abstract && <p className="jr-feature-abstract">{p.abstract}</p>}
        <div className="jr-feature-meta">
          <Link to={`/article/${p.id}`} className="btn btn-primary">Read article</Link>
          <span className="muted">{p.category} · {fmtDate(p.publishedAt)}</span>
        </div>
      </div>
    </section>
  );
}

function ArticleRow({ p }) {
  return (
    <article className="jr-art">
      <div className="jr-art-meta">
        <span className="jr-art-type">{p.articleType}</span>
        {p.openAccess && <span className="jr-oa sm">Open Access</span>}
        <span className="muted">{fmtDate(p.publishedAt)}</span>
      </div>
      <h3 className="jr-art-title"><Link to={`/article/${p.id}`}>{p.title}</Link></h3>
      <p className="jr-art-authors">{authorLine(p.authors)}</p>
      {p.abstract && <p className="jr-art-excerpt">{p.abstract.slice(0, 220)}{p.abstract.length > 220 ? '…' : ''}</p>}
      <div className="jr-art-foot muted">
        {p.category}{p.volume ? ` · Vol. ${p.volume}${p.issue ? `, Issue ${p.issue}` : ''}` : ''}{p.pages ? `, pp. ${p.pages}` : ''}
        {p.accesses > 0 && <> · {p.accesses} views</>}
      </div>
    </article>
  );
}
