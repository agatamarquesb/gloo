/**
 * Where each event sits in a day column, and how wide it is.
 *
 * Pure and free of any React or DOM, so the packing can be reasoned about — and
 * tested — without a grid to render it into. The grid turns what comes out of
 * here into percentages.
 */

export interface LayoutEvent {
  id: string;
  /** ISO instants. */
  startsAt: string;
  endsAt: string;
}

export interface PositionedEvent<T extends LayoutEvent> {
  event: T;
  /** Which lane of its own start group, from 0. */
  column: number;
  /** How many events share that exact start, and so how many lanes to split. */
  columns: number;
  /**
   * How many earlier starts this event is laid over.
   *
   * 0 is a block that begins on its column's own left edge. 1 or more is a block
   * inset by that many steps, drawn on top of the ones it overlaps — which is
   * what leaves a strip of each earlier block showing down the left, still
   * pressable, the way an overlapping day reads in Google Calendar.
   */
  depth: number;
  /** Minutes from midnight, clamped to the day being drawn. */
  startMinute: number;
  endMinute: number;
}

/**
 * How far a block can be pushed in before the indent stops paying for itself.
 *
 * Five events in a chain, each starting after the last, would otherwise leave
 * the fifth a sliver. Past this they stack on the same step: the ones underneath
 * are already reachable, and the alternative is a block too narrow to read.
 */
const MAX_DEPTH = 3;

const MINUTES_PER_DAY = 24 * 60;

/**
 * A zero-length event still has to take a lane of its own.
 *
 * Overlap is a strict comparison, so without this an event that starts and ends
 * at 09:00 overlaps nothing — including another event at 09:00 — and the two
 * would be dealt the same lane and drawn on top of each other.
 */
const MIN_OVERLAP_MS = 1;

function endFor(event: LayoutEvent): number {
  const start = new Date(event.startsAt).getTime();
  return Math.max(new Date(event.endsAt).getTime(), start + MIN_OVERLAP_MS);
}

/**
 * The part of an event that falls on a given day, in minutes from its midnight.
 *
 * Returns null when none of it does. An event running from Tuesday 23:00 to
 * Wednesday 01:00 yields 1380–1440 on Tuesday and 0–60 on Wednesday, which is
 * what puts a block in both columns instead of one block overflowing its own.
 */
export function clipToDay(
  event: LayoutEvent,
  dayStart: Date,
): { startMinute: number; endMinute: number } | null {
  const dayStartMs = dayStart.getTime();
  const dayEndMs = dayStartMs + MINUTES_PER_DAY * 60_000;

  const start = new Date(event.startsAt).getTime();
  const end = endFor(event);

  if (start >= dayEndMs || end <= dayStartMs) return null;

  return {
    startMinute: Math.max(0, (start - dayStartMs) / 60_000),
    endMinute: Math.min(MINUTES_PER_DAY, (end - dayStartMs) / 60_000),
  };
}

/**
 * The calendar day an instant names, read in UTC.
 *
 * All-day events are *floating* dates, not moments: "the 8th" is the 8th
 * wherever you are. They are stored as UTC midnight, so converting them to a
 * local day — which is what the timed grid does to everything else — slides
 * them onto the day before for anyone west of Greenwich. In UTC−3 an all-day
 * event on the 8th was being drawn at 21:00 on the 7th.
 */
export function utcDayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export interface AllDayPlacement<T extends LayoutEvent> {
  event: T;
  /** Index into the day columns, inclusive. */
  columnStart: number;
  columnSpan: number;
  /** Which stacked row of the strip, from 0. */
  row: number;
}

/**
 * Place all-day events into the strip above the grid.
 *
 * Bars span the columns they cover, so a three-day trip is one bar and not
 * three, and overlapping bars stack into rows. Everything is compared as
 * `YYYY-MM-DD` strings rather than instants, which is what keeps a floating
 * date floating.
 *
 * The stored end is exclusive, matching Google: an all-day event on the 8th
 * runs 08T00:00Z → 09T00:00Z. Taking the day of `end - 1ms` gives back the 8th
 * and also copes with a non-midnight end, should one ever be stored.
 */
