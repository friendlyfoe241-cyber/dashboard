// Seed data for the in-memory store. In production this is replaced by:
//   - Google Sheets (submissions, editor roster, login table)  -> Track 3
//   - the journal publications database                         -> Track 2
//   - the researcher projects database                         -> Track 4
//
// Passwords are stored in plaintext here ONLY because this is a local mock.
// The real login sheet should store hashes.

import { CATEGORIES, EDITOR_ROLES, RESEARCHER_TAGS, STAGE, freshOnboarding } from './domain.js';
import { hashPassword } from './passwords.js';

let _id = 0;
const id = (prefix) => `${prefix}_${String(++_id).padStart(4, '0')}`;

// All demo accounts share the password "demo1234", stored hashed (so the seed
// and the Sheets bootstrap both persist hashes rather than plaintext).
const DEMO_PASSWORD = hashPassword('demo1234');

// ---------------------------------------------------------------------------
// Editors / staff login table (Track 3)
// ---------------------------------------------------------------------------
function editor(name, username, role, category) {
  return {
    id: id('usr'),
    name,
    username,
    password: DEMO_PASSWORD,
    kind: 'editor',
    role,
    category,
    email: `${username}@synthica.org`,
    discord: `${username.replace(/\./g, '_')}`,
    slug: username.replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
    institution: '',
    bio: '',
    avatarUrl: '',
    interests: [],
    linkedinUrl: '',
    websiteUrl: '',
    links: [],
    public: true,
    emailVerified: true,
    twoFactorSecret: '',
    twoFactorEnabled: false,
    following: [],
  };
}

