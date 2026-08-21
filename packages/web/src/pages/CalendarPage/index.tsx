import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
import { bandRange, daysIn, stepFocused, visibleRange } from '@/components/calendar/calendarRange';
import { useEventDrag } from '@/components/calendar/useEventDrag';
import { useScrollEdges } from '@/components/common/SectionScroll';
import { PageHeader } from '@/components/layout/PageHeader';
import { hiddenScrollbar } from '@/theme/styleConstants';
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

import { CALENDAR_DATE_PARAM, CALENDAR_EVENT_PARAM } from '@/lib/calendarLink';
import { playSound } from '@/lib/sounds';

import { readViewMode, writeViewMode } from './viewPreference';

/**
 * Which day the page should open on, as `YYYY-MM-DD`, and which event it should
 * open the dialog on. Defined in lib/calendarLink, which is also where the event
 * dialog's "Copiar link" builds them — re-exported here because this is the name
 * the rest of the app already reaches for.
 */
export { CALENDAR_DATE_PARAM };

/**
 * The soft edge on the right-hand column, at whichever end has more content past
 * it.
 *
 * Painted in `--background` rather than `--surface`: what runs off the end of
 * this column is a card sitting on the page, and the page is what it has to fade
 * into. 24px — enough to read as a fade rather than a line, short enough to
 * leave a whole row of the list legible under it.
 */
