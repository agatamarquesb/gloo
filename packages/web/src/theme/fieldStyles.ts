/**
 * HeroUI fields paint themselves from CSS custom properties, so re-pointing
 * those is the supported way to restyle one — never `!important` over its
 * classes.
 *
 * Two things are easy to get wrong here, and both cost a round trip to find:
 * the fill is partly an inset shadow (`--field-shadow`), so clearing only the
 * background leaves a visible rounded rectangle; and each component layers its
 * own background variable over the shared `--field-*` set (`--input-bg`,
 * `--textarea-bg`, each with `-hover` and `-focus`), so a field that looks flat
 * at rest can still light up under the cursor.
 */

/**
 * The base of every flat field. Note the three separate background variables:
 * rest is `--field-background`, but hover and focus are `--field-hover` and
 * `--field-focus` — *not* `-hover`/`-focus` suffixes on the first one, which is
 * the natural guess and leaves the field greying under the cursor.
 */
const FLAT_FIELD =
  '[--field-background:transparent] [--field-hover:transparent] [--field-focus:transparent] [--field-shadow:none]';

/** Flattens an Input in every state — rest, hover and focus. */
export const FLAT_INPUT = `${FLAT_FIELD} [--input-bg:transparent] [--input-bg-hover:transparent] [--input-bg-focus:transparent]`;

/** Flattens a TextArea in every state. */
export const FLAT_TEXTAREA = `${FLAT_FIELD} [--textarea-bg:transparent] [--textarea-bg-hover:transparent] [--textarea-bg-focus:transparent]`;

/** Flattens a Select trigger in every state. */
export const FLAT_SELECT_TRIGGER = `${FLAT_FIELD} [--select-trigger-bg:transparent] [--select-trigger-bg-hover:transparent] [--select-trigger-bg-focus:transparent]`;

/** Removes a field's outline entirely, hover included. */
export const NO_FIELD_BORDER =
  '[--field-border:transparent] [--field-border-hover:transparent]';

/**
 * A field outlined exactly like an `outline` Button, so the two can sit side by
 * side. `border` is required for the same reason as in GREEN_UNDERLINE: the
 * field's own width variable resolves to nothing, and the button's is a literal
 * 1px.
 */
export const BUTTON_LIKE_FIELD = 'border [--field-border:var(--outline-control)]';

/**
 * How every list popover in the app is opened — the status dropdown on a task
 * row, the property selects in both modals, the filter bar's.
 *
 * `offset: 0` is the whole point: HeroUI floats a popover 8px below its trigger,
 * and that gap is what made the list read as a separate panel that happened to
 * be nearby. Closed up, and with the joining corners squared off in globals.css,
 * the field and its options are one object — the field on top, the list under
 * it, a hairline between them.
 *
 * `bottom start` so the two share a left edge; anchored anywhere else there is
 * nothing to join.
 *
 * Everything else about the panel — the radius, the hairline, the glass — is in
 * globals.css, on the popover classes themselves, so a list that forgets to
 * spread this still looks right and only loses the join.
 */
export const listboxPopover = { offset: 0, placement: 'bottom start' } as const;

/**
 * A panel exactly as wide as the field it dropped from.
 *
 * react-aria publishes the trigger's measured width on the popover as
 * `--trigger-width`, so a panel that asks for it can never disagree with the
 * value above it — no number to keep in step as a column's width changes.
 *
 * The task modal's property panels deliberately do *not* use this: two of their
 * triggers are chips that hug their own labels, so a panel measured from one
 * came out two thirds the width of the row it dropped from. Everything in the
 * routine modal's property list is full width, which is exactly when this is the
 * right answer. See PROPERTY_PANEL in TaskModal for the other case.
 */
export const PANEL_MATCHES_TRIGGER = 'w-[var(--trigger-width)]';

/**
 * The list itself, with the 4px HeroUI insets it from the panel's left and right
 * edges taken back.
 *
 * That inset is what stopped an option lining up with the value it replaces: the
 * field above carries 8px of its own (see PANEL_FIELD and OPEN_FIELD_GROUND) and
 * the option carried 8 more on top of the list's 4, so every dropdown in the app
 * read 4px to the right of the thing it dropped from. The vertical padding stays
 * — that one is keeping the first and last options off the panel's edges.
 */
export const LISTBOX_FLUSH = 'px-0';

/**
 * And how far in from the panel's edge an option's content then starts: 7px, not
 * the 8 the field above it uses.
 *
 * The odd number is the panel's own hairline, which is drawn inside its box —
 * so 1px is already spent before any padding applies, and 7 + 1 lands an option
 * on exactly the vertical line the value it replaces sits on. The field inside a
 * panel takes it too, for the same sum; the field on the *page* keeps its 8,
 * having no border to pay for.
 */
