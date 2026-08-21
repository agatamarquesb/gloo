import { elapsedMs, TaskPriority, type TaskListItemDto } from '@gloo/shared';

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

/**
 * The order the three bars stand in: low to high, left to right.
 *
 * A scale is read from its light end, and the colours the card draws these in
 * step down the chart ramp in the same direction — so the row says which way
 * priority runs before any of its labels are read.
 */
export const PRIORITY_ORDER = [
  TaskPriority.LOW,
  TaskPriority.MEDIUM,
  TaskPriority.HIGH,
] as const;

/**
 * How far back the card looks.
 *
 * A window on the *completions*, not on the deadlines: the question is how long
 * work has been taking lately, so what belongs in it is the tasks that were
 * finished inside it, however long ago they were started.
 */
export const PerformancePeriod = {
  WEEK_1: 'WEEK_1',
  WEEK_2: 'WEEK_2',
  MONTH_1: 'MONTH_1',
  MONTH_3: 'MONTH_3',
  MONTH_6: 'MONTH_6',
  YEAR_1: 'YEAR_1',
  ALL: 'ALL',
} as const;
export type PerformancePeriod = (typeof PerformancePeriod)[keyof typeof PerformancePeriod];

/**
 * Whether a value is one of them — the guard the stored preference is read back
 * through, so a period written by an older build cannot come back as one this
 * one does not have.
 */
export function isPerformancePeriod(value: unknown): value is PerformancePeriod {
  return typeof value === 'string' && Object.hasOwn(PerformancePeriod, value);
}

/** The order the periods are offered in: shortest first, "Tudo" last. */
export const PERIOD_ORDER = [
  PerformancePeriod.WEEK_1,
  PerformancePeriod.WEEK_2,
  PerformancePeriod.MONTH_1,
  PerformancePeriod.MONTH_3,
  PerformancePeriod.MONTH_6,
  PerformancePeriod.YEAR_1,
  PerformancePeriod.ALL,
] as const;

/**
 * What the card opens on.
 *
 * A month rather than everything: the figure is meant to be read as "how long
 * work is taking", and over all of history that number stops moving — a bad
 * month a year ago weighs the same as this week. A month is long enough to hold
 * a useful number of completions and short enough to still change.
 */
export const DEFAULT_PERIOD: PerformancePeriod = PerformancePeriod.MONTH_1;

/**
 * How many days back each period reaches. `null` is "Tudo" — no window at all.
 *
 * Plain days rather than calendar months, because the window is a *rolling*
 * one: "último mês" means the last thirty days from now, not "since the 1st".
 */
const PERIOD_DAYS: Record<PerformancePeriod, number | null> = {
  WEEK_1: 7,
  WEEK_2: 14,
  MONTH_1: 30,
  MONTH_3: 90,
  MONTH_6: 180,
  YEAR_1: 365,
  ALL: null,
};

/** One priority, as the chart draws it: one bar. */
export interface PerformanceBar {
  priority: TaskPriority;
  /**
   * How long a task of this priority takes on average, in milliseconds. Null
   * when none of them was ever worked on — an average of nothing is not zero,
   * and a bar of no height is the honest way to draw it.
   */
  averageMs: number | null;
  /** How many finished tasks that average was taken over. */
  count: number;
}

export interface Performance {
  /** One per priority, low first. Always three, however empty the data is. */
  bars: PerformanceBar[];
  /**
   * The headline: the total time every finished task spent in progress, divided
   * by how many of them there were — across all priorities, because the split
   * is what the bars underneath are for. Null when there are none.
   */
  averageMs: number | null;
  onTime: number;
  late: number;
  /** Finished, but with no deadline to be measured against. */
  noDeadline: number;
}

/** The mean of a set of stretches. Null for an empty one — not zero. */
function average(of: { ms: number }[]): number | null {
  if (of.length === 0) return null;
  return Math.round(of.reduce((sum, entry) => sum + entry.ms, 0) / of.length);
}

/**
 * What the productivity card shows.
 *
 * Only tasks that were actually *worked on* count towards the times. The clock
 * starts when a task moves from "A fazer" to "Em andamento" and stops when it
 * reaches "Feita" (see timeTracking in the API's task routes), so a task dragged
 * straight from the first to the last has no measured stretch at all — a real
 * zero in the average would say it was finished instantly, which is the opposite
 * of what happened. Those tasks are left out of the averages; they still count
 * towards punctuality, which needs only a deadline and a completion.
 */
export function buildPerformance(
  tasks: TaskListItemDto[],
  period: PerformancePeriod,
  /** Injectable so a test can stand at a fixed instant. */
  now: number = Date.now(),
): Performance {
  const days = PERIOD_DAYS[period];
  const since = days === null ? null : now - days * DAY_MS;

  const finished = tasks.filter((task) => {
    if (task.completedAt === null) return false;
    if (since === null) return true;
    const at = new Date(task.completedAt).getTime();
    // A completion whose date will not parse is kept rather than dropped: it is
    // still a finished task, and the window is not a reason to lose it.
    return Number.isNaN(at) || at >= since;
  });

  /** The measured stretches, by priority — the only tasks an average is over. */
  const measured = finished
    .map((task) => ({
      priority: task.priority,
      // `elapsedMs` rather than `workedMs`, so the two never disagree about what
      // "how long did this take" means. A finished task has no stretch running,
      // so in practice the two are the same number here.
      ms: elapsedMs(task),
    }))
    .filter((entry) => entry.ms > 0);

  const bars = PRIORITY_ORDER.map((priority) => {
    const own = measured.filter((entry) => entry.priority === priority);
    return { priority, averageMs: average(own), count: own.length };
  });

  let onTime = 0;
  let late = 0;
  let noDeadline = 0;
  for (const task of finished) {
    const verdict = completionPunctuality(task.dueDate, task.completedAt);
    if (verdict === 'ON_TIME') onTime += 1;
    else if (verdict === 'LATE') late += 1;
    else noDeadline += 1;
  }

  return { bars, averageMs: average(measured), onTime, late, noDeadline };
}
