// Real-time client: a single Server-Sent-Events connection to /api/stream that
// fan-outs server events (new message, new notification) to subscribers, so the
// feed, the bell, and open chat threads update live instead of on refresh.
import { useEffect, useRef } from 'react';
import { apiBase, getToken } from './api.js';

const TYPES = ['message', 'notification', 'ready'];
const handlers = { message: new Set(), notification: new Set(), ready: new Set() };
let es = null;
let refs = 0;

function connect() {
  if (es) return;
  const token = getToken();
  if (!token) return;
  es = new EventSource(`${apiBase}/api/stream?token=${encodeURIComponent(token)}`);
  for (const type of TYPES) {
    es.addEventListener(type, (e) => {
      let data = {};
      try { data = JSON.parse(e.data); } catch { /* ignore */ }
      handlers[type].forEach((fn) => { try { fn(data); } catch { /* ignore */ } });
    });
  }
  // The browser auto-reconnects EventSource on transient errors.
}

function disconnect() {
  if (es) { es.close(); es = null; }
}

// Subscribe a component to a realtime event type for its lifetime.
export function useRealtime(type, handler) {
  const saved = useRef(handler);
  saved.current = handler;
  useEffect(() => {
    refs += 1;
    connect();
    const fn = (data) => saved.current?.(data);
    handlers[type]?.add(fn);
    return () => {
      handlers[type]?.delete(fn);
      refs -= 1;
      if (refs <= 0) disconnect();
    };
  }, [type]);
}
