import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Building2,
  CalendarDays,
  CircleDot,
  Flag,
  FolderKanban,
  Gauge,
  Link2,
  Pencil,
  Plus,
  Tag,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { parseDate, type CalendarDate } from '@internationalized/date';
import { Button, Calendar, Label, ListBox, Modal, Popover, Select } from '@heroui/react';
// react-aria's own Button, not HeroUI's, for the two properties that open
// something other than a dropdown: HeroUI's carries its own padding, radius and
// hover fill, and all three are exactly what a bare property value must not
// have. This one is a press target and nothing else.
import { Button as AriaButton, TextArea, TextField } from 'react-aria-components';

import {
  LabelScope,
  TaskPriority,
  type AttachmentDto,
  type TaskDetailDto,
  type TaskStatus,
  type UserDto,
} from '@gloo/shared';

import { AttachmentsBlock } from '@/components/common/AttachmentsBlock';
import { NotesBlock } from '@/components/common/NotesBlock';
import { isNotesEmpty } from '@/components/common/RichNotes';
import { SecondaryButton } from '@/components/common/SecondaryButton';
import { UserAvatar } from '@/components/common/UserAvatar';
// The picker a routine's tags are chosen from — the same panel, the same
// create/edit flow. Tags are one pool shared by both kinds of thing, so this is
// deliberately the same component rather than a second one that looks like it.
import { LabelPicker } from '@/components/dashboard/LabelPicker';
import { useMe } from '@/hooks/queries/auth';
import { useLabels } from '@/hooks/queries/labels';
import { useSectors } from '@/hooks/queries/sectors';
import { useDeleteTask, useTask, useUpdateTask, useUpdateTaskStatus } from '@/hooks/queries/tasks';
import { useUsers } from '@/hooks/queries/users';
import { formatDay } from '@/lib/formatDate';
import { canMutateEntity } from '@/lib/permissions';
import { playSound } from '@/lib/sounds';
import { FIELD_PANEL, PILL_LISTBOX_ITEM, TEXT_LISTBOX_ITEM, listboxPopover } from '@/theme/fieldStyles';
import { colorFill } from '@/theme/labelColors';
import {
  EMPTY_VALUE,
  LABEL_ICON,
  PROPERTY_LIST,
  PROPERTY_ROW_PITCH,
  PROPERTY_ROW_SPLIT,
  VALUE_CELL,
  propertyStyles,
} from '@/theme/propertyRow';
import {
  dialogClose,
  dialogSection,
  modalDivider,
  modalDividerGap,
  outlineControl,
  quietTextButton,
} from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

import { PriorityChip } from './PriorityChip';
import { OverdueMark } from './StatusChip';
import { TaskProgressBar } from './TaskProgressBar';
import { TaskStatusChipSelect } from './TaskStatusChipSelect';
import { TaskSubtasks } from './TaskSubtasks';

const PRIORITY_OPTIONS: TaskPriority[] = [
  TaskPriority.LOW,
  TaskPriority.MEDIUM,
  TaskPriority.HIGH,
];

/**
 * The air between the last property and the rule that closes the dialog's upper
 * half off.
 *
 * The two columns have to *end together* — the rule under the properties and the
 * rule under Visão geral are one line across the dialog — and this is what makes
 * that true without pinning either of them: the properties set the height of the
 * half, and the note fills whatever is left of it, minus exactly this. So the
 * note's last line lands level with "Responsável" and the two rules meet, and a
 * property that wraps onto a second line simply takes both sides down with it.
 */
const TOP_COLUMN_TAIL = 'h-4';

/**
 * The dialog's own shape.
 *
 * Taller and narrower than the shared `dialogShape`: a task is read down its two
 * columns, so height is what it wants and width is what pushed the properties
 * away from their values. `my-0` is the point of the height — HeroUI centres a
 * dialog with automatic block margins, and those are what was left over as a
 * band of backdrop above and below. Gone, and with `h-full` the dialog is
 * whatever the modal container leaves it, top to bottom.
 */
const DIALOG_SHAPE = 'rounded-2xl sm:my-0 sm:h-full sm:max-w-[46rem]';

/**
 * The dialog's own padding — 20px at the sides and on top, a little less under
 * the buttons, which carry their own visual weight. Its own rather than the
 * shared `dialogPadding` so the routine modal keeps the inset it was tuned for.
 */
const DIALOG_PADDING = 'px-5 pt-5 pb-[15px]';

/**
 * What is left round it: the container's padding, which is now the dialog's only
 * clearance from the window — 16px, top and bottom. HeroUI's own is 40px from
 * `sm` up, which on a dialog that is meant to run the height of the screen is
 * most of the reason it did not.
 */
const DIALOG_INSET = 'p-4';

/**
 * The tags a task carries, above its title — and, in edit mode, the way to add
 * one.
 *
 * 10px of air above and below rather than a row height: the pills set how tall
 * this is, and the row only has to keep them off the header's rule and off the
 * title. That 10 is also what puts a tag's top edge level with "Visão geral"
 * across the gutter — the note's heading row is 40px with a 20px line centred in
 * it, so its text starts 10px down as well. `min-h` for the case where there are
 * none and the dialog is locked — without it the row collapses and the title
 * jumps the moment a first tag is added.
 */
const TAGS_ROW = 'flex min-h-5 flex-wrap items-center gap-2 py-[10px]';

/**
 * A tag on a task. The same cut as a routine's — see PILL_SHAPE — restated here
 * because the two are separate vocabularies now (see LabelScope) and only look
 * alike on purpose; one changing size should not drag the other with it.
 */
const TASK_LABEL_PILL = 'rounded-md px-2 py-1 text-[13px] leading-4 text-black';

/**
 * A property's value: the routine modal's own 14px, so the two dialogs read at
 * one size, in lower case so the column reads as one voice rather than as a chip
 * among sentences.
 *
 * `font-medium` — the same step up the subtasks and the attachment titles take.
 * The labels are medium too, so what tells a value from its label here is the
 * colour, not the weight: grey asks, full strength answers.
 */
