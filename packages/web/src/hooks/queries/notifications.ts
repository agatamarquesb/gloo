import { useCallback, useMemo, useState } from 'react';

import type { RoutineDto } from '@gloo/shared';

import { nextOccurrence } from '@/components/dashboard/routineSchedule';
import { useMe } from '@/hooks/queries/auth';
import { useRoutines } from '@/hooks/queries/routines';
import { useTasks } from '@/hooks/queries/tasks';
import { strings } from '@/strings/pt-BR';

/**
 * Notifications are derived, not stored: there is no notifications table and no
 * read/unread state on the server. Two conditions raise one, both recomputed
 * from data the app already caches, so ticking off a routine or closing a task
 * clears its notification on the next refetch with nothing to reconcile.
 *
 *  - a task is overdue (past its due date and not DONE)
 *  - a routine falls due within the next two days
 *
 * Scoping follows what each surface already shows: overdue tasks are counted
 * across the whole company, exactly like the Dashboard's "Atrasadas" tile, while
 * routines are the signed-in user's own, like the Routines card.
 */
const ROUTINE_LEAD_DAYS = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DISMISSED_KEY = 'gloo-dismissed-notifications';

export type NotificationKind = 'TASK_OVERDUE' | 'ROUTINE_DUE_SOON';

/** What the notification's "view" action opens. Carries the entity, not a route. */
export type NotificationTarget =
  | { kind: 'TASK'; taskId: string }
  | { kind: 'ROUTINE'; routine: RoutineDto };

export interface AppNotification {
  /**
   * Identity includes the occurrence it refers to — a due date, or the date a
   * routine next falls on. That is what makes dismissal mean "this one", not
   * "this task forever": rescheduling a task, or a routine coming round again
   * next week, produces a new id and so a new notification.
   */
  id: string;
  kind: NotificationKind;
  title: string;
  /** Human-readable timing, e.g. "Vence amanhã". */
  detail: string;
  target: NotificationTarget;
  /** Days until due; negative once late. Drives ordering. */
  daysUntilDue: number;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Whole days between two instants, compared by calendar day rather than elapsed hours. */
function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

function readDismissed(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]');
    return Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : [];
  } catch {
    // Corrupt or unavailable storage must not take the header down with it.
    return [];
  }
}

export function useNotifications(): {
  notifications: AppNotification[];
  dismiss: (id: string) => void;
} {
  const { data: me } = useMe();
  const { data: overdueTasks = [] } = useTasks({ status: 'OVERDUE' });
  const { data: routines = [] } = useRoutines(me?.id);

  // Dismissal is client-side and persisted, since the server has no notion of a
  // notification to mark read.
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);

  const all = useMemo(() => {
    const now = new Date();

    const fromTasks: AppNotification[] = overdueTasks.map((task) => {
      const daysUntilDue = task.dueDate ? daysBetween(now, new Date(task.dueDate)) : 0;
      return {
        id: `task:${task.id}:${task.dueDate ?? 'none'}`,
        kind: 'TASK_OVERDUE',
        title: task.title,
        detail: strings.notifications.overdueByDays(-daysUntilDue),
        target: { kind: 'TASK', taskId: task.id },
        daysUntilDue,
      };
    });

    const fromRoutines: AppNotification[] = routines
      .filter((routine) => !routine.done)
      .map((routine) => ({ routine, date: nextOccurrence(routine, now) }))
      .map(({ routine, date }) => ({ routine, date, days: daysBetween(now, date) }))
      .filter(({ days }) => days <= ROUTINE_LEAD_DAYS)
      .map(({ routine, date, days }) => ({
        id: `routine:${routine.id}:${date.toISOString().slice(0, 10)}`,
        kind: 'ROUTINE_DUE_SOON' as const,
        title: routine.description,
        detail: strings.notifications.dueInDays(days),
        target: { kind: 'ROUTINE' as const, routine },
        daysUntilDue: days,
      }));

    // Most urgent first: the longest-overdue task leads, the furthest-out
    // routine trails.
    return [...fromTasks, ...fromRoutines].toSorted((a, b) => a.daysUntilDue - b.daysUntilDue);
  }, [overdueTasks, routines]);

  const dismiss = useCallback(
    (id: string) => {
      setDismissed((current) => {
        // Prune ids that no longer match anything live before adding the new
        // one, so the stored list can't grow without bound. Pruning against the
        // unfiltered list is deliberate: an already-dismissed notification is
        // still in there, and would otherwise resurrect itself on the next
        // dismissal.
        const live = new Set(all.map((notification) => notification.id));
        const next = [...current.filter((stored) => live.has(stored)), id];
        localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
        return next;
      });
    },
    [all],
  );

  const notifications = useMemo(
    () => all.filter((notification) => !dismissed.includes(notification.id)),
    [all, dismissed],
  );

  return { notifications, dismiss };
}
