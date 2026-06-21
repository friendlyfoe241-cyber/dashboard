import { describe, it, expect, beforeEach } from 'vitest';
import * as store from '../src/store.js';
import * as seed from '../src/seed.js';

// Fresh seed before each test so pipeline mutations never leak between cases.
beforeEach(async () => { await store.reset(); });

// Biology editors used across the tiers.
const reviewer1 = () => seed.editors.find((e) => e.role === 'reviews' && e.category === 'Biology');
const reviewer2 = () => seed.editors.filter((e) => e.role === 'reviews' && e.category === 'Biology')[1];
const senior = () => seed.editors.find((e) => e.role === 'senior' && e.category === 'Biology');
const associate = () => seed.editors.find((e) => e.role === 'associate' && e.category === 'Biology');
const chief = () => seed.editors.find((e) => e.role === 'chief');

// First Biology paper sitting in the reviews queue (seed assigns reviewers).
const bioPaperId = () => store.papersForEditor(reviewer1().id).inbox[0].id;
const paperForReviewer = (rid, pid) =>
  [...store.papersForEditor(rid).inbox, ...store.papersForEditor(rid).archive].find((p) => p.id === pid);

describe('reviews stage — 2-of-2 consensus + peer visibility', () => {
  it('advances to senior screening only when BOTH reviewers approve', () => {
    const pid = bioPaperId();
    store.submitReviewDecision({ paperId: pid, editorId: reviewer1().id, decision: 'approve', comments: 'solid', recommendation: 'advance' });
    // Still in review with one approval outstanding.
    expect(paperForReviewer(reviewer2().id, pid).stage).toBe('review');
    const after = store.submitReviewDecision({ paperId: pid, editorId: reviewer2().id, decision: 'approve', comments: 'agree', recommendation: 'advance' });
    expect(after.stage).toBe('senior_screen');
  });

  it('declines on any non-unanimous combination (approve + reject)', () => {
    const pid = bioPaperId();
    store.submitReviewDecision({ paperId: pid, editorId: reviewer1().id, decision: 'approve', comments: 'ok', recommendation: 'go' });
    const after = store.submitReviewDecision({ paperId: pid, editorId: reviewer2().id, decision: 'reject', comments: 'weak controls' });
    expect(after.stage).toBe('rejected');
    expect(store.directorView().toEmail.some((e) => e.decision === 'declined')).toBe(true);
  });

  it('shows the co-reviewer’s full feedback + recommendation to the peer (live visibility)', () => {
    const pid = bioPaperId();
    store.submitReviewDecision({ paperId: pid, editorId: reviewer1().id, decision: 'approve', comments: 'great methods', recommendation: 'strong accept' });
    // Reviewer 2 opens the paper and sees reviewer 1's decision filled in.
    const seenByR2 = paperForReviewer(reviewer2().id, pid);
    expect(seenByR2.coReviewerDecision).toBe('approve');
    expect(seenByR2.coReview).toMatchObject({ decision: 'approve', comments: 'great methods', recommendation: 'strong accept' });
  });

  it('requires feedback, and a recommendation only when approving', () => {
    const pid = bioPaperId();
    expect(() => store.submitReviewDecision({ paperId: pid, editorId: reviewer1().id, decision: 'approve', comments: '' }))
      .toThrow(/feedback/i);
    expect(() => store.submitReviewDecision({ paperId: pid, editorId: reviewer1().id, decision: 'approve', comments: 'ok' }))
      .toThrow(/recommendation/i);
    // Reject needs no recommendation.
    expect(() => store.submitReviewDecision({ paperId: pid, editorId: reviewer1().id, decision: 'reject', comments: 'no' }))
      .not.toThrow();
  });

  it('hides author identity from reviews editors (single-blind)', () => {
    const pid = bioPaperId();
    const seen = store.papersForEditor(reviewer1().id).inbox.find((p) => p.id === pid);
    expect(seen.authorEmail).toBeNull();
    expect(seen.authorName).toBe('Anonymous author');
  });
});

describe('senior stage — sees the full reviews chain', () => {
  it('passes both reviews decisions + feedback + recommendations to the senior screen', () => {
    const pid = bioPaperId();
    store.submitReviewDecision({ paperId: pid, editorId: reviewer1().id, decision: 'approve', comments: 'fb1', recommendation: 'rec1' });
    store.submitReviewDecision({ paperId: pid, editorId: reviewer2().id, decision: 'approve', comments: 'fb2', recommendation: 'rec2' });
    const onSenior = store.papersForEditor(senior().id).inbox.find((p) => p.id === pid);
    expect(onSenior.priorFeedback).toHaveLength(2);
    expect(onSenior.priorFeedback.every((f) => f.role === 'reviews')).toBe(true);
    expect(onSenior.priorFeedback.map((f) => f.comments).sort()).toEqual(['fb1', 'fb2']);
    expect(onSenior.priorFeedback.map((f) => f.recommendation).sort()).toEqual(['rec1', 'rec2']);
    // Author email IS visible to the senior (not single-blind).
    expect(onSenior.authorEmail).toBeTruthy();
  });
});

describe('chief stage — feedback is required on the final decision', () => {
  // Drive a paper all the way to the chief.
  const driveToChief = () => {
    const pid = bioPaperId();
    store.submitReviewDecision({ paperId: pid, editorId: reviewer1().id, decision: 'approve', comments: 'ok', recommendation: 'go' });
    store.submitReviewDecision({ paperId: pid, editorId: reviewer2().id, decision: 'approve', comments: 'ok', recommendation: 'go' });
    store.seniorDecision({ paperId: pid, editorId: senior().id, decision: 'approve', comments: 'screened' });
    store.associateRound({ paperId: pid, editorId: associate().id });
    store.associateRound({ paperId: pid, editorId: associate().id });
    store.seniorDecision({ paperId: pid, editorId: senior().id, decision: 'approve', comments: 'final ok' });
    return pid;
  };

  it('rejects an empty-feedback chief decision', () => {
    const pid = driveToChief();
    expect(() => store.chiefDecision({ paperId: pid, editorId: chief().id, decision: 'approve', comments: '' }))
      .toThrow(/feedback/i);
  });

  it('approves to the publish queue when feedback is given', () => {
    const pid = driveToChief();
    store.chiefDecision({ paperId: pid, editorId: chief().id, decision: 'approve', comments: 'accept' });
    expect(store.directorView().toPublish.some((p) => p.id === pid)).toBe(true);
  });
});

describe('audit log — every decision is recorded', () => {
  it('writes a paper_decision audit entry for a reviews approval', () => {
    const pid = bioPaperId();
    const before = store.listAudit().filter((a) => a.action === 'paper_decision').length;
    store.submitReviewDecision({ paperId: pid, editorId: reviewer1().id, decision: 'approve', comments: 'ok', recommendation: 'go' });
    const entries = store.listAudit().filter((a) => a.action === 'paper_decision');
    expect(entries.length).toBe(before + 1);
    expect(entries[0].detail).toMatch(/Reviews Editor approved/);
    expect(entries[0].actorName).toBe(reviewer1().name);
  });
});
