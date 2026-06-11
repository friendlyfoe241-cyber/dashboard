import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Card, Badge, Pfp } from '../components/ui.jsx';
import { imageSrc } from '../files.js';
import { useReloadOnFocus } from '../useReload.js';

// Public member profile — works without login, resolves by id or slug.
export default function PublicProfile() {
  const { key } = useParams();
  const { user } = useAuth();
  const [p, setP] = useState(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(() => {
    setMissing(false);
    api.profile(key).then(setP).catch(() => setMissing(true));
  }, [key]);
  useEffect(() => { setP(null); load(); }, [load]);
  useReloadOnFocus(load);

  if (missing) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <h1>Profile not found</h1>
          <p className="sub">This member may have set their profile to private.</p>
          <Link className="btn btn-primary" to="/archive">Browse the archive</Link>
        </div>
      </div>
    );
  }
  if (!p) return <div className="page-loading">Loading…</div>;

  return (
    <div className="archive-page">
      <nav className="archive-topnav" style={{ padding: '1rem clamp(1rem,4vw,2.5rem)' }}>
        <Link to="/" className="topbar-brand"><img className="brand-img" src="/assets/logo/logo.png" alt="" />Synthica</Link>
        <span className="row" style={{ gap: '0.8rem' }}>
          <Link className="btn btn-ghost btn-sm" to="/archive">Archive</Link>
          {user ? <Link className="btn btn-ghost btn-sm" to="/">My dashboard</Link> : <Link className="btn btn-ghost btn-sm" to="/login">Sign in</Link>}
        </span>
      </nav>

      <main className="archive-body" style={{ paddingTop: '0.5rem' }}>
        <Card style={{ marginBottom: '1rem' }}>
          <div className="row" style={{ gap: '1rem', alignItems: 'center' }}>
            <Pfp name={p.name} url={imageSrc(p.avatarUrl)} size="lg" />
            <div>
              <h1 className="page-title" style={{ marginBottom: 0 }}>{p.name}</h1>
              <div className="muted">{p.role}{p.institution ? ` · ${p.institution}` : ''}{p.username ? ` · @${p.username}` : ''}</div>
              {p.blurb && <p style={{ margin: '0.35rem 0 0', color: 'var(--slate)' }}>{p.blurb}</p>}
            </div>
          </div>
          {(p.interests || []).length > 0 && (
            <div className="row" style={{ marginTop: '0.7rem', gap: '0.3rem' }}>
              {p.interests.map((i) => <Badge key={i} tone="gray">{i}</Badge>)}
            </div>
          )}
          {(p.links?.length > 0 || p.linkedinUrl || p.websiteUrl) && (
            <div className="row" style={{ marginTop: '0.6rem' }}>
              {p.linkedinUrl && <a href={p.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn</a>}
              {p.websiteUrl && <a href={p.websiteUrl} target="_blank" rel="noreferrer">Website</a>}
              {(p.links || []).map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer">{l.label}</a>)}
            </div>
          )}
        </Card>

        {p.bio && (
          <Card style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>About</h3>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{p.bio}</p>
          </Card>
        )}

        {(p.currentProjects || []).length > 0 && (
          <Card style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Current projects</h3>
            <div className="stack">
              {p.currentProjects.map((pr) => (
                <div key={pr.id} className="muted">{pr.title} <Badge tone="gray">{pr.category}</Badge></div>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <h3 style={{ marginTop: 0 }}>Published research <Badge tone="gray">{(p.publications || []).length}</Badge></h3>
          {(p.publications || []).length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No published research yet.</p>
          ) : (
            <div className="stack">
              {p.publications.map((pub) => (
                <div key={pub.doi}>
                  {pub.pdfUrl ? <a href={pub.pdfUrl} target="_blank" rel="noreferrer"><strong>{pub.title}</strong></a> : <strong>{pub.title}</strong>}
                  {pub.verified === false && <> <Badge tone="gold">awaiting verification</Badge></>}
                  <div className="muted" style={{ fontSize: '0.8rem' }}>
                    {pub.articleType || 'Article'} · {pub.category} · {pub.publishedAt} · {pub.doi}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
