import { Button } from '@heroui/react';

import type { TaskStatusFilter } from '@gloo/shared';

import { strings } from '@/strings/pt-BR';

type StatusPillValue = TaskStatusFilter | 'ALL';

const PILLS: { value: StatusPillValue; label: string }[] = [
  { value: 'ALL', label: strings.task.filters.all },
  { value: 'TODO', label: strings.task.status.TODO },
  { value: 'IN_PROGRESS', label: strings.task.status.IN_PROGRESS },
  { value: 'OVERDUE', label: strings.task.filters.overdue },
  { value: 'DONE', label: strings.task.status.DONE },
];

export function TaskStatusPills({
  value,
  onChange,
  slim = false,
}: {
  value: StatusPillValue;
  onChange: (value: StatusPillValue) => void;
  slim?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {PILLS.map((pill) => (
        <Button
          key={pill.value}
          size={slim ? 'sm' : 'md'}
          variant={value === pill.value ? 'primary' : 'outline'}
          className="rounded-full"
          onPress={() => onChange(pill.value)}
        >
          {pill.label}
        </Button>
      ))}
    </div>
  );
}
