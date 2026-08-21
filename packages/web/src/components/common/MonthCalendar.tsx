import { useRef, type ReactNode } from 'react';
import { toCalendarDate, type CalendarDate } from '@internationalized/date';
import { Calendar } from '@heroui/react';

import { CALENDAR_FIRST_DAY } from '@/lib/weekStart';

interface MonthCalendarProps {
  ariaLabel: string;
  focusedValue: CalendarDate;
  onFocusChange: (date: CalendarDate) => void;
  onChange?: (date: CalendarDate) => void;
  /**
   * The selected day, when the caller wants to own it.
   *
   * `null` means "nothing is selected, ever" — which is how the Dashboard drives
   * this: react-aria only reports a *change*, so pressing the day already picked
   * fired nothing and its summary could be opened but not closed from the same
   * cell. Held empty, every press is a change, and the caller paints the day it
   * considers picked itself (see gloo-day-picked).
   *
   * Left off, the calendar keeps its own selection, which is what the Calendar
   * page's mini month wants.
   */
  value?: CalendarDate | null;
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
  /**
   * Keeps the leading arrangement's quiet arrows, but puts one at each end of
   * the row with the month's name centred between them.
   *
   * The Tasks page's month asks for this: it has no `headerAction` to balance
   * the far end, so with the group on the left it sat under the first two
   * columns of a seven-column grid with nothing across from it — and with the
   * group merely centred, the two arrows ended up in the middle of the row
   * hugging the title, which is where a reader least expects to find them. A
   * paging control belongs on the edge it pages towards.
   *
   * Not the same as dropping `leadingHeading` altogether: that arrangement puts
   * the arrows at the ends too, but wearing HeroUI's own grey discs rather than
   * this calendar's bare glyphs.
   */
  centerHeading?: boolean;
  /**
   * A right-click on a day. The Calendar page's mini month answers it with the
   * one thing you can do to a day from there — start an event on it.
   *
   * react-aria forwards the global pointer events straight to the cell's own
   * element (see filterDOMProps), so this needs no wrapper of its own and the
   * left-click that opens the day is untouched.
   */
  onCellContextMenu?: (date: CalendarDate, event: React.MouseEvent) => void;
}

/**
 * The paging arrows in the leading arrangement: the glyph and nothing else.
 *
 * No ground of its own at rest and none on hover either — a grey disc lighting
 * up behind an arrow made the header's quietest control its loudest. What
 * answers instead is the arrow itself, which darkens while it is held down, so
 * the feedback arrives with the press that is already changing the month.
 */
const NAV_BUTTON =
  'bg-transparent text-muted shadow-none hover:bg-transparent data-[hovered=true]:bg-transparent data-[pressed=true]:text-foreground';

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
  centerHeading = false,
  value,
  onCellContextMenu,
}: MonthCalendarProps) {
  /**
   * Set for the length of one right-click, so the focus the browser moves on the
   * way to the context menu can be told apart from a focus the user asked for.
   *
   * The move itself cannot be stopped: `preventDefault` on either mousedown or
   * pointerdown does stop the cell being focused, and on macOS it stops the
   * context menu with it — the menu is fired *from* that press. So the press is
   * left alone and the focus it causes is dropped instead, which leaves the month
   * where it was and the grid beside it showing the day it was already showing.
   */
  const isRightPress = useRef(false);

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
      onFocusChange={(date) => {
        if (isRightPress.current) return;
        onFocusChange(date);
      }}
      {...(value === undefined ? {} : { value })}
      // HeroUI types the selected value as DateValue — the union that also
      // covers zoned and time-bearing dates — because a Calendar can be driven
      // by any of them. This one is driven by a CalendarDate, so it only ever
      // hands back a plain date; the conversion is what says so to the compiler
      // without pushing the union onto every caller.
      onChange={onChange ? (picked) => onChange(toCalendarDate(picked)) : undefined}
    >
      <Calendar.Header className={leadingHeading ? 'items-center px-0' : ''}>
        {leadingHeading ? (
          <>
            {/* `< mês >` as one group on the left of the row, and no margin of
                its own: measured, the button's 4px inset plus the chevron's own
                inset inside its 16px box put the arrow's tip within a pixel of
                where "dom." begins — which is the line the whole header is read
                against. Pulling the button left of the row, as this did at
                first, overshoots that by the width of both insets. */}
            <Calendar.NavButton slot="previous" className={NAV_BUTTON} />
            {/* Spread, the heading takes the whole middle and the two arrows are
                pushed to the row's ends by it. Otherwise a minimum width, for
                the same reason: the month names are not the same length, and
                left to itself the arrow after it would step sideways every time
                you paged the year. Sized to the longest of them — "setembro de
                2026". */}
            <Calendar.Heading
              className={centerHeading ? 'flex-1 text-center' : 'min-w-[8.75rem] text-center'}
            />
            <Calendar.NavButton slot="next" className={NAV_BUTTON} />
            {/* Pushes whatever the caller sent to the far end of the row. Not
                needed when the heading is already doing the pushing. */}
            {centerHeading ? null : <span className="flex-1" />}
            {headerAction}
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
            <Calendar.Cell
              date={date}
              className={`relative ${cellClassName?.(date) ?? ''}`}
              onContextMenu={
                onCellContextMenu ? (event) => onCellContextMenu(date, event) : undefined
              }
              // A right-click is not a visit — see isRightPress. The flag is
              // raised for the press and lowered on the next tick, by which time
              // the focus it caused has been and gone.
              onMouseDown={
                onCellContextMenu
                  ? (press) => {
                      isRightPress.current = press.button === 2;
                      if (isRightPress.current) {
                        setTimeout(() => {
                          isRightPress.current = false;
                        }, 0);
                      }
                    }
                  : undefined
              }
            >
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
