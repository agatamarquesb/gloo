import { TaskStatus } from '@gloo/shared';

import { strings } from '@/strings/pt-BR';

import { ChipSelect } from './ChipSelect';
import { StatusChip } from './StatusChip';

/**
 * The three statuses a person sets. "Atrasada" is not among them and never was
 * a choice to make: a task is late because its deadline passed, so the chip says
 * so on its own — see `isOverdue` on the DTO and the trigger below. Offering it
 * asked the reader to declare something the date had already decided.
 *
 * TaskStatus.OVERDUE stays in the enum: tasks marked late by hand before this
 * still carry it, and they keep showing "atrasada" — you just can't set it any
 * more, and picking any of the three below moves such a task out of it.
 */
const STATUS_OPTIONS = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE];

/**
 * The chip is the control: press a task's status on a list row and the three
 * options drop down under it. Everything about how that looks is ChipSelect's,
 * which the priority row wears too.
 *
 * Late or not makes no difference to any of this: lateness is said beside the
 * deadline (see OverdueMark) and the status stays the status the user set.
 */
export function TaskStatusChipSelect({
  status,
  isDisabled = false,
  panelWidth,
  onChange,
}: {
  status: TaskStatus;
  isDisabled?: boolean;
  /** See ChipSelect — the task modal gives its column's width, a row gives none. */
  panelWidth?: string;
  onChange: (status: TaskStatus) => void;
}) {
  return (
    <ChipSelect
      value={status}
      options={STATUS_OPTIONS}
      label={strings.task.fields.status}
      optionLabel={(option) => strings.task.status[option]}
      renderChip={(option) => <StatusChip status={option} />}
      isDisabled={isDisabled}
      panelWidth={panelWidth}
      onChange={onChange}
    />
  );
}
