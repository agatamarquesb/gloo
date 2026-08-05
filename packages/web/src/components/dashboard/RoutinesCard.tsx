import { useEffect, useState } from 'react';
import { ChevronRight, Copy, Plus, Trash2 } from 'lucide-react';
import { Button, ScrollShadow } from '@heroui/react';
import { useSearchParams } from 'react-router';

import type { RoutineDto } from '@gloo/shared';

import { AppCheckbox } from '@/components/common/AppCheckbox';
import {
  useCreateRoutine,
  useDeleteRoutine,
  useRoutines,
  useToggleRoutine,
} from '@/hooks/queries/routines';
import { useMe } from '@/hooks/queries/auth';
import { canMutateEntity } from '@/lib/permissions';
import { playSound } from '@/lib/sounds';
import {
  quietTextButton,
  routineRow,
  routineRowTarget,
  routineRowTitle,
} from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

import { DashboardCard } from './DashboardCard';
import { duplicateRoutineName } from './duplicateRoutineName';
import { RoutineLabels } from './RoutineLabels';
import { RoutineModal } from './RoutineModal';
import { RoutineTrash } from './RoutineTrash';
import { readLabelsCollapsed, writeLabelsCollapsed } from './routineLabelsView';
import { formatRoutineDay, groupRoutinesByMonth } from './routineSchedule';

/**
 * Fixed, not a max: the card shows two routines plus a sliver of the third, so
 * the list always reads as scrollable and the card's height never depends on
 * how many routines happen to exist.
 */
const LIST_HEIGHT = 'h-40';

/** Query param that reopens a routine from a shared link. */
export const ROUTINE_PARAM = 'rotina';

