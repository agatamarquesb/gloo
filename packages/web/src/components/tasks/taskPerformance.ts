import { elapsedMs, type TaskListItemDto, type TaskPriority } from '@gloo/shared';

/**
 * Whether a finished task met its deadline.
 *
 * `NONE` is the third answer and not a failure: a task with no deadline, or one
 * whose completion was never recorded, cannot be on time or late, and counting
 * it as either would make the punctuality figure a lie. It is reported
 * separately so the card can say how many tasks the metric had nothing to say
 * about, rather than quietly dropping them.
 */
export type Punctuality = 'ON_TIME' | 'LATE' | 'NONE';

/** A day lasts this long, and a deadline is a day rather than an instant. */
const DAY_MS = 86_400_000;

/**
 * The deadline against the completion.
 *
 * On time means finished *on or before the day itself* — the brief's wording,
 * and the only reading that matches how a deadline is stored: `dueDate` is
 * midnight UTC on the chosen day, so the whole of that day is still in time.
 * Comparing against the stored instant alone would call every task finished
 * during its own deadline day late.
 */
export function completionPunctuality(
  dueDate: string | null,
  completedAt: string | null,
): Punctuality {
  if (!dueDate || !completedAt) return 'NONE';

  const deadline = new Date(dueDate).getTime();
  const finished = new Date(completedAt).getTime();
  if (Number.isNaN(deadline) || Number.isNaN(finished)) return 'NONE';

  // The last instant of the deadline day, not its first.
  return finished < deadline + DAY_MS ? 'ON_TIME' : 'LATE';
}

/** One finished task, as the chart draws it: one bar. */
export interface PerformanceBar {
  id: string;
  title: string;
  /** How long it spent in "Em andamento", in milliseconds. */
  ms: number;
  punctuality: Punctuality;
}

export interface Performance {
  /** Oldest completion first, so the row of bars reads left to right in time. */
  bars: PerformanceBar[];
  /**
   * The headline: the total time every finished task of this priority spent in
   * progress, divided by how many of them there were. Null when there are none
   * — an average of nothing is not zero.
   */
  averageMs: number | null;
  onTime: number;
  late: number;
  /** Finished, but with no deadline to be measured against. */
  noDeadline: number;
}

/**
 * Which tasks the chart is about: one priority, or every one of them.
 *
 * `ALL` is not a fourth priority — it is the same question asked without the
 * split, which is what a reader wants before they want the breakdown: how long
 * does a task take here, full stop.
 */
export type PerformanceScope = TaskPriority | 'ALL';

/**
 * What the productivity card shows for one priority.
 *
 * Only tasks that were actually *worked on* count. The clock starts when a task
 * moves from "A fazer" to "Em andamento" and stops when it reaches "Feita" (see
 * timeTracking in the API's task routes), so a task dragged straight from the
 * first to the last has no measured stretch at all — a real zero in the average
 * would say it was finished instantly, which is the opposite of what happened.
 * Those tasks are left out of the bars and out of the mean; they still count
 * towards punctuality, which needs only a deadline and a completion.
 */
export function buildPerformance(
  tasks: TaskListItemDto[],
  scope: PerformanceScope,
): Performance {
  const ofPriority = tasks.filter(
    (task) => (scope === 'ALL' || task.priority === scope) && task.completedAt !== null,
  );

  const bars = ofPriority
    .map((task) => ({
      id: task.id,
      title: task.title,
      // `elapsedMs` rather than `workedMs`, so the two never disagree about what
      // "how long did this take" means. A finished task has no stretch running,
      // so in practice the two are the same number here.
      ms: elapsedMs(task),
      punctuality: completionPunctuality(task.dueDate, task.completedAt),
      completedAt: task.completedAt as string,
    }))
    .filter((bar) => bar.ms > 0)
    .toSorted((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime())
    .map(({ completedAt: _completedAt, ...bar }) => bar);

  const total = bars.reduce((sum, bar) => sum + bar.ms, 0);

  let onTime = 0;
  let late = 0;
  let noDeadline = 0;
  for (const task of ofPriority) {
    const verdict = completionPunctuality(task.dueDate, task.completedAt);
    if (verdict === 'ON_TIME') onTime += 1;
    else if (verdict === 'LATE') late += 1;
    else noDeadline += 1;
  }

  return {
    bars,
    averageMs: bars.length > 0 ? Math.round(total / bars.length) : null,
    onTime,
    late,
    noDeadline,
  };
}
