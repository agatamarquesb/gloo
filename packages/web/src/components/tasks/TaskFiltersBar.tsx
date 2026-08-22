import { useMemo, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  ListFilter,
  MoreVertical,
  Settings2,
  Trash2,
} from 'lucide-react';
import { parseDate, type CalendarDate } from '@internationalized/date';
import { Button, Label, ListBox, Popover, RangeCalendar, Select } from '@heroui/react';
// react-aria's own Button for the period row: HeroUI's brings a field's padding
// and a hover fill, and this row has to be indistinguishable from the four
// Select triggers beside it.
import { Button as AriaButton } from 'react-aria-components';

import { TaskStatus, type SectorDto, type TaskSortBy, type UserDto } from '@gloo/shared';

import { SearchField } from '@/components/common/SearchField';
import { SecondaryButton } from '@/components/common/SecondaryButton';
import {
  FLAT_SELECT_TRIGGER,
  FLOATING_PANEL,
  LISTBOX_FLUSH,
  NO_FIELD_BORDER,
  TEXT_LISTBOX_ITEM,
} from '@/theme/fieldStyles';
import { dotsMenuButton, menuRow, quietTextButton } from '@/theme/styleConstants';
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
export const CONTROL_HEIGHT = VIEW_TOGGLE_HEIGHT;

/**
 * The panel both menus drop: one floating card with a hairline, rounded on all
 * four corners.
 *
 * It used to square off the edge facing its button, which is what joins a panel
 * to the *field* it dropped from — and these no longer drop from a field. The
 * triggers carry no ground and no edge now (see TRIGGER_OPEN), so there is
 * nothing above the panel to meet: a squared top was a seam against thin air.
 *
 * The width is the caller's, not `--trigger-width`. Measuring the trigger looks
 * like the safer answer and is not: react-aria takes that measurement as the
 * popover opens, which is the same moment the button grows to its open width
 * (see SORT_TRIGGER_OPEN), so the panel came out a pixel or two off the button
 * it hangs under. Both are now told the same number.
 */
const MENU_PANEL = `${FLOATING_PANEL} rounded-lg`;

/**
 * What the button does while its panel is open: it squares off the two corners
 * the panel butts against, so the pair reads as one silhouette rather than as a
 * pill with a box hanging under it.
 *
 * What it no longer does is *grow*. It used to widen to a stated 11rem or 14rem
 * while open and let MENU_PANEL follow it, on the theory that a panel wider than
 * its trigger looks detached — but a trigger that changes width on press moves
 * every control after it on the row, and moves the panel with it, which is the
 * board's "the dropdown slides as I filter". The width the panel takes is now
 * simply the width the button already had, and neither of them moves.
 */
/**
 * The two triggers: the glyph, and nothing behind it in any state.
 *
 * No edge, no ground, not even while the panel is open. What was left of the
 * button's chrome — a grey fill under the cursor, a second one held while the
 * list was down — was the whole reason a row of three quiet controls read as a
 * row of boxes. The same treatment the app's `···` has always had: what answers
 * the pointer is the ink.
 *
 * `group` is for the label inside, which is only written while the panel is open
 * — see MENU_LABEL. It has to read the *button's* aria-expanded, and a child can
 * only do that through the group.
 */