export const editors = [
  // Reviews editors — at least two per category so dual-review routing works.
  editor('Rina Patel', 'rina.bio', EDITOR_ROLES.REVIEWS, 'Biology'),
  editor('Marco Silva', 'marco.bio', EDITOR_ROLES.REVIEWS, 'Biology'),
  editor('Wei Chen', 'wei.cs', EDITOR_ROLES.REVIEWS, 'Computer Science'),
  editor('Asha Rao', 'asha.cs', EDITOR_ROLES.REVIEWS, 'Computer Science'),
  editor('Tomás Vargas', 'tomas.phys', EDITOR_ROLES.REVIEWS, 'Physics'),
  editor('Lena Hoff', 'lena.phys', EDITOR_ROLES.REVIEWS, 'Physics'),
  editor('Yuki Mori', 'yuki.chem', EDITOR_ROLES.REVIEWS, 'Chemistry'),
  editor('Priya Nair', 'priya.chem', EDITOR_ROLES.REVIEWS, 'Chemistry'),

  // Senior editors (one per category is fine for the screen + final checks).
  editor('Dr. Helen Ward', 'helen.bio', EDITOR_ROLES.SENIOR, 'Biology'),
  editor('Dr. Omar Aziz', 'omar.cs', EDITOR_ROLES.SENIOR, 'Computer Science'),
  editor('Dr. Sofia Marin', 'sofia.phys', EDITOR_ROLES.SENIOR, 'Physics'),
  editor('Dr. Ken Adeyemi', 'ken.chem', EDITOR_ROLES.SENIOR, 'Chemistry'),

  // Associate editors (author liaison / revision rounds).
  editor('Jonah Reid', 'jonah.bio', EDITOR_ROLES.ASSOCIATE, 'Biology'),
  editor('Mia Klein', 'mia.cs', EDITOR_ROLES.ASSOCIATE, 'Computer Science'),
  editor('Diego Cruz', 'diego.phys', EDITOR_ROLES.ASSOCIATE, 'Physics'),
  editor('Nadia Farouk', 'nadia.chem', EDITOR_ROLES.ASSOCIATE, 'Chemistry'),

  // Editor-in-chief and Director span all categories.
  editor('Quang Bui', 'chief', EDITOR_ROLES.CHIEF, null),
  editor('Quang Bui', 'director', EDITOR_ROLES.DIRECTOR, null),
  // Auditor reviews sign-ups + applications (separate from the Director).
  editor('Dana Cole', 'auditor', EDITOR_ROLES.AUDITOR, null),
  // Platform super-admin: full visibility (Director Desk + Admin), no review queue.
  editor('Platform Admin', 'admin', EDITOR_ROLES.ADMIN, null),
  // Your admin account
  {
    id: id('usr'),
    name: 'Friendly Foe',
    username: 'friendlyfoe',
    password: 'scrypt:1ae80fd40794cdd2537f85ac602fcc96:27d2ceefea8c72972c83dc62f3b90b094aaef78d64dde8416d4a17cb9c7447ac',
    kind: 'editor',
    role: EDITOR_ROLES.ADMIN,
    category: null,
    email: 'friendlyfoe241@gmail.com',
    discord: 'friendlyfoe',
    slug: 'friendlyfoe',
    institution: '',
    bio: '',
    avatarUrl: '',
    interests: [],
    linkedinUrl: '',
    websiteUrl: '',
    links: [],
    public: true,
    emailVerified: true,
    twoFactorSecret: '',
    twoFactorEnabled: false,
    following: [],
  },
  // Test Admin account
  {
    id: id('usr'),
    name: 'Test Admin',
    username: 'testadmin',
    password: 'scrypt:e37cc29a41a49f1fa2cd5a343763eb0c:f499621b3277ba85be5de58e1117254876be4d8919452b7c9f5f126e748d31d4',
    kind: 'editor',
    role: EDITOR_ROLES.ADMIN,
    category: null,
    email: 'testadmin@synthica.org',
    discord: 'testadmin',
    slug: 'testadmin',
    institution: '',
    bio: '',
    avatarUrl: '',
    interests: [],
    linkedinUrl: '',
    websiteUrl: '',
    links: [],
    public: true,
    emailVerified: true,
    twoFactorSecret: '',
    twoFactorEnabled: false,
    following: [],
  },
  // Test Director account
  {
    id: id('usr'),
    name: 'Test Director',
    username: 'testdirector',
    password: 'scrypt:03c082a9ca0a39b20dcf464952b4522d:ed16928b234793c1320db59ebc133e0de567109d20c17ff37f47305bcd9d3bd0',
    kind: 'editor',
    role: EDITOR_ROLES.DIRECTOR,
    category: null,
    email: 'testdirector@synthica.org',
    discord: 'testdirector',
    slug: 'testdirector',
    institution: '',
    bio: '',
    avatarUrl: '',
    interests: [],
    linkedinUrl: '',
    websiteUrl: '',
    links: [],
    public: true,
    emailVerified: true,
    twoFactorSecret: '',
    twoFactorEnabled: false,
    following: [],
  },
  // Test Auditor account
  {
    id: id('usr'),
    name: 'Test Auditor',
    username: 'testauditor',
    password: 'scrypt:3cc5b3c05e76fce3f8d0c0eceea2b715:1c5191d6aa1a3aba52de8a8699743c2dffa34a6eb0eb561e6af7ebdc91d445aa',
    kind: 'editor',
    role: EDITOR_ROLES.AUDITOR,
    category: null,
    email: 'testauditor@synthica.org',
    discord: 'testauditor',
    slug: 'testauditor',
    institution: '',
    bio: '',
    avatarUrl: '',
    interests: [],
    linkedinUrl: '',
    websiteUrl: '',
    links: [],
    public: true,
    emailVerified: true,
    twoFactorSecret: '',
    twoFactorEnabled: false,
    following: [],
  },
];

// ---------------------------------------------------------------------------
// Submissions / papers in the review pipeline (Track 3)
// ---------------------------------------------------------------------------
// These mirror the columns we'd pull from the Google Form responses sheet.
function submission(title, authorName, authorEmail, category, abstract) {
  const submittedAt = new Date(Date.now() - Math.floor(Math.random() * 12) * 864e5).toISOString();
  const pdfUrl = 'https://drive.google.com/file/d/EXAMPLE/view';
  return {
    id: id('paper'),
    title,
    authorName,
    authorEmail,
    authorDiscord: authorName.toLowerCase().replace(/[^a-z]/g, '_'),
    submittedBy: null, // researcher userId when submitted from the dashboard
    category,
    abstract,
    pdfUrl,
    submittedAt,
    stage: STAGE.REVIEW,
    assignedReviewers: [], // filled by the store's load-balanced assignment
    assignee: null, // single-owner stages (senior/associate/chief) use this
    reviews: [], // [{ editorId, decision, comments, recommendation, at }]
    comments: [], // [{ id, authorId, authorName, role, body, at }] internal editor thread
    revisions: [{ version: 1, url: pdfUrl, note: 'Initial submission', at: submittedAt, byName: authorName }],
    revisionRequested: false,
    associateRounds: 0,
    history: [], // audit trail of stage transitions + decisions
  };
}

