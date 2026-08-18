/**
 * The grid's one dimension, on its own so the drag hook and the grid can both
 * read it without importing each other.
 *
 * It is what converts between the two units the calendar thinks in: an hour of
 * grid is this many pixels, so a drag measured in pixels becomes minutes by
 * dividing by it. Changing it rescales the whole grid and the drag maths
 * together.
 */
export const HOUR_HEIGHT = 64;

/**
 * The hour the grid opens on: 04:00 at the top, and as much of the day after it
 * as the card is tall.
 *
 * Only a starting position now, not a height. The card is sized by the window —
 * the page does not scroll, so the grid gets whatever is left of the screen and
 * scrolls through the rest of the day inside itself. Fixing the height here
 * instead made the card taller than the window on a small screen and shorter
 * than it on a large one, both of which the layout had to work around.
 */
export const FIRST_VISIBLE_HOUR = 4;

export const MINUTES_PER_DAY = 24 * 60;
