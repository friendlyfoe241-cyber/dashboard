// Data store + journal review-workflow engine.
//
// This is the single source of truth the API routes read and mutate. The data
// itself comes from a pluggable provider (in-memory seed, or Google Sheets),
// selected by the DATA_PROVIDER env var. The workflow logic below is identical
// either way; only load() / persist() differ, so routes and UI never change.

import { randomBytes } from 'node:crypto';
import { STAGE, STAGE_LABEL, EDITOR_ROLES, ASSOCIATE_TOTAL_ROUNDS, TASK_STATUS, freshOnboarding, CATEGORIES } from './domain.js';
import * as seed from './seed.js';
import { verifyPassword, hashPassword } from './passwords.js';
import { notifyMove, notifyEvent } from './notify.js';
import { emailDecision, sendEmail } from './email.js';
import { registerDoi } from './doi.js';
import { generateSecret as totpGenerateSecret, otpauthUrl as totpOtpauthUrl, verifyTotp } from './totp.js';

// Deep clone the seed so a reset returns to a clean baseline.
const clone = (x) => JSON.parse(JSON.stringify(x));

let db;
let provider = null; // null => in-memory (no persistence)

// Fresh in-memory dataset from the seed module.
function buildSeed() {
  return {
    editors: clone(seed.editors),
    researchers: clone(seed.researchers),
    submissions: clone(seed.submissions),
    publications: clone(seed.publications),
    projects: clone(seed.projects),
    listings: clone(seed.listings),
    applications: clone(seed.applications),
    chapters: clone(seed.chapters),
    news: clone(seed.news),
    audit: clone(seed.audit),
    notifications: clone(seed.notifications),
    events: clone(seed.events || []),
    programs: clone(seed.programs || []),
    certificates: clone(seed.certificates || []),
  };
}

// Push an in-app notification to a user (fire-and-forget within mutations).
function pushNotif(userId, { type, title, body, link }) {
  if (!userId || !db.notifications) return;
  db.notifications.push({
    id: `ntf_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    userId,
    type: type || 'info',
    title,
    body: body || '',
    link: link || '',
    read: false,
    at: new Date().toISOString(),
  });
}

// Notify every editor who reviewed a paper (per policy: reviewers are told when
// a paper they reviewed advances or publishes — and learn the author on publish).
function notifyReviewers(sub, title, body) {
  const ids = new Set([...(sub.assignedReviewers || []), ...sub.reviews.map((r) => r.editorId)]);
  for (const id of ids) pushNotif(id, { type: 'paper', title, body, link: '/editor' });
}

// Append an entry to the audit log.
function recordAudit(actor, action, detail) {
  if (!db.audit) db.audit = [];
  db.audit.push({
    id: `aud_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    at: new Date().toISOString(),
    actorId: actor?.id || actor?.editorId || null,
    actorName: actor?.name || 'system',
    action,
    detail: detail || '',
  });
}

// Assign reviewers to any submission sitting in the review stage without them
// (covers fresh seed data and rows imported from the Google Form).
function assignPendingReviewers() {
  db.submissions.forEach((s) => {
    if (s.stage === STAGE.REVIEW && (!s.assignedReviewers || s.assignedReviewers.length === 0)) {
      s.assignedReviewers = pickReviewers(s.category);
    }
  });
}

// Write-behind persistence: debounce so a burst of mutations writes once.
let persistTimer = null;
function schedulePersist() {
  if (!provider || typeof provider.persist !== 'function') return;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    provider.persist(db).catch((e) => console.error('[store] persist failed:', e.message));
  }, 300);
}

// Pull the dataset from the active provider. A provider may return null (empty
// database on first boot) — start from the seed and let the write-behind
// persist establish it. Collections the provider doesn't know about yet (added
// after its data was created) are backfilled from the seed.
async function loadFromProvider() {
  const loaded = await provider.load();
  return loaded ? Object.assign(buildSeed(), loaded) : buildSeed();
}

// Load the active provider's data. Called once at server startup.
export async function init() {
  const name = (process.env.DATA_PROVIDER || 'memory').toLowerCase();
  if (name === 'sheets') {
    const { createSheetsProvider } = await import('./providers/sheets.js');
    provider = await createSheetsProvider();
    db = await loadFromProvider();
  } else if (name === 'postgres' || name === 'pg') {
    const { createPostgresProvider } = await import('./providers/postgres.js');
    provider = await createPostgresProvider();
    db = await loadFromProvider();
  } else {
    provider = null;
    db = buildSeed();
  }
  assignPendingReviewers();
  schedulePersist();
  console.log(`[store] data provider: ${name}`);
  return db;
}

// Reload baseline data (dev helper / "reset" route). Reloads from the active
// provider, or the seed when in memory.
export async function reset() {
  db = provider ? await loadFromProvider() : buildSeed();
  assignPendingReviewers();
  schedulePersist();
}

// --- helpers ---------------------------------------------------------------

