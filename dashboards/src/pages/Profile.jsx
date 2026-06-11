import { useState } from 'react';
import { api, getToken } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Card, Button, Field, Badge } from '../components/ui.jsx';
import { useToast } from '../components/toast.jsx';
import { imageSrc } from '../files.js';

// Everyone can edit their own public profile (shown on the website).
export default function Profile() {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    name: user.name || '',
    institution: user.institution || '',
    bio: user.bio || '',
    blurb: user.blurb || '',
    avatarUrl: user.avatarUrl || '',
    discord: user.discord || '',
    linkedinUrl: user.linkedinUrl || '',
    websiteUrl: user.websiteUrl || '',
    interests: (user.interests || []).join(', '),
    public: user.public !== false,
    links: user.links?.length ? user.links : [{ label: '', url: '' }],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setLink = (i, k) => (e) => {
    const links = form.links.slice();
    links[i] = { ...links[i], [k]: e.target.value };
    setForm({ ...form, links });
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const links = form.links.filter((l) => l.url.trim());
      const interests = form.interests.split(',').map((s) => s.trim()).filter(Boolean);
      await api.updateProfile({ ...form, links, interests });
      toast.success('Profile saved');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // In-app public profile (works on any deployment, no marketing site needed).
  const publicUrl = `/p/${user.slug || user.id}`;

  return (
    <div>
      <h1 className="page-title">My Profile</h1>
      <p className="page-sub">This is your public page on synthica.org — keep it up to date.</p>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          {error && <div className="login-error">{error}</div>}
          <form onSubmit={save}>
            <Field label="Display name"><input value={form.name} onChange={set('name')} /></Field>
            <Field label="Institution / school"><input value={form.institution} onChange={set('institution')} placeholder="e.g. MIT" /></Field>
            <Field label="Profile picture URL"><input value={form.avatarUrl} onChange={set('avatarUrl')} placeholder="https://… (optional — initials shown otherwise)" /></Field>
            <Field label="One-line blurb (shown everywhere next to your name)">
              <input value={form.blurb} onChange={set('blurb')} maxLength={140} placeholder="e.g. High-schooler studying coral reef genetics 🌊" />
            </Field>
            <Field label="Discord username"><input value={form.discord} onChange={set('discord')} /></Field>
            <Field label="Research interests (comma-separated)"><input value={form.interests} onChange={set('interests')} placeholder="machine learning, ecology" /></Field>
            <Field label="LinkedIn URL"><input value={form.linkedinUrl} onChange={set('linkedinUrl')} placeholder="https://linkedin.com/in/…" /></Field>
            <Field label="Website URL"><input value={form.websiteUrl} onChange={set('websiteUrl')} placeholder="https://…" /></Field>
            <Field label="Bio"><textarea value={form.bio} onChange={set('bio')} placeholder="A few sentences about your research." /></Field>

            <div className="field-label">Links</div>
            {form.links.map((l, i) => (
              <div key={i} className="row" style={{ marginBottom: '0.4rem' }}>
                <input placeholder="Label (e.g. ORCID)" value={l.label} onChange={setLink(i, 'label')} style={{ maxWidth: 140 }} />
                <input placeholder="https://…" value={l.url} onChange={setLink(i, 'url')} />
              </div>
            ))}
            <Button type="button" variant="ghost" className="btn-sm" onClick={() => setForm({ ...form, links: [...form.links, { label: '', url: '' }] })}>
              + Add link
            </Button>

            <label className="row" style={{ margin: '0.9rem 0' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={form.public} onChange={(e) => setForm({ ...form, public: e.target.checked })} />
              Show my profile publicly
            </label>

            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</Button>
          </form>
        </Card>

        <Card>
          <h3>Preview</h3>
          <div className="row" style={{ marginTop: '0.5rem' }}>
            <span className="pfp pfp-lg">
              {form.avatarUrl ? <img src={imageSrc(form.avatarUrl)} alt="" /> : (form.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2)}
            </span>
            <div>
              <div style={{ fontWeight: 700 }}>{form.name}</div>
              <div className="muted">{user.role ? user.role : (user.tags || []).join(', ')}{user.username ? ` · @${user.username}` : ''}</div>
            </div>
          </div>
          {form.blurb && <p style={{ marginTop: '0.5rem', color: 'var(--slate)' }}>{form.blurb}</p>}
          {form.institution && <p className="muted" style={{ marginTop: '0.5rem' }}>{form.institution}</p>}
          {form.bio && <p style={{ marginTop: '0.5rem' }}>{form.bio}</p>}
          <p style={{ marginTop: '0.75rem' }}>
            <a href={publicUrl} target="_blank" rel="noreferrer">View public profile →</a>{' '}
            {form.public ? <Badge tone="green">public</Badge> : <Badge tone="gray">hidden</Badge>}
          </p>
        </Card>
      </div>
    </div>
  );
}
