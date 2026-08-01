import { ListBox, Select } from '@heroui/react';

import { TaskStatus } from '@gloo/shared';

import {
  FLAT_SELECT_TRIGGER,
  NO_FIELD_BORDER,
  PANEL_OWNS_FIELD,
  PILL_LISTBOX_ITEM,
  listboxPopover,
} from '@/theme/fieldStyles';
import { strings } from '@/strings/pt-BR';

import { StatusChip, STATUS_PILL_HEIGHT } from './StatusChip';

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
 * options drop down under it.
 *
 * Late or not makes no difference to any of this — the trigger shows "atrasada"
 * because the deadline passed, and the three options underneath stay open and
 * settable the whole time.
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
const CHIP_TRIGGER = `${FLAT_SELECT_TRIGGER} ${NO_FIELD_BORDER} h-auto min-h-0 w-fit cursor-pointer items-center p-0 [--field-shadow:none] aria-expanded:opacity-0`;

/**
 * The panel's own top: the field the options belong to, on the grey ground every
 * open field in the app takes, closed off from the list by a hairline.
 *
 * The other selects get this for free — their trigger *is* a field and grows the
 * ground itself (see OPEN_FIELD_GROUND). This one's trigger is a chip that hugs
 * its label, half the width of the panel below it, so a ground drawn on it would
 * be a tab stuck to a wider box. Instead the panel carries the field, and the
 * offsets below lay it exactly over the chip — which is why the chip goes
 * invisible while it is open: it is still there, holding the row's layout, with
 * its double a pixel above it.
 */
const PANEL_FIELD = 'flex items-center border-b border-border/50 bg-default/25 px-2 py-1';


/**
 * Where that lands the panel. Both numbers are the field band's own geometry:
 * up by the chip's height plus the band's `py-1`, so the two chips share a top
 * edge, and left by the band's `px-2`, so they share a left edge.
 */
const PANEL_OVER_CHIP = { offset: -(STATUS_PILL_HEIGHT + 4), crossOffset: -8 };

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
      <Select.Popover {...listboxPopover} {...PANEL_OVER_CHIP} className={PANEL_OWNS_FIELD}>
        <div className={PANEL_FIELD}>
          <StatusChip status={status} isOverdue={isOverdue} />
        </div>

        <ListBox>
          {STATUS_OPTIONS.map((option) => (
            // The option *is* the pill it will become, so choosing a status is
            // recognising the thing you already see on the row rather than
            // reading its name and picturing it. No rules between them: three
            // pills of three different colours are separated well enough by the
            // colours.
            <ListBox.Item
              key={option}
              id={option}
              textValue={strings.task.status[option]}
              className={PILL_LISTBOX_ITEM}
            >
              <StatusChip status={option} />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
