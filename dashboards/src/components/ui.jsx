// Small set of brand-styled UI primitives shared across both dashboards.
import { useEffect, useState } from 'react';

export function Card({ children, className = '', ...rest }) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function Badge({ children, tone = 'blue' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Button({ children, variant = 'primary', ...rest }) {
  return (
    <button className={`btn btn-${variant}`} {...rest}>
      {children}
    </button>
  );
}

export function SectionTitle({ badge, children, highlight }) {
  return (
    <div className="section-head">
      {badge && <div className="section-badge">{badge}</div>}
      <h2 className="section-title">
        {children} {highlight && <span className="yellow-text">{highlight}</span>}
      </h2>
    </div>
  );
}

export function EmptyState({ children }) {
  return <div className="empty-state">{children}</div>;
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export function Modal({ title, onClose, children, wide }) {
  // Close on Escape.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}


// Profile picture with graceful fallback: broken/missing URLs show initials
// on the brand gradient instead of a broken-image icon.
export function Pfp({ name, url, size }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  const initials = String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
  const cls = `pfp ${size === 'lg' ? 'pfp-lg' : size === 'xs' ? 'pfp-xs' : ''}`;
  return (
    <span className={cls}>
      {url && !broken ? <img src={url} alt={name || ''} onError={() => setBroken(true)} /> : initials}
    </span>
  );
}
