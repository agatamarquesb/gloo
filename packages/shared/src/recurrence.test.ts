import { describe, expect, it } from 'vitest';

import { EventRecurrence } from './enums';
import {
  endOfDayInZone,
  expandEvents,
  findOccurrence,
  type RecurrenceMaster,
} from './recurrence';

/**
 * A one-hour event, unless the caller says otherwise. The defaults are in
 * London deliberately: it changes its clocks on a different weekend from New
 * York, so a test that passes in both zones is testing the wall-clock logic
 * rather than a fixed offset.
 */
function master(overrides: Partial<RecurrenceMaster> = {}): RecurrenceMaster {
  return {
    id: 'm1',
    startsAt: '2026-01-05T09:00:00.000Z',
    endsAt: '2026-01-05T10:00:00.000Z',
    recurrence: EventRecurrence.WEEKLY,
    recurrenceUntil: '2026-03-31T23:59:59.999Z',
    timeZone: 'Europe/London',
    ...overrides,
  };
}

/** Occurrence starts only — what nearly every assertion here is about. */
function starts(instances: { startsAt: string }[]): string[] {
  return instances.map((instance) => instance.startsAt);
}

describe('expandEvents', () => {
  it('returns a non-recurring event as a single instance', () => {
    const result = expandEvents(
      [master({ recurrence: null, recurrenceUntil: null })],
      [],
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
    );

    expect(starts(result)).toEqual(['2026-01-05T09:00:00.000Z']);
  });

  it('includes an event overlapping the window but starting before it', () => {
    const result = expandEvents(
      [
        master({
          recurrence: null,
          recurrenceUntil: null,
          startsAt: '2026-01-04T23:00:00.000Z',
          endsAt: '2026-01-05T01:00:00.000Z',
        }),
      ],
      [],
      '2026-01-05T00:00:00.000Z',
      '2026-01-06T00:00:00.000Z',
    );

    expect(result).toHaveLength(1);
  });

  it('excludes an event that ends exactly when the window opens', () => {
    const result = expandEvents(
      [
        master({
          recurrence: null,
          recurrenceUntil: null,
          startsAt: '2026-01-04T23:00:00.000Z',
          endsAt: '2026-01-05T00:00:00.000Z',
        }),
      ],
      [],
      '2026-01-05T00:00:00.000Z',
      '2026-01-06T00:00:00.000Z',
    );

    expect(result).toEqual([]);
  });

  it('generates weekly occurrences inside the window only', () => {
    const result = expandEvents(
      [master()],
      [],
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
    );

    expect(starts(result)).toEqual([
      '2026-01-05T09:00:00.000Z',
      '2026-01-12T09:00:00.000Z',
      '2026-01-19T09:00:00.000Z',
      '2026-01-26T09:00:00.000Z',
    ]);
  });

  it('steps fortnightly from the series start, not from the window', () => {
    // The window opens mid-series: the occurrences it returns must still land
    // on the master's own parity (5th, 19th, 2nd…), not restart at the window.
    const result = expandEvents(
      [master({ recurrence: EventRecurrence.BIWEEKLY })],
      [],
      '2026-01-15T00:00:00.000Z',
      '2026-02-20T00:00:00.000Z',
    );

    expect(starts(result)).toEqual([
      '2026-01-19T09:00:00.000Z',
      '2026-02-02T09:00:00.000Z',
      '2026-02-16T09:00:00.000Z',
    ]);
  });

  it('keeps the local wall-clock time across a spring-forward', () => {
    // London goes to BST on 2026-03-29. A 09:00 local meeting is 09:00Z before
    // and 08:00Z after; adding a flat seven days in UTC would leave it at 09:00Z,
    // i.e. an hour late in the room.
    const result = expandEvents(
      [
        master({
          startsAt: '2026-03-23T09:00:00.000Z',
          endsAt: '2026-03-23T10:00:00.000Z',
          recurrenceUntil: '2026-04-10T00:00:00.000Z',
        }),
      ],
      [],
      '2026-03-20T00:00:00.000Z',
      '2026-04-10T00:00:00.000Z',
    );

    expect(starts(result)).toEqual([
      '2026-03-23T09:00:00.000Z',
      '2026-03-30T08:00:00.000Z',
      '2026-04-06T08:00:00.000Z',
    ]);
  });

  it('keeps the local wall-clock time across an autumn fall-back', () => {
    // New York leaves EDT on 2026-11-01: 09:00 local is 13:00Z, then 14:00Z.
    const result = expandEvents(
      [
        master({
          timeZone: 'America/New_York',
          startsAt: '2026-10-26T13:00:00.000Z',
          endsAt: '2026-10-26T14:00:00.000Z',
          recurrence: EventRecurrence.DAILY,
          recurrenceUntil: '2026-11-04T00:00:00.000Z',
        }),
      ],
      [],
      '2026-10-30T00:00:00.000Z',
      '2026-11-04T00:00:00.000Z',
    );

    expect(starts(result)).toEqual([
      '2026-10-30T13:00:00.000Z',
      '2026-10-31T13:00:00.000Z',
      '2026-11-01T14:00:00.000Z',
      '2026-11-02T14:00:00.000Z',
      '2026-11-03T14:00:00.000Z',
    ]);
  });

  it('preserves the event duration across a clock change', () => {
    const result = expandEvents(
      [
        master({
          startsAt: '2026-03-23T09:00:00.000Z',
          endsAt: '2026-03-23T10:30:00.000Z',
          recurrenceUntil: '2026-04-01T00:00:00.000Z',
        }),
      ],
      [],
      '2026-03-29T00:00:00.000Z',
      '2026-04-01T00:00:00.000Z',
    );

    const [occurrence] = result;
    const lengthMs =
      new Date(occurrence.endsAt).getTime() - new Date(occurrence.startsAt).getTime();
    expect(lengthMs).toBe(90 * 60 * 1000);
  });

  it('skips months with no such day rather than sliding onto the last one', () => {
    // RFC 5545, and what Google does: a monthly series on the 31st simply has
    // no February occurrence. Clamping to the 28th would also make March jump
    // back to the 31st, so the series would wander.
    const result = expandEvents(
      [
        master({
          recurrence: EventRecurrence.MONTHLY,
          startsAt: '2026-01-31T09:00:00.000Z',
          endsAt: '2026-01-31T10:00:00.000Z',
          recurrenceUntil: '2026-06-01T00:00:00.000Z',
        }),
      ],
      [],
      '2026-01-01T00:00:00.000Z',
      '2026-06-01T00:00:00.000Z',
    );

    expect(starts(result)).toEqual([
      '2026-01-31T09:00:00.000Z',
      '2026-03-31T08:00:00.000Z',
      '2026-05-31T08:00:00.000Z',
    ]);
  });

  it('rolls a monthly series into the next year', () => {
    const result = expandEvents(
      [
        master({
          recurrence: EventRecurrence.MONTHLY,
          startsAt: '2026-11-15T09:00:00.000Z',
          endsAt: '2026-11-15T10:00:00.000Z',
          recurrenceUntil: '2027-02-01T00:00:00.000Z',
        }),
      ],
      [],
      '2026-11-01T00:00:00.000Z',
      '2027-02-01T00:00:00.000Z',
    );

    expect(starts(result)).toEqual([
      '2026-11-15T09:00:00.000Z',
      '2026-12-15T09:00:00.000Z',
      '2027-01-15T09:00:00.000Z',
    ]);
  });

  it('includes an occurrence starting exactly on the until instant', () => {
    const result = expandEvents(
      [master({ recurrenceUntil: '2026-01-19T09:00:00.000Z' })],
      [],
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
    );

    expect(starts(result)).toEqual([
      '2026-01-05T09:00:00.000Z',
      '2026-01-12T09:00:00.000Z',
      '2026-01-19T09:00:00.000Z',
    ]);
  });

  it('excludes an occurrence starting one millisecond after until', () => {
    const result = expandEvents(
      [master({ recurrenceUntil: '2026-01-19T08:59:59.999Z' })],
      [],
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
    );

    expect(starts(result)).toEqual([
      '2026-01-05T09:00:00.000Z',
      '2026-01-12T09:00:00.000Z',
    ]);
  });

  it('suppresses exactly the slot an exception covers', () => {
    const result = expandEvents(
      [master()],
      [{ recurringEventId: 'm1', originalStart: '2026-01-12T09:00:00.000Z' }],
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
    );

    expect(starts(result)).toEqual([
      '2026-01-05T09:00:00.000Z',
      '2026-01-19T09:00:00.000Z',
      '2026-01-26T09:00:00.000Z',
    ]);
  });

  it('matches an exception written with a different but equivalent timestamp', () => {
    // The API stores instants as Date columns and the client sends ISO strings;
    // an offset-bearing form of the same moment must still suppress the slot.
    const result = expandEvents(
      [master()],
      [{ recurringEventId: 'm1', originalStart: '2026-01-12T10:00:00.000+01:00' }],
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
    );

    expect(starts(result)).not.toContain('2026-01-12T09:00:00.000Z');
    expect(result).toHaveLength(3);
  });

  it('ignores an exception belonging to another master', () => {
    const result = expandEvents(
      [master()],
      [{ recurringEventId: 'other', originalStart: '2026-01-12T09:00:00.000Z' }],
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
    );

    expect(starts(result)).toContain('2026-01-12T09:00:00.000Z');
  });

  it('tags every occurrence with its master and its slot', () => {
    const [occurrence] = expandEvents(
      [master()],
      [],
      '2026-01-05T00:00:00.000Z',
      '2026-01-06T00:00:00.000Z',
    );

    expect(occurrence).toEqual({
      masterId: 'm1',
      originalStart: '2026-01-05T09:00:00.000Z',
      startsAt: '2026-01-05T09:00:00.000Z',
      endsAt: '2026-01-05T10:00:00.000Z',
    });
  });

  it('returns occurrences from several masters in chronological order', () => {
    const result = expandEvents(
      [
        master({ id: 'a', recurrence: null, recurrenceUntil: null }),
        master({
          id: 'b',
          recurrence: null,
          recurrenceUntil: null,
          startsAt: '2026-01-05T08:00:00.000Z',
          endsAt: '2026-01-05T08:30:00.000Z',
        }),
      ],
      [],
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
    );

    expect(result.map((instance) => instance.masterId)).toEqual(['b', 'a']);
  });

  it('returns nothing for a series whose until precedes its start', () => {
    const result = expandEvents(
      [master({ recurrenceUntil: '2025-12-01T00:00:00.000Z' })],
      [],
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
    );

    expect(result).toEqual([]);
  });

  it('handles a zero-length event without dropping or duplicating it', () => {
    const result = expandEvents(
      [
        master({
          recurrence: null,
          recurrenceUntil: null,
          endsAt: '2026-01-05T09:00:00.000Z',
        }),
      ],
      [],
      '2026-01-05T00:00:00.000Z',
      '2026-01-06T00:00:00.000Z',
    );

    // Zero-length can't "overlap" anything, but a marker at 09:00 on a day the
    // window covers still belongs on that day's column.
    expect(result).toHaveLength(1);
  });

  it('walks a long-running series without losing occurrences to the fast-forward', () => {
    const result = expandEvents(
      [
        master({
          recurrence: EventRecurrence.DAILY,
          startsAt: '2024-01-01T09:00:00.000Z',
          endsAt: '2024-01-01T10:00:00.000Z',
          recurrenceUntil: '2026-12-31T23:59:59.999Z',
        }),
      ],
      [],
      '2026-06-01T00:00:00.000Z',
      '2026-06-04T00:00:00.000Z',
    );

    expect(starts(result)).toEqual([
      '2026-06-01T08:00:00.000Z',
      '2026-06-02T08:00:00.000Z',
      '2026-06-03T08:00:00.000Z',
    ]);
  });

  it('does not let the fast-forward skip a multi-day event already in progress', () => {
    const result = expandEvents(
      [
        master({
          recurrence: EventRecurrence.WEEKLY,
          startsAt: '2026-01-05T09:00:00.000Z',
          // Runs three days, so the occurrence starting before the window is
          // still on screen when it opens.
          endsAt: '2026-01-08T09:00:00.000Z',
          recurrenceUntil: '2026-03-31T23:59:59.999Z',
        }),
      ],
      [],
      '2026-01-14T00:00:00.000Z',
      '2026-01-15T00:00:00.000Z',
    );

    expect(starts(result)).toEqual(['2026-01-12T09:00:00.000Z']);
  });
});

