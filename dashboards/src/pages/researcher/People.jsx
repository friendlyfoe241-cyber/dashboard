import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { Card, Badge, Button, Pfp } from '../../components/ui.jsx';
import { imageSrc } from '../../files.js';

// Follow researchers and editors to get their updates in your feed.
export default function People() {
  const [people, setPeople] = useState([]);
  const [q, setQ] = useState('');
  const load = useCallback(() => api.people().then(setPeople).catch(() => {}), []);
  useEffect(load, [load]);

  const toggle = (p) => (p.following ? api.unfollow(p.id) : api.follow(p.id)).then(load);
  const needle = q.toLowerCase();
  const shown = needle
    ? people.filter((p) => p.name.toLowerCase().includes(needle) || (p.interests || []).some((i) => i.toLowerCase().includes(needle)) || p.role.toLowerCase().includes(needle) || (p.username || '').toLowerCase().includes(needle) || (p.blurb || '').toLowerCase().includes(needle))
    : people;

  return (
    <div>
      <h1 className="page-title">People</h1>
      <p className="page-sub">Follow researchers and editors to get their updates in your feed.</p>
      <input placeholder="Search name, @username, role, or interest" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320, marginBottom: '1rem' }} />
      <div className="grid grid-3">
        {shown.map((p) => (
          <Card key={p.id}>
            <div className="row">
              <Pfp name={p.name} url={imageSrc(p.avatarUrl)} />
              <div>
                <strong>{p.name}</strong>
                <div className="muted" style={{ fontSize: '0.78rem' }}>{p.role}{p.username ? ` · @${p.username}` : ''}</div>
              </div>
            </div>
            {p.blurb && <p className="muted" style={{ margin: '0.45rem 0 0', fontSize: '0.85rem' }}>{p.blurb}</p>}
            {p.interests?.length > 0 && (
              <div className="row" style={{ marginTop: '0.4rem', gap: '0.3rem' }}>
                {p.interests.slice(0, 3).map((i) => <Badge key={i} tone="gray">{i}</Badge>)}
              </div>
            )}
            <div className="row" style={{ marginTop: '0.6rem' }}>
              <Link className="btn btn-ghost btn-sm" to={`/p/${p.slug || p.id}`}>View profile</Link>
              <Button className="btn-sm" variant={p.following ? 'ghost' : 'primary'} onClick={() => toggle(p)}>{p.following ? 'Following ✓' : 'Follow'}</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
