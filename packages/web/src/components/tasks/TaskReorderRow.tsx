import type { ReactNode } from 'react';

/**
 * The gap a dragged row opens where it will land — the height is measured off
 * the row being carried, so the space is exactly the size of the thing going
 * into it.
 */
const DROP_GAP = 'pointer-events-none rounded-2xl border border-dashed border-outline-green/60';

/**
 * One row of a list you can rearrange by dragging.
 *
 * The whole row is the handle: press it and drag. No grip to aim at, because the
 * row already has a click target covering it — a handle would be one more thing
 * to miss, and pressing anywhere is what the gesture is for.
 *
 * Shared by the Dashboard's "Minhas tarefas" and the Tasks page's list, which
 * rearrange the same kind of row with the same rules and would otherwise be two
 * copies of forty lines of drag handlers.
 */
export function TaskReorderRow({
  id,
  dragId,
  overId,
  dragHeight,
  /** Whether the space opens above this row or below it — see the callers. */
  insertAbove,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: {
  id: string;
  dragId: string | null;
  overId: string | null;
  dragHeight: number;
  insertAbove: boolean;
  onDragStart: (height: number) => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  /**
   * Dropped here, by the row whose id this is.
   *
   * The id comes off the drag's own payload rather than out of the caller's
   * state. It is the same fact either way — until the two disagree, which they
   * do for exactly as long as it takes React to render the `dragstart`: a drop
   * that arrives before that render reads a `dragId` still set to null and does
   * nothing at all. A real drag lasts far longer than a render, so this was only
   * ever reachable by a very fast flick — but the payload is already on the
   * event, is set at the moment the drag begins, and cannot be stale.
   */
  onDrop: (draggedId: string) => void;
  children: ReactNode;
}) {
  const showGap = overId === id && dragId !== null && dragId !== id;

  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        // Firefox starts no drag at all without payload on the event.
        event.dataTransfer.setData('text/plain', id);
        onDragStart(event.currentTarget.getBoundingClientRect().height);
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        if (!dragId || dragId === id) return;
        // preventDefault is what marks the row as a drop target; without it the
        // browser refuses the drop outright.
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        onDragOver();
      }}
      onDragLeave={onDragLeave}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(event.dataTransfer.getData('text/plain'));
      }}
      className={`relative rounded-2xl ${dragId === id ? 'opacity-40' : ''}`}
    >
      {/* Where it will land: a space the size of the row you are holding, opened
          on the edge it will land against, rather than a line drawn between two
          rows. You aim at the slot the task will occupy instead of at a mark
          standing for it.

          Both gaps live *inside* this row's own box, which is what keeps the
          drag steady: the wrapper grows, so the pointer stays over the same drop
          target while the space opens under it — a gap between the rows would
          move the target out from under the cursor and the two would fight. */}
      {showGap && insertAbove ? (
        <div aria-hidden className={`${DROP_GAP} mb-2`} style={{ height: dragHeight }} />
      ) : null}

      {children}

      {showGap && !insertAbove ? (
        <div aria-hidden className={`${DROP_GAP} mt-2`} style={{ height: dragHeight }} />
      ) : null}
    </div>
  );
}
