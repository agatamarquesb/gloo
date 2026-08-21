import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router';

import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { useSectorColors } from '@/hooks/ui/useSectorColors';
import { PROJECTS_PATH, projectPath } from '@/lib/routes';
import { strings } from '@/strings/pt-BR';

/**
 * How many projects the card will ever show.
 *
 * Four, in two rows of two: the card is a third of the row above the task list
 * and as tall as the month beside it, which is room for two folders stacked and
 * was being spent on two folders and a pool of white under them.
 *
 * A cap rather than a length: the array below happens to be exactly this long,
 * but a projects endpoint will not be, and this is the line that keeps the card
 * two rows tall when it arrives.
 */
const MAX_PROJECTS = 4;

/**
 * The projects the card shows.
 *
 * Written down here rather than fetched, because there is nothing to fetch yet:
 * projects have no table and no endpoint. This is the shape of the section — a
 * name, the run of dates, and what kind of project it is — standing in until
 * there is something real to put in it. The moment a projects endpoint exists
 * this array is the only thing that has to go.
 */
const PROJECTS = [
  {
    id: 'lancamento-verao',
    name: 'Lançamento de verão',
    dates: '10 ago. - 25 ago, 2026',
    kind: strings.projects.kind.launch,
  },
  {
    id: 'rebranding',
    name: 'Rebranding da marca',
    dates: '01 set. - 30 set, 2026',
    kind: strings.projects.kind.brand,
  },
  {
    id: 'id-juliana',
    name: 'ID Juliana',
    dates: '15 set. - 10 out, 2026',
    kind: strings.projects.kind.product,
  },
  {
    id: 'ferramenta-abc',
    name: 'Ferramenta ABC',
    dates: '01 out. - 20 nov, 2026',
    kind: strings.projects.kind.tool,
  },
] as const;

/**
 * How tall the folder's tab is, and how far across it runs.
 *
 * The tab is drawn as a box of its own sitting on top of the body rather than
 * cut out of one shape: a `clip-path` could give the notch but not the rounded
 * corners this app is drawn with, and an SVG outline stretched to a card's width
 * distorts every radius it has. Two boxes keep both — real rounded corners and a
 * real 1px border — and the seam between them disappears because the tab carries
 * the card's own ground and no bottom edge, so it covers the body's top border
 * along the stretch it sits over.
 *
 * The width is a share and not a measurement, so the notch stays a notch at any
 * card width: at half the width it used to have, a fixed tab would have run
 * almost the whole way across and the folder would have stopped reading as one.
 */
const TAB_HEIGHT = 'h-3.5';
const TAB_WIDTH = 'w-[45%]';

/**
 * @param className extra classes for the card's own box — the Dashboard's copy
 * of this card, which is given a fixed height so it ends level with the task
 * list in the column beside it. Left off everywhere else, where the card takes
 * the height of the row it is in.
 */
export function ProjectsCard({ className }: { className?: string } = {}) {
  const navigate = useNavigate();
  const sectorColors = useSectorColors();

  return (
    <DashboardCard
      className={className}
      title={strings.projects.title}
      // The way out, in the corner opposite the heading and on its line.
      //
      // It was at the foot of the folders, which is where "and the rest of them"
      // belongs when there is a pool of white down there to put it in — and
      // there is not any more: four folders now take the whole card. On the
      // heading's line it costs no height at all, and it is where every other
      // card on this page keeps the control that acts on it.
      //
      // Deliberately quiet either way: no border, no ground, the app's smallest
      // type in the app's grey, darkening only under the pointer.
      action={
        <button
          type="button"
          onClick={() => navigate(PROJECTS_PATH)}
          className="flex cursor-pointer items-center gap-0.5 text-[12px] leading-none text-muted transition-colors hover:text-surface-foreground active:text-surface-foreground"
        >
          {strings.projects.seeAll}
          <ChevronRight className="size-3.5" aria-hidden />
        </button>
      }
    >
      {/* Two across and two down, filling whatever height the row hands the card
          — `auto-rows-fr` is what divides that height evenly between the two
          rows rather than letting the folders keep their natural size and leave
          the remainder as white at the bottom.

          `min-h-0` because a grid item's default minimum is its content: without
          it a folder whose name wraps pushes the card taller than the row it is
          in, which is the one thing this layout must not do. */}
      <div className="grid min-h-0 flex-1 grid-cols-2 auto-rows-fr gap-2">
        {PROJECTS.slice(0, MAX_PROJECTS).map((project, index) => (
          <button
            key={project.id}
            type="button"
            onClick={() => navigate(projectPath(project.id))}
            // The tab hangs above the body, so the button's own box starts at the
            // top of the tab and the body below is measured from its edge.
            // `flex` and not `block`, so the body can stretch to the cell.
            className="gloo-rise relative flex w-full flex-col pt-3 text-left"
          >
            <span
              aria-hidden
              className={`absolute left-0 top-0 ${TAB_HEIGHT} ${TAB_WIDTH} rounded-t-lg border border-b-0 border-border bg-surface`}
            />

            {/* The body. Its top-left corner is square, which is where the tab's
                left edge continues into it; every other corner is the app's own
                radius. `-mt-px` laps it under the tab so the two borders meet on
                one pixel rather than doubling up. `flex-1` fills the cell, which
                is what takes the white out of the bottom of the card. */}
            <span className="relative -mt-px flex flex-1 gap-2.5 rounded-2xl rounded-tl-none border border-border bg-surface px-2.5 py-2.5">
              {/* The bar down the left edge, as on every other summary box in the
                  app — see OVERVIEW_BAR. A step of the chart ramp per project, so
                  four folders in a grid are told apart by colour as well as by
                  name. */}
              <span
                aria-hidden
                className="w-1 shrink-0 self-stretch rounded-full"
                style={{ backgroundColor: sectorColors[index % sectorColors.length] }}
              />

              {/* Three lines, each its own fact, a little further apart than
                  they were: at half the width these folders used to have, the
                  name is the one that wraps, and lines set tight enough to read
                  as one block made a wrapped name and the date under it hard to
                  tell apart.

                  No status pill and no faces. Both were the first things to go
                  when the card went to four across: the pill took the width the
                  name needed, and a stack of 20px discs at the foot of a folder
                  this size was decoration standing where a fact could be. */}
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="min-w-0 text-sm font-medium leading-snug text-surface-foreground">
                  {project.name}
                </span>
                <span className="truncate text-xs text-muted">{project.dates}</span>
                {/* What kind of project it is, on its own line under the run of
                    dates rather than trailing it after a dot: two facts on one
                    line is a line that has to be read twice at this width, and
                    the dot between them was the first casualty of the truncation
                    either way. */}
                <span className="truncate text-xs text-muted">{project.kind}</span>
              </span>
            </span>
          </button>
        ))}
      </div>
    </DashboardCard>
  );
}
