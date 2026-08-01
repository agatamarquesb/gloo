/**
 * The property list both entity modals open with — a routine's recurrence and
 * who it belongs to, a task's priority, deadline, sector, project, status and
 * responsible.
 *
 * Here rather than in either modal because the two have to be the same object
 * seen twice: a label with its icon on the left, a value with no field chrome on
 * the right, and the whole row switching between a control and a line of text
 * with the dialog's edit mode. Every rule below was tuned in the routine modal;
 * the task modal inherits it by construction instead of by copy.
 */

import { FLAT_SELECT_TRIGGER, NO_FIELD_BORDER, OPEN_FIELD_GROUND } from './fieldStyles';

export const PROPERTY_LIST = 'flex flex-col';

/**
 * A property row in the routine modal, which shares the action-pill row's three
 * columns: the label sits in the first, the value starts at the head of the
 * second. Values therefore begin on the middle pill's left edge — near their
 * labels rather than stranded against the far side of the dialog.
 */
export const PROPERTY_ROW_THIRDS = 'grid grid-cols-3 items-center gap-2';

/**
 * The same row in a dialog column that is already half a dialog wide — the task
 * modal's left column. Thirds there would leave a value like "marketing &
 * aquisição" in a 130px cell, so the label column is fixed at the width it
 * happens to have in the routine modal (a third of `sm:max-w-xl`) and the value
 * takes what is left. Both modals' labels therefore end on the same measure.
 */
export const PROPERTY_ROW_SPLIT = 'grid grid-cols-[11rem_minmax(0,1fr)] items-center gap-2';

/**
 * One height for every row, instead of each one taking the height of whatever it
 * happens to hold.
 *
 * A property list is read down the labels, and the labels only line up as a
 * column if the rows are a constant pitch — a status chip is taller than a line
 * of text, a progress bar shorter, and padding-driven rows let both of those
 * shift the rows below them. Fixed, not a minimum, so the list's total height is
 * knowable: the task modal pins its two columns to it so their closing rules
 * meet. See TOP_COLUMN_HEIGHT there.
 */
export const PROPERTY_ROW_HEIGHT = 'h-10';

/**
 * A row's own vertical padding, and so the gap between two of them: the header
 * group has no gap of its own and leans entirely on this. Tighter once locked —
 * a list you read wants to hold together, while the same rows as controls need
 * the room to be separately clickable.
 */
export const ROW_PADDING_EDIT = 'py-1';
export const ROW_PADDING_VIEW = 'py-0.5';

/**
 * The value side carries no chrome at all — no border, fill or shadow in any
 * state. It is a value you can change, not a form control.
 *
 * `w-full` makes the control span its whole grid column, so the chevron lands on
 * the column's right edge, while the value itself stays left-aligned at the
 * column's start. `pr-6` keeps a long value from running under the chevron.
 *
 * HeroUI insets the chevron 8px from the control's right edge, which would leave
 * it short of the column. Rather than fight that from outside the component, the
 * control is widened by exactly that inset so the chevron lands on the edge.
 */
export const BARE_TRIGGER = `${FLAT_SELECT_TRIGGER} ${NO_FIELD_BORDER} ${OPEN_FIELD_GROUND} w-[calc(100%+0.5rem)] items-center gap-1 pr-6 pl-0 text-left`;

/**
 * The trigger's height, which sets the row's. Locked it comes down to just clear
 * the assignee avatar (size-5), since nothing there has to be a comfortable
 * click target any more.
 */
export const TRIGGER_HEIGHT_EDIT = 'h-8';
export const TRIGGER_HEIGHT_VIEW = 'h-7';

/**
 * Outside edit mode the control stays in place but stops being one: no pointer
 * affordance, and none of HeroUI's dimming, since the value still has to read
 * as the entity's actual content rather than as a disabled field.
 */
export const VIEW_TRIGGER = 'cursor-default disabled:opacity-100 data-[disabled=true]:opacity-100';

/**
 * The same opt-out for the rest of a disabled Select.
 *
 * `isDisabled` is what stops a locked property from opening, but HeroUI dims
 * everything inside it — so the label and its icon faded out too, and the whole
 * column read a shade lighter locked than editing. The trigger already opted out
 * (above); these are its label and the Select's own root, which is where the
 * dimming can also sit. Marked important because the component sets it from its
 * own data attribute and would otherwise win on order.
 */
export const VIEW_UNDIMMED = 'opacity-100! data-[disabled=true]:opacity-100!';

/**
 * The value's grid column. A wrapper rather than putting the control straight in
 * the cell, because the control deliberately overhangs its column by the
 * chevron's inset and the column itself must not.
 */
export const VALUE_CELL = 'w-full';

/** Labels carry the icon, not the control — the value stays plain text. */
export const FIELD_LABEL = 'flex shrink-0 items-center gap-2 text-sm text-muted';

/**
 * The icons read at full text colour while their labels stay grey: at 16px a
 * muted glyph is mostly gone, and these are what you scan the column by.
 */
export const LABEL_ICON = 'size-4 shrink-0 text-foreground';

/**
 * A value with nothing in it — no deadline set, no project chosen. An em dash
 * rather than blank space, so the row still reads as a property that is empty
 * instead of as a rendering fault.
 */
export const EMPTY_VALUE = '—';

/** The four class names a row's parts take, given the dialog's mode. */
export function propertyStyles(
  isEditing: boolean,
  {
    row = PROPERTY_ROW_THIRDS,
    /**
     * A fixed row height, replacing the mode's own padding. The routine modal
     * leaves this off — its rows breathe differently locked and editing — while
     * the task modal pins them, see PROPERTY_ROW_HEIGHT.
     */
    height,
  }: { row?: string; height?: string } = {},
) {
  const undimmed = isEditing ? '' : VIEW_UNDIMMED;
  return {
    undimmed,
    row: `${row} ${height ?? (isEditing ? ROW_PADDING_EDIT : ROW_PADDING_VIEW)}`,
    label: `${FIELD_LABEL} ${undimmed}`,
    trigger: `${BARE_TRIGGER} ${
      isEditing ? TRIGGER_HEIGHT_EDIT : `${TRIGGER_HEIGHT_VIEW} ${VIEW_TRIGGER}`
    }`,
  };
}
