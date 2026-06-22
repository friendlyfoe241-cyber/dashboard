import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Card, Badge, Button, EmptyState } from '../../components/ui.jsx';
import { useToast } from '../../components/toast.jsx';

// Projects the researcher is part of (also surfaced on Home). Leads also see
// applicants to their listings here. As a member you see the projects you've
// joined with their status and task progress (ROLE_WORKFLOWS §6.1).
export default function MyProjects() {
  const { user } = useAuth();
  const isLead = (user?.tags || []).includes('lead_researcher');
  const isIndependent = (user?.tags || []).includes('independent_researcher');
  const [projects, setProjects] = useState([]);
  useEffect(() => { api.myProjects().then(setProjects).catch(() => {}); }, []);
  return (
    <div>
      <div className="card-row" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">My Projects</h1>
          <p className="page-sub">Research projects you're part of.</p>
        </div>
        {/* Independent Researchers start projects via a research proposal (§6.2). */}
        {isIndependent && <Link className="btn btn-primary btn-sm" to="/researcher/independent" style={{ flex: 'none' }}>+ Add a project</Link>}
      </div>

      {isLead && <Applicants />}
      {projects.length === 0 ? (
        <EmptyState>You're not on any projects yet — find one in the <Link to="/researcher/hub">Research Hub</Link> and apply to join a team.</EmptyState>
      ) : (
        <div className="grid grid-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} leadId={user?.id} />
          ))}
        </div>
      )}
    </div>
  );
}

// A project the member is on: status, members, and live task progress.
function ProjectCard({ project: p, leadId }) {
  const tasks = p.tasks || [];
  const done = tasks.filter((t) => t.done || t.status === 'done').length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const isLead = p.leadId === leadId;
  const status = p.status || 'Active';
  return (
    <Link to={`/researcher/project/${p.id}`} style={{ color: 'inherit' }}>
      <Card className="paper-card">
        <div className="card-row" style={{ marginBottom: '0.4rem' }}>
          <Badge>{p.category}</Badge>
          <span className="row" style={{ gap: '0.3rem' }}>
            {isLead ? <Badge tone="gold">Lead</Badge> : <Badge tone="gray">Member</Badge>}
            <span className="muted" style={{ fontSize: '0.72rem' }}>{status}</span>
          </span>
        </div>
        <h3>{p.title}</h3>
        <p className="paper-meta">{(p.members?.length ?? 0)} members · {tasks.length} task{tasks.length === 1 ? '' : 's'}</p>
        {tasks.length > 0 && (
          <div style={{ margin: '0.5rem 0' }}>
            <div className="muted" style={{ fontSize: '0.72rem', marginBottom: '0.2rem' }}>{done}/{tasks.length} tasks done</div>
            <div className="progress"><span style={{ width: `${pct}%` }} /></div>
          </div>
        )}
        <span className="label-up">Open project →</span>
      </Card>
    </Link>
  );
}

// Applicants to the lead's own listings — accept or reject.
function Applicants() {
  const toast = useToast();
  const [apps, setApps] = useState([]);
  const load = useCallback(() => api.listingApplications().then(setApps).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const review = (a, status) => api.reviewListingApplication(a.id, status).then(() => { toast.success(`Applicant ${status}`); load(); }).catch((e) => toast.error(e.message));
  if (!apps.length) return null;
  return (
    <section style={{ marginBottom: '1.5rem' }}>
      <h2 className="section-title" style={{ marginBottom: '0.6rem' }}>Applicants to your listings <Badge tone="gray">{apps.filter((a) => a.status === 'pending').length} pending</Badge></h2>
      <div className="stack">
        {apps.map((a) => (
          <Card key={a.id}>
            <div className="card-row">
              <div>
                <strong>{a.userName}</strong>
                {a.message && <div className="muted" style={{ marginTop: '0.2rem' }}>{a.message}</div>}
                {a.resumeUrl && <a href={a.resumeUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem' }}>résumé</a>}
              </div>
              <div className="row">
                {a.status === 'pending' ? (
                  <>
                    <Button variant="approve" className="btn-sm" onClick={() => review(a, 'approved')}>Accept</Button>
                    <Button variant="reject" className="btn-sm" onClick={() => review(a, 'rejected')}>Reject</Button>
                  </>
                ) : <Badge tone={a.status === 'approved' ? 'green' : 'red'}>{a.status}</Badge>}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