const now = () => new Date().toISOString();
// Monotonic unique-id helper. Date.now() alone collides when several records are
// created within the same millisecond (e.g. rapid submissions) — the counter
// guarantees uniqueness.
let _idSeq = 0;
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${(_idSeq++).toString(36)}`;
const editorsByRole = (role, category) =>
  db.editors.filter((e) => e.role === role && (category ? e.category === category : true));

// Count how many ACTIVE papers each candidate editor currently owns, so we can
// hand the next paper to whoever has the lightest load (even distribution).
function loadOf(editorId) {
  let n = 0;
  for (const s of db.submissions) {
    if (s.stage === STAGE.PUBLISHED || s.stage === STAGE.REJECTED) continue;
    if (s.assignee === editorId) n++;
    if (s.assignedReviewers.includes(editorId)) n++;
  }
  return n;
}

// Pick the two least-loaded Reviews editors in the paper's category.
function pickReviewers(category) {
  const candidates = editorsByRole(EDITOR_ROLES.REVIEWS, category)
    .slice()
    .sort((a, b) => loadOf(a.id) - loadOf(b.id));
  return candidates.slice(0, 2).map((e) => e.id);
}

// Pick the single least-loaded editor of a role in a category.
function pickOne(role, category) {
  const candidates = editorsByRole(role, category)
    .slice()
    .sort((a, b) => loadOf(a.id) - loadOf(b.id));
  return candidates[0]?.id ?? null;
}

function log(sub, event) {
  sub.history.push({ at: now(), ...event });
}

// --- read API --------------------------------------------------------------

export const getEditorById = (id) => db.editors.find((e) => e.id === id) || null;
export const getResearcherById = (id) => db.researchers.find((r) => r.id === id) || null;

export function authenticate(identifier, password) {
  // Seed/demo accounts all share this password. Refuse it in production so a
  // deployed instance can't be entered through well-known demo credentials.
  if (!demoLoginsEnabled() && password === 'demo1234') return null;
  const id = String(identifier || '').trim().toLowerCase();
  // Accept either a username or an email address (the smart sign-in enters email).
  const user = [...db.editors, ...db.researchers].find(
    (u) => u.username.toLowerCase() === id || (u.email && u.email.toLowerCase() === id),
  );
  if (!user || !verifyPassword(password, user.password)) return null;
  const { password: _pw, twoFactorSecret: _s, ...safe } = user;
  return safe;
}

// Whether the shared demo password is accepted (always in dev; in production
// only when ALLOW_DEMO_LOGINS is set). Exposed via /api/config so the login
// page can hide its one-click demo buttons when they'd be refused.
export const demoLoginsEnabled = () =>
  process.env.NODE_ENV !== 'production' || !!process.env.ALLOW_DEMO_LOGINS;

// Smart sign-in: does an account exist for this email, and how does it log in?
// (password vs. Google-only). Lets the UI route to the right next step.
export function lookupEmail(email) {
  const addr = String(email || '').trim().toLowerCase();
  if (!addr) return { exists: false };
  const user = [...db.editors, ...db.researchers].find((u) => u.email && u.email.toLowerCase() === addr);
  if (!user) return { exists: false };
  const googleOnly = !!user.googleId && !user.password;
  return { exists: true, method: googleOnly ? 'google' : 'password', name: user.name };
}

// Google Sign-In: match an existing account by email (link the googleId) or
// create a new researcher. Returns a safe user.
export function findOrCreateGoogleUser({ email, name, googleId }) {
  const lower = email.toLowerCase();
  let user = [...db.editors, ...db.researchers].find((u) => u.email && u.email.toLowerCase() === lower);
  if (user) {
    user.googleId = googleId;
  } else {
    user = {
      id: `usr_${Date.now()}`,
      name: name || email,
      username: lower.split('@')[0],
      password: '', // Google-only account
      kind: 'researcher',
      // Same gate as password sign-ups: no role until an auditor assigns one.
      tags: [],
      approved: false,
      email,
      discord: '',
      resumeUrl: '',
      googleId,
      public: true,
      emailVerified: true, // Google verifies the email
    };
    db.researchers.push(user);
    claimProjectInvites(user);
    db.applications.push({
      id: `app_${db.applications.length + 1}`,
      kind: 'onboarding',
      userId: user.id,
      userName: user.name,
      listingId: null,
      role: null,
      message: 'New member sign-up (Google) — assign a role',
      status: 'pending',
      at: now(),
    });
    notifyEvent({ title: '👋 New member', body: `${user.name} joined Synthica (Google).` });
  }
  if (user.emailVerified === undefined) user.emailVerified = true;
  schedulePersist();
  const { password, ...safe } = user;
  return safe;
}

// --- public profiles (everyone) --------------------------------------------

const TAG_LABEL = {
  chapter_leader: 'Chapter Leader',
  associate_researcher: 'Associate Researcher',
  lead_researcher: 'Lead Researcher',
  independent_researcher: 'Independent Researcher',
};
const EDITOR_ROLE_LABEL = {
  reviews: 'Reviews Editor',
  associate: 'Associate Editor',
  senior: 'Senior Editor',
  chief: 'Editor-in-Chief',
  director: 'Director',
  auditor: 'Auditor',
  admin: 'Platform Admin',
};

function roleDisplay(u) {
  if (u.kind === 'editor') return (EDITOR_ROLE_LABEL[u.role] || 'Editor') + (u.category ? ` — ${u.category}` : '');
  return (u.tags || []).map((t) => TAG_LABEL[t] || t).join(', ') || 'Researcher';
}

export const getUserById = (id) => getEditorById(id) || getResearcherById(id);
const getUserBySlug = (slug) => [...db.editors, ...db.researchers].find((u) => u.slug === slug);

function publicProfileOf(u) {
  const publications = db.publications
    .filter((p) => p.authorUserId === u.id || (p.authorUserIds || []).includes(u.id))
    .map((p) => ({
      doi: p.doi, title: p.title, category: p.category, publishedAt: p.publishedAt,
      articleType: p.articleType, pdfUrl: p.pdfUrl || '', sourceUrl: p.sourceUrl || '',
      verified: p.verified !== false,
    }))
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const currentProjects = db.projects
    .filter((p) => p.members.includes(u.id))
    .map((p) => ({ id: p.id, title: p.title, category: p.category }));
  return {
    id: u.id, slug: u.slug || u.id, username: u.username || '', name: u.name, kind: u.kind, role: roleDisplay(u),
    institution: u.institution || '', bio: u.bio || '', blurb: u.blurb || '', avatarUrl: u.avatarUrl || '',
    interests: u.interests || [], linkedinUrl: u.linkedinUrl || '', websiteUrl: u.websiteUrl || '',
    links: u.links || [], category: u.category || null, currentProjects, publications,
  };
}

// A member is publicly visible once approved (editors always are) and not
// opted out — unapproved sign-ups stay invisible until an auditor admits them.
const isVisible = (u) => u.public !== false && u.approved !== false;

// Resolve a profile by id OR stable slug — links never change.
export function getPublicProfile(key) {
  const u = getUserById(key) || getUserBySlug(key);
  if (!u || !isVisible(u)) return null;
  return publicProfileOf(u);
}

export function listProfiles() {
  return [...db.editors, ...db.researchers]
    .filter(isVisible)
    .map((u) => ({
      id: u.id, slug: u.slug || u.id, username: u.username || '', name: u.name, role: roleDisplay(u),
      institution: u.institution || '', blurb: u.blurb || '', avatarUrl: u.avatarUrl || '', kind: u.kind,
    }));
}

const cleanLinks = (arr) =>
  arr.filter((l) => l && l.url).map((l) => ({ label: String(l.label || l.url).slice(0, 40), url: String(l.url).slice(0, 300) })).slice(0, 6);

export function updateProfile(userId, patch) {
  const u = getUserById(userId);
  if (!u) throw httpError(404, 'User not found');
  if (typeof patch.name === 'string' && patch.name.trim()) u.name = patch.name.trim().slice(0, 80);
  if (typeof patch.institution === 'string') u.institution = patch.institution.trim().slice(0, 120);
  if (typeof patch.bio === 'string') u.bio = patch.bio.slice(0, 1000);
  if (typeof patch.blurb === 'string') u.blurb = patch.blurb.trim().slice(0, 140);
  if (patch.congratsSeen === true) u.newRoleCongrats = null;
  if (typeof patch.avatarUrl === 'string') u.avatarUrl = patch.avatarUrl.trim().slice(0, 400);
  if (typeof patch.resumeUrl === 'string') u.resumeUrl = patch.resumeUrl.trim().slice(0, 400);
  if (typeof patch.discord === 'string') u.discord = patch.discord.trim().slice(0, 60);
  if (typeof patch.linkedinUrl === 'string') u.linkedinUrl = patch.linkedinUrl.trim().slice(0, 300);
  if (typeof patch.websiteUrl === 'string') u.websiteUrl = patch.websiteUrl.trim().slice(0, 300);
  if (Array.isArray(patch.interests)) u.interests = patch.interests.map((s) => String(s).trim().slice(0, 40)).filter(Boolean).slice(0, 12);
  if (Array.isArray(patch.links)) u.links = cleanLinks(patch.links);
  if (typeof patch.public === 'boolean') u.public = patch.public;
  if (typeof patch.experienceSummary === 'string') u.experienceSummary = patch.experienceSummary.slice(0, 800);
  if (patch.gpa !== undefined) u.gpa = String(patch.gpa).trim().slice(0, 12);
  if (patch.researchExperience !== undefined && patch.researchExperience !== null && patch.researchExperience !== '') {
    const exp = Math.max(0, Math.min(10, Number(patch.researchExperience) || 0));
    u.researchExperience = exp;
    // High self-rated experience flags the researcher for a Lead Researcher nudge.
    if (exp >= 8) u.leadRecommended = true;
  }
  if (patch.leadershipExperience !== undefined && patch.leadershipExperience !== null && patch.leadershipExperience !== '') {
    u.leadershipExperience = Math.max(0, Math.min(10, Number(patch.leadershipExperience) || 0));
  }
  if (typeof patch.wantsChapterLead === 'boolean') u.wantsChapterLead = patch.wantsChapterLead;
  // Returning members from the old system: claim prior Lead status + the
  // project they ran. The project is only created if an auditor approves them
  // as a Lead Researcher.
  if (typeof patch.priorLead === 'boolean') u.priorLead = patch.priorLead;
  if (patch.legacyProject !== undefined) {
    const lp = patch.legacyProject;
    u.legacyProject = lp && lp.title?.trim()
      ? { title: String(lp.title).trim().slice(0, 140), category: CATEGORIES.includes(lp.category) ? lp.category : '', description: String(lp.description || '').slice(0, 600) }
      : null;
  }
  schedulePersist();
  const { password, twoFactorSecret, ...safe } = u;
  return safe;
}

// --- admin: people lookup + role management (multi-role enabler) ------------

export function adminListUsers(q) {
  const needle = (q || '').toLowerCase();
  return [...db.editors, ...db.researchers]
    .filter((u) => !needle || u.name.toLowerCase().includes(needle) || (u.email || '').toLowerCase().includes(needle) || (u.username || '').toLowerCase().includes(needle))
    .map((u) => ({
      id: u.id, name: u.name, email: u.email, username: u.username, kind: u.kind,
      role: u.role || null, category: u.category || null, tags: u.tags || [],
      // Onboarding signals so auditors can re-evaluate roles later, not just at sign-up.
      approved: u.approved !== false,
      researchExperience: u.researchExperience ?? null,
      leadershipExperience: u.leadershipExperience ?? null,
      wantsChapterLead: !!u.wantsChapterLead,
      gpa: u.gpa || '',
      resumeUrl: u.resumeUrl || '',
      experienceSummary: u.experienceSummary || '',
      priorLead: !!u.priorLead,
      legacyProject: u.legacyProject || null,
      recommendation: u.kind === 'researcher' ? recommendRole(u) : null,
    }));
}

// Set a user's editor role/category and/or add/remove researcher tags. Lets an
// admin promote anyone (e.g. make a researcher a Lead, or grant editor rights).
export function adminSetUserRole({ userId, kind, role, category, addTags, removeTags, actor }) {
  const u = getUserById(userId);
  if (!u) throw httpError(404, 'User not found');
  if (kind === 'editor' || kind === 'researcher') u.kind = kind;
  if (role !== undefined) u.role = role || null;
  if (category !== undefined) u.category = category || null;
  if (!Array.isArray(u.tags)) u.tags = [];
  if (Array.isArray(addTags)) addTags.forEach((t) => { if (!u.tags.includes(t)) u.tags.push(t); });
  if (Array.isArray(removeTags)) u.tags = u.tags.filter((t) => !removeTags.includes(t));
  u.approved = true; // an admin acting on the account activates it
  if ((addTags || []).includes('lead_researcher')) restoreLegacyProject(u, actor?.id);
  recordAudit(actor, 'set_role', `${u.name}: kind=${u.kind} role=${u.role || '-'} tags=[${u.tags.join(',')}]`);
  schedulePersist();
  const { password, twoFactorSecret, ...safe } = u;
  return safe;
}

// Bulk-assign a researcher tag (or editor role) to many users by email list.
export function adminBulkRole({ emails, tag, role, actor }) {
  const list = String(emails || '').split(/[,\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
  const updated = [];
  const notFound = [];
  for (const email of list) {
    const u = getUserByEmail(email);
    if (!u) { notFound.push(email); continue; }
    if (tag) { if (!Array.isArray(u.tags)) u.tags = []; if (!u.tags.includes(tag)) u.tags.push(tag); }
    if (role) { u.kind = 'editor'; u.role = role; }
    updated.push(u.name);
  }
  recordAudit(actor, 'bulk_role', `${tag || role} → ${updated.length} users`);
  schedulePersist();
  return { updated, notFound };
}

// --- two-factor (TOTP) -----------------------------------------------------

export function startTwoFactorSetup(userId) {
  const u = getUserById(userId);
  if (!u) throw httpError(404, 'User not found');
  if (!u.twoFactorSecret || u.twoFactorEnabled) u.twoFactorSecret = totpGenerateSecret();
  schedulePersist();
  return { secret: u.twoFactorSecret, otpauthUrl: totpOtpauthUrl(u.twoFactorSecret, u.email || u.username) };
}

export function enableTwoFactor(userId, code) {
  const u = getUserById(userId);
  if (!u || !u.twoFactorSecret) throw httpError(400, 'Start setup first');
  if (!verifyTotp(u.twoFactorSecret, code)) throw httpError(400, 'Invalid code');
  u.twoFactorEnabled = true;
  schedulePersist();
  return { ok: true };
}

export function disableTwoFactor(userId, code) {
  const u = getUserById(userId);
  if (!u) throw httpError(404, 'User not found');
  if (u.twoFactorEnabled && !verifyTotp(u.twoFactorSecret, code)) throw httpError(400, 'Invalid code');
  u.twoFactorEnabled = false;
  u.twoFactorSecret = '';
  schedulePersist();
  return { ok: true };
}

// Used by the login flow.
export function twoFactorRequired(userId) {
  const u = getUserById(userId);
  return !!(u && u.twoFactorEnabled);
}
export function verifyTwoFactorCode(userId, code) {
  const u = getUserById(userId);
  return !!(u && verifyTotp(u.twoFactorSecret, code));
}

// Hide author identity from Reviews editors (single-blind, per editorial policy).
function anonymizeForReviews(s) {
  return {
    ...s,
    authorName: 'Anonymous author',
    authorEmail: null,
    authorDiscord: null,
    submittedBy: null,
    revisions: (s.revisions || []).map((r) => ({ ...r, byName: 'Author' })),
  };
}

// Decorate a submission for API responses: attach editor names + stage label.
function decorate(sub) {
  return {
    ...sub,
    comments: sub.comments || [],
    revisions: sub.revisions || [],
    stageLabel: STAGE_LABEL[sub.stage],
    assignedReviewerNames: sub.assignedReviewers.map((id) => getEditorById(id)?.name).filter(Boolean),
    assigneeName: sub.assignee ? getEditorById(sub.assignee)?.name : null,
  };
}

// Internal editor comment thread on a paper (visible to all editors who can see
// it). Separate from the decision feed.
export function addPaperComment({ paperId, editorId, body }) {
  const sub = getSub(paperId);
  if (!sub) throw httpError(404, 'Paper not found');
  if (!body?.trim()) throw httpError(400, 'A comment is required');
  const editor = getEditorById(editorId);
  if (!sub.comments) sub.comments = [];
  const c = { id: `cmt_${Date.now()}`, authorId: editorId, authorName: editor?.name || 'Editor', role: editor?.role || null, body: body.trim(), at: now() };
  sub.comments.push(c);
  schedulePersist();
  return c;
}

// Director: swap one assigned reviews-editor for another (same category) while a
// paper is still in the review stage.
export function reassignReviewer({ paperId, fromEditorId, toEditorId }) {
  const sub = getSub(paperId);
  if (!sub) throw httpError(404, 'Paper not found');
  if (sub.stage !== STAGE.REVIEW) throw httpError(409, 'Paper is no longer in the review stage');
  const to = getEditorById(toEditorId);
  if (!to || to.role !== EDITOR_ROLES.REVIEWS || to.category !== sub.category)
    throw httpError(400, 'Pick a reviews editor in the paper’s category');
  if (sub.assignedReviewers.includes(toEditorId)) throw httpError(409, 'That editor is already assigned');
  const idx = sub.assignedReviewers.indexOf(fromEditorId);
  if (idx === -1) throw httpError(404, 'That editor is not assigned to this paper');
  sub.assignedReviewers[idx] = toEditorId;
  // Drop any review the removed editor had already left.
  sub.reviews = sub.reviews.filter((r) => r.editorId !== fromEditorId);
  log(sub, { type: 'reassign', from: fromEditorId, to: toEditorId });
  schedulePersist();
  return decorate(sub);
}

// Active workload per editor (for balancing decisions).
export function editorWorkload() {
  return db.editors
    .filter((e) => e.role !== EDITOR_ROLES.DIRECTOR)
    .map((e) => ({ id: e.id, name: e.name, role: e.role, category: e.category, load: loadOf(e.id) }))
    .sort((a, b) => b.load - a.load);
}

// Papers visible to a given editor, scoped by role + category + assignment.
export function papersForEditor(editorId) {
  const editor = getEditorById(editorId);
  if (!editor) return [];

  const inbox = [];
  const archive = [];

  for (const raw of db.submissions) {
    const s = decorate(raw);
    const myReview = raw.reviews.find((r) => r.editorId === editorId);

    switch (editor.role) {
      case EDITOR_ROLES.REVIEWS: {
        // Reviews editors see the paper single-blind (no author identity).
        const anon = anonymizeForReviews(s);
        if (raw.stage === STAGE.REVIEW && raw.assignedReviewers.includes(editorId)) {
          const coReview = raw.reviews.find((r) => r.editorId !== editorId);
          inbox.push({ ...anon, myReview: myReview || null, coReviewerDecision: coReview?.decision || null });
        } else if (raw.assignedReviewers.includes(editorId) && myReview) {
          archive.push(anon);
        }
        break;
      }

      case EDITOR_ROLES.SENIOR:
        if ((raw.stage === STAGE.SENIOR_SCREEN || raw.stage === STAGE.SENIOR_FINAL) && raw.assignee === editorId) {
          inbox.push({ ...s, reviewerRecommendations: reviewerRecs(raw), feed: buildFeed(raw) });
        } else if (raw.assignee === editorId && myReview) {
          archive.push({ ...s, feed: buildFeed(raw) });
        }
        break;

      case EDITOR_ROLES.ASSOCIATE:
        if (raw.stage === STAGE.ASSOCIATE && raw.assignee === editorId) {
          inbox.push({ ...s, reviewerRecommendations: reviewerRecs(raw), priorFeedback: priorFeedback(raw), feed: buildFeed(raw) });
        }
        break;

      case EDITOR_ROLES.CHIEF:
        if (raw.stage === STAGE.CHIEF) inbox.push({ ...s, reviewerRecommendations: reviewerRecs(raw), priorFeedback: priorFeedback(raw), feed: buildFeed(raw) });
        break;

      default:
        break;
    }
  }
  return { inbox, archive };
}

function reviewerRecs(sub) {
  return sub.reviews
    .filter((r) => r.recommendation)
    .map((r) => ({ editorName: getEditorById(r.editorId)?.name, recommendation: r.recommendation }));
}

function priorFeedback(sub) {
  return sub.reviews.map((r) => ({
    editorName: getEditorById(r.editorId)?.name,
    decision: r.decision,
    comments: r.comments,
  }));
}

// A chronological activity feed for a paper — every layer's votes, comments,
// recommendations, revision rounds, and the chief's call — so anyone above can
// see the whole history collectively. (Editor names + roles attached.)
function buildFeed(sub) {
  const entries = sub.reviews.map((r) => {
    const e = getEditorById(r.editorId);
    return {
      kind: 'review',
      editorName: e?.name || 'Editor',
      role: e?.role || null,
      decision: r.decision,
      comments: r.comments,
      recommendation: r.recommendation || null,
      at: r.at,
    };
  });
  for (const h of sub.history) {
    if (h.type === 'associate_round') {
      entries.push({
        kind: 'round',
        editorName: getEditorById(h.editorId)?.name || 'Associate editor',
        role: EDITOR_ROLES.ASSOCIATE,
        round: h.round,
        comments: h.note || null,
        at: h.at,
      });
    } else if (h.type === 'chief') {
      entries.push({ kind: 'chief', editorName: 'Editor-in-Chief', role: EDITOR_ROLES.CHIEF, decision: h.decision, comments: h.comments || null, at: h.at });
    }
  }
  return entries.sort((a, b) => new Date(a.at) - new Date(b.at));
}

// Director dashboard: every decision generates an email task; finished papers
// land in the publish queue.
export function directorView() {
  const toEmail = [];
  const toPublish = [];
  for (const raw of db.submissions) {
    const s = decorate(raw);
    // "Papers to email": anything that has reached a notify-worthy decision point.
    for (const note of raw.history.filter((h) => h.notifyDirector)) {
      toEmail.push({
        paperId: raw.id,
        title: raw.title,
        authorName: raw.authorName,
        authorEmail: raw.authorEmail,
        state: note.label,
        decision: note.decision,
        at: note.at,
        emailed: note.emailed || false,
      });
    }
    if (raw.stage === STAGE.PUBLISHED) toPublish.push(s);
  }
  return { toEmail, toPublish };
}

// --- write API: the workflow engine ---------------------------------------

const getSub = (id) => db.submissions.find((s) => s.id === id);

// A Reviews editor submits their decision on a paper.
// Requires feedback; recommendation required only when approving.
export function submitReviewDecision({ paperId, editorId, decision, comments, recommendation }) {
  const sub = getSub(paperId);
  if (!sub) throw httpError(404, 'Paper not found');
  if (sub.stage !== STAGE.REVIEW) throw httpError(409, 'Paper is no longer in the review stage');
  if (!sub.assignedReviewers.includes(editorId)) throw httpError(403, 'You are not assigned to this paper');
  if (sub.reviews.some((r) => r.editorId === editorId)) throw httpError(409, 'You have already reviewed this paper');
  if (!comments?.trim()) throw httpError(400, 'Feedback is required');
  if (decision === 'approve' && !recommendation?.trim())
    throw httpError(400, 'A recommendation is required when approving');

  sub.reviews.push({ editorId, decision, comments, recommendation: recommendation || null, at: now() });
  log(sub, { type: 'review', editorId, decision });

  // Advance only once both assigned reviewers have weighed in.
  const both = sub.assignedReviewers.every((rid) => sub.reviews.some((r) => r.editorId === rid));
  if (both) {
    const allApproved = sub.assignedReviewers.every((rid) =>
      sub.reviews.find((r) => r.editorId === rid)?.decision === 'approve'
    );
    // Every paper — approved or declined — notifies the Director.
    if (allApproved) {
      advance(sub, STAGE.SENIOR_SCREEN, { label: STAGE_LABEL[STAGE.SENIOR_SCREEN], decision: 'approved' });
    } else {
      reject(sub, STAGE_LABEL[STAGE.SENIOR_SCREEN]); // both didn't agree -> decline
    }
  }
  schedulePersist();
  return decorate(sub);
}

// Senior editor screening (after reviews) OR final check (after associate).
export function seniorDecision({ paperId, editorId, decision, comments }) {
  const sub = getSub(paperId);
  if (!sub) throw httpError(404, 'Paper not found');
  if (sub.stage !== STAGE.SENIOR_SCREEN && sub.stage !== STAGE.SENIOR_FINAL)
    throw httpError(409, 'Paper is not awaiting a senior decision');
  if (sub.assignee !== editorId) throw httpError(403, 'You are not assigned to this paper');
  if (!comments?.trim()) throw httpError(400, 'Feedback is required');

  sub.reviews.push({ editorId, decision, comments, recommendation: null, at: now() });
  const wasScreen = sub.stage === STAGE.SENIOR_SCREEN;
  log(sub, { type: 'senior', editorId, decision });

  if (decision !== 'approve') {
    reject(sub, wasScreen ? STAGE_LABEL[STAGE.ASSOCIATE] : STAGE_LABEL[STAGE.CHIEF]);
  } else if (wasScreen) {
    advance(sub, STAGE.ASSOCIATE, { label: STAGE_LABEL[STAGE.ASSOCIATE], decision: 'approved' });
  } else {
    advance(sub, STAGE.CHIEF, { label: STAGE_LABEL[STAGE.CHIEF], decision: 'approved' });
  }
  schedulePersist();
  return decorate(sub);
}

// Associate editor logs a completed revision round; after the final round the
// paper goes to the Senior editor for the final check.
export function associateRound({ paperId, editorId, note }) {
  const sub = getSub(paperId);
  if (!sub) throw httpError(404, 'Paper not found');
  if (sub.stage !== STAGE.ASSOCIATE) throw httpError(409, 'Paper is not with an associate editor');
  if (sub.assignee !== editorId) throw httpError(403, 'You are not assigned to this paper');
  if (sub.associateRounds >= ASSOCIATE_TOTAL_ROUNDS) throw httpError(409, 'All rounds already completed');

  sub.associateRounds += 1;
  log(sub, { type: 'associate_round', editorId, round: sub.associateRounds, note: note || null });

  if (sub.associateRounds >= ASSOCIATE_TOTAL_ROUNDS) {
    advance(sub, STAGE.SENIOR_FINAL, { label: STAGE_LABEL[STAGE.SENIOR_FINAL], decision: 'approved' });
  }
  schedulePersist();
  return decorate(sub);
}

// Editor-in-chief final approval -> Director's publish queue.
export function chiefDecision({ paperId, decision, comments }) {
  const sub = getSub(paperId);
  if (!sub) throw httpError(404, 'Paper not found');
  if (sub.stage !== STAGE.CHIEF) throw httpError(409, 'Paper is not awaiting the editor-in-chief');

  log(sub, { type: 'chief', decision, comments: comments || null });
  if (decision === 'approve') {
    advance(sub, STAGE.PUBLISHED, { label: STAGE_LABEL[STAGE.PUBLISHED], decision: 'approved' });
  } else {
    reject(sub, STAGE_LABEL[STAGE.PUBLISHED]);
  }
  schedulePersist();
  return decorate(sub);
}

// Director marks an email as sent.
export function markEmailed({ paperId, at }) {
  const sub = getSub(paperId);
  if (!sub) throw httpError(404, 'Paper not found');
  const note = sub.history.find((h) => h.notifyDirector && h.at === at);
  if (note) note.emailed = true;
  schedulePersist();
  return true;
}

// Director publishes a finished paper into the journal DOI registry (Track 2).
export function publishToJournal({ paperId, doiSuffix, volume, issue, pages }) {
  const sub = getSub(paperId);
  if (!sub) throw httpError(404, 'Paper not found');
  if (sub.stage !== STAGE.PUBLISHED) throw httpError(409, 'Paper is not ready to publish');

  const today = now().slice(0, 10);
  const pub = {
    id: `pub_${db.publications.length + 1}`,
    doi: `10.55555/synthica.${doiSuffix || `2026.${String(db.publications.length + 1).padStart(4, '0')}`}`,
    title: sub.title,
    articleType: 'Article',
    authors: [{ name: sub.authorName, affiliation: 'Synthica Research Group' }],
    authorUserId: sub.submittedBy || null,
    correspondingAuthor: sub.authorName,
    category: sub.category,
    abstract: sub.abstract,
    keywords: [],
    receivedAt: sub.submittedAt.slice(0, 10),
    acceptedAt: today,
    publishedAt: today,
    volume: volume || 1,
    issue: issue || 1,
    pages: pages || '1–1',
    pdfUrl: sub.pdfUrl,
    license: 'CC BY 4.0',
    openAccess: true,
    sections: [
      { heading: 'Introduction', body: sub.abstract },
      { heading: 'Methods', body: 'See manuscript PDF.' },
      { heading: 'Results', body: 'See manuscript PDF.' },
      { heading: 'Discussion', body: 'See manuscript PDF.' },
    ],
    metrics: { accesses: 0, citations: 0, altmetric: 0 },
    citationCount: 0,
  };
  // Tagged co-authors get the paper on their profiles too.
  pub.authorUserIds = [...new Set([sub.submittedBy, ...(sub.coAuthorIds || [])].filter(Boolean))];
  pub.source = 'editorial';
  pub.verified = true;
  db.publications.push(pub);
  sub.history.push({ at: now(), type: 'published_to_journal', doi: pub.doi });
  recordAudit({ name: 'Director' }, 'publish', `${sub.title} (${pub.doi})`);
  registerDoi(pub); // optional Crossref deposit (no-op unless configured)
  schedulePersist();
  return pub;
}

// --- paper archive (arXiv/Nature-style upload + self-archiving) -------------

const ARTICLE_TYPES = ['Article', 'Letter', 'Analysis', 'Review', 'Preprint', 'Dataset', 'Conference Paper'];

// Normalize an author list, preserving optional userId links to profiles.
// Look up a member by their global @username (case-insensitive, no @).
export const getUserByUsername = (username) => {
  const uname = String(username || '').replace(/^@/, '').trim().toLowerCase();
  return uname ? [...db.editors, ...db.researchers].find((u) => (u.username || '').toLowerCase() === uname) || null : null;
};

function cleanAuthors(list, fallbackName) {
  let authors = (Array.isArray(list) ? list : [])
    .map((a) => {
      // A "@username" tag (in the username field or as the name itself) links
      // the author to their Synthica profile — and must exist.
      const tag = a?.username || (String(a?.name || '').trim().startsWith('@') ? a.name : null);
      if (tag) {
        const u = getUserByUsername(tag);
        if (!u) throw httpError(400, `No member with the username ${String(tag).trim()} — check the spelling`);
        return { name: u.name, affiliation: u.institution || String(a?.affiliation || '').trim().slice(0, 160), userId: u.id };
      }
      return {
        name: String(a?.name || '').trim().slice(0, 120),
        affiliation: String(a?.affiliation || '').trim().slice(0, 160),
        userId: a?.userId ? String(a.userId) : null,
      };
    })
    .filter((a) => a.name);
  if (!authors.length && fallbackName) authors = [{ name: String(fallbackName).slice(0, 120), affiliation: '', userId: null }];
  return authors.slice(0, 30);
}

function nextSynthicaDoi() {
  const yr = new Date().getFullYear();
  const n = db.publications.length + 1;
  return `10.55555/synthica.${yr}.${String(n).padStart(4, '0')}`;
}

// Build a publication record from free-form input (admin upload or self-archive).
function buildPublication(input, { source, verified, addedBy, authorUserId }) {
  if (!input?.title?.trim()) throw httpError(400, 'A title is required');
  if (!CATEGORIES.includes(input.category)) throw httpError(400, 'Pick a valid subject category');
  const authors = cleanAuthors(input.authors, input.correspondingAuthor);
  if (!authors.length) throw httpError(400, 'At least one author is required');
  const primary = authorUserId || authors.find((a) => a.userId)?.userId || null;
  const authorUserIds = [...new Set([primary, ...authors.map((a) => a.userId)].filter(Boolean))];

  let publishedAt = String(input.publishedAt || '').slice(0, 10);
  if (!publishedAt && input.year) publishedAt = `${String(input.year).slice(0, 4)}-01-01`;
  if (!publishedAt) publishedAt = now().slice(0, 10);

  const keywords = Array.isArray(input.keywords)
    ? input.keywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 12)
    : String(input.keywords || '').split(',').map((k) => k.trim()).filter(Boolean).slice(0, 12);

  const abstract = String(input.abstract || '').slice(0, 5000);
  return {
    id: uid('pub'),
    doi: String(input.doi || '').trim() || nextSynthicaDoi(),
    title: input.title.trim().slice(0, 300),
    articleType: ARTICLE_TYPES.includes(input.articleType) ? input.articleType : 'Article',
    authors,
    authorUserId: primary,
    authorUserIds,
    correspondingAuthor: authors[0].name,
    category: input.category,
    abstract,
    keywords,
    receivedAt: publishedAt,
    acceptedAt: publishedAt,
    publishedAt,
    volume: Number(input.volume) || null,
    issue: Number(input.issue) || null,
    pages: String(input.pages || '').slice(0, 20),
    pdfUrl: String(input.pdfUrl || '').trim().slice(0, 500),
    sourceUrl: String(input.sourceUrl || '').trim().slice(0, 500),
    license: String(input.license || 'CC BY 4.0').slice(0, 40),
    openAccess: input.openAccess !== false,
    sections: abstract ? [{ heading: 'Abstract', body: abstract }] : [],
    metrics: { accesses: 0, citations: Number(input.citationCount) || 0, altmetric: 0 },
    citationCount: Number(input.citationCount) || 0,
    source,
    verified: !!verified,
    addedBy: addedBy || null,
  };
}

// Admin/auditor uploads a paper straight into the archive (trusted -> verified).
export function archivePublication(input, actor) {
  const pub = buildPublication(input, { source: 'archive', verified: true, addedBy: actor?.id });
  db.publications.push(pub);
  recordAudit(actor, 'archive_paper', `${pub.title} (${pub.doi})`);
  registerDoi(pub);
  schedulePersist();
  return pub;
}

// A researcher adds one of their past papers. Shows on their profile right away
// but stays unverified (out of the public archive) until an auditor confirms it.
export function addPastPaper(userId, input) {
  const u = getResearcherById(userId);
  if (!u) throw httpError(404, 'Researcher not found');
  let authors = cleanAuthors(input.authors, u.name);
  // Make sure the submitting researcher is linked as one of the authors.
  if (!authors.some((a) => a.userId === userId)) {
    const mine = authors.find((a) => a.name.toLowerCase() === u.name.toLowerCase());
    if (mine) mine.userId = userId;
    else authors = [{ name: u.name, affiliation: u.institution || '', userId }, ...authors];
  }
  const pub = buildPublication({ ...input, authors }, { source: 'self', verified: false, addedBy: userId, authorUserId: userId });
  db.publications.push(pub);
  recordAudit(u, 'add_past_paper', pub.title);
  notifyEvent({ title: '📄 Past paper submitted', body: `${u.name} added "${pub.title}" — needs verification.` });
  schedulePersist();
  return pub;
}

// Auditor verifies (approve -> public) or removes (reject) a self-archived paper.
export function verifyPublication({ id, status, reviewerId }) {
  const idx = db.publications.findIndex((p) => p.id === id);
  if (idx === -1) throw httpError(404, 'Publication not found');
  const pub = db.publications[idx];
  if (status === 'approved') {
    pub.verified = true;
    recordAudit({ id: reviewerId }, 'verify_paper', `${pub.title} (${pub.doi})`);
    if (pub.addedBy) pushNotif(pub.addedBy, { type: 'paper', title: 'Your archived paper was verified', body: pub.title, link: '/researcher/my-journal' });
    registerDoi(pub);
  } else if (status === 'rejected') {
    db.publications.splice(idx, 1);
    recordAudit({ id: reviewerId }, 'reject_paper', pub.title);
    if (pub.addedBy) pushNotif(pub.addedBy, { type: 'paper', title: 'Your archived paper was not approved', body: pub.title, link: '/researcher/my-journal' });
  } else {
    throw httpError(400, 'Invalid status');
  }
  schedulePersist();
  return { ok: true };
}

// Pin/unpin a paper at the top of the public archive (admin/auditor).
export function featurePublication({ id, featured, actor }) {
  const pub = db.publications.find((p) => p.id === id);
  if (!pub) throw httpError(404, 'Publication not found');
  pub.featured = !!featured;
  recordAudit(actor, featured ? 'feature_paper' : 'unfeature_paper', pub.title);
  schedulePersist();
  return pub;
}

// Admin edits a paper's metadata in place (typos, links, dates, keywords).
export function editPublication({ id, patch, actor }) {
  const pub = db.publications.find((p) => p.id === id);
  if (!pub) throw httpError(404, 'Publication not found');
  if (typeof patch.title === 'string' && patch.title.trim()) pub.title = patch.title.trim().slice(0, 300);
  if (patch.category && CATEGORIES.includes(patch.category)) pub.category = patch.category;
  if (typeof patch.articleType === 'string' && ARTICLE_TYPES.includes(patch.articleType)) pub.articleType = patch.articleType;
  if (typeof patch.abstract === 'string') pub.abstract = patch.abstract.slice(0, 5000);
  if (typeof patch.pdfUrl === 'string') pub.pdfUrl = patch.pdfUrl.trim().slice(0, 500);
  if (typeof patch.sourceUrl === 'string') pub.sourceUrl = patch.sourceUrl.trim().slice(0, 500);
  if (typeof patch.doi === 'string' && patch.doi.trim()) pub.doi = patch.doi.trim().slice(0, 120);
  if (patch.publishedAt) pub.publishedAt = String(patch.publishedAt).slice(0, 10);
  if (patch.volume !== undefined) pub.volume = Number(patch.volume) || null;
  if (patch.issue !== undefined) pub.issue = Number(patch.issue) || null;
  if (typeof patch.pages === 'string') pub.pages = patch.pages.slice(0, 20);
  if (patch.keywords !== undefined) {
    pub.keywords = (Array.isArray(patch.keywords) ? patch.keywords : String(patch.keywords).split(','))
      .map((k) => String(k).trim()).filter(Boolean).slice(0, 12);
  }
  recordAudit(actor, 'edit_paper', `${pub.title} (${pub.doi})`);
  schedulePersist();
  return pub;
}

// Remove a publication from the archive (admin/auditor).
export function deletePublication({ id, actor }) {
  const idx = db.publications.findIndex((p) => p.id === id);
  if (idx === -1) throw httpError(404, 'Publication not found');
  const [pub] = db.publications.splice(idx, 1);
  recordAudit(actor, 'delete_paper', `${pub.title} (${pub.doi})`);
  schedulePersist();
  return { ok: true };
}

// --- researcher-submitted papers + revisions (Track 3 ↔ Track 4) -----------

// A logged-in researcher submits a paper straight into the editor pipeline.
export function submitToJournal({ userId, title, category, abstract, pdfUrl, coAuthors }) {
  const u = getResearcherById(userId);
  if (!u) throw httpError(404, 'Researcher not found');
  if (!title?.trim() || !abstract?.trim() || !pdfUrl?.trim())
    throw httpError(400, 'Title, abstract, and paper link are required');
  if (!CATEGORIES.includes(category)) throw httpError(400, 'Pick a valid subject category');
  // @username co-author tags must resolve to real members (typos fail loudly).
  const coAuthorIds = [];
  for (const m of String(coAuthors || '').match(/@[\w.-]+/g) || []) {
    const co = getUserByUsername(m);
    if (!co) throw httpError(400, `No member with the username ${m} — check the spelling`);
    if (co.id !== userId && !coAuthorIds.includes(co.id)) coAuthorIds.push(co.id);
  }
  // A researcher who submits research is, at minimum, an independent researcher.
  if (!u.tags.includes('independent_researcher')) u.tags.push('independent_researcher');
  const at = now();
  const sub = {
    id: uid('paper'),
    title: title.trim(),
    authorName: u.name,
    authorEmail: u.email,
    authorDiscord: u.discord || '',
    submittedBy: userId,
    coAuthorIds,
    category,
    abstract: abstract.trim(),
    pdfUrl: pdfUrl.trim(),
    submittedAt: at,
    stage: STAGE.REVIEW,
    assignedReviewers: pickReviewers(category),
    assignee: null,
    reviews: [],
    comments: [],
    revisions: [{ version: 1, url: pdfUrl.trim(), note: coAuthors ? `Co-authors: ${coAuthors}` : 'Initial submission', at, byName: u.name }],
    revisionRequested: false,
    associateRounds: 0,
    history: [],
  };
  db.submissions.push(sub);
  notifyEvent({ title: '📥 New journal submission', body: `${u.name}: ${sub.title} (${category})` });
  schedulePersist();
  return decorate(sub);
}

// Papers a researcher has submitted (with status, for their dashboard).
export function mySubmissions(userId) {
  return db.submissions.filter((s) => s.submittedBy === userId).map(decorate);
}

// The submitter uploads a new version of their paper.
export function addRevision({ paperId, userId, url, note }) {
  const sub = getSub(paperId);
  if (!sub) throw httpError(404, 'Paper not found');
  if (sub.submittedBy !== userId) throw httpError(403, 'Only the submitter can revise this paper');
  if (!url?.trim()) throw httpError(400, 'A link to the revised paper is required');
  sub.revisions = sub.revisions || [];
  const version = sub.revisions.length + 1;
  sub.revisions.push({ version, url: url.trim(), note: note || '', at: now(), byName: getResearcherById(userId)?.name });
  sub.pdfUrl = url.trim();
  sub.revisionRequested = false;
  log(sub, { type: 'revision', version });
  if (sub.assignee) pushNotif(sub.assignee, { type: 'paper', title: '🔁 Revised paper submitted', body: `"${sub.title}" — v${version}`, link: '/editor' });
  notifyReviewers(sub, '🔁 A paper you reviewed was revised', `"${sub.title}" — v${version}`);
  notifyEvent({ title: '🔁 Revision submitted', body: `${sub.title} — v${version}` });
  schedulePersist();
  return decorate(sub);
}

// An editor asks the author for a revision.
export function requestRevision({ paperId, editorId, note }) {
  const sub = getSub(paperId);
  if (!sub) throw httpError(404, 'Paper not found');
  const e = getEditorById(editorId);
  sub.revisionRequested = true;
  sub.comments = sub.comments || [];
  sub.comments.push({ id: `cmt_${Date.now()}`, authorId: editorId, authorName: e?.name || 'Editor', role: e?.role || null, body: `Revision requested: ${note || 'please submit a revised version.'}`, at: now() });
  log(sub, { type: 'revision_requested', editorId });
  pushNotif(sub.submittedBy, { type: 'revision', title: '✏️ Revision requested', body: `"${sub.title}" — ${note || 'please revise'}`, link: '/researcher/journal' });
  notifyEvent({ title: '✏️ Revision requested', body: `${sub.title}` });
  sendEmail({
    to: sub.authorEmail,
    subject: `Revision requested: ${sub.title}`,
    text: `Hi ${sub.authorName || 'researcher'},\n\nAn editor has requested a revision of "${sub.title}".\n\nNote: ${note || 'Please submit a revised version.'}\n\nUpload your revised version from your Synthica dashboard.\n\n— The Synthica editorial team`,
  });
  schedulePersist();
  return decorate(sub);
}

// --- internal transition helpers ------------------------------------------

function advance(sub, nextStage, note) {
  sub.stage = nextStage;
  // The next stage's single owner (senior/associate/chief). Reviews & published
  // don't take a single assignee here.
  if (nextStage === STAGE.SENIOR_SCREEN || nextStage === STAGE.SENIOR_FINAL) {
    sub.assignee = pickOne(EDITOR_ROLES.SENIOR, sub.category);
  } else if (nextStage === STAGE.ASSOCIATE) {
    sub.assignee = pickOne(EDITOR_ROLES.ASSOCIATE, sub.category);
  } else if (nextStage === STAGE.CHIEF || nextStage === STAGE.PUBLISHED) {
    sub.assignee = null;
  }
  log(sub, { type: 'advance', to: nextStage, notifyDirector: true, label: note.label, decision: note.decision });
  notifyMove({
    title: sub.title,
    paperId: sub.id,
    category: sub.category,
    label: note.label,
    decision: nextStage === STAGE.PUBLISHED ? 'published' : 'approved',
  });
  if (nextStage === STAGE.PUBLISHED) {
    emailDecision({ authorEmail: sub.authorEmail, authorName: sub.authorName, title: sub.title, decision: 'published' });
    notifyReviewers(sub, '🎉 A paper you reviewed was approved for publication', `"${sub.title}" · by ${sub.authorName}`);
  } else {
    notifyReviewers(sub, '📤 A paper you reviewed moved forward', `"${sub.title}" → ${note.label}`);
  }
}

function reject(sub, reachedLabel) {
  sub.stage = STAGE.REJECTED;
  sub.assignee = null;
  log(sub, { type: 'reject', notifyDirector: true, label: reachedLabel, decision: 'declined' });
  notifyMove({ title: sub.title, paperId: sub.id, category: sub.category, label: reachedLabel, decision: 'declined' });
  emailDecision({ authorEmail: sub.authorEmail, authorName: sub.authorName, title: sub.title, decision: 'declined' });
  notifyReviewers(sub, '❌ A paper you reviewed was declined', `"${sub.title}"`);
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// --- plain getters for Track 2 + Track 4 -----------------------------------

// Legacy publications (and editorial/archive ones) are verified by default;
// only self-archived past papers start unverified until an auditor confirms.
const isVerifiedPub = (p) => p.verified !== false;

// Public listing shows verified papers only (unverified self-archives stay on
// the author's profile until reviewed).
export const listPublications = () => db.publications.filter(isVerifiedPub);
export const getPublication = (id) => db.publications.find((p) => p.id === id || p.doi === id) || null;

// Admin/auditor views: the full set, plus the pending self-archive queue.
export const adminListPublications = () => [...db.publications].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
export const listArchiveQueue = () => db.publications.filter((p) => p.source === 'self' && p.verified === false);
export const myPublications = (userId) =>
  db.publications
    .filter((p) => p.authorUserId === userId || (p.authorUserIds || []).includes(userId))
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
export const listProjects = () => db.projects;
export const getProject = (id) => db.projects.find((p) => p.id === id) || null;
// Listings enriched with the people already on board (lead + accepted
// applicants) so cards can show pfp circles and a filled/wanted count.
export const listListings = () =>
  db.listings.map((l) => {
    const memberIds = [l.leadId, ...db.applications.filter((a) => a.listingId === l.id && a.status === 'approved').map((a) => a.userId)].filter(Boolean);
    const team = [...new Set(memberIds)]
      .map((id) => getUserById(id))
      .filter(Boolean)
      .map((u) => ({ id: u.id, slug: u.slug || u.id, name: u.name, avatarUrl: u.avatarUrl || '' }));
    return { ...l, team, filled: team.length };
  });
export const listApplications = () => db.applications;

// Suggest a starting role for a new member from their self-rated onboarding
// signals, so auditors get a sensible default instead of guessing.
// Score the written experience/publications description against known
// milestones (first match wins, strongest first). Deterministic stand-in for
// the "light LLM" idea — same contract, no API key needed.
export function suggestResearchScore(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  const rules = [
    [10, /\brsi\b|research science institute/i, 'RSI'],
    [10, /\bisef\b.{0,30}\b(grand|won|winner|1st|first)\b|\b(won|winner|1st|first)\b.{0,30}\bisef\b/i, 'winning ISEF'],
    [9, /\b(published|publication|peer[- ]?review(ed)?|journal|arxiv|preprint|doi)\b/i, 'a publication'],
    [8, /\bisef\b/i, 'ISEF'],
    [8, /\b(summer science program|ssp\b|simons|promys|mathcamp|sumac)\b/i, 'a selective summer program'],
    [7, /\bstate\b.{0,25}\b(fair|finals?|level|champion)/i, 'a state-level fair'],
    [6, /\b(research internship|research lab|lab experience|university research)\b/i, 'lab or internship research'],
    [5, /\b(regional|county)\b.{0,25}\b(fair|award|medal|place)/i, 'a regional fair'],
    [4, /\bscience fair\b/i, 'a science fair'],
    [2, /\b(school|class)\b.{0,25}\b(project|lab)/i, 'school projects'],
  ];
  for (const [score, re, evidence] of rules) if (re.test(t)) return { score, evidence };
  return { score: 3, evidence: 'self-described experience' };
}

export function recommendRole(u) {
  const slider = Number(u?.researchExperience) || 0;
  const text = suggestResearchScore(u?.experienceSummary);
  // Written evidence can raise (never lower) the self-rated score.
  const r = Math.max(slider, text?.score || 0);
  const via = text && text.score >= slider ? ` — mentions ${text.evidence}` : '';
  const l = Number(u?.leadershipExperience) || 0;
  if (u?.priorLead && u?.legacyProject?.title)
    return { tag: 'lead_researcher', label: 'Lead Researcher', reason: `Led “${u.legacyProject.title}” in the old system — verify and restore.` };
  if (u?.wantsChapterLead && l >= 6)
    return { tag: 'chapter_leader', label: 'Chapter Leader', reason: `Wants to lead a chapter and rates leadership ${l}/10.` };
  if (r >= 8)
    return { tag: 'lead_researcher', label: 'Lead Researcher', reason: `Strong research track record (${r}/10${via || ' — ISEF/RSI tier'}). Can lead projects.` };
  if (l >= 6)
    return { tag: 'chapter_leader', label: 'Chapter Leader', reason: `High leadership experience (${l}/10) — good fit to run a chapter.` };
  if (r >= 4)
    return { tag: 'associate_researcher', label: 'Associate Researcher', reason: `Some research experience (${r}/10${via}). Ready to join a team.` };
  return { tag: 'independent_researcher', label: 'Independent Researcher', reason: 'New to research — start independent and grow.' };
}

// Admin/auditor view: onboarding rows are enriched with the applicant's signals
// + a recommended role.
export const allApplications = () =>
  db.applications.map((a) => {
    if (a.kind !== 'onboarding') return a;
    const u = getResearcherById(a.userId);
    if (!u) return a;
    return {
      ...a,
      researchExperience: u.researchExperience ?? null,
      leadershipExperience: u.leadershipExperience ?? null,
      wantsChapterLead: !!u.wantsChapterLead,
      gpa: u.gpa || '',
      resumeUrl: u.resumeUrl || a.resumeUrl || '',
      experienceSummary: u.experienceSummary || '',
      priorLead: !!u.priorLead,
      legacyProject: u.legacyProject || null,
      recommendation: recommendRole(u),
    };
  });

const ROLE_TO_TAG = {
  'Lead Researcher': 'lead_researcher',
  'Associate Researcher': 'associate_researcher',
  'Chapter Leader': 'chapter_leader',
  'Independent Researcher': 'independent_researcher',
};
const RESEARCHER_TAGS = new Set(Object.values(ROLE_TO_TAG));

// If this member claimed a project from the old system, becoming a Lead
// restores it (whichever path granted the tag).
function restoreLegacyProject(u, actorId) {
  if (!u?.legacyProject?.title) return;
  const lp = u.legacyProject;
  db.projects.push({
    id: uid('proj'), title: lp.title, category: lp.category || '', description: lp.description || '',
    leadId: u.id, members: [u.id], announcements: [], tasks: [], links: [], ideas: [], invites: [],
  });
  recordAudit({ id: actorId }, 'restore_project', `${lp.title} (for ${u.name})`);
  pushNotif(u.id, { type: 'project', title: '📁 Your project was restored', body: lp.title, link: '/researcher/projects' });
  u.legacyProject = null;
}

// Auditor/Director reviews an onboarding or role application. On approval they
// may assign a researcher tag directly (assignTag), otherwise the application's
// requested role maps to a tag.
export function setApplicationStatus({ id, status, reviewerId, assignTag }) {
  const a = db.applications.find((x) => x.id === id);
  if (!a) throw httpError(404, 'Application not found');
  if (!['pending', 'approved', 'rejected'].includes(status)) throw httpError(400, 'Invalid status');
  a.status = status;
  a.reviewedBy = reviewerId || null;
  a.reviewedAt = now();
  recordAudit({ id: reviewerId }, 'review_application', `${a.userName}: ${a.role || a.kind || 'application'} -> ${status}`);
  pushNotif(a.userId, { type: 'application', title: `Your ${a.kind === 'onboarding' ? 'membership' : 'application'} was ${status}`, body: a.role || assignTag || '', link: '/researcher' });
  // Approving grants a researcher tag: the explicitly chosen one, or the one the
  // requested role maps to.
  if (status === 'approved') {
    const tag = (assignTag && RESEARCHER_TAGS.has(assignTag)) ? assignTag : (a.role && ROLE_TO_TAG[a.role]);
    const u = getResearcherById(a.userId);
    if (u) {
      // A decided application activates the member (role assigned -> can log in).
      u.approved = true;
      u.onboardingRejected = false;
      if (tag) {
        if (!Array.isArray(u.tags)) u.tags = [];
        if (!u.tags.includes(tag)) u.tags.push(tag);
        a.assignedTag = tag;
        // Approving a returning lead restores the project they claimed.
        if (tag === 'lead_researcher') restoreLegacyProject(u, reviewerId);
        // One-time in-app congrats + a welcome email with the assigned role.
        u.newRoleCongrats = TAG_LABEL[tag] || tag;
        if (u.email) {
          sendEmail({
            to: u.email,
            subject: `Welcome to Synthica — you're a ${TAG_LABEL[tag] || tag}!`,
            text: `Hi ${u.name},\n\nCongrats! Your Synthica membership was approved and you've been assigned the role of ${TAG_LABEL[tag] || tag}.\n\nSign in to get started: ${process.env.FRONTEND_URL || 'https://app.synthica.org'}\n\n— The Synthica Team`,
          });
        }
      }
    }
  } else if (status === 'rejected' && a.kind === 'onboarding') {
    // Surface the decision on the member's pending screen instead of leaving
    // them waiting forever.
    const u = getResearcherById(a.userId);
    if (u) u.onboardingRejected = true;
  }
  schedulePersist();
  return a;
}