const PROPERTY_VALUE = 'text-sm font-medium text-foreground';
const PROPERTY_VALUE_LOWER = `${PROPERTY_VALUE} lowercase`;

/**
 * What every popover a property opens is set in: the size of the value it drops
 * from.
 *
 * A list is the same words as the row above it, one of which is already chosen —
 * so choosing is recognising the value you are looking at, and a step down in
 * size made the options read as a footnote about it instead.
 *
 * And they wrap. The panel is only as wide as the property it hangs from, so a
 * sector with two words in it ran off the edge; an option that does not fit now
 * takes a second line and its own row grows by one, which keeps the spacing
 * between options exactly where it was.
 *
 * The deadline's calendar is the exception: it is a grid rather than a list, and
 * has a scale of its own — see .gloo-compact-calendar in globals.css.
 */
const LISTBOX_TEXT =
  'text-sm whitespace-normal break-words [&>*]:whitespace-normal [&>*]:break-words';

/**
 * And how wide the panel is: the value column, so its right edge lands on the
 * same line the rules across the dialog end on — the line the × in Anexos sits
 * against. HeroUI sizes a Select's panel to its content otherwise, which left a
 * list of two-word sectors narrower than the row it dropped from.
 *
 * The trigger's width and no more: HeroUI measures it *after* the field has
 * grown its open-state ground, so `--trigger-width` is already the width of the
 * grey band the panel hangs from — and the two share both edges by
 * construction. (Adding the ground's 8px here, which an earlier reading of that
 * variable seemed to need, made the panel overhang by exactly that much.)
 */
const LISTBOX_PANEL = 'w-(--trigger-width)';

/**
 * The task's name, in both of its states — the heading you read and the field
 * you type in. One class so the two are the same block of text and switching
 * between them moves nothing: same size, same measure, and wrapping rather than
 * running on, since the title now takes the left column's width and a long one
 * has to come down onto a second line instead of crossing the gutter.
 *
 * A step above the routine modal's `text-xl`: this one has a tag row above it
 * and section headings below it, and at 20px it no longer led its own column.
 *
 * The weight is deliberately absent: bold at rest, plain while being typed —
 * see the title below.
 */
const TITLE_TEXT = 'block w-full min-w-0 text-[1.375rem] break-words text-foreground';

/**
 * The distance from the title to the two columns under it — half what the body's
 * own `gap-4` gave it, which read as a band of empty dialog rather than as
 * spacing. On the title's cell rather than as the grid's row gap, because the
 * row below it closes against its own rules and must keep none.
 */
const TITLE_GAP = 'pb-2';

/**
 * The left column's own inset, matching the padding every section in the dialog
 * carries — see taskBlockBox.
 *
 * Without it the tags, the title and the property labels started 12px to the
 * left of "Subtarefas" under them, which read as two columns of different width
 * stacked on top of each other. One left edge down the whole side.
 */
const COLUMN_INSET = 'px-3';

/**
 * The rule between the two columns.
 *
 * It runs from above the tags — so the two halves of the dialog are divided all
 * the way up — down past the body and over the footer, ending on the bottom edge
 * of Cancelar. The dialog is two columns for its whole height, and a rule that
 * stopped where the body did left the buttons hanging under a shape that had
 * closed above them.
 *
 * That is why it is positioned against the body and footer together rather than
 * drawn in the grid's middle column: a grid cell cannot overflow its grid, and
 * the body has to clip (it must not scroll — see Modal.Body). `left-1/2` lands
 * it exactly on that middle column all the same, the two outer columns being
 * `1fr` each and the gutters equal.
 *
 * The 12px it starts down from the body's top edge is the clearance it keeps
 * from the header's rule — the same distance it keeps from the rules either
 * side of it lower down, so the line reads as inset by one distance wherever it
 * approaches another.
 */
const COLUMN_RULE =
  'pointer-events-none absolute top-3 bottom-0 left-1/2 hidden w-px -translate-x-1/2 bg-border md:block';

/**
 * The order the properties are read in.
 *
 * Fixed, and no longer the reader's to change: dragging them about was a
 * setting nobody asked the dialog for, kept per browser in localStorage, and it
 * made the one part of a task that should look the same every time you open it
 * the one part that did not. The order is what a task *is* — how urgent, by
 * when, whose part of the business, which project, where it has got to, whose
 * it is.
 */
const PROPERTY_ORDER = [
  'priority',
  'deadline',
  'sector',
  'project',
  'status',
  'assignee',
  'progress',
] as const;

type TaskPropertyKey = (typeof PROPERTY_ORDER)[number];

/**
 * A property whose value opens a popover rather than a dropdown — the deadline
 * and the project.
 *
 * `relative`, because the chevron is placed the way HeroUI places a Select's:
 * absolutely, 8px in from the trigger's own right edge. The trigger overhangs
 * its column by exactly that 8px (see BARE_TRIGGER), so every chevron in the
 * list — HeroUI's and this one — lands on one vertical line.
 */
// No width of its own: the shared trigger class already overhangs the column by
// the chevron's inset, and a `w-full` here would take that back and pull this
// chevron 8px left of every Select's.
const POPOVER_TRIGGER = 'relative flex rounded-md outline-none';

/**
 * The calendar cut to the panel it now lives in: a shorter spacing scale for the
 * gaps between cells, and the type a step down — see .gloo-compact-calendar in
 * globals.css, which is where the class-name selectors live and why.
 */
const CALENDAR_TYPE = 'gloo-compact-calendar [--spacing:0.2rem]';

/**
 * Everything the dialog edits as a form. Status is deliberately not here: it
 * saves the moment it changes, both because it is the one property you can also
 * change from a task row and because it drives the clock behind the productivity
 * chart — a status staged for later would start that clock at the wrong time.
 *
 * Progress is absent for a different reason: it is computed from the subtasks
 * and cannot be set by hand at all.
 */
