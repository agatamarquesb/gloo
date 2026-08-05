import type { ReactNode } from 'react';
import { ListBox, Select } from '@heroui/react';

import {
  FLAT_SELECT_TRIGGER,
  LISTBOX_FLUSH,
  LISTBOX_ITEM_INSET,
  NO_FIELD_BORDER,
  PANEL_OWNS_FIELD,
  PILL_LISTBOX_ITEM,
  listboxPopover,
} from '@/theme/fieldStyles';
import { VIEW_TRIGGER, VIEW_UNDIMMED } from '@/theme/propertyRow';

import { STATUS_PILL_HEIGHT } from './StatusChip';

/**
 * A property whose value is a **botão de status** and whose options are the same
 * pill in every colour it comes in — the task's status, and its priority.
 *
 * One component for both because the two are the same object: a fixed set of
 * named steps, each of which reads as a colour before it reads as a word. The
 * geometry below was tuned on the status dropdown; priority inherits it by
 * construction rather than by copy, so the two can never drift apart.
 *
 * The chip *is* the control: press it and the options drop down under it.
 */

/**
 * The trigger carries no chrome of its own — the chip already has a shape and a
 * colour, and a second border around it would read as a chip inside a field.
 * `w-fit` keeps the hit area on the chip rather than spanning the row's column.
 *
 * `min-h-0` and `items-center` are what let the chip be its own size. HeroUI's
 * trigger is `min-h-9` and stretches its content, so the pill was being pulled
 * to 36px from the outside — no amount of padding on the chip itself was ever
 * going to shorten it.
 */
const CHIP_TRIGGER = `${FLAT_SELECT_TRIGGER} ${NO_FIELD_BORDER} h-auto min-h-0 w-fit items-center p-0 [--field-shadow:none] aria-expanded:opacity-0`;

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
const PANEL_FIELD = `flex items-center border-b border-border/50 bg-default/25 ${LISTBOX_ITEM_INSET} py-1`;

/**
 * Where that lands the panel. Both numbers are the field band's own geometry:
 * up by the chip's height plus the band's `py-1`, so the two chips share a top
 * edge, and left by the band's inset plus the panel's hairline, so they share a
 * left edge — see LISTBOX_ITEM_INSET for why those come to 8 rather than 7.
 */
const PANEL_OVER_CHIP = { offset: -(STATUS_PILL_HEIGHT + 4), crossOffset: -8 };

export function ChipSelect<T extends string>({
  value,
  options,
  label,
  optionLabel,
  renderChip,
  isDisabled = false,
  panelWidth = '',
  onChange,
}: {
  value: T;
  options: readonly T[];
  /** What the property is called, for screen readers — the chip is a colour. */
  label: string;
  /** An option's name, for the same reason and for type-ahead. */
  optionLabel: (option: T) => string;
  renderChip: (option: T) => ReactNode;
  isDisabled?: boolean;
  /**
   * A width for the panel, where the caller has a column to line it up with —
   * the task modal, whose property popovers are all one size. Left off, the
   * panel is as wide as the widest chip in it, which is what a task row wants:
   * there is no column there, only the chip it drops from.
   */
  panelWidth?: string;
  onChange: (value: T) => void;
}) {
  const shown = renderChip(value);

  return (
    // Disabled, the chip keeps its full colour and only stops opening: a status
    // you may not change is still the status the task has, and HeroUI's dimming
    // made it read as a greyed-out control instead. Same opt-out the locked
    // property rows take — see VIEW_TRIGGER.
    <Select
      isDisabled={isDisabled}
      value={value}
      aria-label={label}
      className={isDisabled ? VIEW_UNDIMMED : ''}
      onChange={(key) => onChange(String(key) as T)}
    >
      <Select.Trigger
        className={`${CHIP_TRIGGER} ${isDisabled ? VIEW_TRIGGER : 'cursor-pointer'}`}
      >
        {shown}
      </Select.Trigger>

      <Select.Popover
        {...listboxPopover}
        {...PANEL_OVER_CHIP}
        className={`${PANEL_OWNS_FIELD} ${panelWidth}`}
      >
        <div className={PANEL_FIELD}>{shown}</div>

        <ListBox className={LISTBOX_FLUSH}>
          {options.map((option) => (
            // The option *is* the pill it will become, so choosing one is
            // recognising the thing you already see on the row rather than
            // reading its name and picturing it. No rules between them and no
            // tick on the current one: pills of three different colours are
            // separated well enough by the colours, and a mark behind one reads
            // as a second shape around it.
            <ListBox.Item
              key={option}
              id={option}
              textValue={optionLabel(option)}
              className={PILL_LISTBOX_ITEM}
            >
              {renderChip(option)}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
