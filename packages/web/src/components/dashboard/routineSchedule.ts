import type { RoutineDto } from '@gloo/shared';

/**
 * Routines store a cadence (a weekday, or a day of the month), not a date.
 * The card needs real dates to sort "closest first" and to group by month,
 * so we project each routine onto its next occurrence from today.
 */
export function nextOccurrence(routine: RoutineDto, from: Date = new Date()): Date {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  if (routine.recurrence === 'WEEKLY') {
    const target = routine.weekday ?? 0;
    const delta = (target - start.getDay() + 7) % 7;
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() + delta);
  }

  const target = routine.dayOfMonth ?? 1;
  const thisMonth = new Date(start.getFullYear(), start.getMonth(), target);
  if (thisMonth >= start) return thisMonth;
  // Day 0 of the following month clamps e.g. the 31st in a 30-day month.
  const next = new Date(start.getFullYear(), start.getMonth() + 1, target);
  const lastOfNext = new Date(start.getFullYear(), start.getMonth() + 2, 0).getDate();
  return target > lastOfNext
    ? new Date(start.getFullYear(), start.getMonth() + 2, 0)
    : next;
}

export interface RoutineMonthGroup {
  key: string;
  label: string;
  routines: { routine: RoutineDto; date: Date }[];
}

const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const dayFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });

export const formatRoutineDay = (date: Date) => dayFormatter.format(date);

/** Soonest first, grouped into the month each occurrence falls in. */
export function groupRoutinesByMonth(routines: RoutineDto[], from: Date = new Date()): RoutineMonthGroup[] {
  const dated = routines
    .map((routine) => ({ routine, date: nextOccurrence(routine, from) }))
    .toSorted((a, b) => a.date.getTime() - b.date.getTime());

  const groups = new Map<string, RoutineMonthGroup>();
  for (const entry of dated) {
    const key = `${entry.date.getFullYear()}-${entry.date.getMonth()}`;
    if (!groups.has(key)) {
      groups.set(key, { key, label: monthFormatter.format(entry.date), routines: [] });
    }
    groups.get(key)!.routines.push(entry);
  }
  return [...groups.values()];
}
