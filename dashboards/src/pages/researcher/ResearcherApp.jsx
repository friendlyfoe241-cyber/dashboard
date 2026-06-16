import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../../components/Layout.jsx';
import { useAuth } from '../../auth.jsx';
import { api } from '../../api.js';
import PendingApproval from './PendingApproval.jsx';
import Dashboard from './Dashboard.jsx';
import ProjectDetail from './ProjectDetail.jsx';
import ResearchHub from './ResearchHub.jsx';
import ApplicationHub from './ApplicationHub.jsx';
import Opportunities from './Opportunities.jsx';
import MyProjects from './MyProjects.jsx';
import People from './People.jsx';
import MyJournal from './MyJournal.jsx';
import Programs from './Programs.jsx';
import Groups from './Groups.jsx';
import GroupDetail from './GroupDetail.jsx';
import Competitions from './Competitions.jsx';
import News from './News.jsx';
import Calendar from './Calendar.jsx';
import Drive from './Drive.jsx';
import Tools from '../Tools.jsx';
import Profile from '../Profile.jsx';
import Account from '../Account.jsx';

// One-time celebration the first time a member opens the app after an auditor
// assigns (or upgrades) their role.
function RoleCongrats() {
  const { user, refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!user?.newRoleCongrats) return null;
  const dismiss = async () => {
    setBusy(true);
    try { await api.updateProfile({ congratsSeen: true }); await refreshUser(); } finally { setBusy(false); }
  };
  return (
    <div className="ob-overlay">
      <div className="ob-card" style={{ textAlign: 'center' }}>
        <div className="ob-emoji">🎉</div>
        <h2>Congrats on your new role!</h2>
        <p>You're officially a <strong>{user.newRoleCongrats}</strong> at Synthica. Welcome aboard — your dashboard is ready.</p>
        <button className="btn btn-primary ob-next" disabled={busy} onClick={dismiss}>{busy ? '…' : "Let's go"}</button>
      </div>
    </div>
  );
}

// Consolidated nav: Home · My Projects · Synthica Journal · Archive · Opportunities · People · Account.
export default function ResearcherApp() {
  const { user } = useAuth();
  // Newly-registered members can't use the app until an auditor assigns a role.
  if (user && user.approved === false) return <PendingApproval />;

  const nav = [
    { to: '/researcher', label: 'Home', end: true },
    { to: '/researcher/projects', label: 'My Projects' },
    { to: '/researcher/groups', label: 'Groups' },
    { to: '/researcher/competitions', label: 'Competitions' },
    { to: '/researcher/news', label: 'News' },
    { to: '/researcher/calendar', label: 'Calendar' },
    { to: '/researcher/drive', label: 'Drive' },
    { to: '/researcher/journal', label: 'Synthica Journal' },
    { to: '/archive', label: 'Synthica Archive' },
    { to: '/researcher/opportunities', label: 'Opportunities' },
    { to: '/researcher/programs', label: 'Programs' },
    { to: '/researcher/people', label: 'People' },
    { to: '/researcher/account', label: 'Account' },
  ];

  return (
    <Layout nav={nav}>
      <RoleCongrats />
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<MyProjects />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="drive" element={<Drive />} />
        <Route path="people" element={<People />} />
        <Route path="project/:id" element={<ProjectDetail />} />
        <Route path="journal" element={<MyJournal />} />
        <Route path="opportunities" element={<Opportunities />} />
        <Route path="programs" element={<Programs />} />
        <Route path="groups" element={<Groups />} />
        <Route path="groups/:id" element={<GroupDetail />} />
        <Route path="competitions" element={<Competitions />} />
        <Route path="news" element={<News />} />
        <Route path="account" element={<Account />} />
        {/* Deep-link routes kept so existing links still resolve. */}
        <Route path="hub" element={<ResearchHub />} />
        <Route path="apply" element={<ApplicationHub />} />
        <Route path="profile" element={<Profile />} />
        <Route path="tools" element={<Tools />} />
        <Route path="*" element={<Navigate to="/researcher" replace />} />
      </Routes>
    </Layout>
  );
}
