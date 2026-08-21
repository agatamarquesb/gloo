import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button, Popover } from '@heroui/react';

import { TaskStatus, type TaskPriority } from '@gloo/shared';

import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { useTasks } from '@/hooks/queries/tasks';
import { formatDuration } from '@/lib/formatDuration';
import { TASK_PERIOD_KEY, readPreference, writePreference } from '@/lib/preferences';
import { FIELD_PANEL, PANEL_MATCHES_TRIGGER } from '@/theme/fieldStyles';
import { menuRow, toolbarPill, toolbarPillOpen } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

import {
  DEFAULT_PERIOD,
  PERIOD_ORDER,
  PerformancePeriod,
  buildPerformance,
  isPerformancePeriod,
} from './taskPerformance';

/**
 * A bar's colour says which priority it is, and the three step down one green
 * from light to dark in the same direction the row runs — so the scale is
 * legible before a single label under it is read.
 *
 * The app's chart ramp, the same --sector-* set the Dashboard's sector ring is
 * drawn in, rather than the status palette: these are three steps of one scale,
 * and borrowing the alarm colour for "alta" would read as an error rather than
 * as the far end of that scale. The ramp's own darkest step anchors it, so the
 * three span the full range instead of huddling at the light end.
 *
 * Written as custom properties rather than resolved through useSectorColors —
 * that hook exists for Recharts, which needs a literal value. A `background`
 * takes the variable directly and follows the theme on its own.
 */
const BAR_FILL: Record<TaskPriority, string> = {
  LOW: 'var(--sector-1)',
  MEDIUM: 'var(--sector-2)',
  HIGH: 'var(--sector-4)',
};

/**
 * The punctuality block's two colours: the same green, light and dark.
 *
 * Both mixed towards white until they sit *above* the chart ramp's lightest
 * step, which is what keeps the two blocks apart — the bars own the saturated
 * end of the green and this owns the pale end, so no value on this card means
 * two things. Read in the order the split bar draws them: on time first and
 * lighter, late after it and a step down.
 */
const PUNCTUALITY_FILL = {
  onTime: 'color-mix(in srgb, var(--green) 40%, white)',
  late: 'color-mix(in srgb, var(--green) 80%, white)',
} as const;

/**
 * The shortest a bar with real time behind it is ever drawn, as a share of the
 * tallest.
 *
 * A priority that is genuinely quick still has to be a shape rather than a mark
 * on the baseline — the figure written over it is the reading, and the curve is
 * only there to compare the three at a glance.
 */
const MIN_BAR = 6;

/**
 * The bar's outline: a bell, flat along the baseline and curving up to a rounded
 * summit.
 *
 * Drawn as a path in a 0–100 box and stretched to whatever the bar's box turns
 * out to be (`preserveAspectRatio="none"`), which is the whole reason this is an
 * SVG and not a `clip-path`: the shape has curves, and `polygon()` has only
 * straight edges. `path()` would take curves but only in fixed pixels, so it
 * could not follow a bar whose height is a share of the data.
 *
 * Every control point is horizontal to the point it belongs to — (22,100) off
 * the base, (30,0) and (70,0) either side of the apex — so the curve leaves the
 * baseline flat and rounds over the top instead of arriving at a corner.
 */
const BELL = 'M0,100 C22,100 30,0 50,0 C70,0 78,100 100,100 Z';

/**
 * The shared width of a bar and of the name written under it: a third of the
 * row, with nothing between them.
 *
 * No gap and no ceiling, so the two outer bells run out to the section's own
 * margins and every pair meets in the middle. A bell's tails flatten to nothing
 * at the edges of its own column, so touching columns put the three on one
 * continuous outline — a range rather than three separate mounds with a pool of
 * white between them.
 */
const BAR_TRACK = 'min-w-0 flex-1';

/**
 * The line the three bells stand on.
 *
 * Painted as the *background* of the row the bells are in, at its bottom edge,
 * rather than as an element under it: drawn as a sibling the two boxes met on a
 * fractional pixel and the bells' antialiased last row left a hairline of white
 * between the shape and its own baseline. Sharing one box means there is no seam
 * to land wrong.
 *
 * Its colour is the chart's: a stop of each bar's own fill at that bar's centre,
 * so the line is that priority's colour where the priority meets it and blends
 * from one to the next in between. With three equal columns filling the row
 * those centres are simply a sixth, a half and five sixths of it.
 */
