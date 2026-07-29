import type { LabelDto } from '@gloo/shared';

import { LABEL_BG_CLASS, LABEL_PILL } from '@/theme/labelColors';
import { strings } from '@/strings/pt-BR';

/** Beyond three, the pills crowd the row and push the title into a second line. */
const MAX_VISIBLE_LABELS = 3;

/**
 * A tag with its text taken away: a short rounded bar in the label's own colour.
 *
 * Enough to keep the colour coding — which is what you actually scan a list of
 * routines by — while giving the title back the room the words were using.
 */
const COLLAPSED_PILL = 'h-1.5 w-7 rounded-full';

/**
 * A routine's tags as they appear under its title.
 *
 * Clicking them folds the row down to bars and clicking again unfolds it. The
 * whole group is one button rather than one per tag: collapsing a single tag out
 * of three would leave a row that reads as broken rather than as tidied, and the
 * point of the gesture is to quieten the routine, not to hide a particular
 * label.
 *
 * The state is the list's, not this component's — folding one routine's tags
 * folds every routine's. Half a list of pills and half a list of bars is a worse
 * thing to read than either, and what the gesture is really for is switching the
 * whole list between scanning it by name and scanning it by colour.
 *
 * `pointer-events-auto` because the row it sits in is covered by a click target
 * that opens the routine — quietening the tags is not opening it.
 */
export function RoutineLabels({
  labels,
  isCollapsed,
  onToggle,
}: {
  labels: LabelDto[];
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  if (labels.length === 0) return null;

  return (
    <button
      type="button"
      aria-label={strings.routine.toggleLabels}
      aria-expanded={!isCollapsed}
      onClick={onToggle}
      className="pointer-events-auto relative flex w-fit cursor-pointer flex-wrap items-center gap-1"
    >
      {labels.slice(0, MAX_VISIBLE_LABELS).map((label) => (
        // Expanded, the same pill as inside the routine — one shared style, so a
        // label looks identical wherever it appears.
        <span
          key={label.id}
          className={`${isCollapsed ? COLLAPSED_PILL : LABEL_PILL} ${LABEL_BG_CLASS[label.color]}`}
        >
          {isCollapsed ? null : label.name}
        </span>
      ))}
    </button>
  );
}
