import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, ScrollShadow } from '@heroui/react';

import { TaskStatus, type TaskFilters, type TaskListItemDto, type TaskStatusFilter } from '@gloo/shared';

import { SearchField } from '@/components/common/SearchField';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskModal } from '@/components/tasks/TaskModal';
import { TaskStatusPills } from '@/components/tasks/TaskStatusPills';
import { useDebouncedValue } from '@/hooks/ui/useDebouncedValue';
import { useMe } from '@/hooks/queries/auth';
import { useTasks } from '@/hooks/queries/tasks';
import { strings } from '@/strings/pt-BR';

import { DashboardCard } from './DashboardCard';
import { readTaskOrder, reorderTasks, sortByManualOrder, writeTaskOrder } from './myTasksOrder';

/**
 * Fixed, not a max: five task rows plus their gaps. The card's height never
 * depends on how many tasks happen to match the filter, and the list always
 * reads as scrollable when there are more.
 */
const LIST_HEIGHT = 'h-[26rem]';

/** How long "Feitas" stays lit after a task is completed. */
const FLASH_MS = 2000;

/**
 * True for two seconds after a task in this list is completed, and not again
 * until those two seconds are up.
 *
 * Watched here rather than reported by whatever changed the status, because a
 * task can be completed from three places — its row's chip, the modal, another
 * tab's refetch — and all three arrive as the same thing: a task that was not
 * DONE a moment ago and is now.
 */
function useCompletedFlash(tasks: TaskListItemDto[]): boolean {
  const [isLit, setLit] = useState(false);
  const previous = useRef(new Map<string, TaskStatus>());
  const until = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const current = new Map(tasks.map((task) => [task.id, task.status]));
    const completed = tasks.some((task) => {
      const before = previous.current.get(task.id);
      return before !== undefined && before !== TaskStatus.DONE && task.status === TaskStatus.DONE;
    });
    previous.current = current;

    // Deliberately not restarted while it is already running: ticking off four
    // tasks in a row is one gesture, and four overlapping flashes read as a
    // flicker rather than as confirmation.
    if (!completed || Date.now() < until.current) return;

    until.current = Date.now() + FLASH_MS;
    setLit(true);
    // The timeout outlives this effect's cleanup on purpose — every refetch
    // re-runs it, and clearing on the way out would cut the flash short.
    timer.current = setTimeout(() => setLit(false), FLASH_MS);
  }, [tasks]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return isLit;
}

