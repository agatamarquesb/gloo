import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  Building2,
  CalendarDays,
  ChevronDown,
  CircleDot,
  Flag,
  FolderKanban,
  Gauge,
  Link2,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { parseDate, type CalendarDate } from '@internationalized/date';
import { Button, Calendar, Input, Label, ListBox, Modal, Popover, Select } from '@heroui/react';
// react-aria's own Button, not HeroUI's, for the two properties that open
// something other than a dropdown: HeroUI's carries its own padding, radius and
// hover fill, and all three are exactly what a bare property value must not
// have. This one is a press target and nothing else.
import { Button as AriaButton, TextField } from 'react-aria-components';

import {
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
import { useMe } from '@/hooks/queries/auth';
import { useSectors } from '@/hooks/queries/sectors';
import { useDeleteTask, useTask, useUpdateTask, useUpdateTaskStatus } from '@/hooks/queries/tasks';
import { useUsers } from '@/hooks/queries/users';
import { formatDay } from '@/lib/formatDate';
import { canMutateEntity } from '@/lib/permissions';
import { playSound } from '@/lib/sounds';
import {
  FIELD_PANEL,
  FLAT_INPUT,
  PILL_LISTBOX_ITEM,
  TEXT_LISTBOX_ITEM,
  listboxPopover,
} from '@/theme/fieldStyles';
import {
  EMPTY_VALUE,
  LABEL_ICON,
  PROPERTY_LIST,
  PROPERTY_ROW_HEIGHT,
  PROPERTY_ROW_SPLIT,
  VALUE_CELL,
  propertyStyles,
} from '@/theme/propertyRow';
import {
  TITLE_FIELD,
  dialogBodyFade,
  dialogClose,
  dialogFooter,
  dialogPadding,
  dialogSection,
  dialogShape,
  dialogTitleGap,
  modalDivider,
  modalDividerGap,
  quietTextButton,
} from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

import { PriorityChip } from './PriorityChip';
import { TaskProgressBar } from './TaskProgressBar';
import { TaskStatusChipSelect } from './TaskStatusChipSelect';
import { TaskSubtasks } from './TaskSubtasks';

const PRIORITY_OPTIONS: TaskPriority[] = [
  TaskPriority.LOW,
  TaskPriority.MEDIUM,
  TaskPriority.HIGH,
];

/**
 * The height of the dialog's upper half, from `md` up: seven property rows at
 * `PROPERTY_ROW_HEIGHT` (2.5rem) each, plus a rem of air before the rule that
 * closes the half off.
 *
 * Pinned rather than measured because the two columns have to *end together* —
 * the rule under the properties and the rule under Notas are one line across the
 * dialog, and a note that grew with what was typed would drag its side of that
 * line down the page. So the properties set the height, and Notas scrolls inside
 * whatever is left. Below `md` the columns are stacked and each takes its own.
 */
const TOP_COLUMN_HEIGHT = 'md:h-[18.5rem]';

/**
 * The property rows on their own, without that closing rem: seven rows at
 * PROPERTY_ROW_HEIGHT. What the notes are cut to, so the two blocks in this row
 * end on one line — see the right-hand cell below.
 */
const PROPERTY_ROWS_HEIGHT = 'md:h-[17.5rem]';

/**
 * A property's value: the routine modal's own 14px, so the two dialogs read at
 * one size, in lower case so the column reads as one voice rather than as a chip
 * among sentences.
 */
const PROPERTY_VALUE = 'text-sm text-foreground';
const PROPERTY_VALUE_LOWER = `${PROPERTY_VALUE} lowercase`;

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
const POPOVER_TRIGGER = 'relative flex items-center rounded-md outline-none';

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
  };
}

/**
 * The chevron on a property that is not a `Select`.
 *
 * HeroUI draws its own on a Select trigger, and a row without one reads as a
 * value nobody can change. Positioned exactly as HeroUI positions that one —
 * `absolute`, `inset-inline-end: 8px`, centred — so the column of chevrons is
 * straight whatever kind of control is behind each row.
 */
