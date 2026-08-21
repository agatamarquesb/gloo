import { useState } from 'react';
import { Plus } from 'lucide-react';

import { TaskStatus, type TaskListItemDto } from '@gloo/shared';

import { useSetTaskStatus } from '@/hooks/queries/tasks';
import { strings } from '@/strings/pt-BR';

import { TaskCard } from './TaskCard';
import { TaskListScroll } from './TaskListScroll';
import { TaskReorderRow } from './TaskReorderRow';
import { NewTaskModal } from './TaskModal';

/**
 * The four columns, in the order work moves through them — with "Atrasada"
 * before "Feitas" rather than after it.
 *
 * A late task is unfinished work, and the board is read left to right as a
 * queue: everything still to do should be passed before the pile that is done
 * with. Last, "Atrasada" sat past the end of that queue, which is the one place
 * on the board a person is not looking for the tasks that need them most.
 */
const COLUMNS = [
  { status: TaskStatus.TODO, label: strings.task.status.TODO },
  { status: TaskStatus.IN_PROGRESS, label: strings.task.status.IN_PROGRESS },
  { status: TaskStatus.OVERDUE, label: strings.task.filters.overdue },
  { status: TaskStatus.DONE, label: strings.task.filters.done },
] as const;

/** How many cards a column stands before the rest become a scroll. */
const COLUMN_CARDS = 8;

/** The "+" at the head of a column, and the empty box that balances it. */
const BUTTON_GUTTER = 'size-3.5 shrink-0';

/**
 * The card in the air: which one it is, which one it is over, and how tall it is
 * — the height being what the gap opened for it is drawn at.
 */
interface DragState {
  id: string | null;
  overId: string | null;
  height: number;
}

const NOT_DRAGGING: DragState = { id: null, overId: null, height: 0 };

/**
 * Which column a task belongs in.
 *
 * Lateness wins over the status, and deliberately: `isOverdue` is what the row's
 * own chip says — true whether somebody marked the task late or its deadline
 * simply passed — so a task that reads "atrasada" everywhere else in the app has
 * to be in the column with that name. Sorting by status alone would leave a late
 * task sitting in "A fazer" wearing a red chip, next to an empty "Atrasada".
 *
 * A partition and not four filters, so no task is drawn twice. That is the one
 * place this parts company with the pills above the list, whose counts overlap
 * on purpose — a pill answers "how many are late", which includes the ones it
 * also counts under "a fazer"; a column has to put each card in one place.
 */
function columnOf(task: TaskListItemDto): TaskStatus {
  return task.isOverdue ? TaskStatus.OVERDUE : task.status;
}

