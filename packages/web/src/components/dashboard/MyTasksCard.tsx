import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@heroui/react';

import type { TaskFilters, TaskStatusFilter } from '@gloo/shared';

import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskStatusPills } from '@/components/tasks/TaskStatusPills';
import { useMe } from '@/hooks/queries/auth';
import { useTasks } from '@/hooks/queries/tasks';
import { strings } from '@/strings/pt-BR';

import { DashboardCard } from './DashboardCard';

const VISIBLE_LIMIT = 5;

export function MyTasksCard({ onAddTask }: { onAddTask: () => void }) {
  const { data: me } = useMe();
  const [status, setStatus] = useState<TaskStatusFilter | 'ALL'>('ALL');

  const filters: TaskFilters = { status, assigneeId: me?.id };
  const { data: tasks = [], isLoading } = useTasks(filters);

  return (
    <DashboardCard
      title={strings.dashboard.myTasks}
      action={
        <Button isIconOnly variant="secondary" aria-label={strings.task.addTask} onPress={onAddTask}>
          <Plus className="size-4" />
        </Button>
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
