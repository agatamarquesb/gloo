import { EventRecurrence, isEventRecurrence } from '@gloo/shared';

/**
 * Translating between Google's event shape and ours.
 *
 * Pure, and separate from the sync itself, because this is where the two models
 * actually disagree — everything else is bookkeeping. Tested directly against
 * fixtures, since the alternative is finding out from a live calendar.
 */

export interface GoogleEventTime {
  dateTime?: string;
  /** Set instead of dateTime for an all-day event: a bare `YYYY-MM-DD`. */
  date?: string;
  timeZone?: string;
}

export interface GoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: GoogleEventTime;
  end?: GoogleEventTime;
  recurrence?: string[];
  recurringEventId?: string;
  originalStartTime?: GoogleEventTime;
  iCalUID?: string;
  etag?: string;
  attendees?: { email?: string; self?: boolean }[];
}

/** RFC 5545 weekday tokens, in the 0=Sunday order the rest of the app uses. */
const WEEKDAY_TOKENS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/**
 * A BYDAY list as weekday numbers, or null if it says something we can't model.
 *
 * Positional forms — `1MO` for "the first Monday", `-1FR` for "the last Friday"
 * — are a different rule entirely from "every Monday", so they are refused
 * rather than flattened into one.
 */
function parseByDay(value: string | undefined): number[] | null {
  if (!value) return [];

  const days: number[] = [];
  for (const token of value.split(',')) {
    const index = WEEKDAY_TOKENS.indexOf(token.trim().toUpperCase());
    if (index === -1) return null;
    days.push(index);
  }

  // Normalised on the way in: Google writes them in no particular order
  // ("BYDAY=FR,MO,TH,TU,WE" is one of theirs verbatim), and a stored list whose
  // order depends on the sender makes every later comparison — round-trips,
  // "did this rule change?" — answer differently for the same rule.
  return [...new Set(days)].toSorted((a, b) => a - b);
}

/**
 * RRULE → our rules.
 *
 * Returns null for anything we cannot expand faithfully — a COUNT-bounded
 * series, a positional BYDAY, a monthly-by-weekday, a yearly event. Those are
 * stored as a plain non-recurring event rather than guessed at: showing one
 * occurrence of a series we can't expand is wrong in a way the user can see and
 * correct, whereas expanding it by the wrong rule silently scatters phantom
 * meetings across their calendar.
 *
 * What it does *not* refuse any more is BYDAY and a missing UNTIL. Google's UI
 * puts a BYDAY on every weekly event it writes — including single-day ones —
 * and leaves the series open-ended unless the user says otherwise, so refusing
 * those two meant refusing essentially every real recurring event.
 */
export function parseRecurrence(
  rules: string[] | undefined,
): { recurrence: EventRecurrence; until: Date | null; byWeekdays: number[] } | null {
  const rrule = rules?.find((rule) => rule.startsWith('RRULE:'));
  if (!rrule) return null;

  const parts = new Map(
    rrule
      .slice('RRULE:'.length)
      .split(';')
      .map((pair) => {
        const [key, value] = pair.split('=');
        return [key, value] as const;
      }),
  );

  // Our model counts occurrences by date, not by how many have happened.
  if (parts.has('COUNT')) return null;
  // "The 3rd Tuesday", "the 15th of the month" — a different shape of rule.
  if (parts.has('BYMONTHDAY') || parts.has('BYSETPOS')) return null;

  const interval = Number(parts.get('INTERVAL') ?? '1');
  const freq = parts.get('FREQ');

  let recurrence: EventRecurrence | null = null;
  if (freq === 'DAILY' && interval === 1) recurrence = EventRecurrence.DAILY;
  else if (freq === 'WEEKLY' && interval === 1) recurrence = EventRecurrence.WEEKLY;
  else if (freq === 'WEEKLY' && interval === 2) recurrence = EventRecurrence.BIWEEKLY;
  else if (freq === 'MONTHLY' && interval === 1) recurrence = EventRecurrence.MONTHLY;
  if (!recurrence) return null;

  const byWeekdays = parseByDay(parts.get('BYDAY'));
  if (byWeekdays === null) return null;
  // A weekday list only means anything to a weekly rule. On a monthly one it is
  // the positional form we already refused, so anything left here is a rule we
  // would expand wrongly.
  if (
    byWeekdays.length > 0 &&
    recurrence !== EventRecurrence.WEEKLY &&
    recurrence !== EventRecurrence.BIWEEKLY
  ) {
    return null;
  }

  // Absent UNTIL is a series with no end, which the expansion now bounds by the
  // window it is drawing. A malformed one is not the same thing and is refused.
  const rawUntil = parts.get('UNTIL');
  const until = rawUntil ? parseUntil(rawUntil) : null;
  if (rawUntil && !until) return null;

  // WKST is deliberately ignored: it only affects which weeks an INTERVAL>1
  // rule lands on, and expansion already fixes Monday as the week start — which
  // is the WKST Google writes on every rule it produces.
  return { recurrence, until, byWeekdays };
}

