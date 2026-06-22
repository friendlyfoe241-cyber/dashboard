import { describe, it, expect, beforeEach } from 'vitest';
import * as store from '../src/store.js';

beforeEach(async () => { await store.reset(); });

// Seeded mentor accounts (see seed.js).
const maya = () => store.authenticate('maya@example.com', 'demo1234');
const mentorAcct = () => store.authenticate('testmentor@synthica.org', 'demo1234');
// A plain researcher who books calls.
const jordan = () => store.authenticate('jordan@example.com', 'demo1234');
const sam = () => store.authenticate('sam@example.com', 'demo1234');

const futureSlot = (days = 5, hour = 12) => {
  const d = new Date();
  d.setUTCHours(hour, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
};

describe('mentor directory', () => {
  it('lists seeded mentors with specialties + open slots', () => {
    const mentors = store.listMentors();
    expect(mentors.length).toBeGreaterThanOrEqual(3);
    const m = mentors.find((x) => x.name === 'Dr. Maya Chen');
    expect(m).toBeTruthy();
    expect(m.specialties).toContain('Statistics');
    expect(m.openSlots).toBeGreaterThan(0);
  });

  it('filters by specialty (case-insensitive, substring)', () => {
    const py = store.listMentors({ specialty: 'python' });
    expect(py.length).toBeGreaterThan(0);
    expect(py.every((m) => m.specialties.some((s) => s.toLowerCase().includes('python')))).toBe(true);
  });

  it('exposes the union of specialties for the filter chips', () => {
    const specs = store.mentorSpecialties();
    expect(specs).toContain('Statistics');
    expect(specs).toContain('Machine Learning');
  });

  it('getMentor returns open slots for the booking view', () => {
    const detail = store.getMentor(maya().id);
    expect(Array.isArray(detail.slots)).toBe(true);
    expect(detail.slots.length).toBeGreaterThan(0);
    expect(detail.slots[0]).toHaveProperty('slot');
  });

  it('non-mentors are not findable as mentors', () => {
    expect(() => store.getMentor(jordan().id)).toThrow();
  });
});

describe('mentor availability (self-service)', () => {
  it('a mentor adds an availability slot', () => {
    const m = mentorAcct();
    const before = store.mentorDashboard(m.id).slots.length;
    const slot = futureSlot(9, 10);
    const dash = store.addMentorSlot({ userId: m.id, slot });
    expect(dash.slots.length).toBe(before + 1);
    expect(dash.slots.some((s) => s.slot === slot && !s.booked)).toBe(true);
  });

  it('rejects a past slot and a non-mentor', () => {
    const m = mentorAcct();
    expect(() => store.addMentorSlot({ userId: m.id, slot: '2000-01-01T10:00:00.000Z' })).toThrow();
    expect(() => store.addMentorSlot({ userId: jordan().id, slot: futureSlot() })).toThrow(/not an expertise mentor/);
  });

  it('editing specialties + bio updates the directory card', () => {
    const m = mentorAcct();
    store.setMentorProfile({ userId: m.id, specialties: 'Genetics, Python', mentorBio: 'Ask me anything.' });
    const card = store.listMentors().find((x) => x.id === m.id);
    expect(card.specialties).toEqual(['Genetics', 'Python']);
    expect(card.mentorBio).toBe('Ask me anything.');
  });

  it('cannot remove a booked slot', () => {
    const m = maya();
    const slot = store.getMentor(m.id).slots[0].slot;
    store.bookMentor({ researcherId: jordan().id, mentorId: m.id, slot, note: '' });
    const booked = store.mentorDashboard(m.id).slots.find((s) => s.slot === slot);
    expect(booked.booked).toBe(true);
    expect(() => store.removeMentorSlot({ userId: m.id, slotId: booked.id })).toThrow();
  });
});

describe('booking a mentor call', () => {
  it('creates a booking, calendar entries for BOTH parties, and notifies the mentor', () => {
    const mentor = maya();
    const researcher = jordan();
    const slot = store.getMentor(mentor.id).slots[0].slot;

    const booking = store.bookMentor({ researcherId: researcher.id, mentorId: mentor.id, slot, note: 'Help with stats' });
    expect(booking.status).toBe('confirmed');
    expect(booking.meetingUrl).toMatch(/^https?:\/\//);

    // Calendar entry for the researcher...
    const rCal = store.calendarFor(researcher.id).find((x) => x.id === `mbk:${booking.id}`);
    expect(rCal).toBeTruthy();
    expect(rCal.kind).toBe('mentor');
    expect(rCal.date).toBe(String(slot).slice(0, 10));
    // ...and for the mentor.
    const mCal = store.calendarFor(mentor.id).find((x) => x.id === `mbk:${booking.id}`);
    expect(mCal).toBeTruthy();

    // In-app notification to the mentor.
    const notif = store.listNotifications(mentor.id).find((n) => n.type === 'mentor');
    expect(notif).toBeTruthy();
    expect(notif.body).toContain('Help with stats');

    // The booked slot is now claimed and disappears from open slots.
    expect(store.getMentor(mentor.id).slots.some((s) => s.slot === slot)).toBe(false);
  });

  it('the researcher sees the booking in their own list', () => {
    const mentor = maya();
    const researcher = jordan();
    const slot = store.getMentor(mentor.id).slots[0].slot;
    store.bookMentor({ researcherId: researcher.id, mentorId: mentor.id, slot, note: '' });
    const mine = store.myMentorBookings(researcher.id);
    expect(mine.length).toBe(1);
    expect(mine[0].mentorName).toBe('Dr. Maya Chen');
  });

  it('rejects double-booking the same slot', () => {
    const mentor = maya();
    const slot = store.getMentor(mentor.id).slots[0].slot;
    store.bookMentor({ researcherId: jordan().id, mentorId: mentor.id, slot, note: '' });
    expect(() => store.bookMentor({ researcherId: sam().id, mentorId: mentor.id, slot, note: '' })).toThrow();
  });

  it('rejects an unknown / unoffered slot', () => {
    const mentor = maya();
    expect(() => store.bookMentor({ researcherId: jordan().id, mentorId: mentor.id, slot: futureSlot(30), note: '' })).toThrow();
  });

  it('rejects booking yourself', () => {
    const mentor = maya();
    const slot = store.getMentor(mentor.id).slots[0].slot;
    expect(() => store.bookMentor({ researcherId: mentor.id, mentorId: mentor.id, slot, note: '' })).toThrow();
  });
});

describe('cancelling a booking', () => {
  it('frees the slot, drops it from the calendar, and notifies the other party', () => {
    const mentor = maya();
    const researcher = jordan();
    const slot = store.getMentor(mentor.id).slots[0].slot;
    const booking = store.bookMentor({ researcherId: researcher.id, mentorId: mentor.id, slot, note: '' });

    const res = store.cancelMentorBooking({ userId: researcher.id, bookingId: booking.id });
    expect(res.status).toBe('cancelled');

    // Slot is open again and re-bookable.
    expect(store.getMentor(mentor.id).slots.some((s) => s.slot === slot)).toBe(true);
    // No longer on either calendar.
    expect(store.calendarFor(researcher.id).some((x) => x.id === `mbk:${booking.id}`)).toBe(false);
    expect(store.calendarFor(mentor.id).some((x) => x.id === `mbk:${booking.id}`)).toBe(false);
    // The mentor was notified of the cancellation.
    expect(store.listNotifications(mentor.id).some((n) => n.title.includes('cancelled'))).toBe(true);
  });

  it('a stranger cannot cancel someone else’s booking', () => {
    const mentor = maya();
    const slot = store.getMentor(mentor.id).slots[0].slot;
    const booking = store.bookMentor({ researcherId: jordan().id, mentorId: mentor.id, slot, note: '' });
    expect(() => store.cancelMentorBooking({ userId: sam().id, bookingId: booking.id })).toThrow(/Not your booking/);
  });
});
