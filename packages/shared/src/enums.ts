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

export const DEFAULT_LABEL_COLOR: LabelColor = 'green';

export function isLabelColor(value: unknown): value is LabelColor {
  return typeof value === 'string' && (LABEL_COLORS as readonly string[]).includes(value);
}

/** A link the user pasted, or a file they uploaded. */
export const AttachmentKind = {
  LINK: 'LINK',
  FILE: 'FILE',
} as const;
export type AttachmentKind = (typeof AttachmentKind)[keyof typeof AttachmentKind];