const FADE = 'pointer-events-none absolute inset-x-0 z-10 h-6';
const FADE_TOP = `${FADE} top-0 bg-[linear-gradient(to_bottom,var(--background),transparent)]`;
const FADE_BOTTOM = `${FADE} bottom-0 bg-[linear-gradient(to_top,var(--background),transparent)]`;

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
  /**
   * Dia, Semana or Mês — whichever was last left, read from the browser rather
   * than reset on every arrival. See viewPreference for why the *date* is not
   * remembered with it: the view is a way of reading the calendar, the day is
   * where you happened to be browsing, and coming back to a calendar means
   * coming back to now.
   */
  const [viewMode, setViewModeState] = useState<CalendarViewMode>(readViewMode);
  function setViewMode(mode: CalendarViewMode) {
    setViewModeState(mode);
    writeViewMode(mode);
  }
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
  /**
   * What the month beside the grid bands, which is the grid's range everywhere
   * except Dia — there it is that day's whole week. See bandRange.
   */
  const banded = useMemo(() => bandRange(focusedDate, viewMode), [focusedDate, viewMode]);

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

  /**
   * A link straight to one event — what the dialog's "Copiar link" writes.
   *
   * Once only, and only once the events for the day have arrived: the dialog is
   * opened *on* an event, so there is nothing to open until the query that holds
   * it has answered. Closing the dialog afterwards must not reopen it, which is
   * what the ref is for.
   */
  const openedFromLink = useRef(false);
  useEffect(() => {
    if (openedFromLink.current) return;
    const requested = searchParams.get(CALENDAR_EVENT_PARAM);
    if (!requested) return;

    const match = events.find((candidate) => candidate.id === requested);
    if (!match) return;

    openedFromLink.current = true;
    setEditing({ event: match, start: new Date(match.startsAt) });
  }, [events, searchParams]);

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
    // The details card arrives in the column beside the grid, which is far
    // enough from the pointer that the press and its answer read as two
    // separate things. One bubble is what ties them back together.
    playSound('bubble', 0.35);
    setSelectedKey(instanceKey(event));
  }

  /**
   * The details card, and the column it scrolls in.
   *
   * The first is held so a press anywhere else can put the card away — see
   * below. The second is what the fades at the top and bottom of the column are
   * measured from.
   */
  /** Which column the small month last sent us to — see openWeekOn. */
  const [flashDay, setFlashDay] = useState<{ day: string; tick: number } | null>(null);

  const detailsRef = useRef<HTMLElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const { edges, measure: measureColumn } = useScrollEdges(columnRef, selectedEvent);

  /**
   * Selecting an event brings its details into view.
   *
   * The card is written at the top of this column, above the agendas — so a
   * reader who had scrolled down to the end of their agenda list and then
   * clicked an event got an answer somewhere off the top of the screen, and no
   * sign that anything had happened at all. The column goes back to the top,
   * which is where the card is.
   *
   * Only on arriving at a selection, never on losing one: closing the card
   * should leave the list where the reader left it. Smoothly, unless the machine
   * has been told not to animate — the same rule the rest of the app follows in
   * globals.css, asked here because this is script rather than a stylesheet.
   */
  useEffect(() => {
    if (!selectedKey) return;
    columnRef.current?.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  }, [selectedKey]);

  /**
   * A press outside the details card closes it.
   *
   * The card is the answer to a click, so it lasts as long as that click is the
   * last thing you did: click anywhere else — the grid's own background, the
   * month, the agendas — and it goes. Clicking another event still selects it,
   * because this runs in the capture phase and the block's own handler, which
   * runs after it, sets the new selection.
   *
   * `click` rather than `pointerdown`, which is where this started. Closing the
   * card takes 200-odd pixels out of the column, so anything the user was
   * pressing in it moved out from under the pointer between the press and the
   * release — and a button whose press ends somewhere else is not a press at
   * all. The `···` on the Agendas card simply stopped opening. By `click` the
   * gesture is already complete.
   */
  useEffect(() => {
    if (!selectedKey) return;
    function handle(clicked: MouseEvent) {
      const target = clicked.target;
      if (target instanceof Node && detailsRef.current?.contains(target)) return;
      setSelectedKey(null);
    }
    document.addEventListener('click', handle, true);
    return () => document.removeEventListener('click', handle, true);
  }, [selectedKey]);

  /**
   * A day picked in the month *grid* — the big one. That is a request to look at
   * that day on its own, so it opens Dia.
   */
  function openDay(day: CalendarDate) {
    setFocusedDate(day);
    setViewMode(CalendarViewMode.DAY);
  }

  /**
   * A day picked in the small month beside the grid, which asks for something
   * else: the week that day falls in, with the day itself marked.
   *
   * Dia was what this did, and it was the wrong answer to the question the small
   * month is asked — you go there to move about, and landing on a single column
   * with no neighbours is losing the context you were navigating by. The flash
   * is what stops the week arriving anonymous: seven identical columns say
   * nothing about which of them you pressed. See gloo-day-flash.
   *
   * Arrowing through the small month is deliberately not this — that only moves
   * the band.
   */
  function openWeekOn(day: CalendarDate) {
    setFocusedDate(day);
    setViewMode(CalendarViewMode.WEEK);
    setFlashDay((previous) => ({ day: day.toString(), tick: (previous?.tick ?? 0) + 1 }));
  }

  /**
   * "Hoje", which means "put me back on now" — and what "now" looks like depends
   * on the view you are in. Semana comes back to this week and Dia to today,
   * both without changing what you were reading. A month has no *now* to come
   * back to — the month you are in is already on screen, or you are somewhere
   * else entirely — so there the press is read as the request underneath it and
   * opens today, on its own.
   */
  function goToToday() {
    const now = today(getLocalTimeZone());
    if (viewMode === CalendarViewMode.MONTH) {
      openDay(now);
      return;
    }
    setFocusedDate(now);
  }

  /** Paging: the week itself moves, and the grid leans the way it went. */
  function step(direction: 1 | -1) {
    setFocusedDate(stepFocused(focusedDate, viewMode, direction));
    // Away from the arrow you pressed: forward leans left, as if the next week
    // were being pulled in from the right.
    setNudge((previous) => ({ tick: previous.tick + 1, dx: direction * -5 }));
  }

  return (
    // At xl the page is exactly one screen and the grid takes whatever the
    // header leaves — a flex column rather than a `calc()` on the grid, because
    // the header's own height is what that calculation kept guessing at, and
    // being 20px out is what left the strip of bare page under the cards.
    // Below xl the columns stack and the page is as long as its content.
    <div className="xl:flex xl:h-full xl:flex-col">
      <PageHeader title={strings.nav.calendar} />

      {/* Three quarters to the grid rather than two thirds: the right-hand
          column holds a month, a detail panel and a list of names, none of which
          gets better with more width, while the grid is the page.

          One screen tall at xl and never taller, so the page itself has nothing
          to scroll: what scrolls is whichever of the two columns the pointer is
          over — the grid through its own hours, the right-hand column through
          the cards under its month. A page that scrolled as well made three
          scrollbars out of one gesture, and the bottom of the card was somewhere
          you had to travel to. The row is capped as well as the container,
          because a grid row sizes to its content and would otherwise overflow
          the height set here.

          The bottom padding is the header's own top padding, so the page is
          framed by the same margin all the way round.

          Below xl the two columns stack, and a stacked page has to be as long as
          what is in it. */}
      <div className="grid grid-cols-1 gap-4 px-4 pb-4 md:gap-5 md:px-6 md:pb-6 xl:min-h-0 xl:flex-1 xl:grid-cols-4 xl:grid-rows-[minmax(0,1fr)]">
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
              onToday={goToToday}
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
                  onOpenDay={openDay}
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
                  flashDay={flashDay}
                  onFlashDone={() => setFlashDay(null)}
                />
              )}
            </div>
          </section>
        </div>

        {/* Two rows, and only the second of them moves. The month is a fixed
            block of dates whose whole use is being in the same place every time
            you look for it — scrolling it away to reach the agendas made the
            fastest control on the page the one you had to go and find. */}
        <div className="flex min-h-0 flex-col gap-4 md:gap-5">
          {/* Two ways in, and they mean different things. Arrowing through the
              month only moves what the grid is centred on; *picking* a day asks
              to be taken to it, which is the week it falls in with the day
              marked — see openWeekOn. */}
          <MiniCalendarCard
            focusedDate={focusedDate}
            onFocusedDateChange={setFocusedDate}
            onOpenDay={openWeekOn}
            bandedRange={banded}
            // Nothing is marked in month view: the band is the whole month, so
            // the only day standing out there is today.
            pickedDate={viewMode === CalendarViewMode.MONTH ? null : focusedDate}
            // The same hour a click on an empty month cell opens at — see
            // NEW_EVENT_HOUR in CalendarMonthGrid. A day picked off a month
            // carries no time with it, and 09:00 is the one the grid already
            // settled on.
            onCreateOnDay={(date) => setEditing({ event: null, start: dayStart(date) })}
          />

          {/* The second row is the scroller: the details of whatever is selected
              and the whole list of agendas, which together do not always fit
              what the month leaves. Nothing inside it scrolls on its own any
              more, so the agendas card is as tall as its list and one gesture
              reaches the end of it.

              A gradient at whichever end has more content past it, painted in
              the page's own ground so a card running off the top or the bottom
              dissolves into it instead of being cut through the middle of a row.
              Only while there is something past that edge — see
              useScrollEdges — and never over the pointer, so the cards under it
              are still clickable. */}
          <div className="relative flex min-h-0 flex-1 flex-col">
            {edges.top ? <div aria-hidden className={FADE_TOP} /> : null}

            <div
              ref={columnRef}
              onScroll={measureColumn}
              // No bar of its own, unlike the grid beside it. Even the 2px
              // hairline gloo-thin-scroll draws is 2px this column's cards do
              // not have, and the month above the scroller is outside it — so
              // Detalhes and Minhas agendas came out narrower than the calendar
              // directly above them, which is visible as a step down the
              // column's right-hand edge. The fades at both ends already say
              // there is more.
              // `overflow-anchor:none`: the details card is inserted at the
              // *top* of this column, and Chrome's scroll anchoring answers
              // that by pushing scrollTop down by exactly the card's height, so
              // that whatever was on screen stays on screen. Which is the wrong
              // instinct here — the card is the answer to the click that just
              // happened, and anchoring is what kept it hidden above the fold
              // even for a reader already at the top of the column. Off, the
              // column stays where it is and the card appears in it; see the
              // effect that also brings a reader back up from further down.
              className={`${hiddenScrollbar} flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto [overflow-anchor:none] md:gap-5`}
            >
              {/* Only when there is something to detail. An empty card telling
                  you to select an event was a permanent hole between the month
                  and the agendas — the agendas simply start here when nothing is
                  selected, and move down to make room when something is. */}
              {selectedEvent ? (
                <EventDetailsCard
                  ref={detailsRef}
                  event={selectedEvent}
                  agenda={agendasById.get(selectedEvent.agendaId)}
                  onEdit={() =>
                    setEditing({ event: selectedEvent, start: new Date(selectedEvent.startsAt) })
                  }
                />
              ) : null}
              <AgendasCard onLinkGoogle={() => connectGoogle.mutate()} />
            </div>

            {edges.bottom ? <div aria-hidden className={FADE_BOTTOM} /> : null}
          </div>
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
 * The start of a new event on a day chosen from the mini calendar. See
 * NEW_EVENT_HOUR in CalendarMonthGrid, which is the same answer to the same
 * question for a click on an empty month cell.
 */
function dayStart(date: CalendarDate): Date {
  const start = date.toDate(getLocalTimeZone());
  start.setHours(9, 0, 0, 0);
  return start;
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
