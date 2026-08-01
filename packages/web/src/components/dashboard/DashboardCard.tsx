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
  ref,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /**
   * The card's own element, for a card that has to bring itself into view — see
   * MyTasksCard, which scrolls to itself when you change the filter.
   */
  ref?: Ref<HTMLElement>;
}) {
  return (
    <section
      ref={ref}
      className={`gloo-rise flex flex-col gap-4 rounded-3xl bg-surface p-4 shadow-surface md:p-5 ${className}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
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
