import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

import { useIsDarkMode } from '@/hooks/ui/useIsDarkMode';
import { useTasksBySector } from '@/hooks/queries/tasks';
import { CHART_SURFACE, seriesColor } from '@/theme/chartColors';
import { strings } from '@/strings/pt-BR';

import { DashboardCard } from './DashboardCard';

export function SectorDonutCard() {
  const navigate = useNavigate();
  const isDark = useIsDarkMode();
  const { data: bySector = [] } = useTasksBySector();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const total = bySector.reduce((sum, entry) => sum + entry.pendingCount, 0);
  // Recharts renders nothing for an all-zero dataset; a flat placeholder ring
  // keeps the card's shape instead of collapsing it.
  const slices = total > 0 ? bySector : bySector.map((entry) => ({ ...entry, pendingCount: 1 }));

  return (
    <DashboardCard title={strings.dashboard.openBySector}>
      {/* Container query, not a viewport breakpoint: this card sits in a narrow
          column on wide screens and full-width on phones, so it has to lay out
          against its own width or the long sector names get truncated. */}
      <div className="@container">
        <div className="flex flex-col items-center gap-5 @md:flex-row">
        <div className="h-44 w-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="pendingCount"
                nameKey="sector.name"
                innerRadius="62%"
                outerRadius="100%"
                // 2px of surface between slices: the gap does the separating,
                // never a stroke drawn around each mark.
                paddingAngle={2}
                stroke={CHART_SURFACE[isDark ? 'dark' : 'light']}
                strokeWidth={2}
                isAnimationActive
                animationDuration={450}
              >
                {slices.map((entry, index) => (
                  <Cell
                    key={entry.sector.id}
                    fill={total > 0 ? seriesColor(index, isDark) : 'var(--color-default)'}
                    opacity={activeIndex === null || activeIndex === index ? 1 : 0.45}
                    className="cursor-pointer transition-opacity"
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                    onClick={() => navigate(`/tasks?sectorId=${entry.sector.id}&status=TODO`)}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* The pills are the legend and the direct labels: identity never rests
            on color alone, which is also what relieves the palette's contrast
            warning on the lighter slots. */}
        {/* min-w-0 lets the pills shrink inside the flex row instead of
            overflowing the card when a sector name is long. */}
        <ul className="flex w-full min-w-0 flex-1 flex-col gap-2">
          {bySector.map((entry, index) => (
            <li key={entry.sector.id}>
              <button
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                onClick={() => navigate(`/tasks?sectorId=${entry.sector.id}&status=TODO`)}
                className="flex w-full items-center gap-3 rounded-full border border-border px-3 py-2 text-left transition-colors hover:bg-default"
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: seriesColor(index, isDark) }}
                />
                <span className="flex-1 text-sm text-foreground">{entry.sector.name}</span>
                <span className="shrink-0 text-sm font-semibold text-foreground">
                  {entry.pendingCount}
                </span>
              </button>
            </li>
          ))}
        </ul>
        </div>
      </div>
    </DashboardCard>
  );
}
