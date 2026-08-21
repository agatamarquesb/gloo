import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, ListFilter, Settings2 } from 'lucide-react';
import { Button, Label, ListBox, Popover, Select } from '@heroui/react';

import { TaskStatus, type SectorDto, type TaskSortBy, type UserDto } from '@gloo/shared';

import { SearchField } from '@/components/common/SearchField';
import {
  FIELD_PANEL,
  FLAT_SELECT_TRIGGER,
  FLOATING_PANEL,
  LISTBOX_FLUSH,
  NO_FIELD_BORDER,
  PANEL_MATCHES_TRIGGER,
  TEXT_LISTBOX_ITEM,
} from '@/theme/fieldStyles';
import { menuRow } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

import { SAMPLE_PROJECTS } from './sampleProjects';
import { TaskViewToggle, TaskView, VIEW_TOGGLE_HEIGHT } from './TaskViewToggle';

const SORT_OPTIONS: TaskSortBy[] = ['DUE_DATE', 'PRIORITY', 'PROGRESS'];

/**
 * The height every control on this row is held to.
 *
 * Five controls of four kinds sit on that line — the view fieldset, two
 * buttons, the search field and the "add" — and left to their own defaults they
 * came out at 40, 36, 38 and 36. One stated number, and each of them is told it
 * rather than each of them being trusted to arrive at it.
 *
 * Taken from the toggle rather than written down twice: that one has to set its
 * own height in its own file, since the discs inside it are cut to fit.
 */
const CONTROL_HEIGHT = VIEW_TOGGLE_HEIGHT;

/**
 * The panel both menus drop: one floating card with a hairline, squared off
 * against the button it came from — the same shape the chart's period selector
 * drops. It takes the trigger's own measured width, so the two can never
 * disagree about where the seam is.
 */
const MENU_PANEL = `${PANEL_MATCHES_TRIGGER} ${FIELD_PANEL} rounded-b-lg data-[placement=top]:rounded-t-lg`;

/**
 * What the button does while its panel is open: it grows to the panel's width
 * and squares off the two corners the panel butts against, so the pair reads as
 * one silhouette rather than as a pill with a wider box hanging under it.
 *
 * It grows to the *right*, which is what pushes the button after it along —
 * the alternative, a panel wider than the trigger, left the trigger looking
 * detached from the thing it opened. Closing puts everything back.
 *
 * The two widths are written out rather than composed, because Tailwind reads
 * these class names out of the source text and never sees a string built at
 * runtime. They are also what `--trigger-width` measures, so MENU_PANEL follows
 * them without being told.
 */
const TRIGGER_OPEN = [
  'aria-expanded:justify-start aria-expanded:rounded-b-none aria-expanded:rounded-t-lg',
  'aria-expanded:bg-default/40',
  // React Aria holds the trigger *pressed* for as long as its popover is open,
  // and HeroUI shrinks a pressed button to 97%. Left alone that is the whole
  // problem this constant exists to fix, in miniature: a trigger 5px narrower
  // and 1px shorter than the panel welded to it. The press feedback still fires
  // on the way in — it is the resting state while open that is cancelled.
  //
  // `transform-none` and not `scale-100`: Tailwind writes the latter to the
  // standalone `scale` property, which the component's own `transform: scale()`
  // is then composed *on top of* rather than replaced by, so the button stayed
  // at 97% of a 100% scale. This drops the transform outright.
  'aria-expanded:transform-none',
].join(' ');
const SORT_TRIGGER_OPEN = `${TRIGGER_OPEN} aria-expanded:w-44`;
const FILTER_TRIGGER_OPEN = `${TRIGGER_OPEN} aria-expanded:w-56`;

/**
 * The gutter every line in the sort menu carries: a dot against the three
 * orders, an arrow against the direction under them.
 *
 * One column, and every line has it — a marker added to some rows and not
 * others is the one thing that cannot line up, since it either displaces those
 * rows' text or overlaps it. The dot is the same mark a status pill wears (see
 * DOT): the current colour at half strength, so it belongs to the line rather
 * than to a palette of its own.
 */
const MENU_GUTTER = 'flex size-3.5 shrink-0 items-center justify-center';

