import { describe, it, expect, beforeEach } from 'vitest';
import * as store from '../src/store.js';

// Fresh seed before each test so mutations never leak between cases.
beforeEach(async () => { await store.reset(); });

const sam = () => store.authenticate('sam@example.com', 'demo1234');       // lead researcher
const jordan = () => store.authenticate('jordan@example.com', 'demo1234'); // associate
const robin = () => store.authenticate('robin@example.com', 'demo1234');   // independent

describe('create project → auto-listing (§5.2/§5.6)', () => {
  it('publishing a project creates a linked Hub listing', () => {
    const lead = sam();
    const res = store.createProject({ userId: lead.id, title: 'Tide Pools', category: 'Biology', description: 'Survey work', spots: 2 });
    expect(res.listing).toBeTruthy();
    expect(res.listing.projectId).toBe(res.id);
    expect(res.listing.title).toBe('Tide Pools');
    const onHub = store.listListings().find((l) => l.id === res.listing.id);
    expect(onHub).toBeTruthy();
    expect(onHub.spots).toBe(2);
  });

  it('publishListing:false creates a project without a listing', () => {
    const lead = sam();
    const res = store.createProject({ userId: lead.id, title: 'Quiet Project', category: 'Physics', publishListing: false });
    expect(res.listing).toBeNull();
    expect(store.listListings().some((l) => l.projectId === res.id)).toBe(false);
  });

  it('non-leads cannot create projects', () => {
    const u = jordan();
    expect(() => store.createProject({ userId: u.id, title: 'Nope' })).toThrow();
  });
});

describe('custom application mode (§5.4)', () => {
  it('seed ships a coral listing with custom questions and a pending applicant', () => {
    const lead = sam();
    const listing = store.myListings(lead.id).find((l) => l.customApplication);
    expect(listing).toBeTruthy();
    expect(listing.customQuestions.length).toBe(2);
    expect(listing.applicantsDetail.length).toBeGreaterThan(0);
    const applicant = listing.applicantsDetail[0];
    // The lead sees the applicant's answers paired with each question label.
    expect(applicant.answers.length).toBe(2);
    expect(applicant.answers[0].label).toContain('programming');
    expect(applicant.answers[0].answer).toBeTruthy();
  });

  it('toggle only sticks when at least one question is provided', () => {
    const lead = sam();
    const l1 = store.createListing({ userId: lead.id, title: 'No questions', customApplication: true, customQuestions: [] });
    expect(l1.customApplication).toBe(false);
    const l2 = store.createListing({ userId: lead.id, title: 'With questions', customApplication: true, customQuestions: [{ label: 'Why?' }] });
    expect(l2.customApplication).toBe(true);
    expect(l2.customQuestions[0].id).toBeTruthy();
    expect(l2.customQuestions[0].required).toBe(true);
  });

  it('rejects an application that omits a required custom answer', () => {
    const lead = sam();
    const listing = store.createListing({ userId: lead.id, title: 'Reef team', customApplication: true, customQuestions: [{ label: 'Tools?' }] });
    const applicant = robin();
    expect(() => store.addApplication({ userId: applicant.id, userName: applicant.name, listingId: listing.id, message: 'hi' }))
      .toThrow(/Tools\?/);
  });

  it('captures answers keyed by question id when the application is valid', () => {
    const lead = sam();
    const listing = store.createListing({ userId: lead.id, title: 'Reef team', customApplication: true, customQuestions: [{ label: 'Tools?' }] });
    const qid = listing.customQuestions[0].id;
    const applicant = robin();
    const app = store.addApplication({ userId: applicant.id, userName: applicant.name, listingId: listing.id, message: 'hi', answers: { [qid]: 'Python' } });
    expect(app.answers[qid]).toBe('Python');
    const seen = store.myListings(lead.id).find((l) => l.id === listing.id).applicantsDetail.find((a) => a.userId === applicant.id);
    expect(seen.answers[0].answer).toBe('Python');
  });

  it('ignores answers for a listing without custom application', () => {
    const lead = sam();
    const listing = store.createListing({ userId: lead.id, title: 'Plain', customApplication: false });
    const applicant = robin();
    const app = store.addApplication({ userId: applicant.id, userName: applicant.name, listingId: listing.id, message: 'hi', answers: { whatever: 'x' } });
    expect(app.answers).toBeNull();
  });

  it('editing a listing replaces its questions', () => {
    const lead = sam();
    const listing = store.createListing({ userId: lead.id, title: 'Reef team', customApplication: true, customQuestions: [{ label: 'A' }] });
    const updated = store.updateListing({ listingId: listing.id, leadId: lead.id, customQuestions: [{ label: 'B' }, { label: 'C' }] });
    expect(updated.customQuestions.map((q) => q.label)).toEqual(['B', 'C']);
    expect(updated.customApplication).toBe(true);
  });
});

describe('applicant review → accept joins the project team (§5.6)', () => {
  it('accepting an applicant adds them to the linked project and bumps the filled count', () => {
    const lead = sam();
    const listing = store.myListings(lead.id).find((l) => l.customApplication);
    const app = listing.applicantsDetail.find((a) => a.status === 'pending');
    const before = store.getProject(listing.projectId).members.length;

    store.reviewListingApplication({ leadId: lead.id, appId: app.id, status: 'approved' });

    const project = store.getProject(listing.projectId);
    expect(project.members.includes(app.userId)).toBe(true);
    expect(project.members.length).toBe(before + 1);
    // The Hub's filled count is driven by approved applicants (+ lead).
    const onHub = store.listListings().find((l) => l.id === listing.id);
    expect(onHub.filled).toBeGreaterThanOrEqual(2);
  });

  it('accepting is idempotent — the member is not added twice', () => {
    const lead = sam();
    const listing = store.myListings(lead.id).find((l) => l.customApplication);
    const app = listing.applicantsDetail.find((a) => a.status === 'pending');
    store.reviewListingApplication({ leadId: lead.id, appId: app.id, status: 'approved' });
    store.reviewListingApplication({ leadId: lead.id, appId: app.id, status: 'approved' });
    const members = store.getProject(listing.projectId).members.filter((m) => m === app.userId);
    expect(members.length).toBe(1);
  });

  it('rejecting notifies but does not add to the team', () => {
    const lead = sam();
    const listing = store.myListings(lead.id).find((l) => l.customApplication);
    const app = listing.applicantsDetail.find((a) => a.status === 'pending');
    store.reviewListingApplication({ leadId: lead.id, appId: app.id, status: 'rejected' });
    expect(store.getProject(listing.projectId).members.includes(app.userId)).toBe(false);
  });

  it('a lead cannot review applications on a listing they do not own', () => {
    const lead = sam();
    const listing = store.myListings(lead.id).find((l) => l.customApplication);
    const app = listing.applicantsDetail.find((a) => a.status === 'pending');
    const other = robin();
    expect(() => store.reviewListingApplication({ leadId: other.id, appId: app.id, status: 'approved' })).toThrow();
  });
});
