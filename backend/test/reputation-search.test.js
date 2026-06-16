import { describe, it, expect, beforeEach } from 'vitest';
import * as store from '../src/store.js';

beforeEach(async () => { await store.reset(); });

const sam = () => store.authenticate('sam@example.com', 'demo1234');
const robin = () => store.authenticate('robin@example.com', 'demo1234');

describe('badges & reputation', () => {
  it('awards badges from activity and reputation reflects contributions', () => {
    const u = sam(); // leads seed projects + has a seeded publication? at least leads projects
    const badges = store.badgesFor(u.id);
    expect(badges.some((b) => b.id === 'lead')).toBe(true); // sam leads projects
    const before = store.reputationFor(u.id);
    store.createGroup({ userId: u.id, name: 'Rep Group' });
    expect(store.reputationFor(u.id)).toBeGreaterThan(before); // founding a group adds points
    expect(store.badgesFor(u.id).some((b) => b.id === 'founder')).toBe(true);

    const profile = store.getPublicProfile(u.slug);
    expect(Array.isArray(profile.badges)).toBe(true);
    expect(typeof profile.reputation).toBe('number');
  });

  it('community contributor badge needs 5 posts', () => {
    const u = robin();
    expect(store.badgesFor(u.id).some((b) => b.id === 'contributor')).toBe(false);
    for (let i = 0; i < 5; i++) store.createPost({ userId: u.id, text: `post ${i}` });
    expect(store.badgesFor(u.id).some((b) => b.id === 'contributor')).toBe(true);
  });
});

describe('global search', () => {
  it('finds people, groups, and publications by query', () => {
    const viewer = sam();
    const people = store.searchAll('rivera', viewer.id);
    expect(people.people.some((p) => /Rivera/i.test(p.name))).toBe(true);

    store.createGroup({ userId: viewer.id, name: 'Quantum Computing Club', category: 'Physics' });
    const g = store.searchAll('quantum', viewer.id);
    expect(g.groups.some((x) => /Quantum/i.test(x.name))).toBe(true);

    const pubs = store.searchAll('microplastic', viewer.id);
    expect(pubs.publications.length).toBeGreaterThanOrEqual(1);
  });

  it('only returns projects the viewer is a member of', () => {
    const viewer = robin(); // not on sam's seed projects
    const r = store.searchAll('air quality', viewer.id); // a seed project title
    expect(r.projects.length).toBe(0);
    const samView = store.searchAll('air quality', sam().id);
    expect(samView.projects.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty for very short queries', () => {
    const r = store.searchAll('a', sam().id);
    expect(r.people).toEqual([]);
  });
});
