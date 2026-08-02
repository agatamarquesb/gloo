import { useMemo, useState } from 'react';
import { getLocalTimeZone, today, type CalendarDate } from '@internationalized/date';
import { useNavigate } from 'react-router';

import { MonthCalendar } from '@/components/common/MonthCalendar';
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
      <MonthCalendar
        ariaLabel={strings.dashboard.calendar}
        focusedValue={focused}
        onFocusChange={setFocused}
        onChange={(date) =>
          navigate(`/tasks?dueDateFrom=${date.toString()}&dueDateTo=${date.toString()}`)
        }
        renderCellExtra={(date) => {
          const sectorIds = bySector.get(date.toString()) ?? [];
          if (sectorIds.length === 0) return null;

          return (
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
          );
        }}
      />
    </DashboardCard>
  );
}
