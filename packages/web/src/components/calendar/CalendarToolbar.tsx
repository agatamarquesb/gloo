import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@heroui/react';

import { CalendarViewMode } from '@gloo/shared';

import { SearchField } from '@/components/common/SearchField';
import { CALENDAR_LOCALE } from '@/lib/weekStart';
import { strings } from '@/strings/pt-BR';

import type { DateRange } from './calendarRange';

const VIEW_MODES: CalendarViewMode[] = [
  CalendarViewMode.DAY,
  CalendarViewMode.WEEK,
  CalendarViewMode.MONTH,
];

interface CalendarToolbarProps {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  range: DateRange;
  onStep: (direction: 1 | -1) => void;
  onToday: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  onCreateEvent: () => void;
}

/**
 * The range as a heading — "12–16 de setembro de 2026", or the single month or
 * day the view is showing.
 *
 * Written out rather than run through formatDate.ts: those helpers format one
 * instant, and every case here is a *range*, which collapses differently
 * depending on whether the two ends share a month and a year.
 */
function formatRange(range: DateRange, mode: CalendarViewMode): string {
  const start = range.start.toDate('UTC');
  const end = range.end.toDate('UTC');

  if (mode === CalendarViewMode.MONTH) {
    // The padded grid starts in the previous month, so the heading names the
    // month the user asked for — taken from the middle of the range, which is
    // always inside it.
    const middle = new Date((start.getTime() + end.getTime()) / 2);
    return new Intl.DateTimeFormat(CALENDAR_LOCALE, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(middle);
  }

  if (mode === CalendarViewMode.DAY) {
    return new Intl.DateTimeFormat(CALENDAR_LOCALE, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(start);
  }

  const sameMonth = range.start.month === range.end.month && range.start.year === range.end.year;
  const tail = new Intl.DateTimeFormat(CALENDAR_LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(end);

  // A week inside one month says its month once: "12–16 de setembro de 2026".
  // One that straddles two has to name both.
  const head = sameMonth
    ? String(range.start.day)
    : new Intl.DateTimeFormat(CALENDAR_LOCALE, {
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      }).format(start);

  return `${head} – ${tail}`;
}

/**
 * The row above the grid: search, the range and its arrows, the view selector,
 * and the button that adds an event.
 *
 * Agenda filtering deliberately isn't here. It used to be a row of pills, but
 * an agenda is no longer a tag — it belongs to an account, carries a colour and
 * can be hidden — so the Agendas card owns that now and the eye icons are the
 * filter.
 */
export function CalendarToolbar({
  viewMode,
  onViewModeChange,
  range,
  onStep,
  onToday,
  search,
  onSearchChange,
  onCreateEvent,
}: CalendarToolbarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          slim
          value={search}
          onChange={onSearchChange}
          placeholder={strings.calendar.searchPlaceholder}
          className="min-w-0 flex-1 basis-52"
        />

        <div className="flex items-center gap-1">
          <Button
            isIconOnly
            size="sm"
            variant="outline"
            className="rounded-full"
            aria-label={strings.calendar.previous}
            onPress={() => onStep(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" onPress={onToday}>
            {strings.calendar.today}
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="outline"
            className="rounded-full"
            aria-label={strings.calendar.next}
            onPress={() => onStep(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <Button
          isIconOnly
          size="sm"
          variant="primary"
          className="rounded-full"
          aria-label={strings.calendar.newEvent}
          onPress={onCreateEvent}
        >
          <Plus className="size-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* first-letter:uppercase because PT-BR month names are lowercase, and a
            heading that reads "setembro de 2026" looks like a typo mid-page. */}
        <h2 className="text-lg font-semibold first-letter:uppercase">
          {formatRange(range, viewMode)}
        </h2>

        {/* Same rule as the task status pills: the view you are in is the filled
            one, the others outlined. */}
        <div className="flex gap-2">
          {VIEW_MODES.map((mode) => (
            <Button
              key={mode}
              size="sm"
              variant={mode === viewMode ? 'primary' : 'outline'}
              className="rounded-full"
              onPress={() => onViewModeChange(mode)}
            >
              {strings.calendar.view[mode]}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
