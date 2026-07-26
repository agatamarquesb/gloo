import { useState } from 'react';

import { CalendarCard } from '@/components/dashboard/CalendarCard';
import { MyTasksCard } from '@/components/dashboard/MyTasksCard';
import { RoutinesCard } from '@/components/dashboard/RoutinesCard';
import { SectorDonutCard } from '@/components/dashboard/SectorDonutCard';
import { TaskSummaryCard } from '@/components/dashboard/TaskSummaryCard';
import { TimeBlockingCard } from '@/components/dashboard/TimeBlockingCard';
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal';
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
          <TaskSummaryCard onAddTask={() => setCreateOpen(true)} />
          <MyTasksCard onAddTask={() => setCreateOpen(true)} />
          <SectorDonutCard />
        </div>

        <div className="flex flex-col gap-4 md:gap-5">
          <CalendarCard />
          <RoutinesCard />
          <TimeBlockingCard />
        </div>
      </div>

      <CreateTaskModal
        isOpen={isCreateOpen}
        onClose={() => setCreateOpen(false)}
        defaultAssigneeId={me?.id}
      />
    </div>
  );
}
