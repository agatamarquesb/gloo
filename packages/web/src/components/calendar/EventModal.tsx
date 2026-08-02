import { useMemo, useState } from 'react';
import { Button, Input, Label, ListBox, Modal, Select } from '@heroui/react';
import { TextField } from 'react-aria-components';

import {
  countOtherAttendees,
  EventRecurrence,
  type AgendaDto,
  type CalendarEventDto,
  type CreateEventInput,
} from '@gloo/shared';

import { AppCheckbox } from '@/components/common/AppCheckbox';
import { DateField } from '@/components/common/DateField';
import { RedButton } from '@/components/common/RedButton';
import { SecondaryButton } from '@/components/common/SecondaryButton';
import { NotesBlock } from '@/components/common/NotesBlock';
import { useMe } from '@/hooks/queries/auth';
import { useCreateEvent, useDeleteEvent, useUpdateEvent } from '@/hooks/queries/calendar';
import { useUsers } from '@/hooks/queries/users';
import { listboxPopover } from '@/theme/fieldStyles';
import { dialogFooter, dialogPadding, dialogShape } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

import { ConfirmEventChangeModal, type EventChangeChoice } from './ConfirmEventChangeModal';

const RECURRENCES: EventRecurrence[] = [
  EventRecurrence.DAILY,
  EventRecurrence.WEEKLY,
  EventRecurrence.BIWEEKLY,
  EventRecurrence.MONTHLY,
];

/** The "não se repete" option needs a key, and empty string is not selectable. */
const NO_RECURRENCE = 'NONE';

interface FormState {
  title: string;
  agendaId: string;
  /** Local calendar date, `YYYY-MM-DD`, as DateField speaks. */
  date: string;
  /** Local wall-clock times, `HH:MM`, as `<input type="time">` speaks. */
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  location: string;
  description: string;
  assigneeIds: string[];
  recurrence: EventRecurrence | typeof NO_RECURRENCE;
  recurrenceUntil: string;
  /** Weekdays a weekly series lands on, 0=Sunday … 6=Saturday. */
  byWeekdays: number[];
}