/** One column's own drop state, so only the column under the pointer lights up. */
function TaskKanbanColumn({
  status,
  label,
  tasks,
  boardIds,
  drag,
  setDrag,
  onDropTask,
  onReorderTask,
  onAddTask,
}: {
  status: TaskStatus;
  label: string;
  tasks: TaskListItemDto[];
  /** Every card on the board, in the order it is drawn — see `insertAbove`. */
  boardIds: string[];
  drag: DragState;
  setDrag: (next: DragState | ((current: DragState) => DragState)) => void;
  onDropTask: (status: TaskStatus, taskId: string) => void;
  /** The dragged card, and the one it was dropped on — which is where it goes. */
  onReorderTask: (draggedId: string, targetId: string) => void;
  onAddTask: (status: TaskStatus) => void;
}) {
  const [isOver, setOver] = useState(false);

  return (
    <div
      onDragOver={(event) => {
        // preventDefault is what marks the column as a drop target; without it
        // the browser refuses the drop outright.
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        // Which card was dropped comes off the drag itself rather than out of
        // component state — see the payload set on dragstart below. Anything
        // dragged in from outside carries an id that matches no task, and the
        // board simply does nothing with it.
        onDropTask(status, event.dataTransfer.getData('text/plain'));
      }}
      // A hairline of the app's green around the whole column, and the cards
      // inside it filled and edgeless: the outline that used to be drawn once per
      // card is drawn once per column instead, so what you see is four containers
      // holding tiles rather than a grid of outlined boxes.
      //
      // Solid rather than dashed, and always there rather than only while
      // something is in the air — the column is a real container now, not a
      // target that appears when you aim at it. What the drag adds is the fill:
      // the palest step of that same green, so the column you are over lights up
      // without a second edge appearing inside the first.
      className={`flex min-w-0 flex-col gap-2 rounded-2xl border border-outline-green px-3 pb-3 pt-2 transition-colors ${
        isOver ? 'bg-row-hover' : 'bg-transparent'
      }`}
    >
      {/* The name and how many are under it, on one line — the count is the
          thing you read a column header for. `pt-1.5` stands the pair off the
          column's own edge: at the top of a bordered box the heading was sitting
          on the hairline it is inside.

          The count is a green pill rather than a grey one. Grey is what this app
          writes *quiet* things in, and the figure at the head of a column is the
          opposite — it is the one number the header exists to give. Black on the
          brand green, the same pairing every filled control in the app uses. */}
      <div className="flex items-center justify-between gap-2 px-1 pt-1.5">
        <p className="truncate text-sm font-medium text-surface-foreground">{label}</p>
        <span className="shrink-0 rounded-md bg-green px-1.5 py-0.5 text-xs font-medium tabular-nums text-black">
          {tasks.length}
        </span>
      </div>

      {/* The way in, under the column's name and above the first card.
          Full-width and quiet — an outline in the column's own green with no
          fill, so four of them across the board do not read as four buttons
          shouting over the cards they head.

          Per column rather than once for the board, because the column is the
          status: a task added under "Em andamento" is one that has been started,
          and this is the only place in the app where that can be said while
          creating it. See `defaultStatus` in NewTaskModal for how it gets
          there. */}
      <button
        type="button"
        onClick={() => onAddTask(status)}
        className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-outline-green px-2 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-row-hover hover:text-surface-foreground"
      >
        <Plus className={BUTTON_GUTTER} aria-hidden />
        {strings.tasksPage.newTask}
        {/* An empty box the width of the glyph, so the label is centred on the
            button rather than shunted right of centre by it. Without it the
            words sit 10px — half the glyph and its gap — to the right of the
            button's own middle, which is nothing at all until the column is
            empty and "Nada por aqui" is centred underneath them. */}
        <span aria-hidden className={BUTTON_GUTTER} />
      </button>

      {tasks.length === 0 ? (
        <p className="px-1 py-6 text-center text-xs text-muted">
          {strings.tasksPage.emptyColumn}
        </p>
      ) : (
        // Eight cards, and the ninth a scroll away — the same measured cap and
        // the same fade into the ground the list down the page uses, so a full
        // column ends on a softened edge rather than on a cut. Eight rather than
        // the list's ten because a board card is twice a row's height, and four
        // columns each ten cards tall is a page nobody can see the shape of.
        <TaskListScroll count={tasks.length} rows={COLUMN_CARDS}>
          {tasks.map((task) => (
            // The very row the list down the page rearranges with — the whole
            // card is the handle, and a gap the size of the card you are holding
            // opens where it will land. Shared rather than rebuilt because the
            // board rearranges the same tasks by the same rules, and the payload
            // it puts on the drag is the one the column's own drop reads back.
            <TaskReorderRow
              key={task.id}
              id={task.id}
              dragId={drag.id}
              overId={drag.overId}
              dragHeight={drag.height}
              // Which edge of the card being hovered the dragged one lands on:
              // above when it is travelling up the board's order, below when
              // down. Measured against the whole board rather than this column,
              // and it comes to the same answer — a column is the board's order
              // with cards taken out of it, so two cards in one column sit the
              // same way round in both.
              insertAbove={boardIds.indexOf(drag.id ?? '') > boardIds.indexOf(task.id)}
              onDragStart={(height) => setDrag({ id: task.id, overId: null, height })}
              onDragEnd={() => setDrag(NOT_DRAGGING)}
              onDragOver={() => setDrag((current) => ({ ...current, overId: task.id }))}
              onDragLeave={() =>
                setDrag((current) =>
                  current.overId === task.id ? { ...current, overId: null } : current,
                )
              }
              // Dropped on a card: that is where it goes. The column under it
              // hears the same drop on the way up and sets the status, so a card
              // dragged from one column onto a card in another lands in that
              // column *and* in that place — see handleDrop.
              onDrop={(draggedId) => onReorderTask(draggedId, task.id)}
            >
              <TaskCard task={task} compact board />
            </TaskReorderRow>
          ))}
        </TaskListScroll>
      )}
    </div>
  );
}

