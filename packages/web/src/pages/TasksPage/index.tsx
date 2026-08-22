import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BrushCleaning, Check, Plus, Trash2 } from 'lucide-react';
import { Button } from '@heroui/react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';

import type { TaskFilters, TaskSortBy, TaskStatusFilter } from '@gloo/shared';

import { RedButton } from '@/components/common/RedButton';
import { SecondaryButton } from '@/components/common/SecondaryButton';
import { CalendarCard } from '@/components/dashboard/CalendarCard';
import { ProjectsCard } from '@/components/tasks/ProjectsCard';
import { TaskCard } from '@/components/tasks/TaskCard';
import { CONTROL_HEIGHT, TaskFiltersBar } from '@/components/tasks/TaskFiltersBar';
import { TaskKanban } from '@/components/tasks/TaskKanban';
import { TaskListScroll } from '@/components/tasks/TaskListScroll';
import { TaskReorderRow } from '@/components/tasks/TaskReorderRow';
import { TaskView, isTaskView } from '@/components/tasks/TaskViewToggle';
import { TaskPerformanceCard } from '@/components/tasks/TaskPerformanceCard';
import { NewTaskModal, TaskModal } from '@/components/tasks/TaskModal';
import { TaskStatusPills } from '@/components/tasks/TaskStatusPills';
import { PageHeader } from '@/components/layout/PageHeader';
import { useDebouncedValue } from '@/hooks/ui/useDebouncedValue';
import { useSectors } from '@/hooks/queries/sectors';
import {
  useDeletedTasks,
  useDeleteTasks,
  useEmptyTaskTrash,
  useRestoreTask,
  useTasks,
  useTaskSummary,
} from '@/hooks/queries/tasks';
import { useUsers } from '@/hooks/queries/users';
import { playSound } from '@/lib/sounds';
import {
  ALL_TASKS_ORDER_KEY,
  readTaskOrder,
  reorderTasks,
  sortByManualOrder,
  writeTaskOrder,
} from '@/components/dashboard/myTasksOrder';
import { TASK_VIEW_KEY, readPreference, writePreference } from '@/lib/preferences';
import { strings } from '@/strings/pt-BR';

type StatusPillValue = TaskStatusFilter | 'ALL';

/**
 * A comma-separated filter parameter as the list it stands for.
 *
 * Empty entries dropped, so a value left as "" by clearing the last tick reads
 * as "nothing ticked" rather than as a search for the sector with no id.
 */
function toIds(value: string | undefined): string[] {
  return value ? value.split(',').filter(Boolean) : [];
}

/**
 * How tall the list section is. Always.
 *
 * Stated rather than measured from the rows, which is the whole point: the box
 * used to be as tall as whatever was in it, so ticking a filter, searching a
 * word or opening the bin made the page jump — and a popover opened from the
 * row above it went with the jump, which is the board's "the dropdown moves as I
 * filter". A section that does not change size cannot do that, and the list
 * inside it scrolls instead.
 *
 * Two steps rather than one: on a laptop this is most of what is left below the
 * three cards, and on a wide screen there is room for a couple more rows.
 */
const TASK_LIST_HEIGHT = 'h-[32rem] xl:h-[36rem]';

/**
 * The box drawn inside "Selecionar todas".
 *
 * A span and not a checkbox, because the whole button already is one: a real
 * input inside a button is two controls in one hit area, and whichever of them
 * answered a press the other would have to be kept in step with. This only has
 * to *look* like the boxes down the list — the same small radius, the same green
 * fill and tick once it is on — so that is all it is.
 *
 * `border-current`, so the box is drawn in the button's own ink: it sits beside
 * a bin glyph on the next button along, and the two are the same weight of mark
 * saying the same kind of thing. The control outline it used to wear was a
 * shade lighter and made the box read as a field inside a button.
 */
const SELECT_ALL_BOX =
  'flex size-4 shrink-0 items-center justify-center rounded-sm border border-current transition-colors';

/**
 * "Selecionar todas", and the same button reading "Desmarcar todas" once they
 * are.
 *
 * One button for both directions rather than a checkbox beside a label: the box
 * and the words are saying the same thing, and split in two they could be
 * pressed apart. The box shows the state — empty while the words offer to fill
 * it, ticked while they offer to empty it — so what you see and what the button
 * will do are never the same claim written twice.
 */
