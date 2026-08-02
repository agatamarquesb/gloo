/**
 * The grid's one dimension, on its own so the drag hook and the grid can both
 * read it without importing each other.
 *
 * It is what converts between the two units the calendar thinks in: an hour of
 * grid is this many pixels, so a drag measured in pixels becomes minutes by
 * dividing by it. Changing it rescales the whole grid and the drag maths
 * together.
 */
export const HOUR_HEIGHT = 52;

export const MINUTES_PER_DAY = 24 * 60;
