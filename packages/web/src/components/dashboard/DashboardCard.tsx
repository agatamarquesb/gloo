import type { ReactNode, Ref } from 'react';

/**
 * Shared shell for every Dashboard card: rounded surface, consistent padding,
 * and the bold-title / optional-subtitle / right-aligned-action header used
 * across the reference designs.
 */
export function DashboardCard({
  title,
  subtitle,
  action,
  titleAction,
  children,
  className = '',
  titleClassName = 'text-lg font-semibold',
  hideTitle = false,
  bodyGap = 'gap-4',
  ref,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /**
   * A control that belongs to the heading rather than to the far end of the row
   * — the Tasks page's projects card, whose chevron reads as part of the word it
   * follows ("Projetos ›") rather than as a second thing on the line.
   *
   * `action` is still the other corner, for controls that act on the card's
   * contents rather than on the card's subject.
   */
  titleAction?: ReactNode;
  children: ReactNode;
  /**
   * What separates the heading from the body. A prop rather than something the
   * caller adds to `className`, because both would be a `gap-*` on the same
   * element and which one won would come down to the order Tailwind happens to
   * emit them in.
   *
   * The sector donut sets it to none: its ring is a circle in a rounded card and
   * carries its own whitespace on every side, so the card's own 16px on top of
   * that read as the chart having slipped down the card.
   */
  bodyGap?: string;
  className?: string;
  /**
   * The heading's own type, for a card whose name should not out-shout what is
   * in it — the Calendar page's Agendas list, whose title is set to the size an
   * item's name is written at inside the card above it.
   */
  titleClassName?: string;
  /**
   * Keep the card's name for screen readers but take the heading row off the
   * card — the Calendar, whose month is already written across the top of the
   * grid in type of its own. Two headings meant the card opened with the word
   * "Calendário" over "agosto de 2026", and the second one is the useful one.
   *
   * Not simply omitting the title: the section still needs a name, and the
   * heading is what gives it one.
   */
  hideTitle?: boolean;
  /**
   * The card's own element, for a card that has to bring itself into view — see
   * MyTasksCard, which scrolls to itself when you change the filter.
   */
  ref?: Ref<HTMLElement>;
}) {
  return (
    // No gap under a hidden heading: `gap-4` is the space between the header row
    // and the body, and with no header row on screen it was 16px of nothing at
    // the top of the card. The card's own padding is then the only margin, which
    // is what makes the four sides equal.
    <section
      ref={ref}
      className={`gloo-rise flex flex-col rounded-3xl bg-surface p-4 shadow-surface md:p-5 ${
        hideTitle ? '' : bodyGap
      } ${className}`}
    >
      <header
        className={`flex flex-wrap items-start justify-between gap-3 ${
          hideTitle ? 'sr-only' : ''
        }`}
      >
        <div>
          {/* The heading and whatever follows it on one line, so a chevron sits
              against the word rather than under it. */}
          <div className="flex items-center gap-1">
            <h2 className={`${titleClassName} text-surface-foreground`}>{title}</h2>
            {titleAction}
          </div>
          {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
