import { CalendarViewMode } from '@gloo/shared';

/**
 * Which of Dia, Semana and Mês the Calendar page opens in.
 *
 * Kept in `localStorage`, like the Routines card's folded tags and the task
 * order on the Dashboard: it is one person's way of reading one page — "I work
 * in day view" — rather than a fact about anything on the server, and it should
 * survive leaving the page and coming back without a round trip to restore it.
 *
 * Deliberately only the *view*, never the day it was left on. Coming back to
 * the calendar means coming back to now: a page that reopened on the 20th
 * because that is where you were browsing last week is a calendar that has to
 * be corrected before it can be read. So the mode is remembered and the date is
 * always today — see CalendarPage, which reads them separately.
 */
const VIEW_KEY = 'gloo-calendar-view-mode';

const MODES = new Set<string>(Object.values(CalendarViewMode));

export function readViewMode(): CalendarViewMode {
  try {
    const stored = localStorage.getItem(VIEW_KEY);
    // Anything else in the slot is somebody else's data or an older shape — the
    // week is the view the page has always started in.
    return stored && MODES.has(stored) ? (stored as CalendarViewMode) : CalendarViewMode.WEEK;
  } catch {
    // Private mode, a blocked origin.
    return CalendarViewMode.WEEK;
  }
}

export function writeViewMode(mode: CalendarViewMode) {
  try {
    localStorage.setItem(VIEW_KEY, mode);
  } catch {
    // A full quota — which view the page opens in is a convenience, not data.
  }
}
