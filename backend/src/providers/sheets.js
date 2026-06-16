// Google Sheets data provider.
//
// Reads the whole dataset from a spreadsheet at startup and writes the mutable
// tabs back when data changes. It exposes the same { load, persist } shape the
// store expects, so switching DATA_PROVIDER=sheets needs no route/UI changes.
//
// Each tab's first row is a header row; the SCHEMAS below map headers <-> typed
// domain objects. Complex fields (arrays/objects) are stored as JSON strings in
// a single cell.
//
// Auth (service account): set either
//   GOOGLE_SERVICE_ACCOUNT_JSON  = the full service-account JSON (inline), or
//   GOOGLE_APPLICATION_CREDENTIALS = path to that JSON file.
// Share the spreadsheet with the service account's client_email (Editor).
// Required: SHEETS_SPREADSHEET_ID = the spreadsheet id from its URL.

import { google } from 'googleapis';

const num = (v) => (v === '' || v == null ? 0 : Number(v));
const bool = (v) => v === true || v === 'TRUE' || v === 'true';
const json = (v, fallback) => {
  if (v == null || v === '') return fallback;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};

// Column order + type per tab. `kind` drives parsing on read and encoding on write.
export const SCHEMAS = {
  Users: [
    ['id'], ['name'], ['username'], ['password'], ['kind'],
    ['role'], ['category'], ['tags', 'json'], ['email'], ['discord'], ['resumeUrl'],
    ['slug'], ['institution'], ['bio'], ['avatarUrl'], ['interests', 'json'], ['linkedinUrl'], ['websiteUrl'],
    ['links', 'json'], ['public', 'bool'], ['googleId'], ['emailVerified', 'bool'],
    ['twoFactorSecret'], ['twoFactorEnabled', 'bool'], ['following', 'json'], ['pathway', 'json'],
    ['gpa'], ['researchExperience', 'num'], ['leadRecommended', 'bool'], ['approved', 'bool'],
    ['leadershipExperience', 'num'], ['wantsChapterLead', 'bool'], ['onboardingRejected', 'bool'],
    ['blurb'], ['newRoleCongrats'], ['experienceSummary'], ['priorLead', 'bool'], ['legacyProject', 'json'],
    // Rich profile + referrals.
    ['affiliations', 'json'], ['pronouns'], ['contactEmail'], ['researchGroup'], ['researchGroupUrl'],
    ['githubUrl'], ['twitterUrl'], ['scholarUrl'], ['orcid'], ['dob'], ['dobPublic', 'bool'],
    ['referralCode'], ['referredBy'], ['createdAt'],
  ],
  Submissions: [
    ['id'], ['title'], ['authorName'], ['authorEmail'], ['authorDiscord'], ['submittedBy'], ['category'],
    ['abstract'], ['pdfUrl'], ['submittedAt'], ['stage'],
    ['assignedReviewers', 'json'], ['assignee'], ['reviews', 'json'],
    ['comments', 'json'], ['revisions', 'json'], ['revisionRequested', 'bool'],
    ['associateRounds', 'num'], ['history', 'json'], ['coAuthorIds', 'json'],
  ],
  Publications: [
    ['id'], ['doi'], ['title'], ['articleType'], ['authors', 'json'], ['authorUserId'],
    ['correspondingAuthor'], ['category'], ['abstract'], ['keywords', 'json'],
    ['receivedAt'], ['acceptedAt'], ['publishedAt'], ['volume', 'num'],
    ['issue', 'num'], ['pages'], ['pdfUrl'], ['license'], ['openAccess', 'bool'],
    ['sections', 'json'], ['metrics', 'json'], ['citationCount', 'num'],
    ['authorUserIds', 'json'], ['source'], ['verified', 'bool'], ['addedBy'], ['sourceUrl'], ['featured', 'bool'],
    ['references', 'json'],
  ],
  Projects: [
    ['id'], ['title'], ['category'], ['description'], ['leadId'],
    ['members', 'json'], ['announcements', 'json'], ['tasks', 'json'], ['links', 'json'], ['ideas', 'json'], ['invites', 'json'], ['roles', 'json'],
  ],
  Listings: [
    ['id'], ['title'], ['category'], ['spots', 'num'], ['leadName'], ['leadId'], ['description'], ['bannerUrl'], ['lookingFor'],
  ],
  Events: [
    ['id'], ['title'], ['type'], ['dueAt'], ['projectId'], ['chapterId'], ['groupId'], ['createdBy'], ['createdByName'], ['at'],
  ],
  Groups: [
    ['id'], ['name'], ['description'], ['category'], ['leaderId'], ['bannerUrl'],
    ['members', 'json'], ['projectIds', 'json'], ['positions', 'json'], ['links', 'json'], ['createdAt'],
  ],
  Competitions: [
    ['id'], ['title'], ['description'], ['url'], ['category'], ['deadline'], ['prize'], ['postedById'], ['postedByName'], ['at'],
  ],
  Posts: [
    ['id'], ['authorId'], ['text'], ['linkUrl'], ['imageUrl'], ['likes', 'json'], ['comments', 'json'], ['at'],
  ],
  Activities: [
    ['id'], ['actorId'], ['type'], ['text'], ['link'], ['at'],
  ],
  Applications: [
    ['id'], ['kind'], ['userId'], ['userName'], ['listingId'], ['programId'], ['role'], ['message'], ['answers', 'json'],
    ['resumeUrl'], ['status'], ['assignedTag'], ['reviewedBy'], ['reviewedAt'], ['at'],
  ],
  Programs: [
    ['id'], ['title'], ['cohortLabel'], ['category'], ['description'], ['spots', 'num'],
    ['applyDeadline'], ['startAt'], ['endAt'], ['status'], ['cohort', 'json'], ['milestones', 'json'],
    ['createdBy'], ['createdAt'],
  ],
  Certificates: [
    ['id'], ['code'], ['userId'], ['name'], ['type'], ['issuedAt'],
  ],
  Chapters: [
    ['id'], ['name'], ['location'], ['leaderId'], ['handbookUrl'], ['members', 'json'], ['announcements', 'json'],
  ],
  News: [
    ['id'], ['title'], ['body'], ['authorName'], ['audience'], ['bannerUrl'], ['at'],
  ],
  Audit: [
    ['id'], ['at'], ['actorId'], ['actorName'], ['action'], ['detail'],
  ],
  Notifications: [
    ['id'], ['userId'], ['type'], ['title'], ['body'], ['link'], ['read', 'bool'], ['at'],
  ],
};

