import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

// Notification bell with unread count + dropdown. Polls every 30s.
export default function Bell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const load = () => api.notifications().then(setItems).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const unread = items.filter((n) => !n.read).length;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread) {
      api.markNotificationsRead([]).then(() => setItems((xs) => xs.map((n) => ({ ...n, read: true }))));
    }
  };

  const go = (n) => {
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="bell" ref={ref}>
      <button className="bell-btn" onClick={toggle} aria-label="Notifications">
        🔔{unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="bell-menu">
          <div className="bell-head">Notifications</div>
          {items.length === 0 ? (
            <div className="bell-empty">You're all caught up.</div>
          ) : (
            items.slice(0, 20).map((n) => (
              <button key={n.id} className={`bell-item ${n.read ? '' : 'unread'}`} onClick={() => go(n)}>
                <div className="bell-title">{n.title}</div>
                {n.body && <div className="bell-body">{n.body}</div>}
                <div className="bell-time">{new Date(n.at).toLocaleString()}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