/**
 * A property line in the filter panel: its name, what it is currently set to,
 * and the arrow saying there is more to the right.
 *
 * A menu row and not a field — no border, no ground of its own, the same hover
 * grey as the lines in the sort menu — because that is what it now behaves
 * like. The value sits at the far end in grey, which is the whole of what the
 * row has to report at rest; the list that changes it is one press away and
 * costs the panel no height until it is asked for.
 *
 * The Select brings a field's chrome and a field's minimum height with it, so
 * both are taken back: `h-auto min-h-0` for the height, FLAT_SELECT_TRIGGER and
 * NO_FIELD_BORDER for everything else.
 */
/**
 * How wide a filter's side list is cut.
 *
 * Wide enough for a name of about 23 characters *and* the tick after it, which
 * is what the longest sector in this business ("Marketing & Aquisição") needs —
 * before, the panel was measured for the name alone and the mark was laid over
 * its last letters. Anything longer is truncated rather than widening the panel
 * further: a list that grows with its longest entry is a list whose width is
 * decided by whoever names the next sector.
 *
 * One stated width and not a minimum with a cap, because `truncate` on the name
 * leaves the row with no intrinsic width to push against — a panel free to
 * shrink then always sat at its minimum, which was the bug this was meant to
 * fix. All four lists take it, so the panel does not change shape as you move
 * down the menu.
 */
const SIDE_PANEL = 'w-[13.75rem]';

const FILTER_TRIGGER = [
  FLAT_SELECT_TRIGGER,
  NO_FIELD_BORDER,
  'h-auto min-h-0 w-full cursor-pointer justify-between gap-3 rounded-md px-2 py-1.5 text-left',
  'hover:bg-default/50 aria-expanded:bg-default/50',
].join(' ');

