import { useEffect, useRef } from 'react';
import type { CalendarDate } from '@internationalized/date';

import type { AgendaDto, CalendarEventDto } from '@gloo/shared';

import { CALENDAR_LOCALE } from '@/lib/weekStart';
import { LABEL_BG_CLASS, LABEL_EDGE_CLASS } from '@/theme/labelColors';
import { strings } from '@/strings/pt-BR';

import { EventBlock } from './EventBlock';
import { layoutAllDay, layoutDay, type LayoutEvent } from './eventLayout';
import { HOUR_HEIGHT, MINUTES_PER_DAY } from './gridMetrics';
import type { DragPreview } from './useEventDrag';

/**
 * What the layout is given: the times it packs by, plus the event they came
 * from so the block can be rendered without looking it up again.
 */
interface GridEvent extends LayoutEvent {
  source: CalendarEventDto;
}

/** Where the grid scrolls to on arrival — early enough to see a 08:00 start. */
const INITIAL_SCROLL_HOUR = 7;

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function hourLabel(hour: number): string {
  return new Intl.DateTimeFormat(CALENDAR_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2026, 0, 1, hour)));
}

function weekdayLabel(day: CalendarDate): string {
  return new Intl.DateTimeFormat(CALENDAR_LOCALE, {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(day.toDate('UTC'));
}

/**
 * The current zone as an offset — "UTC+1" — for the corner above the hour
 * gutter, which is what tells the reader whose clock the grid is showing.
 */
function zoneLabel(): string {
  const minutes = -new Date().getTimezoneOffset();
  const sign = minutes < 0 ? '-' : '+';
  const hours = Math.abs(minutes) / 60;
  return `UTC${sign}${Number.isInteger(hours) ? hours : hours.toFixed(1)}`;
}

interface CalendarTimeGridProps {
  days: CalendarDate[];
  events: CalendarEventDto[];
  agendasById: Map<string, AgendaDto>;
  selectedEventId: string | null;
  onSelectEvent: (event: CalendarEventDto) => void;
  onEventPointerDown: (key: string, event: CalendarEventDto, pointer: React.PointerEvent) => void;
  onEventResizeStart: (key: string, event: CalendarEventDto, pointer: React.PointerEvent) => void;
  onPointerMove: (pointer: React.PointerEvent) => void;
  onPointerUp: (pointer: React.PointerEvent) => void;
  /** The block being dragged, at the times it would land on. */
  dragPreview: DragPreview | null;
  /** A click on empty grid, as the instant that slot represents. */
  onSlotClick: (start: Date) => void;
  todayIso: string;
}

/**
 * The week and day views — one component, because a day view is a week view
 * with one column and nothing else about it differs.
 *
 * A full 24 hours is always rendered and the container scrolls, rather than
 * cropping to working hours: an event at 06:00 or 22:00 is unusual but it is
 * not invisible, and a grid that silently omits part of the day is the kind of
 * thing nobody notices until something is missed.
 */
export function CalendarTimeGrid({
  days,
  events,
  agendasById,
  selectedEventId,
  onSelectEvent,
  onEventPointerDown,
  onEventResizeStart,
  onPointerMove,
  onPointerUp,
  dragPreview,
  onSlotClick,
  todayIso,
}: CalendarTimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // All-day events are floating dates, not spans of the clock, so they never
  // enter the timed grid — placed there they would either occupy all 24 hours
  // or, worse, land on the previous day once their UTC midnight was read as a
  // local one. They get their own strip above.
  const allDayEvents = events.filter((event) => event.isAllDay);
  const timedEvents = events.filter((event) => !event.isAllDay);

  // The dragged block is laid out at the times it would land on rather than the
  // ones it still has on the server, so it follows the pointer — including into
  // another day's column, which is a change of which cell it is packed into and
  // not something a CSS transform could express.
  const gridEvents: GridEvent[] = timedEvents.map((event) => {
    const key = instanceKey(event);
    const dragged = dragPreview?.key === key ? dragPreview : null;
    return {
      id: key,
      startsAt: dragged?.startsAt ?? event.startsAt,
      endsAt: dragged?.endsAt ?? event.endsAt,
      source: dragged ? { ...event, startsAt: dragged.startsAt, endsAt: dragged.endsAt } : event,
    };
  });

  const allDayStrip = layoutAllDay(
    allDayEvents.map((event) => ({
      id: instanceKey(event),
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      source: event,
    })),
    days.map((day) => day.toString()),
  );
  const allDayRows = allDayStrip.reduce((rows, entry) => Math.max(rows, entry.row + 1), 0);

  useEffect(() => {
    // Once, on arrival. Re-running on every page would fight the user's own
    // scrolling every time they moved a week.
    if (scrollRef.current) scrollRef.current.scrollTop = INITIAL_SCROLL_HOUR * HOUR_HEIGHT;
  }, []);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex border-b border-border pb-2">
        <span className="w-14 shrink-0 pr-2 text-right text-[11px] text-muted">{zoneLabel()}</span>
        {days.map((day) => {
          const isToday = day.toString() === todayIso;
          return (
            <div key={day.toString()} className="min-w-0 flex-1 px-1 text-center">
              <span
                className={`text-xs ${isToday ? 'font-semibold text-accent-soft-foreground' : 'text-muted'}`}
              >
                {/* first-letter:uppercase for the same reason the toolbar's
                    heading needs it: PT-BR weekday names are lowercase. */}
                <span className="capitalize">{weekdayLabel(day)}</span>{' '}
                <span className={isToday ? '' : 'text-foreground'}>{day.day}</span>
              </span>
            </div>
          );
        })}
      </div>

      {allDayStrip.length > 0 ? (
        <div className="flex border-b border-border py-1">
          <span className="w-14 shrink-0 pr-2 text-right text-[11px] text-muted">
            {strings.calendar.allDay}
          </span>
          {/* One grid over the day columns rather than a bar per column, so a
              multi-day event is a single bar that spans them. */}
          <div
            className="grid min-w-0 flex-1 gap-0.5"
            style={{
              gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${allDayRows}, minmax(0, auto))`,
            }}
          >
            {allDayStrip.map(({ event, columnStart, columnSpan, row }) => {
              const original = event.source;
              const color = agendasById.get(original.agendaId)?.color ?? 'gray';
              const key = instanceKey(original);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelectEvent(original)}
                  style={{
                    gridColumn: `${columnStart + 1} / span ${columnSpan}`,
                    gridRow: row + 1,
                  }}
                  className={`mx-0.5 truncate rounded-md border px-1.5 py-0.5 text-left text-[11px] text-black ${
                    LABEL_BG_CLASS[color]
                  } ${LABEL_EDGE_CLASS[color]} ${
                    selectedEventId === key
                      ? 'ring-2 ring-foreground ring-offset-1 ring-offset-surface'
                      : ''
                  }`}
                >
                  {original.title || strings.calendar.event.untitled}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* The move and release handlers live on the scroll container rather than
          on each block: once a drag starts the pointer is captured, but the
          events still bubble to here, and one pair of listeners is cheaper than
          a pair per block. */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="relative flex" style={{ height: MINUTES_PER_DAY * (HOUR_HEIGHT / 60) }}>
          <div className="w-14 shrink-0">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="relative pr-2 text-right"
                style={{ height: HOUR_HEIGHT }}
              >
                {/* Lifted half a line so the label reads as marking the rule
                    beside it rather than the band under it. Midnight has no
                    rule above it to mark. */}
                {hour === 0 ? null : (
                  <span className="absolute -top-2 right-2 text-[11px] text-muted">
                    {hourLabel(hour)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {days.map((day) => {
            // The grid draws in the viewer's own zone, so the day's boundaries
            // are local midnights — not the UTC ones a CalendarDate implies.
            const localDayStart = new Date(day.year, day.month - 1, day.day);
            const positioned = layoutDay(gridEvents, localDayStart);

            return (
              <div
                key={day.toString()}
                // Read at drag start to convert sideways travel into whole days.
                data-day-column
                className="relative min-w-0 flex-1 border-l border-border"
                onClick={(clickEvent) => {
                  // Only a click on the column itself, never one that bubbled
                  // up from a block sitting on it.
                  if (clickEvent.target !== clickEvent.currentTarget) return;
                  const bounds = clickEvent.currentTarget.getBoundingClientRect();
                  const minute =
                    ((clickEvent.clientY - bounds.top) / HOUR_HEIGHT) * 60;
                  const snapped = Math.floor(minute / 30) * 30;
                  onSlotClick(new Date(localDayStart.getTime() + snapped * 60_000));
                }}
                role="presentation"
              >
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="pointer-events-none border-b border-border/50"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}

                {positioned.map(({ event, column, columns, startMinute, endMinute }) => {
                  const minutes = endMinute - startMinute;
                  const original = event.source;

                  return (
                    <EventBlock
                      key={event.id}
                      event={original}
                      agenda={agendasById.get(original.agendaId)}
                      isSelected={selectedEventId === event.id}
                      minutes={minutes}
                      columns={columns}
                      onSelect={() => onSelectEvent(original)}
                      onResizeStart={
                        original.isReadOnly
                          ? undefined
                          : (pointer) => onEventResizeStart(event.id, original, pointer)
                      }
                      onPointerDown={
                        original.isReadOnly
                          ? undefined
                          : (pointer) => onEventPointerDown(event.id, original, pointer)
                      }
                      style={{
                        top: (startMinute / 60) * HOUR_HEIGHT,
                        // A floor so a 15-minute event is still readable, and
                        // -2 so consecutive blocks show a seam rather than
                        // meeting as one unbroken band of colour.
                        height: Math.max(18, (minutes / 60) * HOUR_HEIGHT - 2),
                        left: `calc(${(column / columns) * 100}% + 2px)`,
                        width: `calc(${(1 / columns) * 100}% - 4px)`,
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * A stable key for one occurrence.
 *
 * A generated occurrence shares its master's id with every other occurrence of
 * the series, so the id alone would collide across a week of a daily event —
 * React would reuse the wrong node and selecting one would light up several.
 * The slot is what makes it unique.
 */
export function instanceKey(event: CalendarEventDto): string {
  return event.originalStart ? `${event.id}|${event.originalStart}` : event.id;
}