export const submissions = [
  submission(
    'CRISPR Screening of Drought-Tolerance Genes in Maize',
    'Aiden Cole',
    'aiden.cole@example.com',
    'Biology',
    'We apply a pooled CRISPR knockout screen to identify candidate loci associated with drought tolerance in Zea mays seedlings.'
  ),
  submission(
    'A Lightweight Transformer for On-Device Sign-Language Recognition',
    'Bella Nguyen',
    'bella.nguyen@example.com',
    'Computer Science',
    'We present a distilled transformer that runs real-time ASL recognition on mobile hardware under 50ms latency.'
  ),
  submission(
    'Constraints on Dark Photon Mass from Tabletop Interferometry',
    'Caleb Ortiz',
    'caleb.ortiz@example.com',
    'Physics',
    'Using a student-built Michelson interferometer we place an upper bound on dark-photon coupling in the sub-eV regime.'
  ),
  submission(
    'Green Synthesis of Silver Nanoparticles from Citrus Peel Extract',
    'Dara Field',
    'dara.field@example.com',
    'Chemistry',
    'An eco-friendly route to AgNPs using citrus pectin as a reducing agent, characterized by UV-Vis and TEM.'
  ),
  submission(
    'Predicting Protein Folding Stability with Graph Neural Networks',
    'Evan Park',
    'evan.park@example.com',
    'Biology',
    'A GNN trained on the Megascale dataset predicts ΔΔG of point mutations with competitive accuracy.'
  ),
];

// ---------------------------------------------------------------------------
// Journal publications / DOI registry (Track 2)
// ---------------------------------------------------------------------------
// Publication shape mirrors the metadata Nature surfaces on an article page:
// article type, full author + affiliation list, corresponding author, abstract,
// keywords, the received/accepted/published dates, volume/issue/pages, DOI,
// license, and article-level metrics (accesses, citations, Altmetric).
function publication(title, authors, category, doiSuffix, year, abstract, extra = {}) {
  return {
    id: id('pub'),
    doi: `10.55555/synthica.${doiSuffix}`,
    title,
    articleType: extra.articleType || 'Article',
    authors, // [{ name, affiliation }]
    authorUserId: extra.authorUserId || null, // links to a researcher profile
    correspondingAuthor: extra.correspondingAuthor || authors[0]?.name,
    category,
    abstract,
    keywords: extra.keywords || [],
    receivedAt: extra.receivedAt || `${year - 1}-11-02`,
    acceptedAt: extra.acceptedAt || `${year}-02-18`,
    publishedAt: extra.publishedAt || `${year}-03-15`,
    volume: extra.volume || 1,
    issue: extra.issue || 1,
    pages: extra.pages || '1–14',
    pdfUrl: extra.pdfUrl || 'https://www.synthica.org/journal/pdf/EXAMPLE.pdf',
    license: 'CC BY 4.0',
    openAccess: true,
    // Nature-style article sections, used to render the full-text view.
    sections: extra.sections || [
      { heading: 'Introduction', body: 'Background and motivation for the study.' },
      { heading: 'Methods', body: 'Materials, data sources, and experimental design.' },
      { heading: 'Results', body: 'Key findings and figures.' },
      { heading: 'Discussion', body: 'Interpretation, limitations, and future work.' },
    ],
    metrics: {
      accesses: extra.accesses ?? 200 + Math.floor(Math.random() * 4000),
      citations: extra.citations ?? Math.floor(Math.random() * 8),
      altmetric: extra.altmetric ?? Math.floor(Math.random() * 30),
    },
    citationCount: extra.citations ?? Math.floor(Math.random() * 8),
  };
}

