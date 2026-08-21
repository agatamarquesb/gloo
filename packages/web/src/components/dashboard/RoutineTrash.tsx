import { useState } from 'react';
import { ArrowLeft, BrushCleaning, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@heroui/react';

import type { RoutineDto } from '@gloo/shared';

import { AppCheckbox } from '@/components/common/AppCheckbox';
import { RedButton } from '@/components/common/RedButton';
import { playSound } from '@/lib/sounds';
import {
  useDeletedRoutines,
  useEmptyRoutineTrash,
  useRestoreRoutine,
} from '@/hooks/queries/routines';
import { SecondaryButton } from '@/components/common/SecondaryButton';
import {
  quietTextButton,
  routineRow,
  routineRowTarget,
  routineRowTitle,
} from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';
import { liftRoom } from '@/theme/styleConstants';

import { RoutineModal } from './RoutineModal';

/**
 * The band a row's controls sit in — the title's own line box, with everything
 * centred in it. The checkbox and Recuperar therefore land on the title's first
 * line whatever height they happen to be, and a wrapped title grows downward
 * from that line rather than dragging them out of place.
 */
const ROW_CONTROL_BAND = 'relative flex h-5 shrink-0 items-center';

/**
 * Deleting a routine is reversible, so there has to be somewhere to reverse it
 * from. This is that place: a panel laid over the Routines card rather than a
 * dialog of its own, because the trash belongs to the card — you open it, take
 * something back or empty it, and are done.
 *
 * `absolute inset-0` covers the card exactly, and the card is the positioned
 * ancestor. `bg-surface` rather than a translucent scrim: the list underneath is
 * the same shape as this one and showing through would make both hard to read.
 */
export function RoutineTrash({ onClose }: { onClose: () => void }) {
  const { data: routines = [], isLoading } = useDeletedRoutines();
  const restoreRoutine = useRestoreRoutine();
  const emptyTrash = useEmptyRoutineTrash();

  /** The routine being read, if one was opened from the list. */
  const [viewing, setViewing] = useState<RoutineDto | null>(null);
  /** Ticked for a bulk delete. Ids rather than routines, so a refetch can't
   *  leave the selection holding stale copies. */
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const isEmpty = routines.length === 0;
  // Only what is actually still in the bin: a routine restored or destroyed
  // elsewhere must not keep a tick behind it that then names a missing id.
  const selectedIds = routines.map(({ id }) => id).filter((id) => selected.has(id));

  function toggleSelected(id: string, isSelected: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (isSelected) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-surface md:p-5">
      <header className="flex items-center justify-between gap-2">
        {/* The same weight and size as every other card's title — it stands in
            for the Routines heading while it is open, so it has to carry the
            same rank. */}
        <h3 className="text-lg font-semibold text-surface-foreground">
          {strings.routine.trash.heading}
        </h3>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className="shrink-0 text-muted"
          aria-label={strings.routine.trash.close}
          onPress={onClose}
        >
          {/* Back rather than close: the panel covers the Routines card instead
              of floating over the page, so leaving it returns you to what is
              underneath — the same trip the "lixeira ›" link made to get here. */}
          <ArrowLeft className="size-4" />
        </Button>
      </header>

      {/* min-h-0 so the list scrolls inside the panel instead of pushing the
          footer past the card's bottom edge. The -mx/px pair is the Routines
          card's, for the same reason: the rows lift on hover and the scroller
          would clip the scaled edge, while the negative margin keeps them on the
          panel's own margins. */}
      <div className={`gloo-thin-scroll min-h-0 flex-1 overflow-y-auto ${liftRoom}`}>
        {isLoading ? (
          <p className="py-4 text-center text-xs text-muted">{strings.common.loading}</p>
        ) : isEmpty ? (
          <p className="py-4 text-center text-xs text-muted">{strings.routine.trash.empty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {routines.map((routine) => (
              // The same row as on the card, hover and lift included: a deleted
              // routine is the same object in a different place. No tags,
              // though — in the bin the only thing that matters about a routine
              // is which one it is.
              <li key={routine.id} className={routineRow}>
                {/* The whole row opens it. The list gives you a title and
                    nothing else, which is rarely enough to decide between
                    putting a routine back and destroying it — so it opens the
                    routine's own dialog, read-only; see `isTrashed` there. */}
                <button
                  type="button"
                  onClick={() => setViewing(routine)}
                  aria-label={routine.description}
                  className={routineRowTarget}
                />

                {/* pointer-events-auto to opt back out of the click target
                    covering the row — ticking a routine is not opening it. */}
                <div className={`${ROW_CONTROL_BAND} pointer-events-auto`}>
                  <AppCheckbox
                    accent
                    isSelected={selected.has(routine.id)}
                    onChange={(isSelected) => toggleSelected(routine.id, isSelected)}
                  >
                    <span className="sr-only">{strings.routine.trash.select}</span>
                  </AppCheckbox>
                </div>

                <span
                  className={`${routineRowTitle} pointer-events-none relative min-w-0 flex-1 text-foreground`}
                >
                  {routine.description}
                </span>

                <div className={ROW_CONTROL_BAND}>
                  {/* A shade heavier than the muted text around it, icon
                      included: it is the one thing on the row you are meant to
                      reach for. Green on hover rather than the usual darkening
                      — everything else in the panel destroys, and this is the
                      one that gives something back. The deep green, not the
                      brand one, which is a fill colour and does not hold up as
                      text. Important, because it is overriding the hover the
                      shared class already sets. */}
                  <button
                    type="button"
                    className={`${quietTextButton} pointer-events-auto gap-1 text-xs font-semibold hover:text-green-deep!`}
                    disabled={restoreRoutine.isPending}
                    onClick={() => restoreRoutine.mutate(routine.id)}
                  >
                    <RotateCcw className="size-3.5" strokeWidth={2.75} />
                    {strings.routine.trash.restore}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="flex justify-end gap-2">
        {/* Only once something is ticked: with nothing selected it has nothing
            to destroy, and a red button sitting there permanently reads as a
            warning about the panel rather than about an action. */}
        {selectedIds.length > 0 ? (
          <RedButton
            size="sm"
            className="rounded-full text-xs"
            isDisabled={emptyTrash.isPending}
            onPress={() => {
              playSound('delete');
              emptyTrash.mutate(selectedIds);
              setSelected(new Set());
            }}
          >
            <Trash2 className="size-4" />
            {strings.routine.trash.deleteSelected}
          </RedButton>
        ) : null}

        {/* Outlined rather than red: emptying the bin is destructive too, but it
            is the panel's routine housekeeping, and two red buttons side by side
            would leave neither of them meaning anything. */}
        <SecondaryButton
          size="sm"
          className="text-xs"
          isDisabled={isEmpty || emptyTrash.isPending}
          onPress={() => {
            // Its own sound, not the broom's: this empties the bin, while the
            // broom elsewhere clears a field you were typing in.
            playSound('emptyTrash');
            emptyTrash.mutate(undefined);
            setSelected(new Set());
          }}
        >
          <BrushCleaning className="size-4" />
          {strings.routine.trash.emptyTrash}
        </SecondaryButton>
      </footer>

      {/* Restoring or destroying from inside the dialog closes it, and the list
          behind refetches — so the routine simply leaves, from both at once. */}
      <RoutineModal
        isTrashed
        isOpen={viewing !== null}
        onClose={() => setViewing(null)}
        routine={viewing ?? undefined}
      />
    </div>
  );
}
