/**
 * The two things a calendar address can carry: which day it opens on, and which
 * event it opens.
 *
 * Here rather than in the page because the event dialog writes these links and
 * the page reads them — and the page already imports the dialog, so the dialog
 * cannot import the page back.
 */
export const CALENDAR_DATE_PARAM = 'data';
export const CALENDAR_EVENT_PARAM = 'evento';

/**
 * A link to one event: the day it is on, so the grid arrives showing it, and the
 * event itself, which is what the page opens the dialog on.
 *
 * The day is part of the address rather than looked up on arrival because the
 * calendar only ever fetches the range it is showing — landing on today and
 * asking for an event three weeks out would be asking about something the page
 * has not loaded.
 */
export function eventLink(id: string, startsAt: string, origin: string): string {
  const day = new Date(startsAt);
  const date = [
    day.getFullYear(),
    String(day.getMonth() + 1).padStart(2, '0'),
    String(day.getDate()).padStart(2, '0'),
  ].join('-');

  const url = new URL('/calendar', origin);
  url.searchParams.set(CALENDAR_DATE_PARAM, date);
  url.searchParams.set(CALENDAR_EVENT_PARAM, id);
  return url.toString();
}
