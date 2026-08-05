import { Copy, Trash2 } from 'lucide-react';

import type { RoutineDto } from '@gloo/shared';

import { AppCheckbox } from '@/components/common/AppCheckbox';
import { useDeleteRoutine, useToggleRoutine } from '@/hooks/queries/routines';
import { playSound } from '@/lib/sounds';
import {
  quietTextButton,
  routineRow,
  routineRowTarget,
  routineRowTitle,
} from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

import { RoutineLabels } from './RoutineLabels';
import { formatRoutineDay } from './routineSchedule';

/**
 * A routine as a row — on the Dashboard's card, and in "Todas as rotinas".
 *
 * Its own module because the two lists have to be the same object seen twice:
 * the panel is the same routines without the four-day window, and a second copy
 * of this markup would have drifted the first time either was touched.
 */
export function RoutineRow({
  routine,
  date,
  canEdit,
  onEdit,
  onDuplicate,
  areLabelsCollapsed,
  onToggleLabels,
}: {
  routine: RoutineDto;
  date: Date;
  canEdit: boolean;
  onEdit: () => void;
  /** Owned by the list, which is the only thing that knows the names in use. */
  onDuplicate: () => void;
  /** Shared with every other row — see RoutineLabels. */
  areLabelsCollapsed: boolean;
  onToggleLabels: () => void;
}) {
  const toggleRoutine = useToggleRoutine();
  const deleteRoutine = useDeleteRoutine();

  return (
    <li className={routineRow}>
      {/* The whole row opens the routine, not just its text. */}
      <button
        type="button"
        onClick={onEdit}
        aria-label={routine.description}
        className={routineRowTarget}
      />

      {/* The same h-5 band as the cluster on the right, so the checkbox, the
          title and the date all sit on one line — and a wrapped title grows
          downward from it rather than dragging anything out of place. */}
      <div className="pointer-events-auto relative flex h-5 items-center">
        <AppCheckbox
          accent
          isSelected={routine.done}
          isDisabled={!canEdit}
          onChange={(done) => toggleRoutine.mutate({ id: routine.id, done })}
        >
          <span className="sr-only">{routine.description}</span>
        </AppCheckbox>
      </div>

      <div className="pointer-events-none relative flex min-w-0 flex-1 flex-col gap-1">
        {/* Wraps rather than truncating; the flex siblings on the right keep it
            from running underneath them. */}
        <span
          className={`${routineRowTitle} ${
            routine.done ? 'text-muted line-through' : 'text-foreground'
          }`}
        >
          {routine.description}
        </span>

        <RoutineLabels
          labels={routine.labels}
          isCollapsed={areLabelsCollapsed}
          onToggle={onToggleLabels}
        />
      </div>

      {/* Date, then the two icons, all on the title's own line — h-5 is that
          line box and the contents centre in it.

          The icons are bare buttons rather than ghost ones — see
          quietTextButton — so they carry no padding of their own and take only
          the width of the glyph, instead of eating the right-hand end of the row
          with two hover discs. */}
      <div className="relative flex h-5 shrink-0 items-center gap-2">
        <span className="pointer-events-none text-xs text-muted">{formatRoutineDay(date)}</span>

        {canEdit ? (
          <>
            {/* Mirrored, so the copy reads as coming off the routine rather than
                going onto it — and it leads the pair, since duplicating is the
                one of the two you might do casually. */}
            <button
              type="button"
              className={`${quietTextButton} pointer-events-auto`}
              aria-label={strings.routine.duplicate}
              onClick={onDuplicate}
            >
              <Copy className="size-4 -scale-x-100" />
            </button>
            <button
              type="button"
              className={`${quietTextButton} pointer-events-auto`}
              aria-label={strings.common.delete}
              onClick={() => {
                playSound('delete');
                deleteRoutine.mutate(routine.id);
              }}
            >
              <Trash2 className="size-4" />
            </button>
          </>
        ) : null}
      </div>
    </li>
  );
}
