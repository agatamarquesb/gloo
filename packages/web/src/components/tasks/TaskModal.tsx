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
  Tag,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { Button, Label, ListBox, Modal, Select } from '@heroui/react';
import { TextArea, TextField } from 'react-aria-components';

import {
  LabelScope,
  Role,
  TaskStatus,
  type AttachmentDto,
  type TaskDetailDto,
  type TaskPriority,
  type UserDto,
} from '@gloo/shared';

import { AttachmentsBlock } from '@/components/common/AttachmentsBlock';
import { NotesBlock } from '@/components/common/NotesBlock';
import { isNotesEmpty } from '@/components/common/RichNotes';
import { SecondaryButton } from '@/components/common/SecondaryButton';
import { AssigneeValue } from '@/components/common/AssigneeValue';
import { DatePropertyValue } from '@/components/common/DatePropertyValue';
import { UserAvatar } from '@/components/common/UserAvatar';
// The picker a routine's tags are chosen from — the same panel, the same
// create/edit flow. Tags are one pool shared by both kinds of thing, so this is
// deliberately the same component rather than a second one that looks like it.
import { LabelPicker } from '@/components/dashboard/LabelPicker';
import { useMe } from '@/hooks/queries/auth';
import { useLabels } from '@/hooks/queries/labels';
import { useSectors } from '@/hooks/queries/sectors';
import {
  useCreateTask,
  useDeleteTask,
  useEmptyTaskTrash,
  useRestoreTask,
  useSetTaskStatus,
  useTask,
  useUpdateTask,
  useUpdateTaskStatus,
} from '@/hooks/queries/tasks';
import { useUsers } from '@/hooks/queries/users';
import { isDayPast } from '@/lib/formatDate';
import { canMutateEntity } from '@/lib/permissions';
import { playSound } from '@/lib/sounds';
import {
  LISTBOX_FLUSH,
  OPEN_FIELD_FILL,
  OPEN_FIELD_FILL_LIGHT,
  TEXT_LISTBOX_ITEM,
  listboxPopover,
} from '@/theme/fieldStyles';
import { colorFill } from '@/theme/labelColors';
import {
  EMPTY_VALUE,
  LABEL_ICON,
  PROPERTY_LIST,
  PROPERTY_ROW_PITCH,
  PROPERTY_ROW_SPLIT,
  PROPERTY_VALUE,
  VALUE_CELL,
  propertyStyles,
} from '@/theme/propertyRow';
import {
  dialogClose,
  dialogSection,
  modalDivider,
  modalDividerGap,
  quietTextButton,
} from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

import { OverdueMark } from './StatusChip';
import { TaskPriorityChipSelect } from './TaskPriorityChipSelect';
import { TaskProgressBar } from './TaskProgressBar';
import { TaskStatusChipSelect } from './TaskStatusChipSelect';
import { TaskSubtasks } from './TaskSubtasks';
import { SAMPLE_PROJECTS } from './sampleProjects';

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
 * A tag on a task. The same cut as a routine's — see PILL_SHAPE — restated here
 * because the two are separate vocabularies now (see LabelScope) and only look
 * alike on purpose; one changing size should not drag the other with it.
 */
const TASK_LABEL_PILL = 'rounded-md px-2 py-1 text-[13px] leading-4 text-black';

/**
 * What every popover a property opens is set in: the size of the value it drops
 * from.
 *
 * A list is the same words as the row above it, one of which is already chosen —
 * so choosing is recognising the value you are looking at, and a step down in
 * size made the options read as a footnote about it instead.
 *
 * And they wrap. The panel is a fixed 171.5px (see PROPERTY_PANEL), so a sector
 * with two words in it ran off the edge; an option that does not fit now takes a
 * second line and its own row grows by one, which keeps the spacing between
 * options exactly where it was.
 *
 * The deadline's calendar is the exception: it is a grid rather than a list, and
 * has a scale of its own — see .gloo-compact-calendar in globals.css.
 */
const LISTBOX_TEXT =
  'text-sm whitespace-normal break-words [&>*]:whitespace-normal [&>*]:break-words';

