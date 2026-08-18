import { useState } from 'react';
import { Copy, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button, Popover } from '@heroui/react';

import type { RoutineDto } from '@gloo/shared';

import { AppCheckbox } from '@/components/common/AppCheckbox';
import { useDeleteRoutine, useToggleRoutine } from '@/hooks/queries/routines';
import { playSound } from '@/lib/sounds';
import { FIELD_PANEL } from '@/theme/fieldStyles';
import {
  dotsMenuButton,
  menuRow,
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
  /** Controlled, so picking Duplicar or Deletar shuts the panel behind it. */
  const [isMenuOpen, setMenuOpen] = useState(false);

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

      {/* Date, then the row's menu, both on the title's own line — h-5 is that
          line box and the contents centre in it.

          The date ends where the pair of icons it replaced used to end: the menu
          button is pulled out of the flow so the date can occupy the whole
          right-hand end, and the `···` is laid over it. That way a routine reads
          the same whether or not the pointer is on it — nothing shifts sideways
          when the menu appears. */}
      <div className="relative flex h-5 shrink-0 items-center">
        {/* 24px of right margin, which is exactly the space the duplicate
            icon used to occupy: the date now ends where that icon's right edge
            ended, and the `···` takes the strip the bin left behind. The button's
            box is 4px wider than the glyph in it, so it hangs that far past the
            row's edge — which is what lands the dots exactly where the bin's
            glyph was, and gives the date back the 8px it had before its first
            icon. */}
        <span className="pointer-events-none mr-6 text-xs text-muted">
          {formatRoutineDay(date)}
        </span>

        {canEdit ? (
          // Only under the pointer, or while the menu it opened is up — three
          // dots on every row of a list this dense is a column of dots. Kept
          // mounted rather than swapped in, so opening it cannot move the row.
          <span
            className={`pointer-events-auto absolute top-1/2 -right-1 -translate-y-1/2 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${
              isMenuOpen ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Popover isOpen={isMenuOpen} onOpenChange={setMenuOpen}>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                className={dotsMenuButton}
                aria-label={strings.routine.rowMenu}
              >
                <MoreHorizontal className="size-4" />
              </Button>

              <Popover.Content className={`w-44 ${FIELD_PANEL}`}>
                <Popover.Dialog className="p-1">
                  <div className="flex flex-col gap-0.5">
                    {/* The same two glyphs the row used to wear, in the same
                        order and mirrored the same way: the copy reads as coming
                        off the routine rather than going onto it. */}
                    <button
                      type="button"
                      className={menuRow}
                      onClick={() => {
                        setMenuOpen(false);
                        onDuplicate();
                      }}
                    >
                      <Copy className="size-4 -scale-x-100" />
                      {strings.routine.duplicate}
                    </button>
                    <button
                      type="button"
                      className={`${menuRow} text-danger hover:text-danger`}
                      onClick={() => {
                        setMenuOpen(false);
                        playSound('delete');
                        deleteRoutine.mutate(routine.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                      {strings.common.delete}
                    </button>
                  </div>
                </Popover.Dialog>
              </Popover.Content>
            </Popover>
          </span>
        ) : null}
      </div>
    </li>
  );
}
