import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import type { CalendarDate } from '@internationalized/date';

import { CalendarItemKind, type AgendaDto, type CalendarEventDto } from '@gloo/shared';

import { useNow } from '@/hooks/ui/useNow';
import { CALENDAR_LOCALE } from '@/lib/weekStart';
import { colorEventBlock } from '@/theme/labelColors';
import { strings } from '@/strings/pt-BR';

import { EventBlock } from './EventBlock';
import { layoutAllDay, layoutDay, type LayoutEvent } from './eventLayout';
import { HOUR_HEIGHT, MINUTES_PER_DAY, blockHeight, initialScrollTop } from './gridMetrics';
import type { DragPreview } from './useEventDrag';

/**
 * What the layout is given: the times it packs by, plus the event they came
 * from so the block can be rendered without looking it up again.
 */
interface GridEvent extends LayoutEvent {
  source: CalendarEventDto;
}

/**
 * The bare strip of column kept clear beside every block, the step each
 * overlapping block is pushed in by, and the hairline between a block and the
 * next column.
 *
 * The strip is on the *right*: a block starts on its day's own edge, which is
 * where the eye looks for it and where the hour labels line up. It used to be on
 * the left, and a column of events all indented 10px read as a column aligned to
 * the wrong side.
 */
const GUTTER = 10;
const OVERLAP_STEP = 14;
const BLOCK_GAP = 2;
/** How far off its column's rule a block sits, so the two do not touch. */
const BLOCK_INSET = 1;

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
  /** Ticking a Google task off. Absent on a grid that shows none. */
  onToggleDone?: (event: CalendarEventDto, done: boolean) => void;
  onEventPointerDown: (key: string, event: CalendarEventDto, pointer: React.PointerEvent) => void;
  onEventResizeStart: (key: string, event: CalendarEventDto, pointer: React.PointerEvent) => void;
  /** Dragging an all-day item down onto an hour — see DragMode in useEventDrag. */
  onEventScheduleStart: (key: string, event: CalendarEventDto, pointer: React.PointerEvent) => void;
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
  onToggleDone,
  onEventPointerDown,
  onEventResizeStart,
  onEventScheduleStart,
  onPointerMove,
  onPointerUp,
  dragPreview,
  onSlotClick,
  todayIso,
}: CalendarTimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // The line across today's column, and which blocks are behind it. Both change
  // with the clock rather than with anything the user does — see useNow.
  const now = useNow();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayColumn = todayIso;

  // All-day events are floating dates, not spans of the clock, so they never
  // enter the timed grid — placed there they would either occupy all 24 hours
  // or, worse, land on the previous day once their UTC midnight was read as a
  // local one. They get their own strip above.
  //
  // Except while one is being dragged onto an hour: for the length of that drag
  // it is laid out as a timed block at the times it would land on, which is what
  // makes the ghost follow the pointer down into the grid. Nothing else is
  // needed for the preview — the mapping below already substitutes a dragged
  // block's times, and this only decides which of the two layouts it goes to.
  const scheduling = dragPreview?.mode === 'schedule' ? dragPreview.key : null;
  const allDayEvents = events.filter(
    (event) => event.isAllDay && instanceKey(event) !== scheduling,
  );
  const timedEvents = events.filter(
    (event) => !event.isAllDay || instanceKey(event) === scheduling,
  );

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
    // Once, on arrival, and on the hour it actually is — see initialScrollTop.
    // Re-running on every page would fight the user's own scrolling every time
    // they moved a week.
    if (scrollRef.current) scrollRef.current.scrollTop = initialScrollTop();
  }, []);

  return (
    // The move and release handlers sit on the whole grid rather than on the
    // scrolling hours: a drag that starts in the all-day strip captures the
    // pointer on an element *above* that scroller, and its events would never
    // have reached a listener inside it.
    <div
      className="flex min-h-0 flex-1 flex-col"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* `items-baseline`: the zone is 11px and the weekday names are 14px, and a
          row of mixed sizes aligned to its top edge sits the small one visibly
          higher than the line it belongs to. On the baseline the corner label
          reads as part of the same row as the days it heads. */}
      <div className="flex items-baseline border-b border-border pb-2">
        <span className="w-14 shrink-0 pr-2 text-right text-[11px] text-muted">{zoneLabel()}</span>
        {days.map((day) => {
          const isToday = day.toString() === todayIso;
          return (
            <div key={day.toString()} className="min-w-0 flex-1 px-1 text-center">
              {/* 14px: this row names the seven columns under it and is read
                  before any of them, so it carries the same size as the body
                  text rather than the 12px of a caption. */}
              {/* Today's column is named in the brand green — the deep step of
                  it, which is the one that can carry text on a light surface.
                  See --green-deep. */}
              <span
                className={`text-sm ${isToday ? 'font-semibold text-green-deep' : 'text-muted'}`}
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

              // A Google task is due on a *day*, so this strip — not the hour
              // grid — is where every one of them lands. It carries the same
              // round tick the timed blocks do, and for the same reason: the one
              // thing a task can do that an event cannot is be finished.
              const isTask = original.kind === CalendarItemKind.TASK;

              // Both the colour and the placement are inline styles, so they
              // have to be merged rather than written as two attributes: a
              // Google agenda's colour is a hex value and arrives as a `style`,
              // which — spread after a `style` of its own — replaced the grid
              // placement outright. Every bar in the strip then fell in source
              // order rather than on its day, which is what put a Thursday task
              // in Friday's column and made a three-day bar one cell wide.
              const paint = colorEventBlock(
                color,
                original.color,
                `flex min-w-0 items-center gap-1.5 rounded-[3px] border px-1.5 py-0.5 text-[11px] text-black ${
                  original.isReadOnly ? '' : 'cursor-grab active:cursor-grabbing'
                } ${selectedEventId === key ? 'ring-1 ring-inset ring-[var(--border)]' : ''}`,
              );

              return (
                <div
                  key={key}
                  className={paint.className}
                  style={{
                    ...paint.style,
                    gridColumn: `${columnStart + 1} / span ${columnSpan}`,
                    gridRow: row + 1,
                  }}
                  // Pressing and dragging it puts it on the clock. A task
                  // arrives from Google with a day and no hour — this strip is
                  // the only place it can be — so the gesture that gives it one
                  // has to start here.
                  onPointerDown={
                    original.isReadOnly
                      ? undefined
                      : (pointer) => onEventScheduleStart(key, original, pointer)
                  }
                >
                  {isTask ? (
                    <label className="relative flex size-3 shrink-0 cursor-pointer items-center justify-center rounded-full border border-current">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={original.isDone}
                        aria-label={original.title || strings.calendar.event.untitled}
                        onChange={(changed) => onToggleDone?.(original, changed.target.checked)}
                      />
                      {original.isDone ? <Check className="size-2" strokeWidth={3} /> : null}
                    </label>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => onSelectEvent(original)}
                    className={`min-w-0 flex-1 cursor-pointer truncate text-left ${
                      isTask && original.isDone ? 'line-through opacity-70' : ''
                    }`}
                  >
                    {original.title || strings.calendar.event.untitled}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Whatever is left of the card, with the rest of the day inside it.
          `flex-1` rather than a height in hours: the card ends where the window
          does, and a fixed sixteen hours made it taller than the screen — which
          turned the whole page into something you had to scroll before you could
          reach the agendas beside it. The wheel is left entirely alone here: over
          the grid it moves the hours, over the column beside it that column, and
          the page itself never moves because there is nothing to move. */}
      <div ref={scrollRef} className="gloo-thin-scroll min-h-0 flex-1 overflow-y-auto">
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
                // Read at drag start to convert sideways travel into whole days,
                // and read live by a scheduling drag, which asks the column
                // under the pointer what day it is.
                data-day-column
                data-day={day.toString()}
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

                {/* Now, on the only column it can be on. A hairline the full
                    width of the day with a dot on its left end — the dot is what
                    makes a 1px rule read as a marker rather than as one more of
                    the grid's own hour lines, which is why it sits on the edge
                    the hour labels are read from. 2px, so it still reads as one
                    line where it crosses a block of its own colour.

                    Above every block (z-40) and deaf to the pointer: it marks
                    the grid, it is not part of it, and an event that happens to
                    be running now must still be clickable through it. */}
                {day.toString() === todayColumn ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 z-40"
                    style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}
                  >
                    <span className="absolute top-1/2 -left-[3px] size-2 -translate-y-1/2 rounded-full bg-danger" />
                    <span className="block h-0.5 w-full bg-danger" />
                  </div>
                ) : null}

                {positioned.map(({ event, stacked, depth, startMinute, endMinute }) => {
                  const minutes = endMinute - startMinute;
                  const original = event.source;

                  return (
                    <EventBlock
                      key={event.id}
                      event={original}
                      agenda={agendasById.get(original.agendaId)}
                      isSelected={selectedEventId === event.id}
                      isOverlapping={depth > 0}
                      // Over and done with — measured on the end, so whatever is
                      // running right now keeps its colour until it finishes.
                      isPast={new Date(event.endsAt).getTime() <= now.getTime()}
                      onToggleDone={
                        original.kind === CalendarItemKind.TASK
                          ? (done) => onToggleDone?.(original, done)
                          : undefined
                      }
                      minutes={minutes}
                      stacked={stacked}
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
                        // See blockHeight — the block reads the same number to
                        // decide what will fit inside it.
                        height: blockHeight(minutes),
                        // Two insets, and they mean different things.
                        //
                        // GUTTER is the strip of bare column left clear at the
                        // *end* of every block: that strip is the day itself,
                        // and pressing it is how a new event is started at the
                        // hour under the pointer. At the 2px it used to be there
                        // was nowhere on a busy day to press that was not an
                        // event.
                        //
                        // The depth step is how far this block is laid over the
                        // ones it overlaps — see PositionedEvent — and the
                        // z-index is what puts it on top of them. It is measured
                        // from the left, so what stays visible of a block
                        // underneath is its own left-hand edge.
                        //
                        // Full width from that step to the gutter, whatever else
                        // is running: nothing here splits a column any more, so
                        // three things at nine o'clock are three readable blocks
                        // in a cascade rather than three slivers side by side.
                        zIndex: depth + 1,
                        left: `${BLOCK_INSET + depth * OVERLAP_STEP}px`,
                        width: `calc(100% - ${
                          BLOCK_INSET + depth * OVERLAP_STEP + GUTTER + BLOCK_GAP
                        }px)`,
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
