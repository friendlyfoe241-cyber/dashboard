import { describe, it, expect, beforeEach } from 'vitest';
import * as store from '../src/store.js';

beforeEach(async () => { await store.reset(); });

const auditor = () => store.authenticate('auditor@synthica.org', 'demo1234');

describe('new-member pending-approval flow (ROLE_WORKFLOWS §3.1)', () => {
  it('a fresh sign-up is unapproved, tag-less, and queued for a Moderator', () => {
    const u = store.registerResearcher({ name: 'New Member', email: 'newbie@example.com', discord: 'newbie', password: 'hunter22' });
    expect(u.approved).toBe(false);
    expect(u.tags).toEqual([]);
    const onboardingRow = store.allApplications().find((a) => a.userId === u.id && a.kind === 'onboarding');
    expect(onboardingRow).toBeTruthy();
    expect(onboardingRow.status).toBe('pending');
  });

  it('Moderator approval grants Associate Researcher and activates the account', () => {
    const u = store.registerResearcher({ name: 'Joins Soon', email: 'joins@example.com', discord: 'joins', password: 'hunter22' });
    const row = store.allApplications().find((a) => a.userId === u.id && a.kind === 'onboarding');
    store.setApplicationStatus({ id: row.id, status: 'approved', reviewerId: auditor().id, assignTag: 'associate_researcher' });
    const after = store.getResearcherById(u.id);
    expect(after.approved).toBe(true);
    expect(after.tags).toContain('associate_researcher');
  });

  it('rejection flags the member, and resubmit re-queues them for review', () => {
    const u = store.registerResearcher({ name: 'Try Again', email: 'again@example.com', discord: 'again', password: 'hunter22' });
    const row = store.allApplications().find((a) => a.userId === u.id && a.kind === 'onboarding');
    store.setApplicationStatus({ id: row.id, status: 'rejected', reviewerId: auditor().id });
    expect(store.getResearcherById(u.id).onboardingRejected).toBe(true);

    const back = store.resubmitOnboarding(u.id);
    expect(back.onboardingRejected).toBe(false);
    const reRow = store.allApplications().find((a) => a.userId === u.id && a.kind === 'onboarding');
    expect(reRow.status).toBe('pending');
  });

  it('resubmit is refused once the member is already approved', () => {
    const u = store.registerResearcher({ name: 'Done', email: 'done@example.com', discord: 'done', password: 'hunter22' });
    const row = store.allApplications().find((a) => a.userId === u.id && a.kind === 'onboarding');
    store.setApplicationStatus({ id: row.id, status: 'approved', reviewerId: auditor().id, assignTag: 'associate_researcher' });
    expect(() => store.resubmitOnboarding(u.id)).toThrow(/already active/i);
  });
});

describe('role-upgrade application intake validation (ROLE_WORKFLOWS §3.2)', () => {
  // Approve a fresh researcher to Associate so they can apply for advanced roles.
  const approvedAssociate = () => {
    const u = store.registerResearcher({ name: 'Assoc Member', email: `assoc${Date.now()}@example.com`, discord: 'assoc', password: 'hunter22' });
    const row = store.allApplications().find((a) => a.userId === u.id && a.kind === 'onboarding');
    store.setApplicationStatus({ id: row.id, status: 'approved', reviewerId: auditor().id, assignTag: 'associate_researcher' });
    return store.getResearcherById(u.id);
  };

  it('accepts a complete Lead Researcher application', () => {
    const u = approvedAssociate();
    const rec = store.addApplication({ userId: u.id, userName: u.name, role: 'Lead Researcher', message: 'My research plan…', answers: { 'Full Name': u.name } });
    expect(rec.status).toBe('pending');
    expect(rec.role).toBe('Lead Researcher');
  });

  it('rejects applying for Associate Researcher (granted automatically)', () => {
    const u = approvedAssociate();
    expect(() => store.addApplication({ userId: u.id, userName: u.name, role: 'Associate Researcher', message: 'x' }))
      .toThrow(/granted automatically/i);
  });

  it('rejects an unknown role', () => {
    const u = approvedAssociate();
    expect(() => store.addApplication({ userId: u.id, userName: u.name, role: 'Supreme Leader', message: 'x' }))
      .toThrow(/unknown role/i);
  });

  it('requires the application essay (message)', () => {
    const u = approvedAssociate();
    expect(() => store.addApplication({ userId: u.id, userName: u.name, role: 'Chapter Leader', message: '   ' }))
      .toThrow(/answer the application questions/i);
  });

  it('blocks a duplicate pending application for the same role', () => {
    const u = approvedAssociate();
    store.addApplication({ userId: u.id, userName: u.name, role: 'Independent Researcher', message: 'A solo project' });
    expect(() => store.addApplication({ userId: u.id, userName: u.name, role: 'Independent Researcher', message: 'Again' }))
      .toThrow(/already have a pending/i);
  });

  it('blocks applying for a role the member already holds', () => {
    const u = approvedAssociate();
    store.auditorSetTags({ userId: u.id, addTags: ['lead_researcher'], actor: auditor() });
    expect(() => store.addApplication({ userId: u.id, userName: u.name, role: 'Lead Researcher', message: 'plan' }))
      .toThrow(/already hold/i);
  });

  it('still allows listing applications (no role) without essay validation', () => {
    const u = approvedAssociate();
    const rec = store.addApplication({ userId: u.id, userName: u.name, listingId: null, message: '' });
    expect(rec.status).toBe('pending');
  });
});
