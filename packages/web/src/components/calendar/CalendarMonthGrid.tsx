import type { CalendarDate } from '@internationalized/date';

import type { AgendaDto, CalendarEventDto } from '@gloo/shared';

import { CALENDAR_LOCALE } from '@/lib/weekStart';
import { colorBlock } from '@/theme/labelColors';
import { strings } from '@/strings/pt-BR';

import { formatEventTime } from './EventBlock';
import { instanceKey } from './CalendarTimeGrid';
import { clipToDay, utcDayKey } from './eventLayout';

/**
 * How many chips a cell shows before collapsing the rest into a count.
 *
 * A month cell is around 90px tall; four chips plus the date already fill it,
 * and letting a busy day grow its row would make every other row in the month
 * grow with it.
 */
const MAX_CHIPS = 3;

const WEEKDAY_FORMAT = new Intl.DateTimeFormat(CALENDAR_LOCALE, {
  weekday: 'short',
  timeZone: 'UTC',
});

interface CalendarMonthGridProps {
  days: CalendarDate[];
  events: CalendarEventDto[];
  agendasById: Map<string, AgendaDto>;
  selectedEventId: string | null;
  onSelectEvent: (event: CalendarEventDto) => void;
  /** Clicking the day number opens that day. */
  onOpenDay: (day: CalendarDate) => void;
  /** Clicking empty space in a cell starts an event at 09:00 that day. */
  onCreateOnDay: (start: Date) => void;
  focusedMonth: number;
  todayIso: string;
}

/** Where a click on an empty month cell puts a new event. */
const NEW_EVENT_HOUR = 9;

/**
 * The month view: whole weeks of cells, each listing that day's events as
 * chips.
 *
 * Chips rather than positioned blocks — a month cell has no usable vertical
 * scale, so an event's height would say nothing and its position would say
 * less. What a month is read for is which days are busy and roughly with what,
 * so the cell lists titles in time order and says how many it could not fit.
 */
export function CalendarMonthGrid({
  days,
  events,
  agendasById,
  selectedEventId,
  onSelectEvent,
  onOpenDay,
  onCreateOnDay,
  focusedMonth,
  todayIso,
}: CalendarMonthGridProps) {
  const weeks: CalendarDate[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return (
    <div className="gloo-thin-scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="grid grid-cols-7 border-b border-border pb-2">
        {days.slice(0, 7).map((day) => (
          <span
            key={day.toString()}
            className="text-center text-xs text-muted capitalize"
          >
            {WEEKDAY_FORMAT.format(day.toDate('UTC'))}
          </span>
        ))}
      </div>

      <div className="grid flex-1 auto-rows-fr grid-cols-7">
        {weeks.flatMap((week) =>
          week.map((day) => {
            const localDayStart = new Date(day.year, day.month - 1, day.day);
            const dayKey = day.toString();
            const dayEvents = events
              .filter((event) =>
                // All-day events are matched by calendar date; everything else
                // by where it falls on this day's clock.
                event.isAllDay
                  ? utcDayKey(event.startsAt) <= dayKey &&
                    dayKey <= utcDayKey(new Date(new Date(event.endsAt).getTime() - 1).toISOString())
                  : clipToDay(event, localDayStart) !== null,
              )
              .toSorted((a, b) => a.startsAt.localeCompare(b.startsAt));

            const isToday = day.toString() === todayIso;
            // Days completing the first and last weeks belong to the months
            // either side, and are dimmed so the month itself still reads as a
            // shape rather than as a six-by-seven block of equal cells.
            const isOutside = day.month !== focusedMonth;

            return (
              <div
                key={day.toString()}
                role="presentation"
                onClick={(clickEvent) => {
                  if (clickEvent.target !== clickEvent.currentTarget) return;
                  const start = new Date(localDayStart);
                  start.setHours(NEW_EVENT_HOUR, 0, 0, 0);
                  onCreateOnDay(start);
                }}
                className={`min-h-24 border-r border-b border-border/50 p-1 ${
                  isOutside ? 'bg-background/30' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => onOpenDay(day)}
                  className={`mb-1 flex size-6 items-center justify-center rounded-full text-xs ${
                    isToday ? 'bg-accent font-semibold text-accent-foreground' : ''
                  } ${isOutside ? 'text-muted' : ''}`}
                >
                  {day.day}
                </button>

                <div className="flex flex-col gap-0.5">
                  {dayEvents.slice(0, MAX_CHIPS).map((event) => {
                    const color = agendasById.get(event.agendaId)?.color ?? 'gray';
                    const key = instanceKey(event);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => onSelectEvent(event)}
                        {...colorBlock(
                          color,
                          `flex w-full items-center gap-1 truncate rounded-md border px-1 py-0.5 text-left text-[10px] text-black ${
                            selectedEventId === key
                              ? 'ring-1 ring-foreground ring-offset-1 ring-offset-surface'
                              : ''
                          }`,
                        )}
                      >
                        {/* No clock time on an all-day event: it does not have
                            one, and formatting its UTC midnight in the viewer's
                            zone would print a misleading "21:00". */}
                        {event.isAllDay ? null : (
                          <span className="shrink-0 tabular-nums opacity-70">
                            {formatEventTime(event.startsAt)}
                          </span>
                        )}
                        <span className="truncate">
                          {event.title || strings.calendar.event.untitled}
                        </span>
                      </button>
                    );
                  })}

                  {dayEvents.length > MAX_CHIPS ? (
                    <button
                      type="button"
                      onClick={() => onOpenDay(day)}
                      className="px-1 text-left text-[10px] text-muted hover:text-foreground"
                    >
                      {`+${dayEvents.length - MAX_CHIPS} ${strings.calendar.more}`}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
