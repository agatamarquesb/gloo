import type { Role, RoutineRecurrence, TaskPriority, TaskSortBy, TaskStatus, TaskStatusFilter } from './enums';

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: Role;
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
}

export interface TaskDetailDto extends TaskListItemDto {
  description: string | null;
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

export interface RoutineDto {
  id: string;
  description: string;
  recurrence: RoutineRecurrence;
  weekday: number | null;
  dayOfMonth: number | null;
  done: boolean;
  assignee: UserDto;
  createdById: string;
}

export interface CreateRoutineInput {
  description: string;
  recurrence: RoutineRecurrence;
  weekday?: number | null;
  dayOfMonth?: number | null;
  assigneeId: string;
}

export type UpdateRoutineInput = Partial<CreateRoutineInput>;

export interface LoginInput {
  email: string;
  password: string;
}
