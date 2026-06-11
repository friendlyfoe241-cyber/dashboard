// Weekly opportunities digest — "what's open and what's due this week".
// Data comes from store.digestData(); delivery uses the same pluggable email
// transport as everything else (logs to console without RESEND_API_KEY).
//
// Scheduling: server.js runs maybeSendWeekly() hourly when ENABLE_DIGESTS=true.
// On free-tier hosts that sleep, prefer hitting POST /api/admin/digest/send
// from an external cron (or the Admin page button) instead.

import { sendEmail } from './email.js';

const FRONTEND_URL = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
const day = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function buildDigestText(name, { listings, programs, events }) {
  const parts = [`Hi ${name || 'researcher'},\n\nHere's what's happening at Synthica this week:`];

  if (programs.length) {
    parts.push(
      '🎓 Programs open for applications:\n' +
        programs.map((p) => `  • ${p.title}${p.cohortLabel ? ` (${p.cohortLabel})` : ''}${p.applyDeadline ? ` — apply by ${day(p.applyDeadline)}` : ''}`).join('\n'),
    );
  }
  if (listings.length) {
    parts.push(
      '🔬 Open project spots:\n' +
        listings.slice(0, 6).map((l) => `  • ${l.title} (${l.category}${l.spots ? `, ${l.spots} spots` : ''})${l.leadName ? ` — led by ${l.leadName}` : ''}`).join('\n'),
    );
  }
  if (events.length) {
    parts.push(
      '📅 Deadlines in the next 7 days:\n' +
        events.map((e) => `  • ${day(e.dueAt)} — ${e.title}`).join('\n'),
    );
  }
  if (parts.length === 1) parts.push('A quiet week — a good time to start something new.');

  parts.push(`Jump back in: ${FRONTEND_URL || 'https://app.synthica.org'}/researcher\n\n— The Synthica Team`);
  return parts.join('\n\n');
}

// Sends to every approved researcher with an email. Returns delivery counts.
export async function sendWeeklyDigests(data) {
  const { recipients, ...sections } = data;
  let sent = 0;
  for (const r of recipients) {
    const res = await sendEmail({
      to: r.email,
      subject: 'Your Synthica week: open programs, projects & deadlines',
      text: buildDigestText(r.name, sections),
    });
    if (res.ok || res.skipped) sent++;
  }
  return { recipients: recipients.length, sent };
}

// Fire once a week (Monday, 13:00–13:59 UTC). The caller invokes this hourly;
// the module remembers the last send so a long-lived process won't repeat it.
let lastSentAt = 0;
export async function maybeSendWeekly(getData) {
  const now = new Date();
  const isWindow = now.getUTCDay() === 1 && now.getUTCHours() === 13;
  const sentRecently = Date.now() - lastSentAt < 6 * 24 * 3600 * 1000;
  if (!isWindow || sentRecently) return null;
  lastSentAt = Date.now();
  const out = await sendWeeklyDigests(getData());
  console.log(`[digest] weekly digest sent to ${out.sent}/${out.recipients} researchers`);
  return out;
}
