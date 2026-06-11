import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api.js';
import { Card, Badge, Button, Field, EmptyState } from '../../components/ui.jsx';
import { useToast } from '../../components/toast.jsx';

const CATEGORIES = ['Biology', 'Chemistry', 'Physics', 'Mathematics', 'Computer Science', 'Humanities', 'Economics', 'Psychology'];

// Researchers submit papers to the journal and manage revisions here.
export default function MyJournal() {
  const toast = useToast();
  const [subs, setSubs] = useState([]);
  const [error, setError] = useState('');

  const [pubs, setPubs] = useState([]);
  const load = useCallback(() => {
    api.mySubmissions().then(setSubs).catch((e) => setError(e.message));
    api.myPublications().then(setPubs).catch(() => {});
  }, []);
  useEffect(load, [load]);

  return (
    <div>
      <h1 className="page-title">Synthica Journal</h1>
      <p className="page-sub">Submit new research for review, and add your past papers to the archive.</p>
      {error && <div className="login-error">{error}</div>}

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <SubmitForm onSubmitted={() => { load(); toast.success('Submitted to the journal'); }} />

        <div>
          <h2 className="section-title" style={{ marginBottom: '0.75rem' }}>
            My submissions <Badge tone="gray">{subs.length}</Badge>
          </h2>
          {subs.length === 0 ? (
            <EmptyState>Nothing submitted yet — send your first paper.</EmptyState>
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

// Self-archive of the researcher's past/published papers (links to their profile;
// new additions are verified by an auditor before they hit the public archive).
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
      {pubs.length > 0 && (
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

// Compact past-paper form (metadata + link). Co-authors are entered by name.
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
      <h3>Submit a paper</h3>
      {error && <div className="login-error">{error}</div>}
      <form onSubmit={submit}>
        <Field label="Title"><input value={form.title} onChange={set('title')} required /></Field>
        <Field label="Subject">
          <select value={form.category} onChange={set('category')}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Abstract"><textarea value={form.abstract} onChange={set('abstract')} required /></Field>
        <Field label="Link to your paper (Google Drive, PDF…)"><input value={form.pdfUrl} onChange={set('pdfUrl')} placeholder="https://…" required /></Field>
        <Field label="Co-authors — tag members with @username (checked on submit)">
          <input value={form.coAuthors} onChange={set('coAuthors')} placeholder="Ada Lovelace, @benv" />
        </Field>
        <Button type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit to journal'}</Button>
      </form>
    </Card>
  );
}

function SubmissionCard({ sub, onChange }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ url: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <Card>
      <div className="card-row">
        <strong>{sub.title}</strong>
        {sub.revisionRequested ? <Badge tone="gold">revision requested</Badge> : <Badge tone="blue">{sub.stageLabel}</Badge>}
      </div>
      <p className="muted" style={{ margin: '0.35rem 0' }}>
        <Badge tone="gray">{sub.category}</Badge> · v{sub.revisions.length} · submitted {new Date(sub.submittedAt).toLocaleDateString()}
      </p>

      {/* version history */}
      <details>
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

      <div className="row" style={{ marginTop: '0.6rem' }}>
        <Button variant={sub.revisionRequested ? 'primary' : 'ghost'} className="btn-sm" onClick={() => setOpen((o) => !o)}>
          {open ? 'Cancel' : 'Upload revision'}
        </Button>
      </div>
      {open && (
        <div className="info-block" style={{ marginTop: '0.5rem' }}>
          <input placeholder="Link to revised paper" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} style={{ marginBottom: '0.5rem' }} />
          <input placeholder="What changed? (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={{ marginBottom: '0.5rem' }} />
          <Button className="btn-sm" disabled={busy} onClick={revise}>{busy ? 'Uploading…' : 'Submit revision'}</Button>
        </div>
      )}
    </Card>
  );
}
