import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, ScrollShadow } from '@heroui/react';

import type { RoutineDto } from '@gloo/shared';

import { AppCheckbox } from '@/components/common/AppCheckbox';
import { useDeleteRoutine, useRoutines, useToggleRoutine } from '@/hooks/queries/routines';
import { useMe } from '@/hooks/queries/auth';
import { canMutateEntity } from '@/lib/permissions';
import { strings } from '@/strings/pt-BR';

import { DashboardCard } from './DashboardCard';
import { RoutineModal } from './RoutineModal';
import { formatRoutineDay, groupRoutinesByMonth } from './routineSchedule';

/** Roughly four rows; the rest stays reachable by scrolling the timeline. */
const VISIBLE_HEIGHT = 'max-h-72';

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
    <li className="group flex items-start gap-3 rounded-2xl bg-background p-3">
      <AppCheckbox
        isSelected={routine.done}
        isDisabled={!canEdit}
        onChange={(done) => toggleRoutine.mutate({ id: routine.id, done })}
        className="pt-0.5"
      >
        <span className="sr-only">{routine.description}</span>
      </AppCheckbox>

      <span
        className={`flex-1 text-sm ${routine.done ? 'text-muted line-through' : 'text-foreground'}`}
      >
        {routine.description}
      </span>

      <span className="shrink-0 text-xs text-muted">{formatRoutineDay(date)}</span>

      {canEdit ? (
        // Always visible: hover-only controls hide the fact that a row is editable
        // at all, and are unreachable on touch.
        <span className="flex shrink-0 gap-1">
          <Button isIconOnly size="sm" variant="ghost" aria-label={strings.common.edit} onPress={onEdit}>
            <Pencil className="size-4" />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={strings.common.delete}
            onPress={() => deleteRoutine.mutate(routine.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </span>
      ) : null}
    </li>
  );
}

export function RoutinesCard() {
  const { data: me } = useMe();
  const { data: routines = [], isLoading } = useRoutines(me?.id);
  const [editing, setEditing] = useState<RoutineDto | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);

  const groups = groupRoutinesByMonth(routines);

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
        // HeroUI's own fade rather than a hand-rolled gradient mask: it tracks the
        // scroll position, so an edge only softens while it actually has content
        // hidden past it — the last row stays crisp once you reach the bottom.
        <ScrollShadow variant="fade" orientation="vertical" size={28} className={`${VISIBLE_HEIGHT} pr-1`}>
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
                      assigneeIds: [routine.assignee.id],
                    })}
                    onEdit={() => openEdit(routine)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </ScrollShadow>
      )}

      <Button variant="primary" fullWidth className="rounded-full" onPress={openCreate}>
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