// Auditors assign/remove researcher tags directly (role assignment), without
// the editor-role powers reserved for the Director.
export function auditorSetTags({ userId, addTags, removeTags, actor }) {
  const u = getResearcherById(userId);
  if (!u) throw httpError(404, 'Researcher not found');
  if (!Array.isArray(u.tags)) u.tags = [];
  const granted = (Array.isArray(addTags) ? addTags : []).filter((t) => RESEARCHER_TAGS.has(t) && !u.tags.includes(t));
  granted.forEach((t) => u.tags.push(t));
  (Array.isArray(removeTags) ? removeTags : []).forEach((t) => { u.tags = u.tags.filter((x) => x !== t); });
  if ((addTags || []).length) u.approved = true; // granting a role activates the member
  if (granted.includes('lead_researcher')) {
    restoreLegacyProject(u, actor?.id);
    u.leadRecommended = false; // clear the nudge once they've become a lead
  }
  if (granted.length) u.newRoleCongrats = TAG_LABEL[granted[granted.length - 1]] || granted[granted.length - 1];
  recordAudit(actor, 'assign_tags', `${u.name}: [${u.tags.join(',')}]`);
  schedulePersist();
  const { password, twoFactorSecret, ...safe } = u;
  return safe;
}

// Platform analytics for the admin page.
export function analytics() {
  const byStage = {};
  for (const s of db.submissions) byStage[s.stage] = (byStage[s.stage] || 0) + 1;
  const byCategory = {};
  for (const p of db.publications) if (p.verified !== false) byCategory[p.category] = (byCategory[p.category] || 0) + 1;
  return {
    users: db.editors.length + db.researchers.length,
    editors: db.editors.length,
    researchers: db.researchers.length,
    submissions: db.submissions.length,
    published: db.publications.filter((p) => p.verified !== false).length,
    byStage,
    byCategory,
    applications: db.applications.length,
    pendingApplications: db.applications.filter((a) => a.status === 'pending').length,
    pendingPapers: db.publications.filter((p) => p.source === 'self' && p.verified === false).length,
    chapters: db.chapters.length,
    projects: db.projects.length,
    totalAccesses: db.publications.reduce((s, p) => s + (p.metrics?.accesses || 0), 0),
  };
}

