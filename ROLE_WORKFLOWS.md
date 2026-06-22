# Synthica Dashboard — Role Workflows

## 1. Overview

The Synthica dashboard is a multi-portal platform for high-school and early-career researchers. Users move through **researcher roles** (tags on a member account) and, separately, **editorial roles** (journal review pipeline). A single person may hold multiple researcher tags at once — for example, Lead Researcher and Chapter Leader.

Every signed-in member gets a **Member portal** (community feed, messages, people, calendar, drive). Additional workspaces unlock based on assigned tags. A **Director** account can switch into every workspace to oversee the full platform.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Synthica Dashboard                              │
├──────────────────────────────┬──────────────────────────────────────────┤
│     Researcher portal        │           Editorial portal               │
│  (/researcher)               │           (/editor)                      │
│                              │                                          │
│  • Associate Researcher      │  • Reviews / Senior / Associate / Chief  │
│  • Lead Researcher           │  • Director desk (publish & email)       │
│  • Independent Researcher    │                                          │
│  • Chapter Leader            │  See JOURNAL_PIPELINE.md for full spec    │
│  • Expertise Mentor          │                                          │
├──────────────────────────────┴──────────────────────────────────────────┤
│  Platform oversight: Director · Moderator (application review)          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Role Model

### 2.1 Researcher tags

Researcher capabilities are expressed as **tags** on a member account. Tags are not mutually exclusive unless noted.

| Tag | Label | Default? | How obtained |
| --- | --- | --- | --- |
| `associate_researcher` | Associate Researcher | **Yes** — every new member | Assigned on onboarding approval |
| `lead_researcher` | Lead Researcher | No | Apply → Moderator approves |
| `independent_researcher` | Independent Researcher | No | Apply → Moderator approves |
| `chapter_leader` | Chapter Leader | No | Apply → Moderator approves |
| `expertise_mentor` | Expertise Mentor | No | Assigned by platform staff |

### 2.2 Editorial roles

Editorial roles are separate editor accounts used for the journal pipeline. They do not overlap with researcher tags.

| Role | Scope |
| --- | --- |
| Reviews Editor | First-pass screening (2 per paper, same category) |
| Associate Editor | Author collaboration across 2 revision rounds |
| Senior Editor | Pre- and post-Associate quality checks |
| Chief Editor | Final scientific sign-off |
| Director | Publication, author emails, full platform oversight |

> Full editorial workflow, data model, and UI views: **[JOURNAL_PIPELINE.md](./JOURNAL_PIPELINE.md)**

### 2.3 Platform oversight roles

| Role | Responsibility |
| --- | --- |
| **Moderator** | Reviews and approves membership applications for Lead Researcher, Independent Researcher, and Chapter Leader; assigns starting roles to new sign-ups |
| **Director** | Full visibility across researcher and editorial workspaces; platform admin, analytics, integrations, and broadcast tools |

---

## 3. Onboarding & Applications

### 3.1 New member flow

1. User registers and completes a short profile (school, experience, interests).
2. Account enters a **pending approval** state until a Moderator reviews it.
3. Moderator assigns a starting tag — typically **Associate Researcher**.
4. Member gains access to the hub, research groups listing, and community features.

### 3.2 Role upgrade applications

Members apply for advanced roles through the **Application Hub** (`Explore → Apply for a role`). Each role has a structured form (name, school, research background, role-specific essays).

| Applied role | Reviewed by | On approval |
| --- | --- | --- |
| Lead Researcher | Moderator | `lead_researcher` tag added; Lead workspace unlocked |
| Independent Researcher | Moderator | `independent_researcher` tag added; independent project flow unlocked |
| Chapter Leader | Moderator | `chapter_leader` tag added; chapter management unlocked |

Moderators see a queue of pending applications with the applicant's profile, form answers, and recommended role. They approve or reject; approved applicants receive a notification and any role-specific certificate.

---

## 4. Associate Researcher

**Associate Researcher is the baseline role.** Every user is assigned this tag after onboarding unless explicitly given a different starting role.

### 4.1 What they can do

- Browse the **Research Hub** — the public forum of open project listings posted by Lead Researchers.
- Browse the **Research Groups** page and view group profiles.
- **Apply** to join a project listing or a research group.
- Access community features: feed, messages, people directory, calendar, drive, journal tools.
- View **My Projects** — all projects they are a member of (not leading).

### 4.2 How they join a project

Two paths:

1. **Research Hub listing** — find an open project, click Apply. The Lead Researcher receives the application and accepts or rejects it.
2. **Direct invite** — a Lead Researcher invites them by email from inside a project.

Application behavior depends on the Lead Researcher's **custom application** setting (see §5.4).

---

## 5. Lead Researcher

Lead Researchers run research teams. They create projects, recruit associates, and optionally organize work inside research groups.

### 5.1 Lead workspace

When the `lead_researcher` tag is present, a dedicated **Lead workspace** appears in the view switcher with:

| Page | Purpose |
| --- | --- |
| Lead hub | Overview of listings, applicants, and quick actions |
| Projects | All projects the lead owns or participates in |
| Groups | Research groups the lead founded or joined |
| Explore | Application hub, competitions, programs |

### 5.2 Creating a research project

When a Lead Researcher creates a project:

1. They provide a **title**, **category** (Biology, Chemistry, Physics, etc.), and **description / project brief**.
2. The project is linked to a **listing** on the Research Hub so Associate Researchers can discover and apply.
3. The Lead manages the project from a **classroom-style project page**.

### 5.3 Project page — required components

Each project should expose everything a team needs to collaborate:

| Section | Contents |
| --- | --- |
| **Project brief** | Title, category, description, status |
| **Links** | GitHub repo URL, Google Drive, literature, datasets — any external resources |
| **Calendar** | Project-scoped events and deadlines |
| **Team roster** | Member list with names, contact info, and per-member **roles** (e.g. Data Lead, Writer) |
| **Tasks** | Assignable to-do items with due dates, status, and approval workflow |
| **Announcements** | Lead-posted updates visible to all members |
| **Ideas board** | Shared brainstorming space |
| **Invites** | Lead can invite new members by email |

Lead-only controls: assign tasks, post announcements, edit member roles, invite people, review applicants.

### 5.4 Custom application mode (Associate Researcher recruitment)

Each Lead Researcher can toggle **custom application** for their project listings:

| Mode | Applicant experience | Lead experience |
| --- | --- | --- |
| **Off (default)** | Applicant clicks Apply with a short message; their **current profile** (name, résumé, school, experience) is sent automatically | Lead sees application with profile snapshot; accept or reject |
| **On** | Applicant must also answer **additional questions** defined by the Lead (free-text or structured fields) | Lead sees profile + custom answers; accept or reject |

Leads configure custom questions when creating or editing a listing. Questions are per-listing, not global.

### 5.5 Research groups

A Lead Researcher can create a **research group** — a container for one or more related projects under a shared identity (name, logo, banner, description).

```
Research Group
├── Group profile (public page on Research Groups listing)
├── Open positions (e.g. "Data Lead", "Outreach")
├── Shared links & resources
├── Group-scoped calendar events
└── Projects
    ├── Project A
    ├── Project B
    └── …
```

- Groups appear on the **Research Groups** page (`/researcher/groups`).
- Members can join a group independently of any single project.
- The group founder (Lead Researcher) manages branding, positions, links, and which projects belong to the group.
- Only the group leader can edit group settings.

### 5.6 Listing lifecycle

1. Lead creates a project → listing auto-published to Research Hub.
2. Associates apply → Lead reviews in **My listings** or **My Projects → Applicants**.
3. On accept, applicant is added to the project team and listing spot count updates.
4. Lead can edit listing details or **close** the listing (pending applicants are notified).

---

## 6. Independent Researcher

Independent Researchers work on **solo or self-directed projects** that require platform approval before active work begins.

### 6.1 My Projects (all users)

Every member has a **My Projects** page showing:

- Projects they **lead**
- Projects they are a **member** of
- Project status, member count, and task progress

### 6.2 Independent Researcher flow

1. Member applies for the Independent Researcher role via Application Hub → Moderator approves.
2. On **My Projects**, an **Add a project** button appears (Independent Researchers only).
3. Member submits a **research proposal** (title, category, description, intended methodology).
4. Proposal enters a **pending approval** queue reviewed by a Moderator (or designated reviewer).
5. **On approval** — project is created and the member can begin work (tasks, calendar, links, etc.).
6. **On rejection** — member receives feedback and can revise and resubmit.

Independent projects are **not** automatically listed on the Research Hub for associate recruitment unless the researcher later upgrades to Lead Researcher or explicitly opens the project for collaborators.

### 6.3 Resources

Independent Researchers receive curated resources (research methods course, paper-reading guides, journal submission guide) and track progress through **Pathways** — a personal checklist from research question to draft.

---

## 7. Expertise Mentor

