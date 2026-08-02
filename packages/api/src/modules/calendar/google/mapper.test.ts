import { describe, expect, it } from 'vitest';

import { EventRecurrence } from '@gloo/shared';

import {
  attendeeEmails,
  isAllDay,
  parseEventTime,
  parseRecurrence,
  toRRule,
  type GoogleEvent,
} from './mapper';

describe('parseRecurrence', () => {
  it('reads a weekly rule', () => {
    const result = parseRecurrence(['RRULE:FREQ=WEEKLY;UNTIL=20261231T235959Z']);
    expect(result?.recurrence).toBe(EventRecurrence.WEEKLY);
    expect(result?.until?.toISOString()).toBe('2026-12-31T23:59:59.000Z');
  });

  it('reads a daily rule', () => {
    expect(parseRecurrence(['RRULE:FREQ=DAILY;UNTIL=20260601T000000Z'])?.recurrence).toBe(
      EventRecurrence.DAILY,
    );
  });

  it('reads INTERVAL=2 weekly as biweekly', () => {
    expect(
      parseRecurrence(['RRULE:FREQ=WEEKLY;INTERVAL=2;UNTIL=20261231T235959Z'])?.recurrence,
    ).toBe(EventRecurrence.BIWEEKLY);
  });

  it('reads a monthly rule', () => {
    expect(parseRecurrence(['RRULE:FREQ=MONTHLY;UNTIL=20261231T235959Z'])?.recurrence).toBe(
      EventRecurrence.MONTHLY,
    );
  });

  it('picks the RRULE out of a list that also has EXDATE', () => {
    const result = parseRecurrence([
      'EXDATE;TZID=Europe/London:20260810T090000',
      'RRULE:FREQ=WEEKLY;UNTIL=20261231T235959Z',
    ]);
    expect(result?.recurrence).toBe(EventRecurrence.WEEKLY);
  });

  it('expands a bare date UNTIL to the end of that day', () => {
    const result = parseRecurrence(['RRULE:FREQ=WEEKLY;UNTIL=20261231']);
    expect(result?.until?.toISOString()).toBe('2026-12-31T23:59:59.999Z');
  });

  it('refuses a COUNT-bounded series', () => {
    // We have no count, and guessing an until would invent occurrences.
    expect(parseRecurrence(['RRULE:FREQ=WEEKLY;COUNT=10'])).toBeNull();
  });

  it('reads a series with no UNTIL as open-ended', () => {
    const result = parseRecurrence(['RRULE:FREQ=WEEKLY']);
    expect(result?.recurrence).toBe(EventRecurrence.WEEKLY);
    expect(result?.until).toBeNull();
  });

  it('refuses an interval we do not model', () => {
    expect(parseRecurrence(['RRULE:FREQ=DAILY;INTERVAL=3;UNTIL=20261231T235959Z'])).toBeNull();
  });

  it('refuses a yearly rule', () => {
    expect(parseRecurrence(['RRULE:FREQ=YEARLY;UNTIL=20301231T235959Z'])).toBeNull();
  });

  it('returns null when there is no recurrence', () => {
    expect(parseRecurrence(undefined)).toBeNull();
    expect(parseRecurrence([])).toBeNull();
  });
});

describe('toRRule', () => {
  const until = new Date('2026-12-31T23:59:59.000Z');

  it('writes each rule in Google basic format', () => {
    expect(toRRule('WEEKLY', until)).toEqual(['RRULE:FREQ=WEEKLY;UNTIL=20261231T235959Z']);
    expect(toRRule('DAILY', until)).toEqual(['RRULE:FREQ=DAILY;UNTIL=20261231T235959Z']);
    expect(toRRule('MONTHLY', until)).toEqual(['RRULE:FREQ=MONTHLY;UNTIL=20261231T235959Z']);
    expect(toRRule('BIWEEKLY', until)).toEqual([
      'RRULE:FREQ=WEEKLY;INTERVAL=2;UNTIL=20261231T235959Z',
    ]);
  });

  it('is undefined without a rule', () => {
    expect(toRRule(null, until)).toBeUndefined();
  });

  it('omits UNTIL entirely for an open-ended series', () => {
    // An empty UNTIL= would be malformed; leaving it out is how RFC 5545 says
    // "forever".
    expect(toRRule('WEEKLY', null)).toEqual(['RRULE:FREQ=WEEKLY']);
  });

  it('writes the weekday list', () => {
    expect(toRRule('WEEKLY', null, [1, 3, 5])).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR']);
    expect(toRRule('BIWEEKLY', until, [2])).toEqual([
      'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU;UNTIL=20261231T235959Z',
    ]);
  });

  it('never puts a weekday list on a daily or monthly rule', () => {
    // Google would read BYDAY on a MONTHLY rule as "the nth weekday", which is
    // a different series from the one we hold.
    expect(toRRule('MONTHLY', until, [1, 3])).toEqual([
      'RRULE:FREQ=MONTHLY;UNTIL=20261231T235959Z',
    ]);
    expect(toRRule('DAILY', until, [1])).toEqual(['RRULE:FREQ=DAILY;UNTIL=20261231T235959Z']);
  });

  it('ignores a rule that is not one of ours', () => {
    expect(toRRule('YEARLY', until)).toBeUndefined();
  });

  it('round-trips every rule we support', () => {
    for (const recurrence of ['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY']) {
      const rule = toRRule(recurrence, until);
      expect(parseRecurrence(rule)?.recurrence).toBe(recurrence);
      expect(parseRecurrence(rule)?.until?.toISOString()).toBe(until.toISOString());
    }
  });

  it('round-trips a weekday list', () => {
    const rule = toRRule('WEEKLY', null, [1, 3, 5]);
    const parsed = parseRecurrence(rule);
    expect(parsed?.byWeekdays).toEqual([1, 3, 5]);
    expect(parsed?.until).toBeNull();
  });
});

