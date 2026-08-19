import { useState, type ReactNode } from 'react';
import type { CalendarDate } from '@internationalized/date';
import { ChevronDown, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button, Popover } from '@heroui/react';

import { CalendarViewMode } from '@gloo/shared';

import { SearchField } from '@/components/common/SearchField';
import { FIELD_PANEL, PANEL_MATCHES_TRIGGER } from '@/theme/fieldStyles';
import { dotsMenuButton, menuRow, outlineControl } from '@/theme/styleConstants';
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
 * The range as a heading — the month it falls in, and the year.
 *
 * Only ever a month and a year, never the days: they are written across the top
 * of the grid immediately below, so the heading's job is to say where in the
 * year you are and nothing more.
 *
 * A week that straddles two months is named after both — "Ago. – Set. 2026" —
 * because naming it after one of them is a heading that disagrees with three of
 * the columns under it. Short forms there and long ones for a single month: the
 * transition form is twice the words, and this row has one line to spend.
 *
 * The month view is always named after itself even though its grid begins in
 * the previous month, which is why the midpoint is what gets formatted rather
 * than either end.
 */
function monthName(date: CalendarDate, style: 'long' | 'short'): string {
  const formatted = new Intl.DateTimeFormat(CALENDAR_LOCALE, {
    month: style,
    timeZone: 'UTC',
  }).format(date.toDate('UTC'));
  // PT-BR month names are lowercase, and a heading that opens "agosto de 2026"
  // reads as a typo mid-page. Done here rather than with `first-letter` because
  // a transition heading has two of them.
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatRange(range: DateRange, viewMode: CalendarViewMode): string {
  const { start, end } = range;

  // The month view's own range runs from the last days of one month to the first
  // of the next by definition; only a day or a week straddling one is a
  // transition worth naming.
  if (viewMode !== CalendarViewMode.MONTH && start.month !== end.month) {
    const from = monthName(start, 'short');
    const to = monthName(end, 'short');
    return start.year === end.year
      ? `${from} – ${to} ${end.year}`
      : `${from} ${start.year} – ${to} ${end.year}`;
  }

  const middle = new Date(
    (start.toDate('UTC').getTime() + end.toDate('UTC').getTime()) / 2,
  );

  return new Intl.DateTimeFormat(CALENDAR_LOCALE, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(middle);
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
/**
 * A control in this row that is only its glyph — the two arrows and the search
 * toggle. The app's `···` treatment: no ground at rest or on hover, the icon
 * going from grey to full ink instead. See dotsMenuButton.
 */
function IconButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      isIconOnly
      size="sm"
      variant="ghost"
      aria-label={label}
      className={dotsMenuButton}
      onPress={onPress}
    >
      {children}
    </Button>
  );
}

/**
 * The shape the row's two secondary controls share: "Hoje" and the view
 * selector beside it.
 *
 * Written down once because they sit against each other — any drift in height,
 * radius or hover between the two is visible without moving your eye. The light
 * grey under the cursor is the point of it: at HeroUI's own default the pill
 * went almost as dark as the ink on it, which read as pressed rather than as
 * hovered.
 */
const TOOLBAR_PILL = [
  outlineControl,
  'h-9 rounded-full text-sm font-medium text-muted md:h-8',
  'hover:bg-default/40 data-[hovered=true]:bg-default/40',
].join(' ');

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
  const [isViewOpen, setViewOpen] = useState(false);

  return (
    // One row: the month with its arrows on the left, then the three controls
    // that act on what is under it. Two rows meant the heading and the view
    // buttons sat on a line of their own above a search field that is used once
    // a week — a strip of chrome as tall as three hours of the day it was
    // covering.
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <IconButton label={strings.calendar.previous} onPress={() => onStep(-1)}>
          <ChevronLeft className="size-4" />
        </IconButton>

        {/* The heading is also a way back to today, the same as the "Hoje"
            pill on the other end of the row. first-letter:uppercase because
            PT-BR month names are lowercase, and a heading that reads "agosto de
            2026" looks like a typo mid-page. */}
        <button
          type="button"
          onClick={onToday}
          title={strings.calendar.today}
          className="cursor-pointer px-1 text-lg font-semibold whitespace-nowrap first-letter:uppercase"
        >
          {formatRange(range, viewMode)}
        </button>

        <IconButton label={strings.calendar.next} onPress={() => onStep(1)}>
          <ChevronRight className="size-4" />
        </IconButton>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* The way back to the day you are actually on, and the first of the
            row's two secondary controls — the same pill as the view selector it
            sits against, because the two are pressed in the same breath: pick a
            view, then come back to today in it. The heading on the left still
            does the same thing, but a heading is not somewhere anyone looks for
            a button. */}
        <Button
          size="sm"
          variant="outline"
          className={`${TOOLBAR_PILL} px-3`}
          onPress={onToday}
        >
          {strings.calendar.today}
        </Button>

        {/* Dia, Semana and Mês were three pills spending a third of the row on
            the two you are not in. One control, naming the one you are — and
            wearing the same outlined pill as the search field beside it, since
            the two are the row's two secondary controls. */}
        <Popover isOpen={isViewOpen} onOpenChange={setViewOpen}>
          {/* One fixed width, cut for "Semana" — the longest of the three. Sized
              to its own label the pill changed width every time the view did,
              which moved the search field and the "+" beside it sideways as a
              side effect of choosing a view. The label sits left and the chevron
              at the far end, so the word starts in the same place in all three
              states. */}
          <Button
            size="sm"
            variant="outline"
            className={[
              TOOLBAR_PILL,
              'w-[6.5rem] justify-between gap-1 px-3',
              // Open, the pill and its list are one shape: the bottom corners
              // square off to meet the panel butting against them, exactly as a
              // property row does in the task and routine modals (see
              // OPEN_FIELD_GROUND).
              //
              // And the top two come down from the capsule's own radius to the
              // 8px the panel under them is drawn at. Kept at `rounded-full` the
              // squared-off bottom turned the trigger into a dome sitting on a
              // box — a shape neither half of the silhouette owns. At 8px the
              // two read as one box with rounded corners, which is what the pill
              // becomes for as long as its list is open.
              'aria-expanded:rounded-b-none aria-expanded:rounded-t-lg aria-expanded:bg-default/40',
            ].join(' ')}
          >
            {strings.calendar.view[viewMode]}
            <ChevronDown className="size-4 shrink-0" />
          </Button>

          {/* As wide as the pill it dropped from and touching it: the app's own
              dropdown panel (FIELD_PANEL, which squares whichever edge meets the
              trigger), with the two far corners rounded to the pill's radius so
              the trigger and the list read as one silhouette. `offset={0}` is
              what closes the 2px seam that used to leave the list floating below
              the button. */}
          <Popover.Content
            offset={0}
            className={`${PANEL_MATCHES_TRIGGER} ${FIELD_PANEL} rounded-b-lg data-[placement=top]:rounded-t-lg`}
          >
            <Popover.Dialog className="p-1">
              <div className="flex flex-col gap-0.5">
                {VIEW_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`${menuRow} ${mode === viewMode ? 'text-foreground' : ''}`}
                    onClick={() => {
                      onViewModeChange(mode);
                      setViewOpen(false);
                    }}
                  >
                    {strings.calendar.view[mode]}
                  </button>
                ))}
              </div>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>

        {/* Always on the row rather than behind a magnifier that swapped itself
            for the field: the toggle spent a control on hiding a control, and
            what it hid is the one thing on this row you look for by name. */}
        <SearchField
          slim
          value={search}
          onChange={onSearchChange}
          placeholder={strings.common.search}
          className="w-52"
        />

        <Button
          isIconOnly
          size="sm"
          variant="primary"
          className="size-9 rounded-full md:size-8"
          aria-label={strings.calendar.newEvent}
          onPress={onCreateEvent}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}
