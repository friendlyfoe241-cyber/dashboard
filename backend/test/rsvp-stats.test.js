import { describe, it, expect, beforeEach } from 'vitest';
import * as store from '../src/store.js';

beforeEach(async () => { await store.reset(); });

const director = () => store.authenticate('director@synthica.org', 'demo1234');
const sam = () => store.authenticate('sam@example.com', 'demo1234');
const jordan = () => store.authenticate('jordan@example.com', 'demo1234');

describe('event RSVPs', () => {
  it('a member RSVPs to a global workshop and it shows on their calendar', () => {
    const ev = store.addEvent({ userId: director().id, title: 'Intro Workshop', type: 'workshop', dueAt: '2026-09-01' });
    const r = store.rsvpEvent({ eventId: ev.id, userId: sam().id, going: true });
    expect(r.rsvpCount).toBe(1);
    expect(r.going).toBe(true);
    const item = store.calendarFor(sam().id).find((x) => x.eventId === ev.id);
    expect(item.rsvpable).toBe(true);
    expect(item.going).toBe(true);
    expect(item.rsvpCount).toBe(1);
  });

  it('un-RSVP removes the member', () => {
    const ev = store.addEvent({ userId: director().id, title: 'Meetup', type: 'meetup', dueAt: '2026-09-02' });
    store.rsvpEvent({ eventId: ev.id, userId: sam().id, going: true });
    const r = store.rsvpEvent({ eventId: ev.id, userId: sam().id, going: false });
    expect(r.rsvpCount).toBe(0);
    expect(r.going).toBe(false);
  });
});

describe('profile views + member stats', () => {
  it('counts views from others but not the owner', () => {
    const u = sam();
    store.recordProfileView(u.slug, jordan().id); // other
    store.recordProfileView(u.slug, jordan().id); // other
    store.recordProfileView(u.slug, u.id);        // self — ignored
    store.recordProfileView(u.slug, null);        // anonymous — counts
    expect(store.myStats(u.id).profileViews).toBe(3);
  });

  it('myStats aggregates posts, projects, groups, referrals', () => {
    const u = sam();
    store.createPost({ userId: u.id, text: 'hi' });
    store.createGroup({ userId: u.id, name: 'Stats Group' });
    store.registerResearcher({ name: 'Ref One', email: 'ref1@example.com', discord: 'r1', password: 'hunter22', ref: store.referralCodeFor(u.id) });
    const s = store.myStats(u.id);
    expect(s.posts).toBeGreaterThanOrEqual(1); // seed has a post by Sam too
    expect(s.groups).toBeGreaterThanOrEqual(1);
    expect(s.referrals).toBe(1);
    expect(s.projects).toBeGreaterThanOrEqual(1); // sam leads seed projects
  });
});
