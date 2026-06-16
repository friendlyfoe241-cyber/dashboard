import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Card, Badge, Button } from '../../components/ui.jsx';
import { useToast } from '../../components/toast.jsx';
import { Embed } from '../../components/embed.jsx';

const isOverdue = (t) => t.dueAt && t.status !== 'done' && new Date(t.dueAt) < new Date(new Date().toDateString());

// Classroom-style project view. Associate researchers see tasks/progress/team;
// the lead additionally gets teacher-style controls (assign task, announce).
export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.project(id).then(setProject).catch((e) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  if (error) return <div className="login-error">{error}</div>;
  if (!project) return <p className="muted">Loading project…</p>;

  const total = project.tasks.length;
  const done = project.tasks.filter((t) => t.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div>
      <Link to="/researcher" className="label-up">
        ← Back to dashboard
      </Link>
      <h1 className="page-title" style={{ marginTop: '0.5rem' }}>
        {project.title}
      </h1>
      <p className="page-sub">
        <Badge>{project.category}</Badge> {project.isLead && <Badge tone="gold">you lead this</Badge>}
      </p>
      <p style={{ color: 'var(--body)', maxWidth: 720 }}>{project.description}</p>

      <div className="grid grid-2" style={{ marginTop: '1.5rem', alignItems: 'start' }}>
        <div className="stack">
          <Card>
            <h3>Project stats</h3>
            <div className="progress" style={{ margin: '0.5rem 0' }}>
              <span style={{ width: `${pct}%` }} />
            </div>
            <p className="muted">{done} of {total} tasks complete ({pct}%)</p>
            <div className="row" style={{ marginTop: '0.6rem', gap: '0.4rem' }}>
              <Badge tone="blue">{project.tasks.filter((t) => t.status === 'in_progress').length} in progress</Badge>
              <Badge tone="gold">{project.tasks.filter((t) => t.status === 'awaiting_approval').length} awaiting</Badge>
              <Badge tone="gray">{project.members.length} members</Badge>
              <Badge tone="gray">{project.tasks.filter((t) => t.type === 'question').length} questions</Badge>
            </div>
          </Card>

          <IdeasCard project={project} onChange={load} />
          <TasksCard project={project} onChange={load} />

          <Card>
            <h3>Announcements</h3>
            {project.announcements.length === 0 ? (
              <p className="muted">No announcements.</p>
            ) : (
              project.announcements.map((a) => (
                <div key={a.id} className="info-block">
                  {a.body}
                  <div className="muted" style={{ marginTop: '0.25rem' }}>
                    {new Date(a.at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </Card>

          <LinksCard project={project} onChange={load} />
        </div>

        <div className="stack">
          <Card>
            <div className="card-row">
              <h3>Team</h3>
              {project.team?.length > 0 && (
                <a
                  className="btn btn-primary btn-sm"
                  href={`mailto:${project.team.map((m) => m.email).join(',')}`}
                >
                  Email team
                </a>
              )}
            </div>
            <div className="stack" style={{ marginTop: '0.5rem' }}>
              {(project.team || []).map((m) => (
                <div key={m.id} className="row" style={{ alignItems: 'flex-start' }}>
                  <span className="badge badge-blue" style={{ borderRadius: '999px' }}>
                    {String(m.name || '?').split(' ').map((p) => p[0] || '').join('').slice(0, 2)}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div>
                      <Link to={`/p/${m.slug || m.id}`}>{m.name}</Link> {m.isLead && <Badge tone="gold">lead</Badge>}
                      {m.role && <> <Badge tone="blue">{m.role}</Badge></>}
                    </div>
                    <div className="muted" style={{ fontSize: '0.78rem' }}>
                      <a href={`mailto:${m.email}`}>{m.email}</a>
                      {m.discord && <> · Discord: {m.discord}</>}
                    </div>
                    {project.isLead && <RoleEditor projectId={id} member={m} onChange={load} />}
                  </div>
                </div>
              ))}
            </div>
            {project.isLead && <InviteByEmail projectId={id} invites={project.invites || []} onChange={load} />}
          </Card>

          {project.isLead && <SuggestedPeople projectId={id} onChange={load} />}
          {project.isLead && <LeadControls projectId={id} onPosted={load} />}
        </div>
      </div>
    </div>
  );
}

// Team brainstorm: anyone proposes ideas, everyone upvotes, the lead picks one.
function IdeasCard({ project, onChange }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const ideas = [...(project.ideas || [])].sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0));

  const run = (p) => { setBusy(true); p.then(onChange).finally(() => setBusy(false)); };
  const add = (e) => { e.preventDefault(); if (text.trim()) { run(api.addIdea(project.id, text)); setText(''); } };

  return (
    <Card>
      <h3>Research ideas</h3>
      <p className="muted" style={{ margin: '0.2rem 0 0.6rem' }}>Propose ideas as a team, vote, then the lead picks the direction.</p>
      <div className="stack">
        {ideas.length === 0 && <p className="muted">No ideas yet — add the first one.</p>}
        {ideas.map((i) => (
          <div key={i.id} className="info-block" style={i.chosen ? { borderLeft: '3px solid var(--success)' } : undefined}>
            <div className="card-row">
              <div>{i.text} {i.chosen && <Badge tone="green">chosen</Badge>}</div>
              <div className="row" style={{ gap: '0.3rem' }}>
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(api.voteIdea(project.id, i.id))}>
                  ▲ {i.votes?.length || 0}
                </button>
                {project.isLead && !i.chosen && (
                  <button className="btn btn-approve btn-sm" disabled={busy} onClick={() => run(api.chooseIdea(project.id, i.id))}>Choose</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={add} className="row" style={{ marginTop: '0.6rem' }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Propose a research idea…" />
        <button className="btn btn-primary btn-sm" disabled={busy}>Add</button>
      </form>
    </Card>
  );
}

// Paper + media links with embedded previews (Drive / YouTube / PDF).
function LinksCard({ project, onChange }) {
  const [form, setForm] = useState({ label: '', url: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const links = project.links || [];

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.addProjectLink(project.id, form);
      setForm({ label: '', url: '' });
      onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h3>Paper &amp; media</h3>
      {error && <div className="login-error">{error}</div>}
      {links.length === 0 && <p className="muted" style={{ marginTop: '0.4rem' }}>No links yet.</p>}
      <div className="stack" style={{ marginTop: '0.5rem' }}>
        {links.map((l) => (
          <div key={l.id} className="info-block">
            <a href={l.url} target="_blank" rel="noreferrer">{l.label}</a>
            <Embed url={l.url} height={300} title={l.label} />
          </div>
        ))}
      </div>
      <form onSubmit={add} style={{ marginTop: '0.75rem' }}>
        <input placeholder="Label (e.g. Draft manuscript)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} style={{ marginBottom: '0.5rem' }} />
        <div className="row">
          <input placeholder="https://… (Drive, YouTube, PDF)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} required />
          <button className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Adding…' : 'Add'}</button>
        </div>
      </form>
    </Card>
  );
}

const STATUS_TONE = { todo: 'gray', awaiting_approval: 'gold', in_progress: 'blue', done: 'green' };
const STATUS_LABEL = { todo: 'to do', awaiting_approval: 'awaiting approval', in_progress: 'in progress', done: 'done' };

// Task board: questions float to the top (hierarchy), then everything else.
// Any member can add tasks + assign people; steps that need approval wait for
// the lead, who can approve them to start.
function TasksCard({ project, onChange }) {
  const id = project.id;
  const team = project.team || [];
  const { user } = useAuth();
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'task', dueAt: '', requiresApproval: false });

  const nameOf = (uid) => team.find((m) => m.userId === uid)?.name || '—';
  const run = (p) => p.then(onChange).catch((e) => setError(e.message));

  const add = (e) => {
    e.preventDefault();
    run(api.addTask(id, form));
    setForm({ title: '', type: 'task', dueAt: '', requiresApproval: false });
    setAdding(false);
  };

  // Questions first (top of the hierarchy), then the rest. Optional "mine" filter.
  let ordered = [...project.tasks].sort((a, b) => (a.type === 'question' ? -1 : 0) - (b.type === 'question' ? -1 : 0));
  if (mineOnly) ordered = ordered.filter((t) => t.assignedTo.includes(user.id));

  return (
    <Card>
      <div className="card-row">
        <h3>Tasks & questions</h3>
        <div className="row">
          <button className={`btn btn-sm ${mineOnly ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMineOnly((m) => !m)}>
            Assigned to me
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setAdding((a) => !a)}>
            {adding ? 'Cancel' : 'Add'}
          </button>
        </div>
      </div>
      {error && <div className="login-error">{error}</div>}

      {adding && (
        <form onSubmit={add} className="info-block" style={{ marginTop: '0.6rem' }}>
          <input placeholder="Title…" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required style={{ marginBottom: '0.5rem' }} />
          <div className="grid grid-3">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="task">Task</option>
              <option value="reading">Reading</option>
              <option value="question">Research question</option>
            </select>
            <input type="date" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
            <label className="row" style={{ fontSize: '0.82rem' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={form.requiresApproval} onChange={(e) => setForm({ ...form, requiresApproval: e.target.checked })} />
              needs lead approval to start
            </label>
          </div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: '0.6rem' }}>Add task</button>
        </form>
      )}

      {ordered.length === 0 ? (
        <p className="muted" style={{ marginTop: '0.6rem' }}>No tasks yet.</p>
      ) : (
        <div className="stack" style={{ marginTop: '0.6rem' }}>
          {ordered.map((t) => (
            <div key={t.id} className="info-block" style={t.type === 'question' ? { borderLeft: '3px solid var(--brand)' } : undefined}>
              <div className="card-row">
                <div className="row" style={{ gap: '0.4rem' }}>
                  <Badge tone={t.type === 'question' ? 'blue' : 'gray'}>{t.type}</Badge>
                  <Badge tone={STATUS_TONE[t.status] || 'gray'}>{STATUS_LABEL[t.status] || t.status}</Badge>
                </div>
                {t.dueAt && (
                  <span className={isOverdue(t) ? 'overdue' : 'muted'} style={{ fontSize: '0.75rem' }}>
                    {isOverdue(t) ? 'overdue ' : 'due '}{t.dueAt}
                  </span>
                )}
              </div>
              <div className={t.status === 'done' ? 'ci-title' : ''} style={{ marginTop: '0.35rem', textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>
                {t.title}
              </div>
              <div className="muted" style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
                {t.assignedTo.length ? `Assigned: ${t.assignedTo.map(nameOf).join(', ')}` : 'Unassigned'}
              </div>

              {/* Actions */}
              <div className="row" style={{ marginTop: '0.5rem', gap: '0.4rem' }}>
                {t.status === 'todo' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => run(api.startTask(id, t.id))}>
                    {t.requiresApproval ? 'Request to start' : 'Start'}
                  </button>
                )}
                {t.status === 'awaiting_approval' && project.isLead && (
                  <>
                    <button className="btn btn-approve btn-sm" onClick={() => run(api.approveTask(id, t.id, true))}>Approve start</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => run(api.approveTask(id, t.id, false))}>Send back</button>
                  </>
                )}
                {t.status === 'awaiting_approval' && !project.isLead && (
                  <span className="muted" style={{ fontSize: '0.78rem' }}>Waiting on lead approval…</span>
                )}
                {t.status === 'in_progress' && (
                  <button className="btn btn-approve btn-sm" onClick={() => run(api.completeTask(id, t.id, true))}>Mark done</button>
                )}
                {t.status === 'done' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => run(api.completeTask(id, t.id, false))}>Reopen</button>
                )}
                {/* Assign anyone on the team */}
                {team.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => e.target.value && run(api.assignTask(id, t.id, e.target.value))}
                    style={{ width: 'auto', padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                  >
                    <option value="">Assign…</option>
                    {team.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {t.assignedTo.includes(m.userId) ? '✓ ' : ''}{m.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// Lead control: post an announcement to the team (tasks live in the task board).
function LeadControls({ projectId, onPosted }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      await api.addAnnouncement(projectId, { body });
      setBody('');
      onPosted();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h3>Post announcement</h3>
      {error && <div className="login-error">{error}</div>}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share an announcement with the team…"
      />
      <button
        className="btn btn-primary btn-sm"
        style={{ marginTop: '0.75rem' }}
        disabled={busy || !body.trim()}
        onClick={submit}
      >
        {busy ? 'Posting…' : 'Post announcement'}
      </button>
    </Card>
  );
}

// Lead-only: invite someone by email. Existing accounts join instantly;
// new emails get a register link and join automatically on sign-up.
function InviteByEmail({ projectId, invites, onChange }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const invite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      const r = await api.inviteToProject(projectId, email.trim());
      toast.success(r.status === 'added' ? `${r.name} added to the team` : `Invite sent to ${r.email}`);
      setEmail('');
      onChange();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
      <form className="row" onSubmit={invite} style={{ flexWrap: 'nowrap' }}>
        <input type="email" placeholder="Invite by email (old teammates welcome)" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" className="btn-sm" disabled={busy}>{busy ? '…' : 'Invite'}</Button>
      </form>
      {invites.length > 0 && (
        <div className="muted" style={{ marginTop: '0.45rem', fontSize: '0.78rem' }}>
          ✉️ Waiting on: {invites.map((i) => i.email).join(', ')} — they'll join automatically when they sign up.
        </div>
      )}
    </div>
  );
}

// Lead sets a member's role (e.g. "Head of Data Collection"); it shows on the
// roster and auto-appears on that member's public profile.
function RoleEditor({ projectId, member, onChange }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(member.role || '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await api.setProjectRole(projectId, member.id, title.trim()); toast.success('Role updated'); setEditing(false); onChange(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  if (!editing) {
    return <button className="btn btn-ghost btn-sm" style={{ marginTop: '0.25rem' }} onClick={() => { setTitle(member.role || ''); setEditing(true); }}>{member.role ? 'Edit role' : '+ Set role'}</button>;
  }
  return (
    <div className="row" style={{ marginTop: '0.3rem', gap: '0.3rem' }}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Head of Data Collection" maxLength={60} style={{ maxWidth: 220 }} />
      <Button className="btn-sm" disabled={busy} onClick={save}>Save</Button>
      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
    </div>
  );
}

// Suggested teammates ranked by shared interests — the lead invites with one click.
function SuggestedPeople({ projectId, onChange }) {
  const toast = useToast();
  const [people, setPeople] = useState(null);
  const [busyId, setBusyId] = useState('');
  const load = useCallback(() => api.suggestedForProject(projectId).then(setPeople).catch(() => setPeople([])), [projectId]);
  useEffect(() => { load(); }, [load]);

  const invite = async (person) => {
    setBusyId(person.id);
    try { await api.inviteMemberById(projectId, person.id); toast.success(`${person.name} added to the project`); load(); onChange(); }
    catch (e) { toast.error(e.message); } finally { setBusyId(''); }
  };

  if (!people) return null;
  return (
    <Card>
      <h3>Suggested people</h3>
      <p className="muted" style={{ margin: '0.2rem 0 0.6rem' }}>Researchers whose interests match this project. Invite them to your team.</p>
      {people.length === 0 ? (
        <p className="muted">No interest matches yet — try the Research Hub to recruit, or fill out your project's category.</p>
      ) : (
        <div className="stack">
          {people.map((p) => (
            <div key={p.id} className="info-block">
              <div className="card-row">
                <div>
                  <Link to={`/p/${p.slug || p.id}`}><strong>{p.name}</strong></Link> <span className="muted" style={{ fontSize: '0.78rem' }}>{p.role}{p.institution ? ` · ${p.institution}` : ''}</span>
                  {p.blurb && <div className="muted" style={{ fontSize: '0.82rem' }}>{p.blurb}</div>}
                  <div className="row" style={{ gap: '0.3rem', marginTop: '0.3rem' }}>
                    {p.shared.slice(0, 4).map((i) => <Badge key={i} tone="green">{i}</Badge>)}
                  </div>
                </div>
                <Button className="btn-sm" disabled={busyId === p.id} onClick={() => invite(p)}>{busyId === p.id ? 'Inviting…' : 'Invite'}</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
