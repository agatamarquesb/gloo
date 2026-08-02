import { EventRecurrence } from './enums';

/**
 * Turning a repeating event into the occurrences that fall inside a window.
 *
 * Lives in the shared package because both sides have to agree on what "the
 * Tuesday instance" is: the API expands when it answers `GET /calendar/events`,
 * and the grid needs the same answer to place an optimistic edit before the
 * server replies. Two implementations would drift the first time one of them
 * handled a clock change differently.
 *
 * Everything here is pure and dependency-free — the shared package has no
 * dependencies at all, and adding date-fns to it just for this would push it
 * into the web bundle too.
 */

/** The stored row a series is generated from. */
export interface RecurrenceMaster {
  id: string;
  /** ISO instant of the first occurrence. */
  startsAt: string;
  /** ISO instant the first occurrence ends. Later ones keep its duration. */
  endsAt: string;
  recurrence: EventRecurrence | null;
  /**
   * ISO instant the series stops at, inclusive: an occurrence starting exactly
   * on it still counts.
   *
   * An instant rather than a date because comparing instants needs no timezone
   * reasoning here. Callers that let the user pick a *day* store the last
   * millisecond of that day in the event's own zone — see the API's
   * `endOfDayInZone`, which is the one place that conversion happens.
   *
   * Null means the series never ends, in which case the requested window is the
   * only thing that bounds it.
   */
  recurrenceUntil: string | null;
  /**
   * Weekdays a weekly series lands on, 0=Sunday … 6=Saturday.
   *
   * Empty or absent means "whichever weekday the series started on", which is
   * how a plain `FREQ=WEEKLY` behaves. Ignored for DAILY and MONTHLY.
   */
  byWeekdays?: number[];
  /** IANA zone the series was created in. Occurrences keep its wall clock. */
  timeZone: string;
}

/**
 * An occurrence that has a row of its own — because it was edited, or deleted.
 *
 * Both kinds suppress the generated occurrence they replace; what differs is
 * what the caller does next. An edited one is returned as its own event, a
 * deleted one is returned as nothing at all. Expansion doesn't need to know
 * which, so it only asks for the slot.
 */
export interface RecurrenceException {
  recurringEventId: string;
  /** ISO instant of the slot this row stands in for. */
  originalStart: string;
}

export interface ExpandedInstance {
  masterId: string;
  /** The slot this occurrence fills. Its identity, and what Google keys on. */
  originalStart: string;
  startsAt: string;
  endsAt: string;
}

/**
 * How many occurrences one master may generate before we stop.
 *
 * A series always has an end date, so this is not what terminates the loop —
 * it is a guard against a corrupt row (an `until` centuries out, a start after
 * its own until) turning one request into an unbounded one. Daily for five
 * years is comfortably under it.
 */
const MAX_OCCURRENCES = 2000;

const PART_KEYS = ['year', 'month', 'day', 'hour', 'minute', 'second'] as const;

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

/**
 * Formatters are cached because expanding a month of a daily series asks for
 * the same zone hundreds of times, and constructing an Intl.DateTimeFormat is
 * the expensive part of this whole module.
 */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    // h23 rather than hour12:false — the latter still yields "24" for midnight
    // in some environments, which parses as the next day.
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

/** What a clock in `timeZone` reads at this instant. */
function toWallClock(instant: number, timeZone: string): WallClock {
  const parts = formatterFor(timeZone).formatToParts(new Date(instant));
  const values = {} as Record<(typeof PART_KEYS)[number], number>;

  for (const part of parts) {
    if ((PART_KEYS as readonly string[]).includes(part.type)) {
      values[part.type as (typeof PART_KEYS)[number]] = Number(part.value);
    }
  }

  return {
    ...values,
    // Intl has no millisecond field, so it is carried from the instant itself.
    // Safe because every zone offset is a whole number of minutes.
    millisecond: ((instant % 1000) + 1000) % 1000,
  };
}

/** The zone's offset from UTC at this instant, in milliseconds. */
function offsetAt(instant: number, timeZone: string): number {
  const wall = toWallClock(instant, timeZone);
  const asIfUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
    wall.millisecond,
  );
  return asIfUtc - instant;
}

