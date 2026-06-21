import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Button, Field } from '../components/ui.jsx';
import GoogleButton from '../components/GoogleButton.jsx';
import AuthShell from '../components/AuthShell.jsx';
import Icon from '../components/Icon.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ref = params.get('ref') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await register({ email: email.trim(), password, ref });
      navigate('/researcher', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell mode="register">
      <h1>Create your account</h1>
      <p className="sub">Email and password — you&apos;ll set up your profile right after.</p>

      {ref && (
        <div className="login-hint" style={{ marginTop: 0, color: 'var(--brand-deep)' }}>
          <span className="icon-label"><Icon name="party" size={16} /> You were invited — your referrer gets the credit when you join.</span>
        </div>
      )}
      {error && <div className="login-error">{error}</div>}

      <GoogleButton text="signup_with" onSuccess={() => navigate('/researcher', { replace: true })} onError={setError} />
      <p className="login-hint auth-google-hint">
        Use the same email with Google to keep one account.
      </p>
      <div className="login-divider"><span>or with email</span></div>

      <form onSubmit={onSubmit}>
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
            placeholder="you@school.edu"
            required
          />
        </Field>
        <Field label="Password (min 6 characters)">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            autoComplete="new-password"
            placeholder="••••••••"
            required
          />
        </Field>
        <Button type="submit" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <div className="login-hint auth-link-row">
        Already have an account? <Link to="/login">Sign in</Link>
      </div>
    </AuthShell>
  );
}
