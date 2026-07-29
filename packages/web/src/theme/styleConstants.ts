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
  'flex flex-col gap-2 rounded-2xl border border-outline-green py-3 pr-3 pl-5';

/**
 * The three action pills in the routine modal — Checklist, Etiquetas, Anexos.
 * Shared because one of them lives in LabelPicker rather than beside the other
 * two, which is exactly how it ended up without their hover lift.
 */
export const actionPill =
  'rounded-full border-outline-control transition-transform duration-200 motion-safe:hover:scale-[1.04]';

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
