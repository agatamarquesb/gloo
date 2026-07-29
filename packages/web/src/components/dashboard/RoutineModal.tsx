import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BrushCleaning,
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
import {
  FLAT_INPUT,
  FLAT_SELECT_TRIGGER,
  GREEN_UNDERLINE,
  NO_FIELD_BORDER,
} from '@/theme/fieldStyles';
import { playSound } from '@/lib/sounds';
import { LABEL_BG_CLASS, LABEL_PILL } from '@/theme/labelColors';
import {
  actionPill,
  blockBox,
  blockBoxBare,
  blockDivider,
  blockLeadColumn,
  blockTitle,
  modalDivider,
  modalDividerGap,
  outlineControl,
  quietTextButton,
} from '@/theme/styleConstants';
import { SecondaryButton } from '@/components/common/SecondaryButton';
import { strings } from '@/strings/pt-BR';

import { LabelPicker } from './LabelPicker';
import { RoutineAttachments } from './RoutineAttachments';
import { emptyChecklist, RoutineChecklist } from './RoutineChecklist';
import { isNotesEmpty, RichNotes } from './RichNotes';

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

const PROPERTY_LIST = 'flex flex-col';

/**
 * A property row shares the action-pill row's three columns: the label sits in
 * the first, the value starts at the head of the second. Values therefore begin
 * on the middle pill's left edge — near their labels rather than stranded
 * against the far side of the dialog.
 */
const PROPERTY_ROW = 'grid grid-cols-3 items-center gap-2';

/**
 * A row's own vertical padding, and so the gap between two of them: the header
 * group has no gap of its own and leans entirely on this. Tighter once locked —
 * a list you read wants to hold together, while the same rows as controls need
 * the room to be separately clickable.
 */
const ROW_PADDING_EDIT = 'py-1';
const ROW_PADDING_VIEW = 'py-0.5';

/**
 * The value side carries no chrome at all — no border, fill or shadow in any
 * state. It is a value you can change, not a form control.
 *
 * `w-full` makes the control span its whole grid column, so the chevron lands on
 * the column's right edge — the same edge as the middle action pill — while the
 * value itself stays left-aligned at the column's start. `pr-6` keeps a long
 * value from running under the chevron.
 *
 * HeroUI insets the chevron 8px from the control's right edge, which would leave
 * it short of the column. Rather than fight that from outside the component, the
 * control is widened by exactly that inset so the chevron lands on the edge.
 */
const BARE_TRIGGER = `${FLAT_SELECT_TRIGGER} ${NO_FIELD_BORDER} w-[calc(100%+0.5rem)] items-center gap-1 pr-6 pl-0 text-left`;

/**
 * The trigger's height, which sets the row's. Locked it comes down to just clear
 * the assignee avatar (size-5), since nothing there has to be a comfortable
 * click target any more.
 */
const TRIGGER_HEIGHT_EDIT = 'h-8';
const TRIGGER_HEIGHT_VIEW = 'h-7';

/**
 * Outside edit mode the control stays in place but stops being one: no pointer
 * affordance, and none of HeroUI's dimming, since the value still has to read
 * as the routine's actual content rather than as a disabled field.
 */
const VIEW_TRIGGER =
  'cursor-default disabled:opacity-100 data-[disabled=true]:opacity-100';

/**
 * The same opt-out for the rest of a disabled Select.
 *
 * `isDisabled` is what stops a locked property from opening, but HeroUI dims
 * everything inside it — so the label and its icon faded out too, and the whole
 * column read a shade lighter locked than editing. The trigger already opted out
 * (above); these are its label and the Select's own root, which is where the
 * dimming can also sit. Marked important because the component sets it from its
 * own data attribute and would otherwise win on order.
 */
const VIEW_UNDIMMED = 'opacity-100! data-[disabled=true]:opacity-100!';

/**
 * The value's grid column. A wrapper rather than putting the control straight in
 * the cell, because the control deliberately overhangs its column by the
 * chevron's inset and the column itself must not.
 */
const VALUE_CELL = 'w-full';

/** The dropdown itself, squared off a little from HeroUI's default. */
const SELECT_POPOVER = 'rounded-xl';

/** Labels carry the icon, not the control — the value stays plain text. */
const FIELD_LABEL = 'flex shrink-0 items-center gap-2 text-sm text-muted';

