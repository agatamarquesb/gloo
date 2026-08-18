import type { ComponentProps, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * The box one thing on a calendar is described in — the Dashboard's day summary,
 * and the Calendar page's Detalhes card.
 *
 * Here rather than in either of them because they are the same object seen twice:
 * a name, a coloured bar saying which agenda it belongs to, and four labelled
 * facts about it. The two were drawn separately and had drifted into two
 * different cards — different type sizes, one with icons and one without, one
 * with a bar and one without.
 */

/**
 * An item's own heading: 14px, medium — a step under the card titles around it,
 * because this names one thing *inside* a card rather than the card.
 */
export const OVERVIEW_TITLE = 'text-sm font-medium text-surface-foreground';

/**
 * The box itself. The border says where one item ends and the next begins, which
 * a hairline between rows could not: a stack of rows read as one long table
 * broken up rather than as two separate things.
 */
export const OVERVIEW_BOX = 'flex gap-3 rounded-2xl border border-border p-3';

/**
 * The bar down the left edge, in the colour of the agenda or sector the item
 * belongs to — the same colour as its dot on the month above it.
 *
 * `self-stretch` rather than a height: it is as tall as the item beside it,
 * whatever that item turns out to hold. Inside the box's padding rather than on
 * its edge, so the rounded ends read as a mark on the card instead of as a
 * thickened border.
 */
export const OVERVIEW_BAR = 'w-1 shrink-0 self-stretch rounded-full';

/** The size every one of these rows draws its icon at. */
export const OVERVIEW_ICON = 'size-3.5 shrink-0 text-foreground';

/**
 * A label/value pair, on the property rows' own grid.
 *
 * The label column is fixed rather than sized to its text, so Data, Hora, Tipo
 * and Agenda all answer on one vertical line — the thing that makes four short
 * rows read as a table instead of as four sentences.
 *
 * `items-start`, so a value that wraps onto two lines keeps its label — and any
 * swatch beside it — level with the *first* of them. Centred, a two-line agenda
 * name left its colour chip floating between the lines.
 */
export function OverviewRow({
  icon,
  label,
  children,
}: {
  /**
   * Drawn by the caller rather than named: two of these rows carry a glyph that
   * depends on the item — the day it falls on — and a component passed by
   * reference could not be given it.
   */
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[5.75rem_minmax(0,1fr)] items-start gap-2 py-1">
      {/* The icon at full strength while the word stays grey, as in the two
          entity modals — see LABEL_ICON. At this size a muted glyph is mostly
          gone, and these are what the column is scanned by. */}
      <span className="flex items-center gap-1.5 text-xs text-muted">
        {icon}
        {label}
      </span>
      <span className="min-w-0 text-xs text-foreground">{children}</span>
    </div>
  );
}

/**
 * The way out of the card — through to the calendar, or to the dialog that can
 * change the thing.
 *
 * A chevron and nothing else: no ground at rest, none on hover, the glyph going
 * from grey to full ink instead. The same treatment every quiet control in the
 * app takes (see dotsMenuButton), and it replaced a pencil in a ghost button
 * whose grey disc was the loudest thing on the card.
 */
export function OverviewChevron({
  label,
  ...props
}: { label: string } & ComponentProps<'button'>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className="flex shrink-0 cursor-pointer items-center text-muted transition-colors hover:text-surface-foreground active:text-surface-foreground"
    >
      <ChevronRight className="size-4" />
    </button>
  );
}
