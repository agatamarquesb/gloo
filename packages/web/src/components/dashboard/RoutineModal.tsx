import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Link2,
  Paperclip,
  Pencil,
  Repeat,
  ClipboardList,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { Button, Input, Label, ListBox, Modal, Select } from '@heroui/react';
import { TextField } from 'react-aria-components';

import {
  MAX_ROUTINE_CHECKLISTS,
  RoutineRecurrence,
  type AttachmentDto,
  type RoutineChecklistDto,
  type RoutineDto,
} from '@gloo/shared';

import { UserAvatar } from '@/components/common/UserAvatar';
import {
  useCreateRoutine,
  useDeleteRoutine,
  useDeleteRoutinePermanently,
  useRestoreRoutine,
  useUpdateRoutine,
} from '@/hooks/queries/routines';
import { useLabels } from '@/hooks/queries/labels';
import { useMe } from '@/hooks/queries/auth';
import { useUsers } from '@/hooks/queries/users';
import { FLAT_INPUT, TEXT_LISTBOX_ITEM, listboxPopover } from '@/theme/fieldStyles';
// The property list is shared with the task modal — see theme/propertyRow.ts.
import {
  LABEL_ICON,
  PROPERTY_LIST,
  VALUE_CELL,
  propertyStyles,
} from '@/theme/propertyRow';
import { formatTimestamp } from '@/lib/formatDate';
import { playSound } from '@/lib/sounds';
import { LABEL_BG_CLASS, LABEL_PILL } from '@/theme/labelColors';
import {
  TITLE_FIELD,
  actionPill,
  dialogBodyFade,
  dialogClose,
  dialogFooter,
  dialogPadding,
  dialogSection,
  dialogShape,
  modalDivider,
  modalDividerGap,
  quietTextButton,
} from '@/theme/styleConstants';
import { SecondaryButton } from '@/components/common/SecondaryButton';
import { strings } from '@/strings/pt-BR';

import { AttachmentsBlock } from '@/components/common/AttachmentsBlock';
import { NotesBlock } from '@/components/common/NotesBlock';

import { LabelPicker } from './LabelPicker';
import { emptyChecklist, RoutineChecklist } from './RoutineChecklist';

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
/**
 * Two digits throughout — "01", not "1". The value stays the plain number; only
 * how it reads changes, and it has to match the "01 de ago." the Routines card
 * already prints for the same day.
 */
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1).padStart(2, '0'),
}));

/**
 * The gap under the tags, which is bigger than the one above them: they close
 * off the routine's identity, and the schedule below is a new kind of thing.
 */
const TAGS_ROW_VIEW = 'pt-1.5 pb-3';

/**
 * Locked, the title, its tags and the properties read as one list with no gap
 * of its own — every row's spacing is its own padding, HEADER_ROW_VIEW or
 * ROW_PADDING_VIEW. Editing, they are separate controls and need the room the
 * rest of the dialog uses.
 */
const HEADER_STACK_EDIT = 'gap-4';

/**
 * The title's own padding, locked — a step above the property rows below it
 * rather than the same. It is what the routine *is*; the schedule under it is
 * detail, and reads better held closer together.
 */
const HEADER_ROW_VIEW = 'py-1.5';

/** How long after the last edit an autosave fires. */

const ATTACHMENTS_ANCHOR = 'routine-attachments';
const checklistAnchor = (index: number) => `routine-checklist-${index}`;

interface FormState {
  description: string;
  recurrence: RoutineRecurrence;
  weekday: number;
  dayOfMonth: number;
  notes: string;
  checklists: RoutineChecklistDto[];
  attachments: AttachmentDto[] | null;
  labelIds: string[];
  assigneeIds: string[];
}

const emptyForm = (assigneeId: string): FormState => ({
  description: '',
  recurrence: RoutineRecurrence.WEEKLY,
  weekday: 1,
  dayOfMonth: 1,
  notes: '',
  checklists: [],
  // Null means "no attachments block"; an empty array means the block is open
  // but still empty. The button toggles between those two.
  attachments: null,
  labelIds: [],
  assigneeIds: assigneeId ? [assigneeId] : [],
});

