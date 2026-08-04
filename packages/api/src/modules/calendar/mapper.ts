import {
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
    agendas: account.agendas.map(toAgendaDto),
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
  };
}