/**
 * The instant at which a clock in `timeZone` reads this wall time.
 *
 * Two passes: the first guesses using the offset in force at the naive instant,
 * the second corrects it when that guess landed on the other side of a clock
 * change. Without the correction a 9am meeting the morning after the clocks go
 * forward comes out an hour wrong.
 *
 * Wall times that a clock never reads — the hour skipped by a spring-forward —
 * resolve to the instant the skipped hour would have started. That matches what
 * every calendar does with an event dragged into the gap, and the alternative
 * (dropping the occurrence) loses a meeting once a year.
 */
function fromWallClock(wall: WallClock, timeZone: string): number {
  const naive = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
    wall.millisecond,
  );

  const firstGuess = naive - offsetAt(naive, timeZone);
  const correctedOffset = offsetAt(firstGuess, timeZone);
  return naive - correctedOffset;
}

/**
 * The wall-clock date `step` intervals after the series start, or null when
 * that date doesn't exist.
 *
 * Null only ever comes back from MONTHLY: a series starting on the 31st has no
 * occurrence in a 30-day month, and RFC 5545 — which is what Google implements —
 * says to skip such a month rather than slide the occurrence onto the 30th.
 * Clamping instead would silently turn "the 31st" into "the last day", and the
 * following month would jump back to the 31st.
 */
/** Days between occurrences, for the three rules that move by a fixed span. */
function stepDays(recurrence: EventRecurrence): number {
  if (recurrence === EventRecurrence.DAILY) return 1;
  return recurrence === EventRecurrence.WEEKLY ? 7 : 14;
}

/**
 * The week a weekly series counts from, as a wall-clock date.
 *
 * Monday, because that is the `WKST` Google sends on every rule it writes. It
 * only matters for BIWEEKLY: with a one-week interval every week is "on", so
 * where the week is deemed to start makes no difference, but with two the
 * choice decides which alternate weeks the series lands on.
 */
function startOfWeekWall(wall: WallClock): WallClock {
  const asUtc = new Date(Date.UTC(wall.year, wall.month - 1, wall.day));
  // getUTCDay is 0=Sunday; shift so Monday is 0.
  const fromMonday = (asUtc.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(wall.year, wall.month - 1, wall.day - fromMonday));

  return {
    ...wall,
    year: monday.getUTCFullYear(),
    month: monday.getUTCMonth() + 1,
    day: monday.getUTCDate(),
  };
}

