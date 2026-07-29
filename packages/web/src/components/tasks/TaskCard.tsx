import { NotebookText } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';

import type { TaskListItemDto } from '@gloo/shared';

import { strings } from '@/strings/pt-BR';

import { AssigneeAvatars } from './AssigneeAvatars';
import { StatusChip } from './StatusChip';
import { TaskProgressBar } from './TaskProgressBar';

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function TaskCard({ task }: { task: TaskListItemDto }) {
  const navigate = useNavigate();
  const location = useLocation();
  const dueDate = formatDate(task.dueDate);

  return (
    <button
      type="button"
      // Carry where the row was clicked from, so closing the task modal returns
      // here — the Dashboard shows these rows too, and it used to dump you on the
      // Tasks page instead.
      onClick={() => navigate(`/tasks/${task.id}`, { state: { from: location.pathname } })}
      // motion-safe on the hover lift: it's decoration, so it goes away under
      // prefers-reduced-motion while the color change stays.
      className="gloo-rise flex w-full flex-col gap-3 rounded-2xl border border-outline-green bg-transparent p-4 text-left transition-[background-color,transform] duration-200 hover:bg-default/40 active:scale-[0.995] motion-safe:hover:scale-[1.015] sm:flex-row sm:items-center sm:gap-4"
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

        {/* Notes marker, always shown so the row's columns stay aligned; only the
            dot is conditional. A span rather than a button — the whole row is
            already one, and nesting buttons is invalid. */}
        <span
          className="relative shrink-0 text-muted"
          title={task.hasDescription ? strings.task.hasNotes : strings.task.noNotes}
        >
          <NotebookText className="size-5" aria-hidden />
          {task.hasDescription ? (
            <>
              {/* ring in the row's own backdrop so the dot stays legible against
                  whatever the icon overlaps. */}
              <span
                aria-hidden
                className="absolute -right-1 -top-1 size-2.5 rounded-full bg-danger ring-2 ring-surface"
              />
              <span className="sr-only">{strings.task.hasNotes}</span>
            </>
          ) : null}
        </span>

        <AssigneeAvatars assignees={task.assignees} />
      </div>
    </button>
  );
}
