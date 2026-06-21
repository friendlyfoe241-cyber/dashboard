import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../../components/Layout.jsx';
import { useAuth } from '../../auth.jsx';
import EditorDashboard from './EditorDashboard.jsx';
import DirectorDashboard from './DirectorDashboard.jsx';
import Admin from './Admin.jsx';
import Tools from '../Tools.jsx';
import Profile from '../Profile.jsx';
import Account from '../Account.jsx';

// Editors share one shell. Sidebar + view switcher adapt to each role workspace.
export default function EditorApp() {
  const { user } = useAuth();
  const demo = user?.allViewsDemo;
  const isSuperAdmin = !demo && user?.role === 'admin';
  const isDirector = demo || user?.role === 'director' || user?.role === 'admin';
  const isAuditor = !demo && user?.role === 'auditor';
  const isAdmin = demo || isDirector || isAuditor;
  const hasQueue = demo || (!isAuditor && !isSuperAdmin);

  const nav = [];
  if (hasQueue) {
    nav.push({ to: '/editor', label: 'My Queue', icon: 'inbox', end: true, views: ['editor-queue'] });
  }
  if (isDirector) {
    nav.push({ to: '/editor/director', label: 'Director Desk', icon: 'folder-open', views: ['editor-director'] });
  }
  if (isAdmin) {
    nav.push({ to: '/editor/admin', label: 'Admin', icon: 'settings', views: ['editor-admin'] });
  }
  nav.push({ to: '/archive', label: 'Archive', icon: 'archive', views: ['*'] });
  nav.push({ spacer: true, views: ['*'] });
  nav.push({ to: '/editor/account', label: 'Account', icon: 'user', views: ['*'] });

  return (
    <Layout nav={nav}>
      <Routes>
        <Route index element={hasQueue ? <EditorDashboard /> : <Navigate to={isSuperAdmin ? '/editor/director' : '/editor/admin'} replace />} />
        {isDirector && <Route path="director" element={<DirectorDashboard />} />}
        {isAdmin && <Route path="admin" element={<Admin />} />}
        <Route path="account" element={<Account />} />
        <Route path="profile" element={<Profile />} />
        <Route path="tools" element={<Tools />} />
        <Route path="*" element={<Navigate to="/editor" replace />} />
      </Routes>
    </Layout>
  );
}
