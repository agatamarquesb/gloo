import { ClipboardList, Paperclip } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';

import type { TaskListItemDto, TaskStatus } from '@gloo/shared';

import { useMe } from '@/hooks/queries/auth';
import { useUpdateTaskStatus } from '@/hooks/queries/tasks';
import { formatLongDate, formatShortDate } from '@/lib/formatDate';
import { canMutateEntity } from '@/lib/permissions';
import { strings } from '@/strings/pt-BR';
import { quietSurface } from '@/theme/styleConstants';

import { AssigneeAvatars } from './AssigneeAvatars';
import { TaskProgressBar } from './TaskProgressBar';
import { OverdueMark } from './StatusChip';
import { TaskStatusChipSelect } from './TaskStatusChipSelect';

/**
 * The status pill hugs its own label, so no two are the same width. This is the
 * cell it sits in: fixed, and left-aligned inside, so every row's pill starts on
 * one edge however long its label is.
 *
 * 7.5rem is the longest pill — "em andamento", which measures 118px — and not a
 * pixel less. At 7rem it overhung the cell by six, which the row's `gap-4` then
 * paid for: the pill sat 10px from the subtask marker after it and 16px from the
 * progress bar before it, so the one thing on the row you can press looked
 * shunted to the right.
 */
const STATUS_COLUMN = 'flex w-30 shrink-0 justify-start';

/**
 * Whether there is a list inside this one.
 *
 * A checklist rather than a notebook of lines: what it answers is the same thing
 * the progress bar beside it is measuring. Always drawn, so a column of rows
 * stays aligned; only the dot is conditional.
 */
