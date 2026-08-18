import type { CalendarDate } from '@internationalized/date';

import { MonthCalendar } from '@/components/common/MonthCalendar';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { strings } from '@/strings/pt-BR';

interface MiniCalendarCardProps {
  /** The day the grid is centred on. Also what decides which week is banded. */
  focusedDate: CalendarDate;
  onFocusedDateChange: (date: CalendarDate) => void;
  /** The first and last day currently on the grid, inclusive. */
  visibleRange: { start: CalendarDate; end: CalendarDate };
}

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
  visibleRange,
}: MiniCalendarCardProps) {
  function bandClassName(date: CalendarDate): string {
    if (date.compare(visibleRange.start) < 0 || date.compare(visibleRange.end) > 0) return '';

    const isStart = date.compare(visibleRange.start) === 0;
    const isEnd = date.compare(visibleRange.end) === 0;

    // Names only — the fill and the radii live in globals.css beside the rest of
    // the compact month. Written as Tailwind utilities here they lost to the
    // stylesheet's own `.gloo-compact-month .calendar__cell`, and the run came
    // out as seven rounded boxes instead of one pill.
    return `gloo-band${isStart ? ' gloo-band-start' : ''}${isEnd ? ' gloo-band-end' : ''}`;
  }

  return (
    // The month is the whole card, so it needs no name above it — the same call
    // the Dashboard's calendar makes, and for the same reason.
    <DashboardCard hideTitle title={strings.dashboard.calendar}>
      <MonthCalendar
        // The Dashboard's own scale and its three greens for today, the day you
        // picked and the day under the pointer — one compact month, drawn twice.
        // Without `gloo-month-dots`: nothing hangs under a day here, and the band
        // across the week on screen is what this calendar has to say instead.
        className="gloo-compact-month gloo-month-band"
        ariaLabel={strings.dashboard.calendar}
        focusedValue={focusedDate}
        onFocusChange={onFocusedDateChange}
        onChange={onFocusedDateChange}
        cellClassName={bandClassName}
      />
    </DashboardCard>
  );
}
