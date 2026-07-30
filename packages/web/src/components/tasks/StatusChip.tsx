import type { TaskStatus } from '@gloo/shared';

import { strings } from '@/strings/pt-BR';

/**
 * Each status keeps the hue of the Dashboard tile that means the same thing — A
 * fazer is blue like the "a fazer" tile, Em andamento yellow, Feita green — a
 * step lighter. See --status-* in globals.css for why the lighter tint rather
 * than the tile value itself: the sector donut is already using those, and the
 * same swatch cannot stand for a status and a sector on one page.
 *
 * Tailwind classes rather than HeroUI `color` values because this isn't one of
 * HeroUI's semantic slots. Black text on all four, which the lighter grounds
 * carry comfortably in either theme.
 */
const STATUS_CLASS: Record<TaskStatus, string> = {
  TODO: 'bg-status-todo text-black',
  IN_PROGRESS: 'bg-status-progress text-black',
  DONE: 'bg-status-done text-black',
};

const OVERDUE_CLASS = 'bg-status-overdue text-black';

/**
 * The pill itself: fully round, tight, and only as wide as its label.
 *
 * Its own geometry rather than the tags' PILL_SHAPE — the two have diverged, a
 * tag being a rounded rectangle with room to breathe and a status a small hard
 * capsule. `whitespace-nowrap` because a status is a single token: "Em
 * andamento" broken over two lines is not a label any more.
 *
 * `lowercase` in CSS rather than in the strings, because the same strings label
 * the filter pills and the dropdown, where sentence case is right.
 */
/**
 * `leading-none` is what makes the dot and the label read as centred together.
 *
 * Both are centred in the same box by `items-center`, so they cannot disagree —
 * but with the default line height that box is taller than the letters, carrying
 * ascender and descender room a word like "fazer" never uses, and its centre is
 * not the letters' centre. Collapsing the line height to the glyphs puts the two
 * within a hair of each other. `py-1` gives back the height that removes, so the
 * pill is the same size it was.
 */
const STATUS_PILL =
  'inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-1 text-xs leading-none whitespace-nowrap lowercase';

/**
 * The dot before the label, in the pill's own text colour at half strength.
 *
 * Derived rather than given a colour per status: it then follows the tile palette
 * through both themes for free, and reads as a darker shade of the pill it sits
 * on either way.
 */
const DOT = 'size-1.5 shrink-0 rounded-full bg-current opacity-50';

/**
 * A plain span rather than HeroUI's Chip: the Chip brought its own type scale
 * and its own padding, and inside a Select trigger it was stretched to the
 * trigger's `min-h-9` besides.
 *
 * The pill hugs its label, so widths differ between statuses. What lines a
 * column of them up is the fixed-width cell each sits in on the task row — see
 * STATUS_COLUMN in TaskCard.
 */
export function StatusChip({ status, isOverdue }: { status: TaskStatus; isOverdue?: boolean }) {
  const showOverdue = isOverdue && status !== 'DONE';
  const label = showOverdue ? strings.task.filters.overdue : strings.task.status[status];

  return (
    <span className={`${STATUS_PILL} ${showOverdue ? OVERDUE_CLASS : STATUS_CLASS[status]}`}>
      <span aria-hidden className={DOT} />
      {label}
    </span>
  );
}
