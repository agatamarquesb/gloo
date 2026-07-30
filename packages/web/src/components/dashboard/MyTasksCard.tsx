import { useState } from 'react';
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

/**
 * Fixed, not a max: five task rows plus their gaps. The card's height never
 * depends on how many tasks happen to match the filter, and the list always
 * reads as scrollable when there are more.
 */
const LIST_HEIGHT = 'h-[26rem]';

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

  return (
    <DashboardCard title={strings.dashboard.myTasks}>
      {/* One row for everything you do to the list: filter it on the left,
          search it and add to it on the right. None of it belongs in the card's
          header, where it read as part of the title.

          Search and add travel together so the pair stays whole when the row
          wraps, and both are cut to the pills' own height — `size="sm"` for the
          button, `slim` for the field. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TaskStatusPills value={status} onChange={setStatus} slim withOverdue={false} />

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
      ) : tasks.length === 0 ? (
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
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onOpen={() => setOpenTaskId(task.id)} />
            ))}
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
