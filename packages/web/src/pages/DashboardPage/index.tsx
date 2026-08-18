import { useState } from 'react';

import { CalendarCard } from '@/components/dashboard/CalendarCard';
import { MyTasksCard } from '@/components/dashboard/MyTasksCard';
import { RoutinesCard } from '@/components/dashboard/RoutinesCard';
import { SectorDonutCard } from '@/components/dashboard/SectorDonutCard';
import { TaskSummaryCard } from '@/components/dashboard/TaskSummaryCard';
import { TimeBlockingCard } from '@/components/dashboard/TimeBlockingCard';
import { NewTaskModal } from '@/components/tasks/TaskModal';
import { PageHeader } from '@/components/layout/PageHeader';
import { useMe } from '@/hooks/queries/auth';
import { strings } from '@/strings/pt-BR';

export function DashboardPage() {
  const { data: me } = useMe();
  const [isCreateOpen, setCreateOpen] = useState(false);

  return (
    <div>
      <PageHeader title={strings.nav.dashboard} />

      {/* Two independent columns rather than a strict grid, so cards stack
          masonry-style at their natural heights instead of padding out rows. */}
      <div className="grid grid-cols-1 gap-4 px-4 pb-6 md:gap-5 md:px-6 xl:grid-cols-3">
        <div className="flex flex-col gap-4 md:gap-5 xl:col-span-2">
          <TaskSummaryCard />
          {/* Routines and the sector donut share the row under the summary, but
              only at xl where this column is two thirds wide. Splitting them
              earlier squeezed each card to ~260px, narrow enough that the donut
              card gave up its chart-beside-list layout and stacked. */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-5">
            <RoutinesCard />
            <SectorDonutCard />
          </div>
          <MyTasksCard onAddTask={() => setCreateOpen(true)} />
        </div>

        <div className="flex flex-col gap-4 md:gap-5">
          <CalendarCard />
          <TimeBlockingCard />
        </div>
      </div>

      {isCreateOpen ? (
        <NewTaskModal onClose={() => setCreateOpen(false)} defaultAssigneeId={me?.id} />
      ) : null}
    </div>
  );
}
