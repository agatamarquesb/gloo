import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  Clock,
  Link2,
  MapPin,
  Pencil,
  Repeat,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { Button, Input, Label, ListBox, Modal, Popover, Select } from '@heroui/react';
// react-aria's own Button for the colour, not HeroUI's: HeroUI's carries a
// ground, a radius and a hover fill, and all three are exactly what a bare
// property value must not have.
import { Button as AriaButton, TextField } from 'react-aria-components';

import {
  CalendarItemKind,
  countOtherAttendees,
  EventRecurrence,
  GOOGLE_EVENT_COLORS,
  GOOGLE_EVENT_COLOR_IDS,
  type AgendaDto,
  type CalendarEventDto,
  type CreateEventInput,
  type PaletteColor,
} from '@gloo/shared';

import { AppCheckbox } from '@/components/common/AppCheckbox';
import {
  ColorPicker,
  SECTION_TITLE,
  SWATCH_COMPACT,
  SWATCH_SELECTED,
} from '@/components/common/ColorPicker';
import { AssigneeValue } from '@/components/common/AssigneeValue';
import { CalendarAgendaGlyph, CalendarDayGlyph } from '@/components/common/CalendarGlyph';
import { DatePropertyValue } from '@/components/common/DatePropertyValue';
import { UserAvatar } from '@/components/common/UserAvatar';
import { SecondaryButton } from '@/components/common/SecondaryButton';
import { NotesBlock } from '@/components/common/NotesBlock';
import { useMe } from '@/hooks/queries/auth';
import { useCreateEvent, useDeleteEvent, useUpdateEvent } from '@/hooks/queries/calendar';
import { useUsers } from '@/hooks/queries/users';
import { eventLink } from '@/lib/calendarLink';
import { playSound } from '@/lib/sounds';
import { colorFill } from '@/theme/labelColors';
import {
  FIELD_PANEL,
  FLAT_INPUT,
  FLAT_SELECT_TRIGGER,
  LISTBOX_FLUSH,
  NO_FIELD_BORDER,
  OPEN_FIELD_FILL,
  PANEL_MATCHES_TRIGGER,
  TEXT_LISTBOX_ITEM,
  listboxPopover,
} from '@/theme/fieldStyles';
// The property list is the one both entity dialogs open with — see
// theme/propertyRow.ts, which is where every class in it comes from.
import {
  EMPTY_VALUE,
  LABEL_ICON,
  PROPERTY_LIST,
  PROPERTY_ROW_PITCH,
  PROPERTY_ROW_SPLIT,
  PROPERTY_VALUE,
  TRIGGER_HUGS,
  VALUE_CELL,
  VIEW_TRIGGER,
  propertyStyles,
} from '@/theme/propertyRow';
import {
  TITLE_FIELD,
  dialogClose,
  dialogFooter,
  dialogPadding,
  dialogSection,
  dialogShape,
  menuRow,
  modalDivider,
  modalDividerGap,
  quietTextButton,
} from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

import { ConfirmEventChangeModal, type EventChangeChoice } from './ConfirmEventChangeModal';
import { ConfirmLabelLossModal } from './ConfirmLabelLossModal';

const RECURRENCES: EventRecurrence[] = [
  EventRecurrence.DAILY,
  EventRecurrence.WEEKLY,
  EventRecurrence.BIWEEKLY,
  EventRecurrence.MONTHLY,
];

/** The "não se repete" option needs a key, and empty string is not selectable. */
const NO_RECURRENCE = 'NONE';

/**
 * The head of the dialog: the title, what kind of thing it is, and the air that
 * holds the pair off the first property.
 *
 * The numbers are the other two dialogs' — 10px from the header's rule down to
 * the title and 8px from the block down to the properties — because this is the
 * same object seen a third time. See HEADER_ROW in RoutineModal.
 */
const HEADER_STACK = 'flex flex-col gap-0.5 pb-2';

/**
 * What the date's calendar opens at — the task dialog's own panel width, since
 * it is the same month in the same kind of column. See PROPERTY_PANEL there.
 */
const PROPERTY_PANEL = 'w-[171.5px]';

/**
 * The colour panel, which is as wide as the widest line inside it and no wider —
 * six swatches across, or the row at the foot that keeps the agenda's own
 * colour. See SWATCH_COMPACT.
 */
const COLOR_PANEL = 'w-fit';

/** The colour itself, as a value in the property list: a small square. */
const COLOR_SWATCH = 'size-3.5 shrink-0 rounded-sm';

/**
 * The two rows a recurrence opens — until when, and on which days.
 *
 * They are not properties of the event, they are the rest of one property's
 * answer, so they say so the way a nested list does: no icon of their own, a
 * short rule where the icon would be, and the whole row stepped in to start on
 * the word above it rather than on its glyph. The inset is exactly the icon plus
 * its gap, which is where "Repete" itself begins.
 */
