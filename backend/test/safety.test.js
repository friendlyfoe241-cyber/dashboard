import { describe, it, expect, beforeEach } from 'vitest';
import * as store from '../src/store.js';

beforeEach(async () => { await store.reset(); });

const sam = () => store.authenticate('sam@example.com', 'demo1234');      // lead
const jordan = () => store.authenticate('jordan@example.com', 'demo1234'); // associate
const robin = () => store.authenticate('robin@example.com', 'demo1234');   // independent
const director = () => store.authenticate('director@synthica.org', 'demo1234');

describe('blocking', () => {
  it('hides a blocked user’s posts from the feed and stops DMs both ways', () => {
    const a = robin(), b = sam();
    store.createPost({ userId: b.id, text: 'hello from sam' });
    expect(store.listPosts(a.id).some((p) => p.author.id === b.id)).toBe(true);

    store.blockUser(a.id, b.id);
    expect(store.listPosts(a.id).some((p) => p.author.id === b.id)).toBe(false); // hidden for the blocker

    expect(() => store.sendMessage({ from: a.id, to: b.id, text: 'hi' })).toThrow(/no longer message/i);
    expect(() => store.sendMessage({ from: b.id, to: a.id, text: 'hi' })).toThrow(/no longer message/i); // blocked the other way too

    store.unblockUser(a.id, b.id);
    expect(store.listPosts(a.id).some((p) => p.author.id === b.id)).toBe(true);
  });

  it('lists who you’ve blocked', () => {
    store.blockUser(robin().id, sam().id);
    const blocked = store.listBlocked(robin().id);
    expect(blocked).toHaveLength(1);
    expect(blocked[0].id).toBe(sam().id);
  });
});

describe('reporting + moderation', () => {
  it('files a report, surfaces it in the queue, and removing it deletes the post', () => {
    const post = store.createPost({ userId: sam().id, text: 'spammy thing' });
    store.reportContent({ reporterId: jordan().id, kind: 'post', targetId: post.id, reason: 'spam' });

    const queue = store.listReports('open');
    expect(queue).toHaveLength(1);
    expect(queue[0].targetOwnerId).toBe(sam().id);
    expect(queue[0].snippet).toContain('spammy');

    store.resolveReport({ id: queue[0].id, actor: director(), action: 'remove' });
    expect(store.listReports('open')).toHaveLength(0);
    expect(store.listPosts(jordan().id).some((p) => p.id === post.id)).toBe(false); // post gone
  });

  it('de-dupes a double report and refuses self-reports', () => {
    const post = store.createPost({ userId: sam().id, text: 'x' });
    store.reportContent({ reporterId: jordan().id, kind: 'post', targetId: post.id, reason: 'a' });
    store.reportContent({ reporterId: jordan().id, kind: 'post', targetId: post.id, reason: 'b' });
    expect(store.listReports('open')).toHaveLength(1); // second is a no-op
    expect(() => store.reportContent({ reporterId: sam().id, kind: 'post', targetId: post.id })).toThrow(/your own/i);
  });

  it('suspend action removes the content and suspends the author; non-mods are refused', () => {
    const post = store.createPost({ userId: sam().id, text: 'bad' });
    store.reportContent({ reporterId: jordan().id, kind: 'post', targetId: post.id, reason: 'abuse' });
    const r = store.listReports('open')[0];
    expect(() => store.resolveReport({ id: r.id, actor: jordan(), action: 'suspend' })).toThrow(/moderators/i);

    store.resolveReport({ id: r.id, actor: director(), action: 'suspend' });
    expect(() => store.authenticate('sam@example.com', 'demo1234')).toThrow(/suspended/i);
  });
});

describe('account export + deletion', () => {
  it('exports the member’s own data without secrets', () => {
    const u = sam();
    store.createPost({ userId: u.id, text: 'my post' });
    const dump = store.exportMyData(u.id);
    expect(dump.profile.email).toBe('sam@example.com');
    expect(dump.profile.password).toBeUndefined();
    expect(dump.profile.twoFactorSecret).toBeUndefined();
    expect(dump.posts.some((p) => p.text === 'my post')).toBe(true);
  });

  it('deletes the account and its content, transferring a led group', () => {
    const lead = sam();
    const g = store.createGroup({ userId: lead.id, name: 'Handover Lab' });
    store.joinGroup({ groupId: g.id, userId: jordan().id });
    const post = store.createPost({ userId: lead.id, text: 'bye' });

    store.deleteMyAccount(lead.id);

    expect(store.getUserById(lead.id)).toBeFalsy();
    expect(() => store.authenticate('sam@example.com', 'demo1234')).not.toThrow();
    expect(store.authenticate('sam@example.com', 'demo1234')).toBeNull(); // account gone
    expect(store.listPosts(jordan().id).some((p) => p.id === post.id)).toBe(false); // their post removed
    const grp = store.groupDetail(g.id, jordan().id);
    expect(grp.leaderId).toBe(jordan().id); // leadership handed to the remaining member
  });

  it('refuses to self-delete a staff account', () => {
    expect(() => store.deleteMyAccount(director().id)).toThrow(/administrator/i);
  });
});
