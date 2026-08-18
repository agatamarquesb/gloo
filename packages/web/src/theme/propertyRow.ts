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
 * aquisição" in a 130px cell, so the label column is fixed and the value takes
 * what is left.
 *
 * 7.5rem is the longest label ("Responsável") plus its icon and no more — 107px
 * of content in a 120px column. Values now wrap rather than truncate, and every
 * pixel this column does not need is a pixel that goes to the value beside it:
 * the deadline's calendar and the sector's list are both as wide as the trigger
 * they drop from, so the label column is the one place their width comes from.
 */
export const PROPERTY_ROW_SPLIT = 'grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-2';

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
 * Spacing instead of a height, for a list whose values may wrap.
 *
 * A row that could not grow had to cut what it held; one with a fixed floor put
 * its label 6px above the first line of a value that had come down onto two. So
 * the task modal's rows take their height from their content and this is the air
 * around it — the same above and below, so the pitch stays even whether a row
 * holds one line or three. See `fluid`.
 */
export const PROPERTY_ROW_PITCH = 'py-1.5';

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
export const BARE_TRIGGER = `${FLAT_SELECT_TRIGGER} ${NO_FIELD_BORDER} ${OPEN_FIELD_GROUND} aria-expanded:w-[calc(100%+1rem)] w-[calc(100%+0.5rem)] items-center gap-1 pr-6 pl-0 text-left`;

/**
 * The same trigger with no chevron on it — the task modal's, where the pointer
 * is what says a value can be changed.
 *
 * Two things follow from dropping the glyph. The row keeps its own width instead
 * of overhanging the column by the chevron's inset, since there is no longer a
 * chevron to line up on that edge; and the 24px it reserved on the right goes
 * back to the value, which is what a long sector name needed.
 *
 * `cursor-pointer` only where it can actually be pressed: locked, the value is
 * text, and a hand over text promises something the dialog will not do.
 *
 * `p-0` rather than only `px-0`: a Select trigger brings 8px of block padding
 * with it, so the two rows that hold a pill stood 16px taller than the four that
 * hold text and the column lost the even pitch it is read by.
 *
 * The `aria-expanded` rules are the ground it grows while open, and they only
 * touch its height: 6px of air above and below the value, so the band reads as a
 * field the list belongs to rather than as a strip the height of the text. The
 * `-mt-1.5 pt-1.5` pair is the vertical twin of OPEN_FIELD_GROUND's `-ml-2 pl-2`
 * — the margin grows the fill upwards and the padding gives that space back to
 * the text, so the band gets its height and the value does not move as the list
 * opens.
 *
 * The width deliberately does *not* change with it. Every trigger and every
 * panel in the task modal's property column is one width — see PROPERTY_PANEL
 * there — and the band is `w-full` in both states, sliding 8px left with the
 * ground rather than growing by it. So the band and the panel under it are the
 * same box seen twice, whichever property opened them.
 */
export const BARE_TRIGGER_NO_INDICATOR = `${FLAT_SELECT_TRIGGER} ${NO_FIELD_BORDER} ${OPEN_FIELD_GROUND} aria-expanded:-mt-1.5 aria-expanded:pt-1.5 aria-expanded:pb-1.5 w-full gap-1 p-0 text-left`;

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

/**
 * Labels carry the icon, not the control — the value stays plain text.
 *
 * `font-medium` explicitly: half these rows are a HeroUI `Label` (the ones
 * inside a Select) and half a plain span, and the component brings that weight
 * with it — so Deadline, Projeto and Status read a shade lighter than
 * Prioridade, Setor and Responsável in the same column. Stated here, all six are
 * the same word.
 */
export const FIELD_LABEL = 'flex shrink-0 items-center gap-2 text-sm font-medium text-muted';

/**
 * The icon takes its label's own grey — the two are one thing, a name with a
 * picture of itself in front of it, and drawing the picture in full ink made a
 * column of six glyphs the loudest thing in a dialog whose content is beside
 * them. `text-current` rather than the token, so anything that recolours a row
 * carries its icon with it.
 */
export const LABEL_ICON = 'size-4 shrink-0 text-current';

/**
 * A property's value.
 *
 * `font-medium` — the same step up the subtasks and the attachment titles take.
 * The labels are medium too, so what tells a value from its label is the colour,
 * not the weight: grey asks, --value-ink replies. Not the page's full ink: a
 * column of answers in black reads as a column of headings under a title that is
 * also black.
 *
 * Here rather than in either dialog because the two were keeping identical
 * copies with a comment on each saying so.
 */
export const PROPERTY_VALUE = 'text-sm font-medium text-value-ink';

/**
 * The same value for content that comes out of the database — a sector, a
 * project. Lower case so the column reads as one voice rather than as a chip
 * among sentences, and the first letter back up so it reads as a word rather
 * than as a fragment. Both in CSS: the name belongs to whoever typed it, and
 * neither rule should reach the data.
 */
export const PROPERTY_VALUE_LOWER = `${PROPERTY_VALUE} lowercase first-letter:uppercase`;

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
    /**
     * Whether the value keeps its chevron. The task modal's do not — see
     * BARE_TRIGGER_NO_INDICATOR — and the caller that turns this off is also the
     * one that must not render a `Select.Indicator`.
     */
    indicator = true,
    /**
     * Whether a value that does not fit may wrap and take its row with it. The
     * control's height becomes a minimum rather than a fixed one, so two lines
     * make a taller row instead of a clipped one.
     */
    fluid = false,
  }: { row?: string; height?: string; indicator?: boolean; fluid?: boolean } = {},
) {
  const undimmed = isEditing ? '' : VIEW_UNDIMMED;
  const base = indicator
    ? BARE_TRIGGER
    : `${BARE_TRIGGER_NO_INDICATOR} ${isEditing ? 'cursor-pointer' : ''}`;
  // Fluid, the control has no height of its own and sits at the top of its row:
  // a value on two lines must start where its label does, and anything centred
  // in a taller box starts lower than the label beside it.
  // `min-h-0` and not merely "no height": a HeroUI Select trigger carries a 36px
  // minimum of its own, so the two rows that hold a pill stood 16px taller than
  // the four that hold text and the column lost its rhythm.
  const align = fluid ? 'min-h-0 items-start' : 'items-center';
  const editHeight = fluid ? align : `${align} ${TRIGGER_HEIGHT_EDIT}`;
  const viewHeight = fluid ? align : `${align} ${TRIGGER_HEIGHT_VIEW}`;
  return {
    undimmed,
    row: `${row} ${height ?? (isEditing ? ROW_PADDING_EDIT : ROW_PADDING_VIEW)}`,
    label: `${FIELD_LABEL} ${undimmed}`,
    trigger: `${base} ${isEditing ? editHeight : `${viewHeight} ${VIEW_TRIGGER}`}`,
  };
}