interface FormState {
  title: string;
  priority: TaskPriority;
  /** A bare calendar day, `YYYY-MM-DD`, or '' for no deadline. */
  dueDate: string;
  sectorId: string;
  assigneeIds: string[];
  /** The task's notes, as markup — the same rich text a routine's notes hold. */
  notes: string;
  attachments: AttachmentDto[];
  /** The tags it wears, from the pool routines draw on — see LabelPicker. */
  labelIds: string[];
}

/** The form as the API takes it — also the shape the dirty check compares. */
function toPayload(form: FormState) {
  return {
    title: form.title.trim(),
    // Markup that renders as nothing is an empty note, which is what the API
    // stores it as — so the dirty check has to call it empty too, or every save
    // would leave the form looking changed against what came back.
    description: isNotesEmpty(form.notes) ? null : form.notes,
    priority: form.priority,
    // Midnight UTC on the day chosen: a deadline is a day, not an instant, and
    // this is the form every reader of the column expects — see formatDate.ts.
    dueDate: form.dueDate ? `${form.dueDate}T00:00:00.000Z` : null,
    sectorId: form.sectorId,
    assigneeIds: form.assigneeIds,
    attachments: form.attachments,
    labelIds: form.labelIds,
  };
}

function toFormValue(task: TaskDetailDto): FormState {
  return {
    title: task.title,
    priority: task.priority,
    dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
    sectorId: task.sector.id,
    assigneeIds: task.assignees.map((assignee) => assignee.id),
    notes: task.description ?? '',
    attachments: task.attachments ?? [],
    labelIds: task.labels.map((label) => label.id),
  };
}

/**
 * Who the task belongs to, as the property row shows it.
 *
 * One person reads as a name with their face beside it, the way a routine's
 * does. More than one drops the names and keeps the faces: three names in a
 * property cell wrap onto three lines, and the faces are what you recognise a
 * team by anyway.
 */
function AssigneeValue({ users, canAdd }: { users: UserDto[]; canAdd: boolean }) {
  if (users.length === 0) {
    return <span className={`${PROPERTY_VALUE} text-muted!`}>{strings.task.noAssignees}</span>;
  }

  return (
    <span className="flex min-w-0 items-center gap-2">
      {users.length === 1 ? (
        <span className={`flex min-w-0 items-center gap-2 ${PROPERTY_VALUE}`}>
          <UserAvatar
            name={users[0].name}
            avatarUrl={users[0].avatarUrl}
            size="sm"
            className="size-5"
          />
          <span className="truncate">{users[0].name}</span>
        </span>
      ) : (
        // Overlapped, each ringed in the dialog's own surface so the faces read
        // as a stack rather than a smear. Sized to the row, not to the avatar
        // group on a task card, which sits in a taller row.
        <span className="flex items-center -space-x-1.5">
          {users.map((user) => (
            <span key={user.id} className="rounded-full ring-2 ring-surface" title={user.name}>
              <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="sm" className="size-5" />
            </span>
          ))}
        </span>
      )}

      {/* "Add someone else", in the avatar group's own shape and right where the
          faces end — so the way to add the second person is beside the first
          rather than at the far side of the row. It takes the chevron's place
          once anyone is assigned: an empty property still needs the chevron to
          say it can be opened at all, but a face plus a plus says it better. */}
      {canAdd ? (
        <span
          aria-hidden
          className="flex size-5 shrink-0 items-center justify-center rounded-full border border-dashed border-outline-control text-muted"
        >
          <Plus className="size-3" />
        </span>
      ) : null}
    </span>
  );
}

/**
 * The deadline: a date written out in full ("30 de julho, 2026") that opens a
 * calendar when the dialog is unlocked.
 *
 * A calendar in a popover rather than the segmented `DateField` the create form
 * uses, because a property row shows a *value*, not a field — three editable
 * segments and a suffix button would be the only control in the column with
 * chrome of its own.
 */
