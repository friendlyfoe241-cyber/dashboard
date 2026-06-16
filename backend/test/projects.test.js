import { describe, it, expect, beforeEach } from 'vitest';
import * as store from '../src/store.js';

beforeEach(async () => { await store.reset(); });

const sam = () => store.authenticate('sam@example.com', 'demo1234');   // lead on seed projects
const leadProject = (leadId) => store.listProjects().find((p) => p.leadId === leadId);

describe('per-project roles', () => {
  it('lead sets a member role and it surfaces on the profile + roster', () => {
    const lead = sam();
    const proj = leadProject(lead.id);
    const member = proj.members.find((m) => m !== lead.id);
    store.setProjectRole({ projectId: proj.id, leadId: lead.id, userId: member, title: 'Head of Data Collection' });

    const onRoster = store.projectTeam(proj.id).find((m) => m.id === member);
    expect(onRoster.role).toBe('Head of Data Collection');

    const memberUser = store.getUserById(member);
    const profile = store.getPublicProfile(memberUser.slug);
    const pr = profile.currentProjects.find((x) => x.id === proj.id);
    expect(pr.role).toBe('Head of Data Collection');
  });

  it('clears a role with an empty title', () => {
    const lead = sam();
    const proj = leadProject(lead.id);
    const member = proj.members.find((m) => m !== lead.id);
    store.setProjectRole({ projectId: proj.id, leadId: lead.id, userId: member, title: 'Analyst' });
    store.setProjectRole({ projectId: proj.id, leadId: lead.id, userId: member, title: '' });
    expect(store.projectTeam(proj.id).find((m) => m.id === member).role).toBe('');
  });

  it('non-lead cannot assign roles', () => {
    const lead = sam();
    const proj = leadProject(lead.id);
    const member = proj.members.find((m) => m !== lead.id);
    expect(() => store.setProjectRole({ projectId: proj.id, leadId: member, userId: lead.id, title: 'x' })).toThrow();
  });
});

describe('suggested people', () => {
  it('ranks non-members by shared interests and excludes the team', () => {
    const lead = sam();
    const proj = leadProject(lead.id);
    // Give the lead an interest and a non-member the same interest.
    store.updateProfile(lead.id, { interests: ['robotics'] });
    const outsider = store.authenticate('robin@example.com', 'demo1234');
    store.updateProfile(outsider.id, { interests: ['robotics', 'ai'] });

    const suggestions = store.suggestedPeopleForProject(proj.id, lead.id);
    expect(suggestions.some((s) => s.id === outsider.id)).toBe(true);
    expect(suggestions.every((s) => !proj.members.includes(s.id))).toBe(true);
    const hit = suggestions.find((s) => s.id === outsider.id);
    expect(hit.shared).toContain('robotics');
  });

  it('one-click invite adds the member', () => {
    const lead = sam();
    const proj = leadProject(lead.id);
    const outsider = store.authenticate('robin@example.com', 'demo1234');
    expect(proj.members.includes(outsider.id)).toBe(false);
    store.inviteToProjectById({ projectId: proj.id, leadId: lead.id, userId: outsider.id });
    expect(store.getProject(proj.id).members.includes(outsider.id)).toBe(true);
  });
});