/**
 * The icons read at full text colour while their labels stay grey: at 16px a
 * muted glyph is mostly gone, and these are what you scan the column by.
 */
const LABEL_ICON = 'size-4 shrink-0 text-foreground';

/**
 * The dialog's horizontal padding, applied to the header, body and footer alike
 * rather than left to HeroUI's own.
 *
 * One value in one place is what makes the whole dialog line up: every rule in
 * it spans the same width, the header's buttons start where the routine's title
 * does, and the footer's buttons end where the content does. `pl`/`pr` rather
 * than `px` because Tailwind emits the long-hand utilities after the shorthand,
 * so these are the ones that win over the component's own padding.
 */
const DIALOG_PADDING = 'pl-4 pr-4';

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
const AUTOSAVE_DELAY_MS = 800;

/** "28/07/2026, 14:32" — the date the modal reports at its foot. */
const timestampFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

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

  useEffect(() => {
    if (!isOpen) return;
    setEditing(!routine && !isTrashed);
    setForm(
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
    );
  }, [isOpen, routine, me?.id]);

  // Adding a block below the fold is invisible without this — the new box is
  // outside the dialog's scroll viewport, so the button appears to do nothing.
  useEffect(() => {
    if (!scrollTo) return;
    document.getElementById(scrollTo)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setScrollTo(null);
  }, [scrollTo]);

  /** The row rhythm and control height both follow the mode — see their consts. */
  const rowPadding = isEditing ? ROW_PADDING_EDIT : ROW_PADDING_VIEW;
  const propertyRow = `${PROPERTY_ROW} ${rowPadding}`;
  const undimmed = isEditing ? '' : VIEW_UNDIMMED;
  const fieldLabel = `${FIELD_LABEL} ${undimmed}`;
  const trigger = `${BARE_TRIGGER} ${isEditing ? TRIGGER_HEIGHT_EDIT : `${TRIGGER_HEIGHT_VIEW} ${VIEW_TRIGGER}`}`;

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
    if (isOpen) savedRef.current = JSON.stringify(payload);
    // Deliberately only on open: this is the baseline the dirty check compares
    // against, so it must not follow the form as the user types.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, routine?.id]);

  const saveIfDirty = useCallback(() => {
    // Only for an existing routine — a new one has no id to PATCH, and
    // autosaving one would litter the list with untitled routines. Never for a
    // trashed one: nothing about it is editable, so anything this found would be
    // a bug rather than a change worth keeping.
    if (!routine || !canSubmit || isTrashed) return;
    const serialised = JSON.stringify(payload);
    if (serialised === savedRef.current) return;

    savedRef.current = serialised;
    updateRoutine.mutate({ id: routine.id, ...payload });
  }, [routine, canSubmit, payload, updateRoutine, isTrashed]);

  // Autosave: every edit persists on its own shortly after you stop making it,
  // so closing the dialog — by any route — never loses work.
  useEffect(() => {
    if (!isOpen || !routine || isTrashed) return;
    const timer = setTimeout(saveIfDirty, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isOpen, routine, isTrashed, saveIfDirty]);

  /**
   * The line at the foot of the dialog: when the routine was last written, or
   * when it was deleted if that is what it is.
   *
   * For the live case the `routine` prop is a snapshot taken when the dialog
   * opened — the list hands over the object it had — so on its own it would
   * freeze at the moment of opening while autosave carried on writing behind it.
   * The PATCH response is the same routine as the server now has it, so the
   * mutation's last result takes precedence — but only for the routine it
   * actually belongs to, since the dialog stays mounted between openings and the
   * result outlives them.
   */
  const saved = updateRoutine.data;
  const footnote = useMemo(() => {
    // A trashed routine reports when it went, not when it last changed: nothing
    // has changed it since, and the date it was deleted is what you want to know
    // when deciding whether to bring it back.
    if (isTrashed) {
      return routine?.deletedAt
        ? `${strings.routine.trash.deletedAt}: ${timestampFormatter.format(new Date(routine.deletedAt))}`
        : null;
    }

    const iso = saved && saved.id === routine?.id ? saved.updatedAt : routine?.updatedAt;
    return iso
      ? `${strings.routine.lastUpdated}: ${timestampFormatter.format(new Date(iso))}`
      : null;
  }, [isTrashed, saved, routine?.id, routine?.updatedAt, routine?.deletedAt]);

  /** Flushes anything the debounce hasn't written yet, then closes. */
  function handleClose() {
    saveIfDirty();
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

  function clearNotes() {
    set('notes', '');
    playSound('sweep');
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
        <Modal.Dialog className="sm:max-w-xl">
          {/* No Modal.CloseTrigger: that one positions itself against the
              dialog's corner, which is never quite where the header's own row
              sits. The close button is a member of that row instead — see the
              end of it — so the two line up by construction rather than by two
              paddings being kept in step. */}
          {/* No gap: the rule below the actions carries its own, so that it and
              the one between the content blocks keep the same distance from
              what they separate. */}
          <Modal.Header className={`flex flex-col ${DIALOG_PADDING}`}>
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
              <SecondaryButton
                isIconOnly
                size="sm"
                className="ml-auto"
                aria-label={strings.common.close}
                onPress={handleClose}
              >
                <X className="size-4" />
              </SecondaryButton>
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
            className={`flex flex-col gap-4 overflow-x-hidden pb-6 ${DIALOG_PADDING} [mask-image:linear-gradient(to_bottom,transparent_0,black_1.25rem,black_calc(100%-1.25rem),transparent_100%)]`}
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
                      className={`${FLAT_INPUT} ${GREEN_UNDERLINE} text-xl font-bold`}
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
                <Select.Popover className={SELECT_POPOVER}>
                  <ListBox>
                    {Object.values(RoutineRecurrence).map((value) => (
                      <ListBox.Item
                        key={value}
                        id={value}
                        textValue={strings.routine.recurrence[value]}
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
                  <Select.Popover className={SELECT_POPOVER}>
                    <ListBox>
                      {WEEKDAYS.map((label, index) => (
                        <ListBox.Item key={label} id={String(index)} textValue={label}>
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
                  <Select.Popover className={SELECT_POPOVER}>
                    <ListBox>
                      {MONTH_DAYS.map((day) => (
                        <ListBox.Item key={day.value} id={day.value} textValue={day.label}>
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
                <Select.Popover className={SELECT_POPOVER}>
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
                while editing, bare once locked. The name is fixed here, so it is
                text rather than a field. */}
            <section className={isEditing ? blockBox : blockBoxBare}>
              <RichNotes
                isEditing={isEditing}
                value={form.notes}
                onChange={(notes) => set('notes', notes)}
                placeholder={strings.routine.notesPlaceholder}
                title={
                  /* One flex of its own rather than two children of the toolbar:
                     the toolbar's gap is tuned for the formatting buttons, and
                     this heading has to sit on the same left edge as the
                     checklist's and Anexos', which means the shared column and
                     the gap that goes with it. */
                  <div className="flex flex-1 items-center gap-2">
                    <span className={blockLeadColumn}>
                      <Pencil className="size-4 text-foreground" aria-hidden />
                    </span>
                    <span className={`text-foreground ${blockTitle(isEditing)}`}>
                      {strings.routine.notesTitle}
                    </span>
                  </div>
                }
                actions={
                  /* Outlined like "Escolher arquivo", and labelled: emptying a
                     field the user has typed into deserves a word, not just an
                     icon. The woosh is the feedback that it actually happened —
                     the field simply going blank is easy to miss. */
                  <Button
                    size="sm"
                    variant="outline"
                    className={`h-9 shrink-0 rounded-full ${outlineControl}`}
                    isDisabled={isNotesEmpty(form.notes)}
                    onPress={clearNotes}
                  >
                    <BrushCleaning className="size-4" />
                    {strings.routine.clearNotes}
                  </Button>
                }
              />

              {/* Same rule, and the same clearance, as the one that closes a
                  checklist. Locked only: editing, the box's own edge does it. */}
              {isEditing ? null : <div className={blockDivider} />}
            </section>

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
                  <RoutineAttachments
                    isEditing={isEditing}
                    canOpen={!isTrashed}
                    attachments={form.attachments}
                    onChange={(attachments) => set('attachments', attachments)}
                    onDelete={() => set('attachments', null)}
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
            className={`flex items-center justify-end gap-2 pt-2 pb-3 ${DIALOG_PADDING}`}
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
                <SecondaryButton slot="close">{strings.common.cancel}</SecondaryButton>
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