export function TaskFiltersBar({
  search,
  onSearchChange,
  sortBy,
  sortDir,
  onSortByChange,
  onSortDirToggle,
  sectorIds,
  onSectorChange,
  assigneeIds,
  onAssigneeChange,
  status,
  onStatusChange,
  projectIds,
  onProjectChange,
  sectors,
  users,
  action,
  view,
  onViewChange,
  isFiltered = false,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  sortBy: TaskSortBy | undefined;
  sortDir: 'ASC' | 'DESC';
  onSortByChange: (value: TaskSortBy | undefined) => void;
  onSortDirToggle: () => void;
  /** Every sector ticked, or empty for all of them. Likewise the two below. */
  sectorIds: string[];
  onSectorChange: (value: string[]) => void;
  assigneeIds: string[];
  onAssigneeChange: (value: string[]) => void;
  /**
   * The status filter, or undefined for every status. List view only, and the
   * one row of the four that takes a single answer — it is the same choice the
   * pills under this row make, and those are one-at-a-time by nature.
   */
  status: string | undefined;
  onStatusChange: (value: string | undefined) => void;
  /** Which projects, from the placeholder list — see SAMPLE_PROJECTS. */
  projectIds: string[];
  onProjectChange: (value: string[]) => void;
  sectors: SectorDto[];
  users: UserDto[];
  /** Which way the list below is drawn — see TaskViewToggle. */
  view: TaskView;
  onViewChange: (value: TaskView) => void;
  /**
   * A control for the far end of the row — the Tasks page's "add".
   *
   * Here rather than anywhere else on the card because this row *is* the top of
   * the section: it is the first thing in the box, and its right edge is the
   * section's top right corner. A button placed anywhere else would need a
   * header row of its own over a card that has never had one.
   */
  action?: ReactNode;
  /**
   * Whether anything behind the "Filtrar" button is actually narrowing the list
   * — a sector, a person, a status, or the day picked on the month above.
   *
   * The button says so in the brand green, set bold, glyph and all. The filters
   * live inside a popover and one of them is a press on a calendar in another
   * card entirely, so without this the only way to tell a filtered list from a
   * short one is to open the popover and look.
   */
  isFiltered?: boolean;
}) {
  return (
    // What you do *to* the list on the left, what you do *with* it on the right:
    // the view, the order and the filters decide what the rows below are, while
    // the search and the "add" are the two things aimed at a task rather than at
    // the list. The pair on the right travels together so it stays whole when
    // the row wraps — the same arrangement the Dashboard's list uses.
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {/* First on the row because it decides what everything after it is
            arranging: the order and the filters read differently on a board
            than on a list, and this is the control that says which you are on. */}
        <TaskViewToggle value={view} onChange={onViewChange} />

        <Popover>
          <Button
            variant="outline"
            className={`${CONTROL_HEIGHT} shrink-0 rounded-full ${SORT_TRIGGER_OPEN}`}
          >
            {/* Three lines narrowing to a point: a list being funnelled into an
                order. The arrow this carried said A–Z, which is not what any of
                the three sorts actually does. */}
            <ListFilter className="size-4 shrink-0" />
            {strings.common.sortBy}
          </Button>
          <Popover.Content offset={0} className={MENU_PANEL}>
            <Popover.Dialog className="p-1">
              <div className="flex flex-col gap-0.5">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`${menuRow} gap-2 ${sortBy === option ? 'text-foreground' : ''}`}
                    // Pressing the sort you are already on clears it, which is
                    // the only way back to the server's own order.
                    onClick={() => onSortByChange(sortBy === option ? undefined : option)}
                  >
                    <span className={MENU_GUTTER}>
                      <span
                        aria-hidden
                        className={`size-1.5 rounded-full bg-current ${
                          sortBy === option ? '' : 'opacity-40'
                        }`}
                      />
                    </span>
                    {strings.tasksPage.sort[option]}
                  </button>
                ))}

                {/* Which end of that order comes first is a different question
                    from which order — so a rule, and the direction under it.
                    The app's own hairline, inset by the row padding so it starts
                    where the words do. */}
                <span aria-hidden className="mx-2 my-1 h-px bg-border" />

                <button type="button" className={`${menuRow} gap-2`} onClick={onSortDirToggle}>
                  <span className={MENU_GUTTER}>
                    {sortDir === 'ASC' ? (
                      <ArrowUp className="size-3.5" aria-hidden />
                    ) : (
                      <ArrowDown className="size-3.5" aria-hidden />
                    )}
                  </span>
                  {strings.tasksPage.sort[sortDir]}
                </button>
              </div>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>

        <Popover>
          {/* The ink and nothing else: the button keeps its outline and its white
              ground either way, so the row does not change shape when a filter
              goes on — what changes is that its label is written in green and a
              step heavier. --green-deep rather than --green, which is a fill
              colour and barely legible as words on a light surface. */}
          <Button
            variant="outline"
            className={`${CONTROL_HEIGHT} shrink-0 rounded-full ${FILTER_TRIGGER_OPEN} ${
              isFiltered ? 'font-semibold text-green-deep' : ''
            }`}
          >
            {/* Two rows with a knob on each: settings being adjusted, which is
                what the popover behind this actually holds. The funnel went to
                "Ordenar", where a narrowing shape means something. */}
            <Settings2 className="size-4 shrink-0" />
            {strings.common.filterBy}
          </Button>
          <Popover.Content offset={0} className={MENU_PANEL}>
            <Popover.Dialog className="p-1">
              {/* A menu, and each line opens its own list to the side. The two
                  arrangements this replaced both spent the panel's width on the
                  wrong thing: side by side, the value had about six characters;
                  stacked, every property cost two lines and a field's worth of
                  chrome whether or not anyone was going to touch it. This way a
                  filter reads as one line and only the one you press opens. */}
              <div className="flex flex-col gap-0.5">
                <FilterRow
                  label={strings.task.fields.sector}
                  values={sectorIds}
                  options={sectors.map((sector) => ({ id: sector.id, name: sector.name }))}
                  onChange={onSectorChange}
                />

                <FilterRow
                  label={strings.task.fields.assignee}
                  values={assigneeIds}
                  options={users.map((user) => ({ id: user.id, name: user.name }))}
                  onChange={onAssigneeChange}
                />

                {/* Off the board entirely: the board's four columns *are* the
                    split by status, and narrowing to one of them here would
                    empty three columns to fill the one you asked for. Same
                    reason the status pills are hidden there. */}
                {view === TaskView.LIST ? (
                  <FilterRow
                    label={strings.task.fields.status}
                    values={status ? [status] : []}
                    // One at a time, unlike its three neighbours: this row and
                    // the pills under the bar set the same thing, and a list
                    // showing two statuses could not be written on a pill.
                    single
                    options={[
                      { id: TaskStatus.TODO, name: strings.task.status.TODO },
                      { id: TaskStatus.IN_PROGRESS, name: strings.task.status.IN_PROGRESS },
                      { id: TaskStatus.DONE, name: strings.task.filters.done },
                      { id: TaskStatus.OVERDUE, name: strings.task.filters.overdue },
                    ]}
                    onChange={(next) => onStatusChange(next[0])}
                  />
                ) : null}

                <FilterRow
                  label={strings.task.fields.project}
                  values={projectIds}
                  options={SAMPLE_PROJECTS.map((name) => ({ id: name, name }))}
                  onChange={onProjectChange}
                />
              </div>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
        <SearchField
          value={search}
          onChange={onSearchChange}
          heightClass={CONTROL_HEIGHT}
          className="min-w-0 flex-1 sm:w-64"
        />
        {action}
      </div>
    </div>
  );
}