function ValueIndicator() {
  return (
    <ChevronDown
      aria-hidden
      className="absolute top-1/2 right-2 size-4 shrink-0 -translate-y-1/2 text-muted"
    />
  );
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
  triggerClass,
}: {
  value: string;
  onChange: (value: string) => void;
  isEditing: boolean;
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

  if (!isEditing) {
    return <span className={PROPERTY_VALUE}>{label}</span>;
  }

  return (
    <Popover isOpen={isOpen} onOpenChange={setOpen}>
      {/* No fill and no hover: a date is a value you can change, and a pill
          lighting up under the cursor made it the loudest thing in the column. */}
      <AriaButton className={`${triggerClass} ${POPOVER_TRIGGER}`}>
        <span className={`truncate ${PROPERTY_VALUE}`}>{label}</span>
        <ValueIndicator />
      </AriaButton>

      {/* Cut to the field it hangs from: the popover takes the trigger's own
          width and the calendar fills it, instead of a 252px card sitting wider
          than the row it belongs to. HeroUI's calendar is `container-type:
          inline-size` — its cells are a share of its width — so narrowing the
          panel shrinks the whole grid rather than clipping it. */}
      <Popover.Content
        {...listboxPopover}
        className={`w-(--trigger-width) ${FIELD_PANEL}`}
      >
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
        <ValueIndicator />
      </AriaButton>
      {/* Sized to what it says rather than to a fixed 16rem — empty, it was a
          wide flat capsule instead of the small card the status dropdown drops
          under its own chip. The message a step down in size, and enough padding
          that the box has a card's height even with a single line in it. */}
      <Popover.Content {...listboxPopover} className={`w-(--trigger-width) ${FIELD_PANEL}`}>
        <Popover.Dialog className="flex min-h-28 items-center justify-center px-4 py-4">
          <p className="text-xs whitespace-nowrap text-muted">{strings.task.projectsEmpty}</p>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
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
  } = propertyStyles(isEditing, { row: PROPERTY_ROW_SPLIT, height: PROPERTY_ROW_HEIGHT });

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

  return (
    <Modal.Dialog className={`sm:max-w-[52rem] ${dialogShape} ${dialogPadding}`}>
      {/* No Modal.CloseTrigger: that one positions itself against the dialog's
          corner rather than on the header's own row. The close button is a
          member of that row instead, so the two line up by construction. */}
      <Modal.Header className={`flex flex-col ${dialogSection}`}>
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

      {/* overflow-x-hidden because the property controls overhang their column
          by the chevron's 8px inset (see BARE_TRIGGER), and that overhang
          propagates up as a horizontal scrollbar. The mask fades the scroll
          edges so long content doesn't end in a hard cut at the margins. */}
      <Modal.Body
        className={`flex flex-col overflow-x-hidden ${dialogTitleGap} ${dialogSection} ${dialogBodyFade}`}
      >
        {/* The title spans both columns: it is what the task *is*, and the two
            columns below are only how the rest of it is arranged. */}
        {isEditing ? (
          <TextField
            aria-label={strings.task.fields.title}
            value={form.title}
            onChange={(title) => set('title', title)}
            className="min-w-0"
          >
            <Input
              fullWidth
              placeholder={strings.task.fields.title}
              className={`${FLAT_INPUT} ${TITLE_FIELD} text-xl font-bold`}
            />
          </TextField>
        ) : (
          <h2 className="min-w-0 text-xl font-bold text-foreground">{form.title}</h2>
        )}

        {/* Two columns from `md` up, stacked below it — and two rows: what the
            task *is* over what it *carries*, on the left, against its notes over
            its files on the right.

            One grid rather than two columns of their own, because the four
            blocks have to line up across as well as down: the rule under the
            properties and the rule under Notas are the same line, and they only
            stay one line if both cells belong to the same row. The middle column
            is the vertical rule itself, spanning both rows, inset top and bottom
            by the same 1.5rem the gap gives it either side. */}
        <div className="grid grid-cols-1 gap-x-6 md:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]">
          {/* Row 1, left: the properties, closed off by a rule on the cell's own
              bottom edge — which is the same edge Notas' rule sits on. */}
          <div className={`flex min-w-0 flex-col ${TOP_COLUMN_HEIGHT}`}>
            <div className={PROPERTY_LIST}>
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
                    {/* The chosen pill, not its name in text: the options are
                        pills, so the field has to be the same object or picking
                        one looks like it did nothing. Same reasoning as the
                        status row, which has read this way all along. */}
                    <Select.Trigger className={trigger}>
                      <PriorityChip priority={form.priority} />
                      {isEditing ? <Select.Indicator /> : null}
                    </Select.Trigger>
                  </div>
                </div>
                {/* The options are pills, like the status dropdown's: priority
                    is the other property on this list that is a fixed set of
                    named steps, and reading it as a colour is faster than
                    reading it as a word. No tick beside the current one — see
                    STATUS_ITEM in TaskStatusChipSelect for why a mark behind a
                    pill reads as a second shape around it. */}
                <Select.Popover {...listboxPopover}>
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

              <div className={row}>
                <span className={fieldLabel}>
                  <CalendarDays className={LABEL_ICON} aria-hidden />
                  {strings.task.fields.deadline}
                </span>
                <div className={VALUE_CELL}>
                  <DeadlineValue
                    isEditing={isEditing}
                    value={form.dueDate}
                    onChange={(dueDate) => set('dueDate', dueDate)}
                    triggerClass={trigger}
                  />
                </div>
              </div>

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
                      <span className={`truncate ${PROPERTY_VALUE_LOWER}`}>{sectorName}</span>
                      {isEditing ? <Select.Indicator /> : null}
                    </Select.Trigger>
                  </div>
                </div>
                <Select.Popover {...listboxPopover}>
                  <ListBox>
                    {sectors.map((sector) => (
                      <ListBox.Item
                        key={sector.id}
                        id={sector.id}
                        textValue={sector.name}
                        // Lower case here as well as on the trigger: the value
                        // and the option that sets it are the same word, and it
                        // changed case between them.
                        className={`${TEXT_LISTBOX_ITEM} lowercase`}
                      >
                        {sector.name}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>

              <div className={row}>
                <span className={fieldLabel}>
                  <FolderKanban className={LABEL_ICON} aria-hidden />
                  {strings.task.fields.project}
                </span>
                <div className={VALUE_CELL}>
                  <ProjectValue isEditing={isEditing} triggerClass={trigger} />
                </div>
              </div>

              {/* Live in both modes, like a routine's checkboxes: moving a task
                  along is using it, not editing it — and it is the one property
                  you can also change from a task row without opening anything.
                  Changing it to "Em andamento" starts the clock behind the
                  productivity chart; nothing here says so, by design. */}
              <div className={row}>
                <span className={fieldLabel}>
                  <CircleDot className={LABEL_ICON} aria-hidden />
                  {strings.task.fields.status}
                </span>
                <div className={VALUE_CELL}>
                  <TaskStatusChipSelect
                    status={task.status}
                    isOverdue={task.isOverdue}
                    isDisabled={!canEdit}
                    onChange={(status: TaskStatus) => updateStatus.mutate(status)}
                  />
                </div>
              </div>

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
                      {isEditing && assignees.length === 0 ? <Select.Indicator /> : null}
                    </Select.Trigger>
                  </div>
                </div>
                <Select.Popover {...listboxPopover}>
                  <ListBox selectionMode="multiple">
                    {users.map((user) => (
                      <ListBox.Item key={user.id} id={user.id} textValue={user.name}>
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

              {/* Read-only in both modes: progress is what the subtasks below
                  come to, so it is set by ticking them off rather than here. */}
              <div className={row}>
                <span className={fieldLabel}>
                  <Gauge className={LABEL_ICON} aria-hidden />
                  {strings.task.fields.progress}
                </span>
                <div className={VALUE_CELL}>
                  {/* The full value cell, so the bar and the count together end
                      on the same line as the dropdown above them opens to. */}
                  <TaskProgressBar value={task.progress} className="w-full" />
                </div>
              </div>
            </div>

            {/* `mt-auto` rather than a margin of its own: the rule belongs to
                the bottom of the cell, which is what puts it level with the one
                under Notas however the properties above it are laid out. */}
            <div className={`${modalDivider} mt-auto`} />
          </div>

          {/* The rule between the columns, spanning both rows and running their
              full height — no inset of its own, so it starts and ends where the
              content on either side of it does. */}
          <div aria-hidden className="hidden w-px bg-border md:row-span-2 md:block" />

          {/* Row 1, right: the notes, filling the height the properties set and
              scrolling inside it — see TOP_COLUMN_HEIGHT and NotesBlock's
              `fill`. Its rule is the same rule, on the same edge. */}
          <div className={`flex min-w-0 flex-col ${TOP_COLUMN_HEIGHT}`}>
            {/* The notes stop where the property rows stop, not where the cell
                does: the rem of air the properties leave under "Barra de
                progresso" is air on this side too, so the two blocks end on one
                line and only the rules below them touch the cell's edge. */}
            <div className={PROPERTY_ROWS_HEIGHT}>
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
            <div className={`${modalDivider} mt-auto`} />
          </div>

          {/* Row 2: what the task carries. `pt-4` on both, so the two blocks
              start at the same height under the rule that separates them from
              the half above. */}
          <div className="min-w-0 pt-4">
            <TaskSubtasks
              taskId={task.id}
              subtasks={task.subtasks}
              isEditing={isEditing}
              canEdit={canEdit}
            />
          </div>

          <div className="min-w-0 pt-4">
            {/* Always present, in both modes: locked, an empty block used to
                vanish entirely, and a task with no files then looked like a task
                that could not have any. It says so instead. */}
            <AttachmentsBlock
              isEditing={isEditing}
              attachments={form.attachments}
              onChange={(attachments) => set('attachments', attachments)}
            />
          </div>
        </div>

      </Modal.Body>

      {/* Copiar link / Deletar / Editar live in the header, and the last change
          scrolls with the content, so the footer is only the two ways out of the
          dialog. Nothing above the buttons and nothing below them — `mt-0`
          cancels the component's own 20px — so the body ends where the footer
          begins and the buttons sit on the dialog's own bottom margin. */}
      <Modal.Footer
        className={`flex flex-wrap items-center justify-end gap-2 ${dialogFooter}`}
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
      <Modal.Container scroll="inside">
        {isLoading || !task ? (
          <Modal.Dialog className={`sm:max-w-[52rem] ${dialogShape} ${dialogPadding}`}>
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