export const publications = [
  publication(
    'Quantifying Microplastic Uptake in Freshwater Daphnia',
    [{ name: 'Hana Lee', affiliation: 'Synthica Research Group' }],
    'Biology',
    '2025.0001',
    2025,
    'A controlled exposure study measuring microplastic accumulation in Daphnia magna over a 14-day window.',
    { keywords: ['microplastics', 'Daphnia magna', 'freshwater ecology'], articleType: 'Article', accesses: 3120, citations: 4, altmetric: 18 }
  ),
  publication(
    'Benchmarking Small Language Models for Math Word Problems',
    [
      { name: 'Ravi Shah', affiliation: 'Synthica Research Group' },
      { name: 'Mei Tan', affiliation: 'Synthica Research Group' },
    ],
    'Computer Science',
    '2025.0002',
    2025,
    'We evaluate sub-3B parameter models on GSM8K-style problems and analyze failure modes.',
    { keywords: ['language models', 'mathematical reasoning', 'benchmarking'], articleType: 'Analysis', accesses: 5400, citations: 6, altmetric: 27 }
  ),
];

// ---------------------------------------------------------------------------
// Researchers, projects, listings, applications (Track 4)
// ---------------------------------------------------------------------------
function researcher(name, username, tags, extra = {}) {
  return {
    id: id('usr'),
    name,
    username,
    password: DEMO_PASSWORD,
    kind: 'researcher',
    tags,
    email: `${username}@example.com`,
    discord: username,
    resumeUrl: '',
    gpa: '',
    researchExperience: null, // self-rated 0–10, collected at onboarding
    leadRecommended: false, // flagged when self-rated experience is high (≥ 8)
    pathway: [], // personal guided research to-dos (title, deliverable, due, done)
    slug: username.replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
    institution: '',
    affiliations: [], // up to two; institution mirrors the first
    bio: '',
    blurb: '',
    pronouns: '',
    avatarUrl: '',
    interests: [],
    researchGroup: '', // current lab / research group name
    researchGroupUrl: '',
    contactEmail: '', // public contact email (login email stays private)
    linkedinUrl: '',
    websiteUrl: '',
    githubUrl: '',
    twitterUrl: '',
    scholarUrl: '', // Google Scholar
    orcid: '',
    dob: '', // YYYY-MM-DD; private unless dobPublic
    dobPublic: false,
    links: [],
    public: true,
    emailVerified: true,
    twoFactorSecret: '',
    twoFactorEnabled: false,
    following: [],
    ...extra,
  };
}

