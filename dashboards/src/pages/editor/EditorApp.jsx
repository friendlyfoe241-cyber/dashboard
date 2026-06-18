import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../../components/Layout.jsx';
import { useAuth } from '../../auth.jsx';
import EditorDashboard from './EditorDashboard.jsx';
import DirectorDashboard from './DirectorDashboard.jsx';
import Admin from './Admin.jsx';
import Tools from '../Tools.jsx';
import Profile from '../Profile.jsx';
import Account from '../Account.jsx';

// Editors share one shell. Auditors get the Admin view (no review queue);
// Directors get Director Desk + Admin; the platform Admin sees everything;
// everyone else gets their review queue.
export default function EditorApp() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'admin';
  const isDirector = user?.role === 'director' || isSuperAdmin;
  const isAuditor = user?.role === 'auditor';
  const isAdmin = isDirector || isAuditor;
  // Auditors and the platform Admin have no personal review queue.
  const hasQueue = !isAuditor && !isSuperAdmin;

  const nav = [];
  if (hasQueue) nav.push({ to: '/editor', label: 'My Queue', icon: '📥', end: true });
  if (isDirector) nav.push({ to: '/editor/director', label: 'Director Desk', icon: '🗂️' });
  if (isAdmin) nav.push({ to: '/editor/admin', label: 'Admin', icon: '⚙️' });
  nav.push({ to: '/archive', label: 'Archive', icon: '📚' });
  nav.push({ to: '/editor/account', label: 'Account', icon: '👤' });

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
