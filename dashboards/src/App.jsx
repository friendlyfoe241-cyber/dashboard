import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAuth, RequireAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import UikitDemo from './pages/__UikitDemo.jsx';

// Route-level code splitting: the two dashboards (and heavier public pages)
// load on demand, so a researcher never downloads the editor app and first
// paint ships a much smaller bundle. Login stays eager — it's the entry point.
const Register = lazy(() => import('./pages/Register.jsx'));
const Verify = lazy(() => import('./pages/Verify.jsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const EditorApp = lazy(() => import('./pages/editor/EditorApp.jsx'));
const ModeratorApp = lazy(() => import('./pages/moderator/ModeratorApp.jsx'));
const ResearcherApp = lazy(() => import('./pages/researcher/ResearcherApp.jsx'));
const Archive = lazy(() => import('./pages/Archive.jsx'));
const PublicProfile = lazy(() => import('./pages/PublicProfile.jsx'));
const VerifyCertificate = lazy(() => import('./pages/VerifyCertificate.jsx'));

const PageFallback = () => <div className="page-loading"><div className="spinner" /></div>;

// Send a logged-in user to the right dashboard based on their account kind.
function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="page-loading">
      <div className="spinner" />
      <p className="home-link"><Link to="/">go home</Link></p>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.kind === 'editor' ? '/editor' : '/researcher'} replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/uikit-demo" element={<UikitDemo />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/reset" element={<ResetPassword />} />
        <Route path="/forgot" element={<ForgotPassword />} />
        {/* Public, no login required: the archive + member profiles. */}
        <Route path="/archive" element={<Archive />} />
        <Route path="/p/:key" element={<PublicProfile />} />
        <Route path="/verify-certificate" element={<VerifyCertificate />} />
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
      </Suspense>
    </ErrorBoundary>
  );
}