/**
 * An RRULE UNTIL, which is basic-format ISO 8601 — `20261231T235959Z`, or a
 * bare `20261231` for an all-day series. `new Date()` parses neither.
 */
function parseUntil(value: string | undefined): Date | null {
  if (!value) return null;

  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(value);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const parsed = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour ?? '23'),
      Number(minute ?? '59'),
      Number(second ?? '59'),
      hour ? 0 : 999,
    ),
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** And back the other way, for an event we are pushing to Google. */
export function toRRule(
  recurrence: string | null,
  until: Date | null,
  byWeekdays: number[] = [],
): string[] | undefined {
  if (!recurrence || !isEventRecurrence(recurrence)) return undefined;

  const clauses = [
    recurrence === EventRecurrence.BIWEEKLY
      ? 'FREQ=WEEKLY;INTERVAL=2'
      : `FREQ=${recurrence === EventRecurrence.MONTHLY ? 'MONTHLY' : recurrence}`,
  ];

  // Only a weekly rule can carry weekdays; on anything else Google would read
  // BYDAY as the positional form and produce a different series entirely.
  if (
    byWeekdays.length > 0 &&
    (recurrence === EventRecurrence.WEEKLY || recurrence === EventRecurrence.BIWEEKLY)
  ) {
    const days = [...new Set(byWeekdays)]
      .toSorted((a, b) => a - b)
      .map((day) => WEEKDAY_TOKENS[day])
      .filter(Boolean);
    if (days.length > 0) clauses.push(`BYDAY=${days.join(',')}`);
  }

  // No UNTIL at all for an open-ended series — omitting it is how RFC 5545 says
  // "forever", and sending an empty one would be malformed.
  if (until) {
    clauses.push(
      `UNTIL=${until.getUTCFullYear()}${pad(until.getUTCMonth() + 1)}${pad(
        until.getUTCDate(),
      )}T${pad(until.getUTCHours())}${pad(until.getUTCMinutes())}${pad(until.getUTCSeconds())}Z`,
    );
  }

  return [`RRULE:${clauses.join(';')}`];
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * A Google start/end into an instant.
 *
 * An all-day event carries `date` rather than `dateTime`; it is interpreted at
 * midnight UTC, which is what our own all-day events use.
 */
export function parseEventTime(time: GoogleEventTime | undefined): Date | null {
  if (!time) return null;
  if (time.dateTime) return new Date(time.dateTime);
  if (time.date) return new Date(`${time.date}T00:00:00.000Z`);
  return null;
}

export function isAllDay(event: GoogleEvent): boolean {
  return Boolean(event.start?.date && !event.start?.dateTime);
}

/**
 * Attendee addresses, minus the account holder's own.
 *
 * Google lists the organiser among the attendees; carrying that back as an
 * "external guest" would show the calendar's owner as a stranger on their own
 * meeting.
 */
export function attendeeEmails(event: GoogleEvent): string[] {
  return (event.attendees ?? [])
    .filter((attendee) => attendee.email && !attendee.self)
    .map((attendee) => attendee.email!);
}
