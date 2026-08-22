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

/** The tasks list — the "Ver todas" on the Dashboard's own task card. */
export const TASKS_PATH = '/tasks';

/**
 * Where a task is read. The Tasks page under its own id, which opens the task's
 * dialog over the list — see the `/tasks/:taskId` route.
 */
export function taskPath(id: string): string {
  return `${TASKS_PATH}/${id}`;
}

/** The Dashboard, which is where routines live. */
export const DASHBOARD_PATH = '/';

/**
 * The search param that names a routine to open on the Dashboard.
 *
 * Routines have no route of their own — they are a card on the Dashboard — so
 * "go to this routine" is that page plus this param, read once by RoutinesCard
 * and then dropped from the URL.
 */
export const ROUTINE_PARAM = 'rotina';

/** Where a routine is read: the Dashboard, with the routine's dialog open on it. */
export function routinePath(id: string): string {
  return `${DASHBOARD_PATH}?${ROUTINE_PARAM}=${id}`;
}
