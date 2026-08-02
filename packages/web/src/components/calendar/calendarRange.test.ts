import { CalendarDate } from '@internationalized/date';
import { describe, expect, it } from 'vitest';

import { CalendarViewMode } from '@gloo/shared';

import { daysIn, stepFocused, visibleRange } from './calendarRange';

/** 2026-09-16 is a Wednesday — mid-week and mid-month, so nothing lands on an edge by luck. */
const wednesday = new CalendarDate(2026, 9, 16);

function iso(range: { start: CalendarDate; end: CalendarDate }) {
  return [range.start.toString(), range.end.toString()];
}

describe('visibleRange', () => {
  it('covers a single day in day view', () => {
    expect(iso(visibleRange(wednesday, CalendarViewMode.DAY))).toEqual(['2026-09-16', '2026-09-16']);
  });

  it('covers Sunday to Saturday in week view', () => {
    expect(iso(visibleRange(wednesday, CalendarViewMode.WEEK))).toEqual([
      '2026-09-13',
      '2026-09-19',
    ]);
  });

  it('keeps a Sunday in its own week rather than the previous one', () => {
    // The boundary case that a naive "subtract getDay()" gets wrong.
    const sunday = new CalendarDate(2026, 9, 13);
    expect(iso(visibleRange(sunday, CalendarViewMode.WEEK))).toEqual(['2026-09-13', '2026-09-19']);
  });

  it('keeps a Saturday in its own week', () => {
    const saturday = new CalendarDate(2026, 9, 19);
    expect(iso(visibleRange(saturday, CalendarViewMode.WEEK))).toEqual(['2026-09-13', '2026-09-19']);
  });

  it('pads month view out to whole weeks', () => {
    // September 2026 starts on a Tuesday and ends on a Wednesday, so the grid
    // shows 30 Aug and runs to 3 Oct.
    expect(iso(visibleRange(wednesday, CalendarViewMode.MONTH))).toEqual([
      '2026-08-30',
      '2026-10-03',
    ]);
  });

  it('does not pad a month that already begins and ends on week boundaries', () => {
    // November 2026 begins on a Sunday and ends on a Monday, so only the tail
    // needs completing.
    const november = new CalendarDate(2026, 11, 15);
    expect(iso(visibleRange(november, CalendarViewMode.MONTH))).toEqual([
      '2026-11-01',
      '2026-12-05',
    ]);
  });

  it('crosses a year boundary in month view', () => {
    const december = new CalendarDate(2026, 12, 15);
    expect(iso(visibleRange(december, CalendarViewMode.MONTH))).toEqual([
      '2026-11-29',
      '2027-01-02',
    ]);
  });
});

describe('daysIn', () => {
  it('lists seven days for a week', () => {
    const days = daysIn(visibleRange(wednesday, CalendarViewMode.WEEK));
    expect(days).toHaveLength(7);
    expect(days[0].toString()).toBe('2026-09-13');
    expect(days[6].toString()).toBe('2026-09-19');
  });

  it('lists one day for a day view', () => {
    expect(daysIn(visibleRange(wednesday, CalendarViewMode.DAY))).toHaveLength(1);
  });

  it('lists whole weeks for a month', () => {
    const days = daysIn(visibleRange(wednesday, CalendarViewMode.MONTH));
    expect(days).toHaveLength(35);
    expect(days.length % 7).toBe(0);
  });
});

describe('stepFocused', () => {
  it('moves a day at a time in day view', () => {
    expect(stepFocused(wednesday, CalendarViewMode.DAY, 1).toString()).toBe('2026-09-17');
    expect(stepFocused(wednesday, CalendarViewMode.DAY, -1).toString()).toBe('2026-09-15');
  });

  it('moves a week at a time in week view', () => {
    expect(stepFocused(wednesday, CalendarViewMode.WEEK, 1).toString()).toBe('2026-09-23');
  });

  it('moves a month at a time in month view', () => {
    expect(stepFocused(wednesday, CalendarViewMode.MONTH, 1).toString()).toBe('2026-10-16');
  });

  it('returns to the starting month after forward then back', () => {
    // The drift guard: stepping by the visible five or six weeks would not
    // round-trip, because a month is not a whole number of weeks.
    const january = new CalendarDate(2026, 1, 31);
    const there = stepFocused(january, CalendarViewMode.MONTH, 1);
    const back = stepFocused(there, CalendarViewMode.MONTH, -1);
    expect(back.month).toBe(1);
  });
});
