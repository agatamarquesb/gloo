import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getLocalTimeZone, today, type CalendarDate } from '@internationalized/date';
import { useNavigate } from 'react-router';

import { MonthCalendar } from '@/components/common/MonthCalendar';
import { useMe } from '@/hooks/queries/auth';
import { useAgendasById, useCalendarEvents } from '@/hooks/queries/calendar';
import { useSectors } from '@/hooks/queries/sectors';
import { useTasks, useTasksCalendar } from '@/hooks/queries/tasks';
import { useTileColors } from '@/hooks/ui/useTileColors';
import { CALENDAR_DATE_PARAM } from '@/pages/CalendarPage';
import { colorFill, type ColorPaint } from '@/theme/labelColors';
import { strings } from '@/strings/pt-BR';

import { DashboardCard } from './DashboardCard';
import { DayAgendaPanel } from './DayAgendaPanel';
import { buildDayAgenda, localDayKey, type DayItemAccent } from './dayAgenda';
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

function monthRange(focused: CalendarDate) {
  const first = focused.set({ day: 1 });
  const last = first.add({ months: 1 }).subtract({ days: 1 });
  return { from: first.toString(), to: last.toString() };
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
  const first = focused.set({ day: 1 });
  return {
    fromIso: localMidnight(first).toISOString(),
    toIso: localMidnight(first.add({ months: 1 })).toISOString(),
  };
}

export function CalendarCard() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const [focused, setFocused] = useState<CalendarDate>(() => today(getLocalTimeZone()));
  /** The day whose summary is open, or null while the card is just a month. */
  const [selected, setSelected] = useState<CalendarDate | null>(null);
  const tileColors = useTileColors();
  const cardRef = useRef<HTMLElement>(null);

  const { from, to } = monthRange(focused);
  const { fromIso, toIso } = monthInstants(focused);
  const { data: entries = [] } = useTasksCalendar(from, to);
  const { data: sectors = [] } = useSectors();
  const { data: events = [] } = useCalendarEvents(fromIso, toIso);
  const agendasById = useAgendasById();

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
   * would only have said it three times. Hidden agendas are left out, exactly as
   * they are on the calendar page.
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
              backgroundColor: tileColors[(slotBySector.get(accent.id) ?? 0) % tileColors.length],
            },
          },
    [agendasById, slotBySector, tileColors],
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
        className="gloo-dashboard-calendar"
        ariaLabel={strings.dashboard.calendar}
        focusedValue={focused}
        onFocusChange={setFocused}
        // Picking a day opens the summary under the month instead of leaving the
        // Dashboard. Pressing the day that is already open closes it again —
        // the cell is the panel's own switch, and having to click away to shut
        // something you opened by clicking is a rule with no reason.
        onChange={(date) =>
          setSelected((current) => (current?.toString() === date.toString() ? null : date))
        }
        renderCellExtra={(date) => {
          const day = date.toString();
          const sectorIds = bySector.get(day) ?? [];
          const agendaIds = byAgenda.get(day) ?? [];
          if (sectorIds.length === 0 && agendaIds.length === 0) return null;

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
            <span className="pointer-events-none absolute inset-x-0 top-full mt-[3px] flex justify-center gap-[2px]">
              {dots.map((dot) => (
                <span key={dot.key} {...dot.paint} />
              ))}
            </span>
          );
        }}
      />

      {selected ? (
        <DayAgendaPanel
          items={dayItems}
          paintAccent={paintAccent}
          onOpenCalendar={() =>
            navigate(`/calendar?${CALENDAR_DATE_PARAM}=${selected.toString()}`)
          }
        />
      ) : null}
    </DashboardCard>
  );
}
