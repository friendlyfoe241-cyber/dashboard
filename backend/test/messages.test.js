import { describe, it, expect, beforeEach } from 'vitest';
import * as store from '../src/store.js';

beforeEach(async () => { await store.reset(); });

const sam = () => store.authenticate('sam@example.com', 'demo1234');
const jordan = () => store.authenticate('jordan@example.com', 'demo1234');

describe('direct messages', () => {
  it('sends a message, threads it, and counts unread', () => {
    const a = sam(); const b = jordan();
    store.sendMessage({ from: a.id, to: b.id, text: 'Hey, want to collaborate?' });

    // Recipient sees it unread in conversations.
    const bConvos = store.listConversations(b.id);
    expect(bConvos[0].user.id).toBe(a.id);
    expect(bConvos[0].unread).toBe(1);
    expect(store.unreadMessageCount(b.id)).toBe(1);

    // Opening the thread marks it read.
    const thread = store.getThread(b.id, a.id);
    expect(thread.messages).toHaveLength(1);
    expect(thread.messages[0].mine).toBe(false);
    expect(store.unreadMessageCount(b.id)).toBe(0);

    // Reply shows for the sender as "mine".
    store.sendMessage({ from: b.id, to: a.id, text: 'Yes!' });
    const aThread = store.getThread(a.id, b.id);
    expect(aThread.messages.map((m) => m.mine)).toEqual([true, false]);
  });

  it('rejects empty / self messages', () => {
    const a = sam();
    expect(() => store.sendMessage({ from: a.id, to: a.id, text: 'hi' })).toThrow();
    expect(() => store.sendMessage({ from: a.id, to: jordan().id, text: '   ' })).toThrow();
  });

  it('emits a realtime event to the recipient', () => {
    const a = sam(); const b = jordan();
    const seen = [];
    const unsub = store.subscribeRealtime((uid, type) => seen.push({ uid, type }));
    store.sendMessage({ from: a.id, to: b.id, text: 'ping' });
    unsub();
    expect(seen.some((e) => e.uid === b.id && e.type === 'message')).toBe(true);
  });
});

describe('network', () => {
  it('reports following, followers, and mutuals', () => {
    const a = sam(); const b = jordan();
    store.unfollowUser(a.id, b.id); // reset any seed follow
    store.unfollowUser(b.id, a.id);
    store.followUser(a.id, b.id);
    store.followUser(b.id, a.id);
    const net = store.networkFor(a.id);
    expect(net.following.some((u) => u.id === b.id && u.mutual)).toBe(true);
    expect(net.followers.some((u) => u.id === b.id)).toBe(true);
  });
});
