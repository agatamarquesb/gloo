import { ClipboardList, Paperclip } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';

import type { TaskListItemDto, TaskStatus } from '@gloo/shared';

import { useMe } from '@/hooks/queries/auth';
import { useUpdateTaskStatus } from '@/hooks/queries/tasks';
import { formatLongDate, formatShortDate } from '@/lib/formatDate';
import { canMutateEntity } from '@/lib/permissions';
import { strings } from '@/strings/pt-BR';

import { AssigneeAvatars } from './AssigneeAvatars';
import { TaskProgressBar } from './TaskProgressBar';
import { OverdueMark } from './StatusChip';
import { TaskStatusChipSelect } from './TaskStatusChipSelect';

/**
 * The status pill hugs its own label, so no two are the same width. This is the
 * cell it sits in: fixed, and left-aligned inside, so every row's pill starts on
 * one edge however long its label is. Sized to the longest — "em andamento".
 */
const STATUS_COLUMN = 'flex w-28 shrink-0 justify-start';

export function TaskCard({
  task,
  onOpen,
  compact = false,
}: {
  task: TaskListItemDto;
  /**
   * How to show the task. Given, the caller opens it where it stands — which is
   * what the Dashboard wants, so its modal lays over the Dashboard rather than
   * over the Tasks page. Omitted, the row routes to /tasks/:id.
   */
  onOpen?: () => void;
  /**
   * The Dashboard's version of the row: half the width it has on the Tasks page,
   * and sat beside the Routines card.
   *
   * Two things follow from that. The date is written short — "31 de jul. 2026"
   * rather than in full, which was the first thing to start crowding the sector
   * beside it. And the title and the line under it are set to a routine's own
   * sizes, so a task and a routine read as two of the same kind of thing rather
   * than as two levels of the app.
   */
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: me } = useMe();
  const updateStatus = useUpdateTaskStatus(task.id);

  const dueDate = compact ? formatShortDate(task.dueDate) : formatLongDate(task.dueDate);
  const canEdit = canMutateEntity(me, {
    createdById: task.createdById,
    assigneeIds: task.assignees.map((assignee) => assignee.id),
  });

  function open() {
    if (onOpen) {
      onOpen();
      return;
    }
    // Carry where the row was clicked from, so closing the task modal returns
    // here rather than dumping you on the Tasks page.
    navigate(`/tasks/${task.id}`, { state: { from: location.pathname } });
  }

  return (
    // A div with a click target stretched behind it, not a button around
    // everything: the row now holds a status dropdown, and a control cannot live
    // inside a button. The content layer is click-through and the status opts
    // back in — see `pointer-events-auto` below.
    //
    // motion-safe on the hover lift: it's decoration, so it goes away under
    // prefers-reduced-motion while the colour change stays.
    <div className="gloo-rise relative flex w-full flex-col gap-3 rounded-2xl border border-outline-green bg-transparent p-4 text-left transition-[background-color,transform] duration-200 hover:bg-default/40 motion-safe:hover:scale-[1.015] sm:flex-row sm:items-center sm:gap-4">
      <button
        type="button"
        onClick={open}
        aria-label={task.title}
        className="absolute inset-0 cursor-pointer rounded-2xl active:scale-[0.995]"
      />

      {/* Compact, the title takes a routine title's text-sm and the line under it
          the text-xs a routine's date carries — see `compact` above. */}
      <div className="pointer-events-none relative min-w-0 flex-1">
        {/* The mark ends the title rather than joining the meta line under it:
            the date on that line is the *due* date either way, and what is worth
            noticing at a glance is that this row is late. */}
        <p
          className={`flex items-center gap-1.5 font-medium text-surface-foreground ${
            compact ? 'text-sm' : ''
          }`}
        >
          <span className="truncate">{task.title}</span>
          {task.isOverdue ? <OverdueMark /> : null}
        </p>
        <p className={`truncate text-muted ${compact ? 'text-xs' : 'text-sm'}`}>
          {dueDate ? `${dueDate} · ` : ''}
          {task.sector.name}
        </p>
      </div>

      {/* Meta collapses under the title on phones instead of squeezing the
          title into an unreadable column beside it. */}
      <div className="relative flex shrink-0 items-center justify-between gap-3 sm:justify-end sm:gap-4">
        <TaskProgressBar value={task.progress} className="pointer-events-none w-20 sm:w-28" />

        {/* The one thing on the row you can change without opening it: pressing
            the status opens the three options rather than the task. */}
        <div className={`pointer-events-auto ${STATUS_COLUMN}`}>
          <TaskStatusChipSelect
            status={task.status}
            isDisabled={!canEdit}
            onChange={(status: TaskStatus) => updateStatus.mutate(status)}
          />
        </div>

        {/* Subtask marker, always shown so the row's columns stay aligned; only
            the dot is conditional. A checklist rather than a notebook of lines:
            what it answers is "is there a list inside this one?", which is also
            what the progress bar to its left is measuring. */}
        <span
          className="pointer-events-none relative shrink-0 text-muted"
          title={task.subtaskCount > 0 ? strings.task.hasSubtasks : strings.task.noSubtasks}
        >
          <ClipboardList className="size-5" aria-hidden />
          {task.subtaskCount > 0 ? (
            <>
              {/* The dot alone, with no ring: at this size the halo read as a
                  second, paler ring around it rather than as separation from the
                  icon underneath. */}
              <span
                aria-hidden
                className="absolute -right-1 -top-1 size-2.5 rounded-full bg-danger"
              />
              <span className="sr-only">{strings.task.hasSubtasks}</span>
            </>
          ) : null}
        </span>

        {/* Attachment count, beside the subtask marker: the two answer the same
            question — what else is in here — so they read as a pair. Always
            shown, zero included, so the row's columns stay aligned. */}
        <span
          className="pointer-events-none flex shrink-0 items-center gap-1 text-muted"
          title={strings.task.attachmentCount}
        >
          <Paperclip className="size-4" aria-hidden />
          <span className="text-xs">{task.attachmentCount}</span>
        </span>

        <div className="pointer-events-none">
          <AssigneeAvatars assignees={task.assignees} />
        </div>
      </div>
    </div>
  );
}
