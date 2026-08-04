import { Clock } from 'lucide-react';

import type { AgendaDto, CalendarEventDto } from '@gloo/shared';

import { AssigneeAvatars } from '@/components/tasks/AssigneeAvatars';
import { CALENDAR_LOCALE } from '@/lib/weekStart';
import { colorBlock } from '@/theme/labelColors';
import { strings } from '@/strings/pt-BR';

/** Below this many minutes there is only room for the title. */
const COMPACT_MINUTES = 45;
/** And below this, not even that fits on its own line. */
const TINY_MINUTES = 25;
/** Avatars need a block this tall before they stop crowding the times. */
const AVATAR_MINUTES = 75;
/**
 * From this many lanes, a column is too narrow for avatars whatever its height
 * — they are a fixed width, so they spill sideways where text merely truncates.
 */
const CROWDED_COLUMNS = 3;

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
  onSelect,
  minutes,
  columns,
  onResizeStart,
  onPointerDown,
  style,
}: {
  event: CalendarEventDto;
  agenda: AgendaDto | undefined;
  isSelected: boolean;
  onSelect: () => void;
  /** How tall the block is, in minutes — what decides how much fits. */
  minutes: number;
  /** How many lanes its cluster needs — what decides how narrow it is. */
  columns: number;
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
  const isTiny = minutes < TINY_MINUTES;
  const isCompact = minutes < COMPACT_MINUTES;

  return (
    <div
      onPointerDown={onPointerDown}
      className={`${paint.className} group/event absolute overflow-hidden rounded-xl border px-2 text-black ${
        isTiny ? 'py-0' : 'py-1'
      } ${
        // The selected event is marked with a ring rather than a different
        // fill: the fill is the agenda's identity and must not double as state.
        isSelected ? 'ring-2 ring-foreground ring-offset-1 ring-offset-surface' : ''
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
        className={`absolute inset-0 z-0 rounded-xl ${
          event.isReadOnly ? 'cursor-default' : 'cursor-pointer'
        }`}
      >
        <span className="sr-only">{event.title || strings.calendar.event.untitled}</span>
      </button>

      <div className="pointer-events-none relative z-10">
        <p className={`truncate font-medium ${isTiny ? 'text-[11px] leading-tight' : 'text-xs'}`}>
          {event.title || strings.calendar.event.untitled}
        </p>

        {/* The time line is tight on purpose: a day column is around 90px, and
            at 11px with spaces around the dash "07:00 – 09:00" overflows and
            truncates mid-timestamp, which reads as a broken value rather than a
            shortened one. Smaller type, a hair-gap after the icon, no spaces
            round the dash, and tabular figures so the digits don't jitter
            between blocks. */}
        {isCompact ? null : (
          <p className="mt-0.5 flex items-center gap-0.5 truncate text-[10px] tabular-nums opacity-70">
            <Clock className="size-2.5 shrink-0" />
            {formatEventTime(event.startsAt)}–{formatEventTime(event.endsAt)}
          </p>
        )}

        {minutes >= AVATAR_MINUTES && columns < CROWDED_COLUMNS && event.assignees.length > 0 ? (
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
