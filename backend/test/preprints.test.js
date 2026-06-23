import { describe, it, expect, beforeEach } from 'vitest';
import * as store from '../src/store.js';

beforeEach(async () => { await store.reset(); });

const sam = () => store.authenticate('sam@example.com', 'demo1234');
const jordan = () => store.authenticate('jordan@example.com', 'demo1234');
const robin = () => store.authenticate('robin@example.com', 'demo1234');

describe('preprints', () => {
  it('ships seeded preprints with Synthica IDs', () => {
    const list = store.listPreprints();
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list[0].synId).toMatch(/^SYN-\d{4}-\d{4}$/);
  });

  it('posts a preprint, mints a unique ID, and surfaces it for the author', () => {
    const u = sam();
    const view = store.postPreprint({ userId: u.id, title: 'A new method', category: 'Physics', abstract: 'x', pdfUrl: 'example.com/p.pdf' });
    expect(view.synId).toMatch(/^SYN-\d{4}-\d{4}$/);
    expect(view.versions[0].pdfUrl).toBe('https://example.com/p.pdf'); // sanitized
    expect(view.canEdit).toBe(true);
    expect(store.myPreprints(u.id).some((p) => p.id === view.id)).toBe(true);
  });

  it('versions: only an author can post a new version, and it becomes latest', () => {
    const u = sam();
    const v = store.postPreprint({ userId: u.id, title: 'Versioned', category: 'Biology', pdfUrl: 'example.com/v1.pdf' });
    expect(() => store.addPreprintVersion({ preprintId: v.id, userId: robin().id, pdfUrl: 'example.com/x.pdf' })).toThrow(/author or staff/i);
    const v2 = store.addPreprintVersion({ preprintId: v.id, userId: u.id, pdfUrl: 'example.com/v2.pdf', note: 'more data' });
    expect(v2.versions[0].v).toBe(2);
    expect(v2.latestPdf).toBe('https://example.com/v2.pdf');
  });

  it('tagging a member surfaces the preprint on their profile + dashboard', () => {
    const u = sam(), j = jordan();
    const v = store.postPreprint({ userId: u.id, title: 'Tag me', category: 'Chemistry' });
    const out = store.tagPreprintAccounts({ preprintId: v.id, actorId: u.id, addUserIds: [j.id] });
    expect(out.taggedAccounts.map((t) => t.id)).toContain(j.id);
    expect(store.myPreprints(j.id).some((p) => p.id === v.id)).toBe(true);
  });

  it('links a preprint to a published article both ways (Phase 4)', () => {
    const u = sam();
    const pre = store.postPreprint({ userId: u.id, title: 'Linkable work', category: 'Biology' });
    const pub = store.listPublications()[0];

    // A random member can't link.
    expect(() => store.linkPreprintToPublication({ preprintId: pre.id, pubId: pub.id, actorId: robin().id })).toThrow(/author or staff/i);

    const article = store.linkPreprintToPublication({ preprintId: pre.id, pubId: pub.id, actorId: u.id });
    expect(article.preprint.synId).toBe(pre.synId); // article shows its preprint

    const pv = store.preprintView(pre.id, u.id);
    expect(pv.linkedDoi).toBe(pub.doi);   // preprint shows the published DOI
    expect(pv.linkedPubId).toBe(pub.id);  // and links back in-site
  });
});
