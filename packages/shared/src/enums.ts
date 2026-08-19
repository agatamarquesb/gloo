export const Role = {
  ADMIN: 'ADMIN',
  EMPLOYEE: 'EMPLOYEE',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const TaskPriority = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;
export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

export const TaskStatus = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
  /**
   * Late — set by hand, unlike the lateness the due date implies on its own.
   *
   * Both exist and they mean the same thing to the reader: `isOverdue` on a DTO
   * is true for either, so a row shows the same "atrasada" chip whether the date
   * ran out or somebody said so. What the stored one adds is a way to call a
   * task late when its deadline can't say that for you — no due date at all, or
   * one that hasn't passed yet.
   */
  OVERDUE: 'OVERDUE',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && Object.hasOwn(TaskStatus, value);
}

/**
 * The "Atrasada" filter pill. Deliberately the same string as the status above:
 * a task is late either because it was marked so or because its due date passed,
 * and the pill asks for both — see buildWhere in the tasks routes.
 */
export const TASK_FILTER_OVERDUE = 'OVERDUE' as const;

export type TaskStatusFilter = TaskStatus | typeof TASK_FILTER_OVERDUE;

export const TaskSortBy = {
  DUE_DATE: 'DUE_DATE',
  PRIORITY: 'PRIORITY',
  PROGRESS: 'PROGRESS',
} as const;
export type TaskSortBy = (typeof TaskSortBy)[keyof typeof TaskSortBy];

export const RoutineRecurrence = {
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
} as const;
export type RoutineRecurrence = (typeof RoutineRecurrence)[keyof typeof RoutineRecurrence];

/**
 * The colors a label can take. Keys, never hex — each one maps to a
 * `--label-<key>` custom property defined in the web package's globals.css,
 * which stays the only place a color value is written down.
 */
export const LABEL_COLORS = [
  'green',
  'lime',
  'yellow',
  'orange',
  'red',
  'pink',
  'purple',
  'blue',
  'teal',
  'gray',
] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];

/**
 * A colour a user mixed themselves, as `#rrggbb`.
 *
 * The ten above are the palette; this is the escape from it. Stored in the same
 * column and read by the same code — anything that paints a label or an agenda
 * takes either, and the web package decides between a class and an inline value.
 */
export type HexColor = `#${string}`;

/** Either kind: one of the ten keys, or a hex a user chose. */
export type PaletteColor = LabelColor | HexColor;

export const DEFAULT_LABEL_COLOR: LabelColor = 'green';

export function isLabelColor(value: unknown): value is LabelColor {
  return typeof value === 'string' && (LABEL_COLORS as readonly string[]).includes(value);
}

