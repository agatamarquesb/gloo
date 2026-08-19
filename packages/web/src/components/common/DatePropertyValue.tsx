import { useMemo, useState, type ReactNode } from 'react';
import { parseDate, type CalendarDate } from '@internationalized/date';
import { Calendar, Popover } from '@heroui/react';
// react-aria's own Button, not HeroUI's: HeroUI's carries its own padding,
// radius and hover fill, and all three are exactly what a bare property value
// must not have. This one is a press target and nothing else.
import { Button as AriaButton } from 'react-aria-components';

import { formatDay } from '@/lib/formatDate';
import { FIELD_PANEL, listboxPopover } from '@/theme/fieldStyles';
import { EMPTY_VALUE, PROPERTY_VALUE } from '@/theme/propertyRow';

/**
 * The calendar cut to the panel it lives in — the property column's own width,
 * which for a month of seven columns leaves a little over 22px a day.
 *
 * That is what the shorter spacing scale is for: at the default the gaps between
 * the cells were taking the width the cells needed, and Saturday was being cut
 * off by the panel's edge. Everything else — the numbers, the weekday initials,
 * the month at the head of it — is a step down in .gloo-compact-calendar in
 * globals.css, which is where the class-name selectors live and why.
 */
const CALENDAR_TYPE = 'gloo-compact-calendar [--spacing:0.15rem]';

/**
 * `relative`, because the chevron of a property that opens a *dropdown* is
 * placed absolutely against its trigger's right edge; a value that opens a
 * popover instead has to offer the same box for anything it hangs there.
 */
const POPOVER_TRIGGER = 'relative flex items-center rounded-md outline-none';

/**
 * A date as a property row shows it: written out in full ("31 de agosto, 2026"),
 * opening a calendar when the dialog it sits in is unlocked.
 *
 * A calendar in a popover rather than the segmented `DateField` the smaller
 * forms use, because a property row shows a *value*, not a field — three
 * editable segments and a suffix button would be the only control in the column
 * with chrome of its own.
 *
 * Shared by the task dialog's Deadline and the event dialog's Data and Até: the
 * three are one row seen three times, and the event dialog is where that stopped
 * being true — it had HeroUI's boxed picker in a column of bare values.
 */
export function DatePropertyValue({
  value,
  onChange,
  isEditing,
  label,
  triggerClass,
  panelWidth,
  tone = '',
  mark = null,
}: {
  /** ISO date string (`YYYY-MM-DD`), or '' for none. */
  value: string;
  onChange: (value: string) => void;
  isEditing: boolean;
  /** The row's own name, for the calendar and the trigger. */
  label: string;
  /** The property column's trigger class — see propertyStyles. */
  triggerClass: string;
  /** The width every panel in that column opens at. */
  panelWidth: string;
  /** An extra colour on the date itself — the task's overdue red. */
  tone?: string;
  /** Anything that travels with the date, on its right — the overdue mark. */
  mark?: ReactNode;
}) {
  const [isOpen, setOpen] = useState(false);

  const selected = useMemo<CalendarDate | null>(() => {
    try {
      return value ? parseDate(value) : null;
    } catch {
      return null;
    }
  }, [value]);

  const text = formatDay(value) ?? EMPTY_VALUE;

  if (!isEditing) {
    return (
      <span className="flex items-center gap-1">
        <span className={`${PROPERTY_VALUE} ${tone}`}>{text}</span>
        {mark}
      </span>
    );
  }

  return (
    <Popover isOpen={isOpen} onOpenChange={setOpen}>
      {/* No fill and no hover: a date is a value you can change, and a pill
          lighting up under the cursor made it the loudest thing in the column. */}
      <AriaButton aria-label={label} className={`${triggerClass} ${POPOVER_TRIGGER}`}>
        <span className={`break-words ${PROPERTY_VALUE} ${tone}`}>{text}</span>
        {mark}
      </AriaButton>

      {/* The column's one panel width, like every other property's. HeroUI's
          calendar is `container-type: inline-size` — its cells are a share of
          its width — so the month is cut to the panel rather than overflowing
          it; see CALENDAR_TYPE for the scale that makes seven columns fit. */}
      <Popover.Content {...listboxPopover} className={`${panelWidth} ${FIELD_PANEL}`}>
        <Popover.Dialog className="p-2">
          <Calendar
            className={`w-full max-w-none ${CALENDAR_TYPE}`}
            aria-label={label}
            value={selected}
            onChange={(date) => {
              onChange(date ? date.toString() : '');
              // Nothing else to choose once a day is picked, and a calendar left
              // open over the properties hides the rows it was opened from.
              setOpen(false);
            }}
          >
            <Calendar.Header>
              <Calendar.YearPickerTrigger>
                <Calendar.YearPickerTriggerHeading />
                <Calendar.YearPickerTriggerIndicator />
              </Calendar.YearPickerTrigger>
              <Calendar.NavButton slot="previous" />
              <Calendar.NavButton slot="next" />
            </Calendar.Header>
            <Calendar.Grid>
              <Calendar.GridHeader>
                {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
              </Calendar.GridHeader>
              <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
            </Calendar.Grid>
            <Calendar.YearPickerGrid>
              <Calendar.YearPickerGridBody>
                {({ year }) => <Calendar.YearPickerCell year={year} />}
              </Calendar.YearPickerGridBody>
            </Calendar.YearPickerGrid>
          </Calendar>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