export const researchers = [
  researcher('Sam Rivera', 'sam', [RESEARCHER_TAGS.LEAD_RESEARCHER], {
    affiliations: ['Phillips Exeter Academy', 'Synthica Research Group'],
    institution: 'Phillips Exeter Academy',
    pronouns: 'she/her',
    blurb: 'Lead researcher studying coral-reef genetics 🌊',
    bio: 'High-school researcher leading a team on reef resilience. I love turning messy field data into models that say something real about a warming ocean.',
    interests: ['marine biology', 'genomics', 'climate modeling'],
    researchGroup: 'Reef Genomics Group',
    contactEmail: 'sam.rivera@example.com',
    linkedinUrl: 'https://www.linkedin.com/in/sam-rivera',
    githubUrl: 'https://github.com/sam-rivera',
    scholarUrl: 'https://scholar.google.com/citations?user=EXAMPLE',
    orcid: '0000-0002-1825-0097',
    dob: '2007-04-12',
    dobPublic: false,
    avatarUrl: '',
  }),
  researcher('Jordan Kim', 'jordan', [RESEARCHER_TAGS.ASSOCIATE_RESEARCHER]),
  researcher('Taylor Brooks', 'taylor', [RESEARCHER_TAGS.CHAPTER_LEADER]),
  researcher('Robin Diaz', 'robin', [RESEARCHER_TAGS.INDEPENDENT_RESEARCHER]),
  researcher('Casey Wong', 'casey', [
    RESEARCHER_TAGS.ASSOCIATE_RESEARCHER,
    RESEARCHER_TAGS.CHAPTER_LEADER,
  ]),
  // Test Lead Researcher account
  {
    id: id('usr'),
    name: 'Test Lead Researcher',
    username: 'testlead',
    password: 'scrypt:ec645a98525401b6d8504eeedcaabff4:59987b5cf1d251d47efd1cdf874a10f22733763dddb6d2c25c3ce994d0ddc04d',
    kind: 'researcher',
    tags: [RESEARCHER_TAGS.LEAD_RESEARCHER],
    email: 'testlead@synthica.org',
    discord: 'testlead',
    resumeUrl: '',
    gpa: '',
    researchExperience: 8,
    leadRecommended: false, // already a lead, don't show the nudge
    pathway: [],
    slug: 'testlead',
    institution: '',
    bio: '',
    avatarUrl: '',
    interests: [],
    linkedinUrl: '',
    websiteUrl: '',
    links: [],
    public: true,
    emailVerified: true,
    twoFactorSecret: '',
    twoFactorEnabled: false,
    following: [],
  },
  // Test Associate Researcher account
  {
    id: id('usr'),
    name: 'Test Associate Researcher',
    username: 'testassociate',
    password: 'scrypt:29415f3205b4fcbefa1338f2467c6ded:2b209af65b71823c4879d62e7eead337d67befdde2d4ec963c1b4ffd44de93b0',
    kind: 'researcher',
    tags: [RESEARCHER_TAGS.ASSOCIATE_RESEARCHER],
    email: 'testassociate@synthica.org',
    discord: 'testassociate',
    resumeUrl: '',
    gpa: '',
    researchExperience: 5,
    leadRecommended: false,
    pathway: [],
    slug: 'testassociate',
    institution: '',
    bio: '',
    avatarUrl: '',
    interests: [],
    linkedinUrl: '',
    websiteUrl: '',
    links: [],
    public: true,
    emailVerified: true,
    twoFactorSecret: '',
    twoFactorEnabled: false,
    following: [],
  },
  // Test Chapter Leader account
  {
    id: id('usr'),
    name: 'Test Chapter Leader',
    username: 'testchapter',
    password: 'scrypt:d04f686cd92dda5a18f397135fddf3ed:71b9eefc8eb646c2514d112c3730ce0fa484d219c63cd5b764487882ea28af75',
    kind: 'researcher',
    tags: [RESEARCHER_TAGS.CHAPTER_LEADER],
    email: 'testchapter@synthica.org',
    discord: 'testchapter',
    resumeUrl: '',
    gpa: '',
    researchExperience: 6,
    leadRecommended: false,
    pathway: [],
    slug: 'testchapter',
    institution: '',
    bio: '',
    avatarUrl: '',
    interests: [],
    linkedinUrl: '',
    websiteUrl: '',
    links: [],
    public: true,
    emailVerified: true,
    twoFactorSecret: '',
    twoFactorEnabled: false,
    following: [],
  },
  // Test Independent Researcher account
  {
    id: id('usr'),
    name: 'Test Independent Researcher',
    username: 'testindependent',
    password: 'scrypt:c95ee385f4c6f5a71e77150d11c001ba:b701b0572eb9d10f2a32a595a43bda13b92d112399e82c9d53e24a3cd5294dca',
    kind: 'researcher',
    tags: [RESEARCHER_TAGS.INDEPENDENT_RESEARCHER],
    email: 'testindependent@synthica.org',
    discord: 'testindependent',
    resumeUrl: '',
    gpa: '',
    researchExperience: 4,
    leadRecommended: false,
    pathway: [],
    slug: 'testindependent',
    institution: '',
    bio: '',
    avatarUrl: '',
    interests: [],
    linkedinUrl: '',
    websiteUrl: '',
    links: [],
    public: true,
    emailVerified: true,
    twoFactorSecret: '',
    twoFactorEnabled: false,
    following: [],
  },
];

const leadId = researchers[0].id;
const assocId = researchers[1].id;
const taylorId = researchers[2].id;
const caseyId = researchers[4].id;

// task(title, type, assignedTo, status, opts)
function task(title, type, assignedTo, status, opts = {}) {
  return {
    id: id('task'),
    title,
    type, // 'task' | 'reading' | 'question'
    assignedTo,
    status, // see TASK_STATUS
    done: status === 'done',
    requiresApproval: !!opts.requiresApproval,
    createdBy: opts.createdBy || leadId,
    dueAt: opts.dueAt || null,
  };
}

