import { useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, ScrollShadow } from '@heroui/react';

import type { TaskFilters, TaskStatusFilter } from '@gloo/shared';

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

/**
 * The gap a dragged row opens where it will land — see `dragHeight` below, which
 * measures the row so the space is exactly the size of the thing going into it.
 */
const DROP_GAP = 'pointer-events-none rounded-2xl border border-dashed border-outline-green/60';

/**
 * The element that actually scrolls the page this card is on.
 *
 * Both halves of the test are needed. An ancestor whose content overflows is not
 * necessarily scrollable — with `overflow: visible` the content simply spills,
 * and `scrollHeight` still reports it — so the overflow property has to agree;
 * and an ancestor that *can* scroll but has nothing hidden is not the one that
 * moves. Falls back to the document, for a page laid out without an inner
 * scroller.
 */
function scrollingAncestor(from: HTMLElement | null): HTMLElement | null {
  for (let node = from?.parentElement ?? null; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    const scrolls = overflowY === 'auto' || overflowY === 'scroll';
    if (scrolls && node.scrollHeight > node.clientHeight) return node;
  }
  return document.scrollingElement as HTMLElement | null;
}

export function MyTasksCard({ onAddTask }: { onAddTask: () => void }) {
  const { data: me } = useMe();
  const card = useRef<HTMLElement>(null);
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
  /**
   * How tall the row being dragged is, measured when the drag starts. The gap
   * that opens for it is that height exactly, so what you are aiming at is the
   * space the task will occupy rather than a mark saying where it would go.
   */
  const [dragHeight, setDragHeight] = useState(0);

  const ordered = useMemo(() => sortByManualOrder(tasks, order), [tasks, order]);
  const visibleIds = ordered.map((task) => task.id);

  /**
   * Change the filter and run the page to the bottom.
   *
   * The card is the last thing on the Dashboard, so from the top of the page a
   * filter pill is often the only part of it on screen: you press "A fazer" and
   * the answer lands below the fold. Scrolling to the end rather than to the card
   * lands on the same view every time, with the foot of the page under it — the
   * card's own bottom edge no longer floating somewhere mid-screen.
   *
   * The scroller is the shell's `main`, not the window (see AppShell: the page
   * is a full-height flex row and only that column scrolls), so it is found by
   * walking up from the card rather than assumed.
   */
  function selectStatus(next: TaskStatusFilter | 'ALL') {
    setStatus(next);

    const scroller = scrollingAncestor(card.current);
    scroller?.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
  }

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const next = reorderTasks(order, visibleIds, dragId, targetId);
    setOrder(next);
    writeTaskOrder(next);
    setDragId(null);
    setOverId(null);
  }

  return (
    <DashboardCard ref={card} title={strings.dashboard.myTasks}>
      {/* One row for everything you do to the list: filter it on the left,
          search it and add to it on the right. None of it belongs in the card's
          header, where it read as part of the title.

          Search and add travel together so the pair stays whole when the row
          wraps, and both are cut to the pills' own height — `size="sm"` for the
          button, `slim` for the field. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TaskStatusPills value={status} onChange={selectStatus} slim withOverdue={false} />

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

      {/* Loading and empty take the list's own height rather than collapsing to a
          line of text: the card is the same box under every filter, whether that
          filter has five tasks in it or none, and the Dashboard below it does not
          jump each time you press one. */}
      {isLoading || ordered.length === 0 ? (
        <div className={`${LIST_HEIGHT} flex items-center justify-center text-muted`}>
          {isLoading ? strings.common.loading : strings.dashboard.noTasks}
        </div>
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
        //
        // The fade is deliberately short — a band that deep washed the first and
        // last rows out into the card's own white and read as a haze over the
        // list rather than as an edge with more behind it.
        <ScrollShadow
          variant="fade"
          orientation="vertical"
          size={10}
          className={`${LIST_HEIGHT} gloo-thin-scroll -mx-1.5 overflow-y-auto px-1.5 py-1`}
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
                    setDragHeight(event.currentTarget.getBoundingClientRect().height);
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
                  className={`relative rounded-2xl ${dragId === task.id ? 'opacity-40' : ''}`}
                >
                  {/* Where it will land: a space the size of the row you are
                      holding, opened on the edge it will land against, rather
                      than a line drawn between two rows. You aim at the slot the
                      task will occupy instead of at a mark standing for it.

                      Both gaps live *inside* this row's own box, which is what
                      keeps the drag steady: the wrapper grows, so the pointer
                      stays over the same drop target while the space opens under
                      it — a gap between the rows would move the target out from
                      under the cursor and the two would fight. */}
                  {overId === task.id && dragId && insertAbove ? (
                    <div aria-hidden className={`${DROP_GAP} mb-2`} style={{ height: dragHeight }} />
                  ) : null}

                  <TaskCard task={task} compact onOpen={() => setOpenTaskId(task.id)} />

                  {overId === task.id && dragId && !insertAbove ? (
                    <div aria-hidden className={`${DROP_GAP} mt-2`} style={{ height: dragHeight }} />
                  ) : null}
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
