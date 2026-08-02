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
  /** Which lane of its cluster, from 0. */
  column: number;
  /** How many lanes that cluster ended up needing. */
  columns: number;
  /** Minutes from midnight, clamped to the day being drawn. */
  startMinute: number;
  endMinute: number;
}

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
 * Pack a single day's events into lanes.
 *
 * Two events that overlap in time are given adjacent lanes of equal width; a
 * run of events that overlap transitively forms one cluster and shares its
 * width. Closing the cluster only when nothing is still running is what stops a
 * single long event at 09:00–18:00 squeezing the entire day into half-width
 * columns — its cluster ends when it does, and the evening starts fresh.
 *
 * Greedy first-fit rather than anything cleverer: it matches what every
 * calendar does, and the pathological cases it loses on (a long event beside
 * many short ones) are the ones users read as correct anyway.
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
  /** The end minute of the last event placed in each lane, for this cluster. */
  let laneEnds: number[] = [];
  /** Where the current cluster's entries begin in `positioned`. */
  let clusterStart = 0;

  function closeCluster() {
    const width = laneEnds.length;
    for (let index = clusterStart; index < positioned.length; index += 1) {
      positioned[index].columns = width;
    }
    laneEnds = [];
    clusterStart = positioned.length;
  }

  for (const entry of ordered) {
    // Nothing from the previous cluster is still running, so its width is
    // settled and this event starts a new one.
    if (laneEnds.length > 0 && laneEnds.every((end) => end <= entry.startMinute)) {
      closeCluster();
    }

    let lane = laneEnds.findIndex((end) => end <= entry.startMinute);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(entry.endMinute);
    } else {
      laneEnds[lane] = entry.endMinute;
    }

    positioned.push({
      event: entry.event,
      column: lane,
      // Provisional: the cluster's final width isn't known until it closes.
      columns: 1,
      startMinute: entry.startMinute,
      endMinute: entry.endMinute,
    });
  }

  if (positioned.length > clusterStart) closeCluster();

  return positioned;
}
