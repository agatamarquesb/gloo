/**
 * Chart chrome that needs a literal value in JS rather than a Tailwind class.
 *
 * Series colors are NOT here: charts color their marks from the task-summary tile
 * palette via theme/colors.ts (`tileColor`), so a sector's slice matches the tile
 * of the same slot instead of introducing a second palette. The categorical
 * palette that used to live in this file was retired with that change.
 */

/** Surface the marks sit on, used for the 2px separating gap between slices. */
export const CHART_SURFACE = {
  light: '#ffffff',
  dark: '#211f1f',
} as const;
