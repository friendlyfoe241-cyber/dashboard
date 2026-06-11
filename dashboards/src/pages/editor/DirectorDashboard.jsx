import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api.js';
import { Card, Badge, Button, EmptyState, Field } from '../../components/ui.jsx';

// Configure a Discord webhook so the whole server sees the queue: every time a
// paper moves up a level (or is declined), an embed is posted to the channel.
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
    try { await api.setWebhook(url); setStatus('Saved'); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const test = async () => {
    setBusy(true); setError(''); setStatus('');
    try { await api.setWebhook(url); await api.testWebhook(); setStatus('Test message sent — check your Discord channel'); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Card style={{ marginBottom: '1.5rem' }}>
      <div className="card-row">
        <h3>Discord queue notifications</h3>
        <Badge tone={url ? 'green' : 'gray'}>{url ? 'configured' : 'off'}</Badge>
      </div>
      <p className="muted" style={{ margin: '0.25rem 0 0.75rem' }}>
        Paste a Discord channel webhook URL. Every time a paper advances a level — or is declined —
        Synthica posts an update so your server can watch the queue live.
      </p>
      {error && <div className="login-error">{error}</div>}
      <Field label="Discord webhook URL">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://discord.com/api/webhooks/…" />
      </Field>
      <div className="row">
        <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        <Button variant="ghost" onClick={test} disabled={busy}>Send test</Button>
        {status && <span className="muted">{status}</span>}
      </div>
      <p className="muted" style={{ marginTop: '0.6rem', fontSize: '0.78rem' }}>
        Tip: in Discord → Channel settings → Integrations → Webhooks → New Webhook → Copy URL.
        Set <code>DISCORD_WEBHOOK_URL</code> on the backend to make it persist across restarts.
      </p>
    </Card>
  );
}

// Editor workload at a glance (helps balance reassignment decisions).
function WorkloadCard() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.workload().then(setRows).catch(() => {});
  }, []);
  if (!rows.length) return null;
  const top = rows.slice(0, 6);
  return (
    <Card style={{ marginBottom: '1.5rem' }}>
      <h3>Editor workload</h3>
      <p className="muted" style={{ margin: '0.25rem 0 0.6rem' }}>Active papers per editor (highest first).</p>
      <div className="stack">
        {top.map((e) => (
          <div key={e.id} className="card-row">
            <span>{e.name} <Badge tone="gray">{e.role}{e.category ? ` · ${e.category}` : ''}</Badge></span>
            <Badge tone={e.load >= 3 ? 'red' : 'blue'}>{e.load} active</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Download the Director's "papers to email" list as a CSV.
function exportEmailsCsv(rows) {
  const head = ['Paper', 'Author', 'Email', 'State', 'Decision', 'At', 'Emailed'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = rows.map((e) => [e.title, e.authorName, e.authorEmail, e.state, e.decision, e.at, e.emailed ? 'yes' : 'no'].map(esc).join(','));
  const csv = [head.join(','), ...body].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'synthica-papers-to-email.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// Director's desk: two sections — "Papers to email" (every decision in the
// pipeline, with the state it reached) and "Papers to publish" (finished papers).
export default function DirectorDashboard() {
  const [data, setData] = useState({ toEmail: [], toPublish: [] });
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.director().then(setData).catch((e) => setError(e.message));
  }, []);
  // Live polling so papers appear as they move through the pipeline.
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const markEmailed = (paperId, at) =>
    api.markEmailed({ paperId, at }).then(load).catch((e) => setError(e.message));

  const publish = (paperId) =>
    api.publish({ paperId }).then(load).catch((e) => setError(e.message));

  return (
    <div>
      <h1 className="page-title">Director Desk</h1>
      <p className="page-sub">Send author emails for every decision, and publish finished papers to the journal.</p>

      <WebhookCard />
      <WorkloadCard />

      {error && <div className="login-error">{error}</div>}

      <div className="card-row" style={{ marginBottom: '0.75rem' }}>
        <h2 className="section-title">
          Papers to email <Badge tone="gray">{data.toEmail.filter((e) => !e.emailed).length}</Badge>
        </h2>
        {data.toEmail.length > 0 && (
          <Button variant="ghost" className="btn-sm" onClick={() => exportEmailsCsv(data.toEmail)}>
            Export CSV
          </Button>
        )}
      </div>
      {data.toEmail.length === 0 ? (
        <EmptyState>No author emails pending.</EmptyState>
      ) : (
        <div className="stack">
          {data.toEmail.map((e, i) => (
            <Card key={`${e.paperId}-${i}`}>
              <div className="card-row">
                <div>
                  <div className="row">
                    <Badge tone={e.decision === 'approved' ? 'green' : 'red'}>{e.decision}</Badge>
                    <strong>{e.title}</strong>
                  </div>
                  <p className="muted" style={{ margin: '0.35rem 0 0' }}>
                    State: {e.state} · {e.authorName} ·{' '}
                    <a href={`mailto:${e.authorEmail}`}>{e.authorEmail}</a>
                  </p>
                </div>
                {e.emailed ? (
                  <Badge tone="blue">emailed</Badge>
                ) : (
                  <Button className="btn-sm" onClick={() => markEmailed(e.paperId, e.at)}>
                    Mark emailed
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <h2 className="section-title" style={{ margin: '2rem 0 0.75rem' }}>
        Papers to publish <Badge tone="gray">{data.toPublish.length}</Badge>
      </h2>
      {data.toPublish.length === 0 ? (
        <EmptyState>No papers ready to publish.</EmptyState>
      ) : (
        <div className="grid grid-2">
          {data.toPublish.map((p) => (
            <Card key={p.id} className="paper-card">
              <div className="card-row">
                <Badge>{p.category}</Badge>
                <Badge tone="gold">approved</Badge>
              </div>
              <h3>{p.title}</h3>
              <p className="paper-meta">{p.authorName}</p>
              <Button className="btn-sm" onClick={() => publish(p.id)}>
                Publish to journal (assign DOI)
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