/**
 * The tasks as a board: one column per state, and one drag doing both things you
 * can do to a card.
 *
 * Dropped on a *column*, it takes that column's status. Dropped on a *card*, it
 * takes that card's place — within a column, which is how the cards inside one
 * are rearranged, or across two, which does both at once: the column under the
 * card hears the same drop on its way up and sets the status, so a card carried
 * into another column lands exactly where it was aimed rather than at the end.
 *
 * The status pills above the list are hidden while this is on (see TasksPage):
 * the board *is* the split by status, and filtering it to one status would leave
 * three empty columns beside the one you asked for.
 */
export function TaskKanban({
  tasks,
  onReorder,
}: {
  tasks: TaskListItemDto[];
  /**
   * Put the first card where the second one is.
   *
   * The board does not keep the arrangement itself: it is one list of ids held
   * for the whole Tasks page (see myTasksOrder), and the same drag on the list
   * view writes the same list. Rearranging the board is therefore rearranging
   * the list, which is right — they are one person's order for one set of tasks,
   * shown two ways.
   */
  onReorder: (dragId: string, targetId: string) => void;
}) {
  // Named at the drop rather than bound to the card being dragged: the status
  // change never depends on a render having happened between picking a card up
  // and letting it go. See useSetTaskStatus.
  const setStatus = useSetTaskStatus();
  /** The column whose "+ Nova tarefa" was pressed, or null for no dialog. */
  const [addingTo, setAddingTo] = useState<TaskStatus | null>(null);
  /**
   * What is being carried, and where it is hovering.
   *
   * State here and not merely on the drag's own payload, unlike the status
   * change above: this is what *draws* the gap, and a card being carried has to
   * be visible on the board while it travels. The drop still reads the id off
   * the event, so nothing about where the card lands depends on this.
   */
  const [drag, setDrag] = useState<DragState>(NOT_DRAGGING);

  const boardIds = tasks.map((task) => task.id);

  /** Dropping a card on a column is what puts the task in that state. */
  function handleDrop(status: TaskStatus, taskId: string) {
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task) return;
    // Nothing to do when the card came from the column it was dropped on — and
    // nothing to do for a late task dropped back on "Atrasada", which is where
    // it already is without anyone having set that status.
    if (columnOf(task) !== status) setStatus.mutate({ id: task.id, status });
  }

  /** And dropping it on a card is what puts it in that place. */
  function handleReorder(draggedId: string, targetId: string) {
    if (draggedId && draggedId !== targetId) onReorder(draggedId, targetId);
    setDrag(NOT_DRAGGING);
  }

  return (
    <>
      {/* Four across from lg, two abreast below it, one on a phone: a column
          narrower than the card inside it stops being a column.

          `items-start` so each column is only as tall as what is in it. Stretched
          to the row's height, an empty "Atrasada" was a green rectangle as tall
          as the busiest column beside it. */}
      <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((column) => (
          <TaskKanbanColumn
            key={column.status}
            status={column.status}
            label={column.label}
            tasks={tasks.filter((task) => columnOf(task) === column.status)}
            boardIds={boardIds}
            drag={drag}
            setDrag={setDrag}
            onDropTask={handleDrop}
            onReorderTask={handleReorder}
            onAddTask={setAddingTo}
          />
        ))}
      </div>

      {addingTo ? (
        <NewTaskModal defaultStatus={addingTo} onClose={() => setAddingTo(null)} />
      ) : null}
    </>
  );
}
