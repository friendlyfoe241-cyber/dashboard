import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Card, Badge, Button, EmptyState } from '../../components/ui.jsx';
import { useToast } from '../../components/toast.jsx';

// Projects the researcher is part of (also surfaced on Home). Leads also see
// applicants to their listings here.
export default function MyProjects() {
  const { user } = useAuth();
  const isLead = (user?.tags || []).includes('lead_researcher');
  const [projects, setProjects] = useState([]);
  useEffect(() => { api.myProjects().then(setProjects).catch(() => {}); }, []);
  return (
    <div>
      <h1 className="page-title">My Projects</h1>
      <p className="page-sub">Research projects you're part of.</p>

      {isLead && <Applicants />}
      {projects.length === 0 ? (
        <EmptyState>You're not on any projects yet — find one in <Link to="/researcher/opportunities">Opportunities</Link>.</EmptyState>
      ) : (
        <div className="grid grid-3">
          {projects.map((p) => (
            <Link key={p.id} to={`/researcher/project/${p.id}`} style={{ color: 'inherit' }}>
              <Card className="paper-card">
                <Badge>{p.category}</Badge>
                <h3>{p.title}</h3>
                <p className="paper-meta">{p.members.length} members · {p.tasks.length} tasks</p>
                <span className="label-up">Open project →</span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
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
