import type { TaskDetailDto, TaskListItemDto } from '@gloo/shared';

import { toUserDto } from '../../lib/userDto';
import { parseAttachments } from '../routines/mapper';
import type { Prisma } from '../../../generated/prisma/client';

const taskWithRelations = {
  include: {
    sector: true,
    assignees: { include: { user: true } },
    subtasks: true,
  },
} satisfies Prisma.TaskDefaultArgs;

export type TaskWithRelations = Prisma.TaskGetPayload<typeof taskWithRelations>;

export const taskInclude = taskWithRelations.include;

export function computeProgress(subtasks: { done: boolean }[]): number {
  if (subtasks.length === 0) return 0;
  return Math.round((subtasks.filter((s) => s.done).length / subtasks.length) * 100);
}

/**
 * Late either way: because somebody said so, or because the due date passed on a
 * task nobody has finished. The chip on a row reads the same for both.
 */
export function computeIsOverdue(dueDate: Date | null, status: string): boolean {
  if (status === 'OVERDUE') return true;
  return Boolean(dueDate) && dueDate! < new Date() && status !== 'DONE';
}

export function toTaskListItemDto(task: TaskWithRelations): TaskListItemDto {
  return {
    id: task.id,
    title: task.title,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    priority: task.priority,
    status: task.status,
    isOverdue: computeIsOverdue(task.dueDate, task.status),
    progress: computeProgress(task.subtasks),
    sector: { id: task.sector.id, name: task.sector.name },
    assignees: task.assignees.map((a) => toUserDto(a.user)),
    createdById: task.createdById,
    subtaskCount: task.subtasks.length,
    // Through the routines parser rather than trusting the column: it is Json, so
    // what comes back is whatever was last written, and anything malformed has to
    // be dropped before it can be counted.
    attachmentCount: parseAttachments(task.attachments)?.length ?? 0,
    // On the list DTO rather than only the detail one: the productivity chart
    // reads a whole page of tasks at once, and these are three scalars.
    workedMs: task.workedMs,
    startedAt: task.startedAt ? task.startedAt.toISOString() : null,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
  };
}

export function toTaskDetailDto(task: TaskWithRelations): TaskDetailDto {
  return {
    ...toTaskListItemDto(task),
    description: task.description,
    attachments: parseAttachments(task.attachments),
    subtasks: task.subtasks
      .toSorted((a, b) => a.order - b.order)
      .map((s) => ({ id: s.id, text: s.text, done: s.done, order: s.order })),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