function RoutineRow({
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
  /** Owned by the card, which is the only thing that knows the names in use. */
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

export function RoutinesCard() {
  const { data: me } = useMe();
  const { data: routines = [], isLoading } = useRoutines(me?.id);
  const createRoutine = useCreateRoutine();
  const [editing, setEditing] = useState<RoutineDto | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isTrashOpen, setTrashOpen] = useState(false);
  /**
   * Whether the tag rows are folded down to bars — one flag for the whole list,
   * because the gesture switches how you read the card rather than dressing a
   * single routine. See RoutineLabels.
   *
   * Seeded from where it was left rather than from `false`, so a refresh brings
   * the card back the way it was being read — see routineLabelsView.
   */
  const [areLabelsCollapsed, setLabelsCollapsed] = useState(readLabelsCollapsed);
  const [searchParams, setSearchParams] = useSearchParams();

  const groups = groupRoutinesByMonth(routines);

  // Routines have no route of their own, so a shared link is the Dashboard plus
  // this param — see copyLink in RoutineModal. Consumed once the routine it
  // names has loaded, then dropped from the URL so a later close doesn't reopen
  // the dialog.
  const deepLinkId = searchParams.get(ROUTINE_PARAM);
  useEffect(() => {
    if (!deepLinkId) return;
    const match = routines.find((routine) => routine.id === deepLinkId);
    if (!match) return;

    setEditing(match);
    setModalOpen(true);
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete(ROUTINE_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [deepLinkId, routines, setSearchParams]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(routine: RoutineDto) {
    setEditing(routine);
    setModalOpen(true);
  }

  /** Folds every tag row, or unfolds them, and remembers which for next time. */
  function toggleLabels() {
    setLabelsCollapsed((current) => {
      const next = !current;
      writeLabelsCollapsed(next);
      return next;
    });
  }

  /**
   * A copy of everything the routine is, under the next free "(n)".
   *
   * It needs no position of its own: the list is ordered by creation and grouped
   * by when each routine next falls due, and a copy shares the original's
   * schedule — so it lands in the same group, immediately after the routine it
   * came from.
   *
   * Attachments are copied by reference, with fresh ids. Both routines then
   * point at the same uploaded file, which is what duplicating means here; the
   * ids are per-routine and only have to be unique within one.
   */
  function duplicate(routine: RoutineDto) {
    createRoutine.mutate({
      description: duplicateRoutineName(
        routine.description,
        routines.map(({ description }) => description),
      ),
      recurrence: routine.recurrence,
      weekday: routine.weekday,
      dayOfMonth: routine.dayOfMonth,
      notes: routine.notes,
      checklists: routine.checklists,
      attachments:
        routine.attachments?.map((attachment) => ({
          ...attachment,
          id: crypto.randomUUID(),
        })) ?? null,
      labelIds: routine.labels.map(({ id }) => id),
      assigneeIds: routine.assignees.map(({ id }) => id),
    });
  }

  return (
    // `relative` so the trash panel can cover the card and nothing else, and
    // `overflow-hidden` so its square corners are clipped to the card's rounded
    // ones. Plain text rather than a button for the trigger: it is a way in to
    // somewhere quiet, not an action on the routines you are looking at.
    <DashboardCard
      title={strings.routine.title}
      className="relative overflow-hidden"
      action={
        // h-7 is the title's own line height, so the two sit on one axis: the
        // header aligns its children by their top edges, and left to itself this
        // much smaller text rides above the word it belongs beside.
        <button
          type="button"
          className="flex h-7 cursor-pointer items-center gap-0.5 text-xs text-muted hover:font-medium hover:text-surface-foreground"
          onClick={() => setTrashOpen(true)}
        >
          {strings.routine.trash.open}
          <ChevronRight className="size-3.5" />
        </button>
      }
    >
      {isLoading ? (
        <p className="py-6 text-center text-muted">{strings.common.loading}</p>
      ) : routines.length === 0 ? (
        <p className="py-6 text-center text-muted">{strings.routine.empty}</p>
      ) : (
        // HeroUI's own fade rather than a hand-rolled gradient mask: it tracks
        // the scroll position, so an edge only softens while it actually has
        // content hidden past it — the last row stays crisp at the bottom.
        //
        // -mt-2 pulls the list up into the card's header gap, close enough to
        // the title that the top fade reads against it. overflow-y-scroll with a
        // thin scrollbar keeps the bar permanently visible instead of letting
        // the platform hide it until you scroll.
        <ScrollShadow
          variant="fade"
          orientation="vertical"
          size={28}
          // px/py inside the scroller, not margins outside it: the rows lift on
          // hover, and without that padding the scaled edge is clipped by the
          // scroll container. The matching -mx pulls the scroller back out by
          // exactly that padding, so the rows and the month heading start and
          // end on the card's own margins — the same edges as "Adicionar
          // rotina" below them — while the lift keeps its room.
          className={`${LIST_HEIGHT} -mx-1.5 -mt-2 overflow-y-scroll px-1.5 py-1 [scrollbar-width:thin]`}
        >
          {groups.map((group) => (
            <section key={group.key} className="mb-3 last:mb-0">
              <h3 className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
                {group.label}
              </h3>
              <ul className="flex flex-col gap-2">
                {group.routines.map(({ routine, date }) => (
                  <RoutineRow
                    key={routine.id}
                    routine={routine}
                    date={date}
                    canEdit={canMutateEntity(me, {
                      createdById: routine.createdById,
                      assigneeIds: routine.assignees.map((assignee) => assignee.id),
                    })}
                    onEdit={() => openEdit(routine)}
                    onDuplicate={() => duplicate(routine)}
                    areLabelsCollapsed={areLabelsCollapsed}
                    onToggleLabels={toggleLabels}
                  />
                ))}
              </ul>
            </section>
          ))}
        </ScrollShadow>
      )}

      {/* mt-auto pins this to the bottom of the card, so it lines up with the
          preset grid in the Time blocking card beside it rather than floating up
          when the list is short. */}
      <Button variant="primary" fullWidth className="mt-auto rounded-full" onPress={openCreate}>
        <Plus className="size-4" />
        {strings.routine.addRoutine}
      </Button>

      <RoutineModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        routine={editing ?? undefined}
      />

      {/* Mounted only while open, so closing it drops the trash query rather
          than leaving it to refetch behind a panel nobody is looking at. */}
      {isTrashOpen ? <RoutineTrash onClose={() => setTrashOpen(false)} /> : null}
    </DashboardCard>
  );
}
