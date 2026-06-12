import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, RequireAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Verify from './pages/Verify.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import EditorApp from './pages/editor/EditorApp.jsx';
import ResearcherApp from './pages/researcher/ResearcherApp.jsx';
import Archive from './pages/Archive.jsx';
import PublicProfile from './pages/PublicProfile.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

// Send a logged-in user to the right dashboard based on their account kind.
function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.kind === 'editor' ? '/editor' : '/researcher'} replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/reset" element={<ResetPassword />} />
        <Route path="/forgot" element={<ForgotPassword />} />
        {/* Public, no login required: the archive + member profiles. */}
        <Route path="/archive" element={<Archive />} />
        <Route path="/p/:key" element={<PublicProfile />} />
        <Route path="/" element={<HomeRedirect />} />
        <Route
          path="/editor/*"
          element={
            <RequireAuth kind="editor">
              <EditorApp />
            </RequireAuth>
          }
        />
        <Route
          path="/researcher/*"
          element={
            <RequireAuth kind="researcher">
              <ResearcherApp />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
