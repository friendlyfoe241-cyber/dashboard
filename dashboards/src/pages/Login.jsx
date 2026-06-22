import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { Button, Field } from '../components/ui.jsx';
import GoogleButton from '../components/GoogleButton.jsx';

const SUBJECTS = ['Biology', 'Chemistry', 'Physics', 'Mathematics', 'Computer Science', 'Humanities', 'Economics', 'Psychology'];

// Emails match the seeded demo accounts (backend/src/seed.js). "Moderator" is the
// member-facing name for the Auditor role (ROLE_WORKFLOWS §9).
const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@synthica.org' },
  { label: 'Director', email: 'director@synthica.org' },
  { label: 'Moderator', email: 'auditor@synthica.org' },
  { label: 'Lead researcher', email: 'sam@example.com' },
  { label: 'Associate researcher', email: 'jordan@example.com' },
  { label: 'Independent researcher', email: 'testindependent@synthica.org' },
  { label: 'Expertise mentor', email: 'testmentor@synthica.org' },
];

// What's inside the portal — shown on the login's left panel so first-time
// visitors know what they're signing into.
const PORTAL_FEATURES = [
  ['💬', 'Community feed & messages'],
  ['🔬', 'Research groups & projects'],
  ['🎓', 'Programs & competitions'],
  ['📅', 'Events & workshops'],
  ['📜', 'Publish & earn certificates'],
];

// Static layout wrapper. Must live at module scope: defining it inside Login
// would create a new component type on every render, making React unmount and
// remount the whole card on each keystroke (replaying the entry animation,
// dropping input focus, and repainting the blurred aurora).
function Shell({ children }) {
  return (
    <div className="login-wrap login-v2">
      <Aurora />
      <div className="login-split">
        <aside className="login-aside">
          <span className="login-aside-badge">✦ Open to all students — free</span>
          <h3 className="login-aside-title">Synthica,<br /><span className="login-aside-em">all in one place</span></h3>
          <h3 className="login-aside-em">Connecting researchers world-wide</h3>
          <p className="login-aside-sub">
            Connect, learn, and grow. Access global programs, join events, and stay connected with a worldwide community.
          </p>
          <ul className="login-aside-list">
            {PORTAL_FEATURES.map(([icon, label]) => (
              <li key={label}><span className="login-aside-ico" aria-hidden="true">{icon}</span>{label}</li>
            ))}
          </ul>
        </aside>
        <div className="login-card login-card-v2">
          <div className="login-brand"><img className="brand-img" src="/assets/logo/logo.png" alt="" />Synthica</div>
          {children}
          <div className="login-foot"><Link to="/archive">Browse the Synthica Archive →</Link></div>
        </div>
      </div>
    </div>
  );
}

