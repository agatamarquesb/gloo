/** A trailing " (3)", which is how a duplicate is marked. */
const COPY_SUFFIX = /\s*\((\d+)\)$/;

/**
 * What to call a copy of `description`, given every routine name already in use.
 *
 * Numbering restarts from the stem rather than the name it was copied from, so
 * duplicating "Planejamento mensal (1)" gives "(2)" and not "(1) (1)" — a copy
 * of a copy is another copy of the same routine, and the list reads as a run.
 *
 * It takes the lowest free number rather than one past the highest, so deleting
 * "(2)" out of a run of three leaves a gap the next duplicate fills instead of
 * counting off into the distance.
 */
export function duplicateRoutineName(description: string, taken: string[]): string {
  const stem = description.replace(COPY_SUFFIX, '').trim();

  const used = new Set<number>();
  for (const name of taken) {
    const trimmed = name.trim();
    const match = COPY_SUFFIX.exec(trimmed);
    if (match && trimmed.slice(0, match.index).trim() === stem) {
      used.add(Number(match[1]));
    }
  }

  let next = 1;
  while (used.has(next)) next += 1;
  return `${stem} (${next})`;
}
