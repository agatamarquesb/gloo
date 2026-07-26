import type { ReactNode } from 'react';

import { UserAvatar } from '@/components/common/UserAvatar';
import { useMe } from '@/hooks/queries/auth';

import { useProfileModal } from './ProfileContext';

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  const { data: user } = useMe();
  const profile = useProfileModal();

  return (
    <header className="flex items-center justify-between px-4 py-4 md:px-6">
      <h1 className="text-xl font-semibold text-foreground">{title}</h1>

      <div className="flex items-center gap-3">
        {actions}
        {user ? (
          <button
            type="button"
            onClick={profile.open}
            className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-default"
          >
            <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
            <span className="hidden pr-1 text-sm font-medium text-foreground sm:inline">
              {user.name}
            </span>
          </button>
        ) : null}
      </div>
    </header>
  );
}