// Public impact counters for the marketing site (no auth, no PII).
export function publicStats() {
  return {
    researchers: db.researchers.length,
    members: db.editors.length + db.researchers.length,
    papersPublished: db.publications.filter((p) => p.verified !== false).length,
    projects: db.projects.length,
    chapters: db.chapters.length,
    openPrograms: db.programs.filter((p) => p.status === 'open').length,
  };
}

// --- programs (apply → cohort → milestones) ---------------------------------

const getProgram = (id) => db.programs.find((p) => p.id === id);

// Public view for the marketing site: open programs, no member identities.
export function listPublicPrograms() {
  return db.programs
    .filter((p) => p.status === 'open')
    .map((p) => ({
      id: p.id, title: p.title, cohortLabel: p.cohortLabel, category: p.category,
      description: p.description, spots: p.spots, applyDeadline: p.applyDeadline,
      startAt: p.startAt, endAt: p.endAt, cohortSize: p.cohort.length,
      milestones: p.milestones.map((m) => ({ id: m.id, title: m.title, dueAt: m.dueAt })),
    }));
}

// Researcher view: every non-archived program plus where this user stands.
export function listProgramsFor(userId) {
  return db.programs
    .filter((p) => p.status !== 'archived')
    .map((p) => {
      const application = db.applications.find(
        (a) => a.kind === 'program' && a.programId === p.id && a.userId === userId,
      );
      const myStatus = p.cohort.includes(userId)
        ? 'member'
        : application?.status === 'pending'
          ? 'applied'
          : application?.status === 'rejected'
            ? 'rejected'
            : 'none';
      return {
        id: p.id, title: p.title, cohortLabel: p.cohortLabel, category: p.category,
        description: p.description, spots: p.spots, applyDeadline: p.applyDeadline,
        startAt: p.startAt, endAt: p.endAt, status: p.status,
        cohortSize: p.cohort.length, milestones: p.milestones, myStatus,
      };
    });
}

