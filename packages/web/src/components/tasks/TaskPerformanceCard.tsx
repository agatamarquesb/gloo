import { useMemo, useState } from 'react';
import { Button } from '@heroui/react';

import { TaskPriority, TaskStatus } from '@gloo/shared';

import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { useTasks } from '@/hooks/queries/tasks';
import { formatDuration } from '@/lib/formatDuration';
import { strings } from '@/strings/pt-BR';

import { buildPerformance, type PerformanceBar, type PerformanceScope } from './taskPerformance';

/**
 * Everything first, then low to high.
 *
 * "Todas" leads because it is the question before the breakdown — how long does
 * a task take here — and the three after it are the same figure split along a
 * scale, in the order a scale is read.
 */
const SCOPES: PerformanceScope[] = [
  'ALL',
  TaskPriority.LOW,
  TaskPriority.MEDIUM,
  TaskPriority.HIGH,
];

/**
 * How many finished tasks the row of bars draws.
 *
 * The most recent ones, not all of them: past thirty-odd bars in a column this
 * wide each one is a hairline with no gap beside it — the row stops being a
 * chart and becomes a smear. The average above it is still taken over *every*
 * finished task in the scope, which is what the figure claims to be; the bars
 * are the recent shape of it.
 */
const MAX_BARS = 32;

/**
 * A bar's colour says whether that task met its deadline — the card's second
 * metric, drawn into the first rather than charted twice.
 *
 * Three steps of one green rather than a green and a red: this is the app's
 * chart palette, the same --sector-* ramp the Dashboard's sector ring is drawn
 * in, and a chart that borrows the alarm colour from the status pills would be
 * reading as an error rather than as the far end of a scale. On time is the
 * lightest step and late the darkest, so the row still says at a glance which
 * way it leans; a task with no deadline sits between them, being neither.
 *
 * Written as custom properties rather than resolved through useSectorColors —
 * that hook exists for Recharts, which needs a literal value. A `background`
 * takes the variable directly and follows the theme on its own.
 */
const BAR_FILL: Record<PerformanceBar['punctuality'], string> = {
  ON_TIME: 'var(--sector-1)',
  LATE: 'var(--sector-4)',
  NONE: 'var(--sector-2)',
};

/** What a scope is called on its pill. */
function scopeLabel(scope: PerformanceScope): string {
  return scope === 'ALL' ? strings.task.filters.all : strings.task.priority[scope];
}

/**
 * How long tasks take, and how often they land on time.
 *
 * Both metrics come from the same set of finished tasks, so they are one card
 * rather than two: the headline is the mean of every stretch spent in "Em
 * andamento", the bars are those stretches in the order they were finished, and
 * each bar is coloured by whether that task beat its deadline.
 */