export function RoutineModal({
  isOpen,
  onClose,
  routine,
  isTrashed = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Present when editing; omitted when creating. */
  routine?: RoutineDto;
  /**
   * Opened from the trash, where the routine can be read and nothing else: no
   * edit mode, no autosave, no ticking anything off, no reaching its files. The
   * only two things left are the ones that decide its fate — put it back, or
   * destroy it — and both are here rather than a level up, because you want to
   * see what a routine is before choosing between them.
   */
  isTrashed?: boolean;
}) {
  const { data: me } = useMe();
  const { data: users = [] } = useUsers();
  const createRoutine = useCreateRoutine();
  const updateRoutine = useUpdateRoutine();
  const deleteRoutine = useDeleteRoutine();
  const restoreRoutine = useRestoreRoutine();
  const deletePermanently = useDeleteRoutinePermanently();

  const [form, setForm] = useState<FormState>(() => emptyForm(me?.id ?? ''));
  /**
   * Opening an existing routine shows it, it doesn't hand you a form: the
   * dialog is read-only until "Editar" is pressed. A new one has nothing to
   * read, so it starts editable.
   */
  const [isEditing, setEditing] = useState(false);
  /** Anchor id of a block just added, so the dialog can scroll it into view. */
  const [scrollTo, setScrollTo] = useState<string | null>(null);

  /** The routine as a form — what the dialog opens with, and what Cancelar returns to. */
  const seedForm = useCallback(
    (): FormState =>
      routine
        ? {
            description: routine.description,
            recurrence: routine.recurrence,
            weekday: routine.weekday ?? 1,
            dayOfMonth: routine.dayOfMonth ?? 1,
            notes: routine.notes ?? '',
            checklists: routine.checklists,
            attachments: routine.attachments,
            labelIds: routine.labels.map((label) => label.id),
            assigneeIds: routine.assignees.map((assignee) => assignee.id),
          }
        : emptyForm(me?.id ?? ''),
    [routine, me?.id],
  );

  useEffect(() => {
    if (!isOpen) return;
    setEditing(!routine && !isTrashed);
    setForm(seedForm());
    // isTrashed decides whether the dialog opens unlocked, so a routine opened
    // from the trash and the same one opened from the list have to seed
    // differently — it belongs in the list.
  }, [isOpen, routine, me?.id, isTrashed, seedForm]);

  // Adding a block below the fold is invisible without this — the new box is
  // outside the dialog's scroll viewport, so the button appears to do nothing.
  useEffect(() => {
    if (!scrollTo) return;
    document.getElementById(scrollTo)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setScrollTo(null);
  }, [scrollTo]);

  /** The row rhythm and control height both follow the mode — see propertyRow.ts. */
  const {
    row: propertyRow,
    label: fieldLabel,
    trigger,
    undimmed,
  } = propertyStyles(isEditing);

  const isWeekly = form.recurrence === RoutineRecurrence.WEEKLY;
  const canSubmit = form.description.trim() && form.assigneeIds.length > 0;
  const canAddChecklist = form.checklists.length < MAX_ROUTINE_CHECKLISTS;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  function addChecklist() {
    if (!canAddChecklist) return;
    const next = [...form.checklists, emptyChecklist()];
    set('checklists', next);
    setScrollTo(checklistAnchor(next.length - 1));
  }

  function openAttachments() {
    set('attachments', form.attachments ?? []);
    setScrollTo(ATTACHMENTS_ANCHOR);
  }

  /**
   * Everything an edit could change, in the shape the API takes. Serialised for
   * the dirty check, so any edit at all — a ticked item, a new label, a swapped
   * assignee — is caught without listing the fields twice.
   */
  const payload = useMemo(
    () => ({
      description: form.description.trim(),
      recurrence: form.recurrence,
      weekday: isWeekly ? form.weekday : null,
      dayOfMonth: isWeekly ? null : form.dayOfMonth,
      notes: form.notes.trim() || null,
      // Kept verbatim, blank rows included: adding a checklist or opening the
      // attachments block is itself an edit, so an empty one persists as empty
      // rather than vanishing on the next open.
      checklists: form.checklists,
      attachments: form.attachments,
      labelIds: form.labelIds,
      assigneeIds: form.assigneeIds,
    }),
    [form, isWeekly],
  );

  /**
   * The last state known to be on the server, so an autosave only fires for a
   * real change. Set when the form loads and after each save.
   */
  const savedRef = useRef('');
  useEffect(() => {
    if (isOpen) {
      savedRef.current = JSON.stringify(payload);
      discardedRef.current = false;
    }
    // Deliberately only on open: this is the baseline the dirty check compares
    // against, so it must not follow the form as the user types.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, routine?.id]);

  /**
   * Set by Cancelar, so the close that follows it writes nothing.
   *
   * A flag rather than resetting the baseline: the baseline is a serialised
   * `payload`, and `payload` only catches up with the reverted form on the next
   * render — which is after the dialog has already been told to close. Cleared
   * on open, since the dialog outlives each of its openings.
   */
  const discardedRef = useRef(false);

  const saveIfDirty = useCallback(() => {
    // Only for an existing routine — a new one has no id to PATCH, and saving
    // one on the way out would litter the list with untitled routines. Never for
    // a trashed one: nothing about it is editable, so anything this found would
    // be a bug rather than a change worth keeping.
    if (discardedRef.current || !routine || !canSubmit || isTrashed) return;
    const serialised = JSON.stringify(payload);
    if (serialised === savedRef.current) return;

    savedRef.current = serialised;
    updateRoutine.mutate({ id: routine.id, ...payload });
  }, [routine, canSubmit, payload, updateRoutine, isTrashed]);

  /**
   * The line at the foot of the dialog, and only in the trash: when the routine
   * was deleted, which is what you want to know when deciding whether to bring
   * it back. A live routine says nothing — "last changed" was a fact about the
   * dialog rather than about the routine, and it sat under everything you had
   * come to read.
   */
  const footnote = useMemo(
    () =>
      isTrashed && routine?.deletedAt
        ? `${strings.routine.trash.deletedAt}: ${formatTimestamp(routine.deletedAt)}`
        : null,
    [isTrashed, routine?.deletedAt],
  );

  /**
   * Closing without pressing anything — the header's ×, a click outside, Escape
   * — keeps the edit: what is on screen is what you meant, so it is written on
   * the way out. Cancelar is the one route that does not.
   */
  function handleClose() {
    saveIfDirty();
    onClose();
  }

  /**
   * Cancelar: back to the routine as it stands on the server, and out with
   * nothing written — see `discardedRef`, which is what stops the way out from
   * saving the edit this just threw away.
   */
  function handleCancel() {
    discardedRef.current = true;
    setForm(seedForm());
    onClose();
  }

  /**
   * The two ways a trashed routine leaves the trash. Both close the dialog on
   * success — either way the routine it was showing is no longer in the list
   * that opened it.
   */
  function handleRestore() {
    if (!routine) return;
    restoreRoutine.mutate(routine.id, { onSuccess: onClose });
  }

  function handleDeletePermanently() {
    if (!routine) return;
    deletePermanently.mutate(routine.id, { onSuccess: onClose });
  }

  /**
   * Routines live on the Dashboard rather than at their own route, so a shareable
   * link is the Dashboard plus a query param that reopens this one. See
   * ROUTINE_PARAM in RoutinesCard, which is what reads it back.
   */
  function copyLink() {
    if (!routine) return;
    const url = new URL(window.location.origin);
    url.searchParams.set('rotina', routine.id);
    navigator.clipboard.writeText(url.toString());
  }

  function handleDelete() {
    if (!routine) return;
    // Skip the pending autosave: the routine is about to stop existing.
    savedRef.current = JSON.stringify(payload);
    deleteRoutine.mutate(routine.id, { onSuccess: onClose });
  }

  function handleSubmit() {
    if (routine) {
      // Commits and drops back to reading it. Closing would be the wrong move
      // now that Salvar is the counterpart of Editar rather than of Cancelar —
      // and autosave means the write has usually already happened anyway.
      savedRef.current = JSON.stringify(payload);
      updateRoutine.mutate({ id: routine.id, ...payload });
      setEditing(false);
    } else {
      // A new routine has nowhere to return to: creating it is the whole point
      // of the dialog, so this one closes.
      createRoutine.mutate(payload, { onSuccess: onClose });
    }
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Modal.Container scroll="inside">
        <Modal.Dialog className={`sm:max-w-[34rem] ${dialogShape} ${dialogPadding}`}>
          {/* No Modal.CloseTrigger: that one positions itself against the
              dialog's corner, which is never quite where the header's own row
              sits. The close button is a member of that row instead — see the
              end of it — so the two line up by construction rather than by two
              paddings being kept in step. */}
          {/* No gap: the rule below the actions carries its own, so that it and
              the one between the content blocks keep the same distance from
              what they separate. */}
          <Modal.Header className={`flex flex-col ${dialogSection}`}>
            {/* The dialog still needs a name for screen readers; the routine's
                own title carries it visually, so this one is hidden. */}
            <Modal.Heading className="sr-only">
              {routine ? strings.common.edit : strings.routine.addRoutine}
            </Modal.Heading>

            {/* The actions take the header row, and the close button ends it.
                Only a saved routine has a link to copy or anything to delete —
                and a trashed one has neither: there is no point sharing a link
                to something that is on its way out, and nothing left to edit.
                All it keeps is the one button that finishes the job, on the
                left where Copiar link would have been.

                All of them are bare buttons — no padding, no hover pill, just
                the text darkening; see quietTextButton. Without that padding the
                row starts on the same edge as the rule below it, and gap-4 is
                what keeps the labels apart now that nothing else does. */}
            <div className="flex flex-wrap items-center gap-4">
              {isTrashed ? (
                // Unpadded, so it starts on the same edge as the rule below the
                // header rather than a button's worth of space in from it — and
                // with nothing on hover but the text going darker. See
                // quietTextButton for why this is not a ghost Button.
                <button
                  type="button"
                  className={`${quietTextButton} text-sm font-medium`}
                  disabled={deletePermanently.isPending}
                  onClick={() => {
                    playSound('delete');
                    handleDeletePermanently();
                  }}
                >
                  <Trash2 className="size-4" />
                  {strings.routine.trash.deletePermanently}
                </button>
              ) : (
                <>
                  {routine ? (
                    <>
                      <button
                        type="button"
                        className={`${quietTextButton} text-sm font-medium`}
                        onClick={copyLink}
                      >
                        <Link2 className="size-4" />
                        {strings.routine.copyLink}
                      </button>
                      <button
                        type="button"
                        className={`${quietTextButton} text-sm font-medium`}
                        disabled={deleteRoutine.isPending}
                        onClick={() => {
                          playSound('delete');
                          handleDelete();
                        }}
                      >
                        <Trash2 className="size-4" />
                        {strings.routine.deleteRoutine}
                      </button>
                    </>
                  ) : null}

                  {/* Unlocks the dialog, then reports that it is unlocked —
                      Salvar is in the footer, so once you are editing there is
                      nothing left for this slot to do but say so. Copiar link
                      and Deletar keep their places either way. */}
                  {isEditing ? (
                    /* Weight and colour matched to the Editar button it
                       replaces — it takes that button's place in the row, so it
                       has to read as the same thing in a different state, not
                       as different copy. */
                    <span className="flex items-center gap-1.5 text-sm font-medium text-muted">
                      <Pencil className="size-4" />
                      {strings.routine.editing}
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
              )}

              {/* The primary button's own look, not a grey glyph: closing is one
                  of the two things you can do from here, and it is the same one
                  as Cancelar in the footer — so it wears the same outlined pill
                  rather than the filled green Salvar carries. `ml-auto` puts it
                  on the row's far end, which is the content's right edge. */}
              <button
                type="button"
                className={dialogClose}
                aria-label={strings.common.close}
                onClick={handleClose}
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Closes the action row off from the routine below it — the same
                hairline that separates the properties from the content blocks. */}
            <div className={`${modalDivider} ${modalDividerGap}`} />
          </Modal.Header>

          {/* Fades the scroll edges so long content doesn't end in a hard white
              cut at the dialog's margins. A mask rather than an overlay, so it
              tracks the body's own padding and needs no extra element. */}
          {/* overflow-x-hidden because the property controls overhang their
              column by the chevron's 8px inset (see BARE_TRIGGER), and that
              overhang propagates up as a horizontal scrollbar. The 8px lands
              inside the body's own right padding, so nothing visible is clipped
              — and a vertical form should never scroll sideways anyway. */}
          <Modal.Body
            className={`flex flex-col gap-4 overflow-x-hidden ${dialogSection} ${dialogBodyFade}`}
          >
            {/* Title, tags and properties are one group so their spacing can be
                set together — see HEADER_STACK_EDIT. */}
            <div className={`flex flex-col ${isEditing ? HEADER_STACK_EDIT : ''}`}>
              {/* Underline, not a box: the title is the one thing you always
                  type, so it reads as a line to write on rather than another
                  form field. Green rule, the same marker the checklist title
                  uses — and it goes away when the dialog is locked, since there
                  is then nothing to write on. */}
              <div
                className={`flex items-center gap-2 ${isEditing ? '' : HEADER_ROW_VIEW}`}
              >
                {/* Locked, the routine's name is a heading, not a field switched
                    off: a read-only Input still draws its own edge under the
                    cursor, which put a rule under a title nobody was editing. */}
                {isEditing ? (
                  <TextField
                    aria-label={strings.routine.titleLabel}
                    value={form.description}
                    onChange={(description) => set('description', description)}
                    className="min-w-0 flex-1"
                  >
                    <Input
                      fullWidth
                      placeholder={strings.routine.titleLabel}
                      className={`${FLAT_INPUT} ${TITLE_FIELD} text-xl font-bold`}
                    />
                  </TextField>
                ) : (
                  <h2 className="min-w-0 flex-1 truncate text-xl font-bold text-foreground">
                    {form.description}
                  </h2>
                )}
              </div>

              {/* No indent: with the title's icon gone there is no column to
                  clear, and everything in the dialog now starts on the same edge
                  as the rule under the header. */}
              <div className={`flex flex-col ${isEditing ? HEADER_STACK_EDIT : ''}`}>
                <SelectedLabels ids={form.labelIds} className={isEditing ? '' : TAGS_ROW_VIEW} />

              {/* One property per row — label on the left, value on the right —
                  rather than three columns: the values are short, and stacking
                  them keeps the whole set scannable at a glance. */}
              <div className={PROPERTY_LIST}>
                

              <Select
                isDisabled={!isEditing}
                className={undimmed}
                value={form.recurrence}
                onChange={(key) => set('recurrence', String(key) as RoutineRecurrence)}
              >
                <div className={propertyRow}>
                  <Label className={fieldLabel}>
                    <Repeat className={LABEL_ICON} aria-hidden />
                    {strings.routine.recurrenceLabel}
                  </Label>
                  <div className={VALUE_CELL}>
                    <Select.Trigger className={trigger}>
                      <Select.Value />
                      {isEditing ? <Select.Indicator /> : null}
                    </Select.Trigger>
                  </div>
                </div>
                <Select.Popover {...listboxPopover}>
                  <ListBox>
                    {Object.values(RoutineRecurrence).map((value) => (
                      <ListBox.Item
                        key={value}
                        id={value}
                        textValue={strings.routine.recurrence[value]}
                        className={`${TEXT_LISTBOX_ITEM} lowercase`}
                      >
                        {strings.routine.recurrence[value]}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>

              {isWeekly ? (
                <Select
                  isDisabled={!isEditing}
                className={undimmed}
                  value={String(form.weekday)}
                  onChange={(key) => set('weekday', Number(key))}
                >
                  <div className={propertyRow}>
                    <Label className={fieldLabel}>
                      <CalendarDays className={LABEL_ICON} aria-hidden />
                      {strings.routine.weekdayLabel}
                    </Label>
                    <div className={VALUE_CELL}>
                      <Select.Trigger className={trigger}>
                        <Select.Value />
                        {isEditing ? <Select.Indicator /> : null}
                      </Select.Trigger>
                    </div>
                  </div>
                  <Select.Popover {...listboxPopover}>
                    <ListBox>
                      {WEEKDAYS.map((label, index) => (
                        <ListBox.Item
                          key={label}
                          id={String(index)}
                          textValue={label}
                          className={`${TEXT_LISTBOX_ITEM} lowercase`}
                        >
                          {label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              ) : (
                <Select
                  isDisabled={!isEditing}
                className={undimmed}
                  value={String(form.dayOfMonth)}
                  onChange={(key) => set('dayOfMonth', Number(key))}
                >
                  <div className={propertyRow}>
                    <Label className={fieldLabel}>
                      <CalendarDays className={LABEL_ICON} aria-hidden />
                      {strings.routine.dayOfMonthLabel}
                    </Label>
                    <div className={VALUE_CELL}>
                      <Select.Trigger className={trigger}>
                        <Select.Value />
                        {isEditing ? <Select.Indicator /> : null}
                      </Select.Trigger>
                    </div>
                  </div>
                  <Select.Popover {...listboxPopover}>
                    <ListBox>
                      {MONTH_DAYS.map((day) => (
                        <ListBox.Item
                          key={day.value}
                          id={day.value}
                          textValue={day.label}
                          className={`${TEXT_LISTBOX_ITEM} lowercase`}
                        >
                          {day.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              )}
            <Select
                  selectionMode="multiple"
                  isDisabled={!isEditing}
                  className={undimmed}
                  value={form.assigneeIds}
                onChange={(keys) => set('assigneeIds', (keys as (string | number)[]).map(String))}
              >
                <div className={propertyRow}>
                  <Label className={fieldLabel}>
                    <UserRound className={LABEL_ICON} aria-hidden />
                    {strings.routine.assigneeLabel}
                  </Label>
                  <div className={VALUE_CELL}>
                    <Select.Trigger className={trigger}>
                      <Select.Value />
                      {isEditing ? <Select.Indicator /> : null}
                    </Select.Trigger>
                  </div>
                </div>
                <Select.Popover {...listboxPopover}>
                  <ListBox selectionMode="multiple">
                    {users.map((user) => (
                      <ListBox.Item key={user.id} id={user.id} textValue={user.name}>
                        <span className="flex items-center gap-2">
                          <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="sm" className="size-5" />
                          {user.name}
                        </span>
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              </div>
              </div>
            </div>

            {/* What the routine carries, as opposed to what it is — back on the
                dialog's own spacing, since these are blocks rather than rows of
                a list. */}
            <div className="flex flex-col gap-4">
            {/* Splits the routine in two: what it is — title, tags, schedule,
                who — above, and what it carries — notes, checklists, files —
                below. Locked only: editing, it fell immediately above the
                Checklist/Etiquetas/Anexos pills and read as their frame. */}
            {isEditing ? null : <div className={modalDivider} />}

            {/* The three ways to enrich a routine, as one pill row above the
                notes — same shape and grid as the Time blocking presets. Adding
                anything is an edit, so the whole row goes with edit mode. */}
            <div className={`grid grid-cols-3 gap-2 ${isEditing ? '' : 'hidden'}`}>
              <Button
                variant="outline"
                size="sm"
                fullWidth
                className={actionPill}
                isDisabled={!canAddChecklist}
                onPress={addChecklist}
              >
                <ClipboardList className="size-4" />
                {strings.routine.checklist}
              </Button>

              <LabelPicker
                selectedIds={form.labelIds}
                onChange={(labelIds) => set('labelIds', labelIds)}
              />

              <Button
                variant="outline"
                size="sm"
                fullWidth
                className={actionPill}
                onPress={openAttachments}
              >
                <Paperclip className="size-4" />
                {strings.routine.attachments}
              </Button>
            </div>

            {/* Notes wear the same box and the same header row as the checklist
                and attachment blocks, so the three read as one family — outlined
                while editing, bare once locked. The task modal wears the very
                same block; see NotesBlock. */}
            <NotesBlock
              isEditing={isEditing}
              value={form.notes}
              onChange={(notes) => set('notes', notes)}
              placeholder={strings.routine.notesPlaceholder}
            />

            {form.checklists.map((checklist, index) => (
              // Index keys: checklists are only appended and removed, never
              // reordered, so position is a stable identity here.
              // eslint-disable-next-line react/no-array-index-key
              <div key={index} id={checklistAnchor(index)}>
                <RoutineChecklist
                  isEditing={isEditing}
                  canToggle={!isTrashed}
                  checklist={checklist}
                  onChange={(next) =>
                    set(
                      'checklists',
                      form.checklists.map((current, i) => (i === index ? next : current)),
                    )
                  }
                  onDelete={() =>
                    set(
                      'checklists',
                      form.checklists.filter((_, i) => i !== index),
                    )
                  }
                />
              </div>
            ))}

              {form.attachments ? (
                <div id={ATTACHMENTS_ANCHOR}>
                  <AttachmentsBlock
                    isEditing={isEditing}
                    canOpen={!isTrashed}
                    attachments={form.attachments}
                    onChange={(attachments) => set('attachments', attachments)}
                  />
                </div>
              ) : null}

              {/* Last thing in the routine rather than pinned to the footer: it
                  is a fact about the routine, so it belongs with the rest of
                  them and scrolls with them. Same size and grey as a property's
                  label — a footnote, not part of the content. */}
              {footnote ? <p className="text-xs text-muted italic">{footnote}</p> : null}
            </div>
          </Modal.Body>

          {/* Copiar link / Deletar / Editar live in the header, and the last
              change with the content, so the footer is just the two ways out of
              the dialog — Salvar only while there is something to save. */}
          {/* pt/pb rather than HeroUI's own: the body already ends in pb-6, and
              the component's default on top of that left the buttons adrift in a
              band of empty space. */}
          <Modal.Footer
            className={`flex items-center justify-end gap-2 ${dialogFooter}`}
          >
            {/* From the trash, the way out of the dialog is the header's × —
                so the footer carries the decision instead, and Recuperar takes
                Salvar's place as the one green thing here. */}
            {isTrashed ? (
              <Button
                className="rounded-full"
                isDisabled={restoreRoutine.isPending || deletePermanently.isPending}
                onPress={handleRestore}
              >
                {strings.routine.trash.restore}
              </Button>
            ) : (
              <>
                <SecondaryButton onPress={handleCancel}>{strings.common.cancel}</SecondaryButton>
                {isEditing ? (
                  <Button
                    className="rounded-full"
                    isDisabled={!canSubmit || createRoutine.isPending || updateRoutine.isPending}
                    onPress={handleSubmit}
                  >
                    {strings.common.save}
                  </Button>
                ) : null}
              </>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** The labels currently ticked in the picker, shown as the pills they will be. */
function SelectedLabels({ ids, className = '' }: { ids: string[]; className?: string }) {
  const { data: labels = [] } = useLabels();
  const selected = labels.filter((label) => ids.includes(label.id));

  // Returning nothing rather than an empty row: the caller pads this to match a
  // property row, and an empty one would show as a gap where no tags are.
  if (selected.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {selected.map((label) => (
        <span
          key={label.id}
          className={`${LABEL_PILL} ${LABEL_BG_CLASS[label.color]}`}
        >
          {label.name}
        </span>
      ))}
    </div>
  );
}