export function applyToProgram({ programId, userId, message }) {
  const p = getProgram(programId);
  if (!p) throw httpError(404, 'Program not found');
  if (p.status !== 'open') throw httpError(400, 'This program is not accepting applications');
  if (p.applyDeadline && new Date(p.applyDeadline) < new Date()) throw httpError(400, 'The application deadline has passed');
  if (p.cohort.includes(userId)) throw httpError(400, "You're already in this cohort");
  if (p.spots && p.cohort.length >= p.spots) throw httpError(400, 'This cohort is full');
  if (db.applications.some((a) => a.kind === 'program' && a.programId === programId && a.userId === userId && a.status === 'pending'))
    throw httpError(400, "You've already applied — hang tight!");
  const u = getUserById(userId);
  const record = {
    id: `app_${db.applications.length + 1}`,
    kind: 'program',
    programId,
    userId,
    userName: u?.name || '',
    message: String(message || '').slice(0, 600),
    status: 'pending',
    at: now(),
  };
  db.applications.push(record);
  notifyEvent({ title: '🎓 Program application', body: `${record.userName} applied to ${p.title}${p.cohortLabel ? ` (${p.cohortLabel})` : ''}.` });
  schedulePersist();
  return record;
}

// Admin view: all programs with cohort names + their pending applications.
export function listProgramsAdmin() {
  const nameOf = (id) => getUserById(id)?.name || id;
  return db.programs.map((p) => ({
    ...p,
    cohortMembers: p.cohort.map((id) => ({ id, name: nameOf(id) })),
    applications: db.applications
      .filter((a) => a.kind === 'program' && a.programId === p.id)
      .map((a) => ({ ...a })),
  }));
}

export function createProgram({ title, description, category, cohortLabel, spots, applyDeadline, startAt, endAt, milestones }, actor) {
  if (!title?.trim()) throw httpError(400, 'A title is required');
  const p = {
    id: `prg_${Date.now()}`,
    title: title.trim().slice(0, 140),
    cohortLabel: String(cohortLabel || '').trim().slice(0, 60),
    category: CATEGORIES.includes(category) ? category : '',
    description: String(description || '').slice(0, 1200),
    spots: Math.max(0, Number(spots) || 0),
    applyDeadline: applyDeadline || '',
    startAt: startAt || '',
    endAt: endAt || '',
    status: 'open',
    cohort: [],
    milestones: (Array.isArray(milestones) ? milestones : [])
      .filter((m) => m && m.title?.trim())
      .map((m, i) => ({ id: `ms_${i + 1}`, title: m.title.trim().slice(0, 140), dueAt: m.dueAt || '', done: false })),
    createdBy: actor?.id || 'system',
    createdAt: now(),
  };
  db.programs.push(p);
  recordAudit(actor, 'program.create', p.title);
  schedulePersist();
  return p;
}

export function updateProgramStatus({ programId, status, actor }) {
  const p = getProgram(programId);
  if (!p) throw httpError(404, 'Program not found');
  if (!['open', 'closed', 'archived'].includes(status)) throw httpError(400, 'Invalid status');
  p.status = status;
  recordAudit(actor, 'program.status', `${p.title} → ${status}`);
  schedulePersist();
  return p;
}

export function addProgramMilestone({ programId, title, dueAt, actor }) {
  const p = getProgram(programId);
  if (!p) throw httpError(404, 'Program not found');
  if (!title?.trim()) throw httpError(400, 'A title is required');
  p.milestones.push({ id: `ms_${Date.now()}`, title: title.trim().slice(0, 140), dueAt: dueAt || '', done: false });
  schedulePersist();
  return p;
}

// Cohort-wide milestone toggle; members are notified when one completes.
export function toggleProgramMilestone({ programId, milestoneId, done, actor }) {
  const p = getProgram(programId);
  const m = p?.milestones.find((x) => x.id === milestoneId);
  if (!m) throw httpError(404, 'Milestone not found');
  m.done = !!done;
  if (m.done) for (const uid of p.cohort) pushNotif(uid, { type: 'program', title: `🎯 Milestone complete: ${m.title}`, body: `${p.title} (${p.cohortLabel}) just hit a milestone.`, link: '/researcher/programs' });
  recordAudit(actor, 'program.milestone', `${p.title}: ${m.title} → ${m.done ? 'done' : 'open'}`);
  schedulePersist();
  return p;
}

// Accept/reject a program application. Accepting admits the user to the cohort.
export function reviewProgramApplication({ id, status, reviewerId }) {
  const a = db.applications.find((x) => x.id === id && x.kind === 'program');
  if (!a) throw httpError(404, 'Application not found');
  if (a.status !== 'pending') throw httpError(400, 'Already reviewed');
  a.status = status === 'accepted' ? 'accepted' : 'rejected';
  a.reviewedBy = reviewerId;
  a.reviewedAt = now();
  const p = getProgram(a.programId);
  if (a.status === 'accepted' && p && !p.cohort.includes(a.userId)) {
    p.cohort.push(a.userId);
    pushNotif(a.userId, { type: 'program', title: `🎉 You're in: ${p.title}`, body: `Welcome to the ${p.cohortLabel || ''} cohort! Check your milestones.`, link: '/researcher/programs' });
  } else if (p) {
    pushNotif(a.userId, { type: 'program', title: `Update on ${p.title}`, body: 'Your program application was not accepted this round — more cohorts are coming.', link: '/researcher/programs' });
  }
  recordAudit({ id: reviewerId }, 'program.review', `${a.userName} → ${a.status} (${p?.title || a.programId})`);
  schedulePersist();
  return { ...a, user: getUserById(a.userId) ? { email: getUserById(a.userId).email, name: getUserById(a.userId).name } : null, program: p ? { title: p.title, cohortLabel: p.cohortLabel } : null };
}

