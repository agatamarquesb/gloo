import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getLocalTimeZone, startOfWeek, today, type CalendarDate } from '@internationalized/date';
import { useNavigate } from 'react-router';

import { CalendarProvider } from '@gloo/shared';

import { MonthCalendar } from '@/components/common/MonthCalendar';
import { useMe } from '@/hooks/queries/auth';
import { useAgendasById, useCalendarAccounts, useCalendarEvents } from '@/hooks/queries/calendar';
import { useSectors } from '@/hooks/queries/sectors';
import { useTasks, useTasksCalendar } from '@/hooks/queries/tasks';
import { useSectorColors } from '@/hooks/ui/useSectorColors';
import { CALENDAR_DATE_PARAM } from '@/pages/CalendarPage';
import { CALENDAR_FIRST_DAY, CALENDAR_LOCALE } from '@/lib/weekStart';
import { colorFill, type ColorPaint } from '@/theme/labelColors';
import { strings } from '@/strings/pt-BR';

import { CalendarAgendaMenu } from './CalendarAgendaMenu';
import { readHiddenAgendas, writeHiddenAgendas } from './calendarAgendaView';
import { DashboardCard } from './DashboardCard';
import { DayAgendaPanel } from './DayAgendaPanel';
import { buildDayAgenda, localDayKey, type DayItem, type DayItemAccent } from './dayAgenda';
import { sortBySectorOrder } from './sectorOrder';

const MAX_DOTS = 3;

/**
 * A day's mark: 5px, which is where it stops being a speck.
 *
 * It sits under the day's box, in the room the rows were opened up to give it —
 * see .gloo-dashboard-calendar. Inside the fill it had to be paid for out of the
 * number's own space, which is what stopped the dates lining up.
 */
const DOT = 'size-[5px] rounded-full';

/**
 * Everything on screen, not everything in the month.
 *
 * The grid draws six weeks, so the last days of the previous month and the first
 * of the next are on it — and those days are pressable and carry dots like any
 * other. Asking for the month alone left them permanently empty: no dots, and an
 * empty summary under a day that plainly has something on it.
 *
 * Six weeks flat, whether or not the month needs the sixth row: a fixed window
 * is a superset of what is drawn, and a query key that changes shape with the
 * month would refetch on the way past.
 */
function gridStart(focused: CalendarDate): CalendarDate {
  return startOfWeek(focused.set({ day: 1 }), CALENDAR_LOCALE, CALENDAR_FIRST_DAY);
}

function monthRange(focused: CalendarDate) {
  const first = gridStart(focused);
  return { from: first.toString(), to: first.add({ days: 41 }).toString() };
}

/**
 * The same month as an instant range, for the events endpoint — which deals in
 * absolute times rather than in days. The end is midnight *after* the last day,
 * so an event starting at 23:00 on the 31st is still inside the window.
 */
/** A calendar day as the instant local midnight begins on it. */
function localMidnight(value: CalendarDate): Date {
  return new Date(value.year, value.month - 1, value.day);
}

function monthInstants(focused: CalendarDate) {
  const first = gridStart(focused);
  return {
    fromIso: localMidnight(first).toISOString(),
    // Midnight *after* the last day drawn, so an event at 23:00 on it is still
    // inside the window.
    toIso: localMidnight(first.add({ days: 42 })).toISOString(),
  };
}

