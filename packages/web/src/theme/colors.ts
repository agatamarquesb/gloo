/**
 * Reads the brand palette from the live CSS custom properties defined in
 * src/styles/globals.css (the single source of truth) instead of duplicating
 * the hex values here. Used where a raw color string is required rather than
 * a Tailwind class — e.g. Recharts `fill`/`stroke` props.
 */
const PALETTE_VARS = ['--blue', '--yellow', '--green', '--red', '--black'] as const;

/** Green is the primary brand color — prefer it whenever a single accent is needed. */
export type PaletteKey = 'blue' | 'yellow' | 'green' | 'red' | 'black';

export function getPaletteColor(key: PaletteKey): string {
  const varName = `--${key}`;
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

export function getPalette(): Record<PaletteKey, string> {
  const styles = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    PALETTE_VARS.map((varName) => [varName.slice(2), styles.getPropertyValue(varName).trim()]),
  ) as Record<PaletteKey, string>;
}

/**
 * The task-summary tile colors, in the order the tiles appear on the Dashboard
 * (to do, in progress, done, overdue). Charts reuse these so a sector's slice
 * matches the tiles rather than introducing a second palette.
 *
 * Read live rather than duplicated as hex because --tile-* are the palette's
 * per-mode tokens: the same call returns the light pastels or the dark muted
 * steps depending on the active theme. Prefer the useTileColors hook over calling
 * this directly — it re-reads when the theme flips, which a bare call won't.
 */
const TILE_VARS = ['--tile-todo', '--tile-progress', '--tile-done', '--tile-overdue'] as const;

export function getTileColors(): string[] {
  const styles = getComputedStyle(document.documentElement);
  return TILE_VARS.map((varName) => styles.getPropertyValue(varName).trim());
}
