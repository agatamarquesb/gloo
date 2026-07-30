/**
 * "1 de agosto" — pt-BR writes the day and month as a phrase, not a list.
 *
 * Read in UTC, because the dates this formats are *days* rather than instants: a
 * due date is stored as midnight UTC on the day chosen, and formatting that in a
 * timezone behind UTC lands on the evening before — which showed a task due on
 * the 30th as due on the 29th everywhere in Brazil.
 */
const dayAndMonth = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

/**
 * "30 de julho, 2026" — how every date the app shows is written: on a task row,
 * and as the deadline in the task modal. The year is set off by a comma rather
 * than a second "de".
 */
export function formatLongDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${dayAndMonth.format(date)}, ${date.getUTCFullYear()}`;
}

/** The same, for a bare calendar day ("2026-07-30") rather than an instant. */
export function formatDay(day: string | null | undefined): string | null {
  return day ? formatLongDate(`${day}T00:00:00Z`) : null;
}

/**
 * "31 de jul. 2026" — the abbreviated form, for rows that have to share their
 * line with a sector, a progress bar and a status. Same UTC reading as the long
 * one, and for the same reason.
 */
const shortDayAndMonth = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

export function formatShortDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // No comma before the year here: the abbreviated month already ends in a
  // full stop, and two marks of punctuation in five words is one too many.
  return `${shortDayAndMonth.format(date)} ${date.getUTCFullYear()}`;
}

/** "28/07/2026, 14:32" — the timestamp a modal reports at its foot. */
const timestamp = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatTimestamp(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : timestamp.format(date);
}