function DeadlineValue({
  value,
  onChange,
  isEditing,
  isOverdue,
  triggerClass,
}: {
  value: string;
  onChange: (value: string) => void;
  isEditing: boolean;
  /**
   * Whether the day has passed on a task nobody has finished. The date says so
   * itself, in the same red the mark on the status row wears — the two are one
   * statement about the same fact, two rows apart.
   */
  isOverdue: boolean;
  triggerClass: string;
}) {
  const [isOpen, setOpen] = useState(false);

  const selected = useMemo<CalendarDate | null>(() => {
    try {
      return value ? parseDate(value) : null;
    } catch {
      return null;
    }
  }, [value]);

  const label = formatDay(value) ?? EMPTY_VALUE;
  const tone = isOverdue ? 'text-status-overdue-text!' : '';
  // The mark belongs to the date, not to the row: it says this *day* has passed,
  // so it follows the day itself and moves with it into and out of edit mode.
  const mark = isOverdue ? <OverdueMark className="shrink-0" /> : null;

  if (!isEditing) {
    return (
      <span className="flex items-center gap-1.5">
        <span className={`${PROPERTY_VALUE} ${tone}`}>{label}</span>
        {mark}
      </span>
    );
  }

  return (
    <Popover isOpen={isOpen} onOpenChange={setOpen}>
      {/* No fill and no hover: a date is a value you can change, and a pill
          lighting up under the cursor made it the loudest thing in the column. */}
      <AriaButton className={`${triggerClass} ${POPOVER_TRIGGER}`}>
        <span className={`break-words ${PROPERTY_VALUE} ${tone}`}>{label}</span>
        {mark}
      </AriaButton>

      {/* Cut to the field it hangs from: the popover takes the trigger's own
          width and the calendar fills it, instead of a 252px card sitting wider
          than the row it belongs to. HeroUI's calendar is `container-type:
          inline-size` — its cells are a share of its width — so narrowing the
          panel shrinks the whole grid rather than clipping it. */}
      <Popover.Content {...listboxPopover} className={`${LISTBOX_PANEL} ${FIELD_PANEL}`}>
        <Popover.Dialog className="p-2">
          <Calendar
            className={`w-full max-w-none ${CALENDAR_TYPE}`}
            aria-label={strings.task.fields.deadline}
            value={selected}
            onChange={(date) => {
              onChange(date ? date.toString() : '');
              // Nothing else to choose once a day is picked, and a calendar left
              // open over the properties hides the rows it was opened from.
              setOpen(false);
            }}
          >
            <Calendar.Header>
              <Calendar.YearPickerTrigger>
                <Calendar.YearPickerTriggerHeading />
                <Calendar.YearPickerTriggerIndicator />
              </Calendar.YearPickerTrigger>
              <Calendar.NavButton slot="previous" />
              <Calendar.NavButton slot="next" />
            </Calendar.Header>
            <Calendar.Grid>
              <Calendar.GridHeader>
                {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
              </Calendar.GridHeader>
              <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
            </Calendar.Grid>
            <Calendar.YearPickerGrid>
              <Calendar.YearPickerGridBody>
                {({ year }) => <Calendar.YearPickerCell year={year} />}
              </Calendar.YearPickerGridBody>
            </Calendar.YearPickerGrid>
          </Calendar>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

/**
 * The project the task belongs to.
 *
 * There are no projects yet — no page, no model, nothing to pick — so the row
 * exists and says so when pressed. It is here rather than waiting for the
 * feature because the property list is the shape of a task, and leaving a gap in
 * it would have to be filled in twice: once now and once when projects land.
 */
function ProjectValue({ isEditing, triggerClass }: { isEditing: boolean; triggerClass: string }) {
  if (!isEditing) {
    return <span className={`${PROPERTY_VALUE_LOWER} text-muted!`}>{EMPTY_VALUE}</span>;
  }

  return (
    <Popover>
      <AriaButton className={`${triggerClass} ${POPOVER_TRIGGER}`}>
        <span className={`${PROPERTY_VALUE_LOWER} text-muted!`}>{EMPTY_VALUE}</span>
      </AriaButton>
      {/* Sized to what it says rather than to a fixed 16rem — empty, it was a
          wide flat capsule instead of the small card the status dropdown drops
          under its own chip. The message a step down in size, and enough padding
          that the box has a card's height even with a single line in it. */}
      <Popover.Content {...listboxPopover} className={`${LISTBOX_PANEL} ${FIELD_PANEL}`}>
        <Popover.Dialog className="flex min-h-28 items-center justify-center px-4 py-4">
          {/* Centred and wrapping: the panel is only as wide as the property it
              hangs from, and a line that refused to break ran out of it. A step
              below the lists' own size — this is the panel saying it has nothing
              to offer, not an option in it. */}
          <p className="text-center text-xs break-words text-muted">
            {strings.task.projectsEmpty}
          </p>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

/**
 * The task's tags, over its title — the pills it wears, and the one way to
 * change them.
 *
 * The button is the picker's trigger and takes two shapes. With no tags it is a
 * tag glyph, which is the only thing in the row and has to say what the row is
 * for; with tags it becomes a "+" at the head of them, because the row then
 * already says it and all that is left is a way to add to it. Either way it is
 * the glyph alone with the hint on the cursor — a labelled button above the
 * title competed with the title.
 *
 * Editing only: a tag is part of what a task *is*, and everything else about
 * that is behind Editar too.
 */
function TaskLabelsRow({
  labelIds,
  onChange,
  isEditing,
}: {
  labelIds: string[];
  onChange: (ids: string[]) => void;
  isEditing: boolean;
}) {
  // The task pool, never the routines' — see LabelScope.
  const { data: labels = [] } = useLabels(LabelScope.TASK);
  const selected = labels.filter((label) => labelIds.includes(label.id));

  // Locked and empty there is nothing to show and nothing to add — but the row
  // itself stays, so unlocking the dialog doesn't move the title.
  if (!isEditing && selected.length === 0) return <div className={TAGS_ROW} />;

  return (
    <div className={TAGS_ROW}>
      {isEditing ? (
        <LabelPicker
          scope={LabelScope.TASK}
          selectedIds={labelIds}
          onChange={onChange}
          trigger={
            <Button
              size="sm"
              variant="outline"
              isIconOnly={selected.length > 0}
              aria-label={strings.label.add}
              className={`shrink-0 rounded-full ${outlineControl} ${
                selected.length === 0 ? 'h-6 min-h-0 gap-1 px-2 text-[13px]' : 'size-6'
              }`}
            >
              {/* `title` on a wrapper, not the Button — HeroUI's Button doesn't
                  forward it, the same reason the note's format buttons wrap
                  theirs. With no tags yet the button carries the word too: an
                  empty row and a lone glyph said nothing about what pressing it
                  would produce. Once there are tags the row says it, and the
                  button comes down to the "+" at the head of them. */}
              {selected.length === 0 ? (
                <span title={strings.label.add} className="flex items-center gap-1">
                  <Tag className="size-3.5" />
                  {strings.label.one}
                </span>
              ) : (
                <span
                  title={strings.label.add}
                  className="flex size-full items-center justify-center"
                >
                  <Plus className="size-3.5" />
                </span>
              )}
            </Button>
          }
        />
      ) : null}

      {selected.map((label) =>
        isEditing ? (
          // Editing, a tag is a way into its own editor: the same panel the "+"
          // opens, on the label pressed. Reading, it is a pill and nothing else.
          <LabelPicker
            key={label.id}
            scope={LabelScope.TASK}
            selectedIds={labelIds}
            onChange={onChange}
            startOn={{ kind: 'edit', label }}
            trigger={
              // HeroUI's Button, not a bare one: the popover hands its trigger
              // press handling that a plain DOM button never receives. Its own
              // height and padding are cleared so what is left is the pill.
              <Button
                variant="ghost"
                {...colorFill(label.color, `${TASK_LABEL_PILL} h-auto min-h-0`)}
              >
                {label.name}
              </Button>
            }
          />
        ) : (
          <span key={label.id} {...colorFill(label.color, TASK_LABEL_PILL)}>
            {label.name}
          </span>
        ),
      )}
    </div>
  );
}

function TaskModalContent({
  task,
  onClose,
  flushRef,
}: {
  task: TaskDetailDto;
  onClose: () => void;
  /**
   * Where the dialog's pending save is left for the backdrop to call. Dismissing
   * from outside — a click on the overlay, Escape — is handled a component up,
   * where the form is out of reach; this is how the two meet.
   */
  flushRef: RefObject<() => void>;
}) {
  const { data: me } = useMe();
  const { data: sectors = [] } = useSectors();
  const { data: users = [] } = useUsers();

  const updateTask = useUpdateTask(task.id);
  const updateStatus = useUpdateTaskStatus(task.id);
  const deleteTask = useDeleteTask();

  const canEdit = canMutateEntity(me, {
    createdById: task.createdById,
    assigneeIds: task.assignees.map((assignee) => assignee.id),
  });

  const [form, setForm] = useState<FormState>(() => toFormValue(task));
  /**
   * Opening a task shows it, it doesn't hand you a form — the same rule as a
   * routine. "Editar" in the header unlocks it.
   */
  const [isEditing, setEditing] = useState(false);

  /**
   * Whether the caret is in the title.
   *
   * The title is bold — it is what the task is called — and a bold field being
   * typed into looks like a heading that has started moving. So it drops to a
   * plain weight while it holds the caret and goes back to bold the moment it
   * loses it, whether that was Salvar, a click elsewhere in the dialog, or a
   * click on anything else at all.
   */
  const [isTitleFocused, setTitleFocused] = useState(false);

  /**
   * Unlocking the dialog puts the caret in the title, as if it had been pressed:
   * the title is what you came to change often enough that having to click it
   * first was a step for nothing. The field itself takes it from there — see
   * `onFocus`, which parks the caret after the last letter. Locking takes it
   * back out again.
   */
  useEffect(() => {
    setTitleFocused(isEditing);
  }, [isEditing]);

  /**
   * Seeded once per task rather than on every server copy: autosave means the
   * server answers each keystroke's PATCH with a fresh task object, and
   * re-seeding from those would overwrite whatever was typed while one was in
   * flight. Everything the server owns alone — status, progress, subtasks — is
   * read straight from `task` below and stays live.
   */
  useEffect(() => {
    setForm(toFormValue(task));
    setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  const {
    row,
    label: fieldLabel,
    trigger,
    undimmed,
  } = propertyStyles(isEditing, {
    row: PROPERTY_ROW_SPLIT,
    // Air rather than a height: a long value wraps and its row grows with it —
    // see `fluid`, and the note beside it, which follows the same total.
    height: PROPERTY_ROW_PITCH,
    fluid: true,
    // No chevrons in this dialog: six of them down one column was a stack of
    // arrows saying what the cursor already says on the way past. See
    // BARE_TRIGGER_NO_INDICATOR, which turns the hand on in edit mode.
    indicator: false,
  });

  const assignees = useMemo(
    () => users.filter((user) => form.assigneeIds.includes(user.id)),
    [users, form.assigneeIds],
  );

  const sectorName = sectors.find((sector) => sector.id === form.sectorId)?.name ?? EMPTY_VALUE;

  const canSubmit = Boolean(form.title.trim());

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  /**
   * Everything an edit could change, serialised for the dirty check — so any
   * edit at all is caught without listing the fields twice.
   */
  const payload = useMemo(() => toPayload(form), [form]);

  /**
   * The last state known to be on the server, so autosave only fires for a real
   * change. Taken from the task rather than from the form, which is the same
   * thing at rest and the right answer while a save is in flight.
   */
  const savedRef = useRef(JSON.stringify(toPayload(toFormValue(task))));
  useEffect(() => {
    savedRef.current = JSON.stringify(toPayload(toFormValue(task)));
    // Deliberately only per task: this is the baseline the dirty check compares
    // against, so it must not follow the form as the user types.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  const saveIfDirty = useCallback(() => {
    if (!canEdit || !canSubmit) return;
    const serialised = JSON.stringify(payload);
    if (serialised === savedRef.current) return;

    savedRef.current = serialised;
    updateTask.mutate(payload);
  }, [canEdit, canSubmit, payload, updateTask]);

  useEffect(() => {
    flushRef.current = saveIfDirty;
  }, [flushRef, saveIfDirty]);

  /**
   * Closing without pressing anything — the header's ×, a click outside, Escape
   * — keeps the edit. Nothing was staged for later and then abandoned: what is
   * on screen is what you meant, so it is written on the way out.
   *
   * Cancelar is the one route that does not, below.
   */
  function handleClose() {
    saveIfDirty();
    onClose();
  }

  /**
   * Cancelar: the task goes back to what the server has and the dialog closes
   * with nothing written.
   *
   * The baseline moves with it, so the close that follows finds nothing dirty —
   * without that, `handleClose` on the way out would save the very edit this
   * just discarded.
   */
  function handleCancel() {
    const original = toFormValue(task);
    setForm(original);
    savedRef.current = JSON.stringify(toPayload(original));
    onClose();
  }

  /** A task has a route of its own, so its link is simply that address. */
  function copyLink() {
    const url = new URL(`/tasks/${task.id}`, window.location.origin);
    navigator.clipboard.writeText(url.toString());
  }

  function handleDelete() {
    // Skip the pending autosave: the task is about to stop existing.
    savedRef.current = JSON.stringify(payload);
    deleteTask.mutate(task.id, { onSuccess: onClose });
  }

  function handleSubmit() {
    // Commits and drops back to reading it, like the routine modal's Salvar:
    // it is the counterpart of Editar, not of Cancelar.
    savedRef.current = JSON.stringify(payload);
    updateTask.mutate(payload);
    setEditing(false);
  }

  /**
   * The six property rows, by name rather than in order: the order is the
   * user's (see `propertyOrder`), so the list below picks them out one at a time
   * instead of holding them in the sequence they happen to be written in.
   *
   * Progress is not among them any more. It was the one row nobody could set —
   * it is what the subtasks add up to — so it now sits on that list's own
   * heading, where what it measures is on screen beside it.
   */
  const propertyRows: Record<TaskPropertyKey, ReactNode> = {
    priority: (
      <Select
        isDisabled={!isEditing}
        className={undimmed}
        value={form.priority}
        onChange={(key) => set('priority', String(key) as TaskPriority)}
      >
        <div className={row}>
          <Label className={fieldLabel}>
            <Flag className={LABEL_ICON} aria-hidden />
            {strings.task.fields.priority}
          </Label>
          <div className={VALUE_CELL}>
            {/* The chosen pill, not its name in text: the options are pills, so
                the field has to be the same object or picking one looks like it
                did nothing. Same reasoning as the status row, which has read
                this way all along. */}
            <Select.Trigger className={trigger}>
              <PriorityChip priority={form.priority} />
            </Select.Trigger>
          </div>
        </div>
        {/* The options are pills, like the status dropdown's: priority is the
            other property on this list that is a fixed set of named steps, and
            reading it as a colour is faster than reading it as a word. No tick
            beside the current one — see STATUS_ITEM in TaskStatusChipSelect for
            why a mark behind a pill reads as a second shape around it. */}
        <Select.Popover {...listboxPopover} className={LISTBOX_PANEL}>
          <ListBox>
            {PRIORITY_OPTIONS.map((priority) => (
              <ListBox.Item
                key={priority}
                id={priority}
                textValue={strings.task.priority[priority]}
                className={PILL_LISTBOX_ITEM}
              >
                <PriorityChip priority={priority} />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    ),

    deadline: (
      <div className={row}>
        <span className={fieldLabel}>
          <CalendarDays className={LABEL_ICON} aria-hidden />
          {strings.task.fields.deadline}
        </span>
        <div className={VALUE_CELL}>
          <DeadlineValue
            isEditing={isEditing}
            isOverdue={task.isOverdue}
            value={form.dueDate}
            onChange={(dueDate) => set('dueDate', dueDate)}
            triggerClass={trigger}
          />
        </div>
      </div>
    ),

    sector: (
      <Select
        isDisabled={!isEditing}
        className={undimmed}
        value={form.sectorId}
        onChange={(key) => set('sectorId', String(key))}
      >
        <div className={row}>
          <Label className={fieldLabel}>
            <Building2 className={LABEL_ICON} aria-hidden />
            {strings.task.fields.sector}
          </Label>
          <div className={VALUE_CELL}>
            <Select.Trigger className={trigger}>
              {/* Wrapped rather than cut: "marketing & aqui…" told you which
                  sector it was not. The row's height is a minimum, so a second
                  line makes it taller instead of hiding half a word. */}
              <span className={`break-words ${PROPERTY_VALUE_LOWER}`}>{sectorName}</span>
            </Select.Trigger>
          </div>
        </div>
        <Select.Popover {...listboxPopover} className={LISTBOX_PANEL}>
          <ListBox>
            {sectors.map((sector) => (
              <ListBox.Item
                key={sector.id}
                id={sector.id}
                textValue={sector.name}
                // Lower case here as well as on the trigger: the value and the
                // option that sets it are the same word, and it changed case
                // between them.
                //
                // text-xs is the size every popover in this column speaks at —
                // see LISTBOX_TEXT.
                className={`${TEXT_LISTBOX_ITEM} ${LISTBOX_TEXT} lowercase`}
              >
                {sector.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    ),

    project: (
      <div className={row}>
        <span className={fieldLabel}>
          <FolderKanban className={LABEL_ICON} aria-hidden />
          {strings.task.fields.project}
        </span>
        <div className={VALUE_CELL}>
          <ProjectValue isEditing={isEditing} triggerClass={trigger} />
        </div>
      </div>
    ),

    // Live in both modes, like a routine's checkboxes: moving a task along is
    // using it, not editing it — and it is the one property you can also change
    // from a task row without opening anything. Changing it to "Em andamento"
    // starts the clock behind the productivity chart; nothing here says so, by
    // design.
    status: (
      <div className={row}>
        <span className={fieldLabel}>
          <CircleDot className={LABEL_ICON} aria-hidden />
          {strings.task.fields.status}
        </span>
        <div className={VALUE_CELL}>
          <TaskStatusChipSelect
            status={task.status}
            isDisabled={!canEdit}
            onChange={(status: TaskStatus) => updateStatus.mutate(status)}
          />
        </div>
      </div>
    ),

    // Read-only in both modes: progress is what the subtasks below come to, so
    // it is set by ticking them off rather than here. The bar takes the whole
    // value cell, so it runs from where every other value starts to where the
    // rule under the properties ends.
    progress: (
      <div className={row}>
        <span className={fieldLabel}>
          <Gauge className={LABEL_ICON} aria-hidden />
          {strings.task.fields.progress}
        </span>
        <div className={VALUE_CELL}>
          <TaskProgressBar value={task.progress} className="h-5 w-full" />
        </div>
      </div>
    ),

    assignee: (
      <Select
        selectionMode="multiple"
        isDisabled={!isEditing}
        className={undimmed}
        value={form.assigneeIds}
        onChange={(keys) => set('assigneeIds', (keys as (string | number)[]).map(String))}
      >
        <div className={row}>
          <Label className={fieldLabel}>
            <UserRound className={LABEL_ICON} aria-hidden />
            {strings.task.fields.assignee}
          </Label>
          <div className={VALUE_CELL}>
            <Select.Trigger className={trigger}>
              <AssigneeValue users={assignees} canAdd={isEditing && assignees.length > 0} />
            </Select.Trigger>
          </div>
        </div>
        <Select.Popover {...listboxPopover} className={LISTBOX_PANEL}>
          <ListBox selectionMode="multiple">
            {users.map((user) => (
              <ListBox.Item
                key={user.id}
                id={user.id}
                textValue={user.name}
                className={LISTBOX_TEXT}
              >
                <span className="flex items-center gap-2">
                  <UserAvatar
                    name={user.name}
                    avatarUrl={user.avatarUrl}
                    size="sm"
                    className="size-5"
                  />
                  {user.name}
                </span>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    ),
  };

  return (
    <Modal.Dialog className={`${DIALOG_SHAPE} ${DIALOG_PADDING}`}>
      {/* No Modal.CloseTrigger: that one positions itself against the dialog's
          corner rather than on the header's own row. The close button is a
          member of that row instead, so the two line up by construction. */}
      {/* The header takes the columns' own inset, so its row of actions starts
          where the tags below it start, its × ends where Anexos' bins end, and
          the rule under it is exactly as long as the two rules further down. */}
      <Modal.Header className={`flex flex-col ${dialogSection} ${COLUMN_INSET}`}>
        {/* The dialog still needs a name for screen readers; the task's own
            title carries it visually, so this one is hidden. */}
        <Modal.Heading className="sr-only">{task.title}</Modal.Heading>

        <div className="flex flex-wrap items-center gap-4">
          <button type="button" className={`${quietTextButton} text-sm font-medium`} onClick={copyLink}>
            <Link2 className="size-4" />
            {strings.task.copyLink}
          </button>

          {canEdit ? (
            <>
              <button
                type="button"
                className={`${quietTextButton} text-sm font-medium`}
                disabled={deleteTask.isPending}
                onClick={() => {
                  playSound('delete');
                  handleDelete();
                }}
              >
                <Trash2 className="size-4" />
                {strings.task.deleteTask}
              </button>

              {/* Unlocks the dialog, then reports that it is unlocked — Salvar
                  is in the footer, so once you are editing there is nothing left
                  for this slot to do but say so. */}
              {isEditing ? (
                <span className="flex items-center gap-1.5 text-sm font-medium text-muted">
                  <Pencil className="size-4" />
                  {strings.task.editing}
                </span>
              ) : (
                <button
                  type="button"
                  className={`${quietTextButton} text-sm font-medium`}
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="size-4" />
                  {strings.common.edit}
                </button>
              )}
            </>
          ) : null}

          <button
            type="button"
            className={dialogClose}
            aria-label={strings.common.close}
            onClick={handleClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className={`${modalDivider} ${modalDividerGap}`} />
      </Modal.Header>

      {/* Body and footer in one box, because the rule between the columns has to
          run over both — see COLUMN_RULE. It takes the height the header leaves
          and passes it on: `min-h-0` so the body inside it can be shorter than
          its content and hand each section a height to scroll inside. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
      {/* The body does not scroll — nothing in the dialog does. Its rules, its
          columns and its property list are fixed, and the three sections that
          can outgrow their space (the note, the subtasks, the files) each scroll
          inside themselves. `overflow-hidden` is what says so: HeroUI's
          scroll="inside" hands the body a `overflow-y: auto` this takes back,
          and the x half of it catches the 8px the property controls overhang
          their column by (see BARE_TRIGGER), which would otherwise propagate up
          as a horizontal scrollbar. */}
      <div aria-hidden className={COLUMN_RULE} />

      {/* `mx-0` undoes a -3px inline margin HeroUI gives the body to pair with
          its own 3px padding — padding this file zeroes (see dialogSection), so
          what was left was three pixels of overhang on each side. That is what
          made the body's rules longer than the header's, and the right-hand
          margin look tighter than the left. */}
      <Modal.Body className={`mx-0 flex min-h-0 flex-col overflow-hidden ${dialogSection}`}>
        {/* Two columns from `md` up, stacked below it — and two rows: what the
            task *is* over what it *carries*, on the left its tags, name and
            properties over its subtasks, on the right its note over its files.

            One grid rather than two columns of their own, because the blocks
            have to line up across as well as down: the rule under the properties
            and the rule under Visão geral are the same line, and they only stay
            one line if both cells belong to the same row. The middle column is
            the vertical rule's own width, spanning both rows.

            The second row takes what is left (`minmax(0,1fr)`) rather than its
            content's height: that is what gives the two blocks in it a height to
            scroll inside, and what keeps the footer on the dialog's own bottom
            edge however many subtasks there are. */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-x-6 md:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] md:grid-rows-[auto_minmax(0,1fr)]">
          {/* Row 1, left: the tags, the name and the properties — one cell, so
              the note beside it starts level with the tags and ends level with
              the last property. They end at the gutter, where the properties do,
              so a long title wraps onto a second line rather than running the
              width of the dialog. The tags lead: they say what kind of thing
              this is before you read what it is called. */}
          <div
            className={`flex min-w-0 flex-col ${COLUMN_INSET} md:col-start-1 md:row-start-1`}
          >
            <div className={TITLE_GAP}>
            <TaskLabelsRow
              labelIds={form.labelIds}
              onChange={(labelIds) => set('labelIds', labelIds)}
              isEditing={isEditing}
            />
            {isEditing && isTitleFocused ? (
              <TextField
                aria-label={strings.task.fields.title}
                value={form.title}
                onChange={(title) => set('title', title)}
                className="w-full min-w-0"
              >
                {/* A textarea rather than an input: the title wraps, and an
                    input would scroll a long one sideways inside a single line.
                    `field-sizing-content` gives it the height of what it holds,
                    so the field is exactly the heading it replaces. */}
                {/* The field only exists because the dialog was just unlocked or
                    the title just pressed, so the caret has to arrive with it —
                    without the focus the press would look like it did nothing at
                    all. Waived rather than moved into an effect: this is focus
                    following a deliberate action, which is what the rule is
                    protecting. */}
                <TextArea
                  rows={1}
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  placeholder={strings.task.fields.title}
                  // The caret lands after the last letter, not before the first:
                  // a focused textarea starts its selection at 0, which put the
                  // cursor at the head of a name you were about to add to.
                  onFocus={(event) => {
                    const end = event.currentTarget.value.length;
                    event.currentTarget.setSelectionRange(end, end);
                  }}
                  onBlur={() => setTitleFocused(false)}
                  onKeyDown={(event) => {
                    // A title is one line of text, so Enter finishes it rather
                    // than breaking it in two.
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    event.currentTarget.blur();
                  }}
                  className={`${TITLE_TEXT} field-sizing-content resize-none bg-transparent font-normal outline-none placeholder:text-muted`}
                />
              </TextField>
            ) : (
              <h2 className={`${TITLE_TEXT} font-bold`}>
                {isEditing ? (
                  // Editing but not being typed in — the state you land in after
                  // clicking away from the title. Still the heading, and pressing
                  // it puts the caret back. No drawn caret parked after the
                  // words: a bar the user cannot move is not a caret, it just
                  // looks like one that has got stuck.
                  <button
                    type="button"
                    className="w-full cursor-text text-left break-words"
                    onClick={() => setTitleFocused(true)}
                  >
                    {form.title}
                  </button>
                ) : (
                  form.title
                )}
              </h2>
            )}
            </div>

            {/* The properties, then the air the half closes on, then the rule.
                The row's height is this cell's own — no floor, no ceiling — so a
                value that wraps grows the row, the cell and the column beside it
                together. */}
            <div className={PROPERTY_LIST}>
              {PROPERTY_ORDER.map((key) => (
                <div key={key}>{propertyRows[key]}</div>
              ))}
            </div>

            <div aria-hidden className={TOP_COLUMN_TAIL} />
            <div className={modalDivider} />
          </div>

          {/* The middle column, which is the rule's — but only its width. The
              rule itself is drawn a level up, over the body *and* the footer;
              see COLUMN_RULE, and this column's own note there. */}
          <div aria-hidden className="hidden md:col-start-2 md:row-span-2 md:row-start-1 md:block" />

          {/* Row 1, right: the note, which starts where the tags start and ends
              where the last property ends — the cell beside it sets the height
              of the row, and the note takes all of it but the tail. Its rule is
              the same rule, on the same edge.

              Laid out absolutely inside the cell, which is the whole trick: a
              row this tall is `auto`, and an ordinary child would grow it to fit
              a long note — pushing the subtasks off the bottom of the dialog. An
              absolutely positioned one contributes no height at all, so the note
              is told how tall it is rather than deciding, and scrolls inside
              that. */}
          <div className="relative min-w-0 md:col-start-3 md:row-start-1">
            {/* The inset is on this one rather than the cell: an absolutely
                positioned box is laid out against its ancestor's *padding* box,
                so padding a level up would move nothing. */}
            <div className={`flex flex-col ${COLUMN_INSET} md:absolute md:inset-0`}>
              <div className="min-h-0 flex-1">
                <NotesBlock
                  fill
                  compact
                  showDivider={false}
                  isEditing={isEditing}
                  value={form.notes}
                  onChange={(notes) => set('notes', notes)}
                  title={strings.task.notesTitle}
                  placeholder={strings.task.notesPlaceholder}
                />
              </div>
              <div aria-hidden className={TOP_COLUMN_TAIL} />
              <div className={modalDivider} />
            </div>
          </div>

          {/* Row 2: what the task carries — the row that takes whatever height
              is left, which is what the two blocks in it scroll inside. `pt-4`
              on both, so they start at the same height under the rule that
              separates them from the half above, and from there down they keep
              step row by row — see blockRow and blockHeaderRow. `min-h-0`
              because each block fills its cell: without it the cell would take
              its content's height and the list would never scroll. */}
          <div
            className={`flex min-h-0 min-w-0 flex-col pt-4 ${COLUMN_INSET} md:col-start-1 md:row-start-2`}
          >
            <TaskSubtasks
              taskId={task.id}
              subtasks={task.subtasks}
              isEditing={isEditing}
              canEdit={canEdit}
            />
          </div>

          <div
            className={`flex min-h-0 min-w-0 flex-col pt-4 ${COLUMN_INSET} md:col-start-3 md:row-start-2`}
          >
            {/* Always present, in both modes: locked, an empty block used to
                vanish entirely, and a task with no files then looked like a task
                that could not have any. It says so instead. */}
            <AttachmentsBlock
              compact
              isEditing={isEditing}
              attachments={form.attachments}
              onChange={(attachments) => set('attachments', attachments)}
            />
          </div>
        </div>

        </Modal.Body>

        {/* Copiar link / Deletar / Editar live in the header, and the last
            change with the content, so the footer is only the two ways out of
            the dialog. Nothing above the buttons and nothing below them —
            `mt-0` cancels the component's own 20px — so the body ends where the
            footer begins and the buttons sit on the dialog's own bottom
            margin. */}
        <Modal.Footer
          className={`flex flex-wrap items-center justify-end gap-2 ${dialogSection} ${COLUMN_INSET} mt-0`}
        >
          <SecondaryButton onPress={handleCancel}>{strings.common.cancel}</SecondaryButton>
          {isEditing ? (
            <Button
              className="rounded-full"
              isDisabled={!canSubmit || updateTask.isPending}
              onPress={handleSubmit}
            >
              {strings.common.save}
            </Button>
          ) : null}
        </Modal.Footer>
      </div>
    </Modal.Dialog>
  );
}

export function TaskModal({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { data: task, isLoading } = useTask(taskId);
  /** Filled in by the dialog's content — see `flushRef` there. */
  const flushEdits = useRef<() => void>(() => {});

  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(open) => {
        if (open) return;
        // Dismissed from outside the dialog: the edit on screen is kept, the
        // same as pressing the header's ×. Only Cancelar discards.
        flushEdits.current();
        onClose();
      }}
    >
      {/* The container's padding is all that stands between the dialog and the
          window now that the dialog has no margins of its own — see
          DIALOG_SHAPE. HeroUI's own 40px was most of the reason a dialog asked
          to be full height was not. */}
      <Modal.Container scroll="inside" className={DIALOG_INSET}>
        {isLoading || !task ? (
          // The same shape while it loads, so the dialog doesn't resize under
          // the pointer the moment the task arrives.
          <Modal.Dialog className={`${DIALOG_SHAPE} ${DIALOG_PADDING}`}>
            <Modal.Body>
              <p className="py-8 text-center text-muted">{strings.common.loading}</p>
            </Modal.Body>
          </Modal.Dialog>
        ) : (
          <TaskModalContent task={task} onClose={onClose} flushRef={flushEdits} />
        )}
      </Modal.Container>
    </Modal.Backdrop>
  );
}
