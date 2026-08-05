import type { RoutineDto } from '@gloo/shared';

import { weeklyDays } from './routineWeekdays';

/**
 * Routines store a cadence (a weekday, or a day of the month), not a date.
 * The card needs real dates to sort "closest first" and to group by month,
 * so we project each routine onto its next occurrence from today.
 */
export function nextOccurrence(routine: RoutineDto, from: Date = new Date()): Date {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  if (routine.recurrence === 'WEEKLY') {
    // The soonest of however many days it runs on. A routine set to Monday and
    // Thursday is due on Monday when read on Sunday and on Thursday when read on
    // Tuesday — one cadence, two answers, depending on when you ask. An ordinary
    // routine has one day and this is the same arithmetic it always did.
    const targets = weeklyDays(routine);
    const delta = Math.min(...targets.map((target) => (target - start.getDay() + 7) % 7));
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

/**
 * How far ahead the Routines card looks.
 *
 * The card is what you have to do *soon*, not a register of every routine that
 * exists — with a dozen of them the list became a scrolling index of the whole
 * schedule, and the two or three that actually mattered this week were somewhere
 * in the middle of it. Four days is the window: a routine appears on its own day
 * and on the four before it, and the moment its day has passed it drops out
 * until it comes round again.
 *
 * That last part is free, and worth saying out loud: `nextOccurrence` never
 * looks backwards, so a Wednesday routine read on Thursday is already six days
 * out and simply fails this test — it comes back on Saturday. Everything that
 * exists, whenever it falls, is in "Todas as rotinas".
 */
export const ROUTINE_LOOKAHEAD_DAYS = 4;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Whole days from one midnight to another. Both arguments are already floored
 * to midnight by the callers, so this is exact rather than approximate — no
 * daylight-saving rounding to worry about at these distances.
 */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/** Whether a routine's next turn is close enough for the card to show it. */
export function isDueSoon(routine: RoutineDto, from: Date = new Date()): boolean {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return daysBetween(start, nextOccurrence(routine, from)) <= ROUTINE_LOOKAHEAD_DAYS;
}

/**
 * Where a routine sits in its own cadence, as a number that sorts.
 *
 * A monthly one is simply its day. A weekly one is its weekday counted from
 * Monday rather than from Sunday — the stored value is 0=Sunday, which is right
 * for the calendar grid and wrong for a list somebody reads as "the week": a
 * Sunday routine belongs at the end of it, not before Monday.
 *
 * Only meaningful within one cadence, which is all "Todas as rotinas" ever asks:
 * it shows the weekly ones or the monthly ones, never both at once.
 */
export function cadencePosition(routine: RoutineDto): number {
  return routine.recurrence === 'WEEKLY' ? ((routine.weekday ?? 0) + 6) % 7 : (routine.dayOfMonth ?? 0);
}

export interface RoutineMonthGroup {
  key: string;
  label: string;
  routines: { routine: RoutineDto; date: Date }[];
}

const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const dayFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });

export const formatRoutineDay = (date: Date) => dayFormatter.format(date);

/**
 * Soonest first, grouped into the month each occurrence falls in — and only the
 * ones close enough to be worth showing. See ROUTINE_LOOKAHEAD_DAYS.
 */
export function groupRoutinesByMonth(routines: RoutineDto[], from: Date = new Date()): RoutineMonthGroup[] {
  const dated = routines
    .filter((routine) => isDueSoon(routine, from))
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