// Tabs written back when the store mutates (the rest are treated as read-only config).
const WRITABLE = ['Submissions', 'Publications', 'Applications'];

function decodeRow(schema, headerRow, cells) {
  const obj = {};
  const idx = Object.fromEntries(headerRow.map((h, i) => [h, i]));
  for (const [key, kind] of schema) {
    const raw = cells[idx[key]] ?? '';
    if (kind === 'json') obj[key] = json(raw, key === 'tags' || key.endsWith('s') ? [] : {});
    else if (kind === 'num') obj[key] = num(raw);
    else if (kind === 'bool') obj[key] = bool(raw);
    else obj[key] = raw === '' ? null : raw;
  }
  return obj;
}

function encodeRows(schema, items) {
  const header = schema.map(([k]) => k);
  const rows = items.map((it) =>
    schema.map(([k, kind]) =>
      kind === 'json' ? JSON.stringify(it[k] ?? (kind === 'json' ? [] : null)) : it[k] ?? ''
    )
  );
  return [header, ...rows];
}

export async function getSheetsClient() {
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  let auth;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    auth = new google.auth.GoogleAuth({ credentials, scopes });
  } else {
    // Falls back to GOOGLE_APPLICATION_CREDENTIALS / application default creds.
    auth = new google.auth.GoogleAuth({ scopes });
  }
  return google.sheets({ version: 'v4', auth });
}

