import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api.js';
import { Card, Badge, Button, Field, EmptyState, Pfp } from '../../components/ui.jsx';
import { useToast } from '../../components/toast.jsx';

const PROGRESS_TYPES = {
  general: '📝 General',
  member: '👥 Member Activity',
  event: '📅 Event',
  recruitment: '🎯 Recruitment',
  outreach: '🌐 Outreach',
};

const TYPE_COLORS = {
  general: 'blue',
  member: 'green',
  event: 'purple',
  recruitment: 'orange',
  outreach: 'teal',
};

export default function Chapter() {
  const [chapter, setChapter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const { toast } = useToast();

  const [createForm, setCreateForm] = useState({ name: '', location: '', handbookUrl: '' });
  const [progressForm, setProgressForm] = useState({ title: '', description: '', type: 'general' });
  const [progress, setProgress] = useState([]);
  const [adding, setAdding] = useState(false);

  const loadChapter = useCallback(async () => {
    try {
      const data = await api.chapter();
      if (data && data.hasChapter === false && data.isLeader === false) {
        // User doesn't have a chapter yet
        setChapter(null);
        setShowCreate(true);
      } else {
        setChapter(data);
        setShowCreate(false);
        // Load progress
        const prog = await api.chapterProgress();
        setProgress(prog || []);
      }
      setError('');
    } catch (err) {
      setError(err.message);
      setChapter(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadChapter(); }, [loadChapter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await api.createChapter(createForm);
      toast('Chapter created successfully!', 'success');
      loadChapter();
      setShowCreate(false);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleAddProgress = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await api.addChapterProgress(progressForm);
      toast('Progress logged!', 'success');
      setProgressForm({ title: '', description: '', type: 'general' });
      const prog = await api.chapterProgress();
      setProgress(prog || []);
      setShowProgress(false);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <div className="page-loading">Loading…</div>;

  if (showCreate) {
    return (
      <div>
        <h1 className="page-title">🌍 Create Your Chapter</h1>
        <p className="page-sub">Start a new Synthica chapter in your area or institution.</p>
        
        <Card>
          <form onSubmit={handleCreate}>
            <Field label="Chapter Name *" required>
              <input
                type="text"
                placeholder="e.g. Berkeley AI Research Chapter"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                required
                style={{ width: '100%' }}
              />
            </Field>
            <Field label="Location">
              <input
                type="text"
                placeholder="e.g. Berkeley, California, USA"
                value={createForm.location}
                onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
                style={{ width: '100%' }}
              />
            </Field>
            <Field label="Chapter Handbook URL">
              <input
                type="url"
                placeholder="https://example.com/handbook"
                value={createForm.handbookUrl}
                onChange={(e) => setCreateForm({ ...createForm, handbookUrl: e.target.value })}
                style={{ width: '100%' }}
              />
            </Field>
            <div style={{ marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={adding}>
                {adding ? 'Creating…' : 'Create Chapter'}
              </button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  if (!chapter) {
    return (
      <div>
        <h1 className="page-title">🌍 Chapter</h1>
        <EmptyState icon="🌍" message="You are not leading a chapter." />
      </div>
    );
  }

  return (
    <div>
      <div className="card-row" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>🌍 {chapter.name}</h1>
          {chapter.location && <p className="muted" style={{ margin: '0.25rem 0 0' }}>📍 {chapter.location}</p>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="outline" onClick={() => setShowProgress(true)}>
            📝 Log Progress
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-3" style={{ marginBottom: '1.5rem' }}>
        <Card>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--brand-deep)' }}>
            {chapter.stats?.members || 0}
          </div>
          <div className="muted">Members</div>
        </Card>
        <Card>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--brand-deep)' }}>
            {progress.length}
          </div>
          <div className="muted">Progress Entries</div>
        </Card>
        <Card>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--brand-deep)' }}>
            {chapter.stats?.activeProjects || 0}
          </div>
          <div className="muted">Active Projects</div>
        </Card>
      </div>

      {/* Progress Log */}
      {showProgress && (
        <Card style={{ marginBottom: '1.5rem', border: '2px solid var(--brand)' }}>
          <h3>📝 Log Your Progress</h3>
          <form onSubmit={handleAddProgress}>
            <Field label="What did you accomplish? *" required>
              <input
                type="text"
                placeholder="e.g. Hosted first community meetup"
                value={progressForm.title}
                onChange={(e) => setProgressForm({ ...progressForm, title: e.target.value })}
                required
                style={{ width: '100%' }}
              />
            </Field>
            <Field label="Description">
              <textarea
                placeholder="Add more details about what you accomplished..."
                value={progressForm.description}
                onChange={(e) => setProgressForm({ ...progressForm, description: e.target.value })}
                rows={3}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </Field>
            <Field label="Type">
              <select
                value={progressForm.type}
                onChange={(e) => setProgressForm({ ...progressForm, type: e.target.value })}
                style={{ width: '100%' }}
              >
                {Object.entries(PROGRESS_TYPES).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={adding}>
                {adding ? 'Saving…' : 'Save Entry'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowProgress(false)}>
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Progress Timeline */}
      {progress.length > 0 ? (
        <Card>
          <h3 style={{ marginTop: 0 }}>📊 Progress Timeline</h3>
          <div className="stack">
            {progress.map((p) => (
              <div key={p.id} className="info-block" style={{ borderLeft: '3px solid var(--brand)', paddingLeft: '1rem' }}>
                <div className="card-row">
                  <div>
                    <strong>{p.title}</strong>
                    <Badge tone={TYPE_COLORS[p.type] || 'blue'} style={{ marginLeft: '0.5rem' }}>
                      {PROGRESS_TYPES[p.type] || p.type}
                    </Badge>
                  </div>
                  <span className="muted" style={{ fontSize: '0.78rem' }}>
                    {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                {p.description && (
                  <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
                    {p.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card>
          <EmptyState 
            icon="📊" 
            message="No progress entries yet. Start logging your chapter building activities!" 
          />
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <Button variant="primary" onClick={() => setShowProgress(true)}>
              📝 Log Your First Activity
            </Button>
          </div>
        </Card>
      )}

      {/* Members Section */}
      <Card style={{ marginTop: '1.5rem' }}>
        <h3 style={{ marginTop: 0 }}>👥 Chapter Members ({chapter.members?.length || 0})</h3>
        {chapter.members && chapter.members.length > 0 ? (
          <div className="stack">
            {chapter.members.map((m) => (
              <div key={m.userId} className="info-block">
                <div className="card-row">
                  <div>
                    <strong>{m.name}</strong> {m.onboarded && <Badge tone="green">onboarded</Badge>}
                    <div className="muted" style={{ fontSize: '0.78rem' }}>
                      <a href={`mailto:${m.email}`}>{m.email}</a>
                      {m.discord && <> · Discord: {m.discord}</>}
                    </div>
                    {m.projects && m.projects.length > 0 && (
                      <div className="muted" style={{ fontSize: '0.78rem', marginTop: '0.2rem' }}>
                        Projects: {m.projects.join(', ')}
                      </div>
                    )}
                  </div>
                  <div style={{ minWidth: 120 }}>
                    <div className="muted" style={{ fontSize: '0.72rem', textAlign: 'right' }}>{m.onboardingPct}%</div>
                    <div className="progress">
                      <span style={{ width: `${m.onboardingPct}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="👥" message="No members yet. Start by onboarding your first member!" />
        )}
      </Card>

      {/* Announcements */}
      {chapter.announcements && chapter.announcements.length > 0 && (
        <Card style={{ marginTop: '1.5rem' }}>
          <h3 style={{ marginTop: 0 }}>📣 Announcements</h3>
          <div className="stack">
            {chapter.announcements.map((a) => (
              <div key={a.id || a.title} className="info-block">
                <strong>{a.title}</strong>
                {a.body && <p style={{ margin: '0.5rem 0 0' }}>{a.body}</p>}
                <span className="muted" style={{ fontSize: '0.78rem' }}>
                  {a.byName} · {new Date(a.at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
