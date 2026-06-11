import { useEffect, useMemo, useState, useCallback } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Card, Badge, Button, Field } from '../../components/ui.jsx';
import { useToast } from '../../components/toast.jsx';

const KIND_META = {
  paper: { icon: '📄', tone: 'gold', label: 'Paper' },
  task: { icon: '✅', tone: 'blue', label: 'Task' },
  event: { icon: '📅', tone: 'gray', label: 'Event' },
  pathway: { icon: '🧭', tone: 'gray', label: 'Pathway' },
};
const iso = (d) => d.toISOString().slice(0, 10);

// Shared calendar: lead-set deadlines, dated project tasks, and your own
// pathway steps — one month grid + an upcoming list.
export default function Calendar() {
  const { user } = useAuth();
  const isLead = (user?.tags || []).includes('lead_researcher') || (user?.tags || []).includes('chapter_leader');
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selected, setSelected] = useState(iso(new Date()));
  const [open, setOpen] = useState(false);

  const load = useCallback(() => api.calendar().then(setItems).catch(() => {}), []);
  useEffect(load, [load]);

  const byDate = useMemo(() => {
    const m = {};
    for (const it of items) (m[it.date] = m[it.date] || []).push(it);
    return m;
  }, [items]);

  // Build the month grid (weeks starting Monday).
  const cells = useMemo(() => {
    const first = new Date(month);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [month]);

  const today = iso(new Date());
  const upcoming = items.filter((it) => it.date >= today).slice(0, 8);
  const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const shift = (n) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  const remove = (it) =>
    api.deleteEvent(it.id).then(() => { toast.success('Deadline removed'); load(); }).catch((e) => toast.error(e.message));

  return (
    <div>
      <div className="card-row" style={{ marginBottom: '0.25rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Calendar</h1>
        {isLead && <Button onClick={() => setOpen((o) => !o)}>{open ? 'Close' : '+ Set a deadline'}</Button>}
      </div>
      <p className="page-sub">Deadlines from your project leads, task due dates, and your pathway — all in one place.</p>

      {open && <DeadlineForm onAdded={() => { setOpen(false); load(); toast.success('Deadline set — your team has been notified'); }} />}

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', alignItems: 'start' }}>
        <Card className="cal-card">
          <div className="card-row" style={{ marginBottom: '0.75rem' }}>
            <strong style={{ fontSize: '1.05rem' }}>{monthLabel}</strong>
            <span className="row" style={{ gap: '0.3rem' }}>
              <button className="cal-nav" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
              <button className="cal-nav" onClick={() => { setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setSelected(today); }}>Today</button>
              <button className="cal-nav" onClick={() => shift(1)} aria-label="Next month">›</button>
            </span>
          </div>
          <div className="cal-grid cal-head">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="cal-grid">
            {cells.map((d) => {
              const key = iso(d);
              const inMonth = d.getMonth() === month.getMonth();
              const dayItems = byDate[key] || [];
              return (
                <button
                  key={key}
                  className={`cal-day ${inMonth ? '' : 'dim'} ${key === today ? 'today' : ''} ${key === selected ? 'sel' : ''}`}
                  onClick={() => setSelected(key)}
                >
                  <span className="cal-num">{d.getDate()}</span>
                  {dayItems.length > 0 && (
                    <span className="cal-dots">
                      {dayItems.slice(0, 3).map((it, i) => <i key={i} className={`cal-dot dot-${it.kind}`} />)}
                      {dayItems.length > 3 && <em>+{dayItems.length - 3}</em>}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: '0.9rem' }}>
            <div className="muted" style={{ marginBottom: '0.4rem' }}>
              {new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            {(byDate[selected] || []).length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>Nothing due this day.</p>
            ) : (
              <div className="stack">
                {byDate[selected].map((it) => <CalRow key={it.id} it={it} onRemove={remove} />)}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0 }}>Coming up</h3>
          {upcoming.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No upcoming deadlines. Enjoy the calm 🌤</p>
          ) : (
            <div className="stack">
              {upcoming.map((it) => <CalRow key={it.id} it={it} onRemove={remove} showDate />)}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function CalRow({ it, onRemove, showDate }) {
  const meta = KIND_META[it.kind] || KIND_META.event;
  const overdue = it.date < new Date().toISOString().slice(0, 10);
  return (
    <div className="cal-item">
      <span className="cal-item-icon">{meta.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{it.title}</div>
        <div className="muted" style={{ fontSize: '0.78rem' }}>
          {showDate && <>{new Date(`${it.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · </>}
          {it.context}{it.byName ? ` · set by ${it.byName}` : ''}
        </div>
      </div>
      <Badge tone={overdue ? 'red' : meta.tone}>{overdue ? 'overdue' : meta.label}</Badge>
      {it.canDelete && <button className="link-btn" onClick={() => onRemove(it)} aria-label="Delete">✕</button>}
    </div>
  );
}

// Lead-only: create a task/paper deadline on one of their projects.
function DeadlineForm({ onAdded }) {
  const { user } = useAuth();
  const toast = useToast();
  const [targets, setTargets] = useState([]); // { value, label } project: / chapter: prefixed
  const [f, setF] = useState({ title: '', type: 'task', dueAt: '', target: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.allSettled([api.myProjects(), api.chapter()]).then(([pr, ch]) => {
      const t = [];
      if (pr.status === 'fulfilled')
        for (const p of pr.value.filter((x) => x.leadId === user.id)) t.push({ value: `project:${p.id}`, label: `📁 ${p.title}` });
      if (ch.status === 'fulfilled' && ch.value?.id) t.push({ value: `chapter:${ch.value.id}`, label: `🌍 ${ch.value.name} (chapter)` });
      setTargets(t);
      if (t[0]) setF((x) => ({ ...x, target: t[0].value }));
    });
  }, [user.id]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const [kind, id] = f.target.split(':');
    try {
      await api.addEvent({ title: f.title, type: f.type, dueAt: f.dueAt, projectId: kind === 'project' ? id : undefined, chapterId: kind === 'chapter' ? id : undefined });
      onAdded();
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  if (!targets.length) {
    return <Card style={{ marginBottom: '1rem' }}><p className="muted" style={{ margin: 0 }}>You need to lead a project or a chapter before setting deadlines.</p></Card>;
  }
  return (
    <Card style={{ marginBottom: '1rem' }}>
      <form onSubmit={submit}>
        <Field label="What's due?"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Submit final manuscript draft" required /></Field>
        <div className="grid grid-3">
          <Field label="Type">
            <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              <option value="task">Project task</option>
              <option value="paper">Paper deadline</option>
              <option value="event">Event</option>
            </select>
          </Field>
          <Field label="Due date"><input type="date" value={f.dueAt} onChange={(e) => setF({ ...f, dueAt: e.target.value })} required /></Field>
          <Field label="For">
            <select value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })}>
              {targets.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
        </div>
        <Button type="submit" disabled={busy}>{busy ? 'Setting…' : 'Set deadline'}</Button>
        <span className="muted" style={{ marginLeft: '0.6rem', fontSize: '0.8rem' }}>Everyone in the project or chapter sees it + gets a notification.</span>
      </form>
    </Card>
  );
}
