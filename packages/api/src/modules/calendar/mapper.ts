import {
  CalendarProvider,
  DEFAULT_LABEL_COLOR,
  isPaletteColor,
  type AgendaDto,
  type CalendarAccountDto,
  type CalendarEventDto,
  type EventRecurrence,
  type UserDto,
} from '@gloo/shared';

import { toUserDto } from '../../lib/userDto';

/** What every agenda query has to select for toAgendaDto to work. */
export const agendaSelect = {
  id: true,
  accountId: true,
  name: true,
  color: true,
  isHidden: true,
  isDefault: true,
  isReadOnly: true,
  isSharedInbox: true,
  sortOrder: true,
  googleCalendarId: true,
} as const;

type AgendaRow = {
  id: string;
  accountId: string;
  name: string;
  color: string;
  isHidden: boolean;
  isDefault: boolean;
  isReadOnly: boolean;
  isSharedInbox: boolean;
  sortOrder: number;
};

export function toAgendaDto(agenda: AgendaRow): AgendaDto {
  return {
    id: agenda.id,
    accountId: agenda.accountId,
    name: agenda.name,
    // Stored as a plain string, so an unknown key — a hand-edited row, or a
    // colour retired from the palette — falls back rather than reaching the UI
    // as an undefined class. Same reasoning as toLabelDto.
    color: isPaletteColor(agenda.color) ? agenda.color : DEFAULT_LABEL_COLOR,
    isHidden: agenda.isHidden,
    isDefault: agenda.isDefault,
    isReadOnly: agenda.isReadOnly,
    isShared: agenda.isSharedInbox,
    sortOrder: agenda.sortOrder,
  };
}

/**
 * How Google's own calendar list reads: by name, and with runs of digits
 * compared as numbers so "10." lands after "9." rather than after "1.".
 *
 * `sensitivity: 'base'` so case and accents don't split what a reader sees as
 * one alphabet — "Ágata" belongs with the As.
 */
const AGENDA_COLLATOR = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

export function toCalendarAccountDto(account: {
  id: string;
  provider: string;
  displayName: string;
  googleEmail: string | null;
  isCollapsed: boolean;
  needsReauth: boolean;
  agendas: AgendaRow[];
}): CalendarAccountDto {
  return {
    id: account.id,
    provider: account.provider as CalendarAccountDto['provider'],
    displayName: account.displayName,
    googleEmail: account.googleEmail,
    isCollapsed: account.isCollapsed,
    needsReauth: account.needsReauth,
    // A Google account's agendas come out in name order, the order Google
    // Calendar itself lists them in — not in the order the query returns them.
    //
    // Their `sortOrder` is the position they happened to occupy in the
    // calendarList response on the day they were first imported, which is
    // neither Google's display order nor stable across accounts, and it is never
    // rewritten by a later sync. Sorting here rather than in the query fixes the
    // agendas already in the table, and does it for every route that returns an
    // account rather than only the one the list is read from.
    //
    // The Gloo account keeps its own order: there, sortOrder is deliberate —
    // "Minha agenda" first, the shared inbox pinned last.
    agendas: (account.provider === CalendarProvider.GOOGLE
      ? account.agendas.toSorted((a, b) => AGENDA_COLLATOR.compare(a.name, b.name))
      : account.agendas
    ).map(toAgendaDto),
  };
}

/** What every event query has to include for toCalendarEventDto to work. */
export const eventInclude = {
  assignees: { include: { user: true } },
  agenda: { select: { isReadOnly: true, googleCalendarId: true } },
} as const;

interface EventRow {
  id: string;
  agendaId: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  isAllDay: boolean;
  timeZone: string;
  createdById: string;
  recurrence: string | null;
  recurrenceUntil: Date | null;
  byWeekdays: number[];
  recurringEventId: string | null;
  originalStart: Date | null;
  googleEventId: string | null;
  kind: string;
  isDone: boolean;
  color: string | null;
  googleEventLabelId: string | null;
  externalAttendees: unknown;
  assignees: { user: Parameters<typeof toUserDto>[0] }[];
  agenda: { isReadOnly: boolean; googleCalendarId: string | null };
}

/**
 * Attendee emails off the JSON column, defensively.
 *
 * The column is written by the Google importer, so a malformed value means a
 * shape changed upstream — worth ignoring rather than throwing, since the event
 * itself is still perfectly displayable without its external guests.
 */
function toExternalAttendees(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

/**
 * One stored row → the DTO.
 *
 * `overrides` is how an expanded occurrence borrows its master's row: the
 * generated instance carries its own start and end, but everything else — title,
 * assignees, agenda — comes from the master it was generated from.
 */
export function toCalendarEventDto(
  event: EventRow,
  overrides?: { startsAt: string; endsAt: string; originalStart: string; recurringEventId: string },
): CalendarEventDto {
  return {
    id: event.id,
    agendaId: event.agendaId,
    title: event.title,
    description: event.description,
    location: event.location,
    startsAt: overrides?.startsAt ?? event.startsAt.toISOString(),
    endsAt: overrides?.endsAt ?? event.endsAt.toISOString(),
    isAllDay: event.isAllDay,
    timeZone: event.timeZone,
    assignees: event.assignees.map((link) => toUserDto(link.user)) as UserDto[],
    externalAttendees: toExternalAttendees(event.externalAttendees),
    createdById: event.createdById,
    recurrence: (event.recurrence as EventRecurrence | null) ?? null,
    recurrenceUntil: event.recurrenceUntil?.toISOString() ?? null,
    byWeekdays: event.byWeekdays,
    recurringEventId: overrides?.recurringEventId ?? event.recurringEventId,
    originalStart: overrides?.originalStart ?? event.originalStart?.toISOString() ?? null,
    isReadOnly: event.agenda.isReadOnly,
    isFromGoogle: event.googleEventId !== null,
    kind: event.kind as CalendarEventDto['kind'],
    isDone: event.isDone,
    // Same guard the agenda's colour gets, and the same reason — except that
    // here "nothing valid" and "nothing at all" mean the same thing: the block
    // falls back to its agenda either way.
    color: isPaletteColor(event.color) ? event.color : null,
    // Whether, never which: the id is opaque and useless to anything that isn't
    // Google. All the client needs is that there is something here to lose.
    hasGoogleLabel: event.googleEventLabelId !== null,
  };
}
