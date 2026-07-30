import { Button } from '@heroui/react';

import type { TaskStatusFilter } from '@gloo/shared';

import { outlineControl } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

type StatusPillValue = TaskStatusFilter | 'ALL';

const PILLS: { value: StatusPillValue; label: string }[] = [
  { value: 'ALL', label: strings.task.filters.all },
  { value: 'TODO', label: strings.task.status.TODO },
  { value: 'IN_PROGRESS', label: strings.task.status.IN_PROGRESS },
  { value: 'OVERDUE', label: strings.task.filters.overdue },
  { value: 'DONE', label: strings.task.filters.done },
];

/**
 * The outlined selection: every pill keeps the secondary button's shape and only
 * its edge says which one is on — green for the current filter, the control grey
 * for the rest.
 *
 * The transition is what makes the green *leave* rather than switch off, which
 * the "Feitas" flash below depends on: it goes green at once and eases back over
 * the best part of a second, so a task being completed reads as a wave across
 * the pill instead of a blink.
 */
const OUTLINE_PILL = 'rounded-full transition-[border-color] duration-700';

export function TaskStatusPills({
  value,
  onChange,
  slim = false,
  withOverdue = true,
  outlineSelected = false,
  flash,
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
  /**
   * Marks the current filter with a green edge instead of filling it in. For the
   * Dashboard card, where a solid green pill sat directly above a list of
   * green-edged task rows and outweighed everything it was filtering.
   */
  outlineSelected?: boolean;
  /**
   * A pill to light up green for a moment without selecting it — see
   * `useCompletedFlash` in MyTasksCard, which points it at "Feitas" whenever a
   * task is completed, so the row you just ticked off has somewhere to go.
   */
  flash?: StatusPillValue;
}) {
  const pills = withOverdue ? PILLS : PILLS.filter((pill) => pill.value !== 'OVERDUE');

  return (
    <div className="flex flex-wrap gap-2">
      {pills.map((pill) => {
        const isSelected = value === pill.value;
        const isLit = isSelected || flash === pill.value;

        return (
          <Button
            key={pill.value}
            size={slim ? 'sm' : 'md'}
            variant={outlineSelected || !isSelected ? 'outline' : 'primary'}
            className={
              outlineSelected
                ? `${OUTLINE_PILL} ${isLit ? 'border-outline-green' : outlineControl}`
                : 'rounded-full'
            }
            onPress={() => onChange(pill.value)}
          >
            {pill.label}
          </Button>
        );
      })}
    </div>
  );
}
