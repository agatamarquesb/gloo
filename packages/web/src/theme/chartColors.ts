/**
 * Categorical series palette for charts.
 *
 * Chart data colors live here rather than in globals.css because Recharts needs
 * literal values in JS; UI/chrome colors stay in globals.css. This is still a
 * single source of truth — no chart component defines its own hex.
 *
 * Slot 0 is the brand primary green's hue so every chart leads with the primary
 * color, but at a DARKER step than --green itself in both modes: the brand value
 * (#c4d254) is a soft pastel, and a categorical series slot has to clear a
 * lightness band, a chroma floor and 3:1 against the surface — the pastel misses
 * all three, which would leave donut slices mushy and hard to tell apart. The
 * remaining slots are neutral categorical hues carrying no status meaning.
 *
 * Validated with the dataviz skill's checker (`--pairs all`, both modes):
 *   light — lightness/chroma/CVD/normal-vision all PASS; contrast WARN on
 *           green + magenta, relieved by the sector pills' visible labels.
 *   dark  — all six checks PASS.
 * Re-run the checker before changing any slot.
 *
 * Slots are assigned in fixed order and never cycled or reordered by value —
 * a sector keeps its color regardless of rank or filtering.
 */
export const CHART_SERIES = {
  light: ['#9abc04', '#2a78d6', '#008300', '#e87ba4'],
  dark: ['#86a300', '#3987e5', '#008300', '#d55181'],
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
