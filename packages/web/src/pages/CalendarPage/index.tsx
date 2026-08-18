import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { getLocalTimeZone, parseDate, today, type CalendarDate } from '@internationalized/date';
import { useSearchParams } from 'react-router';

import {
  CalendarProvider,
  CalendarViewMode,
  countOtherAttendees,
  type CalendarEventDto,
} from '@gloo/shared';

import { CalendarMonthGrid } from '@/components/calendar/CalendarMonthGrid';
import { CalendarTimeGrid, instanceKey } from '@/components/calendar/CalendarTimeGrid';
import { CalendarToolbar } from '@/components/calendar/CalendarToolbar';
import { EventDetailsCard } from '@/components/calendar/EventDetailsCard';
import { EventModal } from '@/components/calendar/EventModal';
import { MiniCalendarCard } from '@/components/calendar/MiniCalendarCard';
import { ConfirmEventChangeModal } from '@/components/calendar/ConfirmEventChangeModal';
import { AgendasCard } from '@/components/calendar/agendas/AgendasCard';
import { daysIn, stepFocused, visibleRange } from '@/components/calendar/calendarRange';
import { useEventDrag } from '@/components/calendar/useEventDrag';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  useAgendasById,
  useCalendarAccounts,
  useCalendarEvents,
  useConnectGoogle,
  useToggleEventDone,
  useGoogleSync,
  useUpdateEvent,
} from '@/hooks/queries/calendar';
import { strings } from '@/strings/pt-BR';

/**
 * Which day the page should open on, as `YYYY-MM-DD`. Exported so the one place
 * that writes it and the one place that reads it name it once.
 */
export const CALENDAR_DATE_PARAM = 'data';

/**
 * The Calendar page.
 *
 * Two columns at xl, the same split the Dashboard uses: the grid takes two
 * thirds and the three narrow cards share the last one. Below xl they stack — a
 * week grid and a mini calendar side by side at tablet width leave neither
 * legible.
 *
 * The focused date and the view mode live here rather than in the grid, because
 * three separate things read them: the grid draws them, the mini calendar bands
 * the range they cover, and the toolbar's arrows move them.
 */