// One smart entry point: enter email → we look it up → known accounts get a
// password prompt; new ones flow into sign-up. No "login vs register" choice.
export default function Login() {
  const { login, verify2fa, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const expired = params.get('expired');

  const [step, setStep] = useState('email'); // email | password | signup | twofa
  const [email, setEmail] = useState('');
  const [knownName, setKnownName] = useState('');
  const [password, setPassword] = useState('');
  const [twoFA, setTwoFA] = useState(null);
  const [code, setCode] = useState('');
  const [signup, setSignup] = useState({ name: '', discord: '', password: '', resumeUrl: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoEnabled, setDemoEnabled] = useState(true);

  // Production refuses the shared demo password, so hide the demo buttons
  // there instead of letting them fail with "invalid password".
  useEffect(() => {
    api.config().then((c) => setDemoEnabled(c.demoLogins !== false)).catch(() => {});
  }, []);

  const goHome = (user) => navigate(user.kind === 'editor' ? '/editor' : '/researcher', { replace: true });
  const fail = (e) => setError(e.message || String(e));

  // Step 1 — email lookup decides the next step.
  const checkEmail = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { exists, method, name } = await api.checkEmail(email.trim());
      if (!exists) { setStep('signup'); }
      else if (method === 'google') { setError('This email signs in with Google — use the button above.'); }
      else { setKnownName(name || ''); setStep('password'); }
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  // Step 2a — existing account: password (+ 2FA if enabled).
  const doLogin = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      // Trim the password too: copy-pasting it (e.g. from the demo hint or a
      // password manager) often drags along a trailing space or newline.
      const res = await login(email.trim(), password.trim());
      if (res.twoFactorRequired) { setTwoFA({ tempToken: res.tempToken }); setStep('twofa'); }
      else goHome(res);
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  // One-click demo sign-in — no email/password typing needed.
  const demoLogin = async (demoEmail) => {
    setError('');
    setBusy(true);
    try {
      const res = await login(demoEmail, 'demo1234');
      if (res.twoFactorRequired) { setEmail(demoEmail); setTwoFA({ tempToken: res.tempToken }); setStep('twofa'); }
      else goHome(res);
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const doVerify = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try { goHome(await verify2fa(twoFA.tempToken, code.trim())); }
    catch (err) { fail(err); } finally { setBusy(false); }
  };

  // Step 2b — new account.
  const doSignup = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await register({ ...signup, email: email.trim(), password: signup.password.trim() });
      goHome(user);
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  if (step === 'twofa') {
    return (
      <Shell>
        <h1>Two-factor code</h1>
        <p className="sub">Enter the 6-digit code from your authenticator app.</p>
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={doVerify}>
          <Field label="Authentication code">
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoFocus maxLength={6} required />
          </Field>
          <Button type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'Verifying…' : 'Verify'}</Button>
        </form>
      </Shell>
    );
  }

  if (step === 'password') {
    return (
      <Shell>
        <h1>Welcome back{knownName ? `, ${knownName.split(' ')[0]}` : ''}</h1>
        <p className="sub">{email} · <button className="link-btn" onClick={() => { setStep('email'); setPassword(''); setError(''); }}>not you?</button></p>
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={doLogin}>
          <input type="email" value={email} autoComplete="username" readOnly hidden />
          <Field label="Password">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus placeholder="••••••••" required />
          </Field>
          <Button type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'Signing in…' : 'Sign in →'}</Button>
        </form>
        <div className="login-hint" style={{ marginTop: '1rem', textAlign: 'center' }}>
          <Link to="/forgot">Forgot password?</Link>
        </div>
      </Shell>
    );
  }

  if (step === 'signup') {
    return (
      <Shell>
        <h1>Create your account</h1>
        <p className="sub">{email} · <button className="link-btn" onClick={() => { setStep('email'); setError(''); }}>change</button></p>
        {error && <div className="login-error">{error}</div>}

        <GoogleButton text="signup_with" onSuccess={() => navigate('/', { replace: true })} onError={setError} />
        <p className="login-hint" style={{ margin: '0.5rem 0 0', textAlign: 'center' }}>
          Use the same email with Google to keep one account — no accidental duplicates.
        </p>
        <div className="login-divider"><span>or with a password</span></div>

        <form onSubmit={doSignup}>
          <Field label="Full name"><input value={signup.name} onChange={(e) => setSignup({ ...signup, name: e.target.value })} autoFocus required /></Field>
          <Field label="Discord username (point of contact)"><input value={signup.discord} onChange={(e) => setSignup({ ...signup, discord: e.target.value })} required /></Field>
          <Field label="Password (min 6 characters)"><input type="password" value={signup.password} onChange={(e) => setSignup({ ...signup, password: e.target.value })} minLength={6} autoComplete="new-password" required /></Field>
          <Field label="Resume / CV link (recommended)"><input value={signup.resumeUrl} onChange={(e) => setSignup({ ...signup, resumeUrl: e.target.value })} placeholder="https://drive.google.com/…" /></Field>
          <p className="login-hint" style={{ marginTop: 0 }}>New accounts are reviewed by an auditor who assigns your role before you get access.</p>
          <Button type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'Creating account…' : 'Create account'}</Button>
        </form>
      </Shell>
    );
  }

  // step === 'email'
  return (
    <Shell>
      <h1>Sign in or join</h1>
      <p className="sub">Enter your email to continue — we'll take it from there.</p>
      {expired && !error && <div className="login-error" style={{ background: '#fffbeb', color: '#92400e', borderColor: '#fde68a' }}>Your session expired — please sign in again.</div>}
      {error && <div className="login-error">{error}</div>}

      <GoogleButton onSuccess={() => navigate('/', { replace: true })} onError={setError} />
      <div className="login-divider"><span>or with email</span></div>

      <form onSubmit={checkEmail}>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus placeholder="you@school.edu" required />
        </Field>
        <Button type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'Checking…' : 'Continue →'}</Button>
      </form>

      {demoEnabled && (
        <details className="login-demo">
          <summary>Demo accounts</summary>
          <div className="login-hint" style={{ marginTop: '0.5rem', textAlign: 'center' }}>One click — no email or password needed:</div>
          <div className="login-demo-grid">
            {DEMO_ACCOUNTS.map(({ label, email: demoEmail }) => (
              <button key={demoEmail} type="button" className="demo-btn" disabled={busy} onClick={() => demoLogin(demoEmail)} title={demoEmail}>
                {label}
              </button>
            ))}
          </div>
        </details>
      )}
    </Shell>
  );
}

// Soft floating gradient blobs behind the card (pure CSS, motion-safe).
function Aurora() {
  return (
    <div className="aurora" aria-hidden="true">
      <span className="aurora-blob a1" />
      <span className="aurora-blob a2" />
      <span className="aurora-blob a3" />
    </div>
  );
}
