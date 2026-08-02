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
 * month view. Each cell paints its own background, and the two ends round
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

    // The middles have to say rounded-none explicitly: HeroUI's cell is already
    // rounded-full, so leaving the radius alone clips each day's fill into its
    // own circle and the band reads as seven separate dots rather than one run.
    const shape =
      isStart && isEnd
        ? 'rounded-full'
        : isStart
          ? 'rounded-l-full rounded-r-none'
          : isEnd
            ? 'rounded-r-full rounded-l-none'
            : 'rounded-none';

    // The band sits behind the day number, so it must not take the cell's own
    // text colour with it — bg only, and the accent at low strength so the
    // number stays the thing being read.
    return `bg-accent/25 ${shape}`;
  }

  return (
    <DashboardCard title={strings.dashboard.calendar}>
      <MonthCalendar
        ariaLabel={strings.dashboard.calendar}
        focusedValue={focusedDate}
        onFocusChange={onFocusedDateChange}
        onChange={onFocusedDateChange}
        cellClassName={bandClassName}
      />
    </DashboardCard>
  );
}
