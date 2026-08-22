import { useState } from 'react';

import { CalendarCard } from '@/components/dashboard/CalendarCard';
import { MyTasksCard } from '@/components/dashboard/MyTasksCard';
import { RoutinesCard } from '@/components/dashboard/RoutinesCard';
import { SectorDonutCard } from '@/components/dashboard/SectorDonutCard';
import { TaskSummaryCard } from '@/components/dashboard/TaskSummaryCard';
import { TimeBlockingCard } from '@/components/dashboard/TimeBlockingCard';
import { ProjectsCard } from '@/components/tasks/ProjectsCard';
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
          {/* The projects, under the timer and the width of the column — the
              same card the Tasks page opens with, so a project is drawn one way
              wherever it appears.

              Given a height rather than left to its contents, because the two
              columns are independent: this is what the task list beside it
              measures (its five-row list plus the card's own header, filter row
              and padding — see LIST_HEIGHT in MyTasksCard), so the right column
              ends level with the left instead of stopping short of it. Only from
              md up, where there are two columns for that to matter; stacked on a
              phone the card takes the height its folders need.

              Six folders at a height of their own, rather than four dividing
              that 548px between them: stretched to fill it they came out at
              twice the size of the same folders on the Tasks page, a name, a
              date and a kind marooned in a box. So the card keeps the height the
              column needs and the folders keep the height *they* need, and the
              gap between the two is left as white under the last row. */}
          <ProjectsCard className="md:h-[548px]" max={6} stretch={false} />
        </div>
      </div>

      {isCreateOpen ? (
        <NewTaskModal onClose={() => setCreateOpen(false)} defaultAssigneeId={me?.id} />
      ) : null}
    </div>
  );
}