// --- certificates (verifiable proof of role/completion) ---------------------

// Certificate type → the researcher tag that earns it (see RESEARCHER_TAGS in
// domain.js). Mirrors the official Synthica generator repos
// (AssociateResearcherGen / IndependentResearcherGen / LeadResearchGen):
// same templates, same eligibility.
const CERT_TYPES = {
  associate: 'associate_researcher',
  independent: 'independent_researcher',
  lead: 'lead_researcher',
};

const certCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
  const chunk = () => Array.from(randomBytes(4)).map((b) => alphabet[b % alphabet.length]).join('');
  return `SYN-${chunk()}-${chunk()}`;
};

// Which certificates this user can generate, and which they already hold.
export function myCertificates(userId) {
  const u = getResearcherById(userId);
  const tags = u?.tags || [];
  return {
    eligible: Object.entries(CERT_TYPES).filter(([, tag]) => tags.includes(tag)).map(([type]) => type),
    issued: db.certificates.filter((c) => c.userId === userId).map(({ id, code, type, name, issuedAt }) => ({ id, code, type, name, issuedAt })),
  };
}

// Idempotent: re-requesting an issued certificate returns the existing record
// (same verification code) instead of minting a new one.
export function issueCertificate({ userId, type }) {
  const tag = CERT_TYPES[type];
  if (!tag) throw httpError(400, 'Unknown certificate type');
  const u = getResearcherById(userId);
  if (!u) throw httpError(403, 'Certificates are issued to researchers');
  if (!(u.tags || []).includes(tag)) throw httpError(403, "You haven't earned this certificate yet");
  let cert = db.certificates.find((c) => c.userId === userId && c.type === type);
  if (!cert) {
    cert = { id: `crt_${Date.now()}`, code: certCode(), userId, name: u.name, type, issuedAt: now() };
    db.certificates.push(cert);
    recordAudit(u, 'certificate.issue', `${u.name} — ${type} (${cert.code})`);
    schedulePersist();
  }
  return cert;
}

// Public verification: anyone with the code can confirm a certificate is real.
export function verifyCertificate(code) {
  const c = db.certificates.find((x) => x.code === String(code || '').trim().toUpperCase());
  if (!c) return { valid: false };
  return { valid: true, name: c.name, type: c.type, issuedAt: c.issuedAt };
}

// --- weekly digest data ------------------------------------------------------

// Everything the weekly email digest needs in one read: recipients plus the
// open opportunities, programs, and next week's deadlines.
export function digestData() {
  const inAWeek = Date.now() + 7 * 24 * 3600 * 1000;
  return {
    recipients: db.researchers
      .filter((u) => u.email && u.approved !== false)
      .map((u) => ({ id: u.id, name: u.name, email: u.email })),
    listings: db.listings.map((l) => ({ title: l.title, category: l.category, spots: l.spots, leadName: l.leadName })),
    programs: db.programs
      .filter((p) => p.status === 'open')
      .map((p) => ({ title: p.title, cohortLabel: p.cohortLabel, applyDeadline: p.applyDeadline })),
    events: db.events
      .filter((e) => e.dueAt && new Date(e.dueAt).getTime() > Date.now() && new Date(e.dueAt).getTime() < inAWeek)
      .map((e) => ({ title: e.title, type: e.type, dueAt: e.dueAt })),
  };
}

export function addApplication(app) {
  // You can't apply to a listing you lead.
  if (app.listingId) {
    const listing = db.listings.find((l) => l.id === app.listingId);
    if (listing && listing.leadId === app.userId) throw httpError(400, "You can't apply to your own listing");
  }
  const record = { id: `app_${db.applications.length + 1}`, status: 'pending', at: now(), ...app };
  db.applications.push(record);
  notifyEvent({ title: '📝 New application', body: `${record.userName} applied${record.role ? ` for ${record.role}` : ''}.` });
  schedulePersist();
  return record;
}

// --- researcher project tasks (Track 4) ------------------------------------

const memberOf = (p, userId) => p.members.includes(userId);
const getTask = (p, taskId) => p.tasks.find((t) => t.id === taskId);

// Any team member can add a task (incl. a "question" for the hierarchy).
export function addProjectTask({ projectId, userId, title, type, dueAt, assignedTo, requiresApproval }) {
  const p = getProject(projectId);
  if (!p) throw httpError(404, 'Project not found');
  if (!memberOf(p, userId)) throw httpError(403, 'Only team members can add tasks');
  if (!title?.trim()) throw httpError(400, 'A title is required');
  const t = {
    id: `task_${Date.now()}`,
    title: title.trim(),
    type: ['reading', 'question'].includes(type) ? type : 'task',
    assignedTo: Array.isArray(assignedTo) ? assignedTo.filter((id) => memberOf(p, id)) : [],
    status: TASK_STATUS.TODO,
    done: false,
    requiresApproval: !!requiresApproval,
    createdBy: userId,
    dueAt: dueAt || null,
  };
  p.tasks.push(t);
  schedulePersist();
  return t;
}

// Toggle a member onto/off a task (anyone on the team can assign).
export function assignTask({ projectId, userId, taskId, memberId }) {
  const p = getProject(projectId);
  if (!p) throw httpError(404, 'Project not found');
  if (!memberOf(p, userId)) throw httpError(403, 'Only team members can assign');
  if (!memberOf(p, memberId)) throw httpError(400, 'That person is not on the team');
  const t = getTask(p, taskId);
  if (!t) throw httpError(404, 'Task not found');
  t.assignedTo = t.assignedTo.includes(memberId)
    ? t.assignedTo.filter((id) => id !== memberId)
    : [...t.assignedTo, memberId];
  schedulePersist();
  return t;
}

// A member starts a task. If it needs approval, it waits for the lead.
export function startTask({ projectId, userId, taskId }) {
  const p = getProject(projectId);
  if (!p) throw httpError(404, 'Project not found');
  if (!memberOf(p, userId)) throw httpError(403, 'Only team members can start tasks');
  const t = getTask(p, taskId);
  if (!t) throw httpError(404, 'Task not found');
  t.status = t.requiresApproval ? TASK_STATUS.AWAITING : TASK_STATUS.IN_PROGRESS;
  schedulePersist();
  return t;
}

// The lead approves (or sends back) a task that's awaiting approval to start.
export function approveTask({ projectId, userId, taskId, approve = true }) {
  const p = getProject(projectId);
  if (!p) throw httpError(404, 'Project not found');
  if (p.leadId !== userId) throw httpError(403, 'Only the lead can approve tasks');
  const t = getTask(p, taskId);
  if (!t) throw httpError(404, 'Task not found');
  if (t.status !== TASK_STATUS.AWAITING) throw httpError(409, 'Task is not awaiting approval');
  t.status = approve ? TASK_STATUS.IN_PROGRESS : TASK_STATUS.TODO;
  schedulePersist();
  return t;
}

// Mark a task done (or reopen it).
export function completeTask({ projectId, userId, taskId, done = true }) {
  const p = getProject(projectId);
  if (!p) throw httpError(404, 'Project not found');
  if (!memberOf(p, userId)) throw httpError(403, 'Only team members can update tasks');
  const t = getTask(p, taskId);
  if (!t) throw httpError(404, 'Task not found');
  t.status = done ? TASK_STATUS.DONE : TASK_STATUS.IN_PROGRESS;
  t.done = done;
  schedulePersist();
  return t;
}

export function addProjectAnnouncement({ projectId, userId, body }) {
  const p = getProject(projectId);
  if (!p) throw httpError(404, 'Project not found');
  if (p.leadId !== userId) throw httpError(403, 'Only the project lead can post announcements');
  if (!body?.trim()) throw httpError(400, 'A message is required');
  const ann = { id: `ann_${Date.now()}`, at: now(), body: body.trim() };
  p.announcements.push(ann);
  schedulePersist();
  return ann;
}

// A researcher saves/updates the link to their résumé (for auto-applying).
export function updateResume(userId, resumeUrl) {
  const r = getResearcherById(userId);
  if (!r) throw httpError(404, 'Researcher not found');
  r.resumeUrl = (resumeUrl || '').trim();
  schedulePersist();
  return { resumeUrl: r.resumeUrl };
}

// Contacts (name/email/discord) for everyone on a project — used by the team
// roster and the lead's "email everyone" action.
export function projectTeam(projectId) {
  const p = getProject(projectId);
  if (!p) return [];
  return p.members
    .map((mid) => getResearcherById(mid))
    .filter(Boolean)
    .map((m) => ({ id: m.id, name: m.name, email: m.email, discord: m.discord, isLead: m.id === p.leadId }));
}

// Link a paper or media resource to a project (any member). Used to embed
// previews (Google Drive, YouTube, etc.) on the project page.
// Lead invites someone by email (e.g. teammates from the old system). If they
// already have an account they join immediately; otherwise the invite is held
// on the project and claimed automatically when that email registers.
export function inviteToProject({ projectId, leadId, email }) {
  const p = getProject(projectId);
  if (!p) throw httpError(404, 'Project not found');
  if (p.leadId !== leadId) throw httpError(403, 'Only the project lead can invite people');
  const addr = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) throw httpError(400, 'Enter a valid email address');
  const lead = getUserById(leadId);

  const existing = getUserByEmail(addr);
  if (existing) {
    if (p.members.includes(existing.id)) throw httpError(409, 'They are already on this project');
    p.members.push(existing.id);
    pushNotif(existing.id, { type: 'project', title: `You were added to ${p.title}`, body: `Invited by ${lead?.name || 'the project lead'}`, link: `/researcher/project/${p.id}` });
    sendEmail({
      to: addr,
      subject: `You've been added to "${p.title}" on Synthica`,
      text: `Hi ${existing.name},\n\n${lead?.name || 'A project lead'} added you to the project "${p.title}".\nSign in to see it: ${process.env.FRONTEND_URL || 'https://app.synthica.org'}\n\n— The Synthica Team`,
    });
    schedulePersist();
    return { status: 'added', name: existing.name };
  }

  if (!Array.isArray(p.invites)) p.invites = [];
  if (p.invites.some((i) => i.email === addr)) throw httpError(409, 'That email already has a pending invite');
  p.invites.push({ email: addr, by: leadId, at: now() });
  sendEmail({
    to: addr,
    subject: `${lead?.name || 'A Synthica lead'} invited you to "${p.title}"`,
    text: `Hi,\n\nYou've been invited to join the research project "${p.title}" on Synthica.\nCreate your account with this email address and you'll be added automatically:\n${process.env.FRONTEND_URL || 'https://app.synthica.org'}/register\n\n— The Synthica Team`,
  });
  recordAudit(lead, 'invite_member', `${addr} -> ${p.title}`);
  schedulePersist();
  return { status: 'invited', email: addr };
}

// Claim any project invites waiting on this email (called on registration).
function claimProjectInvites(user) {
  const addr = (user.email || '').toLowerCase();
  if (!addr) return;
  for (const p of db.projects) {
    const idx = (p.invites || []).findIndex((i) => i.email === addr);
    if (idx !== -1) {
      p.invites.splice(idx, 1);
      if (!p.members.includes(user.id)) p.members.push(user.id);
      pushNotif(user.id, { type: 'project', title: `You've joined ${p.title}`, body: 'Your invite was waiting for you.', link: `/researcher/project/${p.id}` });
    }
  }
}

export function addProjectLink({ projectId, userId, label, url }) {
  const p = getProject(projectId);
  if (!p) throw httpError(404, 'Project not found');
  if (!memberOf(p, userId)) throw httpError(403, 'Only team members can add links');
  if (!url?.trim()) throw httpError(400, 'A URL is required');
  if (!p.links) p.links = [];
  const link = { id: `link_${Date.now()}`, label: (label || url).trim(), url: url.trim(), addedBy: userId, at: now() };
  p.links.push(link);
  schedulePersist();
  return link;
}

// --- following + personalized feed -----------------------------------------

export function followUser(userId, targetId) {
  if (userId === targetId) throw httpError(400, "You can't follow yourself");
  const u = getUserById(userId);
  if (!u || !getUserById(targetId)) throw httpError(404, 'User not found');
  if (!Array.isArray(u.following)) u.following = [];
  if (!u.following.includes(targetId)) u.following.push(targetId);
  schedulePersist();
  return { following: u.following };
}

export function unfollowUser(userId, targetId) {
  const u = getUserById(userId);
  if (!u) throw httpError(404, 'User not found');
  u.following = (u.following || []).filter((id) => id !== targetId);
  schedulePersist();
  return { following: u.following };
}

// Directory of people with the viewer's follow state.
export function peopleDirectory(viewerId) {
  const u = getUserById(viewerId);
  const following = new Set((u && u.following) || []);
  return [...db.editors, ...db.researchers]
    .filter((x) => isVisible(x) && x.id !== viewerId)
    .map((x) => ({
      id: x.id, slug: x.slug || x.id, username: x.username || '', name: x.name, role: roleDisplay(x),
      institution: x.institution || '', blurb: x.blurb || '', avatarUrl: x.avatarUrl || '',
      interests: x.interests || [], following: following.has(x.id),
    }));
}

