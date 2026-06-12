// Error boundary to catch React errors and display a user-friendly message
// instead of a blank screen.
import { Component } from 'react';
import { Link } from 'react-router-dom';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'var(--font, -apple-system, BlinkMacSystemFont, sans-serif)',
        }}>
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--ink, #0f172a)', margin: '0 0 0.5rem' }}>
              Something went wrong
            </h1>
            <p style={{ color: 'var(--body, #6b7280)', margin: '0 0 1.5rem' }}>
              We encountered an error loading this page.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '0.55rem 1.2rem',
                  borderRadius: 25,
                  border: 'none',
                  background: 'linear-gradient(90deg, rgba(120, 180, 251, 0.9), rgba(120, 180, 251, 0.7))',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Reload page
              </button>
              <Link
                to="/"
                style={{
                  padding: '0.55rem 1.2rem',
                  borderRadius: 25,
                  border: '1px solid var(--border, #e2e8f0)',
                  background: '#fff',
                  color: 'var(--brand-deep, #1a6bb5)',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Go home
              </Link>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre style={{
                marginTop: '1rem',
                padding: '1rem',
                background: '#f5f5f5',
                borderRadius: 8,
                fontSize: '0.75rem',
                textAlign: 'left',
                overflow: 'auto',
                maxHeight: 200,
              }}>
                {this.state.error.toString()}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}