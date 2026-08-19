/**
 * The projects index — where the card's heading chevron goes.
 *
 * The same placeholder a single project opens onto for now, since neither page
 * has been built; it is written down separately so that when they diverge only
 * this line changes.
 */
export const PROJECTS_PATH = '/projects';

/**
 * Where a project lives.
 *
 * A function rather than a string written at the call site, because the page it
 * points at does not exist yet: when it is built — and when a project stops
 * being a slug in ProjectsCard and becomes a row with an id — this is the one
 * place that has to change.
 */
export function projectPath(id: string): string {
  return `/projects/${id}`;
}
