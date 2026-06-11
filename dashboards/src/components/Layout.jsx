import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import Bell from './Bell.jsx';
import CommandPalette from './CommandPalette.jsx';

// SPAs keep stale state when you leave the browser tab and come back, so the
// page looks blank/old until a manual refresh. This remounts the routed content
// when the tab regains focus after being hidden a moment — every page's load
// effect re-runs, so data is fresh without a full reload. Only fires after a
// real away-and-back (not on quick alt-tabs) to avoid disrupting active use.
function useTabRevalidate() {
  const [rev, setRev] = useState(0);
  useEffect(() => {
    let hiddenAt = 0;
    const onHide = () => { if (document.visibilityState === 'hidden') hiddenAt = Date.now(); };
    const onShow = () => {
      if (document.visibilityState === 'visible' && hiddenAt && Date.now() - hiddenAt > 800) {
        hiddenAt = 0;
        setRev((r) => r + 1);
      }
    };
    // pageshow with persisted=true => restored from the back/forward cache.
    const onPageShow = (e) => { if (e.persisted) setRev((r) => r + 1); };
    document.addEventListener('visibilitychange', onHide);
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);
  return rev;
}

// Light/dark toggle — persisted, applied on <html data-theme>.
function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark');
  const flip = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try { localStorage.setItem('synthica.theme', next ? 'dark' : 'light'); } catch { /* ignore */ }
  };
  return (
    <button className="theme-toggle" onClick={flip} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>
      {dark ? '☀️' : '🌙'}
    </button>
  );
}

// App shell: top bar + role-aware sidebar navigation.
export default function Layout({ children, nav = [] }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sent, setSent] = useState(false);
  const rev = useTabRevalidate();

  const onLogout = () => {
    logout();
    navigate('/login');
  };

  const resend = () => api.resendVerification().then(() => setSent(true)).catch(() => setSent(true));

  return (
    <div className="app-shell">
      {user && user.emailVerified === false && (
        <div className="verify-banner">
          Please verify your email to secure your account.{' '}
          {sent ? <strong>Verification email sent.</strong> : <button className="link-btn" onClick={resend}>Resend link</button>}
        </div>
      )}
      <header className="topbar">
        <div className="topbar-brand"><img className="brand-img" src="/assets/logo/logo.png" alt="" />Synthica</div>
        <div className="topbar-right">
          <button className="cmdk-trigger" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))} aria-label="Search">
            🔍 <span className="cmdk-hint">⌘K</span>
          </button>
          <ThemeToggle />
          <Bell />
          <span className="topbar-user">
            {user?.name}
            {user?.role && <span className="topbar-role"> · {user.role}</span>}
            {user?.category && <span className="topbar-role"> · {user.category}</span>}
          </span>
          <button className="btn btn-ghost" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>
      <div className="app-body">
        <aside className="sidebar">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </aside>
        <main className="content" key={rev}>{children}</main>
      </div>
      <CommandPalette nav={nav} />
    </div>
  );
}
