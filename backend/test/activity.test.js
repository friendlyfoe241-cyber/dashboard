import { describe, it, expect, beforeEach } from 'vitest';
import * as store from '../src/store.js';

beforeEach(async () => { await store.reset(); });

const sam = () => store.authenticate('sam@example.com', 'demo1234');       // lead researcher
const jordan = () => store.authenticate('jordan@example.com', 'demo1234'); // associate
const director = () => store.authenticate('director@synthica.org', 'demo1234');

describe('follow + activity feed', () => {
  it('a follower sees a followed lead found a group', () => {
    const me = jordan();
    const lead = sam();
    store.followUser(me.id, lead.id);
    store.createGroup({ userId: lead.id, name: 'Macro Club' });
    const acts = store.feedFor(me.id).filter((f) => f.type === 'activity');
    expect(acts.some((a) => /founded the research group Macro Club/.test(a.title))).toBe(true);
  });

  it('does NOT show activity from people you do not follow', () => {
    const me = jordan();
    const lead = sam();
    store.unfollowUser(me.id, lead.id); // seed has jordan following sam — undo it
    store.createProject({ userId: lead.id, title: 'Hidden Project' });
    expect(store.feedFor(me.id).some((f) => f.type === 'activity' && /Hidden Project/.test(f.title))).toBe(false);
  });

  it('records a role change (became a Lead Researcher) for followers', () => {
    const me = sam();
    const newbie = store.registerResearcher({ name: 'Up Comer', email: 'up@example.com', discord: 'up', password: 'hunter22' });
    store.followUser(me.id, newbie.id);
    store.auditorSetTags({ userId: newbie.id, addTags: ['lead_researcher'], actor: director() });
    expect(store.feedFor(me.id).some((f) => f.type === 'activity' && /became a Lead Researcher/.test(f.title))).toBe(true);
  });

  it('records a paper advancing to a later round for the author', () => {
    const author = sam();
    const me = jordan();
    store.followUser(me.id, author.id);
    const sub = store.submitToJournal({ userId: author.id, title: 'Reef Models', category: 'Biology', abstract: 'x'.repeat(20), pdfUrl: 'https://drive.google.com/file/d/X/view' });
    const full = store.exportAll().submissions.find((s) => s.id === sub.id);
    for (const rid of full.assignedReviewers) {
      store.submitReviewDecision({ paperId: sub.id, editorId: rid, decision: 'approve', comments: 'ok', recommendation: 'advance' });
    }
    expect(store.feedFor(me.id).some((f) => f.type === 'activity' && /advanced their paper/.test(f.title))).toBe(true);
  });
});
