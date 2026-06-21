// Small set of brand-styled UI primitives shared across both dashboards.
import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';

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

export function Button({ children, variant = 'primary', size = '', ...rest }) {
  // Build class string: btn is always present, variant class is derived from prop,
  // and size can be passed via size prop or any other additional classes via className in rest
  const classes = [
    'btn',
    `btn-${variant}`,
    size,
    rest.className || '',
  ].filter(Boolean).join(' ');
  // Remove className from rest so it doesn't get passed as HTML attribute
  const { className: _unused, ...restProps } = rest;
  return (
    <button className={classes} {...restProps}>
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
export function IconLabel({ icon, children, size = 16, className = '' }) {
  return <span className={`icon-label ${className}`.trim()}><Icon name={icon} size={size} />{children}</span>;
}

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