const BASELINE = [
  'linear-gradient(to right',
  `${BAR_FILL.LOW} 0`,
  `${BAR_FILL.LOW} 16.6667%`,
  `${BAR_FILL.MEDIUM} 50%`,
  `${BAR_FILL.HIGH} 83.3333%`,
  `${BAR_FILL.HIGH} 100%)`,
].join(', ');

/**
 * How long tasks take, and how often they land on time.
 *
 * Both metrics come from the same set of finished tasks, so they are one card
 * rather than two: the headline is the mean of every stretch spent in "Em
 * andamento", and the three bells under it are that same mean taken one
 * priority at a time. The period at the top governs both.
 */
export function TaskPerformanceCard() {
  /**
   * The window, kept between visits: it is a way of reading the card rather than
   * a question asked fresh each time, and someone who measures their team over
   * three months should not be shown the last week every time they open the
   * page. Seeded once — a lazy initialiser, so storage is read on the first
   * render and never again.
   */
  const [period, setPeriod] = useState<PerformancePeriod>(
    () => readPreference(TASK_PERIOD_KEY, isPerformancePeriod) ?? DEFAULT_PERIOD,
  );
  const [isPeriodOpen, setPeriodOpen] = useState(false);

  // Every finished task, not the page's current filter: the chart answers "how
  // long does work take here", which is a question about all of it. Its own
  // query key, so filtering the list below never disturbs this — and the period
  // narrows what comes back rather than being asked of the server, so changing
  // it costs nothing and never blanks the card while a request is in flight.
  const { data: done = [], isLoading } = useTasks({ status: TaskStatus.DONE });

  const performance = useMemo(() => buildPerformance(done, period), [done, period]);
  const { bars } = performance;

  // Every bar is a share of the tallest, so the row keeps its shape whether the
  // tasks took minutes or weeks. Guarded against an all-empty set, which the
  // branch below never reaches but which would divide by zero.
  const longest = Math.max(1, ...bars.map((bar) => bar.averageMs ?? 0));

  const rated = performance.onTime + performance.late;
  const copy = strings.tasksPage.performance;

  return (
    <DashboardCard
      title={copy.title}
      bodyGap="gap-1.5"
      // The window the whole card is measured over, in the corner every card
      // keeps its controls in. The app's secondary pill and the app's own
      // dropdown panel, the same pair the Calendar page's view selector wears —
      // see toolbarPill.
      action={
        <Popover isOpen={isPeriodOpen} onOpenChange={setPeriodOpen}>
          {/* One fixed width, cut for "Últimas 2 semanas". Sized to its own
              label the pill would change width every time the period did, and
              the panel under it — which matches the trigger — would change with
              it, wrapping the longer options on the narrower states. */}
          <Button
            size="sm"
            variant="outline"
            aria-label={copy.period.label}
            className={`${toolbarPill} ${toolbarPillOpen} w-[10.5rem] justify-between gap-1 px-3`}
          >
            {copy.period[period]}
            <ChevronDown className="size-4 shrink-0" />
          </Button>

          <Popover.Content
            offset={0}
            className={`${PANEL_MATCHES_TRIGGER} ${FIELD_PANEL} rounded-b-lg data-[placement=top]:rounded-t-lg`}
          >
            <Popover.Dialog className="p-1">
              <div className="flex flex-col gap-0.5">
                {PERIOD_ORDER.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`${menuRow} ${value === period ? 'text-foreground' : ''}`}
                    onClick={() => {
                      setPeriod(value);
                      writePreference(TASK_PERIOD_KEY, value);
                      setPeriodOpen(false);
                    }}
                  >
                    {copy.period[value]}
                  </button>
                ))}
              </div>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      }
    >
      {/* `flex-1` from here down, so the card fills whatever height the row it
          shares gives it — the month beside it is the tallest thing in that row,
          and this stretches to meet it rather than leaving a gap under itself. */}
      {isLoading ? (
        <p className="flex flex-1 items-center justify-center text-sm text-muted">
          {strings.common.loading}
        </p>
      ) : performance.averageMs === null ? (
        <p className="flex flex-1 items-center justify-center text-center text-sm text-muted">
          {period === PerformancePeriod.ALL ? copy.noDataAll : copy.noDataPeriod}
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {/* The figure first and its explanation under it: what the card is
              *for* is one number, and the words are the caption to it rather
              than a label it answers to. */}
          <div>
            <p className="text-2xl font-semibold text-surface-foreground">
              {formatDuration(performance.averageMs)}
            </p>
            <p className="text-xs text-muted">
              {copy.averageLabel} • {copy.allScope}
            </p>
          </div>

          {/* Three columns of equal width standing on one line: the bells, then
              the line itself, then the names. Two rows rather than one column
              apiece because the line runs the width of the card and the bells do
              not — the only way a name can stay under its own bell across a rule
              that ignores both is for the two rows to be laid out alike. */}
          <div className="mt-3 flex min-h-20 flex-1 flex-col">
            <div
              className="flex min-h-12 flex-1 items-stretch"
              style={{
                backgroundImage: BASELINE,
                backgroundSize: '100% 1px',
                backgroundPosition: 'bottom',
                backgroundRepeat: 'no-repeat',
              }}
            >
              {bars.map((bar) => {
                // A priority nobody has finished stands at nothing: a floor
                // under it would be a shape claiming a time it does not have.
                const height =
                  bar.averageMs === null
                    ? 0
                    : Math.max(MIN_BAR, (bar.averageMs / longest) * 100);

                return (
                  <div
                    key={bar.priority}
                    // The padding is the headroom the figure above the tallest
                    // bell needs: a percentage height resolves against the
                    // content box, so the bell tops out below it and the label,
                    // which hangs off the bell's own top edge, lands inside it.
                    className={`flex flex-col justify-end pt-5 ${BAR_TRACK}`}
                  >
                    <div className="relative w-full shrink-0" style={{ height: `${height}%` }}>
                      {/* Pinned to the bell's summit rather than to a row of its
                          own: the figure belongs to the shape under it, and at a
                          fixed height it sat a hand's width above the short ones
                          with nothing in between. */}
                      <span className="absolute inset-x-0 bottom-full pb-1 text-center text-[0.6875rem] font-medium tabular-nums text-surface-foreground">
                        {bar.averageMs === null ? copy.noBarData : formatDuration(bar.averageMs)}
                      </span>

                      {bar.averageMs === null ? null : (
                        <svg
                          viewBox="0 0 100 100"
                          // The box is the reading, not the drawing: the summit
                          // sits on the box's top edge either way, so a bell of
                          // this height says what a rectangle of it did.
                          preserveAspectRatio="none"
                          // Hidden from the reader: the priority and its average
                          // are already written above and below the shape in
                          // words. The <title> is the pointer's tooltip, which
                          // the accessibility tree never sees.
                          aria-hidden
                          style={{ color: BAR_FILL[bar.priority] }}
                          // Taken out of flow rather than sized inside it: an
                          // <svg> whose percentage height cannot resolve falls
                          // back to the 150px every replaced element defaults
                          // to, and three of those were quietly setting the
                          // card's intrinsic height — which then stretched the
                          // month beside it by sixty pixels. Absolute, it
                          // contributes nothing and still fills the box.
                          className="absolute inset-0 size-full transition-opacity hover:opacity-70"
                        >
                          <title>
                            {`${strings.task.priority[bar.priority]} — ${bar.count} ${
                              bar.count === 1 ? copy.barTask : copy.barTasks
                            }`}
                          </title>
                          <path d={BELL} fill="currentColor" />
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex shrink-0 pt-1.5">
              {bars.map((bar) => (
                <p
                  key={bar.priority}
                  className={`truncate text-center text-[0.6875rem] text-muted ${BAR_TRACK}`}
                >
                  {strings.task.priority[bar.priority]}
                </p>
              ))}
            </div>
          </div>

          {/* The second metric, and all that is left of it: two figures and
              what they are called.

              The rule, the heading and the proportion bar are gone. The heading
              named a block that is one line long — the two labels say what they
              are — and the split bar drew, in a colour nobody can measure by
              eye, the same ratio the two counts state exactly. What is left is
              centred under the chart, so it reads as a footnote to the bells
              rather than as a second section with its own left edge. */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
            {rated > 0 ? (
              <>
                <span className="flex items-center gap-1.5 text-muted">
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ backgroundColor: PUNCTUALITY_FILL.onTime }}
                  />
                  {copy.onTime}
                  <span className="font-medium text-surface-foreground">{performance.onTime}</span>
                </span>
                <span className="flex items-center gap-1.5 text-muted">
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ backgroundColor: PUNCTUALITY_FILL.late }}
                  />
                  {copy.late}
                  <span className="font-medium text-surface-foreground">{performance.late}</span>
                </span>
              </>
            ) : (
              <span className="text-muted">{copy.noDeadline}</span>
            )}
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
