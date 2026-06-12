// Error boundary to catch React errors and display a user-friendly message
// instead of a blank screen.
import { Component } from 'react';
import { Link } from 'react-router-dom';

// Global error handler to catch unhandled promise rejections and other errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    console.error('[Unhandled Error]', e.error);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[Unhandled Promise Rejection]', e.reason);
  });
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary Caught]', error);
    console.error('[Component Stack]', info?.componentStack);
    this.setState({ errorInfo: info });
  }

  render() {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;
      const isNetworkError = error?.message?.includes("Can't reach the server") || 
                           error?.message?.includes("NetworkError") ||
                           error?.message?.includes("Failed to fetch");
      const isAuthError = error?.message?.includes("expired") || 
                        error?.message?.includes("401");

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'var(--font, -apple-system, BlinkMacSystemFont, sans-serif)',
          background: 'linear-gradient(180deg, #2589ed 0%, #4999e8 5%, #69aaec 35%, #99ccff 65%, #ffffff 100%)',
        }}>
          <div style={{ maxWidth: 420, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderRadius: 24, padding: '2rem', border: '1px solid rgba(255,255,255,0.4)', boxShadow: '0 8px 32px rgba(0,61,130,0.2)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--ink, #0f172a)', margin: '0 0 0.5rem' }}>
              {isNetworkError ? 'Server Waking Up' : isAuthError ? 'Session Expired' : 'Something went wrong'}
            </h1>
            <p style={{ color: 'var(--body, #6b7280)', margin: '0 0 1.5rem', fontSize: '0.9rem' }}>
              {isNetworkError 
                ? "The backend is waking up (this happens on free hosting). The page will reload automatically." 
                : isAuthError 
                ? "Your session has expired. Please sign in again."
                : "We encountered an error loading this page."}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  if (isNetworkError || isAuthError) {
                    window.location.reload();
                  } else {
                    this.setState({ hasError: false, error: null, errorInfo: null });
                  }
                }}
                className="btn btn-primary"
                style={{ padding: '0.55rem 1.2rem', borderRadius: 25, border: 'none', cursor: 'pointer' }}
              >
                {isNetworkError || isAuthError ? 'Reload page' : 'Try again'}
              </button>
              <Link
                to="/"
                className="btn btn-ghost"
                style={{ padding: '0.55rem 1.2rem', borderRadius: 25, textDecoration: 'none' }}
              >
                Go home
              </Link>
            </div>
            {process.env.NODE_ENV === 'development' && error && (
              <details style={{ marginTop: '1rem', textAlign: 'left' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: 'var(--body)' }}>Technical details</summary>
                <pre style={{
                  marginTop: '0.5rem',
                  padding: '0.75rem',
                  background: '#f5f5f5',
                  borderRadius: 8,
                  fontSize: '0.7rem',
                  overflow: 'auto',
                  maxHeight: 150,
                }}>
                  {error.toString()}
                  {errorInfo?.componentStack && `\n\nComponent Stack:\n${errorInfo.componentStack}`}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}