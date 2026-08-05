import { useEffect, useState } from 'react';
import { CalendarRange, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { Button, Popover, ScrollShadow } from '@heroui/react';
import { useSearchParams } from 'react-router';

import type { RoutineDto } from '@gloo/shared';

import { useCreateRoutine, useRoutines } from '@/hooks/queries/routines';
import { useMe } from '@/hooks/queries/auth';
import { canMutateEntity } from '@/lib/permissions';
import { FIELD_PANEL } from '@/theme/fieldStyles';
import { menuRow } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

import { AllRoutines } from './AllRoutines';
import { DashboardCard } from './DashboardCard';
import { duplicateRoutineName } from './duplicateRoutineName';
import { RoutineModal } from './RoutineModal';
import { RoutineRow } from './RoutineRow';
import { RoutineTrash } from './RoutineTrash';
import { readLabelsCollapsed, writeLabelsCollapsed } from './routineLabelsView';
import { groupRoutinesByMonth } from './routineSchedule';

/**
 * Fixed, not a max: the card shows two routines plus a sliver of the third, so
 * the list always reads as scrollable and the card's height never depends on
 * how many routines happen to exist.
 */
const LIST_HEIGHT = 'h-40';

/** Query param that reopens a routine from a shared link. */
export const ROUTINE_PARAM = 'rotina';

export function RoutinesCard() {
  const { data: me } = useMe();
  const { data: routines = [], isLoading } = useRoutines(me?.id);
  const createRoutine = useCreateRoutine();
  const [editing, setEditing] = useState<RoutineDto | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  /**
   * Which panel is laid over the card, if either. One value rather than a flag
   * each: they cover the same space and only one of them can be open, and two
   * booleans would have made "both at once" expressible.
   */
  const [panel, setPanel] = useState<'trash' | 'all' | null>(null);
  /** Whether the `···` menu is showing. Controlled, so picking a row shuts it. */
  const [isMenuOpen, setMenuOpen] = useState(false);
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
      // The whole cadence, custom schedule included — a copy that quietly came
      // back on one day of the three would be a different routine.
      weekdays: routine.weekdays,
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
    // `relative` so a panel can cover the card and nothing else, and
    // `overflow-hidden` so its square corners are clipped to the card's rounded
    // ones.
    <DashboardCard
      title={strings.routine.title}
      className="relative overflow-hidden"
      action={
        // A `···` rather than the "Lixeira ›" link it replaces: there are two
        // ways out of the card now, and the corner of a card is not where you
        // list two things. Same menu shape as an agenda's — see AgendaMenu.
        //
        // Controlled, so picking a row shuts the panel behind it; left to
        // itself a Popover stays open under whatever it just opened.
        <Popover isOpen={isMenuOpen} onOpenChange={setMenuOpen}>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            className="text-muted"
            aria-label={strings.routine.menu}
          >
            <MoreHorizontal className="size-4" />
          </Button>

          <Popover.Content className={`w-52 ${FIELD_PANEL}`}>
            <Popover.Dialog className="p-1">
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  className={menuRow}
                  onClick={() => {
                    setPanel('all');
                    setMenuOpen(false);
                  }}
                >
                  <CalendarRange className="size-4" />
                  {strings.routine.all.open}
                </button>
                <button
                  type="button"
                  className={menuRow}
                  onClick={() => {
                    setPanel('trash');
                    setMenuOpen(false);
                  }}
                >
                  <Trash2 className="size-4" />
                  {strings.routine.trash.open}
                </button>
              </div>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      }
    >
      {isLoading ? (
        <p className="py-6 text-center text-muted">{strings.common.loading}</p>
      ) : groups.length === 0 ? (
        // Two different empties, and the difference matters: no routines at all,
        // or none in the next four days. See ROUTINE_LOOKAHEAD_DAYS — without
        // the second message a full schedule read as a lost one.
        <p className="py-6 text-center text-muted">
          {routines.length === 0 ? strings.routine.empty : strings.routine.emptySoon}
        </p>
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

      {/* Mounted only while open, so closing the trash drops its query rather
          than leaving it to refetch behind a panel nobody is looking at. "Todas
          as rotinas" needs no query of its own — it is the card's own list
          without the four-day window, so it is handed the routines directly. */}
      {panel === 'trash' ? <RoutineTrash onClose={() => setPanel(null)} /> : null}
      {panel === 'all' ? (
        <AllRoutines
          routines={routines}
          onClose={() => setPanel(null)}
          onDuplicate={duplicate}
          areLabelsCollapsed={areLabelsCollapsed}
          onToggleLabels={toggleLabels}
        />
      ) : null}
    </DashboardCard>
  );
}
