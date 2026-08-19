import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@heroui/react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';

import type { TaskFilters, TaskSortBy, TaskStatusFilter } from '@gloo/shared';

import { CalendarCard } from '@/components/dashboard/CalendarCard';
import { ProjectsCard } from '@/components/tasks/ProjectsCard';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskFiltersBar } from '@/components/tasks/TaskFiltersBar';
import { TaskPerformanceCard } from '@/components/tasks/TaskPerformanceCard';
import { NewTaskModal, TaskModal } from '@/components/tasks/TaskModal';
import { TaskStatusPills } from '@/components/tasks/TaskStatusPills';
import { PageHeader } from '@/components/layout/PageHeader';
import { useDebouncedValue } from '@/hooks/ui/useDebouncedValue';
import { useSectors } from '@/hooks/queries/sectors';
import { useTasks, useTaskSummary } from '@/hooks/queries/tasks';
import { useUsers } from '@/hooks/queries/users';
import { strings } from '@/strings/pt-BR';

type StatusPillValue = TaskStatusFilter | 'ALL';

export function TasksPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCreateOpen, setCreateOpen] = useState(false);

  // TaskCard stamps the route it was clicked from, so a task opened from the
  // Dashboard closes back to the Dashboard. Falls back to the list for a URL
  // pasted straight into the address bar, which carries no state.
  const closeTo = (location.state as { from?: string } | null)?.from ?? '/tasks';

  // Filters live in the URL so the Dashboard cards can deep-link into a
  // pre-filtered Tasks view, and so filtered views stay shareable/bookmarkable.
  const [searchParams, setSearchParams] = useSearchParams();

  const status = (searchParams.get('status') ?? 'ALL') as StatusPillValue;
  const search = searchParams.get('search') ?? '';
  const sectorId = searchParams.get('sectorId') ?? undefined;
  const assigneeId = searchParams.get('assigneeId') ?? undefined;
  const sortBy = (searchParams.get('sortBy') as TaskSortBy | null) ?? undefined;
  const sortDir = (searchParams.get('sortDir') as 'ASC' | 'DESC' | null) ?? 'ASC';
  const dueDateFrom = searchParams.get('dueDateFrom') ?? undefined;
  const dueDateTo = searchParams.get('dueDateTo') ?? undefined;

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
            sectorId={sectorId}
            onSectorChange={(value) => setParam('sectorId', value)}
            assigneeId={assigneeId}
            onAssigneeChange={(value) => setParam('assigneeId', value)}
            sectors={sectors}
            users={users}
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
              always going to be read. */}
          <TaskStatusPills
            value={status}
            onChange={(value) => setParam('status', value === 'ALL' ? undefined : value)}
            counts={summary}
          />

          <div className="flex flex-col gap-2">
            {isLoading ? (
              <p className="py-8 text-center text-muted">{strings.common.loading}</p>
            ) : tasks.length === 0 ? (
              <p className="py-8 text-center text-muted">{strings.tasksPage.empty}</p>
            ) : (
              tasks.map((task) => <TaskCard key={task.id} task={task} />)
            )}
          </div>
        </div>
      </div>

      {taskId ? <TaskModal taskId={taskId} onClose={() => navigate(closeTo)} /> : null}
      {isCreateOpen ? <NewTaskModal onClose={() => setCreateOpen(false)} /> : null}
    </div>
  );
}
