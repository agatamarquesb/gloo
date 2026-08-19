import { useNavigate } from 'react-router';

import { OverviewChevron } from '@/components/common/OverviewCard';
import { AssigneeAvatars } from '@/components/tasks/AssigneeAvatars';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { useUsers } from '@/hooks/queries/users';
import { useSectorColors } from '@/hooks/ui/useSectorColors';
import { PROJECTS_PATH, projectPath } from '@/lib/routes';
import { strings } from '@/strings/pt-BR';

/**
 * How many projects the card will ever show.
 *
 * A cap rather than a length: the array below happens to be exactly this long,
 * but a projects endpoint will not be, and this is the line that keeps the card
 * two folders tall when it arrives.
 */
const MAX_PROJECTS = 2;

/**
 * The projects the card shows.
 *
 * Written down here rather than fetched, because there is nothing to fetch yet:
 * projects have no table and no endpoint. This is the shape of the section — a
 * name and a status, the run of dates and what kind of project it is, and who is
 * on it — standing in until there is something real to put in it. The moment a
 * projects endpoint exists this array is the only thing that has to go.
 *
 * The people are not invented: the avatars come from the real user list, so the
 * row shows faces this business actually has rather than strangers.
 */
const PROJECTS = [
  {
    id: 'lancamento-verao',
    name: 'Lançamento de verão',
    status: strings.projects.status.inProgress,
    statusClass: 'bg-status-progress text-status-progress-text',
    dates: '10 ago. - 25 ago, 2026',
    kind: strings.projects.kind.launch,
    people: 3,
  },
  {
    id: 'rebranding',
    name: 'Rebranding da marca',
    status: strings.projects.status.todo,
    statusClass: 'bg-status-todo text-status-todo-text',
    dates: '01 set. - 30 set, 2026',
    kind: strings.projects.kind.brand,
    people: 2,
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
 */
const TAB_HEIGHT = 'h-3.5';
const TAB_WIDTH = 'w-[45%]';

export function ProjectsCard() {
  const navigate = useNavigate();
  const sectorColors = useSectorColors();
  const { data: users = [] } = useUsers();

  return (
    <DashboardCard
      title={strings.projects.title}
      // Against the word rather than at the far end of the row: the chevron
      // leads to the projects themselves, so it belongs to the heading that
      // names them. Same treatment every quiet way-out in the app takes — the
      // glyph alone, grey until the pointer is on it.
      titleAction={
        <OverviewChevron
          label={strings.projects.seeAll}
          onClick={() => navigate(PROJECTS_PATH)}
        />
      }
    >
      {/* `flex-1` and `justify-between`, so the folders divide whatever height
          the row's tallest card hands down, rather than stacking at the top with
          a pool of white under them. */}
      <div className="flex min-h-0 flex-1 flex-col justify-between gap-2">
        {PROJECTS.slice(0, MAX_PROJECTS).map((project, index) => (
          <button
            key={project.id}
            type="button"
            onClick={() => navigate(projectPath(project.id))}
            // The tab hangs above the body, so the button's own box starts at the
            // top of the tab and the row below is measured from the body's edge.
            className="gloo-rise relative block w-full pt-3 text-left"
          >
            <span
              aria-hidden
              className={`absolute left-0 top-0 ${TAB_HEIGHT} ${TAB_WIDTH} rounded-t-lg border border-b-0 border-border bg-surface`}
            />

            {/* The body. Its top-left corner is square, which is where the tab's
                left edge continues into it; every other corner is the app's own
                radius. `-mt-px` laps it under the tab so the two borders meet on
                one pixel rather than doubling up. */}
            <span className="relative -mt-px flex gap-3 rounded-2xl rounded-tl-none border border-border bg-surface px-3 py-2.5">
              {/* The bar down the left edge, as on every other summary box in the
                  app — see OVERVIEW_BAR. A step of the chart ramp per project, so
                  three folders in a stack are told apart by colour as well as by
                  name. */}
              <span
                aria-hidden
                className="w-1 shrink-0 self-stretch rounded-full"
                style={{ backgroundColor: sectorColors[index % sectorColors.length] }}
              />

              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                {/* Name on the left, status at the far right — the two things you
                    read about a project before anything else, at opposite ends of
                    the line so the eye can run down either edge. */}
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium text-surface-foreground">
                    {project.name}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] leading-none ${project.statusClass}`}
                  >
                    {project.status}
                  </span>
                </span>

                {/* When it runs and what it is, on one line with a dot between:
                    two facts of the same weight, and neither earns a row. */}
                <span className="truncate text-xs text-muted">
                  {project.dates} • {project.kind}
                </span>

                <AssigneeAvatars assignees={users.slice(0, project.people)} compact />
              </span>
            </span>
          </button>
        ))}
      </div>
    </DashboardCard>
  );
}
