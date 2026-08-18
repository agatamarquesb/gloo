import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@heroui/react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';

import type { TaskFilters, TaskSortBy, TaskStatusFilter } from '@gloo/shared';

import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskFiltersBar } from '@/components/tasks/TaskFiltersBar';
import { NewTaskModal, TaskModal } from '@/components/tasks/TaskModal';
import { TaskStatusPills } from '@/components/tasks/TaskStatusPills';
import { PageHeader } from '@/components/layout/PageHeader';
import { useDebouncedValue } from '@/hooks/ui/useDebouncedValue';
import { useSectors } from '@/hooks/queries/sectors';
import { useTasks } from '@/hooks/queries/tasks';
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

  const { data: tasks = [], isLoading } = useTasks(filters);
  const { data: sectors = [] } = useSectors();
  const { data: users = [] } = useUsers();

  return (
    <div>
      <PageHeader title={strings.nav.tasks} />

      <div className="px-4 pb-6 md:px-6">
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
          />

          <TaskStatusPills
            value={status}
            onChange={(value) => setParam('status', value === 'ALL' ? undefined : value)}
          />

          <div className="flex flex-col gap-2">
            {isLoading ? (
              <p className="py-8 text-center text-muted">{strings.common.loading}</p>
            ) : tasks.length === 0 ? (
              <p className="py-8 text-center text-muted">Nenhuma tarefa encontrada.</p>
            ) : (
              tasks.map((task) => <TaskCard key={task.id} task={task} />)
            )}

            <Button
              variant="outline"
              fullWidth
              className="mt-2 rounded-2xl"
              onPress={() => setCreateOpen(true)}
            >
              <Plus className="size-4" />
              {strings.task.addTask}
            </Button>
          </div>
        </div>
      </div>

      {taskId ? <TaskModal taskId={taskId} onClose={() => navigate(closeTo)} /> : null}
      {isCreateOpen ? <NewTaskModal onClose={() => setCreateOpen(false)} /> : null}
    </div>
  );
}
