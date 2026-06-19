import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { Card, Badge, Button, Pfp, EmptyState } from '../../components/ui.jsx';
import { imageSrc } from '../../files.js';

// Directory + your network (people you follow / who follow you). Follow to get
// their updates in your feed; message anyone directly.
export default function People() {
  const [tab, setTab] = useState('discover');
  const [people, setPeople] = useState([]);
  const [network, setNetwork] = useState(null);
  const [q, setQ] = useState('');

  const load = useCallback(() => api.people().then(setPeople).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'network' && !network) api.network().then(setNetwork).catch(() => setNetwork({ following: [], followers: [] })); }, [tab, network]);

  const toggle = (p) => (p.following ? api.unfollow(p.id) : api.follow(p.id)).then(() => { load(); setNetwork(null); });

  const needle = q.toLowerCase();
  const shown = needle
    ? people.filter((p) => p.name.toLowerCase().includes(needle) || (p.interests || []).some((i) => i.toLowerCase().includes(needle)) || p.role.toLowerCase().includes(needle) || (p.username || '').toLowerCase().includes(needle) || (p.blurb || '').toLowerCase().includes(needle) || (p.institution || '').toLowerCase().includes(needle))
    : people;

  return (
    <div>
      <h1 className="page-title">People</h1>
      <p className="page-sub">Follow researchers and editors to get their updates — and message anyone directly.</p>

      <div className="row" style={{ marginBottom: '1rem' }}>
        <button className={`btn btn-sm ${tab === 'discover' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('discover')}>Discover</button>
        <button className={`btn btn-sm ${tab === 'network' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('network')}>My network</button>
      </div>

      {tab === 'discover' ? (
        <>
          <input placeholder="Search name, @username, role, affiliation, or interest" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 360, marginBottom: '1rem' }} />
          <div className="grid grid-3">
            {shown.map((p) => <PersonCard key={p.id} p={p} onToggle={toggle} />)}
          </div>
        </>
      ) : !network ? (
        <div className="page-loading">Loading…</div>
      ) : (
        <>
          <h3>Following <Badge tone="gray">{network.following.length}</Badge></h3>
          {network.following.length === 0 ? <EmptyState>You're not following anyone yet — find people in Discover.</EmptyState> : (
            <div className="grid grid-3" style={{ marginBottom: '1.5rem' }}>{network.following.map((p) => <ConnectionCard key={p.id} p={p} />)}</div>
          )}
          <h3>Followers <Badge tone="gray">{network.followers.length}</Badge></h3>
          {network.followers.length === 0 ? <EmptyState>No followers yet — share your profile to grow your network.</EmptyState> : (
            <div className="grid grid-3">{network.followers.map((p) => <ConnectionCard key={p.id} p={p} />)}</div>
          )}
        </>
      )}
    </div>
  );
}

function PersonCard({ p, onToggle }) {
  return (
    <Card>
      <div className="row">
        <Pfp name={p.name} url={imageSrc(p.avatarUrl)} />
        <div>
          <strong>{p.name}</strong>
          <div className="muted" style={{ fontSize: '0.78rem' }}>{p.role}{p.username ? ` · @${p.username}` : ''}</div>
          {p.institution && <div className="muted" style={{ fontSize: '0.78rem' }}>{p.institution}</div>}
        </div>
      </div>
      {p.blurb && <p className="muted" style={{ margin: '0.45rem 0 0', fontSize: '0.85rem' }}>{p.blurb}</p>}
      {p.interests?.length > 0 && (
        <div className="row" style={{ marginTop: '0.4rem', gap: '0.3rem' }}>
          {p.interests.slice(0, 3).map((i) => <Badge key={i} tone="gray">{i}</Badge>)}
        </div>
      )}
      <div className="row" style={{ marginTop: '0.6rem' }}>
        <Link className="btn btn-ghost btn-sm" to={`/researcher/messages/${p.id}`}>Message</Link>
        <Button className="btn-sm" variant={p.following ? 'ghost' : 'primary'} onClick={() => onToggle(p)}>{p.following ? 'Following ✓' : 'Follow'}</Button>
      </div>
    </Card>
  );
}

function ConnectionCard({ p }) {
  return (
    <Card>
      <div className="row">
        <Pfp name={p.name} url={imageSrc(p.avatarUrl)} />
        <div style={{ flex: 1 }}>
          <strong>{p.name}</strong>{p.mutual && <> <Badge tone="blue">mutual</Badge></>}
          <div className="muted" style={{ fontSize: '0.78rem' }}>{p.role}</div>
        </div>
      </div>
      <div className="row" style={{ marginTop: '0.6rem' }}>
        <Link className="btn btn-ghost btn-sm" to={`/p/${p.slug || p.id}`}>Profile</Link>
        <Link className="btn btn-primary btn-sm" to={`/researcher/messages/${p.id}`}>Message</Link>
      </div>
    </Card>
  );
}
