import { TaskStatus } from '@gloo/shared';

/**
 * The order the user dragged their tasks into, on the Dashboard's "Minhas
 * tarefas" card.
 *
 * Kept in `localStorage`, like the dismissed notifications and for the same
 * reason: it is one person's view of a shared list — a arrangement, not a fact
 * about the task — and the server has no column for it. The cost is that it does
 * not follow you to another browser, which is the right trade for a card you
 * arrange while working.
 *
 * The stored value is only a list of ids. Tasks it doesn't mention still appear
 * (see `sortByManualOrder`), so nothing is ever hidden by an order that has
 * fallen behind the list.
 */
export const MY_TASKS_ORDER_KEY = 'gloo-my-tasks-order';

/**
 * And the Tasks page's own list, which is a different list of the same objects:
 * everyone's tasks rather than yours, under whatever filter that page is on. Its
 * own key because an arrangement of five of your rows says nothing useful about
 * the order of forty of everybody's.
 */
export const ALL_TASKS_ORDER_KEY = 'gloo-tasks-order';

export function readTaskOrder(key: string = MY_TASKS_ORDER_KEY): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : [];
  } catch {
    // Corrupt or unavailable storage must not take the card down with it.
    return [];
  }
}

export function writeTaskOrder(ids: string[], key: string = MY_TASKS_ORDER_KEY) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Private mode, a full quota — the order is a convenience, not the data.
  }
}

/**
 * The list as the card shows it: finished tasks at the bottom, everything else
 * in the order the user arranged.
 *
 * Completing a task sinking it is the point — a done row has nothing left to do
 * on it, and leaving it among the live ones means reading past it every time.
 * Tasks the order has never seen come *first* rather than last: those are the
 * ones just created, and a new task appearing off the bottom of a scrolling card
 * looks like it was never created at all.
 *
 * `toSorted` is stable, so tasks that tie — two unplaced ones, two done ones —
 * keep the order the server sent them in.
 */
export function sortByManualOrder<T extends { id: string; status: TaskStatus }>(
  tasks: T[],
  order: string[],
): T[] {
  const rank = new Map(order.map((id, index) => [id, index]));

  return tasks.toSorted((a, b) => {
    const doneDiff = Number(a.status === TaskStatus.DONE) - Number(b.status === TaskStatus.DONE);
    if (doneDiff !== 0) return doneDiff;

    return (rank.get(a.id) ?? -1) - (rank.get(b.id) ?? -1);
  });
}

/**
 * The order after dropping `dragId` onto `targetId`.
 *
 * `visibleIds` is the list as it currently reads on screen, which is what the
 * user is actually rearranging — the stored order may be filtered, searched or
 * simply older than some of these tasks. Anything visible but unknown is folded
 * in at its current position first, so a drag always lands where it was aimed
 * even the first time the card is touched.
 *
 * Direction decides the side: dragging a row upwards puts it above the row it
 * was dropped on, downwards puts it below. Anything else means a row dropped one
 * place down would not move at all.
 */
export function reorderTasks(
  order: string[],
  visibleIds: string[],
  dragId: string,
  targetId: string,
): string[] {
  const seeded = [...visibleIds.filter((id) => !order.includes(id)), ...order];

  const movingUp = visibleIds.indexOf(dragId) > visibleIds.indexOf(targetId);
  const without = seeded.filter((id) => id !== dragId);
  const target = without.indexOf(targetId);
  if (target === -1) return seeded;

  const at = movingUp ? target : target + 1;
  return [...without.slice(0, at), dragId, ...without.slice(at)];
}