export const projects = [
  {
    id: id('proj'),
    title: 'Air Quality Sensing in Urban Schools',
    category: 'Chemistry',
    description: 'Deploy low-cost PM2.5 sensors across partner schools and analyze exposure patterns.',
    leadId,
    members: [leadId, assocId, caseyId],
    announcements: [
      { id: id('ann'), at: new Date().toISOString(), body: 'Welcome! Read the onboarding doc before Friday.' },
    ],
    tasks: [
      // A "question" sits at the top of the hierarchy for those ahead to see.
      task('Research question: does ventilation type predict PM2.5 exposure?', 'question', [], 'in_progress', { createdBy: assocId }),
      task('Read: intro to PM2.5 sensing', 'reading', [assocId, caseyId], 'todo', { dueAt: '2026-06-20' }),
      task('Calibrate sensor batch #2', 'task', [assocId], 'done', { dueAt: '2026-06-10' }),
      // A step that needs the lead's sign-off before work starts.
      task('Run the field deployment', 'task', [caseyId], 'awaiting_approval', { requiresApproval: true, dueAt: '2026-06-28' }),
    ],
    links: [
      { id: id('link'), label: 'Draft manuscript (Google Drive)', url: 'https://drive.google.com/file/d/EXAMPLE/view', addedBy: leadId, at: new Date().toISOString() },
      { id: id('link'), label: 'Project kickoff video', url: 'https://youtu.be/dQw4w9WgXcQ', addedBy: leadId, at: new Date().toISOString() },
    ],
    // Team brainstorm: propose ideas, upvote, then the lead picks one.
    ideas: [
      { id: id('idea'), text: 'Compare PM2.5 across naturally vs. mechanically ventilated rooms', by: assocId, votes: [assocId, caseyId], chosen: true, at: new Date().toISOString() },
      { id: id('idea'), text: 'Map exposure to nearby traffic density', by: caseyId, votes: [caseyId], chosen: false, at: new Date().toISOString() },
    ],
  },
  {
    id: id('proj'),
    title: 'NLP for Low-Resource Languages',
    category: 'Computer Science',
    description: 'Build and evaluate tokenizers for under-resourced languages.',
    leadId,
    members: [leadId, assocId],
    announcements: [],
    tasks: [
      task('Collect parallel corpus', 'task', [assocId], 'in_progress', { dueAt: '2026-07-01' }),
    ],
    links: [],
    ideas: [],
  },
];

// Demo: seed a couple personal "Pathway" to-dos + a follow edge.
researchers[1].pathway = [
  { id: id('pw'), title: 'Read 3 papers in my field', deliverable: 'Short notes doc', dueAt: '2026-06-25', done: true },
  { id: id('pw'), title: 'Draft a research question', deliverable: '1-paragraph proposal', dueAt: '2026-07-05', done: false },
];
researchers[1].following = [researchers[0].id]; // Jordan follows Sam
researchers[1].interests = ['air quality', 'sensors'];

// ---------------------------------------------------------------------------
// Chapters + onboarding (Track 4)
// ---------------------------------------------------------------------------
// A chapter is a local group with a leader and members. Each membership tracks
// an onboarding checklist so leaders can see who's fully ramped up.
function member(userId, doneKeys = []) {
  const onboarding = freshOnboarding().map((s) => ({ ...s, done: doneKeys.includes(s.key) }));
  return { userId, joinedAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 864e5).toISOString(), onboarding };
}

export const chapters = [
  {
    id: id('chap'),
    name: 'Bay Area Chapter',
    location: 'San Francisco, USA',
    leaderId: taylorId,
    handbookUrl: 'https://example.com/synthica-chapter-handbook',
    members: [
      member(taylorId, ['discord', 'profile', 'handbook', 'project', 'intro']),
      member(caseyId, ['discord', 'profile', 'handbook']),
      member(assocId, ['discord', 'profile']),
    ],
  },
];

// Open project listings for the Research Hub.
export const listings = [
  { id: id('list'), title: 'Modeling Coral Bleaching under Warming Scenarios', category: 'Biology', spots: 3, leadName: 'Sam Rivera', leadId: leadId, description: 'Use public reef datasets to model bleaching thresholds.' },
  { id: id('list'), title: 'Fairness Audits of Public Recommender Datasets', category: 'Computer Science', spots: 2, leadName: 'Sam Rivera', leadId: leadId, description: 'Measure demographic skew in open recommender benchmarks.' },
  { id: id('list'), title: 'Behavioral Economics of Classroom Incentives', category: 'Economics', spots: 4, leadName: 'Open', leadId: null, description: 'Design a small RCT on study incentives.' },
];

// Role/project applications submitted from the Application Hub.
export const applications = [];

