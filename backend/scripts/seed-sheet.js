// One-off: populate a Google Spreadsheet with the seed data so you can try the
// Sheets-backed backend immediately. Creates any missing tabs, then writes
// headers + rows for every tab.
//
// Usage:
//   SHEETS_SPREADSHEET_ID=... GOOGLE_SERVICE_ACCOUNT_JSON='{...}' \
//     npm run seed:sheet
//
// (Share the spreadsheet with the service account's client_email as Editor.)

import { getSheetsClient, writeTab, SCHEMAS } from '../src/providers/sheets.js';
import * as seed from '../src/seed.js';

async function ensureTabs(sheets, spreadsheetId, titles) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Set(meta.data.sheets.map((s) => s.properties.title));
  const toAdd = titles.filter((t) => !existing.has(t));
  if (toAdd.length === 0) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: toAdd.map((title) => ({ addSheet: { properties: { title } } })),
    },
  });
  console.log(`Created tabs: ${toAdd.join(', ')}`);
}

async function main() {
  const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error('Set SHEETS_SPREADSHEET_ID');

  const sheets = await getSheetsClient();
  const tabs = Object.keys(SCHEMAS); // Users, Submissions, Publications, Projects, Listings, Applications
  await ensureTabs(sheets, spreadsheetId, tabs);

  const users = [...seed.editors, ...seed.researchers];

  await writeTab(sheets, spreadsheetId, 'Users', users);
  await writeTab(sheets, spreadsheetId, 'Submissions', seed.submissions);
  await writeTab(sheets, spreadsheetId, 'Publications', seed.publications);
  await writeTab(sheets, spreadsheetId, 'Projects', seed.projects);
  await writeTab(sheets, spreadsheetId, 'Listings', seed.listings);
  await writeTab(sheets, spreadsheetId, 'Applications', seed.applications);
  await writeTab(sheets, spreadsheetId, 'Chapters', seed.chapters);
  await writeTab(sheets, spreadsheetId, 'News', seed.news);
  await writeTab(sheets, spreadsheetId, 'Audit', seed.audit);
  await writeTab(sheets, spreadsheetId, 'Notifications', seed.notifications);
  await writeTab(sheets, spreadsheetId, 'Events', seed.events || []);

  console.log(`Seeded ${users.length} users, ${seed.submissions.length} submissions, ` +
    `${seed.publications.length} publications, ${seed.projects.length} projects, ` +
    `${seed.listings.length} listings into ${spreadsheetId}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
