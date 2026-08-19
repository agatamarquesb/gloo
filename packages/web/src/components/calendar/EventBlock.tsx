import { Check } from 'lucide-react';

import { CalendarItemKind, type AgendaDto, type CalendarEventDto } from '@gloo/shared';

import { AssigneeAvatars } from '@/components/tasks/AssigneeAvatars';
import { CALENDAR_LOCALE } from '@/lib/weekStart';

import { blockHeight } from './gridMetrics';
import { colorBlock } from '@/theme/labelColors';
import { strings } from '@/strings/pt-BR';

/** Below this many minutes there is only room for the title. */
const COMPACT_MINUTES = 45;
/** And below this, not even that fits on its own line. */
const TINY_MINUTES = 25;
/**
 * From this many lanes, a column is too narrow for avatars whatever its height
 * — they are a fixed width, so they spill sideways where text merely truncates.
 */
const CROWDED_COLUMNS = 3;

/**
 * What each line of a block costs, in the size it is drawn at: the title at
 * 11px, the times at 10px, both `leading-tight`, and a row of 32px faces with
 * the 4px above it.
 *
 * Measured in pixels rather than guessed at in minutes, because that is the unit
 * the answer is in: whether a second line of title fits is a question about the
 * height of the box, and a minutes threshold is only ever a proxy for it — one
 * that was silently wrong the moment an hour stopped being 64px.
 */
const TITLE_LINE = 14;
const TIME_LINE = 12;
const AVATAR_ROW = 36;
/** `py-1`, top and bottom. A tiny block carries `py-0` and gives this back. */
const VERTICAL_PADDING = 8;

/**
 * An instant as a clock time, in the *viewer's* zone.
 *
 * Deliberately not the event's own `timeZone`. That field records the zone the
 * event was authored in, which is what keeps a 09:00 series at 09:00 across a
 * clock change — it is not how the event should be read. The grid positions
 * every block by local midnight, so a label in any other zone would disagree
 * with where the block actually sits: an event drawn at 06:00 captioned
 * "10:00". Google does the same thing, showing everything in the zone you are
 * currently in.
 */
