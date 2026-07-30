import { ListBox, Select } from '@heroui/react';

import { TaskStatus } from '@gloo/shared';

import { FLAT_SELECT_TRIGGER, NO_FIELD_BORDER } from '@/theme/fieldStyles';
import { strings } from '@/strings/pt-BR';

import { StatusChip } from './StatusChip';

const STATUS_OPTIONS = Object.values(TaskStatus);

/**
 * The chip is the control: press a task's status on a list row and the four
 * options drop down under it.
 *
 * The trigger carries no chrome of its own — the chip already has a shape and a
 * colour, and a second border around it would read as a chip inside a field.
 * `w-fit` keeps the hit area on the chip rather than spanning the row's column.
 *
 * `min-h-0` and `items-center` are what let the chip be its own size. HeroUI's
 * trigger is `min-h-9` and stretches its content, so the pill was being pulled
 * to 36px from the outside — no amount of padding on the chip itself was ever
 * going to shorten it.
 */
const CHIP_TRIGGER = `${FLAT_SELECT_TRIGGER} ${NO_FIELD_BORDER} h-auto min-h-0 w-fit cursor-pointer items-center p-0 [--field-shadow:none]`;

/**
 * A row in the dropdown. The pill inside carries the colour and the shape, so
 * the row itself only provides the tap area — no rule, and no tick beside the
 * current one, which the trigger is already showing.
 */
const STATUS_ITEM = 'cursor-pointer px-3 py-1.5';

export function TaskStatusChipSelect({
  status,
  isOverdue,
  isDisabled = false,
  onChange,
}: {
  status: TaskStatus;
  isOverdue?: boolean;
  isDisabled?: boolean;
  onChange: (status: TaskStatus) => void;
}) {
  return (
    <Select
      isDisabled={isDisabled}
      value={status}
      aria-label={strings.task.fields.status}
      onChange={(key) => onChange(String(key) as TaskStatus)}
    >
      <Select.Trigger className={CHIP_TRIGGER}>
        <StatusChip status={status} isOverdue={isOverdue} />
      </Select.Trigger>
      <Select.Popover className="rounded-xl" placement="bottom start">
        <ListBox>
          {STATUS_OPTIONS.map((option) => (
            // The option *is* the pill it will become, so choosing a status is
            // recognising the thing you already see on the row rather than
            // reading its name and picturing it. No rules between them: four
            // pills of four different colours are separated well enough by the
            // colours.
            <ListBox.Item
              key={option}
              id={option}
              textValue={strings.task.status[option]}
              className={STATUS_ITEM}
            >
              <StatusChip status={option} />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
