/**
 * Shared layout constants reused across pages/cards so spacing and sizing
 * stay consistent without repeating magic numbers in every component.
 */
/**
 * The blocks inside both entity modals — notes, checklist, subtasks,
 * attachments — while the dialog is unlocked.
 *
 * No frame any more: a green rule round each of four blocks made the dialog read
 * as four cards on a page rather than as one thing being edited, and the fields
 * inside them already say what is editable. What is left is the same 12px on
 * every side, so the blocks sit on one grid however deep their content runs.
 */
export const blockBox = 'flex flex-col gap-3 rounded-2xl p-3';

/**
 * The same blocks in the task modal, where the heading and what it heads are one
 * object rather than two.
 *
 * The dialog is four quadrants closed off by rules, and inside a quadrant the
 * 12px between "Subtarefas" and its first row read as a gap in the section — the
 * heading looked like it belonged to the rule above it rather than to the list
 * under it. So the gap is the caller's to choose: none for the note and the
 * subtasks, half for Anexos, whose rows carry a coloured tile that needs a
 * little air under the word.
 *
 * No padding of any kind, unlike the routine modal's blocks. The dialog's inset
 * belongs to its two columns (see COLUMN_INSET in TaskModal) rather than to each
 * block inside them — that is what puts every rule, every heading and the right
 * edge of every bin on the same two vertical lines, instead of the sections
 * sitting 12px inside rules that were drawn a level up.
 */
export function taskBlockBox(gap: string): string {
  return `flex flex-col ${gap}`;
}

/**
 * A row's own control in the task dialog — the × that removes a subtask or a
 * file, the + that adds one.
 *
 * The glyph and nothing else: no padding, no ground, no border, so the box *is*
 * the ink and lands exactly on the block's right edge — the edge the rules
 * across the dialog end on. An icon button's 32px square could not: pulled left
 * it stopped short of the line, pulled right it overhung the section and gave
 * the list a horizontal scrollbar.
 */
export const blockRowAction =
  'flex size-4 shrink-0 cursor-pointer items-center justify-center text-muted transition-colors hover:text-foreground';

/**
 * The same control, only while the row is under the cursor — for the ×, which
 * is destructive and has no business being the most visible thing on a row you
 * are only reading. `group-hover` on the row, plus focus so it can still be
 * reached from the keyboard.
 */
export const blockRowActionOnHover =
  'opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100';

/**
 * A trailing control in a task-modal row — a subtask's checkbox and bin, an
 * attachment's pencil and bin.
 *
 * Paired inside one flex rather than each in a column of its own: those controls
 * used to sit a full row-gap apart, which put the checkbox nearer the subtask's
 * text than the bin it belongs with. Closed up, the two read as one cluster on
 * the row's right edge.
 *
 * The slot is the button's own footprint, so a checkbox and a glyph — which do
 * not measure the same — still stack into straight columns down the block.
 */
export const blockActionCluster = 'flex shrink-0 items-center gap-0.5';
/** A HeroUI icon button's footprint, so a bare glyph lines up with one. */
export const blockActionSlot = 'flex size-8 shrink-0 items-center justify-center';

/**
 * The same blocks once the routine modal is locked. Reading a routine is not
 * filling in a form, so the frames come off and the three blocks run down the
 * page as plain sections — which also drops the left padding the border needed,
 * putting their content on the same left edge as the properties above.
 */
export const blockBoxBare = 'flex flex-col gap-3';

/**
 * The modal's hairline rule: under the header actions, and between a routine's
 * properties and its content blocks.
 */
export const modalDivider = 'h-px w-full bg-border';

/** What a free-standing rule keeps clear of whatever sits either side of it. */
export const modalDividerGap = 'my-1';

/**
 * The same rule, closing a content block off from the next one, and given more
 * room than the header's: these separate whole blocks rather than a row of
 * buttons from the dialog.
 *
 * It is the block's last child rather than a sibling of the blocks, so the space
 * either side comes from two different places and each has to be brought to the
 * same 1.25rem: the section's own `gap-3` above, the blocks container's `gap-4`
 * below.
 */
export const blockDivider = `${modalDivider} mt-2 mb-1`;

/**
 * A content block's heading — "Notas", a checklist's name, "Anexos".
 *
 * Locked, the blocks have lost their frames, so the heading is the only thing
 * separating one from the next and carries that on weight alone. Editing, the
 * frames are back and the heading steps down again so the fields it labels lead
 * instead.
 *
 * The size is the same either way, and deliberately below the routine's own
 * title: these name sections of a routine, so they must not compete with what
 * the routine is called.
 */