export function formatEventTime(iso: string): string {
  return new Intl.DateTimeFormat(CALENDAR_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/**
 * An event as it appears on the grid: a pastel card in its agenda's colour,
 * edged a step darker so two adjacent events in the same agenda stay two.
 *
 * The content thins out as the block gets shorter rather than overflowing — a
 * fifteen-minute event has room for a title and nothing else, and a row of
 * clipped avatars bleeding past the bottom edge reads as a rendering fault.
 */
export function EventBlock({
  event,
  agenda,
  isSelected,
  onToggleDone,
  isTogglePending = false,
  onSelect,
  minutes,
  columns,
  onResizeStart,
  onPointerDown,
  isOverlapping = false,
  isPast = false,
  style,
}: {
  event: CalendarEventDto;
  agenda: AgendaDto | undefined;
  isSelected: boolean;
  /** Ticking a task off — only ever passed for one, and only when it may be. */
  onToggleDone?: (done: boolean) => void;
  isTogglePending?: boolean;
  onSelect: () => void;
  /** How tall the block is, in minutes — what decides how much fits. */
  minutes: number;
  /** How many lanes its cluster needs — what decides how narrow it is. */
  columns: number;
  /**
   * True when this block is laid over one that was already running — see
   * PositionedEvent. It is what earns the block its outline, which is the only
   * thing separating two brown cards of the same agenda where they overlap.
   */
  isOverlapping?: boolean;
  /**
   * The event is over — the clock has passed its *end*, not its start. Something
   * running now is still happening, however far into it you are, and dimming it
   * at its own halfway mark would take the colour off the one block on the grid
   * that matters most.
   */
  isPast?: boolean;
  /** Absent on a read-only event, which has no resize handle. */
  onResizeStart?: (pointer: React.PointerEvent) => void;
  /** Begins a move drag. Absent on a read-only event. */
  onPointerDown?: (pointer: React.PointerEvent) => void;
  style: React.CSSProperties;
}) {
  // An agenda we can't resolve means the event arrived before the account list
  // did. Grey is the neutral fallback rather than a missing background.
  const color = agenda?.color ?? 'gray';
  const paint = colorBlock(color);
  const isTask = event.kind === CalendarItemKind.TASK;
  const isTiny = minutes < TINY_MINUTES;
  const isCompact = minutes < COMPACT_MINUTES;

  /**
   * What the block has room for, worked out from its own height downwards.
   *
   * The title wraps onto a second line only when a second line actually fits.
   * It used to wrap whenever the block was over 25 minutes, which cut the
   * second line in half through the letters — a title clipped mid-word reads as
   * broken, where one ending in an ellipsis reads as shortened. So: two lines
   * when they fit, otherwise one line and the ellipsis.
   *
   * The faces come last and are the first thing dropped, for the same reason:
   * half a row of heads along the bottom edge of a block is a rendering fault,
   * and the two lines above them are what the block is for.
   */
  const room = blockHeight(minutes) - (isTiny ? 0 : VERTICAL_PADDING) - (isCompact ? 0 : TIME_LINE);
  const titleLines = room >= TITLE_LINE * 2 ? 2 : 1;
  const hasAvatars =
    event.assignees.length > 0 &&
    columns < CROWDED_COLUMNS &&
    room - titleLines * TITLE_LINE >= AVATAR_ROW;

  return (
    <div
      onPointerDown={onPointerDown}
      // `@container`: the block sizes what is inside it. A lane in a week column
      // is anything from 90px down to 30px depending on how many events are
      // running at once, and the only thing that knows which is the block
      // itself — hence the container queries on the time below rather than a
      // guess made from the lane count.
      className={`${paint.className} group/event @container absolute flex flex-col overflow-hidden rounded-[2px] border px-2 text-black ${
        isTiny ? 'py-0' : 'py-1'
      } ${
        // Too short to stack a title and anything under it: what there is room
        // for goes in the middle, rather than sitting on the top edge with the
        // rest of the block empty below it.
        isCompact ? 'justify-center' : ''
      } ${
        // Done with. Dimmed rather than greyed, so the agenda's colour is still
        // legible — the past is still what the day was made of.
        isPast ? 'opacity-55' : ''
      } ${
        // The selected event is marked with an edge rather than a different
        // fill: the fill is the agenda's identity and must not double as state.
        //
        // A light grey, the same hairline every rule in the app is drawn in, and
        // the same one pixel the overlap outline below uses — the two marks are
        // the same weight so a selected block does not also read as a thicker
        // one. Drawn *inside* the block (`ring-inset`) so it is not cropped by
        // the column and does not push the block off its own left edge.
        isSelected ? 'ring-1 ring-inset ring-[var(--border)]' : ''
      } ${
        // A hairline of the card's own ground around a block that sits on top of
        // another, so the two read as two. Drawn outside the block rather than
        // in — an inset line would eat a pixel of a fifteen-minute event — and
        // as a shadow, so it costs no layout and cannot move anything.
        isOverlapping ? 'shadow-[0_0_0_1px_var(--surface)]' : ''
      }`}
      // The block's position and its colour are both inline — the first because
      // it is computed per event, the second because a colour the user mixed has
      // no class to carry it. See colorBlock.
      style={{ ...style, ...paint.style }}
    >
      {/* The click target is stretched behind the content rather than wrapped
          around it — the same reason a routine row does it (see
          routineRowTarget): the block holds a resize grip and a row of avatars,
          neither of which is valid inside a button. */}
      <button
        type="button"
        aria-pressed={isSelected}
        onClick={onSelect}
        className={`absolute inset-0 z-0 ${
          event.isReadOnly ? 'cursor-default' : 'cursor-pointer'
        }`}
      >
        <span className="sr-only">{event.title || strings.calendar.event.untitled}</span>
      </button>

      <div className="pointer-events-none relative z-10">
        {/* 11px: a day column is around 90px wide, and this is the size at which
            a two-word title fits a line of it. */}
        <p
          className={`flex gap-1.5 text-[11px] leading-tight font-medium ${
            isTiny ? 'items-center' : 'items-start'
          }`}
        >
          {/* A Google task carries its own tick, right where the title starts —
              a round box rather than the app's square one, which is how Google
              draws a task and how a reader tells one from an event at a glance.
              It is the one control on a block that is not the block itself, so
              it opts back into pointer events over the target behind it. */}
          {isTask ? (
            <label className="pointer-events-auto relative flex size-3.5 shrink-0 cursor-pointer items-center justify-center rounded-full border border-current">
              <input
                type="checkbox"
                className="sr-only"
                checked={event.isDone}
                disabled={isTogglePending}
                aria-label={event.title || strings.calendar.event.untitled}
                onClick={(pressed) => pressed.stopPropagation()}
                onChange={(changed) => onToggleDone?.(changed.target.checked)}
              />
              {event.isDone ? <Check className="size-2.5" strokeWidth={3} /> : null}
            </label>
          ) : null}
          {/* Two lines before anything is given up, rather than one line and an
              ellipsis: "conteúdo | ins…" on a card half a finger wide told the
              reader nothing, and the second line was empty space directly under
              it. Only where the second line has nowhere to go — see `room`
              above — does the title truncate instead. */}
          <span
            className={`min-w-0 ${titleLines === 2 ? 'line-clamp-2 break-words' : 'truncate'} ${
              isTask && event.isDone ? 'line-through opacity-70' : ''
            }`}
          >
            {event.title || strings.calendar.event.untitled}
          </span>
        </p>

        {/* The times, directly under the title they belong to and written as
            wide as the block can take them.

            Three states, decided by the block's own width rather than by how
            many lanes its cluster needed: the pair with spaces round the dash,
            the start alone, and — narrower than a single timestamp — nothing at
            all. A time cut in half reads as a broken value rather than a
            shortened one, which is why the parts disappear whole.

            The breakpoints are content-box widths, which is what a container
            query measures: the block's own 8px of padding either side is already
            out of them. The pair measures 67px at this size; 68px is the first width
            that holds it.

            10px and tabular figures, so the digits don't jitter between blocks
            and the line stays a step quieter than the name above it. */}
        {isCompact ? null : (
          <p className="hidden text-[10px] leading-tight tabular-nums opacity-70 @min-[2.25rem]:block">
            <span className="whitespace-nowrap">{formatEventTime(event.startsAt)}</span>
            <span className="hidden whitespace-nowrap @min-[4.25rem]:inline">
              {' – '}
              {formatEventTime(event.endsAt)}
            </span>
          </p>
        )}

        {hasAvatars ? (
          <div className="mt-1">
            <AssigneeAvatars assignees={event.assignees} />
          </div>
        ) : null}
      </div>

      {/* The resize grip: the bottom few pixels of the block, invisible until
          the pointer is over the event. Nothing is drawn for it beyond the
          cursor change — a visible handle on every block would be a row of
          furniture across the grid. */}
      {onResizeStart ? (
        <span
          role="presentation"
          onPointerDown={onResizeStart}
          className="absolute inset-x-0 bottom-0 z-20 h-1.5 cursor-ns-resize"
        />
      ) : null}
    </div>
  );
}
