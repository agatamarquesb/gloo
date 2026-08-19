/**
 * The grid's one dimension, on its own so the drag hook and the grid can both
 * read it without importing each other.
 *
 * It is what converts between the two units the calendar thinks in: an hour of
 * grid is this many pixels, so a drag measured in pixels becomes minutes by
 * dividing by it. Changing it rescales the whole grid and the drag maths
 * together.
 */
export const HOUR_HEIGHT = 48;

/**
 * How far above the current hour the grid opens.
 *
 * The grid arrives on the time it is, not on a fixed hour: in the morning that
 * is the morning, in the evening the end of the day. An hour of context above
 * the line, because what has just happened is as much of an answer to "where am
 * I" as what is next — and the browser clamps the far end, so at 23:00 this
 * simply lands on the bottom of the day.
 */
export const SCROLL_LEAD_HOURS = 1;

/** Where the grid opens: the hour it is now, less the lead above it. */
export function initialScrollTop(now: Date = new Date()): number {
  const hours = now.getHours() + now.getMinutes() / 60 - SCROLL_LEAD_HOURS;
  return Math.max(0, hours * HOUR_HEIGHT);
}

export const MINUTES_PER_DAY = 24 * 60;

/**
 * A floor, so a fifteen-minute event is still something you can read and press.
 */
const MIN_BLOCK_HEIGHT = 18;

/**
 * The pixel taken off the bottom of every block, so two consecutive events show
 * a seam rather than meeting as one unbroken band of colour.
 */
const BLOCK_SEAM = 2;

/**
 * How tall a block of this many minutes is drawn.
 *
 * Here rather than in the grid because the block itself has to know: what fits
 * inside it — one line of title or two, the times, a row of faces — is decided
 * by the height, and a second copy of this arithmetic in EventBlock would drift
 * from this one the first time either changed.
 */
export function blockHeight(minutes: number): number {
  return Math.max(MIN_BLOCK_HEIGHT, (minutes / 60) * HOUR_HEIGHT - BLOCK_SEAM);
}
