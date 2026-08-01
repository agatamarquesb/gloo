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
 * HeroUI's semantic slots. The label is the fill's own hue taken down until it
 * carries — see --status-*-text — so the word is the colour it means, and the
 * dot with it.
 */
const OVERDUE_CLASS = 'bg-status-overdue text-status-overdue-text';

const STATUS_CLASS: Record<TaskStatus, string> = {
  TODO: 'bg-status-todo text-status-todo-text',
  IN_PROGRESS: 'bg-status-progress text-status-progress-text',
  DONE: 'bg-status-done text-status-done-text',
  // The status somebody set and the lateness a passed due date implies are one
  // thing to the reader, so they wear one colour.
  OVERDUE: OVERDUE_CLASS,
};

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
 * `leading-none` collapses the label's line box to its own type size, and `py-1`
 * gives back the height that removes so the pill measures the same.
 */
export const STATUS_PILL =
  'inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-1 text-xs leading-none whitespace-nowrap lowercase';

/**
 * How tall that comes to: `py-1` twice over the 12px of `text-xs`, which
 * `leading-none` holds to its own type size.
 *
 * A number rather than a class because TaskStatusChipSelect has to position a
 * panel against it in pixels — see the offsets there, which lay the dropdown's
 * own copy of the chip exactly over this one.
 */
export const STATUS_PILL_HEIGHT = 20;

/**
 * The dot before the label, in the pill's own text colour at half strength.
 *
 * Derived rather than given a colour per status: it then follows the tile palette
 * through both themes for free, and reads as a darker shade of the pill it sits
 * on either way.
 */
export const DOT = 'size-1.5 shrink-0 rounded-full bg-current opacity-50';

/**
 * The optical nudge that puts the label on the dot's own centre line.
 *
 * `items-center` centres the two boxes, which is not the same as centring what
 * you see: a font's ascent is taller than its descent, so the letters sit low in
 * their line box by roughly the difference — about a pixel here, which is
 * exactly the drop that made the dot look like it was floating above the word.
 * Expressed in `em` so it holds if the pill is ever set at another size.
 */
export const LABEL_OPTICAL_LIFT = '-translate-y-[0.08em]';

/**
 * The **botão de status** — the app's one name for this design, wherever it
 * appears: a task row, the task modal, the dropdown that changes a status. A
 * small capsule in the status colour, a dot, and the status in lower case.
 *
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
      <span className={LABEL_OPTICAL_LIFT}>{label}</span>
    </span>
  );
}
