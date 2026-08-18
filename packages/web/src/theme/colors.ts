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
 * The sector ramp — one green in four steps, lightest first — in the fixed
 * display order of the sectors themselves (see sectorOrder). Every view that
 * colors data by sector reads this one list, so a sector is the same green in
 * the donut, on the calendar's day dots and in any legend beside them.
 *
 * Read live rather than duplicated as hex because --sector-* are per-mode
 * tokens: the same call returns the light ramp or the dark one depending on the
 * active theme. Prefer the useSectorColors hook over calling this directly — it
 * re-reads when the theme flips, which a bare call won't.
 */
const SECTOR_VARS = ['--sector-1', '--sector-2', '--sector-3', '--sector-4'] as const;

export function getSectorColors(): string[] {
  const styles = getComputedStyle(document.documentElement);
  return SECTOR_VARS.map((varName) => styles.getPropertyValue(varName).trim());
}
