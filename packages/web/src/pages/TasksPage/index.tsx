import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@heroui/react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';

import type { TaskFilters, TaskSortBy, TaskStatusFilter } from '@gloo/shared';

import { CalendarCard } from '@/components/dashboard/CalendarCard';
import { ProjectsCard } from '@/components/tasks/ProjectsCard';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskFiltersBar } from '@/components/tasks/TaskFiltersBar';
import { TaskKanban } from '@/components/tasks/TaskKanban';
import { TaskListScroll } from '@/components/tasks/TaskListScroll';
import { TaskReorderRow } from '@/components/tasks/TaskReorderRow';
import { TaskView, isTaskView } from '@/components/tasks/TaskViewToggle';
import { TaskPerformanceCard } from '@/components/tasks/TaskPerformanceCard';
import { NewTaskModal, TaskModal } from '@/components/tasks/TaskModal';
import { TaskStatusPills } from '@/components/tasks/TaskStatusPills';
import { PageHeader } from '@/components/layout/PageHeader';
import { useDebouncedValue } from '@/hooks/ui/useDebouncedValue';
import { useSectors } from '@/hooks/queries/sectors';
import { useTasks, useTaskSummary } from '@/hooks/queries/tasks';
import { useUsers } from '@/hooks/queries/users';
import {
  ALL_TASKS_ORDER_KEY,
  readTaskOrder,
  reorderTasks,
  sortByManualOrder,
  writeTaskOrder,
} from '@/components/dashboard/myTasksOrder';
import { TASK_VIEW_KEY, readPreference, writePreference } from '@/lib/preferences';
import { strings } from '@/strings/pt-BR';

type StatusPillValue = TaskStatusFilter | 'ALL';

/**
 * A comma-separated filter parameter as the list it stands for.
 *
 * Empty entries dropped, so a value left as "" by clearing the last tick reads
 * as "nothing ticked" rather than as a search for the sector with no id.
 */
function toIds(value: string | undefined): string[] {
  return value ? value.split(',').filter(Boolean) : [];
}

