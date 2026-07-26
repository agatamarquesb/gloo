/**
 * Shared layout constants reused across pages/cards so spacing and sizing
 * stay consistent without repeating magic numbers in every component.
 */
export const layout = {
  sidebarWidth: 'w-60',
  pageContentPadding: 'p-4 md:p-6',
  cardPadding: 'p-4 md:p-5',
  cardGap: 'gap-4 md:gap-5',
  cardRadius: 'rounded-3xl',
  pillRadius: 'rounded-full',
} as const;
