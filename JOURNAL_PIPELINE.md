# Synthica Journal Editorial Dashboard — CONTEXT

## 1. Overview

This project is an **internal editorial workflow dashboard** for a scientific journal. It ingests new paper submissions from a Google Sheet, distributes them across multiple tiers of editors based on subject category, and walks each paper through a structured review pipeline ending at the Director, who handles publication and outbound emails.

The entire system is built on **Google Apps Script** (server-side `.gs` files + HTML/CSS/JS frontend served via `HtmlService`). All persistent data lives in **Google Sheets**, and paper files live in **Google Drive**.

---

## 2. Tech Stack

| Layer            | Tool                                                              |
| ---------------- | ----------------------------------------------------------------- |
| Backend          | Google Apps Script (`.gs`)                                        |
| Data store       | Google Sheets (multiple sheets/tabs)                              |
| File store       | Google Drive (PDF links inside submissions)                       |
| Frontend         | HTML + CSS + vanilla JS served by `HtmlService.createTemplate()`  |
| Auth             | Custom auth against a `Users` sheet (no Google OAuth dependency)  |
| Sessions         | `PropertiesService.getUserProperties()` or signed session tokens  |
| Triggers         | Time-based trigger (every N minutes) polling the submissions tab  |

---

## 3. Roles (Editor Tiers)

There are **5 roles** in the system. Each editor (except Chief and Director) belongs to **exactly one subject category**.

1. **Reviews Editor** — first-pass screening. 2 of them review each paper.
2. **Associate Editor** — works directly with the author across 2 revision rounds.
3. **Senior Editor** — does a quality check both *before* the Associate stage and *after* it (final pre-Chief check).
4. **Chief Editor** (a.k.a. Editor-in-Chief) — final scientific sign-off.
5. **Director** — handles outbound author emails and publication.

> Chief Editor and Director are **not** scoped to a category — they see everything.

---

## 4. Subject Categories

Every paper and every category-scoped editor is tagged with exactly one of:

- Biology
- Chemistry
- Physics
- Mathematics
- Computer Science
- Humanities
- Economics
- Psychology

A submission's `category` field determines which editors are eligible to receive it.

---

## 5. Editorial Workflow (End-to-End)

```
                ┌─────────────────────┐
                │  Submission Sheet   │  (filled by external form)
                └──────────┬──────────┘
                           │  poll trigger
                           ▼
              ┌─────────────────────────┐
              │ Assign paperId + route  │
              └──────────┬──────────────┘
                         │
                         ▼
       ┌──────────────────────────────────────┐
       │  2 Reviews Editors  (same category)  │
       │  Each: Approve/Reject + feedback     │
       │  (recommendation required iff Approve)│
       └──────────┬───────────────────────────┘
                  │
       ┌──────────┴───────────┐
       │ Both Approve         │ Any Reject / mixed
       ▼                      ▼
 Senior Editor (1)      Director (Papers to email — DECLINED)
       │
       │  Approve + feedback (no recommendation needed)
       │  (Director also notified of decision)
       ▼
 Associate Editor (same category)
   - sees author email
   - sees all prior feedback
   - tracks rounds 1/2 → marks Finished
       │
       ▼
 Senior Editor (2)  — final check
   - sees author email + all prior feedback
   - Approve / Reject
   - (Director notified)
       │  Approve
       ▼
 Chief Editor (Editor-in-Chief)
   - sees full history
   - Approve / Reject
       │  Approve
       ▼
 Director — Papers to publish
```

Notes on routing semantics:

- **Reviews stage consensus rule:** the paper only advances if *both* Reviews Editors approve. Any other combination → status `DECLINED_AT_REVIEWS`.
- **Mirror to Director at every decision point:** every Approve and every Reject across all stages also creates/updates a row in the Director's "Papers to email" view, tagged with the stage at which the decision happened (e.g. `Reviewed by Reviews Editor`, `Reviewed by Senior Editor`, `Reviewed by Chief Editor`).
- **Archive behavior:** after a Reviews Editor (or any editor) completes their decision on a paper, that paper moves out of their active queue into their personal History/Archive view.
- **Live peer visibility at Reviews stage:** if Reviews Editor A submits before Reviews Editor B, then when B opens the paper they must see A's decision (Approved/Rejected) and feedback already filled in on the paper card.

