import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Card, Button, Field, Badge } from '../components/ui.jsx';
import { useToast } from '../components/toast.jsx';
import { imageSrc } from '../files.js';

// Everyone can edit their own public profile (shown on synthica.org and in-app).
export default function Profile() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  // Guard: RequireAuth gates this route, but never assume user is present.
  const [form, setForm] = useState(() => ({
    name: user?.name || '',
    pronouns: user?.pronouns || '',
    blurb: user?.blurb || '',
    avatarUrl: user?.avatarUrl || '',
    affiliation1: (user?.affiliations?.[0]) || user?.institution || '',
    affiliation2: (user?.affiliations?.[1]) || '',
    contactEmail: user?.contactEmail || '',
    discord: user?.discord || '',
    interests: (user?.interests || []).join(', '),
    researchGroup: user?.researchGroup || '',
    researchGroupUrl: user?.researchGroupUrl || '',
    bio: user?.bio || '',
    linkedinUrl: user?.linkedinUrl || '',
    websiteUrl: user?.websiteUrl || '',
    githubUrl: user?.githubUrl || '',
    twitterUrl: user?.twitterUrl || '',
    scholarUrl: user?.scholarUrl || '',
    orcid: user?.orcid || '',
    dob: user?.dob || '',
    dobPublic: user?.dobPublic === true,
    public: user?.public !== false,
    links: user?.links?.length ? user.links : [{ label: '', url: '' }],
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!user) return <div className="page-loading">Loading…</div>;

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
      const { affiliation1, affiliation2, ...rest } = form;
      const affiliations = [affiliation1, affiliation2].map((s) => s.trim()).filter(Boolean);
      const links = form.links.filter((l) => l.url.trim());
      const interests = form.interests.split(',').map((s) => s.trim()).filter(Boolean);
      await api.updateProfile({ ...rest, affiliations, links, interests });
      // Refresh the auth user so the topbar, preview, and other pages reflect
      // the new values immediately (without this, edits looked "lost").
      await refreshUser();
      toast.success('Profile saved');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // In-app public profile (works on any deployment, no marketing site needed).
  const publicUrl = `/p/${user.slug || user.id}`;
  const roleLine = user.role ? user.role : (user.tags || []).join(', ');
  const previewAffiliations = [form.affiliation1, form.affiliation2].filter(Boolean);

  return (
    <div>
      <h1 className="page-title">My Profile</h1>
      <p className="page-sub">This is your public researcher page — keep it sharp; it's what people see on synthica.org.</p>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          {error && <div className="login-error">{error}</div>}
          <form onSubmit={save}>
            <div className="field-group-title">Basics</div>
            <Field label="Display name"><input value={form.name} onChange={set('name')} /></Field>
            <div className="row" style={{ gap: '0.6rem' }}>
              <Field label="Pronouns (optional)"><input value={form.pronouns} onChange={set('pronouns')} placeholder="she/her · he/him · they/them" /></Field>
              <Field label="Profile picture URL"><input value={form.avatarUrl} onChange={set('avatarUrl')} placeholder="https://… (initials shown otherwise)" /></Field>
            </div>
            <Field label="One-line blurb (shown everywhere next to your name)">
              <input value={form.blurb} onChange={set('blurb')} maxLength={140} placeholder="e.g. High-schooler studying coral reef genetics 🌊" />
            </Field>

            <div className="field-group-title">Affiliations &amp; contact</div>
            <Field label="Affiliation 1 (school, lab, or org)"><input value={form.affiliation1} onChange={set('affiliation1')} placeholder="e.g. Phillips Exeter Academy" /></Field>
            <Field label="Affiliation 2 (optional)"><input value={form.affiliation2} onChange={set('affiliation2')} placeholder="e.g. Synthica Research Group" /></Field>
            <div className="row" style={{ gap: '0.6rem' }}>
              <Field label="Contact email (public)"><input type="email" value={form.contactEmail} onChange={set('contactEmail')} placeholder="you@example.com" /></Field>
              <Field label="Discord username"><input value={form.discord} onChange={set('discord')} /></Field>
            </div>

            <div className="field-group-title">Research</div>
            <Field label="Research interests (comma-separated)"><input value={form.interests} onChange={set('interests')} placeholder="machine learning, ecology, genomics" /></Field>
            <div className="row" style={{ gap: '0.6rem' }}>
              <Field label="Current research group / lab"><input value={form.researchGroup} onChange={set('researchGroup')} placeholder="e.g. Reef Genomics Group" /></Field>
              <Field label="Research group link (optional)"><input value={form.researchGroupUrl} onChange={set('researchGroupUrl')} placeholder="https://…" /></Field>
            </div>
            <Field label="Bio"><textarea value={form.bio} onChange={set('bio')} placeholder="A few sentences about your research and what you're working on." /></Field>

            <div className="field-group-title">Links &amp; socials</div>
            <div className="row" style={{ gap: '0.6rem' }}>
              <Field label="LinkedIn"><input value={form.linkedinUrl} onChange={set('linkedinUrl')} placeholder="https://linkedin.com/in/…" /></Field>
              <Field label="Website"><input value={form.websiteUrl} onChange={set('websiteUrl')} placeholder="https://…" /></Field>
            </div>
            <div className="row" style={{ gap: '0.6rem' }}>
              <Field label="GitHub"><input value={form.githubUrl} onChange={set('githubUrl')} placeholder="https://github.com/…" /></Field>
              <Field label="X / Twitter"><input value={form.twitterUrl} onChange={set('twitterUrl')} placeholder="https://x.com/…" /></Field>
            </div>
            <div className="row" style={{ gap: '0.6rem' }}>
              <Field label="Google Scholar"><input value={form.scholarUrl} onChange={set('scholarUrl')} placeholder="https://scholar.google.com/…" /></Field>
              <Field label="ORCID iD"><input value={form.orcid} onChange={set('orcid')} placeholder="0000-0002-1825-0097" /></Field>
            </div>

            <div className="field-label">Other links</div>
            {form.links.map((l, i) => (
              <div key={i} className="row" style={{ marginBottom: '0.4rem' }}>
                <input placeholder="Label (e.g. Portfolio)" value={l.label} onChange={setLink(i, 'label')} style={{ maxWidth: 160 }} />
                <input placeholder="https://…" value={l.url} onChange={setLink(i, 'url')} />
              </div>
            ))}
            <Button type="button" variant="ghost" className="btn-sm" onClick={() => setForm({ ...form, links: [...form.links, { label: '', url: '' }] })}>
              + Add link
            </Button>

            <div className="field-group-title">Private</div>
            <Field label="Date of birth"><input type="date" value={form.dob} onChange={set('dob')} /></Field>
            <label className="row" style={{ margin: '0.4rem 0' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={form.dobPublic} onChange={(e) => setForm({ ...form, dobPublic: e.target.checked })} />
              Show my date of birth on my public profile
            </label>
            <p className="muted" style={{ margin: '0 0 0.4rem' }}>Your date of birth is private by default — only you and admins can see it unless you tick the box above.</p>

            <div className="field-group-title">Visibility</div>
            <label className="row" style={{ margin: '0.4rem 0 0.9rem' }}>
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
              <div style={{ fontWeight: 700 }}>{form.name}{form.pronouns && <span className="muted" style={{ fontWeight: 400 }}> · {form.pronouns}</span>}</div>
              <div className="muted">{roleLine}{user.username ? ` · @${user.username}` : ''}</div>
            </div>
          </div>
          {form.blurb && <p style={{ marginTop: '0.5rem', color: 'var(--slate)' }}>{form.blurb}</p>}
          {previewAffiliations.length > 0 && <p className="muted" style={{ marginTop: '0.5rem' }}>{previewAffiliations.join(' · ')}</p>}
          {form.researchGroup && <p className="muted" style={{ marginTop: '0.25rem' }}>🔬 {form.researchGroup}</p>}
          {form.interests.trim() && (
            <div className="row" style={{ marginTop: '0.5rem', gap: '0.3rem' }}>
              {form.interests.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 8).map((i) => <Badge key={i} tone="gray">{i}</Badge>)}
            </div>
          )}
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
