import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Card, Button, Field, Badge } from '../components/ui.jsx';
import { useToast } from '../components/toast.jsx';
import UploadButton from '../components/UploadButton.jsx';
import Icon from '../components/Icon.jsx';

// A shared "Tools" space — résumé editor + my stats for researchers, activity
// stats for editors, plus scaffold cards for future additions.
export default function Tools() {
  const { user } = useAuth();
  return (
    <div>
      <h1 className="page-title">Tools</h1>
      <p className="page-sub">Shared resources and settings. More coming soon.</p>

      {user.kind === 'editor' && <EditorStats />}
      {user.kind === 'researcher' && <ResumeCard user={user} />}
      <SecurityCard user={user} />

      <div className="grid grid-3">
        <Placeholder title="Templates" desc="Proposal, methods, and review templates to reuse." />
        <Placeholder title="Branding" desc="Logos, colors, and slide decks." />
        <Placeholder title="Guides" desc="Onboarding docs and how-tos." />
      </div>
    </div>
  );
}

// Two-factor authentication enrollment.
function SecurityCard({ user }) {
  const toast = useToast();
  const [enabled, setEnabled] = useState(user.twoFactorEnabled);
  const [setup, setSetup] = useState(null); // { secret, otpauthUrl }
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const begin = async () => {
    setError('');
    try { setSetup(await api.setup2fa()); } catch (e) { setError(e.message); }
  };
  const enable = async () => {
    setError('');
    try { await api.enable2fa(code); setEnabled(true); setSetup(null); setCode(''); toast.success('Two-factor enabled'); }
    catch (e) { setError(e.message); }
  };
  const disable = async () => {
    setError('');
    try { await api.disable2fa(code); setEnabled(false); setCode(''); toast.success('Two-factor disabled'); }
    catch (e) { setError(e.message); }
  };

  return (
    <Card style={{ marginBottom: '1.25rem' }}>
      <div className="card-row">
        <h3>Two-factor authentication</h3>
        <Badge tone={enabled ? 'green' : 'gray'}>{enabled ? 'on' : 'off'}</Badge>
      </div>
      <p className="muted" style={{ margin: '0.25rem 0 0.75rem' }}>
        Add a 6-digit code from an authenticator app (recommended for editors).
      </p>
      {error && <div className="login-error">{error}</div>}

      {enabled ? (
        <div className="row">
          <input placeholder="Code to disable" value={code} onChange={(e) => setCode(e.target.value)} style={{ maxWidth: 160 }} />
          <Button variant="reject" onClick={disable}>Disable</Button>
        </div>
      ) : setup ? (
        <div>
          <p className="muted">Scan with your authenticator, then enter a code to confirm.</p>
          <img
            alt="2FA QR code"
            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(setup.otpauthUrl)}`}
            style={{ margin: '0.5rem 0', borderRadius: 8 }}
          />
          <p className="muted" style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>Manual key: <code>{setup.secret}</code></p>
          <div className="row">
            <input placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} style={{ maxWidth: 160 }} />
            <Button onClick={enable}>Enable</Button>
          </div>
        </div>
      ) : (
        <Button onClick={begin}>Set up 2FA</Button>
      )}
    </Card>
  );
}

function EditorStats() {
  const [s, setS] = useState(null);
  useEffect(() => {
    api.editorStats().then(setS).catch(() => {});
  }, []);
  if (!s) return null;
  const items = [
    ['Reviewed', s.reviewed],
    ['Approved', s.approved],
    ['Declined', s.declined],
    ['Active now', s.active],
  ];
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <h2 className="section-title" style={{ marginBottom: '0.6rem' }}>My stats</h2>
      <div className="grid grid-4">
        {items.map(([label, value]) => (
          <Card key={label}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--ink)' }}>{value}</div>
            <div className="muted">{label}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Placeholder({ title, desc }) {
  return (
    <Card>
      <div className="card-row">
        <h3>{title}</h3>
        <Badge tone="gray">soon</Badge>
      </div>
      <p className="muted" style={{ marginTop: '0.4rem' }}>
        {desc}
      </p>
    </Card>
  );
}

function ResumeCard({ user }) {
  const { refreshUser } = useAuth();
  const [url, setUrl] = useState(user.resumeUrl || '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await api.updateResume(url);
      // Keep the auth user fresh so listings auto-apply with the new résumé.
      await refreshUser();
      setSaved(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ marginBottom: '1.25rem' }}>
      <h3>My résumé</h3>
      <p className="muted" style={{ margin: '0.25rem 0 0.75rem' }}>
        Link your résumé so you can auto-apply to project listings. Update it any time.
      </p>
      {error && <div className="login-error">{error}</div>}
      <Field label="Résumé (upload a PDF or paste a link)">
        <div className="row" style={{ gap: '0.4rem' }}>
          <input
            value={url}
            onChange={(e) => { setUrl(e.target.value); setSaved(false); }}
            placeholder="https://… or upload"
          />
          <UploadButton kind="resume" label="Upload PDF" onUploaded={(r) => { setUrl(r.url); setSaved(false); }} />
        </div>
      </Field>
      <Button onClick={save} disabled={busy}>
        {busy ? 'Saving…' : 'Save résumé'}
      </Button>
      {saved && <span className="muted" style={{ marginLeft: '0.6rem' }}><span className="icon-label"><Icon name="check" size={14} /> Saved</span></span>}
    </Card>
  );
}