export function CalendarCard() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const [focused, setFocused] = useState<CalendarDate>(() => today(getLocalTimeZone()));
  /** The day whose summary is open, or null while the card is just a month. */
  const [selected, setSelected] = useState<CalendarDate | null>(null);
  const sectorColors = useSectorColors();
  const cardRef = useRef<HTMLElement>(null);

  const { from, to } = monthRange(focused);
  const { fromIso, toIso } = monthInstants(focused);
  const { data: entries = [] } = useTasksCalendar(from, to);
  const { data: sectors = [] } = useSectors();
  const { data: allEvents = [] } = useCalendarEvents(fromIso, toIso);
  // Two views of one query — the map for looking an event's agenda up, the tree
  // for the menu, which lists agendas under the account they belong to.
  const { data: accounts = [] } = useCalendarAccounts();
  const agendasById = useAgendasById();

  /**
   * The agendas this card leaves out, chosen from its own `···` and kept in the
   * browser rather than on the agenda — see calendarAgendaView for why this is
   * not the eye icon.
   */
  const [hiddenAgendaIds, setHiddenAgendaIds] = useState<string[]>(readHiddenAgendas);
  const hiddenAgendas = useMemo(() => new Set(hiddenAgendaIds), [hiddenAgendaIds]);

  function toggleAgenda(agendaId: string) {
    setHiddenAgendaIds((current) => {
      const next = current.includes(agendaId)
        ? current.filter((id) => id !== agendaId)
        : [...current, agendaId];
      writeHiddenAgendas(next);
      return next;
    });
  }

  /**
   * What the menu offers, in the shape it lists them in: by account, and without
   * the agendas the Calendar page's eye has hidden — a box you can tick that
   * changes nothing is worse than no box. An account whose agendas are all
   * hidden drops out with them rather than leaving a heading over nothing.
   */
  const agendaGroups = accounts
    .map((account) => ({
      id: account.id,
      displayName: account.displayName,
      agendas: account.agendas.filter((agenda) => !agenda.isHidden),
    }))
    .filter((account) => account.agendas.length > 0);

  /**
   * The month's events, filtered once — so a day's dots, the summary under it and
   * the ticks in the menu can never disagree.
   */
  const events = useMemo(
    () => allEvents.filter((event) => !hiddenAgendas.has(event.agendaId)),
    [allEvents, hiddenAgendas],
  );

  /**
   * The month's tasks, but only once a day has actually been picked: the dots
   * come from the lighter /tasks/calendar endpoint, and pulling a month of full
   * task rows on every Dashboard load to answer a question nobody has asked yet
   * would be a request for nothing.
   */
  const { data: monthTasks = [] } = useTasks(
    { dueDateFrom: from, dueDateTo: to, assigneeId: me?.id },
    { enabled: selected !== null && Boolean(me?.id) },
  );

  // Sector → palette slot, so a day's dots match the donut's colors exactly.
  // Both sides slot by the shared display order, not by API order, or the same
  // sector would land on a different color in each card.
  const slotBySector = useMemo(
    () =>
      new Map(
        sortBySectorOrder(sectors, (sector) => sector.name).map((sector, index) => [
          sector.id,
          index,
        ]),
      ),
    [sectors],
  );
  const bySector = useMemo(
    () => new Map(entries.map((entry) => [entry.date, entry.sectorIds])),
    [entries],
  );

  /**
   * Which agendas have something on each day, so an event marks its day the way
   * a task does.
   *
   * By agenda rather than by event: three meetings in one agenda are one fact
   * about the day — "there is work calendar here" — and three identical dots
   * would only have said it three times. Agendas hidden on the calendar page are
   * left out, and so are the ones unticked in this card's own `···`.
   */
  const byAgenda = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const event of events) {
      if (agendasById.get(event.agendaId)?.isHidden) continue;
      const day = localDayKey(new Date(event.startsAt));
      const existing = map.get(day);
      if (!existing) map.set(day, [event.agendaId]);
      else if (!existing.includes(event.agendaId)) existing.push(event.agendaId);
    }
    return map;
  }, [events, agendasById]);

  /**
   * What an agenda or a sector paints with — a day's dot on the month, and the
   * bar down the left of that day's items in the summary. One function for both,
   * which is what makes the mark and the thing it stands for the same colour
   * without either side having to remember to be.
   *
   * An agenda's colour goes through colorFill because it may be one the user
   * mixed, which can only be an inline value; a sector's is a slot in the shared
   * chart palette, resolved to a hex the same way the donut resolves it.
   */
  const paintAccent = useCallback(
    (accent: DayItemAccent, className: string): ColorPaint =>
      accent.kind === 'AGENDA'
        ? colorFill(agendasById.get(accent.id)?.color ?? 'gray', className)
        : {
            className,
            style: {
              backgroundColor: sectorColors[(slotBySector.get(accent.id) ?? 0) % sectorColors.length],
            },
          },
    [agendasById, slotBySector, sectorColors],
  );

  /**
   * Which calendar an item came from, for the summary's Agenda row: "Gloo" or
   * "Google Agenda".
   *
   * The account rather than the agenda's own name, because that is the question
   * the panel is answering — the month above mixes both and a reader wants to
   * know which of the two they are looking at, not which of eight. A task has no
   * agenda at all and is always the app's own.
   */
  const sourceOf = useCallback(
    (item: DayItem) => {
      if (item.accent.kind !== 'AGENDA') return strings.dashboard.day.sourceGloo;

      const accountId = agendasById.get(item.accent.id)?.accountId;
      const provider = accounts.find((account) => account.id === accountId)?.provider;
      return provider === CalendarProvider.GOOGLE
        ? strings.dashboard.day.sourceGoogle
        : strings.dashboard.day.sourceGloo;
    },
    [accounts, agendasById],
  );

  /** What the open summary is listing — nothing at all while it is closed. */
  const selectedDay = selected?.toString() ?? null;
  const dayItems = useMemo(
    () =>
      selectedDay
        ? buildDayAgenda({
            day: selectedDay,
            tasks: monthTasks,
            events,
            agendasById,
            userId: me?.id,
          })
        : [],
    [selectedDay, monthTasks, events, agendasById, me?.id],
  );

  /**
   * Picking a day opens its summary; pressing the day that is already open shuts
   * it again — the cell is the panel's own switch, and having to click away to
   * close something you opened by clicking is a rule with no reason.
   */
  function selectDay(date: CalendarDate) {
    setSelected((current) => (current?.toString() === date.toString() ? null : date));
  }

  /**
   * Pressing anywhere outside the card closes the summary again.
   *
   * On the card rather than on the day cell, because everything that keeps the
   * panel meaningful is inside it: paging the month, picking another day,
   * following the chevron. `pointerdown` rather than `click` so the panel is
   * gone before whatever was pressed underneath reacts.
   */
  useEffect(() => {
    if (!selected) return;

    const onPointerDown = (event: PointerEvent) => {
      if (cardRef.current?.contains(event.target as Node)) return;
      setSelected(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [selected]);

  return (
    // The month's own name is the card's heading — see `hideTitle`.
    <DashboardCard ref={cardRef} hideTitle title={strings.dashboard.calendar}>
      <MonthCalendar
        // Shorter rows and a rounded square on today, rather than HeroUI's
        // square cell and its circle — see .gloo-dashboard-calendar.
        className="gloo-compact-month gloo-month-dots"
        ariaLabel={strings.dashboard.calendar}
        // The month is this card's heading, so it leads the row and the arrows
        // follow it; the far end of that row is where the agenda filter goes,
        // which is the corner every other card keeps its `···` in.
        leadingHeading
        headerAction={
          <CalendarAgendaMenu
            accounts={agendaGroups}
            hiddenIds={hiddenAgendas}
            onToggle={toggleAgenda}
          />
        }
        focusedValue={focused}
        onFocusChange={setFocused}
        // Picking a day opens the summary under the month instead of leaving the
        // Dashboard. Pressing the day that is already open closes it again —
        // the cell is the panel's own switch, and having to click away to shut
        // something you opened by clicking is a rule with no reason.
        onChange={selectDay}
        // Never selected as far as the calendar is concerned, so that pressing
        // the day already open counts as a change and closes it — see `value`
        // in MonthCalendar.
        value={null}
        // Which leaves the picked day for us to paint.
        cellClassName={(date) =>
          selected && date.compare(selected) === 0 ? 'gloo-day-picked' : ''
        }
        renderCellExtra={(date) => {
          const day = date.toString();
          const sectorIds = bySector.get(day) ?? [];
          const agendaIds = byAgenda.get(day) ?? [];

          // React Aria disables every cell outside the month on screen, and a
          // disabled cell takes no press — so the end of one month and the start
          // of the next were dead. This lays a target of our own over those:
          // they stay grey, saying they belong to another month, and they answer
          // like any other day.
          //
          // Only over those. On a live cell react-aria handles the press itself
          // and stops the event before it can reach a child, so a button there
          // would be a control that silently does nothing.
          const isOutsideMonth = date.month !== focused.month || date.year !== focused.year;
          const overlay = isOutsideMonth ? (
            <button
              type="button"
              aria-label={day}
              onClick={() => selectDay(date)}
              className="pointer-events-auto absolute inset-0 cursor-pointer rounded-[inherit]"
            />
          ) : null;

          if (sectorIds.length === 0 && agendaIds.length === 0) return overlay;

          // Events lead: a meeting happens at an hour and a task is merely due
          // that day, so the first dot answers the more urgent question.
          const dots = [
            ...agendaIds.map((agendaId) => ({
              key: `agenda-${agendaId}`,
              paint: paintAccent({ kind: 'AGENDA', id: agendaId }, DOT),
            })),
            ...sectorIds.map((sectorId) => ({
              key: `sector-${sectorId}`,
              paint: paintAccent({ kind: 'SECTOR', id: sectorId }, DOT),
            })),
          ].slice(0, MAX_DOTS);

          // Under the day's fill rather than inside it: the box is the date and
          // nothing else, so a day with something on it is the same box in the
          // same place as an empty one, with the marks hanging below it. The
          // room they hang in is the cell's bottom margin, which is what holds
          // them off the row beneath — see .gloo-dashboard-calendar.
          return (
            <>
              {overlay}
              <span className="pointer-events-none absolute inset-x-0 top-full mt-[3px] flex justify-center gap-[2px]">
                {dots.map((dot) => (
                  <span key={dot.key} {...dot.paint} />
                ))}
              </span>
            </>
          );
        }}
      />

      {selected ? (
        <DayAgendaPanel
          items={dayItems}
          paintAccent={paintAccent}
          sourceOf={sourceOf}
          onOpenCalendar={() =>
            navigate(`/calendar?${CALENDAR_DATE_PARAM}=${selected.toString()}`)
          }
        />
      ) : null}
    </DashboardCard>
  );
}
