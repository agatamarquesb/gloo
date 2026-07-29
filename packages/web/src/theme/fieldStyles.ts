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
