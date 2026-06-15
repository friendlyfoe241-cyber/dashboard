// Transactional email — pluggable. Uses Resend (https://resend.com) when
// RESEND_API_KEY is set; otherwise logs to the console (no-op) so the app runs
// without an email provider. Fire-and-forget; never blocks the workflow.

const API_KEY = process.env.RESEND_API_KEY || '';
const FROM = process.env.EMAIL_FROM || 'Synthica <noreply@synthica.org>';

// Whether real email delivery is configured. Without it, verification, password
// reset, and digests are silently logged-only — surfaced via /api/config so the
// Admin page can warn that those flows won't actually send.
export const emailEnabled = () => !!API_KEY;

export async function sendEmail({ to, subject, text }) {
  if (!to) return { ok: false, skipped: true };
  if (!API_KEY) {
    console.log(`[email] (no RESEND_API_KEY) would send to ${to}: ${subject}`);
    return { ok: false, skipped: true };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, text }),
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Notify a paper's author of a final decision.
export function emailDecision({ authorEmail, authorName, title, decision }) {
  if (!authorEmail) return;
  const published = decision === 'published';
  sendEmail({
    to: authorEmail,
    subject: published
      ? `Your Synthica submission has been accepted: ${title}`
      : `Update on your Synthica submission: ${title}`,
    text: published
      ? `Hi ${authorName || 'researcher'},\n\nGreat news — "${title}" has cleared editorial review and is being prepared for publication in the Synthica Journal. We'll follow up with next steps.\n\n— The Synthica editorial team`
      : `Hi ${authorName || 'researcher'},\n\nThank you for submitting "${title}" to the Synthica Journal. After review, it was not accepted at this time. We hope to see a revised version or future work from you.\n\n— The Synthica editorial team`,
  });
}
