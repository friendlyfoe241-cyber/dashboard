import { useState, useEffect } from 'react';
import { api } from '../../api.js';
import { Card, Button, Field } from '../../components/ui.jsx';
import { useToast } from '../../components/toast.jsx';

// Send direct emails to researchers or all members
export default function Email() {
  const toast = useToast();
  const [cfg, setCfg] = useState(null);
  const [f, setF] = useState({ to: '', subject: '', heading: '', body: '', audience: 'researchers' });
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.config().then(setCfg).catch(() => {}); }, []);

  const send = async (e) => {
    e.preventDefault();
    if (!f.subject || !f.body) {
      toast.error('Subject and body are required');
      return;
    }
    setBusy(true);
    try {
      const r = await api.adminBroadcast({ ...f });
      toast.success(`Email sent to ${r.sent} recipients`);
      setF({ ...f, subject: '', heading: '', body: '' });
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <h1 className="page-title">Send Email</h1>
      <p className="page-sub">Send direct emails to researchers or all members.</p>

      <Card>
        {cfg && cfg.emailConfigured === false && (
          <p style={{ marginTop: 0, color: '#92400e', background: '#fffbeb', padding: '0.5rem', borderRadius: '6px' }}>
            ⚠️ Email delivery isn't configured — emails will be logged only.
          </p>
        )}
        <form onSubmit={send}>
          <Field label="Send to">
            <select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>
              <option value="researchers">Researchers only</option>
              <option value="all">All members</option>
            </select>
          </Field>
          <Field label="Subject">
            <input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} required placeholder="Email subject line" />
          </Field>
          <Field label="Heading (optional — defaults to subject)">
            <input value={f.heading} onChange={(e) => setF({ ...f, heading: e.target.value })} placeholder="Email heading" />
          </Field>
          <Field label="Message">
            <textarea rows={8} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} required placeholder="Write your message here..." />
          </Field>
          <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send Email'}</Button>
          <span className="muted" style={{ marginLeft: '0.6rem', fontSize: '0.8rem' }}>Sent from notification@synthica.org</span>
        </form>
      </Card>
    </div>
  );
}
