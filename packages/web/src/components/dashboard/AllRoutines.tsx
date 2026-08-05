import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@heroui/react';

import { RoutineRecurrence, type RoutineDto } from '@gloo/shared';

import { SecondaryButton } from '@/components/common/SecondaryButton';
import { useMe } from '@/hooks/queries/auth';
import { canMutateEntity } from '@/lib/permissions';
import { strings } from '@/strings/pt-BR';

import { RoutineModal } from './RoutineModal';
import { RoutineRow } from './RoutineRow';
import { cadencePosition, nextOccurrence } from './routineSchedule';

/**
 * Every routine there is, whichever day it falls on — the card itself only ever
 * shows the next four days, so this is where you go to see the schedule whole.
 *
 * A panel over the Routines card rather than a page or a dialog, exactly like
 * the trash: it belongs to the card, you look through it and come back. Both are
 * reached from the same `···`, and both leave by the same arrow.
 */
export function AllRoutines({
  routines,
  onClose,
  onDuplicate,
  areLabelsCollapsed,
  onToggleLabels,
}: {
  /** Every live routine, unfiltered — the card's own query, passed down. */
  routines: RoutineDto[];
  onClose: () => void;
  onDuplicate: (routine: RoutineDto) => void;
  areLabelsCollapsed: boolean;
  onToggleLabels: () => void;
}) {
  const { data: me } = useMe();
  /** The routine being edited, if one was opened from the list. */
  const [editing, setEditing] = useState<RoutineDto | null>(null);
  /**
   * Which cadence is on screen. One at a time rather than both: a weekly routine
   * is placed by its weekday and a monthly one by its date, and interleaving two
   * different orderings produces a list that is ascending in neither.
   */
  const [recurrence, setRecurrence] = useState<RoutineRecurrence>(RoutineRecurrence.WEEKLY);
  const isWeekly = recurrence === RoutineRecurrence.WEEKLY;

  // Ascending within the cadence on screen: Monday through Sunday, or the 1st
  // through the 31st. See cadencePosition, which is what turns either into a
  // number. Ties fall back to the title, so two Tuesday routines keep a stable
  // order instead of following whatever the API happened to return.
  const shown = routines
    .filter((routine) => routine.recurrence === recurrence)
    .toSorted(
      (a, b) =>
        cadencePosition(a) - cadencePosition(b) || a.description.localeCompare(b.description, 'pt-BR'),
    );

  return (
    <div className="absolute inset-0 z-20 flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-surface md:p-5">
      <header className="flex items-center justify-between gap-2">
        {/* The same weight and size as every other card's title — it stands in
            for the Routines heading while it is open, so it has to carry the
            same rank. */}
        <h3 className="text-lg font-semibold text-surface-foreground">
          {strings.routine.all.heading}
        </h3>
        {/* Back rather than close, and the trash's own button: the panel covers
            the card instead of floating over the page, so leaving it returns you
            to what is underneath. */}
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className="shrink-0 text-muted"
          aria-label={strings.routine.all.close}
          onPress={onClose}
        >
          <ArrowLeft className="size-4" />
        </Button>
      </header>

      {/* min-h-0 so the list scrolls inside the panel instead of pushing the
          footer past the card's bottom edge. The -mx/px pair is the Routines
          card's, for the same reason: the rows lift on hover and the scroller
          would clip the scaled edge, while the negative margin keeps them on the
          panel's own margins. */}
      <div className="-mx-1.5 min-h-0 flex-1 overflow-y-auto px-1.5 py-1">
        {shown.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">{strings.routine.all.empty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {shown.map((routine) => (
              <RoutineRow
                key={routine.id}
                routine={routine}
                // The row shows when the routine next comes round, the same fact
                // it shows on the card — here it is the only date on offer, and
                // "the next Tuesday" is what a weekday actually means to a
                // reader looking at a list in August.
                date={nextOccurrence(routine)}
                canEdit={canMutateEntity(me, {
                  createdById: routine.createdById,
                  assigneeIds: routine.assignees.map((assignee) => assignee.id),
                })}
                onEdit={() => setEditing(routine)}
                onDuplicate={() => onDuplicate(routine)}
                areLabelsCollapsed={areLabelsCollapsed}
                onToggleLabels={onToggleLabels}
              />
            ))}
          </ul>
        )}
      </div>

      {/* One button that is both the label and the switch: it names the list you
          are looking at, and pressing it swaps to the other one — so the panel
          never needs a second control to say which of the two you are in. In the
          trash's own corner, and in its own outlined shape, since the two panels
          are the same object in two moods. */}
      <footer className="flex justify-end">
        <SecondaryButton
          size="sm"
          className="text-xs"
          onPress={() =>
            setRecurrence(isWeekly ? RoutineRecurrence.MONTHLY : RoutineRecurrence.WEEKLY)
          }
        >
          {isWeekly ? strings.routine.all.weekly : strings.routine.all.monthly}
        </SecondaryButton>
      </footer>

      <RoutineModal
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        routine={editing ?? undefined}
      />
    </div>
  );
}
