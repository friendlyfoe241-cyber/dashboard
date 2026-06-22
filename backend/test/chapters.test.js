import { describe, it, expect, beforeEach } from 'vitest';
import * as store from '../src/store.js';

beforeEach(async () => { await store.reset(); });

const taylor = () => store.authenticate('taylor@example.com', 'demo1234'); // Bay Area chapter leader
const jordan = () => store.authenticate('jordan@example.com', 'demo1234'); // associate, not in the chapter

describe('chapter join codes', () => {
  it('exposes an 8-character alphanumeric join code on the leader dashboard', () => {
    const view = store.chapterView(taylor().id);
    expect(view).toBeTruthy();
    expect(view.joinCode).toMatch(/^[A-Z0-9]{8}$/);
  });

  it('keeps the seeded demo code stable', () => {
    expect(store.chapterView(taylor().id).joinCode).toBe('BAYAREA7');
  });

  it('regenerate produces a new, different, still-unique 8-char code', () => {
    const leader = taylor();
    const before = store.chapterView(leader.id).joinCode;
    const { joinCode: after } = store.regenerateJoinCode(leader.id);
    expect(after).toMatch(/^[A-Z0-9]{8}$/);
    expect(after).not.toBe(before);
    // The old code no longer resolves to a chapter.
    expect(() => store.joinChapterByCode({ userId: jordan().id, code: before })).toThrow();
    // The new code does.
    const res = store.joinChapterByCode({ userId: jordan().id, code: after });
    expect(res.chapterName).toBe('Bay Area Chapter');
  });

  it('only the chapter leader can regenerate the code', () => {
    expect(() => store.regenerateJoinCode(jordan().id)).toThrow();
  });
});

describe('joining a chapter by code', () => {
  it('adds the caller to the roster with a fresh onboarding checklist', () => {
    const member = jordan();
    const code = store.chapterView(taylor().id).joinCode;

    const before = store.chapterView(taylor().id).members.length;
    const res = store.joinChapterByCode({ userId: member.id, code });
    expect(res.chapterName).toBe('Bay Area Chapter');

    const view = store.chapterView(taylor().id);
    expect(view.members.length).toBe(before + 1);
    const row = view.members.find((m) => m.userId === member.id);
    expect(row).toBeTruthy();
    expect(row.onboardingPct).toBe(0); // fresh checklist, nothing done yet

    // The member can now read their own onboarding.
    const ob = store.myOnboarding(member.id);
    expect(ob.chapterName).toBe('Bay Area Chapter');
    expect(ob.steps.length).toBeGreaterThan(0);
  });

  it('is case-insensitive and tolerates surrounding whitespace', () => {
    const member = jordan();
    const code = store.chapterView(taylor().id).joinCode;
    const res = store.joinChapterByCode({ userId: member.id, code: `  ${code.toLowerCase()} ` });
    expect(res.chapterName).toBe('Bay Area Chapter');
  });

  it('tags a joining member as an associate researcher', () => {
    const member = jordan();
    const code = store.chapterView(taylor().id).joinCode;
    store.joinChapterByCode({ userId: member.id, code });
    expect(store.getUserById(member.id).tags).toContain('associate_researcher');
  });

  it('rejects an unknown code', () => {
    expect(() => store.joinChapterByCode({ userId: jordan().id, code: 'NOPENOPE' })).toThrow();
  });

  it('rejects an empty code', () => {
    expect(() => store.joinChapterByCode({ userId: jordan().id, code: '   ' })).toThrow();
  });

  it('rejects joining a chapter twice', () => {
    const member = jordan();
    const code = store.chapterView(taylor().id).joinCode;
    store.joinChapterByCode({ userId: member.id, code });
    expect(() => store.joinChapterByCode({ userId: member.id, code })).toThrow();
  });

  it('notifies the chapter leader when someone joins', () => {
    const leader = taylor();
    const member = jordan();
    const code = store.chapterView(leader.id).joinCode;
    store.joinChapterByCode({ userId: member.id, code });
    const notifs = store.listNotifications(leader.id);
    expect(notifs.some((n) => /joined/i.test(n.title))).toBe(true);
  });
});
