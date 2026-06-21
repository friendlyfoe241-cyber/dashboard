import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Card, Badge, Button, Field, EmptyState } from '../../components/ui.jsx';
import { useToast } from '../../components/toast.jsx';

const COMMON = [
  { key: 'Full Name', type: 'text', required: true },
  { key: 'Discord Display Name', type: 'text', required: true },
  { key: 'Email', type: 'email', required: true },
  { key: 'Date of Birth', type: 'date' },
  { key: 'Location (City, State, Country)', type: 'text' },
  { key: 'Current Grade Level (e.g. HS10, U3, Graduate, PhD)', type: 'text' },
  { key: 'Current School', type: 'text' },
  { key: 'Commitment Hours per Week (e.g. 40 hours)', type: 'text' },
  { key: 'Background in Research', type: 'textarea' },
];

const FORMS = {
  'Lead Researcher': [
    ...COMMON,
    { key: 'Current GPA', type: 'text' },
    { key: 'Intended Research Topic (cannot be N/A)', type: 'text', required: true },
    { key: 'How do you plan to conduct your research topic? (150 words max)', type: 'textarea', required: true },
    { key: 'Why should we make you a lead researcher? (150 words max)', type: 'textarea', required: true },
  ],
  'Chapter Leader': [
    ...COMMON,
    { key: 'Where would you run your chapter?', type: 'text', required: true },
    { key: 'Why do you want to lead a chapter? (150 words max)', type: 'textarea', required: true },
  ],
  'Independent Researcher': [
    ...COMMON,
    { key: 'What do you want to research independently?', type: 'textarea', required: true },
  ],
};

const ROLES = Object.keys(FORMS);

export default function ApplicationHub() {
  const { user } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const [role, setRole] = useState(params.get('role') || 'Lead Researcher');
  const [answers, setAnswers] = useState({});
  const [apps, setApps] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.myApplications().then(setApps).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const fromUrl = params.get('role');
    if (fromUrl && ROLES.includes(fromUrl)) setRole(fromUrl);
  }, [params]);

  useEffect(() => {
    setAnswers((a) => ({
      'Full Name': a['Full Name'] || user.name || '',
      'Discord Display Name': a['Discord Display Name'] || user.discord || '',
      Email: a.Email || user.email || '',
      'Current School': a['Current School'] || user.institution || '',
      'Background in Research': a['Background in Research'] || user.experienceSummary || '',
      'Current GPA': a['Current GPA'] || user.gpa || '',
      ...a,
    }));
  }, [role, user]);

  const fields = FORMS[role];
  const set = (k) => (e) => setAnswers({ ...answers, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const message = answers[fields.find((f) => f.type === 'textarea' && f.required)?.key] || '';
      await api.apply({ role, answers, message });
      setAnswers({});
      toast.success('Application submitted');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const hasAssociate = (user?.tags || []).includes('associate_researcher');

  return (
    <div>
      <h1 className="page-title">Apply for a role</h1>
      <p className="page-sub">
        {hasAssociate
          ? 'Apply for advanced roles. Associate Researcher is already on your account.'
          : 'Lead, Chapter Leader, and Independent Researcher roles are reviewed by our team.'}
      </p>
      {error && <div className="login-error">{error}</div>}

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <h3>Submit an application</h3>
          <Field label="Role">
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          {role === 'Lead Researcher' && (
            <p className="muted" style={{ marginBottom: '0.75rem' }}>
              Lead Researchers run their own project and a team. We review your background and research plan.
            </p>
          )}
          <form onSubmit={submit}>
            {fields.map((f) => (
              <Field key={f.key} label={`${f.key}${f.required ? ' *' : ''}`}>
                {f.type === 'textarea' ? (
                  <textarea value={answers[f.key] || ''} onChange={set(f.key)} required={f.required} />
                ) : (
                  <input type={f.type === 'email' ? 'email' : f.type === 'date' ? 'date' : 'text'} value={answers[f.key] || ''} onChange={set(f.key)} required={f.required} />
                )}
              </Field>
            ))}
            <Button type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit application'}</Button>
          </form>
        </Card>

        <Card>
          <h3>My applications</h3>
          {apps.filter((a) => a.role).length === 0 ? (
            <EmptyState>No role applications yet.</EmptyState>
          ) : (
            <div className="stack">
              {apps.filter((a) => a.role).map((a) => (
                <div key={a.id} className="info-block">
                  <div className="card-row">
                    <strong>{a.role}</strong>
                    <Badge tone={a.status === 'pending' ? 'gray' : a.status === 'approved' ? 'green' : 'red'}>{a.status}</Badge>
                  </div>
                  {a.answers && (
                    <details style={{ marginTop: '0.4rem' }}>
                      <summary className="muted" style={{ cursor: 'pointer' }}>View answers</summary>
                      <div className="stack" style={{ marginTop: '0.3rem' }}>
                        {Object.entries(a.answers).map(([k, v]) => v && (
                          <div key={k} className="muted" style={{ fontSize: '0.8rem' }}><strong>{k}:</strong> {v}</div>
                        ))}
                      </div>
                    </details>
                  )}
                  <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.75rem' }}>{new Date(a.at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
