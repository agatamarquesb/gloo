import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@heroui/react';

import type { TaskFilters, TaskStatusFilter } from '@gloo/shared';

import { SearchField } from '@/components/common/SearchField';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskStatusPills } from '@/components/tasks/TaskStatusPills';
import { useDebouncedValue } from '@/hooks/ui/useDebouncedValue';
import { useMe } from '@/hooks/queries/auth';
import { useTasks } from '@/hooks/queries/tasks';
import { strings } from '@/strings/pt-BR';

import { DashboardCard } from './DashboardCard';

const VISIBLE_LIMIT = 5;

export function MyTasksCard({ onAddTask }: { onAddTask: () => void }) {
  const { data: me } = useMe();
  const [status, setStatus] = useState<TaskStatusFilter | 'ALL'>('ALL');
  const [search, setSearch] = useState('');

  // Same treatment as the Tasks page: the field stays instant while the query
  // key lags behind it, so typing a word costs one request, not one per key.
  const debouncedSearch = useDebouncedValue(search, 300);

  const filters: TaskFilters = {
    status,
    assigneeId: me?.id,
    search: debouncedSearch || undefined,
  };
  const { data: tasks = [], isLoading } = useTasks(filters);

  return (
    <DashboardCard
      title={strings.dashboard.myTasks}
      action={
        // Search and add share the header row. The field takes the slack and
        // the button stays fixed, so the pair shrinks gracefully on a phone
        // rather than pushing the card title onto its own line. Narrow on
        // purpose — it filters a five-row list, not a whole page.
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <SearchField value={search} onChange={setSearch} className="min-w-0 flex-1 sm:w-32" />
          <Button
            isIconOnly
            variant="primary"
            className="shrink-0"
            aria-label={strings.task.addTask}
            onPress={onAddTask}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      }
    >
      <TaskStatusPills value={status} onChange={setStatus} slim />

      <div className="flex flex-col gap-2">
        {isLoading ? (
          <p className="py-6 text-center text-muted">{strings.common.loading}</p>
        ) : tasks.length === 0 ? (
          <p className="py-6 text-center text-muted">{strings.dashboard.noTasks}</p>
        ) : (
          tasks.slice(0, VISIBLE_LIMIT).map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </DashboardCard>
  );
}
