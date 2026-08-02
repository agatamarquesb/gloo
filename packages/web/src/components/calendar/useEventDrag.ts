import { useCallback, useRef, useState } from 'react';

import type { CalendarEventDto } from '@gloo/shared';

import { HOUR_HEIGHT } from './gridMetrics';

/** Everything snaps to this, which is also the shortest an event can be dragged to. */
const SNAP_MINUTES = 15;
/**
 * How far the pointer must travel before this counts as a drag rather than a
 * click. Without it, the few pixels a finger or a trackpad moves during an
 * ordinary press would turn every selection into a one-notch reschedule.
 */
const DRAG_THRESHOLD_PX = 4;

interface DragState {
  key: string;
  event: CalendarEventDto;
  mode: 'move' | 'resize';
  startClientX: number;
  startClientY: number;
  /** Measured once at drag start — a day column's width, for sideways moves. */
  columnWidth: number;
  originalStart: number;
  originalEnd: number;
  moved: boolean;
  /** The block, and the pointer on it — kept so capture can be taken later. */
  element: HTMLElement;
  pointerId: number;
}

export interface DragPreview {
  key: string;
  startsAt: string;
  endsAt: string;
}

function snap(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

/**
 * Shift an instant by whole days and minutes, in local wall-clock terms.
 *
 * Built through the Date constructor rather than by adding milliseconds: a drag
 * that crosses a clock change would otherwise move the event an hour as well as
 * a day, because a "day" is not always 86,400,000ms. This asks for the same
 * time on another date and lets the platform work out the instant.
 */
function shift(instant: number, days: number, minutes: number): number {
  const from = new Date(instant);
  return new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate() + days,
    from.getHours(),
    from.getMinutes() + minutes,
    0,
    0,
  ).getTime();
}

/**
 * Dragging an event to another time, and dragging its bottom edge to another
 * end time.
 *
 * Pointer events rather than the native HTML5 drag-and-drop the task lists use.
 * HTML5 DnD has no usable resize affordance, gives no position updates fine
 * enough to preview a 15-minute step, and drags a translucent ghost of the
 * element that cannot be restyled — all three matter on a time grid, none of
 * them matter when reordering a list.
 *
 * The preview is local state, so the block follows the pointer without a
 * request per pixel; the write happens once, on release.
 */
export function useEventDrag({
  onCommit,
}: {
  onCommit: (event: CalendarEventDto, startsAt: string, endsAt: string) => void;
}) {
  const dragRef = useRef<DragState | null>(null);
  const [preview, setPreview] = useState<DragPreview | null>(null);
  /**
   * Set on release after a real drag, and read by the click handler that fires
   * immediately afterwards — otherwise finishing a drag also re-selects the
   * event, and dropping one onto another day would open its details.
   */
  const suppressClickRef = useRef(false);

  const computeTimes = useCallback((drag: DragState, clientX: number, clientY: number) => {
    const deltaMinutes = snap(((clientY - drag.startClientY) / HOUR_HEIGHT) * 60);
    const deltaDays =
      drag.mode === 'move' && drag.columnWidth > 0
        ? Math.round((clientX - drag.startClientX) / drag.columnWidth)
        : 0;

    if (drag.mode === 'resize') {
      const end = Math.max(
        shift(drag.originalStart, 0, SNAP_MINUTES),
        shift(drag.originalEnd, 0, deltaMinutes),
      );
      return { startsAt: drag.originalStart, endsAt: end };
    }

    const start = shift(drag.originalStart, deltaDays, deltaMinutes);
    // Duration is preserved as elapsed time, so a two-hour meeting stays two
    // hours even when dropped across a clock change.
    return { startsAt: start, endsAt: start + (drag.originalEnd - drag.originalStart) };
  }, []);

  const begin = useCallback(
    (
      mode: 'move' | 'resize',
      key: string,
      event: CalendarEventDto,
      pointer: React.PointerEvent,
    ) => {
      // Clear any suppression left over from a previous drag before anything
      // else. The flag is meant to swallow exactly the click that follows its
      // own drag, but that click doesn't always arrive — a resize that starts
      // on the grip and ends over the block may not produce one — and a flag
      // left standing would then eat an unrelated click much later, making an
      // event look unselectable for no visible reason.
      suppressClickRef.current = false;

      // Only the primary button, and never on an event we may not write to.
      if (pointer.button !== 0 || event.isReadOnly) return;
      // A resize starts on the grip, which sits inside the block: without this
      // the move handler behind it would start too and the two would fight.
      pointer.stopPropagation();

      const column = (pointer.target as HTMLElement).closest<HTMLElement>('[data-day-column]');

      dragRef.current = {
        key,
        event,
        mode,
        startClientX: pointer.clientX,
        startClientY: pointer.clientY,
        columnWidth: column?.getBoundingClientRect().width ?? 0,
        originalStart: new Date(event.startsAt).getTime(),
        originalEnd: new Date(event.endsAt).getTime(),
        moved: false,
        element: pointer.currentTarget as HTMLElement,
        pointerId: pointer.pointerId,
      };

      // Capture is deliberately NOT taken here, only once the pointer has
      // actually moved (see handlePointerMove). A captured pointer retargets
      // the compatibility `click` to the capturing element, so capturing on
      // every press sent the click to the block's wrapper instead of the button
      // inside it — and selecting an event by clicking it stopped working
      // altogether the moment this hook was added.
    },
    [],
  );

  const handlePointerMove = useCallback(
    (pointer: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      if (
        !drag.moved &&
        Math.abs(pointer.clientX - drag.startClientX) < DRAG_THRESHOLD_PX &&
        Math.abs(pointer.clientY - drag.startClientY) < DRAG_THRESHOLD_PX
      ) {
        return;
      }

      if (!drag.moved) {
        drag.moved = true;
        // Now that this is genuinely a drag, take the pointer so it survives
        // leaving the block — which it does at once, the block being what
        // moves. Taking it only now is what leaves an ordinary click alone.
        drag.element.setPointerCapture(drag.pointerId);
      }

      const { startsAt, endsAt } = computeTimes(drag, pointer.clientX, pointer.clientY);
      setPreview({
        key: drag.key,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      });
    },
    [computeTimes],
  );

  const handlePointerUp = useCallback(
    (pointer: React.PointerEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      setPreview(null);
      if (!drag) return;

      if (!drag.moved) return;

      suppressClickRef.current = true;
      const { startsAt, endsAt } = computeTimes(drag, pointer.clientX, pointer.clientY);

      // Nothing actually changed — a drag that came back to where it started.
      if (startsAt === drag.originalStart && endsAt === drag.originalEnd) return;

      onCommit(drag.event, new Date(startsAt).toISOString(), new Date(endsAt).toISOString());
    },
    [computeTimes, onCommit],
  );

  /** True once, immediately after a drag, so the trailing click is ignored. */
  const consumeSuppressedClick = useCallback(() => {
    if (!suppressClickRef.current) return false;
    suppressClickRef.current = false;
    return true;
  }, []);

  return {
    preview,
    beginMove: (key: string, event: CalendarEventDto, pointer: React.PointerEvent) =>
      begin('move', key, event, pointer),
    beginResize: (key: string, event: CalendarEventDto, pointer: React.PointerEvent) =>
      begin('resize', key, event, pointer),
    handlePointerMove,
    handlePointerUp,
    consumeSuppressedClick,
    isDragging: preview !== null,
  };
}
