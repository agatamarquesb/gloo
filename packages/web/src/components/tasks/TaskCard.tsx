import { ClipboardList, Paperclip, RotateCcw, Trash2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';

import type { TaskListItemDto, TaskStatus } from '@gloo/shared';

import { AppCheckbox } from '@/components/common/AppCheckbox';
import { useMe } from '@/hooks/queries/auth';
import { useDeleteTask, useUpdateTaskStatus } from '@/hooks/queries/tasks';
import { playSound } from '@/lib/sounds';
import { formatLongDate, formatShortDate } from '@/lib/formatDate';
import { canMutateEntity } from '@/lib/permissions';
import { strings } from '@/strings/pt-BR';
import { blockRowAction, quietTextButton } from '@/theme/styleConstants';

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
const STATUS_COLUMN = 'flex w-32 shrink-0 justify-start';

/**
 * What a task card sits on in the dark theme.
 *
 * Nothing, in the light one: a row is an outline on the section's own white and
 * a board tile is the palest grey, and both read as objects because everything
 * around them is brighter. On the dark card there is nothing brighter — a row
 * drawn as an outline alone was a hairline around the same near-black as the
 * box behind it, and the board tile at 40% of the neutral was within a couple of
 * points of it. Both take a real step up now, so a card reads as a card before
 * you find its edge.
 *
 * The hover is a further step up from this rather than down — see --row-hover in
 * the dark block, which had to move for the same reason.
 */
const CARD_FILL_DARK = 'dark:bg-default/60';
/**
 * The board tile's own ground, light and dark. Written out rather than composed
 * from `quietSurface`: that constant already names a dark fill, and two
 * `dark:bg-*` utilities on one element are settled by the order Tailwind emits
 * them in rather than by the order they are written here.
 */
const CARD_FILL = `bg-background/50 ${CARD_FILL_DARK}`;

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
  selectable = false,
  alwaysShowSelect = false,
  isSelected = false,
  onSelectChange,
  trashed = false,
  onRestore,
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
  /**
   * Whether the row carries a tick box for the bulk delete.
   *
   * It sits in front of the title and appears under the pointer, which is the
   * whole of its design: a list you are reading should not be a list of forty
   * empty boxes, and a row you are pointing at is the one row where "this one"
   * is a question worth offering an answer to. Ticked, it stays put — a
   * selection that vanished when the pointer left would be a selection you could
   * not see.
   *
   * List rows only. The board's card is a tile in a column you drag things
   * between, and a checkbox on the same surface as a drag handle asks two things
   * of one press.
   */
  selectable?: boolean;
  /**
   * The same box, always drawn rather than only on hover — for "Selecionar
   * tarefas", where picking rows *is* what the list is for, and for the Lixeira,
   * where every row is a candidate for the same two buttons.
   */
  alwaysShowSelect?: boolean;
  isSelected?: boolean;
  onSelectChange?: (isSelected: boolean) => void;
  /**
   * Whether this row is being shown from the trash.
   *
   * A deleted task has no status to set and no place in an arrangement, so the
   * chip goes and "Recuperar" takes the cell — the same word, the same glyph and
   * the same green-on-hover the Routines trash puts on its own rows.
   */
  trashed?: boolean;
  onRestore?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: me } = useMe();
  const updateStatus = useUpdateTaskStatus(task.id);
  const deleteTask = useDeleteTask();

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
    // `group/task` so the tick box in front of the title can answer the row's
    // own hover rather than each row having to hold a hovered flag in state.
    //
    // The board tile's top edge follows the title's colour: green on a task in
    // hand, the overdue red on one that is late. It is the same fact the name
    // under it is written in and the same fact the bar further down is drawn in
    // — one statement about the card, said on every part of it that carries
    // colour, rather than a red heading in a green frame.
    <div
      className={`gloo-rise group/task relative flex w-full flex-col text-left transition-[background-color,transform] duration-200 motion-safe:hover:scale-[1.015] ${
        board
          ? `gap-3 rounded-2xl border-2 border-transparent px-4 py-3.5 ${
              task.isOverdue ? 'border-t-overdue-ink' : 'border-t-green'
            } ${CARD_FILL} hover:bg-default/40 dark:hover:bg-row-hover`
          : `gap-3 rounded-2xl border border-outline-green p-4 hover:bg-row-hover dark:hover:bg-row-hover sm:flex-row sm:items-center sm:gap-4 ${
              // A ticked row wears the same pale green the pointer leaves behind
              // it. Its own colour would be a third state to learn; this one
              // already means "this row, right now", which is what a selection
              // is — held rather than passing.
              isSelected ? 'bg-row-hover dark:bg-row-hover' : `bg-transparent ${CARD_FILL_DARK}`
            }`
      }`}
    >
      <button
        type="button"
        onClick={open}
        aria-label={task.title}
        className="absolute inset-0 cursor-pointer rounded-2xl active:scale-[0.995]"
      />

      {/* The board's way to be rid of a card, in its top right corner and only
          while the pointer is on it: a column of tiles each wearing a bin is a
          column of invitations to destroy something, and the list down the page
          has its tick boxes for the same job. After the click target rather than
          before it, so it takes the presses that land on it.

          Reversible, like every other "Deletar" in the app — the card goes to
          the Lixeira, not away. The title reserves its width (see `pr-6` below)
          so nothing moves when it appears. */}
      {board && canEdit ? (
        <button
          type="button"
          aria-label={strings.task.deleteTask}
          // The card's group is a *named* one (`group/task`, so the tick box on
          // a list row can read it), and an unnamed `group-hover:` matches only
          // a plain `.group` — which is why this spells the name out instead of
          // reusing blockRowActionOnHover.
          className={`${blockRowAction} pointer-events-auto absolute right-3 top-3 z-10 opacity-0 transition-opacity group-hover/task:opacity-100 focus-visible:opacity-100`}
          disabled={deleteTask.isPending}
          onClick={() => {
            playSound('delete');
            deleteTask.mutate(task.id);
          }}
        >
          <Trash2 className="size-4" />
        </button>
      ) : null}

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
          } ${compact ? 'text-sm' : ''} ${board ? 'pr-6' : ''}`}
        >
          {/* Ahead of everything the title carries — the overdue mark included —
              because it is not about the task, it is what you are about to do
              with it. Hidden rather than faded when the pointer is elsewhere, so
              it takes no width until it is there: the title then simply steps
              aside by the box's own width instead of leaving a gap where a
              control might one day appear. `pointer-events-auto` opts back out
              of the click-through layer the title sits in, so ticking a row is
              not opening it. */}
          {selectable ? (
            <span
              className={`pointer-events-auto shrink-0 ${
                alwaysShowSelect || isSelected ? 'flex' : 'hidden group-hover/task:flex'
              }`}
            >
              <AppCheckbox
                quiet
                isSelected={isSelected}
                onChange={(next) => onSelectChange?.(next)}
              >
                <span className="sr-only">{strings.tasksPage.trash.select}</span>
              </AppCheckbox>
            </span>
          ) : null}

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
          <TaskProgressBar
            value={task.progress}
            className="w-full"
            outputRight
            isOverdue={task.isOverdue}
          />

          {/* Both on the left edge and stacked, what is *in* the card over who
              has it. Opposite corners is how a row reads — it has one line and
              two ends — but a tile is read downward, and a pair of marks held
              against the far margin of a 300px column looked like a second
              column of its own rather than like part of the card. */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <SubtaskMark count={task.subtaskCount} className="size-4" />
              <AttachmentCount count={task.attachmentCount} />
            </div>
            <AssigneeAvatars assignees={task.assignees} compact withName />
          </div>
        </div>
      ) : (
        // Meta collapses under the title on phones instead of squeezing the
        // title into an unreadable column beside it.
        <div className="relative flex shrink-0 items-center justify-between gap-3 sm:justify-end sm:gap-4">
          {trashed ? (
            // A deleted row keeps its name and its date and gives up the rest:
            // how far along it got, what is inside it, who had it. None of that
            // is a question you ask about something in a bin — what you are
            // deciding there is whether it comes back — so the only thing on
            // this end of the row is the way to bring it back.
            //
            // Green on hover rather than the usual darkening: everything else
            // reachable from the bin destroys, and this is the one control that
            // gives something back. The deep green, not the brand one, which is
            // a fill colour and does not hold up as text. Important, because it
            // overrides the hover the shared class already sets.
            <button
              type="button"
              className={`${quietTextButton} pointer-events-auto gap-1 text-xs font-semibold hover:text-green-deep!`}
              onClick={onRestore}
            >
              <RotateCcw className="size-3.5" strokeWidth={2.75} />
              {strings.routine.trash.restore}
            </button>
          ) : (
            <>
              <TaskProgressBar
                value={task.progress}
                className="pointer-events-none w-20 sm:w-28"
                isOverdue={task.isOverdue}
              />

              {/* The one thing on the row you can change without opening it:
                  pressing the status opens the three options rather than the
                  task. */}
              <div className={`pointer-events-auto ${STATUS_COLUMN}`}>
                <TaskStatusChipSelect
                  status={task.status}
                  isDisabled={!canEdit}
                  onChange={(status: TaskStatus) => updateStatus.mutate(status)}
                />
              </div>

              <SubtaskMark count={task.subtaskCount} />
              <AttachmentCount count={task.attachmentCount} />

              {/* A cell with a floor rather than the stack on its own: a task
                  with nobody on it drew nothing at all, and everything before it
                  on the row — the marks, the pill, the bar — slid right by
                  exactly one avatar. `min-w-8` is one disc's width, so a row
                  with nobody and a row with somebody line up; two or more still
                  push, which is the stack growing rather than appearing. */}
              <div className="pointer-events-none flex min-w-8 shrink-0 justify-end">
                <AssigneeAvatars assignees={task.assignees} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