describe('open-ended series', () => {
  it('repeats forever, bounded only by the window', () => {
    // Google's UI produces these by default, and four of the six calendars
    // linked in testing had them. Before this they imported as a single event.
    const result = expandEvents(
      [master({ recurrenceUntil: null })],
      [],
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
    );

    expect(starts(result)).toEqual([
      '2026-01-05T09:00:00.000Z',
      '2026-01-12T09:00:00.000Z',
      '2026-01-19T09:00:00.000Z',
      '2026-01-26T09:00:00.000Z',
    ]);
  });

  it('still returns nothing before the series begins', () => {
    const result = expandEvents(
      [master({ recurrenceUntil: null })],
      [],
      '2025-11-01T00:00:00.000Z',
      '2025-12-01T00:00:00.000Z',
    );
    expect(result).toEqual([]);
  });

  it('reaches a window years after the series started', () => {
    const result = expandEvents(
      [
        master({
          recurrence: EventRecurrence.DAILY,
          recurrenceUntil: null,
          startsAt: '2024-01-01T09:00:00.000Z',
          endsAt: '2024-01-01T10:00:00.000Z',
        }),
      ],
      [],
      '2026-06-01T00:00:00.000Z',
      '2026-06-04T00:00:00.000Z',
    );

    expect(starts(result)).toEqual([
      '2026-06-01T08:00:00.000Z',
      '2026-06-02T08:00:00.000Z',
      '2026-06-03T08:00:00.000Z',
    ]);
  });
});

