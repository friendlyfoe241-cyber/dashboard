import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Card, Badge, Button, Field, EmptyState, Modal } from '../../components/ui.jsx';
import { useToast } from '../../components/toast.jsx';
import { imageSrc } from '../../files.js';
import { Pfp } from '../../components/ui.jsx';

// Browse all open project listings; apply to one. Leads can post listings.
// Applying respects a listing's custom-application setting (ROLE_WORKFLOWS §5.4):
// profile-only with a short message, or extra Lead-defined questions.
export default function ResearchHub() {
  const { user } = useAuth();
  const isLead = (user?.tags || []).includes('lead_researcher');
  const [listings, setListings] = useState([]);
  const [myApps, setMyApps] = useState([]);
  const [filter, setFilter] = useState('All');
  const [applying, setApplying] = useState(null); // listing being applied to
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.listings().then(setListings).catch((e) => setError(e.message));
    api.myApplications().then(setMyApps).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  // Map listingId → application status so cards reflect real state on reload.
  const statusByListing = {};
  for (const a of myApps) if (a.listingId) statusByListing[a.listingId] = a.status;

  const categories = ['All', ...new Set(listings.map((l) => l.category))];
  const shown = filter === 'All' ? listings : listings.filter((l) => l.category === filter);

  return (
    <div>
      <h1 className="page-title">Research Hub</h1>
      <p className="page-sub">Every open project listing across Synthica — find one and apply.</p>
      <div className="info-block" style={{ marginBottom: '1rem' }}>
        {user?.resumeUrl
          ? '📎 Your résumé is attached automatically when you apply.'
          : <>No résumé on file — <Link to="/researcher/tools">add one in Tools</Link> to auto-apply.</>}
      </div>
      {error && <div className="login-error">{error}</div>}

      {isLead && <LeadTools onCreated={load} />}
      {isLead && <MyListings onChanged={load} />}

      <div className="row" style={{ marginBottom: '1.25rem' }}>
        {categories.map((c) => (
          <button
            key={c}
            className={`btn btn-sm ${filter === c ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState>No listings in this category yet.</EmptyState>
      ) : (
        <div className="grid grid-3">
          {shown.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              isMine={l.leadId === user.id}
              status={statusByListing[l.id]}
              onApply={() => setApplying(l)}
            />
          ))}
        </div>
      )}

      {applying && (
        <ApplyModal
          listing={applying}
          onClose={() => setApplying(null)}
          onApplied={() => { setApplying(null); load(); }}
        />
      )}
    </div>
  );
}

// One listing tile + its apply state. A listing's `customQuestions` (added by the
// Lead) only changes the apply modal, not the card.
function ListingCard({ listing: l, isMine, status, onApply }) {
  const spotsOpen = Math.max(0, (l.spots || 0) - Math.max(0, (l.filled || 1) - 1));
  const hasQuestions = Array.isArray(l.customQuestions) && l.customQuestions.length > 0;
  return (
    <Card className="paper-card listing-card">
      {l.bannerUrl && <img className="listing-banner" src={imageSrc(l.bannerUrl)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
      <div className="card-row">
        <Badge>{l.category}</Badge>
        <span className="muted">{spotsOpen} of {l.spots} spot{l.spots === 1 ? '' : 's'} open</span>
      </div>
      <h3>{l.title}</h3>
      <p className="muted" style={{ marginBottom: '0.6rem' }}>{l.description}</p>
      {l.lookingFor && (
        <div className="row" style={{ gap: '0.3rem', marginBottom: '0.6rem' }}>
          <span className="muted" style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Looking for</span>
          {l.lookingFor.split(',').map((t) => t.trim()).filter(Boolean).map((t) => <Badge key={t} tone="gold">{t}</Badge>)}
        </div>
      )}
      {hasQuestions && !isMine && !status && (
        <p className="muted" style={{ fontSize: '0.74rem', marginBottom: '0.6rem' }}>📝 A few questions to answer</p>
      )}
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="pfp-stack" title={(l.team || []).map((t) => t.name).join(', ')}>
          {(l.team || []).slice(0, 5).map((t) => (
            <Pfp key={t.id} name={t.name} url={imageSrc(t.avatarUrl)} size="xs" />
          ))}
          {(l.team || []).length > 5 && <span className="pfp pfp-xs pfp-more">+{l.team.length - 5}</span>}
          <span className="muted" style={{ marginLeft: '0.45rem', fontSize: '0.78rem' }}>{l.filled || 1} on board</span>
        </span>
        {isMine ? (
          <Badge tone="gold">Your listing</Badge>
        ) : status === 'approved' ? (
          <Badge tone="green">✓ Accepted</Badge>
        ) : status === 'rejected' ? (
          <Badge tone="red">Not selected</Badge>
        ) : status === 'pending' ? (
          <Badge tone="gray">Applied ✓</Badge>
        ) : (
          <Button className="btn-sm" onClick={onApply}>Apply</Button>
        )}
      </div>
    </Card>
  );
}

// Apply to a listing. Profile-only by default (a short message); if the Lead set
// custom questions on the listing, those are required here too (ROLE_WORKFLOWS §5.4).
function ApplyModal({ listing, onClose, onApplied }) {
  const toast = useToast();
  const { user } = useAuth();
  const questions = Array.isArray(listing.customQuestions) ? listing.customQuestions : [];
  const [message, setMessage] = useState('');
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const setAns = (key) => (e) => setAnswers((a) => ({ ...a, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.apply({
        listingId: listing.id,
        message: message.trim() || `Interested in ${listing.title}`,
        answers: questions.length ? answers : undefined,
      });
      toast.success('Application sent');
      onApplied();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Apply — ${listing.title}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="info-block" style={{ marginBottom: '0.85rem' }}>
          <div style={{ fontWeight: 600 }}>{user?.name}</div>
          <div className="muted" style={{ fontSize: '0.8rem' }}>
            {user?.institution ? `${user.institution} · ` : ''}
            {user?.resumeUrl
              ? <>Your profile and résumé are sent with this application.</>
              : <>Your profile is sent with this application. <Link to="/researcher/tools">Add a résumé</Link> to include one.</>}
          </div>
        </div>

        {questions.length > 0 ? (
          <>
            <p className="muted" style={{ marginTop: 0 }}>This Lead asks a few questions:</p>
            {questions.map((q, i) => {
              const key = q.key || q.label || `q${i}`;
              return (
                <Field key={key} label={`${q.label || key}${q.required ? ' *' : ''}`}>
                  {q.type === 'textarea'
                    ? <textarea value={answers[key] || ''} onChange={setAns(key)} required={q.required} />
                    : <input type="text" value={answers[key] || ''} onChange={setAns(key)} required={q.required} />}
                </Field>
              );
            })}
            <Field label="Anything else? (optional)">
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Add a short note for the Lead…" />
            </Field>
          </>
        ) : (
          <Field label="Add a short message (optional)">
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={`Why you'd like to join "${listing.title}"…`} />
          </Field>
        )}

        {error && <div className="login-error" style={{ marginBottom: '0.6rem' }}>{error}</div>}
        <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
          <Button type="button" variant="ghost" className="btn-sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="btn-sm" disabled={busy}>{busy ? 'Sending…' : 'Submit application'}</Button>
        </div>
      </form>
    </Modal>
  );
}

const CATS = ['Biology', 'Chemistry', 'Physics', 'Mathematics', 'Computer Science', 'Humanities', 'Economics', 'Psychology'];

// Lead's own listings: applicant analytics, accept/reject, edit, close.
function MyListings({ onChanged }) {
  const toast = useToast();
  const [mine, setMine] = useState([]);
  const [editing, setEditing] = useState(null); // listing id
  const load = useCallback(() => api.myListings().then(setMine).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const refresh = () => { load(); onChanged(); };
  const review = (a, status) =>
    api.reviewListingApplication(a.id, status).then(() => { toast.success(`${a.name} ${status}`); refresh(); }).catch((e) => toast.error(e.message));
  const remove = (l) => {
    if (!window.confirm(`Close “${l.title}”? Pending applicants will be notified.`)) return;
    api.deleteListing(l.id).then(() => { toast.success('Listing closed'); refresh(); }).catch((e) => toast.error(e.message));
  };

  if (!mine.length) return null;
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <h2 className="section-title" style={{ margin: '0 0 0.6rem' }}>My listings</h2>
      <div className="stack">
        {mine.map((l) => (
          <Card key={l.id}>
            <div className="card-row">
              <div style={{ minWidth: 0 }}>
                <strong>{l.title}</strong> <Badge tone="gray">{l.category}</Badge>
                <div className="row" style={{ gap: '0.35rem', marginTop: '0.35rem' }}>
                  <Badge tone="blue">{l.stats.applicants} applicant{l.stats.applicants === 1 ? '' : 's'}</Badge>
                  {l.stats.pending > 0 && <Badge tone="gold">{l.stats.pending} to review</Badge>}
                  <Badge tone={l.stats.approved >= l.spots ? 'green' : 'gray'}>{l.stats.approved}/{l.spots} spots filled</Badge>
                  {l.stats.rejected > 0 && <span className="muted" style={{ fontSize: '0.75rem' }}>{l.stats.rejected} passed on</span>}
                </div>
              </div>
              <div className="row" style={{ flexShrink: 0 }}>
                <Button className="btn-sm" variant="ghost" onClick={() => setEditing(editing === l.id ? null : l.id)}>{editing === l.id ? 'Cancel' : 'Edit'}</Button>
                <Button className="btn-sm" variant="reject" onClick={() => remove(l)}>Close</Button>
              </div>
            </div>

            {editing === l.id && <EditListingForm listing={l} onSaved={() => { setEditing(null); refresh(); toast.success('Listing updated'); }} />}

            {l.applicantsDetail.length > 0 && (
              <div className="stack" style={{ marginTop: '0.7rem', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
                {l.applicantsDetail.map((a) => (
                  <div key={a.id} className="card-row" style={{ alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <Link to={`/p/${a.slug}`} target="_blank"><strong>{a.name}</strong></Link>
                      {a.blurb && <span className="muted"> — {a.blurb}</span>}
                      <div className="muted" style={{ fontSize: '0.78rem', marginTop: '0.15rem' }}>
                        Research {a.researchExperience ?? '—'}/10 · Leadership {a.leadershipExperience ?? '—'}/10
                        {a.resumeUrl && <> · <a href={a.resumeUrl} target="_blank" rel="noreferrer">résumé</a></>}
                        {' · '}{new Date(a.at).toLocaleDateString()}
                      </div>
                      {a.message && <div className="muted" style={{ fontSize: '0.8rem', marginTop: '0.15rem' }}>“{a.message}”</div>}
                    </div>
                    <div className="row" style={{ flexShrink: 0 }}>
                      {a.status === 'pending' ? (
                        <>
                          <Button className="btn-sm" variant="approve" onClick={() => review(a, 'approved')}>Accept</Button>
                          <Button className="btn-sm" variant="reject" onClick={() => review(a, 'rejected')}>Pass</Button>
                        </>
                      ) : (
                        <Badge tone={a.status === 'approved' ? 'green' : 'red'}>{a.status}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

// Inline edit form, pre-filled from the listing.
function EditListingForm({ listing, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({ title: listing.title, category: listing.category || CATS[0], spots: listing.spots, description: listing.description || '', bannerUrl: listing.bannerUrl || '', lookingFor: listing.lookingFor || '' });
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await api.updateListing(listing.id, f); onSaved(); }
    catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={save} style={{ marginTop: '0.7rem', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
      <Field label="Title"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required /></Field>
      <div className="grid grid-3">
        <Field label="Subject"><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Open spots (people you want)"><input type="number" min="1" value={f.spots} onChange={(e) => setF({ ...f, spots: e.target.value })} /></Field>
      </div>
      <Field label="Description"><textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <Field label="Looking for (comma-separated)"><input value={f.lookingFor} onChange={(e) => setF({ ...f, lookingFor: e.target.value })} placeholder="data analyst, writer" /></Field>
      <Field label="Banner image URL"><input value={f.bannerUrl} onChange={(e) => setF({ ...f, bannerUrl: e.target.value })} placeholder="https://…" /></Field>
      <BannerPreview url={f.bannerUrl} />
      <Button type="submit" className="btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
    </form>
  );
}

// Live preview for a pasted banner URL — shows exactly what the card will render.
function BannerPreview({ url }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [url]);
  if (!url?.trim()) return null;
  if (bad) return <p className="muted" style={{ margin: '0 0 0.6rem', fontSize: '0.8rem' }}>⚠️ That image couldn't load — check the URL is a direct image link.</p>;
  return <img src={imageSrc(url)} alt="Banner preview" onError={() => setBad(true)} style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 12, margin: '0 0 0.6rem', border: '1px solid var(--border)' }} />;
}

// Leads post recruiting listings. Each listing carries its own banner.
function LeadTools({ onCreated }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [listing, setListing] = useState({ title: '', category: CATS[0], spots: 2, description: '', bannerUrl: '', lookingFor: '' });
  const [busy, setBusy] = useState(false);

  const submitListing = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.createListing(listing); setListing({ title: '', category: CATS[0], spots: 2, description: '', bannerUrl: '', lookingFor: '' }); setOpen(false); toast.success('Listing posted'); onCreated(); }
    catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <Card style={{ marginBottom: '1.25rem' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <strong>Lead tools</strong>
          <div className="muted" style={{ fontSize: '0.78rem' }}>Recruit collaborators for one of your projects.</div>
        </div>
        <div className="seg">
          <button type="button" className={`seg-btn ${open ? 'on' : ''}`} onClick={() => setOpen((v) => !v)}>📣 Post listing</button>
        </div>
      </div>
      {open && (
        <form onSubmit={submitListing} className="pop-in" style={{ marginTop: '0.75rem' }}>
          <Field label="Title"><input value={listing.title} onChange={(e) => setListing({ ...listing, title: e.target.value })} required /></Field>
          <div className="grid grid-3">
            <Field label="Subject">
              <select value={listing.category} onChange={(e) => setListing({ ...listing, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
            </Field>
            <Field label="Open spots (people you want)">
              <input type="number" min="1" value={listing.spots} onChange={(e) => setListing({ ...listing, spots: e.target.value })} />
            </Field>
          </div>
          <Field label="Description"><textarea value={listing.description} onChange={(e) => setListing({ ...listing, description: e.target.value })} /></Field>
          <Field label="Looking for (comma-separated, e.g. data analyst, writer)"><input value={listing.lookingFor} onChange={(e) => setListing({ ...listing, lookingFor: e.target.value })} placeholder="data analyst, writer, wet-lab" /></Field>
          <Field label="Banner image URL (optional — shows on the card)"><input value={listing.bannerUrl} onChange={(e) => setListing({ ...listing, bannerUrl: e.target.value })} placeholder="https://…" /></Field>
          <BannerPreview url={listing.bannerUrl} />
          <Button className="btn-sm" disabled={busy}>Post listing</Button>
        </form>
      )}
    </Card>
  );
}
