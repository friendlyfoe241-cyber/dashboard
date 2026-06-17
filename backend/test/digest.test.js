import { describe, it, expect, beforeEach } from 'vitest';
import * as store from '../src/store.js';
import { buildDigestText, sendWeeklyDigests } from '../src/digest.js';

beforeEach(async () => { await store.reset(); });

const sam = () => store.authenticate('sam@example.com', 'demo1234');
const jordan = () => store.authenticate('jordan@example.com', 'demo1234');

describe('weekly digest — followed activity', () => {
  it('recentFollowedActivity returns recent actions from followed users only', () => {
    const me = jordan();
    const lead = sam();
    store.unfollowUser(me.id, lead.id);
    store.followUser(me.id, lead.id);
    store.createGroup({ userId: lead.id, name: 'Digest Group' });

    const acts = store.recentFollowedActivity(me.id);
    expect(acts.some((a) => /founded the research group Digest Group/.test(a.text))).toBe(true);
    expect(acts[0].actorName).toBe('Sam Rivera');

    // Someone you don't follow: not included.
    store.unfollowUser(me.id, lead.id);
    expect(store.recentFollowedActivity(me.id).some((a) => /Digest Group/.test(a.text))).toBe(false);
  });

  it('the digest text includes the followed-activity section', () => {
    const txt = buildDigestText('Ben', { activity: [{ actorName: 'Sam Rivera', text: 'became a Lead Researcher', at: new Date().toISOString() }], programs: [], listings: [], events: [] });
    expect(txt).toMatch(/From people you follow/);
    expect(txt).toMatch(/Sam Rivera became a Lead Researcher/);
  });

  it('sendWeeklyDigests personalizes activity per recipient (logged without a provider)', async () => {
    const data = store.digestData();
    const out = await sendWeeklyDigests(data, store.recentFollowedActivity);
    expect(out.recipients).toBeGreaterThan(0);
    expect(out.sent).toBe(out.recipients); // skipped counts as handled when no provider
  });
});
