import { describe, it, expect, beforeEach } from 'vitest';
import * as store from '../src/store.js';

beforeEach(async () => { await store.reset(); });

const director = () => store.authenticate('director@synthica.org', 'demo1234');

describe('admin: suspension', () => {
  it('a suspended member cannot log in; reactivation restores access', () => {
    const u = store.registerResearcher({ name: 'Risky User', email: 'risky@example.com', discord: 'risky', password: 'hunter22' });
    expect(store.authenticate('risky@example.com', 'hunter22')).toBeTruthy();

    store.setUserSuspended({ userId: u.id, suspended: true, actor: director() });
    expect(() => store.authenticate('risky@example.com', 'hunter22')).toThrow(/suspended/i);

    store.setUserSuspended({ userId: u.id, suspended: false, actor: director() });
    expect(store.authenticate('risky@example.com', 'hunter22')).toBeTruthy();
  });

  it('admin user list reports suspended state', () => {
    const u = store.registerResearcher({ name: 'X Y', email: 'xy@example.com', discord: 'xy', password: 'hunter22' });
    store.setUserSuspended({ userId: u.id, suspended: true, actor: director() });
    const row = store.adminListUsers('xy@example.com')[0];
    expect(row.suspended).toBe(true);
  });
});

describe('admin: broadcast recipients', () => {
  it('targets a segment and skips suspended / unapproved accounts', () => {
    const all = store.broadcastRecipients('all');
    const researchers = store.broadcastRecipients('researchers');
    expect(all.length).toBeGreaterThan(researchers.length); // all includes editors
    expect(researchers.every((r) => r.email)).toBe(true);

    // Suspend a researcher → dropped from the segment.
    const sam = store.authenticate('sam@example.com', 'demo1234');
    const before = store.broadcastRecipients('researchers').length;
    store.setUserSuspended({ userId: sam.id, suspended: true, actor: director() });
    expect(store.broadcastRecipients('researchers').length).toBe(before - 1);
  });
});

describe('admin bootstrap promotion', () => {
  it('promotes an existing researcher account to platform admin when ADMIN_EMAIL matches', async () => {
    const prevE = process.env.ADMIN_EMAIL, prevP = process.env.ADMIN_PASSWORD;
    process.env.ADMIN_EMAIL = 'jordan@example.com'; // a seed researcher
    process.env.ADMIN_PASSWORD = 'OwnerPass123';
    try {
      await store.reset(); // runs bootstrapAdmin against the freshly-seeded data
      const u = store.authenticate('jordan@example.com', 'OwnerPass123');
      expect(u).toBeTruthy();
      expect(u.kind).toBe('editor');
      expect(u.role).toBe('admin');
      expect(u.onboarded).toBe(true);
      expect(u.approved).toBe(true);
      expect(store.getResearcherById(u.id)).toBeNull(); // moved out of researchers
    } finally {
      if (prevE === undefined) delete process.env.ADMIN_EMAIL; else process.env.ADMIN_EMAIL = prevE;
      if (prevP === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = prevP;
      await store.reset();
    }
  });
});