/**
 * The column a content block's leading icon sits in — and, in a checklist, every
 * row's checkbox.
 *
 * Fixed width and centred rather than each control taking its natural size: a
 * 16px icon and HeroUI's checkbox do not measure the same, so left to themselves
 * the three block headings and a checklist's own rows all start at slightly
 * different places. Declaring the column once puts every one of them on a single
 * left edge whatever sits inside it.
 */
export const blockLeadColumn = 'flex w-5 shrink-0 items-center justify-center';

/**
 * A block heading, one step up in size and weight, for the task modal.
 *
 * "Visão geral", "Subtarefas" and "Anexos" name the four quadrants of a dialog
 * rather than sections of a scrolling page, so they carry a little more than the
 * routine modal's — 15px against 14, and semibold where that one is medium. Not
 * two steps: they still must not compete with the task's own title above them.
 */
export function blockTitle(isEditing: boolean, large = false): string {
  const size = large ? 'text-[0.9375rem]' : 'text-sm';
  const weight = large ? (isEditing ? 'font-semibold' : 'font-bold') : isEditing ? 'font-medium' : 'font-bold';
  return `${size} ${weight}`;
}

/**
 * The three pieces of a block that lists things — its heading row, the list, and
 * a row in it. Shared by Anexos and a task's Subtarefas because in the task
 * modal those two sit side by side, one per column, and have to read as one set
 * of rows across the dialog: same heading height, same pitch, same row height,
 * whichever of them happens to hold more.
 *
 * The heights are minimums rather than fixed, so a wrapped subtask still grows
 * its own row. The number is an icon-only `size="sm"` button — the tallest thing
 * either row holds, and the one control both blocks have — so a row without one
 * (a locked subtask, which is only text and a checkbox) keeps the same pitch as
 * a row with one, and the two lists stay level however each is filled.
 */
export const blockHeaderRow = 'flex min-h-9 items-center gap-2 md:min-h-8';
export const blockRowList = 'flex flex-col gap-1';
export const blockRow = 'flex min-h-9 items-center gap-3 md:min-h-8';

/**
 * The same row in the task dialog, where a title too long for its column wraps
 * rather than being cut — nothing in that dialog scrolls sideways.
 *
 * So the row is top-aligned: a two-line name starts level with the icon beside
 * it instead of straddling it, and the controls at either end stay on the first
 * line where they belong. `group` is what lets the × appear with the row.
 */
export const taskBlockRow = 'group flex min-h-8 items-start gap-3 py-1';


/**
 * The app's one "sitting on the card" surface: a routine row's fill, the disc in
 * the sector donut's hole, and what a sector row takes on hover.
 *
 * Dark mode shifts it a step — on a near-black card the light value is too close
 * to the surface behind it to read as anything at all.
 */
export const quietSurface = 'bg-background/50 dark:bg-default/40';

/** The same fill, applied on hover. */
export const quietSurfaceHover = 'hover:bg-background/50 dark:hover:bg-default/40';

/**
 * A routine's row, on the Dashboard's list and in its trash alike — a deleted
 * routine is the same object in a different place, and should look like it.
 *
 * Same hover treatment as a task row in "Minhas tarefas": colour plus a slight
 * lift, with the lift behind motion-safe since it is decoration. Dark mode
 * shifts the pair up a step — the row takes what used to be its hover grey and
 * hover goes lighter still, because on a near-black surface the old base was too
 * close to the card behind it to read as a card at all.
 */
export const routineRow =
  'group relative flex items-start gap-3 rounded-2xl bg-background/50 p-3 transition-[background-color,transform] duration-200 hover:bg-default/40 motion-safe:hover:scale-[1.015] dark:bg-default/40 dark:hover:bg-default/70';

/**
 * A routine's title inside that row. `group` above is what lets it answer the
 * row's hover rather than its own — the whole row is the target, so the title
 * has to react even when the cursor is nowhere near the words.
 */
export const routineRowTitle = 'text-sm break-words transition-[font-weight] group-hover:font-medium';

/**
 * The click target that covers a routine row.
 *
 * Stretched behind the content rather than wrapped around it, because the row
 * also holds its own buttons and buttons cannot nest — the content layer is
 * click-through and those opt back in with `pointer-events-auto`.
 */
export const routineRowTarget = 'absolute inset-0 cursor-pointer rounded-2xl';

/**
 * The three action pills in the routine modal — Checklist, Etiquetas, Anexos.
 * Shared because one of them lives in LabelPicker rather than beside the other
 * two, which is exactly how it ended up without their hover lift.
 */
