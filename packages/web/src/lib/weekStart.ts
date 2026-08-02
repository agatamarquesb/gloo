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
 * PT-BR starts the week on Sunday, which is also what the mini calendar's own
 * header row shows.
 */
export const CALENDAR_LOCALE = 'pt-BR';

/** The same fact in the shape react-aria's `firstDayOfWeek` wants. */
export const CALENDAR_FIRST_DAY = 'sun' as const;