const SUB_ROW_INSET = 'pl-6';
const SUB_ROW_MARK = 'h-4 w-[3px] shrink-0 rounded-full bg-border';

/**
 * The agenda's trigger, which is the one in this dialog that does not take the
 * value column's width: it is a column of its own, with the card's colour in a
 * second one beside it. A fixed 176px — wide enough for the agenda names in
 * front of it, and fixed so the colour beside it starts on the same line
 * whichever agenda is chosen.
 *
 * Composed here rather than taken from propertyStyles because of the one thing
 * it must *not* have: the 8px the shared trigger insets itself by while open
 * (see OPEN_FIELD_GROUND). That inset is free on a full-width trigger and costs
 * a hugging one exactly 8px of its value, which is a name losing its last two
 * letters the moment the list is opened. The ground it keeps — the fill and the
 * squared-off bottom — is what says the panel below belongs to it.
 */
const AGENDA_TRIGGER = [
  FLAT_SELECT_TRIGGER,
  NO_FIELD_BORDER,
  OPEN_FIELD_FILL,
  'aria-expanded:rounded-t-md aria-expanded:rounded-b-none',
  'w-44 shrink-0 gap-1 p-0 text-left',
].join(' ');

/**
 * The location as an address, or null when it is a place rather than a link.
 *
 * Two shapes count: something already written as a URL, and a bare host with at
 * least one dot in it — "meet.google.com/abc-defg", which is what most of these
 * actually are. Anything else is a room, a street, a floor, and stays text.
 */
