import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CalendarDate } from '@internationalized/date';
import { CalendarPlus } from 'lucide-react';

import { MonthCalendar } from '@/components/common/MonthCalendar';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { FLOATING_PANEL } from '@/theme/fieldStyles';
import { menuRow } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

interface MiniCalendarCardProps {
  /** The day the grid is centred on. Also what decides which week is banded. */
  focusedDate: CalendarDate;
  onFocusedDateChange: (date: CalendarDate) => void;
  /**
   * A day was *picked* rather than merely moved to — a click on a cell, or
   * Enter on the focused one. The page answers it by taking you to that day,
   * which is a change of view as well as of date, so it cannot go through
   * `onFocusedDateChange`: arrowing across the month must still only move the
   * band. See openWeekOn.
   */
  onOpenDay: (date: CalendarDate) => void;
  /**
   * The run of days to band, inclusive. Not the grid's own range — see
   * bandRange: on a single day the band is still that day's whole week.
   */
  bandedRange: { start: CalendarDate; end: CalendarDate };
  /**
   * The day to mark inside the band, or null for none.
   *
   * Null is what month view sends. There, the band is the whole month and every
   * day in it is equally on screen, so marking the one that happens to be
   * focused says a day was chosen when none was — leaving today as the only
   * thing standing out, which is the only thing that is actually true.
   */
  pickedDate: CalendarDate | null;
  /**
   * Start an event on a day, from the menu a right-click opens on it. The month
   * is the fastest way to reach a date on this page, and until this existed it
   * could only take you there to look.
   */
  onCreateOnDay: (date: CalendarDate) => void;
}

/** Where the menu is, and which day it was opened on. */
interface DayMenu {
  date: CalendarDate;
  x: number;
  y: number;
}

/**
 * How far from the window's edges the menu is allowed to land. Clamped rather
 * than flipped: it is one row, so there is nothing a flip would save that
 * sliding it back inside does not.
 */
const MENU_MARGIN = 8;
const MENU_WIDTH = 176;

/**
 * The month overview beside the grid, and the fastest way to jump a long way.
 *
 * The band across the visible days is drawn per cell rather than as one
 * element: the calendar is a CSS grid of independent cells with no row
 * container to hang a single pill on, and a range can wrap onto two rows in
 * month view. Each cell paints its own segment and the two ends round
 * themselves — which also gives the wrapped case the right shape for free,
 * since a row break simply falls between two square middles.
 */
export function MiniCalendarCard({
  focusedDate,
  onFocusedDateChange,
  onOpenDay,
  bandedRange,
  pickedDate,
  onCreateOnDay,
}: MiniCalendarCardProps) {
  const [menu, setMenu] = useState<DayMenu | null>(null);

  // Anything that moves the page out from under the menu closes it: it is
  // pinned to where the pointer was, so a scroll or a resize leaves it pointing
  // at a day that is no longer there. The press that closes it on the way out is
  // caught on the way *down* rather than on click, so the menu is gone before
  // whatever is underneath answers.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (pressed: KeyboardEvent) => pressed.key === 'Escape' && close();
    window.addEventListener('pointerdown', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  function bandClassName(date: CalendarDate): string {
    // The mark on the day the grid is showing. Drawn by a class of ours rather
    // than by react-aria's own selection, which is also why `value` is held
    // empty below: with a day selected, pressing that same day is not a change
    // and fires nothing — so clicking the day already on screen, from month view
    // or from week view, would do nothing at all.
    const picked = pickedDate && date.compare(pickedDate) === 0 ? ' gloo-day-picked' : '';

    if (date.compare(bandedRange.start) < 0 || date.compare(bandedRange.end) > 0) return picked;

    const isStart = date.compare(bandedRange.start) === 0;
    const isEnd = date.compare(bandedRange.end) === 0;

    // Names only — the fill and the radii live in globals.css beside the rest of
    // the compact month. Written as Tailwind utilities here they lost to the
    // stylesheet's own `.gloo-compact-month .calendar__cell`, and the run came
    // out as seven rounded boxes instead of one pill.
    return `gloo-band${isStart ? ' gloo-band-start' : ''}${isEnd ? ' gloo-band-end' : ''}${picked}`;
  }

  return (
    // The month is the whole card, so it needs no name above it — the same call
    // the Dashboard's calendar makes, and for the same reason.
    // `shrink-0`: the month is the fixed row of the column, and a squeezed
    // calendar loses a week off the bottom rather than scrolling.
    <DashboardCard hideTitle title={strings.dashboard.calendar} className="shrink-0">
      <MonthCalendar
        // The Dashboard's own scale and its three greens for today, the day you
        // picked and the day under the pointer — one compact month, drawn twice.
        // Without `gloo-month-dots`: nothing hangs under a day here, and the band
        // across the week on screen is what this calendar has to say instead.
        className="gloo-compact-month gloo-month-band"
        ariaLabel={strings.dashboard.calendar}
        focusedValue={focusedDate}
        onFocusChange={onFocusedDateChange}
        // Held empty on purpose — see bandClassName. Every press is then a
        // change, and the day the page considers picked is painted above.
        value={null}
        onChange={onOpenDay}
        cellClassName={bandClassName}
        onCellContextMenu={(date, event) => {
          // The browser's own menu is a list of things to do with the *page*,
          // and none of them is what a right-click on a date means here.
          event.preventDefault();
          setMenu({
            date,
            x: Math.min(event.clientX, window.innerWidth - MENU_WIDTH - MENU_MARGIN),
            y: event.clientY,
          });
        }}
      />

      {/* Out to the body rather than into the card: the column the card sits in
          scrolls and clips, and a menu pinned to the pointer has to be able to
          land anywhere the pointer can. */}
      {menu
        ? createPortal(
            <div
              role="menu"
              className={`fixed z-50 bg-overlay p-1 ${FLOATING_PANEL}`}
              style={{ left: menu.x, top: menu.y, width: MENU_WIDTH }}
              // The listener that closes this is on the window, and it fires on
              // the way down — so without this the menu would be gone before the
              // press inside it ever reached the button.
              onPointerDown={(press) => press.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                className={menuRow}
                onClick={() => {
                  onCreateOnDay(menu.date);
                  setMenu(null);
                }}
              >
                <CalendarPlus className="size-4" />
                {strings.calendar.createEvent}
              </button>
            </div>,
            document.body,
          )
        : null}
    </DashboardCard>
  );
}
