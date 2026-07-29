import { useMemo, useState } from 'react';
import { getLocalTimeZone, today, type CalendarDate } from '@internationalized/date';
import { Calendar } from '@heroui/react';
import { useNavigate } from 'react-router';

import { useSectors } from '@/hooks/queries/sectors';
import { useTasksCalendar } from '@/hooks/queries/tasks';
import { useTileColors } from '@/hooks/ui/useTileColors';
import { strings } from '@/strings/pt-BR';

import { DashboardCard } from './DashboardCard';
import { sortBySectorOrder } from './sectorOrder';

const MAX_DOTS = 3;

function monthRange(focused: CalendarDate) {
  const first = focused.set({ day: 1 });
  const last = first.add({ months: 1 }).subtract({ days: 1 });
  return { from: first.toString(), to: last.toString() };
}

export function CalendarCard() {
  const navigate = useNavigate();
  const [focused, setFocused] = useState<CalendarDate>(() => today(getLocalTimeZone()));
  const tileColors = useTileColors();

  const { from, to } = monthRange(focused);
  const { data: entries = [] } = useTasksCalendar(from, to);
  const { data: sectors = [] } = useSectors();

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

  return (
    <DashboardCard title={strings.dashboard.calendar}>
      <Calendar
        // HeroUI pins .calendar to a fixed w-63/max-w-63, which left the grid
        // short of the card's right edge. Utilities outrank the component layer,
        // so this lets the 7-column grid stretch and the card's own padding
        // become the margin on all four sides.
        className="w-full max-w-full"
        aria-label={strings.dashboard.calendar}
        focusedValue={focused}
        onFocusChange={setFocused}
        onChange={(date) => navigate(`/tasks?dueDateFrom=${date.toString()}&dueDateTo=${date.toString()}`)}
      >
        <Calendar.Header>
          <Calendar.NavButton slot="previous" />
          {/* flex-1 + text-center rather than letting the heading size to its
              text: the month names have different widths, so without this the
              title shifts sideways as you page through the year. */}
          <Calendar.Heading className="flex-1 text-center" />
          <Calendar.NavButton slot="next" />
        </Calendar.Header>
        <Calendar.Grid>
          <Calendar.GridHeader>
            {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
          </Calendar.GridHeader>
          <Calendar.GridBody>
            {(date) => (
              <Calendar.Cell date={date} className="relative">
                {({ formattedDate }) => {
                  const sectorIds = bySector.get(date.toString()) ?? [];
                  return (
                    <>
                      {formattedDate}
                      {sectorIds.length > 0 ? (
                        <span className="pointer-events-none absolute inset-x-0 -bottom-0.5 flex justify-center gap-0.5">
                          {sectorIds.slice(0, MAX_DOTS).map((sectorId) => (
                            <span
                              key={sectorId}
                              className="size-1 rounded-full"
                              style={{
                                backgroundColor:
                                  tileColors[(slotBySector.get(sectorId) ?? 0) % tileColors.length],
                              }}
                            />
                          ))}
                        </span>
                      ) : null}
                    </>
                  );
                }}
              </Calendar.Cell>
            )}
          </Calendar.GridBody>
        </Calendar.Grid>
      </Calendar>
    </DashboardCard>
  );
}
