import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Card, Badge, Button, Field, EmptyState } from '../../components/ui.jsx';
import { useToast } from '../../components/toast.jsx';
import UploadButton from '../../components/UploadButton.jsx';
import { imageSrc } from '../../files.js';

const CATS = ['Biology', 'Chemistry', 'Physics', 'Mathematics', 'Computer Science', 'Humanities', 'Economics', 'Psychology'];

// Research Groups — interest hubs that hold several projects, a member roster,
// open positions, and shared links. Lead researchers create them; anyone joins.
export default function Groups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const isLead = (user?.tags || []).includes('lead_researcher');
  const toast = useToast();

  const load = useCallback(() => api.groups().then(setGroups).catch(() => setGroups([])), []);
  useEffect(() => { load(); }, [load]);

  if (!groups) return <div className="page-loading">Loading…</div>;

  return (
    <div>
      <div className="card-row" style={{ marginBottom: '0.4rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Research Groups</h1>
        {isLead && <Button onClick={() => setShowCreate((v) => !v)}>{showCreate ? 'Cancel' : '+ New group'}</Button>}
      </div>
      <p className="page-sub">Interest-based hubs that bring several projects, members, and resources together.</p>

      {showCreate && <CreateGroup onDone={() => { setShowCreate(false); load(); }} toast={toast} />}

      {groups.length === 0 ? (
        <EmptyState>No research groups yet.{isLead ? ' Create the first one.' : ''}</EmptyState>
      ) : (
        <div className="grid grid-3">
          {groups.map((g) => (
            <Link key={g.id} to={`/researcher/groups/${g.id}`} className="card group-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              {g.bannerUrl && <img className="group-card-banner" src={imageSrc(g.bannerUrl)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
              <div className="row" style={{ gap: '0.6rem', alignItems: 'center', marginBottom: '0.3rem' }}>
                {g.logoUrl && <img className="group-logo" src={imageSrc(g.logoUrl)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                <h3 style={{ margin: 0 }}>{g.name}</h3>
              </div>
              <div className="row" style={{ gap: '0.3rem', marginBottom: '0.4rem' }}>
                {g.category && <Badge tone="gray">{g.category}</Badge>}
                <Badge tone="blue">{g.memberCount} members</Badge>
                <Badge tone="green">{g.projectCount} projects</Badge>
              </div>
              {g.description && <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>{g.description.slice(0, 120)}{g.description.length > 120 ? '…' : ''}</p>}
              <p className="muted" style={{ fontSize: '0.78rem', marginTop: '0.5rem' }}>Led by {g.leaderName}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateGroup({ onDone, toast }) {
  const [form, setForm] = useState({ name: '', category: '', description: '', bannerUrl: '', logoUrl: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await api.createGroup(form); toast.success('Group created'); onDone(); }
    catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <Card className="pop-in" style={{ marginBottom: '1rem' }}>
      <form onSubmit={submit}>
        <Field label="Group name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
        <Field label="Primary interest / category">
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="">— pick one —</option>
            {CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Description"><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What does this group work on?" /></Field>
        <GroupArtFields form={form} setForm={setForm} />
        <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create group'}</Button>
      </form>
    </Card>
  );
}

// Shared banner + logo pickers (paste a URL or upload), with live previews.
export function GroupArtFields({ form, setForm }) {
  return (
    <>
      <Field label="Banner image (wide — shows across the top)">
        <div className="row" style={{ gap: '0.4rem' }}>
          <input value={form.bannerUrl} onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })} placeholder="https://… or upload →" />
          <UploadButton kind="image" label="Banner" onUploaded={({ url }) => setForm((f) => ({ ...f, bannerUrl: url }))} />
        </div>
      </Field>
      {form.bannerUrl && <img src={imageSrc(form.bannerUrl)} alt="Banner preview" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 12, margin: '0 0 0.6rem', border: '1px solid var(--border)' }} />}
      <Field label="Logo (square — shows beside the name)">
        <div className="row" style={{ gap: '0.4rem' }}>
          <input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://… or upload →" />
          <UploadButton kind="image" label="Logo" onUploaded={({ url }) => setForm((f) => ({ ...f, logoUrl: url }))} />
        </div>
      </Field>
      {form.logoUrl && <img src={imageSrc(form.logoUrl)} alt="Logo preview" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 12, margin: '0 0 0.6rem', border: '1px solid var(--border)' }} />}
    </>
  );
}
