import { useNavigate } from 'react-router';

import type { TaskListItemDto } from '@gloo/shared';

import { AssigneeAvatars } from './AssigneeAvatars';
import { StatusChip } from './StatusChip';
import { TaskProgressBar } from './TaskProgressBar';

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function TaskCard({ task }: { task: TaskListItemDto }) {
  const navigate = useNavigate();
  const dueDate = formatDate(task.dueDate);

  return (
    <button
      type="button"
      onClick={() => navigate(`/tasks/${task.id}`)}
      className="gloo-rise flex w-full flex-col gap-3 rounded-2xl bg-background p-4 text-left transition-[background-color,transform] duration-200 hover:bg-background-tertiary active:scale-[0.995] sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-surface-foreground">{task.title}</p>
        <p className="truncate text-sm text-muted">
          {dueDate ? `${dueDate} · ` : ''}
          {task.sector.name}
        </p>
      </div>

      {/* Meta collapses under the title on phones instead of squeezing the
          title into an unreadable column beside it. */}
      <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end sm:gap-4">
        <StatusChip status={task.status} isOverdue={task.isOverdue} />
        <TaskProgressBar value={task.progress} className="w-20 sm:w-28" />
        <AssigneeAvatars assignees={task.assignees} />
      </div>
    </button>
  );
}
