import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, ScrollShadow } from '@heroui/react';
import { useSearchParams } from 'react-router';

import type { RoutineDto } from '@gloo/shared';

import { AppCheckbox } from '@/components/common/AppCheckbox';
import { useDeleteRoutine, useRoutines, useToggleRoutine } from '@/hooks/queries/routines';
import { useMe } from '@/hooks/queries/auth';
import { canMutateEntity } from '@/lib/permissions';
import { LABEL_BG_CLASS, LABEL_PILL } from '@/theme/labelColors';
import { strings } from '@/strings/pt-BR';

import { DashboardCard } from './DashboardCard';
import { RoutineModal } from './RoutineModal';
import { formatRoutineDay, groupRoutinesByMonth } from './routineSchedule';

/**
 * Fixed, not a max: the card shows two routines plus a sliver of the third, so
 * the list always reads as scrollable and the card's height never depends on
 * how many routines happen to exist.
 */
const LIST_HEIGHT = 'h-40';

/** Query param that reopens a routine from a shared link. */
export const ROUTINE_PARAM = 'rotina';

/** Beyond three, the pills crowd the row and push the title into a second line. */
const MAX_VISIBLE_LABELS = 3;

function RoutineRow({
  routine,
  date,
  canEdit,
  onEdit,
}: {
  routine: RoutineDto;
  date: Date;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const toggleRoutine = useToggleRoutine();
  const deleteRoutine = useDeleteRoutine();

  return (
    // Same hover treatment as a task row in "Minhas tarefas": color plus a
    // slight lift, with the lift behind motion-safe since it is decoration.
    // Dark mode shifts the pair up a step: the row takes what used to be its
    // hover grey, and hover goes lighter still — on a near-black surface the
    // old base was too close to the card behind it to read as a card at all.
    <li className="relative flex items-start gap-3 rounded-2xl bg-background/50 p-3 transition-[background-color,transform] duration-200 hover:bg-default/40 motion-safe:hover:scale-[1.015] dark:bg-default/40 dark:hover:bg-default/70">
      {/* The whole row opens the routine, not just its text. A button stretched
          behind the content rather than a wrapper around it, because the row
          also holds a checkbox and a delete button and buttons can't nest — the
          content layer is click-through, and those two opt back in. */}
      <button
        type="button"
        onClick={onEdit}
        aria-label={routine.description}
        className="absolute inset-0 cursor-pointer rounded-2xl"
      />

      {/* mt-0.5 on the checkbox and the right-hand cluster puts both on the
          title's first line, so a wrapped title grows downward from a fixed
          top edge instead of dragging them out of alignment. */}
      <div className="pointer-events-auto relative mt-0.5">
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
          className={`text-sm break-words ${
            routine.done ? 'text-muted line-through' : 'text-foreground'
          }`}
        >
          {routine.description}
        </span>

        {routine.labels.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {routine.labels.slice(0, MAX_VISIBLE_LABELS).map((label) => (
              // The same pill as inside the routine — one shared style, so a
              // label looks identical wherever it appears.
              <span key={label.id} className={`${LABEL_PILL} ${LABEL_BG_CLASS[label.color]}`}>
                {label.name}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="relative mt-0.5 flex shrink-0 items-center gap-1">
        <span className="pointer-events-none text-xs text-muted">{formatRoutineDay(date)}</span>

        {canEdit ? (
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            className="pointer-events-auto text-muted"
            aria-label={strings.common.delete}
            onPress={() => deleteRoutine.mutate(routine.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function RoutinesCard() {
  const { data: me } = useMe();
  const { data: routines = [], isLoading } = useRoutines(me?.id);
  const [editing, setEditing] = useState<RoutineDto | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
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

  return (
    <DashboardCard title={strings.routine.title}>
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
          // scroll container.
          className={`${LIST_HEIGHT} -mt-2 overflow-y-scroll px-1.5 py-1 [scrollbar-width:thin]`}
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
    </DashboardCard>
  );
}