/**
 * One width for everything the property column opens: 171.5px, which is the
 * value column itself — the dialog's 46rem, less its padding, the gutter and the
 * rule, halved, less the column inset and the 7.5rem the labels take.
 *
 * Stated as a number rather than derived from `--trigger-width`, because not
 * every trigger here *is* that width: the status and priority chips hug their
 * own labels, and a panel measured from one of those came out at two thirds of
 * the row it dropped from. Six properties opening six differently sized panels
 * down one column was the thing you noticed about the column.
 *
 * The panels hang 8px to the left of the value, where the open field's ground
 * also starts (see OPEN_FIELD_GROUND), so a panel and the band above it are one
 * box with a hairline across it.
 *
 * A list narrower than its longest option is why options wrap rather than
 * truncate — see LISTBOX_TEXT.
 */
const PROPERTY_PANEL = 'w-[171.5px]';

/**
 * No tick against the option a list is already set to.
 *
 * It was at the end of a line whose length is the option's, so it landed
 * somewhere different on every row and on the longest one ("marketing &
 * aquisição") it sat on the last letter; moved to a column of its own on the
 * left, it pushed every option 24px clear of the value it was meant to line up
 * with. Both are worse than saying it the way the panel already says it: the
 * field at the head of the list *is* the current value, sat directly above the
 * option that matches it.
 */

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
 * The header stack: 10px from the header's rule down to the title, 10px from the
 * title down to its tags, and 8px from the tags to the properties.
 *
 * The three numbers are the routine dialog's — see HEADER_ROW there — because
 * the two dialogs are the same object seen twice and now stack it the same way:
 * name, then tags, then a column of properties. They were this dialog's numbers
 * first, back when the tags led; moving them under the title left the title
 * against the rule and the tags against the properties, which is the look these
 * put back.
 *
 * On the title's cell rather than as the grid's row gap, because the row below it
 * closes against its own rules and must keep none.
 */
const TITLE_GAP = 'pt-[10px] pb-2';
const TAGS_ROW = 'pt-[10px]';

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
  'labels',
  'deadline',
  'sector',
  'project',
  'priority',
  'status',
  'assignee',
  'progress',
] as const;

type TaskPropertyKey = (typeof PROPERTY_ORDER)[number];

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
 * The deadline: a date written out in full ("30 de julho, 2026") that opens a
 * calendar when the dialog is unlocked — the shared property date, see
 * DatePropertyValue, plus the one thing that is this row's alone: the mark that
 * says the day has passed.
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
  // The mark belongs to the date, not to the row: it says this *day* has passed,
  // so it follows the day itself and moves with it into and out of edit mode.
  return (
    <DatePropertyValue
      value={value}
      onChange={onChange}
      isEditing={isEditing}
      label={strings.task.fields.deadline}
      triggerClass={triggerClass}
      panelWidth={PROPERTY_PANEL}
      tone={isOverdue ? 'text-overdue-ink!' : ''}
      mark={isOverdue ? <OverdueMark className="shrink-0" /> : null}
    />
  );
}

/**
 * Projects, as a sketch.
 *
 * There is no project behind any of these — no model, no page, no endpoint. They
 * are three names hard-coded so the row can be *seen*: what a project reads like
 * in the property column, and what the list that sets one looks like dropping
 * out of it. Choosing between them moves the trigger and nothing else; nothing
 * here is saved, and nothing reads it back.
 *
 * When projects become real this list is what they replace — the row, its
 * trigger and its panel are already the shape they need to be.
 */


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
/**
 * The task's tags as pills and nothing else — under the title while the dialog
 * is locked, and inside the Etiquetas row's trigger while it is not.
 *
 * Read-only in both places: reading, there is nothing to press; editing, the
 * pills are *inside* the picker's own trigger, and a control within a control
 * would swallow the press that opens it.
 */
function TaskLabelPills({ labelIds, className = '' }: { labelIds: string[]; className?: string }) {
  const { data: labels = [] } = useLabels(LabelScope.TASK);
  const selected = labels.filter((label) => labelIds.includes(label.id));

  if (selected.length === 0) return null;

  return (
    <span className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {selected.map((label) => (
        <span key={label.id} {...colorFill(label.color, TASK_LABEL_PILL)}>
          {label.name}
        </span>
      ))}
    </span>
  );
}