const TRIGGER_OPEN = [
  'group aria-expanded:justify-start',
  dotsMenuButton,
  'aria-expanded:bg-transparent',
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

/**
 * The width each menu opens at — the button's and its panel's, one number.
 *
 * At rest the buttons are the size of what is written on them: a pill with a
 * glyph, a word, and nothing between them and their own edges. Held permanently
 * at the panel's width they were two mostly-empty capsules on a row of controls
 * that all hug their labels.
 *
 * Open, each grows to the width its panel needs — three short words for
 * "Ordenar", a property name against its value for "Filtrar", whose longest
 * line is "Responsável" — and the panel is given the very same class, so the
 * seam between the two cannot drift. It grows to the right, so the button's own
 * left edge, which is what the panel is anchored to, never moves.
 */
/**
 * Written out twice per menu rather than composed, because Tailwind reads these
 * class names out of the source text and never sees a string built at runtime:
 * an `aria-expanded:` variant interpolated from the constant below would
 * generate no rule at all. The two halves of each pair have to change together.
 */
const SORT_MENU_WIDTH = 'w-40';
const SORT_TRIGGER_OPEN = `${TRIGGER_OPEN} aria-expanded:w-40`;
const FILTER_MENU_WIDTH = 'w-52';
const FILTER_TRIGGER_OPEN = `${TRIGGER_OPEN} aria-expanded:w-52`;

/**
 * The two buttons at rest: the glyph and nothing else, in a disc the height of
 * everything else on the row.
 *
 * The words come back the moment the panel does — see MENU_LABEL — which is the
 * only moment they are load-bearing: closed, "Ordenar" and "Filtrar" named two
 * controls whose icons say the same thing, and between the view toggle and the
 * `⋮` they were the only things on the row wide enough to read as a sentence.
 *
 * `aria-expanded:w-*` above wins over this because it comes later in the class
 * list *and* because Tailwind orders width utilities by specificity of variant,
 * not source — the variant class is the more specific of the two.
 */
const MENU_TRIGGER_CLOSED = 'aspect-square p-0 aria-expanded:aspect-auto aria-expanded:px-4';

/** And the label it hides: written only while the panel under it is open. */
const MENU_LABEL = 'hidden group-aria-expanded:inline';

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
  dueDateFrom,
  dueDateTo,
  onPeriodChange,
  statusLocked = false,
  showViewToggle = true,
  onOpenTrash,
  onClearFilters,
  trailing,
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
  /** The window of deadlines the list is under, as `YYYY-MM-DD`, or undefined. */
  dueDateFrom?: string;
  dueDateTo?: string;
  /** Both ends at once — a period is one answer, not two. Null clears it. */
  onPeriodChange?: (range: { from: string; to: string } | null) => void;
  /**
   * Whether the status row is shown but unusable — which is what the Lixeira
   * needs. A deleted task's status is a fact about the day it was deleted and
   * narrowing forty binned rows by it answers nothing, but taking the row *out*
   * would make the panel change shape between the list and its bin. So it stays,
   * greyed, saying that this one question does not apply here.
   */
  statusLocked?: boolean;
  /** Whether the list/board switch is on the row — the Lixeira is a list only. */
  showViewToggle?: boolean;
  /**
   * The one thing the `⋮` after "Filtrar" offers: the bin.
   *
   * A menu of one, and deliberately so — it is a place to put the things that
   * change what the list *is* rather than what it shows, and the bin is the
   * first of them. Turning the tick boxes on used to be the second; it went
   * because hovering a row already offers its box, which is a shorter way to the
   * same thing than a menu naming it. Left off, the button is not drawn at all.
   */
  onOpenTrash?: () => void;
  /**
   * Puts every one of the panel's rows back to "Todos" at once.
   *
   * A way out that does not depend on remembering what you set: each row clears
   * itself by choosing its current value again, which works and is a thing
   * nobody discovers. It sits under the rows rather than among them because it
   * is not a filter — it is what undoes them.
   */
  onClearFilters?: () => void;
  /**
   * One more control on the left group, after the `⋮` — the Lixeira's "Esvaziar
   * lixeira".
   *
   * Here rather than beside the bin's own heading so it keeps the row's height
   * and type size: it is one of the things you do to the list, and the row of
   * things you do to the list is this one.
   */
  trailing?: ReactNode;
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
            than on a list, and this is the control that says which you are on.

            Gone in the Lixeira: a board is a split by status, and the bin has
            one thing to say about every row in it. */}
        {showViewToggle ? <TaskViewToggle value={view} onChange={onViewChange} /> : null}

        {/* The three travel as one cluster, closer to each other than to
            anything else on the row: they are the same kind of thing — a press
            that drops a panel — and at the row's own gap they read as three
            unrelated controls that happen to be adjacent. */}
        <div className="flex items-center gap-0.5">
        <Popover>
          {/* No edge on any of the three: an outline round each turned a row of
              quiet controls into a row of boxes, and what they open is a panel
              that draws its own. What answers the cursor is the fill — see the
              ghost variant — and while a panel is open the fill stays, which is
              what joins the button to it. */}
          <Button
            variant="ghost"
            aria-label={strings.common.sortBy}
            className={`${CONTROL_HEIGHT} ${MENU_TRIGGER_CLOSED} shrink-0 rounded-full ${SORT_TRIGGER_OPEN}`}
          >
            {/* Three lines narrowing to a point: a list being funnelled into an
                order. The arrow this carried said A–Z, which is not what any of
                the three sorts actually does. */}
            <ListFilter className="size-4 shrink-0" />
            <span className={MENU_LABEL}>{strings.common.sortBy}</span>
          </Button>
          <Popover.Content offset={4} className={`${SORT_MENU_WIDTH} ${MENU_PANEL}`}>
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
            variant="ghost"
            aria-label={strings.common.filterBy}
            className={`${CONTROL_HEIGHT} ${MENU_TRIGGER_CLOSED} shrink-0 rounded-full ${FILTER_TRIGGER_OPEN} ${
              // Closed there is no label to write in green, so the glyph carries
              // it: `text-green-deep` is on the button and the icon inherits it.
              isFiltered ? 'font-semibold text-green-deep' : ''
            }`}
          >
            {/* Two rows with a knob on each: settings being adjusted, which is
                what the popover behind this actually holds. The funnel went to
                "Ordenar", where a narrowing shape means something. */}
            <Settings2 className="size-4 shrink-0" />
            <span className={MENU_LABEL}>{strings.common.filterBy}</span>
          </Button>
          <Popover.Content offset={4} className={`${FILTER_MENU_WIDTH} ${MENU_PANEL}`}>
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
                    isDisabled={statusLocked}
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

                {/* Last, and the one row of the five that is not a list of
                    names: a deadline is a place on a month, so what opens is a
                    month. Same row, same value-at-the-far-end, same arrow — the
                    difference is behind the arrow, which is where it belongs. */}
                {onPeriodChange ? (
                  <PeriodFilterRow
                    from={dueDateFrom}
                    to={dueDateTo}
                    onChange={onPeriodChange}
                  />
                ) : null}

                {/* Under the rows and against the panel's right edge — the
                    corner a form's "done" is read from, which is also where the
                    period's own tick sits. Only lit while something is actually
                    set: a "Limpar" over five rows that all say "Todos" is a
                    button that cannot do anything. */}
                {onClearFilters ? (
                  <>
                    {/* The same hairline the sort menu draws between its orders
                        and their direction, and for the same reason: what is
                        under it is not another filter, it is what undoes them.
                        Inset by the rows' own padding so it starts where their
                        words do. */}
                    <span aria-hidden className="mx-2 mt-1 h-px bg-border" />
                    <div className="flex justify-end px-1 pt-1.5">
                    <SecondaryButton
                      size="sm"
                      className="text-xs"
                      // Its own test rather than `isFiltered`, which is the
                      // *label's* — that one leaves the status out on purpose,
                      // since the pills under the bar already say it. This
                      // button clears the status row too, so it has to light up
                      // for it.
                      isDisabled={
                        sectorIds.length === 0 &&
                        assigneeIds.length === 0 &&
                        projectIds.length === 0 &&
                        !status &&
                        !dueDateFrom &&
                        !dueDateTo
                      }
                      onPress={onClearFilters}
                    >
                      {strings.common.clear}
                    </SecondaryButton>
                    </div>
                  </>
                ) : null}
              </div>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>

        {/* Three dots and no more: what is behind them changes what the list is
            *for* rather than what it shows, so neither belongs on the row as a
            word competing with "Ordenar" and "Filtrar".

            The glyph darkens on hover and takes no ground — the app's own `···`
            button, wherever it appears. */}
        {onOpenTrash ? (
          <Popover>
            <AriaButton
              aria-label={strings.tasksPage.menu.label}
              className={`${quietTextButton} ${CONTROL_HEIGHT} aspect-square shrink-0 justify-center rounded-full`}
            >
              <MoreVertical className="size-4" />
            </AriaButton>
            {/* Left edges together, opening to the right — the way every other
                panel on this row hangs. It used to be anchored by its right
                edge, which was the one dropdown in the section that grew back
                towards the controls it came from. */}
            <Popover.Content offset={4} placement="bottom start" className={`w-48 ${FLOATING_PANEL}`}>
              <Popover.Dialog className="p-1">
                <div className="flex flex-col gap-0.5">
                  <button type="button" className={`${menuRow} gap-2`} onClick={onOpenTrash}>
                    <Trash2 className="size-3.5 shrink-0" aria-hidden />
                    {strings.tasksPage.menu.trash}
                  </button>
                </div>
              </Popover.Dialog>
            </Popover.Content>
          </Popover>
        ) : null}

        </div>

        {trailing}
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
        <SearchField
          value={search}
          onChange={onSearchChange}
          heightClass={CONTROL_HEIGHT}
          // The Dashboard's own measure — see the "Minhas tarefas" card, which is
          // the other place this field appears. At 16rem it was the widest thing
          // on the row by half, and a search box is not what the row is about.
          className="min-w-0 flex-1 sm:w-40"
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
  isDisabled = false,
}: {
  label: string;
  /** Everything ticked. Empty for "no narrowing at all". */
  values: string[];
  options: { id: string; name: string }[];
  onChange: (value: string[]) => void;
  /** One answer at most — see the status row above. */
  single?: boolean;
  /**
   * The row drawn but locked — the Lixeira's status. Faded and unpressable,
   * rather than removed, so the panel keeps its shape between the list and its
   * bin and the reader can see *which* question stopped applying.
   */
  isDisabled?: boolean;
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
      isDisabled={isDisabled}
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
      <Select.Trigger
        className={`${FILTER_TRIGGER} ${isDisabled ? 'cursor-not-allowed opacity-45 hover:bg-transparent' : ''}`}
      >
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

/**
 * How wide the month in the period row is cut.
 *
 * Wider than the name lists beside it (SIDE_PANEL) because seven columns of two
 * digits and a selection band across them need the room — at the lists' 13.75rem
 * the last column was being clipped by the panel's own edge, exactly as the
 * deadline calendar was before .gloo-compact-calendar existed.
 */
const PERIOD_PANEL = 'w-[15.5rem]';

/**
 * A window's two ends, as short as a menu row can read them: "17 ago – 22 ago".
 *
 * Shorter than formatShortDate, which the rest of the app uses — that one keeps
 * the year, and two of those on one line of a 208px panel is an ellipsis where
 * the second date should be. The year is what a window on a month can most
 * afford to lose: the month it was chosen on is one press away and says so.
 */
const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' });

function shortDay(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return day;
  // The number and the month put together by hand rather than asked for as one
  // date: pt-BR spells that "17 de ago.", and the preposition and full stop are
  // three characters this row cannot spare.
  return `${date.getUTCDate()} ${monthName.format(date).replace('.', '')}`;
}

/**
 * The deadline window, as a month you drag across.
 *
 * The same row as the four filters above it and the same panel geometry as the
 * task dialog's Prazo, so a calendar in this app looks like a calendar in this
 * app wherever it opens. What it adds is the second date: press the first day,
 * press the last, and the days between fill in as one unbroken band with its two
 * ends in solid green — HeroUI's own range treatment, which is exactly the shape
 * asked for.
 *
 * And a tick under it, because a range is the one answer in this panel that is
 * not finished when it is made: a single press leaves a window of one day that
 * looks the same as half a window, so nothing is committed until the check is
 * pressed. Held locally until then — the list behind does not re-filter under
 * you while you are choosing where the window ends.
 */
function PeriodFilterRow({
  from,
  to,
  onChange,
}: {
  from?: string;
  to?: string;
  onChange: (range: { from: string; to: string } | null) => void;
}) {
  const [isOpen, setOpen] = useState(false);

  /** The window as the month understands it, or null if there isn't one. */
  const committed = useMemo(() => {
    try {
      return from && to ? { start: parseDate(from), end: parseDate(to) } : null;
    } catch {
      return null;
    }
  }, [from, to]);

  /**
   * What is drawn on the month right now — which is what has been pressed, not
   * what the list is under. Re-seeded from the committed window every time the
   * panel opens, so a panel reopened after a change shows the change.
   */
  const [draft, setDraft] = useState<{ start: CalendarDate; end: CalendarDate } | null>(committed);

  const summary =
    from && to
      ? strings.tasksPage.filter.range(shortDay(from), shortDay(to))
      : strings.tasksPage.filter.all;

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (open) setDraft(committed);
        setOpen(open);
      }}
    >
      {/* `flex items-center` said here and not in FILTER_TRIGGER: the four rows
          above are Select triggers, which HeroUI already lays out as a flex row.
          A bare button is not one, and without this the name and its value stack
          into two lines. */}
      <AriaButton className={`${FILTER_TRIGGER} flex items-center`}>
        <span className="shrink-0 text-sm text-foreground">{strings.tasksPage.filter.period}</span>
        <span className="flex min-w-0 items-center gap-1 text-muted">
          <span className="truncate text-sm">{summary}</span>
          <ChevronRight className="size-3.5 shrink-0" aria-hidden />
        </span>
      </AriaButton>

      {/* Out to the side like the four lists above it, and for the same reason:
          the arrow on the row promises a panel there. */}
      <Popover.Content
        placement="right top"
        offset={6}
        className={`${FLOATING_PANEL} ${PERIOD_PANEL}`}
      >
        <Popover.Dialog className="flex flex-col gap-1.5 p-2">
          <RangeCalendar
            className="gloo-compact-calendar w-full max-w-none [--spacing:0.15rem]"
            aria-label={strings.tasksPage.filter.period}
            value={draft}
            onChange={(range) => setDraft(range as { start: CalendarDate; end: CalendarDate })}
          >
            <RangeCalendar.Header>
              <RangeCalendar.YearPickerTrigger>
                <RangeCalendar.YearPickerTriggerHeading />
                <RangeCalendar.YearPickerTriggerIndicator />
              </RangeCalendar.YearPickerTrigger>
              <RangeCalendar.NavButton slot="previous" />
              <RangeCalendar.NavButton slot="next" />
            </RangeCalendar.Header>
            <RangeCalendar.Grid>
              <RangeCalendar.GridHeader>
                {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
              </RangeCalendar.GridHeader>
              <RangeCalendar.GridBody>
                {(date) => <RangeCalendar.Cell date={date} />}
              </RangeCalendar.GridBody>
            </RangeCalendar.Grid>
            <RangeCalendar.YearPickerGrid>
              <RangeCalendar.YearPickerGridBody>
                {({ year }) => <RangeCalendar.YearPickerCell year={year} />}
              </RangeCalendar.YearPickerGridBody>
            </RangeCalendar.YearPickerGrid>
          </RangeCalendar>

          {/* Bottom right, under the month it commits — the corner a form's
              "done" is read from. A tick and no word: the panel is 15rem wide
              and everything in it is already about the window on screen, so the
              button only has to say "this one". Pressing it with nothing chosen
              clears the filter, which is the way back to every deadline. */}
          <div className="flex justify-end">
            <Button
              isIconOnly
              size="sm"
              variant="primary"
              className="size-7 shrink-0 rounded-full"
              aria-label={strings.tasksPage.filter.confirmPeriod}
              onPress={() => {
                onChange(
                  draft ? { from: draft.start.toString(), to: draft.end.toString() } : null,
                );
                setOpen(false);
              }}
            >
              <Check className="size-3.5" />
            </Button>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
