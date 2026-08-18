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
  /**
   * Puts the month's name first and its two arrows immediately after it, rather
   * than the month centred between them.
   *
   * The Dashboard's card asks for this because the month is that card's heading
   * — it has no other — and a heading belongs on the left edge with everything
   * else in the column. The Calendar page's mini calendar keeps the centred
   * arrangement: there the month is a control on a panel, not a title.
   */
  leadingHeading?: boolean;
  /**
   * A control for the far end of the header row — the Dashboard's agenda filter.
   * Only reachable with `leadingHeading`, which is what frees that end.
   */
  headerAction?: ReactNode;
}

/**
 * The paging arrows in the leading arrangement: the glyph and nothing else.
 *
 * No ground of its own at rest and none on hover either — a grey disc lighting
 * up behind an arrow made the header's quietest control its loudest. What
 * answers instead is the arrow itself, which darkens while it is held down, so
 * the feedback arrives with the press that is already changing the month.
 *
 * `justify-self-center` is what centres the glyph on its column, since the
 * button's own box is narrower than the seventh of the row it sits in.
 */
const NAV_BUTTON =
  'justify-self-center bg-transparent text-muted shadow-none hover:bg-transparent data-[hovered=true]:bg-transparent data-[pressed=true]:text-foreground';

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
  leadingHeading = false,
  headerAction,
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
      <Calendar.Header className={leadingHeading ? 'grid grid-cols-7 items-center px-0' : ''}>
        {leadingHeading ? (
          <>
            {/* The header is the grid's own seven columns, so every control in
                it stands over a weekday rather than wherever the flow left it:
                the arrows land on the first and fifth, the month spans the three
                between them, and the caller's control ends the row over the
                last. It is also what stops the arrows stepping sideways as the
                month name changes length. */}
            <Calendar.NavButton slot="previous" className={NAV_BUTTON} />
            <Calendar.Heading className="col-span-3 text-center" />
            <Calendar.NavButton slot="next" className={NAV_BUTTON} />
            <span aria-hidden />
            {/* Centred on the last column rather than flush with the card's
                edge: everything else in this row stands on a weekday, and one
                control 7px off that grid is the one you notice. */}
            <span className="justify-self-center">{headerAction}</span>
          </>
        ) : (
          <>
            <Calendar.NavButton slot="previous" />
            {/* flex-1 + text-center rather than letting the heading size to its
                text: the month names have different widths, so without this the
                title shifts sideways as you page through the year. */}
            <Calendar.Heading className="flex-1 text-center" />
            <Calendar.NavButton slot="next" />
          </>
        )}
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
