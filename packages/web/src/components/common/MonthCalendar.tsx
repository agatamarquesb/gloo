import type { ReactNode } from 'react';
import { toCalendarDate, type CalendarDate } from '@internationalized/date';
import { Calendar } from '@heroui/react';

import { CALENDAR_FIRST_DAY } from '@/lib/weekStart';

interface MonthCalendarProps {
  ariaLabel: string;
  focusedValue: CalendarDate;
  onFocusChange: (date: CalendarDate) => void;
  onChange?: (date: CalendarDate) => void;
  /**
   * Extra content drawn inside a day cell, under its number — the Dashboard's
   * sector dots.
   */
  renderCellExtra?: (date: CalendarDate) => ReactNode;
  /**
   * Extra classes for a day cell, so a caller can paint across a range. The
   * calendar page uses it to band the week being viewed.
   */
  cellClassName?: (date: CalendarDate) => string;
  /**
   * Extra classes for the calendar itself, where a caller has a scale of its own
   * — the Dashboard's card, whose rows are shorter than the grid's own squares.
   */
  className?: string;
}

/**
 * The month grid both calendars in the app are built from: the Dashboard's
 * card, which dots days that have tasks due, and the Calendar page's mini
 * calendar, which bands the week on screen.
 *
 * Extracted once the second one appeared — the chrome is a dozen lines of
 * HeroUI compound parts plus one non-obvious width fix, and two copies of that
 * would have drifted the first time either was touched. What differs between
 * the two is only what goes *inside* a cell, which is what the two render props
 * are for.
 */
export function MonthCalendar({
  ariaLabel,
  focusedValue,
  onFocusChange,
  onChange,
  renderCellExtra,
  cellClassName,
  className = '',
}: MonthCalendarProps) {
  return (
    <Calendar
      // HeroUI pins .calendar to a fixed w-63/max-w-63, which left the grid
      // short of the card's right edge. Utilities outrank the component layer,
      // so this lets the 7-column grid stretch and the card's own padding
      // become the margin on all four sides.
      className={`w-full max-w-full ${className}`}
      aria-label={ariaLabel}
      // Stated rather than inherited from the browser locale — see weekStart.ts
      // for what goes wrong when this and the range logic disagree.
      firstDayOfWeek={CALENDAR_FIRST_DAY}
      focusedValue={focusedValue}
      onFocusChange={onFocusChange}
      // HeroUI types the selected value as DateValue — the union that also
      // covers zoned and time-bearing dates — because a Calendar can be driven
      // by any of them. This one is driven by a CalendarDate, so it only ever
      // hands back a plain date; the conversion is what says so to the compiler
      // without pushing the union onto every caller.
      onChange={onChange ? (value) => onChange(toCalendarDate(value)) : undefined}
    >
      <Calendar.Header>
        <Calendar.NavButton slot="previous" />
        {/* flex-1 + text-center rather than letting the heading size to its
            text: the month names have different widths, so without this the
            title shifts sideways as you page through the year. */}
        <Calendar.Heading className="flex-1 text-center" />
        <Calendar.NavButton slot="next" />
      </Calendar.Header>
      <Calendar.Grid>
        <Calendar.GridHeader>
          {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
        </Calendar.GridHeader>
        <Calendar.GridBody>
          {(date) => (
            <Calendar.Cell date={date} className={`relative ${cellClassName?.(date) ?? ''}`}>
              {({ formattedDate }) => (
                <>
                  {formattedDate}
                  {renderCellExtra?.(date)}
                </>
              )}
            </Calendar.Cell>
          )}
        </Calendar.GridBody>
      </Calendar.Grid>
    </Calendar>
  );
}
