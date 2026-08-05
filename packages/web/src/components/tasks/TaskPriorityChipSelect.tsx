import { TaskPriority } from '@gloo/shared';

import { strings } from '@/strings/pt-BR';

import { ChipSelect } from './ChipSelect';
import { PriorityChip } from './PriorityChip';

/** Low to high, the way the colours run — see PriorityChip. */
const PRIORITY_OPTIONS = [TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH];

/**
 * A task's priority, chosen the way its status is: the pill is the control, and
 * the options are the same pill in the other two colours.
 *
 * The same component as the status row rather than a select of its own, because
 * priority is the other property on the list that is a fixed set of named steps
 * — and having them look almost but not quite alike, two rows apart in the same
 * dialog, was the difference you noticed instead of the one that matters.
 */
export function TaskPriorityChipSelect({
  priority,
  isDisabled = false,
  panelWidth,
  onChange,
}: {
  priority: TaskPriority;
  isDisabled?: boolean;
  /** See ChipSelect — the width of the column the panel has to line up with. */
  panelWidth?: string;
  onChange: (priority: TaskPriority) => void;
}) {
  return (
    <ChipSelect
      value={priority}
      options={PRIORITY_OPTIONS}
      label={strings.task.fields.priority}
      optionLabel={(option) => strings.task.priority[option]}
      renderChip={(option) => <PriorityChip priority={option} />}
      isDisabled={isDisabled}
      panelWidth={panelWidth}
      onChange={onChange}
    />
  );
}
