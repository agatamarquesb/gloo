import { Button } from '@heroui/react';

import type { TaskStatusFilter, TaskSummaryDto } from '@gloo/shared';

import { strings } from '@/strings/pt-BR';

type StatusPillValue = TaskStatusFilter | 'ALL';

/**
 * Each pill, and which figure in the summary answers it — so a filter and the
 * number beside it can never come from two different questions.
 */
const PILLS: { value: StatusPillValue; label: string; count: keyof TaskSummaryDto }[] = [
  { value: 'ALL', label: strings.task.filters.all, count: 'total' },
  { value: 'TODO', label: strings.task.status.TODO, count: 'upcoming' },
  { value: 'IN_PROGRESS', label: strings.task.status.IN_PROGRESS, count: 'inProgress' },
  { value: 'OVERDUE', label: strings.task.filters.overdue, count: 'overdue' },
  { value: 'DONE', label: strings.task.filters.done, count: 'completed' },
];

/**
 * The count's chip, in the corner of the pill it belongs to.
 *
 * Green on both, which is the point: the figure is the one thing on this row
 * worth running your eye down, and in the neutral grey it was drawn in it read
 * as a piece of the button's chrome rather than as the answer. The board's
 * column headers count in the same green — see TaskKanban — so a status and how
 * many are in it look the same whichever view you are on.
 *
 * Two greens, one per ground. On an unselected pill the row is the card's own
 * white, so the chip is the brand green with black on it. The selected pill is
 * already filled with that green, where the same swatch would vanish — so there
 * the chip is the same green lightened, written as a white veil over it rather
 * than as a second swatch: it is then the pill's own colour by construction and
 * cannot drift from it. Lighter and not darker, because the chip has to read as
 * a window cut in the fill; a darker green read as a second, heavier object
 * sitting on it.
 *
 * A third of a veil and not a half: at 55% the mix came out at #e4ebb2, which is
 * far enough from the pill under it to read as off-white rather than as the same
 * green a step up. 35% lands on #d9e290 — plainly lighter, plainly still green.
 */
const COUNT_CHIP = 'rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums';

export function TaskStatusPills({
  value,
  onChange,
  slim = false,
  withOverdue = true,
  counts,
}: {
  value: StatusPillValue;
  onChange: (value: StatusPillValue) => void;
  slim?: boolean;
  /**
   * Whether "Atrasada" is one of the filters. The Dashboard leaves it out — it
   * has a tile counting overdue tasks a few centimetres above, and a filter for
   * the same thing on the card below was the second answer to a question the
   * page had already answered.
   */
  withOverdue?: boolean;
  /**
   * How many tasks each filter would return, written into the pill that asks
   * for them.
   *
   * Given, the row also changes shape: the pills share the width equally and
   * each one holds its label against its count, rather than hugging its own
   * word. That is what the number is for — a row of five counts is only worth
   * reading if the eye can run down one edge to find them.
   *
   * Left off, the row is the plain filter it has always been. The Dashboard's
   * list keeps that: the four summary tiles above it already carry these
   * figures, and repeating them a few centimetres below would be the same
   * answer twice.
   */
  counts?: TaskSummaryDto;
}) {
  const pills = withOverdue ? PILLS : PILLS.filter((pill) => pill.value !== 'OVERDUE');

  return (
    <div className={`flex gap-2 ${counts ? 'flex-wrap sm:flex-nowrap' : 'flex-wrap'}`}>
      {/* The current filter is the primary button, filled in the brand green;
          the rest are outlined. One rule on every page that shows these — which
          view you are in is the one thing the row has to say, and saying it in
          green fill says it at a glance. */}
      {pills.map((pill) => {
        const isActive = value === pill.value;

        return (
          <Button
            key={pill.value}
            size={slim ? 'sm' : 'md'}
            variant={isActive ? 'primary' : 'outline'}
            // Counted, the pill is a box with a word at one end and a figure at
            // the other, and the five of them divide the row between them.
            className={`rounded-full ${counts ? 'min-w-0 flex-1 justify-between gap-2' : ''}`}
            onPress={() => onChange(pill.value)}
          >
            <span className="truncate">{pill.label}</span>
            {counts ? (
              <span
                className={`${COUNT_CHIP} ${
                  isActive ? 'bg-white/35 text-black' : 'bg-green text-black'
                }`}
              >
                {counts[pill.count]}
              </span>
            ) : null}
          </Button>
        );
      })}
    </div>
  );
}
