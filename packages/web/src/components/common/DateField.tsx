import { CalendarDate, parseDate } from '@internationalized/date';
import { Calendar, DateField as HeroDateField, DatePicker, Label } from '@heroui/react';

/**
 * Wraps HeroUI's DatePicker with the ISO-date (`YYYY-MM-DD`) string API the
 * rest of the app uses, so callers don't each repeat the CalendarDate
 * conversion and the full DatePicker composition tree.
 */
export function DateField({
  label,
  value,
  onChange,
  isDisabled = false,
  hideLabel = false,
}: {
  label: string;
  /** ISO date string (YYYY-MM-DD), or '' for empty. */
  value: string;
  onChange: (value: string) => void;
  isDisabled?: boolean;
  /**
   * Keeps the name for screen readers and takes it off the screen — for a
   * property row, where the label is already written in the column to the left
   * and a second copy above the field read as two fields.
   */
  hideLabel?: boolean;
}) {
  let parsed: CalendarDate | null = null;
  try {
    parsed = value ? parseDate(value) : null;
  } catch {
    parsed = null;
  }

  return (
    <DatePicker
      isDisabled={isDisabled}
      value={parsed}
      onChange={(date) => onChange(date ? date.toString() : '')}
    >
      <Label className={hideLabel ? "sr-only" : undefined}>{label}</Label>
      <HeroDateField.Group fullWidth>
        <HeroDateField.Input>
          {(segment) => <HeroDateField.Segment segment={segment} />}
        </HeroDateField.Input>
        <HeroDateField.Suffix>
          <DatePicker.Trigger>
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </HeroDateField.Suffix>
      </HeroDateField.Group>
      <DatePicker.Popover>
        <Calendar aria-label={label}>
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
      </DatePicker.Popover>
    </DatePicker>
  );
}
