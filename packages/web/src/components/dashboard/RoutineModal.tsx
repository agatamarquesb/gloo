import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BrushCleaning,
  CalendarDays,
  CircleCheck,
  Link2,
  NotepadText,
  Paperclip,
  Pencil,
  Repeat,
  SquareCheckBig,
  Trash2,
  UserRound,
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
import { useCreateRoutine, useDeleteRoutine, useUpdateRoutine } from '@/hooks/queries/routines';
import { useLabels } from '@/hooks/queries/labels';
import { useMe } from '@/hooks/queries/auth';
import { useUsers } from '@/hooks/queries/users';
import {
  FLAT_INPUT,
  FLAT_SELECT_TRIGGER,
  GREEN_UNDERLINE,
  NO_FIELD_BORDER,
} from '@/theme/fieldStyles';
import { playWoosh } from '@/lib/sounds';
import { LABEL_BG_CLASS, LABEL_PILL } from '@/theme/labelColors';
import { actionPill, blockBox, outlineControl } from '@/theme/styleConstants';
import { SecondaryButton } from '@/components/common/SecondaryButton';
import { strings } from '@/strings/pt-BR';

import { LabelPicker } from './LabelPicker';
import { RoutineAttachments } from './RoutineAttachments';
import { emptyChecklist, RoutineChecklist } from './RoutineChecklist';
import { isNotesEmpty, RichNotes } from './RichNotes';

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

const PROPERTY_LIST = 'flex flex-col';

/**
 * A property row shares the action-pill row's three columns: the label sits in
 * the first, the value starts at the head of the second. Values therefore begin
 * on the middle pill's left edge — near their labels rather than stranded
 * against the far side of the dialog.
 */
const PROPERTY_ROW = 'grid grid-cols-3 items-center gap-2 py-1';

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
const BARE_TRIGGER = `${FLAT_SELECT_TRIGGER} ${NO_FIELD_BORDER} h-8 w-[calc(100%+0.5rem)] items-center gap-1 pr-6 pl-0 text-left`;

/**
 * Outside edit mode the control stays in place but stops being one: no pointer
 * affordance, and none of HeroUI's dimming, since the value still has to read
 * as the routine's actual content rather than as a disabled field.
 */
const VIEW_TRIGGER =
  'cursor-default disabled:opacity-100 data-[disabled=true]:opacity-100';

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
const LABEL_ICON = 'size-4 shrink-0 text-muted';

/**
 * Everything under the title lines up with the start of its green rule, which
 * is the title icon's width (size-5) plus the gap between them.
 */
const TITLE_INDENT = 'pl-7';