---

## 6. Data Model (Google Sheets layout)

All data lives in **one spreadsheet** with multiple tabs. Column names are authoritative — they are referenced by name in code.

### 6.1 Tab: `Submissions` (raw inbox from the form)

| Column           | Type    | Notes                                                 |
| ---------------- | ------- | ----------------------------------------------------- |
| timestamp        | Date    | Auto from form                                        |
| title            | String  |                                                       |
| abstract         | String  |                                                       |
| authorName       | String  |                                                       |
| authorEmail      | String  | Used by Associate / final-Senior stages               |
| category         | Enum    | One of the 8 categories                               |
| pdfDriveLink     | URL     | Google Drive link to the paper PDF                    |
| processed        | Boolean | Set to TRUE once router has picked it up              |

### 6.2 Tab: `Papers` (master state table — source of truth)

| Column                | Type      | Notes                                                        |
| --------------------- | --------- | ------------------------------------------------------------ |
| paperId               | String    | Auto-generated, unique (e.g. `SYN-2026-000123`)              |
| title                 | String    |                                                              |
| abstract              | String    |                                                              |
| authorName            | String    |                                                              |
| authorEmail           | String    |                                                              |
| category              | Enum      |                                                              |
| pdfDriveLink          | URL       |                                                              |
| status                | Enum      | See §6.3                                                     |
| reviewsEditor1        | username  | Assigned Reviews Editor A                                    |
| reviewsEditor2        | username  | Assigned Reviews Editor B                                    |
| reviewsEditor1Decision| Enum      | `PENDING` / `APPROVED` / `REJECTED`                          |
| reviewsEditor2Decision| Enum      | `PENDING` / `APPROVED` / `REJECTED`                          |
| reviewsEditor1Feedback| String    |                                                              |
| reviewsEditor2Feedback| String    |                                                              |
| reviewsEditor1Rec     | String    | Recommendation, only set when Approved                       |
| reviewsEditor2Rec     | String    | Recommendation, only set when Approved                       |
| seniorEditor1         | username  | Senior Editor for pre-Associate review                       |
| seniorEditor1Decision | Enum      | `PENDING` / `APPROVED` / `REJECTED`                          |
| seniorEditor1Feedback | String    |                                                              |
| associateEditor       | username  | Assigned Associate                                           |
| associateRoundsDone   | Integer   | 0 / 1 / 2                                                    |
| associateFinished     | Boolean   | TRUE when 2 rounds complete                                  |
| associateFeedback     | String    | Aggregate feedback from Associate                            |
| seniorEditor2         | username  | Senior Editor for post-Associate final check                 |
| seniorEditor2Decision | Enum      | `PENDING` / `APPROVED` / `REJECTED`                          |
| seniorEditor2Feedback | String    |                                                              |
| chiefDecision         | Enum      | `PENDING` / `APPROVED` / `REJECTED`                          |
| chiefFeedback         | String    |                                                              |
| createdAt             | Date      |                                                              |
| updatedAt             | Date      |                                                              |

### 6.3 Status enum (lifecycle states for `Papers.status`)

- `AWAITING_REVIEWS`           — at least one Reviews Editor still pending
- `DECLINED_AT_REVIEWS`        — sent to Director (email)
- `AWAITING_SENIOR_1`          — both Reviews approved
- `DECLINED_AT_SENIOR_1`       — sent to Director (email)
- `AWAITING_ASSOCIATE`         — Senior 1 approved
- `IN_ASSOCIATE_ROUND_1`
- `IN_ASSOCIATE_ROUND_2`
- `AWAITING_SENIOR_2`          — Associate finished
- `DECLINED_AT_SENIOR_2`       — sent to Director (email)
- `AWAITING_CHIEF`             — Senior 2 approved
- `DECLINED_AT_CHIEF`          — sent to Director (email)
- `READY_TO_PUBLISH`           — Chief approved → Director "Papers to publish"
- `PUBLISHED`                  — Director marked it published

