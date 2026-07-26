import { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

import { useIsDarkMode } from '@/hooks/ui/useIsDarkMode';
import { useTileColors } from '@/hooks/ui/useTileColors';
import { useTasksBySector } from '@/hooks/queries/tasks';
import { CHART_SURFACE } from '@/theme/chartColors';
import { strings } from '@/strings/pt-BR';

import { DashboardCard } from './DashboardCard';
import { sortBySectorOrder } from './sectorOrder';

export function SectorDonutCard() {
  const navigate = useNavigate();
  const isDark = useIsDarkMode();
  const tileColors = useTileColors();
  const { data: unordered = [] } = useTasksBySector();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Slice order is fixed, never by value — a sector keeps its slot and color
  // regardless of how many tasks it has.
  const bySector = useMemo(
    () => sortBySectorOrder(unordered, (entry) => entry.sector.name),
    [unordered],
  );

  const total = bySector.reduce((sum, entry) => sum + entry.pendingCount, 0);
  // Recharts renders nothing for an all-zero dataset; a flat placeholder ring
  // keeps the card's shape instead of collapsing it.
  const slices = total > 0 ? bySector : bySector.map((entry) => ({ ...entry, pendingCount: 1 }));

  return (
    <DashboardCard title={strings.dashboard.openBySector}>
      {/* Container query, not a viewport breakpoint: this card sits in a narrow
          column on wide screens and full-width on phones, so it has to lay out
          against its own width or the long sector names get truncated.

          flex-1: this card shares a grid row with Routines and stretches to that
          card's height. The content claims that height rather than sitting at the
          top and leaving the slack as a gap underneath. */}
      <div className="@container flex flex-1">
        {/* Chart left, sector list right. The row kicks in at a container width
            this card always clears in its Dashboard slot; below that — a phone in
            portrait — it still stacks rather than crushing the sector names. */}
        <div className="flex w-full flex-1 flex-col items-center gap-4 @[16rem]:flex-row @[16rem]:items-stretch">
        {/* Back to 8rem: measured, the sector list needs ~137px for "Marketing &
            Aquisição" to stay on one line at this card's ~330px, and a 9rem chart
            left only 105px. */}
        <div className="relative size-32 shrink-0 self-center">
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
                // Rounds each slice's four corners. Needs the padding angle above
                // to have somewhere to round into, which is why it isn't larger.
                cornerRadius={8}
                isAnimationActive
                animationDuration={450}
              >
                {slices.map((entry, index) => (
                  <Cell
                    key={entry.sector.id}
                    fill={total > 0 ? tileColors[index % tileColors.length] : 'var(--color-default)'}
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

          {/* Echoes the "Em progresso" summary tile's icon in the donut's hole, on
              a neutral disc. Recessive ink rather than a tile color: the slices
              already carry the palette, and a colored glyph here would read as a
              fifth category. bg-default rather than a literal gray so the disc
              follows the theme. pointer-events-none so it never steals a hover. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-default text-muted">
              <TrendingUp className="size-6" />
            </span>
          </span>
        </div>

        {/* The pills are the legend and the direct labels: identity never rests
            on color alone, which is also what relieves the palette's contrast
            warning on the lighter slots. */}
        {/* min-w-0 lets the pills shrink inside the flex row instead of
            overflowing the card when a sector name is long. */}
        {/* Grouped and centered rather than spread across the full height: the
            even distribution left ~55px between pills, too airy to read as a list. */}
        <ul className="flex w-full min-w-0 flex-1 flex-col justify-center gap-2">
          {bySector.map((entry, index) => (
            <li key={entry.sector.id}>
              <button
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                onClick={() => navigate(`/tasks?sectorId=${entry.sector.id}&status=TODO`)}
                className="flex w-full items-center gap-2 rounded-full border border-border px-2.5 py-2 text-left transition-colors hover:bg-default"
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: tileColors[index % tileColors.length] }}
                />
                <span className="flex-1 text-xs text-foreground">{entry.sector.name}</span>
                <span className="shrink-0 text-xs font-semibold text-foreground">
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
