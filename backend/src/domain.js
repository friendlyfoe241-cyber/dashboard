// Shared domain constants for the Synthica journal + dashboards.
// Keeping these in one place means the editor dashboard, researcher dashboard,
// and (eventually) the Google Apps Script ingestion all speak the same vocabulary.

// Subject classifications a paper can be filed under. Every editor belongs to one
// of these categories, and a paper is only ever routed to editors in its category.
export const CATEGORIES = [
  'Biology',
  'Chemistry',
  'Physics',
  'Mathematics',
  'Computer Science',
  'Humanities',
  'Economics',
  'Psychology',
];

// Editor roles, ordered by the review pipeline they participate in.
export const EDITOR_ROLES = {
  REVIEWS: 'reviews',
  ASSOCIATE: 'associate',
  SENIOR: 'senior',
  CHIEF: 'chief', // editor-in-chief
  DIRECTOR: 'director',
  AUDITOR: 'auditor', // reviews sign-ups + applications (separate from Director)
  ADMIN: 'admin', // platform super-admin: sees everything (Director + Auditor powers)
};

// Researcher tags (Track 4). A person can hold more than one.
export const RESEARCHER_TAGS = {
  CHAPTER_LEADER: 'chapter_leader',
  ASSOCIATE_RESEARCHER: 'associate_researcher',
  LEAD_RESEARCHER: 'lead_researcher',
  INDEPENDENT_RESEARCHER: 'independent_researcher',
};

// A paper's position in the review pipeline. Declines short-circuit to `rejected`.
//
//   review        -> two Reviews editors must BOTH approve
//   senior_screen -> Senior editor screening pass (no recommendation required)
//   associate     -> Associate editor works revision rounds with the author (2 rounds)
//   senior_final  -> Senior editor final check
//   chief         -> Editor-in-chief sign-off
//   published     -> reaches the Director's "Papers to publish" queue
//   rejected      -> declined at any stage; reaches the Director's "Papers to email" queue
export const STAGE = {
  REVIEW: 'review',
  SENIOR_SCREEN: 'senior_screen',
  ASSOCIATE: 'associate',
  SENIOR_FINAL: 'senior_final',
  CHIEF: 'chief',
  PUBLISHED: 'published',
  REJECTED: 'rejected',
};

// Human-readable label for the state a paper is in, shown on the Director's
// "Papers to email" section (e.g. "Reviewed by Reviews Editor").
export const STAGE_LABEL = {
  [STAGE.REVIEW]: 'Awaiting Reviews Editors',
  [STAGE.SENIOR_SCREEN]: 'Reviewed by Reviews Editors',
  [STAGE.ASSOCIATE]: 'Screened by Senior Editor',
  [STAGE.SENIOR_FINAL]: 'Revised with Associate Editor',
  [STAGE.CHIEF]: 'Final-checked by Senior Editor',
  [STAGE.PUBLISHED]: 'Approved by Editor-in-Chief',
  [STAGE.REJECTED]: 'Declined',
};

export const ASSOCIATE_TOTAL_ROUNDS = 2;

// Task lifecycle on a research project (Track 4).
//   todo -> in_progress -> done
//   a task flagged requiresApproval goes todo -> awaiting_approval -> in_progress
//   (the lead approves the start) -> done
export const TASK_STATUS = {
  TODO: 'todo',
  AWAITING: 'awaiting_approval',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
};

export const TASK_TYPES = ['task', 'reading', 'question'];

// Standard onboarding checklist for a new chapter member. Progress is tracked
// per member; the chapter leader sees everyone's completion.
export const ONBOARDING_STEPS = [
  { key: 'discord', label: 'Join the chapter Discord' },
  { key: 'profile', label: 'Complete your profile (email + résumé)' },
  { key: 'handbook', label: 'Read the chapter handbook' },
  { key: 'project', label: 'Join your first project' },
  { key: 'intro', label: 'Post a quick intro to the team' },
];

export const freshOnboarding = () =>
  ONBOARDING_STEPS.map((s) => ({ key: s.key, label: s.label, done: false }));
