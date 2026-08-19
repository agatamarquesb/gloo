import { Link } from 'react-router';

import { PageHeader } from '@/components/layout/PageHeader';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { strings } from '@/strings/pt-BR';

/**
 * The page a folder on the Tasks page opens onto — a placeholder, and honestly
 * one.
 *
 * It exists only so that the three project buttons do something: without a route
 * the shell would stay put and the content area would go blank, which reads as a
 * bug rather than as a feature that has not been built. It says what it is and
 * offers the way back, and it should be the first thing deleted when projects
 * become real.
 */
export function ProjectPage() {
  return (
    <div>
      <PageHeader title={strings.projects.soon.title} />

      <div className="px-4 pb-6 md:px-6">
        <DashboardCard hideTitle title={strings.projects.soon.title}>
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted">{strings.projects.soon.body}</p>
            <Link to="/tasks" className="text-sm font-medium text-green-deep underline-offset-4 hover:underline">
              {strings.projects.soon.back}
            </Link>
          </div>
        </DashboardCard>
      </div>
    </div>
  );
}
