/**
 * Synthica — Google Form -> Submissions sheet bridge (Track 3).
 *
 * The journal submission Google Form writes responses to a "Form Responses 1"
 * tab. This script copies each response into the "Submissions" tab in the shape
 * the backend expects (see backend/src/providers/sheets.js → SCHEMAS.Submissions),
 * generating a unique id and setting the paper to the "review" stage. The backend
 * then load-balances it to two reviews editors automatically.
 *
 * SETUP
 * 1. Open the Form's linked spreadsheet → Extensions → Apps Script.
 * 2. Paste this file. Edit FIELD_MAP below to match your Form's question titles.
 * 3. Run `setup` once (creates the Submissions tab + an on-submit trigger).
 * 4. Optionally run `importAllResponses` once to backfill existing responses.
 */

// Map your Form question titles (left) to backend fields (right).
// Adjust the left-hand strings to match your Form exactly.
var FIELD_MAP = {
  'Paper title': 'title',
  'Your name': 'authorName',
  'Email address': 'authorEmail', // required point of contact
  'Discord username': 'authorDiscord', // required point of contact
  'Subject classification': 'category', // must be one of the 8 categories
  'Abstract': 'abstract',
  'Link to your paper (Google Drive)': 'pdfUrl',
};

var SUBMISSIONS_TAB = 'Submissions';
var RESPONSES_TAB = 'Form Responses 1';

// Column order MUST match SCHEMAS.Submissions in the backend.
var HEADERS = [
  'id', 'title', 'authorName', 'authorEmail', 'authorDiscord', 'category', 'abstract', 'pdfUrl',
  'submittedAt', 'stage', 'assignedReviewers', 'assignee', 'reviews',
  'associateRounds', 'history',
];

function setup() {
  ensureSubmissionsTab_();
  // Create an installable on-form-submit trigger (idempotent-ish: clears dupes).
  var ss = SpreadsheetApp.getActive();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onFormSubmit') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onFormSubmit').forSpreadsheet(ss).onFormSubmit().create();
  Logger.log('Setup complete: Submissions tab ready + on-submit trigger installed.');
}

function onFormSubmit(e) {
  // e.namedValues maps question title -> [answer].
  var record = mapNamedValues_(e.namedValues);
  appendSubmission_(record);
}

function importAllResponses() {
  ensureSubmissionsTab_();
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(RESPONSES_TAB);
  if (!sheet) throw new Error('No "' + RESPONSES_TAB + '" tab found.');
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return;
  var headers = values[0];
  for (var r = 1; r < values.length; r++) {
    var named = {};
    for (var c = 0; c < headers.length; c++) named[headers[c]] = [values[r][c]];
    appendSubmission_(mapNamedValues_(named));
  }
  Logger.log('Imported ' + (values.length - 1) + ' responses.');
}

// --- helpers ---------------------------------------------------------------

function mapNamedValues_(named) {
  var rec = {};
  Object.keys(FIELD_MAP).forEach(function (question) {
    var field = FIELD_MAP[question];
    var v = named[question];
    rec[field] = v && v.length ? String(v[0]).trim() : '';
  });
  return rec;
}

function appendSubmission_(rec) {
  var sheet = ensureSubmissionsTab_();
  var id = 'paper_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  var row = [
    id,
    rec.title || '(untitled)',
    rec.authorName || '',
    rec.authorEmail || '',
    rec.authorDiscord || '',
    rec.category || '',
    rec.abstract || '',
    rec.pdfUrl || '',
    new Date().toISOString(),
    'review',        // stage
    '[]',            // assignedReviewers (backend assigns)
    '',              // assignee
    '[]',            // reviews
    0,               // associateRounds
    '[]',            // history
  ];
  sheet.appendRow(row);
}

function ensureSubmissionsTab_() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(SUBMISSIONS_TAB);
  if (!sheet) sheet = ss.insertSheet(SUBMISSIONS_TAB);
  // Write the header row if the tab is empty.
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}
