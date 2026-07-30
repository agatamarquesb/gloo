import type {
  AttachmentKind,
  LabelColor,
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
  dueDate: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  isOverdue: boolean;
  progress: number;
  sector: SectorDto;
  assignees: UserDto[];
  createdById: string;
  /**
   * Whether the task has notes in its description. A flag rather than the text
   * itself so list responses stay small — the body only comes with the detail DTO.
   */
  hasDescription: boolean;
  /**
   * How many links and files are attached. A count for the same reason
   * `hasDescription` is a flag: the row shows the number, and the attachments
   * themselves only come with the detail DTO.
   */
  attachmentCount: number;
}

export interface TaskDetailDto extends TaskListItemDto {
  description: string | null;
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
  description?: string | null;
  priority: TaskPriority;
  dueDate?: string | null;
  sectorId: string;
  assigneeIds: string[];
}

export type UpdateTaskInput = Partial<CreateTaskInput>;

export interface TaskSummaryDto {
  upcoming: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

export interface TaskBySectorDto {
  sector: SectorDto;
  pendingCount: number;
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
  color: LabelColor;
}

export interface LabelInput {
  name: string;
  color: LabelColor;
}

export interface RoutineDto {
  id: string;
  /** Shown as "Título" in the UI. */
  description: string;
  recurrence: RoutineRecurrence;
  weekday: number | null;
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
