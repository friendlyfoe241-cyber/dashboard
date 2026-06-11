# Deploying Synthica

Three deployable pieces:

| Piece | Folder | What it is | Host |
|-------|--------|------------|------|
| Marketing site | `website/` | Static HTML/CSS/JS | Vercel / Netlify / GitHub Pages |
| Backend API | `backend/` | Node + Express | Render / Railway / Fly.io |
| Dashboards | `dashboards/` | React + Vite SPA | Vercel / Netlify |

The two frontends talk to the backend, so **deploy the backend first**, then point the frontends at its URL.

---

## A. Run it all locally

```bash
npm run install:all   # first time only
npm run dev           # backend :4000 · dashboards :5173 · website :8080
npm --prefix backend run test:workflow   # exercises every pipeline path
```

Log in with the demo accounts in `README.md` (password `demo1234`).

---

## B. Deploy to the cloud

### 1) Backend → Render

- **New → Blueprint** → pick the repo (reads [`render.yaml`](render.yaml)), **or** New → Web Service with **Root Directory `backend`**, build `npm install`, start `node server.js`.
- A [`Dockerfile`](backend/Dockerfile) is included for container hosts.
- Set the env vars from the [table below](#environment-variables) (at minimum `AUTH_SECRET`).
- Verify: `https://<backend>/api/health` → `{ "ok": true }`.
- Free tier sleeps after ~15 min idle (first request after wakes in ~30s).

### 2) Dashboards → Vercel

- **New Project** → **Root Directory `dashboards`** (uses [`dashboards/vercel.json`](dashboards/vercel.json)).
- Env: `VITE_API_BASE` = backend URL (no trailing slash); `VITE_GOOGLE_CLIENT_ID` if using Google.
- Redeploy after changing env vars (Vite inlines them at build time).

### 3) Marketing site → Vercel

- **New Project** → **Root Directory `website`**, framework **Other** (no build step).
- To pull live journal/profile data, add to the `<head>` of `journal-archive.html`, `article.html`, `profile.html` **before** `journal-data.js`:
  ```html
  <script>window.SYNTHICA_API_BASE = 'https://<backend>';</script>
  ```
  Without it those pages use built-in sample data.

> Tip: put the site on the apex domain and the dashboards on a subdomain (e.g. `app.synthica.org`) under each Vercel project's **Settings → Domains**.

---

## Adding Google Sign-In (OAuth)

1. **Google Cloud Console** (https://console.cloud.google.com) → create/select a project.
2. **APIs & Services → OAuth consent screen** → External → fill app name, support email, logo; add scopes `email`, `profile`, `openid`; add yourself as a test user (or Publish).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** → **Web application**.
   - **Authorized JavaScript origins:** your dashboards URL(s), e.g.
     `https://app.synthica.org`, `https://synthica-dashboards.vercel.app`, and `http://localhost:5173` for local dev.
   - (No redirect URI needed — we use the Google Identity Services popup/one-tap, not a redirect flow.)
   - Copy the **Client ID** (looks like `…apps.googleusercontent.com`).
4. Set it in **two** places (same value):
   - Backend (Render → Environment): `GOOGLE_CLIENT_ID=…`
   - Dashboards (Vercel → Environment): `VITE_GOOGLE_CLIENT_ID=…` → **redeploy**.
5. Done. A "Continue with Google" button now appears on Login + Register. The backend verifies the Google ID token (audience/issuer/expiry) and links by email or creates a new researcher.

If the client id is unset, the button simply doesn't render — everything else works.

---

## Integrations (optional)

| Feature | How |
|---------|-----|
| **Discord queue alerts** | Director → Admin → Integrations → paste a channel webhook (Discord → Channel → Integrations → Webhooks → New). Or set `DISCORD_WEBHOOK_URL`. |
| **WhatsApp alerts** | Point `WHATSAPP_WEBHOOK_URL` (or Admin → Integrations) at a Twilio/Make/Zapier webhook that forwards `{text}` to WhatsApp. |
| **Author emails** | Set `RESEND_API_KEY` (https://resend.com) + `EMAIL_FROM`. Without it, decision emails are logged only. |
| **Persistent data** | Google Sheets — see [`docs/GOOGLE_SHEETS.md`](docs/GOOGLE_SHEETS.md). Set `DATA_PROVIDER=sheets`, `SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`, then `npm run seed:sheet`. |

---

## Environment variables

| Where | Variable | Required? | Example / notes |
|-------|----------|-----------|-----------------|
| backend | `PORT` | host-set | `4000` |
| backend | `AUTH_SECRET` | **yes (prod)** | long random string; signs session tokens |
| backend | `NODE_ENV` | prod | set to `production` (backend won't boot without AUTH_SECRET) |
| backend | `CORS_ORIGINS` | **yes (prod)** | comma-separated allowed origins, e.g. `https://app.synthica.org` |
| backend | `FRONTEND_URL` | for emails | dashboards base URL (verify/reset links) |
| backend | `GOOGLE_CLIENT_ID` | for Google login | `…apps.googleusercontent.com` |
| backend | `RESEND_API_KEY` | optional | author decision emails |
| backend | `EMAIL_FROM` | optional | `Synthica <noreply@synthica.org>` |
| backend | `DISCORD_WEBHOOK_URL` | optional | queue notifications |
| backend | `WHATSAPP_WEBHOOK_URL` | optional | queue notifications (relay) |
| backend | `DATA_PROVIDER` | **yes (prod)** | `memory` (default) or `sheets`. Memory loses ALL data on restart (the backend warns loudly in prod) |
| backend | `SHEETS_SPREADSHEET_ID` | if sheets | spreadsheet id from URL |
| backend | `GOOGLE_SERVICE_ACCOUNT_JSON` | if sheets | service-account JSON (inline) |
| backend | `ALLOW_DEMO_LOGINS` | leave unset | in production the shared demo password (`demo1234`) is refused at login; set `true` only on a staging demo |
| dashboards (build) | `VITE_API_BASE` | **yes** | `https://<backend>` (no trailing slash) |
| dashboards (build) | `VITE_GOOGLE_CLIENT_ID` | for Google login | same client id |
| website (inline) | `window.SYNTHICA_API_BASE` | optional | `https://<backend>` |

Generate a secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## Production checklist

- [ ] `AUTH_SECRET` set (long & random) — the backend refuses to boot in prod without it
- [ ] `NODE_ENV=production` on the backend (enables the demo-password block + config guards)
- [ ] `CORS_ORIGINS` set to your real frontend origins
- [ ] `DATA_PROVIDER=sheets` + `SHEETS_SPREADSHEET_ID` + `GOOGLE_SERVICE_ACCOUNT_JSON`; ran `npm run seed:sheet` once
- [ ] **Staff accounts secured**: in the Users sheet, change the passwords for `admin`, `director`, and `auditor` (all seeds share `demo1234`, which prod refuses at login — accounts are unusable until you set real password hashes) and enable 2FA on them from Account
- [ ] **At least one auditor/admin can sign in** — new sign-ups are gated behind role assignment, so an empty staff bench means nobody ever gets in
- [ ] `VITE_API_BASE` set on dashboards; `GOOGLE_CLIENT_ID` + `VITE_GOOGLE_CLIENT_ID` set in both places (if using Google sign-in)
- [ ] `RESEND_API_KEY` + `EMAIL_FROM` set (role-approval welcome emails, verification, decisions; logged-only without it)
- [ ] Backend `npm run test:workflow` passes
- [ ] Backend on a paid/always-on instance (no cold starts)
- [ ] Real assets swapped in (team photos, OG image, favicon)
- [ ] Tested on mobile down to ~320px

### How new members get in (so you can verify the flow)
1. Sign-up (password or Google) creates an **unapproved** account with no role — they see a pending screen and can add a résumé + describe their experience.
2. An **auditor/director/admin** reviews the Onboarding queue (Admin page), sees the scores + written experience + suggested role, and approves with a role.
3. The member gets a welcome email + in-app congrats and lands in their dashboard.

### Already handled (no action needed)
- CORS locking via `CORS_ORIGINS`; security headers; per-IP auth rate limiting
- Email verification + password reset flows; scrypt password hashing; optional TOTP 2FA
- Append-only audit log (Admin page) + one-click JSON backup export
- Demo-credential lockout in production (`ALLOW_DEMO_LOGINS` opt-out)

### Worth doing as you grow
- **Durable datastore** — Sheets is fine to start; a real DB (Postgres) scales better. `src/store.js` providers are the swap point.
- **httpOnly cookie sessions** if you want XSS-proof tokens (currently Bearer in localStorage).
- **Monitoring/alerts** (uptime, error tracking) and a shared rate-limit store (Redis) if you run multiple backend instances.