/** Local date and time back into an instant. */
function toInstant(date: string, time: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

/** The UTC midnight after a `YYYY-MM-DD`, which is an all-day event's exclusive end. */
function nextUtcMidnight(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString();
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** And an instant into the two local fields the form edits. */
function splitInstant(iso: string): { date: string; time: string } {
  const local = new Date(iso);
  return {
    date: `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`,
    time: `${pad(local.getHours())}:${pad(local.getMinutes())}`,
  };
}

function toFormValue(event: CalendarEventDto | null, defaults: { agendaId: string; start: Date }): FormState {
  if (!event) {
    const start = splitInstant(defaults.start.toISOString());
    const end = splitInstant(new Date(defaults.start.getTime() + 60 * 60_000).toISOString());
    return {
      title: '',
      agendaId: defaults.agendaId,
      date: start.date,
      startTime: start.time,
      endTime: end.time,
      isAllDay: false,
      location: '',
      description: '',
      assigneeIds: [],
      recurrence: NO_RECURRENCE,
      recurrenceUntil: '',
      byWeekdays: [],
    };
  }

  const start = splitInstant(event.startsAt);
  const end = splitInstant(event.endsAt);
  return {
    title: event.title,
    agendaId: event.agendaId,
    // Same reason as toPayload: an all-day date is stored in UTC and must be
    // read back in UTC, or editing one in a western zone moves it a day earlier.
    date: event.isAllDay ? event.startsAt.slice(0, 10) : start.date,
    startTime: start.time,
    endTime: end.time,
    isAllDay: event.isAllDay,
    location: event.location ?? '',
    description: event.description ?? '',
    assigneeIds: event.assignees.map((user) => user.id),
    recurrence: event.recurrence ?? NO_RECURRENCE,
    recurrenceUntil: event.recurrenceUntil ? splitInstant(event.recurrenceUntil).date : '',
    byWeekdays: event.byWeekdays,
  };
}

function toPayload(form: FormState): CreateEventInput {
  return {
    agendaId: form.agendaId,
    title: form.title.trim(),
    description: form.description || null,
    location: form.location.trim() || null,
    // An all-day event is a floating date, so it is stored as UTC midnight to
    // the *next* UTC midnight — Google's own convention, and what keeps "the
    // 8th" the 8th for a reader in any zone. A local 00:00–23:59 span would be
    // an instant range, and would slide onto the wrong day when read back.
    startsAt: form.isAllDay ? `${form.date}T00:00:00.000Z` : toInstant(form.date, form.startTime),
    endsAt: form.isAllDay ? nextUtcMidnight(form.date) : toInstant(form.date, form.endTime),
    isAllDay: form.isAllDay,
    // The zone the event is authored in, which is what keeps a series on its own
    // wall clock later. Not how it is displayed — see formatEventTime.
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    assigneeIds: form.assigneeIds,
    recurrence: form.recurrence === NO_RECURRENCE ? null : form.recurrence,
    // Blank means "no end date", which is now a real answer rather than an
    // unfinished form — most Google series are open-ended.
    recurrenceUntil: form.recurrence === NO_RECURRENCE ? null : form.recurrenceUntil || null,
    byWeekdays: isWeekly(form.recurrence) ? form.byWeekdays : [],
  };
}

/** Only a weekly rule can name its own days. */
function isWeekly(recurrence: FormState['recurrence']): boolean {
  return recurrence === EventRecurrence.WEEKLY || recurrence === EventRecurrence.BIWEEKLY;
}

/**
 * Create and edit, in one dialog.
 *
 * Unlike the task and routine modals this one commits on Salvar rather than
 * autosaving: an event that repeats can't be written until the user has said
 * whether the change is for one occurrence or all of them, and a dialog that
 * saved as you typed would have to ask that question on every keystroke.
 */
export function EventModal({
  isOpen,
  event,
  agendas,
  defaultAgendaId,
  defaultStart,
  googleAgendaIds,
  onClose,
}: {
  isOpen: boolean;
  /** Null when creating. */
  event: CalendarEventDto | null;
  agendas: AgendaDto[];
  defaultAgendaId: string;
  defaultStart: Date;
  /** Agenda ids that mirror to Google — the only ones that can email anyone. */
  googleAgendaIds: Set<string>;
  onClose: () => void;
}) {
  const { data: users = [] } = useUsers();
  const { data: me } = useMe();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const [form, setForm] = useState<FormState>(() =>
    toFormValue(event, { agendaId: defaultAgendaId, start: defaultStart }),
  );
  const [confirming, setConfirming] = useState<'edit' | 'delete' | null>(null);

  // Re-seed when the dialog is pointed at a different event. Keyed on the id
  // rather than the object so a refetch that returns an equal-but-new event
  // doesn't wipe what is being typed.
  const seedKey = event ? `${event.id}|${event.originalStart ?? ''}` : 'new';
  const [seededFor, setSeededFor] = useState(seedKey);
  if (seededFor !== seedKey) {
    setSeededFor(seedKey);
    setForm(toFormValue(event, { agendaId: defaultAgendaId, start: defaultStart }));
  }

  // Only agendas that can actually take an event: the shared inbox holds other
  // people's, and a read-only Google calendar would reject the write.
  const writableAgendas = useMemo(
    () => agendas.filter((agenda) => !agenda.isShared && !agenda.isReadOnly),
    [agendas],
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const endsBeforeStart = !form.isAllDay && form.endTime < form.startTime;
  const canSubmit = Boolean(form.title.trim()) && !endsBeforeStart;
  const isPending = createEvent.isPending || updateEvent.isPending || deleteEvent.isPending;

  const isSeries = Boolean(event?.recurrence);

  /**
   * How many people this save would email.
   *
   * Read off the *form* rather than the saved event, so adding a colleague and
   * pressing Salvar asks about the colleague you just added. Zero on a
   * Gloo-local agenda, which mirrors nowhere and so can send nothing.
   */
  const otherAttendees = googleAgendaIds.has(form.agendaId)
    ? countOtherAttendees({
        // A new event has no creator on record yet — it will be whoever is
        // filling this form in, and they must not count as someone to notify.
        createdById: event?.createdById ?? me?.id ?? '',
        assigneeIds: form.assigneeIds,
        externalAttendees: event?.externalAttendees ?? [],
      })
    : 0;

  /** Whether committing has to ask anything first. */
  const needsConfirm = isSeries || otherAttendees > 0;

  function save(choice: EventChangeChoice = { notify: false }) {
    const payload = toPayload(form);

    if (!event) {
      createEvent.mutate({ ...payload, notify: choice.notify }, { onSuccess: onClose });
      return;
    }

    updateEvent.mutate(
      {
        id: event.id,
        scope: choice.scope,
        originalStart: event.originalStart,
        notify: choice.notify,
        ...payload,
      },
      { onSuccess: onClose },
    );
  }

  function remove(choice: EventChangeChoice = { notify: false }) {
    if (!event) return;
    deleteEvent.mutate(
      {
        id: event.id,
        scope: choice.scope,
        originalStart: event.originalStart,
        notify: choice.notify,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
        <Modal.Container scroll="inside">
          <Modal.Dialog className={`sm:max-w-lg ${dialogShape} ${dialogPadding}`}>
            <Modal.Header className="p-0">
              <Modal.Heading className="text-lg font-semibold">
                {event ? strings.common.edit : strings.calendar.newEvent}
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-4 p-0 pt-3">
              <TextField
                aria-label={strings.calendar.event.titleLabel}
                value={form.title}
                onChange={(value) => set('title', value)}
                className="flex flex-col gap-1.5"
              >
                <Label className="text-sm font-medium text-foreground">
                  {strings.calendar.event.titleLabel}
                </Label>
                <Input fullWidth placeholder={strings.calendar.event.titlePlaceholder} />
              </TextField>

              <Select
                value={form.agendaId}
                onChange={(key) => set('agendaId', String(key))}
              >
                <Label>{strings.calendar.event.agenda}</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover {...listboxPopover}>
                  <ListBox>
                    {writableAgendas.map((agenda) => (
                      <ListBox.Item key={agenda.id} id={agenda.id} textValue={agenda.name}>
                        {agenda.name}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>

              <div className="grid grid-cols-2 gap-4">
                <DateField
                  label={strings.calendar.event.date}
                  value={form.date}
                  onChange={(value) => set('date', value)}
                />
                <div className="flex items-end">
                  <AppCheckbox
                    isSelected={form.isAllDay}
                    onChange={(selected) => set('isAllDay', selected)}
                  >
                    {strings.calendar.event.allDay}
                  </AppCheckbox>
                </div>
              </div>

              {form.isAllDay ? null : (
                <div className="grid grid-cols-2 gap-4">
                  {/* A native time input rather than a hand-built picker: it is
                      the one control this dialog needs that HeroUI has no part
                      for, and the platform's own is keyboard- and
                      locale-correct everywhere. Wrapped in the app's usual
                      TextField + Label so it still sits on the same grid as the
                      fields around it. */}
                  <TextField
                    aria-label={strings.calendar.event.startsAt}
                    value={form.startTime}
                    onChange={(value) => set('startTime', value)}
                    className="flex flex-col gap-1.5"
                  >
                    <Label className="text-sm font-medium text-foreground">
                      {strings.calendar.event.startsAt}
                    </Label>
                    <Input fullWidth type="time" />
                  </TextField>

                  <TextField
                    aria-label={strings.calendar.event.endsAt}
                    value={form.endTime}
                    onChange={(value) => set('endTime', value)}
                    className="flex flex-col gap-1.5"
                  >
                    <Label className="text-sm font-medium text-foreground">
                      {strings.calendar.event.endsAt}
                    </Label>
                    <Input fullWidth type="time" />
                    {endsBeforeStart ? (
                      <span className="text-xs text-danger">
                        {strings.calendar.event.endBeforeStart}
                      </span>
                    ) : null}
                  </TextField>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Select
                  value={form.recurrence}
                  onChange={(key) => set('recurrence', String(key) as FormState['recurrence'])}
                >
                  <Label>{strings.calendar.details.repeats}</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover {...listboxPopover}>
                    <ListBox>
                      <ListBox.Item
                        id={NO_RECURRENCE}
                        textValue={strings.calendar.recurrence.none}
                      >
                        {strings.calendar.recurrence.none}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      {RECURRENCES.map((recurrence) => (
                        <ListBox.Item
                          key={recurrence}
                          id={recurrence}
                          textValue={strings.calendar.recurrence[recurrence]}
                        >
                          {strings.calendar.recurrence[recurrence]}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>

                {/* Optional: left blank the series simply never ends, which is
                    what Google's own default produces. */}
                {form.recurrence === NO_RECURRENCE ? null : (
                  <div className="flex flex-col gap-1">
                    <DateField
                      label={strings.calendar.recurrence.until}
                      value={form.recurrenceUntil}
                      onChange={(value) => set('recurrenceUntil', value)}
                    />
                    {form.recurrenceUntil ? (
                      <button
                        type="button"
                        className="self-start text-xs text-muted underline"
                        onClick={() => set('recurrenceUntil', '')}
                      >
                        {strings.calendar.recurrence.noEnd}
                      </button>
                    ) : (
                      <span className="text-xs text-muted">
                        {strings.calendar.recurrence.noEnd}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Which days a weekly series lands on. Blank means "the same day
                  it starts on", so an untouched picker behaves exactly as the
                  plain weekly rule did before this existed. */}
              {isWeekly(form.recurrence) ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">
                    {strings.calendar.recurrence.onDays}
                  </span>
                  <div className="flex gap-1">
                    {strings.calendar.recurrence.weekdayInitials.map((initial, weekday) => {
                      const active = form.byWeekdays.includes(weekday);
                      return (
                        <button
                          key={strings.calendar.recurrence.weekdayNames[weekday]}
                          type="button"
                          aria-pressed={active}
                          aria-label={strings.calendar.recurrence.weekdayNames[weekday]}
                          onClick={() =>
                            set(
                              'byWeekdays',
                              active
                                ? form.byWeekdays.filter((day) => day !== weekday)
                                : [...form.byWeekdays, weekday].toSorted((a, b) => a - b),
                            )
                          }
                          className={`size-8 rounded-full text-xs transition-colors ${
                            active
                              ? 'bg-accent text-accent-foreground'
                              : 'border border-outline-control text-muted hover:text-foreground'
                          }`}
                        >
                          {initial}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <TextField
                aria-label={strings.calendar.event.location}
                value={form.location}
                onChange={(value) => set('location', value)}
                className="flex flex-col gap-1.5"
              >
                <Label className="text-sm font-medium text-foreground">
                  {strings.calendar.event.location}
                </Label>
                <Input fullWidth placeholder={strings.calendar.event.locationPlaceholder} />
              </TextField>

              <Select
                selectionMode="multiple"
                value={form.assigneeIds}
                onChange={(keys) =>
                  set('assigneeIds', (keys as (string | number)[]).map(String))
                }
              >
                <Label>{strings.calendar.event.team}</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover {...listboxPopover}>
                  <ListBox selectionMode="multiple">
                    {users.map((user) => (
                      <ListBox.Item key={user.id} id={user.id} textValue={user.name}>
                        {user.name}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>

              <NotesBlock
                value={form.description}
                onChange={(html) => set('description', html)}
                placeholder={strings.calendar.event.description}
                title={strings.calendar.event.description}
                isEditing
                compact
              />
            </Modal.Body>

            <Modal.Footer className={`${dialogFooter} flex items-center justify-between gap-2`}>
              {event ? (
                <RedButton
                  isDisabled={isPending}
                  onPress={() => (needsConfirm ? setConfirming('delete') : remove())}
                >
                  {strings.common.delete}
                </RedButton>
              ) : (
                <span />
              )}

              <span className="flex gap-2">
                <SecondaryButton slot="close">{strings.common.cancel}</SecondaryButton>
                <Button
                  variant="primary"
                  isDisabled={!canSubmit || isPending}
                  onPress={() => (needsConfirm ? setConfirming('edit') : save())}
                >
                  {strings.common.save}
                </Button>
              </span>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <ConfirmEventChangeModal
        isOpen={confirming !== null}
        intent={confirming ?? 'edit'}
        isRecurring={isSeries}
        otherAttendees={otherAttendees}
        onClose={() => setConfirming(null)}
        onConfirm={(choice) => {
          const intent = confirming;
          setConfirming(null);
          if (intent === 'delete') remove(choice);
          else save(choice);
        }}
      />
    </>
  );
}
