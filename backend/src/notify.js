// Discord webhook notifier (fire-and-forget).
//
// The webhook URL is configured at runtime by the Director (PUT /editor/settings)
// or via the DISCORD_WEBHOOK_URL env var (which also makes it survive restarts).
// Whenever a paper moves up a level — or is declined — a rich embed is posted to
// the configured Discord channel so the whole server can watch the queue.

let webhookUrl = (process.env.DISCORD_WEBHOOK_URL || '').trim();
// A second, generic channel — point it at a WhatsApp relay (Twilio/Make/Zapier
// webhook) that forwards a JSON {text} payload to a WhatsApp number/group.
let whatsappUrl = (process.env.WHATSAPP_WEBHOOK_URL || '').trim();

export const getWebhook = () => webhookUrl;
export const setWebhook = (url) => {
  webhookUrl = (url || '').trim();
  return webhookUrl;
};
export const getWhatsapp = () => whatsappUrl;
export const setWhatsapp = (url) => {
  whatsappUrl = (url || '').trim();
  return whatsappUrl;
};

async function postWhatsapp(text) {
  if (!whatsappUrl) return;
  try {
    await fetch(whatsappUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  } catch {
    /* ignore */
  }
}

const COLOR = { move: 0x2589ed, published: 0xffd700, declined: 0xef4444 };

export async function postDiscord(payload) {
  if (!webhookUrl) return { ok: false, skipped: true };
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Called from the workflow whenever a paper advances or is declined.
export function notifyMove({ title, paperId, category, label, decision }) {
  if (!webhookUrl) return;
  const kind = decision === 'declined' ? 'declined' : decision === 'published' ? 'published' : 'move';
  const embed = {
    title:
      kind === 'declined' ? '❌ Paper declined' : kind === 'published' ? '🎉 Paper ready to publish' : '📤 Paper moved up',
    color: COLOR[kind],
    fields: [
      { name: 'Paper', value: `${title} (#${String(paperId).replace('paper_', '')})` },
      { name: 'Subject', value: category || '—', inline: true },
      { name: 'Status', value: label || '—', inline: true },
    ],
    footer: { text: 'Synthica editorial queue' },
    timestamp: new Date().toISOString(),
  };
  // Fire-and-forget so the request never blocks the workflow.
  postDiscord({ username: 'Synthica', embeds: [embed] });
  postWhatsapp(`${embed.title}: ${title} — ${label || ''}`);
}

// Generic event ping (researcher-side events: applications, onboarding, etc.).
export function notifyEvent({ title, body }) {
  postDiscord({
    username: 'Synthica',
    embeds: [{ title, description: body || '', color: COLOR.move, timestamp: new Date().toISOString() }],
  });
  postWhatsapp(`${title}: ${body || ''}`);
}

export function sendTest() {
  return postDiscord({
    username: 'Synthica',
    content: "✅ Synthica webhook connected — you'll get editorial queue updates here.",
  });
}
