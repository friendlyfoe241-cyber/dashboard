import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { Button, Field } from '../components/ui.jsx';
import GoogleButton from '../components/GoogleButton.jsx';

const SUBJECTS = ['Biology', 'Chemistry', 'Physics', 'Mathematics', 'Computer Science', 'Humanities', 'Economics', 'Psychology'];

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
      const res = await login(email.trim(), password);
      if (res.twoFactorRequired) { setTwoFA({ tempToken: res.tempToken }); setStep('twofa'); }
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
      const user = await register({ ...signup, email: email.trim() });
      goHome(user);
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const Shell = ({ children }) => (
    <div className="login-wrap login-v2">
      <Aurora />
      <div className="login-card login-card-v2">
        <div className="login-brand"><img className="brand-img" src="/assets/logo/logo.png" alt="" />Synthica</div>
        {children}
        <div className="login-foot"><Link to="/archive">Browse the Synthica Archive →</Link></div>
      </div>
    </div>
  );

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

      <details className="login-demo">
        <summary>Demo accounts</summary>
        <div className="login-hint" style={{ marginTop: '0.5rem' }}>
          Password <code>demo1234</code> · sign in with any email below:<br />
          Staff — <code>admin@synthica.org</code> · <code>director@synthica.org</code> · <code>auditor@synthica.org</code>
          <br />
          Researchers — <code>sam@example.com</code> (lead) · <code>jordan@example.com</code> (associate)
        </div>
      </details>
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