Expertise Mentors are subject-matter advisors whom researchers can book for one-on-one calls.

### 7.1 Mentor responsibilities

- Maintain an up-to-date **profile** with specialty areas (e.g. Biology · Statistics · Python).
- Set **availability** windows on the platform (day/time slots).
- Connect **Google Calendar** so bookings sync and conflicts are prevented.
- Receive booking notifications and join calls via the provided meeting link.

### 7.2 Researcher-facing mentors page

A dedicated **Mentors** page (separate from the general People directory) lets any researcher:

1. Browse the list of available mentors filtered by specialty.
2. Click a mentor to see their bio, areas of expertise, and open time slots.
3. **Book a call** — similar to Calendly: pick a slot, optionally add a note, confirm.
4. Receive a calendar invite and reminder before the session.

### 7.3 Booking flow

```
Researcher opens Mentors page
        │
        ▼
Select mentor → view specialty + availability
        │
        ▼
Pick a time slot → add optional note → confirm
        │
        ├──▶ Google Calendar event created (both parties)
        ├──▶ In-app notification to mentor
        └──▶ Confirmation email to researcher
```

Mentors can cancel or reschedule from their dashboard; researchers see updated status on their calendar.

---

## 8. Chapter Leader

Chapter Leaders run **local Synthica chapters** — private communities for a school, city, or region. Management is modeled after **Google Classroom**.

### 8.1 Chapter structure

| Element | Description |
| --- | --- |
| Chapter name & location | Public-facing identity |
| Handbook link | Optional URL to chapter guidelines |
| **Join code** | Unique **8-character code** required to join — chapters are private |
| Member roster | Names, emails, onboarding progress, active projects |
| Announcements | Posted to chapter feed + member notifications |
| Onboarding checklist | Per-member steps (profile, first project, etc.) with completion % |

### 8.2 Joining a chapter

1. Chapter Leader shares the **8-character join code** with prospective members (in person, email, etc.).
2. Member enters the code in the dashboard → added to the chapter roster.
3. Member receives an onboarding checklist and chapter-scoped feed content.

> Chapters are **not** publicly discoverable. There is no open "apply to join" flow — membership is code-gated only.

### 8.3 Chapter Leader tools

- **Member management** — view roster, onboarding progress, and each member's active projects.
- **Onboard a member** — add by email (links existing account or creates a new one).
- **Post announcements** — broadcast to all chapter members (feed + notification).
- **Stats dashboard** — member count, fully-onboarded count, average onboarding %, active projects.

### 8.4 Classroom-like management

| Classroom concept | Chapter equivalent |
| --- | --- |
| Class roster | Chapter member list with contact info |
| Assignments | Onboarding checklist steps |
| Announcements | Chapter announcements |
| Progress tracking | Per-member onboarding % |
| Private class code | 8-character join code |

---

## 9. Moderator

Moderators (platform **Auditor** role in the admin console) are the gatekeepers for membership and role upgrades.

### 9.1 Responsibilities

| Queue | Action |
| --- | --- |
| **New member onboarding** | Review sign-up profile → assign starting tag (usually Associate Researcher) or reject |
| **Lead Researcher applications** | Review research plan and background → approve or reject |
| **Independent Researcher applications** | Review independent research intent → approve or reject |
| **Chapter Leader applications** | Review leadership intent and location → approve or reject |
| **Independent project proposals** | Review submitted research proposals → approve or reject project creation |

### 9.2 Moderator workflow

```
Application submitted
        │
        ▼
Moderator opens Admin → Applications queue
        │
        ├── Review applicant profile + form answers
        ├── See system-recommended role (optional hint)
        │
        ▼
   Approve ──▶ Tag assigned · notification sent · certificate unlocked (if applicable)
        │
   Reject  ──▶ Applicant notified with reason
```

Moderators can also re-assign researcher tags on existing accounts and verify self-archived papers before they appear in the public archive.

---

## 10. Director

The Director is the top-level platform operator with **every view available** in the workspace switcher.

### 10.1 Researcher-side visibility

- Member portal, Lead workspace, Chapter Leader workspace (when applicable)
- Archive, admin analytics, people management

### 10.2 Editorial-side visibility

- Review queue (if also assigned an editor role)
- **Director desk** — papers to email and papers to publish
- **Admin console** — platform settings, integrations, backup, broadcast email, program management

### 10.3 Director desk (journal)

