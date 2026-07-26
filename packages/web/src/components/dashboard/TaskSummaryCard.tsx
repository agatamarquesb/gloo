import { CircleCheck, Clock, LayoutList, Plus, TrendingUp } from 'lucide-react';
import { Button } from '@heroui/react';
import { useNavigate } from 'react-router';

import { useTaskSummary } from '@/hooks/queries/tasks';
import { strings } from '@/strings/pt-BR';

import { DashboardCard } from './DashboardCard';

/**
 * Stat tiles, not a chart: four headline counts is a KPI row. Each tile links
 * into the Tasks page with the matching filter already applied.
 *
 * One color per status via the --tile-* tokens in globals.css — the palette's
 * only per-mode colors: the light brand pastels with black text, stepping down to
 * muted variants with white text in dark mode. The text color rides the same
 * token set, so a tile and its ink can never fall out of sync.
 */
const TILES = [
  {
    key: 'upcoming',
    label: strings.dashboard.summary.upcoming,
    icon: LayoutList,
    status: 'TODO',
    tint: 'bg-tile-todo',
  },
  {
    key: 'inProgress',
    label: strings.dashboard.summary.inProgress,
    icon: TrendingUp,
    status: 'IN_PROGRESS',
    tint: 'bg-tile-progress',
  },
  {
    key: 'completed',
    label: strings.dashboard.summary.completed,
    icon: CircleCheck,
    status: 'DONE',
    tint: 'bg-tile-done',
  },
  {
    key: 'overdue',
    label: strings.dashboard.summary.overdue,
    icon: Clock,
    status: 'OVERDUE',
    tint: 'bg-tile-overdue',
  },
] as const;

export function TaskSummaryCard({ onAddTask }: { onAddTask: () => void }) {
  const navigate = useNavigate();
  const { data: summary } = useTaskSummary();

  return (
    <DashboardCard
      title={strings.dashboard.taskSummary}
      action={
        <Button className="rounded-full" onPress={onAddTask}>
          <Plus className="size-4" />
          {strings.task.addTask}
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map(({ key, label, icon: Icon, status, tint }) => (
          <button
            key={key}
            type="button"
            onClick={() => navigate(`/tasks?status=${status}`)}
            className={`flex flex-col gap-3 rounded-2xl p-4 text-left text-tile-foreground transition-transform hover:scale-[1.02] ${tint}`}
          >
            {/* Filled white disc in light mode, white outline in dark, via the
                --tile-icon-* tokens. Same size and edge either way, so the icon
                stays aligned with the count and label and the tiles don't change
                height with the theme. The icon inherits --tile-foreground. */}
            <span className="flex size-9 items-center justify-center rounded-full border border-tile-icon-border bg-tile-icon-backdrop">
              <Icon className="size-5" />
            </span>
            <span className="text-3xl font-semibold">{summary?.[key] ?? '—'}</span>
            <span className="text-sm font-medium">{label}</span>
          </button>
        ))}
      </div>
    </DashboardCard>
  );
}
