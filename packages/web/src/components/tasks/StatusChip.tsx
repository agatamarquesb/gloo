import { Chip } from '@heroui/react';

import type { TaskStatus } from '@gloo/shared';

import { strings } from '@/strings/pt-BR';

const STATUS_COLOR: Record<TaskStatus, 'default' | 'warning' | 'accent' | 'success'> = {
  TODO: 'default',
  IN_PROGRESS: 'warning',
  IN_REVIEW: 'accent',
  DONE: 'success',
};

export function StatusChip({ status, isOverdue }: { status: TaskStatus; isOverdue?: boolean }) {
  const color = isOverdue && status !== 'DONE' ? 'danger' : STATUS_COLOR[status];
  const label = isOverdue && status !== 'DONE' ? strings.task.filters.overdue : strings.task.status[status];

  return <Chip color={color}>{label}</Chip>;
}
