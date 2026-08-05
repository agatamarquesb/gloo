import type { RoutineDto } from '@gloo/shared';

import { strings } from '@/strings/pt-BR';

/**
 * The week, indexed the way everything else in the app indexes it: 0=Sunday …
 * 6=Saturday, which is what `Date.getDay()` returns and what the column stores.
 */
export const WEEKDAY_NAMES = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const;

/**
 * The same seven as single letters, for the row of circles in the picker.
 *
 * Read left to right from Monday, because that is how a week of *work* is read —
 * the picker is about which days a routine runs, not about where a date sits in
 * a calendar grid. See WEEK_ORDER, which is the order; these are only the caps.
 */
export const WEEKDAY_INITIALS: Record<number, string> = {
  0: 'D',
  1: 'S',
  2: 'T',
  3: 'Q',
  4: 'Q',
  5: 'S',
  6: 'S',
};

/** Monday first, Sunday last — the order the picker and the summary both use. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** Monday to Friday, for the "Dias úteis" shortcut. */
export const WEEKDAYS_BUSINESS = [1, 2, 3, 4, 5];

/**
 * Which days a weekly routine actually runs on.
 *
 * One place to ask, because `weekdays` is empty for the ordinary single-day case
 * and every reader would otherwise have to remember to fall back — see the
 * RoutineDto fields, where the two are documented together.
 */
export function weeklyDays(routine: Pick<RoutineDto, 'weekday' | 'weekdays'>): number[] {
  if (routine.weekdays.length > 0) return routine.weekdays;
  return [routine.weekday ?? 0];
}

/** Whether the routine is on a schedule the plain weekday list cannot express. */
export function isCustomWeekly(routine: Pick<RoutineDto, 'weekday' | 'weekdays'>): boolean {
  return routine.weekdays.length > 1;
}

/**
 * A set of weekdays in the order a person reads a week: Monday first.
 *
 * The stored set is sorted 0–6, which puts Sunday at the head — so a routine on
 * Sunday and Monday would summarise as "domingo, segunda" and, worse, would look
 * to the run-detection below like two days that are nowhere near each other.
 */
function inWeekOrder(days: number[]): number[] {
  const set = new Set(days);
  return WEEK_ORDER.filter((day) => set.has(day));
}

/**
 * What a custom schedule is called: "Todos os dias", "Segunda - sexta",
 * "Segunda - quarta", or "Segunda, quarta e sexta".
 *
 * The hyphen form is only used for an unbroken run, because that is the only
 * case where it is *true* — "segunda - sexta" for Monday, Wednesday and Friday
 * would name two days the routine does not run on. Anything else is listed in
 * full, with "e" before the last one, the way the language joins a list.
 */
export function formatWeekdays(days: number[]): string {
  const ordered = inWeekOrder(days);
  if (ordered.length === 0) return '';
  if (ordered.length === 1) return WEEKDAY_NAMES[ordered[0]];
  if (ordered.length === 7) return strings.routine.weekdayPicker.everyDay;

  // A run, in reading order — consecutive positions in WEEK_ORDER rather than
  // consecutive day numbers, so Friday→Saturday→Sunday counts and Sunday→Monday
  // does not.
  const positions = ordered.map((day) => WEEK_ORDER.indexOf(day as (typeof WEEK_ORDER)[number]));
  const isRun = positions.every((position, index) => index === 0 || position === positions[index - 1] + 1);

  if (isRun) {
    return `${WEEKDAY_NAMES[ordered[0]]} - ${WEEKDAY_NAMES[ordered.at(-1)!]}`;
  }

  const names = ordered.map((day) => WEEKDAY_NAMES[day]);
  return `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`;
}
