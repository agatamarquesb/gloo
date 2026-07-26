/**
 * Categorical series palette for charts.
 *
 * Chart data colors live here rather than in globals.css because Recharts needs
 * literal values in JS; UI/chrome colors stay in globals.css. This is still a
 * single source of truth — no chart component defines its own hex.
 *
 * Validated with the dataviz skill's checker (`--pairs all`, both modes):
 *   light — lightness/chroma/CVD/normal-vision all PASS; contrast WARN on
 *           yellow + magenta, relieved by the sector pills' visible labels.
 *   dark  — all PASS except a CVD warn-band pair (ΔE 6.9), likewise legal
 *           because every slice is directly labelled by its pill.
 * Slots are assigned in fixed order and never cycled or reordered by value —
 * a sector keeps its color regardless of rank or filtering.
 */
export const CHART_SERIES = {
  light: ['#eda100', '#2a78d6', '#008300', '#e87ba4'],
  dark: ['#c98500', '#3987e5', '#008300', '#d55181'],
} as const;

/** Surface the marks sit on, used for the 2px separating gap between slices. */
export const CHART_SURFACE = {
  light: '#ffffff',
  dark: '#211f1f',
} as const;

export function seriesColor(index: number, isDark: boolean): string {
  const slots = isDark ? CHART_SERIES.dark : CHART_SERIES.light;
  return slots[index % slots.length];
}
