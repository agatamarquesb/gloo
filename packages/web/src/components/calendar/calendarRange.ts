import {
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  type CalendarDate,
} from '@internationalized/date';

import { CalendarViewMode } from '@gloo/shared';

import { CALENDAR_FIRST_DAY, CALENDAR_LOCALE } from '@/lib/weekStart';

export interface DateRange {
  /** First day on the grid, inclusive. */
  start: CalendarDate;
  /** Last day on the grid, inclusive. */
  end: CalendarDate;
}

/**
 * The days a view puts on screen.
 *
 * Month returns whole weeks rather than the 1st to the 31st, because the month
 * grid draws the leading and trailing days that complete its first and last
 * rows — and an event on one of those days has to be fetched, or it renders as
 * an empty cell the user can see is wrong.
 */
export function visibleRange(focused: CalendarDate, mode: CalendarViewMode): DateRange {
  if (mode === CalendarViewMode.DAY) {
    return { start: focused, end: focused };
  }

  if (mode === CalendarViewMode.WEEK) {
    return {
      start: startOfWeek(focused, CALENDAR_LOCALE, CALENDAR_FIRST_DAY),
      end: endOfWeek(focused, CALENDAR_LOCALE, CALENDAR_FIRST_DAY),
    };
  }

  return {
    start: startOfWeek(startOfMonth(focused), CALENDAR_LOCALE, CALENDAR_FIRST_DAY),
    end: endOfWeek(endOfMonth(focused), CALENDAR_LOCALE, CALENDAR_FIRST_DAY),
  };
}

/**
 * The days the mini calendar bands, which is not the same question.
 *
 * The grid shows a day, a week or a month; the month beside it always shows the
 * *week*, except in month view where it shows the month. That asymmetry is the
 * point: a band one cell wide says nothing a highlight on that cell doesn't
 * already say, and what a reader wants from the small calendar while looking at
 * a single day is where that day sits in its week.
 *
 * So Dia and Semana band the same seven days and differ only in what the grid
 * draws, and Mês is the one view where the two calendars agree.
 */
export function bandRange(focused: CalendarDate, mode: CalendarViewMode): DateRange {
  return visibleRange(focused, mode === CalendarViewMode.DAY ? CalendarViewMode.WEEK : mode);
}

/** Every day in the range, in order — the grid's columns, or its cells. */
export function daysIn(range: DateRange): CalendarDate[] {
  const days: CalendarDate[] = [];
  for (let day = range.start; day.compare(range.end) <= 0; day = day.add({ days: 1 })) {
    days.push(day);
  }
  return days;
}

/**
 * How far an arrow press moves, per view.
 *
 * Month steps by a month rather than by the five or six weeks on screen, so
 * paging forward and back returns to where it started — stepping by the visible
 * range would drift, since months are not a whole number of weeks.
 */
export function stepFocused(
  focused: CalendarDate,
  mode: CalendarViewMode,
  direction: 1 | -1,
): CalendarDate {
  if (mode === CalendarViewMode.DAY) return focused.add({ days: direction });
  if (mode === CalendarViewMode.WEEK) return focused.add({ weeks: direction });
  return focused.add({ months: direction });
}
