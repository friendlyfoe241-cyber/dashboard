import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { Card, Badge, EmptyState } from '../../components/ui.jsx';
import { safeHref } from '../../url.js';

const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const daysLeft = (iso) => Math.ceil((new Date(iso) - Date.now()) / 86400000);

// Competitions board — opportunities posted by staff. Read-only for members.
export default function Competitions({ embedded }) {
  const [comps, setComps] = useState(null);
  useEffect(() => { api.competitions().then(setComps).catch(() => setComps([])); }, []);
  if (!comps) return <div className="page-loading">Loading…</div>;

  return (
    <div>
      {!embedded && <h1 className="page-title">Competitions</h1>}
      {!embedded && <p className="page-sub">Research competitions and opportunities worth your time.</p>}
      {comps.length === 0 ? (
        <EmptyState>No competitions posted right now — check back soon.</EmptyState>
      ) : (
        <div className="grid grid-2">
          {comps.map((c) => {
            const dl = c.deadline ? daysLeft(c.deadline) : null;
            const href = safeHref(c.url);
            return (
              <Card key={c.id}>
                <div className="card-row">
                  <h3 style={{ margin: 0 }}>{c.title}</h3>
                  {c.category && <Badge tone="gray">{c.category}</Badge>}
                </div>
                {c.description && <p style={{ margin: '0.5rem 0' }}>{c.description}</p>}
                <div className="row" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
                  {c.prize && <Badge tone="green">🏆 {c.prize}</Badge>}
                  {c.deadline && <Badge tone={dl >= 0 ? 'gold' : 'gray'}>{dl >= 0 ? `${dl} days left` : 'closed'} · {fmtDay(c.deadline)}</Badge>}
                </div>
                {href && <p style={{ marginTop: '0.7rem', marginBottom: 0 }}><a className="btn btn-primary btn-sm" href={href} target="_blank" rel="noreferrer">Learn more →</a></p>}
                <p className="muted" style={{ fontSize: '0.76rem', marginTop: '0.5rem', marginBottom: 0 }}>Posted by {c.postedByName}</p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
