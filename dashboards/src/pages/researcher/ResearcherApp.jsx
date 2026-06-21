import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../../components/Layout.jsx';
import Icon from '../../components/Icon.jsx';
import { useAuth } from '../../auth.jsx';
import { api } from '../../api.js';
import OnboardingWizard from '../../components/OnboardingWizard.jsx';
import RolePicker from '../../components/RolePicker.jsx';
import Dashboard from './Dashboard.jsx';
import ProjectDetail from './ProjectDetail.jsx';
import ResearchHub from './ResearchHub.jsx';
import ApplicationHub from './ApplicationHub.jsx';
import Opportunities from './Opportunities.jsx';
import Explore from './Explore.jsx';
import MyProjects from './MyProjects.jsx';
import People from './People.jsx';
import MyJournal from './MyJournal.jsx';
import Community from './Community.jsx';
import Messages from './Messages.jsx';
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
        <div className="ob-emoji"><Icon name="party" size={40} /></div>
        <h2>Congrats on your new role!</h2>
        <p>You're officially a <strong>{user.newRoleCongrats}</strong> at Synthica. Welcome aboard — your dashboard is ready.</p>
        <button className="btn btn-primary ob-next" disabled={busy} onClick={dismiss}>{busy ? '…' : "Let's go"}</button>
      </div>
    </div>
  );
}

// Researcher shell — sidebar adapts to the active role view (member, lead, chapter).
export default function ResearcherApp() {
  const { user } = useAuth();

  const demo = user?.allViewsDemo;
  const tags = demo
    ? ['lead_researcher', 'chapter_leader', 'associate_researcher']
    : (user?.tags || []);
  const isLead = demo || tags.includes('lead_researcher');

  const nav = [
    { to: '/researcher', label: 'Home', icon: 'home', end: true, views: ['*'] },

    ...(isLead ? [
      { section: 'Lead workspace', views: ['lead'] },
      { to: '/researcher/hub', label: 'Lead hub', icon: 'rocket', views: ['lead'] },
      { to: '/researcher/projects', label: 'Projects', icon: 'folder', views: ['lead'] },
      { to: '/researcher/groups', label: 'Groups', icon: 'flask', views: ['lead'] },
      { to: '/researcher/explore', label: 'Explore', icon: 'globe', views: ['lead'] },
    ] : []),

    { section: 'Community', views: ['researcher', 'chapter'] },
    { to: '/researcher/community', label: 'Feed', icon: 'megaphone', views: ['researcher', 'chapter'] },
    { to: '/researcher/messages', label: 'Messages', icon: 'message', views: ['researcher', 'chapter'] },
    { to: '/researcher/people', label: 'People', icon: 'users', views: ['researcher', 'chapter'] },

    { section: 'Research', views: ['researcher', 'chapter'] },
    { to: '/researcher/projects', label: 'Projects', icon: 'folder', views: ['researcher', 'chapter'] },
    { to: '/researcher/groups', label: 'Groups', icon: 'flask', views: ['researcher', 'chapter'] },
    { to: '/researcher/journal', label: 'Journal', icon: 'book-open', views: ['researcher'] },
    { to: '/researcher/calendar', label: 'Calendar', icon: 'calendar', views: ['researcher', 'chapter'] },
    { to: '/researcher/drive', label: 'Drive', icon: 'folder-open', views: ['researcher'] },

    { section: 'Discover', views: ['researcher'] },
    { to: '/researcher/explore', label: 'Explore', icon: 'rocket', views: ['researcher'] },

    { spacer: true, views: ['*'] },
    { to: '/archive', label: 'Archive', icon: 'archive', views: ['*'] },
    { to: '/researcher/account', label: 'Account', icon: 'user', views: ['*'] },
  ];

  return (
    <Layout nav={nav}>
      <RoleCongrats />
      <OnboardingWizard />
      <RolePicker />
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="community" element={<Community />} />
        <Route path="messages" element={<Messages />} />
        <Route path="messages/:userId" element={<Messages />} />
        <Route path="projects" element={<MyProjects />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="drive" element={<Drive />} />
        <Route path="people" element={<People />} />
        <Route path="project/:id" element={<ProjectDetail />} />
        <Route path="journal" element={<MyJournal />} />
        <Route path="explore" element={<Explore />} />
        <Route path="opportunities" element={<Opportunities />} />
        <Route path="programs" element={<Programs />} />
        <Route path="groups" element={<Groups />} />
        <Route path="groups/:id" element={<GroupDetail />} />
        <Route path="competitions" element={<Competitions />} />
        <Route path="news" element={<News />} />
        <Route path="account" element={<Account />} />
        <Route path="hub" element={<ResearchHub />} />
        <Route path="apply" element={<ApplicationHub />} />
        <Route path="profile" element={<Profile />} />
        <Route path="tools" element={<Tools />} />
        <Route path="*" element={<Navigate to="/researcher" replace />} />
      </Routes>
    </Layout>
  );
}
