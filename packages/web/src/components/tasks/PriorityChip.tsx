import type { TaskPriority } from '@gloo/shared';

import { strings } from '@/strings/pt-BR';

import { DOT, LABEL_OPTICAL_LIFT, STATUS_PILL } from './StatusChip';

/**
 * Priority as a scale you can see: yellow, orange, red, low to high. See
 * --priority-* in globals.css for why priority gets colours of its own rather
 * than borrowing the status tints — and why they are lighter than those, since
 * the two pills meet inside the same dialog.
 *
 * Exactly a status pill's construction, in the priority palette: a fill and a
 * label a darker step of the same hue, no edge. The word carries the colour, so
 * the three read apart without a line drawn round each one.
 */
const PRIORITY_CLASS: Record<TaskPriority, string> = {
  LOW: 'bg-priority-low text-priority-low-text',
  MEDIUM: 'bg-priority-medium text-priority-medium-text',
  HIGH: 'bg-priority-high text-priority-high-text',
};

/**
 * The botão de status' shape wearing the priority palette: the same capsule, the
 * same dot, the same case — geometry imported from StatusChip rather than
 * restated, so the two can never drift apart.
 */
export function PriorityChip({ priority }: { priority: TaskPriority }) {
  return (
    <span className={`${STATUS_PILL} ${PRIORITY_CLASS[priority]}`}>
      <span aria-hidden className={DOT} />
      <span className={LABEL_OPTICAL_LIFT}>{strings.task.priority[priority]}</span>
    </span>
  );
}
