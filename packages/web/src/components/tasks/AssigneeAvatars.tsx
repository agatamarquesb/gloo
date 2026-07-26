import type { UserDto } from '@gloo/shared';

import { UserAvatar } from '@/components/common/UserAvatar';

const MAX_VISIBLE = 4;

/**
 * HeroUI has no avatar-group component, so this stacks its Avatar primitive
 * with overlap + a "+N" overflow indicator, following the same visual
 * pattern used throughout the reference designs.
 */
export function AssigneeAvatars({ assignees }: { assignees: UserDto[] }) {
  const visible = assignees.slice(0, MAX_VISIBLE);
  const overflow = assignees.length - visible.length;

  if (assignees.length === 0) return null;

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((user) => (
        <div key={user.id} className="rounded-full ring-2 ring-surface">
          <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
        </div>
      ))}
      {overflow > 0 ? (
        <div className="flex size-8 items-center justify-center rounded-full bg-default text-xs font-medium text-default-foreground ring-2 ring-surface">
          +{overflow}
        </div>
      ) : null}
    </div>
  );
}
