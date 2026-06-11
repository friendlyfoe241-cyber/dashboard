import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Button, Field } from '../components/ui.jsx';
import GoogleButton from '../components/GoogleButton.jsx';

// Public researcher self-registration. Email + Discord are required (point of
// contact), matching the submission/registration policy.
export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', discord: '', password: '', resumeUrl: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(form);
      navigate('/researcher', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap login-v2">
      <form className="login-card login-card-v2" onSubmit={onSubmit}>
        <div className="login-brand"><img className="brand-img" src="/assets/logo/logo.png" alt="" />Synthica</div>
        <h1>Join Synthica</h1>
        <p className="sub">Create your researcher account — it's free.</p>

        {error && <div className="login-error">{error}</div>}

        <GoogleButton onSuccess={() => navigate('/researcher', { replace: true })} onError={setError} />

        <div className="login-divider"><span>or sign up with email</span></div>

        <Field label="Full name">
          <input value={form.name} onChange={set('name')} required />
        </Field>
        <Field label="Email (point of contact)">
          <input type="email" value={form.email} onChange={set('email')} required />
        </Field>
        <Field label="Discord username (point of contact)">
          <input value={form.discord} onChange={set('discord')} required />
        </Field>
        <Field label="Password (min 6 characters)">
          <input type="password" value={form.password} onChange={set('password')} minLength={6} required />
        </Field>
        <Field label="Resume / CV link (recommended)">
          <input value={form.resumeUrl} onChange={set('resumeUrl')} placeholder="https://drive.google.com/… — helps us assign your role" />
        </Field>
        <p className="login-hint" style={{ marginTop: 0 }}>New accounts are reviewed by an auditor who assigns your role before you get access.</p>

        <Button type="submit" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Creating account…' : 'Create account'}
        </Button>

        <div className="login-hint">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </form>
    </div>
  );
}