export const LISTBOX_ITEM_INSET = 'px-[7px]';

/**
 * A list option that *is* a pill — the status dropdown, the priority one.
 *
 * Nothing but the tap area around it: the pill carries the colour and the shape,
 * and anything drawn behind or around it (HeroUI's grey `bg-default` on hover,
 * a mark on the current one) reads as a second shape wrapped round the first.
 * So hover and selected are both cleared, and what tells the options apart is
 * the pills themselves — the same pills you are looking at on the row.
 *
 * The inset rather than the 12px this started at, so a pill in the list starts on
 * the same vertical line as the pill in the field above it.
 */
export const PILL_LISTBOX_ITEM = `cursor-pointer rounded-full border-0 ${LISTBOX_ITEM_INSET} py-1.5 hover:bg-transparent data-[hovered=true]:bg-transparent data-[selected=true]:bg-transparent`;

/**
 * A list option that is a line of text — recurrence, the day of the week, a
 * sector.
 *
 * Three things it takes from HeroUI's own: no vertical padding and no minimum
 * height, so the hover is the height of the line rather than a 36px band around
 * it; a small radius instead of a 16px capsule, matching the panel it sits in;
 * and a fill half as strong, since a solid grey behind one option of four made
 * the list look like it had already been chosen from.
 */
export const TEXT_LISTBOX_ITEM = [
  `min-h-0 rounded-md ${LISTBOX_ITEM_INSET} py-0`,
  'hover:bg-default/50 data-[hovered=true]:bg-default/50',
].join(' ');

/**
 * Marks a panel that carries its own field inside it rather than joining the one
 * on the page — the status dropdown, which lays its own copy of the chip over
 * the trigger (see ChipSelect).
 *
 * It exists to opt out of the squared-off top edge in globals.css: that edge is
 * there to meet a field above, and a panel that already contains its field has
 * nothing to meet — it is one box and keeps all four corners.
 */
export const PANEL_OWNS_FIELD = 'gloo-owns-field';

/**
 * The same panel for a popover that is not a list — the property rows' calendar
 * and the project message.
 *
 * Their geometry is in globals.css only for the popovers that hold a `.list-box`,
 * which these do not; the classes here say the same thing from the outside. The
 * `data-placement` variants are the join: whichever edge faces the field loses
 * its rounding, and with `offset: 0` the two meet along one line.
 */
export const FIELD_PANEL = [
  'rounded-[8px] border border-border/50 shadow-[0_8px_20px_-12px_rgb(0_0_0/0.25)]',
  'data-[placement=bottom]:rounded-t-none data-[placement=top]:rounded-b-none',
].join(' ');

/**
 * A field that grows a ground while its list is open.
 *
 * For the chrome-less triggers — the modals' property rows, which are values you
 * can change rather than form controls. Open, the value needs to read as the
 * field the list belongs to, and it is the fill that says so; closed, it goes
 * back to being a line of text. Its bottom corners square off to meet the panel.
 *
 * Fields that already carry their own fill (the filter bar's, the create form's)
 * need none of this — they look like fields the whole time.
 */
/**
 * The `-ml-2 pl-2` pair is what keeps the value where it was: these triggers
 * start on their column's own left edge (`pl-0`, see BARE_TRIGGER), so a ground
 * drawn straight onto them would touch the first letter. The negative margin
 * grows the fill 8px to the left and the padding gives that 8px back to the
 * text, so the ground gets its inset and nothing moves as the list opens.
 */
export const OPEN_FIELD_GROUND = [
  'aria-expanded:rounded-t-md aria-expanded:rounded-b-none aria-expanded:bg-default/60',
  'aria-expanded:-ml-2 aria-expanded:pl-2',
].join(' ');

/**
 * Turns a field into a single green rule under the text — the app's marker for
 * "this line is editable", used by the routine title and the checklist title.
 */
/**
 * `border-b` is not redundant with the other three sides being zeroed: the
 * field's own width comes from `--border-width-field`, which resolves to
 * nothing here, so the bottom edge has to be given an explicit width or the
 * rule is invisible even though its color is set. `--field-border-hover` is
 * pinned to the same green so the rule doesn't shift color under the cursor —
 * these titles are typed into, not clicked.
 */
export const GREEN_UNDERLINE =
  'rounded-none border-x-0 border-t-0 border-b px-0 [--field-radius:0] [--field-border:var(--outline-green)] [--field-border-hover:var(--outline-green)]';