describe('weekly series naming their own days', () => {
  // 2026-09-07 is a Monday; 09 Wed, 11 Fri, 14 Mon, 16 Wed, 18 Fri.
  const monWedFri = {
    startsAt: '2026-09-07T08:00:00.000Z',
    endsAt: '2026-09-07T09:00:00.000Z',
    byWeekdays: [1, 3, 5],
    recurrenceUntil: null,
  };

  it('lands on every named weekday', () => {
    const result = expandEvents(
      [master(monWedFri)],
      [],
      '2026-09-07T00:00:00.000Z',
      '2026-09-19T00:00:00.000Z',
    );

    expect(starts(result)).toEqual([
      '2026-09-07T08:00:00.000Z',
      '2026-09-09T08:00:00.000Z',
      '2026-09-11T08:00:00.000Z',
      '2026-09-14T08:00:00.000Z',
      '2026-09-16T08:00:00.000Z',
      '2026-09-18T08:00:00.000Z',
    ]);
  });

  it('drops named days that fall before the series starts', () => {
    // Starting on the Wednesday, the first week has no Monday: Google anchors a
    // series to its first event, it does not back-fill the week around it.
    const result = expandEvents(
      [master({ ...monWedFri, startsAt: '2026-09-09T08:00:00.000Z', endsAt: '2026-09-09T09:00:00.000Z' })],
      [],
      '2026-09-07T00:00:00.000Z',
      '2026-09-19T00:00:00.000Z',
    );

    expect(starts(result)).toEqual([
      '2026-09-09T08:00:00.000Z',
      '2026-09-11T08:00:00.000Z',
      '2026-09-14T08:00:00.000Z',
      '2026-09-16T08:00:00.000Z',
      '2026-09-18T08:00:00.000Z',
    ]);
  });

  it('treats a single day matching the start as a plain weekly rule', () => {
    // The overwhelmingly common Google shape: FREQ=WEEKLY;BYDAY=MO on an event
    // that already falls on a Monday.
    const result = expandEvents(
      [master({ ...monWedFri, byWeekdays: [1] })],
      [],
      '2026-09-07T00:00:00.000Z',
      '2026-09-26T00:00:00.000Z',
    );

    expect(starts(result)).toEqual([
      '2026-09-07T08:00:00.000Z',
      '2026-09-14T08:00:00.000Z',
      '2026-09-21T08:00:00.000Z',
    ]);
  });

  it('honours a single day that is not the day the series starts on', () => {
    // Google allows FREQ=WEEKLY;BYDAY=WE on a Monday event; the BYDAY wins.
    const result = expandEvents(
      [master({ ...monWedFri, byWeekdays: [3] })],
      [],
      '2026-09-07T00:00:00.000Z',
      '2026-09-26T00:00:00.000Z',
    );

    expect(starts(result)).toEqual([
      '2026-09-09T08:00:00.000Z',
      '2026-09-16T08:00:00.000Z',
      '2026-09-23T08:00:00.000Z',
    ]);
  });

  it('skips a week between occurrences when the rule is fortnightly', () => {
    const result = expandEvents(
      [master({ ...monWedFri, byWeekdays: [1, 3], recurrence: EventRecurrence.BIWEEKLY })],
      [],
      '2026-09-07T00:00:00.000Z',
      '2026-09-26T00:00:00.000Z',
    );

    expect(starts(result)).toEqual([
      '2026-09-07T08:00:00.000Z',
      '2026-09-09T08:00:00.000Z',
      '2026-09-21T08:00:00.000Z',
      '2026-09-23T08:00:00.000Z',
    ]);
  });

  it('stops at the until date', () => {
    const result = expandEvents(
      [master({ ...monWedFri, recurrenceUntil: '2026-09-14T23:59:59.999Z' })],
      [],
      '2026-09-07T00:00:00.000Z',
      '2026-09-26T00:00:00.000Z',
    );

    expect(starts(result)).toEqual([
      '2026-09-07T08:00:00.000Z',
      '2026-09-09T08:00:00.000Z',
      '2026-09-11T08:00:00.000Z',
      '2026-09-14T08:00:00.000Z',
    ]);
  });

  it('lets an exception suppress one named day', () => {
    const result = expandEvents(
      [master(monWedFri)],
      [{ recurringEventId: 'm1', originalStart: '2026-09-09T08:00:00.000Z' }],
      '2026-09-07T00:00:00.000Z',
      '2026-09-12T00:00:00.000Z',
    );

    expect(starts(result)).toEqual([
      '2026-09-07T08:00:00.000Z',
      '2026-09-11T08:00:00.000Z',
    ]);
  });

  it('keeps the local wall clock across a clock change', () => {
    // London leaves BST on 2026-10-25, so 09:00 local goes from 08:00Z to 09:00Z.
    const result = expandEvents(
      [
        master({
          startsAt: '2026-10-19T08:00:00.000Z',
          endsAt: '2026-10-19T09:00:00.000Z',
          byWeekdays: [1, 3],
          recurrenceUntil: null,
        }),
      ],
      [],
      '2026-10-19T00:00:00.000Z',
      '2026-11-01T00:00:00.000Z',
    );

    expect(starts(result)).toEqual([
      '2026-10-19T08:00:00.000Z',
      '2026-10-21T08:00:00.000Z',
      '2026-10-26T09:00:00.000Z',
      '2026-10-28T09:00:00.000Z',
    ]);
  });

  it('handles the every-weekday rule Google writes for "every weekday"', () => {
    const result = expandEvents(
      [master({ ...monWedFri, byWeekdays: [1, 2, 3, 4, 5] })],
      [],
      '2026-09-07T00:00:00.000Z',
      '2026-09-14T00:00:00.000Z',
    );

    expect(result).toHaveLength(5);
    expect(starts(result)[0]).toBe('2026-09-07T08:00:00.000Z');
    expect(starts(result)[4]).toBe('2026-09-11T08:00:00.000Z');
  });

  it('ignores a weekday set on a daily or monthly rule', () => {
    const result = expandEvents(
      [master({ ...monWedFri, recurrence: EventRecurrence.DAILY, byWeekdays: [1, 3] })],
      [],
      '2026-09-07T00:00:00.000Z',
      '2026-09-10T00:00:00.000Z',
    );

    expect(result).toHaveLength(3);
  });
});