Two sections (see [JOURNAL_PIPELINE.md §9.6](./JOURNAL_PIPELINE.md#96-director-dashboard)):

1. **Papers to email** — every approve/reject decision across all review stages; Director sends outbound author emails and marks rows as emailed.
2. **Papers to publish** — Chief-approved papers ready for publication; Director marks published and triggers DOI assignment.

---

## 11. Editorial Team

The editorial team operates a separate portal at `/editor` with its own role hierarchy and review pipeline. It is **not** part of the researcher tag system.

### 11.1 Pipeline summary

```
Submission (Google Form → Sheet)
   └─▶ 2 Reviews Editors (category-matched, load-balanced)
         ├─ both approve ──▶ Senior Editor (screening)
         │                      └─ approve ──▶ Associate Editor (2 revision rounds)
         │                                        └─ done ──▶ Senior Editor (final)
         │                                                      └─ approve ──▶ Chief Editor
         │                                                                       └─ approve ──▶ Director: publish
         └─ not both approve ──▶ declined → Director emails author
```

Every decision (approve or reject) at every stage also mirrors to the Director's email queue.

### 11.2 Where to read more

| Topic | Location |
| --- | --- |
| Full pipeline diagram & routing rules | [JOURNAL_PIPELINE.md §5](./JOURNAL_PIPELINE.md#5-editorial-workflow-end-to-end) |
| Roles & categories | [JOURNAL_PIPELINE.md §3–4](./JOURNAL_PIPELINE.md#3-roles-editor-tiers) |
| Data model (Sheets tabs) | [JOURNAL_PIPELINE.md §6](./JOURNAL_PIPELINE.md#6-data-model-google-sheets-layout) |
| Load balancing | [JOURNAL_PIPELINE.md §7](./JOURNAL_PIPELINE.md#7-assignment-algorithm-load-balancing) |
| Per-role UI views | [JOURNAL_PIPELINE.md §9](./JOURNAL_PIPELINE.md#9-ui--views) |

---

## 12. Cross-Cutting Features

Features available across multiple roles:

| Feature | Who uses it |
| --- | --- |
| **My Projects** | All members — view projects led or joined |
| **Research Hub** | Associates browse; Leads post listings |
| **Research Groups** | Leads create; all members browse and join |
| **Calendar** | Project, group, and chapter events; mentor bookings |
| **Drive** | Personal file storage |
| **Messages & Feed** | Community-wide and scoped (chapter, project) |
| **People directory** | Find and follow other members |
| **Pathways** | Personal research progress checklist |
| **Certificates** | Role-based certificates (Lead, Chapter Leader, etc.) |
| **Archive** | Browse published Synthica journal papers |
| **View switcher** | Switch between available workspaces (top-right menu) |

---

## 13. End-to-End Scenarios

### 13.1 Associate joins a Lead's project

```
Associate browses Research Hub
   → finds listing → Apply (profile-only or custom questions)
   → Lead reviews in My listings → Accept
   → Associate added to project team
   → Associate sees project in My Projects
```

### 13.2 Independent researcher starts solo work

```
Member applies for Independent Researcher → Moderator approves
   → My Projects → Add a project → submit proposal
   → Moderator approves proposal
   → Project created → member works through Pathways + project tools
```

### 13.3 Researcher books a mentor call

```
Researcher opens Mentors page → filters by specialty
   → selects mentor → picks open slot → confirms
   → Google Calendar event created → both parties notified
```

### 13.4 Student joins a local chapter

```
Chapter Leader shares 8-char code
   → student enters code in dashboard
   → added to chapter → onboarding checklist assigned
   → chapter feed and announcements visible
```

### 13.5 Paper published in Synthica Journal

```
Author submits via external form
   → editorial pipeline (Reviews → Senior → Associate → Senior → Chief)
   → Director publishes → DOI assigned → paper in Archive
```

(See [JOURNAL_PIPELINE.md](./JOURNAL_PIPELINE.md) for stage-by-stage detail.)

---

## 14. Glossary

| Term | Definition |
| --- | --- |
| **Tag** | A researcher role label on a member account (e.g. `lead_researcher`) |
| **Listing** | A public Research Hub post advertising open spots on a project |
| **Research group** | A branded container holding multiple projects and open positions |
| **Chapter** | A private, code-gated local community managed by a Chapter Leader |
| **Pathways** | Personal guided checklist for research progress |
| **Moderator** | Platform staff who approve role applications and new members |
| **Director** | Top-level operator with full platform and editorial oversight |
| **Custom application** | Lead-configured extra questions on a project listing |
| **Join code** | 8-character code required to enter a private chapter |
