/**
 * Whether the Routines card's tag rows are folded down to bars — see
 * RoutineLabels, which is where the gesture lives and why it is one flag for the
 * whole list rather than one per routine.
 *
 * Kept in `localStorage`, like the task order on the card beside it and for the
 * same reason: it is one person's way of reading a shared list — whether they
 * are scanning it by name or by colour — not a fact about any routine, and the
 * server has no column for it. Without this the card came back unfolded on every
 * refresh, undoing the choice each time the page reloaded.
 */
const COLLAPSED_KEY = 'gloo-routine-labels-collapsed';

export function readLabelsCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  } catch {
    // Private mode, a blocked origin — unfolded is the state the card starts in.
    return false;
  }
}

export function writeLabelsCollapsed(isCollapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, String(isCollapsed));
  } catch {
    // A full quota — how the tags are read is a convenience, not the data.
  }
}