export function layoutAllDay<T extends LayoutEvent>(
  events: T[],
  dayKeys: string[],
): AllDayPlacement<T>[] {
  const placed: AllDayPlacement<T>[] = [];
  /** The last column each row is occupied up to. */
  const rowEnds: number[] = [];

  const spans = events.flatMap((event) => {
    const firstDay = utcDayKey(event.startsAt);
    const lastDay = utcDayKey(new Date(new Date(event.endsAt).getTime() - 1).toISOString());

    const columnStart = dayKeys.findIndex((key) => key >= firstDay);
    if (columnStart === -1) return [];

    let columnEnd = -1;
    for (let index = dayKeys.length - 1; index >= 0; index -= 1) {
      if (dayKeys[index] <= lastDay) {
        columnEnd = index;
        break;
      }
    }
    if (columnEnd < columnStart) return [];

    return [{ event, columnStart, columnEnd }];
  });

  // Longest first, so a multi-day bar takes the top row and the single days
  // tuck under it rather than fragmenting the strip.
  const ordered = spans.toSorted(
    (a, b) =>
      a.columnStart - b.columnStart ||
      b.columnEnd - b.columnStart - (a.columnEnd - a.columnStart),
  );

  for (const span of ordered) {
    let row = rowEnds.findIndex((end) => end < span.columnStart);
    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(span.columnEnd);
    } else {
      rowEnds[row] = span.columnEnd;
    }

    placed.push({
      event: span.event,
      columnStart: span.columnStart,
      columnSpan: span.columnEnd - span.columnStart + 1,
      row,
    });
  }

  return placed;
}

/**
 * Pack a single day's events.
 *
 * Two rules, which between them are how a day full of overlapping events stays
 * readable:
 *
 *   - Events that begin at the *same* minute stand side by side, splitting the
 *     width between them. Neither is more important than the other and neither
 *     can cover the other up.
 *   - An event that begins *later* than one already running is drawn over it,
 *     stepped in from the left. The earlier block keeps a strip of itself
 *     showing — enough to read its colour and to press it — and the later block
 *     stays as wide as it can be.
 *
 * The lanes-of-equal-width packing this replaced obeyed neither: a 09:00 event
 * and a 09:30 event each lost half the column, so a morning with four things in
 * it was four slivers, none of them readable and none of them obviously later
 * than the next.
 */
export function layoutDay<T extends LayoutEvent>(
  events: T[],
  dayStart: Date,
): PositionedEvent<T>[] {
  const clipped = events.flatMap((event) => {
    const span = clipToDay(event, dayStart);
    return span ? [{ event, ...span }] : [];
  });

  // Earliest first; the longer of two events starting together takes the left
  // lane, which reads better than the reverse.
  const ordered = clipped.toSorted(
    (a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute,
  );

  const positioned: PositionedEvent<T>[] = [];

  for (let index = 0; index < ordered.length; ) {
    const startMinute = ordered[index].startMinute;

    // Everything beginning on this exact minute, taken together: they are the
    // ones that share a width rather than covering each other.
    let groupEnd = index;
    while (groupEnd < ordered.length && ordered[groupEnd].startMinute === startMinute) {
      groupEnd += 1;
    }
    const group = ordered.slice(index, groupEnd);

    // How many *distinct earlier starts* are still running underneath. Distinct,
    // so three events that began together at 09:00 are one step down, not three.
    const openStarts = new Set(
      positioned.filter((entry) => entry.endMinute > startMinute).map((entry) => entry.startMinute),
    );
    const depth = Math.min(openStarts.size, MAX_DEPTH);

    group.forEach((entry, lane) => {
      positioned.push({
        event: entry.event,
        column: lane,
        columns: group.length,
        depth,
        startMinute: entry.startMinute,
        endMinute: entry.endMinute,
      });
    });

    index = groupEnd;
  }

  return positioned;
}