function SelectAllButton({
  isAllSelected,
  onChange,
}: {
  isAllSelected: boolean;
  onChange: (isSelected: boolean) => void;
}) {
  return (
    // The controls' own height and type size, not a smaller step: this line
    // stands in for the row of status pills, directly under the row of buttons
    // it is answering to, and a pair of half-height buttons there read as a
    // footnote about the list rather than as what you are about to do to it.
    <SecondaryButton
      className={`${CONTROL_HEIGHT} shrink-0 whitespace-nowrap`}
      onPress={() => onChange(!isAllSelected)}
    >
      <span
        aria-hidden
        className={`${SELECT_ALL_BOX} ${isAllSelected ? 'bg-green' : 'bg-transparent'}`}
      >
        {isAllSelected ? <Check className="size-3 text-black" strokeWidth={3} /> : null}
      </span>
      {isAllSelected
        ? strings.tasksPage.trash.deselectAll
        : strings.tasksPage.trash.selectAll}
    </SecondaryButton>
  );
}

export function TasksPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCreateOpen, setCreateOpen] = useState(false);

  /**
   * Whether the section is showing the bin rather than the list.
   *
   * Component state and not the URL, unlike every filter on this page: the
   * Lixeira is somewhere you step into, take something back or empty it, and
   * step out of — it is not a view of the tasks worth sending anybody a link to,
   * and a bookmark that opened on the trash would be a bookmark of a chore.
   */
  const [isTrash, setTrash] = useState(false);
  /** The rows ticked, by id, so a refetch cannot leave stale copies behind. */
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // TaskCard stamps the route it was clicked from — query string and all, so a
  // card opened on the board closes back onto the board rather than onto the
  // list. A task opened from the Dashboard closes back to the Dashboard the same
  // way.
  //
  // The fallback is for a URL pasted straight into the address bar, which
  // carries no state: it keeps whatever that URL was asking for, so
  // /tasks/:id?view=KANBAN closes onto the board too.
  const closeTo =
    (location.state as { from?: string } | null)?.from ?? `/tasks${location.search}`;

  // Filters live in the URL so the Dashboard cards can deep-link into a
  // pre-filtered Tasks view, and so filtered views stay shareable/bookmarkable.
  const [searchParams, setSearchParams] = useSearchParams();

  const status = (searchParams.get('status') ?? 'ALL') as StatusPillValue;
  const search = searchParams.get('search') ?? '';
  /**
   * The sectors and the people ticked in the filter panel, which takes several
   * of each now.
   *
   * Still one parameter apiece, comma-separated: every link already pointing at
   * this page — the Dashboard's tiles deep-link into it — carries a single id,
   * and a list of one is exactly that. The API splits them the same way, see
   * `ids` in the tasks routes.
   */
  const sectorId = searchParams.get('sectorId') ?? undefined;
  const assigneeId = searchParams.get('assigneeId') ?? undefined;
  const sectorIds = toIds(sectorId);
  const assigneeIds = toIds(assigneeId);
  const sortBy = (searchParams.get('sortBy') as TaskSortBy | null) ?? undefined;
  const sortDir = (searchParams.get('sortDir') as 'ASC' | 'DESC' | null) ?? 'ASC';
  const dueDateFrom = searchParams.get('dueDateFrom') ?? undefined;
  const dueDateTo = searchParams.get('dueDateTo') ?? undefined;
  /**
   * Which project the filter panel is set to.
   *
   * Held and remembered like every other filter, and narrowing nothing: a task
   * has no project to be filtered by — see SAMPLE_PROJECTS — so this goes no
   * further than the URL until one exists. Deliberately left out of `isFiltered`
   * below for the same reason: a green "Filtrar" over a list that did not change
   * would be the button telling you something the rows contradict.
   */
  const projectIds = toIds(searchParams.get('projectId') ?? undefined);

  /**
   * Which way the tasks are drawn: the URL first, then what you last left it on.
   *
   * The URL wins so a board stays a link you can send someone. Storage is what
   * answers when there is no link — coming back to /tasks from the Dashboard, or
   * reopening the app — because the view is a way of working rather than a
   * question the page asks fresh every time, and a person who works on the board
   * should not be handed the list every morning.
   *
   * Only a *choice* is stored, never the fallback: see onViewChange below.
   */
  const viewParam = searchParams.get('view');
  const [storedView] = useState(() => readPreference(TASK_VIEW_KEY, isTaskView));
  const chosenView: TaskView = isTaskView(viewParam) ? viewParam : (storedView ?? TaskView.LIST);

  function setParam(key: string, value: string | undefined) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value === undefined || value === '') {
          next.delete(key);
        } else {
          next.set(key, value);
        }
        return next;
      },
      // Carry location.state through the replace. Without it the search effect,
      // which fires once on mount, silently drops the origin TaskCard stamped on
      // the entry — and the modal would always close back to the list.
      { replace: true, state: location.state },
    );
  }

  // The input stays instant while the query key (and refetch) lags behind it,
  // so typing a word costs one request instead of one per keystroke.
  const [searchDraft, setSearchDraft] = useState(search);
  const debouncedSearch = useDebouncedValue(searchDraft, 300);

  useEffect(() => {
    setParam('search', debouncedSearch);
    // setParam is recreated each render; only the debounced value should retrigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const filters: TaskFilters = {
    search: debouncedSearch || undefined,
    status,
    sectorId,
    assigneeId,
    sortBy,
    sortDir,
    dueDateFrom,
    dueDateTo,
  };

  /**
   * The day picked on the month, when the two ends of the deadline window are
   * the same day — which is the only way this page ever sets them. Anything
   * else (a range typed into the URL by hand) leaves the month unmarked rather
   * than marking one arbitrary end of it.
   */
  const pickedDay = dueDateFrom && dueDateFrom === dueDateTo ? dueDateFrom : null;

  /**
   * Pressing a day filters the list to that deadline; pressing it again clears
   * it. Both bounds move together, so the window is exactly the day.
   */
  function pickDay(day: string | null) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (day) {
          next.set('dueDateFrom', day);
          next.set('dueDateTo', day);
        } else {
          next.delete('dueDateFrom');
          next.delete('dueDateTo');
        }
        return next;
      },
      { replace: true, state: location.state },
    );
  }

  /**
   * The deadline window the "Período" row sets — both ends at once, or neither.
   *
   * The same two parameters the month above sets by pressing a day, which is
   * exactly right: a day is a window of one, and the two controls are two ways
   * of asking the same question. Picking a period wide enough to hold several
   * days simply leaves the month unmarked — see `pickedDay`.
   */
  function setPeriod(range: { from: string; to: string } | null) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (range) {
          next.set('dueDateFrom', range.from);
          next.set('dueDateTo', range.to);
        } else {
          next.delete('dueDateFrom');
          next.delete('dueDateTo');
        }
        return next;
      },
      { replace: true, state: location.state },
    );
  }

  /**
   * Every filter off at once — the panel's "Limpar".
   *
   * The status goes with them even though it also has pills of its own above the
   * list: the button is under the row that sets it, and a "Limpar" that left one
   * of the rows it is sitting under still set would be lying about what it did.
   * The search box is not a filter in the panel and stays where it is.
   */
  function clearFilters() {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const key of ['sectorId', 'assigneeId', 'status', 'projectId', 'dueDateFrom', 'dueDateTo']) {
          next.delete(key);
        }
        return next;
      },
      { replace: true, state: location.state },
    );
  }

  /**
   * Whether anything is narrowing the list beyond the status pills and the
   * search box — which is what the "Filtrar por" button says in green.
   *
   * The status pills are left out on purpose: they carry their own counts and
   * the one you are on is already filled in, so the button would be repeating
   * what the row above it says outright.
   */
  const isFiltered = Boolean(sectorId || assigneeId || dueDateFrom || dueDateTo);

  // One of the two is asked at a time: the live list and the bin are the same
  // query read from either side of `deletedAt`, and fetching both would be a
  // request for rows nothing is going to draw.
  const { data: liveTasks = [], isLoading: isLoadingLive } = useTasks(filters, {
    enabled: !isTrash,
  });
  const { data: trashedTasks = [], isLoading: isLoadingTrash } = useDeletedTasks(filters, {
    enabled: isTrash,
  });
  const tasks = isTrash ? trashedTasks : liveTasks;
  const isLoading = isTrash ? isLoadingTrash : isLoadingLive;

  const deleteTasks = useDeleteTasks();
  const restoreTask = useRestoreTask();
  const emptyTrash = useEmptyTaskTrash();
  // The same filters the list is under, minus the status — so each pill's figure
  // is what pressing that pill would actually show.
  const { data: summary } = useTaskSummary({
    search: filters.search,
    sectorId,
    assigneeId,
    dueDateFrom,
    dueDateTo,
  });
  const { data: sectors = [] } = useSectors();
  const { data: users = [] } = useUsers();

  /**
   * The order the rows were dragged into, exactly as the Dashboard's own list
   * keeps it — a person's arrangement of a shared list, held in the browser
   * because the server has no column for it. Its own key, so rearranging forty
   * of everybody's tasks here does not reshuffle the five of yours over there.
   */
  const [order, setOrder] = useState<string[]>(() => readTaskOrder(ALL_TASKS_ORDER_KEY));
  /** The row being dragged, the row it is over, and how tall the first one is. */
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dragHeight, setDragHeight] = useState(0);

  // One arrangement, both views. A column is this order with the cards that are
  // in another state taken out of it, so rearranging the board rearranges the
  // list and the other way round — which is right: it is one person's order for
  // one set of tasks, shown two ways. The board's own drag changes the *status*
  // as well, but only when the card is dropped on a different column.
  //
  // Finished tasks sink to the bottom, which the board never sees: they are all
  // in "Feitas" together, so the rule cannot separate two cards in one column.
  //
  // Unless an order was actually *asked* for. "Ordenar" sorts on the server, and
  // this used to be applied over the answer regardless — so pressing Prioridade
  // sent the request, got the sorted list back, and then reshuffled it into
  // whatever arrangement this browser happened to be holding, with the finished
  // tasks sunk to the bottom on top of that. The button did nothing you could
  // see. A chosen sort now wins outright, and clearing it (pressing the same
  // one again) hands the list back to the arrangement, which is still there.
  const ordered = useMemo(
    () => (sortBy ? tasks : sortByManualOrder(tasks, order)),
    [tasks, order, sortBy],
  );
  const visibleIds = ordered.map((task) => task.id);

  /**
   * What is ticked *and* still on screen.
   *
   * Filtered against the rows rather than trusted as held: a task deleted,
   * restored or filtered away must not keep a tick behind it that then names a
   * row nobody can see — and "Deletar selecionadas" has to mean the rows you are
   * looking at.
   */
  const selectedIds = visibleIds.filter((id) => selected.has(id));
  const isAllSelected = visibleIds.length > 0 && selectedIds.length === visibleIds.length;

  function toggleSelected(id: string, isSelected: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (isSelected) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  /** Every row on screen, or none of them — what the box beside "Todas" does. */
  function toggleAll(isSelected: boolean) {
    setSelected(isSelected ? new Set(visibleIds) : new Set());
  }

  /**
   * Leaving the bin, or the board, or the list, drops the ticks with it.
   *
   * One place for all of them, because a selection is a sentence about the rows
   * you are looking at: carried anywhere else it would name rows that are not
   * there, and offer to destroy them.
   */
  function leaveSelection() {
    setSelected(new Set());
  }

  /**
   * Which is also what switching views does.
   *
   * The tick boxes are the list's — a board card is a tile you drag, and asking
   * it to also be a checkbox is two gestures on one surface — so a selection
   * made on the list has nowhere to be shown on the board, and the row of
   * buttons acting on it would be acting on rows nobody can see.
   */
  useEffect(() => {
    setSelected(new Set());
  }, [chosenView, isTrash]);

  /** Whether the row of bulk controls stands where the pills usually are. */
  const isSelectionOpen = selectedIds.length > 0;

  /**
   * And the board is off in the bin, whatever the URL says.
   *
   * A board is a split by status and a deleted task's status is a fact about the
   * day somebody deleted it — three columns of binned work would be sorting the
   * rubbish. The choice is not lost, only suspended: leaving the Lixeira puts
   * you back on the view you were on.
   */
  const view: TaskView = isTrash ? TaskView.LIST : chosenView;

  /** Put the dragged task where the target one is, and remember it. */
  function reorder(from: string, targetId: string) {
    if (from === targetId) return;
    const next = reorderTasks(order, visibleIds, from, targetId);
    setOrder(next);
    writeTaskOrder(next, ALL_TASKS_ORDER_KEY);
  }

  function handleDrop(draggedId: string, targetId: string) {
    if (draggedId) reorder(draggedId, targetId);
    setDragId(null);
    setOverId(null);
  }

  return (
    <div>
      <PageHeader title={strings.nav.tasks} />

      <div className="flex flex-col gap-4 px-4 pb-6 md:gap-5 md:px-6">
        {/* Three across the top, at 40/25/35 — stated as eight, five and seven
            columns of a twenty-column grid rather than as percentages, so the
            two gaps come out of the page instead of out of the columns' own
            widths, which percentages cannot do without a calc apiece.

            Their heights are the month's. A grid row is as tall as its tallest
            item, and the two beside it are built to take whatever slack that
            leaves — the chart's bars grow into it and the three folders divide
            it between them.

            One column below lg, where a quarter of the page is narrower than a
            week. */}
        <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-20">
          {/* A one-cell grid of its own, which is what passes the row's height
              down to the card inside it: a grid item stretches to its track in
              both axes, so none of the three is ever told a height. */}
          <div className="grid lg:col-span-8">
            <TaskPerformanceCard />
          </div>
          {/* Deadlines only. The month sits between a chart about tasks and a
              list of tasks, and a dot on it that turned out to be a meeting
              would be answering a question this page never asks.

              Pressing a day narrows the list below to that deadline rather than
              opening a summary of it: the answer this page has to give about a
              day is already the thing underneath, and a second list beside the
              month would have been the same tasks written twice. */}
          <div className="grid lg:col-span-5">
            <CalendarCard tasksOnly narrow pickedDay={pickedDay} onPickDay={pickDay} />
          </div>
          <div className="grid lg:col-span-7">
            <ProjectsCard />
          </div>
        </div>

        {/* And the list under all three, across the whole page. */}
        <div className="flex flex-col gap-4 rounded-3xl bg-surface p-4 shadow-surface md:p-5">
          {/* The bin's name, over the row of controls rather than beside them.
              It is the heading of what the whole box has become — the same rank
              a card's title carries everywhere else — and on the controls' own
              line it read as one more control. The way out leads it, on the
              left, because that is the direction it goes. */}
          {isTrash ? (
            <div className="flex items-center gap-1">
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                className="-ml-1 shrink-0 text-muted"
                aria-label={strings.routine.trash.close}
                onPress={() => {
                  setTrash(false);
                  leaveSelection();
                }}
              >
                <ArrowLeft className="size-4" />
              </Button>
              <h3 className="text-lg font-semibold text-surface-foreground">
                {strings.tasksPage.trash.heading}
              </h3>
            </div>
          ) : null}

          <TaskFiltersBar
            search={searchDraft}
            onSearchChange={setSearchDraft}
            sortBy={sortBy}
            sortDir={sortDir}
            onSortByChange={(value) => setParam('sortBy', value)}
            onSortDirToggle={() => setParam('sortDir', sortDir === 'ASC' ? 'DESC' : 'ASC')}
            sectorIds={sectorIds}
            onSectorChange={(value) => setParam('sectorId', value.join(','))}
            assigneeIds={assigneeIds}
            onAssigneeChange={(value) => setParam('assigneeId', value.join(','))}
            // The same param the pills above the list set, so the two are one
            // filter with two ways in rather than two filters that disagree.
            status={status === 'ALL' ? undefined : status}
            onStatusChange={(value) => setParam('status', value)}
            projectIds={projectIds}
            onProjectChange={(value) => setParam('projectId', value.join(','))}
            sectors={sectors}
            users={users}
            view={view}
            onViewChange={(next) => {
              writePreference(TASK_VIEW_KEY, next);
              // Both ways written out, the list included — it used to clear the
              // param on the grounds that LIST is the app's default and a URL
              // spelling out a default says nothing. That stopped being true the
              // moment a stored preference could *be* the default: with KANBAN
              // remembered, clearing the param on "Lista" handed the fallback
              // back to storage, which said board, and the press did nothing.
              // A choice made on this page now always ends up in the URL, where
              // it outranks what was remembered.
              setParam('view', next);
            }}
            isFiltered={isFiltered}
            dueDateFrom={dueDateFrom}
            onPeriodChange={setPeriod}
            dueDateTo={dueDateTo}
            // In the bin the status row is drawn and unusable, and the board is
            // not offered at all — see `view` above.
            statusLocked={isTrash}
            showViewToggle={!isTrash}
            // The `⋮` and the one thing it opens onto, which does not belong in
            // the Lixeira: you are already in it.
            onOpenTrash={
              isTrash
                ? undefined
                : () => {
                    leaveSelection();
                    setTrash(true);
                  }
            }
            onClearFilters={clearFilters}
            // On the controls' row rather than beside the bin's heading, so it
            // stands the same height and reads at the same size as the two
            // buttons before it. Outlined and not red: emptying is destructive
            // too, but it is the bin's housekeeping, and beside a red "Deletar
            // permanentemente" two reds would leave neither meaning anything.
            trailing={
              !isTrash ? (
                // The two bulk controls, beside the `⋮` rather than on the line
                // below: they are things you do *to* the list, which is what
                // this row holds, and the line under it is the split by status —
                // a question about the list rather than an instruction to it.
                // They come and go with the selection, since with nothing ticked
                // neither has anything to act on.
                isSelectionOpen ? (
                  <>
                    <SelectAllButton isAllSelected={isAllSelected} onChange={toggleAll} />

                    <SecondaryButton
                      className={`${CONTROL_HEIGHT} shrink-0 whitespace-nowrap`}
                      isDisabled={deleteTasks.isPending}
                      onPress={() => {
                        playSound('delete');
                        deleteTasks.mutate(selectedIds, { onSuccess: leaveSelection });
                      }}
                    >
                      <Trash2 className="size-4" />
                      {strings.tasksPage.trash.deleteSelected}
                    </SecondaryButton>
                  </>
                ) : null
              ) : (
                <>
                  <SecondaryButton
                    className={`${CONTROL_HEIGHT} shrink-0`}
                    isDisabled={ordered.length === 0 || emptyTrash.isPending}
                    onPress={() => {
                      // Its own sound, not the broom's elsewhere, which clears a
                      // field you were typing in.
                      playSound('emptyTrash');
                      emptyTrash.mutate(undefined);
                      setSelected(new Set());
                    }}
                  >
                    <BrushCleaning className="size-4" />
                    {strings.routine.trash.emptyTrash}
                  </SecondaryButton>

                  {/* Beside the broom rather than on a line of its own: they are
                      the same job at two scales — all of it, or the ones ticked
                      — and the bin has no second row to put anything on. Only
                      once something *is* ticked, since with nothing chosen it
                      has nothing to destroy and a red button standing there
                      permanently reads as a warning about the page. */}
                  {selectedIds.length > 0 ? (
                    <RedButton
                      className={`${CONTROL_HEIGHT} shrink-0 rounded-full`}
                      isDisabled={emptyTrash.isPending}
                      onPress={() => {
                        playSound('delete');
                        emptyTrash.mutate(selectedIds);
                        setSelected(new Set());
                      }}
                    >
                      <Trash2 className="size-4" />
                      {strings.routine.trash.deleteSelected}
                    </RedButton>
                  ) : null}
                </>
              )
            }
            // The way in, at the top right of the section rather than at the
            // foot of the list: a full-width button after the last row was only
            // reachable by scrolling past every task, and it grew further away
            // the more tasks there were. The Dashboard's own list already puts
            // its "add" in this corner, so the two now match.
            //
            // Still there in the bin, and off: nothing is created in a trash. It
            // used to be taken away entirely, which moved the search field and
            // left the row a different shape on either side of the same box —
            // held in place and greyed it says why it cannot be pressed instead.
            //
            // Grey by *variant* rather than by the disabled state alone: HeroUI
            // disables a button by fading it, and a faded brand green is still a
            // green button — a pale one, which reads as the button waiting on
            // something rather than as the button being shut. The neutral fill
            // says it outright.
            action={
              <Button
                isIconOnly
                variant={isTrash ? 'secondary' : 'primary'}
                isDisabled={isTrash}
                // The neutral variant's own ink is the app's soft green, which
                // left a green "+" on the grey disc — the one part of the button
                // still claiming to be the primary action. Both go grey together.
                className={`shrink-0 rounded-full ${isTrash ? 'text-muted' : ''}`}
                aria-label={strings.task.addTask}
                onPress={() => setCreateOpen(true)}
              >
                <Plus className="size-4" />
              </Button>
            }
          />

          {/* The second line: what the list is split by, or — the moment a row
              is ticked — what you are about to do to the rows you picked.

              One or the other and never both. A tick is a sentence about
              particular tasks, and the five pills are a question about all of
              them; side by side the row offered to filter away the very rows
              that were selected. So the pills stand down while a selection is
              open, and the two controls that act on it take the line's left
              end. */}
          {/* The split by status — and nothing at all while rows are ticked.
              A tick is a sentence about particular tasks and the five pills are a
              question about all of them; side by side the row offers to filter
              away the very rows that were selected. What acts on the selection
              is on the line above, beside the `⋮` — see `trailing`. */}
          {!isTrash && view === TaskView.LIST && !isSelectionOpen ? (
            <TaskStatusPills
              value={status}
              onChange={(value) => setParam('status', value === 'ALL' ? undefined : value)}
              counts={summary}
            />
          ) : null}

          {/* One height, always — see TASK_LIST_HEIGHT. Everything below is
              drawn inside it: the board's columns, the list's rows, the two
              lines of type that stand in for them. */}
          <div
            className={`flex min-h-0 flex-col ${TASK_LIST_HEIGHT} ${
              // The board needs more air under the controls than the list does:
              // a column is a bordered box, and at the section's own gap its top
              // edge sat close enough to the row of pills above to read as part
              // of the same object. The list's rows are outlined too but start
              // with a title, which does not.
              view === TaskView.KANBAN ? 'mt-2' : ''
            }`}
          >
          {isLoading ? (
            <p className="flex flex-1 items-center justify-center text-center text-muted">
              {strings.common.loading}
            </p>
          ) : ordered.length === 0 ? (
            <p className="flex flex-1 items-center justify-center text-center text-muted">
              {isTrash ? strings.tasksPage.trash.empty : strings.tasksPage.empty}
            </p>
          ) : view === TaskView.KANBAN ? (
            <TaskKanban tasks={ordered} onReorder={reorder} />
          ) : (
            // As many rows as the section is tall, and the rest a scroll away —
            // with the last one fading into the card rather than ending on a
            // cut. See TaskListScroll.
            <TaskListScroll count={ordered.length} fill>
              {ordered.map((task) => (
                <TaskReorderRow
                  key={task.id}
                  id={task.id}
                  dragId={dragId}
                  overId={overId}
                  dragHeight={dragHeight}
                  // Which edge of the row being hovered the dragged one will land
                  // on. Above when it is travelling up the list, below when down
                  // — the same rule reorderTasks applies to the stored order.
                  insertAbove={visibleIds.indexOf(dragId ?? '') > visibleIds.indexOf(task.id)}
                  onDragStart={(height) => {
                    setDragHeight(height);
                    setDragId(task.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverId(null);
                  }}
                  onDragOver={() => setOverId(task.id)}
                  onDragLeave={() =>
                    setOverId((current) => (current === task.id ? null : current))
                  }
                  onDrop={(draggedId) => handleDrop(draggedId, task.id)}
                >
                  <TaskCard
                    task={task}
                    // Every list row can be ticked; what changes is whether the
                    // box is standing there or waiting for the pointer.
                    selectable
                    alwaysShowSelect={isTrash}
                    isSelected={selected.has(task.id)}
                    onSelectChange={(next) => toggleSelected(task.id, next)}
                    trashed={isTrash}
                    onRestore={() => restoreTask.mutate(task.id)}
                  />
                </TaskReorderRow>
              ))}
            </TaskListScroll>
          )}
          </div>
        </div>
      </div>

      {taskId ? (
        <TaskModal taskId={taskId} isTrashed={isTrash} onClose={() => navigate(closeTo)} />
      ) : null}
      {isCreateOpen ? <NewTaskModal onClose={() => setCreateOpen(false)} /> : null}
    </div>
  );
}