export const actionPill =
  'rounded-full border-outline-control transition-transform duration-200 motion-safe:hover:scale-[1.04]';

/**
 * A control that is only its label: no padding, no fill, nothing on hover but
 * the text and its icon going from grey to full strength.
 *
 * A plain element rather than a ghost Button, because a ghost still carries its
 * own horizontal padding and its own hover background — and both of those are
 * exactly what stops it lining up with the text above it. Without the padding it
 * starts on its container's own edge.
 *
 * `cursor-pointer` explicitly: Tailwind's reset leaves a `<button>` on the
 * default arrow, so every bare button has to ask for the hand.
 */
export const quietTextButton =
  'flex cursor-pointer items-center gap-1.5 text-muted transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50';

/** Outline for controls defined by their edge, brighter in dark mode. */
export const outlineControl = 'border-outline-control';

/**
 * A line in one of the calendar's popover menus — the agenda `···`, the account
 * `···`, and the "Nova agenda" affordance under them.
 *
 * A quietTextButton that fills its panel's width and takes a ground on hover,
 * which is what makes a stack of them read as a menu rather than as a column of
 * links. Shared because the three menus sit within a few hundred pixels of each
 * other and any drift between them is visible at a glance.
 */
export const menuRow = `${quietTextButton} w-full justify-start rounded-md px-2 py-1.5 text-sm hover:bg-default/50 hover:text-foreground`;

/**
 * The dialogs' own chrome, shared by the task modal and the routine modal so the
 * two cannot drift.
 *
 * All the padding is on the dialog itself now. HeroUI gives `.modal__dialog` a
 * `p-6`, and each of the three sections used to add another 16px on top of it —
 * so the content sat 40px in from the edge, which is what made these dialogs
 * look like they had a margin drawn round them. One inset now — 18px at the
 * sides, a little tighter top and bottom — and the header, body and footer add
 * nothing.
 */
export const dialogPadding = 'px-6 pt-[18px] pb-[15px]';

/**
 * The title as a field, while the dialog is unlocked.
 *
 * No rule under it any more: the green line was the app's "you can type here"
 * marker back when the dialogs were read-only by default, and now that a whole
 * dialog says it is in edit mode a line under one field of eight only said it
 * about that one. No padding under it either, so the title sits as close to the
 * first row as the reading version does.
 */
export const TITLE_FIELD = 'rounded-none border-0 px-0 pb-0 [--field-radius:0]';

/**
 * What separates the title from the body under it — half what the body's own
 * `gap-4` gave it, which read as a band of empty dialog rather than as spacing.
 */
export const dialogTitleGap = 'gap-2';

/**
 * The dialog's own shape: a little narrower and a little taller than it sizes
 * itself to, and squared off from HeroUI's 32px corner to the 16px the cards on
 * the Dashboard use. `min-h` rather than `h`, so a short dialog still fills the
 * shape while a long one grows past it and scrolls inside its body.
 */
export const dialogShape = 'rounded-2xl sm:min-h-[70vh]';
export const dialogSection = 'pt-0 pr-0 pb-0 pl-0';

/**
 * The footer's distance from the body above it. Its own space rather than the
 * body's, so a scrolled body ends where the fade does and the buttons sit clear
 * of it.
 */
export const dialogFooter = `${dialogSection} mt-[10px]`;

/**
 * The fade at the top and bottom of a scrolling dialog body.
 *
 * A mask rather than a gradient overlay: the content itself thins out, so it
 * works over whatever the dialog's ground happens to be. Short and soft — at
 * 1.25rem it read as a band across the dialog rather than as an edge, and it was
 * fading whole rows of a property list that were not going anywhere.
 */
export const dialogBodyFade =
  '[mask-image:linear-gradient(to_bottom,transparent_0,black_0.5rem,black_calc(100%-0.5rem),transparent_100%)]';

/**
 * The dialog's close button: the glyph and nothing else.
 *
 * It used to be a SecondaryButton — an outlined pill with a hover fill — which
 * made the one control in the header you press to *leave* the loudest thing in
 * it. Bare, it also carries no padding of its own, so it ends exactly on the
 * dialog's 15px inset, level with the content on the other side.
 */
export const dialogClose = `${quietTextButton} ml-auto`;

export const layout = {
  sidebarWidth: 'w-60',
  pageContentPadding: 'p-4 md:p-6',
  cardPadding: 'p-4 md:p-5',
  cardGap: 'gap-4 md:gap-5',
  cardRadius: 'rounded-3xl',
  pillRadius: 'rounded-full',
} as const;
