/**
 * How this app counts weeks — stated once, because two separate things ask.
 *
 * HeroUI's Calendar takes its week start from the *browser* locale unless told
 * otherwise (the app sets no I18nProvider), while the calendar page works out
 * which days are on screen with `startOfWeek`. Left to themselves those two can
 * disagree: a colleague browsing in en-GB would get a Monday-first month grid
 * with a Sunday-first range banded across it, and the band would appear to run
 * off the end of the row.
 *
 * The week starts on Monday here — the working week the app is read against,
 * and the order the grid and both month calendars now share. `startOfWeek` is
 * given the same fact through `CALENDAR_FIRST_DAY`, so the band across the
 * mini calendar's week can never sit off the row the grid is showing.
 */
export const CALENDAR_LOCALE = 'pt-BR';

/** The same fact in the shape react-aria's `firstDayOfWeek` wants. */
export const CALENDAR_FIRST_DAY = 'mon' as const;