/** Six digits and a hash, lower or upper case. Three-digit shorthand is not stored. */
export function isHexColor(value: unknown): value is HexColor {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

/**
 * What may be written to a colour column. Validated on the way in and again on
 * the way out, so a hand-edited row can never reach the UI as a colour nobody
 * can paint.
 */
export function isPaletteColor(value: unknown): value is PaletteColor {
  return isLabelColor(value) || isHexColor(value);
}

/**
 * What each palette key actually is, as a hex.
 *
 * The values themselves still live in globals.css — these are a *copy*, and the
 * comment above LABEL_COLORS is still true of everything the web package draws:
 * a key becomes a Tailwind class there, and the class reads the custom property.
 *
 * This exists because one thing outside the browser now has to know what "lime"
 * looks like: pushing an agenda's colour to Google, which has no stylesheet to
 * read and takes `#rrggbb` or nothing. Keys must match --label-* exactly, and
 * the two entries that are brand colours (green, yellow, blue, red) are written
 * out here rather than aliased, since there is no var() to follow.
 */
export const LABEL_COLOR_HEX: Record<LabelColor, HexColor> = {
  green: '#c4d254',
  lime: '#d8e8a0',
  yellow: '#ffe868',
  orange: '#ffd2a1',
  red: '#ffd9c9',
  pink: '#ffcfe3',
  purple: '#ddd0ff',
  blue: '#98e0ff',
  teal: '#b6ece0',
  gray: '#dcdcdc',
};

/** Any palette colour as something a foreign API can be handed. */
export function toHex(color: PaletteColor): HexColor {
  return isHexColor(color) ? color : (LABEL_COLOR_HEX[color] ?? LABEL_COLOR_HEX.gray);
}

/**
 * Google's eleven event colours, by the `colorId` an event carries.
 *
 * The one colour vocabulary the two calendars actually share. An event on a
 * Google agenda can only be given one of these, because `colorId` is the only
 * colour field on an event that Google lets anything write — so a colour picked
 * from this list is a colour that shows up in Google Calendar too, and one
 * picked over there arrives here. Anything wider would be a colour Gloo could
 * show and Google could not.
 *
 * The values are the ones Google Calendar's own web app paints, not the ones its
 * `/colors` endpoint reports: those still return the palette from 2012
 * (`#ff887c` for Flamingo against the `#e67c73` actually drawn), and matching
 * the endpoint would make every card a visibly different shade from the same
 * card in the other tab. The ids are the same either way, which is all that
 * travels over the wire.
 *
 * Not to be confused with Google's *event labels*, which is what colours a card
 * green over there without any colorId at all. Those cannot be mirrored: the API
 * hands back an opaque `eventLabelId` with no name and no colour, has no
 * endpoint that resolves one, and silently ignores the field on write.
 */
export const GOOGLE_EVENT_COLORS: Record<string, HexColor> = {
  '1': '#7986cb', // Lavanda
  '2': '#33b679', // Sálvia
  '3': '#8e24aa', // Uva
  '4': '#e67c73', // Flamingo
  '5': '#f6bf26', // Banana
  '6': '#f4511e', // Tangerina
  '7': '#039be5', // Pavão
  '8': '#616161', // Grafite
  '9': '#3f51b5', // Mirtilo
  '10': '#0b8043', // Manjericão
  '11': '#d50000', // Tomate
};

/** The ids in the order Google's own picker lists them. */
export const GOOGLE_EVENT_COLOR_IDS = Object.keys(GOOGLE_EVENT_COLORS);

/**
 * A colour back into the id Google knows it by, or null for one it does not.
 *
 * Null is the answer for every colour outside the eleven — the app's own palette
 * and anything a user mixed — and it means "Google has no way to show this",
 * never "clear the colour". See pushEvent, which tells the two apart.
 */
export function googleColorIdFor(color: PaletteColor | null | undefined): string | null {
  if (!color) return null;
  const hex = toHex(color).toLowerCase();
  return GOOGLE_EVENT_COLOR_IDS.find((id) => GOOGLE_EVENT_COLORS[id] === hex) ?? null;
}

/**
 * Which pool a tag belongs to.
 *
 * Routines and tasks keep separate vocabularies: creating, renaming, recolouring
 * or deleting a tag on one side leaves the other untouched, and neither picker
 * ever lists the other's. They share only the design.
 */
export const LabelScope = {
  ROUTINE: 'ROUTINE',
  TASK: 'TASK',
} as const;
export type LabelScope = (typeof LabelScope)[keyof typeof LabelScope];

export function isLabelScope(value: unknown): value is LabelScope {
  return value === LabelScope.ROUTINE || value === LabelScope.TASK;
}

/** A link the user pasted, or a file they uploaded. */
export const AttachmentKind = {
  LINK: 'LINK',
  FILE: 'FILE',
} as const;
export type AttachmentKind = (typeof AttachmentKind)[keyof typeof AttachmentKind];

/**
 * Where a calendar account's agendas come from.
 *
 * GLOO is the built-in one every user gets on first visit: its agendas live
 * only in our database. GOOGLE is a linked Google account, and its agendas are
 * mirrors of that account's calendars — which is why an agenda knows which
 * provider it belongs to before anything tries to write to it.
 */
export const CalendarProvider = {
  GLOO: 'GLOO',
  GOOGLE: 'GOOGLE',
} as const;
export type CalendarProvider = (typeof CalendarProvider)[keyof typeof CalendarProvider];

/**
 * How often a recurring event repeats.
 *
 * Deliberately four fixed rules rather than a general RRULE: these are the ones
 * the event modal offers, and each maps onto exactly one Google `RRULE` string
 * (BIWEEKLY is `FREQ=WEEKLY;INTERVAL=2`). A recurring event arriving *from*
 * Google with anything else — a by-day list, a count instead of an until —
 * is stored as a single non-recurring event rather than silently mis-expanded.
 */
/**
 * What a row on the calendar is.
 *
 * EVENT is everything this app creates and everything the Google *Calendar* API
 * sends. TASK is a Google task — a different product, mirrored onto the grid so
 * a day reads as one day, and the only kind that can be ticked off. APPOINTMENT
 * is a slot booked through an appointment schedule, which Google marks with its
 * own `eventType`.
 */
export const CalendarItemKind = {
  EVENT: 'EVENT',
  TASK: 'TASK',
  APPOINTMENT: 'APPOINTMENT',
} as const;
export type CalendarItemKind = (typeof CalendarItemKind)[keyof typeof CalendarItemKind];

export const EventRecurrence = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  BIWEEKLY: 'BIWEEKLY',
  MONTHLY: 'MONTHLY',
} as const;
export type EventRecurrence = (typeof EventRecurrence)[keyof typeof EventRecurrence];

export function isEventRecurrence(value: unknown): value is EventRecurrence {
  return typeof value === 'string' && Object.hasOwn(EventRecurrence, value);
}

/**
 * Which instances an edit or a delete applies to, asked whenever the user
 * changes an event that repeats.
 *
 * THIS writes an exception row for the one instance; ALL rewrites the master
 * and leaves existing exceptions alone — the same two choices Google's API
 * offers, so the answer passes straight through to it.
 */
export const RecurrenceScope = {
  THIS: 'THIS',
  ALL: 'ALL',
} as const;
export type RecurrenceScope = (typeof RecurrenceScope)[keyof typeof RecurrenceScope];

/** The calendar's three views. Week is the default. */
export const CalendarViewMode = {
  DAY: 'DAY',
  WEEK: 'WEEK',
  MONTH: 'MONTH',
} as const;
export type CalendarViewMode = (typeof CalendarViewMode)[keyof typeof CalendarViewMode];
