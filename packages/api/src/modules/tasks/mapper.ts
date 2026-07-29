import type { TaskDetailDto, TaskListItemDto } from '@gloo/shared';

import { toUserDto } from '../../lib/userDto';
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

export function computeIsOverdue(dueDate: Date | null, status: string): boolean {
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
    // Whitespace-only descriptions don't count as notes.
    hasDescription: Boolean(task.description?.trim()),
  };
}

export function toTaskDetailDto(task: TaskWithRelations): TaskDetailDto {
  return {
    ...toTaskListItemDto(task),
    description: task.description,
    subtasks: task.subtasks
      .toSorted((a, b) => a.order - b.order)
      .map((s) => ({ id: s.id, text: s.text, done: s.done, order: s.order })),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