function linkFor(location: string): string | null {
  const text = location.trim();
  if (!text || /\s/.test(text)) return null;
  if (/^https?:\/\//i.test(text)) return text;
  return /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(text) ? `https://${text}` : null;
}

/** A time as `HH:MM`, 24-hour, that a clock could actually show. */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * One end of the event's hours, typed rather than picked.
 *
 * `<input type="time">` is what this was, and it brought two things the property
 * column cannot have: a clock glyph inside the value, and a dropdown of its own
 * over a row whose other values open lists. So it is a text field that only
 * accepts a time — digits, with the colon written in as you pass it, and
 * anything impossible pulled back to the nearest hour or minute that exists when
 * the field is left.
 *
 * The draft is held apart from the form so a half-typed "1" is not read as a
 * time: the form only hears complete ones, and whatever is left incomplete falls
 * back to the value that was already there.
 */
function TimeInput({
  value,
  onChange,
  label,
}: {
  /** `HH:MM`. */
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  function type(next: string) {
    const digits = next.replace(/\D/g, '').slice(0, 4);
    const text = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
    setDraft(text);
    if (TIME_PATTERN.test(text)) onChange(text);
  }

  /** Leaving the field settles it: a complete time, clamped, or what it was. */
  function commit() {
    const digits = (draft ?? '').replace(/\D/g, '');
    setDraft(null);
    if (digits.length < 4) return;
    const hours = Math.min(23, Number(digits.slice(0, 2)));
    const minutes = Math.min(59, Number(digits.slice(2)));
    onChange(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={5}
      aria-label={label}
      placeholder="--:--"
      value={draft ?? value}
      onChange={(event) => type(event.target.value)}
      onBlur={commit}
      // Flush with the column and with no chrome of its own, like every other
      // value in the list. Wide enough for "23:59" and no wider, so the two ends
      // read as one range rather than as two fields.
      //
      // Except while it holds the caret: the end being typed takes a ground of
      // its own, so the blinking caret has something to blink in and the other
      // end plainly is not it. The padding is given back as margin, so nothing
      // on the row moves as the ground appears.
      className={`-mx-1 w-[2.9rem] rounded-[4px] bg-transparent px-1 py-0 caret-foreground outline-none placeholder:text-muted focus:bg-default/60 ${PROPERTY_VALUE}`}
    />
  );
}

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
  /**
   * A colour for this card alone, or null for its agenda's.
   *
   * The extra colour, in Google's sense: the agenda's is what an event wears
   * unless it has been singled out, and this is the singling out. Null rather
   * than seeding it with the agenda's colour, so "the same as my agenda" keeps
   * meaning that when the agenda is later recoloured.
   */
  color: PaletteColor | null;
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
      color: null,
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
    color: event.color,
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
    color: form.color,
  };
}

/** Only a weekly rule can name its own days. */
function isWeekly(recurrence: FormState['recurrence']): boolean {
  return recurrence === EventRecurrence.WEEKLY || recurrence === EventRecurrence.BIWEEKLY;
}

/**
 * The colours an event on a Google agenda may take: Google's own eleven.
 *
 * Deliberately not the app's open palette, which is what an event on a Gloo
 * agenda still gets. `colorId` is the only colour field on an event that Google
 * lets anything write, so these eleven are exactly the colours that can be true
 * in both calendars at once — pick one here and the card changes over there too,
 * and vice versa. Offering the wider palette would be offering colours that
 * silently stop at our own edge.
 *
 * Google's own event labels, which is the other way a card gets a colour over
 * there, cannot be offered at all: the API hands back an opaque id with no
 * colour attached and ignores the field on write. An event wearing one shows
 * here in its agenda's colour.
 */
function GoogleColorPicker({
  value,
  onChange,
}: {
  value: PaletteColor | null;
  onChange: (color: PaletteColor) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className={SECTION_TITLE}>{strings.color.palette}</span>
      {/* Six across rather than the app picker's five: eleven colours come out
          as two rows and a stray, and six leaves five and six. The same small
          square the app's own picker uses in this panel — see SWATCH_COMPACT. */}
      <div className="grid w-fit grid-cols-6 gap-1">
        {GOOGLE_EVENT_COLOR_IDS.map((id) => {
          const hex = GOOGLE_EVENT_COLORS[id];
          return (
            <button
              key={id}
              type="button"
              aria-label={strings.calendar.event.googleColorNames[id] ?? id}
              title={strings.calendar.event.googleColorNames[id]}
              aria-pressed={value === hex}
              onClick={() => onChange(hex)}
              {...colorFill(hex, `${SWATCH_COMPACT} ${value === hex ? SWATCH_SELECTED : ''}`)}
            />
          );
        })}
      </div>
    </div>
  );
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
  /**
   * Whether the dialog is a form or a page.
   *
   * The same two states the task and routine dialogs have: opening an event
   * *shows* it, and "Editar" in the header unlocks it. A new one skips that —
   * it is a form and nothing else, since there is nothing yet to look at.
   */
  const [isEditing, setEditing] = useState(!event);
  /**
   * Whether the caret is in the title.
   *
   * The title is bold — it is what the event is called — and a bold field being
   * typed into looks like a heading that has started moving. So it drops to a
   * plain weight while it holds the caret and goes back to bold the moment it
   * loses it. See the same note in TaskModal.
   */
  const [isTitleFocused, setTitleFocused] = useState(!event);
  /**
   * A colour waiting on the label warning, or null when nothing is waiting.
   *
   * Wrapped in an object rather than held as a bare colour, because the colour
   * itself may legitimately be `null` — "Cor da agenda" is an answer, and it
   * costs the label exactly as any other does. The wrapper is what tells "the
   * user chose to clear it" from "nothing is pending".
   *
   * Held rather than applied, because the warning is the choice — see
   * ConfirmLabelLossModal. Confirming applies it; cancelling drops it and the
   * form is untouched.
   */
  const [pendingColor, setPendingColor] = useState<{ color: PaletteColor | null } | null>(null);
  /**
   * Whether the warning has already been answered while this dialog has been
   * open. Asked once: having said yes, being asked again on the way to trying a
   * second colour is the dialog not listening.
   */
  const [labelLossAccepted, setLabelLossAccepted] = useState(false);
  /**
   * Whether the colour panel is open.
   *
   * Held here rather than left to the Popover because choosing a colour has to
   * close it: a panel that stays up covers the warning dialog that a choice can
   * raise, and a confirmation you have to read around is not a confirmation.
   * Closing on every pick is also simply what a one-answer panel should do.
   */
  const [isColorOpen, setColorOpen] = useState(false);

  // Re-seed when the dialog is pointed at a different event. Keyed on the id
  // rather than the object so a refetch that returns an equal-but-new event
  // doesn't wipe what is being typed.
  const seedKey = event ? `${event.id}|${event.originalStart ?? ''}` : 'new';
  const [seededFor, setSeededFor] = useState(seedKey);
  if (seededFor !== seedKey) {
    setSeededFor(seedKey);
    setForm(toFormValue(event, { agendaId: defaultAgendaId, start: defaultStart }));
    // A new event opens as a form, an existing one as a page — see `isEditing`.
    setEditing(!event);
  }

  /**
   * Unlocking the dialog puts the caret in the title, as if it had been pressed:
   * the title is what you came to change often enough that having to click it
   * first was a step for nothing. Locking takes it back out again.
   */
  useEffect(() => {
    setTitleFocused(isEditing);
  }, [isEditing]);

  // Only agendas that can actually take an event: the shared inbox holds other
  // people's, and a read-only Google calendar would reject the write.
  const writableAgendas = useMemo(
    () => agendas.filter((agenda) => !agenda.isShared && !agenda.isReadOnly),
    [agendas],
  );

  const assignees = useMemo(
    () => users.filter((user) => form.assigneeIds.includes(user.id)),
    [users, form.assigneeIds],
  );

  /**
   * What the swatch shows when the event has no colour of its own — read off the
   * agenda the *form* names, so changing the agenda changes it without saving.
   */
  const agendaColor: PaletteColor =
    agendas.find((agenda) => agenda.id === form.agendaId)?.color ?? 'gray';

  /**
   * Whether choosing a colour here would destroy something.
   *
   * Only on a Google agenda, only while Google is still holding a label, and
   * only until the warning has been answered once. See ConfirmLabelLossModal for
   * why the two cannot coexist.
   */
  const wouldLoseLabel =
    Boolean(event?.hasGoogleLabel) && googleAgendaIds.has(form.agendaId) && !labelLossAccepted;

  /** Every way the colour is set goes through here, so the gate cannot be skipped. */
  function chooseColor(color: PaletteColor | null) {
    setColorOpen(false);
    if (wouldLoseLabel) {
      // Null is a colour too as far as Google is concerned: clearing writes an
      // empty colorId, which costs the label exactly as setting one does.
      setPendingColor({ color });
      return;
    }
    set('color', color);
  }

  /**
   * The property rows, in the shape the task dialog gives its own: a fixed label
   * column, air rather than a height, and a bare trigger with no chevron. See
   * propertyStyles, and PROPERTY_ROW_SPLIT for why the labels are a column and
   * not a third of the dialog.
   *
   * `fluid` because two rows hold a control that wraps — the weekday picker and
   * the pair of time fields.
   */
  const PROPERTY_SHAPE = {
    row: PROPERTY_ROW_SPLIT,
    height: PROPERTY_ROW_PITCH,
    fluid: true,
    indicator: false,
  } as const;

  const { row, label: fieldLabel, undimmed } = propertyStyles(isEditing, PROPERTY_SHAPE);

  /**
   * The same trigger for the three values that do not own their row: the two
   * dates, which are followed by an answer of their own ("Dia inteiro", "Sem
   * fim"), and the agenda, which shares its line with the card's colour. Each
   * takes the width of its value instead of the column's — see TRIGGER_HUGS.
   */
  const { trigger: hugTrigger } = propertyStyles(isEditing, {
    ...PROPERTY_SHAPE,
    width: TRIGGER_HUGS,
  });

  /**
   * And the two lists whose options are three words at most — Repete and
   * Convidado. At the column's full width their panels were mostly air beside
   * "Semanalmente", so both the trigger and the panel that matches it come down
   * to half of it.
   */
  const { trigger: halfTrigger } = propertyStyles(isEditing, {
    ...PROPERTY_SHAPE,
    width: 'w-1/2',
  });

  /** The label of a row that belongs to the one above it — see SUB_ROW_MARK. */
  const subLabel = `${fieldLabel} ${SUB_ROW_INSET}`;

  /** Whether the location is somewhere you can go by pressing it. */
  const locationHref = linkFor(form.location);

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

  /** The event's own address, for the header's first action. */
  function copyLink() {
    if (!event) return;
    navigator.clipboard.writeText(eventLink(event.id, event.startsAt, window.location.origin));
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
            {/* The header the other two dialogs carry: what you can do to the
                event, then the way out, then the rule that closes the row off.
                No heading of its own — the event's name is the heading, exactly
                as a routine's title is in that dialog. */}
            <Modal.Header className={`flex flex-col ${dialogSection}`}>
              <Modal.Heading className="sr-only">
                {event ? strings.common.edit : strings.calendar.newEvent}
              </Modal.Heading>

              <div className="flex flex-wrap items-center gap-4">
                {/* Both of these need an event on the server: there is no
                    address to copy before one exists, and nothing to delete. */}
                {event ? (
                  <>
                    <button
                      type="button"
                      className={`${quietTextButton} text-sm font-medium`}
                      onClick={copyLink}
                    >
                      <Link2 className="size-4" />
                      {strings.calendar.event.copyLink}
                    </button>

                    <button
                      type="button"
                      className={`${quietTextButton} text-sm font-medium`}
                      disabled={isPending}
                      onClick={() => {
                        playSound('delete');
                        if (needsConfirm) setConfirming('delete');
                        else remove();
                      }}
                    >
                      <Trash2 className="size-4" />
                      {strings.calendar.event.deleteEvent}
                    </button>
                  </>
                ) : null}

                {/* Unlocks the dialog, then reports that it is unlocked — Salvar
                    is in the footer, so once you are editing there is nothing
                    left for this slot to do but say so. A new event is only ever
                    the second of those two: it opens unlocked and there is no
                    locked state to go back to. */}
                {isEditing ? (
                  <span className="flex items-center gap-1.5 text-sm font-medium text-muted">
                    <Pencil className="size-4" />
                    {strings.calendar.event.editing}
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

                <button
                  type="button"
                  className={dialogClose}
                  aria-label={strings.common.close}
                  onClick={onClose}
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className={`${modalDivider} ${modalDividerGap}`} />
            </Modal.Header>

            <Modal.Body className="flex flex-col p-0">
              {/* The title and what kind of thing it is, held off the properties
                  by the gap the task modal puts under its own title. */}
              <div className={HEADER_STACK}>
                {/* Locked, the event's name is a heading, not a field switched
                    off: a read-only Input still draws its own edge under the
                    cursor, which put a rule under a title nobody was editing.
                    The same is true of an unlocked dialog whose title nobody has
                    the caret in — see `isTitleFocused`. */}
                {isEditing && (isTitleFocused || !form.title) ? (
                  <TextField
                    aria-label={strings.calendar.event.titleLabel}
                    value={form.title}
                    onChange={(value) => set('title', value)}
                    className="w-full min-w-0"
                  >
                    {/* The field only exists because the dialog was just opened
                        on a new event, just unlocked, or the title was just
                        pressed — so the caret has to arrive with it. */}
                    <Input
                      fullWidth
                      // eslint-disable-next-line jsx-a11y/no-autofocus
                      autoFocus
                      placeholder={strings.calendar.event.titleLabel}
                      className={`${FLAT_INPUT} ${TITLE_FIELD} text-xl font-normal`}
                      // The caret lands after the last letter, not before the
                      // first: a focused input starts its selection at 0, which
                      // put the cursor at the head of a name you were about to
                      // add to.
                      //
                      // And the flag follows the caret rather than only the
                      // press that set it: the field is also what an unnamed
                      // event shows, so the first letter typed into one would
                      // otherwise turn it back into a heading mid-word.
                      onFocus={(focus) => {
                        setTitleFocused(true);
                        const end = focus.currentTarget.value.length;
                        focus.currentTarget.setSelectionRange(end, end);
                      }}
                      onBlur={() => setTitleFocused(false)}
                    />
                  </TextField>
                ) : (
                  <h2 className="min-w-0 truncate text-xl font-bold text-foreground">
                    {isEditing ? (
                      // Editing but not being typed in — where you land after
                      // clicking away from the title. Still the heading, and
                      // pressing it puts the caret back.
                      <button
                        type="button"
                        className="w-full cursor-text truncate text-left"
                        onClick={() => setTitleFocused(true)}
                      >
                        {form.title || strings.calendar.event.untitled}
                      </button>
                    ) : (
                      form.title || strings.calendar.event.untitled
                    )}
                  </h2>
                )}

                {/* What kind of thing this is, read off the row rather than
                    assumed: a Google task opens in this same dialog and calling
                    it an event here while the card behind it says "Tarefa" is
                    the dialog disagreeing with itself. Anything made *from* the
                    dialog is an event, which is what the fallback says.

                    A line under the title rather than a row in the list below:
                    it is not something you set, it is what you are looking at —
                    so it wears the title's subtitle instead of a label, icon and
                    value of its own. */}
                <span className="text-sm font-light text-muted/70">
                  {strings.dashboard.day.itemKind[event?.kind ?? CalendarItemKind.EVENT]}
                </span>
              </div>

              {/* One property per row — icon and label on the left, the value on
                  the right — the list both entity dialogs open with, on their
                  pitch and with their bare triggers. See theme/propertyRow.ts,
                  which is where all of this comes from. */}
              <div className={PROPERTY_LIST}>
                <div className={row}>
                  <span className={fieldLabel}>
                    {form.date ? (
                      <CalendarDayGlyph
                        day={Number(form.date.slice(8, 10))}
                        className={LABEL_ICON}
                      />
                    ) : (
                      <CalendarDays className={LABEL_ICON} aria-hidden />
                    )}
                    {strings.calendar.event.date}
                  </span>
                  <div className={`${VALUE_CELL} flex flex-wrap items-center gap-3`}>
                    {/* The task dialog's Deadline, which is the same row: a date
                        written out in full that opens a calendar. */}
                    <DatePropertyValue
                      value={form.date}
                      onChange={(value) => set('date', value)}
                      isEditing={isEditing}
                      label={strings.calendar.event.date}
                      triggerClass={hugTrigger}
                      panelWidth={PROPERTY_PANEL}
                    />
                  </div>
                </div>

                <div className={row}>
                  <span className={fieldLabel}>
                    <Clock className={LABEL_ICON} aria-hidden />
                    {strings.dashboard.day.time}
                  </span>
                  {/* Both ends on one row: an event's hours are one fact, and
                      two labelled fields on two rows read as two. Typed rather
                      than picked — see TimeInput, which is why there is no
                      dropdown and no clock glyph inside the value.

                      "Dia todo" belongs here rather than beside the date: it is
                      the answer to *when*, not to *which day*, and ticking it
                      takes the hours' own place on the row — there are no hours
                      left to stand in front of. */}
                  <div className={`${VALUE_CELL} flex flex-nowrap items-center gap-3`}>
                    {form.isAllDay ? null : isEditing ? (
                      <span className="flex flex-nowrap items-center gap-1">
                        <TimeInput
                          label={strings.calendar.event.startsAt}
                          value={form.startTime}
                          onChange={(value) => set('startTime', value)}
                        />
                        <span className="shrink-0 text-muted">-</span>
                        <TimeInput
                          label={strings.calendar.event.endsAt}
                          value={form.endTime}
                          onChange={(value) => set('endTime', value)}
                        />
                      </span>
                    ) : (
                      <span className={PROPERTY_VALUE}>
                        {form.startTime} - {form.endTime}
                      </span>
                    )}

                    {isEditing ? (
                      <AppCheckbox
                        quiet
                        isSelected={form.isAllDay}
                        onChange={(selected) => set('isAllDay', selected)}
                      >
                        <span className={PROPERTY_VALUE}>{strings.calendar.event.allDay}</span>
                      </AppCheckbox>
                    ) : form.isAllDay ? (
                      <span className={PROPERTY_VALUE}>{strings.calendar.event.allDay}</span>
                    ) : null}

                    {isEditing && endsBeforeStart ? (
                      <span className="text-xs text-danger">
                        {strings.calendar.event.endBeforeStart}
                      </span>
                    ) : null}
                  </div>
                </div>

                <Select
                  isDisabled={!isEditing}
                  className={undimmed}
                  value={form.recurrence}
                  onChange={(key) => set('recurrence', String(key) as FormState['recurrence'])}
                >
                  <div className={row}>
                    <Label className={fieldLabel}>
                      <Repeat className={LABEL_ICON} aria-hidden />
                      {strings.calendar.details.repeats}
                    </Label>
                    <div className={VALUE_CELL}>
                      <Select.Trigger className={halfTrigger}>
                        <span className={PROPERTY_VALUE}>
                          {form.recurrence === NO_RECURRENCE
                            ? strings.calendar.recurrence.none
                            : strings.calendar.recurrence[form.recurrence]}
                        </span>
                      </Select.Trigger>
                    </div>
                  </div>
                  <Select.Popover {...listboxPopover} className={PANEL_MATCHES_TRIGGER}>
                    <ListBox className={LISTBOX_FLUSH}>
                      <ListBox.Item
                        id={NO_RECURRENCE}
                        textValue={strings.calendar.recurrence.none}
                        className={TEXT_LISTBOX_ITEM}
                      >
                        {strings.calendar.recurrence.none}
                      </ListBox.Item>
                      {RECURRENCES.map((recurrence) => (
                        <ListBox.Item
                          key={recurrence}
                          id={recurrence}
                          textValue={strings.calendar.recurrence[recurrence]}
                          className={TEXT_LISTBOX_ITEM}
                        >
                          {strings.calendar.recurrence[recurrence]}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>

                {/* Optional: left blank the series simply never ends, which is
                    what Google's own default produces. */}
                {form.recurrence === NO_RECURRENCE ? null : (
                  <div className={row}>
                    <span className={subLabel}>
                      <span aria-hidden className={SUB_ROW_MARK} />
                      {strings.calendar.recurrence.until}
                    </span>
                    <div className={`${VALUE_CELL} flex flex-wrap items-center gap-3`}>
                      <DatePropertyValue
                        value={form.recurrenceUntil}
                        onChange={(value) => set('recurrenceUntil', value)}
                        isEditing={isEditing}
                        label={strings.calendar.recurrence.until}
                        triggerClass={hugTrigger}
                        panelWidth={PROPERTY_PANEL}
                      />
                      {isEditing && form.recurrenceUntil ? (
                        <button
                          type="button"
                          className="cursor-pointer text-xs text-muted underline"
                          onClick={() => set('recurrenceUntil', '')}
                        >
                          {strings.calendar.recurrence.noEnd}
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Which days a weekly series lands on. Blank means "the same day
                    it starts on", so an untouched picker behaves exactly as the
                    plain weekly rule did before this existed. */}
                {isWeekly(form.recurrence) ? (
                  <div className={row}>
                    <span className={subLabel}>
                      <span aria-hidden className={SUB_ROW_MARK} />
                      {strings.calendar.recurrence.onDays}
                    </span>
                    <div className={`${VALUE_CELL} flex flex-wrap gap-1`}>
                      {strings.calendar.recurrence.weekdayInitials.map((initial, weekday) => {
                        const active = form.byWeekdays.includes(weekday);
                        return (
                          <button
                            key={strings.calendar.recurrence.weekdayNames[weekday]}
                            type="button"
                            disabled={!isEditing}
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
                            className={`size-5 rounded-full text-[11px] transition-colors ${
                              isEditing ? 'cursor-pointer' : ''
                            } ${
                              active
                                ? 'bg-accent text-accent-foreground'
                                : `border border-outline-control text-muted ${
                                    isEditing ? 'hover:text-foreground' : ''
                                  }`
                            }`}
                          >
                            {initial}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <Select
                  isDisabled={!isEditing}
                  className={undimmed}
                  selectionMode="multiple"
                  value={form.assigneeIds}
                  onChange={(keys) => set('assigneeIds', (keys as (string | number)[]).map(String))}
                >
                  <div className={row}>
                    <Label className={fieldLabel}>
                      <UserRound className={LABEL_ICON} aria-hidden />
                      {strings.calendar.event.team}
                    </Label>
                    <div className={VALUE_CELL}>
                      <Select.Trigger className={halfTrigger}>
                        {assignees.length === 0 ? (
                          <span className={PROPERTY_VALUE}>{EMPTY_VALUE}</span>
                        ) : (
                          <AssigneeValue users={assignees} canAdd={isEditing} />
                        )}
                      </Select.Trigger>
                    </div>
                  </div>
                  <Select.Popover {...listboxPopover} className={PANEL_MATCHES_TRIGGER}>
                    <ListBox selectionMode="multiple" className={LISTBOX_FLUSH}>
                      {users.map((user) => (
                        <ListBox.Item
                          key={user.id}
                          id={user.id}
                          textValue={user.name}
                          className={TEXT_LISTBOX_ITEM}
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

                <div className={row}>
                  <span className={fieldLabel}>
                    <MapPin className={LABEL_ICON} aria-hidden />
                    {strings.calendar.event.location}
                  </span>
                  <div className={VALUE_CELL}>
                    {isEditing ? (
                      /* A bare input rather than the framework's: flush with the
                         column like every other value, and with no height of its
                         own — HeroUI's carries a 36px minimum, which made this
                         the one row standing taller than the rest of the list. */
                      <input
                        type="text"
                        aria-label={strings.calendar.event.location}
                        placeholder={EMPTY_VALUE}
                        value={form.location}
                        onChange={(change) => set('location', change.target.value)}
                        className={`w-full bg-transparent p-0 outline-none placeholder:text-muted ${PROPERTY_VALUE}`}
                      />
                    ) : locationHref ? (
                      /* A meeting link is there to be pressed, not read out:
                         locked, a location that is an address becomes one. New
                         tab, because leaving the calendar is not what pressing
                         it means. */
                      <a
                        href={locationHref}
                        target="_blank"
                        rel="noreferrer"
                        className={`${PROPERTY_VALUE} break-all underline hover:text-foreground`}
                      >
                        {form.location}
                      </a>
                    ) : (
                      <span className={PROPERTY_VALUE}>{form.location || EMPTY_VALUE}</span>
                    )}
                  </div>
                </div>

                {/* Agenda and the card's colour on one line — two columns
                    inside one row: the colour is the agenda's until this says
                    otherwise, and the two answers belong side by side. The
                    agenda's column is a fixed width (see AGENDA_TRIGGER) so the
                    colour starts on a line of its own rather than wherever the
                    chosen name happens to end. */}
                <div className={row}>
                  <span className={fieldLabel}>
                    <CalendarAgendaGlyph className={LABEL_ICON} />
                    {strings.calendar.event.agenda}
                  </span>
                  <div className={`${VALUE_CELL} flex min-w-0 items-center gap-3`}>
                    <Select
                      isDisabled={!isEditing}
                      aria-label={strings.calendar.event.agenda}
                      className={`shrink-0 ${undimmed}`}
                      value={form.agendaId}
                      onChange={(key) => set('agendaId', String(key))}
                    >
                      <Select.Trigger
                        // Locked it is text, not a field switched off: HeroUI
                        // dims a disabled trigger, which left this the one value
                        // in the column reading a shade lighter than the rest.
                        className={`${AGENDA_TRIGGER} ${isEditing ? 'cursor-pointer' : VIEW_TRIGGER}`}
                      >
                        <span className={`truncate ${PROPERTY_VALUE}`}>
                          {writableAgendas.find((agenda) => agenda.id === form.agendaId)?.name ??
                            EMPTY_VALUE}
                        </span>
                      </Select.Trigger>
                      {/* As wide as its longest name, never narrower than the
                          trigger it drops from, and capped so one long agenda
                          cannot open a panel wider than the dialog. The trigger
                          is only as wide as the *chosen* name, so a panel pinned
                          to it would have wrapped every other one. */}
                      <Select.Popover
                        {...listboxPopover}
                        className={`w-max min-w-[var(--trigger-width)] max-w-[16rem]`}
                      >
                        <ListBox className={LISTBOX_FLUSH}>
                          {writableAgendas.map((agenda) => (
                            <ListBox.Item
                              key={agenda.id}
                              id={agenda.id}
                              textValue={agenda.name}
                              className={TEXT_LISTBOX_ITEM}
                            >
                              {agenda.name}
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>

                    {/* The card's own colour, beside the agenda whose colour it
                        otherwise takes. This is the one place an extra colour is
                        chosen: an agenda's colour belongs to every event on it
                        and is set from the list (see AgendaMenu), while this
                        belongs to one card and says nothing about the calendar
                        it is on — which is why the block keeps a stripe of the
                        agenda's colour once it has one.

                        The swatch is the whole value: naming it "Cor da agenda"
                        or "Cor do evento" put a sentence about the colour beside
                        the colour itself. The panel still says which of the two
                        it is. */}
                    {isEditing ? (
                      <Popover isOpen={isColorOpen} onOpenChange={setColorOpen}>
                        {/* react-aria's Button, not HeroUI's: HeroUI's brings a
                            ground, a radius and a hover fill, and the row is a
                            colour with a chevron after it, not a pill. */}
                        <AriaButton
                          aria-label={strings.calendar.event.color}
                          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md outline-none"
                        >
                          <span
                            aria-hidden
                            {...colorFill(form.color ?? agendaColor, COLOR_SWATCH)}
                          />
                          <ChevronDown className="size-3.5 shrink-0 text-muted" aria-hidden />
                        </AriaButton>

                        {/* Against the swatch's right edge rather than its
                            left: the trigger is the last thing on the row, so a
                            panel hung from its left edge opened across the row
                            it belongs to instead of under the end of it. */}
                        <Popover.Content
                          placement="bottom end"
                          offset={4}
                          className={`${COLOR_PANEL} ${FIELD_PANEL}`}
                        >
                          <Popover.Dialog className="flex flex-col gap-2 p-2">
                            {/* Which palette depends on where the event lives. A
                                Google agenda gets Google's eleven, because those
                                are the ones that can also be true over there; a
                                Gloo agenda gets the app's own picker, mixer and
                                all, since nothing has to agree with it. */}
                            {googleAgendaIds.has(form.agendaId) ? (
                              <GoogleColorPicker value={form.color} onChange={chooseColor} />
                            ) : (
                              <ColorPicker
                                compact
                                value={form.color ?? agendaColor}
                                onChange={chooseColor}
                              />
                            )}
                            {/* The way back off it, and the panel's own last
                                line whether or not there is anything to undo: a
                                row that came and went with the card's colour
                                moved every swatch above it the moment one was
                                picked. A dot rather than a square, because this
                                is a statement about the agenda rather than
                                another colour to choose. */}
                            <button
                              type="button"
                              className={`${menuRow} text-xs whitespace-nowrap`}
                              onClick={() => chooseColor(null)}
                            >
                              <span
                                aria-hidden
                                {...colorFill(agendaColor, 'size-3 shrink-0 rounded-full')}
                              />
                              {strings.calendar.event.colorDefault}
                            </button>
                          </Popover.Dialog>
                        </Popover.Content>
                      </Popover>
                    ) : (
                      <span
                        aria-label={strings.calendar.event.color}
                        {...colorFill(form.color ?? agendaColor, COLOR_SWATCH)}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className={`${modalDivider} ${modalDividerGap}`} />

              {/* The same block the other two dialogs carry, under the same
                  name — see NotesBlock. */}
              <NotesBlock
                value={form.description}
                onChange={(html) => set('description', html)}
                placeholder={strings.routine.notesPlaceholder}
                title={strings.routine.notesTitle}
                isEditing={isEditing}
                compact
                // Nothing between the note and the buttons: the dialog's own
                // bottom edge is what closes it off, and a rule there read as a
                // section boundary with nothing after it.
                showDivider={false}
              />
            </Modal.Body>

            {/* Excluir is in the header, with the other two dialogs' — so the
                footer is only the two ways out, and Salvar only while there is
                something staged to save. */}
            <Modal.Footer className={`${dialogFooter} flex items-center justify-end gap-2`}>
              <SecondaryButton slot="close">{strings.common.cancel}</SecondaryButton>
              {isEditing ? (
                <Button
                  variant="primary"
                  isDisabled={!canSubmit || isPending}
                  onPress={() => (needsConfirm ? setConfirming('edit') : save())}
                >
                  {strings.common.save}
                </Button>
              ) : null}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* Asked before the colour reaches the form, never at Salvar: by Salvar the
          decision has already been made, and this is the last moment the label
          still exists. */}
      <ConfirmLabelLossModal
        isOpen={pendingColor !== null}
        onClose={() => setPendingColor(null)}
        onConfirm={() => {
          if (pendingColor) set('color', pendingColor.color);
          setLabelLossAccepted(true);
          setPendingColor(null);
        }}
      />

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
