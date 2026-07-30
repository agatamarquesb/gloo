import { Button } from '@heroui/react';

import type { TaskStatusFilter } from '@gloo/shared';

import { strings } from '@/strings/pt-BR';

type StatusPillValue = TaskStatusFilter | 'ALL';

const PILLS: { value: StatusPillValue; label: string }[] = [
  { value: 'ALL', label: strings.task.filters.all },
  { value: 'TODO', label: strings.task.status.TODO },
  { value: 'IN_PROGRESS', label: strings.task.status.IN_PROGRESS },
  { value: 'OVERDUE', label: strings.task.filters.overdue },
  { value: 'DONE', label: strings.task.filters.done },
];

export function TaskStatusPills({
  value,
  onChange,
  slim = false,
  withOverdue = true,
}: {
  value: StatusPillValue;
  onChange: (value: StatusPillValue) => void;
  slim?: boolean;
  /**
   * Whether "Atrasada" is one of the filters. The Dashboard leaves it out — it
   * has a tile counting overdue tasks a few centimetres above, and a filter for
   * the same thing on the card below was the second answer to a question the
   * page had already answered.
   */
  withOverdue?: boolean;
}) {
  const pills = withOverdue ? PILLS : PILLS.filter((pill) => pill.value !== 'OVERDUE');

  return (
    <div className="flex flex-wrap gap-2">
      {pills.map((pill) => (
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