/**
 * One property of the filter panel: its name on one line, and the dropdown that
 * narrows by it on the next.
 *
 * Several answers at once, because that is the question a filter asks — "the
 * tasks in *these* sectors" is a thing you want and "the tasks in this one
 * sector" was all the panel could say. Ticking nothing means all of them, which
 * is why there is no "Todos" option in the list: the empty state *is* that
 * answer, and an option that means "clear the other options" would be a second
 * way of saying it that could disagree with the first.
 */
function FilterRow({
  label,
  values,
  options,
  onChange,
  single = false,
}: {
  label: string;
  /** Everything ticked. Empty for "no narrowing at all". */
  values: string[];
  options: { id: string; name: string }[];
  onChange: (value: string[]) => void;
  /** One answer at most — see the status row above. */
  single?: boolean;
}) {
  const chosen = options.filter((option) => values.includes(option.id));

  // One name while there is one, a count past that: four sector names in a
  // 200px trigger is a line of ellipsis that tells you nothing, while "3
  // selecionados" tells you exactly how much is being left out.
  const summary =
    chosen.length === 0
      ? strings.tasksPage.filter.all
      : chosen.length === 1
        ? chosen[0].name
        : strings.tasksPage.filter.selected(chosen.length);

  return (
    <Select
      selectionMode={single ? 'single' : 'multiple'}
      value={single ? (values[0] ?? null) : values}
      onChange={(keys) => {
        if (single) {
          const next = keys === null ? undefined : String(keys);
          // The chosen option again clears it — the only way back to "all"
          // without an option in the list that means "none of the above".
          onChange(next && next !== values[0] ? [next] : []);
          return;
        }
        onChange((keys as (string | number)[]).map(String));
      }}
    >
      {/* The label is the Select's own, so pressing the words opens the list —
          on a row this shape the name is most of what there is to aim at. */}
      <Label className="sr-only">{label}</Label>
      <Select.Trigger className={FILTER_TRIGGER}>
        <span className="shrink-0 text-sm text-foreground">{label}</span>
        <span className="flex min-w-0 items-center gap-1 text-muted">
          <span className="truncate text-sm">{summary}</span>
          <ChevronRight className="size-3.5 shrink-0" aria-hidden />
        </span>
      </Select.Trigger>
      {/* Out to the side rather than down, which is what the arrow on the row
          promises. `right top` lines the list's first option up with the row it
          came from; react-aria flips it to the left on its own when the window
          has no room on that side. The 6px gap is the one part that is not the
          app's usual dropdown geometry — a list joined to the *edge* of a menu
          would read as the menu having grown a second column. */}
      <Select.Popover
        placement="right top"
        offset={6}
        className={`${FLOATING_PANEL} ${SIDE_PANEL}`}
      >
        <ListBox
          selectionMode={single ? 'single' : 'multiple'}
          className={LISTBOX_FLUSH}
        >
          {options.map((option) => (
            <ListBox.Item
              key={option.id}
              id={option.id}
              textValue={option.name}
              // The same size the menu it hangs off is set in: the list is a
              // continuation of the line you pressed, and a step down made the
              // options read as a footnote about it. The names are left exactly
              // as they were typed — a sector is somebody's word for a part of
              // the business, and case is part of the word.
              className={`${TEXT_LISTBOX_ITEM} flex items-center justify-between gap-2 text-sm`}
            >
              {/* The name may not run under the tick: `min-w-0` is what lets it
                  shrink inside the flex row at all — a flex item's floor is its
                  own content otherwise — and `truncate` then ends a name too
                  long for the panel with an ellipsis instead of sliding it under
                  the mark. See SIDE_PANEL for where the cut lands. */}
              <span className="min-w-0 truncate">{option.name}</span>
              <ListBox.ItemIndicator className="shrink-0" />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
