/**
 * Shared layout constants reused across pages/cards so spacing and sizing
 * stay consistent without repeating magic numbers in every component.
 */
/**
 * The outlined blocks inside the routine modal — notes, checklist, attachments.
 *
 * `pl-5` rather than a uniform `p-3`: each block's header ends in an icon-only
 * button, which carries its own padding, so the trash sits further from the
 * right edge than the leading icon does from the left. Padding the left edge by
 * that difference is what makes the two margins read as equal.
 */
export const blockBox =
  'flex flex-col gap-3 rounded-2xl border border-outline-green py-3 pr-3 pl-5';

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

export function blockTitle(isEditing: boolean): string {
  return isEditing ? 'text-sm font-medium' : 'text-sm font-bold';
}

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

export const layout = {
  sidebarWidth: 'w-60',
  pageContentPadding: 'p-4 md:p-6',
  cardPadding: 'p-4 md:p-5',
  cardGap: 'gap-4 md:gap-5',
  cardRadius: 'rounded-3xl',
  pillRadius: 'rounded-full',
} as const;