function TaskModalContent({
  task,
  onClose,
  onCreated,
  flushRef,
  isDraft = false,
  isTrashed = false,
}: {
  task: TaskDetailDto;
  onClose: () => void;
  /**
   * The task the draft's Salvar just brought into existence — the one moment
   * this dialog has an id it did not start with. Only the board asks for it, so
   * it can move the new task into the column it was added from; everywhere else
   * a created task is simply picked up by the list's own invalidation.
   */
  onCreated?: (created: TaskDetailDto) => void;
  /**
   * Where the dialog's pending save is left for the backdrop to call. Dismissing
   * from outside — a click on the overlay, Escape — is handled a component up,
   * where the form is out of reach; this is how the two meet.
   */
  flushRef: RefObject<() => void>;
  /**
   * Whether `task` is a blank one that does not exist yet — see NewTaskModal.
   *
   * The dialog is the same dialog: same columns, same rules, same property list.
   * What a draft changes is when it writes. An existing task autosaves as you
   * type and keeps whatever is on screen when you leave; a draft is written once,
   * by Salvar, and closing any other way leaves nothing behind. Everything that
   * needs a row to already exist — the link to it, deleting it, moving its
   * status, its subtasks — is out until it does.
   */
  isDraft?: boolean;
  /**
   * Whether the task is being read out of the Lixeira.
   *
   * The same dialog, showing the same task, with everything that *changes* it
   * taken away: no Editar, no autosave, no status, no subtask controls. What is
   * left are the only two things you can do to something in a bin — destroy it,
   * from the header, or take it back, from the footer. Exactly the arrangement
   * the Routines trash gives a routine; see `isTrashed` there.
   */
  isTrashed?: boolean;
}) {
  const { data: me } = useMe();
  const { data: sectors = [] } = useSectors();
  const { data: users = [] } = useUsers();

  const createTask = useCreateTask();
  const updateTask = useUpdateTask(task.id);
  const updateStatus = useUpdateTaskStatus(task.id);
  const deleteTask = useDeleteTask();
  const restoreTask = useRestoreTask();
  const purgeTask = useEmptyTaskTrash();

  // Nobody edits a deleted task, whatever their permissions: it is not in the
  // list any more, and an edit saved onto it would be an edit nobody can see.
  const canEdit =
    !isTrashed &&
    canMutateEntity(me, {
      createdById: task.createdById,
      assigneeIds: task.assignees.map((assignee) => assignee.id),
    });

  const [form, setForm] = useState<FormState>(() => toFormValue(task));
  /**
   * Opening a task shows it, it doesn't hand you a form — the same rule as a
   * routine. "Editar" in the header unlocks it. A draft skips that: it is a
   * form and nothing else until it has been saved.
   */
  const [isEditing, setEditing] = useState(isDraft);

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
   * Which of the placeholder projects the row is showing. Component state and
   * nothing more — it is not in `FormState`, is never sent anywhere and resets
   * with the dialog, because there is nothing behind it yet to send it to. See
   * SAMPLE_PROJECTS.
   */
  const [project, setProject] = useState<string>(SAMPLE_PROJECTS[0]);

  /**
   * The subtasks written on a *draft*, before there is a task to hang them off.
   *
   * Component state rather than a field of `FormState`, and deliberately: the
   * form is what autosave compares against and what a PATCH is built from, and
   * an existing task's subtasks are rows with their own endpoints — putting a
   * list of strings in there would mean every save arguing with them. They exist
   * for exactly one moment, the POST that creates the task; see handleSubmit.
   */
  const [draftSubtasks, setDraftSubtasks] = useState<string[]>([]);

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
    setEditing(isDraft);
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

  // A sector as well as a name, but only for a draft: the API requires one to
  // create a task, while an existing one always has it and the row can be
  // cleared to blank on screen without the save being refused.
  const canSubmit = Boolean(form.title.trim()) && (!isDraft || Boolean(form.sectorId));

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
    // A draft has nothing to save *to* — there is no row yet, and creating one
    // behind the user's back is the opposite of what a blank dialog promises.
    if (isDraft || !canEdit || !canSubmit) return;
    const serialised = JSON.stringify(payload);
    if (serialised === savedRef.current) return;

    savedRef.current = serialised;
    updateTask.mutate(payload);
  }, [isDraft, canEdit, canSubmit, payload, updateTask]);

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
    // saveIfDirty is a no-op on a draft, so this is also the door that throws a
    // half-written new task away — which is what a × on something never saved
    // has to mean.
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
    // A draft's Salvar is what brings the task into existence, and the dialog
    // has done its job the moment it does — there is nothing left on screen to
    // drop back into reading. The list behind it picks the new task up from the
    // mutation's own invalidation.
    if (isDraft) {
      createTask.mutate({ ...payload, subtasks: draftSubtasks }, {
        onSuccess: (created) => {
          onCreated?.(created);
          onClose();
        },
      });
      return;
    }

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
    // Etiquetas leads the list, and only while the dialog is unlocked: it is the
    // one property whose value has somewhere else to live — under the title,
    // where a reader looks for it. So this row is how you *set* the tags, not
    // how you read them, and it is gone the moment there is nothing to set.
    labels: isEditing ? (
      <div className={row}>
        <span className={fieldLabel}>
          <Tag className={LABEL_ICON} aria-hidden />
          {strings.label.title}
        </span>
        <div className={VALUE_CELL}>
          <LabelPicker
            scope={LabelScope.TASK}
            selectedIds={form.labelIds}
            onChange={(labelIds) => set('labelIds', labelIds)}
            trigger={
              // The same bare trigger the other rows use, with the chosen tags
              // where their value would be — so the row answers the question it
              // asks, and the panel drops from the same edge as every other
              // property's. No ground under the pointer, unlike those: the pills
              // *are* the value, and a grey band behind them read as a second,
              // larger pill wrapped round the tags.
              <Button variant="ghost" className={`${trigger.replace(OPEN_FIELD_FILL, OPEN_FIELD_FILL_LIGHT)} h-auto min-h-0 justify-start bg-transparent hover:bg-transparent data-[hovered=true]:bg-transparent`}>
                {form.labelIds.length === 0 ? (
                  <span className={PROPERTY_VALUE}>{EMPTY_VALUE}</span>
                ) : (
                  <TaskLabelPills labelIds={form.labelIds} />
                )}
              </Button>
            }
          />
        </div>
      </div>
    ) : null,

    // The same control as the status row below, in the priority palette: the
    // chip is the field and the options are the same chip in the other two
    // colours. See TaskPriorityChipSelect, and ChipSelect under it, which the
    // two share.
    priority: (
      <div className={row}>
        <span className={fieldLabel}>
          <Flag className={LABEL_ICON} aria-hidden />
          {strings.task.fields.priority}
        </span>
        <div className={VALUE_CELL}>
          <TaskPriorityChipSelect
            priority={form.priority}
            isDisabled={!isEditing}
            panelWidth={PROPERTY_PANEL}
            onChange={(priority) => set('priority', priority)}
          />
        </div>
      </div>
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
            // The day in the picker, not the one the task was loaded with: a
            // deadline pushed into the future stops being late the moment it is
            // chosen, so the red and its mark go with the old date rather than
            // sitting under the new one until the dialog is saved. Done tasks
            // are never late whatever the date says — the same two clauses the
            // API's isOverdue is made of.
            isOverdue={isDayPast(form.dueDate) && task.status !== TaskStatus.DONE}
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
              <span className={`break-words ${PROPERTY_VALUE}`}>{sectorName}</span>
            </Select.Trigger>
          </div>
        </div>
        <Select.Popover {...listboxPopover} className={PROPERTY_PANEL}>
          <ListBox className={LISTBOX_FLUSH}>
            {sectors.map((sector) => (
              <ListBox.Item
                key={sector.id}
                id={sector.id}
                textValue={sector.name}
                className={`${TEXT_LISTBOX_ITEM} ${LISTBOX_TEXT}`}
              >
                {sector.name}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    ),

    // The sector row's twin, down to the panel and the option class — the two
    // are the same kind of property (one name, chosen from a short list) and
    // there is no reason for them to open different-looking lists. What it holds
    // is a placeholder; see SAMPLE_PROJECTS.
    project: (
      <Select
        isDisabled={!isEditing}
        className={undimmed}
        value={project}
        onChange={(key) => setProject(String(key))}
      >
        <div className={row}>
          <Label className={fieldLabel}>
            <FolderKanban className={LABEL_ICON} aria-hidden />
            {strings.task.fields.project}
          </Label>
          <div className={VALUE_CELL}>
            <Select.Trigger className={trigger}>
              <span className={`break-words ${PROPERTY_VALUE}`}>{project}</span>
            </Select.Trigger>
          </div>
        </div>
        <Select.Popover {...listboxPopover} className={PROPERTY_PANEL}>
          <ListBox className={LISTBOX_FLUSH}>
            {SAMPLE_PROJECTS.map((name) => (
              <ListBox.Item
                key={name}
                id={name}
                textValue={name}
                className={`${TEXT_LISTBOX_ITEM} ${LISTBOX_TEXT}`}
              >
                {name}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
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
            // A task cannot be moved along before it exists, so on a draft the
            // chip is the label of a state rather than a control — the state
            // being "A fazer", or the column the draft was opened from on the
            // board.
            isDisabled={!canEdit || isDraft}
            panelWidth={PROPERTY_PANEL}
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
        <Select.Popover {...listboxPopover} className={PROPERTY_PANEL}>
          <ListBox selectionMode="multiple" className={LISTBOX_FLUSH}>
            {users.map((user) => (
              <ListBox.Item
                key={user.id}
                id={user.id}
                textValue={user.name}
                className={`${TEXT_LISTBOX_ITEM} ${LISTBOX_TEXT}`}
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
        <Modal.Heading className="sr-only">
          {isDraft ? strings.task.addTask : task.title}
        </Modal.Heading>

        <div className="flex flex-wrap items-center gap-4">
          {/* Out of the bin, the header is one button and the way out: the task
              is not in any list, so there is no link worth copying and nothing
              to unlock. "Deletar permanente" is what "Deletar" cannot be any
              more — it has already been done once. */}
          {isTrashed ? (
            <button
              type="button"
              className={`${quietTextButton} text-sm font-medium`}
              disabled={purgeTask.isPending}
              onClick={() => {
                playSound('delete');
                purgeTask.mutate([task.id], { onSuccess: onClose });
              }}
            >
              <Trash2 className="size-4" />
              {strings.routine.trash.deletePermanently}
            </button>
          ) : null}

          {/* Both of these need a task on the server: there is no address to
              copy before one exists, and nothing to delete. A draft's header is
              therefore only "Editando" and the way out. */}
          {isDraft || isTrashed ? null : (
            <button
              type="button"
              className={`${quietTextButton} text-sm font-medium`}
              onClick={copyLink}
            >
              <Link2 className="size-4" />
              {strings.task.copyLink}
            </button>
          )}

          {canEdit ? (
            <>
              {/* Nothing to delete on a draft — the row it would remove does not
                  exist until Salvar makes it. */}
              {isDraft ? null : (
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
              )}

              {/* Unlocks the dialog, then reports that it is unlocked — Salvar
                  is in the footer, so once you are editing there is nothing left
                  for this slot to do but say so. A draft is only ever the first
                  of those two: it opens unlocked and there is no locked state to
                  go back to. */}
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
          {/* Row 1, left: the name, its tags and the properties — one cell, so
              the note beside it starts level with the title and ends level with
              the last property. They end at the gutter, where the properties do,
              so a long title wraps onto a second line rather than running the
              width of the dialog. */}
          <div
            className={`flex min-w-0 flex-col ${COLUMN_INSET} md:col-start-1 md:row-start-1`}
          >
            <div className={TITLE_GAP}>
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

            {/* The tags, under the name they belong to — the routine dialog's
                arrangement, and the reason this one no longer opens with a row
                of pills above its own title. Locked only: editing, they are in
                the Etiquetas property row, which is where they are changed. */}
            {isEditing ? null : (
              <TaskLabelPills labelIds={form.labelIds} className={TAGS_ROW} />
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
            {/* Live on a draft too, writing into the form instead of into a
                table: the "+" is there, the rows are there, and the list is
                posted with the task the moment Salvar creates it — see
                `draftSubtasks` above and `subtasks` on CreateTaskInput. It used
                to be read-only here, on the grounds that its controls post to
                /tasks/:id/subtasks and a draft has no id; the effect was a
                create dialog whose Subtarefas block was a heading you could not
                use, on the one screen where writing the list down is most of
                what you came to do. */}
            <TaskSubtasks
              taskId={task.id}
              subtasks={task.subtasks}
              isEditing={isEditing}
              canEdit={canEdit}
              draft={
                isDraft ? { items: draftSubtasks, onChange: setDraftSubtasks } : undefined
              }
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
          {/* One button in the bin, and it is the constructive one: destroying is
              in the header, where the Routines trash keeps its own, and a footer
              offering only "Cancelar" over a task nobody can change was a way
              out of a dialog that had nothing to leave behind. */}
          {isTrashed ? (
            <Button
              className="rounded-full"
              isDisabled={restoreTask.isPending}
              onPress={() => restoreTask.mutate(task.id, { onSuccess: onClose })}
            >
              {strings.routine.trash.restore}
            </Button>
          ) : (
            <>
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
            </>
          )}
        </Modal.Footer>
      </div>
    </Modal.Dialog>
  );
}

/** See draftTask: a stand-in for a person the dialog never actually reads. */
const BLANK_USER: UserDto = {
  id: '',
  email: '',
  name: '',
  role: Role.EMPLOYEE,
  jobTitle: null,
  avatarUrl: null,
};

/**
 * The blank task the create dialog is opened on.
 *
 * A whole TaskDetailDto rather than a partial one, because the dialog reads a
 * task and nothing else — giving it a real-shaped empty one is what lets the
 * create flow *be* the task modal instead of a second dialog that resembles it.
 *
 * The sector is the one field left deliberately unusable: an empty id matches no
 * sector, so the row shows its placeholder and Salvar stays disabled until a
 * real one is picked. The API requires it.
 */
function draftTask(
  userId: string | undefined,
  assigneeId: string | undefined,
  status: TaskStatus,
): TaskDetailDto {
  const now = new Date().toISOString();

  return {
    id: '',
    title: '',
    description: null,
    dueDate: null,
    priority: 'MEDIUM',
    // "A fazer" everywhere but on the board, where the column the draft was
    // opened from is the state it is being written in — see `defaultStatus`.
    // Shown here from the first keystroke rather than applied silently after
    // Salvar, so the dialog says which column the task is about to appear in.
    status,
    isOverdue: false,
    progress: 0,
    sector: { id: '', name: '' },
    // An id in a UserDto's clothes: the only thing the dialog takes from this
    // list is the ids, which is what it seeds the form's assigneeIds with, and
    // the row on screen looks the people themselves up in the users query. The
    // alternative — waiting for that query so a whole record could be copied in
    // — would mean seeding the form after the dialog was already on screen.
    assignees: assigneeId ? [{ ...BLANK_USER, id: assigneeId }] : [],
    // The draft belongs to whoever opened it, which is what puts the dialog in
    // edit mode for them — see canMutateEntity.
    createdById: userId ?? '',
    subtaskCount: 0,
    attachmentCount: 0,
    workedMs: 0,
    startedAt: null,
    completedAt: null,
    labels: [],
    attachments: [],
    subtasks: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * "+ Adicionar tarefa": the task dialog, empty and already unlocked.
 *
 * The same component as TaskModal below, on a task that does not exist yet —
 * see `isDraft` in TaskModalContent. What it is *not* is a second dialog with
 * the same fields: the small create form this replaced had drifted into its own
 * layout, and a task you were about to make looked nothing like a task you had.
 */
export function NewTaskModal({
  onClose,
  defaultAssigneeId,
  defaultStatus,
}: {
  onClose: () => void;
  /** Who the task lands on — the Dashboard fills in the person adding it. */
  defaultAssigneeId?: string;
  /**
   * Which state the task starts in — the board fills in the column its "+ Nova
   * tarefa" was pressed in, so a task added under "Em andamento" appears there
   * and not back at the head of the board.
   *
   * Applied *after* the create rather than as part of it: POST /tasks has no
   * status field, and the status route is where the app keeps the bookkeeping a
   * status change carries with it (when work started, when it finished). Going
   * through it means a task created in a column is indistinguishable from one
   * dragged there.
   */
  defaultStatus?: TaskStatus;
}) {
  const { data: me } = useMe();
  const flushEdits = useRef<() => void>(() => {});
  const setStatus = useSetTaskStatus();
  const status = defaultStatus ?? TaskStatus.TODO;

  // Seeded once: re-making it on a later render would hand the dialog a fresh
  // task object and reset the form under whoever is typing in it.
  const [task] = useState(() => draftTask(me?.id, defaultAssigneeId, status));

  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(open) => {
        // Nothing to flush — a draft is only ever written by Salvar — so
        // dismissing from outside simply drops it.
        if (!open) onClose();
      }}
    >
      <Modal.Container scroll="inside" className={DIALOG_INSET}>
        <TaskModalContent
          isDraft
          task={task}
          onClose={onClose}
          // TODO is what a new task already is, so only the other three columns
          // have anything to say here.
          onCreated={
            status === TaskStatus.TODO
              ? undefined
              : (created) => setStatus.mutate({ id: created.id, status })
          }
          flushRef={flushEdits}
        />
      </Modal.Container>
    </Modal.Backdrop>
  );
}

export function TaskModal({
  taskId,
  onClose,
  isTrashed = false,
}: {
  taskId: string;
  onClose: () => void;
  /** Opened from the Lixeira — see `isTrashed` in TaskModalContent. */
  isTrashed?: boolean;
}) {
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
          <TaskModalContent
            task={task}
            onClose={onClose}
            isTrashed={isTrashed}
            flushRef={flushEdits}
          />
        )}
      </Modal.Container>
    </Modal.Backdrop>
  );
}