/** How long after the last edit an autosave fires. */
const AUTOSAVE_DELAY_MS = 800;

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
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Present when editing; omitted when creating. */
  routine?: RoutineDto;
}) {
  const { data: me } = useMe();
  const { data: users = [] } = useUsers();
  const createRoutine = useCreateRoutine();
  const updateRoutine = useUpdateRoutine();
  const deleteRoutine = useDeleteRoutine();

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
    setEditing(!routine);
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
    // autosaving one would litter the list with untitled routines.
    if (!routine || !canSubmit) return;
    const serialised = JSON.stringify(payload);
    if (serialised === savedRef.current) return;

    savedRef.current = serialised;
    updateRoutine.mutate({ id: routine.id, ...payload });
  }, [routine, canSubmit, payload, updateRoutine]);

  // Autosave: every edit persists on its own shortly after you stop making it,
  // so closing the dialog — by any route — never loses work.
  useEffect(() => {
    if (!isOpen || !routine) return;
    const timer = setTimeout(saveIfDirty, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isOpen, routine, saveIfDirty]);

  /** Flushes anything the debounce hasn't written yet, then closes. */
  function handleClose() {
    saveIfDirty();
    onClose();
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
    playWoosh();
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
          <Modal.CloseTrigger onPress={handleClose} />
          <Modal.Header>
            {/* The dialog still needs a name for screen readers; the routine's
                own title carries it visually, so this one is hidden. */}
            <Modal.Heading className="sr-only">
              {routine ? strings.common.edit : strings.routine.addRoutine}
            </Modal.Heading>

            {/* The actions take the header row, sharing it with the dialog's
                close button. Only a saved routine has a link to copy or anything
                to delete. */}
            <div className="flex flex-wrap items-center gap-1 pr-8">
              {routine ? (
                <>
                  <Button variant="ghost" size="sm" className="text-muted" onPress={copyLink}>
                    <Link2 className="size-4" />
                    {strings.routine.copyLink}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted"
                    isDisabled={deleteRoutine.isPending}
                    onPress={handleDelete}
                  >
                    <Trash2 className="size-4" />
                    {strings.routine.deleteRoutine}
                  </Button>
                </>
              ) : null}

              {/* One button, two states: it unlocks the form, then commits it.
                  Primary while editing, because at that point it is the only
                  thing left to do. */}
              {isEditing ? (
                <Button
                  size="sm"
                  className="rounded-full"
                  isDisabled={!canSubmit || createRoutine.isPending || updateRoutine.isPending}
                  onPress={handleSubmit}
                >
                  {strings.common.save}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted"
                  onPress={() => setEditing(true)}
                >
                  <Pencil className="size-4" />
                  {strings.common.edit}
                </Button>
              )}
            </div>
          </Modal.Header>

          {/* Fades the scroll edges so long content doesn't end in a hard white
              cut at the dialog's margins. A mask rather than an overlay, so it
              tracks the body's own padding and needs no extra element. */}
          {/* overflow-x-hidden because the property controls overhang their
              column by the chevron's 8px inset (see BARE_TRIGGER), and that
              overhang propagates up as a horizontal scrollbar. The 8px lands
              inside the body's own right padding, so nothing visible is clipped
              — and a vertical form should never scroll sideways anyway. */}
          <Modal.Body className="flex flex-col gap-4 overflow-x-hidden pr-7 pb-6 [mask-image:linear-gradient(to_bottom,transparent_0,black_1.25rem,black_calc(100%-1.25rem),transparent_100%)]">
            {/* Underline, not a box: the title is the one thing you always type,
                so it reads as a line to write on rather than another form field.
                Green rule, the same marker the checklist title uses. */}
            <div className="flex items-center gap-2">
              <CircleCheck className="size-5 shrink-0 text-muted" aria-hidden />
              <TextField
                aria-label={strings.routine.titleLabel}
                value={form.description}
                onChange={(description) => set('description', description)}
                isReadOnly={!isEditing}
                className="min-w-0 flex-1"
              >
                <Input
                  fullWidth
                  placeholder={strings.routine.titleLabel}
                  className={`${FLAT_INPUT} ${GREEN_UNDERLINE} text-lg font-medium`}
                />
              </TextField>
            </div>

            {/* Everything below the title starts where the title's green rule
                does — icon width plus its gap — so the icon owns its column and
                nothing sits underneath it. */}
            <div className={`flex flex-col gap-4 ${TITLE_INDENT}`}>
              <SelectedLabels ids={form.labelIds} />

              {/* One property per row — label on the left, value on the right —
                  rather than three columns: the values are short, and stacking
                  them keeps the whole set scannable at a glance. */}
              <div className={PROPERTY_LIST}>
                

              <Select
                isDisabled={!isEditing}
                value={form.recurrence}
                onChange={(key) => set('recurrence', String(key) as RoutineRecurrence)}
              >
                <div className={PROPERTY_ROW}>
                  <Label className={FIELD_LABEL}>
                    <Repeat className={LABEL_ICON} aria-hidden />
                    {strings.routine.recurrenceLabel}
                  </Label>
                  <div className={VALUE_CELL}>
                    <Select.Trigger className={`${BARE_TRIGGER} ${isEditing ? "" : VIEW_TRIGGER}`}>
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
                  value={String(form.weekday)}
                  onChange={(key) => set('weekday', Number(key))}
                >
                  <div className={PROPERTY_ROW}>
                    <Label className={FIELD_LABEL}>
                      <CalendarDays className={LABEL_ICON} aria-hidden />
                      {strings.routine.weekdayLabel}
                    </Label>
                    <div className={VALUE_CELL}>
                      <Select.Trigger className={`${BARE_TRIGGER} ${isEditing ? "" : VIEW_TRIGGER}`}>
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
                  value={String(form.dayOfMonth)}
                  onChange={(key) => set('dayOfMonth', Number(key))}
                >
                  <div className={PROPERTY_ROW}>
                    <Label className={FIELD_LABEL}>
                      <CalendarDays className={LABEL_ICON} aria-hidden />
                      {strings.routine.dayOfMonthLabel}
                    </Label>
                    <div className={VALUE_CELL}>
                      <Select.Trigger className={`${BARE_TRIGGER} ${isEditing ? "" : VIEW_TRIGGER}`}>
                        <Select.Value />
                        {isEditing ? <Select.Indicator /> : null}
                      </Select.Trigger>
                    </div>
                  </div>
                  <Select.Popover className={SELECT_POPOVER}>
                    <ListBox>
                      {MONTH_DAYS.map((day) => (
                        <ListBox.Item key={day} id={String(day)} textValue={String(day)}>
                          {day}
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
                  value={form.assigneeIds}
                onChange={(keys) => set('assigneeIds', (keys as (string | number)[]).map(String))}
              >
                <div className={PROPERTY_ROW}>
                  <Label className={FIELD_LABEL}>
                    <UserRound className={LABEL_ICON} aria-hidden />
                    {strings.routine.assigneeLabel}
                  </Label>
                  <div className={VALUE_CELL}>
                    <Select.Trigger className={`${BARE_TRIGGER} ${isEditing ? "" : VIEW_TRIGGER}`}>
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
                <SquareCheckBig className="size-4" />
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

            {/* Notes wear the same outlined box and the same header row as the
                checklist and attachment blocks, so the three read as one family.
                The name is fixed here, so it is text rather than a field. */}
            <section className={blockBox}>
              <RichNotes
                isEditing={isEditing}
                value={form.notes}
                onChange={(notes) => set('notes', notes)}
                placeholder={strings.routine.notesPlaceholder}
                title={
                  <>
                    <NotepadText className="size-4 shrink-0 text-muted" aria-hidden />
                    <span className="flex-1 text-sm font-medium text-foreground">
                      {strings.routine.notesTitle}
                    </span>
                  </>
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
            </section>

            {form.checklists.map((checklist, index) => (
              // Index keys: checklists are only appended and removed, never
              // reordered, so position is a stable identity here.
              // eslint-disable-next-line react/no-array-index-key
              <div key={index} id={checklistAnchor(index)}>
                <RoutineChecklist
                  isEditing={isEditing}
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
                    attachments={form.attachments}
                    onChange={(attachments) => set('attachments', attachments)}
                    onDelete={() => set('attachments', null)}
                  />
                </div>
              ) : null}
            </div>
          </Modal.Body>

          {/* Copiar link / Deletar / Editar live in the header now, so the
              footer is only ever the close-or-commit pair. */}
          <Modal.Footer className="justify-end gap-2">
            <SecondaryButton slot="close">{strings.common.cancel}</SecondaryButton>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** The labels currently ticked in the picker, shown as the pills they will be. */
function SelectedLabels({ ids }: { ids: string[] }) {
  const { data: labels = [] } = useLabels();
  const selected = labels.filter((label) => ids.includes(label.id));

  if (selected.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
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