export function CalendarPage() {
  const [searchParams] = useSearchParams();
  /**
   * Opens on the day the caller named, or on today.
   *
   * The Dashboard's day summary is what names one: its chevron is the way from
   * "what is on the 12th" to the 12th itself, and landing on today instead would
   * make that a link to somewhere else. Read once, as the initial state — the
   * page owns the focused date from then on, and re-reading it would drag the
   * grid back every time the arrows moved it.
   */
  const [focusedDate, setFocusedDate] = useState<CalendarDate>(() => {
    const requested = searchParams.get(CALENDAR_DATE_PARAM);
    try {
      return requested ? parseDate(requested) : today(getLocalTimeZone());
    } catch {
      return today(getLocalTimeZone());
    }
  });
  const [viewMode, setViewMode] = useState<CalendarViewMode>(CalendarViewMode.WEEK);
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  /**
   * The lean the grid gives when it is paged — see gloo-nudge in globals.css.
   * `tick` exists only to restart the animation: it picks which of the two
   * identical classes is on the grid, and re-applying the one already there
   * would play nothing at all.
   */
  const [nudge, setNudge] = useState({ tick: 0, dx: 0 });
  /**
   * What the dialog is doing, or null when it is shut. `start` is what a click
   * on empty grid means — the slot the new event should open on.
   */
  const [editing, setEditing] = useState<{ event: CalendarEventDto | null; start: Date } | null>(
    null,
  );

  const range = useMemo(() => visibleRange(focusedDate, viewMode), [focusedDate, viewMode]);
  const days = useMemo(() => daysIn(range), [range]);

  // The query window is the visible range in the viewer's own zone: the grid's
  // first column starts at local midnight, not UTC midnight, and asking for the
  // wrong one drops or adds an event at each end.
  const from = useMemo(
    () => new Date(range.start.year, range.start.month - 1, range.start.day).toISOString(),
    [range],
  );
  const to = useMemo(
    () => new Date(range.end.year, range.end.month - 1, range.end.day + 1).toISOString(),
    [range],
  );

  const { data: events = [] } = useCalendarEvents(from, to);
  const { data: accounts = [] } = useCalendarAccounts();
  const agendasById = useAgendasById();

  const agendas = useMemo(
    () => accounts.flatMap((account) => account.agendas),
    [accounts],
  );
  const defaultAgendaId =
    agendas.find((agenda) => agenda.isDefault)?.id ?? agendas[0]?.id ?? '';

  // Only poll Google when there is a Google account to poll.
  useGoogleSync(accounts.some((account) => account.provider === CalendarProvider.GOOGLE));

  // The OAuth callback comes back as a redirect carrying its outcome. Read once
  // and stripped from the URL, so a reload doesn't re-announce a week-old link.
  const [linkResult, setLinkResult] = useState<'linked' | string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('linked') ? 'linked' : params.get('calendarError');
  });
  useEffect(() => {
    if (linkResult) window.history.replaceState({}, '', '/calendar');
  }, [linkResult]);

  const visibleEvents = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return events.filter((event) => {
      // Hidden is a property of the agenda, so filtering happens here rather
      // than server-side — pressing an eye is then instant and refetches
      // nothing.
      if (agendasById.get(event.agendaId)?.isHidden) return false;
      if (!needle) return true;
      return (
        event.title.toLowerCase().includes(needle) ||
        (event.location ?? '').toLowerCase().includes(needle)
      );
    });
  }, [events, agendasById, search]);

  const selectedEvent = useMemo(
    () => visibleEvents.find((event) => instanceKey(event) === selectedKey) ?? null,
    [visibleEvents, selectedKey],
  );

  const connectGoogle = useConnectGoogle();
  const toggleDone = useToggleEventDone();
  const updateEvent = useUpdateEvent();
  /**
   * A drag onto a new time that still has to ask "this occurrence or all of
   * them?". Held until the question is answered, then written.
   */
  const [pendingDrag, setPendingDrag] = useState<{
    event: CalendarEventDto;
    startsAt: string;
    endsAt: string;
  } | null>(null);

  /** Agendas that actually mirror to Google — the only ones that can email. */
  const googleAgendaIds = useMemo(
    () =>
      new Set(
        accounts
          .filter((account) => account.provider === CalendarProvider.GOOGLE)
          .flatMap((account) => account.agendas.map((agenda) => agenda.id)),
      ),
    [accounts],
  );

  /**
   * How many people a change to this event would email.
   *
   * Zero for anything on a Gloo-local agenda: nothing is mirrored, so nothing
   * can be sent, and asking would be a question with no consequence.
   */
  function attendeesToNotify(event: CalendarEventDto): number {
    if (!googleAgendaIds.has(event.agendaId)) return 0;
    return countOtherAttendees({
      createdById: event.createdById,
      assigneeIds: event.assignees.map((user) => user.id),
      externalAttendees: event.externalAttendees,
    });
  }

  const drag = useEventDrag({
    onCommit: (event, startsAt, endsAt, options) => {
      // Two things can make a drag need a question first: a series has to say
      // which occurrences move, and an event with other people on it has to say
      // whether they should be told. Neither applies to most drags, which
      // commit straight away.
      if (event.recurrence || attendeesToNotify(event) > 0) {
        setPendingDrag({ event, startsAt, endsAt });
        return;
      }
      // `isAllDay` only arrives from a drag out of the all-day strip: the item
      // has just been given an hour, and the flag saying it had none has to go
      // with the same write or the grid would put it straight back.
      updateEvent.mutate({
        id: event.id,
        startsAt,
        endsAt,
        ...(options?.isAllDay === undefined ? {} : { isAllDay: options.isAllDay }),
      });
    },
  });

  function handleSelect(event: CalendarEventDto) {
    // The click that ends a drag must not also select — see the hook.
    if (drag.consumeSuppressedClick()) return;
    setSelectedKey(instanceKey(event));
  }

  /** Paging: the week itself moves, and the grid leans the way it went. */
  function step(direction: 1 | -1) {
    setFocusedDate(stepFocused(focusedDate, viewMode, direction));
    // Away from the arrow you pressed: forward leans left, as if the next week
    // were being pulled in from the right.
    setNudge((previous) => ({ tick: previous.tick + 1, dx: direction * -5 }));
  }

  return (
    <div>
      <PageHeader title={strings.nav.calendar} />

      {/* Three quarters to the grid rather than two thirds: the right-hand
          column holds a month, a detail panel and a list of names, none of which
          gets better with more width, while the grid is the page.

          One screen tall at xl and never taller, so the page itself has nothing
          to scroll: what scrolls is whichever of the two columns the pointer is
          over — the grid through its own hours, the right-hand column through
          its cards. A page that scrolled as well made three scrollbars out of
          one gesture, and the bottom of the card was somewhere you had to travel
          to. The row is capped as well as the container, because a grid row
          sizes to its content and would otherwise overflow the height set here.

          Below xl the two columns stack, and a stacked page has to be as long as
          what is in it. */}
      <div className="grid grid-cols-1 gap-4 px-4 pb-6 md:gap-5 md:px-6 xl:h-[calc(100vh-9.5rem)] xl:grid-cols-4 xl:grid-rows-[minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-4 md:gap-5 xl:col-span-3">
          {/* The outcome of a Google link, which arrives as a redirect rather
              than as a response to anything the page asked for. Dismissible,
              and cleared from the URL above. */}
          {linkResult ? (
            <div
              className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm ${
                linkResult === 'linked'
                  ? 'bg-accent/20 text-foreground'
                  : 'bg-danger/10 text-danger'
              }`}
            >
              <span>
                {linkResult === 'linked'
                  ? strings.calendar.google.linked
                  : linkResult === 'scope_denied'
                    ? strings.calendar.google.scopeDenied
                    : strings.calendar.google.linkFailed}
              </span>
              <button
                type="button"
                className="shrink-0 cursor-pointer text-xs underline"
                onClick={() => setLinkResult(null)}
              >
                {strings.common.close}
              </button>
            </div>
          ) : null}

          {/* `flex-1` rather than a height of its own: the row is as tall as the
              taller of the two columns, so the grid now ends exactly where the
              agendas under the mini calendar end. It used to stop at its own
              content and leave a strip of bare page below it. */}
          <section className="gloo-rise flex min-h-0 flex-1 flex-col gap-4 rounded-3xl bg-surface p-4 shadow-surface md:p-5">
            <CalendarToolbar
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              range={range}
              onStep={step}
              onToday={() => setFocusedDate(today(getLocalTimeZone()))}
              search={search}
              onSearchChange={setSearch}
              onCreateEvent={() => setEditing({ event: null, start: defaultStart() })}
            />

            {/* The grid and nothing else leans: the toolbar above it is what did
                the paging, and a heading that flinches when you press its own
                arrow reads as a misclick. */}
            <div
              className={`flex min-h-0 flex-1 flex-col ${
                nudge.tick === 0 ? '' : nudge.tick % 2 === 0 ? 'gloo-nudge-a' : 'gloo-nudge-b'
              }`}
              style={{ '--nudge': `${nudge.dx}px` } as CSSProperties}
            >
              {viewMode === CalendarViewMode.MONTH ? (
                <CalendarMonthGrid
                  days={days}
                  events={visibleEvents}
                  agendasById={agendasById}
                  selectedEventId={selectedKey}
                  onSelectEvent={handleSelect}
                  onOpenDay={(day) => {
                    setFocusedDate(day);
                    setViewMode(CalendarViewMode.DAY);
                  }}
                  onCreateOnDay={(start) => setEditing({ event: null, start })}
                  focusedMonth={focusedDate.month}
                  todayIso={today(getLocalTimeZone()).toString()}
                />
              ) : (
                <CalendarTimeGrid
                  days={days}
                  events={visibleEvents}
                  agendasById={agendasById}
                  selectedEventId={selectedKey}
                  onSelectEvent={handleSelect}
                  onToggleDone={(event, done) => toggleDone.mutate({ id: event.id, done })}
                  onEventPointerDown={drag.beginMove}
                  onEventResizeStart={drag.beginResize}
                  onEventScheduleStart={drag.beginSchedule}
                  onPointerMove={drag.handlePointerMove}
                  onPointerUp={drag.handlePointerUp}
                  dragPreview={drag.preview}
                  onSlotClick={(start) => setEditing({ event: null, start })}
                  todayIso={today(getLocalTimeZone()).toString()}
                />
              )}
            </div>
          </section>
        </div>

        {/* The column is its own scroller: the month, the details of whatever is
            selected and a long list of agendas do not always fit one screen, and
            this is what the pointer scrolls when it is over them. */}
        <div className="gloo-thin-scroll flex min-h-0 flex-col gap-4 overflow-y-auto md:gap-5">
          <MiniCalendarCard
            focusedDate={focusedDate}
            onFocusedDateChange={setFocusedDate}
            visibleRange={range}
          />
          {/* Only when there is something to detail. An empty card telling you
              to select an event was a permanent hole between the month and the
              agendas — the agendas simply start here when nothing is selected,
              and move down to make room when something is. */}
          {selectedEvent ? (
            <EventDetailsCard
              event={selectedEvent}
              agenda={agendasById.get(selectedEvent.agendaId)}
              onEdit={() =>
                setEditing({ event: selectedEvent, start: new Date(selectedEvent.startsAt) })
              }
            />
          ) : null}
          <AgendasCard onLinkGoogle={() => connectGoogle.mutate()} />
        </div>
      </div>

      {/* Keyed so the dialog remounts when it is pointed at a different event —
          otherwise the form state from the last one survives into the next. */}
      {editing ? (
        <EventModal
          key={editing.event ? instanceKey(editing.event) : 'new'}
          isOpen
          event={editing.event}
          agendas={agendas}
          defaultAgendaId={defaultAgendaId}
          defaultStart={editing.start}
          googleAgendaIds={googleAgendaIds}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmEventChangeModal
        isOpen={pendingDrag !== null}
        intent="edit"
        isRecurring={Boolean(pendingDrag?.event.recurrence)}
        otherAttendees={pendingDrag ? attendeesToNotify(pendingDrag.event) : 0}
        onClose={() => setPendingDrag(null)}
        onConfirm={({ scope, notify }) => {
          if (!pendingDrag) return;
          updateEvent.mutate({
            id: pendingDrag.event.id,
            scope,
            originalStart: pendingDrag.event.originalStart,
            startsAt: pendingDrag.startsAt,
            endsAt: pendingDrag.endsAt,
            notify,
          });
          setPendingDrag(null);
        }}
      />
    </div>
  );
}

/**
 * Where "Novo evento" opens when it wasn't a click on the grid: the next whole
 * hour, which is nearly always closer to what is wanted than this minute.
 */
function defaultStart(): Date {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  return start;
}
