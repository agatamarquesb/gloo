/**
 * Fixed display order for sectors, shared by every view that colors data by
 * sector (the donut's slices and pills, the calendar's day dots). A sector's
 * position here *is* its color slot, so this has to be the single source of that
 * order — if the donut and the calendar derived it separately they would drift
 * apart and the same sector would get two different colors.
 *
 * Matched loosely (accent- and case-insensitively) because these are names in
 * the database rather than enum keys. Anything unlisted sorts to the end, keeping
 * its original relative order, so adding a sector never reshuffles the others.
 */
const SECTOR_ORDER = ['gestao', 'comercial', 'produto & servico', 'marketing & aquisicao'];

function orderKey(name: string): number {
  const normalized = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
  const index = SECTOR_ORDER.indexOf(normalized);
  return index === -1 ? SECTOR_ORDER.length : index;
}

/** Sorts any list carrying a sector name into the fixed display order. */
export function sortBySectorOrder<T>(items: T[], nameOf: (item: T) => string): T[] {
  return items.toSorted((a, b) => orderKey(nameOf(a)) - orderKey(nameOf(b)));
}
