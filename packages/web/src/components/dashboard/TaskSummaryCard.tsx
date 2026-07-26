import { CircleCheck, Clock, LayoutList, Plus, TrendingUp } from 'lucide-react';
import { Button } from '@heroui/react';
import { useNavigate } from 'react-router';

import { useTaskSummary } from '@/hooks/queries/tasks';
import { strings } from '@/strings/pt-BR';

import { DashboardCard } from './DashboardCard';

/**
 * Stat tiles, not a chart: four headline counts is a KPI row. Each tile links
 * into the Tasks page with the matching filter already applied.
 */
const TILES = [
  {
    key: 'upcoming',
    label: strings.dashboard.summary.upcoming,
    icon: LayoutList,
    status: 'TODO',
    tint: 'bg-secondary text-tertiary',
  },
  {
    key: 'inProgress',
    label: strings.dashboard.summary.inProgress,
    icon: TrendingUp,
    status: 'IN_PROGRESS',
    tint: 'bg-main/25 text-tertiary',
  },
  {
    key: 'completed',
    label: strings.dashboard.summary.completed,
    icon: CircleCheck,
    status: 'DONE',
    tint: 'bg-fourtiary/25 text-tertiary',
  },
  {
    key: 'overdue',
    label: strings.dashboard.summary.overdue,
    icon: Clock,
    status: 'OVERDUE',
    tint: 'bg-danger-soft text-danger-soft-foreground',
  },
] as const;

export function TaskSummaryCard({ onAddTask }: { onAddTask: () => void }) {
  const navigate = useNavigate();
  const { data: summary } = useTaskSummary();

  return (
    <DashboardCard
      title={strings.dashboard.taskSummary}
      subtitle={strings.dashboard.taskSummarySubtitle}
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
            className={`flex flex-col gap-3 rounded-2xl p-4 text-left transition-transform hover:scale-[1.02] ${tint}`}
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-surface/70">
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