export function TaskPerformanceCard() {
  const [scope, setScope] = useState<PerformanceScope>('ALL');

  // Every finished task, not the page's current filter: the chart answers "how
  // long does work take here", which is a question about all of it. Its own
  // query key, so filtering the list below never disturbs this.
  const { data: done = [], isLoading } = useTasks({ status: TaskStatus.DONE });

  const performance = useMemo(() => buildPerformance(done, scope), [done, scope]);
  const bars = performance.bars.slice(-MAX_BARS);

  // Every bar is a share of the longest one, so the row keeps its shape whether
  // the tasks took minutes or weeks. Guarded against an all-zero set, which
  // cannot happen — buildPerformance drops those — but would divide by zero.
  const longest = Math.max(1, ...bars.map((bar) => bar.ms));

  const rated = performance.onTime + performance.late;
  const copy = strings.tasksPage.performance;

  return (
    <DashboardCard title={copy.title} bodyGap="gap-3">
      {/* The switch, on its own row rather than in the card's header action: four
          pills and a title do not share a line at this width, and putting them
          under the heading keeps the figure they change directly beneath them. */}
      <div className="flex flex-wrap gap-1.5">
        {SCOPES.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={value === scope ? 'primary' : 'outline'}
            className="rounded-full"
            onPress={() => setScope(value)}
          >
            {scopeLabel(value)}
          </Button>
        ))}
      </div>

      {/* `flex-1` from here down, so the card fills whatever height the row it
          shares gives it — the month beside it is the tallest thing in that row,
          and this stretches to meet it rather than leaving a gap under itself. */}
      {isLoading ? (
        <p className="flex flex-1 items-center justify-center text-sm text-muted">
          {strings.common.loading}
        </p>
      ) : performance.averageMs === null ? (
        <p className="flex flex-1 items-center justify-center text-center text-sm text-muted">
          {scope === 'ALL' ? copy.noDataAll : copy.noData}
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {/* The figure first and its explanation under it: what the card is
              *for* is one number, and the words are the caption to it rather
              than a label it answers to. */}
          <div>
            <p className="text-2xl font-semibold text-surface-foreground">
              {formatDuration(performance.averageMs)}
            </p>
            <p className="text-xs text-muted">
              {copy.averageLabel} ·{' '}
              {scope === 'ALL'
                ? copy.allScope
                : `${strings.task.priority[scope]} ${copy.prioritySuffix}`}
            </p>
          </div>

          {/* Hand-drawn rather than a chart component: this is a row of bars on a
              baseline with no axes, no grid and no legend, and the shape is
              entirely `height: %`. What a charting library would add here is a
              resize observer and an animation, both of which this does not want.

              `items-end` is the baseline. `min-h` on each bar so a task that took
              two minutes beside one that took two days is still a mark rather
              than nothing at all.

              `flex-1` on the row itself, so the bars take whatever slack the card
              has after the figure and the punctuality block — which is what lets
              this card match the height of the month beside it without either
              being told a number. */}
          <div className="flex min-h-12 flex-1 items-end justify-evenly gap-[3px]">
            {bars.map((bar) => (
              <span
                key={bar.id}
                title={`${bar.title} — ${copy.taskTime}: ${formatDuration(bar.ms)}`}
                style={{
                  height: `${Math.max(3, (bar.ms / longest) * 100)}%`,
                  backgroundColor: BAR_FILL[bar.punctuality],
                }}
                // `flex-1` up to a ceiling, and the slack spread evenly: with
                // thirty bars each is a few pixels wide and the row is solid,
                // and with one it is a column standing in the middle of the card
                // rather than a green panel filling it.
                className="min-h-[3px] w-full max-w-[18px] flex-1 rounded-[2px] transition-opacity hover:opacity-70"
              />
            ))}
          </div>

          {/* The two ends of the row, so it is read as time passing rather than
              as a ranking. */}
          <div className="flex justify-between text-[0.6875rem] text-muted">
            <span>{copy.axisStart}</span>
            <span>{copy.axisEnd}</span>
          </div>

          {/* The second metric. A rule above it because it is a different
              question about the same tasks — not another row of the first.

              Its name and its two figures share a line, with the proportion
              under them: as three stacked rows this block was 68px of a card
              that has to end level with a near-square month, and the counts read
              as a legend to the bar either way. */}
          <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
              <p className="font-medium text-surface-foreground">{copy.punctuality}</p>

              {rated > 0 ? (
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-muted">
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ backgroundColor: BAR_FILL.ON_TIME }}
                    />
                    {copy.onTime}
                    <span className="font-medium text-surface-foreground">
                      {performance.onTime}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 text-muted">
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ backgroundColor: BAR_FILL.LATE }}
                    />
                    {copy.late}
                    <span className="font-medium text-surface-foreground">{performance.late}</span>
                  </span>
                </span>
              ) : (
                <span className="text-muted">{copy.noDeadline}</span>
              )}
            </div>

            {/* One bar split in two, not two bars: what the metric says is a
                proportion, and a proportion is a single length divided. */}
            {rated > 0 ? (
              <div className="flex h-2 overflow-hidden rounded-full bg-default/40">
                <span
                  style={{
                    width: `${(performance.onTime / rated) * 100}%`,
                    backgroundColor: BAR_FILL.ON_TIME,
                  }}
                />
                <span
                  style={{
                    width: `${(performance.late / rated) * 100}%`,
                    backgroundColor: BAR_FILL.LATE,
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
