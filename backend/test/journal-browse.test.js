import { describe, it, expect, beforeEach } from 'vitest';
import * as store from '../src/store.js';

beforeEach(async () => { await store.reset(); });

describe('journal home + volumes/issues', () => {
  it('overview returns a featured article, volumes, subjects, and stats', () => {
    const o = store.journalOverview();
    expect(o.stats.papers).toBeGreaterThan(0);
    expect(o.featured).toBeTruthy();
    expect(o.featured.title).toBeTruthy();
    expect(Array.isArray(o.volumes)).toBe(true);
    expect(o.volumes.length).toBeGreaterThan(0);
    // volumes sorted newest first; each has issues with counts
    expect(o.volumes[0]).toHaveProperty('volume');
    expect(o.volumes[0].issues[0]).toHaveProperty('count');
    expect(Array.isArray(o.subjects)).toBe(true);
    expect(o.latestIssue).toHaveProperty('volume');
  });

  it('issueContents returns only the articles in that volume/issue', () => {
    const o = store.journalOverview();
    const { volume, issue } = o.latestIssue;
    const toc = store.issueContents(volume, issue);
    expect(toc.volume).toBe(Number(volume));
    expect(toc.count).toBe(toc.articles.length);
    expect(toc.articles.every((a) => (a.volume || 1) === Number(volume) && (a.issue || 1) === Number(issue))).toBe(true);
  });
});
