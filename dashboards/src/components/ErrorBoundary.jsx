// Error boundary to catch React errors and display a user-friendly message
// instead of a blank screen. Auto-reloads to recover from transient errors.
// Uses the same dark/light mode theme as the rest of the dashboard.
import { Component } from 'react';
import { Link } from 'react-router-dom';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
    this.autoReloadTimer = null;
    this.visibilityHandler = null;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary Caught]', error);
    console.error('[Component Stack]', info?.componentStack);
    this.setState({ errorInfo: info });
  }

  componentDidUpdate(prevProps, prevState) {
    // When error state becomes true, auto-reload after a short delay
    if (this.state.hasError && !prevState.hasError) {
      // Auto-reload after 0.25 seconds
      this.autoReloadTimer = setTimeout(() => {
        window.location.reload();
      }, 250);
    }
  }

  componentWillUnmount() {
    if (this.autoReloadTimer) {
      clearTimeout(this.autoReloadTimer);
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && this.state.hasError) {
      // User returned to the tab and error is still showing - reload
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      const { error } = this.state;
      const isNetworkError = error?.message?.includes("Can't reach the server") || 
                           error?.message?.includes("NetworkError") ||
                           error?.message?.includes("Failed to fetch") ||
                           error?.message?.includes("Network request failed");
      const isAuthError = error?.message?.includes("expired") || 
                        error?.message?.includes("401");

      // Set up visibility change listener when error shows
      if (!this.visibilityHandler) {
        this.visibilityHandler = this.handleVisibilityChange;
        document.addEventListener('visibilitychange', this.visibilityHandler);
      }

      // Use CSS variables so it respects dark/light mode
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'var(--font)',
          background: 'var(--surface, #fcfdff)',
          color: 'var(--heading, #1f2937)',
        }}>
          <div style={{
            maxWidth: 420,
            background: 'var(--card-bg, #ffffff)',
            borderRadius: 24,
            padding: '2rem',
            border: '1px solid var(--border, #e2e8f0)',
            boxShadow: '0 8px 32px rgba(0,61,130,0.1)',
          }}>
            {/* Loading spinner */}
            <div style={{
              width: 48,
              height: 48,
              border: '4px solid var(--border, #e2e8f0)',
              borderTopColor: 'var(--brand, #78b4fb)',
              borderRadius: '50%',
              margin: '0 auto 1rem',
              animation: 'spin 1s linear infinite',
            }} />
            <h1 style={{ 
              fontSize: '1.3rem', 
              fontWeight: 700, 
              color: 'var(--ink, #0f172a)', 
              margin: '0 0 0.5rem' 
            }}>
              {isNetworkError ? 'Server Waking Up' : isAuthError ? 'Session Expired' : 'Loading…'}
            </h1>
            <p style={{ 
              color: 'var(--body, #6b7280)', 
              margin: '0 0 1rem', 
              fontSize: '0.9rem' 
            }}>
              {isNetworkError 
                ? "The backend is waking up. Hang on a moment…" 
                : isAuthError 
                ? "Your session may have expired. Refreshing…"
                : "Please wait while we load the page…"}
            </p>
            <p style={{ 
              color: 'var(--body-alt, #9ca3af)', 
              fontSize: '0.8rem',
              margin: 0 
            }}>
              If this persists, <Link to="/" style={{ color: 'var(--brand-deep, #1a6bb5)' }}>go home</Link>
            </p>
          </div>
          {/* Keyframe animation style */}
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      );
    }
    return this.props.children;
  }
}