async function readTab(sheets, spreadsheetId, title) {
  const schema = SCHEMAS[title];
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${title}!A1:Z`,
  });
  const rows = res.data.values || [];
  if (rows.length < 2) return [];
  const header = rows[0];
  return rows.slice(1).filter((r) => r.length && r[0]).map((r) => decodeRow(schema, header, r));
}

export async function writeTab(sheets, spreadsheetId, title, items) {
  const values = encodeRows(SCHEMAS[title], items);
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: title });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${title}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}

export async function createSheetsProvider() {
  const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('SHEETS_SPREADSHEET_ID is required when DATA_PROVIDER=sheets');
  }
  const sheets = await getSheetsClient();

  return {
    name: 'sheets',
    spreadsheetId,
    sheets,

    async load() {
      const users = await readTab(sheets, spreadsheetId, 'Users');
      return {
        editors: users.filter((u) => u.kind === 'editor'),
        researchers: users.filter((u) => u.kind === 'researcher'),
        submissions: await readTab(sheets, spreadsheetId, 'Submissions'),
        publications: await readTab(sheets, spreadsheetId, 'Publications'),
        projects: await readTab(sheets, spreadsheetId, 'Projects'),
        listings: await readTab(sheets, spreadsheetId, 'Listings'),
        applications: await readTab(sheets, spreadsheetId, 'Applications'),
        chapters: await readTab(sheets, spreadsheetId, 'Chapters'),
        news: await readTab(sheets, spreadsheetId, 'News'),
        audit: await readTab(sheets, spreadsheetId, 'Audit'),
        notifications: await readTab(sheets, spreadsheetId, 'Notifications'),
        // Tolerate spreadsheets created before these tabs existed.
        events: await readTab(sheets, spreadsheetId, 'Events').catch(() => []),
        programs: await readTab(sheets, spreadsheetId, 'Programs').catch(() => []),
        certificates: await readTab(sheets, spreadsheetId, 'Certificates').catch(() => []),
        groups: await readTab(sheets, spreadsheetId, 'Groups').catch(() => []),
        competitions: await readTab(sheets, spreadsheetId, 'Competitions').catch(() => []),
        posts: await readTab(sheets, spreadsheetId, 'Posts').catch(() => []),
        activities: await readTab(sheets, spreadsheetId, 'Activities').catch(() => []),
      };
    },

    // Write back the tabs that the app mutates.
    async persist(db) {
      await writeTab(sheets, spreadsheetId, 'Users', [...db.editors, ...db.researchers]);
      await writeTab(sheets, spreadsheetId, 'Submissions', db.submissions);
      await writeTab(sheets, spreadsheetId, 'Publications', db.publications);
      await writeTab(sheets, spreadsheetId, 'Projects', db.projects);
      await writeTab(sheets, spreadsheetId, 'Applications', db.applications);
      await writeTab(sheets, spreadsheetId, 'Chapters', db.chapters);
      await writeTab(sheets, spreadsheetId, 'News', db.news);
      await writeTab(sheets, spreadsheetId, 'Audit', db.audit);
      await writeTab(sheets, spreadsheetId, 'Notifications', db.notifications);
      await writeTab(sheets, spreadsheetId, 'Events', db.events || []);
      // Best-effort: deployments created before these tabs existed keep working.
      await writeTab(sheets, spreadsheetId, 'Programs', db.programs || []).catch(() => {});
      await writeTab(sheets, spreadsheetId, 'Certificates', db.certificates || []).catch(() => {});
      await writeTab(sheets, spreadsheetId, 'Groups', db.groups || []).catch(() => {});
      await writeTab(sheets, spreadsheetId, 'Competitions', db.competitions || []).catch(() => {});
      await writeTab(sheets, spreadsheetId, 'Posts', db.posts || []).catch(() => {});
      await writeTab(sheets, spreadsheetId, 'Activities', db.activities || []).catch(() => {});
    },
  };
}
