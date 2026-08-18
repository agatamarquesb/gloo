import {
  CalendarItemKind,
  type AgendaDto,
  type CalendarEventDto,
  type TaskListItemDto,
  type UserDto,
} from '@gloo/shared';

import { CALENDAR_LOCALE } from '@/lib/weekStart';

/**
 * What a line of the day summary can be.
 *
 * Four kinds rather than the two the app can currently produce: a meeting is an
 * event with somebody else on it, which is the distinction a reader actually
 * makes when scanning a day, and a project is here because the task modal
 * already has a Projeto row waiting for the feature — see SAMPLE_PROJECTS in
 * TaskModal. Nothing produces PROJECT yet; the moment something does, the
 * summary reads it without being touched.
 */
export const DayItemKind = {
  TASK: 'TASK',
  EVENT: 'EVENT',
  MEETING: 'MEETING',
  PROJECT: 'PROJECT',
} as const;
export type DayItemKind = (typeof DayItemKind)[keyof typeof DayItemKind];

/**
 * Where an item takes its colour from: the agenda an event is in, or the sector
 * a task belongs to.
 *
 * The id and not the colour, because neither is a colour until somebody resolves
 * it — an agenda's is a palette key or a hex the user mixed, a sector's is a
 * slot in the tile palette that only the Dashboard knows how to number. So this
 * says which thing to ask about and the card answers it (see paintAccent in
 * CalendarCard), which is also what makes the bar down an item's left edge and
 * the dot on its day in the month the same colour by construction.
 */
export interface DayItemAccent {
  kind: 'AGENDA' | 'SECTOR';
  id: string;
}

/**
 * One thing on a day, whatever it started life as.
 *
 * The panel reads only this: tasks and calendar events arrive as different
 * shapes from different endpoints, and flattening them here is what lets the
 * summary be a single list rather than two lists that happen to be stacked.
 */
export interface DayItem {
  id: string;
  kind: DayItemKind;
  title: string;
  /** The day it falls on, `YYYY-MM-DD` — what the summary's Data row reports. */
  day: string;
  /**
   * ISO instants, or null for something that has no clock time of its own — a
   * task is due on a *day*, not at an hour.
   */
  startsAt: string | null;
  endsAt: string | null;
  isAllDay: boolean;
  assignees: UserDto[];
  /** Rich text, as the note editors write it. Empty markup counts as none. */
  description: string | null;
  /** What colours it — see DayItemAccent. */
  accent: DayItemAccent;
  /** Sorts the day: timed things in clock order, dateless ones after them. */
  sortKey: number;
}

/** A calendar day as `YYYY-MM-DD`, read in the viewer's own zone. */
export function localDayKey(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * The day a due date names.
 *
 * Read in UTC, because a due date is stored as midnight UTC on the day chosen —
 * reading it locally lands on the evening before everywhere west of Greenwich,
 * which is the same trap formatDate.ts documents.
 */
export function dueDayKey(dueDate: string): string {
  return dueDate.slice(0, 10);
}

/**
 * Whether a person is on something.
 *
 * The creator counts as well as the assignees: an event you made and put nobody
 * else on is still yours, and it would otherwise vanish from your own summary.
 */
function includesUser(
  subject: { assignees: UserDto[]; createdById: string },
  userId: string | undefined,
): boolean {
  if (!userId) return false;
  return subject.createdById === userId || subject.assignees.some(({ id }) => id === userId);
}

export function taskToDayItem(task: TaskListItemDto): DayItem {
  return {
    id: `task-${task.id}`,
    kind: DayItemKind.TASK,
    title: task.title,
    day: dueDayKey(task.dueDate ?? ''),
    startsAt: null,
    endsAt: null,
    isAllDay: false,
    assignees: task.assignees,
    description: task.description,
    accent: { kind: 'SECTOR', id: task.sector.id },
    // After everything with a clock time: a task is due some time that day, and
    // putting it at 00:00 would file it before the 08:00 stand-up.
    sortKey: Number.MAX_SAFE_INTEGER,
  };
}

export function eventToDayItem(event: CalendarEventDto): DayItem {
  const others = event.assignees.filter(({ id }) => id !== event.createdById).length;
  return {
    id: `event-${event.id}-${event.startsAt}`,
    // A Google task stays a task whoever is on it. Otherwise: somebody else on
    // it makes it a meeting, on your own it is an event — and the external
    // guests count too, since a call with a client is a meeting whether or not
    // the client has a Gloo login.
    kind:
      event.kind === CalendarItemKind.TASK
        ? DayItemKind.TASK
        : others + event.externalAttendees.length > 0
          ? DayItemKind.MEETING
          : DayItemKind.EVENT,
    title: event.title,
    day: localDayKey(new Date(event.startsAt)),
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    isAllDay: event.isAllDay,
    assignees: event.assignees,
    description: event.description,
    accent: { kind: 'AGENDA', id: event.agendaId },
    // All-day first, then the timed ones in clock order.
    sortKey: event.isAllDay ? -1 : new Date(event.startsAt).getTime(),
  };
}

/**
 * Everything on one day that the reader is actually part of, in reading order.
 *
 * Filtered to them rather than to the company: the card is their day, and a
 * summary listing every task in the business would be a different feature.
 */
export function buildDayAgenda({
  day,
  tasks,
  events,
  agendasById,
  userId,
}: {
  /** `YYYY-MM-DD`, the day being summarised. */
  day: string;
  tasks: TaskListItemDto[];
  events: CalendarEventDto[];
  /** Used only to skip agendas the user has hidden, as the calendar page does. */
  agendasById: Map<string, AgendaDto>;
  userId: string | undefined;
}): DayItem[] {
  const fromTasks = tasks
    .filter((task) => task.dueDate && dueDayKey(task.dueDate) === day)
    .filter((task) => includesUser(task, userId))
    .map(taskToDayItem);

  const fromEvents = events
    .filter((event) => !agendasById.get(event.agendaId)?.isHidden)
    .filter((event) => localDayKey(new Date(event.startsAt)) === day)
    .filter((event) => includesUser(event, userId))
    .map(eventToDayItem);

  return [...fromEvents, ...fromTasks].toSorted((a, b) => a.sortKey - b.sortKey);
}

/**
 * "05 de ago. 2026" — the day written out, with the leading zero kept.
 *
 * Assembled from parts rather than taken straight from Intl: pt-BR's own
 * `{ day, month: 'short', year }` reads "05 de ago. de 2026", and the second
 * "de" is one joining word too many on a line this short.
 */
const dayAndMonth = new Intl.DateTimeFormat(CALENDAR_LOCALE, {
  day: '2-digit',
  month: 'short',
  timeZone: 'UTC',
});

export function formatSummaryDate(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return `${dayAndMonth.format(date)} ${date.getUTCFullYear()}`;
}

/** "13:00", in the viewer's zone — the same reading the grid's blocks take. */
const clock = new Intl.DateTimeFormat(CALENDAR_LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * "13:00 - 15:00", or null for something with no clock time at all.
 *
 * Null rather than a dash, so the caller can decide: a task is due on a day and
 * has no hour to report, and a row reading "Hora —" says less than no row.
 */
export function formatSummaryTime(item: DayItem): string | null {
  if (item.isAllDay || !item.startsAt || !item.endsAt) return null;
  return `${clock.format(new Date(item.startsAt))} - ${clock.format(new Date(item.endsAt))}`;
}