describe('endOfDayInZone', () => {
  it('returns the last millisecond of the day in a zone behind UTC', () => {
    // New York in July is UTC-4, so 23:59:59.999 local is 03:59:59.999Z the
    // next day — the case that makes storing midnight lose a whole occurrence.
    expect(endOfDayInZone('2026-07-15', 'America/New_York')).toBe('2026-07-16T03:59:59.999Z');
  });

  it('returns the last millisecond of the day in a zone ahead of UTC', () => {
    expect(endOfDayInZone('2026-07-15', 'Europe/London')).toBe('2026-07-15T22:59:59.999Z');
  });

  it('handles a day the clocks change on', () => {
    // London goes to BST at 01:00 on 2026-03-29, so that day ends at 22:59:59.999Z.
    expect(endOfDayInZone('2026-03-29', 'Europe/London')).toBe('2026-03-29T22:59:59.999Z');
  });

  it('accepts a full ISO timestamp and uses only its date part', () => {
    expect(endOfDayInZone('2026-07-15T08:30:00.000Z', 'Europe/London')).toBe(
      '2026-07-15T22:59:59.999Z',
    );
  });

  it('includes an occurrence on the until day itself', () => {
    // The reason this helper exists: with midnight the 19th would be excluded.
    const result = expandEvents(
      [master({ recurrenceUntil: endOfDayInZone('2026-01-19', 'Europe/London') })],
      [],
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
    );

    expect(starts(result)).toContain('2026-01-19T09:00:00.000Z');
  });
});

describe('findOccurrence', () => {
  it('returns the slot when the instant is one', () => {
    expect(findOccurrence(master(), '2026-01-19T09:00:00.000Z')).toBe('2026-01-19T09:00:00.000Z');
  });

  it('returns null for an instant merely covered by an occurrence', () => {
    expect(findOccurrence(master(), '2026-01-19T09:30:00.000Z')).toBeNull();
  });

  it('returns null for an instant outside the series', () => {
    expect(findOccurrence(master(), '2026-01-20T09:00:00.000Z')).toBeNull();
  });
});
