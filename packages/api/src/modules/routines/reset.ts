import { isSameWeek } from 'date-fns';

import type { RoutineRecurrence } from '@gloo/shared';

/**
 * Weekly routines uncheck when the week flips, monthly ones when the month
 * flips. This is derived at read time rather than written by a scheduled job:
 * the stored `done`/`lastCompletedAt` stay a historical fact and the "is it
 * currently done?" answer is recomputed per request, so there is no cron to
 * run, nothing to backfill, and no race between concurrent readers.
 */
export function isCurrentlyDone(
  routine: { done: boolean; lastCompletedAt: Date | null; recurrence: RoutineRecurrence },
  now: Date = new Date(),
): boolean {
  if (!routine.done || !routine.lastCompletedAt) return false;

  if (routine.recurrence === 'WEEKLY') {
    // Compare by ISO week (Mon-start) rather than a day delta, so the flip
    // happens on the real week boundary whatever day it was completed.
    return isSameWeek(routine.lastCompletedAt, now, { weekStartsOn: 1 });
  }

  return (
    routine.lastCompletedAt.getFullYear() === now.getFullYear() &&
    routine.lastCompletedAt.getMonth() === now.getMonth()
  );
}