/** The wall-clock date `days` after another, keeping its time of day. */
function addDays(wall: WallClock, days: number): WallClock {
  const shifted = new Date(Date.UTC(wall.year, wall.month - 1, wall.day + days));
  return {
    ...wall,
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** 0=Sunday … 6=Saturday, for a wall-clock date. */
function weekdayOf(wall: WallClock): number {
  return new Date(Date.UTC(wall.year, wall.month - 1, wall.day)).getUTCDay();
}

/**
 * Whether this rule needs the weekday-set expansion rather than the simple
 * fixed-step one.
 *
 * A single-weekday BYDAY that already matches the series start is the same
 * thing as a plain weekly rule, so it takes the cheaper path — which matters,
 * because Google marks *every* weekly event with a BYDAY and most of them name
 * exactly the day the event already falls on.
 */
function usesWeekdaySet(master: RecurrenceMaster, startWall: WallClock): boolean {
  if (master.recurrence !== EventRecurrence.WEEKLY && master.recurrence !== EventRecurrence.BIWEEKLY) {
    return false;
  }
  const days = master.byWeekdays ?? [];
  if (days.length === 0) return false;
  return !(days.length === 1 && days[0] === weekdayOf(startWall));
}

function advance(start: WallClock, recurrence: EventRecurrence, step: number): WallClock | null {
  if (recurrence === EventRecurrence.MONTHLY) {
    const monthIndex = start.month - 1 + step;
    const year = start.year + Math.floor(monthIndex / 12);
    const month = ((monthIndex % 12) + 12) % 12;

    // Day 0 of the next month is the last day of this one.
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    if (start.day > daysInMonth) return null;

    return { ...start, year, month: month + 1 };
  }

  const daysPerStep = stepDays(recurrence);

  // Day arithmetic in UTC, then read back as wall-clock fields: this shifts the
  // calendar date without touching the time of day, which is exactly what
  // keeps a 9am meeting at 9am across a clock change.
  const shifted = new Date(Date.UTC(start.year, start.month - 1, start.day + daysPerStep * step));

  return {
    ...start,
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function exceptionKey(masterId: string, originalStart: string): string {
  return `${masterId}|${originalStart}`;
}

/**
 * Expansion for a weekly rule that names its own days — "every Monday,
 * Wednesday and Friday".
 *
 * Walks whole weeks rather than occurrences, emitting each named weekday inside
 * each active week, because the gap between occurrences is not constant: Friday
 * to Monday is three days, Monday to Wednesday is two. The fixed-step loop
 * cannot express that at all.
 *
 * Occurrences before the series start are dropped. Google anchors a series to
 * the week its first event falls in, so "Mon/Wed/Fri from Wednesday the 5th"
 * has no Monday in its first week.
 */
function expandWeekdaySet(args: {
  master: RecurrenceMaster;
  startWall: WallClock;
  seriesStart: number;
  durationMs: number;
  until: number;
  windowStart: number;
  windowEnd: number;
  taken: Set<string>;
  instances: ExpandedInstance[];
}): void {
  const { master, startWall, seriesStart, durationMs, until, windowStart, windowEnd } = args;

  const weekInterval = master.recurrence === EventRecurrence.BIWEEKLY ? 2 : 1;
  const days = [...new Set(master.byWeekdays ?? [])].toSorted((a, b) => a - b);
  const firstWeek = startOfWeekWall(startWall);

  // Same fast-forward as the fixed-step loop, in whole weeks.
  const weekMs = weekInterval * 7 * 86_400_000;
  let week = 0;
  if (windowStart > seriesStart) {
    const margin = Math.ceil(Math.max(0, durationMs) / weekMs) + 1;
    week = Math.max(0, Math.floor((windowStart - seriesStart) / weekMs) - margin);
  }

  for (let emitted = 0; week < MAX_OCCURRENCES; week += 1) {
    const weekStart = addDays(firstWeek, week * weekInterval * 7);
    let anyBeforeWindowEnd = false;

    for (const weekday of days) {
      // days are 0=Sunday, and the week here starts on Monday.
      const offset = (weekday + 6) % 7;
      const wall = addDays(weekStart, offset);
      const occurrenceStart = fromWallClock(wall, master.timeZone);

      if (occurrenceStart < seriesStart || occurrenceStart > until) continue;
      if (occurrenceStart >= windowEnd) continue;
      anyBeforeWindowEnd = true;
      if (occurrenceStart + durationMs <= windowStart) continue;

      const originalStart = new Date(occurrenceStart).toISOString();
      if (args.taken.has(exceptionKey(master.id, originalStart))) continue;

      args.instances.push({
        masterId: master.id,
        originalStart,
        startsAt: originalStart,
        endsAt: new Date(occurrenceStart + durationMs).toISOString(),
      });
      emitted += 1;
      if (emitted >= MAX_OCCURRENCES) return;
    }

    // Every day of this week is already past the window or past the series'
    // end, so no later week can contribute either.
    const weekBegin = fromWallClock(weekStart, master.timeZone);
    if (!anyBeforeWindowEnd && (weekBegin >= windowEnd || weekBegin > until)) return;
  }
}

/**
 * Every occurrence of every master that overlaps `[from, to)`, minus the slots
 * an exception row already covers.
 *
 * Overlap rather than containment: a two-hour event starting before the window
 * and running into it belongs on the grid, and a week view whose first column
 * begins at 00:00 would otherwise lose anything crossing midnight from Sunday.
 *
 * Masters with no `recurrence` are returned as a single instance, so a caller
 * can hand the whole mixed list over without sorting one-offs out first.
 */
export function expandEvents(
  masters: RecurrenceMaster[],
  exceptions: RecurrenceException[],
  from: Date | string,
  to: Date | string,
): ExpandedInstance[] {
  const windowStart = new Date(from).getTime();
  const windowEnd = new Date(to).getTime();

  const taken = new Set(
    exceptions.map((exception) =>
      exceptionKey(exception.recurringEventId, new Date(exception.originalStart).toISOString()),
    ),
  );

  const instances: ExpandedInstance[] = [];

  for (const master of masters) {
    const seriesStart = new Date(master.startsAt).getTime();
    const durationMs = new Date(master.endsAt).getTime() - seriesStart;

    if (!master.recurrence) {
      if (seriesStart < windowEnd && seriesStart + durationMs > windowStart) {
        instances.push({
          masterId: master.id,
          originalStart: new Date(seriesStart).toISOString(),
          startsAt: new Date(seriesStart).toISOString(),
          endsAt: new Date(seriesStart + durationMs).toISOString(),
        });
      }
      continue;
    }

    // An open-ended series is bounded only by the window being drawn, which is
    // always finite — so `Infinity` here is safe and means "the loop stops when
    // it runs past the far edge of the window", exactly as a dated one does.
    const until = master.recurrenceUntil
      ? new Date(master.recurrenceUntil).getTime()
      : Number.POSITIVE_INFINITY;
    const startWall = toWallClock(seriesStart, master.timeZone);

    // "Every Monday and Wednesday" cannot be walked with one fixed step, so it
    // gets its own pass: week by week, emitting each named day inside it.
    if (usesWeekdaySet(master, startWall)) {
      expandWeekdaySet({
        master,
        startWall,
        seriesStart,
        durationMs,
        until,
        windowStart,
        windowEnd,
        taken,
        instances,
      });
      continue;
    }

    // Jump most of the way to the window instead of walking every occurrence
    // since the series began — a daily standup started two years ago is 700
    // wasted Intl lookups per request otherwise. The estimate is deliberately
    // short: it backs off far enough to cover the event's own length plus any
    // drift a clock change introduces, and the loop's own window checks throw
    // away whatever it lands early on. MONTHLY is left alone, being at most
    // twelve cheap steps a year.
    let step = 0;
    if (master.recurrence !== EventRecurrence.MONTHLY && windowStart > seriesStart) {
      const spanMs = stepDays(master.recurrence) * 86_400_000;
      const margin = Math.ceil(Math.max(0, durationMs) / spanMs) + 1;
      step = Math.max(0, Math.floor((windowStart - seriesStart) / spanMs) - margin);
    }

    for (; step < MAX_OCCURRENCES; step += 1) {
      const wall = advance(startWall, master.recurrence, step);
      // A month with no such day. The series continues — February does not end
      // a run of monthly meetings on the 31st.
      if (!wall) continue;

      const occurrenceStart = fromWallClock(wall, master.timeZone);
      if (occurrenceStart > until) break;

      const occurrenceEnd = occurrenceStart + durationMs;
      if (occurrenceStart >= windowEnd) break;
      if (occurrenceEnd <= windowStart) continue;

      const originalStart = new Date(occurrenceStart).toISOString();
      if (taken.has(exceptionKey(master.id, originalStart))) continue;

      instances.push({
        masterId: master.id,
        originalStart,
        startsAt: originalStart,
        endsAt: new Date(occurrenceEnd).toISOString(),
      });
    }
  }

  return instances.toSorted((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/**
 * The last instant of a calendar day, in a given zone, as an ISO string.
 *
 * This is what turns the date the user picks in "Repetir até" into the
 * `recurrenceUntil` the expansion compares against: they mean "including that
 * whole day", and storing midnight would drop any occurrence on it.
 *
 * Here rather than in the API because it is the same wall-clock-to-instant
 * conversion expansion already does, and a second implementation of that is
 * exactly what this module exists to avoid.
 */
export function endOfDayInZone(date: string, timeZone: string): string {
  const [year, month, day] = date
    .slice(0, 10)
    .split('-')
    .map((part) => Number(part));

  return new Date(
    fromWallClock(
      { year, month, day, hour: 23, minute: 59, second: 59, millisecond: 999 },
      timeZone,
    ),
  ).toISOString();
}

/**
 * The slot a given instant belongs to in a series — used when the client edits
 * an occurrence it generated itself and has to tell the API which one it meant.
 *
 * Returns null when the instant is not an occurrence, which is what stops a
 * stale grid from writing an exception against a slot that no longer exists.
 */
export function findOccurrence(master: RecurrenceMaster, instant: Date | string): string | null {
  const target = new Date(instant).getTime();
  const wanted = new Date(target).toISOString();

  // The window has to be wide enough to catch an occurrence that *starts* at
  // the target, but expansion answers with anything overlapping it — a long
  // event from the day before included. The exact match is what decides.
  const matches = expandEvents([master], [], new Date(target), new Date(target + 1));
  return matches.some((match) => match.originalStart === wanted) ? wanted : null;
}
