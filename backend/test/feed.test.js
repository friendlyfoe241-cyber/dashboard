import { describe, it, expect, beforeEach } from 'vitest';
import * as store from '../src/store.js';

beforeEach(async () => { await store.reset(); });

const sam = () => store.authenticate('sam@example.com', 'demo1234');
const jordan = () => store.authenticate('jordan@example.com', 'demo1234');

describe('community feed', () => {
  it('creates a post and lists it newest-first with author info', () => {
    const u = sam();
    const created = store.createPost({ userId: u.id, text: 'Hello world' });
    expect(created.author.name).toBe('Sam Rivera');
    const list = store.listPosts(u.id);
    expect(list[0].id).toBe(created.id);
    expect(list[0].text).toBe('Hello world');
  });

  it('rejects empty posts and sanitizes link URLs', () => {
    const u = sam();
    expect(() => store.createPost({ userId: u.id, text: '   ' })).toThrow();
    const p = store.createPost({ userId: u.id, text: 'link', linkUrl: 'javascript:alert(1)' });
    expect(p.linkUrl).toBe(''); // dangerous scheme stripped
  });

  it('toggles likes and reflects likedByMe', () => {
    const author = sam();
    const liker = jordan();
    const post = store.createPost({ userId: author.id, text: 'like me' });
    let p = store.togglePostLike({ postId: post.id, userId: liker.id });
    expect(p.likeCount).toBe(1);
    expect(store.listPosts(liker.id).find((x) => x.id === post.id).likedByMe).toBe(true);
    p = store.togglePostLike({ postId: post.id, userId: liker.id });
    expect(p.likeCount).toBe(0);
  });

  it('adds comments with author info', () => {
    const u = sam();
    const post = store.createPost({ userId: u.id, text: 'discuss' });
    const p = store.addPostComment({ postId: post.id, userId: jordan().id, text: 'nice!' });
    expect(p.commentCount).toBe(1);
    expect(p.comments[0].author.name).toBe('Jordan Kim');
    expect(p.comments[0].text).toBe('nice!');
  });

  it('only the author (or staff) can delete; counts surface for profile stats', () => {
    const u = sam();
    const post = store.createPost({ userId: u.id, text: 'mine' });
    expect(() => store.deletePost({ postId: post.id, userId: jordan().id })).toThrow();
    expect(store.postCountFor(u.id)).toBeGreaterThanOrEqual(1);
    store.deletePost({ postId: post.id, userId: u.id });
    expect(store.listPosts(u.id).some((x) => x.id === post.id)).toBe(false);
  });
});
