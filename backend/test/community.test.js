import { describe, it, expect, beforeEach } from 'vitest';
import * as store from '../src/store.js';

beforeEach(async () => { await store.reset(); });

const sam = () => store.authenticate('sam@example.com', 'demo1234');   // lead
const robin = () => store.authenticate('robin@example.com', 'demo1234'); // not a lead
const jordan = () => store.authenticate('jordan@example.com', 'demo1234');

describe('research groups', () => {
  it('a lead creates a group; only leads can', () => {
    const g = store.createGroup({ userId: sam().id, name: 'Quantum Club', category: 'Physics' });
    expect(g.id).toBeTruthy();
    expect(g.members).toContain(sam().id);
    expect(() => store.createGroup({ userId: robin().id, name: 'Nope' })).toThrow();
  });

  it('members join/leave; leader cannot leave', () => {
    const g = store.createGroup({ userId: sam().id, name: 'G' });
    store.joinGroup({ groupId: g.id, userId: robin().id });
    expect(store.groupDetail(g.id, robin().id).isMember).toBe(true);
    store.leaveGroup({ groupId: g.id, userId: robin().id });
    expect(store.groupDetail(g.id, robin().id).isMember).toBe(false);
    expect(() => store.leaveGroup({ groupId: g.id, userId: sam().id })).toThrow();
  });

  it('leader adds projects, positions, and links; positions can be filled', () => {
    const lead = sam();
    const g = store.createGroup({ userId: lead.id, name: 'Lab' });
    const proj = store.listProjects().find((p) => p.leadId === lead.id);
    store.addGroupProject({ groupId: g.id, leaderId: lead.id, projectId: proj.id });
    store.joinGroup({ groupId: g.id, userId: jordan().id });
    let d = store.addGroupPosition({ groupId: g.id, leaderId: lead.id, title: 'Data Lead' });
    const posId = d.positions[0].id;
    d = store.fillGroupPosition({ groupId: g.id, leaderId: lead.id, positionId: posId, userId: jordan().id });
    expect(d.positions[0].filledByName).toBe(jordan().name);
    d = store.addGroupLink({ groupId: g.id, leaderId: lead.id, label: 'Drive', url: 'drive.google.com/x' });
    expect(d.links[0].url).toBe('https://drive.google.com/x'); // sanitized + normalized
    expect(d.projects.some((p) => p.id === proj.id)).toBe(true);
  });

  it('group membership surfaces on the public profile', () => {
    const lead = sam();
    store.createGroup({ userId: lead.id, name: 'Visible Group' });
    const profile = store.getPublicProfile(lead.slug);
    expect(profile.groups.some((g) => g.name === 'Visible Group')).toBe(true);
  });

  it('rejects a javascript: group link', () => {
    const lead = sam();
    const g = store.createGroup({ userId: lead.id, name: 'G' });
    expect(() => store.addGroupLink({ groupId: g.id, leaderId: lead.id, label: 'x', url: 'javascript:alert(1)' })).toThrow();
  });

  it('stores a banner + logo and lets the leader edit them (URLs sanitized)', () => {
    const lead = sam();
    const g = store.createGroup({ userId: lead.id, name: 'Branded', bannerUrl: 'cdn.example.com/b.png', logoUrl: 'javascript:alert(1)' });
    expect(g.bannerUrl).toBe('https://cdn.example.com/b.png'); // normalized
    expect(g.logoUrl).toBe('');                                // dangerous scheme dropped

    const d = store.updateGroup({ groupId: g.id, leaderId: lead.id, name: 'Branded Lab', logoUrl: 'cdn.example.com/logo.png', bannerUrl: 'javascript:alert(2)' });
    expect(d.name).toBe('Branded Lab');
    expect(d.logoUrl).toBe('https://cdn.example.com/logo.png');
    expect(d.bannerUrl).toBe(''); // bad banner dropped on update too

    // list + detail surface both fields
    const row = store.listGroups().find((x) => x.id === g.id);
    expect(row.logoUrl).toBe('https://cdn.example.com/logo.png');
    expect(store.groupDetail(g.id, lead.id).bannerUrl).toBe('');
  });

  it('only the group leader can customize the group', () => {
    const g = store.createGroup({ userId: sam().id, name: 'G' });
    store.joinGroup({ groupId: g.id, userId: robin().id });
    expect(() => store.updateGroup({ groupId: g.id, leaderId: robin().id, name: 'Hijacked' })).toThrow();
  });
});

describe('competitions', () => {
  it('staff posts and members can read; delete works', () => {
    const before = store.listCompetitions().length;
    const c = store.addCompetition({ actor: { id: 'ed1', name: 'Auditor' }, title: 'Hackathon', url: 'example.com', deadline: '2026-12-01' });
    expect(c.url).toBe('https://example.com');
    expect(store.listCompetitions().length).toBe(before + 1);
    store.deleteCompetition({ id: c.id, actor: { id: 'ed1' } });
    expect(store.listCompetitions().length).toBe(before);
  });
});

describe('global + group events', () => {
  it('staff posts a platform-wide workshop that everyone sees', () => {
    store.addEvent({ userId: store.authenticate('director@synthica.org', 'demo1234').id, title: 'Intro Workshop', type: 'workshop', dueAt: '2026-09-01' });
    const cal = store.calendarFor(robin().id);
    expect(cal.some((e) => e.title === 'Intro Workshop' && e.kind === 'workshop')).toBe(true);
  });

  it('group events show only to group members', () => {
    const lead = sam();
    const g = store.createGroup({ userId: lead.id, name: 'EventGroup' });
    store.addEvent({ userId: lead.id, title: 'Group sync', type: 'meetup', dueAt: '2026-08-01', groupId: g.id });
    expect(store.calendarFor(lead.id).some((e) => e.title === 'Group sync')).toBe(true);
    expect(store.calendarFor(jordan().id).some((e) => e.title === 'Group sync')).toBe(false);
  });
});

describe('referrals', () => {
  it('assigns a code and credits the referrer on signup', () => {
    const lead = sam();
    const code = store.referralCodeFor(lead.id);
    expect(code).toMatch(/^SAM-/);
    const newbie = store.registerResearcher({ name: 'New Person', email: 'newp@example.com', discord: 'newp', password: 'hunter22', ref: code });
    expect(newbie.referredBy).toBe(lead.id);
    const stats = store.myReferralStats(lead.id);
    expect(stats.count).toBe(1);
    expect(stats.referred[0].name).toBe('New Person');
    expect(store.referralLeaderboard().find((r) => r.id === lead.id).count).toBe(1);
  });

  it('ignores an unknown referral code', () => {
    const u = store.registerResearcher({ name: 'Solo', email: 'solo@example.com', discord: 'solo', password: 'hunter22', ref: 'BOGUS-CODE' });
    expect(u.referredBy).toBeNull();
    expect(u.referralCode).toBeTruthy();
  });
});