describe('the rules Google actually sent', () => {
  // Captured verbatim from a linked account. Every one of these was refused by
  // the first version of this parser, which is how the gap was found — so they
  // are pinned here to stop it closing again.
  const observed: [string, EventRecurrence, number[], boolean][] = [
    ['RRULE:FREQ=WEEKLY;BYDAY=FR,MO,TH,TU,WE', EventRecurrence.WEEKLY, [1, 2, 3, 4, 5], false],
    ['RRULE:FREQ=WEEKLY;WKST=MO;UNTIL=20260808T025959Z;BYDAY=TH', EventRecurrence.WEEKLY, [4], true],
    ['RRULE:FREQ=WEEKLY;WKST=MO;UNTIL=20260806T025959Z;BYDAY=TU,TH,SA', EventRecurrence.WEEKLY, [2, 4, 6], true],
    ['RRULE:FREQ=WEEKLY;WKST=MO;UNTIL=20260805T025959Z;BYDAY=MO,WE,FR', EventRecurrence.WEEKLY, [1, 3, 5], true],
    ['RRULE:FREQ=WEEKLY;WKST=MO;UNTIL=20260804T025959Z;BYDAY=TU', EventRecurrence.WEEKLY, [2], true],
    ['RRULE:FREQ=WEEKLY;WKST=MO;BYDAY=WE', EventRecurrence.WEEKLY, [3], false],
    ['RRULE:FREQ=WEEKLY;WKST=MO;BYDAY=TU,TH,SA', EventRecurrence.WEEKLY, [2, 4, 6], false],
    ['RRULE:FREQ=WEEKLY;WKST=MO;BYDAY=MO,WE,FR', EventRecurrence.WEEKLY, [1, 3, 5], false],
  ];

  for (const [rule, recurrence, byWeekdays, hasUntil] of observed) {
    it(`parses ${rule}`, () => {
      const parsed = parseRecurrence([rule]);
      expect(parsed).not.toBeNull();
      expect(parsed?.recurrence).toBe(recurrence);
      expect(parsed?.byWeekdays).toEqual(byWeekdays);
      expect(parsed?.until === null).toBe(!hasUntil);
    });
  }
});

describe('weekday lists we still refuse', () => {
  it('refuses a positional BYDAY', () => {
    // "the first Monday of the month" is a different series from "every
    // Monday", and expanding it as the latter would invent occurrences.
    expect(parseRecurrence(['RRULE:FREQ=MONTHLY;BYDAY=1MO'])).toBeNull();
    expect(parseRecurrence(['RRULE:FREQ=MONTHLY;BYDAY=-1FR'])).toBeNull();
  });

  it('refuses an unrecognised weekday token', () => {
    expect(parseRecurrence(['RRULE:FREQ=WEEKLY;BYDAY=XX'])).toBeNull();
  });

  it('refuses a weekday list on a daily rule', () => {
    expect(parseRecurrence(['RRULE:FREQ=DAILY;BYDAY=MO'])).toBeNull();
  });

  it('refuses a malformed UNTIL rather than treating it as open-ended', () => {
    // Silently dropping it would turn a bounded series into an endless one.
    expect(parseRecurrence(['RRULE:FREQ=WEEKLY;UNTIL=not-a-date'])).toBeNull();
  });
});

describe('parseEventTime', () => {
  it('reads a timed event', () => {
    expect(parseEventTime({ dateTime: '2026-08-04T09:00:00-03:00' })?.toISOString()).toBe(
      '2026-08-04T12:00:00.000Z',
    );
  });

  it('reads an all-day event as midnight UTC', () => {
    expect(parseEventTime({ date: '2026-08-04' })?.toISOString()).toBe('2026-08-04T00:00:00.000Z');
  });

  it('returns null when there is no time', () => {
    expect(parseEventTime(undefined)).toBeNull();
    expect(parseEventTime({})).toBeNull();
  });
});

describe('isAllDay', () => {
  it('is true only for a date-only start', () => {
    expect(isAllDay({ id: 'a', start: { date: '2026-08-04' } })).toBe(true);
    expect(isAllDay({ id: 'a', start: { dateTime: '2026-08-04T09:00:00Z' } })).toBe(false);
    expect(isAllDay({ id: 'a' })).toBe(false);
  });
});

describe('attendeeEmails', () => {
  it('drops the account holder and keeps the guests', () => {
    const event: GoogleEvent = {
      id: 'a',
      attendees: [
        { email: 'me@empresa.com', self: true },
        { email: 'ana@fora.com' },
        { email: 'jo@fora.com' },
      ],
    };
    expect(attendeeEmails(event)).toEqual(['ana@fora.com', 'jo@fora.com']);
  });

  it('is empty when there are no attendees', () => {
    expect(attendeeEmails({ id: 'a' })).toEqual([]);
  });

  it('ignores an attendee with no address', () => {
    expect(attendeeEmails({ id: 'a', attendees: [{}, { email: 'x@y.com' }] })).toEqual([
      'x@y.com',
    ]);
  });
});
