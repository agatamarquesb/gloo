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
  children,
  className = '',
  hideTitle = false,
  bodyGap = 'gap-4',
  ref,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
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
          <h2 className="text-lg font-semibold text-surface-foreground">{title}</h2>
          {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
