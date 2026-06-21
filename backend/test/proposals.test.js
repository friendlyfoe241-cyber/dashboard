import { describe, it, expect, beforeEach } from 'vitest';
import * as store from '../src/store.js';

beforeEach(async () => { await store.reset(); });

const robin = () => store.authenticate('robin@example.com', 'demo1234');      // independent_researcher
const auditor = () => store.authenticate('auditor@synthica.org', 'demo1234'); // moderator
const sam = () => store.authenticate('sam@example.com', 'demo1234');          // lead, not independent

const projectsOf = (userId) => store.listProjects().filter((p) => p.members.includes(userId));

describe('independent proposal — submission', () => {
  it('an independent researcher submits a proposal that enters the pending queue', () => {
    const u = robin();
    const p = store.addProposal({
      id: undefined, userId: u.id,
      title: 'Tide Pool Temperature Study', category: 'Biology',
      description: 'Track temps across tide pools', methodology: 'Daily logger readings',
    });
    expect(p.status).toBe('pending');
    expect(p.kind).toBe('proposal');
    expect(p.projectId).toBeNull();
    // surfaced to the member
    expect(store.listProposalsForUser(u.id).some((x) => x.id === p.id)).toBe(true);
    // surfaced to the Moderator console (shared applications queue + dedicated list)
    expect(store.listProposals().some((x) => x.id === p.id)).toBe(true);
    expect(store.allApplications().some((a) => a.id === p.id && a.kind === 'proposal')).toBe(true);
  });

  it('rejects an empty title and blocks non-independent members', () => {
    expect(() => store.addProposal({ userId: robin().id, title: '   ' })).toThrow();
    expect(() => store.addProposal({ userId: sam().id, title: 'I lead, not propose' })).toThrow(/Independent/);
  });
});

describe('independent proposal — moderator approval creates a project', () => {
  it('approving a proposal creates a real project owned by the member', () => {
    const u = robin();
    const before = projectsOf(u.id).length;
    const p = store.addProposal({ userId: u.id, title: 'Urban Bird Survey', category: 'Biology', description: 'd', methodology: 'm' });

    const approved = store.reviewProposal({ id: p.id, status: 'approved', reviewerId: auditor().id });
    expect(approved.status).toBe('approved');
    expect(approved.projectId).toBeTruthy();

    const after = projectsOf(u.id);
    expect(after.length).toBe(before + 1);
    const proj = store.getProject(approved.projectId);
    expect(proj.title).toBe('Urban Bird Survey');
    expect(proj.leadId).toBe(u.id);
    expect(proj.members).toContain(u.id);
    expect(proj.origin).toBe('proposal');
  });

  it('the Moderator console path (setApplicationStatus) also approves proposals', () => {
    const u = robin();
    const p = store.addProposal({ userId: u.id, title: 'Soil pH Mapping', category: 'Chemistry', description: 'd', methodology: 'm' });
    const out = store.setApplicationStatus({ id: p.id, status: 'approved', reviewerId: auditor().id });
    expect(out.status).toBe('approved');
    expect(out.kind).toBe('proposal');
    expect(store.getProject(out.projectId)).toBeTruthy();
  });

  it('a role tag passed by the shared admin form is NOT written into proposal feedback', () => {
    const u = robin();
    const p = store.addProposal({ userId: u.id, title: 'No Tag Leak', category: 'Biology', description: 'd', methodology: 'm' });
    // The legacy applications UI sends assignTag (default 'independent_researcher')
    // even for a proposal; it must be ignored, not stored as feedback.
    const out = store.setApplicationStatus({ id: p.id, status: 'approved', assignTag: 'independent_researcher', reviewerId: auditor().id });
    expect(out.feedback).toBe('');
    // and the member's tags are unchanged (no spurious grant)
    expect(store.getResearcherById(u.id).tags).toEqual(['independent_researcher']);
  });

  it('rejection feedback from the shared admin form reaches the proposal', () => {
    const u = robin();
    const p = store.addProposal({ userId: u.id, title: 'Needs Work', category: 'Biology', description: 'd', methodology: 'm' });
    const out = store.setApplicationStatus({ id: p.id, status: 'rejected', feedback: 'Tighten the scope.', reviewerId: auditor().id });
    expect(out.status).toBe('rejected');
    expect(out.feedback).toBe('Tighten the scope.');
  });

  it('notifies the member when their proposal is approved', () => {
    const u = robin();
    const p = store.addProposal({ userId: u.id, title: 'Algae Growth', category: 'Biology', description: 'd', methodology: 'm' });
    store.reviewProposal({ id: p.id, status: 'approved', reviewerId: auditor().id });
    const notes = store.listNotifications(u.id);
    expect(notes.some((n) => /approved/i.test(n.title))).toBe(true);
  });

  it('cannot approve the same proposal twice', () => {
    const u = robin();
    const p = store.addProposal({ userId: u.id, title: 'Once Only', category: 'Physics', description: 'd', methodology: 'm' });
    store.reviewProposal({ id: p.id, status: 'approved', reviewerId: auditor().id });
    expect(() => store.reviewProposal({ id: p.id, status: 'approved', reviewerId: auditor().id })).toThrow();
  });
});

