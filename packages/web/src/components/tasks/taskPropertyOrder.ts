/**
 * The order the properties are listed in inside the task modal — priority,
 * deadline, sector, project, status, responsible, progress — as the user
 * arranged them by dragging.
 *
 * Kept in `localStorage`, like the Dashboard's task order and for the same
 * reason: it is one person's view of a shared object — an arrangement, not a
 * fact about the task — and the server has no column for it. It therefore
 * applies to every task this browser opens, which is the point: the property
 * list is the shape of a task, and a shape that changed from one task to the
 * next would be unreadable.
 */
export const TASK_PROPERTY_KEYS = [
  'priority',
  'deadline',
  'sector',
  'project',
  'status',
  'assignee',
  'progress',
] as const;

export type TaskPropertyKey = (typeof TASK_PROPERTY_KEYS)[number];

const ORDER_KEY = 'gloo-task-properties-order';

function isKnown(value: unknown): value is TaskPropertyKey {
  return TASK_PROPERTY_KEYS.includes(value as TaskPropertyKey);
}

/**
 * The stored arrangement, always as a complete list.
 *
 * Anything unknown is dropped and anything missing is appended in the default
 * order, so a stored order written before a property existed — or after one was
 * removed — still renders the full list rather than losing a row to it.
 */
export function readPropertyOrder(): TaskPropertyKey[] {
  let stored: unknown = [];
  try {
    stored = JSON.parse(localStorage.getItem(ORDER_KEY) ?? '[]');
  } catch {
    // Corrupt or unavailable storage must not take the dialog down with it.
  }

  const known = Array.isArray(stored) ? stored.filter(isKnown) : [];
  const seen = new Set(known);
  return [...seen, ...TASK_PROPERTY_KEYS.filter((key) => !seen.has(key))];
}

export function writePropertyOrder(keys: TaskPropertyKey[]) {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(keys));
  } catch {
    // Private mode, a full quota — the order is a convenience, not the data.
  }
}

/**
 * The order after dropping `dragKey` onto `targetKey`.
 *
 * Direction decides the side, exactly as it does for a dragged task row: a
 * property dragged upwards lands above the one it was dropped on, downwards
 * below it. Anything else and a row dropped one place down would not move.
 */
export function reorderProperties(
  keys: TaskPropertyKey[],
  dragKey: TaskPropertyKey,
  targetKey: TaskPropertyKey,
): TaskPropertyKey[] {
  const movingUp = keys.indexOf(dragKey) > keys.indexOf(targetKey);
  const without = keys.filter((key) => key !== dragKey);
  const target = without.indexOf(targetKey);
  if (target === -1) return keys;

  const at = movingUp ? target : target + 1;
  return [...without.slice(0, at), dragKey, ...without.slice(at)];
}
