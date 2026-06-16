import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../api.js';
import { Card, Badge, Button, Field } from '../../components/ui.jsx';
import { useToast } from '../../components/toast.jsx';
import { safeHref } from '../../url.js';

// Full research-group page: roster, the projects inside it, open positions, and
// shared links. The group leader gets management controls inline.
export default function GroupDetail() {
  const { id } = useParams();
  const [g, setG] = useState(null);
  const [missing, setMissing] = useState(false);
  const toast = useToast();

  const load = useCallback(() => api.group(id).then(setG).catch(() => setMissing(true)), [id]);
  useEffect(() => { setG(null); setMissing(false); load(); }, [load]);

  const run = (promise, msg) => promise.then((d) => { setG(d); if (msg) toast.success(msg); }).catch((e) => toast.error(e.message));

  if (missing) return <div><h1 className="page-title">Group not found</h1><Link to="/researcher/groups">← All groups</Link></div>;
  if (!g) return <div className="page-loading">Loading…</div>;

  return (
    <div>
      <Link to="/researcher/groups" className="muted" style={{ fontSize: '0.85rem' }}>← All groups</Link>
      <div className="card-row" style={{ margin: '0.4rem 0 0.2rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>{g.name}</h1>
        {g.isLeader
          ? <Badge tone="gold">you lead this</Badge>
          : g.isMember
            ? <Button variant="ghost" onClick={() => run(api.leaveGroup(id), 'Left the group')}>Leave group</Button>
            : <Button onClick={() => run(api.joinGroup(id), 'Joined the group')}>Join group</Button>}
      </div>
      <div className="row" style={{ gap: '0.3rem', marginBottom: '0.6rem' }}>
        {g.category && <Badge tone="gray">{g.category}</Badge>}
        <Badge tone="blue">{g.members.length} members</Badge>
        <span className="muted" style={{ fontSize: '0.82rem' }}>Led by {g.leaderName}</span>
      </div>
      {g.description && <p style={{ maxWidth: 720 }}>{g.description}</p>}

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="stack" style={{ gap: '1rem' }}>
          <Card>
            <h3 style={{ marginTop: 0 }}>Projects <Badge tone="gray">{g.projects.length}</Badge></h3>
            <div className="stack">
              {g.projects.length === 0 && <p className="muted">No projects in this group yet.</p>}
              {g.projects.map((p) => (
                <div key={p.id} className="card-row info-block">
                  <div><Link to={`/researcher/project/${p.id}`}><strong>{p.title}</strong></Link> <Badge tone="gray">{p.category}</Badge> <span className="muted" style={{ fontSize: '0.78rem' }}>· {p.memberCount} members</span></div>
                  {g.isLeader && <button className="btn btn-ghost btn-sm" onClick={() => run(api.removeGroupProject(id, p.id))}>Remove</button>}
                </div>
              ))}
            </div>
            {g.isLeader && g.addableProjects.length > 0 && (
              <AddProject group={g} onChange={(d) => setG(d)} toast={toast} />
            )}
          </Card>

          <Card>
            <h3 style={{ marginTop: 0 }}>Positions</h3>
            <div className="stack">
              {g.positions.length === 0 && <p className="muted">No positions defined.</p>}
              {g.positions.map((pos) => (
                <div key={pos.id} className="info-block">
                  <div className="card-row">
                    <div>
                      <strong>{pos.title}</strong>{' '}
                      {pos.filledByName ? <Badge tone="green">{pos.filledByName}</Badge> : <Badge tone="gold">open</Badge>}
                      {pos.description && <div className="muted" style={{ fontSize: '0.8rem' }}>{pos.description}</div>}
                    </div>
                    {g.isLeader && (
                      <div className="row" style={{ gap: '0.3rem' }}>
                        <select defaultValue={pos.filledBy || ''} onChange={(e) => run(api.fillGroupPosition(id, pos.id, e.target.value || null))} style={{ width: 'auto' }}>
                          <option value="">— open —</option>
                          {g.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        <button className="btn btn-ghost btn-sm" onClick={() => run(api.removeGroupPosition(id, pos.id))}>✕</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {g.isLeader && <AddPosition groupId={id} onChange={(d) => setG(d)} toast={toast} />}
          </Card>
        </div>

        <div className="stack" style={{ gap: '1rem' }}>
          <Card>
            <h3 style={{ marginTop: 0 }}>Members <Badge tone="gray">{g.members.length}</Badge></h3>
            <div className="stack">
              {g.members.map((m) => (
                <div key={m.id} className="row">
                  <span className="badge badge-blue" style={{ borderRadius: '999px' }}>{String(m.name || '?').split(' ').map((x) => x[0] || '').join('').slice(0, 2)}</span>
                  <div><Link to={`/p/${m.slug || m.id}`}>{m.name}</Link> {m.isLeader && <Badge tone="gold">leader</Badge>}<div className="muted" style={{ fontSize: '0.76rem' }}>{m.role}</div></div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 style={{ marginTop: 0 }}>Links</h3>
            <div className="stack">
              {g.links.length === 0 && <p className="muted">No links yet.</p>}
              {g.links.map((l) => (
                <div key={l.id} className="card-row">
                  {safeHref(l.url) ? <a href={safeHref(l.url)} target="_blank" rel="noreferrer">{l.label}</a> : <span>{l.label}</span>}
                  {g.isLeader && <button className="btn btn-ghost btn-sm" onClick={() => run(api.removeGroupLink(id, l.id))}>✕</button>}
                </div>
              ))}
            </div>
            {g.isLeader && <AddLink groupId={id} onChange={(d) => setG(d)} toast={toast} />}
          </Card>
        </div>
      </div>
    </div>
  );
}

function AddProject({ group, onChange, toast }) {
  const [pid, setPid] = useState('');
  const add = () => { if (pid) api.addGroupProject(group.id, pid).then((d) => { onChange(d); setPid(''); }).catch((e) => toast.error(e.message)); };
  return (
    <div className="row" style={{ marginTop: '0.6rem' }}>
      <select value={pid} onChange={(e) => setPid(e.target.value)} style={{ width: 'auto' }}>
        <option value="">+ add one of your projects…</option>
        {group.addableProjects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
      </select>
      <Button className="btn-sm" onClick={add} disabled={!pid}>Add</Button>
    </div>
  );
}

function AddPosition({ groupId, onChange, toast }) {
  const [form, setForm] = useState({ title: '', description: '' });
  const add = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    api.addGroupPosition(groupId, form).then((d) => { onChange(d); setForm({ title: '', description: '' }); }).catch((er) => toast.error(er.message));
  };
  return (
    <form onSubmit={add} className="row" style={{ marginTop: '0.6rem' }}>
      <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Position (e.g. Data Lead)" style={{ maxWidth: 200 }} />
      <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What they do (optional)" />
      <Button className="btn-sm" type="submit">Add</Button>
    </form>
  );
}

function AddLink({ groupId, onChange, toast }) {
  const [form, setForm] = useState({ label: '', url: '' });
  const add = (e) => {
    e.preventDefault();
    if (!form.url.trim()) return;
    api.addGroupLink(groupId, form).then((d) => { onChange(d); setForm({ label: '', url: '' }); }).catch((er) => toast.error(er.message));
  };
  return (
    <form onSubmit={add} className="row" style={{ marginTop: '0.6rem' }}>
      <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Label" style={{ maxWidth: 140 }} />
      <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" />
      <Button className="btn-sm" type="submit">Add</Button>
    </form>
  );
}
