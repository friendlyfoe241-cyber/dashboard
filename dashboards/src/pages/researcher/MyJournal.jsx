import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api.js';
import { Card, Badge, Button, Field, EmptyState } from '../../components/ui.jsx';
import { useToast } from '../../components/toast.jsx';
import UploadButton from '../../components/UploadButton.jsx';

const CATEGORIES = ['Biology', 'Chemistry', 'Physics', 'Mathematics', 'Computer Science', 'Humanities', 'Economics', 'Psychology'];

// The editorial pipeline as an ordered list of steps. `key` matches the backend
// `stage` for the current step; the stepper lights up everything up to and
// including the paper's current stage. (Declined is handled separately.)
const PIPELINE = [
  { key: 'review', short: 'Reviews', label: 'Reviews editors' },
  { key: 'senior_screen', short: 'Senior', label: 'Senior screen' },
  { key: 'associate', short: 'Associate', label: 'Associate revisions' },
  { key: 'senior_final', short: 'Final', label: 'Senior final check' },
  { key: 'chief', short: 'Chief', label: 'Editor-in-chief' },
  { key: 'published', short: 'Published', label: 'Published' },
];
const STAGE_INDEX = Object.fromEntries(PIPELINE.map((s, i) => [s.key, i]));

// Researchers submit papers to the journal, track each one through the
// editorial pipeline, upload revisions, and self-archive past papers.
export default function MyJournal() {
  const toast = useToast();
  const [subs, setSubs] = useState(null); // null = loading
  const [pubs, setPubs] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.mySubmissions().then(setSubs).catch((e) => { setError(e.message); setSubs([]); });
    api.myPublications().then(setPubs).catch(() => setPubs([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (subs === null || pubs === null) return <div className="page-loading">Loading your journal…</div>;

  return (
    <div>
      <h1 className="page-title">Synthica Journal</h1>
      <p className="page-sub">Submit new research for review, follow it through the editorial pipeline, and add your past papers to the archive.</p>
      {error && <div className="login-error">{error}</div>}

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <SubmitForm onSubmitted={() => { load(); toast.success('Submitted — your paper is on its way to the reviews editors'); }} />

        <div>
          <h2 className="section-title" style={{ marginBottom: '0.75rem' }}>
            My submissions <Badge tone="gray">{subs.length}</Badge>
          </h2>
          {subs.length === 0 ? (
            <EmptyState>Nothing submitted yet — send your first paper and track it here.</EmptyState>
          ) : (
            <div className="stack">
              {subs.map((s) => (
                <SubmissionCard key={s.id} sub={s} onChange={() => { load(); toast.success('Revision uploaded'); }} />
              ))}
            </div>
          )}
        </div>
      </div>

      <MyArchive pubs={pubs} onAdded={() => { load(); toast.success('Added to your archive'); }} />
    </div>
  );
}

// Submit a paper straight into the editorial pipeline.
function SubmitForm({ onSubmitted }) {
  const [form, setForm] = useState({ title: '', category: CATEGORIES[0], abstract: '', pdfUrl: '', coAuthors: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.submitJournal(form);
      setForm({ title: '', category: CATEGORIES[0], abstract: '', pdfUrl: '', coAuthors: '' });
      onSubmitted();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h3 style={{ marginTop: 0 }}>Submit a paper</h3>
      {error && <div className="login-error">{error}</div>}
      <form onSubmit={submit}>
        <Field label="Title"><input value={form.title} onChange={set('title')} placeholder="The title of your paper" required /></Field>
        <Field label="Subject">
          <select value={form.category} onChange={set('category')}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Abstract"><textarea value={form.abstract} onChange={set('abstract')} rows={4} placeholder="A short summary of your research" required /></Field>
        <Field label="Your paper (upload a PDF or paste a link)">
          <div className="row" style={{ gap: '0.4rem' }}>
            <input value={form.pdfUrl} onChange={set('pdfUrl')} placeholder="https://… or upload" required />
            <UploadButton kind="pdf" label="Upload PDF" onUploaded={(r) => setForm((x) => ({ ...x, pdfUrl: r.url }))} />
          </div>
        </Field>
        <Field label="Co-authors — tag members with @username (checked on submit)">
          <input value={form.coAuthors} onChange={set('coAuthors')} placeholder="Ada Lovelace, @benv" />
        </Field>
        <Button type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit to journal'}</Button>
      </form>

      <div className="info-block" style={{ marginTop: '1rem' }}>
        <strong>What happens next</strong>
        <p className="muted" style={{ margin: '0.35rem 0 0' }}>
          Your paper is routed to two <strong>Reviews Editors</strong> in your subject. If both approve, it moves on
          to a Senior Editor, an Associate Editor (revision rounds), a final Senior check, and the Editor-in-Chief —
          then it's published. You'll see its stage update right here, and you can upload revisions any time an editor asks.
        </p>
      </div>
    </Card>
  );
}

// One submitted paper: live pipeline status + version history + revision upload.
function SubmissionCard({ sub, onChange }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ url: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const declined = sub.stage === 'rejected';
  const published = sub.stage === 'published';
  const currentIdx = STAGE_INDEX[sub.stage] ?? 0;

  const revise = async () => {
    if (!form.url.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api.reviseSubmission(sub.id, form);
      setForm({ url: '', note: '' });
      setOpen(false);
      onChange();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const statusBadge = declined
    ? <Badge tone="red">Declined</Badge>
    : sub.revisionRequested
      ? <Badge tone="gold">Revision requested</Badge>
      : <Badge tone={published ? 'green' : 'blue'}>{sub.stageLabel}</Badge>;

  return (
    <Card>
      <div className="card-row">
        <strong>{sub.title}</strong>
        {statusBadge}
      </div>
      <p className="muted" style={{ margin: '0.35rem 0 0.6rem' }}>
        <Badge tone="gray">{sub.category}</Badge> · v{sub.revisions.length} · submitted {new Date(sub.submittedAt).toLocaleDateString()}
      </p>

      {/* pipeline stepper */}
      {declined ? (
        <div className="info-block" style={{ borderColor: 'var(--border)' }}>
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            This paper wasn't accepted this round. Check your email for the editors' feedback — you can revise and resubmit a new version.
          </span>
        </div>
      ) : (
        <ol className="pipeline" aria-label="Editorial pipeline progress">
          {PIPELINE.map((step, i) => {
            const state = i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'todo';
            return (
              <li key={step.key} className={`pipeline-step ${state}`}>
                <span className="pipeline-dot">{state === 'done' ? '✓' : i + 1}</span>
                <span className="pipeline-label">{step.short}</span>
              </li>
            );
          })}
        </ol>
      )}

      {/* version history */}
      <details style={{ marginTop: '0.6rem' }}>
        <summary className="muted" style={{ cursor: 'pointer' }}>Version history ({sub.revisions.length})</summary>
        <div className="stack" style={{ marginTop: '0.4rem' }}>
          {sub.revisions.map((r) => (
            <div key={r.version} className="muted" style={{ fontSize: '0.8rem' }}>
              v{r.version} · <a href={r.url} target="_blank" rel="noreferrer">file</a> · {new Date(r.at).toLocaleDateString()}{r.note ? ` — ${r.note}` : ''}
            </div>
          ))}
        </div>
      </details>

      {error && <div className="login-error" style={{ marginTop: '0.5rem' }}>{error}</div>}

      {!published && (
        <div className="row" style={{ marginTop: '0.6rem' }}>
          <Button variant={sub.revisionRequested ? 'primary' : 'ghost'} className="btn-sm" onClick={() => setOpen((o) => !o)}>
            {open ? 'Cancel' : sub.revisionRequested ? 'Upload requested revision' : 'Upload revision'}
          </Button>
        </div>
      )}
      {open && (
        <div className="info-block" style={{ marginTop: '0.5rem' }}>
          <Field label="Link to revised paper">
            <input placeholder="https://…" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          </Field>
          <Field label="What changed? (optional)">
            <input placeholder="e.g. Addressed reviewer comments on methods" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
          <Button className="btn-sm" disabled={busy || !form.url.trim()} onClick={revise}>{busy ? 'Uploading…' : 'Submit revision'}</Button>
        </div>
      )}
    </Card>
  );
}

// Self-archive of the researcher's past/published papers (shown on their
// profile; new additions are verified by an auditor before the public archive).
function MyArchive({ pubs, onAdded }) {
  const [open, setOpen] = useState(false);
  return (
    <section style={{ marginTop: '2rem' }}>
      <div className="card-row" style={{ marginBottom: '0.6rem' }}>
        <h2 className="section-title" style={{ margin: 0 }}>My published archive <Badge tone="gray">{pubs.length}</Badge></h2>
        <Button onClick={() => setOpen((o) => !o)}>{open ? 'Close' : '+ Add a past paper'}</Button>
      </div>
      <p className="muted" style={{ margin: '0 0 0.6rem' }}>
        Already published research elsewhere? Add it so it shows on your profile. New entries are reviewed before appearing in the public archive.
      </p>
      {open && <PastPaperForm onAdded={() => { setOpen(false); onAdded(); }} />}
      {pubs.length === 0 ? (
        !open && <EmptyState>No archived papers yet. Add work you've already published to show it on your profile.</EmptyState>
      ) : (
        <div className="stack">
          {pubs.map((p) => (
            <Card key={p.id || p.doi}>
              <div className="card-row">
                <div>
                  <a href={`/article.html?doi=${encodeURIComponent(p.doi)}`} target="_blank" rel="noreferrer"><strong>{p.title}</strong></a>
                  {' '}{p.verified === false && <Badge tone="gold">awaiting verification</Badge>}
                  <div className="muted" style={{ fontSize: '0.8rem' }}>{(p.authors || []).map((a) => a.name).join(', ')} · {p.category} · {p.publishedAt}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

// Compact past-paper form (metadata + link). Co-authors are entered by name,
// or @username to link Synthica members.
function PastPaperForm({ onAdded }) {
  const toast = useToast();
  const [f, setF] = useState({ title: '', category: CATEGORIES[0], abstract: '', doi: '', pdfUrl: '', sourceUrl: '', publishedAt: '', coAuthors: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const coAuthors = f.coAuthors.split(',').map((s) => s.trim()).filter(Boolean).map((name) => ({ name }));
      await api.addPastPaper({ ...f, authors: coAuthors });
      setF({ title: '', category: CATEGORIES[0], abstract: '', doi: '', pdfUrl: '', sourceUrl: '', publishedAt: '', coAuthors: '' });
      onAdded();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <Card style={{ marginBottom: '0.6rem' }}>
      <form onSubmit={submit}>
        <Field label="Title"><input value={f.title} onChange={set('title')} required /></Field>
        <div className="grid grid-2">
          <Field label="Subject"><select value={f.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Published date"><input type="date" value={f.publishedAt} onChange={set('publishedAt')} /></Field>
        </div>
        <Field label="Abstract"><textarea value={f.abstract} onChange={set('abstract')} rows={3} /></Field>
        <div className="grid grid-2">
          <Field label="DOI / arXiv id (optional)"><input value={f.doi} onChange={set('doi')} placeholder="10.xxxx/… or arXiv:…" /></Field>
          <Field label="Link to paper"><input value={f.pdfUrl} onChange={set('pdfUrl')} placeholder="https://…" /></Field>
        </div>
        <Field label="Co-authors — names, or @username to link Synthica members">
          <input value={f.coAuthors} onChange={set('coAuthors')} placeholder="Ada Lovelace, @benv" />
        </Field>
        <Button type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add to my archive'}</Button>
      </form>
    </Card>
  );
}