// Personalized feed: announcements + people you follow + interest matches.
export function feedFor(userId) {
  const u = getUserById(userId);
  const following = new Set((u && u.following) || []);
  const interests = ((u && u.interests) || []).map((s) => s.toLowerCase());
  const items = [];
  for (const n of db.news || []) items.push({ type: 'news', title: n.title, body: n.body, by: n.authorName, bannerUrl: n.bannerUrl || '', at: n.at });
  for (const c of chaptersOf(userId))
    for (const ann of c.announcements || [])
      items.push({ type: 'chapter', title: `${c.name}: ${ann.title}`, body: ann.body, by: ann.byName, at: ann.at });
  for (const p of db.publications) {
    if (p.authorUserId && following.has(p.authorUserId)) {
      items.push({ type: 'following', title: `New paper from ${getUserById(p.authorUserId)?.name || 'someone you follow'}`, body: p.title, doi: p.doi, at: p.publishedAt });
    } else if (interests.length) {
      const hay = `${p.title} ${(p.keywords || []).join(' ')} ${p.category}`.toLowerCase();
      if (interests.some((i) => i && hay.includes(i))) items.push({ type: 'suggested', title: `Matches your interests`, body: p.title, doi: p.doi, at: p.publishedAt });
    }
  }
  items.sort((a, b) => new Date(b.at) - new Date(a.at));
  return items.slice(0, 30);
}

// --- pathway (personal guided research to-dos) -----------------------------

export const listPathway = (userId) => (getResearcherById(userId)?.pathway) || [];

export function addPathway({ userId, title, deliverable, dueAt }) {
  const u = getResearcherById(userId);
  if (!u) throw httpError(404, 'Researcher not found');
  if (!title?.trim()) throw httpError(400, 'A title is required');
  if (!Array.isArray(u.pathway)) u.pathway = [];
  const item = { id: `pw_${Date.now()}`, title: title.trim(), deliverable: (deliverable || '').trim(), dueAt: dueAt || null, done: false };
  u.pathway.push(item);
  schedulePersist();
  return item;
}

// Seed a guided pathway based on the researcher's chosen track. "own" = start
// your own research; "join" = join an existing project. Idempotent per track —
// re-running with the same track won't duplicate steps.
const PATHWAY_TEMPLATES = {
  own: [
    { title: 'Pick a research question', deliverable: 'A one-sentence question + why it matters' },
    { title: 'Write a short literature scan', deliverable: '5–8 sources with one-line takeaways' },
    { title: 'Find a mentor or advisor', deliverable: 'One person who agreed to advise' },
    { title: 'Draft a project proposal', deliverable: '1-page outline: question, method, timeline' },
    { title: 'Create your project on Synthica', deliverable: 'Project page with goals + first tasks' },
  ],
  join: [
    { title: 'Browse open projects in the Research Hub', deliverable: '3 projects that fit your interests' },
    { title: 'Polish your profile + résumé', deliverable: 'Bio, interests, and résumé link filled in' },
    { title: 'Apply to a project or listing', deliverable: 'At least one application submitted' },
    { title: 'Complete your first assigned task', deliverable: 'One deliverable handed to your lead' },
    { title: 'Share an update with your team', deliverable: 'A progress note posted to the project' },
  ],
};

export function seedPathway({ userId, track }) {
  const u = getResearcherById(userId);
  if (!u) throw httpError(404, 'Researcher not found');
  const template = PATHWAY_TEMPLATES[track];
  if (!template) throw httpError(400, 'Unknown track');
  if (!Array.isArray(u.pathway)) u.pathway = [];
  if (u.pathway.some((p) => p.track === track)) return u.pathway; // already seeded
  const base = Date.now();
  template.forEach((t, i) => {
    u.pathway.push({ id: `pw_${base}_${i}`, title: t.title, deliverable: t.deliverable, dueAt: null, done: false, track });
  });
  schedulePersist();
  return u.pathway;
}

export function togglePathway({ userId, itemId, done }) {
  const u = getResearcherById(userId);
  if (!u) throw httpError(404, 'Researcher not found');
  const it = (u.pathway || []).find((p) => p.id === itemId);
  if (!it) throw httpError(404, 'Item not found');
  it.done = done !== undefined ? !!done : !it.done;
  schedulePersist();
  return it;
}

export function deletePathway({ userId, itemId }) {
  const u = getResearcherById(userId);
  if (!u) throw httpError(404, 'Researcher not found');
  u.pathway = (u.pathway || []).filter((p) => p.id !== itemId);
  schedulePersist();
  return { ok: true };
}

// --- project ideas (brainstorm + vote) -------------------------------------

export function addIdea({ projectId, userId, text }) {
  const p = getProject(projectId);
  if (!p) throw httpError(404, 'Project not found');
  if (!p.members.includes(userId)) throw httpError(403, 'Only team members can add ideas');
  if (!text?.trim()) throw httpError(400, 'Idea text required');
  if (!p.ideas) p.ideas = [];
  const idea = { id: `idea_${Date.now()}`, text: text.trim(), by: userId, votes: [userId], chosen: false, at: now() };
  p.ideas.push(idea);
  schedulePersist();
  return idea;
}

export function voteIdea({ projectId, userId, ideaId }) {
  const p = getProject(projectId);
  if (!p) throw httpError(404, 'Project not found');
  if (!p.members.includes(userId)) throw httpError(403, 'Only team members can vote');
  const idea = (p.ideas || []).find((i) => i.id === ideaId);
  if (!idea) throw httpError(404, 'Idea not found');
  idea.votes = idea.votes || [];
  idea.votes = idea.votes.includes(userId) ? idea.votes.filter((v) => v !== userId) : [...idea.votes, userId];
  schedulePersist();
  return idea;
}

export function chooseIdea({ projectId, userId, ideaId }) {
  const p = getProject(projectId);
  if (!p) throw httpError(404, 'Project not found');
  if (p.leadId !== userId) throw httpError(403, 'Only the lead can choose the idea');
  (p.ideas || []).forEach((i) => { i.chosen = i.id === ideaId; });
  schedulePersist();
  return p.ideas;
}

// --- chapters + onboarding (Track 4) ---------------------------------------

// Public self-registration for researchers. Requires a point of contact
// (email + Discord). Returns the new (safe) user; the route issues a token.
export function registerResearcher({ name, email, discord, password, username, resumeUrl }) {
  if (!name?.trim() || !email?.trim()) throw httpError(400, 'Name and email are required');
  if (!discord?.trim()) throw httpError(400, 'A Discord username is required');
  if (!password || password.length < 6) throw httpError(400, 'Password must be at least 6 characters');

  const uname = (username?.trim() || email.trim().split('@')[0]).toLowerCase();
  const all = [...db.editors, ...db.researchers];
  if (all.some((u) => u.username.toLowerCase() === uname)) throw httpError(409, 'That username is taken');
  if (all.some((u) => u.email && u.email.toLowerCase() === email.trim().toLowerCase()))
    throw httpError(409, 'An account with that email already exists');

  const user = {
    id: `usr_${Date.now()}`,
    name: name.trim(),
    username: uname,
    password: hashPassword(password),
    kind: 'researcher',
    // No role yet — an auditor decides it before the account is usable.
    tags: [],
    approved: false,
    email: email.trim(),
    discord: discord.trim(),
    resumeUrl: String(resumeUrl || '').trim().slice(0, 400),
    gpa: '',
    experienceSummary: '',
    researchExperience: null,
    leadershipExperience: null,
    wantsChapterLead: false,
    leadRecommended: false,
    pathway: [],
    slug: uname.replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
    institution: '',
    bio: '',
    blurb: '',
    avatarUrl: '',
    interests: [],
    links: [],
    following: [],
    public: true,
    emailVerified: false,
  };
  db.researchers.push(user);
  claimProjectInvites(user);
  // Surface every new member in the auditor's onboarding queue for role assignment.
  db.applications.push({
    id: `app_${db.applications.length + 1}`,
    kind: 'onboarding',
    userId: user.id,
    userName: user.name,
    listingId: null,
    role: null,
    message: 'New member sign-up — assign a role',
    status: 'pending',
    at: now(),
  });
  notifyEvent({ title: '👋 New member', body: `${user.name} joined Synthica.` });
  schedulePersist();
  const { password: _pw, ...safe } = user;
  return safe;
}

// --- email verification + password reset (password accounts) ---------------

export const getUserByEmail = (email) =>
  [...db.editors, ...db.researchers].find((u) => u.email && u.email.toLowerCase() === String(email).toLowerCase()) || null;

export function markEmailVerified(userId) {
  const u = getEditorById(userId) || getResearcherById(userId);
  if (!u) return false;
  u.emailVerified = true;
  schedulePersist();
  return true;
}

export function setPassword(userId, newPassword) {
  const u = getEditorById(userId) || getResearcherById(userId);
  if (!u) throw httpError(404, 'User not found');
  if (!newPassword || newPassword.length < 6) throw httpError(400, 'Password must be at least 6 characters');
  u.password = hashPassword(newPassword);
  schedulePersist();
  return true;
}

// --- global news / announcements -------------------------------------------

export function listNews() {
  return [...(db.news || [])].sort((a, b) => new Date(b.at) - new Date(a.at));
}

export function addNews({ authorId, authorName, title, body, audience, bannerUrl }) {
  if (!title?.trim() || !body?.trim()) throw httpError(400, 'Title and body are required');
  const item = {
    id: `news_${Date.now()}`,
    title: title.trim().slice(0, 160),
    body: body.trim().slice(0, 4000),
    authorName: authorName || 'Synthica',
    audience: audience || 'all',
    bannerUrl: (bannerUrl || '').trim().slice(0, 400),
    at: new Date().toISOString(),
  };
  if (!db.news) db.news = [];
  db.news.unshift(item);
  recordAudit({ id: authorId, name: authorName }, 'post_news', title);
  notifyEvent({ title: '📣 Announcement', body: `${title}` });
  for (const u of [...db.editors, ...db.researchers]) {
    pushNotif(u.id, { type: 'news', title: '📣 ' + item.title, body: item.body.slice(0, 140), link: '' });
  }
  schedulePersist();
  return item;
}

// --- in-app notifications --------------------------------------------------

export function listNotifications(userId) {
  return (db.notifications || [])
    .filter((n) => n.userId === userId)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 50);
}

export function markNotificationsRead(userId, ids) {
  const set = Array.isArray(ids) && ids.length ? new Set(ids) : null;
  (db.notifications || []).forEach((n) => {
    if (n.userId === userId && (!set || set.has(n.id))) n.read = true;
  });
  schedulePersist();
  return { ok: true };
}

// --- shared calendar: lead-set deadlines + task/pathway due dates -----------

const EVENT_TYPES = ['task', 'paper', 'event'];
const isStaff = (u) => u?.kind === 'editor';

// Leads set deadlines for their projects; staff can also post platform-wide
// ones (no project). Everyone affected sees them on their Calendar page.
export function addEvent({ userId, title, type, dueAt, projectId, chapterId }) {
  const u = getUserById(userId);
  if (!u) throw httpError(404, 'User not found');
  if (!title?.trim()) throw httpError(400, 'A title is required');
  if (!dueAt || Number.isNaN(new Date(dueAt).getTime())) throw httpError(400, 'A valid date is required');
  let project = null;
  let chapter = null;
  if (projectId) {
    project = getProject(projectId);
    if (!project) throw httpError(404, 'Project not found');
    if (project.leadId !== userId && !isStaff(u)) throw httpError(403, 'Only the project lead can set its deadlines');
  } else if (chapterId) {
    chapter = db.chapters.find((c) => c.id === chapterId);
    if (!chapter) throw httpError(404, 'Chapter not found');
    if (chapter.leaderId !== userId && !isStaff(u)) throw httpError(403, 'Only the chapter leader can set its events');
  } else if (!isStaff(u)) {
    throw httpError(403, 'Pick one of your projects or your chapter — platform-wide deadlines are staff-only');
  }
  if (!Array.isArray(db.events)) db.events = [];
  const ev = {
    id: uid('ev'),
    title: title.trim().slice(0, 140),
    type: EVENT_TYPES.includes(type) ? type : 'event',
    dueAt: String(dueAt).slice(0, 10),
    projectId: project?.id || null,
    chapterId: chapter?.id || null,
    createdBy: userId,
    createdByName: u.name,
    at: now(),
  };
  db.events.push(ev);
  // Tell the affected people right away.
  const audience = project
    ? project.members.filter((id) => id !== userId)
    : chapter
      ? (chapter.members || []).map((m) => m.userId).filter((id) => id !== userId)
      : [];
  const ctx = project?.title || chapter?.name || '';
  for (const id of audience)
    pushNotif(id, { type: 'deadline', title: `📅 New ${ev.type}: ${ev.title}`, body: `${ctx} · ${ev.dueAt}`, link: '/researcher/calendar' });
  recordAudit(u, 'add_deadline', `${ev.title} (${ev.dueAt})`);
  schedulePersist();
  return ev;
}

export function deleteEvent({ id, userId }) {
  const u = getUserById(userId);
  const idx = (db.events || []).findIndex((e) => e.id === id);
  if (idx === -1) throw httpError(404, 'Deadline not found');
  if (db.events[idx].createdBy !== userId && !isStaff(u)) throw httpError(403, 'Only the creator can remove this');
  db.events.splice(idx, 1);
  schedulePersist();
  return { ok: true };
}

