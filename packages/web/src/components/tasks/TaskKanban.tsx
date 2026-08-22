import { useState } from 'react';

import { TaskStatus, type TaskListItemDto } from '@gloo/shared';

import { useSetTaskStatus } from '@/hooks/queries/tasks';
import { strings } from '@/strings/pt-BR';

import { TaskCard } from './TaskCard';
import { TaskListScroll } from './TaskListScroll';
import { TaskReorderRow } from './TaskReorderRow';

/**
 * The three columns, in the order work moves through them.
 *
 * "Atrasada" is not one of them, and never should have been: late is not a state
 * anybody puts a task into, it is what happens to a task whose deadline passed
 * while it was still in one of these three. Given a column of its own it took
 * tasks *out* of the state their owner had put them in — a late task being
 * worked on vanished from "Em andamento" — so the board stopped answering the
 * one question a board is for.
 *
 * A late task therefore sits in the column its status says, and the card says it
 * is late the way every other list in the app says it: the mark before the name,
 * the name in red, and the tile's top edge and progress bar in the same red. See
 * TaskCard.
 */
const COLUMNS = [
  { status: TaskStatus.TODO, label: strings.task.status.TODO },
  { status: TaskStatus.IN_PROGRESS, label: strings.task.status.IN_PROGRESS },
  { status: TaskStatus.DONE, label: strings.task.filters.done },
] as const;

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
 * Which column a task belongs in: the status its owner set, and nothing else.
 *
 * Lateness used to win over that, which is exactly what the "Atrasada" column
 * cost — see COLUMNS. It has no say here now.
 *
 * The one translation left is for tasks carrying the retired OVERDUE status,
 * marked late by hand back when that was something a person could set. There is
 * no column for it, so they are read as what they actually are: unfinished work,
 * to do. Picking a status on such a card moves it out of the old value for good.
 */
function columnOf(task: TaskListItemDto): TaskStatus {
  return task.status === TaskStatus.OVERDUE ? TaskStatus.TODO : task.status;
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
      // `min-h-0` and the full height of its track: the board fills a section of
      // fixed height (see TASK_LIST_HEIGHT), so a column is that height whatever
      // is in it and the cards inside scroll rather than the board growing. It
      // is also what stops three columns of different lengths reading as three
      // boxes of different sizes.
      className={`flex h-full min-h-0 min-w-0 flex-col gap-2 rounded-2xl border border-outline-green px-3 pb-3 pt-2 transition-colors ${
        isOver ? 'bg-row-hover' : 'bg-transparent'
      }`}
    >
      {/* The name and how many are under it, inside a capsule of the column's
          own edge — the same hairline in the same green, so the header reads as
          a smaller instance of the box it heads rather than as a label floating
          at the top of it.

          The count is a green pill rather than a grey one. Grey is what this app
          writes *quiet* things in, and the figure at the head of a column is the
          opposite — it is the one number the header exists to give. Black on the
          brand green, the same pairing every filled control in the app uses. */}
      <div className="flex items-center justify-between gap-2 rounded-full border border-outline-green px-3 py-1.5">
        <p className="truncate text-sm font-medium text-surface-foreground">{label}</p>
        <span className="shrink-0 rounded-md bg-green px-1.5 py-0.5 text-xs font-medium tabular-nums text-black">
          {tasks.length}
        </span>
      </div>

      {tasks.length === 0 ? (
        // Centred in what is left of the column rather than sat under the "+":
        // the column is now a box of fixed height, and a line of type pinned to
        // the top of it read as the first row of a list that failed to load.
        <p className="flex flex-1 items-start justify-center px-1 py-6 text-center text-xs text-muted">
          {strings.tasksPage.emptyColumn}
        </p>
      ) : (
        // As many cards as the column is tall, and the rest a scroll away — the
        // height is the section's (see TASK_LIST_HEIGHT), and the same fade into
        // the ground the list down the page uses ends a full column on a
        // softened edge rather than on a cut.
        <TaskListScroll count={tasks.length} fill>
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
    // Three across from lg, one on anything narrower: at two abreast the odd
    // column sat alone on a second row, which is not a board.
    //
    // Stretched to the row's height rather than each column taking its own, and
    // the row is the section's fixed height — see TASK_LIST_HEIGHT. Three boxes
    // of one size that scroll inside themselves, instead of three of different
    // heights that grow and shrink as the filters change.
    <div className="grid h-full min-h-0 grid-cols-1 gap-2 lg:grid-cols-3">
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
        />
      ))}
    </div>
  );
}