// Global news / announcements (Track-wide).
export const news = [
  {
    id: id('news'),
    title: 'Welcome to the Synthica platform',
    body: 'The editorial and researcher dashboards are live. Post announcements here for everyone.',
    authorName: 'Quang Bui',
    audience: 'all',
    at: new Date().toISOString(),
  },
];

// Append-only audit log of editorial + admin actions.
export const audit = [];
export const events = [];

// Per-user in-app notifications.
export const notifications = [];

// Structured programs (apply → cohort → milestones). Dates are relative to
// "now" so the demo always shows an open, joinable cohort.
const weeksFromNow = (n) => new Date(Date.now() + n * 7 * 24 * 3600 * 1000).toISOString();

export const programs = [
  {
    id: id('prg'),
    title: 'Summer Research Cohort',
    cohortLabel: 'Summer 2026',
    category: '',
    description:
      'An 8-week guided research sprint: weekly mentor check-ins, a structured path from question to draft, and a final showcase. Open to all members — no experience required.',
    spots: 30,
    applyDeadline: weeksFromNow(3),
    startAt: weeksFromNow(4),
    endAt: weeksFromNow(12),
    status: 'open',
    cohort: [],
    milestones: [
      { id: 'ms_1', title: 'Research question + mentor match', dueAt: weeksFromNow(5), done: false },
      { id: 'ms_2', title: 'Literature review complete', dueAt: weeksFromNow(7), done: false },
      { id: 'ms_3', title: 'Methods + first results', dueAt: weeksFromNow(9), done: false },
      { id: 'ms_4', title: 'Final draft + showcase', dueAt: weeksFromNow(12), done: false },
    ],
    createdBy: 'system',
    createdAt: new Date().toISOString(),
  },
];

// Issued role certificates (verifiable by code).
export const certificates = [];

// Research Groups — interest-based hubs run by a lead, holding several projects,
// a member roster, open positions, and shared links (a "guild" of projects).
export const groups = [
  {
    id: id('grp'),
    name: 'Climate & Sensing Lab',
    description: 'A hub for student projects on environmental sensing, climate data, and sustainability. We share tooling, datasets, and review each other’s work.',
    category: 'Chemistry',
    leaderId: leadId,
    bannerUrl: '',
    members: [leadId, assocId, caseyId],
    projectIds: [projects[0].id, projects[1].id],
    positions: [
      { id: id('pos'), title: 'Data Lead', description: 'Owns shared datasets + pipelines', filledBy: assocId },
      { id: id('pos'), title: 'Outreach Coordinator', description: 'Recruits members + partner schools', filledBy: null },
    ],
    links: [
      { id: id('glink'), label: 'Group handbook', url: 'https://example.com/climate-lab-handbook' },
      { id: id('glink'), label: 'Shared data drive', url: 'https://drive.google.com/drive/folders/EXAMPLE' },
    ],
    createdAt: new Date().toISOString(),
  },
];

// Competitions board — opportunities posted by staff (and leads).
export const competitions = [
  {
    id: id('cmp'),
    title: 'Global Research Challenge 2026',
    description: 'A worldwide research competition for high-school students across all subjects. Cash prizes and publication for finalists.',
    url: 'https://globalresearchchallenge.org',
    category: '',
    deadline: new Date(Date.now() + 45 * 864e5).toISOString().slice(0, 10),
    prize: '$5,000 + publication',
    postedByName: 'Synthica',
    at: new Date().toISOString(),
  },
];

// Community feed — member-written posts (questions, opportunities, updates)
// with likes and comments. Author name/avatar are resolved at read time.
const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();
export const posts = [
  {
    id: id('post'),
    authorId: leadId,
    text: 'Kicking off our reef-genomics project this summer! 🌊 If anyone has experience with R for ecology data, I’d love to collaborate — drop a comment.',
    linkUrl: '', imageUrl: '',
    likes: [assocId, caseyId],
    comments: [
      { id: id('cmt'), authorId: assocId, text: 'Count me in — I use R all the time!', at: hoursAgo(1) },
    ],
    at: hoursAgo(3),
  },
  {
    id: id('post'),
    authorId: assocId,
    text: 'Opportunity: my school is running a free data-science bootcamp over break, open to all Synthica members. Comment if you want the link!',
    linkUrl: '', imageUrl: '',
    likes: [leadId],
    comments: [],
    at: hoursAgo(20),
  },
];

export const allUsers = () => [...editors, ...researchers];
