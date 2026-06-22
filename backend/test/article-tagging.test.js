import { describe, it, expect, beforeEach } from 'vitest';
import * as store from '../src/store.js';

beforeEach(async () => { await store.reset(); });

const director = () => store.authenticate('director@synthica.org', 'demo1234');
const jordan = () => store.authenticate('jordan@example.com', 'demo1234');
const robin = () => store.authenticate('robin@example.com', 'demo1234');

const aPub = () => store.listPublications()[0];

describe('article view + account tagging', () => {
  it('returns a hero payload with related papers and a canTag flag', () => {
    const pub = aPub();
    const view = store.articleView(pub.id, director().id);
    expect(view.title).toBe(pub.title);
    expect(Array.isArray(view.authors)).toBe(true);
    expect(Array.isArray(view.related)).toBe(true);
    expect(view.canTag).toBe(true); // staff can tag
    expect(store.articleView(pub.id, robin().id).canTag).toBe(false); // a random member can't
  });

  it('staff tags an account; it surfaces on the member’s profile + dashboard', () => {
    const pub = aPub();
    const j = jordan();
    const out = store.tagPublicationAccounts({ pubId: pub.id, actorId: director().id, addUserIds: [j.id] });
    expect(out.taggedAccounts.map((t) => t.id)).toContain(j.id);

    // Tagged paper now appears in the member's own publications + public profile.
    expect(store.myPublications(j.id).some((p) => p.id === pub.id)).toBe(true);
    const profile = store.getPublicProfile(j.slug);
    expect(profile.publications.some((p) => p.doi === pub.doi)).toBe(true);

    // Untag removes it again.
    const after = store.tagPublicationAccounts({ pubId: pub.id, actorId: director().id, removeUserIds: [j.id] });
    expect(after.taggedAccounts.map((t) => t.id)).not.toContain(j.id);
    expect(store.myPublications(j.id).some((p) => p.id === pub.id)).toBe(false);
  });

  it('refuses tagging from a member who is neither an author nor staff', () => {
    const pub = aPub();
    expect(() => store.tagPublicationAccounts({ pubId: pub.id, actorId: robin().id, addUserIds: [jordan().id] }))
      .toThrow(/author or staff/i);
  });
});
