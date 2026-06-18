import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as store from '../src/store.js';

// Fresh seed before each test so mutations never leak between cases.
beforeEach(async () => { await store.reset(); });

const sam = () => store.authenticate('sam@example.com', 'demo1234');     // lead researcher
const jordan = () => store.authenticate('jordan@example.com', 'demo1234'); // associate
const director = () => store.authenticate('director@synthica.org', 'demo1234');

describe('authentication', () => {
  it('accepts a valid demo login and strips secrets', () => {
    const u = sam();
    expect(u).toBeTruthy();
    expect(u.kind).toBe('researcher');
    expect(u.password).toBeUndefined();
    expect(u.twoFactorSecret).toBeUndefined();
  });

  it('rejects a wrong password', () => {
    expect(store.authenticate('sam@example.com', 'nope')).toBeNull();
  });

  it('refuses the shared demo password in production (lockout guard)', () => {
    const prev = process.env.NODE_ENV, prevAllow = process.env.ALLOW_DEMO_LOGINS;
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_DEMO_LOGINS;
    try {
      expect(store.demoLoginsEnabled()).toBe(false);
      expect(store.authenticate('sam@example.com', 'demo1234')).toBeNull();
    } finally {
      process.env.NODE_ENV = prev;
      if (prevAllow !== undefined) process.env.ALLOW_DEMO_LOGINS = prevAllow;
    }
  });
});

describe('profile — security & model', () => {
  it('strips javascript: URLs (stored-XSS regression)', () => {
    const u = sam();
    const out = store.updateProfile(u.id, {
      websiteUrl: 'javascript:alert(document.cookie)',
      githubUrl: 'github.com/safe',
      links: [{ label: 'evil', url: 'javascript:alert(1)' }, { label: 'ok', url: 'https://ok.com' }],
    });
    expect(out.websiteUrl).toBe('');             // dangerous scheme dropped
    expect(out.githubUrl).toBe('https://github.com/safe'); // scheme-less upgraded
    expect(out.links).toHaveLength(1);            // only the safe link survives
    expect(out.links[0].url).toBe('https://ok.com');
  });

  it('mirrors affiliation #1 into the legacy institution field', () => {
    const u = sam();
    const out = store.updateProfile(u.id, { affiliations: ['Exeter', 'Synthica', 'overflow'] });
    expect(out.affiliations).toEqual(['Exeter', 'Synthica']); // capped at two
    expect(out.institution).toBe('Exeter');
  });

  it('keeps DOB private unless the member opts in', () => {
    const u = sam();
    store.updateProfile(u.id, { dob: '2007-04-12', dobPublic: false });
    expect(store.getPublicProfile(u.slug).dob).toBe('');
    store.updateProfile(u.id, { dobPublic: true });
    expect(store.getPublicProfile(u.slug).dob).toBe('2007-04-12');
  });

  it('hides a profile when set non-public', () => {
    const u = sam();
    store.updateProfile(u.id, { public: false });
    expect(store.getPublicProfile(u.slug)).toBeNull();
  });
});

describe('programs (apply → review → cohort)', () => {
  it('admits an accepted applicant into the cohort', () => {
    const u = jordan();
    const program = store.listProgramsFor(u.id).find((p) => p.status === 'open');
    expect(program).toBeTruthy();

    const app = store.applyToProgram({ programId: program.id, userId: u.id, message: 'hi' });
    expect(app.status).toBe('pending');
    expect(store.listProgramsFor(u.id).find((p) => p.id === program.id).myStatus).toBe('applied');

    store.reviewProgramApplication({ id: app.id, status: 'accepted', reviewerId: director().id });
    const after = store.listProgramsFor(u.id).find((p) => p.id === program.id);
    expect(after.myStatus).toBe('member');
    expect(after.cohortSize).toBe(1);
  });

  it('blocks a second pending application', () => {
    const u = jordan();
    const program = store.listProgramsFor(u.id).find((p) => p.status === 'open');
    store.applyToProgram({ programId: program.id, userId: u.id });
    expect(() => store.applyToProgram({ programId: program.id, userId: u.id })).toThrow();
  });
});

describe('certificates', () => {
  it('issues only the earned type, idempotently, and verifies by code', () => {
    const u = sam(); // holds lead_researcher
    const elig = store.myCertificates(u.id).eligible;
    expect(elig).toContain('lead');
    expect(elig).not.toContain('associate');

    const c1 = store.issueCertificate({ userId: u.id, type: 'lead' });
    const c2 = store.issueCertificate({ userId: u.id, type: 'lead' });
    expect(c1.code).toBe(c2.code); // idempotent — same code, not a new cert

    const v = store.verifyCertificate(c1.code);
    expect(v.valid).toBe(true);
    expect(v.type).toBe('lead');
    expect(store.verifyCertificate('SYN-FAKE-CODE').valid).toBe(false);
  });

  it('refuses a certificate the member has not earned', () => {
    const u = sam();
    expect(() => store.issueCertificate({ userId: u.id, type: 'associate' })).toThrow();
  });
});

describe('public stats', () => {
  it('returns the marketing counters', () => {
    const s = store.publicStats();
    expect(s.researchers).toBeGreaterThan(0);
    expect(s.members).toBeGreaterThanOrEqual(s.researchers);
    expect(typeof s.papersPublished).toBe('number');
    expect(typeof s.openPrograms).toBe('number');
  });
});

describe('onboarding completion is durable', () => {
  it('updateProfile persists onboarded=true on the account', () => {
    const u = store.authenticate('jordan@example.com', 'demo1234');
    expect(store.getUserById(u.id).onboarded).toBeFalsy();
    store.updateProfile(u.id, { onboarded: true });
    expect(store.getUserById(u.id).onboarded).toBe(true);
  });
});
