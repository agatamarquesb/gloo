/**
 * The small choices a person makes about how a page is drawn, kept between
 * visits.
 *
 * Not settings — there is no screen to change these on. They are the state of a
 * control that the user last left in a position: which way the Tasks page draws
 * its list, how far back its chart is measured over. The server has no column
 * for any of it and would not want one; like the manual task order beside it
 * (see myTasksOrder), this is one person's view of a shared page.
 *
 * A string in, a string out, and a guard the caller supplies: storage can hold
 * anything, including a value written by a version of the app that no longer
 * exists, so nothing comes out of here without being checked against what the
 * caller will actually accept.
 */
export function readPreference<T extends string>(
  key: string,
  isValid: (value: unknown) => value is T,
): T | null {
  try {
    const stored = localStorage.getItem(key);
    return isValid(stored) ? stored : null;
  } catch {
    // Storage can be unavailable outright — private mode, a blocked origin —
    // and a preference is never worth taking a page down for.
    return null;
  }
}

export function writePreference(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // A full quota, or no storage at all. The choice still applies to this
    // visit; it just will not survive it.
  }
}

/** Which way the Tasks page draws its tasks — see TaskViewToggle. */
export const TASK_VIEW_KEY = 'gloo-tasks-view';

/** The window the Tasks page's performance chart is measured over. */
export const TASK_PERIOD_KEY = 'gloo-tasks-chart-period';
