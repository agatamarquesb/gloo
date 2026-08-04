import { LabelScope } from '@gloo/shared';

import { prisma } from './prisma';

/**
 * The ids that actually belong to a pool, in the order they were given.
 *
 * Routines and tasks keep separate vocabularies (see `scope` on the Label
 * model), and the only thing standing between them is which list the picker
 * read. That is a guarantee about the UI, not about the API — so anything
 * writing tag links drops the ids that came from the other side rather than
 * quietly building a link that makes the two pools one again.
 */
export async function labelIdsInScope(ids: string[], scope: LabelScope): Promise<string[]> {
  if (ids.length === 0) return [];

  const rows = await prisma.label.findMany({
    where: { id: { in: ids }, scope },
    select: { id: true },
  });
  const allowed = new Set(rows.map((row) => row.id));

  return ids.filter((id) => allowed.has(id));
}
