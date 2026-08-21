import { Columns3, LayoutList } from 'lucide-react';

import { outlineControl } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

/**
 * How the Tasks page draws its list.
 *
 * In the URL, so a board is a link you can send someone and the view survives a
 * reload — the same reason every filter on that page lives there.
 */
export const TaskView = {
  LIST: 'LIST',
  KANBAN: 'KANBAN',
} as const;
export type TaskView = (typeof TaskView)[keyof typeof TaskView];

export function isTaskView(value: unknown): value is TaskView {
  return value === TaskView.LIST || value === TaskView.KANBAN;
}

/**
 * How tall the capsule is drawn.
 *
 * Published rather than kept to itself because it is one of five controls on the
 * Tasks page's filter row that all have to be the same height, and the number is
 * agreed there — see CONTROL_HEIGHT in TaskFiltersBar.
 */
export const VIEW_TOGGLE_HEIGHT = 'h-9';

/**
 * The two views, and the glyph each is asked for by.
 *
 * Both are the same boxed drawing — a frame with the shape of the view inside
 * it — so the pair reads as two settings of one control rather than as two
 * unrelated icons: a heading with lines beside it for the list, three standing
 * columns for the board. Read at 16px in a capsule beside two labelled buttons,
 * these two carry further than the pair before them, whose rules and bars were
 * near enough the same drawing to need reading twice.
 */
const VIEWS = [
  { value: TaskView.LIST, label: strings.tasksPage.view.list, Icon: LayoutList },
  { value: TaskView.KANBAN, label: strings.tasksPage.view.kanban, Icon: Columns3 },
] as const;

/**
 * The switch between the list and the board.
 *
 * One outlined capsule holding both glyphs, rather than two buttons: they are
 * the two settings of a single control, and a segmented shape is what says so.
 * The fill goes on the *selected glyph* and not on the capsule — the capsule is
 * the control, the disc inside it is the answer, and filling the whole pill
 * would have said "this control is on" instead of "the list is the one you are
 * looking at".
 *
 * The same outline and the same height as everything else on its row — see
 * VIEW_TOGGLE_HEIGHT — so the line reads as one set of controls rather than as
 * a tall thing next to short ones. The padding is 2px rather than 4 so the two
 * discs inside can be 28px at that height: the fill on the selected one is the
 * only thing on the row saying which view you are on, and it has to be big
 * enough to be that.
 */
export function TaskViewToggle({
  value,
  onChange,
}: {
  value: TaskView;
  onChange: (value: TaskView) => void;
}) {
  return (
    // A fieldset rather than a div with role="group": the two buttons are one
    // control with two settings, which is what a fieldset says natively — and
    // saying it in markup rather than in an ARIA attribute is the rule
    // everywhere else in the app. `min-w-0` because a fieldset carries a default
    // min-width of its own that stops it shrinking in a flex row.
    <fieldset
      aria-label={strings.tasksPage.view.label}
      className={`flex ${VIEW_TOGGLE_HEIGHT} min-w-0 shrink-0 items-center gap-0.5 rounded-full border p-0.5 ${outlineControl}`}
    >
      {VIEWS.map(({ value: view, label, Icon }) => {
        const isActive = view === value;

        return (
          <button
            key={view}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={isActive}
            onClick={() => onChange(view)}
            className={`flex size-7 cursor-pointer items-center justify-center rounded-full transition-colors ${
              isActive
                ? 'bg-green text-black'
                : 'text-muted hover:text-surface-foreground'
            }`}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        );
      })}
    </fieldset>
  );
}
