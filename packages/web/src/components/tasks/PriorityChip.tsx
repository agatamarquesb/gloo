import { Chip } from '@heroui/react';

import type { TaskPriority } from '@gloo/shared';

import { strings } from '@/strings/pt-BR';

const PRIORITY_COLOR: Record<TaskPriority, 'danger' | 'warning' | 'default'> = {
  HIGH: 'danger',
  MEDIUM: 'warning',
  LOW: 'default',
};

export function PriorityChip({ priority }: { priority: TaskPriority }) {
  return <Chip color={PRIORITY_COLOR[priority]}>{strings.task.priority[priority]}</Chip>;
}
