import type {
  AttachmentKind,
  CalendarItemKind,
  CalendarProvider,
  EventRecurrence,
  LabelScope,
  PaletteColor,
  Role,
  RoutineRecurrence,
  TaskPriority,
  TaskSortBy,
  TaskStatus,
  TaskStatusFilter,
} from './enums';

export interface UserDto {
  id: string;
  email: string;
  name: string;
  /** Permission level (ADMIN/EMPLOYEE). Never user-editable. */
  role: Role;
  /** Free-text job title shown under the name. Cosmetic only. */
  jobTitle: string | null;
  avatarUrl: string | null;
}

export interface SectorDto {
  id: string;
  name: string;
}

export interface SubtaskDto {
  id: string;
  text: string;
  done: boolean;
  order: number;
}

export interface TaskListItemDto {
  id: string;
  title: string;
  /**
   * The task's notes, as markup — on the list DTO rather than only the detail
   * one because the Dashboard's day summary reads a whole day of tasks at once
   * and shows each one's note under it. Fetching a detail per row to reach a
   * single text column would be a request each for something already loaded.
   */
  description: string | null;
  dueDate: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  isOverdue: boolean;
  progress: number;
  sector: SectorDto;
  assignees: UserDto[];
  createdById: string;
  /**
   * How many subtasks the task has. A count rather than the rows themselves so
   * list responses stay small — the subtasks come with the detail DTO. The task
   * row marks the ones that have any.
   */
  subtaskCount: number;
  /**
   * How many links and files are attached. A count for the same reason
   * `subtaskCount` is: the row shows the number, and the attachments themselves
   * only come with the detail DTO.
   */
  attachmentCount: number;
  /**
   * How long the task has spent in "Em andamento", in milliseconds, counting
   * only the stretches that have ended. Never shown anywhere — it is collected
   * for the productivity chart on the Tasks page.
   */
  workedMs: number;
  /**
   * When the stretch currently running began, or null when the task is not in
   * progress. The live total is `workedMs` plus the time since this — see
   * elapsedMs below, which is the one place that sum is written down.
   */
  startedAt: string | null;
  /** When the task last reached "Feita"; null once it is reopened. */
  completedAt: string | null;
}

/**
 * The task's total time in progress right now: the stretches that have finished,
 * plus the one still running if there is one.
 *
 * Here rather than in the chart, so the API's accounting and anything that reads
 * it agree on what "how long did this take" means.
 */
export function elapsedMs(
  task: Pick<TaskListItemDto, 'workedMs' | 'startedAt'>,
  now: number = Date.now(),
): number {
  const running = task.startedAt ? now - new Date(task.startedAt).getTime() : 0;
  return task.workedMs + Math.max(0, running);
}

