import { Chip } from '@heroui/react';

import type { TaskStatus } from '@gloo/shared';

import { strings } from '@/strings/pt-BR';

/**
 * Each status wears the Dashboard tile of the same meaning — To Do is the "a
 * fazer" tile, Em Progresso the "em progresso" tile, and so on — so a status
 * reads the same on a task row as it does in the summary.
 *
 * These are Tailwind classes rather than HeroUI `color` values because the tile
 * palette isn't one of HeroUI's semantic slots. The utilities land in a later
 * cascade layer than `.chip`, so they override its --chip-bg default. IN_REVIEW
 * has no tile counterpart and keeps the neutral default chip.
 */
const STATUS_CLASS: Record<TaskStatus, string> = {
  TODO: 'bg-tile-todo text-tile-foreground',
  IN_PROGRESS: 'bg-tile-progress text-tile-foreground',
  IN_REVIEW: '',
  DONE: 'bg-tile-done text-tile-foreground',
};

const OVERDUE_CLASS = 'bg-tile-overdue text-tile-foreground';

export function StatusChip({ status, isOverdue }: { status: TaskStatus; isOverdue?: boolean }) {
  const showOverdue = isOverdue && status !== 'DONE';
  const label = showOverdue ? strings.task.filters.overdue : strings.task.status[status];

  return <Chip className={showOverdue ? OVERDUE_CLASS : STATUS_CLASS[status]}>{label}</Chip>;
}