// Everything with a date that concerns this user, normalized for the calendar:
// lead-set deadlines (their projects + platform-wide), project task due dates,
// and their own pathway steps.
export function calendarFor(userId) {
  const myProjects = db.projects.filter((p) => p.members.includes(userId));
  const myProjectIds = new Set(myProjects.map((p) => p.id));
  const items = [];
  const myChapterIds = new Set(chaptersOf(userId).map((c) => c.id));
  for (const ev of db.events || []) {
    if (ev.projectId && !myProjectIds.has(ev.projectId)) continue;
    if (ev.chapterId && !myChapterIds.has(ev.chapterId)) continue;
    const project = ev.projectId ? getProject(ev.projectId) : null;
    const chapter = ev.chapterId ? db.chapters.find((c) => c.id === ev.chapterId) : null;
    items.push({
      id: ev.id, date: ev.dueAt, title: ev.title, kind: ev.type,
      context: project?.title || chapter?.name || 'All Synthica', byName: ev.createdByName,
      canDelete: ev.createdBy === userId,
    });
  }
  for (const p of myProjects)
    for (const t of p.tasks || [])
      if (t.dueAt && !t.done)
        items.push({ id: `${p.id}:${t.id}`, date: String(t.dueAt).slice(0, 10), title: t.title, kind: 'task', context: p.title, byName: '', canDelete: false });
  const me = getResearcherById(userId);
  for (const it of me?.pathway || [])
    if (it.dueAt && !it.done)
      items.push({ id: `pw:${it.id}`, date: String(it.dueAt).slice(0, 10), title: it.title, kind: 'pathway', context: 'My pathway', byName: '', canDelete: false });
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

// --- audit log + backup export ---------------------------------------------

export const listAudit = () => [...(db.audit || [])].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 500);

export function exportAll() {
  return db; // full snapshot for backup download
}


const onboardingPct = (membership) =>
  membership.onboarding.length
    ? Math.round((membership.onboarding.filter((s) => s.done).length / membership.onboarding.length) * 100)
    : 0;

const projectsForUser = (userId) => db.projects.filter((p) => p.members.includes(userId));

export const getChapterLedBy = (userId) => db.chapters.find((c) => c.leaderId === userId) || null;
const chaptersOf = (userId) => db.chapters.filter((c) => c.leaderId === userId || (c.members || []).some((m) => m.userId === userId));

// Chapter leader broadcasts to their chapter: stored on the chapter, shown in
// members' feeds, and pushed as a notification.
export function addChapterAnnouncement({ leaderId, title, body }) {
  const chapter = getChapterLedBy(leaderId);
  if (!chapter) throw httpError(403, 'Only a chapter leader can post chapter announcements');
  if (!title?.trim()) throw httpError(400, 'A title is required');
  const lead = getUserById(leaderId);
  if (!Array.isArray(chapter.announcements)) chapter.announcements = [];
  const ann = { id: uid('cann'), title: title.trim().slice(0, 140), body: String(body || '').slice(0, 1000), byName: lead?.name || 'Chapter lead', at: now() };
  chapter.announcements.unshift(ann);
  for (const m of chapter.members || [])
    if (m.userId !== leaderId)
      pushNotif(m.userId, { type: 'chapter', title: `📣 ${chapter.name}: ${ann.title}`, body: ann.body.slice(0, 120), link: '/researcher' });
  recordAudit(lead, 'chapter_announcement', `${chapter.name}: ${ann.title}`);
  schedulePersist();
  return ann;
}
export const getChapterForUser = (userId) =>
  db.chapters.find((c) => c.members.some((m) => m.userId === userId)) || null;

// The current user's onboarding status (for the onboarding card on their dash).
export function myOnboarding(userId) {
  const chapter = getChapterForUser(userId);
  if (!chapter) return null;
  const membership = chapter.members.find((m) => m.userId === userId);
  return {
    chapterId: chapter.id,
    chapterName: chapter.name,
    handbookUrl: chapter.handbookUrl,
    steps: membership.onboarding,
    pct: onboardingPct(membership),
  };
}

// A member checks off (or unchecks) one of their onboarding steps.
export function setOnboardingStep({ userId, key, done }) {
  const chapter = getChapterForUser(userId);
  if (!chapter) throw httpError(404, 'You are not in a chapter');
  const membership = chapter.members.find((m) => m.userId === userId);
  const step = membership.onboarding.find((s) => s.key === key);
  if (!step) throw httpError(404, 'Unknown onboarding step');
  step.done = !!done;
  schedulePersist();
  return { steps: membership.onboarding, pct: onboardingPct(membership) };
}

// Chapter-leader dashboard: roster (contacts + onboarding + projects) + stats.
export function chapterView(leaderId) {
  const chapter = getChapterLedBy(leaderId);
  if (!chapter) return null;
  const members = chapter.members.map((m) => {
    const u = getResearcherById(m.userId);
    const projects = projectsForUser(m.userId).map((p) => p.title);
    return {
      userId: m.userId,
      name: u?.name || 'Member',
      email: u?.email || '',
      discord: u?.discord || '',
      joinedAt: m.joinedAt,
      onboardingPct: onboardingPct(m),
      onboarded: onboardingPct(m) === 100,
      projects,
    };
  });
  const stats = {
    members: members.length,
    fullyOnboarded: members.filter((m) => m.onboarded).length,
    avgOnboarding: members.length
      ? Math.round(members.reduce((s, m) => s + m.onboardingPct, 0) / members.length)
      : 0,
    activeProjects: new Set(members.flatMap((m) => m.projects)).size,
  };
  const announcements = chapter.announcements || [];
  return { id: chapter.id, name: chapter.name, location: chapter.location, handbookUrl: chapter.handbookUrl, members, stats, announcements };
}

// Leader adds a member by email: links an EXISTING account (look-up) or creates
// a new one. Either way they get tagged + a fresh onboarding checklist. People
// can exist without a chapter and be added here later.
export function addChapterMember({ leaderId, name, email, discord }) {
  const chapter = getChapterLedBy(leaderId);
  if (!chapter) throw httpError(403, 'Only a chapter leader can add members');
  if (!email?.trim()) throw httpError(400, 'An email is required');

  let user = getUserByEmail(email);
  let existing = !!user;
  if (user) {
    if (chapter.members.some((m) => m.userId === user.id)) throw httpError(409, 'They are already in this chapter');
  } else {
    if (!name?.trim()) throw httpError(400, 'Name is required to create a new member');
    user = {
      id: `usr_${Date.now()}`,
      name: name.trim(),
      username: email.trim().split('@')[0].toLowerCase(),
      password: hashPassword('demo1234'),
      kind: 'researcher',
      tags: [],
      email: email.trim(),
      discord: (discord || '').trim(),
      slug: email.trim().split('@')[0].toLowerCase(),
      resumeUrl: '', public: true, emailVerified: false, following: [], pathway: [], interests: [],
    };
    db.researchers.push(user);
  }
  if (!Array.isArray(user.tags)) user.tags = [];
  if (!user.tags.includes('associate_researcher')) user.tags.push('associate_researcher'); // get tagged
  chapter.members.push({ userId: user.id, joinedAt: now(), onboarding: freshOnboarding() });
  pushNotif(user.id, { type: 'chapter', title: `You were added to ${chapter.name}`, body: 'Welcome — finish your onboarding to get started.', link: '/researcher' });
  notifyEvent({ title: '👋 Chapter member added', body: `${user.name} joined ${chapter.name}.` });
  schedulePersist();
  return { id: user.id, name: user.name, email: user.email, discord: user.discord, existing };
}

// --- leads: create listings/projects + review their own applicants ---------

const isLead = (u) => u && Array.isArray(u.tags) && u.tags.includes('lead_researcher');

export function createListing({ userId, title, category, spots, description, bannerUrl, lookingFor }) {
  const u = getResearcherById(userId);
  if (!isLead(u)) throw httpError(403, 'Only lead researchers can post listings');
  if (!title?.trim()) throw httpError(400, 'A title is required');
  const listing = {
    id: `list_${Date.now()}`, title: title.trim(), category: category || '',
    spots: Number(spots) || 1, leadName: u.name, leadId: userId,
    description: (description || '').trim(), bannerUrl: String(bannerUrl || '').trim().slice(0, 400),
    lookingFor: String(lookingFor || '').trim().slice(0, 200),
  };
  db.listings.push(listing);
  recordAudit({ id: userId, name: u.name }, 'create_listing', listing.title);
  schedulePersist();
  return listing;
}

export function createProject({ userId, title, category, description }) {
  const u = getResearcherById(userId);
  if (!isLead(u)) throw httpError(403, 'Only lead researchers can create projects');
  if (!title?.trim()) throw httpError(400, 'A title is required');
  const p = { id: `proj_${Date.now()}`, title: title.trim(), category: category || '', description: (description || '').trim(), leadId: userId, members: [userId], announcements: [], tasks: [], links: [], ideas: [] };
  db.projects.push(p);
  recordAudit({ id: userId, name: u.name }, 'create_project', p.title);
  schedulePersist();
  return p;
}

// Edit your own listing (recruiting posts evolve as spots fill).
export function updateListing({ listingId, leadId, title, category, spots, description, bannerUrl, lookingFor }) {
  const l = db.listings.find((x) => x.id === listingId);
  if (!l) throw httpError(404, 'Listing not found');
  if (l.leadId !== leadId) throw httpError(403, 'Not your listing');
  if (typeof title === 'string' && title.trim()) l.title = title.trim().slice(0, 140);
  if (typeof category === 'string' && category) l.category = category;
  if (spots !== undefined) l.spots = Math.max(1, Number(spots) || 1);
  if (typeof description === 'string') l.description = description.trim().slice(0, 1000);
  if (typeof bannerUrl === 'string') l.bannerUrl = bannerUrl.trim().slice(0, 400);
  if (typeof lookingFor === 'string') l.lookingFor = lookingFor.trim().slice(0, 200);
  recordAudit({ id: leadId }, 'edit_listing', l.title);
  schedulePersist();
  return l;
}

export function deleteListing({ listingId, leadId }) {
  const idx = db.listings.findIndex((x) => x.id === listingId);
  if (idx === -1) throw httpError(404, 'Listing not found');
  if (db.listings[idx].leadId !== leadId) throw httpError(403, 'Not your listing');
  const [l] = db.listings.splice(idx, 1);
  // Tell pending applicants instead of leaving them waiting on a ghost.
  for (const a of db.applications.filter((x) => x.listingId === l.id && x.status === 'pending')) {
    a.status = 'rejected';
    a.reviewedAt = now();
    pushNotif(a.userId, { type: 'application', title: 'A listing you applied to was closed', body: l.title, link: '/researcher/opportunities' });
  }
  recordAudit({ id: leadId }, 'delete_listing', l.title);
  schedulePersist();
  return { ok: true };
}

// A lead's own listings with the numbers they decide by: applicant funnel +
// each applicant's signals (resume, scores, blurb).
export function myListings(userId) {
  return db.listings
    .filter((l) => l.leadId === userId)
    .map((l) => {
      const apps = db.applications.filter((a) => a.listingId === l.id);
      const applicants = apps.map((a) => {
        const u = getUserById(a.userId);
        return {
          id: a.id, userId: a.userId, name: a.userName, status: a.status,
          message: a.message || '', resumeUrl: a.resumeUrl || u?.resumeUrl || '', at: a.at,
          researchExperience: u?.researchExperience ?? null,
          leadershipExperience: u?.leadershipExperience ?? null,
          blurb: u?.blurb || '', slug: u?.slug || a.userId,
        };
      }).sort((a, b) => new Date(b.at) - new Date(a.at));
      const stats = {
        applicants: apps.length,
        pending: apps.filter((a) => a.status === 'pending').length,
        approved: apps.filter((a) => a.status === 'approved').length,
        rejected: apps.filter((a) => a.status === 'rejected').length,
      };
      return { ...l, applicantsDetail: applicants, stats, filled: stats.approved };
    });
}

// Applications to listings this lead owns.
export function myListingApplications(userId) {
  const mine = new Set(db.listings.filter((l) => l.leadId === userId).map((l) => l.id));
  return db.applications.filter((a) => a.listingId && mine.has(a.listingId));
}

// A lead accepts/rejects an applicant to one of their own listings.
export function reviewListingApplication({ leadId, appId, status }) {
  const a = db.applications.find((x) => x.id === appId);
  if (!a) throw httpError(404, 'Application not found');
  const listing = db.listings.find((l) => l.id === a.listingId);
  if (!listing || listing.leadId !== leadId) throw httpError(403, 'Not your listing');
  if (!['approved', 'rejected', 'pending'].includes(status)) throw httpError(400, 'Invalid status');
  a.status = status;
  a.reviewedBy = leadId;
  a.reviewedAt = now();
  pushNotif(a.userId, { type: 'application', title: `Your application was ${status}`, body: listing.title, link: '/researcher/opportunities' });
  schedulePersist();
  return a;
}

// --- stats (Track 4 + Track 3) ---------------------------------------------

export function projectStats(projectId) {
  const p = getProject(projectId);
  if (!p) return null;
  const byType = {};
  let done = 0, inProgress = 0, awaiting = 0;
  for (const t of p.tasks) {
    byType[t.type] = (byType[t.type] || 0) + 1;
    if (t.status === TASK_STATUS.DONE) done++;
    else if (t.status === TASK_STATUS.IN_PROGRESS) inProgress++;
    else if (t.status === TASK_STATUS.AWAITING) awaiting++;
  }
  const total = p.tasks.length;
  return {
    members: p.members.length,
    tasksTotal: total,
    done,
    inProgress,
    awaiting,
    pctComplete: total ? Math.round((done / total) * 100) : 0,
    byType,
  };
}

// Editor activity stats from the submissions they've touched.
export function editorStats(editorId) {
  let reviewed = 0, approved = 0, declined = 0, active = 0;
  for (const s of db.submissions) {
    const mine = s.reviews.filter((r) => r.editorId === editorId);
    reviewed += mine.length;
    approved += mine.filter((r) => r.decision === 'approve').length;
    declined += mine.filter((r) => r.decision !== 'approve').length;
    if (s.stage !== STAGE.PUBLISHED && s.stage !== STAGE.REJECTED &&
        (s.assignee === editorId || s.assignedReviewers.includes(editorId))) {
      active++;
    }
  }
  return { reviewed, approved, declined, active };
}

// Synchronous in-memory default so the module is usable on import (e.g. tests)
// before init() runs. Placed last so all helper consts above are initialized.
// init() replaces this with the active provider's data at server startup.
db = buildSeed();
assignPendingReviewers();