export function TasksPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCreateOpen, setCreateOpen] = useState(false);

  // TaskCard stamps the route it was clicked from — query string and all, so a
  // card opened on the board closes back onto the board rather than onto the
  // list. A task opened from the Dashboard closes back to the Dashboard the same
  // way.
  //
  // The fallback is for a URL pasted straight into the address bar, which
  // carries no state: it keeps whatever that URL was asking for, so
  // /tasks/:id?view=KANBAN closes onto the board too.
  const closeTo =
    (location.state as { from?: string } | null)?.from ?? `/tasks${location.search}`;

  // Filters live in the URL so the Dashboard cards can deep-link into a
  // pre-filtered Tasks view, and so filtered views stay shareable/bookmarkable.
  const [searchParams, setSearchParams] = useSearchParams();

  const status = (searchParams.get('status') ?? 'ALL') as StatusPillValue;
  const search = searchParams.get('search') ?? '';
  /**
   * The sectors and the people ticked in the filter panel, which takes several
   * of each now.
   *
   * Still one parameter apiece, comma-separated: every link already pointing at
   * this page — the Dashboard's tiles deep-link into it — carries a single id,
   * and a list of one is exactly that. The API splits them the same way, see
   * `ids` in the tasks routes.
   */
  const sectorId = searchParams.get('sectorId') ?? undefined;
  const assigneeId = searchParams.get('assigneeId') ?? undefined;
  const sectorIds = toIds(sectorId);
  const assigneeIds = toIds(assigneeId);
  const sortBy = (searchParams.get('sortBy') as TaskSortBy | null) ?? undefined;
  const sortDir = (searchParams.get('sortDir') as 'ASC' | 'DESC' | null) ?? 'ASC';
  const dueDateFrom = searchParams.get('dueDateFrom') ?? undefined;
  const dueDateTo = searchParams.get('dueDateTo') ?? undefined;
  /**
   * Which project the filter panel is set to.
   *
   * Held and remembered like every other filter, and narrowing nothing: a task
   * has no project to be filtered by — see SAMPLE_PROJECTS — so this goes no
   * further than the URL until one exists. Deliberately left out of `isFiltered`
   * below for the same reason: a green "Filtrar" over a list that did not change
   * would be the button telling you something the rows contradict.
   */
  const projectIds = toIds(searchParams.get('projectId') ?? undefined);

  /**
   * Which way the tasks are drawn: the URL first, then what you last left it on.
   *
   * The URL wins so a board stays a link you can send someone. Storage is what
   * answers when there is no link — coming back to /tasks from the Dashboard, or
   * reopening the app — because the view is a way of working rather than a
   * question the page asks fresh every time, and a person who works on the board
   * should not be handed the list every morning.
   *
   * Only a *choice* is stored, never the fallback: see onViewChange below.
   */
  const viewParam = searchParams.get('view');
  const [storedView] = useState(() => readPreference(TASK_VIEW_KEY, isTaskView));
  const view: TaskView = isTaskView(viewParam) ? viewParam : (storedView ?? TaskView.LIST);

  function setParam(key: string, value: string | undefined) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value === undefined || value === '') {
          next.delete(key);
        } else {
          next.set(key, value);
        }
        return next;
      },
      // Carry location.state through the replace. Without it the search effect,
      // which fires once on mount, silently drops the origin TaskCard stamped on
      // the entry — and the modal would always close back to the list.
      { replace: true, state: location.state },
    );
  }

  // The input stays instant while the query key (and refetch) lags behind it,
  // so typing a word costs one request instead of one per keystroke.
  const [searchDraft, setSearchDraft] = useState(search);
  const debouncedSearch = useDebouncedValue(searchDraft, 300);

  useEffect(() => {
    setParam('search', debouncedSearch);
    // setParam is recreated each render; only the debounced value should retrigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const filters: TaskFilters = {
    search: debouncedSearch || undefined,
    status,
    sectorId,
    assigneeId,
    sortBy,
    sortDir,
    dueDateFrom,
    dueDateTo,
  };

  /**
   * The day picked on the month, when the two ends of the deadline window are
   * the same day — which is the only way this page ever sets them. Anything
   * else (a range typed into the URL by hand) leaves the month unmarked rather
   * than marking one arbitrary end of it.
   */
  const pickedDay = dueDateFrom && dueDateFrom === dueDateTo ? dueDateFrom : null;

  /**
   * Pressing a day filters the list to that deadline; pressing it again clears
   * it. Both bounds move together, so the window is exactly the day.
   */
  function pickDay(day: string | null) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (day) {
          next.set('dueDateFrom', day);
          next.set('dueDateTo', day);
        } else {
          next.delete('dueDateFrom');
          next.delete('dueDateTo');
        }
        return next;
      },
      { replace: true, state: location.state },
    );
  }

  /**
   * Whether anything is narrowing the list beyond the status pills and the
   * search box — which is what the "Filtrar por" button says in green.
   *
   * The status pills are left out on purpose: they carry their own counts and
   * the one you are on is already filled in, so the button would be repeating
   * what the row above it says outright.
   */
  const isFiltered = Boolean(sectorId || assigneeId || dueDateFrom || dueDateTo);

  const { data: tasks = [], isLoading } = useTasks(filters);
  // The same filters the list is under, minus the status — so each pill's figure
  // is what pressing that pill would actually show.
  const { data: summary } = useTaskSummary({
    search: filters.search,
    sectorId,
    assigneeId,
    dueDateFrom,
    dueDateTo,
  });
  const { data: sectors = [] } = useSectors();
  const { data: users = [] } = useUsers();

  /**
   * The order the rows were dragged into, exactly as the Dashboard's own list
   * keeps it — a person's arrangement of a shared list, held in the browser
   * because the server has no column for it. Its own key, so rearranging forty
   * of everybody's tasks here does not reshuffle the five of yours over there.
   */
  const [order, setOrder] = useState<string[]>(() => readTaskOrder(ALL_TASKS_ORDER_KEY));
  /** The row being dragged, the row it is over, and how tall the first one is. */
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dragHeight, setDragHeight] = useState(0);

  // One arrangement, both views. A column is this order with the cards that are
  // in another state taken out of it, so rearranging the board rearranges the
  // list and the other way round — which is right: it is one person's order for
  // one set of tasks, shown two ways. The board's own drag changes the *status*
  // as well, but only when the card is dropped on a different column.
  //
  // Finished tasks sink to the bottom, which the board never sees: they are all
  // in "Feitas" together, so the rule cannot separate two cards in one column.
  const ordered = useMemo(() => sortByManualOrder(tasks, order), [tasks, order]);
  const visibleIds = ordered.map((task) => task.id);

  /** Put the dragged task where the target one is, and remember it. */
  function reorder(from: string, targetId: string) {
    if (from === targetId) return;
    const next = reorderTasks(order, visibleIds, from, targetId);
    setOrder(next);
    writeTaskOrder(next, ALL_TASKS_ORDER_KEY);
  }

  function handleDrop(draggedId: string, targetId: string) {
    if (draggedId) reorder(draggedId, targetId);
    setDragId(null);
    setOverId(null);
  }

  return (
    <div>
      <PageHeader title={strings.nav.tasks} />

      <div className="flex flex-col gap-4 px-4 pb-6 md:gap-5 md:px-6">
        {/* Three across the top, at 40/25/35 — stated as eight, five and seven
            columns of a twenty-column grid rather than as percentages, so the
            two gaps come out of the page instead of out of the columns' own
            widths, which percentages cannot do without a calc apiece.

            Their heights are the month's. A grid row is as tall as its tallest
            item, and the two beside it are built to take whatever slack that
            leaves — the chart's bars grow into it and the three folders divide
            it between them.

            One column below lg, where a quarter of the page is narrower than a
            week. */}
        <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-20">
          {/* A one-cell grid of its own, which is what passes the row's height
              down to the card inside it: a grid item stretches to its track in
              both axes, so none of the three is ever told a height. */}
          <div className="grid lg:col-span-8">
            <TaskPerformanceCard />
          </div>
          {/* Deadlines only. The month sits between a chart about tasks and a
              list of tasks, and a dot on it that turned out to be a meeting
              would be answering a question this page never asks.

              Pressing a day narrows the list below to that deadline rather than
              opening a summary of it: the answer this page has to give about a
              day is already the thing underneath, and a second list beside the
              month would have been the same tasks written twice. */}
          <div className="grid lg:col-span-5">
            <CalendarCard tasksOnly narrow pickedDay={pickedDay} onPickDay={pickDay} />
          </div>
          <div className="grid lg:col-span-7">
            <ProjectsCard />
          </div>
        </div>

        {/* And the list under all three, across the whole page. */}
        <div className="flex flex-col gap-4 rounded-3xl bg-surface p-4 shadow-surface md:p-5">
          <TaskFiltersBar
            search={searchDraft}
            onSearchChange={setSearchDraft}
            sortBy={sortBy}
            sortDir={sortDir}
            onSortByChange={(value) => setParam('sortBy', value)}
            onSortDirToggle={() => setParam('sortDir', sortDir === 'ASC' ? 'DESC' : 'ASC')}
            sectorIds={sectorIds}
            onSectorChange={(value) => setParam('sectorId', value.join(','))}
            assigneeIds={assigneeIds}
            onAssigneeChange={(value) => setParam('assigneeId', value.join(','))}
            // The same param the pills above the list set, so the two are one
            // filter with two ways in rather than two filters that disagree.
            status={status === 'ALL' ? undefined : status}
            onStatusChange={(value) => setParam('status', value)}
            projectIds={projectIds}
            onProjectChange={(value) => setParam('projectId', value.join(','))}
            sectors={sectors}
            users={users}
            view={view}
            onViewChange={(next) => {
              writePreference(TASK_VIEW_KEY, next);
              // Both ways written out, the list included — it used to clear the
              // param on the grounds that LIST is the app's default and a URL
              // spelling out a default says nothing. That stopped being true the
              // moment a stored preference could *be* the default: with KANBAN
              // remembered, clearing the param on "Lista" handed the fallback
              // back to storage, which said board, and the press did nothing.
              // A choice made on this page now always ends up in the URL, where
              // it outranks what was remembered.
              setParam('view', next);
            }}
            isFiltered={isFiltered}
            // The way in, at the top right of the section rather than at the
            // foot of the list: a full-width button after the last row was only
            // reachable by scrolling past every task, and it grew further away
            // the more tasks there were. The Dashboard's own list already puts
            // its "add" in this corner, so the two now match.
            action={
              <Button
                isIconOnly
                variant="primary"
                className="shrink-0 rounded-full"
                aria-label={strings.task.addTask}
                onPress={() => setCreateOpen(true)}
              >
                <Plus className="size-4" />
              </Button>
            }
          />

          {/* The counts live on the filters now rather than in a card of their
              own: every one of them was a number attached to a view of this
              list, and the pill that opens that view is where the number was
              always going to be read.

              Off the board entirely: the board's four columns *are* the split by
              status, and pressing one of these on it would empty three of them
              to fill the one you asked for. */}
          {view === TaskView.LIST ? (
            <TaskStatusPills
              value={status}
              onChange={(value) => setParam('status', value === 'ALL' ? undefined : value)}
              counts={summary}
            />
          ) : null}

          {isLoading ? (
            <p className="py-8 text-center text-muted">{strings.common.loading}</p>
          ) : ordered.length === 0 ? (
            <p className="py-8 text-center text-muted">{strings.tasksPage.empty}</p>
          ) : view === TaskView.KANBAN ? (
            <TaskKanban tasks={ordered} onReorder={reorder} />
          ) : (
            // Ten rows, and the rest a scroll away — with the last one fading
            // into the card rather than ending on a cut. See TaskListScroll.
            <TaskListScroll count={ordered.length}>
              {ordered.map((task) => (
                <TaskReorderRow
                  key={task.id}
                  id={task.id}
                  dragId={dragId}
                  overId={overId}
                  dragHeight={dragHeight}
                  // Which edge of the row being hovered the dragged one will land
                  // on. Above when it is travelling up the list, below when down
                  // — the same rule reorderTasks applies to the stored order.
                  insertAbove={visibleIds.indexOf(dragId ?? '') > visibleIds.indexOf(task.id)}
                  onDragStart={(height) => {
                    setDragHeight(height);
                    setDragId(task.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverId(null);
                  }}
                  onDragOver={() => setOverId(task.id)}
                  onDragLeave={() =>
                    setOverId((current) => (current === task.id ? null : current))
                  }
                  onDrop={(draggedId) => handleDrop(draggedId, task.id)}
                >
                  <TaskCard task={task} />
                </TaskReorderRow>
              ))}
            </TaskListScroll>
          )}
        </div>
      </div>

      {taskId ? <TaskModal taskId={taskId} onClose={() => navigate(closeTo)} /> : null}
      {isCreateOpen ? <NewTaskModal onClose={() => setCreateOpen(false)} /> : null}
    </div>
  );
}