export function MyTasksCard({ onAddTask }: { onAddTask: () => void }) {
  const { data: me } = useMe();
  const [status, setStatus] = useState<TaskStatusFilter | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  /** The task being read, opened over the Dashboard rather than at its own route. */
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  // Same treatment as the Tasks page: the field stays instant while the query
  // key lags behind it, so typing a word costs one request, not one per key.
  const debouncedSearch = useDebouncedValue(search, 300);

  const filters: TaskFilters = {
    status,
    assigneeId: me?.id,
    search: debouncedSearch || undefined,
  };
  const { data: tasks = [], isLoading } = useTasks(filters);

  const [order, setOrder] = useState<string[]>(readTaskOrder);
  /** The row being dragged, and the row it is currently over. */
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const ordered = useMemo(() => sortByManualOrder(tasks, order), [tasks, order]);
  const visibleIds = ordered.map((task) => task.id);

  const isFlashing = useCompletedFlash(tasks);

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const next = reorderTasks(order, visibleIds, dragId, targetId);
    setOrder(next);
    writeTaskOrder(next);
    setDragId(null);
    setOverId(null);
  }

  return (
    <DashboardCard title={strings.dashboard.myTasks}>
      {/* One row for everything you do to the list: filter it on the left,
          search it and add to it on the right. None of it belongs in the card's
          header, where it read as part of the title.

          Search and add travel together so the pair stays whole when the row
          wraps, and both are cut to the pills' own height — `size="sm"` for the
          button, `slim` for the field. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TaskStatusPills
          value={status}
          onChange={setStatus}
          slim
          withOverdue={false}
          outlineSelected
          flash={isFlashing ? 'DONE' : undefined}
        />

        <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
          <SearchField slim value={search} onChange={setSearch} className="min-w-0 flex-1 sm:w-40" />
          <Button
            isIconOnly
            size="sm"
            variant="primary"
            className="shrink-0"
            aria-label={strings.task.addTask}
            onPress={onAddTask}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="py-6 text-center text-muted">{strings.common.loading}</p>
      ) : ordered.length === 0 ? (
        <p className="py-6 text-center text-muted">{strings.dashboard.noTasks}</p>
      ) : (
        // Every task, five at a time: the card is a fixed height and the rest
        // are a scroll away, rather than the list being cut off at five with no
        // way to reach the sixth. HeroUI's own fade rather than a hand-rolled
        // gradient, as on the Routines card — it tracks the scroll position, so
        // an edge only softens while it actually has content hidden past it.
        //
        // px/py inside the scroller with a matching -mx outside it: the rows
        // lift on hover and the scroller would clip the scaled edge, while the
        // negative margin keeps them on the card's own margins.
        <ScrollShadow
          variant="fade"
          orientation="vertical"
          size={28}
          className={`${LIST_HEIGHT} -mx-1.5 overflow-y-auto px-1.5 py-1 [scrollbar-width:thin]`}
        >
          {/* The flex column is inside the scroller, not the scroller itself:
              rows are flex items either way, and as children of a fixed-height
              flex container they would compress to fit rather than overflow —
              so the list would never scroll at all. */}
          <div className="flex flex-col gap-2">
            {ordered.map((task) => {
              // Which edge of the row being hovered the dragged one will land
              // on. Above when it is travelling up the list, below when down —
              // the same rule reorderTasks applies to the stored order.
              const insertAbove = visibleIds.indexOf(dragId ?? '') > visibleIds.indexOf(task.id);

              return (
                // The whole row is the handle: press it and drag. No grip to
                // aim at, because the row already has a click target covering
                // it — a handle would be one more thing to miss, and pressing
                // anywhere is what the gesture is for.
                <div
                  key={task.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    // Firefox starts no drag at all without payload on the event.
                    event.dataTransfer.setData('text/plain', task.id);
                    setDragId(task.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverId(null);
                  }}
                  onDragOver={(event) => {
                    if (!dragId || dragId === task.id) return;
                    // preventDefault is what marks the row as a drop target;
                    // without it the browser refuses the drop outright.
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    setOverId(task.id);
                  }}
                  onDragLeave={() => setOverId((current) => (current === task.id ? null : current))}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleDrop(task.id);
                  }}
                  className={`relative rounded-2xl transition-opacity ${
                    dragId === task.id ? 'opacity-40' : ''
                  }`}
                >
                  {/* Where it will land, drawn in the brand green on the edge it
                      will land against. Inside the row's own box rather than in
                      the gap between rows, so the scroller never grows by a
                      pixel mid-drag and shifts the list under the cursor. */}
                  {overId === task.id && dragId ? (
                    <span
                      aria-hidden
                      className={`absolute inset-x-2 z-10 h-0.5 rounded-full bg-green ${
                        insertAbove ? 'top-0' : 'bottom-0'
                      }`}
                    />
                  ) : null}

                  <TaskCard task={task} shortDate onOpen={() => setOpenTaskId(task.id)} />
                </div>
              );
            })}
          </div>
        </ScrollShadow>
      )}

      {/* Opened here rather than by routing to /tasks/:id: on the Dashboard the
          task is one card among several, and sending you to the Tasks page to
          read it replaced everything else you were looking at. The modal lays
          over the Dashboard and closing it leaves the page untouched. */}
      {openTaskId ? (
        <TaskModal taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
      ) : null}
    </DashboardCard>
  );
}
