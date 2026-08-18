import { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

import { useSectorColors } from '@/hooks/ui/useSectorColors';
import { useTasksBySector } from '@/hooks/queries/tasks';
import { quietSurface } from '@/theme/styleConstants';
import { strings } from '@/strings/pt-BR';

import { DashboardCard } from './DashboardCard';
import { sortBySectorOrder } from './sectorOrder';

export function SectorDonutCard() {
  const navigate = useNavigate();
  const sectorColors = useSectorColors();
  const { data: unordered = [] } = useTasksBySector();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Slice order is fixed, never by value — a sector keeps its slot and color
  // regardless of how many tasks it has.
  const bySector = useMemo(
    () => sortBySectorOrder(unordered, (entry) => entry.sector.name),
    [unordered],
  );

  // Every task the sector has, not only the open ones — see TaskBySectorDto.
  // The slices, the numbers beside them and the routes out of this card all read
  // the same figure, so pressing a sector lands on that sector's whole list
  // rather than on a filter of it.
  const total = bySector.reduce((sum, entry) => sum + entry.totalCount, 0);
  // Recharts renders nothing for an all-zero dataset; a flat placeholder ring
  // keeps the card's shape instead of collapsing it.
  const slices = total > 0 ? bySector : bySector.map((entry) => ({ ...entry, totalCount: 1 }));

  return (
    <DashboardCard title={strings.dashboard.bySector} bodyGap="gap-0">
      {/* Chart over legend, and the chart centred in what is left after the
          legend has taken its two lines — the ring is the card's subject and it
          sits in the middle of it, rather than off to one side of a list.

          flex-1: this card shares a grid row with Routines and stretches to that
          card's height. The content claims that height rather than sitting at the
          top and leaving the slack as a gap underneath. */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        {/* 12rem, up from the 8 it took beside the list: the ring no longer
            shares the card's width with anything, and every other change to this
            card — the taller row, the legend folded onto two lines, the gap under
            the title closed — was spending its space on the chart. */}
        <div className="relative size-48 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="totalCount"
                nameKey="sector.name"
                innerRadius="62%"
                outerRadius="100%"
                // The gap does the separating, never a stroke drawn around each
                // mark — so it is a little wider now that there is no stroke to
                // help it.
                paddingAngle={3}
                // No stroke at all, in either theme. It used to be drawn in the
                // card's own surface to widen that gap, which passes for a gap
                // on white and reads as a hard black outline around every slice
                // on near-black.
                stroke="none"
                strokeWidth={0}
                // Rounds each slice's four corners. Needs the padding angle above
                // to have somewhere to round into, which is why it isn't larger —
                // and 5 rather than 8 because at the ring's new size the fatter
                // radius was rounding a slice's short edge away entirely, leaving
                // lozenges rather than segments of a ring.
                cornerRadius={5}
                // Off, and not by preference: with recharts 3 the entrance
                // animation leaves the sector groups empty — no `path` is ever
                // drawn — as soon as the data changes shape under it, and the
                // chart simply disappears. Verified by toggling this alone.
                isAnimationActive={false}
              >
                {slices.map((entry, index) => (
                  <Cell
                    key={entry.sector.id}
                    fill={total > 0 ? sectorColors[index % sectorColors.length] : 'var(--color-default)'}
                    opacity={activeIndex === null || activeIndex === index ? 1 : 0.45}
                    className="cursor-pointer transition-opacity"
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                    onClick={() => navigate(`/tasks?sectorId=${entry.sector.id}`)}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* The hole, which is where the numbers live now that the legend lists
              names alone: hover a slice and its count is written in the middle of
              the ring it belongs to, right where the eye already is.

              Idle it echoes the "Em progresso" summary tile's icon, in recessive
              ink rather than a sector colour — the slices already carry the
              palette and a coloured glyph here would read as a fifth sector. The
              disc takes a routine row's own light grey, the app's one "raised off
              the card" surface, so the hole reads as part of the page rather than
              as a hole cut in it. pointer-events-none so it never steals the
              hover that is feeding it. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <span
              className={`flex size-20 flex-col items-center justify-center gap-0.5 rounded-full text-muted ${quietSurface}`}
            >
              {activeIndex === null ? (
                <TrendingUp className="size-8" />
              ) : (
                <>
                  <span className="text-lg leading-none font-semibold text-foreground">
                    {bySector[activeIndex]?.totalCount}
                  </span>
                  <span className="text-[0.625rem] leading-none">
                    {strings.dashboard.tasksSuffix}
                  </span>
                </>
              )}
            </span>
          </span>
        </div>

        {/* The legend, under the ring: a dot and a name, and nothing drawn around
            them. The capsule the rows used to wear was what made this a column of
            buttons the width of the card; without it the same four rows fold into
            two lines and the whole block narrows to what the words actually need.

            No counts here either — they moved into the hole, where only the
            sector under the cursor writes one. Four numbers standing permanently
            beside four names had turned the legend into the card's second table,
            competing with the ring for the same fact.

            Column-major, which is what puts Gestão over Comercial and Produto &
            Serviço over Marketing & Aquisição — reading down each column follows
            the fixed sector order, and the pairs that share a line are the ones
            whose names balance.

            `auto-cols-max` sizes each column to its own longest name and the
            block is centred under the ring, rather than the two columns being
            pinned to the card's left edge and its middle: the legend belongs to
            the circle above it and sits on the same axis, and stretched to the
            card's full width it read as a separate list that happened to be in
            the same box. It is also what lets a fifth sector open a third column
            instead of overflowing. */}
        <ul className="grid auto-cols-max grid-flow-col grid-rows-2 justify-center gap-x-6 gap-y-1">
          {bySector.map((entry, index) => {
            const color = sectorColors[index % sectorColors.length];
            const isActive = activeIndex === index;

            return (
            <li key={entry.sector.id}>
              <button
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
                onClick={() => navigate(`/tasks?sectorId=${entry.sector.id}`)}
                className="flex w-full cursor-pointer items-center gap-2 py-1 text-left"
              >
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {/* The name comes up to full ink while its slice is under the
                    cursor — which is what says *this* row is *that* slice, in
                    both directions, now that there is no pill edge to take the
                    slice's colour. Colour rather than weight: a heavier name is
                    a wider one, and the row would nudge its neighbours every
                    time you crossed the chart. */}
                <span
                  className={`flex-1 truncate text-xs transition-colors ${
                    isActive ? 'text-foreground' : 'text-muted'
                  }`}
                  title={entry.sector.name}
                >
                  {entry.sector.name}
                </span>
              </button>
            </li>
            );
          })}
        </ul>
      </div>
    </DashboardCard>
  );
}