function SubtaskMark({ count, className = 'size-5' }: { count: number; className?: string }) {
  return (
    <span
      className="pointer-events-none relative shrink-0 text-muted"
      title={count > 0 ? strings.task.hasSubtasks : strings.task.noSubtasks}
    >
      <ClipboardList className={className} aria-hidden />
      {count > 0 ? (
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
  );
}

/**
 * How many files are on it, beside the subtask mark: the two answer the same
 * question — what else is in here — so they read as a pair. Zero included, for
 * the same alignment reason.
 */
function AttachmentCount({ count }: { count: number }) {
  return (
    <span
      className="pointer-events-none flex shrink-0 items-center gap-1 text-muted"
      title={strings.task.attachmentCount}
    >
      <Paperclip className="size-4" aria-hidden />
      <span className="text-xs">{count}</span>
    </span>
  );
}

export function TaskCard({
  task,
  onOpen,
  compact = false,
  board = false,
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
  /**
   * The card as the board draws it: a solid tile in a quarter-page column,
   * stacked one fact per line — title, then the deadline and sector, then the
   * progress bar, then who it is on with what else is inside it opposite.
   *
   * Stacked however wide the *window* is, which is the point. The row layout
   * below turns on at `sm`, a question about the viewport that only the card's
   * own container can answer: on any desktop that breakpoint says "row", and the
   * meta then overflows a column it was never measured against.
   *
   * No status pill and no green edge, unlike the row. The column the card is
   * sitting in is the status — a pill repeating it inside every card would be
   * the same word four times down a column headed with it — and the outline is
   * the column's now, drawn once around the whole stack rather than once per
   * card. What is left in its place is a fill: the app's one "sitting on the
   * card" grey, the same one a routine row wears on the Dashboard, so the two
   * kinds of tile read as the same kind of object.
   *
   * And one green edge along the top of it. A *border* and not an inset shadow,
   * because it has to follow the two top corners round: a shadow would be
   * clipped square by the radius and stop where the curve begins. The other
   * three sides are the same border in transparent, which is what lets the
   * green taper into them at the corners rather than ending on a cut — and what
   * keeps the tile the same size on all four sides.
   */
  board?: boolean;
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
    // The query string travels with the id, and the origin carries it back.
    //
    // Everything the Tasks page is showing lives in the URL — which view, which
    // filters, which day on the month — so a bare /tasks/:id is not "this task
    // over what I was looking at", it is this task over the page's defaults.
    // Dropping it put the *list* behind a card opened from the board, and closing
    // the dialog then left you on the list you never asked for.
    const here = `${location.pathname}${location.search}`;
    navigate(`/tasks/${task.id}${location.search}`, { state: { from: here } });
  }

  return (
    // A div with a click target stretched behind it, not a button around
    // everything: the row now holds a status dropdown, and a control cannot live
    // inside a button. The content layer is click-through and the status opts
    // back in — see `pointer-events-auto` below.
    //
    // motion-safe on the hover lift: it's decoration, so it goes away under
    // prefers-reduced-motion while the colour change stays.
    //
    // The row is an outline on the card's own white; the board card is a filled
    // tile whose only edge is a green one along its top — see `board`. Which is
    // also why they hover differently: the row's fill is a fifth of the neutral,
    // a wash that reads as the pointer passing over rather than as a selection,
    // while the tile already has a fill and has to step *off* it to answer at
    // all.
    <div
      className={`gloo-rise relative flex w-full flex-col text-left transition-[background-color,transform] duration-200 motion-safe:hover:scale-[1.015] ${
        board
          ? `gap-3 rounded-2xl border-2 border-transparent border-t-green px-4 py-3.5 ${quietSurface} hover:bg-default/40 dark:hover:bg-default/70`
          : 'gap-3 rounded-2xl border border-outline-green bg-transparent p-4 hover:bg-row-hover sm:flex-row sm:items-center sm:gap-4'
      }`}
    >
      <button
        type="button"
        onClick={open}
        aria-label={task.title}
        className="absolute inset-0 cursor-pointer rounded-2xl active:scale-[0.995]"
      />

      {/* Compact, the title takes a routine title's text-sm and the line under it
          the text-xs a routine's date carries — see `compact` above. */}
      <div className={`pointer-events-none relative min-w-0 flex-1 ${board ? 'space-y-1' : ''}`}>
        {/* The mark leads the title rather than joining the meta line under it:
            the date on that line is the *due* date either way, and what is worth
            noticing at a glance is that this row is late — which is also why the
            name goes red and a step heavier with it.

            In front, not after, because that is where a list is read from: down
            the left edge, one title at a time, and a mark at the end of a name
            of unknown length is somewhere different on every row. It is also the
            one place a long name cannot push it out of sight — the title
            truncates, and anything after it would go with the last word. The
            deadline row in the dialog keeps its mark on the right, where it
            follows the date it is late against rather than heading a list.

            A step heavier, one step and not two: a late row has to be the first
            thing your eye lands on in a list of rows that otherwise look alike,
            and the colour alone was doing that only on the second look. The
            dialog does not follow, deliberately: there is one task in it, so
            there is nothing for it to stand out from. */}
        <p
          className={`flex items-center gap-1.5 ${
            task.isOverdue
              ? 'font-semibold text-overdue-ink'
              : 'font-medium text-surface-foreground'
          } ${compact ? 'text-sm' : ''}`}
        >
          {task.isOverdue ? <OverdueMark /> : null}
          <span className="truncate">{task.title}</span>
        </p>
        <p className={`truncate text-muted ${compact ? 'text-xs' : 'text-sm'}`}>
          {dueDate ? `${dueDate} · ` : ''}
          {task.sector.name}
        </p>
      </div>

      {board ? (
        // One fact per line, in the order they are read: how far along, then who
        // has it and what is inside it.
        <div className="pointer-events-none relative flex flex-col gap-3">
          {/* Right-aligned figure, so the bar's cell ends on the same margin the
              line under it ends on — see `outputRight`. */}
          <TaskProgressBar value={task.progress} className="w-full" outputRight />

          {/* The avatars keep the left edge and the two marks the right, and
              `ml-auto` rather than `justify-between` is what holds that when a
              task has nobody on it: AssigneeAvatars draws nothing at all then,
              and a lone child of a spread row goes to the left. */}
          <div className="flex items-center gap-2">
            <AssigneeAvatars assignees={task.assignees} compact withName />
            <div className="ml-auto flex items-center gap-2">
              <SubtaskMark count={task.subtaskCount} className="size-4" />
              <AttachmentCount count={task.attachmentCount} />
            </div>
          </div>
        </div>
      ) : (
        // Meta collapses under the title on phones instead of squeezing the
        // title into an unreadable column beside it.
        <div className="relative flex shrink-0 items-center justify-between gap-3 sm:justify-end sm:gap-4">
          <TaskProgressBar
            value={task.progress}
            className="pointer-events-none w-20 sm:w-28"
          />

          {/* The one thing on the row you can change without opening it: pressing
              the status opens the three options rather than the task. */}
          <div className={`pointer-events-auto ${STATUS_COLUMN}`}>
            <TaskStatusChipSelect
              status={task.status}
              isDisabled={!canEdit}
              onChange={(status: TaskStatus) => updateStatus.mutate(status)}
            />
          </div>

          <SubtaskMark count={task.subtaskCount} />
          <AttachmentCount count={task.attachmentCount} />

          <div className="pointer-events-none">
            <AssigneeAvatars assignees={task.assignees} />
          </div>
        </div>
      )}
    </div>
  );
}