### 6.4 Tab: `Users` (auth + role registry)

| Column        | Type        | Notes                                                             |
| ------------- | ----------- | ----------------------------------------------------------------- |
| username      | String      | Unique, used as foreign key in `Papers` columns                   |
| passwordHash  | String      | SHA-256 (or PBKDF2) hex digest — never store plaintext            |
| salt          | String      | Per-user random salt                                              |
| role          | Enum        | `REVIEWS` / `ASSOCIATE` / `SENIOR` / `CHIEF` / `DIRECTOR`         |
| category      | Enum / null | Required for REVIEWS / ASSOCIATE / SENIOR; null for CHIEF/DIRECTOR|
| displayName   | String      |                                                                   |
| active        | Boolean     |                                                                   |

> The user said "username, role, and password" — we expand `password` into `passwordHash` + `salt` for safety. The sheet still has a single password column from the admin's perspective; the hashing happens on first login or via an admin tool.

### 6.5 Tab: `DirectorQueue` (denormalized convenience view for the Director)

| Column      | Type   | Notes                                                       |
| ----------- | ------ | ----------------------------------------------------------- |
| paperId     | String |                                                             |
| title       | String |                                                             |
| authorEmail | String |                                                             |
| stage       | String | Human-readable, e.g. `Reviewed by Senior Editor (final)`    |
| decision    | Enum   | `APPROVED` / `REJECTED` / `READY_TO_PUBLISH`                |
| section     | Enum   | `EMAIL` / `PUBLISH`                                         |
| emailedAt   | Date   | Filled by Director after sending email                      |
| publishedAt | Date   | Filled by Director after publishing                         |

### 6.6 Tab: `AuditLog`

Append-only log of every state transition: `{timestamp, paperId, actor, fromStatus, toStatus, note}`. Used for traceability and for showing each editor the previous feedback chain on a paper.

---

## 7. Assignment Algorithm (Load Balancing)

Goal: distribute papers fairly so no single editor gets disproportionally more work than peers in the same role + category.

Algorithm (used at every assignment point — Reviews, Associate, both Senior stages):