describe('independent proposal — reject, revise & resubmit', () => {
  it('rejection carries feedback and the member can revise & resubmit to pending', () => {
    const u = robin();
    const p = store.addProposal({ userId: u.id, title: 'Too Broad Study', category: 'Biology', description: 'd', methodology: 'm' });

    const rejected = store.reviewProposal({ id: p.id, status: 'rejected', reviewerId: auditor().id, feedback: 'Narrow the scope.' });
    expect(rejected.status).toBe('rejected');
    expect(rejected.feedback).toBe('Narrow the scope.');
    // rejecting does NOT create a project
    expect(rejected.projectId).toBeNull();

    const revised = store.reviseProposal({ id: p.id, userId: u.id, title: 'Focused Study', description: 'narrower' });
    expect(revised.status).toBe('pending');
    expect(revised.title).toBe('Focused Study');

    // an approval after revision still creates the project
    const approved = store.reviewProposal({ id: p.id, status: 'approved', reviewerId: auditor().id });
    expect(store.getProject(approved.projectId).title).toBe('Focused Study');
  });

  it('only the owner can revise, and an approved proposal cannot be edited', () => {
    const u = robin();
    const p = store.addProposal({ userId: u.id, title: 'Mine', category: 'Biology', description: 'd', methodology: 'm' });
    store.reviewProposal({ id: p.id, status: 'rejected', reviewerId: auditor().id, feedback: 'fix' });
    expect(() => store.reviseProposal({ id: p.id, userId: sam().id, title: 'hijack' })).toThrow(/Not your/);

    const ok = store.addProposal({ userId: u.id, title: 'Approve Me', category: 'Biology', description: 'd', methodology: 'm' });
    store.reviewProposal({ id: ok.id, status: 'approved', reviewerId: auditor().id });
    expect(() => store.reviseProposal({ id: ok.id, userId: u.id, title: 'changed' })).toThrow();
  });
});

describe('independent proposal — seed data', () => {
  it('seeds Robin with one approved (with project) and one pending proposal', () => {
    const u = robin();
    const mine = store.listProposalsForUser(u.id);
    expect(mine.length).toBeGreaterThanOrEqual(2);
    const approved = mine.find((p) => p.status === 'approved');
    const pending = mine.find((p) => p.status === 'pending');
    expect(approved).toBeTruthy();
    expect(pending).toBeTruthy();
    // the approved proposal links to a real project the member is on
    const proj = store.getProject(approved.projectId);
    expect(proj).toBeTruthy();
    expect(proj.members).toContain(u.id);
  });
});
