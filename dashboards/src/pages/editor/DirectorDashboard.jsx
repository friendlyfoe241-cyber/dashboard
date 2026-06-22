import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../../api.js';
import { Card, Badge, Button, EmptyState, Field } from '../../components/ui.jsx';

// ---------------------------------------------------------------------------
// Director Desk — the top of the editorial pipeline.
//
// Two jobs, two sections (JOURNAL_PIPELINE §9.6):
//   1. Papers to email   — every approve/reject decision across all stages.
//                          The Director emails the author, then marks it sent.
//   2. Papers to publish — Chief-approved papers. "Mark published" mints a DOI,
//                          creates the public Publication, and notifies everyone.
// Supporting panels: editor workload, reviews-editor reassignment, and the
// Discord webhook used for live queue notifications.
// ---------------------------------------------------------------------------

const fmtDate = (s) => {
  if (!s) return '';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};
const fmtDay = (s) => {
  if (!s) return '';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleDateString(undefined, { dateStyle: 'medium' });
};

// Download the "papers to email" list (respecting the active filter) as CSV.
function exportEmailsCsv(rows) {
  const head = ['Paper ID', 'Title', 'Author', 'Author email', 'Category', 'Stage', 'Decision', 'Decided at', 'Emailed', 'Emailed at'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = rows.map((e) =>
    [e.paperId, e.title, e.authorName, e.authorEmail, e.category, e.state, e.decision, e.at, e.emailed ? 'yes' : 'no', e.emailedAt || ''].map(esc).join(',')
  );
  const csv = [head.join(','), ...body].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `synthica-papers-to-email-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// A compact metric tile for the "act now" header.
function Stat({ label, value, tone = 'blue' }) {
  return (
    <div className="dd-stat">
      <span className={`dd-stat-num dd-stat-${tone}`}>{value}</span>
      <span className="dd-stat-label">{label}</span>
    </div>
  );
}

// === Papers to email =======================================================
function EmailQueue({ rows, onMarkEmailed }) {
  const [stage, setStage] = useState('all');
  const [decision, setDecision] = useState('all');
  const [hideEmailed, setHideEmailed] = useState(true);

  const stages = useMemo(() => Array.from(new Set(rows.map((r) => r.state))).sort(), [rows]);
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (stage === 'all' || r.state === stage) &&
          (decision === 'all' || r.decision === decision) &&
          (!hideEmailed || !r.emailed)
      ),
    [rows, stage, decision, hideEmailed]
  );
  const pending = rows.filter((r) => !r.emailed).length;

  return (
    <section style={{ marginBottom: '2rem' }}>
      <div className="card-row dd-section-head">
        <h2 className="section-title">
          Papers to email <Badge tone={pending ? 'gold' : 'gray'}>{pending} to send</Badge>
        </h2>
        {rows.length > 0 && (
          <Button variant="ghost" size="btn-sm" onClick={() => exportEmailsCsv(filtered)}>
            Export CSV
          </Button>
        )}
      </div>
      <p className="muted dd-section-sub">
        Every approve/reject decision in the pipeline lands here. Email the author the outcome, then mark it sent.
      </p>

      {rows.length > 0 && (
        <div className="row dd-filters">
          <label className="dd-filter">
            <span>Stage</span>
            <select value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="all">All stages</option>
              {stages.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="dd-filter">
            <span>Decision</span>
            <select value={decision} onChange={(e) => setDecision(e.target.value)}>
              <option value="all">All</option>
              <option value="approved">Approved</option>
              <option value="declined">Declined</option>
            </select>
          </label>
          <label className="dd-check">
            <input type="checkbox" checked={hideEmailed} onChange={(e) => setHideEmailed(e.target.checked)} />
            <span>Hide already-emailed</span>
          </label>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState>No decisions yet — author emails will appear here as papers are reviewed.</EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState>Nothing matches these filters{hideEmailed ? ' — every decision has been emailed. 🎉' : '.'}</EmptyState>
      ) : (
        <Card className="dd-table-card">
          <table className="dd-table">
            <thead>
              <tr>
                <th>Paper</th>
                <th>Author</th>
                <th>Stage</th>
                <th>Decision</th>
                <th className="dd-num">Decided</th>
                <th className="dd-action" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={`${e.paperId}-${e.at}`} className={e.emailed ? 'dd-done' : ''}>
                  <td>
                    <div className="dd-title">{e.title}</div>
                    <div className="dd-id muted">{e.paperId} · {e.category}</div>
                  </td>
                  <td>
                    <div>{e.authorName}</div>
                    <a className="dd-email" href={`mailto:${e.authorEmail}?subject=${encodeURIComponent(`Your Synthica submission: ${e.title}`)}`}>
                      {e.authorEmail}
                    </a>
                  </td>
                  <td><span className="dd-stage">{e.state}</span></td>
                  <td>
                    <Badge tone={e.decision === 'approved' ? 'green' : 'red'}>{e.decision}</Badge>
                  </td>
                  <td className="dd-num muted">{fmtDay(e.at)}</td>
                  <td className="dd-action">
                    {e.emailed ? (
                      <span className="dd-emailed muted" title={fmtDate(e.emailedAt)}>✓ emailed</span>
                    ) : (
                      <Button size="btn-sm" onClick={() => onMarkEmailed(e.paperId, e.at)}>Mark emailed</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}

// === Papers to publish =====================================================
function PublishCard({ paper, onPublish }) {
  const [open, setOpen] = useState(false);
  const [volume, setVolume] = useState('');
  const [issue, setIssue] = useState('');
  const [pages, setPages] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    try {
      await onPublish(paper.id, {
        volume: volume ? Number(volume) : undefined,
        issue: issue ? Number(issue) : undefined,
        pages: pages.trim() || undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="paper-card dd-publish">
      <div className="card-row">
        <Badge>{paper.category}</Badge>
        <Badge tone="gold">ready to publish</Badge>
      </div>
      <h3>{paper.title}</h3>
      <p className="paper-meta">
        {paper.authorName} · <a href={`mailto:${paper.authorEmail}`}>{paper.authorEmail}</a>
      </p>
      {paper.abstract && <p className="dd-abstract muted">{paper.abstract}</p>}
      <div className="dd-meta-grid muted">
        <span>{paper.id}</span>
        <span>Submitted {fmtDay(paper.submittedAt)}</span>
        {paper.pdfUrl && <a href={paper.pdfUrl} target="_blank" rel="noreferrer">Open PDF ↗</a>}
      </div>

      {open && (
        <div className="dd-pub-form">
          <div className="row">
            <label className="dd-filter dd-pub-num">
              <span>Volume</span>
              <input type="number" min="1" value={volume} onChange={(e) => setVolume(e.target.value)} placeholder="1" />
            </label>
            <label className="dd-filter dd-pub-num">
              <span>Issue</span>
              <input type="number" min="1" value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="1" />
            </label>
            <label className="dd-filter">
              <span>Pages</span>
              <input value={pages} onChange={(e) => setPages(e.target.value)} placeholder="1–8" />
            </label>
          </div>
        </div>
      )}

      <div className="row dd-pub-actions">
        <Button size="btn-sm" onClick={go} disabled={busy}>
          {busy ? 'Publishing…' : 'Mark published & assign DOI'}
        </Button>
        <Button variant="ghost" size="btn-sm" onClick={() => setOpen((v) => !v)} disabled={busy}>
          {open ? 'Hide volume/issue' : 'Set volume/issue'}
        </Button>
      </div>
    </Card>
  );
}

function PublishQueue({ rows, onPublish }) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <div className="dd-section-head">
        <h2 className="section-title">
          Papers to publish <Badge tone={rows.length ? 'gold' : 'gray'}>{rows.length}</Badge>
        </h2>
      </div>
      <p className="muted dd-section-sub">
        Chief-approved papers. Publishing mints a DOI, posts the paper to the public Archive, and notifies the author and reviewers.
      </p>
      {rows.length === 0 ? (
        <EmptyState>No papers ready to publish. Chief-approved papers will appear here.</EmptyState>
      ) : (
        <div className="grid grid-2">
          {rows.map((p) => (
            <PublishCard key={p.id} paper={p} onPublish={onPublish} />
          ))}
        </div>
      )}
    </section>
  );
}

// Recently published papers — confirmation that the DOI was minted + Archive link.
function PublishedList({ rows }) {
  if (!rows.length) return null;
  return (
    <section style={{ marginBottom: '2rem' }}>
      <div className="dd-section-head">
        <h2 className="section-title">Recently published <Badge tone="green">{rows.length}</Badge></h2>
      </div>
      <Card className="dd-table-card">
        <table className="dd-table">
          <thead>
            <tr><th>Paper</th><th>DOI</th><th className="dd-num">Published</th><th className="dd-action" /></tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="dd-title">{p.title}</div>
                  <div className="dd-id muted">{p.authorName} · {p.category}</div>
                </td>
                <td><code className="dd-doi">{p.doi}</code></td>
                <td className="dd-num muted">{fmtDay(p.publishedAt)}</td>
                <td className="dd-action">
                  <a className="btn btn-ghost btn-sm" href={`/archive?q=${encodeURIComponent(p.title)}`}>View in Archive</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}

// === Editor workload =======================================================
function WorkloadCard() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.workload().then(setRows).catch(() => {});
  }, []);
  if (!rows.length) return null;
  const max = Math.max(1, ...rows.map((e) => e.load));
  const top = rows.slice(0, 8);
  return (
    <Card className="dd-panel">
      <h3>Editor workload</h3>
      <p className="muted dd-panel-sub">Active papers per editor — spot anyone overloaded before reassigning.</p>
      <div className="stack">
        {top.map((e) => (
          <div key={e.id} className="dd-load-row">
            <span className="dd-load-name">
              {e.name} <span className="muted">{e.role}{e.category ? ` · ${e.category}` : ''}</span>
            </span>
            <span className="dd-load-bar">
              <span className="dd-load-fill" style={{ width: `${(e.load / max) * 100}%`, background: e.load >= 3 ? 'var(--danger, #e5484d)' : 'var(--brand, #4f7cff)' }} />
            </span>
            <span className="dd-load-num">{e.load}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// === Reassign a reviews editor =============================================
function ReassignCard({ onChanged }) {
  const [board, setBoard] = useState([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busyKey, setBusyKey] = useState('');

  const load = useCallback(() => {
    api.reassignBoard().then(setBoard).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const swap = async (paperId, fromEditorId, toEditorId) => {
    if (!toEditorId) return;
    setBusyKey(`${paperId}:${fromEditorId}`); setError(''); setStatus('');
    try {
      await api.reassign({ paperId, fromEditorId, toEditorId });
      setStatus('Reviewer reassigned.');
      load();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyKey('');
    }
  };

  return (
    <Card className="dd-panel">
      <h3>Reassign a reviews editor</h3>
      <p className="muted dd-panel-sub">
        Swap an assigned reviewer (same category) while a paper is still in first-pass review. Any review they left is cleared.
      </p>
      {error && <div className="login-error">{error}</div>}
      {status && <p className="muted dd-ok">{status}</p>}
      {board.length === 0 ? (
        <p className="muted">No papers are in the reviews stage right now.</p>
      ) : (
        <div className="stack dd-reassign">
          {board.map((p) => (
            <div key={p.paperId} className="dd-reassign-row">
              <div className="dd-title">{p.title}</div>
              <div className="dd-id muted">{p.paperId} · {p.category}</div>
              {p.assigned.map((a) => (
                <div key={a.id} className="dd-reassign-slot">
                  <span>
                    {a.name} <span className="muted">({a.load} active){a.reviewed ? ' · already reviewed' : ''}</span>
                  </span>
                  {p.candidates.length > 0 ? (
                    <select
                      defaultValue=""
                      disabled={busyKey === `${p.paperId}:${a.id}`}
                      onChange={(e) => swap(p.paperId, a.id, e.target.value)}
                    >
                      <option value="" disabled>Swap to…</option>
                      {p.candidates.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.load})</option>
                      ))}
                    </select>
                  ) : (
                    <span className="muted">no spare reviewer</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// === Discord webhook =======================================================
function WebhookCard() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getSettings().then((s) => setUrl(s.discordWebhookUrl || '')).catch(() => {});
  }, []);

  const save = async () => {
    setBusy(true); setError(''); setStatus('');
    try { await api.setWebhook(url); setStatus('Saved.'); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const test = async () => {
    setBusy(true); setError(''); setStatus('');
    try { await api.setWebhook(url); await api.testWebhook(); setStatus('Test message sent — check your Discord channel.'); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Card className="dd-panel">
      <div className="card-row">
        <h3>Discord queue notifications</h3>
        <Badge tone={url ? 'green' : 'gray'}>{url ? 'configured' : 'off'}</Badge>
      </div>
      <p className="muted dd-panel-sub">
        Post an embed to your channel every time a paper advances — or is declined or published — so the team watches the queue live.
      </p>
      {error && <div className="login-error">{error}</div>}
      <Field label="Discord webhook URL">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://discord.com/api/webhooks/…" />
      </Field>
      <div className="row">
        <Button onClick={save} disabled={busy} size="btn-sm">{busy ? 'Saving…' : 'Save'}</Button>
        <Button variant="ghost" onClick={test} disabled={busy} size="btn-sm">Send test</Button>
        {status && <span className="muted">{status}</span>}
      </div>
      <p className="muted dd-hint">
        Discord → Channel settings → Integrations → Webhooks → New Webhook → Copy URL.
        Set <code>DISCORD_WEBHOOK_URL</code> on the backend to persist across restarts.
      </p>
    </Card>
  );
}

// === Page ==================================================================
export default function DirectorDashboard() {
  const [data, setData] = useState({ toEmail: [], toPublish: [], published: [] });
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    api.director()
      .then((d) => { setData({ toEmail: [], toPublish: [], published: [], ...d }); setLoaded(true); })
      .catch((e) => { setError(e.message); setLoaded(true); });
  }, []);
  // Live polling so papers appear as they move through the pipeline.
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const markEmailed = (paperId, at) =>
    api.markEmailed({ paperId, at }).then(load).catch((e) => setError(e.message));

  const publish = (paperId, opts = {}) =>
    api.publish({ paperId, ...opts }).then(load).catch((e) => { setError(e.message); throw e; });

  const pendingEmails = data.toEmail.filter((e) => !e.emailed).length;

  return (
    <div className="dd">
      <h1 className="page-title">Director Desk</h1>
      <p className="page-sub">Email authors the outcome of every decision, and publish accepted papers to the journal.</p>

      <div className="dd-stats">
        <Stat label="emails to send" value={pendingEmails} tone={pendingEmails ? 'gold' : 'gray'} />
        <Stat label="ready to publish" value={data.toPublish.length} tone={data.toPublish.length ? 'gold' : 'gray'} />
        <Stat label="published" value={data.published.length} tone="green" />
      </div>

      {error && <div className="login-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {loaded && (
        <>
          <EmailQueue rows={data.toEmail} onMarkEmailed={markEmailed} />
          <PublishQueue rows={data.toPublish} onPublish={publish} />
          <PublishedList rows={data.published} />
        </>
      )}

      <h2 className="section-title dd-tools-head">Editorial controls</h2>
      <div className="grid grid-2 dd-panels">
        <WorkloadCard />
        <ReassignCard onChanged={load} />
        <WebhookCard />
      </div>
    </div>
  );
}