1. Filter `Users` by `role` and `category` and `active = TRUE`.
2. For each candidate, compute `activeLoad = count(papers where this editor is currently the active assignee at this stage AND status is not terminal-for-them)`.
3. Sort ascending by `activeLoad`, break ties by `lastAssignedAt` (oldest first), then random.
4. For Reviews stage: pick the **top 2 distinct** editors. (If fewer than 2 are available, surface an error and don't auto-assign.)
5. For all other stages: pick the top 1.
6. Persist the assignment + bump `lastAssignedAt` atomically using `LockService.getScriptLock()`.

---

## 8. Authentication & Session Handling

- The web app's entry point (`doGet`) checks for a valid session token in `PropertiesService.getUserProperties()`.
- If no session, render `Login.html`. The login form POSTs username + password → server hashes with the user's salt → compares against `Users.passwordHash`. On success, mint a session token and store `{username, role, category, exp}`.
- All subsequent server calls (`google.script.run`) re-resolve the session from properties; never trust client-supplied role.
- A `Logout` action wipes the session.
- Role-based routing on the server: each `getDashboardFor<Role>()` function returns 403 if the caller's role mismatches.

---

## 9. UI / Views

One single-page-app per role. All share a top bar (logo, role, displayName, category, logout) and a content area.

### 9.1 Reviews Editor Dashboard

- **Active queue** (left list): papers currently `AWAITING_REVIEWS` where the user is `reviewsEditor1` or `reviewsEditor2` and their own decision is `PENDING`.
- **History** (tab): papers where this user has submitted a decision.
- **See more** view (modal or detail pane), shows:
  - Title, abstract, authorName (NOT authorEmail at this stage), category, paperId.
  - PDF preview / "Open PDF" link to the Drive URL.
  - The **other** Reviews Editor's decision + feedback + recommendation, if already submitted (otherwise "Pending").
  - Form: feedback textarea + Approve/Reject radio + recommendation textarea (only enabled and required if Approve is selected). Submit button is disabled until validation passes.

### 9.2 Senior Editor Dashboard (pre-Associate, "Senior 1")

- Active queue: papers in `AWAITING_SENIOR_1` assigned to this user.
- See more view: same as Reviews but additionally shows both Reviews Editors' decisions, feedback, and recommendations. No recommendation field for the Senior. Approve/Reject + feedback only.

### 9.3 Associate Editor Dashboard

- Active queue: papers in `AWAITING_ASSOCIATE` / `IN_ASSOCIATE_ROUND_1` / `IN_ASSOCIATE_ROUND_2` assigned to this user.
- See more view: shows authorEmail, full feedback history (Reviews + Senior 1), and a "Round counter" widget. The Associate can click `Complete Round` — increments `associateRoundsDone`. When it reaches 2, a `Mark Finished` button becomes available which sets `associateFinished = TRUE` and pushes the paper to Senior 2.
- No Approve/Reject at this stage — it is a collaboration stage, not a gate.

### 9.4 Senior Editor Dashboard (post-Associate, "Senior 2")

- Active queue: papers in `AWAITING_SENIOR_2` assigned to this user.
- See more view: shows authorEmail + full feedback chain (Reviews 1, Reviews 2, Senior 1, Associate). Approve/Reject + feedback only.

### 9.5 Chief Editor Dashboard

- Active queue: papers in `AWAITING_CHIEF`, all categories.
- See more view: full history shown. Approve/Reject + feedback.

### 9.6 Director Dashboard

Two clearly-separated sections:

1. **Papers to email** — every paper with a decision (approved at intermediate stage or rejected at any stage). Each row shows `paperId, title, authorEmail, stage label, decision`. Each row has a `Mark emailed` action that timestamps `emailedAt`. Filter by stage.
2. **Papers to publish** — papers with `status = READY_TO_PUBLISH`. Each row shows full metadata and a `Mark published` action that sets `status = PUBLISHED` and timestamps `publishedAt`.

---

## 10. Paper ID Format

`SYN-YYYY-NNNNNN`

- `SYN` = Synthica prefix.
- `YYYY` = year of submission.
- `NNNNNN` = zero-padded incrementing counter, globally unique across years (stored in `ScriptProperties.lastPaperCounter`, incremented under a lock).

Example: `SYN-2026-000042`.

---

## 11. Triggers

- **`onSubmissionPoll`** — time-based trigger, every 5 minutes. Reads new rows in `Submissions` where `processed = FALSE`, allocates `paperId`, runs the load-balancing assignment for Reviews stage, inserts a row in `Papers`, marks `processed = TRUE`.
- **`onEdit`** is NOT used — all state changes go through server functions called from the UI to keep transactions tight.

---

## 12. Non-Functional Requirements

- **Fair distribution:** load-balancing algorithm (§7) is mandatory at every assignment.
- **Atomicity:** every multi-row update uses `LockService.getScriptLock()` with a sensible timeout (e.g. 10s) to prevent race conditions when two editors click Submit simultaneously.
- **Auditability:** every decision writes to `AuditLog`.
- **Security:** passwords hashed + salted; session tokens stored only server-side in user properties; no role information trusted from the client.
- **Idempotency:** submitting a decision twice for the same paperId by the same editor is rejected.
- **Validation:** feedback required on every decision; recommendation required iff `decision = APPROVED` at the Reviews stage.
- **UX:** the Submit button must be disabled until validation passes. Approving/Rejecting shows an optimistic UI confirmation.

---

## 13. Out of Scope (for v1)

- Sending the actual emails (Director still does this manually outside the dashboard — the dashboard just queues them).
- Author-facing portal (authors interact only via the original submission form and direct email from the Associate / Director).
- Editing already-submitted decisions (an Undo flow can be added in v2).
- Mobile-optimized layout (desktop-first; should be usable on tablets).

---

## 14. Glossary

- **Paper** — a single submission progressing through the pipeline.
- **Active queue** — the list a given editor must act on right now.
- **History** — past decisions made by a given editor, read-only.
- **Stage** — one of the 5 review stages: Reviews, Senior 1, Associate, Senior 2, Chief.
- **Director queue** — denormalized list the Director uses for emails and publishing.