export interface TaskDetailDto extends TaskListItemDto {
  /**
   * The task's tags, from the same shared pool a routine's come from — only on
   * the detail DTO, since only the modal shows them.
   */
  labels: LabelDto[];
  /** Null when the task has no attachments block; `[]` when it has an empty one. */
  attachments: AttachmentDto[] | null;
  subtasks: SubtaskDto[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskFilters {
  search?: string;
  status?: TaskStatusFilter | 'ALL';
  sectorId?: string;
  assigneeId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  sortBy?: TaskSortBy;
  sortDir?: 'ASC' | 'DESC';
}

export interface CreateTaskInput {
  title: string;
  /** The task's notes. Carries the same formatting markup a routine's does. */
  description?: string | null;
  priority: TaskPriority;
  dueDate?: string | null;
  sectorId: string;
  assigneeIds: string[];
  /** Null for no attachments block; `[]` for an empty one — as with routines. */
  attachments?: AttachmentDto[] | null;
  /** The tags to carry, as ids into the shared label pool. */
  labelIds?: string[];
  /**
   * Subtasks written on the create dialog, before the task existed to hang them
   * off — see the draft list in TaskSubtasks.
   *
   * Their text and nothing else: a subtask typed into a task that has not been
   * saved cannot already be ticked, and its order is the order they were typed
   * in. Create only, which is why `UpdateTaskInput` drops it below: an existing
   * task's subtasks are rows with their own endpoints, and a PATCH carrying a
   * list of strings would have no way to say which of them are the ones already
   * there.
   */
  subtasks?: string[];
}

export type UpdateTaskInput = Partial<Omit<CreateTaskInput, 'subtasks'>>;

export interface TaskSummaryDto {
  upcoming: number;
  inProgress: number;
  completed: number;
  overdue: number;
  /**
   * Every task, whatever state it is in — what the "Todas" filter would return.
   *
   * Counted rather than added up from the four above: a task that is late is
   * also to do or in progress, so `overdue` overlaps them and the sum would be
   * larger than the list it claims to describe.
   */
  total: number;
}

export interface TaskBySectorDto {
  sector: SectorDto;
  /**
   * Every task the sector has, whatever state it is in — to do, in progress,
   * done, late. It used to be the open ones only, which made the donut a chart
   * of what is left rather than of where the work is; a sector that finished
   * everything then read as a sector with nothing in it.
   */
  totalCount: number;
}

export interface TaskCalendarEntryDto {
  date: string;
  sectorIds: string[];
}

/** One line of a routine's checklist. */
export interface ChecklistItemDto {
  text: string;
  done: boolean;
}

/** One of a routine's checklist blocks: a title plus its lines. */
export interface RoutineChecklistDto {
  title: string;
  items: ChecklistItemDto[];
}

/** A routine may carry at most this many checklists. */
export const MAX_ROUTINE_CHECKLISTS = 5;

export interface AttachmentDto {
  /** Client-generated, so a row stays addressable for edit/delete before saving. */
  id: string;
  kind: AttachmentKind;
  /** An external href for LINK, an `/uploads/...` path for FILE. */
  url: string;
  /** What the user sees, so a long URL doesn't become the label. */
  title: string;
}

export interface LabelDto {
  id: string;
  name: string;
  /** One of the ten palette keys, or a hex the user mixed — see PaletteColor. */
  color: PaletteColor;
}

export interface LabelInput {
  name: string;
  color: PaletteColor;
  /** Which pool it is created in. Never changes afterwards. */
  scope: LabelScope;
}

export interface RoutineDto {
  id: string;
  /** Shown as "Título" in the UI. */
  description: string;
  recurrence: RoutineRecurrence;
  /**
   * The weekday a weekly routine falls on, 0=Sunday … 6=Saturday — and the
   * earliest of them when it falls on several, so this is never null for a
   * weekly routine whatever the user chose. See `weekdays`.
   */
  weekday: number | null;
  /**
   * Every weekday it repeats on, when the user picked more than one. Empty for
   * the ordinary case of a single day, which `weekday` already describes — so
   * "is this a custom schedule?" is `weekdays.length > 1`.
   */
  weekdays: number[];
  dayOfMonth: number | null;
  done: boolean;
  /** Free-text annotation. */
  notes: string | null;
  /** Empty when the routine has no checklist blocks. */
  checklists: RoutineChecklistDto[];
  /** Null when the routine has no attachments block; `[]` when it has an empty one. */
  attachments: AttachmentDto[] | null;
  labels: LabelDto[];
  assignees: UserDto[];
  createdById: string;
  /** ISO timestamp of the last write, shown at the foot of the routine modal. */
  updatedAt: string;
  /**
   * When the routine was moved to the trash, or null while it is live. Takes the
   * place of `updatedAt` at the foot of the modal for a trashed routine: what
   * matters about one is when it went, not when it last changed.
   */
  deletedAt: string | null;
}

export interface CreateRoutineInput {
  description: string;
  recurrence: RoutineRecurrence;
  weekday?: number | null;
  /**
   * The full set for a custom weekly schedule. Sent whole or not at all — the
   * API derives `weekday` from it, so the two can never disagree.
   */
  weekdays?: number[];
  dayOfMonth?: number | null;
  notes?: string | null;
  checklists?: RoutineChecklistDto[];
  attachments?: AttachmentDto[] | null;
  labelIds?: string[];
  assigneeIds: string[];
}

/** What `POST /uploads` returns for an attached file. */
export interface UploadedFileDto {
  url: string;
  filename: string;
}

export type UpdateRoutineInput = Partial<CreateRoutineInput>;

export interface LoginInput {
  email: string;
  password: string;
}

/* ------------------------------------------------------------------ *
 * Calendar
 * ------------------------------------------------------------------ */

/**
 * A source of agendas: the built-in Gloo one, or a linked Google account.
 *
 * Accounts belong to a single user — the Google tokens behind one are personal,
 * and the Gloo account is where that user's own agendas live. Nothing about an
 * account is shared, which is why the Agendas card groups by it.
 */
export interface CalendarAccountDto {
  id: string;
  provider: CalendarProvider;
  /** What the group is called in the Agendas card. Renameable. */
  displayName: string;
  /** The account's own address, shown under the name. Null for the Gloo one. */
  googleEmail: string | null;
  /** Whether the group is folded shut. Persisted so it survives a reload. */
  isCollapsed: boolean;
  /**
   * True once Google has stopped accepting our refresh token — revoked access,
   * a changed password, or the 7-day expiry that applies while the OAuth
   * consent screen is unverified. The card offers "Reconectar" instead of
   * pretending the agendas below it are still live.
   */
  needsReauth: boolean;
  agendas: AgendaDto[];
}

export interface AgendaDto {
  id: string;
  accountId: string;
  name: string;
  /** A key into the `--label-*` palette, or a hex — as with a Label. */
  color: PaletteColor;
  /** Hidden by the eye icon: the agenda stays in the list, its events leave the grid. */
  isHidden: boolean;
  /** Where a new event lands when the user doesn't pick an agenda. Exactly one per user. */
  isDefault: boolean;
  /**
   * True for a Google calendar we may read but not write — a subscribed holiday
   * calendar, or one shared with the user at reader access. Its events render
   * but cannot be dragged, resized or edited.
   */
  isReadOnly: boolean;
  /**
   * True for the pseudo-agenda holding events somebody else assigned to this
   * user. It is not a row in anyone's account: it collects events across
   * agendas the user cannot see, so it can be hidden and recoloured like a real
   * agenda but never renamed, deleted or made default.
   */
  isShared: boolean;
  sortOrder: number;
}

/**
 * One occurrence on the grid.
 *
 * What `GET /calendar/events` returns is always *instances*, never masters: a
 * weekly event that runs for a year arrives as the handful of instances inside
 * the requested window, each carrying the id of the row it came from. The
 * distinction matters on write — see RecurrenceScope.
 */
export interface CalendarEventDto {
  /**
   * The row this instance came from: the master for a generated occurrence, or
   * the exception's own id where one exists. Editing with scope THIS on a
   * generated occurrence creates that exception.
   */
  id: string;
  agendaId: string;
  title: string;
  /** Rich text, carrying the same markup a task's notes do. */
  description: string | null;
  /** A free-text place or, more usually here, a meeting link. */
  location: string | null;
  /** ISO timestamps. Always absolute — `timeZone` says how to label them. */
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  /** IANA zone the event was created in, so a trip doesn't move everyone's meetings. */
  timeZone: string;
  assignees: UserDto[];
  /**
   * Attendees on the Google side with no Gloo user to match — external guests.
   * Shown after the assignee avatars as plain initials.
   */
  externalAttendees: string[];
  createdById: string;
  /** The repeat rule, present on every instance of a recurring event. */
  recurrence: EventRecurrence | null;
  /**
   * ISO date the repeat stops on, inclusive. Null both when the event doesn't
   * repeat and when it repeats forever — `recurrence` is what tells them apart.
   */
  recurrenceUntil: string | null;
  /** Weekdays a weekly series lands on, 0=Sunday … 6=Saturday. */
  byWeekdays: number[];
  /**
   * Set when this instance was generated from a master rather than stored in
   * its own right — the master's id. Null for a one-off event and for an
   * exception, both of which are rows of their own.
   */
  recurringEventId: string | null;
  /**
   * Which slot of the series this instance fills, as an ISO timestamp. It is
   * what identifies an instance to Google, and what an exception row is keyed
   * on, so it survives the instance being dragged to another day.
   */
  originalStart: string | null;
  /**
   * The card's own colour, when it has been given one — Google calls this the
   * event colour, as against the calendar's.
   *
   * Null is the ordinary case and means "whatever the agenda is", which is what
   * every event wore before this existed. Set, the block is drawn in this colour
   * with a stripe of the agenda's down its left edge, so an event that has been
   * singled out still says which calendar it belongs to. Same as Google Calendar
   * draws it, and imported from there: see GOOGLE_EVENT_COLORS.
   */
  color: PaletteColor | null;
  /**
   * True when Google is holding an *event label* on this event.
   *
   * Labels are the other way a card takes a colour in Google Calendar, and they
   * cannot be mirrored: the API hands back an opaque id with no colour, resolves
   * it nowhere, and ignores the field on write. Worse, writing the one colour
   * field it does accept clears the label as a side effect, permanently.
   *
   * So this is a warning flag and nothing else — the dialog asks before letting
   * a colour destroy one. Which label it is never reaches the client, because
   * nothing here could do anything with it.
   */
  hasGoogleLabel: boolean;
  /** True when the event lives on a read-only agenda. Convenience for the grid. */
  isReadOnly: boolean;
  /** True when the event mirrors a Google one, so the UI can mark its origin. */
  isFromGoogle: boolean;
  /** What this row is — see CalendarItemKind. */
  kind: CalendarItemKind;
  /**
   * Whether a task has been ticked off. Always false on the other two kinds: an
   * event is not a thing you complete.
   */
  isDone: boolean;
}

/**
 * How many people an event would actually email, ignoring its own organiser.
 *
 * Google never invites you to your own meeting, so an event whose only assignee
 * is its creator has nobody to notify — and offering "avisar participantes?"
 * there would be a question with no consequence either way.
 *
 * Here rather than on either side alone because both need the same answer for
 * different reasons: the client decides whether to ask, and the API decides
 * whether to pass `sendUpdates=all` to Google. Two definitions of "somebody
 * else is on this event" would eventually disagree, and the visible symptom
 * would be a dialog promising an email that never arrives.
 */
export function countOtherAttendees(event: {
  createdById: string;
  assigneeIds: string[];
  externalAttendees: string[];
}): number {
  return (
    event.assigneeIds.filter((id) => id !== event.createdById).length +
    event.externalAttendees.length
  );
}

export interface CreateEventInput {
  agendaId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt: string;
  isAllDay?: boolean;
  timeZone: string;
  assigneeIds: string[];
  recurrence?: EventRecurrence | null;
  /** Omitted or null for a series with no end date. */
  recurrenceUntil?: string | null;
  byWeekdays?: number[];
  /** The card's own colour. Null clears it, back to the agenda's. */
  color?: PaletteColor | null;
}

export type UpdateEventInput = Partial<CreateEventInput>;

export interface CreateAgendaInput {
  /** Which account it belongs to. A Google one creates a real calendar there. */
  accountId: string;
  name: string;
  /**
   * Optional: left out, the API assigns the first palette colour the user isn't
   * already using. A better default than making someone choose a colour before
   * they have seen the agenda exist.
   */
  color?: PaletteColor;
}

export interface UpdateAgendaInput {
  name?: string;
  color?: PaletteColor;
  isHidden?: boolean;
  isDefault?: boolean;
}

/** What a sync run did, so the UI can say more than "done". */
export interface CalendarSyncResultDto {
  agendasImported: number;
  eventsImported: number;
  eventsRemoved: number;
  /** Accounts that need the user to reconnect before they can sync again. */
  accountsNeedingReauth: string[];
}
